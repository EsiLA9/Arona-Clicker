# Unit 0299-U0：冻结规则并更新 Task 入口

## Goal

将负责人确认的目标、权重、费用、无目标与回合稳定规则写入 Task-0299，并明确覆盖的旧合同。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | Unit 边界与文档产物规则 |
| 文档 | docs/plan-work/archive/task-0290-gameplay-b-action-draw-hand-swap-commit.md | 记录被替换的多目标规则 |
| 文档 | docs/plan-work/archive/task-0291-gameplay-b-hp-enemy-ability-item.md | 记录 C4 同轮目标结算 |
| 文档 | docs/plan-work/archive/task-0298-gameplay-b-relations-hover-and-target-interaction.md | 复用换牌清目标合同 |
| 文档 | docs/plan-work/00-index.md | 更新活动 Task 状态与入口 |
| 源码 | src/arona-clicker/services/gameplay-b-hand-resolver.ts | 核对 Hand[0]、顺序与 RNG 现状 |
| 源码 | src/arona-clicker/services/map-run-service.ts | 核对 Preview / Commit Owner |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 5 篇；只读直接依赖 |
| 历史文档 | 0 篇 |
| 超预算处理 | 记录差异并缩小，不扩展历史扫描 |

## Optional Read Set

- 源码与测试中的对应合同，仅在上述事实不足时读取。

## Do Not Read by Default

- docs/plan-work/archive/**
- 与 Gameplay B MapRun 无关的 UI / Schema / Operation Planner

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 多目标当前阻塞提交；Target Preview 与 Commit 在 MapRun Owner。 | gameplay-b-action-preview-resolver.ts：resolveGameplayBActionPreview；map-run-service.ts：resolveEncounterCommitPlan | 负责人已批准默认目标规则。 |
| C4 当前对先手击杀后续目标的 Character Action 仍收费。 | Task 0291 C4；map-run-service.ts：resolveEncounterCommitPlan | 本 Task 明确增加仅自动目标的例外。 |
| Swap / PlayerCommand 清除目标并重新 Preview。 | Task 0298 U7 Receipt；map-run-service.ts：setActionOverride | 只替换策略结果，不重做命令。 |

## Constraints

- 仅改 Task、活动索引与本 Unit Receipt。
- 规则以当前用户本轮指示为准；没有再次设计或等待全面审阅。

## Allowed Files

- docs/plan-work/archive/task-0299-gameplay-b-autonomous-action-target-strategy.md
- docs/plan-work/00-index.md
- docs/plan-work/archive/task-0299-units/receipts/receipt-0299-U0.md

## Explicit Non-goals

- 不改产品源码、测试、生成 Schema 或既有 UI 工作。
- 不恢复旧 Operation Planner。

## Stop Conditions

- 源码事实与 Task 的事实表不符时先记录冲突，不扩大施工范围。
- 其余遵循 PROJECT-CONSTITUTION §停止条件。

## Completion Criteria

- [x] 目标优先级、情境权重、虚拟费用预算、目标失效、卡牌空目标和存档稳定规则已冻结。
- [x] Task 0290 / 0291 / 0298 的有意覆盖与继续复用范围已写明。
- [x] Task 状态、P0—P5 和后续 Patch Unit 路由已更新。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档检查 | npm run check:docs | 通过 |
| 差异检查 | git diff --check | 通过 |
