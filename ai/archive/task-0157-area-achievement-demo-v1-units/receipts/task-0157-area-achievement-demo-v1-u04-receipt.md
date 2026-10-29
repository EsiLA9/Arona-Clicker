# Execution Receipt：Task 0157 U04

日期：2026-09-26

## 结果

- `enterInit` 已在默认 Area 到访写入后调用现有 `reconcileInformationRevealWatches()`；该入口保持不变，未增加重复对账。
- `travelToArea` 现在在写入 Area 到访事实、发出 `areaEntered`、处理进入效果、刷新可见性并复检 Affector 后，调用一次 `milestoneAdapter.reconcileCurrent()`。没有新增持久状态或事件字段。
- Runtime 测试通过包含完整 `MilestoneListenerDef`（含 `id` 与 `then: []`）的 Datapack 并经 `Registry.load` 加载，覆盖默认 Area 准入；未到访 Area 不建立 Watch，旅行进入后按已满足条件追赶完成；未完成 Watch 在 Save restore 和 `resumeInit` 返回时重建，切换时撤出旧 Registration，后续完成只提交一次且读档不重复提交。
- Domain、效果、统计与 Reveal/Trigger/StoryFollowUp 行为未修改。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/milestone-runtime.test.ts tests/engine/milestone-adapter.test.ts` | 通过；2 个文件、10 项测试通过 |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 314 |

首次定向运行时，测试夹具的起始剧情阻止了普通旅行；用例改用现有 `allowDuringStory` 选项继续验证同一旅行实现。验收复核指出此前用例直接突变 Registry Map，当前夹具已改为在 `Registry.load` 中加载完整监听定义。首次复跑时监听 ID 的 typeName 段不符合实体 ID 校验要求，改为 `milestone-listener` 后最终验证通过。
