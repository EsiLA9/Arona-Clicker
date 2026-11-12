# 示例：购买两份零食

本文沿着 `tests/engine/runtime-content/shop-service.test.ts` 的真实测试数据，观察商店预览、成功结算与余额不足的区别。交易的职责、库存范围和物品服务关系见 [[resources-and-commerce]]。

## 测试内容与前提

测试包声明了一个提供商店功能的 Spot 和商品 `snack`：每份提供 1 个零食，单价为 10 单位 Credit，限购 3 份；购买记录使用 `init × shop` 范围。以下数字是该测试定义，不是所有商店的统一价格。

```text
商品 snack：每份 10 Credit → 1 个零食；同一 Init 内按 Shop 限购 3 份
```

玩家的余额、背包和购买记录属于当前玩家状态；商品价格、货品与购买策略来自 Registry。购物车只表达商品及数量，价格仍要按当前状态解析。

## 情况一：余额足够

测试先将余额设为 30，再向 `checkout()` 提交 `snack × 2`。结算校验通过并提交后：

| 项目 | 提交前 | 提交后 |
| --- | ---: | ---: |
| Credit | 30 | 10 |
| 零食 | 0 | 2 |
| 本商品购买记录 | 无 | 数量 2 |

测试还订阅 `shopPurchased`，监听时看到的余额已是 10。这说明该测试路径的购买事件在交易写入后被观察到；不意味着事件订阅者之后不会产生其他状态变化。

## 情况二：同一购物车余额不足

另一个测试把余额设为 15，并提交两条各买 1 份 `snack` 的购物车行。结算先合并相同商品，得到总费用 20，随后返回 `insufficient-funds`：余额仍是 15，背包没有获得零食，购买记录和 Stats 不变，也没有泄露购买事件。

这个例子展示的是**整车校验失败时不提交该车**。不能据此推断其他领域流程都具有相同事务边界：例如抽卡逐抽检查余额，后续抽取中止时保留已经完成的结果，见 [[character-and-gacha]]。

## 情况三：预览过的价格发生变化

测试将商品价格设为“5 + 当前 Credit”。余额为 10 时预览显示花费 15；余额变为 15 后，结算重新求值为 20，返回 `insufficient-funds`。预览不是价格锁，也不写入存档；`ShopSession` 保存的是临时购物车数量。

## 核对入口

- 定义与结算：`src/arona-clicker/services/economy/shop-service.ts` 的 `preview()`、`checkout()`。
- 状态与事件提交：`src/arona-clicker/state/state-mutation-service.ts` 中的商店事务入口。
- 可执行例子：`tests/engine/runtime-content/shop-service.test.ts` 中“聚合扣款”“支付不足”和“preview 是临时快照”测试。

按项目统一测试入口运行：

```text
npm test -- tests/engine/runtime-content/shop-service.test.ts
```

命令是供读者复验的入口；测试是否在某次文档修改中实际运行，应单独报告。
