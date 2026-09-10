# Task 0039 上游意见审阅：Spot 商店与通用交易系统

状态：🟡 UI 移植意见复审完成，建议回填 Shop P3 任务书

本文回答：Sol 针对 Task 0039 的每条修改意见有哪些参考价值、哪些应直接纳入任务、哪些需要收窄或延后，以及它们对当前架构的实际影响。

审阅对象：[[docs/0x-plan&work/active/task-0039-spot-shop-transaction-system]]  
策划基线：[[docs/0x-plan&work/newPlan/09-shop-transaction-draft]]  
代码核验重点：`src/arona-clicker/state/state-mutation-service.ts`、`src/arona-clicker/services/spot-functionality.ts`

## 总体结论

Sol 的意见不是在调整商店字段，而是在指出 Task 0039 当前对“原子交易”的定义还不够严格：

- 当前 `StateMutationService` 的普通 mutation 会立即改状态、更新 Stats 并 emit Event；逐项调用这些方法不能构成真正事务。
- `global / init` 与 `shop / spot` 是两类不同维度，PurchaseScope 应拆成生命周期与共享 owner。
- TransactionPlan 必须是已经解析、聚合、验证后的冻结计划，不能继续携带动态 GameNum 或依赖未验证的 Effect。
- ShopSession、Stock、Reveal、Condition、Feed 都应保持派生/表现职责，不能成为第二套持久状态系统。

建议优先级：

| 优先级 | 意见 | 结论 |
| --- | --- | --- |
| P0，未裁定不得进 P1 | 1 PurchaseScope 二维建模 | 直接采纳 |
| P0，未裁定不得进 P1 | 3 真正的事务提交语义 | 直接采纳，但方案 A/B 需由 ADR 选定 |
| P0，未裁定不得进 P1 | 4 transaction-safe Effect 边界 | 直接采纳，MVP 收窄 EffectOffer |
| P0 | 5 Plan 冻结、6 TOCTOU、7 聚合支付 | 直接采纳 |
| P1 | 8 单价与行价格、9 onPurchase 执行粒度、10 purchasedQuantity | 直接采纳 |
| P1 | 11 Stock 派生、12 状态正交、13 resolved Functionality | 直接采纳 |
| P1 | 14 Session 保存意图、15 Feed 与事务解耦 | 直接采纳 |
| 后置 | 2 刷新字段 | 采纳为“不要预埋”，待未来刷新系统设计 |

## 对 Sol 后续回复的再审阅

本次回复进一步确认：上一轮保留的三项判断点应继续保留，但它们属于“语义先冻结、工程形式后调查”的不同层级，不能把候选实现直接写成 ADR 结论。

### 应由 ADR 冻结的语义

- PurchaseScope 拆为 `lifetime × owner`。
- Transaction 在 commit 前不得产生任何外部可观察的持久副作用。
- 成功 commit 时 PlayerState、Stats、购买记录和成功事件一致完成；失败时 PlayerState、Stats 不变，EventBus 不泄露中间 mutation，Trigger 不因失败交易触发。
- TransactionPlan 必须是解析后的具体值；动态价格在 checkout 重新求值后冻结。
- ShopSession 只保存用户意图，PurchaseRecord 使用 `purchasedQuantity`，派生库存和可购买状态不写入持久记录。
- 事务内行为必须满足可预验证、可转化为统一持久状态变更的安全契约。
- 所有购买事件只能在整个 transaction 成功 commit 后释放。

### 需要调查后决定、ADR 不提前指定实现的事项

1. 事务内部采用 draft / staged transaction、resolved patch / commitBatch，还是在 StateMutationService 中增加 transaction context。
2. transaction-safe Effect 通过 metadata、compiler registry 还是其他机制表达；不在当前阶段强行新增公共 `EffectCapability` 枚举。
3. 购买事件采用 checkout 级、line 级，或 MVP 只选择其中一种；应先检查 EVENT_CATALOG 的领域事实粒度和 Trigger 的 payload 匹配能力。

### 可以在 P1/P2 施工中收敛的细节

- `once` 是否只是 `limited(1)` 的语法糖。
- View、TransactionPlan、CommitReceipt 和失败 reason 的具体字段名与类型名。
- 事件最终命名及 payload 的细节字段。

### C1-a：deferred event flush 的重入边界

事务提交成功后，flush deferred events 可能触发 Trigger，而 Trigger 可能再次调用 StateMutationService。建议冻结以下边界：

```text
Transaction A commit
  → A 成为稳定事实
  → flush A 的事件
  → Trigger 响应
  → 产生普通 Mutation 或 Transaction B
```

Trigger 在事件 flush 阶段产生的新 mutation 不属于 Transaction A。这样可以防止购买、剧情奖励和后续联动无限扩大同一事务，也使失败回滚边界保持清晰。该规则应作为 C1 的子问题和专项测试项。

### 购买事件的当前建议

事件首先表达领域事实，不表达 UI 点击。若 EVENT_CATALOG 与 Trigger 更适合 line 级事实，MVP 可在一次 checkout 全部成功后，为每个购买 line 释放一个事件；若现有事件体系更偏用户动作，则使用一个 checkout 事件携带 lines 集合。

无论最终粒度如何，都必须满足：

```text
完整 transaction 成功
  → 统一 commit 完成
  → 再释放 checkout / line 事件
```

禁止逐 Entry commit、逐 Entry emit，把一个购物车拆成多个可部分成功的交易。

## 逐条审阅

### 1. 将 PurchaseScope 拆成 lifetime × owner

**意见内容**

当前 `global | init | shop | spot` 混合了“保留多久”和“谁共享”两种维度。建议拆为：

```ts
interface PurchaseRecordScope {
  lifetime: "global" | "init";
  owner: "shop" | "spot";
}
```

**参考价值：极高，直接采纳。**

这是当前任务最重要的结构修正。比如“当前 Init 内，同一个 Shop 被两个 Spot 引用时共享一次性购买次数”无法由单枚举自然表达，但 `lifetime=init + owner=shop` 可以直接表达。

建议 Task 0039 的 C0 改为“Purchase Lifetime & Sharing Scope”，并把 key resolver 作为唯一入口：

```ts
interface PurchaseRecordKey {
  lifetime: "global" | "init";
  ownerKind: "shop" | "spot";
  ownerId: string;
  shopId: string;
  entryId: string;
}
```

实现时需确认：`owner=shop` 时不应把 `spotId` 混入 key；`owner=spot` 时才使用 Spot 身份。未来若增加 `entry` owner，可扩展 ownerKind，不改生命周期维度。

**对 Task 0039 的影响**

- C0 原四选一改为二维模型。
- P0 增加 scope 组合矩阵、key resolver 和同 Shop 多 Spot 测试。
- 存档层归属仍需结合三层状态裁定，不能因为二维 key 已明确就跳过状态分层。

### 2. 第一版 PurchaseRecord 不预埋刷新字段

**意见内容**

第一版不实现现实时间、日历和周期刷新，因此 PurchaseRecord 只保存 `count` 或数量字段，不要放 `lastPurchasedAt`、`refreshAnchor`、`lastResetAt`、`period`。

**参考价值：高，采纳为边界约束。**

这能避免未来时间系统尚未裁定时，商店先形成一套隐含的刷新事实标准。统计“最近买了什么”应交给 Stats / Event；周期刷新应等 Calendar / Reset 系统出现后再设计。

但字段名不建议继续使用含义模糊的 `count`，应结合第 10 条采用 `purchasedQuantity`。如果第一版确实需要记录交易次数，也应另设统计，不与库存消耗量混合。

**对 Task 0039 的影响**

- PurchaseRecord MVP 只保存 `purchasedQuantity`。
- 删除任务中“预留刷新锚点和最后交易时间”的开放项。
- `refresh` Stock 类型从 MVP 移出；`once` 可视为 limit=1 的语法糖。

### 3. Transaction 不能只是批量调用 StateMutationService

**意见内容**

当前 mutation 管道是：

```text
修改 PlayerState → 更新 Stats → emit EventBus → Trigger / subscriber
```

因此逐个调用 `removeResource`、`removeItem`、`addItem`、`recordPurchase` 不是原子交易。即使回滚 PlayerState，Stats、Trigger 和订阅者已经观察到中间状态。

**参考价值：极高，必须作为 C1 的硬性裁定。**

代码核验支持这条意见：`StateMutationService.addItem()` 和 `removeItem()` 会直接修改 inventory、调用 `recordItemChange()` 并 emit `itemCollected`。事件目录也明确这些事件会被 Affector、Condition 和 Trigger 等系统消费。

因此“失败时回滚 PlayerState”不足以满足交易原子性。必须禁止交易内部直接使用会立即 emit 的普通 mutation 方法。

**建议**

优先采用 Sol 的方案 A：Draft / staged transaction；方案 B 的 StatePatch / commitBatch 可以作为具体实现形态，但两者都必须满足：

- transaction 阶段不向 EventBus 泄露中间事件；
- Stats 变更暂存，commit 后一次性 flush；
- Trigger 只能看到 commit 后的结果；
- abort 不产生持久状态、Stats 或成功事件。

这里不应直接承诺“swap 整个 PlayerState”，因为现有服务和引用关系未必允许简单替换；ADR 应裁定是 draft state、patch、command log 还是其他实现。

**对 Task 0039 的影响**

- C1 改为“Deferred Event / Stats Transaction Semantics”。
- P2 不得把“调用多个 StateMutationService 方法”当作实现完成。
- 新增事务层专项测试：失败时验证 EventBus、Stats、Trigger 均无中间观察。
- 这项工作可能升级为可复用的通用 Transaction 层，不应只藏在 ShopService 内。

### 4. 引入 transaction-safe Effect 边界

**意见内容**

`onPurchase: Effect[]` 不代表所有 Effect 都能预验证。播放剧情、改变 UI、随机抽取或外部 callback 等操作无法保证 `canExecute` 与 `execute` 的纯函数一致性。建议只允许能编译为确定性 MutationIntent 的 Effect；MVP 可保留 onPurchase，但延后 EffectOffer。

**参考价值：极高，直接采纳且应收窄 MVP。**

这条补上了当前任务“commit 前检查 onPurchase 可执行性”的漏洞。不是所有 Effect 都有稳定的 preflight，也不是所有 Effect 都属于交易持久层。

建议定义能力边界，而不是假设全部 Effect 自动安全：

```text
Effect
  → compile / preflight
  → deterministic MutationIntent[]
  → TransactionPlan
  → commit
```

MVP 建议：

- Item / Resource Offer 先落地。
- `onPurchase` 只允许 transaction-safe、可确定性编译的状态 mutation。
- EffectOffer 暂不纳入 MVP，或仅允许同样经过 compile/preflight 的子集。
- UI、Story、Theme、外部 callback、不可重放随机等 runtime side effect 不得进入原子交易。

随机并非永远不能交易，但必须先有明确的随机 seed / resolution 记录语义；这不应在商店 MVP 中顺手解决。

### 5. TransactionPlan 必须是解析后的冻结计划

**意见内容**

GameNum 只存在于 ShopDef 到 plan 的求值阶段；TransactionPlan 内应是具体数值的 costs / grants，不应继续保存 GameNum。

**参考价值：极高，直接采纳。**

这是“snapshot”概念的必要条件。若 plan 仍保存 GameNum，它仍依赖实时状态，commit 时可能与 preview 或 plan 阶段不同。

建议分成三层：

```text
ShopDef / CartIntent
  → resolve GameNum、Condition、Offer
Resolved TransactionPlan
  → frozen numeric costs / grants / record delta
CommitReceipt
  → actual applied result
```

TransactionPlan 仍可保留来源 Entry ID、展示名称和诊断信息，但所有执行字段必须是已解析的具体值。Condition 不应作为 commit 时才首次求值的动态对象。

### 6. 明确 Plan 创建到 commit 的 TOCTOU 规则

**意见内容**

plan 创建后、commit 前若发生 Tick、Trigger 或其他状态变化，plan 可能过期。第一版可以规定 plan + commit 在同一个同步调用栈内完成；未来再引入 stateRevision。

**参考价值：高，直接采纳“同步无 async gap”作为 MVP 规则。**

这项规则比第一版直接引入 revision 更轻量，也和当前 UI checkout 的同步交互相符。任务应明确：

```ts
checkout(cart): CheckoutResult {
  const plan = plan(cart);
  return commit(plan);
}
```

中间不得 `await)、切换 tick 或执行会把控制权交回 runtime 的操作。

同时要保留未来扩展点：如果交易日后需要异步确认、动画后提交或网络操作，再引入 stateRevision / expectedRevision，并在 commit 时重新验证。

### 7. 复合购物车必须聚合支付

**意见内容**

不能逐 Entry 判断余额。A 和 B 单独都可买，但合计成本可能超过余额。应先解析所有 line，再按资源 / Item 聚合，最后统一验证持有量。

**参考价值：极高，直接采纳。**

这不仅是测试补充，而是交易计划的核心算法：

```text
Cart lines
  → resolve each unit price
  → multiply by quantity
  → normalize
  → aggregate same resource / item
  → validate holdings
```

建议 TransactionPlan 内同时保存 line-level resolution 和 aggregate cost，前者用于收据与 UI，后者用于扣款。聚合必须在 commit 前完成，不能依靠逐行扣款。

### 8. Price 明确为单价，行价格由数量计算

**意见内容**

`amount` 是每件价格还是整行价格存在歧义。第一版应命名为 `unitCosts`，逻辑为 unit price × quantity；折扣和非线性报价另设 pricingPolicy。

**参考价值：高，直接采纳。**

当前存在可变数量，因此不明确单价会导致数据包作者和 UI 对总价产生不同理解。建议第一版：

```ts
interface ShopPrice {
  unitCosts: ShopCost[];
}
```

同一 Entry 的每一单位成本先求值，再乘以 line quantity。折扣、阶梯价、买 N 送一等都不放入隐含 GameNum context，后续另立 pricingPolicy 设计。

### 9. 裁定 onPurchase 的执行粒度

**意见内容**

批量购买 Entry ×10 时，`onPurchase` 是执行一次、十次，还是按 checkout 执行一次不清楚。建议 MVP 按购物车 line 执行一次，并提供 quantity context。

**参考价值：高，建议采纳，但需要写清副作用契约。**

“按 line 一次”能避免批量购买产生十组事件和十次昂贵副作用，也符合交易收据以 line 为单位的设计。

建议：

- 同一 Entry × N 生成一个 PurchaseResolution。
- `onPurchase` 执行一次，获得 quantity context。
- 若按件奖励，数据表达式显式使用 quantity。
- 不允许隐式把一个 line 展开成 N 次 Effect。
- 如果未来需要按件触发，另设明确的 executionMode，不改变默认语义。

购买事件建议按 checkout 或 line 设计，MVP 采用一个 `shopPurchased` 事件携带 `shopId`、`spotId`、`entryId`、`quantity`、聚合 costs、grants 和 receiptId；具体 payload 仍需与 EVENT_CATALOG 规范对齐。

### 10. PurchaseRecord 区分 purchasedQuantity 与 transaction count

**意见内容**

库存限制 10，购买 ×5 时应减少 5；`count` 容易被理解成购买次数。建议核心持久字段使用 `purchasedQuantity`，交易次数另交给 Stats。

**参考价值：高，直接采纳。**

这和 Stock 的“按数量消耗”以及第 9 条 line 语义直接相关。建议：

```ts
interface PurchaseRecord {
  purchasedQuantity: number;
}
```

若产品确实需要统计“发生过几次 checkout”，那属于统计或审计信息，不应与库存决定字段混在 PurchaseRecord 中。

### 11. Stock 是静态 Policy，剩余库存由记录派生

**意见内容**

`once` 可视为 `limited(1)`；运行时不保存 remaining，由 limit - purchasedQuantity 推导。

**参考价值：高，直接采纳，但保留未来刷新扩展边界。**

这能保持 Def、Save、View 三者职责清楚：

```text
ShopStock        = Datapack policy
PurchaseRecord   = persistent fact
ShopAvailability = derived view
```

MVP 不应保存 remaining，因为它可能与购买记录漂移。未来如果出现刷新库存，应增加明确的 Reset / Calendar 事实，而不是把 remaining 直接写入 Save 后再靠猜测同步。

### 12. Reveal 与 Condition 保持正交

**意见内容**

商品的 discovered、conditionSatisfied、stockRemaining、affordable、quantityValid、offerExecutable 是不同状态；UI 再把它们折叠成 hidden / locked / available / sold-out。Reveal 的 purchaseable 不应承担余额或实时购买能力。

**参考价值：极高，直接采纳。**

这能防止 UI 为了显示一个 status 而把多个机制状态揉成单一 availability。建议 ShopEntryView 至少保留：

```ts
interface ShopEntryView {
  visibility: "hidden" | "visible";
  revealStage: RevealStage;
  eligibility: {
    conditionSatisfied: boolean;
    stockAvailable: boolean;
    affordable: boolean;
    offerExecutable: boolean;
  };
  status: "locked" | "available" | "sold-out";
}
```

其中 affordability 和 quantity validity 是当前 Session / holdings 的派生结果，不应写回 Reveal 或 Condition。

### 13. 从 resolved SpotFunctionalityView 打开 Shop

**意见内容**

`SpotFunctionalitySystem` 会把 Spot 静态 functionalities 与 Enhancement 动态添加的 functionalities 合并，因此打开流程应读取 resolved FunctionalityView，并从明确的 `shopId` 引用解析 Shop，而不是根据 Spot tag 猜商店。

**参考价值：极高，且有当前代码事实支持。**

当前 `SpotFunctionalitySystem.functionalitiesOf()` 确实会读取 Spot 声明并追加满足目标 Tag 条件的 Enhancement functionalities。因此 Shop UI 如果绕过该视图，未来会漏掉动态添加的商店功能。

建议 Function 定义保持明确引用：

```ts
{
  kind: "shop",
  shopId: "base:shop:angel24"
}
```

具体字段名应以现有 `SpotFunctionalityDef` 联合类型和命名风格为准；不能直接假设 `shopId` 已是当前契约字段。

### 14. ShopSession 保存用户意图，不保存派生结果

**意见内容**

CartLine 只保存 `entryId + quantity)；calculatedPrice、affordable、stock、conditionResult 等全部由当前世界状态重新派生。

**参考价值：极高，直接采纳。**

这正好落实 Session 不进存档、checkout 重新解析的边界。建议：

```ts
interface CartLineIntent {
  entryId: string;
  quantity: number;
}
```

价格、余额、库存、Condition 和 Offer 执行能力只能作为 ShopView / checkout result 生成。这样离开商店、切换 Init 或状态变化时不会恢复出过期的购物车计算结果。

### 15. ShopFeed 不参与 TransactionPlan

**意见内容**

交易成功后生成 CommitReceipt，UI 根据 receipt 选择 checkout Feed；“谢谢惠顾”不是事务副作用。

**参考价值：高，直接采纳。**

这能避免表现层被卷入回滚和持久状态边界。建议流程为：

```text
Transaction commit
  → CommitReceipt
  → UI consumes receipt
  → ShopFeed chooses checkout line
```

Feed 可以根据成功 / 失败结果展示反馈，但它本身不写 PlayerState、不参与交易成功条件，也不应成为交易失败回滚对象。失败 Feed 由 CheckoutResult 的结构化 reason 驱动。

## 建议回填 Task 0039 的变更

### C0：改为二维 Purchase Scope

- `lifetime: global | init`
- `owner: shop | spot`
- PurchaseRecord 只保存 `purchasedQuantity`
- remaining、affordable、sold-out 等均为派生 View

### C1：改为真正的 Deferred Transaction

- 交易内部禁止直接调用会立即 emit 的普通 mutation 方法。
- 事务阶段暂存 State、Stats 和 Event 变化。
- commit 后统一 flush，abort 时不泄露任何中间事件。
- 方案 A（draft / staged transaction）与方案 B（resolved patch / commitBatch）由 ADR 选择具体实现。

### C2：Offer / Effect 安全边界

- Item / Resource Offer 进入 MVP。
- `onPurchase` 仅接受 transaction-safe Effect。
- EffectOffer 延后，或只接受可 compile 为确定性 MutationIntent 的子集。
- UI、Story、Theme、外部 callback、不可重放随机不进入 MVP transaction。

### C3：Resolved Functionality 与正交可见状态

- Shop 从 resolved SpotFunctionalityView 打开。
- Function 明确引用 Shop。
- Reveal、Condition、Stock、affordability、quantity validity、offer executability 分开求值。
- 最终 `status` 由 ShopEntryView 派生。

### C4：Plan / Price / Cart 语义

- Price 使用 `unitCosts`，按 quantity 生成 line cost。
- 所有 line cost 聚合后统一验证支付物。
- TransactionPlan 只含已解析的具体数值和确定性 mutation intent。
- CartSession 只保存 `entryId + quantity)。
- plan → commit 不允许 async gap；未来再引入 stateRevision。

### C5：Receipt / Feed / Event

- commit 成功生成 CommitReceipt。
- Feed 只消费 receipt / failure reason，不参与事务。
- onPurchase 默认按 line 执行一次并获得 quantity context。
- 购买事件按 checkout 或 line 聚合发出，不能按 quantity 展开成 N 个成功事件。

## 最终审阅判断

Sol 的意见整体参考价值很高，且大部分应在正式进入 P1 前写入 ADR 或 Task 0039。真正需要保留判断的只有三处：

1. Draft / staged transaction 与 patch / commitBatch 的具体工程实现，应由当前 StateMutationService 的引用、Stats 和 EventBus 约束决定，不能仅凭概念图选型。
2. `EffectCapability` 的命名和粒度不必现在固定成最终枚举，但 transaction-safe 的能力边界必须固定。
3. `shopPurchased` 是按 checkout 还是按 line 发出，应结合 EVENT_CATALOG 的事件粒度和 Trigger 使用方式最终裁定；但无论选哪种，都不应按商品数量展开。

除这三处实现层细节外，Sol 的修改意见可以视为 Task 0039 的高优先级设计补强，而不是可选的 UI 优化。

## 相关路由

## 五、针对三栏 UI 移植的复审与改造意见（2026-09-10）

### 总体评价

Sol 本轮意见判断准确：当前风险已经从商店领域模型转移到“弹窗态 → 顶层工作区态”的生命周期迁移。意见中关于状态边界、主题清理、派生 View、Feed 解耦、撤销语义和共享派生结果的建议，应直接写入 P3 任务书。

但“立即建立通用 WorkspaceSystem”不作为本次硬性目标。本次只建立足够抽象的 workspace 生命周期与返回上下文，避免 `PanelState` 被 Shop 特判锁死；待第二种 Spot Function Workspace 出现后，再根据真实共性抽取通用联合类型或服务。

### 采纳分级

| Sol 意见 | 评价 | 本次处理 |
| --- | --- | --- |
| `PanelState` 不变成万能 Session 仓库 | 高价值 | 采纳边界；Shop workspace 独立 payload，暂不扩建通用 WorkspaceSystem |
| 返回完整 panel snapshot | 必须修正 | 改为只保存 ReturnContext 导航意图，不保存资源、Reveal 或其他派生 View |
| Theme 与 modal 解耦 | 必须采纳 | 所有退出路径统一进入 `disposeShopWorkspace()` |
| Session 与 View 分离 | 必须采纳 | Session 只保留选区/购物车意图，价格库存状态实时派生 |
| Feed 不反向侵入领域层 | 必须采纳 | Controller 消费 CheckoutResult/Receipt 后写入临时 Feed |
| 撤销与离开区分 | 必须采纳 | 撤销只清 cart；离开才 dispose 全部 workspace 状态 |
| Topbar 是返回导航 | 必须采纳 | 使用“← 返回 Spot + 商店名”，不模拟 modal close |
| CSS 完整 namespace | 必须采纳 | 以 `.shop-workspace` 为根，禁止泛化 `.card/.feed/.tabs` 污染 |
| 三栏共享一次派生 View | 必须采纳 | 一次构建 `ShopWorkspaceView`，三个 panel 只消费同一份快照 |
| 明确 checkout 刷新顺序 | 必须采纳 | commit 成功确认后清 cart，再 derive、写 success Feed、render |
| 检查全部隐式退出路径 | 必须采纳 | 纳入测试与浏览器验收 |

### 改造后的关键设计

#### 1. Workspace payload 与 PanelState 的边界

不把 `ShopSession`、Feed 细节和完整回退快照散落在 `PanelState` 顶层。推荐保留一个可替换的工作区槽位，Shop 只实现自己的 payload：

```ts
interface ReturnContext {
  leftTab: string;
  centerTab: string;
  rightTab: string;
  selectedVariantId: string | null;
  conversationVariantId: string | null;
  spotId: string | null;
}

interface ShopWorkspaceState {
  type: 'shop';
  spotId: string;
  shopId: string;
  session: ShopSession;
  feed: ShopFeedEntry[];
  returnContext: ReturnContext;
  themeHandle: string;
}
```

这里的 `ReturnContext` 只保存导航身份；离开后必须基于当前游戏状态重新 render，不恢复旧货币、库存、Reveal、角色或价格结果。若未来出现 Gacha/Craft/Battle workspace，再评估是否将 `type` 提升为正式联合类型。

#### 2. 生命周期必须有单一 dispose 入口

所有退出或替换路径都必须调用同一个 dispose：

```text
open Shop
  → acquire theme/presentation
  → create Session + Feed
  → render shared ShopWorkspaceView

leave / replace / Init change / Spot navigation / restart / render fallback
  → disposeShopWorkspace()
  → clear cart/feed/listeners
  → release theme/presentation
  → restore ReturnContext
  → derive normal Game View and render
```

不得把清理逻辑分散在 modal close、按钮 callback、错误分支或单独的主题回调中。`dispose` 应具备幂等性，防止重复释放主题或重复恢复导航。

#### 3. 一次派生、三栏共享

渲染周期先生成一份 `ShopWorkspaceView`，再传给 Topbar、左栏 Feed、中栏 Catalog、右栏 Settlement。View 可包含当前价格、availability、余额、聚合成本和按钮门控，但这些都不是 Session 持久字段。

```text
ShopService + current state + ShopSession
  → buildShopWorkspaceView()
  → { topbar, feed, catalog, checkout }
  → left / center / right renderers
```

这样可以避免三个 panel 分别求值动态 GameNum 后出现同一帧价格不一致。

#### 4. checkout 与 Feed 的顺序

```text
checkout(cart)
  → ShopService.plan + commit
  → success: receive CommitReceipt
  → clear Session cart
  → derive fresh ShopWorkspaceView
  → append success Feed from receipt
  → render
```

失败路径不得清空 cart：只追加结构化失败 Feed，保留 Session，重新 derive 当前 View。撤销则只清空 cart 并留在 Shop workspace，不释放主题、不清空 Feed、不恢复 ReturnContext。

### 新增验收项

- Shop 中切换 Init、restart、Spot 外部导航、主要 Tab 或被其他 workspace 替换时，均能释放主题、购物车、Feed、监听器、CSS 状态和 workspace flag。
- Shop render 异常进入 fallback 时，不残留 ephemeral theme 或 modal 绑定。
- 连续执行 Shop → 离开 → Shop、Shop A → 返回 → Shop B，不能串用上一次的 cart、Feed、Section 或主题。
- 离开后旧 ReturnContext 只用于恢复导航；所有数字、状态和商品能力均来自当前状态重新派生。
- 同一次 render 中中栏与右栏的动态价格、库存和 affordability 必须来自同一个 `ShopWorkspaceView`。

### 最终改造判断

Sol 的意见书应从“商店 UI 迁移建议”改造成“Spot Function Workspace 生命周期约束”。本次施工优先级调整为：

1. 先建立 `ReturnContext`、Shop workspace payload 和单一 dispose 生命周期。
2. 再迁移三栏渲染，并保证共享 `ShopWorkspaceView`。
3. 最后迁移 actions、Feed、主题样式和浏览器验收。

通用 WorkspaceSystem、Gacha/Craft/Battle 复用和 stateRevision 均保留为后续工作，不阻塞本次 Shop UI 移植。

- [[docs/0x-plan&work/active/task-0039-spot-shop-transaction-system]]
- [[docs/0x-plan&work/newPlan/09-shop-transaction-draft]]
- [[docs/0x-plan&work/active/roadmap-0002-spot-shop]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/04-mechanisms/state-mutation]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/docs-828/05-conventions/testing]]

