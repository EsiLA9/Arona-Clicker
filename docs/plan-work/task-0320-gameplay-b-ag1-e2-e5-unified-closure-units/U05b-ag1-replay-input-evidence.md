# Unit 0320-U05b：AG-1 提交起点与终局回放证据

## Goal

为已完成的 U05 执行队列补齐 U06 所需的历史输入证据。AG-1 Commit Receipt 保存一份闭合的提交开始快照、逐来源完整排序输入和终局发生点，使 U06 能从 Map/Encounter 作者定义与该快照重新运行纯 AG-1 规划器，独立复算来源、目标、费用、HP／资源变化、skip 与终局；无论 Encounter 仍活动或已关闭，Restore 都不需要把后继余额冒充提交前状态。

本 Unit 不改变 Draft 0312 §13 的行为合同，不处理 Restore 验证，不为历史 E1 Receipt 补造证据。

## 开工门

- U05 的 Commit 计划、Receipt 与定向用例均已完成；必须读取 U05 最终实现和 Receipt。
- 仅扩充 AG-1 的 versioned scheduler Receipt。E1 Receipt 形状与行为保持原样。
- 新增字段必须由唯一 detached Owner 从调用开始状态构造；不得在安装后从 live state 回填。
- 如果 U06 仍不能仅凭本 Unit 保存的 `schedulerStartSnapshot` 与当前 Map 合同重算完整计划，停止并提交明确的缺失证据，不得先放宽 Restore。

## 固定证据合同

### 1. `schedulerStartSnapshot`

每个成功 AG-1 Receipt 必须带一个闭合、版本受外层 `schedulerFormatVersion` 保护的提交起点快照，包含规划器读取的全部历史输入：

- MapRun scope 与固定 Party 身份；
- 提交开始时的 PlayerCost、Party HP、Actor／Team 资源；
- Active Encounter 的 node/activity/round/draftVersion、Enemy HP、Enemy Actor／Team 资源和 Enemy 敏捷快照；
- Party／Enemy Hands、Enemy Hand 随机状态、Action overrides、显式 targetSelections、已选 Ability／Item 草稿；
- Encounter locals 与 Status 初态。

只存 U05 `resolveAg1EncounterCommitPlan` 实际读取的状态，不能嵌入整个上一张 Receipt，也不能递归保留历史快照。字段、顺序和数值须闭合；数组沿用对应领域 roster／MapRun 声明顺序。

快照必须来自任何费用扣除、来源程序、HP/资源改变、Hand/RNG 前进之前。Preview 可以返回同一个 detached plan 的序列，但不需要向 UI 暴露这个 Restore 用输入快照。

### 2. 完整排序输入

每条 `executionSequence` 行保存 U02 对应来源的完整排序键：

- `sideRank`、`sourceRank`、`ownerDeclarationIndex`、`logicalIndex`；
- 已有的 `sourceKey`、来源身份、Action/CardRef 与 `baseAgility`、`actorAgility`、`finalAgility`。

这些值必须直接来自 U04 适配器的实际来源，不得按排序后的 index 重造。Receipt 行顺序仍是最终执行顺序；U06 可从排序键独立调用 U02 重算并逐字段比较。

### 3. 终局结果与检查点

AG-1 Receipt 增加闭合终局证据：

- `outcome`：`none | failure | victory`；
- `checkpoint`：`null | commitStart | afterSource | afterStatusRoundEnd | afterNonBattleCompletion`；
- 仅 `afterSource` 携带触发终局的 `executionIndex`，其余形状不得携带该字段。

规划器必须在唯一设置 `terminal` 的同时记录检查点：起始 terminal、逐来源后的 failure-first/victory、RoundEnd Status tick 后、或非 Battle 轮末完成。终局后的来源只能是 `roundEnded`，终局来源之后不得再有 HP／资源变化或支付。AG-1 Preview 可投影同一终局字段；E1 不增加此字段。

### 4. 完整计划可重算

U06 应使用 `schedulerStartSnapshot` 重建唯一 MapRun 起点，并调用真实 U04 来源适配器、U02 排序器和 AG-1 纯计划器。重算结果必须与保存的 `executionSequence`、旧分组投影、Program／Status Receipt、终局证据完全一致；从而共同验证锁定目标输入、自动目标重选、source-start defeated/unaffordable、PlayerCost、Item 消费和终局时点。

本 Unit 的行为测试须证明快照在安装前捕获且深度 detached、完整排序键与 U04 候选一致、targetSelections/Actorless drafts/RNG 和初始账本均被保存、终局检查点与 U05 已有终局用例一致。不得只测“字段存在”。

## Allowed Files

- `src/arona-clicker/contracts/map/map-run.ts`（AG-1 scheduler start/terminal/sort key 合同）
- `src/arona-clicker/services/map/map-run-service.ts`（仅 U05 AG-1 规划器起点快照／排序键／终局证据创建；不改 Restore）
- `tests/engine/gameplay-b-map-ag1-commit.test.ts`
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U05b-ag1-replay-input-evidence.md`（仅记录实施结果）
- `docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U05b-receipt.md`

## Explicit Non-goals

- 不改 U05 的费用／来源／效果／终局业务规则与 E1 路径。
- 不改 `restoreEncounterCommitReceipt`、Effect Receipt Validator、Save/Resume Restore；归 U06。
- 不改 Runtime UI、执行顺序 ReadModel／Tooltip；归 U07。
- 不更改 Hand 抽取算法、Save 顶层版本、Effect/Status Trace 语义、Map 作者合同或 E2–E5 玩法。
- 不编辑 GALHCG 图，不刷新或写 freshness。

## Stop Conditions

- 快照字段不能完整重建 U05 规划器的输入，或 U05 规划器读取了本合同未列出的提交前状态。
- 无法在纯、detached Owner 计划中捕获实际 U04 输入与 terminal 检查点。
- 为实现本单元需触碰 Restore、双 Owner coordinator、UI、Schema 生成器或 Allowed Files 外路径。

满足停止条件时保持本 Unit 尚未完成，列出缺少的实际输入和最小合同调整，不允许 U06 绕过。

## Completion Criteria

- [x] 每个 AG-1 Receipt（含无 Program、来源为空、战斗终局与非 Battle completion）均保存闭合 `schedulerStartSnapshot` 和闭合终局证据；E1 不含新字段。
- [x] 每条执行来源含 U02 完整排序输入，并逐字段等于 U04 候选；U02 重算顺序与 Preview/Commit 序列一致。
- [x] Snapshot 的 HP／余额／locals／Status／Hands／RNG／targetSelections／Ability／Item Draft 均为 Commit 开始时 detached 快照。
- [x] 测试覆盖：历史输入快照、排序键、锁定与自动目标输入（空锁定列表下高速来源击倒默认目标、慢速来源重选存活目标）、Enemy unaffordable、Party 成本拒绝、source effects 与终局检查点、terminal Item 不消费、无 Program Receipt、E1 无新增字段。
- [x] `gameplay-b-map-ag1-commit`、`gameplay-b-map-run`、`gameplay-b-map-source-transactions` 定向测试、`npx tsc --noEmit`、`git --no-pager diff --check` 通过并记录真实结果。
- [x] U06 可使用保存的开始快照重建 AG-1 规划器输入；本 Unit 不实现 Restore。

## 实施结果

- 在 AG-1 scheduler Receipt 中增加完整、深度 detached 的 `schedulerStartSnapshot`，覆盖 planner 实际读取的 Party 与 Encounter 身份、账本、HP、资源、Hands/RNG、overrides、目标与 Ability/Item drafts、locals、statuses、scope、round 和 draft version；不嵌套历史 Receipt。
- 每个执行来源保存 U04 `orderCandidate` 的四项 U02 排序键；Preview 与 Commit 共享同一 plan terminal outcome/checkpoint。
- terminal 证据记录 commit start、source 后、RoundEnd Status tick 后和 non-Battle completion；`afterSource` 另存 execution index。
- 增加二轮有效 Status checkpoint 与自动目标重选金样，另覆盖快照冻结/脱离、锁定目标和 Actorless drafts、完整排序键及终局 Receipt。
- `schedulerStartSnapshot` 提供 U06 从作者 Map/Encounter 合同重建 planner 所需的所有实际读取字段。实际 U06 复算仍由 U06 完成。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| AG-1 起点/排序/终局证据 | `npx vitest run tests/engine/gameplay-b-map-ag1-commit.test.ts` | 起点完整、detached；U02 key 完整；终局 checkpoint 正确 |
| E1 MapRun 兼容 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts` | E1 不新增字段且行为不变 |
| Item coordinator | `npx vitest run tests/engine/gameplay-b-map-source-transactions.test.ts` | 双 Owner 安装与幂等不变 |
| TypeScript | `npx tsc --noEmit` | 退出码 0 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |
