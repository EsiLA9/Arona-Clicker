# Report 0322：旧 Talklet 拆开后，每项功能去了哪里

> 本文回答：正文、choice、底部 Click、回复、效果、跳转、定位气泡和卡片，在 Task 0322 中分别变成什么；它们如何配合，哪里容易重复或误解。

状态：阶段1–5已实现并完成本轮验收；独立编辑工具为阶段6。更新日期：2026-10-23。当前实现与验证见 [[docs/plan-work/task-0322-story-node-model-and-playback-plan]] §15起；当前机制见 [[docs/docs-829/06-wiki/30-arona-clicker-domain/story-and-chat]]。以下先说明实际落点，后面的折叠部分是此前设计调查记录。

## 现在一条剧情怎样工作

可以把它看作顺序写下的演出脚本。正文只负责把话说完，Click负责等人操作，Operation负责做事，Transfer负责换路线。原来的一个Talklet可以写成“正文A → 正文B → 选择 → 共同动作 → 分支动作 → 插播 → 返回”，不再要求一个旧对象对应一个新对象。

| 原来想做的事 | 现在怎么写 | 容易混淆的边界 |
| --- | --- | --- |
| 对话、旁白、图片、头像、左右站位 | Talklet.content/presentation/pacing | 显示完才确认送达；正文里没有藏着的按钮效果 |
| 底部回复按钮 | Click.button，可声明reply | 按钮文字和聊天回复是两回事；未写reply就不回显 |
| choice选择 | Click.choice.options，以optionId提交 | sharedActions只跑一次；只跑选中的result，不跑别的候选 |
| 点N次，然后再确认 | 工作Click.press，再接确认Click | 工作Click正好N次；额外确认是另一个节点，作者看得见 |
| 改资源、flag、角色、好感等 | Operation.state，或输入result.actions | 单个state批次仍由领域服务处理；不同动作已经按脚本先后执行 |
| 移动区域 | travel动作 | 沿正式领域移动命令，notice由来源owner接收；不是嵌入地图玩法 |
| goto/insert | 独立Transfer，或输入result.transfer | insert记住下一节点；回来不重跑刚才的选择和效果 |
| 在坐标(x,y)放文本/消息/邀请 | overlay.show，带显式id | id用于更新/擦除；owner/run决定归属；它不是一条正文历史 |
| 点击卡片进入另一剧情 | Click.entryCard，或overlay中的entryCard | 前者是当前等待输入；后者是可同时显示的邀请。都通过正式Entry准入和确认 |
| 主题、实体表现、开场标题 | presentation命令 | 临时演出按run清理；区域/角色等持久作用域继续走原政策 |
| 闲聊抽取、好感推送、后续投递、区域接取 | StoryService/Entry层 | 放在节点外调度，不能由另一个按钮推进器绕开当前节点 |

地图与卡牌要分清两层：本轮保留定位文本、消息样式和“进入剧情”的邀请卡片；独立Gameplay Map、战斗卡牌与它们自己的Run没有被塞进Talklet。原Flow呈现类型声明不等于已经存在的Story地图生成链。需要新玩法容器时，应给它明确输入/退出合同，不能仅因旧枚举出现过`map`就宣称Node已实现整个地图。

## 它们怎样避免互相抢工作

正文自动接续时，UI只确认自己刚送达的token。底部按钮、选择和卡片提交当前输入token；读档或切换之后旧token失效。选项只负责选中候选，不另外发一轮“按钮效果”。Operation适合独立时刻，result.actions适合“用户确定了以后”，二者共用动作合同；把同一个动作写在两处就会执行两次，程序不会猜作者想去重。

每个owner有独立演出：你打开星野面板时，后台的全局文本、其他角色奖励或旅行通知仍送回原来的流。清理按run执行，结束旧剧情不会擦掉新剧情。存档保存节点位置、多击随机结果、插播栈和表现快照；恢复重新发票据，不重放之前的资源奖励，已显示正文按逻辑身份去重。

正式43篇Story和运行JSON包已切到新结构，作者工厂、Registry引用与Schema同步更新；旧页解释器已退役，旧存档格式明确拒绝。独立Story编辑工具是下一阶段，当前只有可由类型和结构检查约束的作者合同。

<details>
<summary>此前的设计拆分、原语首片和调查证据（历史记录）</summary>

## 播放首片：现在已经能运行什么

现在可显式构造新播放器：依次交付正文，每条确认后继续；阶段末尾开放button、choice或entryCard。多击只在入场抽一次工作量，选择按稳定ID提交并重验条件。查询不会执行动作，旧票据不能重复领取。

选择成功后，先做共同动作，再做候选动作，最后跳转。insert记录整个交互之后的返回点，goto保留外层插播返回栈；链尾交付来源与实际末尾两个身份。资源与表达式批次、旅行、定位文本和入口请求接现有领域服务，执行故障停止来源链，已生效的前序动作不自动回滚。

真实GameInstance样例已经覆盖“正文→选择→共同资源动作→分支批次→插播→返回→旅行→完成”，并检查定位文本ID/坐标、显式擦除、标题事件及不同owner入口。更多边界与验收记录在Task§13及U4–U8收据。

当前还没有屏幕播放Controller、保存恢复、正式内容替换或新链奖励结算。Entry桥接目标仍由现有Entry服务启动；新节点不解释旧talklets。旧Entry含本链访问条件时明确拒绝桥接，避免读错旧链。新链完成不发旧storyCompleted，所以此片明确拒绝story生命周期实体表现和ephemeral主题；持久area/student主题携带旧服务不消费的background也明确拒绝。作者声明保留这些能力，后续补新链清理合同后才能执行。Overlay当前只允许null来源发送全局演出事件，非null来源明确拒绝；Overlay卡片一律待Controller正确传递owner后再支持。Click中的入口卡片已能直接发出Entry请求，两者不能混算。标题目前只接受null来源的显式非空文字，默认来源也待Controller接线。演出事件接线不代表已经通过实屏验收。

## 原语首片：已经写成什么

用户完成Git保存后，三个Luna MAX分工落地作者类型、动作参数、关系检查，并交叉复审。主Agent整合了可检查的S01–S07样例与参数实值。本片没有改旧StoryDef成联合，没有新增两套产品播放解释，也没有启动存档和正式内容迁移。

现在一份新作者文档包含：

```text
StoryNodeDocument
  stages：每个阶段明确 auto（自动接续）或 input（等待显式输入）
  nodes：唯一顺序
    Talklet(stageId)：正文、外观、节奏
    Click(stageId)：button / choice(options) / entryCard
    Operation：状态批次 / 旅行 / 覆盖层 / 表现 / 入口请求
    Transfer：goto / insert
```

**一个阶段是一段连续正文，加上至多一个末尾Click。** input可以没有正文；auto必须有正文而没有Click。Operation/Transfer可以放在阶段之间，不能夹进同一个stageId的正文与Click之间；要么拆两个明确阶段，要么把成功后的动作放在Click结果里。

例如“阿罗娜连说两句，再让老师选择”，两条Talklet与一个choice Click写同一stageId；“老师先敲门，再进门”，两个button Click分别属于两个input阶段。stages不重复存节点列表，不能靠它的键顺序改变播放顺序。

新的动作声明保留：14种有效状态操作及数值表达式/Extra树；旅行目标与notice；定位ID/坐标/适用样式；主题复合参数；实体表现归属/生命周期；标题默认来源；主动/被动Entry请求与全局/角色归属。卡片请求限定主动入口，系统请求仍可指向被动入口；卡片行为与普通/系统启动不被压成同一个强制规则。

两项限制已经能检查：显式typing/thinking只用于非右侧talk；实体主题的area/student scope必须明确对应实体槽。旁白图片、被动卡片、通用target/value状态外壳、loot等有编译拒绝用例。

| 产物 | 它能证明什么 |
| --- | --- |
| `src/data-services/contracts/story-node.ts` | 四节点、阶段与交互结果的声明边界 |
| `src/data-services/contracts/story-node-actions.ts` | 有限动作与参数形状，不提供执行权限 |
| `src/data-services/validation/story-node-structure.ts` | 对typed文档检查阶段/身份/多击与节奏基础约束，不解析任意JSON |
| `tests/data/story-node-authoring.fixtures.ts` | S01–S07等组合及完整状态参数能写成类型实值 |
| `tests/data/story-node-authoring.test.ts` | 组合结构与编译拒绝证据，不是播放器测试 |
| `tests/data/story-node-structure.test.ts` | 阶段错误、身份冲突、数字越界、节奏资格及不修改输入的回归 |

**尚未证明的是实际播放。** 自动阶段如何送达、点击工作量状态、混合Effect批次顺序、入口请求成功/拒绝、奖励完成归属、已读与保存，仍按Task第二轮逐项判断。正式Datapack和现有游戏当前仍使用原StoryDef；新增类型索引不代表独立Editor已获得新表单。

完整字段映射与首片Receipt见当前Task§11–12。以下第二轮中“尚待补定阶段/入参”的问题已由本片声明推进，运行结果类留白继续有效。

## 第二轮覆盖核查：先证明能表达，再讨论引擎

用户补充要求：原功能可以通过多节点拆分、组合逐步实现，不追求一条旧 Talklet 对应一条新 Talklet；当前先讨论第一轮语义拆分，随后再谈详细引擎判断。

本轮由三位 Luna 继续核对交互、旧字段/Effect 参数和显示/业务边界，并由主 Agent回到当前源码复验。结论是：**四类顶层 Node 可以继续保留，但初版的内部结构和相邻分组不足以覆盖原意图。当前可给已核查的单项功能和所列组合找到表达方向；正文与交互的阶段归属、逐op参数与入口请求结果仍需补定，尚不能说作者合同已完整，更不等于引擎支持全部组合。**

### 这轮改了什么

| 初版设计 | 第二轮推荐 | 原因 |
| --- | --- | --- |
| 相邻 Click 自动合并成互斥组 | 一个 Click 是一个交互点，内部明确为 button / choice / entryCard | 连续两次输入不应被误读成二选一 |
| 每个选项各是一个顶层 Click | 一组选项放入一个 Click.choice 的 options | 组边界不依赖插入/移动 Operation |
| 页共同效果必须抄到每个选项 | choice 内可有成功选择后的共同动作，再执行候选动作 | 共同动作不提前执行，也不被分支跳转漏掉 |
| 强制去掉正文确认和多击后确认 | 允许用先后交互阶段组合表达；默认后议 | 作者能力保留与全局点击规则分开 |
| 所有入口启动只剩 Active 卡片合同 | 补回主动/被动入口请求、owner与系统触发意图；卡片另述 | 旧 triggerStory 不是卡片 startEntry 的别名 |
| travelToArea 只有操作名 | 明确保留 notice 提示意图 | 移动提示是已接线能力，不应在拆参数时消失 |
| 全面冻结编译器/Runtime/存档/完成奖励 | 先做语义覆盖，其余列第二轮引擎问题 | 作者结构不能直接推出这些技术与产品选择 |

此外，作者需要能区分“正文A、B一起呈现后给交互C”和“A先确认，再显示B并给交互C”。本轮提出显式呈现阶段/交互归属关系，尚未选定stage声明或正文引用等具体载体。**只证明A→B→C的顺序，不足以证明显示分组已覆盖。** 这应先补在作者层，再谈引擎计时。

这不要求恢复旧JSON兼容。用户允许开发期替换的意见仍保留，但现在没有开始全仓替换，也没有决定一定重写整个 Runtime。

### 当前的四类结构，用人话看

```text
Talklet = 一次正文，里面分内容、外观、节奏
Click   = 一次交互点，里面分单按钮 / 一组互斥选项 / 入口卡片
Operation = 一段要做的行为，里面分状态、旅行、覆盖层、表现、入口请求
Transfer  = 切到哪个 StoryDef，里面分 goto / insert
```

选择组是 Click 的内部成分，不是第五类顶层 Node。动作载荷可被 Operation 与交互结果共享；reply、定位气泡可共享呈现内容片段；共享载荷不等于共享节点身份、生命周期和执行权限。

### 原功能能不能继续表达：第二轮逐项表

“可表达”指能把意图写清楚，不是新 Runtime 已验证。未定默认值、计时或持久化处如实标出。

| 旧能力或组合意图 | 修订后表达 | 结论与边界 |
| --- | --- | --- |
| text、speaker、普通 talk | Talklet.content.talk | 可表达；speaker不等于owner或玩家身份 |
| narration、align | Talklet.content.narration + presentation | 可表达；当前旁白图片不显示，不算丢掉旧有效能力 |
| talk 图片与头像 | content.image + presentation.avatar | 可表达；资源解析规则后续沿真实服务核对 |
| side、noAvatar、showAvatar | presentation.side与明确头像模式 | 可表达有效意图；冲突旧布尔需解释，不机械复制 |
| typing、thinking | pacing | 有去向；当前仅非右侧普通talk、非卡片启用对方节奏，不擅自扩用 |
| 自动连发 | 无中间输入的正文序列表达接续意图 | 顺序能描述；阶段归属、确切自动推进默认和计时后议 |
| 普通正文等待玩家 | Talklet → Click(button) | 可表达，不强制依赖系统默认按钮 |
| sendText、muteReply、玩家回显 | button文案 + 可选reply | 可表达；文案、回显分开 |
| 普通 choices | 一个 Click.choice 内的 options | 可表达；一组内选一项 |
| choice.condition | 对应候选的condition | 可表达资格；隐藏/禁用/重验后议 |
| 先确认正文，再出现选择 | Talklet → button确认 → choice | 可组合；不要求新系统所有选择都这样 |
| 两道连续无正文输入 | button A → button B | 可表达；相邻节点不自动合并 |
| clickWork基础/随机工作量 | button.press | 可表达工作量；随机抽取时机和存读档后议 |
| 工作量填满后额外确认 | press阶段 → 后继button确认 | 可近似支持；不承诺旧进度条在两阶段间逐帧相同 |
| 页effects、没有分支的离场效果 | 明确输入结果或后继Operation | 可表达，作者标清等待点 |
| 页共同effects先于choice.effects | choice成功共同动作 → 候选动作 | 可表达，不再向后猜共同效果 |
| 页级跳转被选项覆盖 | 把目标/模式展开写到各候选结果 | 可表达有效路由，不再依赖跨层字段继承 |
| goto | Transfer或候选结果控制 | 可表达换段，来源Entry仍是另一层 |
| insert与嵌套返回 | Transfer或候选结果控制 | 可表达；交互插播返回整个交互点之后 |
| 正文里的kizuna卡 | Click.entryCard | 可表达邀请；启动准入、重开、打断规则后议 |
| 定位入口卡 | overlay.entryCard | 可表达；宿主不是Click等待点，生命周期另核对 |
| triggerStory目标主动/被动 | 入口请求动作 | **已识别必须保留的语义槽**；不能收窄为Active-only，完整启动模式和结果未定 |
| triggerStory.owner | 入口请求的目标游标/归属 | **已提出参数槽位**；请求其他owner不必终结源链；owner省略与反馈源流程等未定 |
| triggerStory系统意图与普通条件 | 请求来源/启动意图分开 | 必须能区分；现实现force仍检查Init/triggerCondition，不等于无条件启动 |
| travelToArea | 旅行行为 | 可表达剧情移动，不能替换成玩家地图移动 |
| travelToArea.notice | 旅行的可选成功提示 | **已补参数遗漏**；可显示移动迷你条目 |
| 定位text/message、x/y/align | overlay包装器与呈现片段 | 可表达；聊天容器坐标，不是节点/地图坐标 |
| 同临时ID更新、按ID清除 | overlay临时id / clearId | 可表达；不是nodeId与已读地址 |
| 清覆盖层 / 清整条流 | clearAllTexts / clearFlow | 分别保留；当前服务只路由活跃UI流，不承诺跨owner |
| 字体、字号、文字/背景颜色、背景开关 | overlay适用style | 保留适用分支；卡片未消费的样式不算已有支持 |
| default/title/badge/note模板 | overlay.text的变体 | 可表达；title模板与openingTitle横幅不同 |
| 主题colorGroup/palette/tokens/nodes/background/scope/entityKey | presentation.theme完整载荷 | 必须承接，不能只保留“换主题”三个字 |
| 实体表现optionId/owner/lifetime、清除 | presentation实体表现命令 | 必须承接归属与生命周期参数 |
| 开幕横幅与默认标题 | openingTitle + 明确文字/默认来源意图 | 能表达，首页特例/跳转时机/门控后议 |
| 重读、守卫、完成奖励、冷却、后续 | 原Entry与领域层 | 不因拆Node自动退役或改规则 |
| Story外底部按钮触发闲聊/好感推送 | 外层会话调度 | 不新增Node；后续改输入接线时单独回归 |
| 阅读日志、返回点、保存恢复 | 稳定作者身份作为输入 | 不是本轮已证明支持的运行能力，须后续单独验证 |

### 几个最容易看错的组合

```text
先后两次：Click(button「敲门」) → Click(button「进门」)
互斥一次：Click(choice「敲门 / 离开」)

确认再选：Talklet → Click(button「看完了」) → Click(choice[A / B])
直接选择：Talklet → Click(choice[A / B])

选后共同扣资源：Click(choice)
  成功共同动作：扣资源
  A结果：设A标记 → goto A段
  B结果：设B标记 → insert B段
后继Operation：B插播返回后执行；A走goto离开本段

工作量后再确认：Click(button、press=N) → Click(button「确认」)
系统入口请求：Operation(请求被动Entry，在角色V游标启动)
卡片邀请：Click(entryCard，指向主动Entry)
```

完整组合验收样例 S01–S07 已写入当前 Task。不必把全部确认能力做成一堆新开关；先用明确阶段说明意图，再判断引擎是否需要额外阶段载荷。choice的多击候选、多个入口卡互选等属于潜在扩展，不列为保留旧有效能力的必要条件。

### 本轮尚未证明什么

- 没有证明所有现役 Story 都已改写；正式base JSON、TS Builder、可选包、样例、测试夹具仍需后续实际清点。
- 没有证明 Effect 批次拆成多种Action后执行等价；尤其当前运行时请求与状态安装、旅行另批处理要单独核对。
- 没有完成逐op最终字段映射；必须按target、value形状、顶层owner/notice、执行来源核全，不能遗漏ExtraValue或主题/实体表现的复合载荷。
- 没有决定默认点击、输入锁定、抽随机时机、回复投递顺序、卡片强制准入或链尾完成身份。
- 没有冻结PlaybackPlan、compiler、drain、游标签名或存档格式，也没有编写新引擎和执行新模型测试。
- 未实现的loot、Affector声明型上限、旧click+choices等不可靠组合，不作为必须复刻的旧能力。
- MapFlow地图概览/地点卡、mapCards渲染基建、Flow marks/id/repeatPolicy不是正式Story Talklet作者字段；本轮不删除外层能力，也不凭空新增Story权限。

本轮新增核对入口：`src/engine/types/expression.ts` 的 Effect/ThemeEffectValue/EntityPresentationEffectValue；`src/arona-clicker/services/runtime/runtime-effect-reactor.ts` 的 storyEffectRequested 分支；`src/arona-clicker/services/story/story-service.ts` 与 `story-node-player.ts` 的入口及节点执行；`src/ui/presentation/chat-stream.ts` 的节奏门控。这些入口用于核对当前实现与旧语义边界。

复审时还核对了 `src/ui/components/shared/center-panel.ts` 的 renderSendButton 与 `src/ui/components/character/contacts.ts` 的选项显示条件：当前choice通过confirmed控制先确认再显示，并不是按sendText有无决定直接显示。阶段组合用于保留这类意图，不在本轮更改旧UI。

## 初版解读存留说明

**以下 §1–10 解读的是上一版 0322 的“相邻Click自动分组、统一新运行合同”方案，已被本页第二轮核查及当前 Task 调整。它们保留为演进依据，不能作为当前施工合同。尤其其中 always/whenNeeded、第N次完成、强制卡片启动、根Entry完成身份等表述现已回到后续待议。** 初版里的旧源码事实仍可作定位线索，当前事实需回源码核对。

<details>
<summary>展开初版方案解读（历史对照，已调整）</summary>


## 1. 先看一个完整例子

旧模型可以把“阿罗娜说话、显示两个选项、给资源、跳去另一段剧情”全部塞进一条 Talklet。新模型把它写成下面的意思：

```text
Talklet：阿罗娜说「今天先做什么？」
Click A：「先调查」 → 回复「我去调查。」 → 设置调查标记 → goto 调查段
Click B：「先休息」 → 不回复             → 恢复资源     → goto 休息段
```

三个作者节点，实际组成**一轮对话与选择**。A、B 紧挨着，所以是二选一；不会先点 A 再点 B。

这里有四种不同的东西：

- **Talklet Node**：故事里的一次正文显示。
- **Click Node**：作者明确写下的一种玩家输入，可以单独出现，也可以与其他 Click 组成选项组。
- **Action**：输入完成后或运行到某处要做的事，例如给资源、显示覆盖层、跳转。
- **Playback Step**：系统把相邻节点编排后得到的一次执行步骤；一个 Step 可以包含一条 Talklet 和多个 Click。

**因此，Node 不是旧“页”的机械改名，一个 Node 也不保证对应一条气泡或一次点击。** 默认推进按钮甚至可以没有作者 Click Node。

本文所有顺序例子都是语义示意，不是可直接导入的 JSON；正式字段结构以 Task 和实施时的类型、校验为准。

## 2. 四种 Node：分别回答四个问题

| Node | 用人话说 | 内部还能分什么 | 本身会不会等待玩家 |
| --- | --- | --- | --- |
| Talklet | 现在显示什么话 | content：talk / narration；另有 presentation、pacing | 有显式 Click 就等它；没有则看默认推进策略 |
| Click | 玩家现在可以做什么 | 普通 button / entryCard；可带 condition、press、reply、outcome | 会；显式 Click 不会自动略过 |
| Operation | 运行到这里，直接做一件事 | action：effects / overlay / presentation | 不新增自己的确认按钮 |
| Transfer | 运行到这里，切到哪段故事 | mode：goto / insert | 不新增自己的确认按钮 |

把“节点”与“节点里面的类型”画成目录，就是：

```text
Story.nodes
├─ Talklet
│  ├─ content：talk / narration
│  ├─ presentation：气泡、头像、对齐
│  └─ pacing：typing / thinking
├─ Click
│  ├─ presentation：button / entryCard
│  ├─ condition / press
│  ├─ reply：一个 talk / narration 内容片段
│  └─ outcome：行为动作列表 + 可选的末尾 transfer / startEntry
├─ Operation
│  └─ action：effects / overlay / presentation
│     ├─ overlay.show：text / message / entryCard
│     └─ 其他覆盖层清理、主题、实体表现、开场横幅命令
└─ Transfer
   └─ mode：goto / insert
```

这里的 reply、overlay.message、action 都是内部载荷，不是第五、第六类 Node。树中的层级表达语义归属，不指定尚未冻结的 JSON 字段拼法。

“Operation 不等玩家”不等于“演出没有时间”：横幅或 UI 送达门控仍可有显示时长；这里只说它不自带一个新 Click。具体等待谁负责，不能靠作者猜。

### 2.1 Talklet 内部：内容、外观、节奏分开

| 部分 | 放什么 | 不负责什么 |
| --- | --- | --- |
| content.talk | 正文 text、显示名 speaker、可选图片 image | 不因为是右侧气泡就自动认定是玩家 |
| content.narration | 旁白 text | 首片不支持旁白图片；不能接受了 image 却不画 |
| presentation | 左右 side、对齐 align、头像 avatar、头像模式 avatarMode | 不负责浮动坐标 x/y，不决定效果与跳转 |
| pacing | typing、thinking | 不决定选择哪个分支，不执行资源效果 |

旧 noAvatar/showAvatar 两个可能冲突的开关，拟改为 auto/hide/show 一种明确模式。speaker 是显示文字，owner 是入口/播放归属，二者不是同一身份。

### 2.2 Click 内部：按钮、点击过程、回显、后果分开

| 部分 | 人话 | 例子 |
| --- | --- | --- |
| clickText | 按钮上写什么 | 「继续」「打开箱子」「我同意」 |
| condition | 现在能不能选 | 有钥匙才可开箱；提交时再检查 |
| press | 需要点多少次 | 敲三次门；省略为一次完成 |
| reply | 成功后额外说什么 | 按「同意」，玩家气泡说「就这么办。」 |
| outcome | 成功后做什么 | 消耗钥匙、给物品、转到箱内剧情 |
| presentation | 这个输入画成什么 | 普通按钮，或受限制的入口卡片 |

**按钮文字、回复文字和执行效果互相独立。** 按钮叫「打开箱子」，不必让玩家说一遍「打开箱子」；反过来，也可以回显完全不同的句子。

reply 只能是一份 talk 或 narration 内容片段，不是一个新 Node。它没有自己的 choices、press、outcome、跳转或下一步。

### 2.3 Operation 内部：三个动作家族

| 家族 | 能做什么 | 例子 |
| --- | --- | --- |
| effects | 有限的现有状态/旅行操作 | 加资源、给物品、设标记、授予角色、改变好感、旅行 |
| overlay | 显示或清理浮在聊天区上的对象 | 定位说明文字、定位气泡、入口卡；按临时 ID 清掉 |
| presentation | 改表现或发开场横幅 | 换主题、设/清实体表现、openingTitle |

effects 不是把旧 Effect 的所有 op 原样放进来。0322 列的是有限白名单；剧情启动、覆盖层、主题等要走自己的明确动作。未接执行的 loot、声明型上限操作也不会因此获得支持。

Overlay 的 show 再分：text（普通/title/badge/note）、message（talk/narration 内容片段）、entryCard。这里的 title 是覆盖层文字模板；openingTitle 是另一条横幅命令，二者不是别名。

### 2.4 Transfer 内部：换段与插播

| mode | 人话 | 返回与结算 |
| --- | --- | --- |
| goto | 换到另一段接着演 | 不新建来源 Entry；也不自动清掉已经存在的插播返回栈 |
| insert | 暂时插播另一段 | 子段播完后，回到插播点的稳定后继位置 |

Transfer 的目标是 StoryDef。startEntry 的目标是 ActiveStoryEntry：后者是开启另一个入口，替换原链，不是 goto 的另一种写法。

## 3. 旧功能逐项去向表

### 3.1 正式 Talklet 与 choice 字段

| 旧字段/能力 | 0322 下的去向 | 迁移时注意 |
| --- | --- | --- |
| text | Talklet.content 的 text | 旧 click 页的 text 常是按钮文案，应去 clickText，不要额外造气泡 |
| speaker | talk.speaker | 是显示名，不是角色归属外键 |
| kind=talk 或省略 | Talklet.content.talk | 保留普通气泡能力 |
| kind=narration | Talklet.content.narration | 与普通 talk 分清；不承诺旁白图片 |
| kind=click | 通常独立 Click | 不保留“长得像 Talklet、实际只有按钮”的正文类型 |
| image | talk.image | reply/overlay 复用 talk 内容时也可表达图片，按各承载位置验收 |
| side、align、avatar | Talklet.presentation | side 是左右侧；align 是内容对齐，不是坐标 |
| noAvatar、showAvatar | avatarMode | 不再用两个相互打架的布尔值 |
| typing、thinking | Talklet.pacing | 节奏与输入分开；不把 reply 自动当成独立计时正文 |
| sendText | 显式 Click.clickText | 要不要玩家回显，另写 reply |
| muteReply | 不声明 reply | 不再用“有按钮文字，所以默认回复，再加开关压掉”的推断 |
| clickWork | Click.press | 第 N 次达到总数即完成，去掉旧多击填满后的额外确认 |
| choices[] | 紧挨着的一组 Click | 不再嵌在 Talklet 对象中；组内只选一项 |
| choice.text | 各 Click.clickText | 不自动复制成 reply |
| choice.condition | 各 Click.condition | 条件可能变化；显示与提交都要判 |
| 页 effects | 独立 Operation 或显式 Click.outcome | 位置决定时机，不能统一搬到“下一条”就算完成 |
| choice.effects | 对应 Click.outcome 的 effects 动作 | 只执行选中的一项 |
| 页/choice.jumpToStory、jumpMode | Transfer Node 或 outcome 末尾 transfer | 新动作必须明确目标和模式；不再跨页级/选项级分别继承 |
| kizuna | Click.entryCard 或 overlay.entryCard，统一 startEntry | 两种旧卡片路径统一，不保留旧 force 差别 |

旧 choice 中 effects 与页 effects 曾按“页共同效果 → 选中分支效果 → 跳转”执行。新模型没有暗藏的“页离场共同槽”；必须重新写出这个顺序，详见第 6 节。

### 3.2 用户记忆中的丰富显示能力

| 能力 | 旧实现实际在何处 | 0322 下如何表达 |
| --- | --- | --- |
| 定位文字/气泡 | showChatText 的包装对象 | overlay.show 的 text/message；坐标在包装器上 |
| 临时 ID 更新、擦除 | 覆盖层集合的同 ID 替换与 clear | overlay 的临时 id / clearId；不是 nodeId |
| 字体、字号、颜色、背景、文本模板 | ChatTextStyle / 覆盖层模板 | overlay 的适用 style 与 text variant；并非所有分支通吃样式 |
| 定位羁绊卡片 | showChatText 卡片分支 | overlay.entryCard，交互统一 startEntry |
| 主题/实体外观 | 现有表现服务与 Effect 请求 | presentation 动作 |
| 开场标题横幅 | 首页 effects 的特殊处理 | 显式 openingTitle；作者按顺序放置 |
| 地图概览、地点选择卡 | Gameplay B 的 Flow 投影与宿主命令 | 仍由 Map/Flow 负责，0322 不新增 Story 地图节点 |
| 玩法卡牌展示接口 | FlowMapCard 及相关渲染基础 | 不变成 Story 的 Card Node；前轮未发现 mapCards 的生产生成链 |
| Flow 内容 ID 与重复策略 | Flow DTO/适配基础 | 不是 Story 的作者节点字段，不因拆 Node 自动开放 |

这部分有些原本就是 **Story 调用的演出服务**，有些是 **别的业务复用同一种聊天外观**。它们不能一律算成旧 Talklet 的内置字段，更不能为了“保留功能”凭空造 MapNode/CardNode。

## 4. choice、底部 Click、默认按钮到底是什么关系

### 4.1 四种肉眼看起来相似的按钮

| 玩家看到什么 | 作者写什么 | 是否一定有 Click Node |
| --- | --- | --- |
| 普通正文后的默认「点击」 | Talklet；默认 always | 否，由系统生成推进交互 |
| 自定义「好的」「开门」 | 一个显式 Click | 是 |
| 「调查 / 休息」多选项 | 两个紧邻 Click | 是，两个候选同属一组 |
| 需要多点几次的按钮 | Click.press | 是，计数属于该输入 |

底部区域只是界面位置，不是第五类 Node。它可以承载默认推进、显式单按钮、多击过程或选项交互。**0322 统一了交互语义，并未提供完整的新按钮布局设计。** 多选项是否仍在旧位置、禁用项如何呈现，需要 UI 合同/实屏确认，不能从 Node 名字推出。

“没有正在播放的 Story 时，点击底部按钮触发闲聊/好感推送”是当前外层会话行为，不是正在播放的某个 Click Node。0322 未承诺删除它，也未把它变成作者节点；实现时需单独保留或明确调整，不能在删旧 clickSend 时顺手丢失。

### 4.2 新模型主动改变的两件事

旧 choice 页可能先要求点击确认正文，之后才出现选项。新合同是：**正文送达并完成 thinking 后，直接出现显式选项。** 不再额外点一次“显示选项”。

旧多击在 total>1 时，前 N 次填进度，之后还要再确认一次。新合同是：**第 N 次就完成。** 当总数为 3，三次点击足够。

### 4.3 默认推进与显式 Click 谁优先

| 情况 | always（省略时默认） | whenNeeded |
| --- | --- | --- |
| 左侧普通 talk，后面没有附属 Click | 等默认点击 | 送达/节奏完成后允许自动继续 |
| 右侧 talk | 等默认点击 | 仍等默认点击 |
| narration | 等默认点击 | 仍等默认点击 |
| 直接附属一个或多个 Click | 等显式输入 | 仍等显式输入 |

显式 Click 替代该轮的默认推进，不能再叠加一个默认按钮让玩家绕开选择。whenNeeded 也不能绕过显式 Click。最后一句同样按表执行，不会因为“到末尾了”偷偷改变策略。

默认推进按钮没有作者 reply；要定制文案、回复、条件、多击或后果，就应写显式 Click。

### 4.4 多击与条件怎样一起工作

进入组时才初始化候选点击总数，查看界面不抽随机；读档保留总数和进度。公式为 base + floor(random × rand)，省略 rand 时不加随机量；rand>0 的增量范围是 0 到 rand−1，不是 0 到 rand。

多个候选中一旦开始某项多击，就锁定该 clickId，不能点 A 一半再改 B。过程中条件失效，保留进度并阻塞，不重抽；所有候选都不可用时整组停住，不自动跳页。具体显示锁定和阻塞的视觉方式仍需设计。

## 5. 节点之间靠什么建立关系：先看相邻，再看动作

```text
Talklet + 紧邻 Click、Click…  → 一轮正文与互斥输入
Talklet + 其他类型           → 正文自己按默认策略结束
没有紧邻前置 Talklet 的 Click → 独立输入，不造空白气泡
Operation                    → 自动执行，打断 Click 的相邻归属
Transfer                     → 自动转移，打断 Click 的相邻归属
```

这里的“相邻”是作者 nodes 数组中真正挨着，不是屏幕上看起来挨着，也不会跳过 Operation 向前找正文。

### 5.1 同样三个东西，换位置就换意思

| 排列 | 玩家体验/执行顺序 |
| --- | --- |
| Talklet A → Click C → Operation X | 显示 A，等 C；完成 C 的后果后，若仍留在本链后继，再执行 X |
| Talklet A → Operation X → Click C | A 先按默认策略结束；执行 X；再单独等 C |
| Operation X → Talklet A → Click C | 先执行 X，再显示 A 并等 C |

如果 A 采用 always，第二行可能要“默认点一下 A，再点 C”两次。若 A 是可自动的左侧 talk 且采用 whenNeeded，则第一下可以省去。**把 Operation 插进正文与 Click 之间，会改变分组与点击体验。**

### 5.2 连续 Click 绝不是连续两道问题

```text
Click「敲门」
Click「进门」
```

在 0322 里，这是“敲门 / 进门”二选一。它不是“先敲门，再进门”。

若真想连续两道输入，应有明确的阶段边界。例如：

```text
Click「敲门」
Talklet：屋里传来「请进」
Click「进门」
```

这样第一次是独立输入；第二次附属于屋内回应。也可由真实需要的 Operation/Transfer 分隔，但不要为了切组塞无意义动作。**首片没有 ClickGroup Node 或显式 groupId；能否提供无正文、无副作用的纯分组边界，是待讨论的表达能力，不能假装已经支持。**

### 5.3 连续 Talklet 也不共享同一组选项

```text
Talklet A：「先说一件事。」
Talklet B：「现在你选什么？」
Click C / Click D
```

C、D 只附属于 B。A 自己按 always/whenNeeded 决定是否等待。不能因为作者认为 A、B 是同一段话，就让最后的 Click 自动管住整段。

## 6. 效果与跳转：最容易“看着一样，结果不同”的地方

### 6.1 选择后的共同效果放在后面，有时根本不会执行

```text
Talklet：「走哪条路？」
Click A → goto 山路
Click B → goto 河路
Operation：扣除一天时间
```

这个例子里的 A/B 都采用 goto，后面的扣时间就被绕过。它不是两个选项的共同离场效果。

若改为 insert，情况不同：按统一插播语义理解，应先演子段，返回后再执行组后 Operation。不过 Task 对 outcome.insert 的返回锚点没有单独写明，且 §5.1 的“若转移，X 不会执行”过于笼统；需要补明“返回 Click 组之后”，再把这一点作为实现验收。不能把 goto 的绕过规则直接套给 insert。

若意图是选哪条路都扣时间，要在每个候选的 outcome 里明确写：

```text
Click A → 扣一天 → 设置山路标记 → goto 山路
Click B → 扣一天 → 设置河路标记 → goto 河路
```

另一种设计是把扣时间放在选择之前的 Operation；但这会变成**没选也先扣**，还会改变相邻分组，不能当作等价优化。首片没有公共 outcome 或可复用动作宏。

### 6.2 独立 Operation 与 Click.outcome 是“相同能力，不同时机”

- 需要“走到这里就发生”：用 Operation，例如开场换主题。
- 需要“这次输入成功才发生”：用 Click.outcome，例如购买成功扣钱。
- 不要在两处重复写同一个加资源动作，系统不会因为内容相同就替作者去重。

Action 列表按顺序解释；但一个 effects 批次内部仍采用既有 EffectEngine 的整批规则，不意味着数组中每个 Effect 都变成一套逐项交错事务。

### 6.3 Transfer Node 与 outcome.transfer

二者复用同一种转移含义：前者运行到就跳，后者选中且完成输入后才跳。一个 outcome 最多一个 transfer 或 startEntry，并且必须放最后；不能“跳走以后继续发来源动作”。

目标、条件、守卫等应先检查。预检失败，不执行这次 outcome、不回显、不推进。已经开始执行后才发生的晚失败，0322 不承诺把前面的资源变化通用回滚。

### 6.4 insert 的“返回后继”与 goto 的“离开”要一起看

```text
主段：Talklet A → insert 支段 → Talklet B
支段：Talklet C → 结束
结果：A → C → B
```

若支段又 goto 到第三段，已有插播返回栈仍在；第三段正常结束后仍可能回到 B。goto 不是“永远抛掉所有返回点”。若要彻底换到另一个入口，应考虑 startEntry，其替换链语义不同。

### 6.5 完成奖励属于来源入口，阅读属于实际经过的段落

来源 Entry E 指向 Story A；A 跳 B，B 又跳 C，最终结束：

- 完成/奖励按 E.storyId（这里是 A）结算；不用最后的 C 替代。
- 读过 B、C 的哪些节点，仍记在 B、C 的稳定节点上。
- 若中途 startEntry F，原链被替换，不结算原链；之后按 F 的链处理。
- replay 仍执行节点效果，只抑制链尾完成/奖励；不是无副作用的编辑预览。

因此，节点拆开之后仍不能把所有奖励都塞进 Click：入口完成奖励、条件奖励、FollowUp/reactions 继续是 Entry 的工作。

## 7. 看起来重叠的功能，哪些应该保留，哪些需要约束

| 看起来重叠的两处 | 实际关系 | 作者怎么选 |
| --- | --- | --- |
| Talklet.content / Click.reply | 同一内容结构，两个不同出现时机 | 正文写前者，成功输入后的回显写后者 |
| Talklet.content / overlay.message | 同一内容结构，历史正文与定位覆盖层两种承载位置 | 需要正常聊天用前者，需要浮动演出用后者 |
| Operation.action / Click.outcome | 共享动作，执行触发不同 | 自动到达 vs 输入成功 |
| Transfer Node / outcome.transfer | 共享转移，执行触发不同 | 无条件接段 vs 选中某分支接段 |
| Click.entryCard / overlay.entryCard | 共用入口启动命令，交互宿主不同 | 故事等待点上的卡 vs 浮动在界面上的卡 |
| 默认推进 / 显式单 Click | 界面都可能只有一个按钮 | 只继续用默认；需要作者配置用显式 |
| side=right 的正文 / talk reply | 外观可相似，身份与来源不同 | 不以左右侧代替玩家身份判断 |
| overlay.text 的 title / openingTitle | 都能写标题，生命周期不同 | 定位对象 vs 独立限时开场横幅 |
| Entry.triggerCondition / Click.condition | 一个控制普通入场，一个控制当前输入 | 不因为 Click 有条件就默认重新检查 Entry 的全部条件 |
| Entry 完成奖励 / outcome.effects | 链尾结算 vs 当次输入效果 | 同一份奖励写两边会重复发放 |

前三类复用有价值：内容怎么画、动作怎么执行可以共享。危险的是**把共享载荷误当成共享生命周期**，例如认为 reply 也能阻塞、覆盖层气泡也能推进 Story、overlay 卡一定是当前选项。

### 7.1 两种 entryCard：命令统一，玩家所处的状态仍不同

Click.entryCard 是故事的显式输入：单卡组、不支持 press、末尾动作必须是 startEntry。overlay.entryCard 是由演出命令摆出的可交互卡片，不把当前 Story 步骤变成 Click 组。

二者都要调用统一 startEntry：目标仅 ActiveStoryEntry；跳过目标 Init/启动条件；可再次开始已完成内容；不能打断 blocksInteraction 的被动剧情；预检失败保留原链。成功是新播放，不是 replay，重复奖励仍按入口规则。

但两张卡能否同时可点、旧覆盖层卡在当前步骤变化后是否仍有效、一次点击与原 Story 自动推进如何竞争，**0322 只给出了统一命令和链替换原则，没有完整的覆盖层交互令牌/生命周期合同**。需要补定，而不是从“共用 startEntry”推断它们完全等价。

### 7.2 三种位置，四类 ID，不要混填

| 概念 | 作用 | 不是 |
| --- | --- | --- |
| side | 气泡在左还是右 | 玩家身份、浮动坐标 |
| 内容 align | 文字/旁白的对齐 | 覆盖层的屏幕位置 |
| overlay x/y + 包装器 align | 在聊天容器中定位并对齐整个对象 | 地图坐标；当前原点为左下，范围 0..1 |
| StoryDef.id | 哪一段演出 | Entry.id |
| Entry.id | 哪一个入口及其结算/owner配置 | Transfer 的 StoryDef 目标 |
| nodeId / clickId | Story 内稳定节点身份；clickId 是被选 Click 的身份 | 覆盖层临时 ID；不是又一套独立作者选择 ID |
| overlay 临时 id | 更新/擦除某个浮动对象 | 已读节点、返回地址、Flow 实例键 |

运行时另有 executionId、visitSequence、interactionToken 与 Flow 实例键：它们用来区分本次播放、再次访问、过期输入和 UI 实例。作者不应手工把这些填成 nodeId。节点重排保留 ID，复制生成新 ID，语义完全替换应换 ID。

Overlay 仍复用当前活跃 UI 流路由，不能因为 Story 有 owner 就承诺覆盖层定向投递给后台 owner。覆盖层与横幅也仍是临时演出，0322 不承诺读档重建舞台。

## 8. 一份旧内容，拆完后的完整观看顺序

假设作者要“先显示标题，阿罗娜问要不要开箱；开箱需三击，成功后玩家回复、给物品，再插播箱内说明，返回后继续”。推荐语义排列是：

```text
Operation：openingTitle「旧仓库」
Talklet：阿罗娜「要打开这个箱子吗？」
Click A：「打开」
  condition：有钥匙
  press：3
  reply：玩家「让我试试。」
  outcome：消耗钥匙 → 给物品 → insert 箱内说明
Click B：「算了」
  reply：省略
  outcome：省略
Talklet：阿罗娜「我们继续吧。」
```

按“outcome.insert 与独立 insert 共用语义，返回组后后继”的推荐解释，玩家看到的应是：标题 → 问话 → 两个选项。选 A 后锁定 A，前两击只增加进度，第三击完成；源玩家回复进入历史，再交付插播的第一句；支段结束回到「我们继续吧」。选 B 则不进支段，直接进入后一句。该返回锚点仍须按第 9 节补入 Task，不能用示例代替合同。

按钮叫「打开」而回显「让我试试」，两者不必相同。开箱资源与钥匙变化只写 A 的 outcome；不能放进 A/B 后面而误让 B 也领取。若目标/守卫等预检失败，不能先扣钥匙或先让玩家回复。

标题的计时门控沿既有演出服务处理；这里表示词法执行顺序，不额外承诺标题与气泡是否完全串行显示。

## 9. 目前还不能用一句“拆开了”掩盖的空白

以下是阅读 0322 时需要带给上层思考的点，**不是本文擅自新增的已定需求**：

| 问题 | 0322 已定到哪里 | 尚需明确什么 |
| --- | --- | --- |
| 两道无正文、无副作用的连续单按钮 | 连续 Click 必须互斥 | 是否接受表达限制，还是以后加显式分组边界；首片不能伪称已经支持 |
| 条件不满足的选项 | 要评估/重验；全不可用要 blocked | 隐藏还是禁用、原因怎么展示、外部变化如何刷新 |
| 多击选项 | 候选初始化、开始后锁定、失效保留进度 | 锁定后其他候选怎么画；何种外部操作能中止 |
| 默认按钮与显式按钮 | 语义分清、默认不需作者节点 | 最终文案/位置、特殊旁白和卡片布局，不等于已做新 UI |
| reply 的表现 | 只有一个内容片段；talk 强制玩家身份 | 不拥有完整 Node.presentation/pacing；哪些外观沿默认投影需要明确 |
| 覆盖层卡与当前 Click 并存 | 同一 startEntry；预检后替换链 | 旧卡有效期、并发门控、来源令牌与跨流切换 |
| 旧 triggerStory | 新剧情启动限制为 Active startEntry | 对旧被动入口触发/普通入场检查意图，须逐内容查有无使用；不能自动当成等价迁移 |
| 旧 Effect 附加参数 | 已列出允许的操作和服务边界 | travelToArea 的 notice、剧情启动的 owner 等有无现役使用；应明确保留或退役，不默默丢掉 |
| openingTitle 默认文字 | 已改为词法位置执行 | Entry.openingTitle、Story.name 等默认来源的优先级是否保留，Task 尚无完整新载荷表 |
| overlay 样式、theme 与实体表现 | 已有有限命令家族，复用服务 | 完整字段、引用、清理语义与组合校验，需类型及表单合同落地 |
| 旅行和输入组合 | 保留现有旅行专门调用与批次边界 | 旅行改变场景后，来源后继/新事件接线须用用例核实，不能宣称全事务 |
| 旧非法混搭 | 新模型要明确校验 | 旧 click+choices、narration+image 等应按意图重写或拒绝，不机械搬字段 |
| insert 后的共同后继 | 独立 insert 保存稳定后继、结束后返回 | Task §5.1“转移后 X 不执行”应区分 goto 与 insert；建议明确 outcome.insert 返回 Click 组后再执行 X，而非永久跳过 |
| 故事外底部闲聊按钮 | 当前有好感推送/闲聊调度 | 删除旧 Story 按钮链时，外层行为的接线与回归要明确归属 |

其中“Operation 与 outcome 都能发效果”“Transfer 有独立和输入后两种入口”不需要先删一处才能清晰；它们的区别就是触发时机。真正需要防住的是：同一副作用写两遍、同一按钮两套推进、卡片绕过输入门控、以及把视觉复用误当成业务权限。

## 10. 调查依据与使用方式

本轮由主 Agent 与三位 Luna 分别核对旧字段去向、Click/choice 关系、演出与功能重叠。依据分两层：

- **计划规则**：[[docs/plan-work/task-0322-story-node-model-and-playback-plan]] §4–9；本文只作人话解读，有待补定处集中列在第 9 节。
- **旧实现事实**：作者类型与下列源码；前轮报告用于定位，不能替代当前文件。地图/卡牌的“未发现生产生成链”沿用前轮证据范围，不宣称对全仓未来状态的证明。

| 证据入口 | 本文核对的内容 |
| --- | --- |
| `src/data-services/contracts/story.ts` | Talklet、StoryChoice、StoryDef 的旧字段全集 |
| `src/data-services/contracts/story-entry.ts` | Entry 入口条件、奖励、守卫、openingTitle、后续职责 |
| `src/arona-clicker/services/story/story-service.ts`、`story-node-player.ts` | clickSend、advanceStory与节点执行；显式输入阶段和节点顺序 |
| `src/arona-clicker/services/story/story-node-player.ts`、`story-service.ts` | transfer、insert及会话完成路径 |
| `src/ui/presentation/chat-stream.ts` | 内容送达、连发、覆盖层集合与清理 |
| `src/ui/flow/flow-entry.ts` | Flow 逻辑身份、呈现类型与 Map 载荷边界 |
| `src/engine/contracts/chat-presentation.ts` | 定位覆盖层与样式契约 |
| `src/ui/components/story/story.ts` | 覆盖层正文、气泡、入口卡的呈现分支 |
| `src/data-services/registry/runtime-content-reference-rules.ts` | StoryDef / Entry / 演出引用的区别 |

完整旧能力证据见 [[docs/plan-work/reports/story-talklet-investigation/runtime]]、[[docs/plan-work/reports/story-talklet-investigation/position-id-presentation]]、[[docs/plan-work/reports/story-talklet-investigation/flow-map-cards]]、[[docs/plan-work/reports/story-talklet-investigation/authoring-and-validation]]。

本轮只交付调查说明及索引，不改 Task 合同、产品实现、Schema 或存档，不把旧实现测试通过算成新 Node 模型验证。

</details>

</details>
