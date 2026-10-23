# Task 0322：Story 四类作者节点的全量替换与统一播放

状态：proposed — 调查、可行性判断与Task编制完成，尚未开始产品实施。用户已明确选择开发期全量替换、允许破坏旧语义；本Task据此撤销先前双作者协议与兼容编译路线。其余具体执行规则为下文推荐合同，不冒充现行实现。

日期：2026-10-22。需求来源为用户的上层AI拆分方案、[[docs/plan-work/report-0321-story-talklet-capability-investigation]]及四篇分册，以及本轮补充：“项目仍在开发中……全量替换……或直接破坏式替换语义”。

## 1. 目标与已确认方向

保留StoryEntry、Story Runtime、EffectEngine、ChatStream与Flow的基本责任边界，**以唯一的新StoryDef.nodes作者模型全量替换旧talklets模型**。Talklet只负责内容与表现，Click负责交互，Operation负责行为，Transfer负责流向。唯一纯编译器将新模型编译成PlaybackPlan，唯一Runtime解释计划。

本Task结束时，全部现役第一方Story、作者Builder、测试夹具、独立Datapack Editor、游戏内浏览/导出和保存恢复均使用新模型。旧作者JSON和旧存档明确失效，不留“为了以后可能用”而保留的协议、类型、执行分支、表单和存档解释层。

**可行性结论：可行，且开发期单协议路线比双轨兼容更适合本次目标。** 工作量从“兼容两个作者格式”转向“第一方内容全量改写及语义验收”；不是简单删除旧类型，也不能只让一份新样例工作就结项。

### 1.1 已确认与尚待实施的区别

- 用户已确认：全量替换，不保留版本更迭兼容，可破坏旧语义。
- 本Task据此确定：只有新nodes协议、一个编译器、一个播放解释器；旧数据拒绝；第一方内容全部迁入新模型。
- P0负责核对内容清单、固化下文执行合同与差异矩阵；不再要求用户重复批准已确认的替换方向。
- 本轮仍是Task修订，不是启动产品施工或删除用户数据。尚未编正式Patch Unit，也未实际清档。
- 明确的新语义以本Task验收；没有指定改变的EffectEngine、Entry调度和MapRun职责继续遵循各自现行合同，不等于保留旧Story兼容模式。

## 2. 包含与非目标

包含：

- 单一StoryDef/StoryNode及有限动作契约，结构校验、引用校验和纯编译。
- StoryService推进、输入、效果、跳转、Entry启动、重读和完成身份的统一接线。
- 节点ID贯通Cursor、insert continuation、日志、BranchGuard、UI交付和当前格式保存。
- 第一方内容、Builder、运行样例、作者文档和测试夹具的全量改写。
- 独立编辑器单协议表单、引用、诊断和真实导入编辑导出往返。
- 游戏内Story浏览、来源包导出和实际播放的接线；旧协议和产品执行路径退役。
- 定位覆盖层/表现命令复用既有服务，必要的共享Flow回归。

非目标：

- 同时接受talklets与nodes，任何作者格式兼容层、旧索引映射器、legacy编译计划或长期双解释器。
- 自动读取/转换外部旧Story包；正式编辑器打开旧数据后悄然转换。
- 旧存档迁移、按文本猜节点、旧日志/游标局部兼容。
- Story专用图形画布、时间轴、拖动定位对象、Runtime Story热Apply、隔离倒带预览。
- EmbedNode、Story地图/行动卡作者载荷、MapRun命令权限、Theme Lite生命周期接线。
- 任意脚本、递归节点、异步Operation、可回滚EffectEngine或泛化事务框架。
- 实际删除用户本地存档或文件；本轮不改产品源码。

## 3. 当前事实与影响

| 当前事实 | 源码/符号 | 本Task处理 |
| --- | --- | --- |
| StoryDef为id/name/talklets/extra；Talklet混合显示/输入/效果/跳转 | `src/data-services/contracts/story.ts` | 改为单一nodes，不建旧新联合 |
| Entry承载owner/条件/奖励/守卫/FollowUp/被动调度 | `src/data-services/contracts/story-entry.ts` | 保留Entry层，守卫前置改稳定节点引用 |
| 页effects→choice effects→记录→跳转；旅行另批处理 | `services/story-flow.ts:advanceStory/trackFlagsAndApply` | 不保留旧页槽；逐内容明确新Action排列及差异 |
| EffectEngine整批求值、运行时转发与状态安装有既定批次语义 | `src/engine/effect/effect-engine.ts:applyEffects` | 保留Effect批次，不借Story重构改EffectEngine |
| typing/thinking/连发及按钮门控在UI | `src/ui/presentation/chat-stream.ts:afterDelivery/chainEligible` | UI计时，Runtime决定交互策略，删除旧字段推断 |
| goto保持Entry及insert栈；insert按下一页返回 | `services/story-jump.ts` | 单一稳定continuation；goto保留当前栈语义 |
| 卡片两条旧启动路径的force参数不同 | `story-service.ts:startCardStory`、`story-flow.ts:clickSend` | 统一到一种startEntry合同，删除旧差异分支 |
| 链尾当前StoryDef与初始Entry.storyId完成身份不对称 | `services/story-jump.ts:resolveStoryEnd`、`story-rewards.ts` | 本Task明确统一到来源Entry.storyId |
| replay仍执行页/选择效果，完成时不发完成奖励 | `services/story-replay.ts`、`story-jump.ts` | 新执行仍非隔离预览，不为其保留旧页逻辑 |
| 游标/返回点/已读/守卫/UI去重都涉及页索引 | `engine/contracts/story-cursor.ts`、`types/story-state.ts`、`chat-stream.ts:storyPageKey` | 全链路替换，不保留旧页号解释 |
| SaveData、聊天游标、InitSnapshot分散保存 | `contracts/save-data.ts`、`runtime-save-codec.ts`、`state/per-init-fields.ts` | 当前格式全部接线，拒绝旧档 |
| writer与SaveSystem各写死1.0.0，直接game.load未查版本 | `data-services/persistence/storage.ts`、`runtime-game-instance.ts:load` | 写出/存储/导入/直接load一致门控 |
| stories是custom Schema，通用同步测试会跳过若干覆盖项 | `tools/datapack-editor/schema/editor-extras.ts:storiesTable`、`merge.ts` | 直接替换表单，另测节点/动作全字段覆盖 |
| RuntimeEditor作者策略仅四种实体，Story以浏览/来源导出为主 | `authoring/content-policies.ts`、`ui/runtime-editor/pack-export.ts` | 适配新模型，不顺带实现Story热编辑 |

以上为前轮主Agent与三位Luna核查的现状，本轮未重新运行行为测试。实现前回当前文件复验，尤其当前工作树存在其他Gameplay B并行修改。

## 4. 单一作者合同

### 4.1 StoryDef与身份

```ts
interface StoryDef {
  id: StoryId;
  name: string;
  nodes: StoryNode[];
  playback?: { implicitClick?: 'always' | 'whenNeeded' };
  extra?: ExtraCompound;
}

type StoryNode = TalkletNode | ClickNode | OperationNode | TransferNode;
```

不引入StoryDefV1/StoryDefV2联合，不保留formatVersion分支，不新增作者resumeVersion来维系旧内容。旧talklets或节点上的旧式流程字段直接报错，不能静默忽略。存档外层的格式标记仅用于拒旧，不是多版本迁移架构。

Story ID继续为mod:story:name三段式。Node ID为Story内唯一短ID，建议1–64字符、匹配[a-z0-9][a-z0-9_-]*。引用用StoryDef+nodeId；复制生成新ID，移动保留ID，语义替换不得把旧ID分配给另一节点。nodes非空，作者数据不被编译器就地改写。

planIdentity是当前编译计划语义数据的确定性签名，仅用于判断**当前新格式存档**与当前定义是否一致，不解析旧作者协议或旧页号。计划变化时本片不承诺原位续播：整条播放链失效，不做版本映射。节点ID仍用于当前计划的地址、引用、阅读和交付身份。

### 4.2 Talklet：内容、表现与节奏

TalkletNode只有id/type='talklet'/content/presentation?/pacing?。

- content为talk(text/speaker?/image?)或narration(text)。首片不声明narration.image，因为当前旁白renderer没有消费；禁止接受后不显示。
- presentation包括side、align、avatar、avatarMode(auto/hide/show)；不再有noAvatar与showAvatar两个可冲突布尔。
- pacing包括typing/thinking，有限非负秒数；talk沿用0.9秒默认与10秒夹取。旁白不走对方typing节奏，非法的talk专属组合应有诊断。
- image只表达可显示资源；speaker是显示名，不自动等于Entry.owner或玩家身份。
- 不接受effects、choices、sendText、muteReply、clickWork、jumpToStory、jumpMode、kizuna、map/cards/locations/actions、x/y。

### 4.3 Click：动作与回复

ClickNode包含id/type='click'/clickText、condition?、press?、reply?、outcome?及有限presentation（button或entryCard，后者带title?/align?）。

1. 最长连续Click段为互斥组；紧邻前面的Talklet则与其组成一个显示/交互Step，否则为无显示交互Step。Operation/Transfer打断归属，不向前越过它们寻找Talklet。
2. 每组选中一个Click后跳过其余候选，继续组尾后继。多选项在内容送达并完成thinking后直接出现，**删除旧“再点击一次确认文字才显示选项”的阶段**。
3. condition进入组时评估、提交时重验，按clickId提交，不按过滤后的数组位置。
4. 全部不可用时返回blocked/noAvailableClick及原因，允许外部状态变化后重验；不自动跳过、不虚构默认Click、不执行效果。
5. press省略为一次完成；base为>=1安全整数、rand为>=0安全整数，总数为base+floor(random*rand)。**第N次达到total即完成，删除旧多击填满后额外确认的一次点击。**
6. 纯编译和查询不抽随机。进入组时初始化各候选total并保存；多击一旦开始锁定该clickId，完成前不能切换候选。condition失效时保留计数并阻塞，不重抽。
7. reply只有一个TalkletContent，不是StoryNode，不包含嵌套交互/效果/流程。省略即无回显；talk按玩家回复投影isPlayer=true，缺speaker用PLAYER_IDENTITY；narration是旁白。不要靠speaker='老师'判断身份。
8. entryCard只允许单卡组、无press、终结动作startEntry，复用既有卡片确认浮层；不开放任意UI插槽。

Click中的outcome是有限动作列表，由Runtime解释，不让Click对象自己调用服务。

### 4.4 Operation、有限动作与演出

OperationNode包含id/type='operation'/action。action为effects、overlay、presentation有限联合；Click.outcome允许同样的行为动作以及终结transfer/startEntry。无递归outcome、无节点数组、无脚本或异步执行。

effects限定为现有可执行状态/旅行操作：set/addResource、set/addSpotLevel、setManager、addEnhancement、addItem、unlockInit、setFlag、set/add/removeExtra、grantCharacter、addAffectionExp、travelToArea。拒绝Affector声明类set/removeSpotMaxLevel、未接执行的loot。Story中的启动控制用startEntry；演出操作走明确overlay/presentation，不用任意Effect.op再藏一套Story流控制。

- OverlayCommand：show、clearId、clearAllTexts、clearFlow；临时id、x/y/align/style是包装器字段。
- show正文有限variant：text(default/title/badge/note)、message(TalkletContent及适用presentation)、entryCard(entryId/title?/buttonText?/align?)。entryId明确引用ActiveStoryEntry；该目标在Registry与引用浏览器都要校验。卡片不消费通用style时应拒绝该组合。
- PresentationCommand：theme、set/clearEntityPresentation、openingTitle。只调用现有领域/演出服务，不新建第二套主题引擎。
- openingTitle按Operation词法位置执行，**删除旧“首页立即发、离开首页过滤”的特殊逻辑**；迁移内容如需开场横幅，应显式把Operation放在首个Talklet之前。横幅仍用现有3秒与门控。
- 嵌入显示只允许呈现片段，不复用一个可夹带未知执行字段的StoryNode。EngineTalklet等通用服务契约是否仍被其他系统使用需按调用方处理，不能为删旧Story接口破坏外部引擎端口。
- Action之间按列表顺序；单个effects批次仍按EffectEngine原语义求值/转发/安装，travel保留Story专门调用。结构替换不等于把Effect[]强制改成逐项交错事务。

现有EffectEngine/ChatFlowService端口可作为单一新Operation的底层适配，不算旧Story作者兼容。不得同时保留从旧Talklet.effects进入的第二条剧情执行路径。

### 4.5 Transfer、startEntry、完成与重读

TransferNode为id/type='transfer'/storyId/mode(goto|insert)，目标均为新StoryDef。

- goto保持来源Entry、owner、isReplay和已有insert栈。
- insert保存本Story的稳定后继continuation；末尾用end sentinel，返回时不能index+1猜测。
- outcome最多一个transfer或startEntry，必须在列表最后；拒绝转移后仍带动作。
- startEntry仅指ActiveStoryEntry，采用统一卡片合同：不打断blocksInteraction passive；跳过目标Init/triggerCondition；已完成可再开始；isReplay=false；重复奖励依Entry规则。
- 先预检目标存在/类型/非空及当前阻断。失败不清来源链、不执行本次outcome或reply；成功替换来源游标并丢弃其返回栈，不结算被替换链。
- **所有当前页和覆盖层卡片统一走该合同**，删除旧force差异和失败先清游标的路径，不保留legacy模式。

完整播放链结束时，完成/奖励的Story身份统一为**来源Entry.storyId**，不以最后跳转到的StoryDef替代。完成通知、首次/重复奖励、StoryLog、Stats、FollowUp/reactions匹配、尾巴推送、区域投递回执都要同测；区域投递仍精确携带来源Entry.id。实际显示/已读/visited记录仍按当前实际StoryDef，不能全部改成根Story。

replay仍是允许副作用的正式重读：Operation/outcome照常执行，链尾跳过完成奖励/完成写入，分支守卫继续生效；不宣传为编辑器隔离预览。新的行为合同只保留这一种重读路径，不保留旧页解释。

## 5. 分组、推进与纯编译

### 5.1 唯一词法解释

```text
Talklet + 紧邻 Click+ → 一个显示/交互 Step
Talklet + 非 Click   → 显示 Step，按 playback 决定默认点击/自动
独立 Click+         → 无显示交互 Step
Operation           → 自动动作 Step
Transfer            → 自动转移 Step
```

Talklet A, Operation X, Click C：A按自己的默认策略结束，再执行X，再进入独立C组。Talklet A, Click A/B, Operation X：选中outcome先执行；若转移，X不会执行。编译器不得跨Click把X提前成隐式共同onExit。

因此新计划不保留legacy onExit/selectedOutcome槽位、legacyPageIndex或旧首页补丁。选择前共同效果需要在各候选outcome显式声明，或放在明确的前置Operation位置，不创造含糊的“向后收集到哪个Step”规则。

### 5.2 默认点击与节奏

- playback省略为always；没有显式Click的每条Talklet等待默认“点击”，默认Click不写入作者nodes。
- whenNeeded：无显式Click的左侧普通talk允许自动推进；右侧talk与旁白仍等待；末页遵同规则。
- 显式Click永不因whenNeeded被自动跳过。原先无sendText即连发的内容若需要保留节奏，迁移时显式选择whenNeeded，不留旧字段谓词。
- UI负责typing/pause/thinking计时与视觉门控；Runtime决定automatic/implicit/group。UI定时器只通过Controller提交一次带来源令牌的推进，不与领域同步drain重复推进。
- getView/render/按钮查询不执行Operation、不滚随机、不修改作者数据。

### 5.3 计划数据与执行约束

PlaybackPlan至少包含storyDefId、planIdentity、sourceNodeIds、stepKey、完整display(content/presentation/pacing)、interaction/advancePolicy、顺序actions/控制目标、continuation和可读/选择身份。

编译器不读取PlayerState、DOM、服务、真实时钟或随机数；条件和Value在执行时求值。基础编译与校验放data-services，产品服务解释留arona-clicker，不能反向依赖UI或存档实现。

Runtime自动drain至显示/等待/完成/失败。Operation-only和Transfer-only故事允许，设每次推进自动步预算（建议256）及累计控制转移上限32；循环goto同样受限。超限明确停止，不冻结UI。

输入先验clickId、token、条件、press、控制目标、branchGuard，再记录选择与执行。任何预检拒绝无本次效果/回复/游标前进。**不保留旧choiceIndex早写或坏目标晚验的失败副作用。**

Effect执行后如同步事件替换游标，旧drain必须检查generation并停止续写。Action中途晚失败不承诺通用回滚：停止链并给结构化诊断，不自动重试、不重复奖励。异步Action与effect回调中途重入save不在首片承诺，出现真实需求先调整协议与切片。

## 6. 全量内容改写与语义差异

### 6.1 清点范围与退出标准

前次正式base包统计43个Story/118页只是清点起点，不是迁移总数上限。开工搜索全部现役源码与数据：

- 正式base-pack内容、TS作者内容、可选运行包及游戏开发样例。
- datapack-dev中的有效演示包与作者示例。
- tests下Story构造、Builder、阅读/奖励/保存/UI夹具。
- 独立工具的示例、Schema、验证和IO测试输入。
- 当前docs-829及作者说明中的可执行示例。

只读历史快照、归档设计记录不批量改写；不修改dist/node_modules等生成/依赖目录。生成Schema仅由约定命令生成，不手改。所有仍作为有效包/测试输入的第一方内容都必须迁移或明确退役，不能留旧JSON靠拒绝后跳过来伪称通过。

### 6.2 作者迁移表

| 旧表达 | 唯一新表达/处理 |
| --- | --- |
| text/speaker/narration/头像/图片 | Talklet.content/presentation；非法旧组合纠正或拒绝 |
| sendText | 显式Click.clickText，可按作者意图给reply |
| muteReply | 不声明reply |
| choices/condition | 连续Click及其condition，删除文字二次确认 |
| kind=click/clickWork | 独立Click.press，第N次完成 |
| 页共同effects+choice效果+跳转 | 各Click.outcome显式按共同效果→分支效果→转移排列；或重设计为明确Operation |
| 无选择页离场effects | 显式Click.outcome或后继Operation，按需要的等待点选择 |
| jumpToStory/jumpMode | Transfer或outcome末尾transfer |
| kizuna | entryCard+统一startEntry，不保留旧两种启动语义 |
| showChatText/清理/主题/横幅 | Overlay/Presentation Operation或outcome，清晰定位其执行位置 |
| 首页showOpeningTitle | 首个Talklet之前的openingTitle Operation |
| 已读索引/branchGuard页号 | StoryDef+nodeId前置；all仅当前可读Talklet节点 |

可以用一次性离线改写脚本辅助批量编辑，但它必须是**开发期迁移工具**：不进入Runtime/Registry/正式Editor导入，不保留为产品双协议入口。任务结束保留的是新格式内容及差异证据，不是运行时迁移责任。

### 6.3 不要求旧行为逐项等价

每个现役Story列旧意图、新节点排列、明确变化、效果/奖励结果与验证入口。新合同改变的点击次数、选项出现、默认节奏、卡片启动、首页标题、失败保护、完成身份用新预期验收；其余剧情文字、资源/角色奖励、分支意图与入口可达性需核对，不能以“允许破坏式替换”为任意漏内容开脱。

旧实现轨迹仅可在测试基线或迁移说明中帮助确认影响，不是新Runtime必须模拟的合同。不得长期保留旧解释器当产品fallback，不做新编译器与自身互相比对的伪golden。

## 7. Cursor、阅读、保存与交付

### 7.1 只有节点地址

Cursor保存来源Entry、实际StoryDef、planIdentity、当前step/node、交互阶段、锁定clickId、total/done、insert continuations、visitedStoryIds、isReplay、executionId、visitSequence。不再保存旧pending页号/choice索引/talkletIndex恢复路径。

每个返回帧保存storyDefId、planIdentity和nextAddress(node/step或end)。任一当前/返回计划或节点无效，放弃该owner整条链及栈，不补执行、不结算；不影响其他owner，不试旧数组位置或文本相似匹配。

interactionToken是运行时瞬态；View携带token+clickId，Controller原样提交，Runtime先验。start/replace/成功press/advance/transfer/clear/restore更新或作废token；恢复建立新epoch，迟到旧计时器不可复用。持久executionId/visitSequence用于交付去重，token不当存档地址。

### 7.2 阅读与选择

ReadLog只用nodeId与clickId；删除readTalkletIndexes/chosenChoiceIndexes的产品使用，BranchGuard删除talkletIndex（含-1）作者协议，改精确node引用或all-readable。

已读在领域进入显示Step时记录，仍不等于UI送达回执。all-readable仅检查当前定义的Talklet，不要求互斥Click都执行、也不把自动Operation当阅读页。阅读与续播签名分离：plan变化使当前链失效，已读仍按当前存在的可读ID取交集；语义替换应换ID。不存在旧日志转换或版本分支。

### 7.3 旧存档失效

遵守[[docs/docs-829/05-conventions/architecture-discipline]]：存档结构改动不写迁移兼容层。整体拒绝旧Save，按新开局验证，不只清游标后继续旧资源/已读/奖励进度。存档外层使用一个当前格式标记（可沿现有version字段更换值），只检查相等，不维护版本转换表。

必须同时接通writer、SaveSystem.load/import、GameInstance.load及UI。直接load在清任何现有Run/玩家状态前验证格式，返回明确拒绝结果；UI区分missing/invalid/incompatible/ready。旧key仍存在不代表可继续，应允许原始导出保留或新开局。导入旧JSON拒绝，不先写盘。

新格式保存恢复覆盖global、chat与每InitSnapshot、press工作量、返回栈与visited/replay。清理旧SaveData字段及restore缺省回填，不能留下“虽然不读旧档，但仍构造旧游标”的半退役路径。

本Task的清档策略是旧档不再被接受；不自动删除用户文件或LocalStorage槽位。用户触发新开局及后续保存是否覆盖当前槽位须有明确提示。本轮没有执行任何此类写入。

### 7.4 回复与历史顺序

成功输入结果捕获源executionId、visitSequence、clickId、owner/stream。Controller先投递源reply，再同步transfer/startEntry目标首句；不能因来源token已消费丢掉成功回执，也不能取转移后active owner猜归属。失败/working不回复。

display/reply交付identity区分role；同节点再访问以visitSequence区分。重渲染/双击旧按钮/读档不重复，合法再次访问不回收。未送达typing恢复重新投递，已送达automatic页继续pause，always等待。同步命令结果处理完再开放用户保存入口。

## 8. UI、Flow与演出边界

PlaybackView/InteractionView是唯一播放投影。删除以page:旧Talklet为事实源的组合逻辑；ChatStream不扫描nodes决定Operation/转移，只读显示与输入策略。无display的步骤不创建空消息。

正文、reply、图片、头像、旁白沿用共享renderer；Flow实例/逻辑回收ID、Overlay临时ID与Story.nodeId继续分离。新Story协议不接受Flow map/cards或marks来取得领域命令权限。

Overlay/Presentation调用既有服务，保持其当前活跃UI流路由及不保存覆盖层/横幅的边界；本Task不承诺后台owner定向演出或舞台重建。这里是复用服务范围，不是保留旧Story数据。若扩这些能力，另列明确接线和验收，不把它混入兼容残留。

统一startEntry和openingTitle后，相应旧UI handler/facade须删除或改为同一命令入口；不能保留两套“旧send/kizuna”和“新Click”选择规则。

## 9. 校验、引用与作者工具

### 9.1 单协议验证

旧talklets、旧节点流程字段、无nodes的旧Story、旧talkletIndex守卫、旧存档等都要有**拒绝回归**。拒绝应说明目标字段及新模型，不自动升级、不静默丢弃。

新协议校验nodeId唯一/形状、Click组/entryCard限制、press/pacing有限值、reply字段、有限动作列表及唯一末尾转移；建议nodes<=4096、组<=64、outcome<=64。未知type不能跳过执行。

Transfer→stories，startEntry及Overlay.entryCard→activeStories；节点/资源/图片/表现引用同时进入Registry与引用浏览器。引用环境为当前输入包+按现行顺序已经加载的包/依赖，支持同包循环与先加载依赖，拒绝尚不可见目标并提示依赖顺序；本Task不重写全包装载算法。

缓存只服务当前单协议定义和planIdentity，Registry重装必须失效；不存在旧格式兼容缓存。

### 9.2 独立Editor与Runtime浏览

storiesTable直接改为nodes及四节点/有限Action表单，**移除旧表单和格式选择器**，不靠通用JSON框代替完整控件。节点复制生成新ID、移动保留ID；引用候选精确区分StoryDef与Entry。

真实往返：新包导入→内容/表现/节奏编辑→增删复制排序→Click/条件/press/reply/outcome→Transfer/Overlay/Presentation→导出再导入，ID与语义不丢失。合法extra保留，旧包拒绝，Editor不自动转换。

按[[docs/docs-829/05-conventions/schema-sync]]修改源类型与custom元数据，再生成Schema；custom覆盖必须独立测试。RuntimeEditor只适配新Story浏览、引用、计数及来源包导出，不新增Story草稿/热Apply。其导出保留新stories不等于允许导出旧Story有效包。

## 10. 实施切片与退役门槛

依赖为**M1新合同/编译 → M2Runtime/保存/UI → M3全量内容/工具/旧路径退役与联合验收**。可以分片施工，但最终只有新模型；不能把分阶段开发解释为长期兼容。

下表是规划，不是正式Allowed Files。开工依[[docs/ai/PROJECT-CONSTITUTION]]展开精确Unit/Read Set/3–5文件与300–500行预算/Receipt；超预算继续拆。本轮不生成占位源码或实施Unit。

| 片 | 结果/落点 | 前置 | 验收 |
| --- | --- | --- | --- |
| P0 | 全量内容与调用点清单、新旧语义差异矩阵、合同核实 | 无 | 替换方向已确认；没有“还要兼容旧格式”的悬空项 |
| P1a | 新StoryDef/四节点/Action独立类型草拟 | P0 | 单模型字段明确，不先用联合污染现有消费者 |
| P1b | 新结构/引用校验、唯一纯编译器 | P1a | 分组、默认策略、纯度、非法输入及稳定ID通过 |
| P2a | 新Cursor/Action执行/drain/Transfer/统一startEntry | P1b | 无旧页补丁，预算/失败保护/重入安全 |
| P2b | 来源Entry.storyId完成/奖励/FollowUp统一 | P2a | 根完成身份、终端显示身份及区域Entry回执可区分 |
| P2c | 日志/BranchGuard/保存/Init及格式拒旧 | P2a | 全局/owner/返回帧恢复与旧JSON拒绝 |
| P3a | PlaybackView/Click命令/reply与ChatStream接线 | P2a,P2c | 默认/组/press/节奏/历史幂等与回复顺序 |
| P3b | 定位/表现包装与统一卡片/标题入口 | P3a | 能力可达、源流正确，无嵌入执行 |
| P4a | 第一方Story与Builder/样例全量改写 | P1b | 全清单迁移或明确退役，无遗漏活动旧输入 |
| P4b | 测试夹具与新预期、守卫引用全量改写 | P2b,P2c,P3a | 不是保留旧模式只为让测试绿 |
| P5a | 独立Editor唯一新表单/校验/引用/IO | P1b | 无旧协议UI或自动转换 |
| P5b | 游戏内浏览/来源导出/纯读取调用点适配 | P3a,P4a | 只有nodes，无cast/伪talklets兜底 |
| P6 | 公共类型/Datapack/Registry切换、删除旧Story路径 | P2–P5就绪 | 作者、运行、保存、内容和工具一致，只接受新协议 |
| P7 | 联合回归、真实宽屏/Editor验收、文档及集中地图复核 | P6 | 完成定义全部有证据 |

**施工期间的类型/切换纪律：** 可以在测试环境独立开发新类型与执行器，再逐片预适配读取点；这只是开发顺序，不给产品建立双协议。不要先替换公共StoryDef导致全仓报错后放任多个Unit长期不通过，也不要为过渡给新模型加空talklets。正式切换必须同时具备新内容、Runtime、UI、保存和Registry拒旧能力。最终过渡适配器/开关/旧解释器全部退出产品路径。

切换前可采集旧行为用于差异说明，切换后不要求再维护可运行旧oracle。若保留快照夹具，仅作为历史预期或拒绝输入，不作为成功播放输入。

建议新增测试（目前不存在、仅为规划）：

| 目录 | 建议文件名 |
| --- | --- |
| `tests/data/` | `story-node-syntax.test.ts`、`story-node-references.test.ts`、`story-compiler.test.ts` |
| `tests/engine/` | `story-plan-runtime.test.ts`、`story-node-save-resume.test.ts` |
| `tests/ui/` | `story-node-playback.test.ts` |
| `tools/datapack-editor/schema/` | `story-node-schema.test.ts` |
| `tools/datapack-editor/model/` | `story-node-roundtrip.test.ts` |

## 11. 验收矩阵

| 编号 | 输入/情景 | 预期 |
| --- | --- | --- |
| A01 | 新Story及旧talklets/旧流程字段/混搭 | 新模型有效；旧格式精确拒绝，无fallback |
| A02 | 紧邻Click组、Operation打断、开头Click | 最大互斥段/独立组，不跨节点吸附 |
| A03 | always/whenNeeded、右侧/旁白/末页/显式组 | 新默认与自动资格一致，无旧sendText推断 |
| A04 | 选项条件变化、全部不可用、过期token | 阻塞明确，按clickId重验，无本次副作用 |
| A05 | press1/N/rand、候选锁定、保存恢复 | 第N次完成，无额外确认，只滚一次 |
| A06 | 旧共同效果改写后的各分支、终结transfer | 新顺序显式，奖励/分支意图经差异矩阵核对 |
| A07 | talk/narration reply、省略、拒绝、working、跳转 | 成功一次，源reply先于目标首句 |
| A08 | goto/嵌套insert/末尾返回、计划变化 | 稳定帧/明确end；失效整链拒绝，无页号映射 |
| A09 | 纯Operation/Transfer、循环goto、自动超限 | 自动到等待/完成或明确预算错误，不冻UI |
| A10 | Effect批次值、旅行、同步替换游标 | 不改EffectEngine批次，旧命令不续写新链 |
| A11 | 两种旧卡片迁入统一startEntry、非法/已完成目标 | 一种新启动合同，预检失败不清原链 |
| A12 | 根Story→子Story/goto终端→链完成 | 完成/奖励/FollowUp为来源Entry.storyId，阅读仍记实际Story |
| A13 | node/click已读、all-readable、节点增删 | 稳定ID集合；不要求互斥分支全部选择 |
| A14 | global/chat/Init、press/栈/visited/replay | 当前格式保存完整，其他owner不串扰 |
| A15 | 旧save经storage/import/直接game.load | 一致拒绝且先验后动，无迁移或自动删除 |
| A16 | 同文不同node、再次访问、typing未/已送达恢复 | identity区分合法重复，渲染/恢复不重放Action |
| A17 | Overlay临时ID/样式/message/card、主题/标题 | 能力可达、入口可校验；无旧首页特例 |
| A18 | Editor完整往返、新旧包导入 | 新包无损；旧包拒绝，无格式切换器 |
| A19 | 第一方全清单、旧Builder/读取点/测试夹具 | 全部迁移或明确退役，不留有效旧Story输入 |
| A20 | 产品残留检查 | 无双协议、兼容编译、旧页索引/旧守卫、旧表单/导入/存档解释 |
| A21 | MapFlow/卡牌/Flow共享renderer | 直接影响回归正常，不取得Story业务权限 |

拒绝旧格式测试可以保留明确标注的旧JSON，不能以“仓库绝对没有talklets字符串”替代语义审计；Engine演出端口、历史文档或拒绝用例中的同名词不等于旧Story运行路径。残留报告应按生产定义/调用/有效输入分类给出证据。

## 12. 验证与完成定义

本Task属于[[docs/docs-829/05-conventions/testing]]的重要系统结构设计。先定义新行为与内容差异，再实施与独立严格审查；不要求旧Story语义全等价，也不要求每个Unit全量重跑。

现有可重用/需迁移入口：

- Runtime：`tests/engine/story-flow.test.ts`、`story-entry-split.test.ts`、`story-replay.test.ts`、`story-rewards.test.ts`、`story-test-fixtures.ts`、`init-global-lifecycle.test.ts`、`per-init-fields.test.ts`、`def-factory/talklet.test.ts`。
- UI：`tests/ui/story-history-resume.test.ts`、`chat-typing.test.ts`、`story-gate.test.ts`、`flow-entry.test.ts`、`components/chat-text.test.ts`、`components/chat-image.test.ts`；共用呈现影响补map-flow-adapter及地点卡测试。
- 作者：`tools/datapack-editor/schema/engine-schema.sync.test.ts`、`schema/datapack.schema.test.ts`、`model/editor-model.test.ts`、`ui/io.test.ts`；引用与来源导出用`tests/data/runtime-content-reference-rules.test.ts`、`tests/ui/runtime-editor-pack-export.test.ts`。

按片运行相关Vitest；公共契约补npx tsc --noEmit；Schema按npm run gen:schema生成并测custom覆盖；跨层检查npm run check:architecture；文档检查npm run check:docs与diff空白。

最终真实宽屏鼠标验收：从正式入口进入已迁移内容，检验默认点击/选项/多击/转移/卡片/演出/存读档；独立工具真实导入编辑导出再导入。未运行明确写未验收，DOM测试不代替实屏；无豁免时为产品完成门槛。

- [ ] 单一新Story作者合同、编译器和Runtime完成，旧协议有效输入被拒绝。
- [ ] 全部现役第一方Story/Builder/样例/夹具迁移或明确退役，逐Story差异可追溯。
- [ ] 新Click/词法顺序/press/卡片/标题/完成身份按本Task工作，不留旧语义模式。
- [ ] 稳定ID贯穿游标、返回帧、日志、守卫、正文/回复和当前格式保存。
- [ ] 旧存档整体拒绝、全部载入路径一致，无旧字段回填或迁移解释。
- [ ] 独立Editor只有新表单，真实往返通过；游戏内浏览/导出同步。
- [ ] 旧Story类型、Builder输出、解释器、兼容compiler/计划槽、旧索引/表单/导入路径退役。
- [ ] 定向行为/契约/架构/文档检查和实屏验收完成；地图共享层直接影响验证正常。
- [ ] 机制文档、索引、迁移差异及集中GALHCG只读复核收尾，剩余方向明确。

## 13. 风险、边界与剩余工作

允许破坏式替换不意味着可以绕过状态写入口、包归属、领域服务或必要验证。主要风险为内容漏迁、共同效果漏发/多发、根完成身份接线遗漏、drain重入、存档早校验遗漏、无意把通用Engine显示端口当旧Story删除、以及custom Schema假绿。

正式Unit仍按[[docs/ai/PROJECT-CONSTITUTION]]的预算/白名单/事实冲突/必要验证停止条件工作；需要新增机制或超出本Task语义边界时调整Unit。**“旧行为不一致”本身不再是停止理由**，应先查本Task差异合同；已明确改变的规则直接按新预期实施，不因兼容顾虑反复上报。

最终方向仍缺专用Story创作UI、隔离预览/倒带、舞台重建、Embed及业务宿主桥接、Story热编辑；基础替换完成不代表这些已交付。

## 14. 本轮记录与GALHCG

- 前轮完成上层方案阅读及三位Luna事实核查/复审；旧调查保留为当时实现快照，不篡改成新设计事实。
- 本轮按用户补充重写Task，撤销双作者格式/兼容compiler/legacy游标与表单路线，新增全量迁移与退役验收。索引同步。
- 未实施产品、未生成Schema、未新增或重跑游戏测试、未实屏验收、未清档。前次182项通过不计作本Task新模型验证。
- 项目身份前轮已核对为acprogram；本轮变更仅本Task与计划索引，工作节点收尾统一做局部只读changed检查。不写图、不刷新、不写freshness；未索引提示不当作语义通过。
- 本轮交付检查：npm run check:docs通过、errors=0；两文件范围git diff --check通过，仅索引既有换行提示。项目身份已再次核对；Task返回unreferenced_path，索引content_changed，全部9项owner/关联已续读，6项既有Evidence与当前内容不同；索引包含并行任务改动，不把差异全归本次，也未据此改图。

## 15. 相关路由

- [[docs/plan-work/report-0321-story-talklet-capability-investigation]]及其四分册。
- [[docs/ai/goal-workflow]]、[[docs/ai/PROJECT-CONSTITUTION]]。
- [[docs/ai/context-packs/datapack-schema]]、[[docs/ai/context-packs/world-lifecycle]]、[[docs/ai/context-packs/ui-presentation]]。
- [[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/schema-sync]]、[[docs/docs-829/05-conventions/testing]]、[[docs/docs-829/05-conventions/doc-maintenance]]。
