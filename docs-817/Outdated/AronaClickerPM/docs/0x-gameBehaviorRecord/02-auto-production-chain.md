# 自动产出联动链：产出 → 资源 → 解锁 → 发现

记录时间：2026-06-24

## 概念

自动产出是游戏的核心循环之一：Spot 和其他实体持续产出资源，资源变化触发条件检查，条件满足后解锁/发现新内容。这些环节之间存在多向联动，需要统一设计。

## 产出模型

### 核心设计：按资源类型聚合

```
不是每 Tick 遍历所有 Spot 计算产出，
而是每个 Resource 持有来自所有来源的聚合产出值。
```

### 数据流

```
Spot.productions[]
  + Enhancement.effects[] (spot_production_*)
  + 其他来源
      ↓ 汇总到 Resource
Resource.productionCache (持续产出值，避免每 Tick 重复运算)
      ↓ 每 Tick
PlayerState.resources[ResourceId] += productionCache
      ↓
EventBus 发布事件
```

### 产出缓存（productionCache）

- 每个 Resource 在 RuntimeCache 中保存一个 `productionCache: number`（每 Tick 产出量）
- **更新时机**（增量更新，不全量重算）：
  - Spot 购买/升级时
  - 影响产出的 Effect 变更时
  - Enhancement 购买/开关时
  - Init 切换/读档重建时
- **读取时机**：每 Tick 按 Resource 读取 productionCache，直接累加到 PlayerState

### Spot 与 Resource 的连接

- Spot 定义中的 `productions[]` 声明该 Spot 产出哪些 Resource
- 多个 Spot 可产出同一种 Resource → 在 Resource 层累加
- Effect（`spot_production_multiply` / `spot_production_add`）作用于 Spot 产出后，结果汇入 Resource 的 productionCache

## 联动链全流程

```
每 Tick：
  1. 遍历所有 Resource（当前 Init 内活跃的）
  2. 对每个 Resource，读取 productionCache
  3. PlayerState.resources[res] += productionCache
  4. PlayerState.resourceLog[res].totalGained += productionCache
  5. PlayerState.resourceLog[res].perInit[currentInit].gained += productionCache
  6. EventBus.publish("resource/added", { resource, amount, newTotal })
  7. EventBus.publish("resource/total_changed", { resource, totalGained })

  ↓

Tick 事件触发后：
  8. Condition-Trigger 引擎检查所有等待中的可见性条件
     - 对每个实体的 visibility 条件做求值
     - 条件满足 → 提升该实体的可见性等级
  9. 若新实体被发现/解锁：
     - 通知收件箱（待设计）
     - UI 刷新
```

## 解锁与发现

- **全部由 Condition 定义**：没有硬编码的"资源到 N 解锁 X"的规则
- 可见性系统的 Condition-Trigger 机制负责监听资源变化并自动求值
- 发现的内容可以是任何实体类型：Spot、Area、ActiveStory、PassiveStory 等

## 收件箱（Inbox）

- **当前状态：草稿设计，暂不实现**
- 概念：发现新内容时，除了实时通知外，在收件箱中持久记录
- 收件箱是 UI 层概念，引擎只通过 EventBus 发布事件，收件箱由 UI 层实现
- 玩家可以随时查看收件箱，回顾已发现的内容

## 涉及的系统（跨层引用）

| 层 | 系统 | 角色 |
|---|---|---|
| 01-foundation | Value / Condition | 条件求值、产出量计算 |
| 02-definition | Spot.effects[] | 产出来源声明 |
| 02-definition | Resource | 产出目标、productionCache 持有者 |
| 02-definition | Effect | 产出修正（multiply/add/reduce） |
| 04-engine-core | Tick 循环 | 产出触发 |
| 04-engine-core | EventBus | 事件通知 |
| 04-engine-core | 可见性引擎 | Condition-Trigger 管理 |
