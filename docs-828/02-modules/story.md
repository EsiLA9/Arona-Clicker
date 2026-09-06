# 02-modules/story — 剧情演出 / 聊天流 / 被动闲聊

> 一句话：剧情 = 「触发入口（StoryEntry）→ 演出内容（StoryDef.talklets）」两实体；`StoryService` 持游标，主流程/跳转/重读/奖励各拆一模块。

## 职责边界

- **管**：剧情启动/推进/选择/跳转链/重读守卫/完结奖励、聊天流演出事件、被动闲聊抽选、好感台阶/羁绊尾巴的就绪队列推送（见 [[0x-plan&work/completed/affection-planning]]）。
- **不管**：色彩演出层推送（由 ColorSystem 响应）。

## 关键文件（`src/arona-clicker/services/`）

| 文件 | 职责 |
| --- | --- |
| `story-service.ts` | 门面：游标持有 + 流程编排（委托下面各模块）；`startStory`（force 抢占被动闲聊）/ 沙盒游标（`variant:<owner>` 对话空间） |
| `story-flow.ts` | 主流程：start / advance / clickSend / 被动闲聊触发 |
| `story-jump.ts` | 跳转链：`goto`（完全转移）/ `insert`（插入子剧情后返回）/ 返回栈；发 `storyRewarded` |
| `story-replay.ts` | 重读 / 分歧守卫（`BranchGuard` 按 id 查阅读记录） |
| `story-rewards.ts` | 完结奖励结算（`simple` / `conditional` 两种策略） |
| `story-cursor-state.ts` | 剧情游标 / 聊天沙盒游标状态结构 |
| `story-context.ts` | 剧情上下文（当前 entry/talklet/跳转链视图） |
| `chat-flow-service.ts` | `ChatFlowService`：聊天流演出事件出口（`chatTextShown` / `chatFlowCleared` 族，Talklet 专用，UI 订阅后操作聊天流） |
| `story-interaction.ts` | 被动闲聊挑选与交互页判定（纯函数） |
| `debug-labels.ts` | reveal/condition 调试标签 |

### 相关（`src/arona-clicker/services/`）

| 文件 | 职责 |
| --- | --- |
| `passive-pool-system.ts` | 被动闲聊池：子池递归解析（`PassivePoolChild` 真引用取完整内容）/ 差分并入常驻池 / gate 条件（发 `poolGateChanged`）/ owner 空间壁垒（字符串相等比较） |

## 核心概念

- **两实体分离**：`StoryEntryDef`（active/passive 分表：触发条件/奖励/可用性）与 `StoryDef`（talklets 演出内容）；`entry.storyId` 是真引用，当前约定 `entry.id === storyId`（1:1，解耦风险见 [[docs-828/03-data-structures/id-reference-semantics]]）。
- **Talklet 三类**：`talk`（对话气泡）/ `narration`（旁白）/ `click`（纯交互页）；`jumpMode`：goto / insert。
- **阅读记录双轨**：`storyLog`（当前 Init 的完成记录，按 StoryDef.id）与 `storyReadLogs`（当前 Init 的逐 Talklet 阅读记录，随 Init 快照保存）。
- **聊天沙盒**：每个角色差分一个对话空间（`owner` 意义引用），`storyCompleted` 按沙盒 owner 匹配。
- `StoryError` 14 种返回码见 `src/arona-clicker/contracts/results.ts`。

## 测试入口

`tests/engine/chat-flow-service.test.ts`、`passive-pool.test.ts`、`story*.test.ts`、`tests/ui/`（聊天流 UI）

## 相关文档

[[docs-828/03-data-structures/declarative-dsl]]（Talklet/Entry 枚举）· [[0x-plan&work/completed/affection-planning]]（好感数值/台阶推送/羁绊尾巴）
