# ResourceSystem（资源系统）

## 概念

资源类型由数据包定义，游戏引擎不硬编码任何资源类型。

## 数据结构

```
ResourceDefinition:
  - id: string                     # FullKey: ModName/resource/idName
  - name: string
  - icon: string
  - description: string
  - category: "currency" | "material" | "special" | "collectible"
  - maxValue?: number              # 上限（null=无上限）
  - persistent?: boolean           # 是否跨 Init 保留，默认 false
                                   # true = 切换 Init 时不重置此资源数量
                                   # 用于全局经济：玩家在 Init 内积累 → 退出 → 全局购买
```

## 资源相关的基础类型

```
ResourceAmount:
  - resource: string               # 资源的 FullKey
  - amount: number

ResourceCost:
  - resource: string               # 资源的 FullKey
  - amount: number
  - scaling?: CostScaling

CostScaling:
  - base: number
  - exponent: number

ResourceProduction:
  - resource: string               # 资源的 FullKey
  - baseAmount: number
  - intervalTicks: number
```

## 参见

- [Spot](spot.md) — Spot 的产出和升级消耗
- [Enhancement](enhancement.md) — Enhancement 的购买消耗
- [Player](player.md) — PlayerState 中的 resources + resourceLog
- [EventBus](event-bus.md) — 资源变动时发布事件
