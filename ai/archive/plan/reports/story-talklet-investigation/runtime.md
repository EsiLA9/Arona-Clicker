# reports/story-talklet-investigation/runtime — Story 作者契约与 Talklet 执行调查

本文回答：单个 Story 的 Talklet 能声明什么、如何执行、哪些状态跨页与跨 Story 保留，以及未来编辑工具必须理解哪些真实语义。

状态：investigation；日期：2026-10-22；依据：HEAD `36f1b1018bb72ab79845093b41c99166f207a58d` 上有未提交改动的当前工作树源码与已有测试断言。此文件是整改前调查快照，不是新设计批准或持续维护的机制权威页。本子 Agent 未修改产品代码、未独立运行测试、未改动项目图；根 Agent 已运行下文标注的9个定向测试文件，120/120通过（14.96s）。其余已有测试仅表示已查阅的断言范围，不表示本轮重跑通过。地图、卡牌和定位覆盖层另由并行分报告细查；本文不将共享渲染能力自动视为 Story 作者字段。

## 1. 关键判断与证据入口

1. StoryEntry 是入口与结算配置；StoryDef 是 `id/name/talklets/extra`；Talklet 是有顺序的页。作者 Talklet 本身没有 `id`、坐标、地图或玩法卡牌字段。演出定位/临时 ID 可以通过页内 `effects → showChatText` 实现，不能因此说 Talklet 执行页本身已有稳定 ID。
2. 一个播放链具有稳定的来源 Entry ID，但当前 StoryDef 会随 goto/insert 改变。跳转不经过目标 Entry 的入口判定或奖励定义。
3. `startCardStory`、`clickSend` 的 kizuna 路径、`replayStory` 是三种不同入口，不能合并描述为重读。
4. 重读跳过链尾完成结算；页效果、选项效果和阅读记录仍执行。重读不是隔离副作用的编辑器预览。
5. 稳定内容 ID、运行实例 ID、页索引、选项索引、Entry ID、StoryDef ID、演出覆盖层临时 ID 属于不同概念，未来工具必须分别表达。

主要源码（以下行号是本次读取时定位，后续修改可能移动）：

| 主题 | 当前入口与符号 |
| --- | --- |
| 作者字段 | [story.ts](../../../../src/data-services/contracts/story.ts)，`StoryChoice:5 / Talklet:13 / StoryDef:35` |
| Entry 字段 | [story-entry.ts](../../../../src/data-services/contracts/story-entry.ts)，`StoryEntryBase:26 / ActiveStoryEntry:33 / PassiveStoryEntry:36` |
| Builder（本报告形成后已迁移到节点合同） | [story.ts](../../../../src/arona-clicker/content/def-factory/story.ts)、[story-entry.ts](../../../../src/arona-clicker/content/def-factory/story-entry.ts)、[story-node.ts](../../../../src/data-services/contracts/story-node.ts) |
| 主流程 | [story-flow.ts](../../../../src/arona-clicker/services/story/story-flow.ts)，`beginStory:27 / startStory:65 / advanceStory:233 / getSendState:331 / clickSend:389` |
| 跳转与完成 | [story-jump.ts](../../../../src/arona-clicker/services/story/story-jump.ts)，`performJump:17 / resolveStoryEnd:48` |
| 重读 | [story-replay.ts](../../../../src/arona-clicker/services/story/story-replay.ts)，`guardPrereqsMet:12 / replayStory:32` |
| 奖励 | [story-rewards.ts](../../../../src/arona-clicker/services/story/story-rewards.ts)，`applyCompletionReward:15 / recordPassiveCooldown:39 / maybeBlockConversation:58` |
| 门面与 owner | [story-service.ts](../../../../src/arona-clicker/services/story/story-service.ts)，`StoryService:57 / isVisitedInChain:125 / startCardStory:277 / ensureCursorValid:373` |
| 保存字段 | [story-cursor.ts](../../../../src/engine/contracts/story-cursor.ts)、[story-cursor-state.ts](../../../../src/arona-clicker/services/story/story-cursor-state.ts)、[runtime-save-codec.ts](../../../../src/arona-clicker/runtime/runtime-save-codec.ts) |

## 2. 单 Story 与播放链的真实对象关系

```text
StoryEntry.id ──入口条件/owner/奖励/重读守卫/后续
    └─ storyId ──> StoryDef.id
                     └─ talklets[index]
                          ├─ 呈现字段 → StoryView → ChatStream/UI
                          ├─ effects / choices.effects → EffectEngine / 领域旅行处理
                          ├─ jumpToStory → 另一 StoryDef 首页（同来源 Entry）
                          └─ kizuna.storyId → ActiveStoryEntry（替换为新播放）

StoryCursor：来源 Entry + 当前 StoryDef + pageIndex + choiceIndex
             + clickWork + insertStack + visitedStoryIds + isReplay
```

单个 StoryDef 并不是完全自足的创作单元：它可以包含到其他 StoryDef 的引用，也可跳至新 Entry；其可用条件、奖励、分支守卫与 owner 大多在 Entry。反之，同一 StoryDef 可由多个 Entry 引用，但当前完成准入主要按 StoryDef ID 判定，因此并不自然得到独立的每入口完成身份。

## 3. StoryDef 与 Talklet 完整字段

### 3.1 StoryDef

| 字段 | 类型/默认 | 当前用途 |
| --- | --- | --- |
| `id` | StoryId，必填 | Registry 演出身份、跳转目标、阅读日志键、完成记录身份 |
| `name` | string，必填 | 内容显示名；部分标题回退来源 |
| `talklets` | Talklet[]，必填 | 按数组顺序播放；启动拒绝空数组 |
| `extra` | ExtraCompound，可选 | 额外作者数据，不是专用剧情执行指令 |

### 3.2 Talklet（全部现役作者字段）

| 字段 | 类型 | 当前行为/注意 |
| --- | --- | --- |
| `text` | string，必填 | 对话/旁白正文；click 页是底部按钮文案回退；Builder 拒绝空串 |
| `speaker` | string | 显示说话人，未形成必选角色外键；不要等同 owner |
| `choices` | StoryChoice[] | 非 click 页优先进入选项按钮模式；领域 advance 仍对任何非空 choices 做选择校验 |
| `effects` | Effect[] | 离开本页时执行；首页开幕标题存在特例 |
| `sendText` | string | 回复按钮文字；满足回显条件时额外产生玩家气泡 |
| `muteReply` | boolean | 禁止玩家回复气泡，不取消推进与效果 |
| `clickWork` | `{base:number; rand?:number}` | 随机总点击次数；保存在游标，避免正常查询反复抽数 |
| `kind` | talk / narration / click | 缺省呈现为 talk；click 只呈现底部按钮、不入普通聊天历史 |
| `align` | center / left / right | 旁白对齐；不等于气泡 side |
| `avatar` | string | 覆写头像来源；渲染解析另见表现报告 |
| `side` | left / right | 气泡侧；右侧页不走对方 typing 节奏；不自动等于玩家身份 |
| `noAvatar` | boolean | 隐藏头像的呈现声明 |
| `showAvatar` | boolean | 连发时强制完整头像与姓名呈现 |
| `image` | string | 气泡图片来源，可为 pic 索引或 URL |
| `typing` | number | UI 侧输入延迟，资格、上限与默认见呈现调查；领域不按此计时 |
| `thinking` | number | UI 侧回复前停顿；领域不按此计时 |
| `jumpToStory` | StoryId | 指向 StoryDef，离开页后执行 |
| `jumpMode` | goto / insert | 目标存在时使用；总体默认 goto |
| `kizuna` | `{storyId; title?; buttonText?; align?:left/right}` | 羁绊入口卡，目标实际为 ActiveStoryEntry；不是 goto 的别名 |

### 3.3 StoryChoice

| 字段 | 行为 |
| --- | --- |
| `text` | 选项文案 |
| `effects`（必填数组） | 选中后，在本页 effects 之后执行 |
| `condition` | 可选 ConditionGroup；View 给出可用原始索引，提交时重新检查 |
| `jumpToStory` | 可选 StoryDef 目标，覆盖页级 jumpToStory |
| `jumpMode` | 可选，优先于页级 jumpMode，再回退 goto |

注意目标与模式是分别通过 `??` 决定：选项只改目标、没有模式时，会继承页级模式；选项只写模式、没有目标时，会作用于页级目标。工具不能把两者视为始终成对覆盖。

## 4. Entry 完整字段与单 Story 的外部编排

| 范围 | 字段 | 当前职责 |
| --- | --- | --- |
| 共用 | `id / storyId / availableInits / triggerCondition` | 入口身份、演出引用、Init 白名单、启动条件组；空 Init 列表通用 |
| 共用 | `tags / revealTriggers / extra` | 内容分类、信息揭示和扩展数据；不直接决定 Talklet 顺序 |
| 共用 | `replayable` | replayStory 是否准入；缺省为 false（Builder 也如此） |
| 共用 | `completionStrategy` | simple 或 conditional，缺省 simple |
| 共用 | `conditionalRewards` | 有序条件奖励，首个满足者生效；不是每个满足项都发放 |
| 共用 | `branchGuards` | 目标 StoryDef + 前置页已读要求 + 拒绝文案，限 isReplay 跳转检查 |
| 共用 | `openingTitle` | 开幕标题事件无显式文字时的 UI 回退来源之一；字段本身不等于自动发事件 |
| 共用 | `reactions` | 完成后挂载的局部反应；包含局部 id、activation、lifetime、事件、条件、effects、once |
| 共用 | `followUps` | 局部 id，等待未来 next-enter-area，再处理 start-story-entry 结果 |
| Active | `type:'active' / completionReward / owner` | 主动入口、首次/重复奖励、声明归属 |
| Passive | `type:'passive' / repeatable / weight` | 被动入口、能否重复、抽选权重 |
| Passive | `completionReward / owner` | 首次/重复奖励与学生归属 |
| Passive | `affectionRequired / pushAfterStory` | 好感台阶和羁绊尾巴；退出普通随机抽选，进入 owner 就绪队列 |
| Passive | `cooldownFrames` | 完成后记录冷却帧，候选抽取时判断 |
| Passive | `block` | 完成后建立学生对话空间阻断，等待条件解除 |
| Passive | `interruptible / leaveArea / blocksInteraction` | 移动中断、允许离开、外部交互阻塞的不同维度 |

Entry 引用 StoryDef 的关系并未因为单 Story 编辑器出现而消失。工具若仅编辑 talklets，会缺失可进入性、完成奖励、后续等待与分支重读约束。

## 5. Builder 能力与数据入口差异

`StoryBuilder.scene(...items)` 接收 Talklet 或 TalkletBuilder，展开 build 后追加；`extra()` 写扩展；build 返回 id/name/talklets/extra。没有自动生成页 ID、引用重写、页排序迁移或节点校验机制。

TalkletBuilder 方法完整清单：

| 类别 | 方法与结果 |
| --- | --- |
| 发言 | `talklet(text)`、`speaker`、`avatar`；`line(speaker,text,reply?,opts?)` 便捷组合 |
| 页种类 | `narrate(align='center')`；`click(base,rand?)` 同时设 kind 与 clickWork |
| 回复 | `reply / sendText` 同写 sendText；`mute / muteReply` 同写 muteReply |
| 呈现 | `side / noAvatar / showAvatar / image / typing / thinking` |
| 效果 | `effects(...effs)` 追加数组 |
| 选择 | `choice(text,...effects)`；`choiceJump(text,storyId,mode='goto',...effects)` |
| 跳转 | `jump(storyId,mode?)` |
| 卡片 | `kizunaCard(storyId,{title?,buttonText?,align?})` |

现有作者能力不对称：StoryChoice.condition 在结构契约里存在，Builder 的 choice/choiceJump 没有条件参数；可直接传结构化 Talklet，但不能说 Builder 已覆盖全部契约。Builder 对 kind/choices/kizuna/clickWork 等冲突没有统一互斥校验。build 只检查 `text` 真值；speaker/avatar/sendText/image 等使用真值决定是否输出，typing/thinking 用 undefined 判定，因此 0 可保留。输出数组直接引用 Builder 内部数组，并非 deep freeze。

Entry Builder：共用 `.story/.inits/.when/.tags/.replayable/.conditionalReward/.branchGuard/.reveal/.openingTitle/.extra/.reactions/.followUp`。Active 另有 `.completionStrategy/.rewardFirst/.rewardRepeat/.owner`；Passive 有 `.repeatable/.weight/.rewardFirst/.rewardRepeat/.rewardPyroxene/.owner/.cooldownFrames/.affectionRequired/.pushAfterStory/.block/.interruptible/.leaveArea/.blocksInteraction`。PassiveBuilder 没公开 completionStrategy setter，尽管底层契约可声明 conditional；conditionalReward 方法本身不自动切换策略。

## 6. 启动：四类入口及优先顺序

### 6.1 普通 startStory

1. 门面 ensureCursorValid 先丢弃无法解析的旧游标。
2. 查目标 owner 的当前游标。若当前是 blocksInteraction passive，一律 AlreadyActive。
3. 期待启动 active 时可清除普通 passive；已有 active 拒绝。期待 passive 时只有 force 才能清除普通 passive。
4. 查目标 Entry、类型与其 StoryDef，要求至少一页。
5. 非 skipConditions 时检查 availableInits 与 triggerCondition。
6. 非 force 时，active 与不可重复 passive 按入口初始 StoryDef 完成记录拒绝 AlreadyCompleted。
7. beginStory：重置游标/栈/点击/选项确认/链访问集合，isReplay=false，记录第一页已读并发 storyTriggered（携带 Entry ID）。

**已核实的边缘行为：**清除被打断 passive 发生在新 Entry 查找与条件校验之前；若新目标不存在或条件不满足，原播放已清除。本报告不据此修改行为，只供整改决策。

`force` 并不跳过 availableInits/triggerCondition；源码函数头部旧注释说“跳过全部判定”，与函数体不一致，应按实现理解。RuntimeEffectReactor 的 triggerStory 用 force:true，却不传 skipConditions:true。

### 6.2 startCardStory

门面检查当前 blocksInteraction passive 后清空当前游标，调用 startStory(active, skipConditions:true, force:true)。因此：可丢弃当前 active 剩余页；已完成剧情可再开始；跳过 Init/触发条件；isReplay=false，可重复结算 repeat 奖励，不受重读分支守卫限制。目标校验失败也不会恢复原游标。

### 6.3 clickSend 的 kizuna 分支

底部按钮模式为 kizuna 时，清空当前游标后调用 startStory(active, skipConditions:true)，**没有 force:true**。已完成目标仍 AlreadyCompleted。它与 startCardStory 的注释宣称“一致”，但源码参数实际不同。UI 羁绊卡片确认走 startCardStory，故不能用底部 kizuna 路径代替说明 UI 卡片全部行为。

### 6.4 replayStory

只要求 Entry 存在、replayable=true、该 owner 无播放、初始 StoryDef 非空；不检查 AlreadyCompleted，也不要求玩家实际上已完成过。跳过 Init 和触发条件，beginStory(isReplay=true)。这是一种带分支已读守卫的正式播放模式，不是编辑沙盒。

## 7. 页推进与输入模式

### 7.1 getSendState（查询会初始化点击工作量）

优先级：没有故事→idle；非 click 且有 choices→choice；非 click 且有 kizuna→kizuna；其余→advance。

choice/kizuna 会清掉残留 clickWork。advance 读取显式 clickWork；kind=click 且未显式声明时使用 base=1。首次查询 roll：rand 不存在或 <=0 返回 base，否则 `base + floor(random*rand)`。查询并非纯只读：会写游标的随机 total。总数不是由每次 UI render 重抽。

### 7.2 clickSend

- choice：首次仅把 choiceTextConfirmed=true，返回 type:choice；再次点击也不选择，最终由 advanceStory(choiceIndex)提交。
- kizuna：执行前述入口替换。
- idle：owner 非空时先尝试好感队列，成功立即结束；否则随机被动抽选。
- advance：读取 sentText 与 echoReply；有 total>1 工作量时前 total 次填进度，第 total+1 次确认离页；total<=1 则一次点击即可推进。
- 一次 clickSend 当前只调用一次 advanceStory，返回 absorbed 空数组。函数旧注释仍写“向后吸收无交互页”，当前函数体不存在该循环；普通左侧连续消息靠 ChatStream 的定时回调逐页推进。

回显条件是非 click、muteReply 不为 true、有真值 sendText；这里不 trim 空白。领域的 story-interaction.ts 另有同名 shouldEchoReply，使用 trim，但主 story-flow.ts 使用自己的本地实现，不能把未接线 helper 当实际规则。

### 7.3 advanceStory 严格顺序

1. 校验来源 Entry、初始 Story、当前 StoryDef 和当前 page。
2. choices 非空要求 choiceIndex 为有效整数，再实时评估选项 condition；无 choices 却传索引则 InvalidChoice。
3. 先把 currentStoryChoiceIndex 写入游标，再决定跳转与重读守卫。
4. 解析目标/模式；若要跳出本 Story 或结束本 Story，且无 choices，click/clickWork 必须达到已确认态，否则 ClickRequired。
5. isReplay 且有目标时，按来源 Entry.branchGuards 中首个目标匹配项检查前置已读；失败 BranchGuardDenied。
6. 应用 page.effects，再应用 choice.effects；记录离开页和选择。
7. 有目标执行 jump；无目标 pageIndex+1、清点击进度/选项确认；下一页存在则记录已读并返回，否则结算/返回 insert。

重要限制：直接 advanceStory 对中间的无跳转 click/clickWork 页不做统一点击保护；保护条件限定为 willLeaveStory。choiceTextConfirmed 也是 UI 揭示门控，不是 advanceStory 的领域前置条件。编辑器/自动测试若直接调用 advance，会与玩家 UI 路径不同。

类型允许 kind=click 与 choices 同时存在。getSendState 忽略 click 页 choices，advanceStory 又要求索引，组合可能不能经普通底部按钮完成。因此“类型上可组合”不等于“交互上可用”。choices 与 kizuna 同时存在时底部模式选择 choices，而当前 Story 组件另有 kizuna 分派，未来应明确合法组合。

## 8. goto、insert 与完成身份

`performJump` 直接读 registry.stories，目标首页开始。goto 不压返回点；insert 压 `{fromStory.id, currentPageIndex+1}`。两者都保持来源 Entry、isReplay 与已有 insertStack；重置当前页选择、点击工作、确认；累加 jumpDepth，并把目标加到去重的 visitedStoryIds。

因此 insert 子剧情内部 goto 之后，原 insert 栈仍在；它不是清空所有调用上下文的“全局 goto”。`jumpDepth` 是本次播放累计跳转计数，返回不减；达到32后下一次跳转清游标并报 JumpLimitExceeded，不只是 insert 嵌套深度。保存不包含此计数，恢复重置0。

跳转目标缺失/空页时会清游标报 NotFound；此前本页/选项效果和阅读记录已执行，未形成失败原子事务。最大跳转限制同样在效果执行之后检查。

resolveStoryEnd 先弹 insert 栈：返回页未越界则恢复；返回点越界则继续弹，不逐层发奖励。栈空时取 **当前 StoryDef ID**，用来源 Entry 的奖励规则结算，并写当前 StoryDef 完成记录。active 记录当前 choiceIndex，passive 只记录 storyId；choiceIndex 不是整条链的完整决策树。

**需要上层明确的身份风险：**启动时按初始 entry.storyId 判断已完成，而 goto 链结束时记录最终当前 StoryDef。若初始与最终不同，入口完成准入、Entry followUps/reactions 的完成匹配可能与终端记录不一致；本文仅按源码标记此不对称，未新建回归验证。

## 9. 效果、条件与时机

### 9.1 页效果何时发生

大部分页效果离页执行；进入页/把内容落入聊天历史并不等于执行 effects。首 Story 首页 `showOpeningTitle`：beginStory 使用 find 取第一个该 op 直接发 openingTitleShown；离开任何 pageIndex=0 页时过滤全部 showOpeningTitle。performJump 不调用 beginStory，因此通过跳转进入另一个 StoryDef 首页不会走相同开局标题特例，而离开该首页仍会过滤该 op。这是源码路径差异，应在整改前明确设计意图。

trackFlagsAndApply 先收集 setFlag target，再把非 travelToArea effects 一次交给 EffectEngine，最后按原列表执行所有 travelToArea。故 `[旅行A,加资源,旅行B]` 不严格按列表逐项交错，而是资源部分先执行、旅行A/B后执行。page 与 choice 分两批，保持页批次在前。

旅行使用 `travelToArea(target,true,false)`，允许剧情期间移动、跳过邻接检查；失败不终止剧情。notice=true 且成功则发 storyAreaTraveled，供显示移动提示。

### 9.2 Effect 全集可达性

Talklet.effects 与 StoryChoice.effects 都使用通用 Effect，并非专用缩减列表。当前 EffectOp 包含：资源 set/add、Spot等级 set/add、manager、enhancement、item、loot、unlockInit、flag、triggerStory、travelToArea、Spot等级上限设/移、Extra设/加/移、grantCharacter、addAffectionExp、setTheme、setEntityPresentation/clearEntityPresentation、clearAllChatFlow、showChatText、clearIdChatFlow、clearAllChatText、showOpeningTitle。

但“可填 op”不是“该上下文具有实际结算效果”：setSpotMaxLevel/removeSpotMaxLevel 属 Affector 声明；loot 的显示说明仍注明未接执行；旅行在 Story 侧独立处理。EffectEngine 先解析整批 value expression，再筛出运行时 handler 处理项，剩余交 mutation；不能把同批 effect 表达式当然理解成逐项读前一项刚写的结果。

运行时副作用见 [runtime-effect-reactor.ts](../../../../src/arona-clicker/services/runtime/runtime-effect-reactor.ts)：triggerStory 查 Entry 类型后 force 启动到 effect.owner 游标；theme 交 ColorSystem；entity presentation 交内存覆盖层；聊天演出 op 交 ChatFlowService。clearAllChatFlow 的 target 在该转发路径未用于路由，不应只凭 Effect 注释认定支持任意 Variant 定向清流。

### 9.3 条件

Entry.triggerCondition、Choice.condition、conditionalRewards[].condition、Passive.block 使用 ConditionGroup；reactions 支持原子或组。ConditionSystem 支持嵌套 AND/OR 与常用比较，通用 target 包括资源、Spot等级、manager、flag、enh、tag、统计、Extra、角色统计、好感、Area 等。

Story相关三个条件不同：hasReadStory 实际检查当前 state.storyLog 的完成记录；hasReadStoryInRun 经 StatsService 当前 Run 完成记录；visitedStoryInChain 经 StoryService.isVisitedInChain，当前实现只看 globalCursor，未按 owner 参数查询聊天链。阅读到某页的 logs 主要由 branchGuard 使用，不直接等同 hasReadStory。

## 10. 奖励、重读与完成通知

conditional 策略且列表非空：find 首个满足项，只发其 effects；没命中不会自动落入 simple。若 conditional 但列表缺失/为空，则代码继续 simple completionReward。simple 根据最终当前 StoryDef 是否已在 storyLog，取 first 或 repeat。

正式完成顺序：应用奖励→completeStory→passive冷却/学生block→若有实际奖励则 storyRewarded（含收集flags）→清游标。completeStory 把 CompletedStory push 到当前 Init 的 storyLog，用 sourceEntryId 精确完成该 Entry 的 areaStoryDelivery，记录 Stats并发 storyCompleted（携带 StoryDef ID）。没有奖励时不会为纯flags单独发 storyRewarded。

重读 resolveStoryEnd 不做上述完成奖励/日志/冷却/block/通知，但 advanceStory 页/选项效果、begin/advance的已读写入仍发生。现有 replay test 的“不重复发放奖励”只验证 completion reward；不能扩大为页内加资源、旅行、清流、Extra和triggerStory都安全隔离。

branchGuard 只在 isReplay 且有跳转时检查；prerequisites 全满足，索引-1要求对应 StoryDef全部页都在 readTalkletIndexes。守卫失败在 page/choice effects前，但 choiceIndex 已写入。原注释“无任何副作用”只能解释为无效果结算，不能严格说游标完全没变。

## 11. owner、并发与被动队列

globalCursor用于未传owner/null；chatCursors 用 `variant:${owner}`。cursorFor 依据 owner != null，因此空串也可能成为独立聊天游标，而部分入口用 truthy owner 判好感队列；内容工具应避免传空串作为模糊归属。

普通 startStory 使用调用方 owner 选择游标，没有自动把 Entry.owner 代入或验证两者一致；区域投递 accept 入口会显式读 Entry.owner。owner归属约束分别存在于具体入口，不是一个统一隐式规则。

交互门控：无owner时看global+全部聊天游标；指定owner看global+该owner。active阻塞手动移动与外部交互；passive.blocksInteraction也同时阻塞；leaveArea=false只额外阻塞移动。clearPassiveIfPlaying只在interruptible!=false且blocksInteraction!=true时清除普通passive。

随机被动队列通过 PassivePoolSystem 树抽取，过滤 weight<=0、Init、条件、已完成不可重复、owner、cooldown/block；affectionRequired或pushAfterStory声明者退出随机池。

就绪队列要求不可重复、owner精确匹配、未阻断、未完成、Init/条件/冷却合格；尾巴需pushAfterStory已完成，且优先于好感台阶；台阶按所需等级升序，并列保留Registry声明顺序。若两个字段同时有值，pushAfterStory优先，不再检查affectionRequired。后台打开/点击推送、完成尾巴推送是Entry编排，不是Talklet本身触发机制。

并发注意：游标按owner隔离，但 StoryService.flagsSetThisStory、lastRewarded为服务级共享对象；isVisitedInChain看全局。不能泛化为所有剧情相关临时态均按owner独立。其并发影响尚未单独构造回归实验。

## 12. 保存、恢复与已读记录

| 状态 | 保存形式 | 恢复特点 |
| --- | --- | --- |
| 来源Entry | currentStoryId（历史命名）/currentStoryEntryType | 恢复核对Entry存在、类型未变；缺旧字段时补齐 |
| 实际演出 | currentStoryDefId/currentStoryPageIndex | 按数组索引；必须能读到该页，否则清游标 |
| 当前选择 | currentStoryChoiceIndex | 保存单值；全历史选择另在read logs |
| 点击 | talkletClickWork total/done | 保存已roll总数与完成量 |
| 插入链 | insertStack[{storyId,pageIndex}] | 保存返回点；弹栈时核实目标存在 |
| 访问链 | visitedStoryIds | 保存去重列表 |
| 重读 | isReplay | 旧档缺省false |
| jumpDepth | 不保存 | restore重置0 |
| choiceTextConfirmed | 不保存 | restore重置false |
| 聊天节奏/DOM | 不在StoryCursor | UI历史与门控由另一路径恢复，见呈现报告 |

主 SaveData 把global游标拆成 pendingStoryId/pendingStoryEntryType/pendingStoryDefId/pendingStoryPageIndex/pendingStoryChoiceIndex/pendingTalkletClicks/pendingInsertStack/pendingVisitedStoryIds/pendingIsReplay，另存 chatCursors。InitService 把 global/chats 合在 StoryCursorCollection 纳入每Init快照；不是复用老StoryService对象。

recordStoryRead 按 StoryDef ID 保存已读页索引排序去重；chosenChoiceIndexes[pageIndex] 保存所有曾选索引去重。调用时机包含begin第一页、进入下一页、跳转目标第一页、insert返回页、离页与选择；因此它表示领域进入/离开页，不严格代表UI typing消息已送达。玩家可能尚未等文字显示，第一页已被记为读。

未来编辑器重排 Talklet、删除页、重排 choices 时，既有游标、insert返回点、read logs、branch guards和UI storyPageKey都有索引语义。当前 ensureCursorValid只检查索引还能取到页，不检测该索引是否变成另一个内容节点。这是稳定身份整改的直接影响面。

## 13. 完成后的编排边界

[StoryEntryReactionMount](../../../../src/arona-clicker/services/story/story-entry-reaction-mount.ts)在当前Init按完成记录派生TriggerDef，派生ID为`entry.id#reaction:reaction.id`，once缺省true；toTrigger当前使用on/condition/effects/once，作者lifetime没有在该函数中映射。不能仅看契约认为所有lifetime语义已经实现。

[StoryFollowUpMount](../../../../src/arona-clicker/services/story/story-follow-up-mount.ts)只在来源storyId完成且Init合格后等待未来areaEntered，不追补已在目标Area的旧事件。Active目标创建pending区域投递、消费once，不自动播放；Passive目标仍直接启动，每次区域进入至多成功启动一个。目标已完成的Active直接消费等待。acceptAreaStoryDelivery会重核Area/投递/Entry/完成/owner游标，并普通启动。

[StoryAvailabilityDeliveryMount](../../../../src/arona-clicker/services/story/story-availability-delivery-mount.ts)对注入的特定Entry清单，在首次可用时投递到当前Area；不是所有ActiveStoryEntry统一无差别自动投递。后续编辑工具应把这类入口来源与内容页分开展示。

## 14. 已有测试证据与本轮未覆盖项

本报告记录的那轮定向测试包含当时存在的旧作者工厂用例；节点合同迁移后，其当前作者工厂验证位于 [story.test.ts](../../../../tests/engine/def-factory/story.test.ts)，播放行为由 [story-node-playback.integration.test.ts](../../../../tests/engine/story-node-playback.integration.test.ts) 覆盖。其余历史执行记录为 `tests/engine/story-flow.test.ts`、`tests/engine/story-replay.test.ts`、`tests/engine/chat-flow-service.test.ts`、`tests/ui/flow-entry.test.ts`、`tests/ui/chat-typing.test.ts`、`tests/ui/story-history-resume.test.ts`、`tests/ui/components/chat-text.test.ts`、`tests/ui/components/chat-image.test.ts`；报告中的120/120与14.96s是原快照记录，不代表当前节点合同测试的运行结果。

| 测试 | 已读断言范围 |
| --- | --- |
| [story-flow.test.ts](../../../../tests/engine/story-flow.test.ts) | click+goto直接advance被挡；多击填满还需确认；insert末页click先确认；goto链末页click；choice先确认文字；Millennium组合例 |
| [story-entry-split.test.ts](../../../../tests/engine/story-entry-split.test.ts) | Entry/Story并行注册与引用；FollowUp引用及局部ID；奖励经Entry、记录按Story；已读页与选择；缺旧logs兼容 |
| [story-rewards.test.ts](../../../../tests/engine/story-rewards.test.ts) | flag分歧奖励；声明顺序条件兜底；visitedStoryInChain决定奖励 |
| [story-replay.test.ts](../../../../tests/engine/story-replay.test.ts) | replayable准入；未读分支拒绝/读后放行；重读不重复完成奖励；阅读累积 |
| [init-global-lifecycle.test.ts](../../../../tests/engine/init-global-lifecycle.test.ts) | 全局与进行中insert游标跨Init快照恢复，不复用旧运行时 |
| [def-factory/story.test.ts](../../../../tests/engine/def-factory/story.test.ts) | 节点版Story工厂与作者合同（旧Talklet工厂用例已随节点迁移退役） |
| [def-factory/story-entry.test.ts](../../../../tests/engine/def-factory/story-entry.test.ts) | Active/Passive默认值、奖励/守卫/reaction/owner/冷却/阻断/标题 |
| [story-history-resume.test.ts](../../../../tests/ui/story-history-resume.test.ts) | 全局/owner历史恢复、相同文本不同页、insert同页码不同StoryDef、typing未送达与已送达连发恢复 |

未新运行或新增用例：click+choices冲突、kizuna两入口已完成差异、重读页效果副作用、goto完成身份不对称、聊天owner的visitedStoryInChain、并发共享flags、跳转目标缺失后的已执行效果、跳转首页opening特例、索引重排后恢复。这些是源码直接观察或风险推断，不标记为已复现实测bug。

## 15. 供上层讨论的问题（未裁定）

1. 单Story创作单位是否只含StoryDef，还是要同时包装一个或多个Entry、跳转子Story与完成编排？
2. Talklet是否升级为明确节点类型，还是保留字段组合并补完整合法性/优先级合同？如何处理click、choices、kizuna同时声明？
3. 稳定页ID与选项ID如何引入，旧页码进度如何处理，是否允许内容版本不兼容时废弃局部播放？
4. goto是当前“保留insert返回栈”的局部转移，还是需要另一种清栈终止跳转？完成身份属于来源Entry、初始Story、最终Story还是显式播放链？
5. 预览是隔离状态的模拟Runtime、只渲染，还是允许真实Effect？重读不能直接承担编辑器安全预览。
6. 页入场/内容实际送达/玩家确认/离场/故事完成的效果时机，是否需要显式化并统一开幕标题特例？
7. 剧情游标、页面读记录、UI聊天历史、定位覆盖层、地图Flow条目分别由谁持有，哪些可由一个Story编辑产物声明？
8. 是否修齐三种启动路径、owner隔离和完成记录的不对称；哪些作为兼容行为保留，哪些应明确迁移？

