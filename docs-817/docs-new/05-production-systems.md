# 05 — 产出与结算系统

## TickSystem — 帧循环

游戏的主时钟。每帧（默认 1 秒）驱动整个游戏状态更新。

### 核心机制

```typescript
class TickSystem {
  private interval: number;        // 帧间隔（毫秒），默认 1000
  private timer: ReturnType<typeof setInterval> | null;

  start(): void;   // 启动计时器
  stop(): void;    // 停止计时器
  tick(): void;    // 手动触发一帧（用于离线加速补帧）
}
```

### 每帧执行流程

```
tick() 被调用
  │
  ├─ ① 离线追赶处理
  │   └─ 如果上次帧时间差距 > interval，补中间帧
  │
  ├─ ② state.totalFrames++
  │
  ├─ ③ 冷却更新
  │   └─ 所有 cooldown 减 1，到期删除
  │
  ├─ ④ Spot 结算
  │   └─ 遍历当前 Init 下所有已解锁 Spot (level >= 1)
  │       ├─ a. 计算产量（GameNumSystem.calculateYield）
  │       ├─ b. 检查+更新容量（GameNumSystem.checkCapacity）
  │       ├─ c. 应用 Affector 加成（AffectorEngine）
  │       ├─ d. 写入资源（mutation.addResource）
  │       └─ e. 发射 spotProduced 事件
  │
  ├─ ⑤ Enhancement 检查
  │   └─ 遍历 autoApply 且条件满足的 Enhancement → 自动购买
  │
  ├─ ⑥ 故事检查
  │   └─ 挑选当前可触发的 passive Story（权重随机）
  │
  ├─ ⑦ 自动存档
  │   └─ 每帧调用 save() 持久化到 localStorage
  │
  ├─ ⑧ StatsService.recordTick()  // 记录活跃帧
  │
  └─ ⑨ EventBus.emit({ type: 'tick', frame })
```

## GameNumSystem — 数值计算

负责所有与游戏经济相关的数值计算。

### 产量计算

```typescript
class GameNumSystem {
  /** 计算单个 Spot 的单帧产量 */
  calculateYield(spot: SpotDef, level: number, state: PlayerState): number {
    // 1. 基础产量 = evaluate(baseYield, state)
    // 2. 管理员加成 = manager ? evaluate(managerBonusYield, state) : 0
    // 3. Character 标签加成 = characterSystem.getTagBonus(manager, spot.tags)
    // 4. Enhancement 倍率聚合
    // 5. Spot 功能附加产量 = spotFunc.extraYields(spot, level, state)
    // 6. 总和
  }

  /** 检查容量 */
  checkCapacity(spot: SpotDef, state: PlayerState): {
    capacity: number;       // 当前最大容量
    stored: number;         // 当前已存储
    overflow: boolean;      // 是否溢出
  }
}
```

### 容量系统

每个 Spot 有 `baseCapacity`（最大存储量）。产量会被 `spotStored` 追踪：
- 当 `stored + yield > capacity` 时，产出被容量截断
- 存储量在特定条件下可被清空（如手动收集、切换 Init）
- 容量可通过 Enhancement 或升级增加

## EffectEngine — 效果执行

执行 `GameEffect` 数组。效果有三种操作类型：

### 效果操作 (GameEffect)

```typescript
type GameEffect =
  | { op: 'addResource', target: Resource, value: number }          // 增减资源
  | { op: 'addItem', target: ItemId, value: number }                // 增减物品
  | { op: 'setSpotLevel', target: SpotId, value: number }          // 设置 Spot 等级
  | { op: 'setFlag', target: string, value: string }               // 设置标记
  | { op: 'unlockEnhancement', target: EnhancementId }              // 解锁 Enhancement
  | { op: 'unlockInit', target: InitId }                            // 解锁世界线
  | { op: 'completeStory', target: StoryId }                        // 标记故事完成
  | { op: 'setManager', target: SpotId, value: Character }         // 分配管理员
  | { op: 'applyFunclet', target: FuncletId }                       // 执行函子
  | { op: 'rollDropTable', target: string }                         // 抽选掉落表
  | { op: 'restartInit' }                                           // 软重启
  | { op: 'hardResetInit' }                                         // 硬重置
  | { op: 'noop' }                                                  // 空操作
```

### 核心方法

```typescript
class EffectEngine {
  applyEffects(effects: GameEffect[]): void;
  applySingle(effect: GameEffect): void;
}
```

- `addResource` / `addItem` 通过 `mutation.*` 执行，自动触发统计同步和事件广播
- `rollDropTable` 调用 `LootSystem.rollTable()` 抽选物品，结果再加入背包
- `applyFunclet` 查找 `Registry.funcletDefs` 中的函子定义，执行其 effects

## AffectorEngine — 持续效果

处理持续性的数值修改（如物品附加的被动效果）。

### Affector 工作原理

```
Item / Enhancement 附带 affectorPackId
  → AffectorEngine 从 Registry 查询 AffectorDef
    → 每帧结算时查询 StateMutationService
      → 对匹配的 Spot 产量施加持续性影响
```

### AffectorDef

```typescript
interface AffectorDef {
  id: string;
  packId: string;
  resource: Resource;
  value: Expr;          // 加成量（可动态计算）
  duration?: number;    // 持续帧数（undefined = 永久）
  targets?: SpotId[];   // 作用目标（空 = 全局）
  targetTags?: TagPath[]; // 按标签匹配
}
```

## StatsService — 三层统计

在 02 章已详述其数据模型。此处补充与产出系统的衔接点：

**写入同步（由 StateMutationService 调用）**：
- `recordResourceChange(resource, delta)` — 资源 ± 时同步 produced/consumed
- `recordSpotLevel(old, new)` — 区分解锁/升级，同步计数
- `recordEnhancementUnlocked()` — Enhancement 解锁计数
- `recordStoryCompleted()` — 故事完成计数
- `recordInitUnlocked()` / `recordInitEntered()` — Init 解锁/进入
- `recordTick()` — 活跃帧计数

**三层作用域**：
- **global**: 所有世界线贯穿累计
- **init[initId]**: 每个世界线独立累计
- **session**: 当前一次游玩（从进入世界线到退出/存档加载）
