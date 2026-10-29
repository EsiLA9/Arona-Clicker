# docs-830/05-domains/story-and-effects — 剧情与效果

本文回答：剧情如何推进，以及剧情动作如何连接到游戏机制。

## 剧情推进

`StoryService` 按故事拥有者维护活动会话。UI 提交继续、选择或点击命令后，服务检查当前节点状态与可用选项，再推进节点并记录阅读进度。剧情定义由 Registry 提供；服务将运行中的剧情状态投影为查询视图。

启动时，Service 根据 StoryEntry 找到目标 StoryDef，验证结构、入口类型、Init 范围、触发条件和完成状态，再创建带 owner/runId 的会话。推进命令携带当前节点 token，防止界面提交已过期的输入；选择会在提交时再次检查选项条件。交付节点确认后记录已读进度，输入节点则由 `StoryNodePlayer` 执行动作并推进到下一节点。

```text
StoryEntry / StoryDef → StoryService 会话 → Controller 命令推进
                                      → StoryView / UI
```

## 本次 Entry 的局部标记

`StoryNodePlayer` 为每次启动创建独立 `Map<name, value>`。`startActiveStory(entryId, owner, initialFlags)`、`startCardStory(...)` 与对应 GameCommands 可投入初始 JSON 字典；底层 Player 的 start 第三个参数同样接收字典。`StoryService.startStory` 的 options.initialFlags 可供其他类型的入口调用。启动先验证并复制，坏参数不会替换当前会话。name 需要非空，推荐 `StoryName-flagid`，不限制前缀；值为有限 JSON 数据，不提供值比较。

所有四类 StoryNode 都可声明一个 `requiresFlag?: string`。到达时用 Map.has 检查，false、0、空字符串、null 都表示键存在；未声明则正常执行。缺键时直接跳过整个节点：正文不投递，Click 不等待、不取随机也不触发回复/结果，Operation 不执行，Transfer 不跳转。跳过不改变作者 stages，不补 Click，全部跳过可以自然结束；同步自动步数保护仍生效。已经接受的等待点不会在查询或恢复时重复判断。

局部写入使用 StoryAction `{ kind: 'localFlag', op: 'set', name, value }`，同名覆盖；移除使用 `{ kind: 'localFlag', op: 'remove', name }`，不存在时无操作。可用于 Operation、Click 共享动作或结果动作；保持作者顺序，由播放器直接处理，不调用 EffectEngine。goto/insert 沿用同一张表；启动另一 Entry、另一个 owner 或重新开始时不自动继承。

本次表随播放等待点的 `run.localFlags` 保存恢复，结束、取消、替换或失败后不供后续 Run 使用。它与 `PlayerState.flags` 的持久 setFlag，以及 `session.flags` 的“本次执行过哪些持久 setFlag”名称记录相互独立。局部标记不会写入这两处，条件系统的普通 flag 目标也不读取局部表。快照必须包含有效 localFlags；不为旧的活动会话快照补默认值或编写迁移。

验证入口：`tests/engine/story-run-flags.test.ts`、`story-run-flags.integration.test.ts`。编辑器配置与草稿边界见 [[runtime-editor-and-project-checks]]。

## 效果协作

剧情节点或奖励可以请求执行 Effects。`EffectEngine` 处理通用效果；Runtime wiring 将需要领域处理的效果转成事件，订阅的领域服务再执行主题、表现或剧情等响应。状态变更仍由相应状态写入服务提交。

分支提交前会校验转移目标和动作能否解析，再消费输入 token 并执行动作；无效跳转或非法动作不会留下半执行结果。EffectEngine 中可直接写状态的效果走状态写入接口；主题、实体表现和聊天演出等会被 Runtime 接线为事件，再由专属服务处理。

## 剧情目录与运行会话

剧情导航目录 `StoryContentTable` 以分类、篇章、章节和条目组织导航，并保存当前活动的 `activeStoryEntryId`；它提供 UI 排序与分层浏览所需的内容结构。实际可启动的 StoryEntry、StoryDef、触发条件与会话游标由 Registry 和 `StoryService` 管理。目录如何展示某剧情，与剧情本身是否可触发、能否推进是两件事。

```text
剧情动作 → EffectEngine → 状态写入或 Runtime 事件 → 领域响应 → 新视图
```

源码入口：`src/arona-clicker/services/story/story-service.ts`、`story-node-player.ts`、`story-node-action-host.ts`、`src/engine/effect/effect-engine.ts`、`src/arona-clicker/runtime/runtime-wiring.ts`。

相关测试见 `tests/engine/story-service-node.integration.test.ts`。

状态与事件边界见 [[state-and-events]]；UI 查询见 [[read-model-and-ui]]。

## 定义、入口与会话

| 对象 | 负责什么 | 不能替代什么 |
| --- | --- | --- |
| `StoryDef` / 节点 | 描述可播放的内容、输入与节点动作 | 不代表该故事当前已经开始或完成。 |
| `StoryEntry` | 描述如何投放、触发和完成某条入口 | 与导航目录的分类层级不是同一对象。 |
| 运行会话 | 持有 owner、runId、当前节点与输入 token | 不应由 UI 自行推断或改写游标。 |
| `StoryView` / 目录 | 向 UI 投影当前状态或导航 | 是读取结果，不能作为推进命令的权威写入口。 |

一个故事可以在特定 owner 的空间内运行；命令需要针对正确 owner 和当前节点 token。交付阶段与等待输入阶段不同：提交“继续”不一定等同于点击或选择。服务在接受输入前检查当前阶段与候选，拒绝过期 token。

## 示例：两个 owner 的独立会话

`tests/engine/story-service-node.integration.test.ts` 创建 owner A、B 的不同故事：推进 A 后，B 仍停在原节点并保留自己的 token。A 进入点击输入节点后，普通推进返回 `ClickRequired`；若携带 B 的旧 token 点击 A，则返回 `StaleToken`，A 的当前节点保持不变。用 A 的当前 token 才能完成该输入。

同一测试还区分首次完成、强制重开与 replay：测试配置首次奖励 5、重开奖励 2；replay 不重复发奖或写日志。这是该测试配置及当前 replay 路径的行为，不应推广成所有剧情奖励数值。存档恢复会保留逻辑 checkpoint 和表现快照，同时换发 runId / token，旧界面输入不能因此假定仍有效。

## 排查剧情没有推进

先确认 StoryEntry、StoryDef 与当前 owner，再检查入口资格、当前阶段、命令及 token；若是选择，重新核对选项条件。节点推进成功后才追踪对应动作、Effect 或 Runtime 事件。被动池只能选出候选，真正创建和推进会话由本页描述的剧情服务负责，见 [[enhancements-and-passive-pools]]。
