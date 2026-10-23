# Receipt 0322-U47

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `tests/engine/story-service-node.integration.test.ts`；修改 `src/arona-clicker/services/story/story-service.ts`；新增本 Unit 与 Receipt |
| 未完成内容 | 无 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 与 Task 0322 工作节点收尾统一复核；Unit 新增真实GameInstance测试并修正StoryService结算/替换边界，未改图或刷新 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/story-service-node.integration.test.ts --silent` | 通过 | 4/4；覆盖同 owner 即时替换、owner/token 隔离、首次/重复/replay 结算、保存恢复与演出快照 |
| 依赖回归 | `npx vitest run tests/engine/story-rewards.test.ts --silent` | 通过 | 3/3；确认 `visitedStoryInChain` 奖励在会话删除后仍按该 run 判断 |
| 类型检查 | `npx tsc --noEmit` | 失败 | 本 Unit 文件无类型错误；剩余两项在 `tests/data/migrate-story-content.test.ts`：`.mjs` 缺声明与回调参数隐式 `any` |
| 差异检查 | `git diff --check -- tests/engine/init-global-lifecycle.test.ts tests/engine/story-test-fixtures.ts tests/engine/story-service-node.integration.test.ts src/arona-clicker/services/story/story-service.ts docs/plan-work/task-0322-units/task-0322-u46.md docs/plan-work/task-0322-units/receipts/receipt-0322-u46.md docs/plan-work/task-0322-units/task-0322-u47.md` | 通过 | 仅有 shared fixture CRLF→LF 提示 |
| GALHCG | 延后到 Task 收尾统一复核 | 未执行 | 按 Task 工作节点集中维护约定 |

## 遇到问题

- Operation 启动同 owner 卡片后，目标可能在嵌套 `startEntry()` 中立即完成；此前来源 `startEntry()` 会丢失嵌套成功结果并返回 `NoActiveStory`。现把 replacement result 传回最初调用方。
- 完成奖励在移除 live cursor 后运行；若直接使用全局 `visitedStoryInChain` 查询器，查询不到刚完成 run 的 visited set。现使用代理其他 provider、但固定查询该 completed session visited set 的条件上下文。

## 需上游确认项

- 无。

## 事实更新建议

- StoryService 的 conditional reward 应以正在结算的 run 作为 `visitedStoryInChain` 域，即使 live cursor 在结算前已删除；已由本 Unit 集成测试覆盖。
