# 批量 Tick 设计方案 (Batch Tick)

> 状态: 策划阶段 | 日期: 2026-08-08

---

## 1. 目标

提供一个 `batchTick(n)` 方法，一次性处理 N 个 tick。区别于逐 tick：

- **逐 tick 调用**：每个 tick 独立 emit `resourceChanged` / `spotProduced` / `tick`，触发 `every:N` 的 trigger 可能按帧间距逐次触发。
- **批量 tick 调用**：N 个 tick 的**资源收益**一次性结算完毕，再**统一通知** EventBus。如此，任何"当下这个时刻我获得了什么"的判断，只会在批量结束后见到**一笔总量**，而不会在一次调用里看到 N 次零散的中间收益。

---

## 2. 核心设计

### 2.1 API

```ts
// GameInstance
batchTick(n: number): BatchTickResult

interface BatchTickResult {
  /** 起始帧号 (调用前) */
  fromFrame: number;
  /** 结束帧号 (调用后) */
  toFrame: number;
  /** 实际执行的 tick 数（可能因产能耗尽提前终止） */
  processedTicks: number;
  /** 按资源聚合的产出 */
  productionSummary: Record<string, number>;
}
```

### 2.2 处理流程

```
batchTick(n):
  ┌─────────────────────────────────────────────┐
  │ ① 保存起始快照 (fromFrame = totalFrames)     │
  │ ② 进入批量模式 (EventBus 抑制)                │
  │                                               │
  │ ┌─ 循环 i: 0..n-1 ─────────────────────────┐ │
  │ │ ③ 执行一个 tick 的生产计算                  │ │
  │ │    - GameNum 路径: evaluateResourceGain     │ │
  │ │    - 旧 Spot 路径: baseYield × multiplier   │ │
  │ │    - 容量限制: min(requested, capacity-current)│ │
  │ │ ④ 累加产量到临时 Map<resource, totalDelta>   │ │
  │ │ ⑤ 推进状态: totalFrames++, 资源值更新        │ │
  │ │    (但不通过 mutations 写，不触发事件)        │ │
  │ │ ⑥ 若本轮全部产出为 0 → 提前终止              │ │
  │ └──────────────────────────────────────────┘ │
  │                                               │
  │ ⑦ 一次性写入所有资源变更 (per resource)        │
  │    → mutations.changeResource(r, totalDelta)  │
  │ ⑧ emit 批量 tick 事件                          │
  │    → { type: 'tick', frame: toFrame, batchSize: n }│
  │ ⑨ 退出批量模式                                 │
  │ ⑩ flush EventBus                             │
  │ ⑪ applyActiveEffects + recompute visibility  │
  └─────────────────────────────────────────────┘
```

### 2.3 关键：容量限制的正确模拟

某些 Spot 有 `baseCapacity`，意味着"当前资源存不下时停产"。因此必须**逐 tick 模拟**，不能在循环外直接 `n × perTickYield`：

```
tick 1: capacity=100, current=90, requested=8 → actual=8,  current→98
tick 2: capacity=100, current=98, requested=8 → actual=2,  current→100 (满)
tick 3: capacity=100, current=100, requested=8 → actual=0,  current=100 (停产)
...
→ 正确 totalDelta = 10，而非 3×8 = 24
```

### 2.4 触发器的批量行为

触发器 `{ on: { kind: 'tick', every: 10 } }` 在批量模式下：

- **不仿真中间帧**。批量结束后 emit 唯一一个 `tick` 事件 `{ frame: toFrame }`。
- `matchesEvent` 中 `event.frame % 10 === 0` 只会被检查**一次**（对最终帧）。
- 这意味着：如果批量跨越了多个"每 10 帧触发点"，也**只触发一次**，且效果作用于最终帧。

> **设计取舍**：这样做简化了批量语义。如果将来需要批量过程中逐点触发，可以引入 `batchOptions: { checkpointEvery?: number }`，使批量内部在 checkpoint 帧处 flush 一次。

---

## 3. EventBus 批量模式

### 3.1 新增机制

在 EventBus 上增加一个 `suppressed` 标志位，独立于现有的 `flushing`：

```ts
class EventBus {
  private suppressed = false;
  private suppressedQueue: GameEvent[] = [];

  /** 进入批量模式，抑制事件分发 */
  enterBatchMode(): void { this.suppressed = true; }

  /** 退出批量模式，可选的 flush 行为 */
  exitBatchMode(): GameEvent[] {
    this.suppressed = false;
    const pending = [...this.suppressedQueue];
    this.suppressedQueue = [];
    return pending;
  }
}
```

`emit()` 逻辑改为：

```
emit(event):
  if suppressed → push to suppressedQueue, return
  if flushing → push to queue, return
  dispatch(event)
```

> `suppressed` 比 `flushing` 更"高": 处于 `suppressed` 时，事件完全不触碰 handler，只进 suppressedQueue。

### 3.2 批量结束后的 flush

```ts
// 退出批量模式后
const pending = eventBus.exitBatchMode();
// pending 中包含所有 suppressed 期间产生的事件
// 但我们不需要重放它们 — 因为我们会 emit 聚合事件
eventBus.emit({ type: 'tick', frame: toFrame, batchSize: n });
eventBus.flush(); // dispatch 聚合的 tick 事件
```

### 3.3 suppressedQueue 的用处

suppressedQueue 暂时留在设计里但**不使用**。如果以后需要从 suppressed 期间的事件中提取信息（如 trigger checkpoint 帧），可以从这里拿。

---

## 4. 各子系统的区别：批量 vs 逐 tick

### 4.1 StateMutationService — 管线拆分

当前 `changeResource` 做三件事：写状态 → 写统计 → emit 事件。批量模式下需要拆开：

```ts
// 新增：只写状态 + 统计，不 emit
changeResourceSilent(resource: string, delta: number): number {
  const state = this.current;
  state.resources[resource] = (state.resources[resource] ?? 0) + delta;
  this.statsService?.recordResourceChange(resource, delta);
  return state.resources[resource];
}
```

批量结束时统一调用原有的 `changeResource`（含 emit）。

### 4.2 TickSystem — 双模式

```ts
// 现有: 执行一次 tick，调用 mutations.changeResource()，emit 事件
tick(): TickResult

// 新增: 执行 N 次 tick，内部逐 tick 累加，不调用 mutations
tickBatch(n: number): {
  productions: Map<string, number>;  // resource → totalDelta
  processedTicks: number;
}
```

`tickBatch` 内部分解为一个 tick 的核心计算逻辑（抽取为 `tickCore()`），剥离 mutate + emit。

### 4.3 StatsService — 批量累加

```ts
// 新增
recordBatchTick(frames: number): void {
  this.stats.global.framesActive += frames;
  this.stats.session.framesInSession += frames;
  // totalFrames 已由 TickSystem 内部推进
}
```

### 4.4 TriggerSystem — 无特殊处理

当前 `matchesEvent` 中 `event.frame % every === 0` 就足够。批量 emit 的 `tick` 事件携带最终帧号，trigger 只检查一次。这是设计上**刻意为之**的行为。

### 4.5 AffectorEngine — 批量后一次性 apply

```ts
// applyActiveEffects 本就在 tick 之后调用，批量模式下同样只执行一次
this.affectorEngine.applyActiveEffects();
this._visibility = this.visibilityEngine.compute(this._state);
```

---

## 5. `tick` 事件的批量标记

```ts
// types.ts 中扩展
| { type: 'tick'; frame: number; batchSize?: number }
```

- `batchSize` 仅批量模式下存在，表示本次事件代表了多少个 tick。
- 逐 tick 调用的 `tick` 事件**不携带** `batchSize`。
- 下游代码可以据此区分：
  - `event.batchSize === undefined` → 这是逐 tick 的事件
  - `event.batchSize > 1` → 这是一次性批量结算

---

## 6. 影响的 GameEvent 类型

| 事件 | 逐 tick 行为 | 批量行为 |
|---|---|---|
| `tick` | 每帧一次 | 批量结束 emit 一次，带 `batchSize` |
| `resourceChanged` | 每帧每种资源一次 | 批量结束每种资源 emit 一次，delta 为总和 |
| `spotProduced` | 每帧每种 Spot 一次 | 批量结束每种 Spot emit 一次，amount 为总和 |
| `affectorStateChanged` | 正常 emit | 批量期间 suppressed，批量后一次性 apply 后正常 emit |

---

## 7. 触发 `every:N` 的等价性讨论

假设逐 tick 调用 50 次 `tick()`：
- 帧号经过 10, 20, 30, 40, 50 → trigger 触发 5 次

假设 `batchTick(50)`：
- 帧号从 0 直接跳到 50 → trigger 检测 `50 % 10 === 0` → **只触发 1 次**

这两种行为**不一致**。这是一个有意的设计取舍：

- 批量模式的目标是一体化结算，而非缩短动画时间的逐帧模拟。
- 如果需要精确仿真中间帧的 trigger 触发，应该使用逐 tick 调用（当前的 `processOfflineProgress` 就是这样做）。
- 批量模式适用于"跳过等待，直接拿到结果"的场景。

> 后续如果需要在批量中保留 trigger checkpoint，可以在 `batchTick(n, { checkpoints: true })` 里，在 checkpoint 帧处暂停累加、flush 一次事件、再继续。

---

## 8. 与现有 `processOfflineProgress` 的关系

`processOfflineProgress` 是**逐 tick 循环**（当前实现）：

```ts
for (let i = 0; i < offlineFrames; i++) {
  const result = this.tick();          // 每帧独立 emit + mutate
  if (result.productions.length === 0) break;
}
this.effectEngine.setState(this._state);
this._visibility = this.visibilityEngine.compute(this._state);
this.eventBus.flush();
```

`batchTick(n)` 是**批量结算**：

```ts
const result = this.tickSystem.tickBatch(n);  // 内部累加，不 emit
// 写资源 + 统计
for (const [resource, totalDelta] of result.productions) {
  this.mutations.changeResource(resource, totalDelta);
}
this.statsService.recordBatchTick(result.processedTicks);
// 一次性 notify
this.eventBus.emit({
  type: 'tick',
  frame: this._state.totalFrames,
  batchSize: result.processedTicks,
});
this.eventBus.flush();
// 收尾
this.affectorEngine.applyActiveEffects();
this._visibility = this.visibilityEngine.compute(this._state);
```

两者**共存**，各有用途：
- `processOfflineProgress`：离线补算，保留 trigger 逐帧精度
- `batchTick(n)`：玩家主动快进 N 帧，一次性结算

---

## 9. 实现清单 (待编码)

| # | 文件 | 改动 |
|---|---|---|
| 1 | `event-bus.ts` | 新增 `suppressed` 模式 + `enterBatchMode/exitBatchMode` |
| 2 | `types.ts` | `TickResult` 扩展 `batchSize?`；新增 `BatchTickResult` |
| 3 | `tick-system.ts` | 抽 `tickCore()`；新增 `tickBatch(n)` |
| 4 | `state-mutation-service.ts` | 新增 `changeResourceSilent()` |
| 5 | `stats.ts` | 新增 `recordBatchTick(frames)` |
| 6 | `game-instance.ts` | 新增 `batchTick(n)` 方法，整合以上模块 |

---

## 10. 测试关注点

- 容量上限 Spot 的批量产出与逐 tick 产出**数值一致**
- 批量结束后 `resourceChanged` 事件只 emit 一次（而非 N 次）
- `tick` 事件携带 `batchSize`
- `every:N` trigger 在批量结束后恰触发一次（当最终帧满足条件时）
- 批量提前终止（全部停产）时 `processedTicks < n`
