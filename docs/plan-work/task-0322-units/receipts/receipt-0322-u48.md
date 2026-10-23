# Receipt 0322-U48

| 项 | 内容 |
| --- | --- |
| 状态 | 完成 |
| 实际修改 | 迁移 `tests/engine/story-flow.test.ts` 与 `tests/engine/story-replay.test.ts`；生产源码和共享夹具未在本 Unit 修改 |
| 未完成内容 | 无 |
| 范围外变更 | 无 |
| GALHCG 影响闭环 | 随 Task 0322 工作节点收尾统一复核；本 Unit 未改图或刷新 |

## 行为边界

- Flow 测试逐条确认 Talklet delivery、独立 Click input，并使用当前 node token；保留 ClickRequired、press=N 输入次数、insert 回栈与 goto 完成门控。
- Replay 测试通过稳定 optionId 走候选；继续断言 replay branch guard、真实 read-log 与 replay 不结算。
- 测试从旧 Talklet 页执行循环迁移到新 StoryNode wait point，不删减真实行为断言，也不在本 Unit 改生产行为。

## 测试与验证结果

| 项 | 命令 / 方式 | 结果 | 备注 |
| --- | --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/story-flow.test.ts tests/engine/story-replay.test.ts --silent` | 通过 | 2 个文件、11/11 |
| 类型检查 | `npx tsc --noEmit` | 通过 | 无诊断 |
| 差异检查 | `git diff --check` | 通过 | 无空白错误 |

## 事实更新建议

- 流程回归应沿显式 delivery/input 阶段推进；press 完成不会再暗含额外确认。
