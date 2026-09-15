# Task：Runtime Mod Editor — 编辑器骨架优先切片

状态：proposed — 重新裁定 [[task-0071-runtime-editor-p0-capability-baseline]] 的交付顺序与首刀目标

## 一句话

在游戏运行时内交付一个**能新建并编辑新 mod 资源、改完马上看到结果**的编辑器骨架，并按代码中的**内容策略表**逐项开放可写内容；不再把「全部内容类型的能力授权冻结」当作开工前置。

## 与 task-0071 的关系

### 承接（原样保留）

- Draft / Runtime 分离：Draft 在 Apply 成功前不进入 Registry、PlayerState 或 Runtime 已提交事实；
- 单工作区 / 单临时 Mod / 单实体 mutation 的提交边界（沿用 [[runtime-editor-overlay-sol-review]] 的裁定）；
- `prepare → 受控 Registry mutation → 必要物化 → commit / rollback` 的原子语义；Apply 失败不得留下半应用状态；
- **未授权内容不得出现可写入口**（这条指令正确，保留为 UI 硬约束）；
- `modName` 首期锁名；不做 Rename / namespace migration；
- Definition existence ≠ PlayerState existence；State Policy 默认 `Retain`。

### 取代（原 P0 前置冻结）

| task-0071 的要求 | 本 Task 的处理 |
|---|---|
| P0-A：覆盖全部 33 个顶层 Content Key、11 列授权矩阵，逐行冻结后才开工 | 改为**内容策略表在代码中落地**，它是唯一授权真源；文档只登记「已授权行」，其余归一行 `未授权`。加能力 = 加一行策略 + 一个字段级测试 + 一条用户场景 |
| P0-B：三套状态维度 + `RuntimeState` 三值 + Last Apply Attempt / Last Successful Apply 历史 | 降为：两个只读投影（Draft / Runtime）+ UI 侧 `dirty / applied / apply-failed`。不引入 revision 持久化与 apply 历史 |
| 逐 Content Key 裁定 State Policy，未裁定不得实现 | 通则：局部 mutation 与整包 reload 均默认 `Retain`；`Purge` 必须显式立项并附场景 |
| 每个 Content Key 每项能力都要一个 Acceptance Scenario + 一个新 Task | 改为字段级测试 + 用户场景；不为同质扩展重复立法 |
| P1 首刀 = `spots.revealTriggers` 递归条件组 | 降为 S2「复杂字段适配器」首例（保留其原验收场景）；S1 先交付覆盖面骨架与基础字段 |
| 禁止复用 `tools/datapack-editor` 的通用编辑模型 | 改为：抽取**框架无关的 schema 渲染内核**复用；工具自身的 `TableKey` 漂移不在本 Task 修 |

### 删除（不进入任何切片）

- 全量矩阵前置冻结；
- 跨表统一 `DefinitionKey` 身份体系（沿用现有 `{ table, id }`）；
- 统一 Diagnostics 服务与阶段来源协议（复用现有 `RuntimeContentDiagnostic`）；
- Inspection 因果树 / 第二套效果模拟器。

## 「可用的编写体验」验收口径

本 Task 的成败以此五条衡量，而不是以矩阵覆盖面衡量：

1. **无需读文档即可上手**：能看见「有哪些内容类型」「我编了什么」「哪些改动还没生效」；
2. **编辑只改 Draft**：Apply 前游戏画面与运行结果完全不变；
3. **Apply 一键且可失败**：失败给出可定位到字段或条目的错误，且当前运行结果不变；
4. **引用即选择**：引用字段的候选来自当前 Registry 并提供显示名，不需要手打 id；
5. **不能编的内容不装样子**：明确显示为只读 / 未授权，不出现点了没反应的入口。

## 设计边界

### 内容策略表是唯一授权真源

内容类型与可写字段的授权，写在数据服务层的一张声明表里，形状大致为：

```text
ContentKey
  ├─ fields: { key, kind, required, refTable? }[]   # 可写字段集与类型约束
  ├─ apply: 'local-mutation' | 'reload'             # Apply 策略
  ├─ derived: ('spot-index' | 'tag-index' | 'visibility' | 'gamnum')[]  # 必要物化清单
  └─ state: 'retain'                                # 状态策略；purge 需显式登记
```

规则：

- 未登记的 Content Key 与未登记字段一律拒绝写入，UI 显示为只读 / 未授权；
- 登记项必须同时有字段级测试；新增能力只改这一张表 + 补测试 + 补一条用户场景；
- 文档矩阵（见 [[task-0071-runtime-editor-p0-capability-baseline]]）降级为本表的**投影**，只用于阅读，不再是开工闸门。

### 身份与状态（最小化）

- 局部标识沿用 `idName`，全局标识沿用现有 `mod:type:id` 三段式；不为本 Task 新建身份体系；
- 编辑状态由 Draft 与解析结果推导（`unchanged / created / modified / removed`），不持久化为 Def 生命周期字段；
- UI 侧运行状态只有三值：`dirty`（Draft 新于最近一次成功 Apply）、`applied`、`apply-failed`（最近一次 Apply 失败且 Draft 保留）；
- 解析状态继续使用现有 `resolved / suspended / missing`。

### 复用边界

- 从 `tools/datapack-editor` 抽取**纯渲染内核**：`FieldDef` / `FieldType` → 表单标记的递归渲染（`object` / `array` / `union` / `tagged` / `ref` / 可折叠列表）；
- 不搬入其 `EditorModel` 历史栈、表注册、导入导出流程；
- 游戏内 UI 只负责 Draft 状态绑定、Query 投影与 Apply，不持有 Registry 写引用；
- 抽取过程中若遇到工具侧既有的 `TableKey` / 条件目标漂移，**绕过而不顺手修**，另立任务。

## 当前事实与代码落点

- `src/data-services/contracts/datapack.ts` 是顶层内容清单的唯一合同，共 33 个 Content Key；
- `src/arona-clicker/services/runtime-content-coordinator.ts` 已实现 prepare / 受控提交 / 回滚，但可写字段**硬编码**为 9 个常量：白名单、字段类型校验、`toSpotDef` 默认值填充、`cloneSpot` 深拷贝四处彼此独立，加一个字段要改四处；
- `toSpotDef` 目前把 `levelUpgrades`、`tags` 硬填为空数组；`src/data-services/contracts/world.ts` 的 `SpotDef.revealTriggers` 是可选字段，因此当前**根本无法通过提交通道**；
- `src/data-services/registry/registry-spot-mutation.ts` 已具备「受控 mutation + Receipt + rollback」形态，是泛化的最佳起点；
- `src/ui/workspace/runtime-datapack-editor-state.ts` 只承载单表 Draft，已有 `applied` / `error` 两个状态位；
- `src/ui/components/runtime-datapack-editor.ts` 只有三个渲染函数（开关 / Mod 元信息 / 单个 Spot 表单），没有浏览器、列表、筛选、差异视图或诊断列表；
- 条件目标的权威定义在 `src/engine/types/expression.ts` 的 `ConditionTarget`；Reveal 合同在 `src/engine/contracts/reveal.ts`，运行时消费方在 `src/engine/visibility/` 下；
- 既有测试入口：`tests/engine/runtime-content-coordinator.test.ts`、`tests/engine/runtime-hot-content.test.ts`、`tests/engine/arona-runtime-pack.test.ts`。

## 施工切片

### S0：内容策略表与通用写通道（已完成 2026-09-15）

落地产物：

- `src/data-services/authoring/content-policy-types.ts`：`ContentKey` 直接从 `Datapack` 顶层内容字段派生（`Exclude<keyof Datapack, 'name' | 'version' | 'modName'>`），策略行形状、可写字段语义（`WritableFieldKind`）、Apply 策略、派生清单与状态策略；
- `src/data-services/authoring/content-policies.ts`：已授权内容表，当前只有 `spots` 一行（9 个可写字段 + `defaults` + `derived` + `state` + `mutate` 适配钩子）；
- `src/data-services/authoring/content-policy.ts`：表查询与通用通道——`validateAuthoringInput` / `validateAuthoringFieldValue` / `buildAuthoringDef` / `authoringEntityId` / `cloneAuthoringDef` / `applyAuthoringMutation`；
- `src/arona-clicker/services/runtime-content-coordinator.ts`：删除 `RUNTIME_SPOT_FIELDS`、`validateSpotInput`、`validateIdName`、`toSpotDef`、`cloneSpot` 五处硬编码，改为策略表驱动；提交经 `applyAuthoringMutation` 进入现有 Receipt / rollback 语义，单实体 mutation 的原子边界不变；
- `tests/data/content-policy.test.ts`：授权范围、字段授权、Def 构建与受控提交的契约测试。

边界澄清（与原文的差异）：

- 「表名 + 已校验 Def」的声明式入口已存在，但 **Registry 内部仍按表实现**：`applySpotMutation` 的 Area / Tag 索引、suspended record、mutation revision 与 receipt 回滚仍是 Spot 专用。S0 不重写这套已验证的原子回滚；等第二张表（S1）出现真实索引与回滚需求时再泛化，避免在没有第二个样本时凭空抽象。
- 因此完成定义修正为：**为新表开放写能力时，只需新增一行策略（含该表的 `mutate` 适配）+ 字段级测试，不需要修改协调器**。

验收（已通过）：

1. 未登记字段被明确拒绝并给出策略表路径（`spot.functionalities`）；
2. 登记字段必须能通过并完成物化，`buildAuthoringDef` 产出完整 Def；
3. 策略表键与 `Datapack` 顶层内容键的一致性由测试显式报告，未登记键逐项列出（`spots` 已登记，其余如 `characters` 保持未授权）；
4. `local-mutation` 授权项必须登记非空派生清单且 `state === 'retain'`，否则测试失败。

### S1-A：编辑器骨架（已完成 2026-09-15）

- `src/ui/workspace/runtime-editor-form.ts`：策略表驱动的表单层——`runtimeEditorFieldViews`（字段标签来自策略表 `label`，引用候选来自当前 Registry，控件按 `kind` 选择）、`runtimeEditorInitialValues`（新建初值由 `initialValue` + kind 推导）、`renderRuntimeEditorFields` / `readRuntimeEditorFields`（含锁定字段回读）、`runtimeEditorDiff`（按**编码值**比较，不比较两种表示法）、`renderRuntimeEditorProblems` + `problemFieldKey`（诊断定位回字段）；
- `src/ui/components/runtime-datapack-editor.ts`：新增 `renderRuntimeEditorWorkspace`——**内容浏览器**（条目 + 编辑状态徽标 + 编辑/删除入口 + 按状态筛选）、**Apply 区**（待应用计数）、**差异面板**、**诊断列表**；实体表单改为策略驱动并展示与运行中版本的差异；
- `src/ui/workspace/runtime-datapack-editor-state.ts`：新增 `appliedSpots`（最近一次成功 Apply 快照，作为 Runtime Effective 的 UI 侧依据）、`runtimeEditorEntryState`（created / modified / unchanged）、`runtimeEditorPendingSpots`、`browserFilter`、`problems`；
- **行为变更**：保存只写 Draft；新增显式「应用到运行时」；Apply 前游戏画面与 Registry 完全不变，Apply 成功后条目转为「已生效」，失败则保留 Draft 并进入诊断列表；
- **校验单源化**：UI 不再重复 idName 正则、必填、Area 存在性等规则，统一调用 `validateAuthoringInput` / `validateAuthoringFieldValue`；UI 只保留 Draft 级规则（同 ID 重复、已应用条目改名）；
- 测试：新增 `tests/ui/runtime-editor-form.test.ts`；有意改写 `tests/ui/topbar-settings-workspace.test.ts` 的编辑器流程断言（字段属性改为策略键、模态字段改为 `data-runtime-editor-mod-field`、`spotIdName`/`spotName` → `idName`/`name`），并把「保存即生效」改为「保存 → 差异 → Apply」。

### S1-B：首批内容类型授权（已推迟）

> **更正（2026-09-15）**：本切片已由 [[task-0073-spot-field-authoring-ladder]] 重裁并**推迟**。
> 新顺序为：先在 Spot 上把字段编辑能力打满（数值 / 标量 / 标签 / 引用 / `functionalities`），并借 Spot 沉淀可移植的 kind 扩展、字段级失效台账与统一引用解析接口；内容表扩展与 Registry 按表泛化等该 Task 完成后再恢复。
> 以下内容保留为**恢复条件**，不是当前施工项。

- `runtime-datapack-editor-state.ts` 从单表 Draft 扩为多表 Draft 容器，但**提交粒度仍为单实体 mutation**；
- 引用字段候选继续按 `refType` 从 Registry 解析（当前只接 `area`），来源（本 Mod / 基础包）筛选补齐；
- 从 `tools/datapack-editor/ui/components/field-editor.ts` 与 `tools/datapack-editor/schema/types.ts` 抽取框架无关渲染内核，游戏内只做状态绑定；
- 新增第一张非 Spot 内容表时，同步把 `Registry` 的索引 / suspended / revision / rollback 从「Spot 专用」泛化为按表登记的物化协议——这是 S0 明确留给第二张表的工程点。

首批内容类型的选取判据（三条同时满足，用于 S1-B）：

1. 派生失效路径可复用 Spot 已建立的窄协议，或无需派生物化；
2. 无 PlayerState 结构性耦合，`Retain` 语义已足够；
3. 是「编写一个新 mod 内容」的最小单位。

按此判据的候选顺序：`areas`（Spot 的父上下文，Registry 已有索引、UI 已有局部读取）→ `tags`（Spot / Area 的引用目标）→ `items` → `resourceDisplays`。**每张表必须先有策略表行才允许进入 S1-B**，未登记的表保持只读。

完成定义：用户可以在自己的 Mod 内新建 area、新建引用该 area 的 spot、修改数值、看到 Draft 与 Runtime 的差异、一键 Apply，并能反悔（删除 Draft 条目）（S1-A 已完成其中的 Spot 部分与全部骨架）。

### S2：复杂字段适配器（首例：Spot Reveal 条件组）

- 通过策略表把 `spots.revealTriggers` 登记为结构化字段（嵌套、递归），由 S0 的通用通道承载，同时打通 `toSpotDef` / `cloneSpot`；
- 条件编辑器支持原子条件与递归 `AND` / `OR` 组；条件目标以 `ConditionTarget` 为准，无法提供可靠候选的目标显示为自由值 / 受限值 / Deferred，**不伪造引用表**；
- `unlock` 保留 [[task-0071-runtime-editor-p0-capability-baseline]] 的裁决：当前 Spot 购买路径未消费，因此只读展示「当前 Spot 路径未消费」，开放编辑需另立矩阵行与场景；
- 无条件条目语义由现有引擎解释为恒真，UI 不自行改写。

验收沿用 [[task-0071-runtime-editor-p0-capability-baseline]] 的 6 条 Reveal 场景（打开真实 Spot 看到多条 Reveal；新增 `existence` 条件并在 Apply 前后对比；`AND` / `OR` 嵌套重开后不丢失；非法条件进入诊断且不 Apply；Apply 成功后 Visibility / 详情可观察；Apply 失败保留 Draft 并保持 Runtime 用上一次成功版本）。

### S3：工作区持久化与导出

- 持久化 Draft、Tombstone、`modName` 锁定状态与恢复编辑所需的必要上下文；
- 恢复后 Diagnostics 基于当前启用集、Schema 与 Registry 重新计算，旧诊断不作为事实；
- 导出产物可经 `src/data-services/datapack/pack-manager.ts` 重新加载；源文件分片与行级布局不属于验收条件。

## 用户验收场景

| 编号 | 场景 | 关联切片 |
|---|---|---|
| US-1 | 新建 Mod（输入合法且不冲突的 `modName`，锁定）→ 新建 area → 新建引用该 area 的 spot → 游戏栏出现该 spot | S0 / S1 |
| US-2 | 编辑已有 spot 的名称与数值 → Apply 前游戏画面不变 → Apply 后变化 | S0 / S1 |
| US-3 | 所属 Area、资源、标签等引用字段从候选下拉选择，不需要手打 id | S1 |
| US-4 | 提交缺失必填、非法 id、引用不存在时，错误定位到具体字段与条目，Apply 不发生 | S0 / S1 |
| US-5 | 浏览器可筛出「Draft 已改但未生效」的条目，并能看出是否属于编辑中的 Mod | S1 |
| US-6 | 删除 Draft 条目（Tombstone）后，游戏侧行为按策略表执行（Spot 当前为 `Retain`，PlayerState 不清） | S1 |
| US-7 | 刷新后 Draft、`modName` 锁定状态与编辑上下文恢复；诊断重新计算 | S3 |
| US-8 | 未授权内容类型（如 `characters`）只读展示，界面无可写入口 | S1 |
| US-9 | 新建一条含 `AND` / `OR` 嵌套的 Reveal 条件并 Apply，Visibility 与详情按要求变化 | S2 |

## 明确不做

- 不建立通用 DefinitionRepository、SourceStack、Materializer、LayerManager 或事务框架；
- 不把 Registry 改成通用可写数据库，不实现全类型 Runtime 热 CRUD；
- 不实现完整引擎因果追踪或第二套效果计算器；
- 不一次性开放 33 个 Content Key 的写能力；
- 不实现 Mod Rename 的批量 namespace migration；
- 不实现存档迁移与版本兼容；
- 不顺手修 `tools/datapack-editor` 既有的类型漂移（仅在抽取内核时绕过）；
- 不做玩家向权限模型（本 Task 面向作者 / 开发模式）。

## 测试与验收

每刀必须带 vitest 测试（`npm test` 通过才算完成）。S0 的字段策略契约测试为强制项：未登记字段必须被拒绝、登记字段必须能通过、派生物化清单缺失时不得授权 `local-mutation`。

切片完成后统一运行：

```text
npm test
npx tsc --noEmit
npm run check:architecture
npm run check:docs
```

P0 阶段的旧验收口径（只跑 `check:docs`）不再适用：本 Task 从 S0 起就产出运行时代码。

## 剩余工作

- ~~S0 策略表落地并把 Spot 现有 9 字段迁移为其数据来源~~（已完成，见上文 S0）；
- ~~S1-A 编辑器骨架（策略驱动表单 / 内容浏览器 / 差异与 Apply / 诊断定位）~~（已完成，见上文 S1-A）；
- ~~S1-B 首批内容类型授权与 Registry 按表物化泛化~~（已推迟到 [[task-0073-spot-field-authoring-ladder]] 之后）；
- S2 Reveal 条件组适配器；
- S3 工作区持久化与导出；
- 由 [[task-0071-runtime-editor-p0-capability-baseline]] 的矩阵投影出「下一批候选能力」清单，作为 S1 之后的开刀顺序参考，而不是开工闸门。

## 当前核验（2026-09-15）

- S0 完成后：`npm test` 158 文件 / 1473 用例通过；S1-A 完成后：**159 文件 / 1479 用例通过**；
- `npx tsc --noEmit`：通过；
- `npm run check:architecture`：通过（新增 `src/data-services/authoring/` 未引入越界依赖）；
- `npm run check:docs`：通过。

## 相关路由

- [[task-0071-runtime-editor-p0-capability-baseline]]
- [[task-0055-runtime-datapack-editor-mvp]]
- [[task-0057-single-mod-editor-workbench]]
- [[task-0061-runtime-hot-content-crud-spot]]
- [[task-0062-runtime-spot-editor-simple-flow]]
- [[task-0063-runtime-editor-command-facade]]
- [[runtime-editor-overlay-sol-review]]
- [[def-resolution-withdrawal-sol-review]]
- [[16-runtime-datapack-authoring]]
- [[adr-0011-definition-resolution-withdrawal]]
- [[adr-0012-runtime-hot-content-crud]]
- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/01-architecture/design-constraints]]
- [[docs/docs-828/05-conventions/schema-sync]]
