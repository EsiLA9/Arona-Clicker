# Unit 0301-U0b：标注旧敌方行动合同的有意变更

## Goal

在 Task 0291 与 Task 0299 留下可追溯的变更记录，避免其原固定伤害 / 隐藏敌方意图规则与 Task 0301 冲突。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/plan-work/archive/task-0301-gameplay-b-enemy-autonomous-action-cards.md` | 当前批准的新合同 |
| 文档 | `docs/plan-work/archive/task-0291-gameplay-b-hp-enemy-ability-item.md` | 固定 damage / 固定回合执行旧合同 |
| 文档 | `docs/plan-work/archive/task-0299-gameplay-b-autonomous-action-target-strategy.md` | 敌方时机与本 Task 排除项 |
| 文档 | `docs/docs-829/05-conventions/doc-maintenance.md` | 历史 Task 合同修订说明方式 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 5k–10k token |
| 文档 Read Set | 4 篇，相关段落 |
| 历史文档 | 0 篇 |
| 超预算处理 | 停止并上交 |

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Task 0291 定义敌方只有固定伤害，在玩家来源结算完成后行动。 | Task 0291 的 Combat / Commit 合同 | 作为原始规则保留并注明被替换。 |
| Task 0299 限定 P3 仅修改 Character Action，并要求敌方隐藏意图。 | Task 0299 的“同轮目标失效与费用”规则 | 仅对此敌方排除项作补充。 |

## Constraints

- 保留原 Task 的历史范围和已完成 Receipt；只增加有日期、链接的后续修订说明。
- 新旧规则、影响和负责实施的 Task 0301 必须能直接区分。

## Allowed Files

- `docs/plan-work/archive/task-0291-gameplay-b-hp-enemy-ability-item.md`
- `docs/plan-work/archive/task-0299-gameplay-b-autonomous-action-target-strategy.md`
- `docs/plan-work/archive/task-0301-units/0301-U0b-prior-contract-amendments.md`
- `docs/plan-work/archive/task-0301-units/receipts/receipt-0301-U0b.md`

## Explicit Non-goals

- 不改产品实现、Schema、历史测试结果或 Task 0291 / 0299 已完成 U0–U8 的验收。
- 不修改 `draft-0287` 历史总合同；Task 层的有意变更记录已足够追溯。

## Stop Conditions

- 旧 Task 事实需要改写而非追加补充才能避免歧义。
- 发现已有新合同与用户批准方向冲突。
- 需要修改 Allowed Files 外的路径。

## Completion Criteria

- [ ] Task 0291 清楚记录固定 damage 已被 Task 0301 替换。
- [ ] Task 0299 清楚记录“不公开敌方意图”已被 Task 0301 替换，且 Character-only 已升级为双方共用策略。
- [ ] 旧合同正文仍可理解为原任务当时的边界，当前施工入口指向 Task 0301。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档路由 | `npm run check:docs` | 通过 |
| 差异 | `git diff --check` | 无空白错误 |
