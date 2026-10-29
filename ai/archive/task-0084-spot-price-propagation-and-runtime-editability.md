# Task 0084：Spot 价格传导链与初始价格可编辑性

状态：已完成

## 问题描述

部分 Spot 的初始价格定义能够正常参与解锁或升级购买，但进入 Runtime Editor 后无法编辑，保存时还可能被标记为无法无损回写。表现上像是价格“只读”或“丢失”，需要区分真实价格未传导、编辑器反解析失败，以及编辑器为防止覆盖动态表达式而主动阻止保存。

## 当前链路核验

### 1. 内容定义层

- `SpotBuilder.purchaseCost(value, resourceId)` 将价格写成顶层 `purchaseOptions` 的一个方案。
- `value` 可为数字，也可为 `ValueExpression`；数字会包装为 `Expr.const(value)`，表达式保留动态求值能力。
- `SpotBuilder.purchaseOptions(...options)` 可以整体替换解锁价格方案。
- 等级升级价格位于 `levelUpgrades[].paymentOptions`，与顶层解锁价格不是同一字段。

### 2. Registry 层

- `Registry.load()` / Spot 校验器检查顶层 `purchaseOptions` 与每级 `paymentOptions` 的结构、方案 ID、费用类型和费用引用。
- Registry 保存完整的 `PaymentOptionDef`，不会把价格压缩成单一金额。

### 3. 购买服务层

- `SpotService.paymentOptionDefs()`：解锁读取 `spot.purchaseOptions`，升级读取下一等级的 `levelUpgrades[].paymentOptions`。
- `PaymentService.evaluate()` 使用 `ValueSystem` 求值，因此动态金额可以在运行时生效。
- `PaymentService.select()` 处理条件、余额、多支付途径选择和费用聚合。
- `SpotService` 将选中的 Resource / Item 费用转换为扣款，并通过 `commitSpotTransaction()` 与解锁或升级原子提交。

### 4. Runtime Editor 层

- `hydrateRuntimeEditor()` 从 SpotDef 复制支付方案。
- `decodePaymentOptions()` 只把数字或 `Expr.const(number)` 反解析为可编辑金额。
- 动态表达式、非法结构或未知费用类型会进入 `unsupportedPaymentOptionPaths`，并阻止 Runtime Editor 无损回写。
- 支付方案 UI 输入框只接受常量数值；保存时 `encodePaymentOptionList()` 会将数值重新编码为 `Expr.const()`。

## 初步结论

价格在游戏内生效的链路是完整的；当前不可编辑的主要原因是“引擎价格表达能力”高于“Runtime Editor 可回写表达能力”。尤其是由 `purchaseCost(ValueExpression)` 或其他内容工厂产生的动态金额，能够被 `PaymentService` 求值，却不能被当前表单还原为一个常量输入框。

另外，顶层解锁价格与升级价格分属两个位置，后续实现必须避免只修复 `purchaseOptions` 而遗漏 `levelUpgrades[].paymentOptions`。

## 目标

1. 明确 Spot 解锁与升级价格的统一传导契约。
2. 让 Runtime Editor 能识别并展示 Spot 默认价格的真实来源与表达能力。
3. 为可安全编辑的常量价格提供稳定的 round-trip；对动态价格提供明确诊断，不静默清空。
4. 保证默认价格修改后 Registry、购买服务、UI 展示和支付扣款使用同一份新定义。
5. 为未来 Affector 追加价格保留独立合并边界，不提前侵入 Spot 编辑器。

## 已裁定方案

### Spot 默认价格层

Spot 自身只声明默认购买定义：顶层 `purchaseOptions` 负责默认解锁价格组，`levelUpgrades[].paymentOptions` 负责默认升级价格组，价格组内包含 Resource / Item 费用与支付条件。

RuntimeEditor 只编辑这组默认定义。默认金额采用常量数值，条件组使用现有条件编辑器。数字与 `Expr.const(number)` 必须能够稳定完成 Def → Draft → Def 往返。

Spot 自身若使用动态金额表达式，仍由引擎正常求值，但当前 RuntimeEditor 将其作为不可无损回写内容：展示具体路径诊断，不冻结成当前值，也不静默清空整个价格组。

### Affector 追加价格层

外部 Affector 追加的价格组属于独立运行时系统：不写回 SpotDef、不进入 RuntimeEditor 的 Spot 草稿、不与 Spot 默认价格组混存，由未来独立的 Affector 编辑 / 配置入口维护。购买服务未来再将默认价格组与 Affector 追加价格组合成为有效购买途径。

本任务不实现 Affector 追加价格，只固定两层边界。

## 实施范围

### 包含

- SpotBuilder、Datapack 内容中的初始价格来源盘点。
- `SpotDef → Registry → SpotService → PaymentService → StateMutation` 价格链路测试。
- `purchaseOptions` 与 `levelUpgrades[].paymentOptions` 的 Runtime Editor 反解析和回写测试。
- 动态表达式、常量、Resource / Item、多费用项、多支付方案和免费方案的行为核对。
- 明确 UI 对不可编辑价格的提示和保存保护。

### 不包含

- Shop 价格体系重设计。
- 新增支付资产类型。
- PlayerState / 存档迁移。
- 在方案裁定前直接把动态价格强制转换为常量。

## 验收标准

- 初始常量价格可以在 Runtime Editor 中读取、修改、保存并立即影响购买。
- 初始动态价格仍按原表达式生效，编辑器不会静默清空或改写成错误常量。
- Spot 编辑器草稿不包含外部 Affector 追加价格。
- 顶层解锁价格与各级升级价格都能被分别核验。
- 多 Resource / Item 费用、多个支付方案、条件支付和免费方案的传导保持一致。
- 价格编辑失败时保留原 Runtime 定义，并给出具体路径诊断。
- 相关引擎、数据策略和 UI 测试通过；默认层裁定同步更新 `docs/docs-828/02-modules/world.md` 与 `runtime-editor.md`，Affector 合并机制另立任务。

## 关联代码与文档

- `src/arona-clicker/content/def-factory/spot.ts`
- `src/data-services/contracts/cost.ts`
- `src/data-services/contracts/world.ts`
- `src/data-services/registry/registry.ts`
- `src/arona-clicker/services/spot-service.ts`
- `src/arona-clicker/services/payment-service.ts`
- `src/data-services/authoring/content-policy-dsl.ts`
- `src/ui/runtime-editor/collection-prototypes.ts`
- `src/ui/runtime-editor/state.ts`
- [[docs/docs-828/02-modules/world]]
- [[docs/docs-828/02-modules/runtime-editor]]
- [[task-0080-spot-cost-and-payment-extensibility]]

## 执行记录

- 2026-09-16：裁定 RuntimeEditor 只处理 Spot 自身默认价格 / 条件组；Affector 追加价格组独立维护。
- 2026-09-16：确认现有反解析与保存保护已满足该边界：常量价格可回写，动态表达式进入 `unsupportedPaymentOptionPaths` 并阻止无损覆盖。
