# Draft 0212 — 玩法 B：老师指挥学生处理现场事件

状态：draft — 已形成玩法身份、v1 需求、AC 语义映射与可独立验收的施工顺序；未开始代码施工

## 目标与边界

本文定义一款以学生自主行动和老师有限指挥为核心的现场事件策略游戏，并把该玩法翻译为 AC 内可逐步建设的 Runtime、状态、内容和 UI 能力。本文是产品与架构提案，不是当前 AC 运行时事实。

本轮交付只包含玩法内容蒸馏、AC 语义映射与 Task 文档。代码、测试实现和引擎机制文档均不在本轮施工范围。下列施工 Task 全部为 `proposed`，用于之后逐项启动。

## 裁定来源与状态

| 内容 | 状态 | 本 Draft 的处理 |
| --- | --- | --- |
| 无实时反应要求；一次有效的战术 Commit 对应一整批场景行动或完整战斗轮次 | 用户已确认的操作边界 | 保留为节拍制；UI 上的 Commit 代表完整 Beat，而不是单个 Actor 行动。 |
| 玩家先审阅学生计划，再决定是否调整并一次提交 | 已观察到有价值的玩法模式 | 保留“自主准备—有限修订—统一结算”；可编辑数量与限制在本 Draft 中重新裁定。 |
| 学生行动理由、对手 Intent、结算记录需要可解释 | 本次产品要求 | 列为 v1 信息与验收要求，不代表已有完整规则实现。 |
| 每个 Beat 只有一个 Sensei 指挥位，且只能修改一名学生的计划 | **新提案**，不是既有确认规则 | 用于凸显学生自主性并限制逐个操控；Task 0216/0222 必须验证干预存在真实取舍。 |
| 路线选择是单独事件命令，不产生战术 Beat/Resolution | **新裁定** | 解决战术提交单位与地点转场输入的口径歧义；只有一个出口时自动转场，多出口时才等待玩家选择。 |
| 首期路线条件叶节点只检查持有物，可用 `all/any/not` 组合；地图有向且允许环，但每地点访问有界 | 用户已在早期玩法 B Draft 确认（[[draft-0204-gameplay-b-map-and-player-actions]]；这是设计来源，不是 AC 实现事实） | RouteEdge 只读取 EventRun 的局内持有物；访问上限独立于出口条件。事件目标仍可读取 EventState 的轨道/事实。 |
| 随机只在 Commit 后消费 | **新裁定** | 让预览、改选和撤销不会重抽结果；按运行 Seed/Cursor 保持可复现。 |
| 非战斗场景行为可逐角色分别选择，或由玩家选择一个全局行为；玩家拥有共用路线 Cost、有限场景卡组，场景可增加 Cost 并设离场携带上限 | 用户已在早期玩法 B Draft 确认（[[draft-0204-gameplay-b-map-and-player-actions]]；这是设计来源，不是 AC 实现事实） | 纳入 AC-native 设计，细则见“场景行为、路线 Cost 与角色技能兼容”；由新增 Task 0224/0225 落地。场景选择与战斗 Intervention 分开，但共用 EventRun、费用校验和 Resolution。 |
| 保留角色专属随机技能触发；角色技能不消耗玩家路线 Cost | 用户已在早期玩法 B Draft 确认（[[draft-0204-gameplay-b-map-and-player-actions]]；旧原型的现有实现不视为 AC 实现） | 指角色行动之外按条件进行的额外技能触发检查，不是玩家场景卡抽牌。Profile 专属现场能力与之并行；为符合本 Draft 新裁定的 Commit-only RNG，AC-native 把触发检查推迟到有效 Commit 结算。 |
| EventState 使用少量数值轨道和事实集合，事件以成功/部分成功/失败结束 | **新概念/新需求** | 以小型封闭 Predicate 和 Effect 支持事件因果，不假定既有通用状态模型可直接承担。 |
| 精确 Save/Resume 是完整 V1 发布切片门槛 | **范围选择** | 核心可玩切片 0216 不要求存档；多地点正式 V1 切片 0222 要求恢复当前地点、行动计划与随机游标。 |
| 具体人数、行动数值、资源名称、角色专属技能内容与配方输出 | 内容/平衡数据 | 具体数值与内容由事件定义和体验验收决定；不改变上列已经确认的场景模式、路线 Cost/卡组和角色随机技能边界。 |

## 一、玩法定义

### 一句话身份

**玩法 B 是老师协调拥有自主行动倾向的学生小队、处理持续变化的现场事件。** 每个决策节拍中，学生与对手先形成可解释的行动计划；老师判断哪些计划值得干预，再一次提交全场行动，让战斗和场景共同改变事件局势。

### 玩家职责

玩家扮演 Sensei，是队伍的**判断者与有限指挥者**。玩家选择学生阵容、决定事件的处置顺序，并且每个战术节拍最多修订一个学生行动。玩家不逐个替所有学生指定动作；未经干预的计划由学生自己的能力和行动倾向决定。

战斗 Beat 给玩家一个有限指挥位：可把一名学生的计划改为其当前可执行的另一项行动并确认合法目标，或只修订目标；不能执行的改动要给出具体原因。非战斗地点的 `SceneAction` 按地点模式由玩家选择：`individual` 为每名符合条件的角色各选一个行为，`global` 只选一个全局行为。场景选择不占用战斗指挥位；其批次仍通过统一 Commit 和 Resolution 处理。指挥位在下一次战斗 Beat 准备时恢复；角色专长和事件规则可以改变某些行动的可选项，但 v1 不引入永久的指挥点经济。

### 学生为何重要

学生身份必须改变现场行为。每名学生至少通过行动倾向、可用专长或对特定问题的处理方式之一，产生可观察的行动差异；角色档案、学院或社团标签可用于解释适配场景与协同行动。差异不能只体现在攻击、防御等倍率上。

v1 采用可读、可预测的行动优先级与明确的角色能力，不模拟无限制人格或学习型 AI。至少一个协同行动规则要让两名学生的能力组合改变行动结果。好感、复杂关系成长、养成路线与长线解锁保留为以后扩展，首版不以它们承担核心身份。

### Core Loop

```text
进入一个现场问题
  → 查看事件目标、压力和可见信息
  → 按 Location 类型准备：战斗形成学生计划和对手/环境 Intent；非战斗场景按 Individual/Global 收集 SceneAction，可带环境 Intent
  → 查看计划的目标、费用、协同与预计结果
  → 按 Location 类型输入：战斗可修订至多一个学生计划；非战斗场景提交完整 SceneActionSelection 批次
  → Commit 一次，冻结本节拍并统一结算
  → 查看状态变化与原因
  → 若现场问题未结束，开始下一节拍
  → 若地点结束，选择接下来要处理的问题
  → 依据事件状态得到成功、部分成功或失败结果
```

路线选择是独立的事件决策，不提交战术行动、不推进一轮，也不计作一次战术 Click。UI 可用一个主按钮完成 `Commit`，但玩法规则以“决策节拍”定义，不绑定鼠标、帧率或输入设备。

### 三个尺度

| 尺度 | 玩家处理的问题 | 跨尺度传递的状态 |
| --- | --- | --- |
| **Beat / 决策节拍** | 战斗中查看学生计划、对手/环境 Intent 并决定唯一指挥位；非战斗地点按 Individual/Global 模式选择 SceneAction；之后统一 Commit | 学生 HP、位置或受控状态、行动资源、现场危险/安全等事件变量、事实线索、随机流位置 |
| **Location / 现场问题** | 若干节拍共同处理一个局部目标；可为战斗、救援、调查、设施处置或混合问题 | 尚存人员与局部资源、问题的完成度、进入/离开造成的事件变量变化、可解锁事实 |
| **Event / 事件** | 选择问题的处理顺序；判断何时推进、回访或承担未处理问题的后果 | 事件变量与事实、地点访问情况、队伍状态、最终结果及可提交给 AC 的长期结果 |

一个 Location 由多个 Beat 组成；v1 不另建可嵌套的 Encounter 编辑对象。Location 完成条件清楚且需要复用时，再考虑拆出独立 Encounter 定义。

### 战斗与场景共用规则

战斗与非战斗地点共用 Beat 的冻结输入、费用校验、Commit、Resolution 和 EventState 更新，但选择入口不同：战斗使用 `Actor → Prepared Action / Intent → Target → Intervention → Commit → Resolution`；非战斗场景使用 `SceneActionSelection → Scene Intent/Target → Commit → Resolution`。具体动作效果由少量明确的效果种类表达。

战斗专属内容包括伤害、恢复、护盾、击倒与敌方攻击目标等效果和失败条件。现场专属内容包括处理事件轨道、发现或消费事实、设施/人员状态改变等效果。非战斗地点仍会有参与者、对立行动或环境 Intent、目标与结算；它不会变成另一套即时点击规则。

非战斗地点可声明 `individual` 或 `global` 行为模式。`individual` 要求玩家为每名符合条件的角色各选一个场景行为；同一批可选不同类型。`global` 要求玩家只选一个场景行为，并按动作规则指定单人、多人或全队目标。它们形成独立的 `SceneAction` 选择批次，不受战斗 Beat 的“至多修订一名学生”限制；同批行为与场景卡仍只做一次费用校验、一次 Commit 和一个 Resolution。战斗地点保持原有自治规则：学生按 Profile 自动准备战斗行动，Sensei 每 Beat 至多修订一名学生，不存在全局战斗行为槽。

### 场景行为、路线 Cost 与角色技能兼容

- `PlayerCost` 是 EventRun 内跨地点共享的路线资源，与任何学生 Actor/Team 战术行动资源分开；它不是 PlayerState 长期资源。玩家选择的非战斗 `SceneAction` 与玩家场景卡共用 PlayerCost，一批选择在 Commit 前合计校验并一次支付。学生、敌方或环境的 Prepared Action/Intent 成本若由内容声明，按独立的 EventRun 战术资源解释；不得默认为扣除 PlayerCost。
- 每个 Location 可配置 `costGain` 与 `maxCarryCost`。每次进入（包括有界回访）尝试增加 `costGain`；玩家可在该地点使用增加后的余额。离开该地点时才按该 Location 的 `maxCarryCost` 压低可携带余额，场景内暂时持有量不受该离场上限限制。
- 每个 Event 可配置一副固定、有限的玩家场景卡组；v1 不提供构筑或购买。卡牌顺序由 EventRun Seed 确定并保存在 Run，开局抽牌；每次进入地点按配置补牌且不超过手牌上限。抽牌不推进角色技能/行动效果的 Commit 随机游标。打出的卡进入已用区，不洗回抽牌堆；牌堆耗尽后不再补牌。卡牌费用与同一 Beat 场景行为费用一起校验、支付。
- 玩家场景卡只在非战斗场景行动中使用，不进入战斗 Click，不作为学生战斗行动或 CardTag 协同输入。它们消费共享 PlayerCost；角色技能不消费 PlayerCost。
- 新 StudentOperationProfile 的专属现场能力负责提供可预测、能改变可行解法的角色差异；早期确认的角色随机抽取技能作为独立能力与之并行保留，不替代 Profile 专属能力。符合内容条件时，角色技能的触发/效果随机仅在 Commit 执行阶段从 EventRun Seeded Stream 消耗；准备、预览、目标编辑和 Intervention 不掷技能结果，也不推进随机游标。具体触发条件与效果仍由角色/事件内容定义。

v1 不引入格子移动、实时反应窗口、任意脚本语言或复杂异常状态。行动效果在本地事件 Runtime 内产生状态变更；完成事件后，明确允许长期保存的结果才交给 AC 状态写入边界。

### 事件状态与结果

事件运行状态是少量**有限数值轨道**和**已知事实集合**，由具体事件声明。例如现场危险、人员安全、调查进度、设施稳定度都只是事件内容选择的命名轨道，不是所有事件强制拥有的全局字段。

每条数值轨道声明初值及上下限；事实用于表示已确认的信息或事件标记。地点目标与事件终局 Predicate 可读取 EventState 轨道/事实并使用有限比较、存在性和组合规则。路线出口 Gate 单独受早期裁定约束：条件叶节点只检查 EventRun 局内持有物，允许 `all/any/not` 组合；不读取轨道、事实、计时器或 PlayerState 条件，也不读取/修改 AC `PlayerState.inventory`。

Location 可完成、失败或以部分成果结束；地点的部分结果只结算局部问题并更新 EventState，可以继续前往其他 Location。EventOutcome 只在事件终止边界评估；硬失败门槛可在任何 Beat 触发并立即终止，其他 EventOutcome 等待事件完成、达到路线/Beat 上限或无合法出口时再判断。是否全队失能即失败由事件规则决定，HP 不是全局胜利目标。

Event 终止边界的结果优先级固定为：**硬失败 → 全部主目标满足时的成功 → 明确声明且有已取得成果的部分成功 → 失败。** 硬失败与主目标在同一次结算成立时以失败为准。只要尚有合法地点路线且没有硬失败，Event 保持进行中，即使某些部分成果已达成。

### 地图与路线

Location 表示一个仍会变化、能处理或放弃的现场问题。地图用于安排队伍先后处理哪些问题：一处的行动结果可以降低另一处压力、揭示事实、解锁新处理手段或改变最终判断；跳过的地点也可以留下代价。轨道与事实可影响地点目标、可用行动和事件结果；RouteEdge 的门槛仍只读取 EventRun 局内持有物。

v1 用作者明确配置的有向图，不自动生成地图；图允许环路。RouteEdge 的条件叶节点只检查 EventRun 局内持有物，支持 `all/any/not` 组合；不得把数值轨道、事实、计时或任意 EventPredicate 用作路线 Gate。每个 Location 配置有限访问上限，Runtime 单独据此限制回访；路线持有物也只存在 EventRun 内，不读写 AC `PlayerState.inventory`。地点终止时，0 条合法出口会触发 Event 终止结果，1 条合法出口自动转场，2 条以上合法出口等待玩家单独选择；转场均不推进战术 Beat。多出口应形成可解释、互不支配的取舍：每条路线都有已知收益与遗留代价，至少一种代价会在后续状态中兑现。地图节点不以奖励选择器为唯一作用。

## 二、Gameplay Requirement

| 领域 | v1 必须存在 | 未来可扩展 |
| --- | --- | --- |
| 游戏定位 | Sensei 带领自主学生队伍处理多阶段现场事件；节奏为可暂停、非实时的节拍制 | 叙事类型、合作/挑战模式与不同事件主题 |
| 玩家职责 | 选择阵容与路线；每个 Beat 至多一次指挥修订；可解释地 Commit | 通过任务、学生成长或事件规则改变少数指挥机会 |
| 学生自主性 | 每位学生使用确定的能力/倾向优先级准备一项行动；计划展示原因；至少一项学生专属现场能力改变可行解法；行动位无法使用时有可读回退 | 更复杂的性格反应、社团联动、长期训练与关系触发 |
| 信息可见性 | Commit 前显示主要目标、事件轨道、学生计划及目标、敌方/环境 Intent、资源/费用、协同预览、指挥机会和不可改原因 | 隐藏信息、情报来源、预测区间和多阶段预告 |
| Command / Intervention | 战斗 Beat 一个指挥位；至多改一名学生的合法行动和/或目标；未干预行动维持原计划 | 有场景特定的协助、延迟或跨学生指令 |
| Action / Intent / Target | 动作声明标签、费用、适用参与者、合法目标与效果；Actor 的 Prepared Action 和敌对/环境 Intent 都冻结在 Commit 快照 | 位置、连锁动作、事件脚本编排 |
| Resource | 同时保留 EventRun 内有限 Actor/Team 战术资源与共享路线 `PlayerCost`；场景行为、玩家场景卡共用后者；每个 Location 配 `costGain` 与离场 `maxCarryCost`；费用在 Commit 前合计校验、提交时只扣一次 | 更多资源种类、资源转化和奖励商店 |
| Scene behavior mode | 每个非战斗 Location 声明 `individual` 或 `global`；前者由玩家为每名符合条件角色各选一个行为，后者由玩家只选一个可指定目标范围的全局行为；都不占用战斗 Intervention 位 | 多层场景投票、串行小队指令 |
| Player scene deck | 固定有限牌组、Seed 排序、开局/地点入场抽牌、手牌上限、已用区且不洗回；与场景行为共用 PlayerCost；卡牌不参与战斗 Click | 构筑、购买、弃牌选择和洗回 |
| Character skills | 保留角色随机抽取技能；与 Profile 专属现场能力并行；随机只在 Commit 消耗 Seed，技能不扣 PlayerCost | 更复杂的触发树与跨事件角色成长 |
| Tag / Combination | 标签为动作的轻量属性；v1 支持少量按标签与目标匹配的协同行动，输入动作只能被消费一次 | 内容包定义的多步骤配方、环境/社团组合 |
| Resolution | 对冻结计划按确定顺序执行；相同 Seed 和输入重现相同结果；输出可解释的结果日志和状态差异 | 预览概率曲线、战斗回放、可中断动画 |
| Encounter / Location | 一个 Location 由一组决策节拍处理；战斗与场景共用结算管线，专属效果有限且明确 | 多阶段 Location、组合式 Encounter 复用 |
| Event State / Objective | 每个事件可声明数值轨道、事实、目标、失败条件及成功/部分成功/失败结果 | 关系网络、计时器、全局天气、跨事件共享内容状态 |
| Route | 支持允许环路的有向地点图；出口叶节点只读取 EventRun 局内持有物并支持 `all/any/not`；每地点有界访问上限独立限制回访；路线选择与取舍不读写 PlayerState.inventory | 事实/轨道/计时或任意 Predicate 路线门槛、随机路线图、地图编辑器、动态路线生成 |
| Character participation | 运行时通过现有 Character 身份选择学生；现场 HP/资源/行动与长期进度隔离 | Variant 专属操作构型、长期阵容成长、学生关系影响 |
| RNG | 角色技能与行动效果的随机仅在 Commit 结算；预备/编辑不抽取新结果；场景卡牌序由 EventRun Seed 确定并随牌堆保存，不推进 Commit 结算随机游标 | 可视化概率、重播、内容版本兼容回放 |
| Save / Resume | V1 发布切片必须恢复当前 EventRun、地点、局部 Actor/事件状态、准备与已修订计划、日志游标和 RNG 状态；核心可玩切片 0216 可先以内存运行 | 跨内容版本迁移、云同步、操作回放 |
| 内容扩展 | 事件、地点、动作、参与者配置、目标和路线以声明式内容进入 Datapack/Registry，并进行 ID/引用/边界校验 | 游戏内即时编辑、图形化地图编辑、外部脚本和社区模组工具 |
| UI / ViewModel | detached 的只读 Operation View；交互经 Controller/Runtime 命令；准备、指挥、Commit 和结果分区清楚 | 独立 Workspace、复盘视图与高阶策略分析 |

### 可解释性和随机原则

计划阶段只能查询确定信息，不因悬停、切换目标或预览协同而重抽随机数。Commit 先校验准备快照与指挥预算，再冻结；只有结算阶段推进事件随机流。随机分支需在结果日志说明实际触发项及其影响，概率预告只在内容和 Runtime 能给出可靠口径时显示。

合法替换失败时保持原计划或显示明确的计划空缺，不悄悄改写其他 Actor 的行为。一次 Commit 产生一个 Resolution 标识和一份不可变结果；重复提交同一准备版本不得重复扣费或应用结果。

## 三、Runtime 与数据设计

### 最小概念

| 概念 / 职责 | ID / 关键字段 / 引用 | Owner / 生命周期 | Authorable / Registry / Datapack | Save / Runtime-only | PlayerState 边界 | Runtime Editor | GALHCG | Domain Event | UI 是否可见 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `OperationEventDef` — 定义事件入口、状态变量、终局与玩家场景卡组 | event ID、入口 Location ID、初始轨道/事实、嵌入目标/结果、固定有限场景卡组与抽牌参数 | Datapack；Registry 内容包生命周期 | authorable 顶层定义；卡牌定义嵌入 Event，不新增顶层 Registry 表 | 不存档 | 不持有玩家运行状态 | v1 不进游戏内 Runtime Editor | Event 定义稳定后建 Concept | 定义本身不发；开始/终止时有生命周期事件 | 目录/摘要/目标可见 |
| `OperationLocationDef` — 定义可处理的局部现场问题 | location ID、participant/action 引用、`individual/global` 行为模式、有限 SceneAction 批次数、`costGain`、离场 `maxCarryCost`、有限 `maxVisits`、持有物 RouteGate 与嵌入目标 | Datapack；Registry 内容包生命周期 | authorable 顶层定义；Registry 校验引用 | 不存档 | 无 | v1 不进游戏内 Runtime Editor | Location/Route 稳定语义可建 Concept | 进入/完成地点时各发一次 | 当前地点、目标和出口可见 |
| `OperationActionDef` — 定义可准备的学生/对手/环境行动 | action ID、标签、资源归属明确的费用、TargetSpec、允许 Profile 与有限效果；玩家选取的 SceneAction 费用属于 PlayerCost | Datapack；Registry 内容包生命周期 | authorable 顶层定义；Registry 校验 Actor/Target 引用 | 不存档 | 不直接写 PlayerState | v1 不进游戏内 Runtime Editor | Action 稳定语义可建 Concept | 定义/单项结果不发全局事件 | Prepared Action/Intent 被选用时可见 |
| `PlayerSceneCardDef` — 定义一张玩家路线场景卡 | 卡牌/实体 ID、PlayerCost 费用、合法目标、场景时机与有限效果 | 嵌入 Event 的固定有限卡组 | authorable 嵌入值；不新增顶层 Registry 表 | 定义不存档；抽牌/手牌/已用状态随 Run 保存 | 只改 EventRun | 由 Datapack 定义 | 不为单张卡建 Concept | 出牌结果记入该批 Resolution | 手牌、费用、目标与效果可见 |
| `ParticipantSpec` — 把行动者安排到某个 Location | participant ID、阵营、可选 Character ID、Profile/Action 引用 | 嵌入 Location 定义 | authorable 嵌入值；非独立 Registry 表 | 不存档 | 角色引用长期定义，局部状态另存 | 由 Datapack 定义 | 不为单个 Actor 建 Concept | 参与者字段变化不单独发事件 | Actor 卡与当前计划可见 |
| `StudentOperationProfileDef` — 解释学生如何自主计划和处理问题 | Character ID、行动优先级、专长、替代行动、理由与角色随机技能规则引用 | Datapack；事件开始时读取 | authorable 顶层定义；Registry 校验 Character/Action 引用 | 不存档 | 不改 Character 持久进度或消费 PlayerCost | v1 不进游戏内 Runtime Editor | Profile 稳定时建 Concept；单个学生配置不建 | 技能结果仅进入 Commit Resolution | 专长、行动理由、技能结果可见 |
| `CombinationRule` — 让两个行动的协作改变一次结算 | 两个 Action 的标签/目标匹配、确定优先序与组合效果 | 嵌入 Location 定义；Beat 结算时读 | authorable 嵌入值；v1 不设独立 Registry 表 | 不存档 | 只改变当前 EventRun | 由 Datapack 定义 | 稳定协同语义可建 Concept | 匹配是 Runtime 内部步骤 | 可预览匹配与日志结果 |
| 目标/结局规则 — 说明当前问题进展和何时终止 | 局部 ID、轨道/事实 Predicate、类型、说明和奖励白名单 | 嵌入 Event/Location 定义；状态变化时评估 | authorable 嵌入值；不独立建表 | 不存档 | 进度归 EventRun；奖励经 Mutation | 由 Datapack 定义 | 目标/结果稳定后建 Concept | 地点/事件终止时发一次 | 进度、锁定原因和结果可见 |
| `EventRun` 聚合 — 作为本局唯一权威状态源 | run/event ID、当前地点、轨道/事实、局内持有物集合、局部状态、共享 PlayerCost、有限卡组 draw/hand/discard/played 区、地点/批次进度与独立 RNG 游标 | AronaClicker 操作运行时；开始至终局 | Runtime 创建；不进 Datapack/Registry | 是，独立存档子域 | 不混入 PlayerState 或 InitSnapshot；路线条件不读写 PlayerState.inventory | 不适用 | Run/State 边界稳定后建 Concept | 只在开始、地点转移/完成、终局发领域事件 | Event 概览、Actor 状态、Cost/手牌、持有物与路线可见 |
| `PreparedBeat` — 固定本轮所有计划供玩家审阅/提交 | beat ID、Actor→Action/Intent、Target、费用、理由、计划版本 | EventRun 内的待提交事实；Commit 后重建 | Runtime-only；引用 Registry 定义 | 随 Run 保存 | 无 | 不适用 | 通常是 Resolution 流程细节 | 不向 EventBus 逐项发布 | 只读计划投影可见 |
| `InterventionDraft` — 暂存 Sensei 对战斗计划的一项修订 | Actor ID、改选 Action/Target、指挥理由 | EventRun 内的待提交事实；Commit 后清理 | Runtime-only 待提交值 | 随 Run 保存，保证中断可续 | 无 | 不适用 | 不单独建 Concept | 不发布领域事件 | 改动前后差异可见 |
| `SceneActionSelection` — 暂存非战斗地点的玩家行为选择批次 | Location ID、`individual/global` 模式、角色→行为映射或一个全局行为及目标、玩家场景卡选择、费用快照和剩余批次数 | EventRun 内的待提交事实；Commit 后清理 | Runtime-only；引用 Location/Action/PlayerSceneCard 定义 | 随 Run 保存，保证中断可续 | 只改 EventRun | 不适用 | 不单独建 Concept | 通过该批 Resolution 记录结果 | 场景选项、逐人选择和费用合计可见 |
| `Resolution` / `EventResult` — 解释已提交行动和事件后果 | beat/run ID、实际动作/协同、随机结果、状态差异、终局类型 | EventRun 的结算记录；按上限保留 | Runtime 生成；不进 Registry | 有界日志随 Run 保存 | 长期结果由白名单另经 Mutation | 不适用 | 稳定 Resolution 语义可建 Concept；单份结果不建 | Beat 记录留在 Run；地点/事件边界再发事件 | 结果日志和终局摘要可见 |
| `RouteEdge` — 表达事件地点之间的去向和取舍 | source/destination Location ID、EventRun 局内持有物条件（`all/any/not`）、锁定原因 | 嵌入 Location；访问/选择记录归 Run | authorable 嵌入值；非独立 Registry 表 | 访问历史随 Run 保存 | 只读写 EventRun 局内持有物；不访问 PlayerState.inventory | v1 不进游戏内 Runtime Editor | Route 稳定语义可建 Concept | 选择只改 Run；地点转移发一次事件 | 当前可用出口、缺少的持有物及已知代价可见 |
| `OperationView` — 把当前运行投影成可操作信息 | 当前 Event/Location/Beat/Actor/Route 的 detached snapshot | OperationRuntime 派生；每次有效 UI 命令重建 | Runtime 投影；不进 Datapack/Registry | 不存档 | 不构成状态写入 | 不适用 | UI ReadModel 稳定后建 Concept | 不发领域事件 | 只读 UI 主输入 |

v1 只设少量顶层 Registry 表：Event、Location、Action 与可跨事件复用的学生操作 Profile。Participant、Route、Combination、Objective/Outcome 与 PlayerSceneCard 都嵌入所属定义；TargetSpec 和 ActionTag 是字段值，不建表。`Encounter` 是一段 Location 的连续 Beats；`OperationView` 是投影，不成为第二份写模型。若之后的复用/查找/作者生命周期证明确有独立需要，再拆顶层定义。

### 运行数据流

```text
Datapack definitions
  → Registry validation / lookup
  → OperationRuntime.start(EventId, selected Character IDs, seed)
  → EventRun + EventState + initial Location actors
  → enter Location: apply costGain; draw scene cards within hand cap
  → prepare by Location kind: battle student Profile plans + opponent/environment Intents; or non-combat player SceneActionSelection by Individual/Global mode
  → PreparedBeat + readonly OperationView
  → collect the applicable input: optional battle InterventionDraft (0 or 1 student-plan revision); or complete non-combat SceneActionSelection batch
  → validate the selected action costs and Commit one immutable snapshot
  → match eligible Combinations and resolve all actions once
  → update EventRun/ActorState/EventState + append Resolution
  → on location exit: clamp shared PlayerCost to source maxCarryCost
  → project next OperationView or location/event result
  → on terminal result, apply explicitly allowed persistent rewards via StateMutationService
```

Prepared state is stable from first presentation to Commit. A view projection never hands UI mutable runtime state. The product-level `OperationRuntime` owns the run; generic Engine additions are considered only when another AC feature has the same stable semantic need.

### 写模型与计算边界

`EventRun` 是唯一权威写模型，内含 EventState、ActorState、共享 PlayerCost、有限场景牌堆/手牌/已用区、LocationProgress、当前 PreparedBeat、至多一个战斗 Intervention 和至多一份非战斗 SceneActionSelection。`OperationView` 是按需构建的只读派生投影；ID 查表/地点出口索引是可丢弃缓存；Resolution 是有界事件记录。它们不互相复制成多份可独立修改的状态。

学生计划与敌方/环境 Intent 可共用一个带参与方 kind 的 `PlanEntry` 结构。v1 协同规则限为两项行动配对；不构造任意多输入配方搜索。OperationRuntime 不通过 Tick 或全局状态轮询驱动 Beat，只响应明确的 Start、Intervention、Commit、Route 与 Resume 命令。

### 性能与规模评估（静态推算）

**没有 Operation Runtime 实现或基准数据。** 下列复杂度是从设计流程推算，不是实测耗时、内存或扩展曲线。首个核心可玩切片包含 3 名学生、2 名对手、1 个环境参与者、最多 2 个 Beat；这只是校准样例，不是发布规模上限。

| 工作 | 规模变量与静态复杂度 | 设计护栏 |
| --- | --- | --- |
| 准备计划 | Actor 数 `N`、每人的 Profile 候选动作 `A`、合法目标 `T`、条件叶 `P`；未经约束时约 `O(N·A·T·P)` | 只遍历 Profile 声明的候选动作及其合法目标，不扫描整个 Registry；同一 Beat 只准备一次，改选只重算受影响 Actor 与协同预览。 |
| Action Combination | `N` 个 PreparedAction 全量两两比较上界 `O(N²)`；检查当前 Location 内嵌的候选规则 `R` | v1 只支持二输入；按标签/目标分桶，只检查有候选的规则；确定优先级，输入 Action 每 Beat 最多消费一次。 |
| EventState / Resolution | `H` 个效果更新 `N` 个 Actor、`S` 个 track、`F` 个 fact；逐效果复制完整状态会产生 `O(H·(N+S+F))` 分配 | 从同一冻结快照读取，以稀疏 delta 合并、限幅后一次原子写回 EventRun；只递增一次 Run 版本，不逐项触发全局事件。 |
| Objective / Route | Event Objective Predicate 有 `P` 个节点；Route 有 `Q` 个持有物 Gate 项；当前地点出口检查约 `O(outDegree·Q)`，静态图检查 `O(V+E)` | Registry 建 ID 和 `sourceLocation→outgoingEdges` 索引；Route 只查 EventRun 局内持有物与独立的地点访问上限，不评估 EventPredicate；任意 Objective Predicate 的全状态可满足性不放入无界 Registry 加载求解。 |
| OperationView / UI | 一次投影约 `O(viewPayload)`，包含 Actor、候选行动/目标、协同预览、事件轨道和出口 | 每个有效命令构建一次当前地点的 detached View，不投影整包/整张图；复用 UI Dispatcher 合并一个区域刷新；hover、scroll、选择不重跑 Resolver 或全量 render。 |
| Save / Resume | 整份存档 JSON 往返成本约 `O(existing SaveData + EventRunSnapshot)`，峰值临时内存也随新增 snapshot 增长 | 只存权威局内状态、待提交计划、随机游标与有界 Resolution 摘要；Task 0219 为 Run snapshot 设字节上限；不存 Datapack 定义副本、可重建索引、OperationView 或 DOM。只在有效状态命令后保存，不因 hover/预览写盘。 |

**风险判断：**按小队、单个现场、少量目标的回合式负载，Runtime 本身没有显著的设计级算力风险。风险来自内容上限缺失导致的候选/目标/组合爆长，以及误把局部提交接成全 PlayerState/EventBus/UI 全局刷新链。Task 0220 建立可运行的 `at-cap` 内容上限/fixture，另用 `2x-overflow` 验证超限内容会被拒绝；Task 0222 分别测正式默认事件和合法 `at-cap` 工作负载的 Runtime 性能。

Task 0219 用上限内合成 Run 固化 EventRunSnapshot 字节 cap；Task 0222 的性能回执在正式默认事件与合法 `at-cap` 工作负载分别记录 `prepare`、Intervention preview、Commit/resolve、Route projection、OperationView 构建和 Save/load 的 p50/p95、EventRun 快照大小、固定基础存档上的 SaveData 增量、对应内容规模及 reference 浏览器/设备。`2x-overflow` fixture 只测 Registry 拒绝与诊断，不进入 Runtime benchmark。先对比真实互动中是否有可感知卡顿，再决定具体时延 SLA。

### AC 概念翻译

| Gameplay Concept | AC Existing Concept | Decision | 原因 |
| --- | --- | --- | --- |
| 产品 Runtime 生命周期 | `GameInstance` / RuntimeWiring | **Reuse** | 由产品组合层装配新的 Operation Runtime，不让 UI 或内容表自行拥有业务状态。 |
| 世界线/Init | `InitService` / `InitSnapshot` | **Separate** | 一次事件不是世界线；只有未来产品规则明确绑定 Init 时才引用 Init ID。 |
| 长期角色身份 | `CharacterData` / CharacterSystem | **Reuse** | 用 Character ID、档案和玩家 roster 选择学生；不把事件 Actor 当作新一份玩家角色持久数据。 |
| 角色 Variant | `CharacterVariantDef` / VariantProgress | **Reuse with limits** | 保留已有差分和进度语义；v1 现场专长在单独操作 Profile，Variant 不自动变成战斗构型。 |
| 学生现场倾向 | 无同义稳定定义 | **New Concept** | 独立 `StudentOperationProfileDef` 表达行动优先级与专长，避免把现场战术规则塞入角色身份基础字段。 |
| Enemy / environment participant | 现有 Character / Area 实体 | **Separate / New** | 可作为 EventLocation 的 participant；不假设对手是玩家名册中的 Character，也不假设环境是 Area。 |
| 现场节点 | `Area` / `Spot` | **Separate** | Area/Spot 承担世界线空间、设施与功能；Event Location 是一次事件中的问题状态。 |
| Runtime Actor HP / resource / status | `PlayerState` | **Separate** | 归属当前 EventRun，不增加一组 per-Init/Global 玩家字段。 |
| 长期奖励写入 | `StateMutationService` | **Reuse** | 事件终局对明确允许的长期 flags/资源/角色进度写入走 mutation；事件内部步骤不逐条写玩家档案。 |
| per-Init 持久字段 | `PER_INIT_FIELD_SPECS` | **Do Not Use by default** | 仅在事件进度明确随 Init 快照保存时增加字段；Run 默认归事件存档子域。 |
| 资源产出 | `GameNumSystem` | **Do Not Use for tactical values** | 现场费用、危险、队员努力值是运行局部状态；GameNum 的语义是产出和 Spot 求值。 |
| 实时/离线帧推进 | `SessionService` / `TickSystem` | **Do Not Use for Beat progression** | Operation 由玩家 Commit/Route 命令推进；秒级 Tick、离线补算和生产资源流程不属于战术时序。 |
| PlayerState 条件 | `ConditionSystem` | **Reuse for AC admission only; Separate for Run state** | 内容解锁若直接读现有玩家/Registry 条件可用现有 Condition；事件 Objective/Outcome 可读取 EventRun 轨道/事实；RouteEdge 只查 EventRun 局内持有物（`all/any/not`），不读写 `PlayerState.inventory`。 |
| Event-local discovered facts | `Reveal` / Information Reveal | **Separate** | Reveal 派生 AC 内容可见性与 watches；现场线索/事实属于 EventState。事件结果若需公开长期内容，再在终局映射到 AC 可见性状态。 |
| 效果 | Engine `EffectDef` / StateMutation | **Separate for local results; Reuse at terminal edge** | 战术效果改 EventRun；事件完成后长期效果可经既有 Effect/Mutation 管线应用。不能将临时事件变量伪装成玩家效果。 |
| Trigger / EventBus | TriggerSystem / EventBus | **Reuse selectively** | 只发布开始、地点完成、事件终局等值得跨系统订阅的领域事件；准备步骤与结算子阶段保留在 OperationRuntime 内。 |
| `Registry` / `Datapack` | Data Services | **Reuse + Extend** | 新定义加入产品 Datapack/Registry 合同、校验、默认内容与 Schema；不在运行时读写任意 TS 脚本。 |
| `GameView` / UIContext | 只读 ReadModel/Controller 命令 | **Reuse pattern + New projection** | 建立 detached OperationView 与命令契约；不把 EventRun 原对象塞入通用 GameView。 |
| `StoryService` | StoryDef / Story Runtime | **Reuse at narrative boundary** | 事件前后可启动剧情或提交 follow-up；战术 Intent、Beat 与事件日志不借用 Story 游标。 |
| Affection / `CharacterBond` | 角色培养 | **Reuse only if content gates demand** | 关系/好感可作为既有门槛；不把它用作行动命令预算或通用关系图。 |
| `SaveSystem` | 存档/StorageAdapter | **Reuse adapter; separate run payload** | 存档负责持久化；Run codec 明确独立于 PlayerState 与 InitSnapshot，并保存 prepared/随机状态以精确续局。 |
| 游戏内 Runtime Editor | Init/Area/Spot/Enhancement 编辑流程 | **Do Not Use for v1 authoring** | 当前职责不覆盖事件图和回合运行状态。v1 内容经 Datapack 与现有 schema-driven authoring 路径编辑；只有证明需要在线编辑再另立 Task。 |
| 通用引擎算法 | `src/engine/` | **Separate by default** | 玩法 B 属于 AC 产品 Runtime；新概念先落产品层，避免让通用 Engine 承担产品规则。 |

### 运行时 / 长期状态 / 存档边界

- Character 定义与 roster 决定哪些学生能参加；选择学生时将所需的稳定角色引用和已校验基础数据复制到 EventRun ActorState。
- EventRun 内保存临时 HP、资源、已准备行动、事件轨道/事实、地点访问、终局判定、随机种子/游标和日志位置。
- EventRun 还保存共享 PlayerCost 与场景卡堆/手牌/已用区；PlayerCost 不进入 PlayerState。仅在 Commit 消耗随机流；角色随机技能与行动检定均不得在预览/编辑阶段掷骰。
- EventRun 终局时只将定义允许的结果映射到 PlayerState；每一次本地行动都不触发玩家档案写入。
- 续局存档属于 SaveSystem 的 EventRun 子域，不把整局压入 `PlayerState` 或 `InitSnapshot`。不写旧版存档迁移；破坏性结构变更遵守项目清档护栏。

## 四、UI / ViewModel 信息架构

每次 Commit 前，玩家要能同时判断“局面如何、学生将做什么、谁威胁谁、我这次能改什么、预计改变了什么”。OperationView 至少提供：

- Event/Location 标题、当前目标与成功/失败指标；事件轨道及已知事实。
- 学生参与者状态、当前行动、行动原因、目标、资源与合法替代项。
- 非战斗场景的 Individual/Global 模式与本批选择、共享 PlayerCost、当前手牌及抽牌/已用状态。
- 对手 Intent 和环境压力的目标、可预见效果与约束。
- 一次指挥位剩余情况、当前修订前后对照、费用校验和协同结果预览。
- Commit 可用性、不能提交/不能选择的原因。
- Resolution 日志：行动、组合、随机结果、状态变化及触发的地点/事件结局。
- 路线视图：可用地点、缺少的局内持有物、地点访问上限、门槛未满足原因及跳过的现场问题可能造成的变化。

信息区域可组织为 Event Overview、Location、Prepared Beat、Actor、Action/Intent、Intervention、Resolution Log、Route/Transition。它们是内容职责，不预设屏幕分栏或具体美术。

UI 只读 OperationView，通过 Controller 命令修改 InterventionDraft 或选择 RouteEdge。小范围状态更新应保留焦点、滚动与目标选择；普通 hover、scroll、selection 和 click 不重建整个 Workspace。首次纵向切片只需要一处现场与一个 Beat 工作区，不要求一次重做全 AC 导航。

## 五、核心可玩切片（Task 0216）

用全新、无背景知识要求的中性事件验证核心循环：一个地点、三名现场 Profile 不同的学生、两名对手及一个环境目标，最多两个决策节拍。

1. 三名学生各自自动准备行动；至少一名学生的专属现场能力能打开一个真实有效的处理方案。玩家能从 View 读出差异及选择原因。
2. 对手公开 Intent，环境危险通过事件轨道表现。
3. 本战斗切片中玩家每 Beat 最多修订一名学生计划；非法目标不能提交并显示原因。非战斗场景的逐人/全局选择由 Task 0224 验收，不受该战斗指挥位限制。
4. 同一 Beat 至少有两项合理但互相竞争的干预机会；不干预、改动机会 A、改动机会 B 会造成可解释的不同结果或代价，不能一次指挥同时覆盖所有问题。
5. 至少一条二输入行动标签协同在目标/规则匹配时改变一次结果，输入行动不重复结算。
6. Commit 后所有行动使用同一快照，资源只扣一次；Resolution 说明协同及状态变化。
7. 地点目标依据事件轨道或事实判定；玩家可通过不同决定稳定达到成功与失败两种结果，不能只靠随机差异。Task 0217 再扩充为成功、部分成功、失败三类事件终局。

该阶段叫**核心可玩切片**，不包含正式多地点内容、续局和最终发布工作流。重点是学生形成计划、Sensei 进行有限干预、统一结算改变现场状态这条链真实可玩且可复现。

## 六、核心身份待证验收

当前产品身份是可证伪假设，功能存在本身不等于玩法成立。下列条件是从“有学生、有 Click、有路线”走到有独特决策的验收：

- **干预竞争：**核心可玩切片和 V1 事件至少各有一个关键 Beat，同时出现两项以上合理而互相冲突的计划调整机会；不干预和两种不同干预都产生能解释的结果/代价。若总有唯一明显的坏计划，需重做学生倾向或现场压力设计。
- **学生身份：**至少一项 Profile 专属能力改变可行解法；替换学生或失去能力后，行动选项、目标进度或可达结局发生变化。理由需要解释行为原因，不止列标签。
- **路线取舍：**至少一处地点有两条都可取但各留不同后果的路线；选择前显示当时已知的收益、风险或待处理问题，后续状态兑现所选后果。
- **结局取舍：**成功、部分成功、失败使用明确优先顺序；同一终局状态冲突时结果确定。玩家决定能稳定导向三种结果，随机不应独占决定权。
- **统一结算：**战斗与非战斗行动都经历同一冻结计划、费用校验、Commit、Resolution 和 EventState 更新；非战斗地点不是单次菜单检定。

核心切片若未满足前四项，玩法身份尚未得到证明；后续内容量或平衡数值不能替代这些证据。

## 七、Roadmap 与 Task 依赖

| 顺序 | Task | 完成后得到的能力 | 依赖 |
| --- | --- | --- | --- |
| 1 | [[task-0213-gameplay-b-event-runtime-and-session-state]] | 可启动、推进与终止一个独立 EventRun，拥有局部状态边界 | 无 |
| 2 | [[task-0214-gameplay-b-student-participation-and-autonomy]] | AC Character 可作为学生参加事件并依据可解释 Profile 形成计划 | 0213 |
| 3 | [[task-0215-gameplay-b-prepared-actions-and-intervention-resolution]] | 行动/Intent 快照、有限指挥、协同与一次性 Resolution 闭环 | 0213–0214 |
| 4 | [[task-0216-gameplay-b-command-loop-vertical-slice-ui]] | **核心可玩切片**：玩家可在一个地点完成准备、竞争性修订、提交和结算闭环 | 0213–0215 |
| 5 | [[task-0217-gameplay-b-objectives-and-partial-outcomes]] | 场景与战斗共享事件目标，能产生成功/部分成功/失败 | 0213–0216 |
| 6 | [[task-0218-gameplay-b-causal-locations-and-route-selection]] | 多地点选择会改变后续压力、事实或处理方案；Route Gate 只检查 EventRun 局内持有物，允许 `all/any/not`，每地点访问有界 | 0217 |
| 7 | [[task-0224-gameplay-b-scene-actions-and-route-cost]] | Individual/Global 非战斗 SceneAction 玩家选择、共享路线 PlayerCost、每地点 `costGain` / `maxCarryCost` 纳入统一 Commit/Resolution 与 EventRun | 0213–0218 |
| 8 | [[task-0225-gameplay-b-finite-player-scene-card-deck]] | 有限玩家场景卡组、确定性抽牌与场景支付接入；卡牌不进入战斗 Click | 0224 |
| 9 | [[task-0220-gameplay-b-datapack-contracts-and-registry]] | 事件/地点/行动与嵌入场景卡组可由声明式 Datapack 定义并验证，并提供逐事件内容兼容标识 | 0213–0218、0224–0225 |
| 10 | [[task-0219-gameplay-b-event-save-and-resume]] | EventRun 可精确暂停和恢复，包含 PlayerCost、卡组分区及各自 RNG 状态 | 0213–0218、0220、0224–0225 |
| 11 | [[task-0221-gameplay-b-authoring-and-content-validation-workflow]] | 作者能创建、检查、加载并迭代完整事件内容 | 0217–0220、0224–0225 |
| 12 | [[task-0222-gameplay-b-packaged-event-entry-and-end-to-end-slice]] | **V1 产品切片**：玩家可从正式 AC 入口启动并完成含场景选择、PlayerCost、有限场景卡组与三类结局的多地点事件 | 0216–0221、0224–0225 |

0213–0216 先交付自治计划、有限指挥和统一结算的核心切片；0217–0218 补齐事件目标与持有物门槛路线。新增的 Task 0224/0225 在存档、Datapack 合同和作者工作流定型前，补齐早期已确认的场景行为模式、共享路线 Cost、有限场景卡组和角色技能兼容规则。Task 0220 冻结声明合同及事件内容兼容标识；Task 0219 再据此精确保存/恢复 Run；Task 0221 完成作者验证流程，0222 将正式游乐园样例放入 AC 默认内容并从 `base:init:schale_office` 入口走完整事件。旧原型仅提供设计来源，不视为 AC 机制或可直接复用实现。

## 八、开放问题（不阻止推进）

- v1 中学生/敌方战术行动费用采用哪些 Actor/Team EventRun 资源、上限与回充节奏：由纵向切片体验定量，与共享路线 PlayerCost 分开。场景行为与玩家场景卡的 PlayerCost 费用归属已确认；具体每个事件的 Cost 增量、离场上限、抽牌量和手牌上限由内容配置。
- 事件结果提交哪些长期奖励/旗标：每份 EventDefinition 显式白名单，首个切片只选一个可复核结果。
- 参与角色是否受 Init 限制：默认由 roster 与事件入场规则决定；出现稳定产品要求后再连到 Init 生命周期。
- 哪些内容需要在游戏内即时编辑：当前 v1 不用 Runtime Editor 编辑 Operation 定义；若 data pack authoring 验收不能覆盖作者工作流，另立 Task 裁定。
- 内容校验的具体数量上限与完整日志保留字节：由 Task 0220 固化；Task 0222 测量正式默认事件与有效 `at-cap` 夹具，不得在无实测时宣称已有时延 SLA。
- 角色随机技能的具体触发条件、概率和效果由事件/角色内容定义；随机只在 Commit 消耗 Seed，技能不消耗 PlayerCost，并与 Profile 的确定性专属现场能力并行。

## 九、事实依据与置信边界

当前 AC 机制事实以 `src/`、`tests/` 与 `docs/docs-829/` 为准。GALHCG 用于导航；本轮地图查询没有发现玩法 B 的稳定 Concept。用户已确认的操作边界、被观察到的可用模式和本文新增裁定分列于上方“裁定来源与状态”，不能把新设计当成已实现机制。

本轮只读核对了 AC 产品 Runtime、Character / Variant、PlayerState / Mutation / Save、Condition / Effect / Trigger / EventBus、GameNum、Registry / Datapack、View / UI、Story 与 Init / Area / Spot 的现有边界。GALHCG latest saved freshness observation 是 2026-10-03：213 个 owner 曾被记录为 fresh、28 个为 unknown、941 个尚未检查；查询未做全图实时 freshness 核验。所有实现 Task 仍要求开始施工时按 `docs/ai/task-read-set-routing` 读取源码和测试。

由于本轮只构建规划文档，不更新 `docs/docs-829/` 机制正文、不修改 GALHCG 图谱。待实现稳定以后，负责该 Task 的施工者再按文档维护流程更新当前机制页和稳定语义图。

## 十、独立复核与评估结论（2026-10-04）

- **内容/追溯复核：**没有发现新设计依赖特定角色、地点、文件或旧 Runtime 的引用；Task 依赖无循环。复核发现已确认约束、新决策与实验模式需要分层记录，已加入“裁定来源与状态”表；实体表也逐行回答 Datapack、Save、EventBus 和 UI 归属。
- **玩法评估：**核心身份连贯，但属于待证实产品假设。Task 0214/0216/0217/0218/0222 已加入专属学生解法、竞争性干预机会、可解释路线取舍、结局优先序及非随机结局验收。
- **引擎边界评估：**Operation 属于 AronaClicker 产品 Runtime；EventRun 是唯一写模型；OperationView 和索引可重建；局部状态不进入 PlayerState、GameNum、通用 Condition/Effect 或 TickService；Mutation 只处理终局长期奖励。
- **静态性能结论：**当前没有 Operation Runtime 实现，无法报告运行耗时、内存或伸缩曲线。小队/有限地点的预计成本可控；主要风险是作者内容无界、二输入组合搜索、动态 Goal 的无界可满足性求解、每个子效果全量复制和 UI/存档过宽更新。Draft 与 Task 0215/0218/0219/0220/0222 已规定候选遍历、二输入配对、局部索引、批量 delta、有界 Run/日志，以及默认事件与有效 `at-cap` 的测量边界。
- **性能门槛：**数值上限由 Task 0220 固化；运行时 p50/p95 与 SaveData 增量由 Task 0222 在已标记的 reference browser/设备上形成数据后确定。本 Draft 不把复杂度推断或静态审查写成 benchmark 通过；`2x-overflow` 只验证 Registry 拒绝。
- **复核方式：**三条并行只读审查分别覆盖内容来源、玩法质量与 AC Runtime/性能边界；本次没有修改代码或 GALHCG，也没有运行代码测试。

## 下一步

从 Task 0213 开始逐阶段施工。每个 Task 仍需在其范围内选择最小 Read Set、完成行为验收、记录 Receipt，并按项目工作流归档；本 Draft 作为玩法与架构裁定来源持续维护。

## 相关路由

- [[docs/docs-829/00-INDEX]]
- [[docs/ai/goal-workflow]]
- [[docs/ai/task-read-set-routing]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/docs-829/05-conventions/doc-maintenance]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
