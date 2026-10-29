# Receipt 0322-U10

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 重写 `story-service.ts` 为 owner-session 编排；新增 `story-node-session.ts` 负责 Player 生命周期、投影和正文序号；更新 `contracts/runtime/results.ts` 增加 delivery/input、稳定候选与票据字段；退役旧 `story-flow.ts`、`story-interaction.ts` 页面解释器 |
| 未完成内容 | 无 |
| 范围外变更 | Entry/replay/reward细则、save codec和 UI 适配分别由相邻 Units/组合根处理 |
| GALHCG 影响闭环 | 随 Task 0322 工作节点收尾统一复核；本 Unit 未改图或刷新 |

## 行为边界

- 每个 global/chat owner 持有独立 `StoryNodePlayer`；source 保留来源 Entry 与 owner，StoryView 只投影当前新节点，不执行动作或抽随机。
- Talklet delivery ack 与 Click input 是独立票据等待点；`press=N` 恰好要求 N 次输入，choice 通过稳定 optionId 提交。
- 正常完成、替换、失败、取消都以 session close guard 保证只收尾一次；完成先移除当前 session，再进入结算/同步事件。替换时新 session 先发布，避免 close listener 同步开局时被旧 run 覆盖。
- Operation-only 链可直接返回 `finished`，不会伪造等待中的页面。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/story-node-player.test.ts tests/engine/story-node-playback.integration.test.ts --silent` | 通过 | 2 个文件、12/12 |
| Story 回归集 | 本次施工复核的18个 Story/Flow/Trigger/存读档文件 | 通过 | 121/121；完整命令见 U49 receipt |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无诊断 |
| 差异检查 | `git diff --check` | 通过 | 无空白错误 |

## 事实更新建议

- StoryService 的 StoryView 是纯 display DTO；推进严格按当前 delivery/input token 接受，不再由旧页字段隐式解释 StoryDef。
