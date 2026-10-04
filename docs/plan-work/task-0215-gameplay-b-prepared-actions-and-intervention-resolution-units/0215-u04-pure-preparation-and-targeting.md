# Unit 0215-U4：纯 PreparedBeat、Intent 与目标顺序

## Goal

从单一 detached Run/content 输入生成稳定 PreparedBeat，不修改 Run 或随机游标。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`、本 Task 的“确定性准备”裁定 | 当前 Run owner 与计划规则 |
| 源码/测试 | `src/arona-clicker/contracts/operation.ts`、src/arona-clicker/contracts/operation-action.ts、`src/arona-clicker/services/student-operation-profile-resolver.ts`、`tests/engine/student-operation-runtime.test.ts` | 输入 snapshot 和资格投影 |
| 源码/测试 | `src/arona-clicker/contracts/operation-participant.ts`、`src/arona-clicker/services/operation-definition-validation.ts` | 非学生 candidate 与 location rules 引用 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 将纯 target selection 拆开；不加入 UI/路线查询 |

## Optional Read Set

- `docs/docs-829/05-conventions/architecture-discipline.md`：仅当纯函数/产品服务方向不清晰时读取。

## Do Not Read by Default

- UI、Datapack / Registry、Route、Save、Generic AI。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Profile 已持有静态 action candidate 和稳定偏好顺序；事件 actor 顺序来自 OperationEventDef.actors 数组。 | `src/arona-clicker/contracts/student-operation-profile.ts`、`src/arona-clicker/contracts/operation.ts:OperationEventDef` | 两种次序作为确定执行顺序。 |
| Location 当前只有 ID，不存在 LocationDef 或 routes。 | `src/arona-clicker/contracts/operation.ts:OperationEventDef.locationIds` | 读取按当前 ID 索引的临时 `locationTactics`。 |
| U3 的非学生有序候选已进入 Run-start Actor initialization；学生 Profile 则以资格 snapshot 进入 actor state。 | `src/arona-clicker/contracts/operation.ts:OperationActorInitialization`、`OperationActorState` | 纯准备 content 读取受信初始化，不在 EventRun 扩散第二份候选表。 |

## Constraints

- 使用纯 `prepare(snapshot, trustedContent)` 风格；snapshot 只含 `eventId`、`planVersion`、当前 Location ID、按 ID 标识的 Actor participantKind/resources 与 Team resources；trustedContent 含 EventDef、Run-start Actor initialization、Action catalog。eventId 不匹配即报告错误。不得持有可变 Run、读取随机数、PlayerCost/牌区、依赖 UI 或扫描 Registry/Event graph。
- 学生顺序取 Profile `actionPriorityIds` 优先并以 `candidateActionIds` 补足；nonstudent 顺序取 ParticipantSpec.candidateActionIds。候选都与当前 Location `enabledActionIds` 取交集；缺失当前 `locationTactics` 条目定义为空 allowlist，关闭全部 Action 并产生 Wait，不隐式启用 catalog 或扫描其他地点。
- 每 Actor 按 Event Actor 声明顺序处理；先检查地点启用、参与者 kind、学生静态资格及目标，再检查 Actor/Team 余额。snapshot 资源键必须与定义一致且余额位于 bounds 内；成功预留后不得低于 `min`。候选失败不预留资源；仅完整可执行的候选才占用其成本。共享 Team 预算按该顺序预留；费用不足时尝试同一 Actor 的下一候选；无可行项产生无成本 Wait。
- target 仅为 none 或一个 Actor，ActionDef 声明是否需目标与 self/sameTeam/otherTeam/any 关系：self 只匹配来源 Actor；sameTeam/otherTeam 要求双方均有 teamId，前者相等、后者不同；any 可匹配 teamless Actor。自动目标先按来源 `OperationActorDef.targetPriorityActorIds`，再按 Event Actor 声明顺序；具体 Actor ID 不进入可复用 ActionDef。非法目标必须具体报告。
- 自动目标无合法目标会使当前候选失败并继续尝试下一项；最终 Wait 的稳定系统 reason 为 `operation:plan:no-candidate-action`、`operation:plan:no-enabled-action`、`operation:plan:no-legal-target`、`operation:plan:insufficient-resource`，多候选失败时按候选尝试顺序去重聚合。学生没有静态合格行动时沿用其 Profile fallback reason。玩家提交的非法明确目标属于 U5 Intervention 校验。
- 输入 snapshot/content 若违反 Run/Action/Team 引用结构，抛出带定位诊断的 preparation error，不静默转换成 Wait。planVersion 是 snapshot 显式输入，并逐字带入 PreparedBeat。
- 不在准备中掷骰；相同 detached 输入必须得到完全相同计划、Intent、费用与理由。

## Allowed Files

- src/arona-clicker/contracts/operation-beat.ts（新增）
- src/arona-clicker/services/operation-plan-preparation.ts（新增）
- src/arona-clicker/services/operation-target-selection.ts（新增）
- tests/engine/operation-plan-preparation.test.ts（新增）
- tests/engine/operation-target-selection.test.ts（新增）
- docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/receipts/0215-u04-pure-preparation-and-targeting-receipt.md

## Explicit Non-goals

- 不存 PreparedBeat 到 Run、不接 public commands、不提交 state change。
- 不实现 Intervention、Combination、RNG、Effect merge 或 Outcome。
- 不修改 Location route/gate 或 SceneAction。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件默认六条执行；若候选规模无法限界或需访问全 Registry，先停止并回报。

## Completion Criteria

- [x] 每个 Event Actor 输出恰一个 studentAction/Intent 或 Wait；来源、Action、target、cost、reason 和 planVersion 可解释。
- [x] candidate 次序、Team 费用预留次序、Target tie-break 均符合 Task；目标失败与费用不足均继续尝试本 Actor 下一个候选。
- [x] self/sameTeam/otherTeam/any 对有 Team、不同 Team 与 teamless Actor 的判断符合主 Task 固定条件。
- [x] 缺失当前地点 tactics 条目等同空 enabled allowlist；最终 Wait reason ID 稳定且按候选次序去重。
- [x] 相同 Run/content 输入的连续准备结果深度相等；函数不变更输入、Run 或 tacticalCursor。
- [x] locationTactics 引用缺失/非法已由上游合同拒绝，不在此处尝试恢复或扫描其他地点。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-plan-preparation.test.ts tests/engine/operation-target-selection.test.ts` | 固定顺序、共享预算、Wait 和纯度通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 架构检查 | `npm run check:architecture` | 数据服务边界通过 |
| 文档检查 | `npm run check:docs` | Task/Receipt 链接有效 |
| Diff 检查 | `git diff --check` | 无空白错误 |
| 人工验收 | 同一输入双次运行并比较完整输出 | 结果完全一致，cursor 不变 |
