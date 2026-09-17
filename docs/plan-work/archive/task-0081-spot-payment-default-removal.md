# Task：Spot 默认支付字段退役与价格组全面收敛

状态：done — ✅ 已完成（2026-09-16）

前置任务：[[task-0080-spot-cost-and-payment-extensibility]]

## 目标

移除 Spot 对“一个默认金额 + 一个默认 Resource”的隐式支付依赖，所有 Spot 解锁与升级支付统一使用新的价格组（`PaymentOptionDef` / Runtime Editor 中的 `PaymentOptionDraft`）。

本 Task 完成后：

- Spot 解锁必须声明顶层 `purchaseOptions`；
- Spot 升级必须在对应 `levelUpgrades[].paymentOptions` 中声明支付方案；
- 同一价格组内的 `costs` 继续表示 AND，可同时消耗多个 Resource / Item；
- 多个价格组继续表示 OR，由玩家或命令显式选择；
- 引擎、服务、Builder、默认内容、测试内容和 Runtime Editor 不再生成或消费隐式 `id: 'default'` 支付方案；
- 不再保留旧字段兼容回退，不编写存档迁移。

## 背景与术语

本 Task 中：

- “价格组”指一个 `PaymentOptionDef`，包含 `id`、可选 `label` / `condition` 与 `costs`；
- “价格系列”指价格组内的 `costs` 列表；
- 同一价格组内的多个价格系列项全部需要满足；多个价格组之间由调用方选择其一；
- “默认支付”特指由旧字段或缺省分支自动拼出的支付方案，不特指用户主动声明的某个方案名称。

`id: 'default'` 若在数据包中被显式声明，可以作为普通方案 ID 保留；代码不得再把它当作特殊回退入口或自动生成它。

## 设计边界

### 纳入范围

1. `SpotDef` 的解锁支付字段与 `LevelUpgradeDef` 的升级支付字段。
2. `SpotService` 的支付方案解析、升级价格生成、购买 / 升级失败结果。
3. Spot def-factory、正式默认 Datapack、测试 Datapack 与相关 fixture。
4. Runtime Editor 的字段策略、Draft / Input / Def round-trip、支付页和升级条目编辑。
5. Registry / authoring 校验、Schema 生成与三向同步测试。
6. Spot tooltip、支付方案 View 和相关 UI 测试。
7. `docs/docs-828/` 中已经实现的 Spot 支付事实说明。

### 不纳入范围

- Shop 多支付途径；Shop 本轮继续只复用多 Resource / Item 成本，不引入价格组选择。
- 非 Resource / Item 的支付 Provider、兑换率、自动兑换与异步支付。
- Init、Enhancement、Gacha 等其他消费方的所有旧成本字段；只有它们直接依赖 Spot 旧字段时才做必要解耦。
- PlayerState 新账本、存档迁移或旧存档兼容。
- 重新设计 `PaymentOptionDef` 的 AND / OR / Condition 语义；这些语义沿用 [[task-0080-spot-cost-and-payment-extensibility]] 的已落地裁定。

## 当前事实与代码落点

| 旧入口 / 行为 | 当前落点 | 本 Task 处理 |
| --- | --- | --- |
| `SpotDef.baseCost` + `baseCostResource` 表示解锁默认价格 | `src/data-services/contracts/world.ts` | 删除字段；由 `purchaseOptions` 取代 |
| 缺省 `purchaseOptions` 自动生成 `id: 'default'` | `src/arona-clicker/services/spot-service.ts` | 删除回退；缺失方案按结构化无支付方案错误处理 |
| `LevelUpgradeDef.cost` + Spot 默认 Resource 表示升级价格 | `src/data-services/contracts/world.ts`、`src/arona-clicker/services/spot-service.ts` | 删除旧字段与回退；升级条目使用 `paymentOptions` |
| `upgradeCostBase` / `upgradeCostGrowth` 自动计算并沿用默认 Resource | `world.ts`、`spot-service.ts`、`src/ui/components/tooltip-detail-spot.ts` | 删除隐式价格源；需要曲线时在 Builder / 内容层展开为价格组 |
| Builder `.cost()` / `.costResource()` 写入旧字段 | `src/arona-clicker/content/def-factory/spot.ts` | 退役旧 API，改用显式价格组 Builder 入口 |
| Builder `.genericUpgrade()` 同时写旧升级价格与线性产出 | `src/arona-clicker/content/def-factory/spot.ts` | 拆分价格生成与产出功能；输出只能包含 `paymentOptions` |
| Runtime Editor 基础页编辑旧金额 / 资源字段 | `src/data-services/authoring/content-policies.ts`、`src/ui/runtime-editor/` | 删除旧字段控件，支付页成为解锁价格唯一入口 |
| Runtime Editor Draft / Input 含旧字段 | `src/ui/runtime-editor/state.ts`、`src/arona-clicker/contracts/runtime.ts`、`runtime-content.ts` | 删除旧字段，更新 hydrate / clone / stash / apply |
| authoring decode 对旧字段仍保留兼容读写 | `src/data-services/authoring/content-policy-dsl.ts` | 删除旧字段编码 / 解码兼容；无法转换的旧定义应明确失败或由内容迁移完成 |
| 默认内容大量使用 `.cost()` / `.genericUpgrade()` | `src/arona-clicker/content/` | 全部改成显式或编译期展开的价格组 |
| 现有测试验证旧字段回退 | `tests/engine/spot-payment.test.ts`、`tests/data/content-policy.test.ts`、`tests/engine/def-factory/spot.test.ts` | 删除旧兼容断言，补充缺失价格组与显式免费方案测试 |

## 目标数据契约

### Spot 解锁

`SpotDef.purchaseOptions` 成为解锁支付的唯一来源，并且应声明至少一个方案。免费 Spot 使用一个显式价格组表达：

```text
purchaseOptions: [
  { id: 'free', label: '免费', costs: [] }
]
```

不再允许通过省略 `purchaseOptions` 获得默认信用点方案。`purchaseOptions: []` 不表示免费，应在 authoring / Registry 边界给出“至少需要一个解锁价格组”的诊断。

### Spot 升级

`LevelUpgradeDef.paymentOptions` 成为该等级的唯一支付来源。每个需要支付的等级必须有至少一个价格组；免费升级同样使用一个 `costs: []` 的显式方案。

本 Task 推荐删除以下旧字段：

- `LevelUpgradeDef.cost`；
- `SpotDef.upgradeCostBase`；
- `SpotDef.upgradeCostGrowth`。

如果内容仍需要按等级递增的价格，价格曲线只能作为 Builder / 内容编译阶段的便利语法，最终必须展开为每个等级的 `paymentOptions`，并且支付目标必须在该便利语法中明确指定，不能再次隐式继承解锁资源。

### 方案选择与失败

- 只有一个可用价格组时继续自动选择；
- 多个可用价格组时继续要求 `paymentOptionId`，不按数组顺序静默扣款；
- 没有可用价格组时区分条件不满足、库存不足、结构非法和没有声明价格组；
- 失败不得部分扣费，也不得回退到任何旧字段；
- UI 与 Runtime Editor 继续展示价格组、价格系列、缺口和诊断。

## 施工切片

### P0：契约退役与校验边界

- [x] 从 `SpotDef` 删除 `baseCost`、`baseCostResource`、`upgradeCostBase`、`upgradeCostGrowth`。
- [x] 从 `LevelUpgradeDef` 删除 `cost`，明确 `paymentOptions` 的必填 / 非空规则。
- [x] 确认免费解锁 / 免费升级只使用显式 `PaymentOptionDef`，不使用空方案列表。
- [x] 更新 `PaymentOptionDef` 校验：方案 ID 唯一、价格组数量、价格系列引用与金额规则保持一致。
- [x] 为缺失解锁方案、缺失升级方案、显式免费方案分别定义结构化诊断。
- [x] 更新所有 Runtime / Domain contract，保证旧字段不能从命令输入重新进入 Registry。

### P1：Spot 服务与 View 收敛

- [x] 删除 `SpotService.paymentOptionDefs()` 的旧字段回退分支与自动 `default` 方案。
- [x] 删除 tooltip / Spot View 对 `baseCost`、`baseCostResource`、升级曲线的隐式读取。
- [x] 将升级价格读取统一改为当前等级条目的 `paymentOptions`。
- [x] 保持多 Resource / Item 的原子扣费、多个价格组的显式选择和现有错误码语义。
- [x] 确认缺失价格组不会被错误当作免费，也不会触发旧默认支付。

### P2：Builder 与内容迁移

- [x] 退役 `.cost()` / `.costResource()` 的旧写入语义，提供清晰的价格组构建入口。
- [x] 将 `.genericUpgrade()` 中的支付价格与线性产出拆开；保留的曲线便利 API 会在构建结果中展开为逐级 `paymentOptions`。
- [x] 迁移 `src/arona-clicker/content/`、`src/data/` 与测试内容，使所有 Spot 都使用价格组。
- [x] 为信用点单项、Resource + Item 混合、免费方案、多方案和按等级价格组分别保留最小内容样例。
- [x] 检查 `default-datapack` 与 test Datapack 的所有 Spot 不再含旧字段。

### P3：Runtime Editor 全链路更新

- [x] 从 `SPOT_CONTENT_POLICY.fields` 删除 `baseCost` / `baseCostResource` / `upgradeCostBase` / `upgradeCostGrowth`。
- [x] 删除 `RuntimeEditorSpotDraft`、`RuntimeSpotInput` 与相关 contract 中对应字段。
- [x] 顶层支付页要求并编辑 `purchaseOptions`；升级条目要求并编辑 `paymentOptions`。
- [x] 更新 `content-policy-dsl.ts` 的 validate / encode / decode，禁止旧字段静默保留或被重新写回。
- [x] 更新 `hydrateRuntimeEditor`、clone、stash、apply 和诊断路径，确保未知旧字段不会被静默覆盖。
- [x] 保留价格组 → 价格系列的嵌套弹窗栈行为，以及应用失败后回到 Spot 编辑态的行为。
- [x] 更新 Runtime Editor 知识文档中的字段清单、示例和 AI 检查清单。

### P4：Schema、回归与文档收束

- [x] 执行 `npm run gen:schema`，不得手改生成产物。
- [x] 更新 Schema 三向同步测试与所有 Spot / authoring / Builder / Runtime Editor fixture。
- [x] 删除旧默认支付兼容测试，补充“缺失价格组拒绝”“显式免费成功”“旧字段不再接受”测试。
- [x] 更新 `docs/docs-828/02-modules/world`、`runtime-editor` 与相关机制文档，使当前事实不再描述旧兼容字段。
- [x] 完成全量测试、类型、架构、文档检查和必要的浏览器验收后归档本 Task。

## 验收标准

### 数据与引擎

- [x] TypeScript 的 `SpotDef` / `LevelUpgradeDef` 不再暴露旧支付字段。
- [x] 任一 Spot 缺失 `purchaseOptions` 时不会自动获得信用点默认支付；会得到明确诊断或不可购买状态。
- [x] 任一升级条目缺失 `paymentOptions` 时不会自动继承解锁资源或旧升级金额。
- [x] 显式免费价格组可成功完成解锁 / 升级；空价格组列表不能伪装成免费。
- [x] Resource、Item、混合支付、多项支付和多价格组选择全部保持正确。
- [x] 支付失败时没有部分扣费、等级变更、统计变化或事件泄漏。

### 内容与编辑器

- [x] 正式默认内容与测试内容全部通过价格组校验，仓库中不存在 Spot 旧字段产物。
- [x] Runtime Editor 基础页不再出现默认金额 / 默认资源控件。
- [x] 支付页能创建、编辑和校验价格组；升级页能创建、编辑和校验等级价格组。
- [x] 价格组 → 价格系列的保存、取消、Esc、遮罩关闭和 Apply 失败回退均不丢失父级上下文。
- [x] Runtime Editor round-trip 不会将旧字段或不支持结构静默写回。
- [x] Shop 多 Resource / Item 消费现有行为不回归，且不出现多价格组选择 UI。

### 结构与流程

- [x] Schema 生成物由 `npm run gen:schema` 产生，三向同步检查通过。
- [x] 不添加存档迁移或旧字段兼容层。
- [x] Runtime Editor、Spot Service、Authoring 和文档对价格组术语与字段命名一致。

## 测试与验收命令

```text
npm run gen:schema
npx tsc --noEmit
npx vitest run tests/engine/spot-payment.test.ts tests/engine/def-factory/spot.test.ts tests/data/content-policy.test.ts tests/ui/runtime-editor-form.test.ts tests/ui/runtime-editor-payment-actions.test.ts
npm test
npm run check:architecture
npm run check:docs
```

如修改了构建入口或默认内容装配，再补跑：

```text
npm run build
```

## 实施结果（2026-09-16）

- `SpotDef.purchaseOptions` 与 `LevelUpgradeDef.paymentOptions` 已成为必填价格组入口；旧支付字段从 World、Runtime、Authoring 和 Editor Draft 合同中移除。
- SpotService、Tooltip 和 Registry 均只读取显式价格组；缺失方案返回 `PaymentNotDeclared`，空方案列表在 Authoring / Registry 边界拒绝。
- 显式免费方案统一使用 `{ id: 'free', costs: [] }`；多 Resource / Item 费用、多方案选择、逐级升级价格和原子扣费保持有效。
- Runtime Editor 支付页与升级页已同步新合同，价格组 → 价格系列的嵌套弹窗栈及 Apply 失败回退测试保持通过。
- 默认内容、测试内容、独立编辑器 Schema fixture 与核心 zip 已完成价格组化；Builder 的 `.cost()` 仅保留为输出显式 `purchaseOptions` 的过渡拼写，不再写入旧字段。
- 当前事实文档已收敛到价格组模型，未添加存档迁移或旧字段兼容层。

## 验证结果

- `npm run gen:schema`：通过。
- `npx tsc --noEmit`：通过。
- 定向回归：12 个测试文件、130 项通过。
- `npm test -- --reporter=dot`：163 个测试文件、1529 项通过。
- `npm run check:architecture`、`npm run check:docs`、`npm run build`：通过。

## 归档说明

实现、测试和知识文档均已完成；本文件随后移入 `docs/plan-work/archive/`，作为本轮 Spot 支付收敛的施工记录保留。

## 相关路由

[[task-0080-spot-cost-and-payment-extensibility]]
[[docs/docs-828/02-modules/world]]
[[docs/docs-828/02-modules/runtime-editor]]
[[docs/docs-828/03-data-structures/declarative-dsl]]
[[docs/docs-828/05-conventions/schema-sync]]
[[docs/docs-828/05-conventions/testing]]
