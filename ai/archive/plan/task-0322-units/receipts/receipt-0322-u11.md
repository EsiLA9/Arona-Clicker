# Receipt 0322-U11

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 新增 `story-entry-selection.ts` 承接 Entry 准入、被动选择/就绪队列和 branch guard；`story-service.ts` 接入 start/card/system、owner、passive、affection/tail、replay；退役旧 `story-replay.ts` 与 `story-jump.ts` |
| 未完成内容 | 无 |
| 范围外变更 | 未改 Entry schema、正式内容、UI 或 save codec |
| GALHCG 影响闭环 | 随 Task 0322 工作节点收尾统一复核；本 Unit 未改图或刷新 |

## 行为边界

- start 保留入口类型、Init/trigger/完成检查、force/card 规则；被动池、affection step 和 tail push 继续按 owner、冷却、阻断与已完成状态选择。
- replay 状态按 session 隔离；branch guard 只统计实际交付的 Talklet ordinal，Click 与 Operation 不增加正文序号，并使用当前播放链的 visited 集合。
- 当前正文 ack 先验证 token，再登记该正文的 read-log ordinal，之后才 ack Player。这样最终正文确认导致的同步 completion/replay guard 可以读到刚完成的真实正文记录；陈旧票据不会写阅读日志。
- View/getter 不写 read-log；未确认的正文不计为已读。缺少目标/准入拒绝保留原等待输入，不消费错误票据。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向行为回归 | `npx vitest run tests/engine/story-flow.test.ts tests/engine/story-replay.test.ts --silent` | 通过 | 2 个文件、11/11；涵盖 token 推进、Click 门控、insert/goto、真实阅读与守卫 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无诊断 |
| 差异检查 | `git diff --check` | 通过 | 无空白错误 |

## 事实更新建议

- replay branch guard 的 read-history ordinal 基于已 ack 的 Talklet，不再把交互节点或纯操作节点当作正文阅读。
