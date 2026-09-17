# 02-modules/runtime-editor — 游戏内 Runtime Editor

> 本文回答：**后续 AI 如何在游戏内 Runtime Editor 中构建、编辑和提交临时 Spot 内容。**这里的 Runtime Editor 指 `src/ui/runtime-editor/`，不是已弃用的 `tools/datapack-editor/`。

## 一句话定位

Runtime Editor 是一个面向运行中游戏的 Spot 热内容草稿编辑器：UI 维护草稿，Authoring Policy 负责字段白名单、校验与编码，Runtime Content Coordinator 负责版本化提交和回滚，Registry 才是最终的定义落点。它适合临时 Mod / 内容原型 / 运行时快速构建，不是通用 Datapack 编辑器，也不直接修改 `PlayerState`。

## AI 最短施工路径

接到“用 Runtime Editor 构建内容”的任务时，按下面顺序读取和行动：

1. 先读本文，再按目标补读 `src/ui/runtime-editor/` 相关文件、`SPOT_CONTENT_POLICY` 与对应测试。
2. 确认要操作的是当前 Runtime Editor，而不是 `tools/datapack-editor/`。
3. 决定是新建、替换、删除、暂停还是恢复 Spot；新建和替换使用 `RuntimeDefinitionEditorCommands`，输入用 `RuntimeSpotInput` / `RuntimeEditorSpotDraft` 组装。`idName` 是局部名，不带完整 Mod 前缀。
5. 保留 Spot 的基础字段：`areaId`、`name`、`description`；支付必须通过显式 `purchaseOptions` 提供。
6. 需要多资产支付时，用 `purchaseOptions`；每个方案的 `costs` 可同时列 Resource 和 Item。
7. 先通过 `validateAuthoringInput`，再通过 Runtime Command Facade 提交；不要直接写 Registry 或 PlayerState。
8. 修改字段后同步补充 round-trip、校验和提交测试；最后运行类型、测试、架构与文档检查。

## 职责边界

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| `src/ui/runtime-editor/` | 表单、草稿、分页暂存、集合子对话框、错误展示 | 直接写 Registry / PlayerState |
| `src/data-services/authoring/` | 可编辑字段白名单、输入校验、Draft → Def 编码、Def → Draft 解码 | 页面 DOM 与游戏流程 |
| `src/arona-clicker/contracts/runtime-content.ts` | 编辑器与 Runtime 服务之间的输入、操作、诊断契约 | 自己解释字段语义 |
| `RuntimeContentCoordinator` | Mod 会话、revision、原子提交、回滚、提交通知 | UI 展示与支付结算 |
| `Registry` / Spot 服务 | 保存定义、构建关系索引、执行实际 Spot 购买/升级 | 维护编辑器草稿 |

运行时 UI 仍遵守只读纪律：业务 UI 通过 `getView()` / `createUIContext()` 消费视图；Runtime Editor 的写操作只能走 `ctrl.commands` 暴露的命令门面。

## 核心调用链

```text
runtime-editor/actions.ts
        ↓ 读取表单、暂存当前页、整理 RuntimeSpotInput
SPOT_CONTENT_POLICY
        ↓ validateAuthoringInput / buildAuthoringDef
ctrl.commands.runtimeDefinitionEditor
        ↓ createSpot / replaceSpot / deleteSpot / suspendSpot / resumeSpot
RuntimeDefinitionEditor
        ↓
RuntimeContentCoordinator.submit / applySpotMutation
        ↓ 校验 mod、revision、字段与引用
Registry.applySpotMutation
        ↓
spotDefinitionChanged → Spot / Visibility / Affector 等订阅者刷新
```

`RuntimeDefinitionEditor` 位于 `src/arona-clicker/services/spot-content-service.ts`，是 Runtime Editor 的命令门面；`RuntimeContentCoordinator` 位于同目录下的 `runtime-content-coordinator.ts`，是热内容提交的事务协调层。

Apply 前还会提交 Runtime Mod 元信息。Apply 过程中若某个 Spot 提交失败，UI 停止后续提交并显示诊断；Coordinator 的提交观察者失败时会尝试回滚 Registry。

## 三种数据形态

| 形态 | 位置 | 用途与注意事项 |
| --- | --- | --- |
| `RuntimeEditorSpotDraft` | `src/ui/runtime-editor/state.ts` | UI 内部草稿；含 `idName`、页面暂存字段、集合编辑结果和 round-trip 诊断字段。 |
| `RuntimeSpotInput` | `src/arona-clicker/contracts/runtime-content.ts` | 命令输入；字段名与 `SPOT_CONTENT_POLICY` 的 `fields` / `extensions.inputKey` 对齐。 |
| `SpotDef` | `src/data-services/contracts/world.ts` | Registry 中的引擎定义；使用完整实体 ID、`ValueExpression`、`TagPath` 等引擎类型。 |

转换方向是 `Draft/Input → validateAuthoringInput → buildAuthoringDef → SpotDef`。从 Registry 回到编辑器时，Runtime 层使用 `decodeSpotContent`，其中可解码的常量表达式被还原为编辑器可编辑的数字。

不要把 `RuntimePaymentOptionDraft` 当成引擎层的 `PaymentOptionDef`：前者是编辑器常量输入，后者是编码后的定义。对应地，`PaymentCostDraft` 与 `CostItem` 也不是同一层类型。

## Policy：编辑器的唯一字段白名单

`src/data-services/authoring/content-policies.ts` 中的 `SPOT_CONTENT_POLICY` 同时描述：

- `fields`：Spot 的标量字段、类型、是否必填、所在页面和引用类型。
- `extensions`：功能项、升级、解锁支付方案、揭示、标签、卡池引用等列表型结构的编码器和校验器。
- `materialization`：字段消费者、失效方式和提交后触发链；没有明确消费者的字段不能开放编辑。
- `defaults` / `unsupportedFieldHint` / `apply`：默认值、不支持范围和本地热变更策略。

当前 Spot 可编辑的扩展包括：`functionalities`、`levelUpgrades`、`purchaseOptions`、`revealTriggers`、`tags`、`gachaPools`。其中 `purchaseOptions` 与 `levelUpgrades[].paymentOptions` 只表示 Spot 自身的默认价格层；外部 Affector 追加价格属于独立运行时系统，不进入 Spot 草稿，也不由本编辑器编辑。`purchaseOptions` 的页面归属是 `payments`；空数组表示当前没有购买途径，主题、`colorGroupId` 和 `extra` 仍未开放。

新增 Runtime Editor 字段必须同时完成：

1. 在 `content-policy-types.ts` 定义输入 Draft 类型。
2. 在 `content-policy-dsl.ts` 增加 validate / encode / decode，必要时记录不能无损回写的结构。
3. 在 `content-policies.ts` 注册字段或 Extension，并写明消费者与失效链。
4. 在 Runtime contract、Editor state 的 hydrate / clone / stash / apply 边界，以及 `view.ts`、`collection-prototypes.ts`、`collections.ts` 或 `subdialog.ts` 接入它。
5. 增加 Policy、Coordinator、表单 round-trip 和 action 测试。

## Spot 支付方案写法

解锁支付使用 Spot 顶层的 `purchaseOptions`；升级条目使用 `levelUpgrades[].paymentOptions`。两者复用同一套方案与费用项结构。

```ts
const spot: RuntimeSpotInput = {
  idName: 'archive',
  areaId: 'base:area:campus',
  name: '档案室',
  description: '保存资料。',
  purchaseOptions: [
    {
      id: 'credit-and-ticket',
      label: '信用点与票券',
      costs: [
        { type: 'resource', resourceId: 'base:resource:credit', amount: 100 },
        { type: 'item', itemId: 'base:item:ticket', amount: 1 },
      ],
    },
  ],
};
```

语义是：同一方案内的 `costs` 全部需要满足（AND）；多个 `purchaseOptions` 之间由玩家任选其一（OR）。当可用方案多于一个时，Spot 购买 UI 弹窗要求选择方案；单一方案直接执行。Shop 目前只复用多 Resource / Item 费用项，不接入多购买途径选择。

支付输入约束：

- Resource 费用使用 `type: 'resource'` + `resourceId` 且金额为有限非负数；Item 费用使用 `type: 'item'` + `itemId` 且金额为非负整数。
- `id` 必须唯一，并符合小写字母、数字、`_`、`-` 的方案 ID 规则。
- `condition` 是条件 DSL；若只需要普通支付，不要添加空条件对象。
- Resource 引用必须存在于 Registry 的 `resourceDisplays`，Item 引用必须存在于 Registry 的 `items`。
- 编辑器只把常量金额写回为 `ValueExpression`；不要假设它能编辑任意动态表达式。

`purchaseOptions` 是 Spot 默认解锁支付的必填声明：缺失字段是配置错误，显式空数组表示当前没有购买途径。免费解锁必须声明一个 `costs: []` 的方案。升级条目的 `paymentOptions` 同样必填且不能为空，免费升级也使用显式空费用方案。这样缺失价格组不会被解释为免费或继承旧字段。外部 Affector 价格组未来由独立系统追加，不改变这份默认声明。

## 编辑器 UI 的状态与集合编辑

Runtime Editor 按 Policy sections 渲染页面。Spot 当前主要页面是概览、基础、归属、支付、功能、升级、揭示和诊断。

Spot 自身的 `metadata` 属于 Def 审计元数据，不作为普通表单字段编辑：新建提交时生成 `createdAt` / `updatedAt`，成功替换时保留 `createdAt` 并更新 `updatedAt`。表单输入、草稿暂存和失败提交不更新时间；外部 Affector 的运行时追加内容也不修改 Spot 的时间。

- 顶层支付页编辑 `purchaseOptions`。
- 升级条目内编辑 `paymentOptions`，方案内再编辑 `costs`。
- `PaymentOptionPrototype` 与 `PaymentCostPrototype` 位于 `collection-prototypes.ts`；费用项的变体键是 `type`，选项值来自 Registry 的 Resource / Item 表。
- 子对话框通过集合绑定把嵌套列表写回父条目；嵌套条目用 `subdialog` 的 `push` 模式保留父弹窗，保存 / 取消后回退到父级，不要在 DOM 中维护第二份状态。
- 切换页面前必须先 `stashSpotForm`；Apply 前必须再次保存当前页面。只读当前 DOM 会丢掉其它页面和嵌套对话框的修改。
- 列表编辑、字段编辑和 Apply 后都应重新渲染当前 Editor 视图，并让错误留在 Editor state 中。

## Round-trip 与诊断策略

Registry 中的 Spot 可能来自手写 Datapack，因此并非所有定义都能被 Runtime Editor 无损表达。

`decodeSpotContent` 对 Spot 默认支付方案只接受可还原的常量金额。遇到动态金额、非法结构或其他暂不支持的方案内容时：

1. 保留 `unsupportedPaymentOptionPaths` 诊断路径。
2. 在 Runtime Editor 的诊断页显示问题。
3. Apply 时阻止静默覆盖，并要求先在 Datapack 中处理该定义。
4. 真正组装命令输入前剥离诊断元数据；这些元数据不是 `RuntimeSpotInput` 的业务字段。

这条规则同样适用于已有的 `unsupportedFunctionalityIds`。Runtime Editor 不应为了“让保存成功”而把无法回写的引擎结构变成空数组或默认值。

## AI 构建内容检查清单

写入或生成 Spot 前，逐项确认：

- 是否明确使用了 `RuntimeSpotInput`，而不是直接拼 `SpotDef`。
- `idName` 是否是当前 Runtime Mod 内唯一的局部 ID，且已转小写。
- `areaId`、Resource ID、Item ID 是否存在；功能、揭示、卡池等引用是否符合对应 Registry 表。
- 是否填写了 `areaId`、`name`、`description`，并明确区分 `purchaseOptions` 缺失、空数组（无购买途径）和含 `costs: []` 的免费方案。
- 多资产同一途径是否放在一个 `costs`；不同途径是否拆成多个 option。
- 顶层解锁是否用 `purchaseOptions`，升级是否用 `paymentOptions`。
- 是否把免费支付写成显式 `PaymentOptionDraft`（`costs: []`），而不是省略价格组。
- 是否在 Policy 校验通过后才调用 Command Facade。
- 是否处理了 round-trip 诊断，未把 `unsupported...` 元数据提交给 Runtime 服务。
- 是否为新增结构补充至少一个失败校验和一个成功 round-trip / 提交测试。

## 常见误区

| 误区 | 正确做法 |
| --- | --- |
| 把 Runtime Editor 当成独立 Datapack 编辑器 | 当前入口是 `src/ui/runtime-editor/`；独立工具仅作历史参考。 |
| 在 UI 中直接调用 Registry 或修改 PlayerState | 通过 `ctrl.commands.runtimeDefinitionEditor`；运行时状态仍走既有 Mutation 管道。 |
| 顶层和升级都写 `paymentOptions` | 顶层解锁是 `purchaseOptions`，升级条目才是 `paymentOptions`。 |
| 费用项只允许 Resource | `PaymentCostDraft` 支持 Resource / Item，按 `type` 分支填写对应 ID。 |
| 动态金额回读后当成 0 或空值保存 | 标记诊断并阻止 Apply，保持无损原则。 |
| 缺少 Spot 解锁或升级价格组 | 通过 Policy / Registry 诊断修正；不能依赖默认信用点或空数组回退。 |
| 只读取当前支付页来 Apply | 先 stash 当前页，再从完整 `editor.spots` 草稿提交。 |
| 直接扩展旧的字段拷贝逻辑 | 先登记 `SPOT_CONTENT_POLICY`，再沿 hydrate → view → stash → apply 全链路接入。 |

## 关键文件与测试入口

| 目的 | 首读文件 |
| --- | --- |
| UI 状态、分页、Apply | `src/ui/runtime-editor/state.ts`、`actions.ts` |
| 表单与集合 / 子对话框 | `view.ts`、`form.ts`、`collection-prototypes.ts`、`collections.ts`、`subdialog.ts` |
| 字段政策与 DSL | `src/data-services/authoring/content-policies.ts`、`content-policy-dsl.ts`、`content-policy-types.ts` |
| Runtime 边界与提交 | `src/arona-clicker/contracts/runtime-content.ts`、`services/spot-content-service.ts`、`services/runtime-content-coordinator.ts` |
| Runtime 装配与热定义同步 | `src/arona-clicker/runtime.ts` |
| 支付回归 | `tests/data/content-policy.test.ts`、`tests/ui/runtime-editor-form.test.ts`、`tests/ui/runtime-editor-payment-actions.test.ts` |
| 提交回归 | `tests/engine/runtime-content-coordinator.test.ts` |

推荐验证顺序：

```text
npx tsc --noEmit
npx vitest run tests/data/content-policy.test.ts tests/ui/runtime-editor-form.test.ts tests/ui/runtime-editor-payment-actions.test.ts tests/engine/runtime-content-coordinator.test.ts
npm run check:architecture
npm run check:docs
```

若同时修改了引擎机制、Registry 或状态链，再补跑 `npm test` 与 `npm run build`。

## 相关文档

[[docs/docs-828/00-INDEX]] · [[docs/docs-828/02-modules/ui]] · [[docs/docs-828/02-modules/world]] · [[docs/docs-828/02-modules/registry]] · [[docs/docs-828/04-mechanisms/state-mutation]] · [[docs/docs-828/05-conventions/architecture-discipline]] · [[docs/docs-828/05-conventions/testing]] · [[task-0080-spot-cost-and-payment-extensibility]]
