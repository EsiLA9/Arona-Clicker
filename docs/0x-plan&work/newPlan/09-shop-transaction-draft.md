# 新策划/09-shop-transaction-draft — Spot 商店与通用交易系统策划草案

状态：🟡 任务书；P0–P2 已完成，待执行 Shop UI 三栏工作区移植

> 本文回答：Spot 商店应该提供什么玩法体验、采用怎样的交易模型、运行时状态放在哪里，以及实现前必须裁定哪些问题。
>
> 本文整理自 Sol 的商店设计建议，并结合当前项目的 Spot Function、Datapack、Condition、Effect、GameNum、Reveal、StateMutationService 与 UI Session 方向形成。它不是最终机制事实源，也不替代后续 ADR。

## 一、设计结论摘要

商店不应只是 `ShopItem -> effects[]` 的薄壳，而应定义成一个通用的**交易/取得系统**：

> **Shop 是交易环境，ShopEntry 是交易提案，Offer 描述获得物，Price 描述支付物，Condition 描述能否交易，Stock 描述交易次数，Effect 描述交易造成的额外副作用。**

建议冻结以下四条边界：

1. `ShopDef / ShopEntryDef` 只保存 Datapack 静态定义，不保存已购买次数、剩余库存等运行时状态。
2. `ShopSession` 只保存购物车、选择项和价格预览等临时 UI 状态，不进入正式存档。
3. 结算必须先完整验证，再通过统一交易计划原子提交；禁止边扣费、边发货的裸 Effect 串联。
4. 购买记录必须显式声明 scope，不能只用 `entryId -> count` 的隐式结构。

## 二、玩法预期

### 2.1 商店在世界中的定位

商店是 Spot 的一种 Function，而不是全局菜单或独立地图节点。玩家在具体地点发现交易环境，不同地点可以提供不同商品、货币、表现和剧情反馈。

```text
Spot
├─ Shop：物资购买
├─ Talklet：日常交流
└─ 特殊事件 / 制作 / 升级
```

同一个 `ShopDef` 理论上可以被多个 Spot 引用；同一个 Spot 也可以同时拥有商店、对话和其他功能。这样“地点”和“地点提供的服务”保持分离，后续可复用 Function Session 结构。

### 2.2 玩家体验目标

第一版商店应让玩家清楚感受到：

- 我在哪里购买：商店属于某个 Spot，并有自己的主题、店员和信息流。
- 我可以买什么：商品按 Section 陈列，未发现、已锁定、可购买、售罄状态清晰可见。
- 我需要付出什么：支持资源和物品组成的价格，结算前显示完整消耗预览。
- 我能买多少：无限、一次性、有限库存和周期刷新要能被玩家理解。
- 这次交易带来了什么：Offer 明确描述获得物，购买后的剧情、标记或其他联动由 `onPurchase` 表达。

推荐循环：

```text
进入 Spot → 打开 Shop Function → 选择商品与数量 → 查看价格预览
  → 结算前重新验证 → 原子扣款、发货、记账、触发事件
  → 保留结果，销毁 ShopSession，返回 Spot
```

### 2.3 内容层商店类型

| 类型 | 主要体验 | 典型规则 |
| --- | --- | --- |
| 常规商店 | 用生产资源换取日用品 | 无限或高库存、价格稳定 |
| 周期商店 | 定期回来查看新货 | Init 或周期刷新库存 |
| 角色商店 | 获取角色相关内容 | 角色 / Variant / 培养资源 Offer |
| 世界线商店 | 当前 Init 的限定兑换 | 购买记录绑定 Init |
| 交换商店 | 用 Item 换另一种 Item 或资源 | 多 Item Price |

## 三、概念模型

```text
Spot Function: Shop → ShopDef
                         ├─ presentation / feed / sections
                         └─ entries[] → ShopEntryDef
                                  ├─ offer       买到什么
                                  ├─ price       付出什么
                                  ├─ condition   能不能买
                                  ├─ stock       能买几次
                                  └─ onPurchase  额外发生什么

ShopDef + 当前只读状态 → ShopSession → TransactionPlan → 原子 StateMutation
```

### 3.1 ShopDef：交易环境

`ShopDef` 负责商店身份、表现、货币上下文、Section、Entry 和 Feed，不负责购买记录。

```ts
interface ShopDef {
  id: ShopId;
  name: string;
  presentation?: ShopPresentationDef;
  currencies?: ResourceId[];
  sections?: ShopSectionDef[];
  entries: ShopEntryDef[];
  feed?: ShopFeedDef;
  condition?: Condition;
  extra?: ExtraValue;
}
```

Spot 只声明 Function 与 Shop 引用；一个 Spot 可以有多个 Function，一个 Shop 也可以被多个 Spot 使用。

### 3.2 ShopEntry：交易提案

推荐使用 `ShopEntry`，而不是 `ShopItem`。商店卖的不一定是 Item，也可能是资源、角色、升级、Affector 或一段特殊取得行为。

```ts
interface ShopEntryDef {
  id: string;
  offer: ShopOffer;
  price: ShopPrice;
  condition?: Condition;
  visibility?: "hidden-until-available" | "show-locked";
  stock?: ShopStock;
  purchase?: ShopPurchasePolicy;
  display?: ShopEntryDisplay;
  onPurchase?: Effect[];
}
```

| 字段 | 回答的问题 | 不负责什么 |
| --- | --- | --- |
| `offer` | 玩家买到了什么 | 不负责扣款和购买次数 |
| `price` | 玩家付出了什么 | 不负责发货 |
| `condition` | 是否满足购买前提 | 不维护商店自己的解锁状态 |
| `stock` | 允许购买多少、何时刷新 | 不决定商品内容 |
| `display` | UI 怎样展示 | 不参与权威结算 |
| `onPurchase` | 购买后额外发生什么 | 不替代核心 Offer |

### 3.3 Offer：强语义取得对象

第一版建议使用带判别字段的 Union：

```ts
type ShopOffer =
  | { type: "item"; item: ItemId; amount: number }
  | { type: "resource"; resource: ResourceId; amount: GameNum }
  | { type: "role"; role: RoleId }
  | { type: "upgrade"; upgrade: UpgradeId }
  | { type: "spot"; spot: SpotId }
  | { type: "affector"; affector: AffectorId }
  | { type: "effect"; effects: Effect[] };
```

常见游戏对象使用强语义 Offer，只有无法归类的特殊商品使用 `EffectOffer`。底层可以复用 Effect engine，但数据包层不应要求作者通过解析 Effect 才能知道商品是什么。

### 3.4 Price：可组合的支付物

第一版可支持资源和可堆叠 Item 两类成本：

```ts
interface ShopPrice { costs: ShopCost[]; }

type ShopCost =
  | { type: "resource"; resource: ResourceId; amount: GameNum }
  | { type: "item"; item: ItemId; amount: GameNum };
```

这覆盖普通购买、物品交换和复合支付。作为货币的 Item 只支持 stackable definition item，不处理带品质、实例属性或装备状态的 instance item。

### 3.5 Stock、Policy、Condition

```ts
type ShopStock =
  | { type: "unlimited" }
  | { type: "once" }
  | { type: "limited"; max: number }
  | { type: "refresh"; max: number; scope: "init" | "day" | string };

interface ShopPurchasePolicy {
  min?: number;
  maxPerCheckout?: number;
  quantity?: "single" | "multiple";
}
```

`once` 不是完整的持久化语义，必须进一步绑定 purchase scope。商店继续复用统一 `Condition`，不新增 `requiredSpotLevel`、`requiredRole` 等平行判断系统：

- `hidden-until-available`：不满足发现条件时隐藏。
- `show-locked`：可见但展示锁定原因。
- `purchaseable`：条件、库存和价格均通过时可购买。
- `sold-out`：条件仍可能满足，但购买记录已耗尽。

Reveal 可以负责“商品是否被发现”，Condition 负责“当前能否购买”；不要让 Shop 自己维护一份解锁状态。Affector、剧情标记和其他统一系统仍是状态来源。

## 四、运行时状态与存档边界

| 状态 | 示例 | 生命周期 | 是否进存档 |
| --- | --- | --- | --- |
| 静态定义 | Shop、Entry、Price、Offer | Datapack 生命周期 | 否 |
| ShopSession | 选中项、数量、价格预览、当前 Section | 进入商店至退出 | 否 |
| 持久购买状态 | 已购次数、已领取结果、刷新锚点 | 按 scope 保留 | 是 |

退出商店时，主题覆盖、左栏 Feed、选中商品和价格预览都应销毁；已经完成的交易结果、扣款和购买记录必须保留。

推荐的初始 scope：

```ts
type PurchaseScope = "global" | "init" | "shop" | "spot";
```

购买记录不能只写成 `entryId → count`，而应包含 scope owner：

```text
global  : shopId + entryId
init    : initId + shopId + entryId
shop    : shopInstanceId + entryId
spot    : spotId + shopId + entryId
```

具体落入 `global / per-Init 快照 / per-Init 当前` 哪一层，必须结合 [[docs/docs-828/01-architecture/state-layers]] 裁定。周期刷新还要明确刷新锚点和当前项目没有日历时间时的替代表达。

`ShopEntry.id` 一旦用于购买或库存记录，就成为持久化 schema 的一部分，而不只是 UI key。正式发布后修改 ID 等同于切换购买记录身份；改名只修改 display 字段，替换商品应新增 ID。当前项目不编写存档迁移或旧 ID 兼容层。

## 五、交易结算方案

### 5.1 统一交易计划

以下逐条执行存在半完成交易风险：

```text
扣 Credit → 扣 Item → 发放商品 → 执行 onPurchase
```

商店需要独立的 `TransactionPlan`：先完整验证，再通过 `StateMutationService` 原子提交。它更像数据库事务，而不是一串裸 Effect。

### 5.2 两阶段流程

```text
1. 收集购物车
2. 重新求值价格与数量
3. 检查 Shop / Entry Condition
4. 检查库存、PurchasePolicy 与购买记录
5. 检查全部支付物余额
6. 检查 Offer 与 onPurchase 是否可执行
7. 生成完整 TransactionPlan
8. 原子提交扣款、发货、记账与事件
9. 生成结果快照并刷新 ShopSession
```

加入购物车时可以快速校验，但不是权威判断。结算时必须重新检查，因为价格、Condition、库存和其他状态可能在购物车停留期间发生变化。

第一版建议同批次所有 Entry 都以结算前状态为统一判断基准，不允许“先买 A 解锁 B，再在同一批次购买 B”。这样不需要事务内模拟，也避免同批次顺序影响结果。

动态价格可以使用 GameNum，但必须遵守：UI 实时 preview；checkout 时重新 evaluate；使用该次 checkout 的价格 snapshot 执行扣款。最终扣款以 snapshot 为准，并展示实际扣除值。

### 5.3 失败与回滚

交易失败时应满足：

- 不扣除任何支付物。
- 不发放部分 Offer。
- 不增加购买次数。
- 不执行 `onPurchase` 的持久副作用。
- 不发出表示交易成功的 `purchased` 事件。
- UI 保留购物车，展示失败原因，并允许修正后重试。

如果 `StateMutationService` 无法保证多步 Mutation 的原子性，应先补齐交易所需的计划验证与 commit 边界，而不是用 UI 层 try/catch 伪造回滚。

## 六、ShopSession 与 UI 预期

```text
ShopSession
├─ Topbar：离开、商店名称
├─ Left：店员、ShopFeed
├─ Center：Section、Entry cards
└─ Right：持有资源、购物车、预计消耗、结算
```

ShopFeed 应是轻量反馈，不应强迫作者创建完整 Story：

```ts
interface ShopFeedDef {
  enter?: ShopLinePool;
  select?: ShopLinePool;
  add?: ShopLinePool;
  remove?: ShopLinePool;
  insufficient?: ShopLinePool;
  checkout?: ShopLinePool;
  leave?: ShopLinePool;
}
```

主题属于 Shop，而不是 Entry。打开时应用 Shop 的临时 presentation/theme 覆盖，关闭时 dispose Session 并恢复 Spot UI。UI 只消费只读 View；数量调整只修改 Session，结算请求交给交易服务 / StateMutationService。

## 七、第一版范围建议

### 纳入 MVP

- Spot 新增 `shop` Function。
- `ShopDef / ShopEntryDef / ShopOffer / ShopPrice` 基础定义。
- Item Offer、Resource Offer，必要时保留 EffectOffer 逃生舱。
- Resource Cost 与 stackable Item Cost。
- `unlimited / once / limited` 三种基础库存。
- 明确一种初始 PurchaseScope，并完成存档登记。
- 统一 Condition 与简单隐藏 / 锁定展示。
- ShopSession、购物车、数量、价格预览与一次性结算。
- 交易计划的完整验证、原子提交、失败不变更。
- 购买成功事件、购买记录、基础 ShopFeed 和临时主题引用。

### 暂不纳入 MVP

- 实例物品作为货币。
- 同批次购买链式解锁。
- 复杂周期（日历、现实时间、跨设备时间校验）。
- 树状多级 Category。
- 每种 Offer 都有独立的复杂 UI。
- 把完整 Story / Talklet 作为普通商店短句的必选依赖。
- 存档迁移与旧 Entry ID 兼容层。

## 八、重要问题与待裁定项

1. 购买记录到底属于全局、当前 Init、Shop 还是 Spot；同一 Shop 被多个 Spot 引用时是否共享。
2. `once` 的 owner 是谁；`shopId + entryId` 是否足够，还是必须包含 Spot / Init。
3. 周期刷新依据什么时间；当前没有成熟日历时间时是否只提供 Init 刷新或 tick 计数。
4. 交易原子性由哪个服务保证；`StateMutationService` 是否新增 TransactionPlan / batch commit 能力。
5. Item、Resource、Role、Upgrade 等结果如何接入各自领域服务，EffectOffer 如何限制副作用范围。
6. 角色、升级和一次性 Offer 重复获得时，是条件阻止、转化为碎片，还是允许重复触发。
7. Affector 是直接承载上架，还是 Shop 静态 Entry + Condition / Reveal 门控。
8. checkout 期间价格变化时，是直接使用最终 snapshot，还是要求玩家确认价格变化。
9. 失败原因使用统一错误码、Condition 展示树，还是交易服务输出结构化原因。
10. 谁负责保证 Entry ID 稳定；内容包替换商品时如何处理旧记录。

## 九、实现切片建议

### P0：冻结领域边界

- 形成正式 ADR：Shop 是 Spot Function；Def、Session、Save、Transaction 职责分离。
- 裁定 PurchaseScope、购买记录结构和 `once` 语义。
- 裁定同批次购买规则与原子提交责任。

### P1：定义与注册

- 新增 Shop 领域契约与 Registry 表。
- 补 `SpotFunctionalityDef.kind = shop`。
- 按 Schema 同步协议生成编辑器字段并补 editor extras。
- 完成 Shop / Entry / Offer / Price 的引用校验和 ID 稳定性规则。

### P2：交易服务

- 实现购物车到 TransactionPlan 的转换。
- 实现 checkout 前完整验证。
- 接入扣款、发货、购买记录和购买事件。
- 为失败路径增加原子性测试与不变更断言。

### P3：游戏内 UI

- 从 Spot Function 打开 ShopSession。
- 接入三栏布局、Section、卡片、购物车和价格预览。
- 接入临时主题、ShopFeed 和退出销毁。
- 验证 UI 全程只读消费。

### P4：内容样例与验收

- 添加 Credit → Item 常规商店、Item → Item 交换商店。
- 添加受 Condition / Reveal 限制的商品和一次性 / 有限库存商品。
- 覆盖重新结算失败、价格变化、重复购买和退出重进场景。

## 十、验收标准

- 能用一句话解释 Shop、Entry、Offer、Price、Stock、Condition、onPurchase 的边界。
- 不存在把购物车存档或把运行时库存写进 ShopDef 的路径。
- 结算前所有支付物、库存、条件和结果均可验证。
- 任一验证失败不会留下扣款、发货或购买记录的半完成状态。
- 同一 Shop 被多个 Spot 引用时，购买记录语义仍然明确。
- UI 离开商店后临时主题和 Session 状态全部清理，购买结果保留。
- Entry ID、PurchaseScope 和刷新规则足以解释存档中的每一条购买记录。
- 至少有单元测试覆盖成功、余额不足、库存不足、Condition 失效、动态价格和副作用失败路径。

## 相关路由

## 十一、当前实现审查与 UI 移植决策（2026-09-10）

### 决策

**不重做商店领域系统；保留 P0–P2 的 Datapack、购买记录、`ShopService`、原子结算和事件契约，仅移植/重构 P3 的 UI 宿主与交互状态。**

当前实现把 `ShopSession` 放入 `app-modal`，这与产品要求的 Spot 功能工作区不一致。商店应视为由 Spot Function 打开的临时顶层工作区：打开后接管左—中—右三栏，离开后恢复进入前的面板、选中项、主题和其他临时 UI 状态。

### 偏差对照

| 目标 | 当前实现 | 移植结论 |
| --- | --- | --- |
| Spot 上的功能入口 | 已从 resolved Spot Function 取得 `shopId`，但调用 `openSpotShopModal` | 保留解析入口，改为打开 Shop workspace |
| 左栏简单信息流 | Feed 在弹窗右侧 | 新增 Shop 左栏，显示进入、选购、失败、结算等轻量记录 |
| 中栏商品卡片 | 已有商品卡片和 Section | 保留语义，迁移到 center panel |
| 右栏商店结算 | 购物车和预计消耗混在弹窗侧栏 | 拆为持有货币、已购小项/购物车、消耗汇总、结算与撤销 |
| 顶部新 tab | 使用 modal 标题 | 新增 Shop tab，提供离开键与商店名 |
| Shop 自有主题 | 已有 ephemeral theme push/pop | 保留，生命周期绑定 workspace session，并验证退出恢复 |

### 不变的领域边界

- Shop 仍只能从 `functionalitiesOf()` 返回的 resolved Spot Function 打开。
- `ShopSession` 只保存临时购物车意图，不进入存档；购买记录继续由交易服务维护。
- UI 只消费 availability/preview/read model，不直接改 PlayerState。
- checkout 仍由 `ShopService` 重新验证并原子提交；失败保留购物车，成功清空购物车并保留购买记录。
- 不新增 Shop 自己的解锁、库存、货币或回滚系统。

### 工程移植切片

1. `PanelState` 增加 `shopWorkspace`（spotId、shopId、session、feed、进入前 panel 快照）；正常 game shell 与 Shop shell 分流。
2. 将 `shop.ts` 拆成 Shop topbar、ShopFeed、商品目录、右栏结算四个可独立渲染区；三栏组件只接收只读 view 和 session 意图。
3. 将 `openSpotShopModal` 改为 `openSpotShopWorkspace`；入口按钮和 Spot Function 文案保持不变，删除商店主流程对 `modal.open` 的依赖。
4. 新增 Shop actions：加/减数量、撤销当前购物车、结算、离开；离开必须销毁 session、移除临时主题并恢复原 panel 状态。
5. CSS 从 modal 选择器迁移到 workspace 命名空间，验证不污染 gacha、collection、普通三栏与其他 Tabs。
6. 补 UI controller/render 测试，再执行浏览器验收：进入、四种商品状态、动态价格/余额变化、失败重试、成功结算、撤销、离开恢复。

### 明确不做

- 不保留“弹窗作为商店主界面”的兼容双路由。
- 不把 ShopFeed 做成完整 Story/Talklet 系统。
- 不在本次移植中加入周期刷新、实例物品货币、角色/升级复杂 Offer 或存档迁移。

### 完成判定

从真实 Spot 的 Shop Function 进入后，用户可在同一顶层页面看到左 Feed、中商品、右结算；顶部可离开；撤销只清理临时购物车；结算失败无持久副作用；离开后 Spot 原三栏、主题和 Tab 状态恢复。满足这些条件后，才将 roadmap-0002 与 task-0039 的 P3 标记完成。

- [[docs/0x-plan&work/active/roadmap-0002-spot-shop]]：Spot 商店目标与当前状态
- [[docs/0x-plan&work/newPlan/03-spot-shop]]：早期 Spot 商店草案
- [[docs/docs-828/01-architecture/state-layers]]：三层状态与存档归属
- [[docs/docs-828/04-mechanisms/state-mutation]]：状态写入管道
- [[docs/docs-828/05-conventions/schema-sync]]：Datapack Schema 同步
- [[docs/docs-828/02-modules/ui]]：游戏内 UI 模块路由

## 十二、任务书：Spot 商店三栏工作区移植

### 12.1 任务目标

将当前 `app-modal` 商店移植为由 Spot `shop` Function 打开的临时顶层工作区。进入后接管左—中—右三栏，顶部显示商店 Tab；离开后仅恢复进入前的导航意图，再基于当前游戏状态重新派生并渲染。

### 12.2 已冻结边界

- 保留现有 Shop Datapack、PurchaseScope、`ShopService`、TransactionPlan、CommitReceipt、购买记录与事件机制。
- `ShopSession` 仍是临时购物车意图，不进入存档；UI 不直接修改 PlayerState。
- checkout 仍由服务层重新验证并原子提交；失败保留购物车，成功清空购物车。
- 不新增周期刷新、实例物品货币、复杂 Offer、商店独立解锁系统或存档迁移。
- 不保留弹窗作为商店主界面的兼容双路由。

### 12.3 目标界面

| 区域 | 必须提供 |
| --- | --- |
| 顶部 Shop Tab | 离开按钮、商店名；离开不结算，临时购物车销毁 |
| 左栏 | ShopFeed：进入、加购、减购、失败、成功等轻量信息流 |
| 中栏 | Section 与商品卡片；Offer、价格、库存及 hidden/locked/available/sold-out 状态 |
| 右栏 | 持有货币、已购小项/购物车、聚合消耗、撤销、结算 |

### 12.4 实施任务

1. 在 `PanelState` 增加可替换的 Shop workspace payload：`spotId`、`shopId`、Session、Feed 与 `ReturnContext` 导航意图；禁止保存完整派生 panel 快照，建立普通 Game shell / Shop shell 分流。
2. 先一次构建共享的 `ShopWorkspaceView`，再将 `shop.ts` 拆为 Topbar、ShopFeed、商品目录、右栏结算四个区域，分别接入 left/center/right panel。
3. 将 `openSpotShopModal` 改为 workspace 入口；新增加减数量、撤销、结算、离开 actions，删除商店主流程对 `modal.open` 的依赖。
4. 将主题生命周期从 modal close 迁移到幂等的 workspace `dispose`；离开、替换、切换 Init、restart、外部导航和 fallback 均走同一清理入口，确保普通三栏、gacha、collection 和其他 Tabs 不受污染。
5. 将商店 CSS 从 modal 选择器迁移到 Shop workspace 命名空间，覆盖窄屏、长商品名、多货币、空购物车和长 Feed。
6. 补 UI/controller/render 测试，记录浏览器验收结果，并更新 roadmap-0002 与 task-0039 的 P3/P4 状态。

### 12.5 验收标准

- [ ] 从真实 Spot Function 进入，不出现商店 modal。
- [ ] 左栏 Feed、中栏商品、右栏持有物与结算区同时可见。
- [ ] 四种商品状态、加减数量、撤销行为正确。
- [ ] 余额/条件/库存/动态价格变化后，checkout 重新验证。
- [ ] 失败不扣费、不发货、不记账、不发成功事件，并保留购物车。
- [ ] 成功正确扣费、发货、记账、刷新视图并清空购物车。
- [ ] 离开销毁 Session，已完成购买保留，Spot 面板与主题恢复。
- [ ] `npx tsc --noEmit`、`npm run check:architecture`、`npm test`、`npm run build`、`git diff --check` 全部通过。

### 12.6 完成定义

用户能在同一顶层页面完成“进入 Spot 商店 → 浏览 → 加购 → 结算/失败重试/撤销 → 离开”，且交易语义与现有 P0–P2 不变、临时 UI 状态不入存档、退出后原页面完整恢复。满足后才标记 roadmap-0002 的 P3 完成。
