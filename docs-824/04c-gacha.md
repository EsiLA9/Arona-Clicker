# docs-824 — 04c 抽卡结算：卡池 / 保底 / 重复转换

> 原文出处：`04-core-algorithms.md` 三章。`GachaService.roll(poolId, count)`。

## 抽取流程

```text
roll(poolId, count)
 ├─ 校验：卡池存在、货币足够（stop 条件 insufficient-currency）
 ├─ 逐抽：
 │    ├─ 候选 = drawableOf(pool)（排除已满收藏的差分）
 │    ├─ 概率 = 基础权重 × 保底修正（pity 累计）
 │    ├─ 随机命中 → 检查重复：已有该差分 → 转碎片；新 → 入库
 │    └─ pity 计数 +1（SSR 保底阈值命中时必出高稀有度）
 ├─ 扣货币 → 返回结果数组（results: { variantId, duplicate, shards }）
 └─ 发事件：gachaRolled / characterAcquired
```

## 数据模型

- `GachaPoolDef`：{ entries: { variantId, weight }[], currency, pricePerRoll, pityThreshold }；
- Spot 可声明 `gachaPools`（专有卡池），无则仅全局通用卡池；
- `gachaState`：{ pity: number, pulls: number } 持久化在 PlayerState。

## 重复转换

- 重复差分不重复入库：返回 `duplicate: true` + `shards`（碎片累计，用于图鉴兑换）；
- 新差分入库：`characters` 收集 + 发 `characterAcquired` 事件（重算色彩解锁）。

## 保底

- 逐抽后检查 `pity >= pityThreshold` → 强制从高稀有度条目中选一个（不消耗保底权重）；
- 保底计数在 `roll` 内独立推进，抽空重置。

---

上一篇：[[docs-824/04b-production]] · 下一篇：[[docs-824/04d-cultivate]]