# 04-mechanisms/state-mutation — 状态写入 4 步管道

> 本文回答：**状态变更如何流经引擎。** 所有状态变更的必经之路（架构纪律 1）；模块卡片见 [[docs/docs-828/02-modules/state-mutation]]。

## 4 步管道

```text
1. 业务门面（service / GameInstance 子门面）做只读校验（canXxx）
2. StateMutationService 写方法：
     ① 改 PlayerState 字段
     ② 同步统计（statsService.record）
     ③ 发对应事件（eventBus.emit）
3. 事件监听器响应（Trigger / Affector / GameNum / UI 订阅）
4. 可选：重建派生数据（visibility / tag 索引 / GameNum 失效）
```

## 单一写入口 StateMutationService

| 方法 | 效果 | 发事件 |
| --- | --- | --- |
| `setResource` / `changeResource` | 设置/增减资源（Global 资源走 globalResources） | `resourceChanged` |
| `setSpotLevel` / `addSpotLevel` | 设施等级 | `spotLevelChanged` |
| `setManager` | 指派 Manager | `managerChanged` |
| `unlockInit` / `addItem` / `addEnhancement` | 解锁世界线/物品/强化 | `initUnlocked` / `itemCollected` / `enhancementAdded` |
| `setFlag` / `setExtra` / `addExtra` / `removeExtra` | 标记/扩展数据 | `flagChanged` / `extraChanged` |
| `acquireCharacter` | 获得差分（重复转碎片） | 角色获得事件（Trigger kind `character` 侦测） |
| `applyExp` / `breakthroughStar` | 培养推进 | `characterProgressChanged`（`domain: 'level'` / `'star'`） |
| `commitShopTransaction` | 已冻结的商店扣费、发货与限购记录一次提交 | 聚合资源/物品事件后逐 CartLine 发 `shopPurchased` |
| `commitSpotTransaction` | Spot 支付扣费与等级变更一次提交 | 资源/物品事件后发 `spotLevelChanged` |

事件名以 `EVENT_CATALOG`（`src/arona-clicker/contracts/event-catalog.ts`）登记为准；事件联合类型位于 `src/engine/types/events.ts`。新增事件必须同时更新两者，编译期穷尽检查。

## Effect 执行（effect-ops）

- `applyEffects(effects)` 逐条 `applyEffect(effect)`：按 `op` 分发到对应写方法；
- 状态层落数据的 13 种：`setResource/addResource/setSpotLevel/addSpotLevel/setManager/addEnhancement/addItem/unlockInit/setFlag/setExtra/addExtra/removeExtra/grantCharacter`；
- 转发类（`loot`/`triggerStory`/`travelToArea`/`setTheme`/聊天流族）在状态层不落数据——演出类经**请求事件**转发（`themeEffectRequested` 等，见 [[docs/docs-828/04-mechanisms/trigger-effect]]）；
- 声明类（`setSpotMaxLevel`/`removeSpotMaxLevel`）不经执行，由 `getSpotMaxLevelOverrides` 动态读取。
- 完整 `EffectOp`（25 种）枚举见 [[docs/docs-828/03-data-structures/declarative-dsl]] §4。

## 为什么不可绕过

- 校验只发生在门面层，但**写状态必须经管道**，保证：统计不错记、事件不漏发、GameNum 失效不遗漏、UI 只读一致性。
- 直接改 `state` 的调用方会导致 GameNum 陈旧读（失效由事件驱动，见 [[docs/docs-828/04-mechanisms/production]]）。

## Shop transaction

- `ShopService` 先按 checkout 当刻状态解析所有 unit price、Offer 与安全 `onPurchase`，聚合资源/物品 delta，再统一验证余额、库存、容量和门控；preview 仅供 UI 显示，绝不作为扣款依据。
- 成功时 `commitShopTransaction` 先完整写入 PlayerState 与购买记录，再记 Stats，最后释放资源/物品事件与每 CartLine 一条 `shopPurchased`。失败交易不会写 State、Stats 或 EventBus。
- 限购事实只存 `globalShopPurchaseRecords` 或当前 Init 的 `shopPurchaseRecords`；scope 的 lifetime 与 owner（shop/spot）共同决定 key。`ShopDef` 本身不保存运行时库存。
- `ShopSession` 仅持有 `entryId + quantity` 的临时 UI 意图；关闭商店立即销毁，不进入 Save。`onPurchase` 目前只开放可在 commit 前编译的静态 `addResource` / `addItem`，并按 CartLine 执行一次。

## Spot transaction

- `SpotService` 在提交前通过只读 `PaymentService` 解析当前等级的支付方案，聚合 Resource / Item 费用并计算缺口；单一可用方案可直接选中，多方案必须显式提供 `paymentOptionId`。
- `commitSpotTransaction` 在一次写入中扣除所有支付项并更新 Spot 等级；失败路径不进入写入口，因此不会产生部分 State、Stats 或 EventBus 变化。成功后按资源、物品、Spot 等级顺序释放事件。
- Spot 解锁必须从 `purchaseOptions` 读取显式价格组，升级必须从目标等级的 `paymentOptions` 读取显式价格组；缺失价格组不会回退为免费或默认信用点支付。Shop 只复用 `CostItem` 的多 Resource / Item 费用项，不引入多方案选择。

## 相关文档

[[docs/docs-828/02-modules/state-mutation]] · [[docs/docs-828/03-data-structures/player-state]]

