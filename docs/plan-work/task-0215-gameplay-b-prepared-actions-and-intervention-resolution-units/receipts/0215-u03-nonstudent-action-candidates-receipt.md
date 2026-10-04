# Receipt 0215-U3

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 扩展 `OperationParticipantSpec` / admitted participant 与 `OperationActorInitialization`，增加非学生有序 `candidateActionIds`；Admission 解析与冻结候选、按 actorId 投影至 Run-start；共享 Action 内容校验覆盖参与者 kind、候选引用、能力门槛与 Actor/Team resource 引用；结构校验允许合法非学生候选并拒绝 Wait/重复/畸形 ID；扩展 admission、profile/runtime 与公开入口测试。U3 Unit 文件同步扩充实际需要的白名单，并更新父 Task 推进状态。 |
| 契约裁定 | 非学生候选次序唯一来自 ParticipantSpec；Action 必须存在且允许 opponent/environment。非学生没有 capability 来源，因此引用带非空 `requiredCapabilityIds` 的 Action 会被拒绝，不静默忽略能力门槛，也不新增能力内容合同。Location `enabledActionIds` 在 U4 纯准备阶段过滤；入场保留全局候选顺序。 |
| 资源闭合 | 候选 Action 的费用、效果 Actor/Team resource 以 Event Actor 与其 `teamId` 解析；目标 Actor/Team 资源按 Action 的合法目标关系检查。`factionId` 只标识参与者，不替代 `teamId`。所有无效候选都在 owner 写入 Run 前拒绝，owner 对直接 Run-start 输入也重复检查。 |
| 身份边界 | 非学生 Admission 不读取 CharacterSystem、RosterSystem 或 PlayerState；只有存在需核验的学生入场时才要求并读取这些依赖。候选顺序以 detached、冻结列表进入 Run-start Actor initialization；不加入 ActorState 公共投影，U8 负责将其和 Action Catalog 冻结到私有 per-Run rules，供 U4 及后续准备流程消费。 |
| 白名单调整 | 原 Allowed Files 漏掉 ParticipantSpec 到 Run-start 投影、owner 输入结构验证和已有强类型 fixture。完成前将 Unit 白名单扩展到 `student-operation-profile-resolver.ts`、`operation-definition-validation.ts` 及三个直接共享该契约的测试；这些改动均服务同一 admission → owner 手递路径，未扩展机制范围。 |
| GALHCG 影响闭环 | 项目 `acprogram` 的 contracts、services、tests/engine 与 plan-work 范围已定向 `refresh`；12 个本 Unit 文件均由 `resolve_paths` 成功解析。`review_changes` 已逐路径检查，所有既有 Evidence owner 页面均完成分页；既有 Runtime/Profile Admission 证据为 `content_changed`，将在 U9 稳定语义后更新。`operation-action-content-validation.ts` 与 Task/Receipt 当前没有直接语义映射；Action / Intent / nonstudent candidate 的唯一语义 owner 与 maps_to 维护留 U9，未在中间态提前改图。 |
| 后续交接 | U4 需明定缺少当前地点 `locationTactics` 时的 allowlist 行为，并为非学生无可行动作的 Wait 提供稳定 reason ID。U8 需保留这里生成的完整候选顺序；U9 更新 `operation-runtime.md` 与最终 GALHCG 语义关联。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-participant-admission.test.ts tests/engine/student-operation-runtime.test.ts tests/engine/operation-runtime-service.test.ts tests/engine/gameplay-b-event-runtime-integration.test.ts` | 通过 | 4 个文件，42 tests passed。覆盖 NPC-only 不接入 roster、多个非学生按 actorId 绑定、候选次序/冻结、owner forged kind、能力拒绝及 Actor/Team/目标资源引用。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无 TypeScript 错误。 |
| 架构检查 | `npm run check:architecture` | 通过 | 数据服务/Engine 边界检查通过。 |
| Diff 检查 | `git diff --check` | 通过 | 只有并存的其他文件 CRLF 提示；U3 变更无空白错误。 |
| 文档检查 | `npm run check:docs` | 通过 | 623 个 Markdown 文件，0 errors。 |
| GALHCG | `refresh`、`resolve_paths`、`review_changes`（项目 `acprogram`） | 通过 | 12 条路径全部解析；既有 owner 分页完整。地图语义更新留 U9。 |
