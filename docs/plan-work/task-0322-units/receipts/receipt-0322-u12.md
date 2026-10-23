# Receipt 0322-U12

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | `story-service.ts` / `story-rewards.ts` 实现完成编排、Entry 奖励与被动尾处理；`engine/contracts/story-cursor.ts` 保存 StoryNodePlayback 与 replay、flags、choice 元数据；删除旧 `story-context.ts`、`story-cursor-state.ts` 游标/结算共享结构 |
| 未完成内容 | 无 |
| 范围外变更 | 无旧页 save migration/fallback；GameInstance 调用顺序由组合根处理 |
| GALHCG 影响闭环 | 随 Task 0322 工作节点收尾统一复核；本 Unit 未改图或刷新 |

## 行为边界

- 每个 owner 独立保存播放等待点、replay、flags 与最近一次 Choice 元数据；`lastChoiceStoryId` 保留候选索引的文档归属，使 insert/save/load 后回到根文档仍能恢复 choiceIndex。缺字段或不一致元数据按新 schema 拒绝。
- 奖励策略与被动 cooldown/block 取自来源 Entry；完成 storyLog 与 completed/rewarded 事件指向 terminal Story。Replay 完成不发奖励、日志、cooldown、block 或 `storyCompleted`。
- `visitedStoryInChain` 奖励使用当前待结算 session 的 visited 集合。Session 先从 owner map 移除，再调用 presentation close、奖励、完成日志和事件；同步 listener 可安全启动新 run，不会被旧会话覆盖。
- Restore 只还原 Player checkpoint/表现快照，不执行 operation 或重播 read-log；旧页格式无兼容回退。当前正式恢复路径先对整个 owner collection 做纯预检，再替换活动游标。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 结算与存档回归 | `npx vitest run tests/engine/story-node-player.snapshot.test.ts tests/engine/story-rewards.test.ts tests/engine/story-service-node.integration.test.ts tests/engine/story-node-save.integration.test.ts tests/engine/story-cursor-preflight.integration.test.ts --silent` | 通过 | 5 个文件、15/15；覆盖 visitedStoryInChain 奖励、替换重入、双 owner 保存恢复、Choice→insert→恢复后 choiceIndex 和无副作用预检 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无诊断 |
| 差异检查 | `git diff --check` | 通过 | 无空白错误 |

## 事实更新建议

- `StoryCursorSnapshot` 只保存新 StoryNode 播放格式及其稳定完成元数据；结算成功后 owner cursor 已移除，因而同步 follow-up 不会误操作结束 run。
