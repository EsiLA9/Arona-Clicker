# docs-830/05-domains/resources-and-commerce — 资源、商店与物品

本文回答：资源与物品如何产出、交易和影响玩家状态。

## 主要路径

```text
Tick / 领域奖励 → 资源或物品写入
商店购买 → 条件与库存校验 → 成本 / 奖励一次提交 → 购买事件
使用物品 → 持有与条件检查 → 扣除物品 → 执行使用效果
```

自动资源产出由 [[docs/docs-830/03-runtime/session-and-tick]] 说明。商店的 `ShopService` 根据 Registry 定义计算预览，结算时重新校验库存、条件和支付能力，再把成本、奖励及购买记录交给状态写入服务一次提交。`ItemService` 管理物品发放、消耗和掉落表；物品定义可声明获得或使用时执行的效果。

商店预览不是扣款凭据：预览和提交之间状态可能变化，`checkout()` 会重新解析购物车，并校验商店是否由当前 Spot 提供、购买条件、每项库存、数量、余额和背包容量。全车校验成功后才调用 `commitShopTransaction()`，一次写入资源/物品差额、购买记录及 `shopPurchased` 事件。任一行失败则不提交整车。

`ShopSession` 只保存界面中的购物车数量，不写入存档；价格、库存和条件均从最新状态重算。物品使用则先核对物品类型、持有数量与使用条件，成功移除后才执行 `useEffects`。掉落表由 `LootSystem` 抽取，交由 `ItemService.giveItem()` 发放结果。

源码入口：`src/arona-clicker/services/economy/shop-service.ts`、`item-service.ts`、`loot-system.ts`、`src/arona-clicker/state/state-mutation-service.ts`。相关测试见 `tests/engine/shop-service.test.ts`。

抽卡是依赖资源与角色状态的独立流程，见 [[docs/docs-830/05-domains/character-and-gacha]]。
