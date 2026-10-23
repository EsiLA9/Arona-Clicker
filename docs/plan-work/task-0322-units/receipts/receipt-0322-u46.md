# Receipt 0322-U46

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `tests/engine/init-global-lifecycle.test.ts`、`tests/engine/story-test-fixtures.ts`、`docs/plan-work/task-0322-units/task-0322-u46.md`、本 Receipt |
| 未完成内容 | 无 |
| 范围外变更 | 无；StoryService reward-chain 修复在原服务切换 Unit 范围内单独验证 |
| GALHCG 影响闭环 | 与 Task 0322 工作节点收尾统一复核；本 Unit 只迁移已有测试辅助与快照断言，未改图或刷新 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/init-global-lifecycle.test.ts --silent` | 通过 | 9/9；覆盖 Init 保存与恢复、insert 栈 |
| 共享夹具行为验证 | `npx vitest run tests/engine/story-rewards.test.ts --silent` | 通过 | 3/3；确认共享推进器能逐节点完成选择与 Click，且条件奖励结算通过 |
| 类型检查 | `npx tsc --noEmit` | 失败 | 无本 Unit 文件错误；当前其余错误限于 `tests/data/migrate-story-content.test.ts` 的 `.mjs` 声明与隐式 `any` |
| 人工验收 | 检查测试断言与新 StoryCursorSnapshot 结构 | 通过 | 当前游标由 `playback.run.source.entryId` 表示，insert 帧用 `nextNodeId` 表示 |
| GALHCG | 延后到 Task 收尾统一复核 | 未执行 | 按 Task 工作节点集中维护约定 |

## 遇到问题

- 旧共享推进器只调用 `advanceStory()`，在 StoryNode `Click` 输入处停止；现在按投影的 phase/choices/token 选择推进命令。
- Init 测试原断言依赖 `currentStoryId/insertStack`；已改为新节点快照字段。

## 需上游确认项

- 无。

## 事实更新建议

- 无。
