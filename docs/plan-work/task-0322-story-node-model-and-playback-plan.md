# Task 0322：Story 第一轮作者语义拆分与旧能力覆盖核对

状态：semantic-review — 第一轮语义方案与静态覆盖调查已更新；尚未进入引擎设计冻结或产品施工。更新日期：2026-10-23。

> 本轮回答：把旧 Talklet 拆成多类 Node 及其内部成分后，作者还能不能表达原有功能？允许一条旧 Talklet 拆成多个节点、多个阶段，也允许组合改写；不要求逐页一一转换。

## 1. 本轮方向与结论

用户最新要求是：先考虑第一轮拆分语义，随后再考虑详细引擎判断。**本 Task 据此收回上一版把作者拆分、玩法变化、编译器、Runtime、保存与全量内容切换一次冻结的范围。** 本轮只交付作者语义边界、能力覆盖证据、组合示例与后续问题。

用户此前允许开发期全量替换、不保留版本兼容，仍作为未来落地的可选约束保留；它不代表必须现在重写整个引擎，也不代表可以默认丢掉旧功能。本轮不新增兼容层、不迁移内容、不清档、不修改产品代码。

**核查结论：四类顶层 Node 有继续承载旧有效能力的可行方向，但现在不能回答“已经完全支持”。** 上一版需要改为显式交互组，补上入口启动请求、旅行提示、共同结果动作与多阶段输入，还需要明确正文与交互的阶段归属、完整动作参数目录。当前可以给已核查单项能力和所列组合提供表达方案；尚不能宣称作者合同已经完整、新引擎已支持、全部实际内容迁移无损，或任意旧字段混搭都应继续有效。

本轮优先保住作者意图，例如“先确认再选择”“多击之后再确认”“选择后共同扣资源再分支”，而不是保住旧对象的形状、旧按钮处理函数或偶然失败副作用。

## 2. 什么叫支持原语义

### 2.1 验收口径

支持按三层判断：

1. **单项能力有去向**：正文、图片、输入、效果、跳转、演出、入口请求等有明确承载者。
2. **组合意图能表达**：能标明先后、互斥、共同结果与分支结果，不因字段拆开就漏掉动作或改变分支含义。
3. **运行行为待验证**：什么时候算送达、具体点击几次、效果批次求值、失败保护、保存恢复等，另做引擎合同和行为测试。

前两层是本轮交付。第三层未完成不能用文档示例冒充；发现会影响作者表达的第三层问题，应留下语义需求，再交后续设计处理。

允许通过以下方式支持：一条旧 Talklet 拆为正文、输入、行为、转移多个节点；旧选项转为一个交互点内的多个候选；共同效果显式分组；确认和多击拆为先后阶段；复用现有 Effect、入口和演出服务。

不要求支持：旧无效字段组合、未接执行的声明、失败时错误回显/先清链等偶然行为。需要分别说明“不支持的原因”，不能把这些和真实能力一起默默删掉。

### 2.2 本轮不做的判断

本轮不规定一定要新建 PlaybackPlan/纯编译器、不规定重写 StoryService、不规定保存格式或旧档处理、不规定一次性切换路径。也不借此决定完成奖励身份、所有卡片的强制启动规则、自动推进默认值与新点击次数。

## 3. 第一轮推荐语义模型

以下是**作者概念模型**，不是已经冻结的 TypeScript/JSON schema。英文子成分名用于讨论；字段拼法、默认值和校验上限后续再定。

Story 本身继续表达 id、name、extra；演出序列拟由 nodes 承接。它与 StoryEntry 仍为分别引用的对象，不把 Entry 内联并入 Story。数据格式最终切换与导入拒旧策略留到落地阶段，不以本轮示意类型制造长期双协议。

```text
StoryEntry：条件、owner、完成奖励、后续
  └─ storyId 引用 StoryDef（独立对象，不是内联子对象）
StoryDef：id、name、extra
└─ nodes：按作者顺序组织
   ├─ Talklet：一次正文呈现
   │  ├─ content：talk / narration
   │  ├─ presentation：侧别、对齐、头像等
   │  └─ pacing：输入中、思考等节奏意图
   ├─ Click：一个明确的交互点
   │  ├─ button：一次按钮输入，可有多击工作量
   │  ├─ choice：明确包含一组选项，组内互斥
   │  └─ entryCard：入口卡片交互
   ├─ Operation：到达这里要执行的行为
   │  └─ 行为载荷：状态效果 / 旅行 / 覆盖层 / 表现 / 入口启动请求
   └─ Transfer：StoryDef 之间的控制流
      └─ goto / insert
```

**重要修订：相邻 Click 不自动合并。** 一个 Click 是一个交互点；需要二选一时，在该 Click 内明确写 choice.options。连续两个普通 Click 自然表示两道先后输入。仍只有四类顶层节点，不为选择组增加第五种 Node。

顺序用于说明作者意图。正文与输入的作者归属见下节；它们怎样投影到一个 UI Step、是否存在系统默认按钮、引擎如何推进，本轮不靠“相邻吸附”预先决定。

### 3.0 呈现阶段归属：还需有一个明确的编排关系

只写A→B→Click还不够说明：A、B一起呈现后给选项，还是A先等待、再显示B并给选项。**这是作者语义缺口，不能全推给引擎。** 本轮提出需要一个明确的“呈现阶段/交互归属”概念，把一条或多条正文与一个交互点关联起来：

```text
同一阶段：[正文A，正文B] + 交互C
两次等待：阶段1[正文A] + 交互确认 → 阶段2[正文B] + 交互C
纯交互阶段：无正文 + 交互C
```

此关系不是第五类可执行Node，不藏效果或转移。可用阶段声明、正文引用或其他明确结构实现，具体schema尚未确定；本轮不先增加一个复杂容器。节点移动或插入Operation不能无声把两道输入合并成选择组。

在此关系冻结前，本文例子证明的是顺序与分支意图，**没有完全证明正文/选项显示分组的覆盖**。后续首先补定这个作者层问题，再进入引擎时序。

### 3.1 Talklet：内容、外观、节奏

- content：talk 保留 text、speaker、可显示图片；narration 保留旁白文字。
- presentation：side、align、avatar、明确的头像模式，承接 noAvatar/showAvatar 的有效使用意图。
- pacing：typing/thinking 的节奏表达与适用对象需保留。当前只对非右侧普通 talk、非卡片启用对方输入/思考节奏；不因搬字段就向旁白、卡片、右侧消息扩大。
- speaker、玩家身份、Entry.owner 分开；气泡在右侧不等于玩家。
- Talklet 不再直接装 choices、资源效果和跨 Story 跳转。

正文停下来等输入，可写后继 Click；连续发言可由无输入间隔的正文序列表达自动接续意图。是否有隐式等待、何种默认值更合适，留到引擎/UI轮。必须同时保留“可连续”和“可等待”两种能力，不能先默认全部都等或全部都自动。

旧 narration.image 虽在宽接口中可写，当前旁白 renderer 不显示；不把它算成已工作的旧图片能力。若要支持旁白图片，列为扩展。

### 3.2 Click：显式交互点及其内部形式

| 内部形式 | 语义 | 内部成分 |
| --- | --- | --- |
| button | 等一次明确的玩家输入 | 文案、可选按击工作量、可选回复、成功结果 |
| choice | 在本交互点的候选中选一项 | options；每项有独立身份、文案、condition、可选回复、分支结果 |
| entryCard | 用卡片邀请进入另一个入口 | ActiveStoryEntry 引用、标题/按钮文案/对齐、入口启动意图 |

condition 是可选项能否被选择的资格；不是整段 Story 的普通启动条件。候选应该拥有稳定身份，不能靠过滤后的位置表达“选了谁”；确切持久化地址留到引擎轮。

button 的 press 表达多击工作量与可选随机增量。一次输入有文案，不意味着一定回显玩家气泡：reply 明确给出才有，省略即可承接 muteReply。

选择组可以有**成功选择之后、分支结果之前的共同动作段**，再加各选项自己的结果。此概念承接旧页共同 effects；具体字段可叫 sharedResult 等，尚不冻结名字。无须每个分支手抄一份相同动作，也不能把组后的普通 Operation 偷当成共同动作。

reply 使用不带节点身份的呈现内容片段，承接普通玩家回显；如允许 narration/image 等组合，须单独标作扩展或复用能力，不把它说成旧 choice 已有的回复行为。reply 不携带交互、效果、流程或递归节点。

多击候选、多个入口卡互选、每个候选独立多击等，不是覆盖旧有效 choice 所必需。本轮不因结构上可组合就承诺这些扩展。

### 3.3 用阶段组合保留确认意图

```text
先敲门再进门：Click(button「敲门」) → Click(button「进门」)
正文确认再选择：Talklet → Click(button「看完了」) → Click(choice[A / B])
多击再确认：Click(button「检查」、press=N) → Click(button「确认完成」)
直接选择：Talklet → Click(choice[A / B])
```

这些都是独立可表达的作者意图。旧多击的随机工作量与后续确认可拆开，因此不必为了复现一种旧体验给所有 press 固定增加一次确认，也不必现在决定全产品统一删掉确认。

上述示意中的 press=N 表示“完成 N 次工作量的阶段”，不是对旧 clickWork 参数如何一一换算的承诺。是否需阶段内确认配置、进度条在确认阶段如何保留，以及未完成时的锁定与取消，待引擎/UI核对；不能靠这个静态例子宣布像素与时序完全等价。

### 3.4 Operation 与共享行为载荷

Operation 是节点；Action/行为段是内部载荷。**共享的是行为数据，不是把 Operation Node 连同节点身份、运行状态塞进 Click。** 不引入任意脚本或递归流程来掩盖表达缺口。

| 家族 | 必须承接的原能力/参数 |
| --- | --- |
| 状态效果 | set/addResource、set/addSpotLevel、setManager、addEnhancement、addItem、unlockInit、setFlag、set/add/removeExtra、grantCharacter、addAffectionExp；保留适用的 target/value、ValueExpression与ExtraValue |
| 旅行 | travelToArea 的目标与 notice 提示意图；这是剧情要求移动，不能默认为玩家地图点击 |
| 覆盖层 | show、clearId、clearAllTexts、clearFlow；保留临时 ID、定位、适用样式和清理范围区别 |
| 表现 | theme、set/clearEntityPresentation、openingTitle；保留主题 scope/entityKey、表现 owner/lifetime、标题文字/默认来源等语义槽位 |
| 入口启动请求 | 旧 triggerStory 的目标 Entry、active/passive 类型、owner/目标游标、系统触发意图；不能缩成 Active 卡片启动 |

这一表是已有执行能力覆盖表，不是向所有业务开放任意 Effect.op。set/removeSpotMaxLevel 属于 Affector 声明，loot 前轮未找到执行接线，不因为出现在 EffectOp 就承诺 Story 运行能力。

表内是必须承接的参数目录，**不是所有op已完成最终字段映射**。作者合同冻结前，还需逐op登记 target、value形状、顶层owner/notice和执行来源：owner/notice在旧Effect顶层，不是任意value内字段；theme的palette/tokens/nodes/background与ExtraValue也不能漏。clearFlow当前服务实际只处理活跃UI流，不能从旧注释的target推导出有效的后台定向清理。

Overlay.show 的内部内容分 text（普通/title/badge/note）、message（对话/旁白呈现片段）、entryCard。包装器负责 x/y、临时 ID、适用 style；内容片段不执行自己的 choices/effects/jump。卡片不消费的通用样式组合不能假称支持。

效果可作为独立 Operation，也可作为交互结果。后者的意思是“完成这个输入后执行”，前者的意思是“流程到这里执行”。相同资源变化写在两处不会自动去重。

旧 Effect[] 的批次求值、运行时请求与旅行分批，是后续引擎必须核对的事实。本轮的分类不是强迫把批内每个 Effect 改成独立即时事务，也不证明拆批等价。

### 3.5 结果、转移与入口启动分清

交互结果需要表达：共同动作 → 选中候选动作 → 可选后续控制。单按钮则没有互斥分支层。独立 Transfer 和结果中的转移共用 goto/insert 意图，不需要两套作者概念。

没有额外动作或控制时，作者意图是顺序走到交互点之后；这说明内容关系，不指定引擎用数组、地址、编译Step还是其他方式定位后继。

- goto：换到目标 StoryDef 接着演；同来源 Entry 的跨段播放。
- insert：演子段，结束后回到调用位置的后继；对 choice 内结果而言，后继是整个交互点之后，不能返回其他候选。
- 入口启动：目标是 Entry，而非 StoryDef。普通入场、系统触发与卡片邀请的资格/替换意图需要分开描述。

**补回旧 triggerStory 的覆盖：** Operation 的入口请求应能表达主动和被动入口、全局或角色游标。它可能请求另一个 owner 的播放，不能一律当成“终结当前源链”。同一 owner 的成功替换、拒绝或阻断交后续引擎定义。

这里补的是必须保留的语义槽位，不是完整运行覆盖。owner省略时指谁、请求成功/拒绝/阻断是否反馈源流程、同owner与异owner的关系还需写清。现有系统请求传force=true，但force仍检查Init/triggerCondition，不能被解释为“无条件启动”；这些区别不能只用一个模糊的system字符串掩盖。

**卡片仍是另一种意图：** Click.entryCard 与 overlay.entryCard 共享入口引用/显示内容，但显示宿主与生命周期不同。旧两条卡片路径的 force/skipConditions 差异记录为后续待议，本轮不把所有启动请求统一成“跳过条件、已完成可重开”的新合同。

有限的终结控制、禁止跳走后继续来源动作，可作为后续验证方向；是否把请求和控制分成哪些最终 Action 类型，在类型设计轮确认。首轮不把旧系统入口触发强行限制为某个终结卡片动作。

### 3.6 身份与外层职责

Story ID、Entry ID、节点 ID、选项 ID、覆盖层临时 ID、Flow 内容/实例 ID 分别有用途。第一轮保留稳定作者身份的设计目标，不预先规定游标、计划签名、token、存档结构。

Entry 的 owner、条件、首次/重复奖励、守卫、好感台阶、被动抽选、FollowUp/reactions 继续在入口/领域层。Story 外“点击底部按钮触发闲聊/好感推送”也属于会话外壳，不是应新增的 Node。

地图概览、地点卡、行动卡、Flow marks 等是共享显示或业务宿主能力，不是旧 Story Talklet 的正式作者字段。本轮不会删除 MapFlow，也不新增 Story MapNode/CardNode 或业务操作权限。以后需嵌入时另谈。

## 4. 旧能力静态覆盖结论

完整字段、重叠和旧证据见 [[docs/plan-work/report-0322-story-node-semantics-explained]]；该页顶部“第二轮覆盖核查”是本轮更新，后面的初版解读已标明适用范围。

| 能力 | 修订后如何表达 | 判断 |
| --- | --- | --- |
| 对话/旁白/图片/头像/左右/对齐 | Talklet 三组子成分 | 可表达，非法旧混搭不算缺失 |
| 输入中/思考/连发/等待 | pacing + 正文序列 + 显式 Click | 顺序意图可表达；阶段归属未冻结，默认和计时后议 |
| 按钮文案/静默/玩家回显 | button 文案与独立 reply | 可表达 |
| 条件选项/互斥 | 一个 Click.choice 内的 options | 可表达，撤回相邻自动分组 |
| 无正文的连续两次输入 | 两个独立 Click | 可表达，不需塞假 Operation |
| 正文确认后再给选项 | button → choice 两阶段 | 可表达，UI呈现后议 |
| 多击/随机多击/填满后确认 | press 工作量 + 可选后继确认 | 可近似表达，不强制旧参数一对一 |
| 页共同效果 + 分支效果 | 交互共同结果 + 候选结果 | 可表达，避免靠后继猜归属 |
| 无选择的离页效果 | 明确输入后的结果或后继 Operation | 可表达，执行边界后议 |
| goto/insert/多层返回 | Transfer 或交互结果的控制 | 可表达，返回交互点之后 |
| 普通/系统 Entry 请求 | 入口请求动作与类型/owner/意图 | 已识别必需语义槽，完整模式/结果尚未覆盖 |
| 羁绊入口卡 | Click.entryCard / overlay.entryCard | 可表达，不统一旧差异为新规则 |
| 剧情旅行与移动提示 | travel 目标 + notice | 补足参数遗漏 |
| 定位/临时ID/文本样式/清理 | overlay 包装器与内容变体 | 可表达，沿既有服务边界 |
| 主题/实体表现/横幅 | presentation 的对应载荷 | 必查参数已列；完整映射与时机后议 |
| 奖励/重读/守卫/被动/后续 | Entry与领域层 | 继续存在，不以拆 Node 改写规则 |
| 阅读/存档/返回地址持久化 | 有稳定身份目标 | 引擎验证未做，不能算已支持 |

这是一份有边界的静态表达判断，不是全量内容普查完成证书：正式 base 包、TS Builder、可选包、演示与测试夹具未来仍要按每条实际组合核对；前轮 43 个 Story/118 页不是全仓总量。

## 5. 用组合样例检查，而不是只看类型字段

### S01：连续输入与互斥输入不同

```text
先后：Click(button「敲门」) → Click(button「进门」)
互斥：Click(choice「敲门 / 离开」)
```

验收：无须正文、假效果或跳转占位，也能区分两个意图。

### S02：问话、确认、共同效果、分支跳转

```text
Talklet：「先调查哪条路？」
Click(button「我看完了」)                    # 若需要正文确认
Click(choice)
  共同成功动作：扣一天
  山路：条件=有登山工具；结果=设山路标记 → goto 山路段
  河路：条件=有船；结果=设河路标记 → goto 河路段
```

验收：共同动作在成功选择之后、分支动作之前；不能选择前就扣。原 choice 没有自动玩家回显，本例不新增 reply。条件评估/失败原子性后议。

### S03：多击、随机量、确认和回显各自独立

```text
Click(button「检查设备」、press=基础次数+随机增量)
Click(button「确认检查完成」、reply=玩家「检查好了」)
Operation：发检查奖励
```

验收：可表达多阶段工作量和额外确认，不靠增加假 Talklet。若不需要确认/回复，可直接把奖励放在工作量完成结果。这里承诺作者意图可拆分表达，不承诺拆成两个Click后仍与旧单控件的文案/进度呈现完全一致；计数与进度条的确切运行合同另定。

### S04：insert 回来后执行共同后继

```text
Talklet：「需要先听一段说明吗？」
Click(choice)
  需要：insert 说明段
  不需要：继续
Operation：展示下一阶段提示
Talklet：「现在进入下一阶段。」
```

验收：insert 子段结束后回到 Operation；不需要分支直接到 Operation。若某分支改 goto，则离开本段后继。上一版“发生转移，后继就不执行”过于笼统，本轮以此例区分。

### S05：定位舞台与正常正文分开

```text
Operation：overlay.show 临时ID=tip，位置=(0.85,0.18)，内容=note
Talklet：「看右下角的提示。」
Click(button「看到了」)
Operation：overlay.clearId tip
```

验收：临时 ID 可更新/清除；nodeId 只负责作者节点身份。坐标是聊天窗格左下原点的归一化锚点，不是地图坐标。嵌入气泡只画内容。

### S06：系统启动与入口卡不是一个能力

```text
系统请求：Operation → 请求被动Entry P，在角色V的游标启动
卡片邀请：Click(entryCard → 主动Entry A)
浮动邀请：Operation → overlay.entryCard(主动Entry A)
```

验收：三种意图都有去向；第一种不能被 Active-only 卡片约束吞掉。是否成功、打断谁、是否重复奖励由后续入口合同处理。

### S07：正文离开后旅行并显示提示

```text
Talklet：「我们去办公室。」 → Click(button「出发」)
Operation：travel 办公室，notice=true
Talklet：「到了。」
```

验收：既有剧情移动和可选移动提示均有落点；旅行触发事件与来源后继的竞争不在本轮假定为已解决。

## 6. 第一轮覆盖证据与后续内容样本

| 当前文件/符号 | 核实的事实 | 影响 |
| --- | --- | --- |
| `src/data-services/contracts/story.ts`：Talklet / StoryChoice / StoryDef | 所有旧字段、choice嵌套 | 拆分必须覆盖显示、输入、行为、流向四组 |
| `src/arona-clicker/services/story/story-flow.ts`：getSendState / clickSend / advanceStory | 多击与确认、共同效果先于选项效果、外层闲聊入口 | 显式交互阶段和共同结果必需 |
| `src/arona-clicker/services/story/story-jump.ts`：performJump / resolveStoryEnd | goto/insert及返回；当前完成身份 | 保留转移能力，完成身份另议 |
| `src/engine/types/expression.ts`：Effect / ThemeEffectValue / EntityPresentationEffectValue | owner、notice、主题scope、表现lifetime等 | 不只迁移op名字，要保留附带参数 |
| `src/arona-clicker/services/runtime/runtime-effect-reactor.ts`：onEvent | triggerStory推断active/passive、传owner并force；演出请求路由 | 卡片启动不能代替所有入口请求 |
| `src/ui/presentation/chat-stream.ts`：typingEligible / thinkingDelayOf / chainEligible | 对方节奏适用范围、自动连发 | 不把节奏字段扩大成任意延时节点 |
| `src/engine/contracts/chat-presentation.ts`、`src/ui/components/story/story.ts` | 定位/样式/呈现片段/卡片 | Overlay是独立包装器，不是嵌套执行器 |
| `src/arona-clicker/content/story/story-schale-main.ts` | welcome、flow_show、theme_lite_test含多击、选择、效果、主题、定位、goto/insert | 后续逐内容迁移样本；TS文件不是默认产品包的唯一来源 |
| `src/arona-clicker/content/base-pack/content.json`、`src/arona-clicker/content/default-datapack.ts` | 正式内置包实际入口 | 样本核实必须回正式JSON，不能只验TS Builder |

本轮三位 Luna 分别复核交互覆盖、旧字段/Effect参数、外层边界。调查为静态核对，没有运行新模型测试；前轮旧实现测试通过不等于本轮新语义已实现。

## 7. 从上一版撤回为后续讨论的判断

以下旧建议不再是本 Task 的施工约束；若后续仍采用，必须在对应引擎/产品合同中重新明确：

| 上一版建议 | 本轮处理 |
| --- | --- |
| 连续Click自动互斥、与前一Talklet吸附编译成Step | 改为Click内部显式choice；显示Step如何组织后议 |
| 默认always/whenNeeded及确切自动资格 | 先保留连续与等待两种表达，默认后议 |
| 所有选项删正文确认、所有多击第N次直接完成 | 撤回全局新默认；确认意图可拆阶段表达 |
| 入组即抽所有候选随机数、锁定、多击失效阻塞 | 属于详细输入运行合同；本轮不冻结 |
| 所有startEntry仅Active、跳过条件、已完成可重开 | 不足覆盖triggerStory；区分卡片/系统/普通请求意图 |
| 完成奖励统一到来源Entry.storyId | 作为已知不对称问题继续调查，不随拆字段改结算 |
| openingTitle取消首页特例、默认来源与精确门控 | 保留横幅表达；时机及默认来源另定 |
| 唯一纯编译器、PlaybackPlan、drain与转移预算 | 技术候选，不作为作者语义覆盖的前提 |
| 游标签名/交付token/保存字段/计划变化整链失效 | 全部后议；作者稳定ID不自动决定保存策略 |
| 旧save整体拒绝并立即设计全部load门控 | 暂不启动保存改造；确需结构变化仍遵项目不做迁移的约定 |
| 新输入预检/回复投递顺序/重入与晚失败策略 | 保留问题清单，后续按真实调用链判断 |
| 一次完成全内容、Runtime、Editor与旧路径退役 | 拆成语义核对 → 引擎评估 → 小范围纵向验证 → 再裁定切换范围 |

本轮并不要求恢复旧BUG或承诺兼容旧JSON。它只避免把“愿意换作者结构”推导成“上述玩法和引擎选择全已确认”。

## 8. 当前阶段任务与完成定义

### 第一轮：本 Task 当前范围

- [x] 核对四类Node及内部成分对旧有效功能的静态覆盖。
- [x] 识别相邻Click、多阶段输入、共同动作、triggerStory、旅行notice等缺口。
- [x] 给出显式交互组及行为/入口请求的最小修订方向。
- [x] 提供S01–S07组合样例，区分可表达与待验证。
- [x] 将详细引擎、保存、统一卡片/奖励等旧建议移回待议。
- [x] 更新Task、说明稿及索引，不进行产品施工。
- [ ] 补定呈现阶段/交互归属的作者表达，再冻结第一轮作者合同。
- [ ] 完成逐op参数映射与Entry请求模式/结果目录，不把字段目录当作完整覆盖。

第一轮调查结论可供继续讨论，剩余两个作者层缺口在上面明确保留；不等于作者schema已最终冻结。显式内部choice是本轮推荐方案；若用户改变方向，继续在此Task修订，不让早期示例自动升级成正式协议。

### 第二轮：后续引擎判断，当前未开始

1. 用S01–S07和真实内容挑小样本，逐项核实当前服务可复用部分。
2. 明确输入/送达/效果/转移/完成的运行边界；单独处理已知BUG与产品规则变化。
3. 比较最小解释适配与编译计划等技术候选，再决定是否重写哪些模块。
4. 只有确认状态与作者结构后，再定保存/Schema/Editor影响及纵向验证。
5. 小样本行为证据充分后，再确定正式内容改写与旧格式退役范围；开发期允许全量替换不等于第一步全仓切换。

不得仅因本Task标题/旧路径中仍有playback-plan字样，就启动旧版P1–P7施工。该文件路径为保持引用稳定而保留，正文范围已改变。

## 9. 文档与工作边界

- 当前源码和现行机制仍以 `docs/docs-829/` 与实际文件为准；Task表达下一步方案。
- 前轮 [[docs/plan-work/report-0321-story-talklet-capability-investigation]] 及四分册是旧能力调查快照，不改写成新实现。
- [[docs/plan-work/report-0322-story-node-semantics-explained]] 保留初版解读作为设计演进记录，顶部明确新旧差别；后续判断以本Task与报告最新覆盖核查为准。
- 不改dist、生成Schema、历史快照或其他并行任务内容；本轮未编正式Patch Unit、未提交产品实现。
- 检查采用npm run check:docs、文档范围diff空白检查及集中GALHCG只读changed复核；不写图、不刷新、不写freshness。
- 后续正式施工再依 [[docs/ai/PROJECT-CONSTITUTION]] 建立Read Set、Allowed Files、预算和Receipt。

相关入口：[[docs/ai/goal-workflow]]、[[docs/docs-829/05-conventions/doc-maintenance]]、[[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/testing]]。
