# 数值—行为系统与 EB-T 接入调查

> 本文记录 2026-09-26 的源码与机制文档调查，回答：游戏数值和行为从定义到状态、事件与视图经过哪些实体；哪些职责可能简化；现有领域内容是否适合由 EB-T Registration 唤醒。本文是可删除 Goal Set 内的研究底稿，不是当前机制事实源、架构决策或施工授权。代码事实以源码和 `docs/docs-828/` 为准。

## 1. 调查结论摘要

1. 主干不是单一“Trigger 系统”，而是一条多层链：Datapack Def → Registry/关系索引 → 领域服务与表达式求值 → `StateMutationService` 提交权威状态、统计和事件 → Trigger/Affector/索引/领域 Reactor 响应 → 快照或 UI ReadModel。
2. 应优先简化重复作者表达与重复扫描；不要把权威事实、缓存失效、一次性行为和持续数值流合并成同一抽象。
3. EB-T Registration 适合“有明确事件源、生命周期可重建、命中后要执行一个领域行为”的窄唤醒通路；它不覆盖全部 GameEvent，也不替领域决定监听准入、事实归属或状态写入。
4. 当前候选中，**学生阻断**最值得评估事件唤醒，因当前每 Tick 复检；仍需未覆盖条件回退。**ColorUnlock**可在证明全表扫描成本后做定向复检，但更自然的优化工具是 `ConditionDepIndex`。**StoryFollowUp** 有启动失败重试和每次区域进入最多启动一个的仲裁语义，不适合直接换成普通 once Trigger。
5. **PassivePool 与 Visibility** 已使用 ConditionDepIndex 做失效路由；**Affector** 也已用该索引并对宽依赖轮询。把它们整体迁入 EB-T 会重复索引或丢失已有回退。
6. 静态调查还发现需核查条件失效覆盖：`STAT_DEP_EVENTS` 未包含 `resourceChanged`、`tick`、`characterAcquired`；Visibility/PassivePool 对宽依赖没有 Affector 同等的 Tick 轮询回退。它可能令依赖相关统计的缓存较晚失效，是代码推导风险，未由本轮测试验证。

## 2. 系统主链与职责

```text
Datapack / 默认内容定义
  → Parser / Registry / 引用与关系索引
  → ValueSystem / ConditionSystem / GameNum 与领域服务
  → StateMutationService 提交权威状态、统计和 GameEvent
  → EventBus 队列 / Tick 阶段边界
  → TriggerSystem、AffectorEngine、ConditionDepIndex 消费者、领域 Reactor
  → Visibility/Reveal/Milestone 等派生投影与领域事实
  → GameView / UI ReadModel（只读消费）
```

这条链是职责地图，不表示所有操作都从同一个入口开始。Init 生命周期与移动由 `InitService` 负责；`TickSystem` 推进帧并组织结算阶段；交易领域可能先构造计划再一次提交，Gacha 则按抽逐次提交。事实与投影要按真实生命周期分别处理。

关键机制路由：[[docs/docs-828/01-architecture/run-logic]]、[[docs/docs-828/01-architecture/state-layers]]、[[docs/docs-828/04-mechanisms/state-mutation]]、[[docs/docs-828/04-mechanisms/production]]、[[docs/docs-828/04-mechanisms/trigger-effect]]。

## 3. 过程实体与数据所有权

| 过程/层 | 主要实体 | 权威事实或运行时数据 | 主要交接 |
|---|---|---|---|
| 内容定义与装配 | Datapack、Resource、Spot、AffectorPack、TriggerDef、StoryEntry、Color/Equipment Def 等 | Def 是内容输入；Registry 是加载后的查找表和关系索引 | Registry 为领域服务、表达式和引擎执行提供当前定义 |
| 状态与统计 | PlayerState、InitSnapshot、StatsSnapshot、ProtoStats、CharacterMemory | 玩家拥有、等级、资源、完成事实等由 PlayerState/对应账本持有；统计快照记录 DSL 可查询的累计值；字段 scope 各自不同 | 状态领域经写入口更新数据，再发布事件；Init 进出还涉及快照捕获/恢复 |
| 条件与数值表达 | Condition/ConditionGroup、Value、Funclet、ConditionSystem、ValueSystem | 条件表达式不是事实；求值基于当前状态/统计/Registry | Condition 给出准入或重验；Value/GameNum 计算数额或派生结果 |
| 生产 | Resource、Spot、Affector flow、linearYield、ZoneModifier、GameNum 节点 | 资源余额是权威状态；GameNum 层级树、Spot/Zone 计算和 Affector 实例是可重建运行时投影 | Tick 先结算生产；状态入账后发资源等事件，相关缓存按依赖失效 |
| 行为联动 | GameEvent/EventBus、TriggerDef、Trigger Registration、Effect、EffectEngine | `triggersCompleted` 是 once 事实；Registration、group、token、事件桶是运行投影 | Event → 桶筛选 → 事件匹配 → Condition 重验 → 一次性提交或 Effect 路由 |
| 持续效果 | AffectorPack、Affector instance、entry condition、四效果通道 | 实例由定义/状态挂载关系重建，不是存档事实；active entry 集为运行状态 | activation edge、perTickEffects、continual flows、zoneModifiers/area connections 分别参与行为或数值计算 |
| 领域交易/养成 | Spot 升级交易、ShopSession/Offer、Gacha pool/mode、Variant/progression | Shop 购物车是临时意图；支付、限购、抽卡结果、角色培养是各自领域状态 | Spot/Shop 可先准备计划再原子提交；Gacha 逐抽处理，可能保留已成功的部分抽取 |
| 剧情与被动行为 | StoryDef、StoryEntry、Talklet、Story log/read/cursor/cooldown/student block、PassivePool | 完成、阅读、游标、冷却与阻断字段表达不同事实，不能仅因都与剧情相关便合并 | 完成事件驱动反应挂载、follow-up、聊天流等；被动池择取受 Owner、冷却、block、gate 约束 |
| 解锁/发现 | ColorGroup/Design/Equipment unlock Conditions、Reveal/Milestone Def 与领域进度 | 已解锁、已揭示、已完成是领域事实；Wake/Registration、Visibility 快照是重建投影 | 事件只唤醒候选项；领域完整重验并通过 StateMutationService 提交事实 |
| 可见性与 UI | VisibilityEngine/Index、GameView、UI controller/read model | 可见性快照和 UI 模型可重算，不是业务真相 | 事件使目标变 dirty，读时重新求值；UI 只读 `getView()`/只读上下文 |

### 3.1 状态的不同生命周期

- Global、per-Init 快照、per-Init 当前状态需要分清；Init 切换会保存、恢复或初始化相应字段。
- StatsSnapshot、ProtoStats、CharacterMemory 都可能记录累计数据，但统计口径与生命周期不同，不应按字段相似直接合并。
- Trigger once、RevealProgress、MilestoneProgress 是持久事实；Trigger/Reveal/Milestone registrations 是基于事实与当前 Def 推导的运行时投影。
- 购物车、故事游标、冷却、故事完成日志和阅读日志服务不同流程；“临时”不代表都可以共用同一状态表。

## 4. 数值、行为和状态更新流程

### 4.1 生产与数值

1. Spot 与其他来源声明基础 flow/linear yield、等级或启用条件；AffectorPack 声明可挂载的持续流和 modifiers。
2. AffectorEngine 将 Spot 的 flow / linearYield 投影到 Affector flows；实例根据当前 PlayerState、Def 和挂载身份重建。
3. GameNum 按资源、Spot/Zone 与各层 modifier 组织计算依赖和缓存失效。它不仅是表达式求值器，也维护生产树、资源依赖和脏位传播。
4. Tick 先完成生产入账，再由 Affector 的状态边沿效果与剧情/阻断等阶段继续处理；最终状态写入发出事件，统计同步。

**简化方向：**评估把 Spot 作者侧 `flow` / `linearYield` 与 Affector `flows` 收敛到共同的作者 DSL，因为两者已投影至同一运行时路径。必须保留 Spot 主产出乘数链、等级表达式、启用门槛和特定收益目标语义。不要因此把持续 flow 与一次性 `addResource` Effect 合并；二者的时间语义不同。

### 4.2 Trigger 与 Effect

标准 Trigger 以数据定义事件种类、条件和 Effect；普通 once 会在 Effect 执行前提交完成 ID。EffectEngine 再将状态效果交由 StateMutationService，或转成表现/故事请求事件交给对应消费者。

EB-T Registration 是 TriggerSystem 的运行时注册身份层：key/token/group/tag、事件种类分桶和 withdraw/re-register 管理都属于派生运行时索引。它不持有领域历史进度。Reveal/Milestone adapter 使用空 Effect 的内部 Trigger 和 opaque action handle 做唤醒，但由各领域拥有 Watch 准入、完整条件重验和事实提交。当前 runtime action handler 需要组合领域处理函数。

### 4.3 交易、抽卡与角色成长

- Spot、Shop 会形成支付/购买计划后集中提交，以维护交易边界和一次性事件顺序。
- Gacha 逐抽扣费、计算获得、更新保底和发 `characterAcquired`；余额不足可能停止并保留此前完成的抽取。因此不能不分析逐抽语义便统一成 Spot/Shop 的整批原子事务。
- Roster、fragments、Variant progression、ProtoStats、CharacterMemory 可能彼此关联，但分别代表发现/持有、资源、进度、累计口径、跨线记忆等不同责任。优先画清消费者和字段生命周期，再考虑账本收敛。

### 4.4 剧情与行为

StoryEntry 组合入口、availability、condition、cooldown、block、reaction、follow-up 等规则；StoryDef/Talklet 负责演出内容。完成/阅读日志、游标、触发 once、冷却、学生阻断不能仅按“剧情状态”打包成一个事实。

StoryEntry reaction 会把定义转换为 TriggerDef 并交给 TriggerSystem；StoryFollowUp 当前由独立 mount 投影等待项。其成功启动目标后才 commit 派生 once ID，启动失败继续等待。它们在使用公共触发执行路径上的程度不同，应分开评估。

## 5. 简化机会与不可直接合并项

| 方向 | 当前重叠/负担 | 可评估的收敛 | 必须保留的区别/风险 |
|---|---|---|---|
| Spot flow 与 Affector flow | 作者侧存在两类生产声明，运行时都由 Affector/GameNum 执行 | 优先统一作者 DSL 或构建器入口，减少两个生产描述面 | Spot 主流倍率、等级曲线、解锁/启用条件和目标链可能是产品语义，不可扁平丢失 |
| Trigger / Effect / StateMutationService | 分别是唤醒调度、效果解释、权威提交 | 保持公共职责；可按内部领域拆分大型写服务实现 | 不能让 Trigger 直接写状态或 Effect 绕开统一统计/事件顺序；统一外部提交边界有价值 |
| Condition 与 Value | 都读资源/等级等当前状态 | 可共享底层读取/表达式工具 | Condition 有布尔逻辑、依赖目标和唤醒分析；Value 有数值返回/错误策略，不能合成无类型 DSL |
| 持续 flow 与一次 Effect | 都可能增减资源 | 保留不同频道，明确持续结算与一次性事件的作者体验 | 持续产出要进入 GameNum/Zone/倍率和 tick 门控；Effect 在某次行为触发时提交 |
| StatsSnapshot / ProtoStats / CharacterMemory | 均为累计或历史数据 | 先绘制口径、消费者和时间/Init scope 表，再寻找可派生或重复字段 | 重复获得、首次拥有、最高进度、跨线历史和通用 DSL 统计口径不同 |
| StateMutationService | 多域状态动作集中，内部职责较多 | 可按领域拆内部 helper/模块，保留统一 mutation façade 与事件排序 | 交易原子性、统计同步、跨域副作用和重入顺序必须保持 |
| Shop/Spot/Gacha 事务 | 都有付款和结果提交 | 共享可复用的支付计算/结果描述工具 | Gacha 逐抽和部分完成语义不同于 Shop/Spot 整体计划提交 |
| 休眠状态/未接线入口 | 先前检查记录了需要复核的 `chatRead` 写入方与 `refreshWorldPool` 调用路径 | 若当前消费者确认无依赖，可删；保留则补清晰接线和目的 | 本条需重新查源码/测试后才能形成删除决策，当前只是复核入口 |

## 6. EB-T 当前机制与接入判据

### 6.1 适合 EB-T 的典型形状

候选适配应同时满足：

1. 某个领域规则在 admission 时仍未完成/未满足，并且存在确定的真实 GameEvent 唤醒源。
2. 监听可从当前 Def、权威状态、scope 和生命周期重建；运行 Registration 不成为事实来源。
3. 事件只表示“值得重新检查”，命中后使用当前完整 Condition/ConditionGroup 重验。
4. 行为由领域服务提交，沿用 StateMutationService；事件失败或条件未满足时，不误提交一次性完成事实。
5. 未覆盖目标有明确策略：Admission-only、明确不支持或可信回退。不能因表达式可求值就假定其可可靠实时唤醒。

### 6.2 EB-T 与 ConditionDepIndex 的差别

- TriggerSystem 以作者/运行时 Trigger event kind 为入口，当前有有限事件种类映射和 typed internal action 路径；普通 Trigger once 有固定先提交后执行语义。
- ConditionDepIndex 以条件叶子为依赖声明，覆盖资源、flag、extra 路径、Tag、Manager、强化、故事等更多变化；能按 entity key / tag / path 前缀定向失效。
- ConditionDepIndex 常用于“事件将派生数据标脏，稍后查询再重算”；EB-T 常用于“事件唤醒一项已准入行为，领域执行后可能写入持久事实”。两者有交集但不是替代关系。
- 若要复用共通能力，建议先考虑领域无关的内部 wake-source 合同，并维持现有精确依赖匹配；不要把它伪装成扩大后的作者可见 Trigger DSL，除非确有作者需求。

## 7. 领域消费者接入评估

| 消费者 | 当前实体/流程 | EB-T 适配收益 | 语义与覆盖风险 | 建议 |
|---|---|---|---|---|
| 学生阻断 `studentBlocks` | Runtime 每 Tick 对活跃阻断 Variant 重新读取 PassiveStory 的 block 条件；成功移动 Area 后也立即复检；满足后通过 `clearStudentBlock` 清除 | 可把每帧全量遍历改为受影响 Variant 唤醒，减少每帧工作 | 所有 block 条件需有可靠 source；unsupported/stat 仍要回退。entry 删除/block 定义撤掉需 reconcile。装载、Init/内容变化、设 block 时需 admission recheck。唤醒只复验完整当前 block，清除继续经 StateMutationService | **最高的机制评估候选；窄范围试点。**由于 ConditionDepIndex 现成，也可由它直接路由到 block owner，未必需要 EB-T Registration |
| ColorUnlock（组/设计/装备） | `ColorUnlockReactor` 在 `characterAcquired`/`flagChanged` 后调用多个全表 recheck；领域服务各自验证并提交拥有事实；设计解锁还有槽位副作用 | 若 Def 数增长，全表检查可能值得改为只检查受影响规则 | Trigger 缺 `flagChanged` 与多个 Condition 依赖事件；颜色/装备/设计落入不同领域事实和副作用；每规则 Registration 需生命周期 reconcile | **条件候选；先测实际重检成本和完整依赖覆盖。**更倾向领域侧 ConditionDepIndex 索引，而非 EB-T 伪装成普通 Trigger |
| StoryFollowUp | 监听 `storyCompleted` reconcile 等待 Map；`areaEntered` 匹配 wait area；目标 StoryEntry 启动成功后 commit 派生完成 ID | 每个等待项可表示为按区域唤醒的 runtime Registration | 普通 once 在效果前提交，不保留启动失败重试。还需保证一次 areaEntered 最多成功启动一个 follow-up。EB-T 类型桶内仍需 areaId match；转换会加专用 action 与仲裁 | **不优先迁移。**现有小型领域监听语义直接清楚；如将来需要规模化再评估 typed action |
| StoryEntryReaction | 完成事件触发 mount；当前 Init 中已完成入口的 reaction 转成普通 TriggerDef 并归组挂载 | 少量直接回调可统一到一套生命周期入口 | 核心 Condition/Effect/once 已由 TriggerSystem 执行；还须保留“完成后才挂载”和 Init 卸载/重建 | **已基本接入 EB-T；保留投影胶水。**进一步抽象收益低 |
| PassivePool gate | 每个 passive pool 的 Condition 登记 ConditionDepIndex；事件只标 dirty，`isAvailable` 查询时完整重算；真值改变发 `poolGateChanged` | 可把 dirty 通知发给另一套内部 action 总线 | gate 是可逆、持续缓存状态而非完成即撤出的 Watch；EB-T 会重复索引并增加注册/action；目前已有精确失效方式 | **不迁移。**保留 ConditionDepIndex 与查询时惰性求值 |
| Visibility existence | Registry 的实体 existence 条件登记 VisibilityIndex/ConditionDepIndex；事件只标脏，取快照或直接查时重算 | 统一唤醒设施的外观收益 | 需要保留延迟计算、Spot Definition change 特例和 rebuild；EB-T 会重建依赖路由，不能自然保留按实体/条件叶索引优势 | **不迁移。**先检查宽依赖事件覆盖风险 |
| Affector activation | 每实例/entry 以 ConditionDepIndex 订阅事件，命中时完整 recheck；wide 条件实例放入每 Tick polling；Latent→Active 才执行一次性 effects | 可统一注册撤出和 stale dispatch token 的实现方式 | 要覆盖 activation/deactivation、entry 集变更、GameNum 收敛；需要更多事件种类；EB-T 当前不比 DepIndex 精确，stat 仍需 polling | **保留当前混合路由。**性能/统一收益不足以支持整体迁移 |
| GameNum 数值依赖 | 按资源、Spot、Zone、Tag/Extra 等构建依赖树和脏位传播 | 无明显接入收益 | registration 不能替代向上游树节点传播、生产汇总与缓存失效 | **保持独立数值基础设施。** |

依据源码：`src/engine/effect/trigger-system.ts`、`src/engine/expression/condition-deps.ts`、`src/engine/effect/affector-engine.ts`、`src/engine/visibility/visibility-index.ts`、`src/engine/visibility/visibility-engine.ts`、`src/arona-clicker/services/story-follow-up-mount.ts`、`src/arona-clicker/services/story-entry-reaction-mount.ts`、`src/arona-clicker/services/passive-pool-system.ts`、`src/arona-clicker/services/color-unlock-reactor.ts`、`src/arona-clicker/runtime-reset.ts`、`src/arona-clicker/runtime-game-instance.ts`。

## 8. 条件失效覆盖风险：需单独核实

`ConditionDepIndex` 将 stat/未知 target 归入 `statDeps`，由消费者决定宽依赖处理。但当前 `STAT_DEP_EVENTS` 静态集合未含 `resourceChanged`、`tick`、`characterAcquired`。代码链上，资源改变会更新累计统计并发 `resourceChanged`，每 Tick 会写入 frame 统计，获得角色会改变 ProtoStat。Affector 对宽条件使用 pollingInstances；已检查的 Visibility 与 PassivePool 则未看到同等每 Tick fallback。

由此可能出现：依赖累计资源、帧数或角色获得统计的 visibility/passive-pool gate 初始化计算后，没有相关事件使缓存失效。**这是一项代码路径推导风险，不是已由测试确认的线上缺陷**，须按实际 Condition target、每个写入口与消费者生命周期做闭合审计。修复方向可能是补齐真实失效事件/订阅或在相应读取入口重验；不能假定扩 EB-T 就自动修好。

后续核对矩阵至少要覆盖：ConditionTarget/读状态来源 → 每个写入 producer → 写后发出的事件及 payload → DepIndex/EB-T 精度 → activation 与 invalidation 两个方向 → admission/rebuild → unsupported fallback。

## 9. 建议推进顺序

1. **先闭合当前事件事实**：对 stat、protoStat、资源、Tick、角色获得及 Tag/Extra 目标做静态写入者与事件表核对；把 Visibility/PassivePool 可能 stale 的风险证实、证伪或限定范围。
2. **学生阻断做最小概念设计**：确定 ConditionDepIndex 直接路由是否已足够；列出支持条件能力；保持每 Tick fallback 作为 unsupported/wide 路径，除非统计事件完整闭合并有证据移除回退。
3. **ColorUnlock 以数据规模/成本做门槛**：如果扫描成本无实测问题，不改；如需优化，优先用条件依赖索引定向发现相关 Def，由三个现有领域仍各自提交状态。
4. **StoryFollowUp、PassivePool、Visibility、Affector 暂留原机制**：先不为“统一”而增加 EB-T action 与重复索引。
5. **仅当多个新领域都需要相同的 Registration adapter 后，再评估内部 `ConditionWakeSource` 抽象**。需保持 domain owns progress、desired watch、scope、完整重验、StateMutationService commit；EB-T owns registration/token/event routing。抽象不能吞掉领域事实或隐式扩大作者 DSL。

## 10. 源码与机制入口

- 系统/状态：[当前上下文卡片](../../docs-828/01-architecture/current-context-card.md)、[运行逻辑](../../docs-828/01-architecture/run-logic.md)、[状态分层](../../docs-828/01-architecture/state-layers.md)、[PlayerState](../../docs-828/03-data-structures/player-state.md)
- 数值/生产：[生产机制](../../docs-828/04-mechanisms/production.md)、[Affector 模块卡片](../../docs-828/02-modules/affector.md)、`src/engine/expression/condition-deps.ts`、`src/engine/effect/affector-engine.ts`
- 触发/状态写入：[事件联动机制](../../docs-828/04-mechanisms/trigger-effect.md)、[状态写入机制](../../docs-828/04-mechanisms/state-mutation.md)、`src/engine/effect/trigger-system.ts`
- 领域消费者：`src/arona-clicker/services/story-follow-up-mount.ts`、`story-entry-reaction-mount.ts`、`passive-pool-system.ts`、`color-unlock-reactor.ts`、`src/arona-clicker/runtime-reset.ts`、`src/engine/visibility/visibility-index.ts`、`visibility-engine.ts`

## 11. 调查边界与状态

- 调查性质：源码与现有机制文档静态阅读，按数值/行为实体和 EB-T 候选领域分工协作核对。
- 未修改代码、Datapack、Schema 或当前机制事实文档；未运行测试；本报告不构成变更授权。
- 推荐只是后续 Goal 的输入，不等于产品裁定。进入正式讨论时，先新建 Draft，核实当前源码和测试，区分建议、决定和证据；不要在这个可删除目录外引用具体 Goal 文件。
