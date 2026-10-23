# 06-wiki/30-arona-clicker-domain/story-and-chat — 剧情、聊天与阅读进度

本文概括剧情演出服务与聊天流桥接的当前职责，并区分持久进度和运行时游标。

这里有三个容易混淆的词：`StoryEntry` 是“剧情何时/如何出现”的入口声明；`StoryDef` 是由 `nodes` 和 `stages` 组成的演出声明；EventBus 的事件是运行时系统之间传递的消息。读剧情时通常从 Entry 找到 StoryDef，再由 StoryService 推进它。

StoryService 协调剧情启动、推进、发送、跳转、奖励、重读守卫和被动剧情池等流程。它持有全局剧情游标，也按角色 owner 持有聊天沙盒游标；游标由 Save/Init 快照 context 管理，和 PlayerState 中已完成记录、已读日志不是同一数据。

`ChatFlowService` 是表现桥接：它发出清空聊天流、显示/清除演出文本和开幕标题等事件，本身不写 PlayerState。聊天已读标记、被动冷却、学生阻断等运行进度则经领域 mutation 更新。UI 订阅事件并负责呈现。

通常的入口判定会检查当前 Init、触发条件、owner 游标是否被其他剧情占用以及完成状态。`StoryService` 提供启动、推进与聊天按钮命令；`StoryNodePlayer` 按 `StoryDef.nodes/stages` 驱动当前节点，StoryService 负责入口选择、奖励与会话生命周期。已完成 Story 与页阅读记录是 PlayerState 状态；当前演出游标是 owner 隔离的 Runtime 执行位置，通过 `engine/contracts/story-cursor.ts` 快照保存。

当前 Init 的 `StoryFollowUp` 若指向 ActiveStoryEntry，来源故事完成后仍等待未来匹配的 `areaEntered`；到达目标 Area 时仅创建 `areaStoryDeliveries`，不自动开播，也不追补来源已完成时玩家已经所在 Area 的旧进入事件。故事目录中只有可用条件来源的 9 个 ActiveStoryEntry，在首次满足 `availableInits` 与 `triggerCondition` 时投递到当时所在 Area。玩家进入 AreaHero Workspace 后通过正式 Story 命令手动接取，命令重新检查 Area、投递、Entry、条件和对应 owner 游标；失败保留投递，成功仍保留记录直至完成。FollowUp once 标记表示触发已消费，不替代投递记录。指向 PassiveStoryEntry 的 FollowUp 和通用 `triggerStory` 维持原直接启动语义。故事页仅呈现已完成的历史条目，不再提供未读故事的首次启动入口。

正式完成时 StoryService 先移除原会话，再把来源 `entryId` 交给完成 mutation，精确标记该 Entry 的区域投递；重播不会完成或清除投递。`storyLog` 的完成身份仍是 StoryDef ID，因此共用 StoryDef 的 Entry 仍共享现有完成准入语义。回归入口见 `tests/engine/passive-pool.test.ts` 与 `tests/ui/workspace-lifecycle.test.ts`。

聊天历史由 UI 保存，已送达的剧情消息带 `storyPageKey`（逻辑 historyId、Entry、实际 StoryDef、nodeId、waitSequence）；读档恢复历史时，`ChatStream.restoreHistoryState()` 对当前游标复原去重状态和消息 ID 计数，避免再追加最近一句话。未送达的 typing 条目不入档，恢复后仍正常投递；已送达的连发页继续原有节奏链。文本相同的不同页面仍分别显示。相关回归入口：`tests/ui/story-history-resume.test.ts`。

## 节点如何配合

正式内容只解释 `StoryDef.nodes/stages`，生产43篇均已替换。旧 `talklets`、混合Effect页解释器与 `.scene()` 作者工厂已退役；`Talklet` 类型仅作为 UI 显示投影，不执行效果。独立 Story 编辑工具尚未实现。

四类 StoryNode 的完整字段、结构约束、等待与提交、Action / Presentation Host、保存恢复及 StoryService 调用链见 [[docs/docs-829/04-mechanisms/arona-clicker/story-node-playback]]。本页保留 Entry、聊天历史、投递及剧情归属关系概览；机制页展开节点和播放引擎。

| 节点 | 做什么 | 与其他节点的关系 |
| --- | --- | --- |
| Talklet | 正文、旁白、图片、头像和显示节奏 | UI 送达后确认当前 token，随后才进入下一节点；自己不承载选择和效果 |
| Click | 等待按钮、多击、选项或入口卡片 | 可以紧跟一个或多个正文；按钮回复由显式 reply 声明，选择采用稳定 optionId |
| Operation | 状态批次、移动、表现、覆盖文本或入口请求 | 自动执行；状态动作仍经正式 Mutation/Effect 服务，不能借任意 Effect 字段扩展执行能力 |
| Transfer | goto 或 insert | goto 舍弃当前剩余节点；insert 保存稳定返回节点ID，子剧情结束再返回 |

同一阶段可放多个正文及一个输入；阶段声明 auto/input 描述作者意图，实际执行仍按节点顺序和等待点。正文用 `advanceStory` 确认送达，按钮用 `clickSend`，选择用 `advanceStory(optionId)`。旧内容的“点击N次再确认”拆成 press.base/rand 的工作 Click 与另一个确认 Click；新作者的工作 Click 本身恰好在第N次提交后离开，不暗增一次确认。选择的共同行为在 sharedActions，选项独有行为和转移在各自 result；没有选中的选项不执行。

运行票据随等待点和读档变化，过期 DOM/定时器提交不能推进新节点。`pageIndex/totalPages` 是显示投影索引，不可用作保存执行位置，也不等于旧 Talklet 页码。阅读日志仍用正文序号，完成日志仍按终端 StoryDef 记账。

## 演出归属与恢复

每个 owner 有独立运行会话；null 表示全局。来源 runId 绑定覆盖文本、标题、临时主题和 story 生命周期实体表现，替换、取消、失败或完成都关闭对应运行。`storyRunEnded` 只清理对应 owner/run 的演出和定时器，保留正文历史及其他会话。UI 当前选择的通讯录不改变后台事件的目的地，奖励/移动通知也按来源 owner 入流。area/student/manual/init 等持久表现继续沿既有作用域政策处理。

完成准入、被动冷却、阻断与区域交付采用根 Entry；奖励首次/重复与完成日志采用终端 StoryDef。会话在结算事件前移除，因此事件同步启动的后续剧情不会被旧完成流程覆盖。重读保留分支阅读守卫，不重复发完成奖励、写完成日志或更新被动冷却/阻断；显式节点动作按已有重读政策执行。

正式存档版本为 `2.0.0`。`storyPlayback` 保存全局及聊天会话的节点ID、返回栈、visited、等待序号、多击结果与结算元数据；UI 历史另存。恢复生成新 runId/token，保留逻辑 historyId，既避免旧操作生效，也避免同一句正文再次入流。临时主题、story 实体表现和覆盖文本用表现快照恢复，不重播 Operation。旧格式明确拒绝，程序不主动删除磁盘上的旧存档。

源码入口：`story-node-player.ts`、`story-node-session.ts`、`story-node-action-host.ts`、`story-node-presentation-host.ts`、`runtime-save.ts` 与 `ui/presentation/chat-stream.ts`。行为回归包括 `tests/engine/story-node-player.snapshot.test.ts`、`tests/engine/story-service-node.integration.test.ts`、`tests/engine/story-node-save.integration.test.ts`、`tests/ui/story-node-delivery.test.ts`、`tests/ui/story-node-card-routing.test.ts` 和 `tests/ui/story-history-resume.test.ts`。

## 好感台阶与羁绊尾巴

`PassiveStoryEntry.affectionRequired` 与 `pushAfterStory` 条目不参加普通被动剧情的随机抽取，而由角色 owner 的就绪队列投递。好感台阶要求达到门槛且剧情尚未读过，按门槛升序选择，并列时保持 Registry 声明顺序；关联剧情已完成的羁绊尾巴排在台阶之前。owner 空间、阻断、Init、条件与冷却等门槛仍会过滤队列项目。选择规则位于 `src/arona-clicker/services/story/story-entry-selection.ts`，回归覆盖见 `tests/engine/affection-system.test.ts`。

## Gear 装备导航

角色差分可声明三个装备槽及各槽 Gear 类型线。`GearSystem` 从 Registry 和 PlayerState 生成只读槽视图、消耗预览与当前 tier 的效果声明；装配、投喂经验和升 tier 由 `StateMutationService` 写入。联系人面板消费 `viewOf()`。`effectsOf()` 会计算效果声明，但当前 `src/` 未发现将它接入派生数值消费的调用点，因此不能据此声称 Gear 已影响生产。代码与测试入口：`src/arona-clicker/services/progression/gear-system.ts`、`src/arona-clicker/state/state-mutation-service.ts`、`src/ui/components/character/contacts.ts`、`tests/engine/gear-system.test.ts`。

代码入口：`src/arona-clicker/services/story/story-service.ts`、`story-node-player.ts`、`story-entry-selection.ts`、`story-rewards.ts`、`chat-flow-service.ts`、`src/engine/contracts/story-cursor.ts`。剧情效果与奖励的机制文档将在对应专题完成后从 docs-829 导航；本页不复用旧库正文。

## 从哪里核对

- `src/arona-clicker/services/story/story-service.ts` 与 `story-node-player.ts`：`startStory()`、`advanceStory()`、`clickSend()`、节点执行及游标捕获/恢复。
- `src/arona-clicker/services/story/chat-flow-service.ts`：`clearAll()`、`showText()`、`clearId()`、`showOpeningTitle()` 只发送演出事件，不直接改玩家进度。
- `tests/engine/story-flow.test.ts` 覆盖 click 页推进门槛、insert / goto 跳转和选项确认；`tests/engine/story-entry-split.test.ts` 覆盖从 Entry 消费奖励和阅读日志；`tests/engine/init-global-lifecycle.test.ts` 覆盖 Story 游标随 Init 快照恢复。
- `tests/engine/chat-flow-service.test.ts` 验证表现事件被发出且 PlayerState 不变；Affection 台阶和尾巴队列另见 `tests/engine/affection-system.test.ts`。
- 当前机制入口：[[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]、[[docs/docs-829/03-data-structures/player-state]]。剧情/聊天定义入口见 [[docs/docs-829/03-data-structures/datapack-contracts]]。
