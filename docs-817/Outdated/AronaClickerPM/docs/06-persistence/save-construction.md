# Save Construction（存档构建机制）

## 概念

存档构建引擎在以下时机触发：
1. **新游戏** — 从头创建 PlayerState
2. **读档** — 从序列化数据重建 RuntimeCache
3. **Init 切换** — 根据继承策略保留/丢弃部分状态

## 新游戏流程

```
1. Init 列表生成：
   ┌─ 遍历 Registry 中所有 InitDefinition
   ├─ 对每个 Init，检查 entryRequirements（→ Condition 系统）
   ├─ 过滤掉不满足条件的 Init
   └─ 展示剩余 Init 供玩家选择

2. 玩家选择 Init：
   ┌─ 创建空 PlayerState
   ├─ 为 Init 内所有 Area 初始化 AreaState：
   │  └─ discovered = false, unlocked = false, explorationProgress = 0
   ├─ startingArea 设为 discovered = true, unlocked = true（初始可见可到达）
   ├─ 设置 player.currentArea = startingArea（初始位置）
   ├─ 执行 Init.startingActions（FuncList，顺序执行）:
   │  └─ play_story 启动 Story 语境（引擎将其作为 ActiveStoryEntry 入口处理）
   │  └─ travel_to_area 可在故事中实时切换 currentArea
   ├─ 执行完毕后验证 currentArea 有效性
   │  └─ 若无效（AreaState.unlocked == false）→ 回退到 startingArea
   └─ 设置 player.currentInit = Init FullKey
```

## 读档流程

```
1. 反序列化 PlayerState（纯 ID + state，无定义数据）

2. 重建 RuntimeCache（Reg-Instance 桥接）：
   ┌─ 遍历 player.enhancements
   │  └─ EnhancementId → Registry.EnhancementDefinition
   │     └─ effects[] → Registry.EffectDefinition
   │        └─ 计算 activeEffects（叠加等级倍率）
   │
   ├─ 遍历 player.spots
   │  └─ SpotId → Registry.SpotDefinition
   │     └─ 计算 spotProductionCache（等级 + 生效 Effect 修正）
   │
   ├─ 重建 passiveStoryEntryCache：
   │  └─ 从 Registry 读取冷却定义 + Instance lastTriggeredAt
   │     └─ 计算剩余冷却
   │
   └─ 若存档时处于故事中：
      └─ 恢复 StoryContext（需额外序列化 currentIndex / labels / flags）

3. 挂接 EventBus：
   └─ 为 Trigger 实例化 Condition 监听（参见 value-condition.md 求值策略）
```

## Reg-Instance 引用可见性

Instance 只存储 ID + 状态，所有定义数据存储在 Registry。

```
例：Enhancement 的效果计算路径

  ┌─ Instance 层 ─────────────────────┐
  │  player.enhancements: {           │
  │    "mod/enh/click_boost": {       │  ← 只存 EnhancementId + level
  │      level: 3, unlocked: true     │
  │    }                              │
  │  }                                │
  └──────────┬───────────────────────-┘
             │ lookup by ID
             ▼
  ┌─ Registry 层 ─────────────────────┐
  │  EnhancementDefinition: {         │
  │    id: "mod/enh/click_boost",     │
  │    effects: ["mod/eff/click_mul"] │  ← 效果引用列表
  │  }                                │
  │  EffectDefinition: {              │
  │    id: "mod/eff/click_mul",       │
  │    type: "chat_reward_multiply",  │
  │    operation: "multiply",         │
  │    value: 0.5,                    │
  │    perLevel: 0.1                  │  ← 每级追加
  │  }                                │
  └──────────┬───────────────────────-┘
             │ compute
             ▼
  ┌─ RuntimeCache 层 ─────────────────┐
  │  activeEffects: [{                │
  │    source: "mod/enh/click_boost", │
  │    type: "chat_reward_multiply",  │
  │    value: 0.5 + 3 × 0.1 = 0.8,   │
  │    ...                            │
  │  }]                               │
  └───────────────────────────────────-┘
```

### 关键原则

- **Registry（定义）** — 存储连接图（Area 属于哪个 Init、Area 连通性、Story 引用等）
- **Instance（状态）** — 存储玩家进度（哪些 Area 已发现/解锁、Spot 等级等）
- **RuntimeCache（计算）** — 从 Instance + Registry 实时计算（不持久化，读档重建）
- Instance 自身不存储任何定义数据的副本，始终依赖 Registry 的只读索引

## Init 切换与全局实体继承

```
切换 Init 时：

  scope = "global" 的 Enhancement:
    → 始终保留（level / unlocked / active 不变）
    → 不受 inheritEnhancements 影响

  scope = "init" 的 Enhancement:
    → 若 inheritEnhancements = true → 保留
    → 若 inheritEnhancements = false → 重置

  persistent = true 的资源:
    → 始终保留当前持有量，不受 inheritResources 影响
    → 用于全局经济：Init 内积累 → 退出 Init → 全局购买页消耗

  persistent = false 的资源:
    → 若 inheritResources = true → 保留
    → 若 inheritResources = false → 重置为 0

  其他非全局 Instance 实体:
    → 根据 Init 定义的 inherit* 字段决定
    → 未继承的实体进入"未拥有"状态（不参与运算，数据保留以备未来恢复）
```

## 休眠机制

当玩家不处于任何 Init 中（全局购买页/Init 选择界面），所有非全局实体进入休眠：

```
休眠规则：
  1. 所有 scope = "init" 的 Spot → 停止自动产出
  2. 所有 scope = "init" 的 Enhancement → Effect 暂停
  3. 仅 scope = "global" 且 active = true 的 Enhancement 持续生效
  4. RuntimeCache.spotProductionCache → 暂停更新
  5. Tick 继续推进，但休眠实体不响应

退出休眠：
  玩家选择 Init 进入 → 恢复所有 Init 内实体的运算 → 重建 productionCache
```

## Init 可见性

新游戏时对所有 Init 做初始过滤：

```
Init 对玩家可见的条件：
  1. entryRequirements 为空 → 始终可见
  2. entryRequirements 满足 → 可见
  3. 已完成的 Init（player.completedInits）→ 可见（可 NG+ 重复进入）
```

## 参见

- [Player](player.md) — PlayerState 数据结构
- [三层架构](three-layer.md) — Reg-Instance 分层规则
- [Init](init.md) — Init 定义和启动流程
- [Area](area.md) — Area 连通与旅行
- [Value & Condition](value-condition.md) — entryRequirements 使用的 Condition
