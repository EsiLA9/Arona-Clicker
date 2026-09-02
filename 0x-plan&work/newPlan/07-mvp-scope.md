# MVP 范围与后续裁定

## MVP 包含

1. Ownership V2：Character Owned、Variant Owned、Character Affection、Variant Development、Duplicate → Eleph。
2. 统一 `AcquireVariant` Effect：招募、商店、剧情全部走同一入口。
3. Spot Shop：Offer、Cost、Reward/Effect、Stock、Condition、Reveal 与简单刷新。
4. Gacha V2：Pool / Banner 分离、Banner 生命周期、Recruitment Point、200 点兑换 Pick Up、重复转 Eleph。
5. 确定性获取：Eleph → Character / Variant；商店出售部分 Eleph；少量剧情直接赠送 Variant。

## 暂不做

- 多种并行角色碎片与复杂兑换层级。
- 大规模随机商店与大量货币。
- 一次性实现所有限定池、学校池、世界线池和特殊票券池。
- 在未完成数据模型裁定前直接扩散到 UI 与完整内容包。

## 建议切片顺序

```text
数据模型关系图
→ Ownership / AcquireVariant
→ Offer / Spot Shop
→ Pool / Banner / Recruitment Point
→ Eleph 确定性获取
→ 空间化 UI 与通讯终端样例
→ 联动剧情与更多内容
```

## 首轮评审问题

- Character / Variant / Development 各自落在哪一层状态，哪些跨 Init 保留？
- `AcquireVariant` 的重复策略是否统一由 Ownership Resolver 决定？
- Offer 与 Effect 的复用边界、成本扣除与失败回滚如何定义？
- Recruitment Point 在 Banner 结束时保留、转化还是清零？
- Eleph 解锁的是 Character、特定 Variant，还是根据目标类型分流？
- Spot 商店的库存由哪些 Reveal / Trigger / Spot 等级驱动？

## 验收方向

先拿“夏莱通讯终端”完成一个端到端样例：首次发现终端、购买招募资源、招募获得 Variant、重复转 Eleph、Eleph 解锁新 Variant、角色参与 Spot，并触发对应剧情。通过该样例后，再把方案拆成正式 ADR、Roadmap 切片和实现任务。

