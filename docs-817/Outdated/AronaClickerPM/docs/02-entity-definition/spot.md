# Spot（产出设备/地标）

## 概念

Spot 是 Area 下的产出设备或迷你地标，代表该区域有特色的地点。升级 Spot 类似于经典放置游戏的购买/升级产出设备。

Spot 的可见性由统一的 [可见性系统](visibility.md) 管理：
1. **自身条件** — `visibility` 字段的 Condition 通过 Trigger 驱动
2. **外部授予** — 其他实体的 Effect（`reveal_entity` / `grant_purchase_access`）直接提升
3. **初始可见** — `visibility` 缺省或为 always 的 Spot 默认可见

**自动发现**是可见性 Lv.3（DescShown）在 Spot 场景下的表现。

玩家**购买** Spot 后获得其产出能力，**升级**可提升产出效率。

## 数据结构

```
SpotDefinition:
  - id: string                         # FullKey: ModName/spot/idName
  - name: string
  - description: string
  - icon: string
  - parentArea: string                 # → [Area](area.md) 的 FullKey
  - productions: ResourceProduction[]  # → [Resource](resource.md) ResourceProduction
  - cost: ResourceCost                 # → [Resource](resource.md) ResourceCost
  - costScaling?: CostScaling          # → [Resource](resource.md) CostScaling
  - maxLevel?: number                  # 空 = 无上限
  - visibility?: Record<1|2|3|4, Condition>  # → [Visibility](visibility.md)
  - unlockCondition?: Condition              # @deprecated 使用 visibility.3 替代
  - effects: string[]                        # → [Effect](effect.md) 的 FullKey 列表

ResourceProduction:
  - resource: ResourceId
  - baseAmount: number
  - intervalTicks: number              # 产出间隔，单位：tick
  - perLevel?: number                  # 每级追加的产出量

CostScaling:
  - base: number                       # 倍率基数
  - exponent: number                   # 指数系数
  # 公式: cost = baseAmount × (base ^ (level × exponent))
```

### CostScaling 公式

```
N 级升到 N+1 级的成本：
  actualCost = cost.amount × (costScaling.base ^ (currentLevel × costScaling.exponent))

示例：
  cost.amount = 10
  costScaling = { base: 1.15, exponent: 1 }

  level 0→1:  10 × (1.15 ^ 0) = 10
  level 1→2:  10 × (1.15 ^ 1) = 11.5 → 12（向上取整）
  level 2→3:  10 × (1.15 ^ 2) = 13.2 → 14
  level 5→6:  10 × (1.15 ^ 5) = 20.1 → 21

若 costScaling 不存在，则每级成本固定为 cost.amount。
```

## 运行时状态

```
SpotState:
  - level: number                        # 当前等级（0=未拥有）
  - lastProductionTick: GameTick         # 上次产出时间
```

## 自动发现（对应可见性 Lv.3）

Spot 在达到可见性 Lv.3（DescShown）之前对玩家**不可见**。

```
发现条件检查时机：
  → 由统一可见性系统处理（→ [Visibility](visibility.md) Condition-Trigger 机制）
  → 条件满足时 EventBus.publish("visibility/changed", { target, newLevel })
  → UI 监听到后刷新，新 Spot 出现
  → 聊天框通知："发现了一个新地点：[Spot Name]"
```

**注意：** 发现（Lv.3）≠ 拥有（Lv.5 Fetched）。发现后 Spot 出现在列表中，玩家仍需消耗资源**购买**才能获得其产出能力。

## 购买与升级流程

### 购买（首次获得，level 0 → 1）

```
前提：Spot 已可见（unlockCondition 满足）

1. 玩家点击 Spot 的"购买"按钮
2. 检查 SpotState.level == 0（确保未拥有）
3. 计算成本: actualCost = cost.amount × (scaling.base ^ (0 × scaling.exponent))
   → 若 costScaling 不存在，成本 = cost.amount
4. 检查 player.resources[cost.resource] >= actualCost
   → 不足 → 提示资源不足，流程终止
5. 扣除资源: player.resources[cost.resource] -= actualCost
6. 设置 SpotState.level = 1
7. 设置 SpotState.lastProductionTick = currentTick
8. 重新计算 Spot 产出率（加入 RuntimeCache.spotProductionCache）
9. 应用 Spot 的 effects（→ 见下方效果更新流程）
10. EventBus.publish("spot/purchased", { spotId, level: 1 })
11. UI 更新：Spot 显示为"已拥有"状态，启用升级按钮
```

### 升级（已有 Spot，level N → N+1）

```
前提：SpotState.level > 0

1. 玩家点击 Spot 的"升级"按钮
2. 若 maxLevel 存在且 level >= maxLevel → 已满级，按钮置灰
3. 计算成本: actualCost = cost.amount × (scaling.base ^ (level × scaling.exponent))
4. 检查 player.resources[cost.resource] >= actualCost
   → 不足 → 提示资源不足，流程终止
5. 扣除资源
6. SpotState.level += 1
7. 重新计算 Spot 产出率
8. 若该 Spot 的效果带有 perLevel → 重新计算 Effect 实例
9. EventBus.publish("spot/leveled_up", { spotId, newLevel })
```

### 产出计算

```
每次 Tick 的实际产出量：

  effectiveAmount = baseAmount + (level - 1) × perLevel
  再经所有生效的 Effect 修正（→ [Effect](effect.md)）

  intervalTicks 不受 Effect 影响（固定间隔）。

  RuntimeCache.spotProductionCache 的更新时机：
    - Spot 购买/升级后立即重算
    - 影响该 Spot 的 Effect 变更时
    - 读档重建时
```

## 效果更新流程

Spot 的 effects 列表在以下时机重新计算：

```
1. Spot 首次购买（level 0 → 1）:
   → 将所有 Effect 实例注册到 RuntimeCache.activeEffects

2. Spot 升级:
   → 若 EffectDefinition 包含 perLevel 字段
   → 重新计算 Effect 实例的 value = baseValue + (level - 1) × perLevel
   → 更新 RuntimeCache.activeEffects

3. Spot 丢失（Init 切换/其他）:
   → 从 RuntimeCache 中移除该 Spot 的所有 Effect

4. Spot 的 Effect 更新后:
   → EventBus.publish("effects/changed", { source: spotId })
   → 依赖该 Effect 的系统（聊天收益、AutoProduction 等）按需重新计算
```

## 行为规则

- Spot 绑定在 Area 下，只能在其所属 Area 被访问时产出
- 自动产出仅运算当前 Init 内的 Spot
- 购买/升级 Spot 消耗资源，每次升级按 CostScaling 公式提升成本
- 无 `maxLevel` 的 Spot 可无限升级（成本持续增长）
- `unlockCondition` 使用统一 [Condition](value-condition.md) 系统（如 `resource_gained` 累计获得量）
- 已发现但未购买的 Spot 不产出，不占用 RuntimeCache 计算资源

## 数据包示例

```json
{
  "id": "arona/spot/crystal_mine",
  "name": "水晶矿",
  "description": "闪闪发光的水晶矿床",
  "parentArea": "arona/area/hometown",
  "productions": [
    {
      "resource": "arona/resource/gold",
      "baseAmount": 5,
      "intervalTicks": 60,
      "perLevel": 2
    }
  ],
  "cost": { "resource": "arona/resource/gold", "amount": 50 },
  "costScaling": { "base": 1.15, "exponent": 1 },
  "maxLevel": 10,
  "unlockCondition": {
    "type": "cmp",
    "op": "gte",
    "left": { "type": "resource_gained_total", "target": "arona/resource/gold" },
    "right": { "type": "const", "value": 200 }
  },
  "effects": ["arona/effect/crystal_boost"]
}
```

## 参见

- [Area](area.md) — 所属区域
- [Resource](resource.md) — 产出和消耗的资源类型
- [Visibility](visibility.md) — Spot 的可见性等级和 Condition-Trigger 机制
- [Value & Condition](value-condition.md) — visibility/效unlockCondition 使用的 Condition
- [Effect](effect.md) — Spot 提供的效果（含 perLevel 倍率；外部可见性授予）
- [Engine](engine.md) — AutoProductionCalculator + 自动发现检查
- [Player](player.md) — PlayerState 中保存 spots 状态
