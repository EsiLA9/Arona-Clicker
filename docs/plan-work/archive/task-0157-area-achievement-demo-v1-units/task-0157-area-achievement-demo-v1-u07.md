# Unit 0157-U07：只读 Achievement 投影

## Goal

从 Registry、PlayerState 与统计快照派生玩家可见的 Area Achievement 列表，包括发现、完成、文案和首期简单数值进度。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | `AGENTS.md`、`docs/docs-828/00-INDEX.md`、`docs/docs-828/01-architecture/state-layers.md`、`docs/ai/PROJECT-CONSTITUTION.md` | 只读投影与状态层级 |
| 计划 | `docs/plan-work/task-0157-area-achievement-demo-v1.md`、本 Unit、U03/U05 Receipts | 首访和统计边界 |
| 源码 | `src/data-services/contracts/datapack.ts`、`src/data-services/registry/registry.ts`、`src/arona-clicker/types/state.ts`、`src/engine/contracts/stats.ts`、`src/engine/expression/stat-dsl.ts` | 定义、当前/快照到访和统计 |
| 测试 | `tests/engine/milestone-adapter.test.ts` 的关联样例 | 现有声明与条件形状 |

## Context Budget

目标约 12k–22k tokens；新投影只服务 G01 Area 成就，超出 2 个额外文件或 60k tokens 时停下上报。

## Optional Read Set

- `src/arona-clicker/state/init-savepoint.ts`，仅在离开 Init 的到访快照读取不清楚时读取。
- `src/engine/stats/stats.ts`，仅在统计快照键形状不清楚时读取。

## Do Not Read by Default

- UI、编辑器、Effect、历史计划、所有其他 Condition Presentation 方案。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Achievement → Listener → Milestone 与 Area 引用经 Registry 加载期验证 | U02 Receipt | 投影不写第二份完成账本 |
| 当前 Init 的 `visitedAreas` 与其他 Init 的 `initSnapshots[initId].visitedAreas` 可用于回看 | `src/arona-clicker/types/state.ts`、`state/init-savepoint.ts` | 不因离开 Init 隐藏已发现项 |
| 两种 Init 统计存于 `StatsSnapshot.init[initId]` | `src/engine/contracts/stats.ts` | 不新增 Area 统计桶 |

## Constraints

- 只返回关联定义仍存在且已到访 Area 的 Achievement；若已有 completed ID 也保留展示。未访问 Area 的目标不提前显示。Milestone 始终是内部数据，不以列表项直接暴露。
- 当前 Init 到访读当前状态；其他 Init 读 `initSnapshots`。完成读 `milestoneProgress.completed`，无独立 Achievement 完成状态。
- 仅对单叶 `$InitProducedAmount`／`$InitCollectedAmount` 数值 `>=`／`>` 条件给 `current`、`target`、`comparator`；组合条件只保留作者线索，不强算百分比。读取对应 Init 的统计，无 Area 产地限制。
- 结果使用新数组/对象，不让 UI 持有可写 PlayerState 或 Registry 引用。按当前 Area、当前 Init 其他 Area、其他 Init 的顺序输出。

## Allowed Files

- `src/arona-clicker/read-model/achievement-view.ts`（新增）
- `tests/engine/achievement-view.test.ts`（新增）
- `docs/plan-work/task-0157-area-achievement-demo-v1-units/receipts/task-0157-area-achievement-demo-v1-u07-receipt.md`

## Explicit Non-goals

- 不把投影接入 `GameReadModel`、UI 或事件刷新；下一 Unit 负责。
- 不扩 Init／全局目标、组合条件进度、奖励领取、Roadmap、存档字段或编辑器。

## Stop Conditions

按 [[docs/ai/PROJECT-CONSTITUTION]] 默认六条；若跨 Init 已发现回看必须依赖新增持久状态，停止并给出源码证据。

## Completion Criteria

- [ ] 未访 Area 不显示，首次到访后显示；离开 Init 后回看仍存在（定义存在时）。
- [ ] 完成事实、标题、线索、奖励说明和指定单叶统计进度正确；资源花费或物品使用后累计不倒退。
- [ ] 输出顺序优先当前 Area，结果只读且不泄露可写引用；Receipt 记录验证。

## Verification

| 项 | 命令 | 期望 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/achievement-view.test.ts` | 通过 |
| 类型 | `npx tsc --noEmit` | 无新增错误 |
| 文档 | `npm run check:docs` | 通过 |
