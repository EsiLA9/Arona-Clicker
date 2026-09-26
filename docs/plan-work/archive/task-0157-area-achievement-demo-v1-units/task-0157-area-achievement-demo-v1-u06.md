# Unit 0157-U06：首次完成后执行 Listener then

## Goal

关联 Listener 的 Milestone 首次成功提交完成事实后，自动执行一次 `then`；可捕获异常记录 DevLog，读档与返回不重放。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/effect-trigger.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 完成、Effect 与 Unit 边界 |
| 计划 | `docs/plan-work/task-0157-area-achievement-demo-v1.md`、本 Unit、U02/U05 Receipts | op 准入与统计前置 |
| 源码 | `src/arona-clicker/services/milestone-adapter.ts`、`src/arona-clicker/runtime-wiring.ts`、`src/arona-clicker/state/state-mutation-service.ts:completeMilestone`、`src/engine/effect/effect-engine.ts`、`src/engine/core/dev-log.ts` | 提交、依赖注入、效果与错误记录 |
| 测试 | `tests/engine/milestone-runtime.test.ts` | 完成、效果、读档运行路径 |

## Context Budget

目标约 12k–22k tokens；只看上述机制相关符号，超出 2 个额外文件或 60k tokens 时停止上报。

## Optional Read Set

- `tests/engine/milestone-adapter.test.ts`，仅在确认原 Adapter 构造调用兼容时读取。

## Do Not Read by Default

- UI、编辑器、其他 Effect 生产方、历史计划和所有数据包内容。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Adapter 当前仅提交完成事实并撤出，无 `then` | `src/arona-clicker/services/milestone-adapter.ts:attemptCompletion` | 增加成功提交后的效果 |
| Runtime 已装配 EffectEngine 与 DevLog | `src/arona-clicker/runtime-wiring.ts:119-141,234,288-290` | 注入现有实例 |
| 完成写入幂等，返回 boolean | `src/arona-clicker/state/state-mutation-service.ts:119-127` | 只在 true 时结算 |
| Registry 已拒绝未知、no-op、声明类与 Story 专用旅行 op | U02 Receipt | 本 Unit 不重校验 op |

## Constraints

- 先由 `completeMilestone` 记录完成，撤出本目标 Watch，再调用 Listener `then` 的现有 EffectEngine；只在 `committed === true` 且有关联 Listener 时调用。
- 运行中同步事件重入不得让同一 Milestone 效果执行两次；已完成 ID 在读档、返回 Init 或定义更新后不补发。
- 捕获效果执行抛出的异常，以含 Listener/Milestone ID 的 DevLog error 记录并吞掉异常，使完成事实保持。EffectEngine 的 void 接口无法报告未抛错的业务拒绝，本 Unit 不声称检测它们。
- 现有旧 Milestone 无 Listener 时保持仅提交事实的行为；不新增效果账本。

## Allowed Files

- `src/arona-clicker/services/milestone-adapter.ts`
- `src/arona-clicker/runtime-wiring.ts`
- `tests/engine/milestone-runtime.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u06-receipt.md`

## Explicit Non-goals

- 不改 Registry op 验证、Milestone Domain、Stats、EffectEngine、StateMutationService、UI、示范包或存档结构。
- 不建立失败重试／补发、成就领奖、完整事务或新的 GameEvent。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若现有 Adapter 无法以白名单内改动保证完成先记账和不重放，停止上报。

## Completion Criteria

- [ ] 关联 Listener 首次完成可执行 `addResource` 效果一次；旧 Milestone 无效果。
- [ ] 效果抛异常时完成仍保存，DevLog 带目标 ID，返回/读档不补发；定义更新不重放。
- [ ] 同步重入不会双发，Receipt 记录实际验证与限制。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/milestone-runtime.test.ts tests/engine/milestone-adapter.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
