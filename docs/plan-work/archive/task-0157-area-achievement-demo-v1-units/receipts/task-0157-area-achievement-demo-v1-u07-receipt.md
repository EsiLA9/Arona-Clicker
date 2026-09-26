# Execution Receipt：Task 0157 U07

日期：2026-09-26

## 结果

- 新增纯只读 `buildAchievementView`，沿 Achievement → Listener → Milestone → Area 解析；任一关联定义缺失或 Area 未到访时不返回该项。
- 当前 Init 从 `PlayerState.visitedAreas` 判断发现；其他 Init 从 `initSnapshots[initId].visitedAreas` 回看。完成状态只读取 `milestoneProgress.completed`，已完成项仍展示。
- 结果仅含新建的数组、列表项与进度对象，以及 ID、文案和完成状态等值；不返回 Registry 定义、Condition、PlayerState 或统计对象引用。列表按当前 Area、当前 Init 其他 Area、其他 Init 排序。
- 只为单叶 `$InitProducedAmount` 与 `$InitCollectedAmount` 的数值 `>=`／`>` 条件提供进度。读取目标 Init 的 `produced`／`itemsCollected` 累计量；组合条件和其他条件不提供进度。
- 定向测试覆盖未访隐藏、跨 Init 快照回看、完成项、文案、两种累计统计、组合条件无进度、花费／使用后累计进度稳定、排序和不共享定义引用。

## 验证

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/engine/achievement-view.test.ts` | 通过；1 个文件、2 项测试通过 |
| `npx tsc --noEmit` | 通过；无输出 |
| `npm run check:docs` | 通过；errors: 0，scanned markdown: 319 |

## 限制

- 本 Unit 仅新增纯投影，不接入 GameReadModel、UI 或运行时刷新；由后续 Unit 决定消费接入。
