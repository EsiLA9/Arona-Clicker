# Unit 0320-U06：AG-1 Receipt Restore 与执行序列独立回放

## Goal

在 Save/Resume Restore 中独立验证 AG-1 调度 Receipt：从 U05 最终 Receipt、当前 Map/Encounter 合同与 U01–U04 冻结输入重新核对来源、排序、分组投影和程序访问顺序；E1-COMPAT-1 的验证路径与行为保持不变。

> **开工门槛：U05 与 U05b 均未完成审阅时不得开始本 Unit 的源码施工。** 先确认两个 Unit 与 Receipt 均为 `completed`，检查最终 Receipt 类型和 Owner 实际输出，并核对分层验证所需的完整 `schedulerStartSnapshot`、排序输入及 terminal checkpoint。Restore 必须从提交开始快照重建 MapRun 起点并重跑真实 AG-1 规划器；若无法重建，先停止并补齐合同／拆分 Unit，不得凭空猜测字段，也不得先放宽 Restore。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 规范 | `docs/ai/PROJECT-CONSTITUTION.md` | Patch Unit 白名单、预算与停止条件 |
| 规范 | `docs/docs-829/05-conventions/architecture-discipline.md` | Restore 信任边界、Run Owner 与 detached 状态约束 |
| 规范 | `docs/docs-829/05-conventions/testing.md` | 存档篡改拒绝、行为金样与风险分级 |
| Task / 合同 | `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure.md` 与 `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md` §13.1–13.4 | P1 总目标、批准的来源排序／支付／skip／终局规则 |
| 前置 Unit | U01–U05b 对应 Unit 与 Receipts，尤其 U05／U05b 最终版本 | 作者输入、排序／来源快照、提交开始状态、目标意图、terminal checkpoint、最终序列和分组投影字段；须作为开工门槛重新读取 |
| 源码 | `src/arona-clicker/services/map/map-run-service.ts`：`restoreEncounterCommitReceipt`、`restoreEncounterSnapshot`、`restoreRunState` | 两处最新 Commit Receipt 的闭合 Restore 入口及当前 Encounter 上下文 |
| 源码 | `src/arona-clicker/services/map/map-effect-receipt-validator.ts`：`validateMapEffectCommitReceipt`、`sourceInfos`、`canonicalVisits` | Effect Program 访问回放及当前 E1 分组顺序约束；AG-1 需按独立执行序列验证 |
| 前置接口 | `gameplay-b-ag1-scheduler.ts`：`resolveGameplayBAg1SourceOrder`；`gameplay-b-ag1-source-adapter.ts`：`buildGameplayBAg1ExecutionSources` | 用已保存／恢复的合法来源输入独立重算 U02 全序并复用 U04 来源边界 |
| 测试 | `tests/engine/gameplay-b-map-ag1-commit.test.ts`、`tests/engine/gameplay-b-map-save-resume.test.ts`、`tests/engine/gameplay-b-effect-save-resume.test.ts` | U05 成功提交样例、普通 Restore 与 Effect Receipt 篡改基线 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 30k tokens；集中读取 Receipt Restore、AG-1 来源／排序 helper 与对应定向用例 |
| 文档 Read Set | 6 篇／节，含 U01–U05 当前合同和 Receipt |
| 历史文档 | 0 篇；除非现行实现与合同不符且需追溯理由 |
| 超预算处理 | 超出 35k tokens，或需修改第二个领域 Owner／GameInstance 协调时，停止并交负责人拆分 |

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Receipt Restore 对未知字段闭合拒绝，且旧入口对顶层字段数设有上限 | `map-run-service.ts`：`restoreEncounterCommitReceipt` | U05 新增字段必须在本 Unit 显式纳入；不得删除闭合校验 |
| Program Receipt 目前只在存在 Effect Program 头部时调用 Effect Validator | `map-run-service.ts`：`restoreEncounterCommitReceipt` | AG-1 scheduler Receipt 即使无 Program 也必须验证；AG-1 从 start snapshot 重跑真实 planner，并完整比较 Program 访问、trace 与 locals，因此不需要改旧 E1 source-walk validator |
| Effect Receipt Validator 当前硬性要求 `executionContractId === 'E1-COMPAT-1'`，并按旧分组重建来源与访问序 | `map-effect-receipt-validator.ts`：`validateMapEffectCommitReceipt`、`settlementRows`、`canonicalVisits` | 仅 AG-1 分支按 U05 序列回放；E1 旧规则保留 |
| U02 全序函数与 U04 实际来源适配器已实现 | `gameplay-b-ag1-scheduler.ts`、`gameplay-b-ag1-source-adapter.ts` 及各自 Receipt | Restore 只能从 U05b `schedulerStartSnapshot` 重建来源输入、复用 U04／U02 与纯 AG-1 planner 重算，不得从 UI 次序或已排序结果猜测 |
| U03 将 AG-1 Party 敏捷快照存在 Run，并将 Enemy 敏捷快照存在活动 Encounter；恢复时已与当前作者值比较 | `map-run.ts`、`map-run-service.ts`：`initialPartyAgility`、`initialEnemyAgility`、`restoreAgilitySnapshot` | U06 实际调用／传递方式以 U05 最终 Restore 调用上下文为准 |
| U05 完成后仍缺少历史可回放的提交前状态与终局点 | U06 只读审计；U05b Receipt / Unit 为补齐入口 | U05b 完成及其最终 Receipt 审阅前，本 Unit 不允许源码施工 |

## 分层验证合同

### 0. 前置合同门

- 实施前确认 U05／U05b 最终固定的 `schedulerFormatVersion`、`schedulerStartSnapshot`、完整排序键、targetSelections 与 Actorless Draft、`executionSequence`、终局 outcome/checkpoint 及其和旧 settlement groups 的投影映射；以最终源码与 Receipt 为事实。
- 从 start snapshot 重建一份与当前 Save checkpoint 无关的历史 MapRunSlot，重跑纯 AG-1 planner；比较完整输出（计划来源、排序、skip、投影、Program/Status 证据与终局）。再把输出最终 HP／余额与能取得的相邻活动 checkpoint 互校。
- 若上游字段不能完全重建 planner 输入或不能复算关闭 Encounter 的历史结果，停止并明确列出缺少的输入／结果证据；先修订上游合同，不以“结构合法”代替独立回放。
- U05／U05b 任一仍进行中、测试未通过、Receipt 未更新时，只能继续审阅，不得修改本 Unit 的源码白名单文件。

### 1. Receipt 外壳与调度版本

- AG-1 的 `executionContractId: 'AG-1'` 是 scheduler 合同标记，与 `programReceiptVersion` 分离；AG-1 必须同时携带 U05 规定的 `schedulerFormatVersion`、U05b 的 `schedulerStartSnapshot`／terminal 证据与 `executionSequence`，即使所有来源均无 Effect Program 或来源序列为空。
- 仅 `programReceiptVersion` / `effectScope` / visits / trace 描述存在程序执行证据；它们不得决定或覆盖 scheduler 合同。无 Program 的 AG-1 Receipt 仍必须通过 scheduler 层 Restore 校验。
- E1-COMPAT-1 Receipt 不得携带 AG-1 scheduler 字段。未知／缺失字段、字段组合矛盾、错误版本或错误执行合同一律拒绝；不得通过放宽根对象闭合校验绕过。
- 对 AG-1 start snapshot 与序列施加闭合结构、领域顺序、值域和来源数量上界；校验从 0 连续的 `executionIndex`、唯一 `sourceKey`、U05b 保存的每一 U02 排序输入、合法来源种类／身份、CardRef scope、目标选择输入／最终 target、PlayerCost／Item 值及安全整数。确切字段形状以 U05b 最终类型为准。

### 2. 来源、敏捷与全序独立重算

- 从固定 Party／Enemy 行和 U05 明确保留的 Actorless selected-source 证据还原或核验来源集合；Party Wait 与 Enemy Wait 不入队，候选选项和未选手牌不入队。每个已选择来源——包括被 skip 的来源——必须在序列中恰好出现一次；不得增加来源或重复来源。若 U05 对跳过的 Ability／Item 只在序列中保留选择、且旧 projection 只记录实际执行／消费，则按该 U05 规则验证 projection 的合法缺省；不得将被跳过来源强行投影成已扣 PlayerCost／已消费 Item。
- 对实体来源验证 owner、Action 与当前合法／Prepared 来源、当前本轮真实 Catalog CardRef；Actorless 来源按 U05 合同使用 `owner: null`、无来源 CardRef 及对应 Item／Ability 身份。序列 CardRef 是来源卡身份，target 中 CardRef／旧投影 targetCard 是目标证据；两者不得混淆。
- 根据 U05b start snapshot、当前 Map／Encounter 合同和真实前轮 Hands／overrides 重建行动 Preview，再调用 U04 产生唯一来源及排序候选。验证 `finalAgility = min(baseAgility + actorAgility, max)` 和全部 side/source/declaration/logical 键；再调用 U02 并逐字段比对整个序列顺序，不能只核对序列“看起来已排序”。
- 从 U04 规范重新生成每行 `sourceKey`，核对 scope、来源类别、owner/source id 与 Action；不同 Scope、别名 JSON、被篡改 key 或跨 round CardRef 必须拒绝。

### 3. 序列与旧分组投影双向一致

- 对每个 Party／Enemy action-bearing 旧投影行，必须存在且只存在一条对应序列行；Ability／Item 的 projection 存在性按 U05 最终合同区分“选中来源”与“实际执行／消费”，并对允许缺省的 skipped actorless 来源单独核验。核对 owner／Action／CardRef 的来源身份、目标、skip、实际费用支付、Item 消费以及 HP／资源变化；Wait 投影不应产生执行行。
- 只验证字段投影关系，不把旧 `settlements`／`enemyActions` 的固定 roster 顺序当成 AG-1 执行序；保持旧 projection 的 Schema 与 E1 含义。
- `PlayerCommand` 选择费、Actor／Team／Ability／Item 成本与来源 skip 必须符合 Draft 0312 §13 及 U05 定稿：party 不可付成本不得成为成功 Receipt 的某条 skip；Enemy `unaffordable` 不扣费／不应用效果；被 `roundEnded` 的后缀来源不得扣固定成本、消耗 Item 或产生 HP／资源变化。
- 以 `schedulerStartSnapshot` 中逐类 HP／资源、locals、Status 与目标选择为初值，逐源重跑 source-start `defeated`、锁定目标／自动 fallback、可付性、同源效果和即时结算；对照 U05b terminal outcome/checkpoint 重放 failure-first / victory、Status round-end 与 non-battle completion。历史 Encounter 即使关闭也必须完成 Receipt 内部前向重放；只有相邻活动 checkpoint 可再与 live 末态比较，严禁用 Restore 后余额假装提交前状态。

### 4. Effect Program 与 scheduler 分层回放

- AG-1 有 Program Receipt 时，先完整通过第 1–3 层，再从 schedulerStartSnapshot 重跑真实 AG-1 planner；planner 按 executionSequence 中未跳过且实际运行 Program 的来源顺序生成完整 Program visit walk，Receipt 的 visits、trace、locals 与 settlement 必须逐字段相同。无需改变旧 E1 source-walk validator。
- `executionContractId: 'AG-1'` 不得因 Effect Program 的 E1/当前版本 trace 而降级。`programReceiptVersion` 验证程序记录格式；`schedulerFormatVersion` 验证调度序列格式。
- E1 Program Receipt 继续使用既有 E1 source walk 与 settlement projection 语义。新增 scheduler-aware 分支只作用于显式 AG-1，不改变 E1 金样。
- 如果当前 `map-effect-receipt-validator.ts` 的内部复算无法支持“同源完整执行、来源效果即时可见、随后来源按队列执行”，先缩小或拆分实施并上报，不得跳过已有 Program／Status／E2 trace 验证。

### 5. Restore 与快照闭环

- 无论 latest receipt 位于活动 Encounter 的 `lastCommit` 还是 Run 的 `lastEncounterCommit`，都必须使用相同 AG-1 scheduler 校验；在范围允许时校验同一提交的两份 checkpoint 互相一致。
- 当前 Encounter 为该提交紧邻后继时，继续核对已有的当前 HP、资源余额、locals、Status 等 live checkpoint；历史／已关闭 Encounter 无当前可信快照时，仅按 Receipt、冻结输入和 U05 留存证据重算可证明部分，不虚构 live state。
- Restore 拒绝须保持现有原子语义：无效 Receipt 不安装部分 MapRun；E1 旧存档和无 Receipt 初始状态仍按现有规则恢复。

## Allowed Files

- `src/arona-clicker/services/map/map-run-service.ts`（Receipt 外壳、AG-1 scheduler 序列 Restore 与从 `schedulerStartSnapshot` 重算；不改提交规划／安装）
- `src/arona-clicker/services/map/map-effect-receipt-validator.ts`（仅 AG-1 Program visits 的 scheduler-aware 回放；E1 保持原规则）
- `tests/engine/gameplay-b-map-ag1-restore.test.ts`（新增独立 AG-1 Restore／篡改拒绝测试）
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U06-ag1-restore-replay.md`（仅记录实际实施结果）
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U06-receipt.md`

当前 U05 已声明 `map-run.ts` 中包含调度字段与序列类型；若最终交付证明 U06 需要修改白名单外文件或新增契约字段，停止并由任务负责人先修订本 Unit。禁止为提早适配正在施工的 U05 而修改其实现文件。

## Explicit Non-goals

- 不施工、不修改 U05 的 Commit Owner、费用／效果队列、Receipt 创建或 runtime 双 Owner 安装。
- 不改 AG-1 业务合同、U01–U04 输入字段／排序规则、Hand RNG、卡牌候选、MapRun Save 顶层版本或 E1-U18 验收。
- 不更改 UI / ReadModel 的执行次序显示；该项归独立后续 Unit。
- 不因 U05 Sequence 新字段缺少而默默接受不完整恢复、不降级成 E1，也不移除 Effect／Status／E2 既有 Restore 校验。
- 不编辑 GALHCG 图、刷新或写 freshness；项目图健康检查在 Task 0320 工作节点收尾统一执行。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件六项。另有以下硬停止条件：

1. U05 或 U05b 尚未 completed、任一 Receipt 未记录最终实现与定向验证，或快照／序列字段／来源键／目标含义与本 Unit 不一致。
2. Restore 无法从最终 `schedulerStartSnapshot` 独立重跑纯 AG-1 plan，或无法证明所需 skip／terminal／资源结果。
3. 为通过 Restore 需扩展至 Allowed Files 外、改变 Save 版本迁移策略、触碰第二个状态 Owner，或放宽 E1／AG-1 既有闭合验证。

满足停止条件后，报告实际阻塞事实、缺少证据和建议的上游合同调整；本 Unit 源码保持不改。

## Completion Criteria

- [x] 通过 U05 与 U05b 开工门槛；源码与最终 Receipts 的 scheduler／Program 字段对应并符合本文分层合同。
- [x] AG-1 scheduler 外壳、完整 commit-start 来源输入、U04 sourceKey、U03 agility 与 U02 全序均可独立 Restore 重算；无 Effect Program 的 AG-1 Receipt 也受检。
- [x] 从 commit-start 快照重跑出的 executionSequence 与 Party／Enemy／Ability／Item projection 双向逐项一致；合法 skip／支付／Item 消费／目标与结果关系有独立拒绝证据。
- [x] AG-1 Program visits/trace 按真实执行来源顺序重放；原 E1 Program Receipt 验证与 E1 Save/Resume 金样不变。
- [x] Restore 测试覆盖合法 AG-1 有／无 Program 往返、终局后 skipped Ability／Item 的 U05 合法 projection 形态，并拒绝无效版本／start snapshot／terminal checkpoint、缺失／额外序列、重复或乱序行、伪造来源／CardRef、排序键／敏捷篡改、projection 差异、非法费用／Item／terminal 后缀及 Program visit 次序篡改。
- [x] 无效 checkpoint 拒绝时不安装部分 MapRun；活动 Encounter 和已结束 Encounter 的可证明检查边界有测试或已有行为证据。
- [x] 运行本 Unit 定向测试、既有 MapRun／Effect Save/Resume 定向测试、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 与 `git --no-pager diff --check`；联合定向测试100/100、类型／架构／文档／差异检查均通过，Receipt 记录真实结果。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| AG-1 Restore / 篡改拒绝 | `npx vitest run tests/engine/gameplay-b-map-ag1-restore.test.ts` | 合法 checkpoint 恢复；规定的篡改逐项拒绝 |
| MapRun Save/Resume 兼容 | `npx vitest run tests/engine/gameplay-b-map-save-resume.test.ts` | E1 基线不变，AG-1 latest receipt 恢复规则一致 |
| Effect Program Save/Resume 兼容 | `npx vitest run tests/engine/gameplay-b-effect-save-resume.test.ts` | E1 trace 与 Restore 行为不变；AG-1 trace 按真实序列验证 |
| 架构检查 | `npm run check:architecture` | 退出码 0 |
| 文档链接与结构 | `npm run check:docs` | 无新增错误 |
| TypeScript | `npx tsc --noEmit` | 退出码 0 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
