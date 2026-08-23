# ADR-002 rev2：派生快照的事件驱动失效（EventDrivenReactor 共享基底）

- 状态：**已落地**（rev2 方案于 2026-08-22 实现；PassivePoolCache 顺延、statChanged 事件待做，见文末）
- 日期：2026-08-20（rev1）／2026-08-21（rev2 修订）／2026-08-22（实现落地）
- 关联：`11-passive-tag-selection.md`（ADR-001）、`09-engine-performance.md`（P0-1）、`03-engine-subsystems.md`、`visibility-engine.ts`、`visibility-index.ts`、`trigger-system.ts`、`event-bus.ts`、`affector-engine.ts`

## rev2 修订要点

rev1 起草后引擎已发生两项变化，本版据此校准：

1. **P0-1 已落地**：`TriggerSystem` 不再用 `onAny` 全量扫描，改为按事件类型分桶
   （`ON_KIND_TO_EVENT` + `byType: Map<EventType, Set<triggerId>>`，仅订阅 7 种事件）。
   共享基底必须继承分桶派发，**不能倒退回 `onAny`**。
2. **可见性侧目标架构已基本落地**：`VisibilityEngine` 已实现"反向索引（VisibilityIndex）
   → onAny 标脏 → `getVisibility()` 拉取式增量重算"，且 `tick()`/setInterval 中的无条件
   全量 `compute()` 已删除（rev1 落点第 5 项完成）。剩余问题是该模式与 TriggerSystem
   **平行实现、无共享代码**，且订阅仍走 `onAny`。

因此 rev2 的核心从"引入事件驱动失效"收敛为：**把已验证的模式抽取为共享基底，并让
TriggerSystem / VisibilityEngine / PassivePoolCache / AffectorEngine 四个实例归一**。

## 背景与问题

四个系统都在回答同一个问题——"某事件发生后，哪些声明依赖受影响"——但各自为政：

| 实例 | 依赖来源 | 命中后动作 | 现状 |
| --- | --- | --- | --- |
| TriggerSystem | 作者声明的 `on`（事件类型+实体 ID） | 执行 effects | 已分桶派发（P0-1） |
| VisibilityEngine | 静态分析条件叶子 → 反向索引 | 标脏 + 拉取式重算 | 模式已落地，但与 Trigger 平行实现、仍用 `onAny` |
| PassivePoolCache（ADR-001） | spotTag/manager/flag/area 事件 | 清活跃 tag 缓存 | 未建，计划每次抽选全量派生 |
| AffectorEngine | 无索引 | 每 Tick 全量 recheck（O(实例×entry)） | 结构性挂载走事件，条件新鲜度靠轮询 |

共同短板：**stat 宽依赖**。stat 计数器变化无专属事件（StatsService record 钩子静默），
VisibilityIndex 只能把 stat 依赖归入 `statDeps` 宽集合（任何 STAT_DEP_EVENTS 全部标脏），
AffectorEngine 则因此干脆每 Tick 全量重估。

## 决策

抽出共享基底 `EventDrivenReactor`，四个实例继承它；基底采用**分桶订阅**（与 P0-1 后的
TriggerSystem 同构），命中动作由子类定义。

## 共享基底：`EventDrivenReactor`

```ts
abstract class EventDrivenReactor {
  constructor(protected eventBus: EventBus) {
    // 分桶订阅（同 trigger-system.ts 的 ON_KIND_TO_EVENT 模式），禁止 onAny：
    // 每个 reactor 实例只为自己依赖的事件类型付匹配成本。
    for (const type of this.dependsOnEventTypes()) {
      this.eventBus.on(type, e => this.onEvent(type, e));
    }
  }
  /** 本 reactor 关心的事件类型集合（由子类依赖声明推导）。 */
  protected abstract dependsOnEventTypes(): readonly GameEvent['type'][];
  /** 声明式依赖 → 反向索引（子类构建；世界线切换时重建）。 */
  protected abstract rebuildIndex(): void;
  /** 事件是否命中某条依赖（细粒度：实体 key / 路径前缀 / tag）。 */
  protected abstract matchesDep(dep: Dep, event: GameEvent): boolean;
  /** 命中后动作：trigger=执行 effects；invalidation=标脏；cache=清缓存。 */
  protected abstract onHit(dep: Dep, event: GameEvent): void;

  private onEvent(type: GameEvent['type'], event: GameEvent) {
    for (const dep of this.depsFor(type, event)) {
      if (this.matchesDep(dep, event)) this.onHit(dep, event);
    }
  }
}
```

## 各实例归一后的形态

### 1. TriggerSystem（重构，行为须完全等价）

- `dependsOnEventTypes()` = 现有 7 种映射；`depsFor` = `byType` 桶；
  `matchesDep` = 现有 `matchesEvent`（含 tick every 节流）；`onHit` = 条件求值 + fire。
- once 落账、快照迭代等语义原样保留，测试守护等价性。

### 2. VisibilityEngine（迁移到基底）

- `rebuildIndex` = 现有 `VisibilityIndex.build()`；标脏逻辑不变；
  **订阅从 `onAny` 改为分桶**（其依赖事件类型可由索引静态得出）。
- 拉取式重算契约不变：`getVisibility()` 读时消化 dirty。

### 3. PassivePoolCache（新增，衔接 ADR-001）

- 依赖事件：`spotTagChanged` / `managerChanged` / `flagChanged('char_unlock_*')` /
  `areaEntered`；命中 → 清活跃集合缓存，下次抽选时重新派生。
- 抽选算法改为"读缓存，脏则派生"。

### 4. AffectorEngine（收编轮询）

- 结构性 mount/unmount 维持现有事件逻辑不动。
- entry 条件新鲜度：注册期静态分析各 entry condition 叶子 → 事件反向索引
  （复用 VisibilityIndex 的 `addLeafDep` 提取逻辑，抽为共享工具），
  命中 → 定向 `recheck(instanceId)`，替代 `applyActiveEffects()` 开头的全量 recheck。
- 迁移前置条件：stat 宽依赖收窄（见下），否则对含 stat 条件的实例保留 per-tick 重估
  作为精确回退（按实例粒度降级，不做全局兜底）。

## stat 宽依赖收窄（四实例共同前置）

方案：给 StatsService 的 record 钩子补齐事件通道——在 StateMutationService 的既有
emit 点之后追加 `statChanged { scope, key }` 事件（如 `recordResourceChange` →
`statChanged{scope:'global'|'init'|'run', key:'produced.credit'}`）。注意：

- 该事件频率与 resourceChanged 同阶，**必须并入分桶派发**，且 TriggerSystem/
  Visibility/Affector 中引用 stat 的依赖改挂此事件后即可精确命中。
- 兼容路径：未 emit statChanged 前，stat 依赖维持宽集合/按实例轮询降级，行为不劣化。

## 与 TriggerSystem 的概念对照

| 维度 | TriggerSystem | 派生快照失效器 |
| --- | --- | --- |
| 订阅 | 分桶 `on(type)` | 分桶 `on(type)`（同基底） |
| 依赖模型 | 作者声明 `on`（人工保证与 condition 一致） | 引擎静态提取条件叶子（自动挂靠） |
| 命中后 | 推式执行 effects（立即副作用） | 拉式标脏（读时增量重算，最终一致） |
| 处理时机 | 事件 flush 后 | 事件 flush 后（同） |
| 动态生命周期 | `mount/unmount/group` | `rebuildIndex` 随世界线切换重挂 |

## 落点（代码改动清单）

1. **新增** `src/engine/event-driven-reactor.ts`：分桶订阅版抽象基底。
2. **重构** `trigger-system.ts` 继承基底（行为不变，vitest 守护等价）。
3. **迁移** `visibility-engine.ts` 到基底：去掉 `onAny`，索引/标脏/懒重算逻辑不变。
4. **抽取** visibility-index.ts 的条件叶子→事件映射为共享工具（供 4/5 复用）。
5. **新增** passive-pool-cache.ts 接入基底。
6. **改造** affector-engine.ts：entry 条件定向 recheck；含 stat 条件且 statChanged
   未上线前按实例保留轮询降级。
7. **扩展** stats/state-mutation-service：`statChanged` 事件（独立小步，可后置）。
8. 测试：reactor 基底"仅相关事件触发命中"；visibility"tick 不触发重算"（已有行为回归）；
   passive-pool"spotTagChanged 后池更新"；affector"条件翻转经事件定向 recheck"。

## 已确认决策

- 动态值支持：`flag`/`extra`/`hasTag`/`countTags` 变更均已 emit，反向索引可精确命中。
- 不保留全局兜底全量：完全依赖子事件完备性；降级只发生在**单个实例**粒度
  （如 stat 条件 Affector），不再有系统级每帧/每 Tick 全算。
- 基底必须分桶订阅（rev2 新增，随 P0-1 收敛）。

## 待确认

- ~~基底抽取范围~~：已确认 TriggerSystem 重构为继承基底（测试守护等价）。
- ~~`statChanged` 事件的 payload 形态~~：实现时再定；当前 stat 依赖维持宽依赖/轮询降级。

## 实现落地记录（2026-08-22）

| 落点 | 状态 | 说明 |
| --- | --- | --- |
| 1. `event-driven-reactor.ts` 基底 | ✅ | `subscribeTo` 分桶订阅（幂等）+ 抽象 `onEvent` |
| 2. TriggerSystem 继承基底 | ✅ | 行为等价，全量测试守护 |
| 3. VisibilityEngine 迁移 | ✅ | 去 `onAny`，构造期按 `CONDITION_DEP_EVENT_TYPES` 超集分桶订阅 |
| 4. 共享条件依赖工具 | ✅ | `condition-deps.ts`：`ConditionDepIndex` + 叶子提取 + 实体 key 提取；VisibilityIndex 变薄壳 |
| 5. PassivePoolCache | ⏸ 顺延 | 被动池仍为 v1 平铺模型（无活跃集合派生），无可缓存对象；ADR-001 rev2 落地时再接入 |
| 6. AffectorEngine 定向 recheck | ✅ | mount 时登记 entry 条件依赖 → 事件命中定向 recheck；stat/未知 target 实例转入 `pollingInstances` 每 Tick 重估（applyActiveEffects 仅重估轮询集合） |
| 7. `statChanged` 事件 | ⏳ 待做 | 上线后可把轮询集合收窄为零 |

行为增强：Affector 条件此前仅在同实体事件 + 每 Tick 全量重估下保证新鲜，
现在跨实体依赖（如条件引用其它 spot 等级）也能经事件即时翻转。
测试：`tests/engine/event-driven-reactor.test.ts`（定向翻转 / 跨实体命中 / stat 轮询降级 /
extra 前缀 / tag / unregister）。
