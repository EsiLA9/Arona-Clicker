# Receipt 0215-U4

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `operation-beat.ts`、`operation-plan-preparation.ts`、`operation-target-selection.ts` 与对应两个定向测试；明确 U4 的纯函数输入和稳定 Wait reason；验证 Actor/Team 资源快照与 bounded 声明一致、十进制精确扣费后仍在资源下限之上、预留期间保留精确共享余额、Team membership 已声明，且 Profile 能力候选与 ActionDef 门槛一致；同步 U4 Unit 约束与父 Task 的 fail-closed 地点和候选回退裁定。 |
| 输入/输出 | `prepareOperationBeat(snapshot, trustedContent)` 只读取 Event ID、显式 planVersion、当前 Location、Actor participantKind/resources、Team resources，以及 EventDef、Run-start Actor initializations、Action catalog。结果保留 planVersion，并按 Event Actor 声明顺序输出每名 Actor 恰一个 studentAction、Intent 或 Wait。它不接触 mutable Run、RNG、PlayerCost、牌区、Registry 或 UI。 |
| 候选与地点 | 学生从 Profile priority-first `actionCandidates` 读取静态资格、次序与 reason；非学生从 U3 detached `candidateActionIds` 读取声明序。两者只取当前 Location `enabledActionIds` 交集。若当前 Location 没有 `locationTactics` 条目，allowlist 为空并生成 Wait，不开放整个 Action catalog，也不查找其他地点。 |
| 目标和预算 | `self`、`sameTeam`、`otherTeam`、`any` 按 `teamId` 与声明 Team 检查；`targetPriorityActorIds` 优先，Event actor 声明序破同分。当前候选没有合法自动目标或精确扣费后会低于资源 `min` 时尝试下一项。只有目标与 Actor/Team 成本都可行时才在本地预算副本预留资源；共享 Team 池按 Event Actor 声明序扣减，Wait 不扣费，输入余额保持不变。 |
| 稳定 Wait 语义 | 增加四个动态 reason：`operation:plan:no-candidate-action`、`operation:plan:no-enabled-action`、`operation:plan:no-legal-target`、`operation:plan:insufficient-resource`；同一 Actor 的失败候选按尝试顺序聚合并去重。学生静态能力筛选为空时沿用 `operation:profile:no-eligible-action`。损坏的 snapshot/content 返回带定位的 preparation/target-selection error，不静默降级为 Wait。 |
| 交接边界 | U4 仍是纯计算，没有 Run 写入、PreparedBeat 持久化、Intervention、Combination、RNG 或 Commit。U8 需从 EventRun 与当前 planVersion 投影精简 snapshot，并把完整 Event/Actor initialization/Action rules 在 Run 内冻结；U5 处理玩家明确指定目标的校验。 |
| GALHCG 影响闭环 | 项目 `acprogram` 的 contracts、services、tests/engine 与 plan-work 范围已定向 `refresh`；8 个 U4 文件均由 `resolve_paths` 成功解析。`review_changes` 对这些新文件均返回 `unreferenced_path`，没有尚待分页的既有 Evidence owner。新的 PreparedBeat/Target Selection 语义映射留 U9，避免把 U4 纯计算提前记录成已接线的 Runtime 机制。 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-plan-preparation.test.ts tests/engine/operation-target-selection.test.ts` | 通过 | 2 个文件，24 tests passed；涵盖关系矩阵、Actor/Team 资源 schema 与 bounds、扣费后 min 下限、小数精度及大余额的共享扣减、候选能力一致性、候选回退、fail-closed、reason 聚合、determinism、freeze 与跨 Event ID 拒绝。 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无 TypeScript 错误。 |
| 架构检查 | `npm run check:architecture` | 通过 | Engine 与 data-services 边界通过。 |
| 文档检查 | `npm run check:docs` | 通过 | 624 个 Markdown 文件，0 errors。 |
| Diff 检查 | `git diff --check` | 通过 | 仅有并行主题系统文件的 CRLF 转换提示；U4 改动无空白错误。 |
| GALHCG | `refresh`、`resolve_paths`、`review_changes`（项目 `acprogram`） | 通过 | 8 条路径全部解析；全为当前未映射路径，语义 owner 与 maps_to 留 U9。 |
