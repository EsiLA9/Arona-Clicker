# Unit task-0151-PU-3：Save Progress 与幂等提交

## Goal

增加 Save-scope MilestoneProgress 的最小 completed 身份事实，并通过 StateMutationService 提供只成功一次的完成提交。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `docs/docs-828/01-architecture/state-layers.md` | 确认权威状态层与投影边界 |
| 文档 | `docs/docs-828/03-data-structures/player-state.md` | PlayerState Save 字段约定 |
| 文档 | `docs/docs-828/04-mechanisms/state-mutation.md` | 唯一状态写入服务与验证口径 |
| Task | `docs/plan-work/task-0151-milestone-persistent-arrival-facts-p0.md` | 只保存 completed ID、保留 orphan 的裁定 |
| 源码 | `src/arona-clicker/types/state.ts:PlayerState` | Save 数据接口 |
| 源码 | `src/arona-clicker/state/state-factory.ts:createDefaultPlayerState` | 新存档默认值 |
| 源码 | `src/arona-clicker/state/state-mutation-service.ts` | 幂等 mutation 与写入守卫模式 |
| 测试 | `tests/engine/state-mutation-service.test.ts` | 验证一次性写入和状态约束 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k tokens |
| 文档 Read Set | 4 篇，含 Task |
| 历史文档 | 0 篇 |
| 超预算处理 | 超过 60k 时停止并重新拆分 |

## Optional Read Set

- `src/arona-clicker/runtime-save-codec.ts`、`src/arona-clicker/runtime-save.ts`：仅当 PlayerState 顶层字段未随整体序列化时读取；当前 Task 事实称整体克隆。

## Do Not Read by Default

- `docs/plan-work/archive/**`（本 Unit 明确列出的自身依赖除外）
- Datapack parser / Registry、Adapter、UI

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Save codec 整体 JSON 克隆 PlayerState | `src/arona-clicker/runtime-save-codec.ts:buildSaveData`、`runtime-save.ts:restoreFromSave` | 新顶层字段随 Save 往返 |
| `triggersCompleted` 属于 per-Init 快照，而 Reveal Progress 是顶层 Save 事实 | `src/arona-clicker/state/per-init-fields.ts:PER_INIT_FIELD_SPECS`、`types/state.ts:PlayerState` | Milestone 使用 Save 级字段 |
| 所有状态写入必须走 StateMutationService | `AGENTS.md` 稳定护栏、`state-mutation.md` | 该规则对本 Unit 生效 |

## Constraints

- v1 唯一事实是 `milestoneId ∈ completed`；不得持久化 incomplete、当前 Condition 值、registration identity 或 completedAt。
- 具体编码按现有 Save 习惯选择 array / record；保留没有当前 Definition 的 completed ID。
- 不写存档 migration。

## Allowed Files

- `src/arona-clicker/types/state.ts`
- `src/arona-clicker/state/state-factory.ts`
- `src/arona-clicker/state/state-mutation-service.ts`
- `tests/engine/state-mutation-service.test.ts`

## Explicit Non-goals

- Milestone Definition、Registry、Condition evaluation、事件注册、Runtime wiring、UI 与 migration。

## Stop Conditions

使用 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件全部 6 条。若幂等提交需要修改保存恢复或独立 service，停止回交。

## Completion Criteria

- [ ] PlayerState 有 Save-scope completed Progress 默认值并随现有 Save 路径往返。
- [ ] StateMutationService 对重复完成返回无效提交且不造成第二次事实写入。
- [ ] completed 可包含 orphan ID，Condition 变化不清除它。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/state-mutation-service.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 架构检查 | `npm run check:architecture` | 通过 |
