# 06-wiki/30-arona-clicker-domain/story-and-chat — 剧情、聊天与阅读进度

本文概括剧情演出服务与聊天流桥接的当前职责，并区分持久进度和运行时游标。

StoryService 协调剧情启动、推进、发送、跳转、奖励、重读守卫和被动剧情池等流程。它持有全局剧情游标，也按角色 owner 持有聊天沙盒游标；游标由 Save/Init 快照 context 管理，和 PlayerState 中已完成记录、已读日志不是同一数据。

`ChatFlowService` 是表现桥接：它发出清空聊天流、显示/清除演出文本和开幕标题等事件，本身不写 PlayerState。聊天已读标记、被动冷却、学生阻断等运行进度则经领域 mutation 更新。UI 订阅事件并负责呈现。

## 好感台阶与羁绊尾巴

`PassiveStoryEntry.affectionRequired` 与 `pushAfterStory` 条目不参加普通被动剧情的随机抽取，而由角色 owner 的就绪队列投递。好感台阶要求达到门槛且剧情尚未读过，按门槛升序选择，并列时保持 Registry 声明顺序；关联剧情已完成的羁绊尾巴排在台阶之前。owner 空间、阻断、Init、条件与冷却等门槛仍会过滤队列项目。对应实现位于 `src/arona-clicker/services/story-flow.ts`，回归覆盖见 `tests/engine/affection-system.test.ts`。

## Gear 装备导航

角色差分可声明三个装备槽及各槽 Gear 类型线。`GearSystem` 从 Registry 和 PlayerState 生成只读槽视图、消耗预览与当前 tier 的效果声明；装配、投喂经验和升 tier 由 `StateMutationService` 写入。联系人面板消费 `viewOf()`。`effectsOf()` 会计算效果声明，但当前 `src/` 未发现将它接入派生数值消费的调用点，因此不能据此声称 Gear 已影响生产。代码与测试入口：`src/arona-clicker/services/gear-system.ts`、`src/arona-clicker/state/state-mutation-service.ts`、`src/ui/components/contacts.ts`、`tests/engine/gear-system.test.ts`。

代码入口：`src/arona-clicker/services/story-service.ts`、`story-flow.ts`、`story-rewards.ts`、`chat-flow-service.ts`、`story-cursor-state.ts`。剧情效果与奖励的机制文档将在对应专题完成后从 docs-829 导航；本页不复用旧库正文。
