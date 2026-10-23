# Receipt 0322-U50

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `story-service.ts` 保存、恢复与纯预检 Choice 来源 Story；`story-entry-selection.ts` 要求新快照字段；`story-cursor.ts` 增加必需的 `lastChoiceStoryId`；`story-cursor-preflight.integration.test.ts` 覆盖元数据拒绝及 insert 后保存恢复；更新本 Unit |
| 未完成内容 | 无 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 随 Task 0322 工作节点收尾统一复核；本 Unit 只变更新 cursor 合同、StoryService 与对应回归测试，未改图或刷新 |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/story-cursor-preflight.integration.test.ts tests/engine/story-service-node.integration.test.ts tests/engine/story-node-save.integration.test.ts tests/engine/story-rewards.test.ts --silent` | 通过 | 4 个文件、12/12；含根 Choice → insert 子 Story → 保存恢复 → 返回根完成并保留 `choiceIndex: 0` |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无诊断 |
| 差异检查 | `git diff --check -- docs/plan-work/task-0322-units/task-0322-u50.md docs/plan-work/task-0322-units/receipts/receipt-0322-u50.md src/engine/contracts/story-cursor.ts src/arona-clicker/services/story/story-entry-selection.ts src/arona-clicker/services/story/story-service.ts tests/engine/story-cursor-preflight.integration.test.ts` | 通过 | 无空白错误 |
| GALHCG | 延后到 Task 收尾统一复核 | 未执行 | 按工作节点集中维护约定 |

## 事实更新建议

- Story cursor 保存最近一次 Choice 的 `lastChoiceStoryId`，避免跨 `insert` 保存恢复后把原候选索引归到当前子 Story；预检还要求该 Story 已访问且候选索引确实存在。
