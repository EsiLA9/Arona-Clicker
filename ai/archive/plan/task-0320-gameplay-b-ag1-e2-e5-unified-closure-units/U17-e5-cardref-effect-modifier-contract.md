# Task 0320-U17：E5 Prepared CardRef 效果修正合同（首片已冻结）

> **状态：合同已冻结，施工获准。** Task Owner 于 2026-10-23 采用本页所列最小 CardRef Modifier 合同；U17a–U17d 按下列顺序逐片施工。本页冻结设计，不代表运行时能力已经实现。

## Goal

冻结 Draft 0312 §3「增减卡牌效果」的最小可见首片：一个 Party 来源明确选择另一名 Party Character 本轮实际选中的 Prepared Action，并在 AG-1 顺序中先于目标执行时，为目标 Action 唯一的顶层无条件 `damage` 或 `heal` 语句加上一个固定 signed delta。效果只存在于本次 Encounter 的 detached commit plan；Commit Receipt 可由 Restore 独立重算。

该首片只覆盖 Draft 示例「治疗卡 heal+2」与「damage−1」中的单个加法 Modifier。它不交付一般化 Modifier 引擎、卡牌相对位置、下一张增强、标签筛选、卡牌复制／生命周期、终局结果条件或费用修改扩展。

## Confirmed Facts

| 已核实事实 | 源码／测试依据 |
| --- | --- |
| 真实卡身份为 scoped `MapRunCardRef`；`MapRunCardInstance` 包含 owner、zone、actionId、logicalIndex、`prepared` 和 `controllable`。 | `src/arona-clicker/contracts/map/map-cards.ts`：`MapRunCardRef`、`MapRunCardInstance`；`src/arona-clicker/services/map/map-card-catalog.ts`：`catalogMapRunCards()`、`mapRunCardKey()` |
| CardCatalog 将 Party 当前 Hand 逐张列出并按 `actionId === preparedActionId` 标 `prepared`；被选的 PlayerCommand 以 `playerCommand` zone 作为当前准备来源；Enemy Intent 是独立只读实例。 | `src/arona-clicker/services/map/map-card-catalog.ts`：`catalogMapRunCards()` |
| AG-1 source adapter 只为当前已选 Party/Enemy Action 创建 source；`findSourceCard()` 要求唯一 `prepared === true` 的真实 Catalog 卡，并验证 canonical CardRef 与 Run/Map/Node/Activity/Round scope。 | `src/arona-clicker/services/map/gameplay-b-ag1-source-adapter.ts`：`findSourceCard()`、`buildGameplayBAg1ExecutionSources()` |
| Adapter 的 Party/Enemy/Ability/Item sources 经 `resolveGameplayBAg1SourceOrder()` 排序；AG-1 Owner 按排序后的 `sources` 顺序规划，并在 `appendSequence()` 记录 `executionIndex` 与 source `cardRef`。 | `src/arona-clicker/services/map/gameplay-b-ag1-source-adapter.ts`：`buildGameplayBAg1ExecutionSources()`；`src/arona-clicker/services/map/gameplay-b-ag1-scheduler.ts`：`resolveGameplayBAg1SourceOrder()`；`src/arona-clicker/services/map/map-run-service.ts`：`resolveAg1EncounterCommitPlan()`、`appendSequence()` |
| `resolveMapCardEffects()` 已解析 CardRef 目标并用 active choice 建立可受用 source 对应，但现有合同只服务 `prepare.discountSCost`：要求目标 Action 有正 Actor `sCost`、来源 Action 有非空 `prepare`；这会拒绝无 sCost 的治疗卡及无 prepare 的 resolve Modifier。 | `src/arona-clicker/services/map/map-card-effects.ts`：`resolveMapCardEffects()`、`mapScostCost()`；`tests/engine/gameplay-b-map-ag1-restore.test.ts`：`replays a real CardRef source and rejects a forged sequence CardRef` |
| 当前 `prepare` 在来源排序前收集并固定费用折扣；`planSource()` 调用 `planMapEffectSource()` 时仅传 unit `primary`，没有 CardRef 输入或 pending Card Modifier 容器。 | `src/arona-clicker/services/map/map-run-service.ts`：`resolveAg1EncounterCommitPlan()` 中 prepare metadata 与 source loop、`planSource()`；`src/arona-clicker/contracts/map/map-effects.ts`：`MapEffectPlannerOptions` |
| Effect AST 的 `GameplayMapEffectProgramDef` 将 `prepare` 与有序 `resolve` 分开；当前 resolve 有 damage/heal，但没有 CardRef Modifier 语句。 | `src/data-services/contracts/gameplay-map-effects.ts`：`GameplayMapEffectProgramDef`、`GameplayMapEffectStatementDef` |
| Receipt 已记录 scheduler version、执行序列及 Program trace；Restore 会从 scheduler 起点重新规划并核对 Receipt。当前最终版本为 scheduler format 5、program receipt 1、Status receipt 2；U17 不改排序输入或 scheduler 起点。 | `src/arona-clicker/contracts/map/map-run.ts`：`MapRunEncounterExecutionSequenceEntry`、`MapRunEncounterCommitReceipt`；`src/arona-clicker/services/map/map-run-service.ts`：`resolveAg1EncounterCommitPlan()`、`restoreAg1EncounterCommitReceipt()`；U14/U15/U16 Receipts |

当前最终版本已由 U14/U15/U16 Receipt 与源码复核：`schedulerFormatVersion: 5`、既有 `programReceiptVersion: 1`、AG-1 `statusReceiptVersion: 2`。本 Unit 不改变 scheduler 起点或排序输入。

## Frozen Contract

### 作者 AST 与作用范围

- Modifier 来源必须是可生成实际 AG-1 source 的 Party Character 当前 Prepared Action；Enemy、Ability、Item 不可作为此首片的 Modifier 来源。
- 来源 Action 必须有 `target.kind: 'card'`，沿用现有显式 CardRef 选择入口。resolve Program 仅允许一条顶层语句：一个 CardRef Modifier；`prepare` 为空／省略，不在本首片混用费用折扣。
- 建议闭合语句形状：

  ```ts
  {
    op: 'cardEffectModifier',
    path: 'resolve[0].amount',
    operation: 'add',
    delta: number,
  }
  ```

- `path`、`operation` 都是固定字面量，不接受任意属性路径或乘法。`delta` 必须是 `Number.isSafeInteger` 的非零有符号整数，范围为 `[-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]`；不引入浮点或另一套精度体系。
- 目标必须是另一名 Party Character 的当前 Prepared Action：CardCatalog 中真实 `prepared` 的 `hand` 卡，或实际选定的 `playerCommand` 卡。拒绝同 Owner、未选 Hand 卡、未选 Command 候选、Enemy Intent、其他 Run/Map/Node/Activity/Round 的引用。
- 目标 Action 的 Effect Program 必须有且仅有一条顶层无条件 `damage` 或 `heal` resolve 语句。拒绝空语句、多条顶层语句、`when`、`forTargets` 语句作为目标、嵌套条件／循环、`hpChange` 或其他操作。目标 damage/heal 语句自身既有合法 TargetSet/repeat 可保留；修正适用于该语句每个目标／hit 实际求值的 amount。
- 此合同只识别结构位置 `resolve[0].amount`，不根据 Tag、Action 名称、UI 文案、CardCatalog 排序或视觉相邻关系推断目标。

### AG-1 执行序与实际 Prepared 身份证明

- 对每个 Modifier，Owner 必须从本轮已验证的 AG-1 `sources` 中分别定位 Modifier source 与所选目标 CardRef 对应的 Prepared source；比较其排序后序号。必须满足 `targetExecutionIndex > modifierExecutionIndex`，否则 Preview/Commit 拒绝该选择，不允许对已执行来源追溯修改。
- 目标身份比较使用完整 scoped CardRef（`mapRunCardKey`），并要求它与 source adapter 生成的 `source.cardRef` 精确一致；不能只比较 Action ID，因为不同 Owner 可有同 Action ID 的实例。
- 当前 `resolveMapCardEffects()` 的 CardRef 解析先于 source adapter。实现可在 `sources` 排序后追加 Modifier 专用交叉校验；必须复用 Adapter 的实际 Prepared 证明，不得把普通候选卡列表误当成已选来源。
- AG-1 source 的自身 `cardRef` 与该 Action 的 `targetCard` 是不同身份：前者证明谁执行，后者指明将要修改哪张卡。两者均须进入 detached plan/Receipt 证据。

### 数值与顺序语义

- Modifier source 按正常 AG-1 流程通过 skip 检查、费用预检并执行后，才将 `{targetCardRef, path, delta, source identity, source executionIndex}` 追加到本次 detached plan 的 pending modifier ledger。
- 目标 source 执行到唯一 damage/heal 指令时，先按既有 Value 语义求出该次原始非负 safe-integer 请求量，再加固定 `delta`，随后交给既有 damage/heal HP 上下限处理。每次加法用精确整数运算；负结果 clamp 到 0；大于 `Number.MAX_SAFE_INTEGER` 的结果拒绝整个 plan，不饱和到上限。
- Planner 不得因 Modifier 直接写 Live MapRun 或 PlayerState。所有变更只进入相同 detached Encounter 规划状态；Commit 通过既有 Owner 安装点一次安装。
- 一个来源只能声明一个 Modifier；同一目标卡最多接受一个此首片 Modifier。相同或不同来源产生的第二个 Modifier 均使本轮计划拒绝，不进行叠加。未来如允许叠加，须另行冻结顺序、叠加和 Receipt 合同。

### 失效、跳过与失败

- Draft 在 scope 变化、来源替换或目标 Prepared Action 变化后必须重验；失效 CardRef 清除或拒绝，要求重新选择，不映射到同 Action 的另一张卡。
- Modifier source 因 `defeated`、`noLegalTarget`、`unaffordable`、`roundEnded` 或其他合法跳过而未执行：不登记 Modifier，目标如正常执行则用原始效果。
- Modifier 已执行而目标随后因上述任一原因跳过：Modifier 记为 `notApplied` 并带目标 skip reason；本轮结束丢弃，无退款、无转移、无跨轮状态。
- 缺失/重复目标 source、序号不晚、scope 不符、目标 Action 已不满足静态 AST 形状、数值溢出、Receipt 重放不一致：Commit/Restore 拒绝；不得静默忽略、改选其他目标或对 live state 部分安装。

### Owner、Planner、Receipt、Restore 与 UI 证据

- Planner 对新语句生成 bounded plan intent 与 trace；Owner 负责根据真实 `sources` 序号登记/消费 pending modifier，并把目标卡绑定到唯一 source。Planner 不自行读取 UI、Run 全局对象或重新排序。
- Receipt 至少可核验：Modifier source owner/action/source CardRef/executionIndex；目标 CardRef 与目标 source owner/action/executionIndex；固定 path、delta；目标原 amount、修正后 amount、每 hit 的实际 HP 变化；应用状态或精确 skip reason。
- Restore 必须以既有 scheduler start snapshot 与提交的真实 Prepared 输入重新构造 `sources`、重算 Modifier 顺序和 Planner 结果，并逐字段比对消费证据；伪造目标 CardRef、挪动 executionIndex、改 delta/amount 或伪造 `notApplied` 均拒绝。
- UI 复用当前 CardRef 目标选择，不新增任意目标脚本。此 Modifier 来源只显示不同 Party owner、真实当前 Prepared、静态 Action 形状合格且 AG-1 序号晚于来源的卡；展示目标 Action 与 `damage/heal ±delta` 预览。Commit 重验仍是权威。

### 格式版本与前置

- U14/U15/U16 前置已完成并核对：scheduler v5、Status Receipt v2、MapRun Fact snapshot v1。U17 不改变排序输入或 scheduler start snapshot，故保持 `schedulerFormatVersion: 5`。
- 仅包含 `cardEffectModifier` 证据的 AG-1 Program Receipt 使用 `programReceiptVersion: 2`；没有该 op 的既有 Receipt 继续使用并接受 v1。Restore 按重放出的 Program 形状确定预期版本，并严格拒绝同一形状下不匹配的 Receipt 版本。不改变 Status 专用 v2。
- 只含新 AST 的测试/样例 Map 按已冻结 Map resume-version 规则单独升版；不为无关 Map 或历史数据做迁移。
- U14 additionalTarget 是单位第二目标合同，不能被当作 CardRef；U15 Fact-gated static pools 提供候选冻结输入但不是本 Modifier 的目标解析器；U16 Status Remove 改变 Status 专用证据，不提供通用 Modifier 或效果排序能力。

## Proposed Patch Units

以下施工切片按序执行；每片仍须在其 Receipt 中记录最终 Allowed Files，遇到范围外需要先拆片。每个实现片控制在3–5个手工维护文件、约300–500行净改动；Schema 生成输出只能由 `npm run gen:schema` 更新，不得手改。

### U17a1：AST / Strict Syntax / Normalization

**Goal：** 增加唯一闭合 Modifier 语句，完成 Syntax、Normalizer、Context/Registry 静态规则与生成 Schema 同步；目标 Action 的静态 shape 可核验，运行时 CardRef 实际选择留给 Owner。

**Allowed Files：**

- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `src/data-services/normalization/gameplay-map-effect-program.ts`
- `tests/data/gameplay-b-effect-syntax.test.ts`
- `tests/data/gameplay-b-effect-normalization.test.ts`

**Completion Criteria：** 严格解析固定 path/operation 与 non-zero signed safe-integer delta；拒绝未知字段、错误路径、零值和 unsafe integer；归一化保留闭合字段与语句顺序。

### U17a2：Context / Registry / Schema

**Allowed Files：** `src/data-services/validation/gameplay-map-effect-context.ts`、`src/data-services/registry/registry-validate.ts`、`tests/data/gameplay-b-effect-registry.test.ts`、`tools/datapack-editor/schema/engine-schema.sync.test.ts`；如契约生成结果变化，只运行 `npm run gen:schema` 写 `tools/datapack-editor/schema/engine-defs.gen.json`，不得直接编辑。

**Completion Criteria：** Modifier 来源必须符合 Party source、Card target 与唯一语句限制；静态目标 Action 仅一条顶层无条件 damage/heal；CardRef 目标引用合法，Schema sync 与 Registry 测试通过。运行时真实 Prepared、Owner 与序号证明留给 U17c。

### U17b：Planner intent 与修正计算

**Goal：** 让 Planner 以固定 delta 修正目标 damage/heal amount，并输出可重放的 intent/trace；不接 Owner live state。

**候选 Allowed Files：** `src/arona-clicker/contracts/map/map-effects.ts`、`src/arona-clicker/services/map/map-effect-planner.ts`、`tests/engine/gameplay-b-effect-planner.test.ts`。

**Completion Criteria：** 直接与 Value amount、TargetSet/repeat、负值归零和 safe-integer overflow 行为测试；trace 保留原 amount、delta、修正 amount 和 hit 证据；同一输入得到相同 plan。

### U17c1：Owner / AG-1 序号 / Receipt / Restore

**Goal：** 将 CardRef 目标解析、实际 Prepared source 交叉验证、严格后序应用及 pending/skip 证据接入唯一 detached Owner commit 与 Restore 重放。

**Allowed Files：** `src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts`、`src/arona-clicker/services/map/map-card-effects.ts`、`src/arona-clicker/contracts/map/map-run.ts`、`src/arona-clicker/services/map/map-run-service.ts`、`tests/engine/gameplay-b-map-ag1-commit.test.ts`、`tests/engine/gameplay-b-map-ag1-restore.test.ts`。额外纳入 Preview resolver 仅用于放行 CardRef Modifier 的空 prepare 来源；不改 UI 呈现。此片因必需门禁共6个手工维护文件，净改动仍控制在原 300–500 行预算内，不能再扩展其它层。

**Completion Criteria：** 无 sCost 目标卡可通过 Modifier 专用解析，但旧 prepare 折扣规则保持；验证 target CardRef 与实际 `source.cardRef` 一致、目标为不同 Party owner 且严格后序；来源跳过、目标跳过、变更/伪造 CardRef、数值溢出与 Restore 篡改均有拒绝或 `notApplied` 证据；Commit 不出现部分安装。

### U17c2：RecentCommit ReadModel 投影

**Goal：** 将 Program Receipt v2 的 Modifier evidence 只读、安全、深冻结地投影到 Preview/RecentCommit，不接触 Live Owner。

**Allowed Files：** `src/arona-clicker/contracts/runtime/runtime.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`、`tests/ui/gameplay-b-effect-workspace.test.ts`。

**Completion Criteria：** ReadModel 接受 Program Receipt v2 并深冻结 Modifier Trace；E1/legacy Receipt v1 与无新 op 的 AG-1 Receipt v1 投影不变；测试覆盖版本、CardRef 与 amount application evidence。

### U17d1：UI 候选与预览

**Goal：** 复用 CardRef 选择入口，只展示合法的后序 Prepared Party 卡并清楚呈现目标 Action 与修正量。

**Allowed Files：** `src/ui/components/map/map-workspace.ts`、`src/ui/flow/map-flow-model.ts`、`src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts`、`tests/ui/gameplay-b-map-workspace.test.ts`。

**Completion Criteria：** UI 不显示自身、Enemy、未选候选、无唯一顶层 damage/heal 或序号不晚的卡；旧选择失效时要求重选。若过滤所需候选字段无法由既有 ReadModel 表达，先补 U17c2，不借由 UI 推断 AG-1 顺序。

### U17d2：正式 Map 示例与运行验证

**Goal：** 增加一个真实 Map 内容样例及玩家可见的 Commit/Restore 证据。

**Allowed Files：** `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`、`tests/engine/gameplay-b-effect-example.test.ts`；新增作者示例或 Draft 路由由 Task Owner 在 P7 收尾时维护。

**Completion Criteria：** 样例呈现“来源先执行，另一名角色的当前治疗卡 heal+2”；Commit/Restore Receipt 与 Owner 实际变化一致，单轮内目标跳过行为有覆盖。

## Explicit Non-goals / E5 Scope Ruling

- 不实现“下一张增强”、左右相邻卡、同 Owner 其他牌集合选择、Tag/Prepared 过滤型追加、来源排序交换、复制/生成/替换/移除卡、Effect Program 任意 path 修改、乘法、Modifier 层叠或冲突优先级。
- 不实现击杀奖励、按实际命中/伤害计数等结果条件；它们需要独立的结果身份与结算证据。
- 不改变 Hand RNG、Effect RNG、AG-1 排序键或费用顺序；不修改 AC PlayerState、MapRun Facts、Enemy Intent 或全局/跨轮状态。
- 不允许同一角色自我增强，亦不将 Enemy/Ability/Item 纳入本首片来源/目标。
- 这些是本建议方案的延期边界，不裁定 Draft §3 的其他 E5 项永久不纳入；未来每项仍须有产品样例与独立合同/Unit。

## Task Owner Freeze Decisions

1. `delta` 采用非零 safe integer 全范围；负 amount 归零，正向 safe-integer 溢出拒绝整轮。
2. 每个来源最多一个 Modifier，每个目标卡最多一个；同一目标的第二个修正拒绝，不叠加。
3. scheduler 保持 v5；仅含新 Modifier 证据的 Program Receipt 使用 v2，旧 AG-1 Program Receipt v1 和 Status Receipt v2 保持各自路径。
4. U17d 样例采用“Party 来源先执行，为另一 Party 后续单句治疗 Action 增加 heal 2”，并展示其真实 Prepared CardRef 与修正结果。

上述裁定基于 Draft 0312 的示例、现有 safe-integer 求值、AG-1 统一执行序及 detached Restore 机制；避免依赖未定义的累加/舍入规则，并将变化限制在新作者 op 的 Receipt 版本与示例 Map。

