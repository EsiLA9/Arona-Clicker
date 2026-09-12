# PassiveStory / StoryChain 设计意见与逐条审阅

状态：✅ 已裁定；施工任务见 [[docs/plan-work/active/task-0032-passive-story-scheduling]]

> 本文保存 Sol 对 PassiveStory 的完整设计意见，并基于当前 AronaClicker 代码逐条审阅。本文是方案评审记录，不替代 docs/docs-828 中的当前机制事实源，也不代表已经决定引入 StoryChain。

## 一、Sol 原文

### 总体判断

整体上，我会保留你现在的“大框架”，但把 PassiveStory 从“特殊 StoryEntry”提升成一个正式的投放/调度领域。目前真正的问题不是复用 StoryService，而是身份、资格判断、调度状态、演出状态混在了一起。

我推荐的核心分层是：

> StoryDef = 演什么  
> StoryChain = 这段剧情在逻辑上是什么  
> PassiveEntry = 从哪里、以什么规则投放它  
> Pool = 如何参与随机竞争  
> StoryRun = 这一次实际播放到了哪里

这样基本能把你列出的边界问题一次性解决。

### A. PassiveStory 是否继续复用 StoryEntry + StoryDef + StoryService？

StoryDef 和 StoryService 应继续复用；StoryEntry 不建议继续承担 PassiveStory 的全部语义。

你现在复用 Talklet / choice / clickWork / goto / insert / Effect 是非常正确的。Active / Passive 的差别主要应该发生在：

- 怎么获得播放资格；
- 谁请求启动；
- 是否参与随机；
- 是否进入 ready queue；
- 播放前如何锁定资源；
- 播完后如何记账。

一旦进入演出：

~~~~text
StoryRun
  ↓
StoryService
  ↓
Talklet / choice / goto / insert / Effect
~~~~

Passive 和 Active 应该几乎没有区别。

所以架构上建议变成：

~~~~text
┌─ ActiveStoryEntry
StoryDef ← Chain ←┤
                  └─ PassiveStoryEntry
                           ↑
                     PassiveScheduler
                           ↑
               Pool / ReadyQueue / Trigger
~~~~

也就是说：复用演出系统，不复用调度语义。

如果现有 StoryEntry 本来就是一个非常薄的：

~~~~ts
{
  id,
  storyId
}
~~~~

那可以继续作为共同基类。

但如果它已经开始承载 weight、cooldown、affectionRequired、pushAfterStory、owner、repeatable、block、pool 等字段，那实际上它已经不是通用 StoryEntry，而是 PassiveStoryEntryDef 了。

我会显式拆开，否则未来你会不断出现：“这个字段 ActiveStory 应不应该管？”

### B. 是否统一所有启动路径的资格检查？

必须统一。

现在：

~~~~text
idle click
    ↓
复杂资格检查
    ↓
startStory()
~~~~

但：

~~~~text
某代码
    ↓
startStory()
    ↓
直接播放
~~~~

意味着你实际上有两个系统。

长期一定会出现：

- debug 命令绕 cooldown；
- pushAfterStory 绕 block；
- trigger 启动绕 affection；
- UI 点击绕 owner；
- 脚本 Effect 调用绕 repeatable；
- mod/datapack 找到一条非预期启动路径。

推荐所有正式启动统一走：

~~~~ts
requestStoryStart(request)
~~~~

而不是：

~~~~ts
startStory(storyId)
~~~~

例如：

~~~~ts
requestStoryStart({
  source: "passive-random",
  entryId,
  owner,
})
~~~~

内部：

~~~~text
resolve target
    ↓
EligibilityService.evaluate()
    ↓
reserve / consume scheduling state
    ↓
create StoryRun
    ↓
StoryService.start(run)
~~~~

但是需要保留一个真正的低级 API：

~~~~text
unsafeStartStory()
~~~~

仅供：

- 存档恢复；
- 测试；
- debugger；
- developer console。

甚至命名就应该故意危险：

~~~~text
storyRuntime.restoreRun()
storyRuntime.startUnchecked()
~~~~

资格检查本身也不要写成一个巨型 if。推荐返回结构化结果：

~~~~ts
EligibilityResult {
  eligible: boolean

  reasons: [
    { type: "init", ... },
    { type: "condition", ... },
    { type: "cooldown", ... },
    { type: "block", ... },
    { type: "repeat", ... },
    { type: "affection", ... },
  ]

  effectiveWeight?: GameNum
}
~~~~

这对 Datapack 尤其重要。以后可以直接做作者调试 UI：

~~~~text
为什么这条闲聊没有出现？

✓ Init
✓ Trigger
✓ Owner
✗ StudentBlock: base:arona
  剩余 73 tick
✓ Cooldown
✓ Repeatable
Weight: 0.42
~~~~

### C. canonical identity 应该是 Entry、StoryDef，还是独立 StoryChain？

我强烈推荐：

独立 StoryChainId 作为剧情业务身份。

三者身份分别承担不同意义：

| Identity | 表示什么 | 是否适合记录完成状态 |
| --- | --- | --- |
| StoryDef.id | 一段实际演出内容 | 否 |
| Entry.id | 一个投放位置/方式 | 否 |
| StoryChain.id | 玩家认知中的“一件剧情” | 是 |

为什么 StoryDef 不适合？

假设：

~~~~text
arona_morning_01
~~~~

以后重构为：

~~~~text
arona_morning_intro
arona_morning_main
arona_morning_tail
~~~~

玩家其实仍然完成的是同一件事。如果历史状态绑 StoryDef.id，内容重构会破坏存档语义。

反过来也可能：

~~~~text
Entry A ─┐
         ├→ same StoryDef
Entry B ─┘
~~~~

两个 Entry 可能是：

- 不同地图入口；
- 不同世界线；
- 不同 Pool；
- 不同权重；
- 不同条件。

它们共享演出，不代表它们一定共享业务身份。

所以推荐：

~~~~ts
StoryChainDef {
  id: StoryChainId

  nodes: {
    start: StoryNodeDef
    ...
  }
}

StoryNodeDef {
  story: StoryDefId
}
~~~~

最简单的一段 PassiveStory：

~~~~text
chains:
  arona.breakfast:
    story: arona.breakfast.story
~~~~

可以允许 shorthand，编译阶段自动生成单节点 Chain。这样不会给普通 Datapack 作者增加负担。

### D. Pool / Entry / Child cooldown 怎么设计？

这里建议从“某对象上有个 cooldownFrames”改成：

cooldown 是一种带 scope 的锁。

~~~~ts
CooldownRule {
  key?: CooldownKey
  duration: GameNum
  scope:
    | "entry"
    | "pool"
    | "owner"
    | "student"
    | "chain"
    | "custom"

  consumeOn:
    | "started"
    | "delivered"
    | "completed"
}
~~~~

实际状态只需要：

~~~~ts
cooldowns: Map<CooldownStateKey, ExpireTick>
~~~~

Pool / Child / Entry 的自然语义：

~~~~text
Pool A cooldown=100

├─ Child X cooldown=30
│   ├─ Entry 1 cooldown=10
│   └─ Entry 2
│
└─ Child Y
    └─ Entry 3
~~~~

选中 Entry 1 后，应原子消费：

~~~~text
Pool A   → 100
Child X  → 30
Entry 1  → 10
~~~~

选 Entry 3：

~~~~text
Pool A   → 100
~~~~

这样 child cooldown 才真正成为：“这个剧情类别暂时少出现一点。”

例如：

~~~~text
school_life
├── food          cooldown 30
├── weather       cooldown 20
├── teasing       cooldown 60
└── serious       cooldown 120
~~~~

cooldown 在什么时候消费？

我默认推荐：delivered。

因为 completed 太晚：

~~~~text
抽中
→ 用户退出
→ 没 complete
→ 再抽
→ 同一条又来
~~~~

而 started 又可能太早：

~~~~text
创建 StoryRun
→ UI 尚未展示
→ 游戏被关闭
~~~~

玩家实际上没看到，却吃掉冷却。

因此三阶段刚好能解决：

~~~~text
started   = run 已建立
delivered = 至少一个有效 Talklet 已呈现
completed = 正常抵达终点
~~~~

默认：

~~~~text
consumeOn: delivered
~~~~

特殊剧情可以明确指定 consumeOn: completed。

### E. reveal / trigger / ready / block 要不要合并？

不要合并。

它们不是同一维度。

应该在 API 上统一评估，但语义必须分层。

建议明确划成四个概念：

| 概念 | 语义 |
| --- | --- |
| Reveal | 玩家知不知道它存在 |
| Eligibility | 现在允不允许启动 |
| Scheduling | 它怎么进入待播放候选 |
| Concurrency | 它跟什么东西不能同时/连续发生 |

对应你的概念：

- revealTriggers → Reveal；
- triggerCondition → Eligibility；
- ready queue → Scheduling；
- block → Concurrency。

尤其不要让：

~~~~text
reveal == false
~~~~

自动意味着：

~~~~text
eligible == false
~~~~

否则将来很难表达：

一个隐藏事件在后台发生，但玩家事前不知道其存在。

同样不要把 ready 理解成“资格”。

Ready 应该表示：

Scheduler 已经产生了一次待交付意图。

### F. 是否需要 started / delivered / completed？

非常需要。

实际上对你的系统来说，这三个状态已经隐含存在了，只是目前没有正式建模，因此出现了：

被打断的 non-repeatable 又进入 ready queue。

推荐建立：

~~~~text
          ┌──── abort ────┐
          ↓               │
eligible → started → delivered → completed
              │         │
              └ resume ─┘
~~~~

它们分别回答三个完全不同的问题。

started：

系统已经决定“这一次剧情实例存在”。

- 创建 StoryRunId；
- 保存 cursor；
- claim ready item；
- 防止 scheduler 再创建另一个相同实例。

delivered：

玩家至少真的看到了一部分剧情。

- 写 seenAt；
- 消费默认 cooldown；
- non-repeatable 禁止再产生新的 run；
- UI 标记“已见”。

completed：

StoryRun 正常走到了 terminal。

- completionCount++；
- first/repeat reward；
- conditional reward；
- pushAfterStory；
- affection tail；
- completion trigger；
- storyLog；
- block-after-complete。

尤其：first/repeat reward 必须按 completedCount 判断，而不是 started/seen。

### G. 我推荐的最终模型

~~~~ts
StoryDef {
  id
  talklets
}

StoryChainDef {
  id

  ownerPolicy

  nodes: StoryChainNode[]

  repeatPolicy
  completionPolicy
}

StoryChainNode {
  id
  story: StoryDefId

  next?
}
~~~~

然后：

~~~~ts
PassiveStoryEntryDef {
  id

  chain: StoryChainId
  node?: StoryChainNodeId

  owner

  eligibility?: Condition

  delivery:
    | {
        type: "random"
        pool: PassivePoolId
        weight: GameNum
      }
    | {
        type: "ready"
        enqueueWhen: Trigger
        priority: GameNum
      }

  cooldowns?: CooldownRule[]

  block?: BlockRule

  reveal?: RevealRule
}
~~~~

Pool：

~~~~ts
PassivePoolDef {
  id

  children: PoolChild[]

  eligibility?: Condition
  cooldowns?: CooldownRule[]

  selectionPolicy?: {
    type: "weighted"
  }
}
~~~~

Child：

~~~~ts
PoolChild {
  target: PoolId | EntryId

  weight: GameNum

  eligibility?: Condition
  cooldowns?: CooldownRule[]
}
~~~~

### 随机权重还有一个值得现在修的地方

你当前：

PoolChild 路径权重相乘 × Entry.weight。

数学上没有问题，但作者心智并不好。

例如：

~~~~text
A weight 1
  ├ 10 entries

B weight 1
  └ 1 entry
~~~~

如果最终 flatten 后每个叶子都是 pathProduct，那么 A 总概率约为 10/11，B 总概率约为 1/11。

很多内容作者会自然以为 A = 50%、B = 50%，因为他们认为 PoolChild.weight 是“分支权重”。

所以最好明确两种模型之一。

我更推荐真正的分层抽取：

1. 在当前 Pool 的 eligible children 中按 child.weight 抽一个；
2. 如果是 subpool，继续进入子 pool；
3. 如果是 Entry，按 Entry.weight / sibling semantics 抽取。

这样 A weight 1、B weight 1 永远意味着 50%/50%，不会因为 A 底下新增一个 Dialogue 就把整个概率分布改坏。

这是 Datapack 作者体验上的巨大提升。

### Ready Queue 也建议从 Entry 列表升级

不要只存：

~~~~text
readyQueue: EntryId[]
~~~~

建议存：

~~~~ts
DeliveryIntent {
  id

  entryId
  chainId
  owner

  reason:
    | "affection"
    | "story-followup"
    | "trigger"
    | "script"

  priority

  createdAt

  sourceEventId?

  state:
    | "pending"
    | "claimed"
    | "delivered"
    | "completed"
    | "cancelled"
}
~~~~

这能解决一个很大的潜在问题：

好感达到 10 → enqueue → 好感后来变化。

如果只是每次实时扫描 affectionRequired，答案会变得模糊。而 Event-driven 系统更自然的语义应该是：

达到阈值这个事件已经发生，因此生成了一次 DeliveryIntent。

### 存档层级

你现在：

cooldowns、studentBlocks

在 PlayerState 顶层，我认为长期风险很高。

默认应该跟随造成它们的生命周期。

~~~~text
PlayerState
├─ globalStoryState
│
└─ InitSnapshots
   └─ initId
      └─ passiveStoryState
~~~~

例如：

~~~~ts
PassiveStoryState {
  cooldowns
  blocks

  chainProgress
  runs

  readyQueue
}
~~~~

默认：

Init 内产生的 cooldown → InitSnapshot。

只有明确声明 scope: global 的：

- StoryChain completion；
- account-level narrative；
- 跨世界线角色关系；

才写 Global。

否则会出现非常奇怪的体验：

世界线 A：阿罗娜刚聊过天气。

切到世界线 B。

阿罗娜：“天气话题 CD 中”。

除非这是设计意图，否则应该避免。

### 最终状态机

~~~~text
EVENT
                   │
                   ▼
             Scheduling
          ┌────────┴────────┐
          │                 │
       Random             Ready
          │                 │
          └────────┬────────┘
                   ▼
            Candidate Entry
                   │
                   ▼
          Eligibility Evaluate
                   │
             ┌─────┴─────┐
             │           │
          reject       accept
                         │
                         ▼
                     Reserve
                         │
                         ▼
                      Started
                         │
                         ▼
                     Delivered
                         │
                         ▼
                     Completed
~~~~

其中 StoryService 只负责最后三步附近：

StoryRun → Talklet runtime → terminal。

PassiveScheduler 完全不应该知道 choice、goto、insert、clickWork。StoryService 也完全不应该知道 pool weight、affection、ready priority。

### 最重要的一组不变量

1. 任何正常 Story 启动都必须经过同一个 eligibility + reservation pipeline。
2. StoryDef.id 永远不承担玩家剧情进度的 canonical identity。
3. 同一 DeliveryIntent 最多产生一个活跃 StoryRun。
4. non-repeatable Chain 在达到其定义的消费阶段后，不得产生新的 Run，但现存 Run 可以恢复。
5. completed 必须是幂等事务；重复执行完成回调不得重复发奖励。
6. 完成某 Entry 时，只修改本次真实参与的 Pool ancestry / Child / Entry cooldown key。
7. cooldown 检查和 cooldown 消费必须使用同一种 canonical key 生成算法。
8. reveal=false 不等价于 eligible=false。
9. ready queue 不参与随机权重竞争；Random 和 Ready 是两个 scheduler source。
10. 所有剧情状态必须显式声明生命周期 scope；没有声明时默认跟随 Init。
11. owner 只决定 conversation namespace / cursor / scheduling domain，不应偷偷改变 Story identity。
12. 恢复一个 started StoryRun 永远不重新执行 eligibility、权重抽取或 ready enqueue。
13. completedCount、reward ledger、story completion 必须在同一个原子提交中更新。
14. Datapack reload 后，只要 Chain ID 不变，StoryDef 的内部拆分和 Entry 移动不应让玩家重新完成旧剧情。

### 最后

我会特别改掉现在这个观念：

~~~~text
PassiveStoryEntry = 剧情
~~~~

改为：

~~~~text
PassiveStoryEntry = Delivery Rule
StoryChain         = Narrative Entity
StoryDef           = Presentation
StoryRun           = Runtime Instance
DeliveryIntent     = Scheduled Instance
~~~~

一旦这五个概念分开，你现在列出的 startStory 绕检查、Entry/StoryDef ID 混乱、ready 重入、pool cooldown 丢失、跨 Init 冷却污染、羁绊尾巴重复入队，都会变成非常容易定义和测试的问题。

对于 AronaClicker 这种未来还要让 Datapack 作者编写复杂剧情/触发器的系统，我认为这是比继续给 PassiveStoryEntry 加字段更值得做的一次结构升级。

## 二、逐条审阅说明

### 总体结论：诊断正确，但 StoryChain 不是当前阶段的必要解法

Sol 对当前问题的诊断基本准确：现在确实混合了四种不同语义：

1. StoryDef 的演出内容；
2. Entry 的触发入口；
3. PassivePool 的调度；
4. StoryService 的运行时游标。

不过，Sol 把“业务身份问题”直接升级成完整 StoryChain，是一次较大的结构跃迁。当前代码已经通过 Talklet 的 goto/insert 支持多个 StoryDef 组成演出链；如果再增加 StoryChainDef、StoryChainNode、Entry → Chain → Node → StoryDef 四层引用，会同时增加 Registry 表、Datapack Schema、编辑器同步、引用校验、存档身份、StoryService 跳转语义、测试矩阵和内容重写。

因此我的裁定是：

> 保留 Sol 的分层思想，但暂不引入正式 StoryChain 实体。先把“调度身份”和“演出身份”拆开；只有实际出现跨多个 StoryDef 共享业务进度的内容时，再引入 StoryChain。

低风险替代方案是给 Entry 增加可选业务完成键：

~~~~ts
completionKey?: string
~~~~

默认值为 entry.storyId。需要跨 StoryDef 共享进度时，多个 Entry 或跳转节点使用相同 completionKey；需要独立进度时使用不同 key。

这样可以解决当前主要问题，不必先创建 StoryChain 表。

### A. 复用 StoryService，但不必立即拆掉 StoryEntry

这一条大方向正确。

Passive 与 Active 在进入演出以后确实应该共用 Talklet、choice、clickWork、goto/insert、Effect、StoryCursor 和 UI 演出事件。

但“PassiveEntry 只是 Delivery Rule”有一点过度纯化。当前 owner、奖励、block、repeatable 等字段确实属于投放生命周期，不属于演出内容；可是一个 Entry 仍然是“某次剧情投放的业务配置”，不只是池节点。

建议分两步：

1. 保留当前 PassiveStoryEntry，先把资格评估和启动入口统一；
2. 如果 Active/Passive 公共字段继续膨胀，再拆成 StoryTriggerEntryBase、ActiveStoryEntry、PassiveStoryEntry、PassiveDeliveryRule。

暂不引入 StoryChain。

Sol 的“复用演出系统，不复用调度语义”应采纳；“立即建立四层新数据模型”暂缓。

### B. 统一启动资格检查：强烈赞同，属于 P0

这是 Sol 建议中最应该优先实施的一项。

当前 startStory 的确不是完整 Passive eligibility 检查。它主要检查 Entry 是否存在、类型、Story 是否存在、Init、triggerCondition 和 repeatable，但不会检查 owner、cooldown、block、affectionRequired、pushAfterStory、weight。

因此应统一正式启动入口，但不建议简单把所有入口压成一个无差别 API。不同来源本来就有不同策略：

| 来源 | 应检查的内容 |
| --- | --- |
| passive random | Pool、owner、weight、cooldown、block、repeatable、普通 eligibility |
| affection ready | owner、好感、ready priority、repeat、cooldown、block |
| tail push | owner、前置完成、repeat、cooldown、block |
| active story | active entry 条件 |
| replay | replayable 与分支守卫 |
| save restore | 不重新抽取、不重新判断 |
| debug/test | 明确绕过，但必须命名为 unchecked |

推荐引入 requestStoryStart({ source, entryId, owner, policy })，内部统一调用 EligibilityEvaluator，然后再创建或恢复 StoryRun。

现有 force、skipConditions 两个布尔参数表达能力太强，容易误用。长期可改为显式 StartPolicy，例如：

~~~~ts
{
  checkInit: true,
  checkTrigger: true,
  checkRepeat: true,
  checkSchedule: true,
  allowInterruptPassive: false
}
~~~~

但 save restore 和 debug/test 仍应保留低级 unchecked 路径，不能让通用 EligibilityEvaluator 负责恢复存档。

### EligibilityResult：赞同，但先做只读诊断

Sol 建议返回结构化 reasons 很有价值，尤其适合 Datapack 调试 UI。

第一步不必等新架构完成。可以直接在现有代码上增加：

~~~~ts
evaluatePassiveEntry(entryId, context): EligibilityResult
~~~~

先把当前分散在 PassivePoolSystem、story-flow、readyStepIds 中的判定集中成纯查询逻辑；随后让真正启动路径复用同一结果。

effectiveWeight 只有在随机 Pool 上下文中才有意义，不能让脱离 Pool 的普通 EligibilityResult 假装拥有确定权重。

### C. StoryChain：方向有价值，但当前不应直接落地

Sol 关于三种身份的分析是正确的：

- StoryDef 是表现节点；
- Entry 是投放入口；
- 玩家认知的“完成了一件剧情”可能是另一种身份。

但当前问题可以先用三种更小的方式解决：

#### 方案 1：completionKey

~~~~ts
PassiveStoryEntry {
  id
  storyId
  completionKey?: string
}
~~~~

这是当前最推荐的方案。

#### 方案 2：公共 Entry 业务身份

如果 Active 和 Passive 都需要统一完成记录，可以把字段放到 StoryEntryBase：

~~~~ts
StoryEntryBase {
  id
  storyId
  progressKey?: string
}
~~~~

#### 方案 3：未来再引入 StoryChain

只有出现以下实际需求时再升级：

- 多个独立 Entry 共享同一套跨节点进度；
- StoryDef 被大规模重拆，但必须保持玩家完成状态；
- 多个投放入口需要共享某个剧情链的完成次数；
- 需要对 Chain 节点做统一跳转、统计、奖励或解锁；
- 编辑器需要以“剧情链”而不是单个 StoryDef 作为创作单位。

当前 StoryDef 已经通过 Talklet 的 jumpToStory 形成运行时图。引入 StoryChainNode.next 可能与现有跳转系统形成第二套图结构。未来若采用 StoryChain，必须先明确 Chain 节点的 next 是否取代 Talklet jump、还是只做业务身份；一个 StoryDef 是否只能属于一个 Chain；insert 子剧情属于 Chain 节点还是 StoryRun 临时栈。

### D. Cooldown scope：赞同方向，反对一次性泛化到六种 scope

Sol 指出当前 pool/child/entry cooldown 语义不完整，这是正确的。

当前代码至少存在两个确定问题：

1. PassivePoolChild.cooldownFrames 声明了，但抽取逻辑没有消费；
2. 只有 pool.cooldownFrames 而没有 entry.cooldownFrames 时，完成后 recordPassiveCooldown 会提前返回，池冷却不会写入。

这应作为独立 P0/P1 修复，而不是等 StoryChain。

但 scope 一次扩展为 entry、pool、owner、student、chain、custom，容易把简单的被动闲聊机制变成通用锁系统。第一阶段建议只支持：

~~~~ts
scope: 'entry' | 'pool' | 'owner'
consumeOn: 'started' | 'completed'
~~~~

并先统一状态键算法：

~~~~text
passive:<entryId>
passive-pool:<poolId>
passive-owner:<owner>
~~~~

是否支持 delivered，应等 UI 与引擎事件边界确定后再决定。当前 Talklet 已显示与 UI ChatStream 的 typing 门控有关，如果用 UI 呈现事件作为持久化语义，存档与恢复会更复杂。

Sol 推荐 delivered 作为默认消费时机，设计上合理；但对当前项目我暂时更倾向：

- 普通随机闲聊：started 或 completed 二选一，优先 started 防止连续重复；
- 好感台阶/尾巴：completed 才消费，以免中途打断后被误视为已消费；
- 只有未来明确需要“看过即算”的内容才引入 delivered。

### E. 四类条件分层：赞同，但应修正 block 的分类

Sol 反对合并 reveal、trigger、ready、block，这一点完全正确。

但“block = Concurrency”不够准确。当前 block 更像：

~~~~text
Post-completion availability gate
完成后的可用性阻断
~~~~

建议最终分成六类：

| 类别 | 当前/建议语义 |
| --- | --- |
| Reveal | 玩家是否知道它存在 |
| Eligibility | 当前是否允许启动 |
| Scheduling | 进入随机候选还是 ready queue |
| Cooldown | 时间上的暂时不可用 |
| Concurrency | owner 游标、active 冲突、可打断性、离区限制 |
| Block | 完成后锁定某空间，直到条件解除 |

需要保留：

~~~~text
Reveal false 不等于 Eligibility false
Ready 不等于仅仅“条件满足”
~~~~

当前 ready queue 是实时派生候选，不是持久化意图。不要仅因为 Sol 使用了 DeliveryIntent，就自动把所有 readyStepIds 改成持久化队列。

### F. started / delivered / completed：问题真实存在，但不应盲目三态持久化

Sol 指出被打断的 non-repeatable 会重新回到 ready queue，这个观察正确。

当前系统已经隐含有：

- started：cursor 非空；
- completed：storyLog 有记录；
- delivered：UI ChatStream 实际显示内容，但没有引擎状态。

因此最小修复可以先定义清楚：

1. cursor 非空代表当前 StoryRun；
2. storyLog 只代表正常 completed；
3. ready item 是否在 started 时 claim，需要单独决定；
4. interrupted run 是否保留、清除或可恢复，需要单独决定。

不建议现在立即引入完整 DeliveryIntent + StoryRunId + delivered 存档状态，因为会带来 UI 未显示时如何判定 delivered、浏览器关闭时 started 还是 aborted、保存时 cursor 与 delivery state 一致性、ready queue 与 storyLog 双轨、旧 intent 取消等问题。

更稳妥的路线是：

~~~~text
P0：明确 interrupted 的语义，并统一 claim 点
P1：为非重复条目增加轻量 consumed/claimed 记录
P2：真的需要跨事件、跨 UI、跨存档追踪时，再引入 DeliveryIntent
~~~~

first/repeat reward 按 completedCount 判断，这一条应采纳。奖励绝不能按 started 或 delivered 判断。

### G. 最终模型：采纳边界，不采纳完整落地方案

Sol 的最终模型适合作为长期目标，但不适合作为当前一次性重构目标。

建议当前模型保持：

~~~~text
StoryDef
  = 演出内容

StoryEntry
  = 对外入口与业务投放规则

PassivePool
  = 随机竞争结构

StoryCursor / StoryRun
  = 当前播放位置

completionKey
  = 可选的玩家进度身份
~~~~

未来有明确需求时再扩展：

~~~~text
StoryChain
  = 多个 StoryDef 的稳定业务身份与进度容器
~~~~

也就是说，先采纳“概念分层”，暂不采纳“新增完整数据实体”。

### 随机权重：Sol 的问题成立，但修改会改变现有内容概率

当前扁平化权重：

~~~~text
PoolChild.weight × Entry.weight
~~~~

数学上没有错误，但作者心智确实容易误解。

Sol 推荐的分层抽取更符合“PoolChild.weight 是分支概率”的直觉；不过它不是无损修复。切换后会改变所有现有池的分布，并且需要明确子池内 Entry 是否再次按 Entry.weight 抽取、子池总权重如何影响父池、gate 关闭后父级概率如何重新归一、orphan Entry 如何参与、多个 root pool 是否继续并列竞争。

建议：

1. 短期保留现有算法，补充文档和调试 UI 展示 effectiveWeight；
2. 新增 Pool 的 selectionPolicy；
3. 如果改成分层抽取，使用显式版本或新 policy，不要静默改变旧包概率。

若重新设计，倾向：

~~~~text
selectionPolicy:
  flatWeighted   // 兼容现有
  hierarchical   // 新内容使用
~~~~

### Ready Queue：暂不升级为 DeliveryIntent

Sol 关于“实时扫描 vs 事件产生意图”的问题值得保留，但当前好感台阶机制使用派生队列有明显优点：

- 不需要重复入队去重；
- 好感等级只增不减，逻辑简单；
- 未读数永远与实际可播放内容一致；
- 条件变化后不需要取消旧 Intent；
- 不需要额外存档结构。

如果改成 DeliveryIntent，必须先裁定好感达标时是否立即生成、角色未拥有时是否生成、切换 Init 后 Intent 是否保留、triggerCondition 后来失效是否取消、同一尾巴重复完成是否幂等、mod reload 后旧 Entry 是否还能解析。

当前建议：

~~~~text
readyStepIds = 派生候选集合
claim = 开始播放时从派生集合中占用
completed = storyLog / completionKey
~~~~

只有未来需要“事件发生过但当前条件已不再满足仍必须送达”时，才引入 DeliveryIntent。

### 存档层级：基本赞同，应优先处理

Sol 关于跨 Init cooldown/block 污染的担忧成立。

当前 storyLog、storyReadLogs 属于 Init 快照，而 passiveCooldowns、studentBlocks 在 PlayerState 顶层。这样会导致软重启或切换已有 Init 时，它们不按 Init 独立恢复。

建议：

1. 把当前被动剧情运行状态归入一个明确的 per-Init 容器；
2. 至少包含 cooldowns、studentBlocks；
3. 如果以后有 StoryRun 持久化，再把 runs 放进去；
4. 需要跨 Init 的完成身份另设 globalStoryProgress，不要把所有 Passive 状态都做成 Global。

这项修改不依赖 StoryChain，可以独立实施。

根据项目规则，新增 per-Init 字段必须同步 PlayerState、InitSnapshot、PER_INIT_FIELD_SPECS、save/restore 测试与相关文档。

### 最终状态机：作为概念图采纳，作为存档模型暂缓

Sol 的：

~~~~text
Scheduling
→ Candidate
→ Eligibility
→ Reserve
→ Started
→ Delivered
→ Completed
~~~~

适合作为领域流程图。

当前实现中需要稍微调整顺序：

~~~~text
Scheduling candidate
→ Eligibility recheck
→ Reservation / claim
→ Story cursor started
→ first Talklet recorded/displayed
→ completed
~~~~

Eligibility 不应只发生在 Candidate 之后一次。因为 Pool 展开时的资格判断和真正启动之间可能有状态变化，所以启动前必须再次检查。

Reserve 也不应在所有随机抽取时立刻持久化；如果抽取结果只存在于当前请求中，可以在成功创建 StoryRun 后再 claim。

### 重要不变量逐条审阅

| # | 结论 | 说明 |
| --- | --- | --- |
| 1 | 赞同 | 正式启动应统一进入 eligibility + reservation 管线 |
| 2 | 部分赞同 | StoryDef 不应独自承担业务进度，但不必马上使用 StoryChain；completionKey 足够作为第一步 |
| 3 | 赞同 | 一个 DeliveryIntent 不应生成多个活跃 Run；当前可先约束 cursor 与 claim |
| 4 | 部分赞同 | non-repeatable 的消费时机必须明确，不能默认由 Chain 决定 |
| 5 | 赞同 | 完成回调必须幂等；奖励、完成记录、尾巴触发要防重 |
| 6 | 赞同 | 只修改真实命中的 Pool ancestry；当前需要让选取结果返回 ancestry |
| 7 | 赞同 | cooldown 检查与写入必须共享 canonical key |
| 8 | 赞同 | reveal 与 eligibility 必须分离 |
| 9 | 赞同 | ready queue 不应参与随机权重竞争 |
| 10 | 赞同 | 状态生命周期必须显式；默认 per-Init 更安全 |
| 11 | 赞同 | owner 是调度/游标隔离，不应改变剧情业务身份 |
| 12 | 赞同 | 恢复 StoryRun 不应重新抽取或重新 enqueue |
| 13 | 赞同 | completion、奖励 ledger、奖励效果需要同一事务边界 |
| 14 | 部分赞同 | Chain ID 稳定可以保护重构，但 completionKey 也能解决当前需求；Datapack reload 与存档兼容还需另行定义 |

## 三、综合裁定与建议切片

### P0：不引入 StoryChain，先修一致性

1. 统一正式启动入口，区分 requestStart 与 unchecked/restore；
2. 抽取资格、ready 资格、直接启动资格统一由 EligibilityEvaluator 解释；
3. 修复 pool-only cooldown；
4. 明确或暂时删除未消费的 PassivePoolChild.cooldownFrames；
5. 让随机选择结果携带 Pool ancestry；
6. 增加“为什么不可用”的结构化诊断；
7. 为 ready item 明确 started/claimed/interrupted 语义。

### P1：修正状态身份与生命周期

1. 增加可选 completionKey/progressKey；
2. 用 completionKey 记录完成、repeat、tail 依赖；
3. 把 passiveCooldowns/studentBlocks 放入明确的 per-Init 被动状态；
4. 增加完成回调幂等保护；
5. 补充跨 Init、打断、保存恢复测试。

### 已裁定：Pool 分层权重移入当前施工任务

用户裁定执行 P0、P1，并将 Pool 分层权重从原 P2 提前纳入当前任务。具体施工范围与验收标准见 [[docs/plan-work/active/task-0032-passive-story-scheduling]]。

### P2：其余调度模型暂缓

1. 是否引入 delivered；
2. 是否把 ready queue 变成 DeliveryIntent；
3. 是否需要 StoryRunId；
4. 是否存在足够多的跨 StoryDef 业务链，值得引入 StoryChain。

### 最终结论

Sol 提出的概念分层值得采纳，但完整 StoryChain 设计目前有过度风险。

当前最合适的方向是：

~~~~text
保留 StoryDef + StoryService
保留 PassiveStoryEntry + PassivePool
新增统一 Eligibility / StartRequest
新增 completionKey
修正 cooldown 与 per-Init 状态
执行 Pool hierarchical selection
暂不新增 StoryChainDef / StoryChainNode / DeliveryIntent
~~~~

等真实内容证明“一个玩家认知剧情”确实需要跨多个 StoryDef、多个 Entry 共享稳定进度时，再把 completionKey 演化为 StoryChainId，而不是现在预先建立完整 Chain 图。

## 四、当前代码落点

- StoryEntry 契约：src/data-services/contracts/story-entry.ts
- PassivePool 契约：src/data-services/contracts/passive-pool.ts
- Pool 抽取：src/arona-clicker/services/passive-pool-system.ts
- Passive/Ready 流程：src/arona-clicker/services/story-flow.ts
- 奖励、冷却、block：src/arona-clicker/services/story-rewards.ts
- 跳转与完成：src/arona-clicker/services/story-jump.ts
- 状态写入口：src/arona-clicker/state/state-mutation-service.ts
- Init 状态分层：src/arona-clicker/state/per-init-fields.ts、src/arona-clicker/types/state.ts
- 当前好感/尾巴方案：docs/plan-work/completed/affection-planning.md
