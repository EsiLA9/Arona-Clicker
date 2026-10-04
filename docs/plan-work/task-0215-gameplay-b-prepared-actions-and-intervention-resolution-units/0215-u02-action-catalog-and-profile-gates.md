# Unit 0215-U2：受信 Action Catalog 与 Profile 门槛投影

## Goal

将静态学生能力门槛收敛到受信 Action definitions，并为随机技能规则预留受信内容入口。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | 当前 ID-only entry 与 Profile snapshot 语义 |
| 历史 | `docs/plan-work/archive/task-0214-gameplay-b-student-participation-and-autonomy.md` | 已实现 candidate/priority/capability/reason 快照 |
| 源码/测试 | src/arona-clicker/contracts/operation-action.ts、`src/arona-clicker/contracts/operation.ts`、`src/arona-clicker/contracts/operation-content-resolver.ts`、`src/arona-clicker/contracts/operation-participant.ts`、`src/arona-clicker/services/operation-participant-admission.ts`、`src/arona-clicker/services/student-operation-profile-resolver.ts`、`src/arona-clicker/services/operation-definition-validation.ts`、`tests/engine/student-operation-runtime.test.ts`、`tests/engine/operation-participant-admission.test.ts` | 单一可信 Action source 贯穿 resolver/admission/Profile projection |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–30k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 1 篇 |
| 超预算处理 | 分开 resolver 投影与内容入口，不扩大 Read Set |

## Optional Read Set

- `src/arona-clicker/services/operation-entry-service.ts`：仅当解析内容的调用路径不清楚时读取。

## Do Not Read by Default

- Datapack / Registry 的未来实现、UI、Save 与无关 Character 实现。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Profile 当前以 actionRequirements 的交集得到 candidate snapshot，能力和 reason 随 snapshot 冻结。 | `student-operation-profile-resolver.ts:snapshotProfile` | 本 Unit 用 ActionDef 完全替代旧门槛表。 |
| Operation content 只能经 GameInstance 构造时受信 resolver 注入，公开入口不接收 EventDef。 | `operation-content-resolver.ts:OperationContentResolver`、`operation-entry-service.ts:OperationEntryFacade` | Action definitions 同样从这个可信 Resolver 返回。 |

## Constraints

- `OperationResolvedContent.actionDefinitions` 是 Action 唯一权威来源；从 EventDef 删除 `actionRequirements`，ActionDef.requiredCapabilityIds / reasonIds 直接驱动 Profile snapshot。
- Profile 的 priority/candidate 顺序沿用 Task 0214；ActionDef 缺失、重复或 Profile 引用不存在 Action 必须在 owner start 前拒绝。
- `OperationResolvedContent.studentSkillRules` 仅是临时受信内容入口，供 Profile.randomSkillRuleId 解析；正式规则的 Registry 归属留 Task 0220。
- Action definitions 与技能规则经 `OperationAdmission` 传递给一次性 Run-start projection；不要另加 EventDef action requirements 或其他非 resolver 内容入口。
- `locationTactics.enabledActionIds`、Combination tag slots 与 Skill rule reference 在同一受信 content 边界内与 Action/Skill definitions 完整交叉校验；U3/U6 可假设这份内容已验证。
- 不建立 Datapack 表、Schema、Runtime Editor 或默认包内容。

## Allowed Files

- `src/arona-clicker/contracts/operation.ts`
- src/arona-clicker/contracts/operation-action.ts
- `src/arona-clicker/contracts/operation-content-resolver.ts`
- `src/arona-clicker/contracts/operation-participant.ts`
- `src/arona-clicker/services/operation-participant-admission.ts`
- `src/arona-clicker/services/student-operation-profile-resolver.ts`
- `src/arona-clicker/services/operation-definition-validation.ts`
- `tests/engine/operation-participant-admission.test.ts`
- `tests/engine/student-operation-runtime.test.ts`
- `tests/engine/gameplay-b-event-runtime-integration.test.ts`
- docs/plan-work/task-0215-gameplay-b-prepared-actions-and-intervention-resolution-units/receipts/0215-u02-action-catalog-and-profile-gates.md

## Explicit Non-goals

- 不在这里选择当前行动、目标或资源可支付性；这些属于 U4。
- 不消费随机流、不执行技能规则、不变更 Run。
- 不更改 Task 0214 归档文件，不保留第二个资格权威字段。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件默认六条执行；发现 Profile 的已归档保证与当前源码冲突时停止并报告。

## Completion Criteria

- [ ] `OperationResolvedContent.actionDefinitions` 与 `.studentSkillRules` 受信返回，并经 OperationAdmission 交给 Run-start projection；缺失/重复 ID 与引用错误给出稳定诊断。
- [ ] 删除 `OperationEventDef.actionRequirements`，Profile eligibility/reasons 从完整 ActionDef 投影，已有顺序、Wait fallback 与 detached freeze 保持。
- [ ] Profile 引用的随机技能规则在解析内容中可核验；缺失/重复规则拒绝启动，未触发时不执行。
- [ ] locationTactics.enabledActionIds、Combination tag slots 和 studentSkillRules 的 Action/Outcome 引用均在 resolver/admission 边界闭合校验。
- [ ] 不改变 Character/Roster 入场检查和非学生身份旁路。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/student-operation-runtime.test.ts tests/engine/operation-participant-admission.test.ts` | Snapshot/source migration 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 人工验收 | 通过 source search 确认 actionRequirements 不再是运行时权威 | 无双重门槛来源 |
