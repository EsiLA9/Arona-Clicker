# Task 0322：Story Node原语与阶段1–5全量替换

状态：阶段1–5完成；正式Node/UI/生命周期/结算/保存、43篇内容与旧解释器替换已验收。本轮测试通过，全量仍有8项范围外既有失败。阶段6独立Story编辑工具未施工。更新日期：2026-10-23。

> 阅读顺序：§15起是用户后续授权的全量切换范围与最新实现。§1–14保留前阶段设计和验收历史，其中“尚未接UI/保存”等描述只适用于当时首片，不代表当前状态。

> 本轮回答：把旧 Talklet 拆成多类 Node 及其内部成分后，作者还能不能表达原有功能？允许一条旧 Talklet 拆成多个节点、多个阶段，也允许组合改写；不要求逐页一一转换。

## 1. 本轮方向与结论

用户要求先拆分语义、随后判断引擎，并在Git保存后授权多个Luna MAX以新原语模式推进。**本 Task 保持收回上一版把作者拆分、玩法变化、编译器、Runtime、保存与全量内容切换一次冻结的范围。** 当前已把首轮语义落实为可由TypeScript检查的独立作者声明、阶段关系校验与组合样例；施工记录见§10起。

用户此前允许开发期全量替换、不保留版本兼容，仍作为未来落地的可选约束保留；它不代表必须现在重写整个引擎，也不代表可以默认丢掉旧功能。本片没有新增运行兼容层、迁移正式内容或清档；首片修改为新作者原语、结构校验、测试和生成类型索引；后续获授权的播放首片范围见§13。

**结论：四类顶层Node现在已有闭合作者声明，显式阶段与S01–S07可由代码检查；这仍不是“游戏运行层已完整支持”。** 入口请求、旅行提示、共同结果、多阶段输入与旧有效动作参数均有声明落点。尚未证明混合Effect批次的执行等价、全部实际内容迁移无损、保存恢复或任意旧字段混搭有效。

本轮优先保住作者意图，例如“先确认再选择”“多击之后再确认”“选择后共同扣资源再分支”，而不是保住旧对象的形状、旧按钮处理函数或偶然失败副作用。

## 2. 什么叫支持原语义

### 2.1 验收口径

支持按三层判断：

1. **单项能力有去向**：正文、图片、输入、效果、跳转、演出、入口请求等有明确承载者。
2. **组合意图能表达**：能标明先后、互斥、共同结果与分支结果，不因字段拆开就漏掉动作或改变分支含义。
3. **运行行为待验证**：什么时候算送达、具体点击几次、效果批次求值、失败保护、保存恢复等，另做引擎合同和行为测试。

前两层已交付；第三层新增§13限定的内存播放首片，不代表整个运行层完成。未完成部分不能用文档示例冒充；发现会影响作者表达的第三层问题，应留下语义需求，再交后续设计处理。

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

### 3.0 呈现阶段归属：已采用显式stageId与阶段模式

只写A→B→Click还不够说明：A、B一起呈现后给选项，还是A先等待、再显示B并给选项。**这项作者缺口现以stageId+stages解决。** 一条或多条正文与至多一个交互点组成显式连续阶段：

```text
同一阶段：[正文A，正文B] + 交互C
两次等待：阶段1[正文A] + 交互确认 → 阶段2[正文B] + 交互C
纯交互阶段：无正文 + 交互C
```

nodes仍是唯一顺序；stages仅按ID声明advance=auto/input，不再重复列成员。auto阶段有正文无Click，input阶段可无正文但末尾恰有一个Click。每个阶段只占一个连续区段，Operation/Transfer在阶段之间；若插入同阶段成员之间，校验会拒绝，要求作者明确拆阶段或把后果放进交互结果。

阶段不是第五类可执行Node，不藏效果或转移。当前已验证正文/交互的声明归属，而具体UI显示、auto计时、input按钮状态机仍由后续引擎/UI轮验证。

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

本片已按§11逐op登记旧target/value、owner/notice及新命名字段，并以类型实值覆盖这些载荷；它不是执行适配器或完整JSON值验证器。clearFlow当前服务实际只处理活跃UI流，不能从旧注释的target推导出有效的后台定向清理。

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
| `src/arona-clicker/services/story/story-service.ts`、`story-node-player.ts`：clickSend / advanceStory / 节点执行 | 多击与确认、共同效果先于选项效果、外层闲聊入口 | 显式交互阶段和共同结果必需 |
| `src/arona-clicker/services/story/story-node-player.ts`、`story-service.ts` | transfer/insert及会话完成；当前完成身份 | 保留转移能力，完成身份另议 |
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
- [x] 更新Task、说明稿及索引，原语首片未进入播放引擎施工。
- [x] 采用stageId/stages声明并验证呈现阶段/交互归属。
- [x] 完成逐op入参映射、Entry请求来源/目标/owner的作者声明；不把请求声明当作启动成功保证。
- [ ] 后续引擎轮明确Entry请求成功/拒绝/阻断的结果与对来源链的影响。

本片作者合同有独立代码和组合验证，但未成为正式Datapack导入/运行协议。新的模型可继续修订；引擎、保存和全量内容切换仍须独立核实，不能由声明测试自动获得准入。

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
- 不改dist、历史快照或其他并行任务内容；Schema仅通过命令生成，当前只增加原语类型索引；正式Patch Units与Receipt见下。
- 检查采用npm run check:docs、文档范围diff空白检查及集中GALHCG只读changed复核；不写图、不刷新、不写freshness。
- 后续正式施工再依 [[docs/ai/PROJECT-CONSTITUTION]] 建立Read Set、Allowed Files、预算和Receipt。

相关入口：[[docs/ai/goal-workflow]]、[[docs/docs-829/05-conventions/doc-maintenance]]、[[docs/docs-829/05-conventions/architecture-discipline]]、[[docs/docs-829/05-conventions/testing]]。

## 10. 原语落地首片（用户授权后，2026-10-23）

用户已完成Git保存并要求多个Luna MAX以新原语模式工作。本片据此推进**独立作者声明、typed关系检查和组合样例**。这是§8第一轮的源码验证，不启动第二轮播放引擎，也不把当前Datapack的StoryDef改成旧新联合。

### 本片采用的具体作者选择

- `StoryNodeDocument`：id/name/extra、nodes、stages；新声明尚未接入Datapack、Registry和Runtime。
- nodes为唯一顺序。stages为以阶段ID为键的声明，只标advance=auto/input，不再复制成员或顺序。
- 节点、阶段及选项局部ID采用1–64位ASCII名：首位字母，后续为字母、数字、下划线或连字符。节点ID在文档内唯一；阶段ID是stages的键；选项ID仅在所属choice内唯一，可在另一choice复用。
- Talklet/Click必须显式stageId；一个stage只占nodes中的一个连续区段。auto有正文且无Click；input末尾恰有一个Click，可无正文。Operation/Transfer是阶段边界，插入同阶段成员之间应报错。
- 一个Click.interaction明确为button/choice/entryCard；候选属于choice内部，连续两个Click是两个独立input阶段。
- choice.sharedActions先于被选候选result；result.actions之后才是result.transfer。共享的是Action载荷，不把带ID的执行Node嵌套进结果。
- EntryRequest保留entryId、entryType、owner（null明确表示全局）、intent；system/ordinary可请求active/passive，card仅active。intent描述来源，未承诺成功/拒绝/替换/奖励规则。
- 本片校验只接受已类型化的StoryNodeDocument，检查作者关系和基本数字约束；不是不可信JSON解析器、完整Effect值验证器、引用Registry或实际执行器。
- 稳定作者ID、stage关系与动作参数已成为此片的可检验合同；计时、输入次数状态机、完成身份、保存和播放器选择仍未裁定。

### 正式Patch Units

三个Unit均依[[docs/ai/PROJECT-CONSTITUTION]]执行；不扩至Runtime、正式内容迁移或编辑器表单。每Unit预算3–5文件、约300–500行净变更；类型/测试过大时拆分并回报，不临时扩白名单。文档记账由主Agent在Task/索引/说明稿完成。

Unit总数增加后按施工纪律拆出；U1–U3首片Receipt仍见§12。

- [[docs/plan-work/task-0322-units/task-0322-u01]]
- [[docs/plan-work/task-0322-units/task-0322-u02]]
- [[docs/plan-work/task-0322-units/task-0322-u03]]

## 11. 旧动作入参 → 首片原语字段

这是作者字段映射，不是已执行的转换器。旧被忽略的target/value不进入新动作；旧数字字符串可以在内容改写时写成数字，保留其功能而不保留宽外壳。完整类型见 `src/data-services/contracts/story-node-actions.ts`，实值样例见 `tests/data/story-node-authoring.fixtures.ts`。

| 旧op | 旧有效入参 | 新声明 |
| --- | --- | --- |
| set/addResource | target资源、value数值/表达式 | state.effects：resourceId、amount |
| set/addSpotLevel | target地点、value数值/表达式 | spotId、amount |
| setManager | target地点、value经理身份 | spotId、managerId |
| addEnhancement | value强化ID；target忽略 | enhancementId |
| addItem | target物品、value数量 | itemId、amount |
| unlockInit | value世界线ID；target忽略 | initId |
| setFlag | target标记、value最终转字符串 | flagId、value；保留字面值与ValueExpression |
| setExtra | target路径、value为ExtraValue/字面值/表达式 | path、value；保留递归Extra树 |
| addExtra | target路径、value数值增量 | path、amount |
| removeExtra | target路径；value忽略 | path |
| grantCharacter | target角色差分；value忽略 | variantId |
| addAffectionExp | target角色差分、value增量 | variantId、amount |
| travelToArea | target区域、顶层notice；value忽略 | travel.areaId、notice |
| triggerStory | target为Entry、顶层owner、目标类型由Registry推断 | entryRequest.request的entryId/entryType/owner/intent；不再藏在state.effects |
| showChatText | target临时ID、value位置/样式/内容 | overlay.show的id/x/y/align/content；text/message/entryCard显式分支 |
| clearIdChatFlow | target临时ID；value忽略 | overlay.clearId.id |
| clearAllChatText | target/value忽略 | overlay.clearAllTexts |
| clearAllChatFlow | 当前执行链丢弃target/value | overlay.clearFlow，不承诺后台定向清流 |
| setTheme | value完整ThemeEffectValue | presentation.theme.value；保留色组/色板/tokens/nodes/background，area/student必须带对应entityKey |
| setEntityPresentation | target实体、value.optionId/owner/lifetime，owner可回退Effect.owner | target/optionId/owner/lifetime；归一后的有效owner显式必填 |
| clearEntityPresentation | target实体、有效owner | target/owner；缺归属的旧无效请求不作为必须复刻功能 |
| showOpeningTitle | 非空value文字，否则宿主默认来源 | openingTitle.title可省略；时机、默认来源优先级后议 |
| loot | Mutation为空分支 | 不纳入已执行原语 |
| set/removeSpotMaxLevel | Affector声明消费者 | 不纳入Story状态动作 |

同一组state.effects作为批次数据保留；这不说明“将旧混合Effect批次拆成state/presentation/entryRequest等动作”已经执行等价。混合批次的表达式统一求值、运行请求发出与状态安装顺序，必须在第二轮核对。

readonly约束针对新声明的属性与容器；复用的ConditionGroup、ExtraValue、ValueExpression、Theme基础字段和ChatTextStyle仍沿用原契约的嵌套类型。本片不提供深冻结/复制服务，关系校验器经测试不修改有效或无效输入。

## 12. 首片Receipt

| Unit | 实际结果 | 实际验证 | 剩余边界 |
| --- | --- | --- | --- |
| U1 | 新增story-node.ts与story-node-actions.ts；四节点、显式阶段、闭合状态/演出/入口请求；生成Schema只增加类型索引和时间 | 类型检查通过；Schema同步测试通过；generated diff未改变Datapack表/旧StoryDef字段 | 未注册正式包；不执行行为；未定入口请求结果 |
| U2 | 新增story-node-structure.ts与对应测试；关系、ID、press范围、节奏数值/资格与纯读取检查 | 定向11项通过，tsc通过 | 非JSON解析器；不验引用存在、完整Action值语法或运行时生命周期 |
| U3 | 新增S01–S07及多正文/纯转移样例、14种状态参数与复合演出实值；编译拒绝用例；本文/说明稿/索引同步 | 组合/类型及Schema联合验证见下；独立Luna MAX复审 | 测试证明声明组合，不证明实际播放、奖励、历史或存档 |

独立复审发现并已修正：卡片Extract联合误成never、goto注释误导、旁白/右侧节奏资格遗漏、有效输入不可变测试缺例；另明确了ID词法与option的局部唯一范围。实体表现owner必填表示把旧有效归属显式化，主题实体scope也需明确对应槽。

工作树未提交；用户Git保存之前的内容未回退或改写。未运行游戏实屏；此片没有可展示的新播放UI，也不把真实浏览器播放作为已通过项。集中GALHCG只读复核不修改图或freshness；未关联新文件不当作语义验证通过。

### 联合验证记录（2026-10-23）

- `npx vitest run tests/data/story-node-structure.test.ts tests/data/story-node-authoring.test.ts tools/datapack-editor/schema/engine-schema.sync.test.ts`：3文件39/39通过（11结构、13作者组合、15Schema同步）。
- `npx tsc --noEmit`：通过；测试文件中的编译拒绝断言也在include范围内。
- `npm run gen:schema`：通过；差异仅generatedAt和新原语indexedTypes，Datapack表与现行StoryDef字段没有变化。
- `npm run check:architecture`：通过；基础层无禁止的向外依赖。
- `npm run check:docs`与`git diff --check`：通过；仅既有CRLF转LF提示，无空白错误。
- 未运行全量游戏测试或实屏播放：没有改现有运行调用方，此片不包含可播放的新UI。39项不代表新Runtime/存档/实际内容切换通过。


## 13. 纵向播放首片执行合同（2026-10-23）

用户已确认执行下一片。目标为可调用、可行为验证的新节点内存播放器，复用现有EffectEngine/领域服务，打通正文→输入→动作→goto/insert→链尾。此片仍不切正式StoryDef、旧游标、存档、全量内容或UI。新入口由显式factory构造，集成测试使用真实GameInstance；没有“返回成功但未执行”的占位端口。

1. 新Player持有独立内存Run，来源固定为entryId/rootStoryId/owner；新文档进入时复制并做typed关系检查，不借旧talklets播放。每个Player同一时刻只播一条链。
2. 每条Talklet逐条交付，ackDelivery确认当前正文后才进入下一节点；input阶段全部正文送达后才给Click，纯Click直接进入输入。auto没有隐式按钮，最后一条正文确认后继续。
3. getView纯读取，可重验选项条件，但不抽随机、不执行行为。每次交付/输入携带不持久化票据；旧票据、重复ack、重复成功输入不得重放动作。工作量每次有效提交更新票据。
4. press只在进入button时抽一次，base+floor(random*rand)，rand省略/0不增加；第N次完成。需要额外确认用下一input阶段。choice只按optionId提交，提交时重验条件；全部不可用仍等待。
5. 操作按nodes顺序自动执行；choice顺序为sharedActions→候选actions→可选transfer，按钮为actions→可选transfer。每个state批次一次调用既有EffectEngine，批内统一求值规则保留；不同Action顺序执行，不宣称旧混合Effect批次逐项等价。
6. 输入先对所有Action做静态引用/能力支持预检，并检查转移目标。该预检失败保留当前等待、无本次动作/回复/前进。入口资格、Spot当前Init可写性和好感目标拥有资格等动态条件按每个Action执行前的最新状态检查，允许前一Action解锁后一Action；动态拒绝属于执行失败，前序动作可能已生效，停止新链且不通用回滚、不自动重试。Operation运行到自身时检查，不承诺整分支动态资格预测或整条未来链事务。
7. 同步命令执行期间拒绝嵌套start/ack/submit；允许cancel作废来源。行为回调取消后旧循环不能续写或继续后续动作。晚到UI提交只能拿到过期结果。
8. insert返回点为当前节点/整个交互点之后；goto不新增返回点并保留已有insert栈。控制转移累计上限32，每次自动推进预算256，超限停止并诊断。
9. EntryRequest仅桥接现有Entry服务：ordinary保留普通准入，system用现有force但仍检查Init/条件；新card邀请明确采用现有startCardStory的启动合同，不把旧inline路径也宣称等价。预检先核目标存在/类型/非空；资格、占用等可能被前序动作改变，实际执行前再纯读核对，避免调用旧路径先清游标后拒绝。相同owner成功返回replaced结束新来源链；异owner成功继续；执行时拒绝按晚失败处理。旧Entry目标仍是现行内容，此复用是领域服务适配，不是作者格式兼容编译。含visitedStoryInChain准入的旧Entry此片明确拒绝桥接，防止读取旧global链；新choice的该条件必须读取本新链visited集合。
10. 旅行复用领域旅行，notice只在成功后发；Overlay/Presentation复用现有服务路由，当前Overlay只允许null来源发送全局演出事件；非null来源、所有Overlay.entryCard都明确拒绝，因为旧UI无法传递请求owner。Click.entryCard直接执行入口请求不受此展示限制。openingTitle仅接受null来源与显式非空标题，默认来源待Controller接线。当前未接新链清理，所以ephemeral主题和story lifetime实体表现明确拒绝；area/student主题带现有服务不消费的background也拒绝。作者类型保留这些意图，后续接完整生命周期再放行。状态批次执行前核当前Init的Spot可写资格与好感目标拥有资格；批内先grant再加好感仍可执行，且保留一次Engine调用。服务不支持的组合不能静默报告成功。
11. 新链结束只交付本地completion，包含来源entryId/rootStoryId/owner及terminalStoryId；来源身份与实际链尾不混用。**本片不写旧完成日志、不发链尾奖励/FollowUp/reactions、不注册旧storyCompleted事件。** 这明确限制首片结算范围，不提前替旧系统选择根/尾完成身份。
12. 命令事件序列先列源reply，再列新播放器目标视图；实际旧UI/Entry事件跨系统排序尚无Controller接线，本片不声称完成屏幕交付或历史恢复。

### 本片Unit与验收

- [[docs/plan-work/task-0322-units/task-0322-u04]]：端口合同与真实领域Action适配。
- [[docs/plan-work/task-0322-units/task-0322-u05]]：播放器推进、输入与转移行为。
- [[docs/plan-work/task-0322-units/task-0322-u06]]：GameInstance构造入口与真实状态纵向样例。

- [[docs/plan-work/task-0322-units/task-0322-u07]]：独立边界测试，补足取消、预检、预算与快照隔离。

- [[docs/plan-work/task-0322-units/task-0322-u08]]：状态动态准入与未支持表现生命周期的明确拒绝。

Receipt见各Unit的receipts目录。本片已实现上述内存播放合同；未接UI/存档/旧奖励部分不计完成。

## 14. 播放首片Receipt（2026-10-23）

U4–U8完成：显式factory构造独立内存播放器；逐条正文确认、稳定选择ID、一次随机多击、顺序动作、goto/insert返回栈、来源/链尾分离回执，以及实际领域服务接线。尚不切换正式包、UI、旧游标、保存、历史、奖励或FollowUp。

严格Luna MAX独立复审发现并已处理：自动推进同步cancel回执不一致；非当前Init的Spot和未拥有角色好感被旧Engine静默忽略；临时主题/表现没有新链清理；Overlay卡片与后台owner无法经旧UI保留路由；标题默认来源缺失。前者修复并回归，动态状态资格在执行前明确拒绝，其余未支持组合在静态预检明确拒绝，作者类型保留未来语义。Action静态预检与动态资格分开；前序动作可改变后序资格，不宣称动态失败能回滚。已补跨Action的grant→好感回归；数值零增量/上限等沿用既有领域政策，字面与表达式一致，applied不保证数值增长。

验收证据：

- 联合13个测试文件 **107/107通过**：作者结构/组合、Schema同步、播放器、边界、Action适配/准入、真实GameInstance集成，以及旧Story flow/entry/replay/rewards/chat-flow回归。新运行部分为29项（6核心、8边界、5适配、4准入、6集成）。
- `npx tsc --noEmit`通过；`npm run check:architecture`、`npm run check:docs`与`git diff --check`均通过；没有运行实屏UI验收。
- Schema此播放片没有新修改；工作树内既有Schema变化属于U1作者类型索引，不代表正式StoryDef切换。
- GALHCG按直接影响路径集中只读changed核对：新增源码/测试、Task/Report与Unit/Receipt均无直接关联（unreferenced_path）；索引的9个owner分两页检查，6项旧Evidence标记content_changed。未写图、刷新或写freshness，地图结果不替代行为验证。
- 工作树保留未提交；未回退用户修改、清档或实施全量内容替换。每Unit详情在各Receipt中。

下一片应先明确新Controller的owner定向、主题/实体表现清理与标题默认来源，再接实屏正文/输入；保存与完成结算另立合同。本片的有限执行能力不能等同“全部旧Talklet场景已替换”。

## 15. 全量切换阶段1–5（用户授权持续施工）

用户授权持续完成：①现有UI实际播放；②owner/run演出归属及生命周期；③根Entry/终端Story完成结算；④节点进度保存恢复；⑤正式内容和调用入口全量替换。独立Story编辑工具为阶段6，不在本轮范围。

本轮决策：正式StoryDef仅nodes/stages，不运行旧talklets编译兼容；当前聊天视觉DTO可复用现有窗口字段但不承担执行。每GameInstance按owner管理独立Run和票据；同owner替换前先核入口，不清错游标。完成策略源自根Entry，完成记录及首次/重复判定沿既有终端Story身份；来源Entry另用于区域交付、冷却和阻断。replay不重复奖励或完成日志，保留阅读前置分支守卫。

存档采用2.0.0与节点等待快照，明确拒绝旧格式、不读取迁移、不删除用户磁盘存档。正文/输入节点、返回栈、visited、多击随机结果和Run结算元数据保存；恢复新票据与运行身份，不执行此前资源/入口动作。临时主题、story实体表现和Overlay有独立表现快照恢复，不用重放Operation补演出。

UI沿现有聊天风格与所属区域刷新；正文真实送达后按捕获的token确认，输入按稳定optionId提交，卡片确认绑定来源run。演出事件显式owner/runId，后台剧情不能写到用户当前打开的流。旧页面推断推进器和游标在正式接线验证后退役。

施工单元：U9节点快照；U10–12正式服务/结算/选择与旧解释器退役；U15–16保存合同与接线；U17–19输入/送达/演出UI；U20–23表现宿主、事件及表现快照；U24组合根和命令；U25卡片来源确认；U26通知队列；U30起数据合同与正式内容。各Unit的状态与实际检查以对应Receipt为准，此处不提前宣称五阶段完成。


## 16. 阶段1–5交付与联合验收

本轮采用开发期全量替换；没有双版本Story解释器，没有旧存档迁移。独立Story编辑工具是阶段6，尚未施工。

| 阶段 | 已落地的行为 | 主要证据 |
| --- | --- | --- |
| 1：现有UI播放 | 正文实际送达后确认token；按钮/多击/选择/卡片作为独立输入；沿现有聊天DOM与局部刷新 | UI输入/送达/卡片/历史恢复回归；浏览器真实欢迎剧情 |
| 2：演出生命周期 | owner/run路由；主题/实体/Overlay/标题按来源管理；关闭旧Run不擦掉新Run或其他空间 | PresentationHost、生命周期与消息路由回归 |
| 3：完成结算 | 根Entry负责准入/冷却/阻断/交付，终端Story负责完成日志和首次/重复奖励；重读守卫；同步后续不被旧完成覆盖 | StoryService、奖励、被动池、Flow/Replay回归 |
| 4：保存恢复 | 2.0.0节点快照；稳定返回点、visited、工作量、choice归属及表现快照；恢复新票据/Run，保留historyId；全游标纯预检先于状态替换 | snapshot/save/preflight/Init/历史恢复回归 |
| 5：全量替换 | 43篇作者源与运行JSON包、工厂、Registry引用、Schema同步；旧页解释器/旧工厂与相关工具退役 | 43篇结构校验、HEAD离线转换对照、bundle check、Schema同步测试 |

### 验证结果

- 本轮实际变更的43个测试文件：**428/428通过**（包含最终左栏移动锁回归）。测试集合来自 `git diff --name-only --diff-filter=ACM` 与新增 `.test.ts` 的合并列表；没有排除其中失败来计算通过数。
- 最终全量：`npx vitest run --silent --maxWorkers=4 --minWorkers=1 --reporter=json`，319文件中315通过、4失败；**3237项通过、8项失败，共3245项**。全部Story相关回归通过；全量不是全绿。
- 范围外8项：`tests/data/gameplay-b-map-registry.test.ts` 1项缺新增地图version预期；`tests/engine/gameplay-b-basic-map-p0-p3.test.ts` 2项旧Edge精确断言缺kind；`tests/engine/gameplay-b-map-source-transactions.test.ts` 1项旧Item草稿断言缺显式additionalTarget:null；`tests/ui/presentation-text-color-css.test.ts` 4项读取旧拆分前文件位置导致ENOENT。未为通过而修改这些断言或玩法源码，诊断见U39与UI回执。
- `npx tsc --noEmit --pretty false`、`npm run check:architecture`、`npm run check:docs`、`git diff --check`：通过。
- `npm run gen:schema` 后再次运行显示unchanged；全量中的Schema同步回归通过。`node scripts/sync-base-datapack-bundle.mjs --check`：43篇运行包与TS源一致。
- 生产内容审查：旧HEAD作者内容经离线转换重放，43篇、0 issues、0 mismatches；43篇结构均有效。迁移器7项行为测试通过；测试目录旧作者形状预览0待转换/0问题。

浏览器实测采用正式运行JSON包，经世界线正常入口进入夏莱：正文自动投递 → 回复 → 实际随机总量4和5的工作Click（不同次正常开局） → 独立确认 → 正文 → 生产分支选择 → 结尾 → 设施奖励与解除移动锁定。浏览器未出现error日志。UI历史保留，按钮与选择不会重复投递正文；完成后左栏说明和区域准入同步解锁，旧推进提示已更正。

### 已明确的行为边界

- `base:story:abydos_siesta`旧混合批次会先发主题请求、后写资源；新节点按作者声明先加资源、后切主题。两者没有状态依赖，但事件/投影顺序可观察；采用本轮显式顺序语义，未宣称逐位复刻旧EffectEngine调度。
- 旅行继续使用正式领域命令。AlreadyThere、NotInThisInit等正常失败结果沿旧Story政策跳过，剧情继续；成功且notice才发来源通知。异常仍停止执行并报告错误。
- 离线迁移工具对静态总量1只生成单Click，对总量始终大于1生成工作加确认；随机范围可能同时产生1和多击时报告`ambiguous-click-confirm`，要求人工改写，不建立运行兼容层。
- 不同Operation按脚本顺序生效。后续动作失败不会自动回滚此前的不同动作；同一个state批次仍保留领域批次求值。
- 保存恢复不重放资源动作、入口请求或开场标题。临时表现从纯数据快照恢复；非法后一个owner或表现快照在替换当前状态前被拒绝。复用同一存档也生成新的运行身份。
- `pageIndex/totalPages`、显示Talklet与`absorbed:[]`只是保留的显示投影合同，不承担旧格式解释；执行和保存均依赖稳定节点与新票据。

### GALHCG只读收尾

按项目`acprogram`核实身份后，对212个本Task直接路径做合并changed核对；另补查U31/U61直接路径及U62新增测试/文档、U60回执；后者均无直接关联。73个路径有关联，其中64个内容变化、119条已存Evidence仍引用旧版本；owner与Evidence分页完整。9个旧工厂/解释器/工具测试路径已删除但仍有地图关联，12个新节点合同/播放器/宿主路径尚无直接关联。这是地图尚未维护，不是实现缺失。

未改图、刷新清单或写freshness；新Unit/receipt与新测试多数本就无直接映射。未来需要地图回填时按维护指南单独取得并复验依据，当前不把缓存摘要当成新实现事实。未提交Git、未回退用户改动、未删除用户磁盘存档。

### Unit与Receipt索引

| Unit | 验收回执 |
| --- | --- |
| [[docs/plan-work/task-0322-units/task-0322-u01]] | 见Unit内阶段记录 |
| [[docs/plan-work/task-0322-units/task-0322-u02]] | 见Unit内阶段记录 |
| [[docs/plan-work/task-0322-units/task-0322-u03]] | 见Unit内阶段记录 |
| [[docs/plan-work/task-0322-units/task-0322-u04]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u04]] |
| [[docs/plan-work/task-0322-units/task-0322-u05]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u05]] |
| [[docs/plan-work/task-0322-units/task-0322-u06]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u06]] |
| [[docs/plan-work/task-0322-units/task-0322-u07]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u07]] |
| [[docs/plan-work/task-0322-units/task-0322-u08]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u08]] |
| [[docs/plan-work/task-0322-units/task-0322-u09]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u09]] |
| [[docs/plan-work/task-0322-units/task-0322-u10]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u10]] |
| [[docs/plan-work/task-0322-units/task-0322-u11]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u11]] |
| [[docs/plan-work/task-0322-units/task-0322-u12]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u12]] |
| [[docs/plan-work/task-0322-units/task-0322-u15]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u15]] |
| [[docs/plan-work/task-0322-units/task-0322-u16]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u16]] |
| [[docs/plan-work/task-0322-units/task-0322-u17]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u17]] |
| [[docs/plan-work/task-0322-units/task-0322-u18]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u18]] |
| [[docs/plan-work/task-0322-units/task-0322-u19]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u19]] |
| [[docs/plan-work/task-0322-units/task-0322-u20]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u20]] |
| [[docs/plan-work/task-0322-units/task-0322-u21]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u21]] |
| [[docs/plan-work/task-0322-units/task-0322-u22]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u22]] |
| [[docs/plan-work/task-0322-units/task-0322-u23]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u23]] |
| [[docs/plan-work/task-0322-units/task-0322-u24]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u24]] |
| [[docs/plan-work/task-0322-units/task-0322-u25]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u25]] |
| [[docs/plan-work/task-0322-units/task-0322-u26]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u26]] |
| [[docs/plan-work/task-0322-units/task-0322-u27]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u27]] |
| [[docs/plan-work/task-0322-units/task-0322-u28]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u28]] |
| [[docs/plan-work/task-0322-units/task-0322-u29]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u29]] |
| [[docs/plan-work/task-0322-units/task-0322-u30]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u30]] |
| [[docs/plan-work/task-0322-units/task-0322-u31]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u31]] |
| [[docs/plan-work/task-0322-units/task-0322-u32]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u32]] |
| [[docs/plan-work/task-0322-units/task-0322-u33]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u33]] |
| [[docs/plan-work/task-0322-units/task-0322-u34]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u34]] |
| [[docs/plan-work/task-0322-units/task-0322-u35]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u35]] |
| [[docs/plan-work/task-0322-units/task-0322-u36]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u36]] |
| [[docs/plan-work/task-0322-units/task-0322-u37]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u37]] |
| [[docs/plan-work/task-0322-units/task-0322-u38]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u38]] |
| [[docs/plan-work/task-0322-units/task-0322-u39]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u39]] |
| [[docs/plan-work/task-0322-units/task-0322-u40]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u40]] |
| [[docs/plan-work/task-0322-units/task-0322-u41]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u41]] |
| [[docs/plan-work/task-0322-units/task-0322-u42]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u42]] |
| [[docs/plan-work/task-0322-units/task-0322-u43]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u43]] |
| [[docs/plan-work/task-0322-units/task-0322-u44]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u44]] |
| [[docs/plan-work/task-0322-units/task-0322-u45]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u45]] |
| [[docs/plan-work/task-0322-units/task-0322-u46]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u46]] |
| [[docs/plan-work/task-0322-units/task-0322-u47]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u47]] |
| [[docs/plan-work/task-0322-units/task-0322-u48]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u48]] |
| [[docs/plan-work/task-0322-units/task-0322-u49]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u49]] |
| [[docs/plan-work/task-0322-units/task-0322-u50]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u50]] |
| [[docs/plan-work/task-0322-units/task-0322-u60]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u60]] |
| [[docs/plan-work/task-0322-units/task-0322-u61]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u61]] |
| [[docs/plan-work/task-0322-units/task-0322-u62]] | [[docs/plan-work/task-0322-units/receipts/receipt-0322-u62]] |
