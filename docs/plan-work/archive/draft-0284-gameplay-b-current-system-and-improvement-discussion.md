# Draft：玩法 B 当前结构与综合改进讨论

状态：draft — 已依据当前源码和机制文档整理现状；待 SolChat 提出综合改进方案，并由项目负责人裁定方向。

> 本文给未参与前序实现的讨论者阅读。尽量先用玩法语言解释现状，再给出源码名词和事实依据。本文描述的是当前实现，不代表已批准的改造方案；“待讨论”问题也不构成施工授权。

## 目标与最终方向

为玩法 B 建立一份完整、容易理解、可以交给 SolChat 评议的现状底稿。讨论目标是：在保留玩法 B 已有地图、战斗、场景行动、卡牌、路线、奖励和续局能力的前提下，判断内容作者和玩家是否容易理解整个系统，并提出一套能循序渐进落地的综合改进方案。

期望最终结果包括：

1. 玩家能理解一次行动发生了什么、为何可以或不可以执行、执行后改变了什么。
2. Datapack 作者能从空白内容开始，按清楚的步骤制作一张小地图，并知道每一步需要什么数据。
3. 角色行动候选、角色策略与玩家持有的场景卡牌有明确且不相互误导的边界。
4. 简单内容不必配置高级系统；复杂内容仍可逐步增加分支、条件、场景、自动行动和奖励。
5. 改进计划能拆成有独立验收标准的阶段，不要求一次性重写整个玩法 B。

## 先读结论

- 玩法 B 的基础骨架是 **Event（一次任务）→ Location（地图地点）→ Scene（地点内的阶段）→ Action（可执行行动规则）**。
- 当前系统还包括 Actor / Team、目标与结局条件、Route 路线、Character Profile、加权行动池、策略偏好、玩家场景卡组、干预、协同、奖励与 Save/Resume。
- Runtime 的状态归属和结算边界整体清楚：局内状态由 Operation Runtime 持有；UI 读只读投影；一次结算先规划，再原子提交。
- 对作者而言，概念和引用较多。尤其是六张顶层表、Location 与 Scene 两层设置、角色行动手牌与玩家物理卡组两套牌、多个层级的完成条件，都会增加从零创作的认知负担。
- 当前讨论不预设“合并所有东西”或“删掉高级能力”。需要 SolChat 提出在简单入口、表达能力和旧内容兼容之间的综合建议。

## 玩法 B 是什么

Gameplay B 是从一个固定阵容进入的一次独立行动关卡。玩家进入后沿地点推进，在战斗中安排角色行动，在非战斗场景中执行调查、修整、交涉、购买或其他行动；完成地点目标后选择路线，最终达成成功、部分成功或失败结局。符合条件的终局奖励可领取。

一个很简单的玩家过程可以是：

1. 从夏莱办公室的行动入口选择一个关卡并确认出动学生。
2. 在入口地点处理敌人，满足地点目标后打开出口。
3. 进入现场场景，由学生检查设备，得到线索或物品。
4. 使用线索解除警报，或者选择另一条需要通行证的路线。
5. 到达出口，结束事件并领取成功奖励。

“双方”在规则中不是画面左右两边。规则用 Actor ID、参与者类型（学生／对手／环境）、Team、位置和 Action 的目标条件表达谁能行动、能对谁行动。UI 可以把角色显示在两侧，但画面布局不是规则依据。

## 内容包中有哪些数据

玩法 B 的内容随 Datapack 加载，当前有六类顶层表。一个内容包通常还必须提供项目级的基础 Datapack 字段；下面只列玩法 B 自己的六类可选内容表。

| 数据表 | 通俗解释 | 主要内容 |
| --- | --- | --- |
| `operationEvents` | 一次关卡任务的总目录 | 入口标题、所属世界线、地点列表、初始状态、参与者、目标、奖励、玩家费用和场景卡组 |
| `operationLocations` | 地图上的地点 | 战斗或场景阶段、启用行动、地点目标、路线、费用变化、访问限制、可选 Scene 序列 |
| `operationActions` | 真正的行动规则库 | 可用角色类型、能力要求、目标规则、Actor / Team 费用、数值或事实效果 |
| `studentOperationProfiles` | 某位学生在本事件中的玩法配置 | 可选 Action、优先级、能力、理由、抽取池、策略和可选技能规则 |
| `operationCardPools` | 为角色提供行动候选的加权池 | 满足哪些有限条件后可用、池中有哪些 Action、各自抽取权重 |
| `operationStrategyProfiles` | 角色对行动标签的偏好 | 行动标签的偏好权重，供角色行动候选权重计算使用 |

Event、Location、Action、Profile、Card Pool、Strategy Profile 通过完整稳定 ID 互相引用。SceneAction、RouteEdge、Objective、Outcome、CombinationRule、玩家场景卡定义、Actor、Team 等则嵌在所属 Event 或 Location 里，使用局部 ID。也就是说，作者需要同时理解“哪些数据是独立表”和“哪些数据随父对象一起声明”。

## 一次 Event 的组成

### Event：地图与任务总合同

Event 声明：

- 任务属于哪个 Init，如何在游戏里找到入口；
- 包含哪些 Location、从哪里开始、最多允许访问多少地点；
- Actor、Team、学生参与者及各自的学生 Profile；
- 事件轨道（有范围的数字）、事实（已发现/未发现）、物品和起始持有物；
- 事件目标、硬失败条件、成功/部分成功条件；
- 初始 PlayerCost 与可选玩家场景卡牌；
- 成功或部分成功时可发放的受限资源奖励；
- 恢复存档时使用的 `resumeVersion`。

Event 会引用地点 ID，不内嵌 Location 全文。Action、Profile、抽取池等也从独立表解析。Runtime 入场时会检查事件定义、参与者资格、角色是否真实持有且已解锁、Profile 引用等；检查失败不会创建半份 Run。

### Actor 与 Team：局内的行动者和共享资源

Actor 可以是学生、对手或环境实体。Actor 定义包含生命值、局部资源、类型、可选 Team、位置，以及可选展示信息。Team 维护队伍共享战术资源，Actor 的 Team 归属只由其 `teamId` 指定。

玩家选入的学生仍以 AC 的角色身份作为长期来源；入场后 Run 冻结本局需要的身份和 Profile 资格快照。EventRun 不复制角色的完整长期数据、Variant 进度或角色对象。

### Location：地图节点和出口

Location 必须明确是 `combat` 或 `scene`。战斗地点启用可用 Action 和 Combination；场景地点可配置 SceneAction、批次、购买选项和费用。Location 还能声明：

- primary / secondary 目标、部分成功或失败条件；
- `costGain`：进入地点时增加多少 PlayerCost；
- `maxCarryCost`：离开时最多能带多少 PlayerCost；
- `maxVisits`：这个地点最多能进入多少次；
- `routeEdges`：可去哪些地点、路线显示文字、门槛物品以及是否消耗门票。

RouteEdge 的目标必须是 Event 中声明的 Location。路线只在当前地点完成后根据门槛开放；玩家提交路线 ID 后才转场。一个出口和多个出口走同一条 Runtime 命令。

### Scene：地点中的有序步骤

Location 可声明零个或多个 Scene。显式 Scene 会按作者排列顺序推进，带自己的标题、说明、行动来源、批次上限和完成谓词。若 Location 没写 `scenes`，系统会投影一个隐式 `main` Scene，并沿用旧 Location 上的场景字段。

Scene 完成只表示该地点内的某个阶段结束。Location 是否完成仍按地点目标和结局条件判断；地点完成后可能还要选择 Route；没有可用出口时才继续判定 Event 的最终结局。

### Action 与 SceneAction：行动规则和出现位置

`OperationActionDef` 是行动效果和目标规则的唯一来源。它描述行动资格、能力门槛、目标关系、目标筛选、费用和效果。效果当前可改变 Actor 生命或资源、位置、Team 资源、Event 轨道、事实和持有物。

SceneAction 是 Location/Scene 中的一个薄入口：它引用 `actionId`，再补充场景标题、说明、Individual/Global 范围、PlayerCost、固定/可选策略，以及执行者是否必须是学生、可选学生或无需学生。

这意味着“检查设备”和“医疗”可以是出现在某个地点的场景入口，而它们的目标、资格和效果仍由引用的 Action 定义。界面不应根据 Action ID 自己猜目标或效果。

### 目标、事实与结局

Event 的轨道是有上下限的数值；Fact 表示某件事已知或尚未发现；Held Item 表示 Run 当前持有的任务物品。Objective / Outcome 的谓词可以检查轨道数值或某个事实是否存在，并可组合 all / any 条件。

这些概念承担不同用途：

- **轨道**：例如警报等级、整备度、队列秩序；
- **事实**：例如已找到维修线索、警报已解除；
- **物品**：例如钥匙、员工证；
- **目标/结局**：检查轨道或事实，决定阶段或任务是否达成；
- **路线 Gate**：检查 Event 持有物，决定某条边是否可以通行。

Route Gate 当前检查已声明的持有物；Objective / Outcome 谓词当前检查 Event 轨道和事实。它们不是同一套任意表达式系统。

## 两种主要游玩情境

### 战斗地点：按 Beat 处理多名行动者

战斗开始后，Runtime 根据当前 Actor 状态、可行动作、能力、目标合法性、资源和启用行动，为行动者准备一个 Beat。每名参与者获得一个 `studentAction`、对手 `intent` 或 `wait` 计划。玩家可以在有限干预槽中修订至多一名学生的计划。

提交时，纯规划器重算并核对行动、目标、费用、Combination、可触发的学生技能及变化。成功才一次性提交支付、效果、随机游标和 Resolution 历史；失败时不写入半笔状态。一次 Beat 的战术资源和 PlayerCost 分开：Combat Beat 不支付 PlayerCost。

Combination 是 Event/Location 局部规则：匹配两名不同学生的 Action 标签、目标条件和优先级后，以组合效果替代输入行动效果，但原有行动费用仍需支付。学生技能规则只会在引用的有限规则存在、触发 Action 匹配且有效 Beat 成功提交时抽样。

### Scene 地点：提交一个场景批次

非战斗 Scene 每次由一个显式批次命令推进。批次可含 fixed SceneAction、玩家选择的 SceneAction、零张或多张玩家手牌、一次性 PurchaseOffer；如果 Scene 开启 `autoCharacterActions`，也可合入存活学生的自动行动。Runtime 会先计算 PlayerCost，再校验 Actor / Team 行动成本与目标，最后用同一条 `OperationResolution` 一次提交费用、效果、卡牌移动和批次进度。

Individual 模式按学生分派行动；Global 模式由一张行动面对当前合法对象。目标可以是手动选择特定 Actor，也可以在场景批次中声明对所有当前合格目标生效。`selected-student` 表示必须绑定一个合格学生；`none` 表示由玩家就地激活；`optional-student` 允许两种用法。fixed 项自动进入批次，不可取消；可选项并不意味着必须全部选满。Skip 是单独的显式提交行为，具体哪些 fixed 内容仍结算由合同决定。

场景批次不会运行战斗专属的敌方 Intent、Combination 或学生技能抽样。普通 Scene 不自动生成学生行动；需要作者显式打开 `autoCharacterActions`。这可以构成休整、自动协助、调查、交涉、购买、设备操作等场景，但这些主题目前不是独立的数据类型，具体由 Scene + SceneAction / Action / PurchaseOffer 组合表达。

## 两种“手牌”和抽取复杂度

玩法 B 内有两套容易混淆的牌：

### 学生 Character Hand（行动候选）

这套 Hand 是每名学生当前能用于战斗或自动场景规划的 Action ID 候选集合。Event 可设置每名角色的 Hand 大小，缺省为 3，验证范围为 1–10。候选从 Event、Location 和 Student Profile 指定的 Card Pool 汇总；Pool 可根据有限现场条件启用，并给每个 Action 候选权重。Strategy Profile 的标签偏好会影响行动候选权重。学生 Profile 的 Action 优先级再决定自动规划时优先尝试哪些已持有行动。

关键点：这套“手牌”并不是给玩家逐张打出的角色实体卡，它描述角色的可选行动与自动计划来源。启用 Scene 自动行动时，每次成功批次可按固定种子和当前访问/批次状态派生下一轮 Character Hand；不会推进战斗 Beat 或战术 RNG。

### 玩家场景卡组（实体牌）

这是真正有副本数和实体实例的有限卡组，定义嵌在 Event 的 `playerSceneDeck` 中。每种卡指向已有 Action，另外指定副本数、PlayerCost、初始抽牌量、地点进入时抽牌量和最大手牌数。Run 只保存物理卡实例 ID 在 drawPile / hand / discard 的分区和次序；打出的牌进入 discard，不会自动洗回。

因此，作者需要分别回答：角色可以“抽到/持有”哪些行动候选，以及玩家能从手牌“打出”哪些场景卡。二者的身份、抽取方式、费用来源、弃牌方式和触发场景都不同。

## 从空白到一张可运行地图

对新作者，最自然的构建顺序应是先做最小地图，再逐步添加规则。下面是当前数据结构能表达的创作步骤，不代表编辑器已提供这些步骤向导：

1. **确定一个任务**：给 Event 起名字，指定入口世界线、起始 Location、访问上限和一个清楚的成功目标。
2. **放入 Actor**：定义玩家要面对的角色、对手或环境对象；决定谁属于哪个 Team、初始生命和资源是多少。
3. **创建首个地点**：选择 `combat` 或 `scene`，声明启用 Action 和至少一个可判断的完成/失败出口。
4. **创建基础 Action**：写清谁能使用、目标是谁、需要什么费用、成功后改变什么。
5. **连好地图**：用 RouteEdge 连接目标地点；先做一条必经路线，再按需要加入分支、通行物或访问上限。
6. **增加故事步骤**：需要一个地点内连续多个阶段时再添加 Scenes；每个 Scene 说清进入时做什么、怎样完成、完成后下一个 Scene 是什么。
7. **加入学生特性**：只在确实需要角色差异或自动行动时添加 Student Profile、行动池和 Strategy Profile。
8. **加入玩家卡与购买**：需要实体消耗牌或一次性商店选择时，再补 `playerSceneDeck` 或 `purchaseOffers`。
9. **运行校验和试玩**：确认 ID、引用、目标和出口完整；从入口跑通成功、失败与主要分支，再观察费用、卡牌、续局和奖励。

用“游乐园警报”作简单例子：一个 Event 有“入口战斗 → 设备现场 → 出口”三个 Location；设备现场有“检查设备”和“解除警报”两个 Scene；检查行动揭示维修线索，线索影响通行路线；出口完成后发放资源奖励。第一版可以不做角色抽取池、技能、物理卡组和多个分支，等基础流程好玩后再逐个引入。

## 当前内容包中的玩法样例

当前样例已经覆盖多种组合，不是一个单一的战斗 Demo：

| 样例 | 主要展示 | 可帮助讨论的问题 |
| --- | --- | --- |
| Carousel 正式切片 | 战斗地点接场景地点、现场行动、费用与路线选择 | 战斗与非战斗行动怎样组成同一条任务流程 |
| Strategy Park（13 个地点） | 多地点地图、探索/交涉/战斗/恢复、分支、持有物门禁、路线和访问上限 | 作者如何看懂较大的地图，角色行动、策略和地点条件怎样共同工作 |
| Atomic Scene Demo | 一个地点内依次调查设备、处理警报；不同 Scene 各有批次和完成条件 | Scene 完成与 Location 完成为什么要分开 |
| Rest Scene Demo | 学生自动行动、固定场景行动、角色差异和玩家物理场景卡共用一次结算 | 角色行动候选与玩家打出的实体卡如何同时出现 |
| Scene Purchase Demo | SceneAction 选择和一次性 PurchaseOffer | 场景中的“做行动”和“花费用买一次结果”如何区分 |

Carousel、Atomic、Rest 和 Purchase 样例由 `gameplay-b@1.0.0` bundle 装配；13 地点 Strategy Park 是独立的 `gameplay-b-strategy-park@1.0.0` bundle。两者都走同一 PackManager / Registry / Operation Runtime 路径。以上样例适合 SolChat 评议新手路径和高级能力是否应分层；内容包的存在不等于每个样例都是最终商业关卡设计。

## 运行时状态、提交和存档

EventRun 是一次行动过程中唯一的局内状态 owner，与长期 PlayerState 分开。它包含 Event 轨道/事实/物品、Actor 和 Team 状态、玩家 PlayerCost、实体卡牌三分区、地点访问与 Scene 完成进度、路线历史、结算历史、战术计划和有限随机状态。纯预览不会写 Run；只有被接受的批次或 Beat 才提交。

每次玩家命令会携带 `runId` 和 `planVersion`，避免过期页面提交到新状态。Runtime 根据冻结的本局规则重算预览和结算；成功时整体替换 Run 状态，不在中途留下部分变化。UI 读的是 detached 的 OperationView，不直接拿 EventRun 或规则定义写回。

主 SaveData 可以带一个有版本约束的 `operationRun` checkpoint。存档保存局内状态，不重复保存完整 Registry 规则或 View；读档时用当前 Registry 规则重新解析并验证 checkpoint。作者修改影响续局兼容的内容后需要维护 `resumeVersion`。战斗随机和场景角色 Hand 的确定性派生也有不同用途；只有有效战斗 Commit 才推进战术 RNG cursor。

## UI 与作者体验的当前边界

当前游戏 UI 使用 Operation 工作区展示地图、角色/行动、Scene 和操作记录。它通过只读 View 获取作者文案、可用行动、当前合法目标、费用预览、路线状态和奖励状态；临时选择可先保留在 UI 草稿，确认后才交给 Runtime。

卡牌交互会涉及浏览、选择、不可用、固定、执行者、目标、拖放和键盘路径。这些状态的底层语义不同，但在作者内容上往往表现为一组可选字段。编辑者还需要理解稳定 ID、跨表引用、合法的目标范围和目标/结局出口。当前 V1 不包含完整的地图画布、阵容选择器、通用任意卡牌系统或自定义奖励效果；这是现有范围边界，不等于后续永远不能做。

## 当前实现事实与讨论影响

| 已核实的事实 | 当前实现依据 | 对综合方案的影响 |
| --- | --- | --- |
| 内容作者输入来自六类独立顶层表；Scene 和多种规则则嵌在 Event/Location | `src/data-services/contracts/datapack.ts`、`src/data-services/contracts/operation.ts`、[[docs/docs-829/03-data-structures/datapack-contracts]] | 要讨论表是否需要作者侧聚合/向导，不要误以为所有定义都在 Event 一个对象里 |
| Event 引用 Location；Location 声明 stage 与路线；Scene 按顺序推进或省略后回退为 `main` | `operation.ts` 的 `OperationEventContentDef`、`OperationLocationDef`、`OperationSceneDef`；[[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] | 讨论 Location 与 Scene 是否足够直观，默认和继承规则是否需要更显式 |
| Action 承担目标、资格、成本和效果；SceneAction / 玩家 SceneCard 只做入口包装并引用 Action | `operation.ts` 的 `OperationActionDef`、`OperationSceneActionDef`、`OperationPlayerSceneCardDef` | 讨论是否保留复用边界，并用编辑体验隐藏不必要的跨表跳转 |
| EventRun 是独立局内状态；OperationView 是只读投影；预览与提交分开 | `src/arona-clicker/contracts/operation.ts`、`src/arona-clicker/contracts/operation-view.ts`、[[docs/docs-829/03-data-structures/operation-view]] | 改善作者 UI 不应让内容表直接成为运行态或让显示层写状态 |
| Scene 结算可合并玩家行动、物理卡牌、一次性购买和可选自动角色计划，但战斗仍走 Beat 提交 | [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] | 玩法上可以共享效果/Resolution，但是否要让作者理解两套提交类型需要讨论 |
| Character Hand 与玩家物理 Scene Deck 是不同的系统；各自有不同抽取和生命周期 | `operation.ts` 的 `StudentOperationProfileDef`、`OperationCardPoolDef`、`OperationPlayerSceneDeckDef`；`operation-runtime.md` | 应明确命名、显示和教学；不应因 UI 都叫“牌”就误导为同一资源 |
| Event 可恢复；规则由当前 Registry 重建；`resumeVersion` 由作者显式维护 | `operation-runtime.md` 的 Save/Resume 章节 | 任何字段、默认值或含义变更都需考虑旧 checkpoint 的处理策略 |
| 当前正式内容由 Carousel 与 13 地点 Strategy Park 等样例包承载；另有休整、原子场景与购买样例 | `src/arona-clicker/content/operation-samples/`、`docs/plan-work/00-index.md` | 讨论时应以真实样例覆盖能力，不只以理想化小例子估算成本 |

## 初步复杂度判断（供讨论，不是最终裁定）

### 结构上较清楚的部分

- 长期角色状态和单局事件状态分开；一次事件不会直接把临时生命、持有物或路线状态写进长期角色档案。
- Action 规则只有一个权威来源；场景按钮和卡牌复用其效果与目标合同。
- 预览、费用校验和最终提交有明确边界；Runtime 不信任 UI 传来的行动效果。
- 地图路线、地点目标、Scene 完成和 Event 结局按不同层级管理，允许表达有分支的任务。

### 作者可能觉得混乱的部分

1. **对象层级多：** Datapack、Event、Location、Scene、SceneAction、Action、Profile、Card Pool、Strategy Profile 都可能要认识。
2. **内容分散：** 一个玩家能看到的按钮和它的行动规则可能位于两个表；角色行为又由 Profile、Pool、Strategy 三处共同影响。
3. **默认和覆盖规则较多：** Location 可有隐式 `main` Scene；Scene 可以继承 Location 行动；标题和说明可以由包装覆盖；批次和完成条件又分层配置。
4. **“牌”有双义：** Character Hand 是行动候选；玩家 Scene Deck 是有实体副本的卡组。抽牌、打牌和自动选行动容易被混为一谈。
5. **相似费用并非一种钱：** PlayerCost 由 SceneAction/玩家卡/购买项使用；Actor / Team 行动成本属于战术资源；地点进入可增加 PlayerCost，离开又有限额。
6. **完成条件有多个层级：** Scene 完成不等于 Location 完成，Location 成功不等于 Event 结束；Route Gate 还会单独检查持有物。
7. **Interaction 密度高：** 固定/可选、Individual/Global、执行者政策、目标选法、群体目标、Skip、购买、M-of-N 组合起来，作者很难只凭字段名预测玩家将如何操作。

### 初步结论

现有系统不宜简单评价为“架构混乱”：Runtime 边界和状态提交相当刻意。更准确的问题是 **作者侧的概念负担与可发现性不足**。作者可以表达很多种玩法，但从零开始可能要先理解太多内部术语和跨表引用，无法自然地从一个最小地图逐渐成长到复杂玩法。

需要 SolChat 评议的是：哪些复杂度是玩法表达能力必需的，哪些可以由更好的作者工作流、模板、默认值、即时校验、可视化关系、命名和循序渐进的编辑表面吸收；是否有数据模型本身值得进一步收敛的重复语义。

## 给 SolChat 的讨论任务

请把本文作为“当前实现事实底稿”，为 Gameplay B 提出一套综合改进方案，而不是只对某个 Scene UI 或单张表提意见。方案应回答：

1. **玩家侧：** 如何让玩家理解当前地点目标、场景阶段、角色为什么能/不能做某个行动、费用如何变化以及结果如何影响路线？
2. **作者侧：** 如何从空白 Datapack 开始，在不懂全部高级概念时先做出可玩的最小地图，再逐步添加角色差异、抽取、卡牌、分支和奖励？
3. **概念收敛：** Event / Location / Scene / Action / SceneAction 的职责是否清楚？哪些定义应该聚合显示，哪些关系需要保持分离？是否有需要合并、改名或明确区分的字段？
4. **抽卡与策略：** Character Hand、Card Pool、Strategy Profile、Action priority 和 Player Scene Deck 如何分别讲清楚？现有随机抽取复杂度是否值得？如何确保配置数量与玩家可感知收益相称？
5. **一次交互：** 战斗 Beat、场景批次、购买、路线转场和终局领奖分别是何种玩家命令？可以共享哪些表述，哪些必须保持不同？
6. **错误预防：** 作者如何在试玩前发现缺少出口、无合法目标、没有角色可执行、不会增长的轨道或不可达完成条件？系统能给出什么人类可读的诊断？
7. **演进策略：** 给出分阶段方案，每阶段说明玩家/作者可观察的独立结果、依赖、保留的兼容边界、验证方式及暂缓项；不要默认一次性重写。

请区分：

- 本文核实的当前事实；
- SolChat 的设计建议；
- 需要项目负责人决定的取舍；
- 仍需本地源码、测试或试玩确认的事实。

优先给一个“最小新手路径”与一个“进阶能力路径”的对照，以及一张推荐的阶段顺序图。若建议删减功能，说明它解决了什么认知负担、失去了什么表达能力、如何处理现有内容。不要把建议写成当前已实现能力，也不要因为发现复杂度就自动产生多个互不关联的 Goal / Task。

## 裁定记录

| 待裁定问题 | SolChat 建议 | 本项目决定 | 依据 / 待验证项 |
| --- | --- | --- | --- |
| 玩法 B 的新手最小内容模型应包含哪些对象？ | 待讨论 | 未裁定 | 先以一地点、一条行动、一条结束条件为最小参照 |
| 是否需要把“简单内容”与“进阶内容”做成分层作者流程？ | 待讨论 | 未裁定 | 当前六类表和大量可选字段的学习负担 |
| Location 与 Scene 的职责、默认值和继承是否容易理解？ | 待讨论 | 未裁定 | 当前 Location 可没有显式 Scene，Run 中按内容顺序推导进度 |
| Character Hand 与玩家 Scene Deck 是否应继续保持两套系统？ | 待讨论 | 未裁定 | 当前身份、费用和生命周期不同；需同时评估学习成本与玩法收益 |
| Card Pool / Strategy Profile / Action priority 的抽取复杂度是否物有所值？ | 待讨论 | 未裁定 | 需用玩家能感知的角色差异和真实内容配置作评估 |
| SceneAction、玩家卡、PurchaseOffer 是否有一致且容易理解的操作呈现？ | 待讨论 | 未裁定 | 目前它们可合并进一条原子 Resolution，但作者合同不同 |
| 哪些改进能靠作者工具和诊断解决，哪些需要改数据模型？ | 待讨论 | 未裁定 | 需分开讨论表单/地图工作流与运行时规则合同 |
| 兼容、迁移、Save/Resume 及样例包如何演进？ | 待讨论 | 未裁定 | `resumeVersion`、稳定 ID 与现有 Datapack 引用 |

## Draft → Task 准入

- [ ] 玩法 B 的玩家体验终点和作者体验终点已裁定。
- [ ] 影响方案选择的关键事实已回到源码、测试和现行机制文档核验。
- [ ] 已区分玩家侧、内容作者侧、编辑器侧与 Runtime 侧的改进结果。
- [ ] 综合方案有清楚的阶段、依赖、非目标与兼容边界。
- [ ] 每个拟建立 Task 都有独立可验收结果、Read Set 和验证入口。
- [ ] 已写明阶段计划结束后仍暂缓的最终方向。

## 下一步

将本 Draft 的全文交给 SolChat，要求其按“给 SolChat 的讨论任务”提出综合方案。收到意见后，在本 Draft 的裁定记录中逐项记录“采纳／修改／暂缓”和依据；随后由本地协作根据事实门槛回到源码与测试核对。当前不建立实施 Task，也不将任何建议视为施工授权。

## 相关路由

- [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]]：当前玩法 B Runtime、战斗、场景、路线、存档与奖励。
- [[docs/docs-829/03-data-structures/datapack-contracts]]：Datapack 聚合与玩法 B 六类定义表。
- [[docs/docs-829/03-data-structures/operation-view]]：玩法 B 的 UI 只读投影与显示边界。
- [[docs/ai/context-packs/datapack-schema]]：Datapack、Registry 与 Schema Read Set。
- [[docs/ai/goal-workflow]]：Draft、事实核对、裁定和 Task 准入流程。
- [[docs/plan-work/00-index]]：当前计划与相关 Gameplay B 施工背景。

## 主要核实来源

- `src/data-services/contracts/datapack.ts`：六类玩法 B Datapack 表。
- `src/data-services/contracts/operation.ts`：Event、Location、Scene、Action、Actor、Profile、Strategy、Card Pool 和玩家卡组定义。
- `src/arona-clicker/contracts/operation.ts`、`operation-scene-action.ts`、`operation-resolution.ts`：EventRun、场景命令与结算数据。
- `src/arona-clicker/contracts/operation-view.ts`：供 UI 使用的只读投影。
- `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`、`gameplay-b-strategy-park.ts` 及相邻样例：当前实际打包的玩法内容。
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`：入场、规划、提交、路线、奖励和续局机制。
- `docs/docs-829/03-data-structures/datapack-contracts.md`、`docs/docs-829/03-data-structures/operation-view.md`：数据表与 UI 投影解释。
