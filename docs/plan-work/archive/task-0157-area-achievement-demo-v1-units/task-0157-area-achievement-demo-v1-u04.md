# Unit 0157-U04：Area 到访后即时对账

## Goal

玩家旅行进入 Area 后立即重算关联 Milestone Watch；同时以运行时测试证明默认 Area、返回与读档路径使用正确的到访事实。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/02-modules/world.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 生命周期与 Unit 纪律 |
| 计划 | `docs/plan-work/task-0157-area-achievement-demo-v1.md`、本 Unit、U03 Receipt | 门槛已完成，缺即时入口 |
| 源码 | `src/arona-clicker/services/init-service.ts` 的 `enterInit/travelToArea/reconcileInformationRevealWatches`、`src/arona-clicker/services/milestone-domain.ts`、`src/arona-clicker/services/milestone-adapter.ts` | 到访顺序与期望对账 |
| 测试 | `tests/engine/milestone-runtime.test.ts` | 玩家运行路径 |

## Context Budget

目标约 10k–20k tokens；只看生命周期相关片段，超出 2 个额外文件或 60k tokens 时停下上报。

## Optional Read Set

- `src/arona-clicker/runtime-save.ts`，仅在确认读档重建入口时读取。
- `src/data/test-datapack.ts`，仅在确认测试基础世界的可旅行 Area 时读取。

## Do Not Read by Default

- UI、编辑器、效果执行、统计、历史计划和其他机制测试。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Init 进入时默认 Area 到访写入后已有 `reconcileInformationRevealWatches()` | `src/arona-clicker/services/init-service.ts:237-243,269-275` | 默认路径主要需测试 |
| 旅行时先写 `visitedAreas`，再发 `areaEntered`，目前没有后续 Milestone reconcile | `src/arona-clicker/services/init-service.ts:345-360` | 需接即时入口 |
| U03 Domain 已按当前 Init 与 Area 到访门控 | U03 Receipt、`src/arona-clicker/services/milestone-domain.ts` | 不重做门槛 |

## Constraints

- 旅行路径在到访和 Area 进入效果就绪后调用现有 Milestone reconcile；调用一次，不新增 `firstEntered` GameEvent 字段。
- 默认 Area 依赖现有 Init 完成后的 reconcile；保持旧 Reveal、Trigger、StoryFollowUp 顺序与行为。
- 不增加持久状态；读档与返回只按现有到访事实重建。

## Allowed Files

- `src/arona-clicker/services/init-service.ts`
- `tests/engine/milestone-runtime.test.ts`
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u04-receipt.md`

## Explicit Non-goals

- 不实现 `stat` 唤醒、Listener `then`、Achievement UI、示范包或编辑器。
- 不改 EventBus payload、到访存档结构、Domain 过滤和普通 Trigger 的业务语义。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若必须修改 Runtime 装配或事件目录才能及时对账，停下报告。

## Completion Criteria

- [ ] 默认 Area 在进入 Init 后可被准入；其他 Area 在首访前无 Watch，旅行进入后即时挂 Watch 或追赶完成。
- [ ] 离开当前 Init 时撤出关联 Watch，返回或读档后按到访历史重建；完成事实不重复提交。
- [ ] 旧 Milestone 与 StoryFollowUp 相关运行路径不受影响；Receipt 记录实测范围。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/milestone-runtime.test.ts tests/engine/milestone-adapter.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
