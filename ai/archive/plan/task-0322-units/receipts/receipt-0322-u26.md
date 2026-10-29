# Receipt Task 0322-U26

| 项 | 内容 |
| --- | --- |
| 状态 | 完成；定向测试通过 |
| 实际修改 | `src/ui/presentation/chat-stream.ts` 在恢复流状态时重建 run 到 stream 的索引，使 `endRun` 可以取消恢复后的门控定时器；新增通知路由回归测试覆盖owner旅行/奖励以及全局回退路径 |
| 未完成内容 | 无 |
| 范围外变更 | 未改Controller业务断言或通知次序；controller owner路由由并行改动提供，本Unit以行为测试核实 |
| GALHCG影响闭环 | 合并到Task收尾复核；未改图、刷新或写freshness |

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| Owner通知路由 | `npx vitest run tests/ui/story-node-notice-routing.test.ts` | 通过 | 4项；旅行按owner/global/legacy流分发，奖励不被其他owner剧情阻塞，保存前全局奖励仍入全局流 |
| 恢复Run清理 | 同上 | 通过 | 重建的聊天run结束后能取消恢复的门控定时器 |
| 定向差异检查 | `git diff --check` | 待Task收尾复核 | 与全Task检查统一执行 |
| 文档检查 | `npm run check:docs` | 待Task收尾复核 | 由主Agent合并检查 |

## 需上游确认项

- 无。
