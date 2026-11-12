# docs-830/05-domains/story-and-effects — 剧情与效果

本文回答：剧情如何推进，以及剧情动作如何连接到游戏机制。

## 剧情推进

`StoryService` 按故事拥有者维护普通活动会话。`StoryNodePlayer` 解释作者节点、动作与转移；`StoryPlaybackCoordinator` 管理当前等待点的有限表现步骤、计时和已投递输出。UI 读取 `getPlaybackView(owner)`，提交明确的继续、输入或节奏加速意图；读取和刷新本身不推进剧情。

重读使用独立的一次性 `replayId` 通道，可与同 owner 的普通故事并行；owner 仍表示故事归属，但重读会话、输出、表现阶段和输入 token 都按 replayId 隔离。UI 将它投影到临时聊天空间，结束后返回故事页；重读输出不进入普通聊天历史、故事游标或存档，取消/重置时清理。重读仅计算本次 localFlags 和临时演出，跳过持久状态、真实旅行、入口请求及完成奖励；area/student 主题和非 story 生命周期的实体覆盖也不执行。

启动时，Service 根据 StoryEntry 找到目标 StoryDef，验证结构、入口类型、Init 范围、触发条件和完成状态，再创建带 owner/runId 的会话与独立文档副本。普通播放默认沿用触发时传入的对话 owner 与所在空间；Entry 的 `travelToStartContext` 开启时才按 StoryDef 起始上下文真实前往。Active/Passive Entry 类型不决定起始对话空间。重播始终按 `startContext` 虚拟切到 Area 或 Chara 演出空间；只有 Entry 开启 `travelToStartContext` 才真实前往起始 Area / Chara 空间。后续显式移动节点在重播中只呈现空间变化，不再执行实际移动。继续和输入命令携带当前表现阶段的 token；服务复核 owner、阶段和候选，拒绝过期输入，选择提交时再检查条件。正文写入 Runtime 输出记录时才标记已送达和已读，随后按当前等待点决定进入自由继续或 Click 输入。

```text
StoryEntry / StoryDef → StoryService / StoryNodePlayer → 当前逻辑等待点
                    → StoryPlaybackCoordinator → 有限步骤、计时、稳定输出
                    → getPlaybackView / replayId 查询 → UI 临时流 → Controller 显式意图 → StoryService
```

## 本次 Entry 的局部标记

`StoryNodePlayer` 为每次启动创建独立 `Map<name, value>`。`startActiveStory(entryId, owner, initialFlags)`、`startCardStory(...)` 与对应 GameCommands 可投入初始 JSON 字典；底层 Player 的 start 第三个参数同样接收字典。`StoryService.startStory` 的 options.initialFlags 可供其他类型的入口调用。启动先验证并复制，坏参数不会替换当前会话。name 需要非空，推荐 `StoryName-flagid`，不限制前缀；值为有限 JSON 数据，不提供值比较。

StoryPlayer 只按 StoryDef 的 `nodes` 数组顺序执行；旧 `stageId` / `stages` 字段继续随定义保存，但不再分组节点、规定 Click 数量或影响推进。Talklet 送达后，如果紧邻的下一节点是当前可用 Click，表现步骤完成后自动衔接到该 Click；否则等待用户自由继续。单按钮 Click 只提供文案与按击次数，完成后继续后继节点，不接受 result。奖励、局部写入和表现由后续 Operation 承担，控制流由 Transfer 承担，场景变化可使用独立移动节点；连续 Click 分别成为当前输入。剧情入口卡仍通过专用 Entry 请求处理邀请与接续。Operation 正常播放时先预检和执行一次，再停在动作结果等待点，由 Runtime 顺序展示实际效果、执行临时演出，完成后自动衔接；重播跳过持久 Operation，但保留 localFlag、覆盖层及本次运行的临时表现动作。`moveToArea` 与 `moveToCharaspace` 是独立移动节点：正常播放分别强制旅行或切换通讯录 owner，重播只改变演出空间并保留一次性输出。Transfer、局部条件跳过及 `insert` 返回栈保持作者顺序与有界执行保护。

## 有限表现步骤与交接

每个逻辑等待点只编译当前批次的 `delay`、`output`、`effect` 步骤，不预执行未来 Click 后的逻辑。协调器持有步骤位置、剩余等待时间、正文送达状态和自动衔接策略；打字、思考、效果间隔和开幕标题计时均在 Runtime。`continueStory()`、`submitStoryInput()`、`accelerateStoryPresentation()` 分别处理自由继续、玩家输入和打字/思考加速；Operation、banner、finishing 等未完成阶段拒绝越过当前表现的输入。

Runtime 输出有稳定逻辑 ID、递增序号、时间戳与 historyId，正文和玩家可读通知保留有界记录。保存恢复依赖步骤游标与输出检查点，不从 UI 聊天条目数量倒推动作是否执行。`clearFlow` 增加输出 epoch 并清空记录；若当前正文仍未送达，标记本等待点的输出受抑制，后续计时不会让旧正文复活。历史裁剪和显式清理不回退已提交的逻辑进度。

完成链进入 `finishing`：先结算奖励、记录完成及相关冷却，再顺序呈现实际奖励通知。当前 owner 的运行槽在尾通知完成后释放，随后才安装已接纳的后继 Entry；角色剧情完成时会请求已达标的羁绊尾巴，交接后自动启动，不必再次由 UI 手动推送。同步动作或完成通知中提出的新启动先取得明确准入结果与请求身份，延后目标播放器的执行，避免监听器在当前动作批次中递归启动新链。待交接请求随快照保存，并受队列和因果链交接次数上限约束。恢复 finishing 不重发已结算奖励或完成事件。执行中发生晚拒绝或通知异常时保留已提交回执并进入失败状态，不声称回滚已有状态。

所有四类 StoryNode 都可声明一个 `requiresFlag?: string`。到达时用 Map.has 检查，false、0、空字符串、null 都表示键存在；未声明则正常执行。缺键时直接跳过整个节点：正文不投递，Click 不等待、不取随机，Operation 不执行，Transfer 不跳转。Talklet 后续 Click 若被条件跳过，则该 Talklet 按无紧邻可用 Click 处理，等待用户自由继续。已经接受的等待点不会在查询或恢复时重复判断。

局部写入使用 StoryAction `{ kind: 'localFlag', op: 'set', name, value }`，同名覆盖；移除使用 `{ kind: 'localFlag', op: 'remove', name }`，不存在时无操作。用于 Operation，保持作者顺序，由播放器直接处理，不调用 EffectEngine。Choice 使用下述专用选择标记，不声明通用动作。goto/insert 沿用同一张表；启动另一 Entry、另一个 owner 或重新开始时不自动继承。

本次表随播放等待点的 `run.localFlags` 保存恢复，完成时捕获至 finishing；除明确的父子返回外，不供后续 Run 使用。它与 `PlayerState.flags` 的持久 setFlag，以及 `session.flags` 的“本次执行过哪些持久 setFlag”名称记录相互独立。局部标记不会写入这两处，条件系统的普通 flag 目标也不读取局部表。快照必须包含有效 localFlags；不为旧的活动会话快照补默认值或编写迁移。

Story Editor 的 Choice 绑定卡维护声明式关联：把 Choice 后的节点拖到某个选项左侧卡片，会在该 option 的 `marks` 中追加标记名称，并给目标节点设置同名 `requiresFlag`。每次目标节点使用独立的 `Story-choiceId-num` 名称；编辑器可级联重命名标记，统一更新选择声明、普通局部写入 / 移除与节点条件。Choice 不再显示共同局部动作、通用结果动作、任意标记值或内嵌转移控件。

Choice 只提供选项、出现条件与选择记录：option 保留 `id/text`，`showWhen` 读取普通持久条件组，`requiresFlag` 检查本次 Entry 局部键存在，两者同时满足才显示；省略条件表示始终出现。`marks` 声明选中时成立的局部标记名称，可为空，不带任意值或动作类型。成功接纳选择后，播放器先清除本组所有 marks，再将当前选项的 marks 写为 true；其他组与普通局部标记不受影响。同一 Transfer 可达链中的不同 Choice 不能声明同名 marks；父子 Entry 若通过 returnFlags 回传双方不同 Choice 自有的同名标记，也会拒绝，普通局部回传仍沿用显式白名单规则。提交时复核候选与 token，失败不清理或消费输入。运行态隐藏不满足条件的选项，完成记录只保留当时可见候选，编辑预览仍展示所有作者选项。

到达 Choice 时若没有可见选项，播放器在本次显式推进中清除本组 marks 并跳过整个节点，避免旧分支残留。已经等待输入时条件变为零候选，查询只更新候选；底部提供“继续故事”，显式空选项提交才清理并跳过。有候选时空提交仍被拒绝。重要说明应放在前置 Talklet，不能依赖被跳过的 Choice 正文。该过程不创建额外选择历史状态，局部表照常保存与恢复。

业务效果在后续带 `requiresFlag` 的 Operation 执行，goto / insert 则由受同一标记控制的顶层 Transfer 执行。已有持久 `setFlag` 仍由 Operation 写入持久状态，不与 Entry 局部标记混用。共同业务效果放在选择成功后的节点，不提前到 Choice 之前；每个分支的效果批次和转移保持原顺序。

正式 Choice 合同不再接受 `sharedActions`、option `condition/result` 等旧字段；作者投影与结构校验报告具体路径，不静默丢弃后保存。内置标准 set true / remove 模式已改为 marks；外部内容与本地旧草稿需要显式处理，旧可选条件改为隐藏条件也需作者确认语义。迁出的效果使用既有 Operation 等待点：到达时独立预检，失败会终止当前运行，先前已完成的独立 Operation 不自动回滚；不能将此模式理解成整个选项的一次原子事务。独立 Transfer 的重读分支守卫同样在到达转移时检查；若被拒绝，运行进入带 BranchGuardDenied 详情的失败状态，需要显式重新开始，不再允许复用已消费的 Choice token 改选。运行中旧游标与修改后的定义失配时，沿用现有显式失配与 Entry 重启路径，不补写旧快照。

## 节点局部演出与定点清理

Talklet / Click 的 `performance` 保存有限样式与 `layout`（flow / positioned）；Talklet 另有正文 template。省略即沿用原流内表现。`layout.anchor` 将内容与聊天窗格的同名九宫格点对齐。X 向右、Y 向上为正，默认使用相对窗格宽高的 −1..1 比例，`layout.unit: px` 使用有符号 CSS 像素。旧定义缺省 anchor，仍按左下原点、非负坐标和 align 横向锚点呈现。模板不复制正文，输入 / 思考仍由 Runtime 执行原有等待后投递，不变成逐字动画。

输出以 historyId 隔离逻辑运行，并携带真实 storyId / nodeId。流内每次到达追加；同一次运行再次到达某定位节点替换其旧展示。流内正文与完成 Choice 留历史；定位内容在完成、取消、失败、替换或换场时移除。Button / EntryCard 仅在当前输入等待点存在，Choice 完成后只留禁用记录；重访定位 Choice 时先移除其旧完成卡。位置与样式不绕过条件、标记、按击工作量或 token，也不提供脱离当前 Click 的 Entry 启动能力。

Operation `clearNode` 以 storyId / nodeId 清除发起运行中该节点的全部现存输出，包括流历史和定位展示；同名节点的其他 Story / 运行不受影响。未展示的有效目标为无操作。它不回退节点、不撤销 flags、已读或业务效果。clearFlow 清除输出并保留原有待投递抑制，clearAllTexts 也清理本运行的定位输出；当前输入等待点仍保留，避免清理展示改变执行状态。Coordinator 持有唯一输出真相；快照只保存清理后的内容，读档不补投已清输出。恢复保留逻辑 historyId，分配新运行凭据，使旧输入 token 失效；不另建 UI 业务状态或存档迁移层。

## 地点续播与一层羁绊调用

会话空间保留普通聊天历史，游标保留一次 Entry 的运行状态，屏幕根据 Story 起始上下文及移动节点选择场景。Init / Chara 根运行可以各自等待，正式子故事同时最多一个；等待本身不创建额外游标，也不全程禁止旅行。正式子与到场续播沿用通道隔离推进 / token，正文按投递时的场景进入 Init 或 Chara 历史；换场不清历史，Area 正文不回灌 Chara，根运行归属不随现场变化。只有重读使用私有输出。

作者只使用以下两种 Click，不填写游标、返回地址、事件名或 afterStoryId：

| 声明 | 行为 |
| --- | --- |
| `interaction: { kind: 'areaContinue', areaId }` | 当前游标停住；玩家到该 Area 手动接纳后，继续同一 Entry 的后继节点，不创建子故事 |
| `interaction: { kind: 'kizunaCard' }` | 从当前 Entry 的 `kizuna` 关联取得目标，保留父节点并启动独立子故事 |
| Entry `kizuna.areaId` | 将上述羁绊入口改为赴约提示；玩家到指定 Area 接取 ActiveStory 后才创建子运行 |

Entry 关联的字段片段如下；其余必填字段沿用现有 StoryEntry：

```json
{
  "kizuna": {
    "entryId": "pack:activestory:bond",
    "areaId": "pack:area:meeting",
    "returnFlags": ["bond-choice"]
  }
}
```

省略 areaId 就从当前爱心卡片直接进入。父正文仍是“前文 → kizunaCard → 后文”，没有另一份尾段 Entry。子故事正常完成、结算与尾通知结束后，只把 returnFlags 允许的键返回父表：先清父表这些键，再复制子表最终存在的项；false / 0 / null 仍按存在处理。省略 returnFlags 表示只返回完成关系。正式子结束停在自身最终场景，释放播放绑定并按该场景已有门控恢复 Click，不自动召回或推进父故事；最终场景就是父空间时，下一次普通 Click 接续父后文，否则等玩家自行选择原空间。查询、刷新和读档不代替本次输入 / 返回意图；私有完整重读仍自动串联父后文。

父只允许一个关联目标、一次成功调用；目标必须是独占关联的 Active Entry，正式启动只能经过该父卡片或赴约邀请，单独阅读使用重读。Registry 与启动检查沿 goto / insert 和 Click 结果检查可达正文，子故事禁止 kizunaCard、areaContinue、entryCard、入口请求和入口覆盖卡；服务在实际启动及延后入口再次禁止子运行递归开播。子仍可切换场景、修改世界或投递未来故事。

Area 邀请由当前父 historyId 与等待序号派生，保存的是父游标而非复制一份 Entry。到场不自动播放，未接取不占子槽；忙或资格不符保持原邀请。子取消后恢复原入口，父取消则连同子运行失效。取消不撤销已经发生的世界写入；已记录完成的子结果不能因清理临时画面而丢弃。

父、子、待返回结果、局部表、会话输出与表现队列随 `StoryCursorCollection` 一起保存。读档检查唯一 historyId / channel、父子对应与内容指纹，换发 runId / token；损坏关联在替换当前状态前拒绝。旧正式 channelOutput 中已有独立正文时，因缺少当时的空间归属以 `StoryOutputFormatChanged` 拒绝加载，不静默丢弃、不自动迁移；普通无此类在播通道的存档不受该检查影响。已结算后的通知异常保留 finishing 结果，可通过“继续故事”恢复返回而不再次结算。完整回放在私有父子关系中自动接回后文，使用虚拟地点，不唤醒正式游标。

基础包将星野天台 FollowUp 接线改为 areaContinue，将羁绊邀约与原尾段接成完整父正文。「午后的堤防」在阿比多斯、星野好感 3 级投放：子故事先在原通讯录接话，再前往旧校舍相邻堤防 Area，最后回原通讯录并按局部选择接父收尾。白子样例保留夏莱直接子调用与天台到场接取。FollowUp、pushAfterStory 仍保留给旧包和真正独立的后续投放。运行边界见 `tests/engine/story/story-continuation.test.ts`；三空间与正式内容见 `hoshino-story-spaces.test.ts`、`tests/ui/story/story-space-history.test.ts`。

## 输入后的作者回应

Button / ChoiceOption 不再内嵌玩家回复内容，也不由 Click 提交事件自动造一条老师消息。若需要老师回应，作者在输入节点后追加右侧 Talklet；它遵循普通 Story 节点顺序、投递与确认节奏。若不同选项需要不同回应，各 option 的 marks 声明独立 Entry 局部标记，后续 Talklet 用 `requiresFlag` 选择；条件仅判断标记是否存在，不比较值。存在跳转时，需把 Transfer 放在希望显示的回应 Talklet 之后，否则被跳转的节点不会执行。

验证入口：`tests/engine/story/story-run-flags.test.ts`、`story-run-flags.integration.test.ts`。编辑器配置与草稿边界见 [[runtime-editor-and-project-checks]]。

## 效果协作

剧情节点或奖励可以请求执行 Effects。状态变更仍由相应状态写入服务提交；`EffectEngine.applyEffectsWithReceipts()` 保留整批先解析表达式、再按序写入的规则。每项 `EffectReceipt` 在对应目标写入后、同步通知前固化，携带 effectIndex、op、target、changed/noop 及实际前后值、差值或结果明细。玩家通知据实际回执生成，不把请求量当作实得量；noop、内部 flag 与 Extra 不播报为奖励。通知抛错也保留已提交前缀，不通过重试重复发放。

Story Operation 的有限 `StoryStateAction` 支持 `acquireAreaMap(mapId)` 与 `revealInformation(target)`。地图动作只把地图加入当前 Init 的地图册，不打开地图或移动玩家；信息动作必须指向 Area、AreaMap 或本地 Node 上声明为 `explicit` 的单个信息面。Story 投影和执行预检都检查引用及该显式规则，再由受保护的 Effect / 信息写入口提交。重复收录或重复告知不重复改变状态；重读跳过持久状态动作，隔离试播不会污染真实存档。

分支提交前校验转移目标和动作能否解析，再消费输入 token 并执行。静态非法内容在执行前拒绝；动态执行和外部同步通知仍可能在部分状态已提交后失败，回执负责保留真实结果。Story 旅行也返回实际旅行回执，不另发一条由 UI 抢先插入的剧情移动通知。

正式 Story 会话将覆盖层、开幕标题、ephemeral theme 和 story lifetime 实体表现编译成延后执行的表现意图，轮到对应步骤时由 `StoryNodePresentationHost` 按 run 生命周期执行。标题的来源默认值在接纳动作时物化，等待期间改名不会改掉本次标题。area/student 主题及 manual/area/init 实体覆盖仍在逻辑批次执行一次；可能清除非 Story 覆盖的 `clearEntityPresentation` 也直接逻辑执行，禁止放入可恢复的表现步骤重复写入。

## 剧情目录与运行会话

剧情导航目录 `StoryContentTable` 以分类、篇章、章节和条目组织导航，并保存当前活动的 `activeStoryEntryId`；它提供 UI 排序与分层浏览所需的内容结构。实际可启动的 StoryEntry、StoryDef、触发条件与会话游标由 Registry 和 `StoryService` 管理。目录如何展示某剧情，与剧情本身是否可触发、能否推进是两件事。StoryDef 的 `startContext` 与 Story Editor 文档属性共同维护 Area/Chara 起始位置；移动节点分别编辑目标 Area 或角色 ID。

```text
剧情动作 → EffectEngine → 状态写入或 Runtime 事件 → 领域响应 → 新视图
```

源码入口：`src/arona-clicker/services/story/story-service.ts`、`story-node-player.ts`、`story-playback-coordinator.ts`、`story-playback-snapshot.ts`、`story-node-action-host.ts`、`src/engine/contracts/effect-receipt.ts`、`src/engine/effect/effect-engine.ts`。

相关测试见 `tests/engine/story/story-service-node.integration.test.ts`。

状态与事件边界见 [[state-and-events]]；UI 查询见 [[read-model-and-ui]]。

## 定义、入口与会话

StoryEntry 将正文引用 `storyId`、归属角色 `owner`、历史编排 `catalog` 与正式激活 `activation` 分开。公共资格、重读和完结能力保存在公共记录；激活配置有且只有三类：`active` 为主动接取，可省略地区兜底，或声明 `current-area` / `fixed-area` 投放；`random` 保存基础权重、重复触发及冷却；`affection` 要求角色 owner，以等级或前置 Story 完成触发单次角色阶段，尾段仍优先。原顶层 type、weight、affectionRequired、pushAfterStory 不再是作者字段，active/passive 启动通道由 `storyEntryType()` 派生。Datapack 保留 activeStories 与 passiveStories 两个分区，后者容纳 random / affection；ID 和运行完成记录的身份保持不变。

历史目录位置提升为 `catalog.category/part/chapter/order`，三类入口均可编排，不赋予首次播放资格，也不写入完成或已读状态；原 Extra.storyCatalog 与产品目录的逐条归属已转写，目录分组名称和顺序继续由产品模型维护。主动地区兜底读取 Entry 自身配置，不再读取硬编码名单；它只创建可接取投放，不自动开播或旅行，且不能跨当前 Init。被动池仍独立持有 children，成员只能是随机入口或其他池；池成员与路径权重不在 Entry 反向双写。前置 Story 是激活依赖，不加入播放调用链或 Entry 局部 Flag 作用域。

合同／导入边界见 `contracts/story-entry.ts`、`validation/story-entry.ts` 和 Registry；运行消费见 `story-entry-selection.ts`、`story-availability-delivery-mount.ts`、`passive-pool-system.ts`。回归入口为 `tests/data/story/story-entry-activation.test.ts`、`tests/engine/story/story-entry-fallback.test.ts` 及既有 Entry／池／重读测试。

| 对象 | 负责什么 | 不能替代什么 |
| --- | --- | --- |
| `StoryDef` / 节点 | 描述可播放的内容、输入与节点动作 | 不代表该故事当前已经开始或完成。 |
| `StoryEntry` | 描述如何投放、触发和完成某条入口 | 与导航目录的分类层级不是同一对象。 |
| 运行会话 | 持有 owner、runId、当前节点与输入 token | 不应由 UI 自行推断或改写游标。 |
| `StoryView` / 目录 | 向 UI 投影当前状态或导航 | 是读取结果，不能作为推进命令的权威写入口。 |

一个故事可以在特定 owner 的空间内运行；命令需要针对正确 owner 和当前节点 token。交付阶段与等待输入阶段不同：提交“继续”不一定等同于点击或选择。服务在接受输入前检查当前阶段与候选，拒绝过期 token。

## 示例：两个 owner 的独立会话

`tests/engine/story/story-service-node.integration.test.ts` 创建 owner A、B 的不同故事：推进 A 后，B 仍停在原节点并保留自己的 token。A 进入点击输入节点后，普通推进返回 `ClickRequired`；若携带 B 的旧 token 点击 A，则返回 `StaleToken`，A 的当前节点保持不变。用 A 的当前 token 才能完成该输入。

同一测试还区分首次完成、强制重开与 replay：测试配置首次奖励 5、重开奖励 2；replay 不重复发奖或写日志。这是该测试配置及当前 replay 路径的行为，不应推广成所有剧情奖励数值。存档恢复会保留逻辑 checkpoint 和表现快照，同时换发 runId / token，旧界面输入不能因此假定仍有效。

## 排查剧情没有推进

先确认 StoryEntry、StoryDef 与当前 owner，再检查入口资格、当前阶段、命令及 token；若是选择，重新核对选项条件。节点推进成功后才追踪对应动作、Effect 或 Runtime 事件。被动池只能选出候选，真正创建和推进会话由本页描述的剧情服务负责，见 [[enhancements-and-passive-pools]]。
