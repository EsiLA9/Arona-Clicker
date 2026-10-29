# Receipt 0322-U49

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 迁移 `tests/engine/story-entry-split.test.ts`、`tests/engine/chat-flow-service.test.ts`、`tests/engine/trigger-system.test.ts`；Trigger 测试改用已迁移的 `finishWelcome`，消除只等待 advanceable 而卡在显式 Click 上的无限同步循环 |
| 未完成内容 | 无 |
| 范围外变更 | 本 Unit 只迁移测试操作；共享 `story-test-fixtures.ts` 的 token-aware `finishStory` / `finishWelcome` 在 U46 完成 |
| GALHCG 影响闭环 | 随 Task 0322 工作节点收尾统一复核；本 Unit 未改图或刷新 |

## 行为边界

- Entry split 继续覆盖正文 ordinal 与 read-log；只在真实 Talklet delivery ack 后记阅读。
- ChatFlow 将正文和演出 Operation 作为独立节点确认，保留同步事件顺序、完成和重读断言。
- Trigger 测试推进 tokenized StoryView，并显式处理 Click；不再通过“只要 advanceable 就同步 advance”的循环假设所有页都可推进。
- 相关 StoryService 回归也验证了条件奖励以结算 run 的 visited 集合求值，以及 owner session 在完成事件/同步重入前先移除。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/story-entry-split.test.ts tests/engine/chat-flow-service.test.ts tests/engine/trigger-system.test.ts --silent` | 通过 | 3 个文件、45/45 |
| Story 全回归集 | 本次复核的18个 Story/Flow/Trigger/存读档测试文件 | 通过 | 121/121 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无诊断 |
| 差异检查 | `git diff --check` | 通过 | 无空白错误 |

## 事实更新建议

- 测试 helper 必须区分 Talklet delivery ack 与 Click 输入；触发器收尾不能假设 advanceStory 可消费任意等待阶段。
