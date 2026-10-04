# Unit 0215-U3：非学生 Intent 候选来源

## Goal

让对手/环境 Actor 从自己的 ParticipantSpec 获得唯一有序 Intent 候选；LocationTactics 仅过滤启用 Action 并提供 CombinationRules。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | 当前非学生 admission 旁路与 Actor 快照 |
| 历史 | `docs/plan-work/archive/task-0214-gameplay-b-student-participation-and-autonomy.md` | 非学生不需要 Character/Profile 的已完成边界 |
| 源码/测试 | `src/arona-clicker/contracts/operation-participant.ts`、`src/arona-clicker/services/operation-participant-admission.ts`、`src/arona-clicker/services/operation-entry-service.ts`、`src/arona-clicker/contracts/operation.ts`、`tests/engine/operation-participant-admission.test.ts` | ParticipantSpec admission 到 Run start 的投影 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k token |
| 文档 Read Set | 1 篇 |
| 历史文档 | 1 篇 |
| 超预算处理 | 只补充 Actor candidate snapshot 所需边界 |

## Optional Read Set

- `tests/engine/gameplay-b-event-runtime-integration.test.ts`：仅当 GameInstance facade 投影验证不足时读取。

## Do Not Read by Default

- Enemy AI、Character roster、Datapack Editor、路线与 Save 内容。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 非学生 ParticipantSpec 目前只有 actorId/kind/factionId，无候选行动字段。 | `src/arona-clicker/contracts/operation-participant.ts:OperationParticipantSpec` | U3 只加有序 candidateActionIds。 |
| 对手和环境参与者不经过玩家 roster admission，Run actor identity snapshot 由受控入口传递。 | `operation-participant-admission.ts`、`operation-definition-validation.ts:validateOperationActorInitializations` | 保留此旁路，不伪造 Character/Profile。 |

## Constraints

- 非学生候选来自 `OperationParticipantSpec.candidateActionIds`，其数组顺序就是 Intent 的尝试顺序；所有 ID 必须由 Action catalog 提供且 ActionDef 允许对应 kind。
- `locationTactics` 临时块仅列 `enabledActionIds` 和 `combinationRules`，不得再复制/排序非学生 candidate 列表；当前地点可用候选是 ParticipantSpec 顺序与 enabledActionIds 的交集。
- 候选在 admission/start 时校验、复制，不在每次准备时重扫 Registry 或 Participant definitions。
- `OperationActorDef.teamId` 决定 Team resource 付款归属；ParticipantSpec.factionId 仍仅是参与者身份，不隐式决定 Team。
- 不实现 AI 条件树；每 Beat 按声明序与当时目标/资源资格选第一个可行 Intent。

## Allowed Files

- `src/arona-clicker/contracts/operation-participant.ts`
- `src/arona-clicker/contracts/operation.ts`
- `src/arona-clicker/services/operation-participant-admission.ts`
- `src/arona-clicker/services/operation-entry-service.ts`
- `tests/engine/operation-participant-admission.test.ts`
- docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/receipts/0215-u03-nonstudent-action-candidates.md

## Explicit Non-goals

- 不实现对手策略 AI、路径决策或内容 Registry。
- 不让非学生经过 CharacterSystem/RosterSystem，不改 faction 语义。
- 不准备/结算 Beat，不消费 RNG。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件默认六条执行；若候选 Action 对身份类型无法确定，停止并上交而不猜测。

## Completion Criteria

- [ ] 非学生 ParticipantSpec 可声明唯一有序 action candidate IDs；错误、重复、缺定义、kind 不兼容均在 Run 启动前拒绝。
- [ ] 合法候选以 detached 快照进入受控 Run start input，并能供后续纯准备器读取。
- [ ] LocationTactics 只过滤 enabledActionIds 并提供 CombinationRules，不重复维护 Intent 优先序。
- [ ] factionId 与 teamId 清晰分离；非学生 admission 不读取 Player roster/Character Profile。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-participant-admission.test.ts` | 候选投影/拒绝边界通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 人工验收 | 检查 operation participant admission 和 actor snapshot | 无身份语义回退 |
