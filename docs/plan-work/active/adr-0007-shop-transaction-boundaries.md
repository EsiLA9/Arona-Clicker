# ADR 0007：Spot 商店交易边界

**状态：🟡 已裁定，待 P1/P2 实现。**
**日期：2026-09-10**

## 背景

Spot 商店需要支持多支付物、动态价格、限购和购买联动。现有 `StateMutationService` 的普通写方法会依次修改状态、更新 `StatsService` 并立即向 `EventBus` 派发事件；因此将扣款、发货和记账逐项调用不能满足失败无可观察副作用的交易要求。

## 决策

1. Shop 是 Spot Function，Function 显式引用 Shop；打开入口必须来自 `SpotFunctionalitySystem.functionalitiesOf()` 的 resolved view。ShopDef 是静态数据包定义，ShopSession 只保存用户意图且不进存档。
2. PurchaseScope 拆为正交的 `lifetime: global | init` 与 `owner: shop | spot`。`owner=shop` 的记录 key 不得带 Spot 身份；`owner=spot` 才以 Spot 为 owner。global 记录放 PlayerState 顶层，init 记录放 per-Init 快照及当前层，并登记 `PER_INIT_FIELD_SPECS`。
3. PurchaseRecord 只持久化 `purchasedQuantity`。Stock 是静态 policy，剩余库存由 policy 减购买量派生；MVP 只支持 unlimited / limited，once 是 limited(1) 的语法糖，不预埋刷新时间字段。
4. checkout 在同一同步调用栈中完成 `plan → commit`，不允许 async gap。每个 checkout 都重新解析 Condition、Reveal、GameNum 单价、库存、支付物和 Offer；同批购物车均以 checkout 前状态验证，不支持 A 解锁 B 后同批购买 B。
5. TransactionPlan 只能包含已解析的确定性数值和 mutation intent：逐 line 保留用于收据的解析结果，先聚合所有资源/物品成本再验证持有量。它不得持有 GameNum、未求值 Condition 或其他动态定义。价格是 `unitCosts`，按 quantity 计算 line cost。
6. 事务预备阶段不得调用会即时写状态、更新统计或 emit 的普通 mutation。提交层必须暂存状态、统计和领域事件；仅在全部 intent 可执行后统一提交并释放事件。失败时 PlayerState、Stats、购买记录和 EventBus 均保持不变，Trigger 不得观察到中间状态。
7. 成功提交后先形成 CommitReceipt，再释放购买领域事实事件。事件 flush 中由 Trigger 产生的新 mutation 属于后续普通 mutation 或新 transaction，不并入原交易。事件粒度采用 **line 级**：一次成功 checkout 在完整提交后为每个购物车 line 释放一个 `shopPurchased` 事件，绝不按 quantity 展开。
8. MVP 的 Offer 仅支持 Item 和 Resource；Price 仅支持资源和 stackable Item。EffectOffer 延后。`onPurchase` 仅能使用能在预备阶段确定性编译为持久 mutation intent 的安全子集，且每个购物车 line 只执行一次并获得 quantity context；UI、Story、Theme、随机和其他不可逆运行时 Effect 不允许进入交易。
9. Reveal、Condition、Stock、余额、数量合法性及 Offer 可执行性分别求值；UI 从只读 view 派生 hidden / locked / available / sold-out 状态。ShopFeed 仅消费 CommitReceipt 或结构化失败原因，不参与交易。

## 实现调查结论

- `src/arona-clicker/state/state-mutation-service.ts` 的写方法会同步调用 Stats 并由私有 `emit()` 立即派发。
- `src/engine/core/event-bus.ts` 只在已处于 `flush()` 期间才入队；普通 emit 会直接 dispatch。因此 P2 不能以“多次普通 mutation + 回滚”为实现。
- `src/engine/effect/trigger-system.ts` 同步消费资源/物品等事件并可再次执行 Effect；延迟事件必须在 transaction 已稳定后才 flush。
- 当前 Trigger DSL 无 shop 事件 kind。P2 新增 `shopPurchased` 后须同步 `GameEvent`、`EVENT_CATALOG`、Trigger 的事件映射与测试。

## 后果

- P2 需要在 StateMutationService 周围或内部提供可复用的 staged transaction 能力；本 ADR 不预设 draft、patch、batch 或 transaction context 的具体结构。
- 购买记录同时影响 global 与 per-Init 状态层，需通过唯一 key resolver 避免 scope 漂移。
- 高风险 Offer 与非持久化 Effect 被刻意推迟，先保证资源 / 堆叠物品交易的原子性。

## 相关路由

- [[docs/plan-work/active/task-0039-spot-shop-transaction-system]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/04-mechanisms/state-mutation]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
