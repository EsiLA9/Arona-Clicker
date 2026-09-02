# 统一学生获取：Acquisition / Offer

## 核心抽象

不要让 `Gacha → Character` 成为特殊通路，而统一为：

```text
Source
  → Offer / Drop
  → Acquire Variant
  → Ownership Resolver
```

潜在来源包括招募、商店兑换、剧情赠送、世界线奖励、碎片合成、Spot 特殊事件、活动兑换和成就奖励。

## 统一效果

```text
acquireVariant:
  variant: base:shiroko
  duplicatePolicy: fragment
```

Ownership Resolver 的基本决策：

1. 没有 Character：解锁 Character 与 Variant。
2. 有 Character、没有该 Variant：解锁 Variant。
3. 已有该 Variant：执行 Duplicate Reward。

所有状态变更仍应遵守项目的 StateMutationService 单一写入口；本方案只提出领域语义，不改变现有架构纪律。

## Offer 的通用性

Offer 不应只服务商店。卡池 Spark、碎片兑换、剧情奖励都可以表现为带条件、成本和奖励的 Offer，从而统一消费与发放逻辑。

