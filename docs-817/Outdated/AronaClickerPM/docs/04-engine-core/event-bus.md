# EventBus 事件系统

## 概念

EventBus 是引擎内部的事件分发总线。当游戏数据发生变化时，发布事件到总线上，唤醒对此感兴趣的订阅者。

订阅者包括：推荐算法、解锁检测、统计系统、效果系统等。

## 数据结构

```
EventBus:
  - publish(event: GameEvent): void
  - subscribe(type: string, handler: EventHandler): Subscription
  - unsubscribe(sub: Subscription): void

GameEvent:
  - type: string                # 事件类型
  - timestamp: GameTick
  - data: any                   # 事件负载
```

## 事件类型枚举

```
# 资源系统
resource/added          { resource: string, amount: number, newTotal: number, init?: string }
resource/removed        { resource: string, amount: number, newTotal: number, init?: string }
resource/total_changed  { resource: string, totalGained: number, totalConsumed: number, init?: string }

# Spot 系统
spot/purchased          { spot: string, area: string, level: number, cost: ResourceAmount }
spot/upgraded           { spot: string, level: number, cost: ResourceAmount }
spot/produced           { spot: string, productions: ResourceAmount[] }

# Enhancement 系统
enhancement/purchased   { enhancement: string, level: number, cost: ResourceAmount }

# Story 系统
story/started           { story: string, ownerKey: string }
story/talklet_played    { story: string, talkletId: string, label: number }
story/ended             { story: string, ownerKey: string, labels: number[] }
story/modified_state    { story: string, modification: Modification }

# Area 系统
area/entered            { area: string, init: string }
area/explored           { area: string, progress: number }

# Tag 系统
tag/collected           { typeName: string, tag: string, total: number }
tag/triggered           { typeName: string, tag: string, total: number }

# Init 系统
init/changed            { from?: string, to: string }

# 引擎
tick/passed             { tick: number }
```

## 数据流示例

```
Spot 自动产出（每tick）:
  1. AutoProductionCalculator 计算产出
  2. 写入 player.resources
  3. 更新 player.resourceLog（totalGained + perInit）
  4. EventBus.publish("resource/added", ...)
  5. EventBus.publish("resource/total_changed", ...)
  6. EventBus.publish("spot/produced", ...)
  → UnlockChecker 收到事件 → 检查是否有新解锁
  → 推荐算法收到事件 → 按需重新计算权重
  → 统计系统收到事件 → 更新运行时统计

玩家点击聊天按钮:
  1. 计算收益
  2. 写入 player.resources + 更新 resourceLog
  3. EventBus.publish("resource/added", ...)
  4. 若触发 PassiveStory → EventBus.publish("story/started", ...)
  → 各订阅者响应
```

## 参见

- [Engine](engine.md) — TickProcess 中发布事件
- [Tag](1-项目/ACProgram/docs-817/Outdated/AronaClickerPM/docs/02-entity-definition/tag.md) — Tag 统计变化发布事件
- [Player](player.md) — PlayerState 保存的资源/Tag统计数据
