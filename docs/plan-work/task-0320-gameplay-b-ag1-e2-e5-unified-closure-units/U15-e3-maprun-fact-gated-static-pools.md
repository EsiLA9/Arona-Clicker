# Unit 0320-U15：E3 MapRun Fact 门控的静态候选池

## Goal

在 Task 0317 已完成的 Map-local 静态候选池上增加一个受限动态来源：候选池可按 MapRun Counter 或 Flag 的单项条件启用。条件只读取 MapRun Facts，不读取外部成长、当前 Prepared 结果或临时 Owner 状态。

每个新 Encounter 在进入时冻结一次候选解析输入。该 Encounter 后续 Round 虽会重新抽取 Hand，但一直使用同一份冻结输入；进入下一个 Encounter 时，才用当时的 MapRun Facts 建立新快照。抽取、资格校验、AG-1 Commit 和 Save/Resume/Receipt Restore 必须从同一快照解析候选来源。

本 Unit 只实现 MapRun Fact 门控的静态 Map-local Pool。Prepared-source filter、成长／临时输入与跨 Map Pool 按本 Unit 末尾裁定延期或不纳入。

## 前置条件

- Task 0317 静态 Tag、Map-local Pool、候选权重合并、过滤和抽取基线保持完成，不重做其行为。
- U09a、U09b、U09c、U12b、U12c 已完成；MapRun Facts 的作者定义、Owner 状态、来源内顺序和 AG-1 Restore 重放均已可用。
- U13b Effect RNG/scheduler v3 与 U14 additionalTarget Runtime/scheduler v4 必须依序完成。U15 依赖 U14 完成后，在 scheduler v4 起点上增加候选输入重放字段并升级到 scheduler v5；不得与 U14 并行修改 Owner 文件。
- 如 0317 静态候选池合同或 U09/U12 Fact 行为已改变，先重新核实相关 Receipt 与源码，再开始施工。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 项目入口 | [[AGENTS.md]]、[[docs/ai/PROJECT-CONSTITUTION]] | Patch Unit 边界、停止条件与工作流 |
| 机制与作者合同 | [[docs/plan-work/task-0317-gameplay-b-static-tags-and-candidate-pools]]、[[docs/plan-work/task-0319-gameplay-b-prepared-tag-combo]] | 现行静态候选池与 Prepared Tag 基线 |
| 统一 Task | [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]]：P2/P3/P7 | 本阶段范围及剩余能力路由 |
| Fact 合同 | [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U09a-maprun-fact-author-contract]]、U09b/U09c、U12b/U12c Unit 与 Receipt | MapRun Fact 声明、快照、更新与 Restore 语义 |
| RNG / scheduler | [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U13a-e2-effect-rng-and-planner-random-targets]]、[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U13b-e2-owner-effect-rng-scheduler-v3]]、[[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14-e2-additional-target-runtime]] 与 Receipt | Hand/Effect RNG 分离、scheduler v4 起点重放及 additionalTarget 身份边界 |
| 作者上下文与消费者校验 | `src/data-services/validation/gameplay-map-effect-context.ts`、`src/arona-clicker/services/map/map-card-effects.ts`、`src/arona-clicker/services/map/map-encounter-statuses.ts` | 静态校验所有 gate 可启用来源；CardRef 与活动 Status 来源资格复用 Encounter 冻结 Facts |
| 作者类型与展开 | src/data-services/contracts/gameplay-map.ts：GameplayMapRunFactsDef、GameplayMapCandidatePoolDef；src/data-services/validation/gameplay-map-candidate-pools.ts：resolveGameplayMapCandidateSources | 增加闭合 Pool gate 并保留现有展开顺序 |
| Hand 与资格 | src/arona-clicker/services/map/gameplay-b-hand-resolver.ts、gameplay-b-action-preview-resolver.ts、map-run-service.ts：candidateActionIdsFor | 查明抽取、替换候选与资格重验的全部入口 |
| Owner 状态与 Restore | src/arona-clicker/contracts/map/map-run.ts：MapRunEncounterSnapshot、MapRunEncounterSchedulerStartSnapshot；map-run-service.ts：createEncounterSnapshot、schedulerStartSnapshotOf、restoreEncounterSnapshot、restoreAg1EncounterCommitReceipt | 保存每个 Encounter 的冻结输入并从同一输入重算 |
| 定向测试 | tests/data/gameplay-b-map-registry.test.ts、tests/engine/gameplay-b-map-run.test.ts、gameplay-b-map-ag1-commit.test.ts、gameplay-b-map-ag1-restore.test.ts | 作者边界、每轮 Hand、Commit 与历史重放 |
| Schema / 文档 | [[docs/docs-829/05-conventions/schema-sync]]、[[docs/docs-829/05-conventions/testing]]、[[docs/docs-829/03-data-structures/datapack-contracts]] | 同步生成 Schema、定向验证与作者说明 |
| 项目地图 | graph_project(acprogram) 后按上述目标路径只读核实 | 确认项目身份和实现路径；不编辑图、不刷新或写 freshness |

Read Set 仅覆盖以上文件和段落，不追溯历史 Task。若必须扩展到外部成长 Owner、Prepared 选择系统或跨 Map 供应者，停止并交 Task Owner 另行拆分。

## 已核实基线

| 事实 | 依据 |
| --- | --- |
| Task 0317 的 Pool 是 Map-local、有序、可包含 Action、Tag 和嵌套 Pool；相同 Action 在来源合并时累计安全整数权重，固定首次出现位置，然后执行资格／费用／目标过滤、Tendency 调整和现有 Hand RNG 抽取。 | Task 0317；GameplayMapCandidatePoolDef；resolveGameplayMapCandidateSources |
| 候选 resolver 只读取 Map 静态定义、直接候选与 Pool ID。Hand 抽取、Action Preview 和 MapRun 候选资格检查均直接或间接调用该 resolver。 | gameplay-b-hand-resolver.ts；gameplay-b-action-preview-resolver.ts；map-run-service.ts 的 candidateActionIdsFor 调用点 |
| 成功的非终局 Commit 会推进 Round 并再次调用 createEncounterSnapshot 抽取下一轮 Hand；同一领域 Encounter 的多个 Round 因而共享候选规则，但每轮会重新 draw。 | map-run-service.ts：commitMapEncounterRound 内 createEncounterSnapshot 调用 |
| 新 MapRun 的 Facts 从 MapRun 根状态进入 AG-1 source-start snapshot；U12c 让成功来源更新 detached Facts，成功 Commit 后安装；Restore 从起点重跑并核验。 | U09a/U09c、U12b/U12c Receipt；map-run.ts；map-run-service.ts |
| Prepared Tag 快照属于 Task 0319 的回合起始 Prepared 输入，仅计实际 Party Prepared Actions；它不是现有 Hand 候选解析输入。 | Task 0319 与 preparedTagCount Planner/Receipt 实现 |

## 冻结合同

### Pool gate

- 候选 Pool 定义新增可选 gate。gate 只能是一个原子条件，不提供逻辑组合、嵌套表达式或 Effect Program 复用。
- 作者形状固定为以下闭合联合；两种形状均不得带额外字段：

| gate kind | 必需字段 | 约束 |
| --- | --- | --- |
| counter | counterId、comparison、value | counterId 对应 MapRun Counter；comparison 为 eq、lt、lte、gt、gte 之一；value 为 safe integer |
| flag | flagId、value | flagId 对应 MapRun Flag；value 严格为 boolean |
- Counter gate 读取一个已声明的 MapRun Counter ID，使用 eq、lt、lte、gt、gte 之一比较单个 safe integer 常量。
- Flag gate 读取一个已声明的 MapRun Flag ID，与单个 boolean 常量比较是否相等。
- Registry 必须拒绝未知 Fact ID、Counter/Flag 类型不匹配、非安全整数、未知比较符、未知 gate 字段和额外表达式节点。Map 未声明 MapRun Facts 时不得声明 gate。
- 含任何 Fact-gated Pool 的 Map 必须显式使用 `executionContractId: 'AG-1'`；Registry 拒绝 E1-COMPAT-1／缺省执行合同上的 gate。该限制使候选历史完全由 AG-1 scheduler v5 重放，不扩展独立 E1/legacy Receipt Validator。
- gate 是 Pool 的准入条件。条件不匹配时，该 Pool 对本次候选展开贡献空集合；条件匹配时，按 0317 原顺序展开 entries。嵌套 Pool 各自评估自己的 gate；上层 gate 关闭时不会展开其子项。
- 静态 Action Tag 保持静态分类；gate 不改 Action tags，不生成 Action、不改写候选权重，也不改变既有 Pool-only／direct candidate 的资格错误策略。
- 同一 Action 的直接来源、通过 gate 的 Pool 与其他静态 Pool 仍按 0317 规则在过滤前合并权重；Safe Integer 上限和首次出现顺序保持不变。

### 候选解析器调用模式

- 候选展开必须显式区分静态作者校验与运行时解析，不能以“缺少事实快照”默认为 gate false。
- Registry/Effect Context 使用 `allPotentialSources` 静态模式：递归枚举所有可能由 Map 声明的 gate 开启的静态 Pool entries，忽略 gate 当前值但独立严格校验 gate 语法、引用与值域。该模式只用于检验所有潜在来源是否合规，不得用于运行时 Hand、目标或 Receipt。
- Hand、Action Preview、PlayerCommand 候选资格、卡牌目标资格、Status 来源资格与 Commit/Restore 使用 `runtime` 模式，并显式传入所属 Encounter 的 `candidateSourceSnapshot.mapRunFacts`。Fact gate 只读取这份冻结事实；带 gate 的 Map 缺少有效快照时解析失败并拒绝操作，不能把空候选当作合法结果。
- 运行时消费者清单闭合为：`gameplay-b-hand-resolver.ts`、`gameplay-b-action-preview-resolver.ts`、`map-run-service.ts`、`map-card-effects.ts`、`map-encounter-statuses.ts`。AG-1 Restore 继续由 scheduler 重跑实际 Planner；独立 `map-effect-receipt-validator.ts` 仅服务 E1/legacy，因 E1 Map 被禁止声明 gate，不改其合同或实现。
- `gameplay-map-effect-context.ts` 必须用 `allPotentialSources`，避免只验证入场初值 gate 打开的来源，导致后续 Fact 写入后新启用的候选绕过作者上下文校验。

### Encounter 快照与重放

- 只有包含至少一个 Fact-gated Pool 的 Map 才物化候选输入快照；没有 gate 的旧 Map 省略该字段并保持原行为。Map 作者必须声明 gate 引用的所有 Facts。
- MapRunEncounterSnapshot 与其 scheduler start snapshot 内的版本化 candidateSourceSnapshot 形状固定为 formatVersion=1 与 mapRunFacts=完整、规范顺序的 MapRunFactState。该快照只作为条件求值输入，不拥有或修改 Facts。
- 新 Encounter（进入 Node 或独立 Activity）首次建立时，从当前 MapRun 根 Facts 复制 MapRunFactState 并建立 candidateSourceSnapshot。
- 同一领域 Encounter 后续 Round 重抽 Hand、预览替换候选、提交资格复验及本 Encounter 的 Restore 一律使用该 Encounter 保存的 candidateSourceSnapshot；来源效果即使更新了 MapRun Facts，也不在当前 Encounter 内重评 Pool gate。
- 进入下一个 Encounter 时，以当时已经成功安装的 MapRun 根 Facts 建立新快照。失败、过期、Preview、Restore 验证或异常均不能改变候选输入快照。
- 每一轮 scheduler start snapshot 都复制同一 candidateSourceSnapshot。第二轮及以后，候选快照可能早于当前 round 的 scheduler MapRunFactState；Restore 不得要求两者相等，而要分别重放候选来源与本轮资源／Fact 计划。
- AG-1 Receipt Restore 必须从保存的 scheduler start snapshot 重建候选来源并重放完整计划；不能以 Restore 时当前 MapRun Facts 代替候选历史输入，也不能信任 Receipt 中单独保存的展开结果。
- Restore 检查快照版本、闭合 Facts 状态和 Map 声明；重新展开各 Party／Enemy 候选，与 Hand Action IDs、抽取终态 Hand RNG cursor、当前 Encounter 快照及 scheduler start snapshot 做一致性比较。任何不一致均拒绝恢复。
- 使用版本化格式：candidateSourceSnapshot format version 为 1。因 scheduler start snapshot 新增候选输入，schedulerFormatVersion 从 U14 的 v4 升为 v5；Restore 拒绝 v4 与未知版本，不增加迁移分支。使用新字段的定向测试 Map 将 `GameplayMapDef.resumeVersion` 从 U14 完成后的值 5 提升至 6。
- Hand RNG 算法、游标地址、同输入候选顺序与 0317 静态 Map 行为均保持。启用 gate 后因候选集合／权重发生变化而得到不同合法 Hand 属于预期；不得额外推进候选解析自身的随机状态。

## 两阶段施工

### A. 作者合同、Registry 与 Schema

Allowed Files：

- src/data-services/contracts/gameplay-map.ts
- src/data-services/validation/gameplay-map-candidate-pools.ts
- src/data-services/validation/gameplay-map-effect-context.ts（使用 allPotentialSources 校验所有 gate 可启用来源）
- src/data-services/registry/registry-validate.ts
- tests/data/gameplay-b-map-registry.test.ts
- tools/datapack-editor/schema/engine-defs.gen.json（仅 npm run gen:schema 生成）
- tools/datapack-editor/schema/engine-schema.sync.test.ts（仅需要时）
- docs/docs-829/03-data-structures/datapack-contracts.md
- docs/examples/gameplay-b-maprun-fact-gated-pools.md（新文件）

完成条件：闭合 gate AST/作者类型；Registry 按 Map Facts 声明校验引用、类型和值域；candidate resolver 能用传入的冻结 Facts 条件展开 Pool；Schema 由生成器同步；作者样例展示条件关闭、启用及嵌套 Pool。

### B. MapRun Owner、Hand 与 AG-1 Restore

Allowed Files：

- src/arona-clicker/contracts/map/map-run.ts
- src/arona-clicker/services/map/gameplay-b-hand-resolver.ts
- src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts
- src/arona-clicker/services/map/map-card-effects.ts（卡牌目标候选复用冻结 Facts）
- src/arona-clicker/services/map/map-encounter-statuses.ts（Status 来源资格复用冻结 Facts）
- src/arona-clicker/services/map/map-run-service.ts
- tests/engine/gameplay-b-map-run.test.ts
- tests/engine/gameplay-b-map-ag1-commit.test.ts
- tests/engine/gameplay-b-map-ag1-restore.test.ts
- tests/data/gameplay-b-map-registry.test.ts（仅更新本 Unit 新增正式示例的固定 Map ID/resumeVersion 清单）
- src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts（仅注册本 Unit 的正式示例 Map）
- tests/engine/gameplay-b-maprun-fact-gated-pools.test.ts（新文件）

完成条件：新 Encounter 冻结当前 MapRun Facts；相同快照贯通每轮 Hand 重抽、Preview、PlayerCommand/Enemy 候选资格、AG-1 scheduler v5 start snapshot 和 Receipt Restore；新 Encounter 重新采样；成功 Commit 与终局不丢失 Facts 或候选快照。

两阶段顺序执行。作者合同与生成 Schema 先通过后，再改 Owner；Owner 阶段不得越过上游合同或临时变更 0317 静态候选行为。Task Owner 维护本 Unit Receipt、Task 0320 与 00-index；施工 Agent 不修改这些记录。

## 明确延期／不纳入

| 能力 | 裁定 | 依赖 |
| --- | --- | --- |
| Prepared-source filter | 不纳入 U15。Task 0319 只提供冻结的 Prepared Tag 读取；当前回合 Hand 已由 Encounter 候选规则生成。未来若需用 Prepared 影响候选，须先明确作用于哪个后续 Encounter/Hand、何时冻结与失效，并作为 E5 子 Unit 冻结。 | E5 Prepared 交互合同；不得用 Prepared 重筛当前已抽 Hand。 |
| Cultivate、Gear、Skill、好感、星级等成长 Tag/Pool 注入 | 不纳入 U15；Fact gate 不反推外部成长数据。 | P6 版本化、白名单式成长 Snapshot Provider；只在 GameInstance/MapRun admission 读取一次，再由独立 E3 Unit 定义如何生成 Tag/Pool source。 |
| 临时局内 Tag/Pool/Item 候选注入 | 不纳入 U15；本 Unit 不增加临时 Owner 或可变 Pool。 | E5 临时 Item 持有/消费合同及相应 MapRun Owner／Receipt 生命周期冻结。 |
| Cross-Map Pool 引用／共享 | 不纳入 U15。Pool ID 与定义保持 0317 Map-local；不允许引用另一 Map、全局池或隐式共享可变定义。 | 需要明确版本化 supplier、引用 ID、Map admission 绑定、版本失效与 Save/Resume Restore 语义后另立 Unit。 |
| 动态 Action Tag | 不纳入 U15；Action.tags 仍是 Map 作者声明的静态 TagRef。Fact gate 仅控制静态候选来源是否贡献候选，不改变 Tag 身份。 | 若未来需运行时 Actor/来源 Tag，先冻结 Tag Owner、来源、匹配优先级、生命周期与 Restore 证据，另立 Unit。 |
| Fact-driven Edge 解锁、Story/AC Resource 写入、随机候选池、Effect/Hand RNG 规则变更 | 不纳入 U15。 | P5/E5 或独立 Owner 合同；继续复用当前已冻结边界。 |

Task 0320 P7 应记录上述裁定及依赖，不能将这些延期项描述成 U15 已实现，也不能以本 Unit 宣称 E3 所有候选来源完成。

## 验收与验证

| 场景 | 证据 |
| --- | --- |
| 合法 Counter/Flag gate 被 Registry/生成 Schema 接受；未声明、未知、类型错配、非法比较/常量、额外字段与重复 ID 被拒绝。 | Map Registry 与 Schema 同步定向测试 |
| False gate 不贡献候选；true gate 按静态展开顺序贡献候选；direct/静态 Pool/gated Pool 同 Action 合并后仅进行一次资格／费用／目标过滤、Tendency 与抽取；嵌套 gate 独立关闭/打开。 | candidate resolver 与 MapRun Hand 定向测试 |
| Encounter 内成功 Commit 修改 Counter/Flag 后，同 Encounter 下一 Round 的 Hand 与候选授权仍基于旧的 candidateSourceSnapshot；新 Encounter 使用安装后的新 Facts。 | MapRun/AG-1 Commit 集成测试 |
| Save/Resume 可重算当前 Hand 与 RNG cursor；AG-1 Receipt 从 scheduler v5 起点重跑同一候选来源及完整计划。 | MapRun 与 AG-1 Restore 定向测试 |
| CardRef 目标与已持有 Encounter Status 的 Action 来源校验，在 MapRun 根 Facts 已变化时仍读取本 Encounter 冻结候选输入；新 Encounter 才切换快照。 | Map Card Effect 与 Status Save/Restore 定向测试 |
| 篡改快照版本/Facts、Hand Action、scheduler start snapshot、Receipt start input 或 Hand RNG cursor 均被拒绝；v3/未知 scheduler 被拒绝；失败、过期、Preview 不安装或重采样候选输入。 | MapRun/AG-1 Commit/Restore 负向测试 |
| 没有 Fact-gated Pool 的 0317 静态示例和既有候选 Map 仍走原路径；Hand RNG 算法、预算和静态抽取结果不变。 | 0317 Registry/MapRun 回归用例 |

必要验证：

- Map Registry、Schema sync 与 MapRun/AG-1 Commit/Restore 定向测试通过。
- npm run gen:schema 后生成文件无非预期差异。
- npx tsc --noEmit、npm run check:architecture、npm run check:docs 与 git --no-pager diff --check 通过。
- 完成后对本 Unit 直接影响路径做一次只读范围核对；不改图、不刷新或写 freshness。

## 停止条件

- U14 尚未完成 additionalTarget Runtime 与 scheduler v4，或其实现与本 Unit 计划的 scheduler v5 起点字段不兼容：停止并让 Task Owner 重排依赖，不与 U14 并行改 MapRun Owner。
- 需要在单个 Pool 增加多谓词/任意表达式、变更 0317 合并/筛选/抽取语义、在同一 Encounter 内按最新 Facts 重新评估 gate，或读取 MapRun 以外的可变状态：停止并报告需求，另行冻结合同。
- 所有 Hand/资格入口无法接收同一候选快照，或 AG-1 Restore 不能由 scheduler start snapshot 重算候选：停止，不允许只接抽取或 Preview 后交付。
- 若运行时资格检查必须依赖 E1/legacy 独立 Effect Receipt Validator 才能保留已提交的候选身份，停止并报告，不扩展该 Validator；含 gate 的 Map 已由作者合同限定为 AG-1。
- 需要修改 Allowed Files 外的生产路径、旧存档迁移、独立候选 Receipt Validator、跨 Owner 写入或超出一个候选来源边界：停止并请求 Task Owner 拆分。
- 任一失败/拒绝路径安装了候选快照、Facts、Hand/RNG、费用或结算片段：停止；先修复原子边界，不扩大功能。

## Completion Criteria

- [ ] Fact gate 仅支持一个声明有效的 MapRun Counter/Flag 原子谓词；静态 Pool 合同和旧候选行为保持。
- [ ] 新 Encounter 固定 candidateSourceSnapshot；同一 Encounter 的后续 Round、Hand、Preview、候选资格、Commit 与 Restore 共用该快照。
- [ ] 新 Encounter 取已成功安装的 MapRun Facts；失败、Preview、过期、Restore 与重试不改快照或 Facts。
- [ ] scheduler v5 独立重放候选输入、Hand、AG-1 来源计划和 Receipt；Restore 拒绝格式及内容篡改。
- [ ] 作者 Schema、正式示例、作者文档、行为测试、类型/架构/文档/差异检查通过，并由 Task Owner 记录 Receipt。
- [ ] Prepared-source filter、成长/临时输入、动态 Action Tag 与跨 Map Pool 均按本 Unit 所列裁定延期或不纳入；P7 保留依赖路由。

Task Owner 在结项时同步本 Unit Receipt、Task 0320、[[docs/plan-work/00-index]] 与 [[docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives]]；实现 Agent 不编辑这些施工记录。
