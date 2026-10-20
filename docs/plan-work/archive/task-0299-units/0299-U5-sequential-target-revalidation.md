# Unit 0299-U5：同轮自动目标失效与无目标收据

## Goal

让同轮先手击杀目标后的自动 Character Action 按同一目标策略重选；若无剩余对象则跳过且免 Actor / Team Action costs，并将结果写进共享 Commit Plan 与 Receipt。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | 白名单与停止条件 |
| 文档 | docs/plan-work/archive/task-0299-gameplay-b-autonomous-action-target-strategy.md：P0、P3、Task 0291 覆盖表 | 费用和手动 / 自动目标规则 |
| 文档 | docs/plan-work/archive/task-0291-gameplay-b-hp-enemy-ability-item.md：C4 同轮结算 | 确认本 Unit 有意覆盖范围 |
| 源码 | src/arona-clicker/services/gameplay-b-action-preview-resolver.ts：目标 preference 与合法候选 | 提取共享策略 |
| 源码 | src/arona-clicker/services/map-run-service.ts：resolveEncounterCommitPlan、previewEncounterCommit、prepareEncounterRoundCommit | 顺序模拟与唯一结算 Owner |
| 源码 | src/arona-clicker/contracts/map-run.ts：MapRunEncounterActionSettlement / receipt | 保存跳过结果 |
| 测试 | tests/engine/gameplay-b-map-run.test.ts | 自动重选、手动失效、费用 / Receipt / Restore |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 20k–35k token |
| 文档 Read Set | 3 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 如需改 Runtime View 或 UI 投影，交给独立 Unit，不扩展本 Unit 白名单 |

## Optional Read Set

- tests/engine/gameplay-b-map-save-resume.test.ts，仅当本 Unit 无法覆盖 receipt Restore 时再读。

## Do Not Read by Default

- docs/plan-work/archive/**
- Workspace、Controller、CSS 与 Task 0291 U4 文件
- Ability / Item 行为实现；本 Unit 明确保持其旧合同

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Commit Preview 与实际 Commit 共用 resolveEncounterCommitPlan；当前先汇总费用后模拟 HP。 | map-run-service.ts：resolveEncounterCommitPlan、previewEncounterCommit、prepareEncounterRoundCommit | 在同一纯计划中解决目标和费用。 |
| 目标草稿只保存玩家显式选择；自动目标从 Preview 推导。 | map-run.ts：MapRunEncounterTargetSelection；gameplay-b-action-preview-resolver.ts | 有 targetSelections 表示手动锁定。 |
| C4 当前先手击杀后后手仍支付费用并产生 0 HP delta。 | Task 0291 C4；现有 overkill 回归 | 本 Task 窄范围覆盖自动准备目标。 |
| Restore 严格校验持久化 receipt settlement 字段。 | map-run-service.ts：restoreEncounterCommitReceipt | 新 skipReason 必须有显式校验，不放宽整体保存解析。 |

## Constraints

- 按 Map 固定队伍顺序模拟 Character Actions；若初始自动目标仍存活就保持它，只有目标失效时才按当前 Action preference 重选。
- 手动目标失效不改锁、不重选，继续支付其 Actor / Team Action costs，HP delta 为 0。
- 自动目标失效且无合法替代时，保留 Action ID / Override / PlayerCommand fee，标记 skipReason=noLegalTarget；不收 Actor / Team Action costs，不应用该 Action 的 resource effects / HP effects / card effects。
- 若其 Action 来自 PlayerCommand，已支付的 1 PlayerCost 指令费继续结算；该费用不是 Action resource cost。
- Skip 仅覆盖 Character Action。Ability / Item 显式目标和费用仍按 Task 0291。
- Commit Preview、正式 Commit 与 Receipt 使用同一 MapRun 纯计划；不在 Hover / 普通 Preview 写状态。

## Allowed Files

- src/arona-clicker/services/gameplay-b-target-selection.ts（新增）
- src/arona-clicker/services/gameplay-b-action-preview-resolver.ts
- src/arona-clicker/services/map-run-service.ts
- src/arona-clicker/contracts/map-run.ts
- tests/engine/gameplay-b-map-run.test.ts

## Explicit Non-goals

- 不改 Workspace / Runtime View / Controller / UI；由 U9 负责投影。
- 不重抽 Hand、重新规划其他角色或改写 Ability / Item 目标语义。
- 不在 Commit 中重选仍合法的自动目标，不将手动目标变成自动目标。

## Stop Conditions

- 无法从 targetSelections 区分手动目标与自动派生目标：停止并指出缺少的已保存来源状态。
- 费用合并 / Receipt 合同无法豁免未执行 Character Action 的 Actor / Team costs，但保持 PlayerCommand PlayerCost：停止并说明冲突。
- 需要修改 Runtime View / UI / Task 0291 U4 接口或触碰 Allowed Files 外文件：停止当前 Unit，不扩大范围。
- 其余遵循 PROJECT-CONSTITUTION §停止条件。

## Completion Criteria

- [x] 先手 Action 击杀 A 后，后手自动目标按同策略选择仍存活 B，Preview settlements、Commit HP 结果和 Receipt 一致。
- [x] 自动目标没有替代对象时，角色行动显式标记 noLegalTarget；该行动不收 Actor / Team costs 或效果，整轮仍可 Commit。
- [x] 手动目标 A 被先手击杀后不改目标，仍付原费用且记录 0 HP delta；单个合法默认目标被手动确认时也保存为手动。
- [x] PlayerCommand skip 保留 1 PlayerCost，但不重复扣费；普通 natural / Swap 不扣该费。
- [x] 保存恢复能校验新 Receipt，Ability / Item 仍执行 Task 0291 原合同。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| MapRun / Commit / Receipt | npx vitest run tests/engine/gameplay-b-map-run.test.ts | 通过 |
| 类型检查 | npx tsc --noEmit | 通过 |
| 差异检查 | git diff --check | 通过 |
