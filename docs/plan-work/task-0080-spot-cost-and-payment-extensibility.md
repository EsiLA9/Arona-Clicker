# Task：Spot 多资源/物品花费与可扩展支付途径

状态：active — 🟢 P0/P1 与 Runtime Editor 支持已完成；非库存支付 Provider 另立后续 Task

## 目标

将 Spot 的解锁与升级花费从“一个 `ValueExpression` + 一个 Resource”推广为可组合的资源/物品费用，并支持由条件、外部效果或内容包解锁额外支付方案。

本 Task 的最终使用体验应当是：

- 一次操作可以同时消耗多个 Resource / Item；
- 同一操作可以声明多个可选支付方案，例如默认使用信用点，满足条件后可使用另一种 Resource 或 Item；
- UI 能展示每个方案的可用性、缺口与拒绝原因，命令侧必须明确选择方案；
- 所有费用检查与扣除仍遵守“只读判定 → StateMutationService 写入 → 事件”的单一写入口；
- Shop 能复用同一套费用值对象与结算辅助能力，避免 Spot、Shop、Init/Enhancement 各自发展一套成本语义。

## 设计边界

### 纳入范围

1. Spot 解锁费用。
2. Spot 升级费用：包括 `levelUpgrades[].cost` 与通用升级公式的替代建模。
3. Resource 与 stackable Item 两种内建支付资产。
4. 多项并列费用（AND）与多个支付方案（OR）。
5. 条件化支付方案、预览、缺口计算、失败原因与 UI 展示。
6. Shop 现有 `ShopCost` 与新通用费用值对象的收敛，保留 Shop 的按购物车聚合与原子提交边界。
7. Runtime Spot 编辑器、def-factory、Registry 引用校验、Schema 同步与默认/测试 Datapack。

### 不纳入范围

- 不设计任意 Effect 作为扣费器；支付必须先解析为确定性的资源/物品 delta。
- 不在本 Task 引入新的 PlayerState 货币账本；Resource 与 inventory 仍是余额真相。
- 不实现刷新券、角色碎片、装备耐久、随机扣费或异步支付等新语义。
- 不把“支付途径”理解为自动兑换或汇率系统；不同方案是独立成本包，除非未来另立规则明确兑换关系。
- 不编写存档迁移代码。新的结构允许破坏性替换旧 Spot 字段，旧存档按项目纪律清档重来。
- 不同时重做 Init、Enhancement、Gacha 的所有费用字段；它们只在确认需要共享值对象时接入，超出范围的消费方另立 Task。

## 推荐概念模型

### 1. 费用项与费用包

新增数据服务层通用费用类型（建议放在 `src/data-services/contracts/`，具体文件名开工时裁定）：

```text
CostItem =
  { type: 'resource', resourceId, amount: ValueExpression }
  | { type: 'item', itemId, amount: ValueExpression }

CostBundle = { costs: CostItem[] }
```

`CostItem[]` 内部是 AND：同一包中的所有项都必须满足，并在提交时聚合为 Resource / Item delta。Item 金额必须为非负整数；Resource 金额允许 ValueExpression 求值后的有限非负数，具体是否允许小数沿用当前 Resource 语义。

### 2. 支付方案

需要区分“费用内容”和“选择哪一种费用”。推荐使用：

```text
PaymentOption = {
  id: string;
  label?: string;
  condition?: ConditionGroup;
  cost: CostBundle;
}
```

一个操作的 `PaymentOption[]` 是 OR。条件只负责方案是否出现/可选；余额不足仍是 checkout 时的独立判定。`id` 必须稳定，因为 UI 选择、命令参数、日志和未来统计都不能依赖数组位置。

推荐规则：

- 只有一个方案时，UI 可自动选中；
- 多个方案时，命令带 `paymentOptionId`，不按声明顺序静默选择；
- 方案条件不满足、费用求值失败、余额不足分别返回不同的结构化原因；
- 同一方案内的多项成本不能自动以“任意一种满足”解释；需要 OR 时声明多个方案。

### 3. Spot 字段落点

建议将 Spot 的一次性解锁与升级费用都改为支付方案集合，而不是继续让升级费用隐式继承 `baseCostResource`：

- `SpotDef`：`acquisitionCost` 或等价名称，表达解锁方案；
- `LevelUpgradeDef`：`paymentOptions` 或等价名称，表达该等级的升级方案；
- 通用升级公式若保留，公式只负责生成金额，资源/物品支付目标必须由明确的默认方案声明；
- 当某等级没有显式升级方案时，按明确的 Spot 默认升级费用策略求值，不能隐式回退到“解锁费用资源”这一旧耦合。

最终字段名需在开工前结合编辑器字段命名与已有 `ShopPrice` 一并裁定，避免同时存在 `cost`、`price`、`purchaseCost` 三套近义名。

## 当前事实与代码落点

| 现状 | 代码落点 | 规划影响 |
| --- | --- | --- |
| Spot 解锁只读取一个金额和一个 Resource | `src/data-services/contracts/world.ts`、`src/arona-clicker/services/spot-service.ts` | 必须改为费用包/方案解析，并扩展结果类型 |
| Spot 升级显式费用只有金额，通用公式也固定使用 `baseCostResource` | `world.ts`、`spot-service.ts` | 需要消除资源目标的隐式继承 |
| Shop 已支持多个 Resource / Item 成本并聚合 | `src/data-services/contracts/shop.ts`、`src/arona-clicker/services/shop-service.ts` | 抽出共享 `CostItem` / 解析与余额检查能力，不能破坏 Shop 原子提交 |
| 普通 `changeResource` / `removeItem` 会立即记 Stats 并发事件 | `src/arona-clicker/state/state-mutation-service.ts` | Spot 若同时扣多项，必须引入一次操作的 staged/transaction 边界，或复用已冻结的 Shop transaction 能力 |
| UI 只读消费 View，Spot 提示仍拼接单个资源名 | `src/ui/components/tooltip-detail-spot.ts` | 新增费用方案/缺口只进 View，不让 UI 直接读写状态 |
| Runtime 编辑器仍使用 `baseCost` / `baseCostResource` 草稿字段 | `src/arona-clicker/contracts/runtime-content.ts`、`src/ui/runtime-editor/`、`src/data-services/authoring/` | 需要更新编辑协议、校验、集合编辑器与热内容边界 |
| 默认/测试内容大量使用旧字段 | `src/arona-clicker/content/`、`src/data/`、`tests/` | 破坏性结构替换必须全量改测试与样例，不做存档兼容层 |
| Schema 生成物禁止手改 | `docs/docs-828/05-conventions/schema-sync` | 类型改动后必须 `npm run gen:schema` 并跑同步测试 |

## 施工切片

### P0：机制裁定与共享费用类型

- 裁定 `CostItem`、`CostBundle`、`PaymentOption` 的最终命名、字段与金额约束。
- 裁定支付方案的条件/余额/隐藏状态与 `paymentOptionId` 命令契约。
- 裁定通用升级公式的兼容形态：保留公式但新增支付目标，或彻底改成逐级声明。
- 将 Shop 的 `ShopCost` 映射到共享费用项；若无法保持 Shop 的现有动态求值与收据形状，先保留 Shop 适配层，不强行合并。

### P1：Spot 解锁与升级结算

- 新增只读费用解析器：在当前状态下解析所有方案、逐项求值、计算余额/库存缺口。
- 扩展 `SpotService` 的 `can/unlock/upgrade` 结果，使调用方能获得方案列表、缺口和结构化失败原因。
- 新增带方案选择的命令入口；单方案调用保留便捷路径，但最终走同一解析器。
- 将多项扣费与等级变更、升级效果放入一次原子提交：失败时 PlayerState、Stats、EventBus 均不变；成功后再释放资源/物品变化事件及 Spot 变化事件。
- 明确升级效果中的额外 `addResource` / `addItem` 是否纳入同一提交；若不能安全纳入，P1 先限制为现有可确定子集并另立后续任务。

### P2：视图、UI 与内容编辑

- 在 Spot 只读 View 中表达 payment options、方案状态、每项持有量/需求量/缺口与选中方案。
- 更新 Spot tooltip、购买/升级按钮与失败提示，支持多项成本和多方案选择。
- 更新 Runtime Spot 表单、集合行编辑、authoring content policy、候选资源/物品引用校验。
- 处理 Runtime 热内容的字段白名单、clone/default/submit 三处一致性，确保新增嵌套字段不会被静默丢失。

### P3：内容与共享化收束

- 迁移正式默认内容、测试 Datapack、def-factory 与相关 UI fixture。
- 评估 Init/Enhancement/Gacha 是否接入共享费用项；只接入有明确验收价值的调用方，其余记录为后续任务。
- 更新 `docs/docs-828/` 中的 Spot/状态变更/数据结构说明；若新增稳定架构约束，再同步 `design-constraints`。

## 关键设计决策待裁定

1. **支付方案是否允许无条件自动选择？** 推荐：单方案自动；多方案必须显式选择，避免因顺序变化误扣另一种资产。
2. **支付方案 condition 不满足时是隐藏还是显示锁定？** 推荐复用现有 Reveal/Condition 的双状态：内容声明决定 hidden 或 show-locked，结算始终拒绝不可用方案。
3. **Resource 是否允许小数费用？** 推荐保留当前 Resource 的数值能力，但 Item 强制整数；若 Spot 费用需要整数资源，应在共享费用策略中显式声明，而不是在 UI 层取整。
4. **费用方案是否可由外部运行时动态追加？** 推荐首阶段只允许 Datapack 声明多个方案、由外部状态通过 Condition 解锁；真正的运行时追加/撤回需另立“Definition/Runtime Delta 与支付方案”任务，避免绕过 Registry 与可重复结算边界。
5. **新支付类型的扩展点是什么？** 推荐当前只内建 Resource/Item；未来若出现非库存资产，新增受控 `PaymentProvider`/解析适配器与单独的原子提交契约，不把任意字符串 `type` 直接开放给 Effect 或 UI。

## 测试与验收

至少覆盖：

- 单 Resource 旧场景迁移后正向解锁/升级；
- 多 Resource 并列扣费；
- Resource + Item 混合扣费；
- 两个支付方案：默认不可用、备用可用、显式选择成功；
- 方案条件不满足、方案不存在、动态金额非法、Item 非整数、余额/库存不足；
- 多项扣费失败时没有部分写入、Stats 或事件；
- 成功提交时资源/物品/Spot 等级/升级效果的事件顺序与原子边界；
- Shop 既有多成本、多购物车聚合、动态价格与库存测试不回归；
- Registry 引用校验、Schema 三向同步、Runtime editor 新字段读写与未知字段保留；
- UI 多项成本与方案状态的渲染测试。

准出命令：

```text
npm run gen:schema
npm test
npx tsc --noEmit
npm run check:architecture
npm run check:docs
```

## 本轮执行裁定（2026-09-16）

- 先实现通用费用项数据结构与求值/余额检查基础，不先扩展非 Resource/Item 的支付 Provider。
- Spot 解锁与升级兼容旧字段：旧 `baseCost` / `baseCostResource` 继续作为默认单方案来源；新增方案优先使用显式声明。
- 多个 Spot 支付方案由 UI 弹窗让玩家明确选择；单方案继续直接购买。命令侧支持可选 `paymentOptionId`，不按数组顺序静默扣款。
- Shop 只收敛到共享的多 Resource / Item 费用项；本轮不支持 Shop 多支付方案。
- Runtime Editor 本轮同步开放新支付方案字段：支付页编辑解锁方案，升级条目内编辑等级方案，方案内编辑 Resource / Item 费用项；动态金额表达式暂不提供输入控件，回读时保留诊断并阻止静默覆盖。

## 当前核验（2026-09-16）

- 已阅读：`docs/docs-828/00-INDEX.md`、World/State Mutation 模块卡片、State Mutation/Production 机制、设计约束、文档维护与测试规范。
- 已核对：`world.ts`、`shop.ts`、`spot-service.ts`、`shop-service.ts`、`state-mutation-service.ts`、Runtime authoring 相关类型与 Spot 成本测试引用。
- 已实现：`CostItem` / `PaymentOptionDef` 共享费用契约、`PaymentService` 只读求值与选择、Spot 原子提交、Spot 命令的 `paymentOptionId`、Spot 多方案 UI 弹窗，以及 Shop 的共享 Resource / Item 费用项收敛。
- 已兼容：旧 `baseCost` / `baseCostResource`、旧升级 `cost` 与通用升级公式继续生成默认支付方案；未选择方案时仅在存在多个可用方案时返回结构化的 `PaymentOptionRequired`。
- 已同步：def-factory、Registry Item 引用与方案 ID 校验、Schema 生成与三向同步测试；Runtime Editor 已支持 Spot 支付页、升级条目内支付方案、Resource / Item 费用项增删、表单 round-trip 与 Apply 前诊断。
- 已执行：定向 Spot / Shop / Schema / UI 回归测试、Runtime Editor 支付方案 round-trip / 嵌套动作测试、`npm run gen:schema`、`npx tsc --noEmit`、`npm test`、`npm run check:architecture`、`npm run check:docs`、`npm run build`；最终全量结果为 163 个测试文件、1524 个测试全部通过。
- 已验证：`git diff --check` 无错误；生产构建仅保留既有的大 chunk 体积提示，不影响构建成功。

## 剩余工作

本轮已完成 P0/P1 以及 P2 的 Runtime Editor 切片。剩余工作是：非 Resource/Item 支付 Provider、支付方案隐藏/锁定的内容声明、动态金额表达式的编辑器能力，以及 Init/Enhancement/Gacha 的共享费用接入；这些应另立后续 Task，不在本轮扩大范围。

## 相关路由

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/world]] · [[docs/docs-828/02-modules/state-mutation]] · [[docs/docs-828/04-mechanisms/state-mutation]] · [[docs/docs-828/05-conventions/schema-sync]] · [[docs/docs-828/05-conventions/testing]] · [[adr-0007-shop-transaction-boundaries]]
