# GameEngine（游戏引擎核心）

## 概念

引擎核心负责协调所有子系统，处理游戏循环、自动产出、状态更新等。

## 接口设计

```
GameLoop:
  - tick(): GameTick
  - getTick(): GameTick

TickProcess:
  - 1. 计算所有当前Init&Area内Spot的自动产出
    2. 将产出资源加入 PlayerState.resources
    3. 更新 PlayerState.resourceLog
    4. EventBus.publish("spot/produced", { spotId, amount, ... })
    5. EventBus.publish("resource/added", { resource, amount, ... })
    6. EventBus.publish("resource/total_changed", { resource, total, ... })
     7. Spot 自动发现检查（→ [Spot](../02-entity-definition/spot.md) 自动发现）
       - 遍历当前 Area 所有未发现的 Spot
       - 对每个 Spot 检查 unlockCondition（→ [Value & Condition](../01-foundation/value-condition.md)）
       - 条件满足 → 标记为已发现 → EventBus.publish("spot/discovered", ...)
    8. 检查所有 UnlockCondition（遗留系统，逐步迁移至 Condition）
    9. 更新 Area 探索度（如有自动增长）
    10. EventBus.publish("tick/passed", { tick })

AutoProductionCalculator:
  - 输入: 当前 Init 内所有拥有的 Spot（level > 0）, 所有生效的 Effect
  - 输出: 本次 tick 应获得的 ResourceAmount[]
  - 流程:
    1. 遍历每个 SpotState.level > 0 的 Spot
    2. 检查是否到达产出间隔（currentTick - lastProductionTick >= intervalTicks）
    3. 计算基础产出: baseAmount + (level - 1) × perLevel
    4. 若有 Effect 作用于该 Spot:
       - spot_production_multiply → 产出量 × value
       - spot_production_add → 产出量 + value
       - spot_interval_reduce → 缩短间隔
    5. 汇总所有产出，写入 RuntimeCache.spotProductionCache

SpotDiscoveryChecker:
  - 输入: currentArea, playerState, registry
  - 输出: newlyDiscovered: SpotId[]
  - 触发时机: 每次资源变更后、Area 切换时、读档后
  - 流程:
    1. 获取当前 Area 的所有 SpotDefinition
    2. 过滤 SpotState.level > 0（已拥有）→ 跳过
    3. 过滤 player.areaStates[area].discovered == true → 跳过
    4. 对每个未发现 Spot, 检查 unlockCondition
    5. Condition 求值:
       - 使用 EvaluationContext（player + runtime）
       - 注意 resource_gained 的资源累积量来自 resourceLog
    6. 若为 true → 标记 discovered = true
    7. 发布 Event 并触发聊天通知

GameState:
  - config: GameConfig
  - player: PlayerState
  - tick: GameTick
  - tickRate: number
  - isRunning: boolean

GameConfig:
  - registry: GameRegistry
  - chatConfig: ChatConfig

SaveManager:
  - serialize(state: PlayerState): string
  - deserialize(data: string): PlayerState
  - getSaveSlot(slot: number): SaveSlotInfo

SaveSlotInfo:
  - slot: number
  - lastSaveAt: number
  - playTime: number
  - initName: string
  - initId: string
  - preview: {
      resources: ResourceAmount[]
      topSpots: string[]
      talkCount: number
    }
```

## 参见

- [Player](player.md) — PlayerState 和 GameInstance
- [Spot](spot.md) — 自动产出、购买升级、自动发现
- [Value & Condition](value-condition.md) — 自动发现和 UnlockChecker 使用的 Condition
- [Effect](effect.md) — Spot 产出修正
- [EventBus](event-bus.md) — 引擎通过 EventBus 发布事件
- [三层架构](three-layer.md) — GameInstance 的完整说明
