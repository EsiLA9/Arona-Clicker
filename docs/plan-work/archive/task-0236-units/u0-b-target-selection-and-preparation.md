# Unit 0236-U0-B：统一目标匹配与自动计划

## Goal
让通用目标筛选规则参与合法候选计算与自动计划准备；未声明过滤的既有 Action 保持原目标范围和偏好顺序。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 任务 | `docs/plan-work/archive/task-0236-gameplay-b-typed-action-cards-and-target-layers.md`、`docs/plan-work/archive/task-0236-units/u0-a-target-scope-contract.md` | 目标含义与新合同 |
| 协议 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/galhcg-project-map.md` | Unit / Evidence 护栏 |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | 当前准备与目标选择语义 |
| 源码 | `src/arona-clicker/services/operation-target-selection.ts:selectOperationTarget`、`operation-plan-preparation.ts:prepareOperationBeat` | 自动目标的权威选择点 |
| 测试 | `tests/engine/operation-target-selection.test.ts`、`operation-plan-preparation.test.ts` | 匹配与自动计划回归 |

## Context Budget
| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k tokens |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分或上报，不扩大白名单 |

## Optional Read Set
- Unit U0-A 已完成后的 Receipt（仅确认字段最终名称与校验边界）。

## Do Not Read by Default
- `docs/plan-work/archive/**`、UI 源码及无关 Resolution 机制。

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| `selectOperationTarget` 先计算 relation 候选，再按 `targetPriorityActorIds` 顺序选择；偏好不限制合法范围。 | `src/arona-clicker/services/operation-target-selection.ts` | 新过滤条件需应用于所有 relation 候选。 |
| `prepareOperationBeat` 使用统一目标选择器构建学生、对手和环境的基础计划。 | `src/arona-clicker/services/operation-plan-preparation.ts` | 目标筛选须影响自动准备。 |
| `OperationActorDef.type` 是 Event Actor 的声明对象类型；`OperationActorKind` / `participantKind` 是参与者类别。 | `src/data-services/contracts/operation.ts:OperationActorDef.type / OperationActorKind`、`src/arona-clicker/contracts/operation-view.ts:OperationViewActor.participantKind` | `allowedActorTypes` 应与 Actor 声明 type 精确匹配。 |
| 当前目标测试覆盖四种 relation 和优先级，但无规则范围过滤用例。 | `tests/engine/operation-target-selection.test.ts` | 加入精确 ID / type 的接受与排除案例。 |

## Constraints
- 本 Unit 依赖 U0-A 的目标字段落定；开始前核对 Unit 与其 Receipt。
- UI 可见候选最终应与 Runtime 选择规则一致；不重定义 relation。

## Allowed Files
- `src/arona-clicker/services/operation-target-selection.ts`
- `src/arona-clicker/services/operation-plan-preparation.ts`
- `tests/engine/operation-target-selection.test.ts`
- `tests/engine/operation-plan-preparation.test.ts`
- `docs/plan-work/archive/task-0236-units/u0-b-target-selection-and-preparation.md`
- `docs/plan-work/archive/task-0236-units/receipts/receipt-u0-b-target-selection-and-preparation.md`

## Explicit Non-goals
- 不改干预预览、OperationView、Resolution 或 UI。
- 不改首幕内容声明；由 U0-D 负责。
- 不把 `targetPriorityActorIds` 改成允许名单。

## Stop Conditions
按 [[docs/ai/PROJECT-CONSTITUTION#停止条件]] 默认六条执行；U0-A 事实与当前代码冲突时停止。

## Completion Criteria
- [x] Actor ID / type 过滤先于偏好排序并用于同一 relation 的全部候选。
- [x] 合法目标为空时仍走既有 Wait / unavailable 语义。
- [x] 自动计划的目标不会落在声明过滤范围外。
- [x] 未声明过滤的 `any`、团队 relation 和优先顺序回归不变。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-target-selection.test.ts tests/engine/operation-plan-preparation.test.ts` | 通过 |
| Receipt | 填写本 Unit Receipt | 记录实际改动 / 验证 |
