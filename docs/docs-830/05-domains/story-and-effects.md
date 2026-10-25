# docs-830/05-domains/story-and-effects — 剧情与效果

本文回答：剧情如何推进，以及剧情动作如何连接到游戏机制。

## 剧情推进

`StoryService` 按故事拥有者维护活动会话。UI 提交继续、选择或点击命令后，服务检查当前节点状态与可用选项，再推进节点并记录阅读进度。剧情定义由 Registry 提供；服务将运行中的剧情状态投影为查询视图。

启动时，Service 根据 StoryEntry 找到目标 StoryDef，验证结构、入口类型、Init 范围、触发条件和完成状态，再创建带 owner/runId 的会话。推进命令携带当前节点 token，防止界面提交已过期的输入；选择会在提交时再次检查选项条件。交付节点确认后记录已读进度，输入节点则由 `StoryNodePlayer` 执行动作并推进到下一节点。

```text
StoryEntry / StoryDef → StoryService 会话 → Controller 命令推进
                                      → StoryView / UI
```

## 效果协作

剧情节点或奖励可以请求执行 Effects。`EffectEngine` 处理通用效果；Runtime wiring 将需要领域处理的效果转成事件，订阅的领域服务再执行主题、表现或剧情等响应。状态变更仍由相应状态写入服务提交。

分支提交前会校验转移目标和动作能否解析，再消费输入 token 并执行动作；无效跳转或非法动作不会留下半执行结果。EffectEngine 中可直接写状态的效果走状态写入接口；主题、实体表现和聊天演出等会被 Runtime 接线为事件，再由专属服务处理。

```text
剧情动作 → EffectEngine → 状态写入或 Runtime 事件 → 领域响应 → 新视图
```

源码入口：`src/arona-clicker/services/story/story-service.ts`、`story-node-player.ts`、`story-node-action-host.ts`、`src/engine/effect/effect-engine.ts`、`src/arona-clicker/runtime/runtime-wiring.ts`。

相关测试见 `tests/engine/story-service-node.integration.test.ts`。

状态与事件边界见 [[docs/docs-830/02-data-and-state/state-and-events]]；UI 查询见 [[docs/docs-830/04-presentation/read-model-and-ui]]。
