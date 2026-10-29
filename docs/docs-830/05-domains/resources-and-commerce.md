# docs-830/05-domains/resources-and-commerce — 资源、商店与物品

本文回答：资源与物品如何产出、交易和影响玩家状态。

## 主要路径

```text
Tick / 领域奖励 → 资源或物品写入
商店购买 → 条件与库存校验 → 成本 / 奖励一次提交 → 购买事件
使用物品 → 持有与条件检查 → 扣除物品 → 执行使用效果
```

自动资源产出由 [[session-and-tick]] 说明。商店的 `ShopService` 根据 Registry 定义计算预览，结算时重新校验库存、条件和支付能力，再把成本、奖励及购买记录交给状态写入服务一次提交。`ItemService` 管理物品发放、消耗和掉落表；物品定义可声明获得或使用时执行的效果。

商店预览不是扣款凭据：预览和提交之间状态可能变化，`checkout()` 会重新解析购物车，并校验商店是否由当前 Spot 提供、购买条件、每项库存、数量、余额和背包容量。全车校验成功后才调用 `commitShopTransaction()`，一次写入资源/物品差额、购买记录及 `shopPurchased` 事件。任一行失败则不提交整车。

`ShopSession` 只保存界面中的购物车数量，不写入存档；价格、库存和条件均从最新状态重算。物品使用则先核对物品类型、持有数量与使用条件，成功移除后才执行 `useEffects`。掉落表由 `LootSystem` 抽取，交由 `ItemService.giveItem()` 发放结果。

源码入口：`src/arona-clicker/services/economy/shop-service.ts`、`item-service.ts`、`loot-system.ts`、`src/arona-clicker/state/state-mutation-service.ts`。相关测试见 `tests/engine/shop-service.test.ts`。

抽卡是依赖资源与角色状态的独立流程，见 [[character-and-gacha]]。

## 一次购买如何结算

购物车记录的是“商品 ID 和数量”，不是锁定的价格或库存。`preview()` 根据当前状态聚合同一商品的数量，计算资源和物品的消耗与发放；它不提交状态，也不保证之后仍可成交。`checkout(shopId, spotId, cart)` 在结算时再次读取定义和状态：

1. 检查商店与 Spot 存在、该 Spot 当前提供此商店、商店条件满足；空购物车被拒绝。
2. 合并相同商品行，逐行检查数量、可见性、购买条件、剩余库存和可执行的价格 / 商品效果。
3. 聚合所有行的资源和物品变化，再检查整体支付能力及物品能否接收。
4. 所有检查通过后，`commitShopTransaction()` 一次写入差额和购买记录，并按商品行发出 `shopPurchased`。

因此，预览成功后价格变化，结算仍可能返回 `insufficient-funds`；其中一行不合法也会拒绝整车，不能把预览当成支付保证。检查失败发生在提交前，不应产生该车的部分扣款、发货或购买事件。

支付与容量检查针对整车聚合后的资源和物品**净变化**：同一资产的发放可以抵消成本，并非逐项先验证所有原始成本。商品 `onPurchase` 目前只接受可编译为静态非负资源或物品增量的安全子集；每个聚合商品行处理一次，不随该行购买数量倍增，也不进入 EffectEngine。遇到不支持的效果，结算不能将其当成一般 Effect 继续执行。

一次成功购买、余额不足及预览价格变化的完整例子见 [[shop-transaction-example]]。

库存并非总是“每个界面各一份”。购买记录的 `lifetime` 选择 global 或 Init，`owner` 选择 shop 或 spot；测试展示了同一商店的不同 Spot 在 `init × shop` 范围下共享限购，而 `global × spot` 会分别记录。`once` 库存等同限购 1。具体配置见 `src/data-services/contracts/shop.ts` 和 `ShopService.remaining()`。

## 物品使用与购买的区别

购买是计算整车交易；`ItemService` 的发放 / 使用处理单个物品行为。商店发货通过 `commitShopTransaction()` 直接写入库存，不经过 `ItemService.giveItem()`，因此不能默认套用物品获得效果。使用前要检查定义、持有与条件；扣除成功后执行使用效果。掉落表先计算结果，再交给物品服务发放；不要将“抽出掉落”与“已经写入背包”视为同一阶段。进一步修改时，查 `tests/engine/shop-service.test.ts`、`tests/engine/loot-system.test.ts` 的实际覆盖；测试不能代替核对对应代码分支。
