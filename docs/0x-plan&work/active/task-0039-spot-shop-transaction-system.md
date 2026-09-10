# Task 0039：Spot 商店与通用交易系统

状态：🟡 P0–P2 已完成；P3 三栏 Shop workspace 已接入，待浏览器验收与隐式退出路径专项验收

本文回答：如何把 Spot 商店从数据定义、购买记录、交易结算到游戏内 UI 拆成可执行的工程任务，并确保交易失败不会留下半完成状态。

设计草案：[[docs/0x-plan&work/newPlan/09-shop-transaction-draft]]  
上游路线：[[docs/0x-plan&work/active/roadmap-0002-spot-shop]]
上游意见审阅：[[docs/0x-plan&work/active/task-0039-sol-review]]

## 目标

在 Spot Function 中落地一个可扩展的 Shop 系统：

- Shop 是交易环境，挂靠在 Spot 的 Function 上。
- ShopEntry 是交易提案，Offer 表达获得物，Price 表达支付物。
- Condition / Reveal 继续复用现有统一机制。
- Stock、PurchasePolicy 与购买记录分离。
- ShopSession 只承载临时 UI 状态。
- checkout 生成完整 TransactionPlan，验证通过后原子提交。
- 购买结果通过 StateMutationService 所承载的事务提交层写入，并在完整 commit 成功后释放购买领域事件供 Trigger 联动。

本任务完成后，内容作者可以用 Datapack 描述“在哪里、卖什么、付出什么、可以买几次、满足什么条件”，而不需要把普通商品全部写成裸 Effect。

## 不在本任务范围内

- 现实时间、日历系统和跨设备时间校验。
- 实例物品作为货币。
- 同批次商品链式解锁和事务内模拟状态。
- 树状多级商品分类。
- 存档迁移或旧 Entry ID 兼容代码。
- 把完整 Story / Talklet 变成普通 ShopFeed 的必要依赖。
- 其他卡池、角色拥有或碎片经济的独立机制；如商店需要引用这些系统，只接入已经裁定的领域服务。

## 当前事实与代码落点

| 领域 | 当前落点 | 本任务关系 |
| --- | --- | --- |
| Spot Function 注册 | `src/arona-clicker/services/spot-functionality.ts` | 新增 `shop` kind，保持 Spot 可拥有多个功能 |
| Reveal | `src/engine/types/reveal.ts` | 复用 `purchaseable` 等现有揭示语义 |
| Condition | `src/engine/` 表达式与条件相关模块 | 商品可见 / 可购不另建判断系统 |
| Effect / Trigger | `src/engine/effect/`、事件目录 | Offer 的副作用和购买事件复用现有链路 |
| 状态写入 | `src/arona-clicker/state/state-mutation-service.ts` | 扣费、发货、记账必须走单一写入口 |
| 资源 / 物品 | 现有 resource、item service 与 loot 链路 | 第一版 Price 支持资源和 stackable Item |
| UI | `src/ui/` Spot 功能项、panel controller、theme/presentation | ShopSession 临时接管商店布局，退出时销毁 |
| Schema | `src/engine/types/`、`tools/datapack-editor/schema/` | 改实体字段后必须执行 Schema 同步协议 |

施工前必须重新读取：

- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/04-mechanisms/state-mutation]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/schema-sync]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/docs-828/02-modules/ui]]

## 前置裁定

以下事项没有裁定前，不进入正式类型和存档施工：

### C0：Purchase Lifetime & Sharing Scope

将购买记录 scope 拆为两个正交维度：`lifetime: global | init` 与 `owner: shop | spot`，并裁定对应的 global / per-Init 快照 / per-Init 当前存放层。

必须回答：

- 同一个 Shop 被多个 Spot 引用时，购买次数是否共享。
- `once` 是整个存档一次、当前 Init 一次、Shop 一次还是 Spot 一次。
- 购买记录核心字段使用 `purchasedQuantity`，不预埋刷新锚点、最后交易时间等未来 Calendar 字段。
- `owner=shop` 时不得把 `spotId` 混入 key；`owner=spot` 时才使用 Spot 身份。

### C1：交易原子性

先冻结交易的外部可观察性契约，再调查 TransactionPlan 由哪个服务创建、验证和提交，以及 StateMutationService 是否需要 draft、patch、batch 或 transaction context。ADR 不提前指定其中一种工程实现。

必须保证：

- commit 前不产生任何外部可观察的持久副作用。
- commit 成功时 PlayerState、Stats、购买记录一致更新，事件只在成功后释放。
- commit 失败时 PlayerState、Stats 不变，EventBus 不泄露中间 mutation，Trigger 不因失败交易触发。
- deferred event flush 后由 Trigger 产生的新 mutation 不属于原 transaction。
- Offer、Price、Stock、Condition 和事务内行为都在 commit 前完成可执行性检查。
- 成功交易只产生一组完整的购买记录与领域事实事件，不按商品数量拆成 N 次提交。

### C2：事务内行为安全边界

第一版以 Item Offer、Resource Offer 为主；`onPurchase` 与 EffectOffer 只允许在 commit 前可确定性验证、可编译为统一持久状态变更、且不会直接 emit、调用 UI、启动 Story 或执行不可逆外部副作用的行为。EffectOffer 默认延后，或只开放同一安全子集。具体表示方式由实现调查决定，不预先新增公共 capability enum。

### C3：Resolved Functionality 与正交可见状态

Shop 从 resolved SpotFunctionalityView 打开，Function 明确引用 Shop；货架采用 Shop 静态 Entry + Condition / Reveal 门控。discovered、Condition、Stock、affordability、quantity validity、offer executability 分开求值，最终 status 由 View 派生，不让 Reveal 或 Condition 承担完整购买能力。

### C4：Plan、Price 与 Cart 语义

- Price 明确为 `unitCosts`，按 quantity 生成 line cost。
- 所有 line cost 解析后按资源 / Item 聚合，再统一验证持有量。
- TransactionPlan 只含已解析的具体值和确定性 mutation intent，不含未求值 GameNum。
- ShopSession 只保存 `entryId + quantity` 等用户意图，不保存 calculatedPrice、affordable、stock 或 conditionResult。
- MVP 规定 plan → commit 无 async gap；未来若需要异步流程，再引入 stateRevision / expectedRevision。

### C5：Receipt、Feed 与事件粒度

- commit 成功生成 CommitReceipt，ShopFeed 只消费 receipt 或失败 reason，不参与事务。
- `onPurchase` 默认按购物车 line 执行一次并获得 quantity context。
- 购买事件粒度先调查 EVENT_CATALOG 与 Trigger 使用方式；无论选择 checkout 级或 line 级，都只能在整个 transaction 成功后释放。

### 裁定分层

| 层级 | 本任务应冻结的内容 | 不应提前冻结的内容 |
| --- | --- | --- |
| ADR 语义 | Scope 二维模型、commit 前无外部持久副作用、失败不变更、Plan 冻结值、checkout 动态价格、Session 意图、购买数量、事务内行为安全边界、事件成功后释放 | — |
| 实现调查 | StateMutationService / Stats / EventBus / Trigger 的同步、重入与不可回退关系 | draft、patch、batch、transaction context 的具体选型 |
| P1/P2 收敛 | View、Plan、Receipt、失败 reason 和事件字段命名 | 不为命名便利反向改变上述语义 |

## 施工切片

### P0：形成设计裁定与数据边界（✅ 已完成）

- [x] 将 C0–C5 及 C1-a 写入正式 ADR；未裁定项不得通过“先写类型、后补语义”绕过。见 [[docs/0x-plan&work/active/adr-0007-shop-transaction-boundaries]]。
- [x] 确定 ShopDef、ShopEntryDef、ShopOffer、ShopPrice、ShopStock、ShopPurchasePolicy 的字段责任。
- [x] 确定 `ShopEntry.id` 的稳定性政策和引用校验。
- [x] 确定 PurchaseRecord 的 key、二维 scope、`purchasedQuantity` 和状态层归属；不预埋刷新时间字段。
- [x] 确定同批次商品一律以 checkout 前状态判断，不支持 A 解锁 B 后同批次购买 B。
- [x] 确定动态价格采用 checkout snapshot，UI preview 不作为最终扣费依据。
- [x] 调查 StateMutationService → Stats → EventBus → Trigger Reactor 的同步执行、重入和不可回退副作用。
- [x] 调查 C1-a：deferred event flush 阶段由 Trigger 产生的新 mutation 不属于原 transaction。
- [x] 调查 EVENT_CATALOG 的领域事实粒度，决定购买事件采用 checkout 级还是 line 级；确定为完整提交后的 line 级事件。

完成条件：ADR 能独立回答“状态存哪里、谁负责结算、失败如何恢复、记录如何定位、事件何时释放”，但不把 draft / patch 等候选实现误写成架构前提。

### P1：新增 Datapack 定义与 Registry（✅ 已完成）

- [x] 在正确的领域契约位置新增 Shop 及 Entry 类型。
- [x] 注册 `shop` Spot Function，并补 Shop、Section、Entry、Offer、Price 的引用校验。
- [x] 保持 ShopDef 无运行时购买次数和库存字段。
- [x] 保持 Offer 使用 discriminated union；常见对象不通过解析 Effect 推断。
- [x] 支持第一版资源 Cost、stackable Item Cost、Item Offer、Resource Offer；EffectOffer 延后。
- [x] 接入 `condition`、`visibility`、`stock`、`purchase`、`onPurchase`。
- [x] 执行 `npm run gen:schema`，同步 editor extras 与三向一致测试。
- [x] 更新对应 Registry / 数据结构文档，不修改生成产物源文件。

完成条件：最小常规商店 Datapack 能通过 Registry、Schema 和引用校验。

### P2：购买记录与交易服务（✅ MVP 完成）

- [x] 新增只读的 Entry availability / purchase view，汇总 Condition、Reveal、Stock 与购买记录。
- [x] 新增 ShopSession 所需的购物车数据结构，但不把 Session 写入 Save。
- [x] 实现购物车数量变更和价格 preview。
- [x] checkout 时重新 evaluate GameNum 价格。
- [x] 在 commit 前验证 Shop / Entry Condition、购买数量、库存、所有支付物、Offer 执行能力；`onPurchase` 仅开放静态 `addResource` / `addItem` 安全子集，其它效果拒绝。
- [x] 生成已解析、聚合、冻结的执行计划（仅持有数值 map 和购买记录 intent）。
- [x] 通过 StateMutationService 原子提交；验证失败时保持所有持久状态不变。
- [x] 提交完整状态与 Stats 后才释放事件；Trigger 引发的新 mutation 为后续普通 mutation。
- [x] 登记 line 级 `shopPurchased` 事件与 EVENT_CATALOG；不按 quantity 展开。
- [x] 为余额不足、条件失效、库存不足、数量非法和结果不可执行返回结构化原因。

完成条件：服务层可以独立测试成功交易、验证失败和 commit 失败，不依赖 UI。

### P3：Spot Function 与 ShopSession UI（🟡 基础交互完成，待浏览器验收）

- [x] 从 Spot Function 打开 ShopSession，不创建全局 Shop 菜单。
- [x] 实现 Topbar、ShopFeed、Section、Entry cards、购物车、预计消耗和结算区。
- [x] UI 只消费只读查询；数量调整只修改 Session，不能直接写 PlayerState。
- [x] 支持隐藏、锁定、可购买和售罄状态。
- [x] 结算失败时保留购物车并显示结构化失败原因。
- [x] 结算成功后刷新商品状态与持有资源。
- [x] 接入 Shop 临时主题 / presentation，退出时 dispose Session 并恢复 Spot UI。
- [x] 首版 ShopFeed 支持 enter、add、remove、insufficient、checkout 等轻量反馈。
- [ ] 确认非商店 panel、gacha、collection 和其他 Tabs 不被商店布局样式污染。

完成条件：浏览器中可以从 Spot 进入、购买、失败重试并退出商店，临时 UI 状态不进入存档。

### P4：内容样例与专项验收（🟡 浏览器验收待环境恢复）

- [x] 添加 Credit → Item 的常规商店样例。
- [x] 添加 Item → Item 的交换商店样例。
- [x] 添加受 Condition / Reveal 限制的商品样例。
- [x] 添加一次性或有限库存商品样例。
- [x] 覆盖动态 GameNum 价格在 preview 与 checkout 间变化的样例。
- [x] 覆盖同一 Shop 被多个 Spot 引用时的 purchase scope 样例。
- [x] 覆盖退出商店后重新进入，确认购物车丢弃而购买记录保留。

完成条件：样例能说明所有冻结语义，且不依赖隐含的 UI 状态或手工 Save 修改。

## 测试与验收

### 必须覆盖的服务测试

- ShopDef / Entry / Offer / Price 的 schema 与引用校验。
- unlimited、once、limited 的库存判断。
- 每一种已裁定 PurchaseScope 的 key 生成与 Init 切换行为。
- 资源单价、动态 GameNum 单价、复合资源 / Item Price。
- 购物车数量上下限和 maxPerCheckout。
- checkout 时 Condition 失效。
- checkout 时价格变化，最终使用 snapshot。
- 余额不足、库存不足、重复购买、Offer 不可执行。
- 交易失败时支付物、Offer、购买次数、事件和 onPurchase 均不发生变化。
- 成功交易只产生一组聚合扣款、发货、记账和购买事件；不得按商品数量展开事件。
- 多个 CartLine 竞争同一种资源时，先聚合总成本再统一验证余额。
- TransactionPlan / CommitReceipt 的执行字段不含 GameNum、未求值 Condition 或其他动态定义。
- onPurchase 按 line 执行一次并获得 quantity context；不隐式展开为 N 次 Effect。
- deferred event flush 阶段 Trigger 产生的新 mutation 被识别为后续 Mutation / Transaction，不属于原交易。
- 失败交易期间 EventBus、Stats、Trigger 均观察不到中间状态。
- ShopSession 不写入 Save，退出后临时主题与购物车销毁。

### 命令验收

设计与实现完成后至少执行：

```text
npx tsc --noEmit
npm run check:architecture
npm test
npm run build
git diff --check
```

如果新增 Schema 或编辑器字段，还必须执行：

```text
npm run gen:schema
```

并确认生成产物只由命令更新，不手工编辑。

### 浏览器验收

- 从一个真实 Spot 打开商店，确认返回 Spot 后主题和 panel 状态恢复。
- 切换 Section、选择商品、调整数量，确认右栏预览与实际 checkout snapshot 一致。
- 在购物车停留期间改变余额、Condition 或动态价格，确认 checkout 重新验证。
- 模拟结算失败，确认没有扣费、发货、购买记录或成功 Feed。
- 完成复合支付，确认所有支付物一次性扣除，Offer 一次性发放。
- 检查未发现、锁定、可购、售罄四种展示状态。
- 检查窄屏、长商品名、多货币和多条 Feed。
- 检查商店临时主题不污染 Spot、其他 panel 或非商店 Tabs。

## 风险控制

- 不修改 `dist/`、`web-dist/`、`src/ui/dist/`、`node_modules/`。
- 不手工修改 `tools/datapack-editor/schema/engine-defs.gen.json`。
- 不把购买记录写回 ShopDef，不把购物车写入正式存档。
- 不新增 Shop 自己的 Condition / Reveal / 解锁状态系统。
- 不通过 UI 层 try/catch 模拟交易回滚。
- 不在 C0–C5、C1-a 未裁定时扩展 Role、Upgrade、周期刷新或不安全 Effect 等高风险能力。
- 不编写存档迁移或旧 Entry ID 兼容逻辑。
- 保留已有工作树改动，不回滚无关修改。

## 当前核验（2026-09-10）

- 已阅读 [[docs/docs-828/00-INDEX]]、Spot 商店路线图、早期 Spot 商店草案、通用交易系统策划草案和任务文档规范。
- 已确认当前 Spot 商店仍处于待设计裁定，尚无 Shop 实现可作为当前事实。
- 已确认本任务首先阻塞于二维 PurchaseScope、交易外部不可观察性、transaction-safe Effect 边界、Plan 冻结语义、Reveal / Condition 关系和事件粒度调查。
- 已将 Sol 后续审阅意见分层：ADR 冻结语义；事务实现形式、Effect 表示方式和事件粒度通过源码调查决定；命名和 View 字段可在 P1/P2 收敛。
- 已完成 P0 ADR、P1 Datapack / Registry / Schema 与 P2 交易服务；P3 已从 Spot 弹层迁移为三栏 Shop workspace，提供购物车和结算入口。
- 已执行 `npm run gen:schema`、`npx tsc --noEmit`、`npm run check:architecture`、`npm test`（128 文件 / 1199 测试）、`npm run build` 与 `git diff --check`；构建仅保留既有 chunk size warning。
- 浏览器验收入口固定为可直接进入的“主题系统展示 Init”→“气泡、状态与商店样本”，不依赖 Abydos 世界线的解锁流程。

## 剩余工作

- [x] 完成 P0 ADR 裁定。
- [x] 完成 C1 调查：StateMutationService → Stats → EventBus → Trigger Reactor 的同步、重入与不可回退副作用。
- [x] 完成 EVENT_CATALOG 事件粒度调查，并记录 checkout / line 选择依据。
- [x] 根据 ADR 更新 roadmap-0002 状态与本任务字段。
- [x] 完成 P1 定义、Registry、Schema 同步。
- [x] 完成 P2 交易服务与服务测试。
- [x] 修复 workspace 被外部 tick/揭示刷新回普通三栏的问题：`refreshPanels()` 统一先判断当前 workspace。
- [x] 将三栏宿主抽象为 `PanelState.workspace` + `WorkspaceState` 分流入口，Shop 作为首个实现。
- [ ] 完成 P3 UI 与浏览器验收。
- [ ] 完成 P4 内容样例与全量验收。
- [x] 将完成后的机制正文迁移到 docs/docs-828 对应分区，并保留本任务施工记录。

## 相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/04-mechanisms/state-mutation]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/schema-sync]]
- [[docs/docs-828/05-conventions/testing]]
- [[docs/0x-plan&work/newPlan/09-shop-transaction-draft]]
- [[docs/0x-plan&work/active/task-0039-sol-review]]
- [[docs/0x-plan&work/active/roadmap-0002-spot-shop]]
