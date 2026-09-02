# Spot Shop：空间中的商店

## 定位

商店不是全局 SHOP 菜单，而是 Spot Function。玩家在具体生活节点发现交易地点：

```text
夏莱办公室
├─ 设施升级
├─ 学生配置
└─ 联邦学生会物资终端
      ├─ 信用点采购
      └─ 每日物资
```

可能的落点还有食堂的食材与礼物采购、通讯终端的招募与神名文字兑换。

## Offer 模型

```yaml
offer:
  id: arona_gift
  cost:
    resource: credit
    amount: 5000
  rewards:
    - item: base:item:strawberry_milk
      amount: 1
  stock:
    max: 3
    refresh: daily
```

建议字段：`cost`、`reward`、`condition`、`stock`、`refresh`、`reveal`。奖励复用 Effect，商店本身成为带 Cost、Stock、Condition 的 Effect 执行器。

## Reveal 与库存变化

商店可以经历：

```text
invisible → presence → known → utility → purchaseable
```

商品也可单独 Reveal。库存不只依赖随机刷新，还可由 Spot 等级、生产升级、剧情和世界线进度改变。

四类商店：

| 类型 | 作用 |
| --- | --- |
| 常规商店 | 消耗基础生产资源 |
| 周期商店 | 按日或世界线刷新，制造回访 |
| 角色商店 | 碎片、Variant 与角色培养 |
| 世界线商店 | 当前 Init 特有商品 |

