# docs-830/05-domains/story-and-effects — 剧情与效果

本文回答：剧情如何推进，以及剧情动作如何连接到游戏机制。

## 剧情推进

`StoryService` 按故事拥有者维护活动会话。`StoryNodePlayer` 解释作者节点、动作与转移；`StoryPlaybackCoordinator` 管理当前等待点的有限表现步骤、计时和已投递输出。UI 读取 `getPlaybackView(owner)`，提交明确的继续、输入或节奏加速意图；读取和刷新本身不推进剧情。

启动时，Service 根据 StoryEntry 找到目标 StoryDef，验证结构、入口类型、Init 范围、触发条件和完成状态，再创建带 owner/runId 的会话与独立文档副本。继续和输入命令携带当前表现阶段的 token；服务复核 owner、阶段和候选，拒绝过期输入，选择提交时再检查条件。正文写入 Runtime 输出记录时才标记已送达和已读，随后按当前等待点决定进入自由继续或 Click 输入。

```text
StoryEntry / StoryDef → StoryService / StoryNodePlayer → 当前逻辑等待点
                    → StoryPlaybackCoordinator → 有限步骤、计时、稳定输出
                    → getPlaybackView / UI → Controller 显式意图 → StoryService
```

## 本次 Entry 的局部标记

`StoryNodePlayer` 为每次启动创建独立 `Map<name, value>`。`startActiveStory(entryId, owner, initialFlags)`、`startCardStory(...)` 与对应 GameCommands 可投入初始 JSON 字典；底层 Player 的 start 第三个参数同样接收字典。`StoryService.startStory` 的 options.initialFlags 可供其他类型的入口调用。启动先验证并复制，坏参数不会替换当前会话。name 需要非空，推荐 `StoryName-flagid`，不限制前缀；值为有限 JSON 数据，不提供值比较。

StoryPlayer 只按 StoryDef 的 `nodes` 数组顺序执行；旧 `stageId` / `stages` 字段继续随定义保存，但不再分组节点、规定 Click 数量或影响推进。Talklet 送达后，如果紧邻的下一节点是当前可用 Click，表现步骤完成后自动衔接到该 Click；否则等待用户自由继续。Click 提交先形成结果等待点，结果通知和临时演出按序完成后再执行已接纳的后继；连续 Click 分别成为当前输入。Operation 先预检和执行一次，再停在动作结果等待点，由 Runtime 顺序展示实际效果、执行临时演出，完成后自动衔接。连续 Operation 逐个处理，无须额外确认。Transfer、局部条件跳过及 `insert` 返回栈保持作者顺序与有界执行保护。

## 有限表现步骤与交接

每个逻辑等待点只编译当前批次的 `delay`、`output`、`effect` 步骤，不预执行未来 Click 后的逻辑。协调器持有步骤位置、剩余等待时间、正文送达状态和自动衔接策略；打字、思考、效果间隔和开幕标题计时均在 Runtime。`continueStory()`、`submitStoryInput()`、`accelerateStoryPresentation()` 分别处理自由继续、玩家输入和打字/思考加速；Operation、banner、finishing 等未完成阶段拒绝越过当前表现的输入。

Runtime 输出有稳定逻辑 ID、递增序号、时间戳与 historyId，正文和玩家可读通知保留有界记录。保存恢复依赖步骤游标与输出检查点，不从 UI 聊天条目数量倒推动作是否执行。`clearFlow` 增加输出 epoch 并清空记录；若当前正文仍未送达，标记本等待点的输出受抑制，后续计时不会让旧正文复活。历史裁剪和显式清理不回退已提交的逻辑进度。

完成链进入 `finishing`：先结算奖励、记录完成及相关冷却，再顺序呈现实际奖励通知。当前 owner 的运行槽在尾通知完成后释放，随后才安装已接纳的后继 Entry；角色剧情完成时会请求已达标的羁绊尾巴，交接后自动启动，不必再次由 UI 手动推送。同步动作或完成通知中提出的新启动先取得明确准入结果与请求身份，延后目标播放器的执行，避免监听器在当前动作批次中递归启动新链。待交接请求随快照保存，并受队列和因果链交接次数上限约束。恢复 finishing 不重发已结算奖励或完成事件。执行中发生晚拒绝或通知异常时保留已提交回执并进入失败状态，不声称回滚已有状态。

所有四类 StoryNode 都可声明一个 `requiresFlag?: string`。到达时用 Map.has 检查，false、0、空字符串、null 都表示键存在；未声明则正常执行。缺键时直接跳过整个节点：正文不投递，Click 不等待、不取随机也不触发结果，Operation 不执行，Transfer 不跳转。Talklet 后续 Click 若被条件跳过，则该 Talklet 按无紧邻可用 Click 处理，等待用户自由继续。已经接受的等待点不会在查询或恢复时重复判断。

局部写入使用 StoryAction `{ kind: 'localFlag', op: 'set', name, value }`，同名覆盖；移除使用 `{ kind: 'localFlag', op: 'remove', name }`，不存在时无操作。可用于 Operation、Click 共享动作或结果动作；保持作者顺序，由播放器直接处理，不调用 EffectEngine。需要选项触发不同后续 Talklet 时，可在各选项结果写入各自的局部标记，并在对应 Talklet 上声明 `requiresFlag`；该条件只检查键存在，不比较值。若 Choice 可能在同一 Entry 中重复到达，共享动作应先清除旧分支标记，再由所选结果写入当前标记。goto/insert 沿用同一张表；启动另一 Entry、另一个 owner 或重新开始时不自动继承。

本次表随播放等待点的 `run.localFlags` 保存恢复，结束、取消、替换或失败后不供后续 Run 使用。它与 `PlayerState.flags` 的持久 setFlag，以及 `session.flags` 的“本次执行过哪些持久 setFlag”名称记录相互独立。局部标记不会写入这两处，条件系统的普通 flag 目标也不读取局部表。快照必须包含有效 localFlags；不为旧的活动会话快照补默认值或编写迁移。

Story Editor 的 Choice 绑定卡自动维护这组标准字段：把 Choice 后的节点拖到某个选项左侧卡片，会在该 option result 中追加 `localFlag set true`，并给目标节点设置同名 `requiresFlag`。每次目标节点使用独立的 `Story-choiceId-num` 名称；再次到达该 Choice 时，`sharedActions` 先清理本 Choice 的已绑定标记。编辑器可级联重命名标记，统一更新写入、移除和节点条件；Runtime 不需要专用绑定数据。

## 输入后的作者回应

Button / ChoiceOption 不再内嵌玩家回复内容，也不由 Click 提交事件自动造一条老师消息。若需要老师回应，作者在输入节点后追加右侧 Talklet；它遵循普通 Story 节点顺序、投递与确认节奏。若不同选项需要不同回应，各 option 的结果写入独立 Entry 局部标记，后续 Talklet 用 `requiresFlag` 选择；条件仅判断标记是否存在，不比较值。存在跳转时，需把 Transfer 放在希望显示的回应 Talklet 之后，否则被跳转的节点不会执行。

验证入口：`tests/engine/story-run-flags.test.ts`、`story-run-flags.integration.test.ts`。编辑器配置与草稿边界见 [[runtime-editor-and-project-checks]]。

## 效果协作

剧情节点或奖励可以请求执行 Effects。状态变更仍由相应状态写入服务提交；`EffectEngine.applyEffectsWithReceipts()` 保留整批先解析表达式、再按序写入的规则。每项 `EffectReceipt` 在对应目标写入后、同步通知前固化，携带 effectIndex、op、target、changed/noop 及实际前后值、差值或结果明细。玩家通知据实际回执生成，不把请求量当作实得量；noop、内部 flag 与 Extra 不播报为奖励。通知抛错也保留已提交前缀，不通过重试重复发放。

分支提交前校验转移目标和动作能否解析，再消费输入 token 并执行。静态非法内容在执行前拒绝；动态执行和外部同步通知仍可能在部分状态已提交后失败，回执负责保留真实结果。Story 旅行也返回实际旅行回执，不另发一条由 UI 抢先插入的剧情移动通知。

正式 Story 会话将覆盖层、开幕标题、ephemeral theme 和 story lifetime 实体表现编译成延后执行的表现意图，轮到对应步骤时由 `StoryNodePresentationHost` 按 run 生命周期执行。标题的来源默认值在接纳动作时物化，等待期间改名不会改掉本次标题。area/student 主题及 manual/area/init 实体覆盖仍在逻辑批次执行一次；可能清除非 Story 覆盖的 `clearEntityPresentation` 也直接逻辑执行，禁止放入可恢复的表现步骤重复写入。

## 剧情目录与运行会话

剧情导航目录 `StoryContentTable` 以分类、篇章、章节和条目组织导航，并保存当前活动的 `activeStoryEntryId`；它提供 UI 排序与分层浏览所需的内容结构。实际可启动的 StoryEntry、StoryDef、触发条件与会话游标由 Registry 和 `StoryService` 管理。目录如何展示某剧情，与剧情本身是否可触发、能否推进是两件事。

```text
剧情动作 → EffectEngine → 状态写入或 Runtime 事件 → 领域响应 → 新视图
```

源码入口：`src/arona-clicker/services/story/story-service.ts`、`story-node-player.ts`、`story-playback-coordinator.ts`、`story-playback-snapshot.ts`、`story-node-action-host.ts`、`src/engine/contracts/effect-receipt.ts`、`src/engine/effect/effect-engine.ts`。

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
