# Task：Runtime Editor P0 能力矩阵与 Draft/Runtime 查询契约

状态：proposed — 2026-09-15 暂停推进，随活跃计划层清退移入冻结考古层

> **更正（2026-09-15）**：本 Task 的交付顺序与 P1 首刀目标已由 [[task-0072-runtime-mod-editor-authoring-spine]] 重新裁定。
> 具体变更：① P0-A 全量能力矩阵的前置冻结取消，改为在代码中落地内容策略表，本文矩阵降级为它的阅读投影；② P0-B 的三套状态维度与 Apply 历史降为两个只读投影 + UI 三值；③ 逐 Content Key 裁定 State Policy 与逐能力立法的流程取消；④ P1 首刀 `spots.revealTriggers` 降为 S2 复杂字段适配器首例。
> 本文以下内容作为**需求基线与能力台账**继续有效（不变量、失败语义、Reveal 目标边界、P1 Reveal 验收场景均被 0072 原样承接），但不再构成本任务的开工闸门。

## 目标

把 Runtime Editor 的 RTE-001～008 需求基线转化为可执行、可验收的 P0 约束，交付三项产物：

1. 覆盖当前 `Datapack` 合同全部顶层 Content Key 的 Content Capability Matrix；
2. 明确 Draft Projection 与 Runtime Effective Projection 的查询契约、身份规则和状态语义；
3. 为 RTE-001～008 编写可追踪到后续工程任务的 Acceptance Scenario。

本 Task 只冻结范围与接口语义，不实现完整 Authoring、通用 Diagnostics 服务、通用热更新或新的 Repository / Layer 抽象。

## 设计边界

### 产品能力编号与工程模块

RTE-001～008 是产品能力编号，不要求一一对应工程模块或服务。一个 RTE 可以由多个现有服务共同满足；不得因为某个 RTE 编号而预先创建同名 God Service。

### Capability Matrix 是规范性边界

矩阵是 Runtime Editor 的唯一能力授权表。某个 Content Key 未获得 `Create`、`Edit`、`Remove` 或 `Inspect` 能力时，施工任务不得以“顺手”“复用现有代码”或“技术上可行”为理由附带开放该能力。

新增或扩大能力必须先修改矩阵，并补充对应 Acceptance Scenario，再建立工程 Task。

### Draft 与 Runtime 分离

编辑器必须保留两个查询语义：

```text
Draft Projection
  当前工作区正在编辑的内容

Runtime Effective Projection
  当前游戏实际采用的内容
```

Draft 在 Apply 成功前不进入 Registry、PlayerState 或 Runtime Coordinator 的已提交事实。同一个 canonical ID 可以同时存在正式来源版本、Draft 版本和 Runtime 仍采用的旧版本。

### ModName 生命周期

首期规则：

```text
创建 Workspace
  → 输入并校验 modName
  → 确认
  → 开始创建 Authorable Content
  → modName 锁定
```

普通属性编辑不得隐式触发 namespace migration。显式 Rename Mod 不属于本 Task；若以后恢复，必须单独定义 canonical ID 批量重写、内部引用更新、失败回滚和验收场景。

### Apply 策略

用户只感知统一的 Apply 行为；局部 mutation、整包 reload 和状态保留策略由矩阵裁定。当前只有 Spot 具备较完整的局部热路径；其他 Content 首期不得因本 Task 获得通用热更新能力。

### Diagnostics 与 Inspection

Diagnostics 是跨来源校验结果的统一协议与展示入口，不是统一执行者。Schema、Resolution、Pack、Registry 和 Runtime Apply 可以继续由各自服务产生结果。

Inspection 首期只暴露现有引擎已经可靠拥有的结构化事实，不要求建立完整因果树、全引擎 provenance 或第二套模拟器。

### 持久化

工作区必须持久化 Draft、Tombstone 和恢复编辑所需的必要状态。Diagnostics 可以缓存，但恢复工作区后必须允许重新计算，不得把旧诊断当作事实。源文件分片和原始布局的保留不属于 P0。

## 当前事实与代码落点

- `Datapack` 顶层合同位于 `src/data-services/contracts/datapack.ts`，当前包含 `modName`、基础世界内容、剧情、物品、效果 / 触发、角色成长、色彩、卡池 / 商店、图片、资料、状态配置、资源显示、标签和 `extras` 等 Content Key。
- `Registry` 位于 `src/data-services/registry/registry.ts`，是注入 Datapack 的只读运行时物化层，暴露只读 Map / getter；目前仅 Spot 有受控的 `applySpotMutation` 和回滚 Receipt。
- `RuntimeContentCoordinator` 位于 `src/arona-clicker/services/runtime-content-coordinator.ts`，当前围绕单个临时 Mod 和 Spot mutation 维护已提交运行事实。
- `src/arona-clicker/runtime.ts` 已有 `modName` 格式校验和与已加载 Mod 的冲突检查，但尚未形成 Workspace 创建后锁名的完整生命周期。
- `src/ui/workspace/runtime-datapack-editor-state.ts` 主要保存编辑工作区 Draft；现有 Draft Resolution 只覆盖编辑层，不能代替 Runtime Effective Query。
- `SpotDef.revealTriggers` 已是现行 Spot 合同中的嵌套可编辑内容：每个 `RevealTrigger` 由揭示目标和可选条件组成，条件可以是原子 `Condition` 或递归的 `ConditionGroup`。
- `VisibilityEngine` 主要消费 `existence`，信息揭示 UI 消费 `name`、`condition`、`utility`，引擎还提供 `unlock` 的通用可达性判断；因此 Reveal 表的编辑结果必须沿用现有引擎语义，不能在编辑器中重新解释揭示规则。
- `PackManager`、`pack-parser.ts` 和 `pack-storage.ts` 已提供正式数据包加载 / 存储基础，但解析后的 `Datapack` 不保留完整的 JSON 分片和行级来源。
- `tools/datapack-editor/` 的通用编辑模型和 Schema 产物只作为复用参考；其中 `FieldDef` / `FieldType` 驱动的递归 `object`、`array`、`union`、`tagged`、`ref` 表单，以及可折叠列表和条件目标联动控件，可作为游戏内 Reveal 表单的交互模式参考。它不是当前游戏内编辑器的默认入口，且当前工具侧条件目标映射和类型检查仍存在与现行引擎合同不同步的问题。
- 当前默认正式内容入口是 `src/arona-clicker/content/default-datapack.ts`；`datapack/` 是可选导入内容，不得在本 Task 中改成新的正式事实源。

## P0 交付物

### P0-A：Content Capability Matrix

矩阵至少包含以下列：

| 列 | 含义 |
|---|---|
| Content Key | `Datapack` 顶层字段或明确的派生 / Runtime-only 内容键 |
| Content Class | Entity / Config / Structured DSL / Asset-backed / Derived |
| Browse | Draft / Runtime / 两者 / 不支持 |
| Inspect | 是否可查看 Runtime 结构化事实 |
| Create | 是否允许创建 |
| Edit | 是否允许修改 |
| Remove | 是否允许撤回 |
| Apply | Local Mutation / Reload / N/A / 未授权 |
| State Policy | 对已有 PlayerState 的影响，未裁定时不得实现 |
| Editor | Generic / Specialized / Read-only |
| Acceptance Scenario | 对应的最小用户场景 |
| Current Basis | 当前源码能力和缺口 |

能力值使用以下语义：

- `P1`：能力授权边界，允许由 Spot 纵向场景首期验证；
- `P2+`：能力授权边界，允许作为后续独立能力候选，但不由本 Task 或 P1 附带实现；
- `RO`：能力授权边界，只读浏览或检查；
- `Deferred`：能力授权边界，已识别但尚未授权；
- `N/A`：该内容不适用此能力。

以上值只描述 Capability Authorization，不描述当前代码是否已经实现。矩阵必须单独填写 `Current Implementation Status` 与 `Current Basis`，避免把“已列入 P1 / P2+”误读为“已有运行时代码”。

初始矩阵必须覆盖以下全部 Content Key，不能只覆盖当前已支持的 Spot：

| Content Key | Content Class | Capability Authorization | Apply 基线 | State Policy 基线 | Editor 基线 | Current Implementation Status | Current Basis |
|---|---|---|---|---|---|---|---|
| `inits` | Entity | `RO`；Authoring `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 Runtime Editor 写入口 |
| `areas` | Entity | `RO`；用于 Spot 场景上下文 | Reload / Deferred | 单独裁定 | Generic / Deferred | Runtime read-only | Registry 已物化；UI 有局部直接读取；无通用 Draft 查询 |
| `spots` | Entity | `P1` Browse / Inspect / Create / Edit / Remove | Local Mutation | `Retain`；`Purge` Deferred / `P2+` | Generic + Spot specialization | Partial Runtime CRUD | 已有 Coordinator、revision、Receipt 和局部索引刷新；Purge API 不等于 P1 产品授权 |
| `enhancements` | Entity | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry getter 存在；无 Editor Command |
| `activeStories` | Entity | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 Authoring 闭环 |
| `passiveStories` | Entity | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 Authoring 闭环 |
| `passivePools` | Structured DSL | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 DSL 编辑入口 |
| `stories` | Structured DSL | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 Story 专用编辑器 |
| `items` | Entity | `P2+` | Reload / Deferred | 单独裁定 | Generic / Deferred | Runtime read-only | Registry getter 存在；无 Runtime CRUD |
| `dropTables` | Structured DSL | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry getter 存在；无 DSL 编辑入口 |
| `affectorPacks` | Structured DSL | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Runtime 可加载 Affector；无编辑命令和安全应用边界 |
| `triggerDefs` | Structured DSL | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Runtime 可加载 Trigger；无编辑命令和安全应用边界 |
| `funcletDefs` | Structured DSL | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry getter 存在；无表达式编辑闭环 |
| `characters` | Entity | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 Runtime CRUD |
| `characterVariants` | Asset-backed Entity | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；资产与资料编辑未接入 |
| `cultivateCurves` | Config / Entity | `P2+` | Reload / Deferred | 单独裁定 | Generic / Deferred | Runtime read-only | Registry 已物化；无 Authoring 闭环 |
| `favoriteItems` | Entity | `P2+` | Reload / Deferred | 单独裁定 | Generic / Deferred | Runtime read-only | Registry 已物化；无 Runtime CRUD |
| `uniqueWeapons` | Entity | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 Runtime CRUD |
| `traits` | Entity | `P2+` | Reload / Deferred | 单独裁定 | Generic / Deferred | Runtime read-only | Registry 已物化；无 Runtime CRUD |
| `gears` | Entity | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 Runtime CRUD |
| `gearConfig` | Config | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 有配置合并和校验；无编辑入口 |
| `colorGroups` | Entity / Config | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 Runtime CRUD |
| `colorEquipments` | Entity | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 Runtime CRUD |
| `themeDesigns` | Entity / Config | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无 Runtime CRUD |
| `gachaPools` | Entity / Config | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry getter 存在；无 Runtime CRUD |
| `shops` | Entity / Config | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry getter 存在；无 Runtime CRUD |
| `pics` | Asset-backed Content | `RO`；Authoring `P2+` | Reload / Deferred | N/A | Specialized / Deferred | Runtime read-only | Pack 图片注册存在；无资产编辑和工作区写回 |
| `charaProfiles` | Asset-backed Config | `P2+` | Reload / Deferred | 单独裁定 | Specialized / Deferred | Runtime read-only | Registry 已物化；无资料 / 资产编辑闭环 |
| `characterPersistConfig` | Config | `RO`；Authoring `P2+` | Reload / Deferred | 必须先裁定 | Specialized / Deferred | Runtime read-only | Registry 有读取与缺省策略；状态影响未形成编辑契约 |
| `affectionConfig` | Config | `RO`；Authoring `P2+` | Reload / Deferred | 必须先裁定 | Specialized / Deferred | Runtime read-only | Registry 有配置校验；状态影响未形成编辑契约 |
| `resourceDisplays` | Config | `P2+` | Reload / Deferred | N/A | Specialized / Deferred | Runtime read-only | Registry getter 存在；无 Runtime Editor 写入口 |
| `tags` | Entity / Presentation Config | `RO`；Authoring `P2+` | Reload / Deferred | 单独裁定 | Generic / Deferred | Runtime read-only | Registry 有 Tag 解析和 Spot 索引关联；无 Tag Authoring 闭环 |
| `extras` | Config / Constant | `P2+` | Reload / Deferred | N/A | Generic / Deferred | Runtime read-only | Registry 支持展开 / 合并；无编辑入口 |

矩阵还必须补充不属于 `Datapack` 顶层字段、但容易被误认为编辑对象的派生内容：

| Derived / Runtime-only Content | 首期边界 |
|---|---|
| Registry Map 与 Registry 索引 | `RO`；不可直接 CRUD |
| Visibility 索引 / Reveal 结果 | `Inspect`；不可直接编辑 |
| GameNum 运行时值与生产索引 | `Inspect`；不可直接编辑 |
| Affector / Trigger 当前运行结果 | 按已有结构化事实提供 `Inspect`，不可直接编辑运行结果 |
| PlayerState | 不属于 Authorable Content；只能按 State Policy 读取 / 保留 / 清除 |

### P0-B：Draft / Runtime Query Contract

契约需要明确以下内容：

#### 身份

- UI 输入可以使用局部 `idName`；跨 Draft、引用、诊断和 Runtime 边界必须使用 canonical `DefinitionKey`；
- `sourceId` 只表示来源，不承担 Definition 身份；
- `modName` 作为编辑 Mod 的 namespace 使用，首期在产生第一个 Authorable Content 后锁定；
- 查询结果必须能够表达来源、实体身份、编辑状态、解析状态和 Runtime 应用状态。

#### 查询语义

至少定义两类查询，而不是让 UI 直接猜测 Registry 与 Draft 的关系：

```text
queryDraftContent(query)
  → 工作区视角的 Draft Projection

queryRuntimeEffectiveContent(query)
  → 当前已应用 Runtime 的 Effective Projection
```

两者都可以复用浏览器组件，但不得共享一个会隐式覆盖另一方的可写对象。

#### 状态维度

编辑状态和解析状态必须分离：

```text
EditState:
  unchanged | created | modified | removed

ResolutionState:
  resolved | suspended | missing

RuntimeState:
  not-applied | applied | apply-failed
```

`RuntimeState` 只描述当前 Draft 与“最近一次成功的 Runtime Effective Projection”及“最近一次 Apply attempt”的关系，不替代 `queryRuntimeEffectiveContent()` 的结果：

- `not-applied`：当前 Draft revision 尚未有成功 Apply 记录；
- `applied`：当前 Draft revision 与最近一次成功 Apply 的 revision 对应；
- `apply-failed`：当前 Draft revision 的最近一次 Apply attempt 失败，但最近一次成功的 Runtime Effective Projection 仍然有效。

必须能够表达以下状态，而不能用 `RuntimeState` 覆盖 Runtime 内容：

```text
Draft Projection: B
RuntimeState: apply-failed
Runtime Effective Projection: A
Last Apply Attempt: B → failed
Last Successful Apply: A
```

#### 失败语义

- Draft 查询或诊断失败不得改变 Runtime；
- Apply 失败不得留下半应用 Registry；
- Runtime Effective Projection 只反映最近一次成功 Apply 的内容；
- Diagnostics 恢复后可以重新生成，旧结果不得自动视为当前事实。

### P0-C：RTE Acceptance Scenarios

#### RTE-001 Workspace

1. 用户输入合法且未冲突的 `modName`，创建 Workspace 成功。
2. 用户输入非法或与启用正式 Mod 重名的 `modName`，Workspace 不能确认，并显示明确原因。
3. Workspace 创建第一个 Authorable Content 后，普通属性编辑不能再静默改变 `modName`。

#### RTE-002 Content Browser

1. 同一 canonical ID 存在正式版本 A、Draft 版本 B 且 Runtime 仍采用 A 时，`Draft View → B`、`Runtime View → A`。
2. 用户可以按 Content Key、ID、来源和编辑状态筛选内容，并能看出该内容是否属于编辑中 Mod。
3. 当前 Runtime 没有采用 Draft 时，浏览器不得把 Draft 标记为 Runtime Effective。

#### RTE-003 Authorable Content

1. 用户可以在编辑中 Mod 内创建、查看、修改、删除 Spot，并看到 canonical ID 和 Draft 状态变化。
2. 对矩阵中未授权的 Content，UI 只能显示 Browse / Inspect 或 Deferred 状态，不出现可写入口。
3. 普通 Definition CRUD 使用统一身份和引用规则；编辑器不得直接写入 Registry Map。

#### RTE-004 Diagnostics

1. Schema 校验发现字段错误时，错误以统一 Diagnostic 结果展示，且不触发 Runtime Apply。
2. Definition Resolution 发现 required 引用缺失、optional 引用缺失或 suspended 引用时，诊断来源和严重性可区分。
3. Registry / Pack / Apply 阶段失败时，UI 能展示阶段来源；不得要求一个新的超级校验服务复制各层检查逻辑。

#### RTE-005 Runtime Apply

1. 合法 Spot Draft Apply 成功后，游戏使用新 Spot，并刷新已有 Spot 相关索引 / 效果观察路径。
2. Apply 失败时，Runtime Effective Projection、Registry 和 PlayerState 保持应用前状态。
3. 后续由矩阵授权的非 Spot 内容可以使用整包 reload；用户不需要知道底层 Apply 策略，但测试必须验证对应 State Policy。Spot P1 只验证 `Retain`，PlayerState `Purge` 保持 `Deferred / P2+`。

#### RTE-006 Runtime Inspection

1. 用户可以查看 Spot 当前 effective Definition、Visibility / Reveal / Condition 等已有结构化事实。
2. 用户可以查看 GameNum 当前值及已知关联 Effect / Affector，但首期不要求完整因果证明树。
3. 对引擎没有可靠事实输出的解释内容，Inspection 必须明确标记为 unavailable / unsupported，不得自行推算为事实。

#### RTE-007 Reverse Lookup

1. 用户从游戏中的 Spot 界面进入 Inspection 时，可以定位到唯一 canonical DefinitionKey。
2. 游戏元素没有稳定 Definition 映射时，UI 显示不可反查原因，不伪造 Definition。

#### RTE-008 Persistence / Export

1. 保存并重新打开 Workspace 后，Draft、Tombstone、`modName` 锁定状态和必要编辑上下文恢复。
2. 恢复 Workspace 后，Diagnostics 可以基于当前启用集、Schema 和 Registry 重新计算；旧诊断不作为事实强制恢复。
3. 导出的 Datapack / ZIP 可以通过现有 PackManager 重新加载；源文件分片布局保留不属于本 Task 的验收条件。

## 施工切片

### P0.1：合同盘点与矩阵冻结

- 从 `src/data-services/contracts/datapack.ts` 逐项登记全部顶层 Content Key；
- 补充派生 / Runtime-only 内容，防止把 Registry 索引当作 Authorable Content；
- 为每行填写 Browse、Inspect、Create、Edit、Remove、Apply、State Policy 和 Editor；
- 标记当前已有能力、P1 授权能力、P2+ 候选和明确 Deferred 项；
- 为每个获得非 `RO` / `Deferred` 能力的行绑定 Acceptance Scenario。

完成定义：矩阵覆盖完整、每个能力有明确语义、未经矩阵授权的能力没有进入 P1 范围。

### P0.2：Draft / Runtime 查询契约

- 定义 Draft Projection 与 Runtime Effective Projection 的最小字段集合；
- 固定 canonical DefinitionKey、sourceId、modName、EditState、ResolutionState、RuntimeState 的关系；
- 定义查询结果在“Draft 已修改但 Runtime 未应用”时的行为；
- 定义删除 / Tombstone 在 Draft View 与 Runtime View 中的显示差异；
- 记录当前 UI 直接读取 Registry 的位置，作为后续收口清单，不在本 Task 中顺便改造所有调用点。

完成定义：任何后续 UI 或 Runtime Task 都能明确回答“查询的是 Draft 还是 Runtime”，并能表达 A / B 版本并存状态。

### P0.3：Acceptance Scenario 与 Task 拆分规则

- 将 RTE-001～008 的场景登记为后续工程任务的引用入口；
- 为 P1 Spot Vertical Slice 标记必须覆盖的 RTE 场景；
- 明确 P1 是验证完整闭环，不是“继续完善 Spot Editor”；
- 定义后续 Content Adapter 获得新能力时必须修改矩阵、补场景、再建 Task 的流程。

完成定义：每个后续 Runtime Editor Task 都能回答：

> 这个修改让哪个 Content Key 获得了 Matrix 中的哪项能力，并通过哪个 RTE Acceptance Scenario？

### P1 首个 Authoring 目标：Spot Reveal 表与条件编辑

P1 的第一个施工目标固定为：在 Spot 的 Draft 编辑界面中实现 `revealTriggers` 的表格化编写，并验证其条件能够被现有游戏引擎接收、应用和检查。

这里的“Reveal 表”是 `SpotDef.revealTriggers` 的可变嵌套列表，不是新增的 `Datapack.reveals` 顶层 Content Key，也不是新的运行时 Registry 表。它属于 `spots` 这一 Matrix 行的字段级 Authoring 能力。

#### 目标范围

- 在 Spot Draft 表单中显示 Reveal 条目列表；每行至少显示揭示目标、条件摘要和编辑状态。
- 支持添加、编辑和删除 Reveal 条目；编辑期间只修改 Draft，保存后才产生 Draft revision。
- 揭示目标使用当前 `RevealTarget` 合同：`existence`、`name`、`condition`、`utility`、`unlock`。
- 每个 Reveal 条目允许无条件；无条件的语义由现有引擎解释为恒真，不由 UI 自行改写。
- 条件编辑器支持单条原子条件，以及可递归嵌套的 `AND` / `OR` 条件组。
- 原子条件至少编辑 `target`、按目标类型适配的 `key`、`comparator` 和数值 `value`；引用型 key 应使用现有内容查询提供候选和显示名称。
- 条件目标选项必须以当前 `src/engine/types/expression.ts` 的 `ConditionTarget` 为准，不能直接复制旧 Editor 的目标列表。当前合同还包括 `tagCount`、`protoStat`、`area` 等旧 Editor 映射中未覆盖的目标；无法提供可靠候选的目标必须显示为明确的自由值 / 受限值或 Deferred，而不能伪造引用表。
- 条件组的嵌套结构、空条件、非法引用和数值类型错误必须进入统一 Diagnostics，不得因为表单可以构造对象就视为合法。

#### 旧 Editor 的复用边界

允许复用旧 Editor 的交互与字段描述思路：

```text
Reveal 条目列表
  → 可折叠数组项
    → 揭示目标选择
    → 条件表达式编辑
      → 原子条件
      → AND / OR 组递归编辑
        → 目标相关 key 控件
        → 比较符与数值
```

不在本目标中整体搬入 `tools/datapack-editor/` 的 `EditorModel`、Schema 表注册、独立导入导出流程或其历史 `TableKey` 模型。游戏内表单需要接入当前 Runtime Editor 的 Draft 状态和 Draft / Runtime 查询契约；旧 Editor 只提供可复用的“字段描述 + 递归渲染”模式。

#### Spot 的目标能力边界

- `existence`：允许编辑；其条件由 VisibilityEngine 建立和刷新 Spot 的存在性反向索引。
- `name`：允许编辑；其条件由现有 Info Reveal 逻辑决定名称是否已知。
- `condition`：允许编辑；其条件由现有 Info Reveal 逻辑决定条件信息是否已知。
- `utility`：允许编辑；其条件由现有 Info Reveal 逻辑决定描述、产出等效用信息是否已知。
- `unlock`：现行合同和通用引擎辅助函数可以表达，但当前 Spot 的购买可达路径并未像 Enhancement 一样使用 `unlockCondition`。因此 P1 不得把它宣传为已生效的 Spot 解锁门槛；若保留既有数据的浏览，应标记为“当前 Spot 路径未消费”，要开放可编辑并纳入有效行为必须先补充 Matrix 和 Acceptance Scenario。

#### P1 最小验收场景

1. 用户打开真实 Spot（优先使用 `base:spot:hangar_dispatch_deck`），可以在 Draft View 中看到多个 Reveal 条目，并区分 `existence`、`name`、`condition` 和 `utility` 的条件。
2. 用户新增一条 `existence` 条件：`spotLevel`、`resource` 等引用型目标能够选择合法 key；保存后 Draft View 能看到结构化条件和摘要，Runtime View 在 Apply 前保持原值。
3. 用户编辑一条包含 `AND` / `OR` 嵌套的 Reveal 条件；重新打开编辑器后结构不丢失，条件组的组合语义保持不变。
4. 用户提交缺失引用、非法目标、非法比较值或空的无效条件组时，统一 Diagnostics 能指出具体 Reveal 条目和条件路径，Apply 不发生。
5. 合法 Reveal Draft Apply 成功后，Spot 的 Runtime Effective Projection 反映新 `revealTriggers`；存在性条件能够更新 Visibility，名称 / 条件 / 效用条件能够在 Spot Inspection 或详情显示中观察到结果。
6. Reveal Draft Apply 失败时，Draft 可以保留失败内容并显示 `apply-failed`，Runtime 仍使用最近一次成功的 Reveal 定义；不能出现 Draft 已替换、Runtime 只替换了一半的状态。

#### 完成定义

该目标完成并不意味着 Spot 的所有字段都已开放，也不意味着通用表单系统完成。它只要求 `spots.revealTriggers` 获得矩阵授权范围内的字段级 Authoring，并通过现有 Visibility / Info Reveal 引擎形成可验证的 Draft → Apply → Runtime → Inspection 闭环。后续为 `levelUpgrades`、`functionalities` 或其他复杂字段复用同一交互模式时，仍须按 Matrix 新增能力和 Acceptance Scenario。

## P1 进入条件

P1 Spot Vertical Slice 只有在 P0 完成以下条件后才能开工：

- P1 的主闭环验收范围为 RTE-001～007；RTE-008 的完整 Persistence / Export 收口不作为 P1 的附带目标；
- `spots` 行已明确为 `P1` Authorable；
- P1 首个 Authoring 目标已固定为 `spots.revealTriggers` 表及其条件编辑；Reveal 条目的目标语义、条件目标范围和 `unlock` 的 Spot 限制已写入验收边界；
- `areas`、必要的 `tags` 和 Spot 运行结果查询边界已明确；
- Draft / Runtime Query Contract 已冻结；
- `modName` 创建后锁定规则已冻结；
- Apply 成功、Apply 失败和 Spot 仅 `Retain` 的 PlayerState 语义已写入验收场景；
- P1 的范围不包含其他 Content Key 的附带 CRUD。

## 明确不做

- 不在 P0 建立通用 DefinitionRepository、SourceStack、Materializer 或 LayerManager；
- 不把 Registry 改成通用可写数据库；
- 不实现全类型 Runtime hot CRUD；
- 不实现完整引擎因果追踪或第二套效果计算器；
- 不把 `tools/datapack-editor/` 整体搬入游戏内 UI；
- 不实现 Mod Rename 的批量 namespace migration；
- 不实现存档迁移；
- 不以 P0 名义开放矩阵中标记为 `P2+`、`Deferred` 或 `RO` 的写能力。

## 测试与验收

### 文档验收

- 矩阵覆盖 `Datapack` 全部顶层 Content Key，并补充派生 / Runtime-only 内容；
- RTE-001～008 每项有 1～3 个 Acceptance Scenario；
- 所有新能力都能追溯到矩阵行和场景；
- 文档只记录计划和当前事实，不把未来设计写入 `docs/docs-828/` 当前机制正文。

### 代码 / 静态验收

P0 若只产出文档，不要求修改运行时代码；完成后至少运行：

```text
npm run check:docs
```

若 P0 同时调整查询契约类型或现有 UI 状态类型，再追加：

```text
npm test
npx tsc --noEmit
npm run check:architecture
```

工具编辑器的专项类型检查不作为 P0 通过条件；若后续选择复用其模型，必须在独立 Task 中先处理当前 Schema / `TableKey` 漂移。

## 当前核验（2026-09-15）

- 已读取并对照 `Datapack` 合同、Registry、Runtime Content Coordinator、Runtime Editor 状态、PackManager / parser 和相关当前架构文档；
- `npm test`：通过；
- `npx tsc --noEmit`：通过；
- `npm run check:architecture`：通过；
- `npm run check:docs`：通过；
- `tools/datapack-editor` 专项类型检查：仍有既有 `TableKey` / 导入路径等问题，未作为当前 Runtime Editor 已完成能力；
- 本 Task 文档新增后需重新运行 `npm run check:docs`。

## 剩余工作

- 完成 P0.1～P0.3 的正式文档产物；
- 根据 P0 矩阵拆出 P1 Spot Vertical Slice Task；
- P1 完成后，再按矩阵为其他 Content Key 分别立项，不在本 Task 中预先承诺统一实现方式。

## 相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/01-architecture/data-flow]]
- [[docs/docs-828/01-architecture/state-layers]]
- [[docs/docs-828/01-architecture/design-constraints]]
- [[docs/docs-828/05-conventions/schema-sync]]
- [[task-0055-runtime-datapack-editor-mvp]]
- [[task-0056-workspace-datapack-boundary-convergence]]
- [[task-0057-single-mod-editor-workbench]]
- [[task-0061-runtime-hot-content-crud-spot]]
- [[task-0062-runtime-spot-editor-simple-flow]]
- [[task-0063-runtime-editor-command-facade]]
- [[16-runtime-datapack-authoring]]
- [[runtime-editor-overlay-sol-review]]
- [[def-resolution-withdrawal-sol-review]]

## 归档结果

- 准出结论：
  - **非完成归档（暂停搁置）**：2026-09-15 活跃计划层清退，本 Task 暂停推进并移入冻结考古层；原 P0 施工未开工，本文不作为任何后续任务的开工闸门。
- 当前知识与能力台账保留于：
  - 本文（33 个顶层 Content Key 的授权矩阵、Draft / Runtime 查询契约、RTE-001～008 验收场景）。该矩阵已由 [[task-0072-runtime-mod-editor-authoring-spine]] 降级为阅读投影，实际授权真源是源码中的内容策略表（`src/data-services/authoring/content-policies.ts`）。
- 设计理由保留于：
  - 本文；交付顺序的替代裁定见 [[task-0072-runtime-mod-editor-authoring-spine]]。
- 后续工作：
  - 本文「剩余工作」中的 P0.1～P0.3 正式文档产物不再需要（其开工闸门地位已由 0072 取消）；
  - 未完成方向统一下沉到 [[docs/plan-work/00-index]] 的「未决方向」，恢复时从原文重新裁定。
