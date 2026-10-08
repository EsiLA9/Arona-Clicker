# Unit 0241-U5：将角色 Hand 接入 Preparation / Intervention

## Goal

让规范计划的学生 Action 来自其当前 Hand，并让玩家显式选择只能从当前 Hand 选取的行动。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0241-gameplay-b-strategy-pools-and-interaction-context.md` E0 | 当前 Hand 选择边界 |
| 源码 | `src/arona-clicker/contracts/operation-beat.ts` | Preparation/Intervention 输入和错误合同 |
| 源码 | `src/arona-clicker/services/operation-plan-preparation.ts` | 默认准备选择顺序 |
| 源码 | `src/arona-clicker/services/operation-intervention-preview.ts` | 显式 Action/target 校验 |
| 源码 | `src/arona-clicker/services/operation-target-selection.ts` | 合法目标校验 |
| 测试 | `tests/engine/operation-plan-preparation.test.ts`、`operation-intervention-preview.test.ts` | 行为和回归断言 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k tokens |
| 文档 Read Set | Task E0 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超 60k tokens 时停止并交还 Task Owner |

## Optional Read Set

- 无；需要新增命令入口或 UI 文件时停止并上报。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `src/ui/**`、Editor、测试样例包

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Preparation 接收快照及冻结 ActionDef 并生成 PreparedBeat | `operation-plan-preparation.ts:prepareOperationBeat` | 当前只读计算 |
| Intervention 校验替换学生行动后重算费用与目标 | `operation-intervention-preview.ts` | 可复用入口 |

## Constraints

- 学生 Hand 之外的 Action 即使 Profile 或 Location 声明，也不能进入学生计划。
- Actor/Team/Environment Intent 不使用角色 Hand。
- Preview 是纯计算，不改变 Run 或任何抽取状态。

## Allowed Files

- `src/arona-clicker/contracts/operation-beat.ts`
- `src/arona-clicker/services/operation-plan-preparation.ts`
- `src/arona-clicker/services/operation-intervention-preview.ts`
- `tests/engine/operation-plan-preparation.test.ts`
- `tests/engine/operation-intervention-preview.test.ts`

## Explicit Non-goals

- Run 的持久化、Save/Resume 安装和 View。
- UI Interaction / Editor / 数据包内容。
- 角色手牌以外的策略或 NPC 自主性。

## Stop Conditions

使用 PROJECT-CONSTITUTION §停止条件全部 6 条；需增加命令/API 或修改白名单外文件时上报。

## Completion Criteria

- [ ] Run 当前学生 Hand 是其学生 Action 选择的硬上界。
- [ ] 显式干预可选择 Hand 中卡片，不可选择 Hand 外 Action。
- [ ] 候选均不合法时仍产生稳定 Wait；Hand 选择不能绕过 target/cost 检查。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-plan-preparation.test.ts tests/engine/operation-intervention-preview.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |

## Receipt

见 `receipts/receipt-0241-u5-operation-hand-preparation.md`。
