# 04-mechanisms/gacha — 抽卡结算：卡池 / 保底 / 重复转换

> 本文回答：**招募（gacha）怎么结算。** `GachaService.roll(poolId, count)`；招募入口在 Spot 的 `gacha` 功能项（不在通讯录，见 [[docs-828/02-modules/character]]）。

## 抽取流程

```text
roll(poolId, count)
 ├─ 校验：卡池存在、货币足够（stop 条件 insufficient-currency）
 ├─ 逐抽：
 │    ├─ 候选 = drawableOf(pool)（排除已满收藏的差分）
 │    ├─ 概率 = 基础权重 × 保底修正（pity 累计）
 │    ├─ 随机命中 → 检查重复：已有该差分 → 转碎片；新 → 入库
 │    └─ pity 计数 +1（保底阈值命中时必出高稀有度）
 ├─ 扣货币 → 返回结果数组（results: { variantId, duplicate, shards }）
 └─ 发事件：gachaRolled / 角色获得（驱动 Trigger kind `character`）
```

## 数据模型

- `GachaPoolDef`：{ mode, currency, costPerPull, rates（稀有度权重表）, featured?（UP 差分，所属稀有度内优先命中）, pity?（保底配置）, 重复返还（缺省全局默认 1 碎片） }；
- Spot 可声明 `gachaPools`（专有卡池），无声明仅开放全局通用卡池（`registry.gachaPools`）；
- `gachaState`：{ pity, pulls } 持久化在 PlayerState（意义引用：按 poolId 存进度副本）。
- `GachaMode` 为代码注册表（当前 `ba-classic`：稀有度权重 roll + UP + 天井），非数据包可插拔。

## 重复转换

- 重复差分不重复入库：返回 `duplicate: true` + `shards`（碎片累计，用于培养突破消耗）；
- 新差分入库：`characters` 收集 + 发角色获得事件（重算色彩解锁等）。

## 保底

- 逐抽后检查 `pity >= pityThreshold` → 强制从高稀有度条目中选一个；
- 保底计数在 `roll` 内独立推进，命中后重置。

## 未接线提示

- `refreshWorldPool`（池关闭成员并入世界 Pool）已实现但无调用点（见 [[docs-828/03-data-structures/id-reference-semantics]] 特别说明 ③）。

## 相关文档

[[docs-828/03-data-structures/character-entities]] · [[docs-828/04-mechanisms/cultivate]]

