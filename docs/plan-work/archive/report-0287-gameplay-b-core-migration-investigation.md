# Task 0287 阶段 A 报告：Gameplay B 当前链路、状态范围与迁移边界

对应 Task：[[task-0287-gameplay-b-semantic-convergence-and-minimal-loop]]  
状态：阶段 A 只读调查完成；阶段 B 行为、数据与内容合同仍待负责人审阅。  
日期：2026-10-17

> 本文记录当前源码、内容包、Runtime、UI、存档与测试中的事实，提出供阶段 B 审议的建议；不批准具体 Schema、Runtime Owner 或删除清单，也不授权施工。三个 Luna Max 子 Agent 分别完成 Datapack / Registry、Runtime / 状态 / 存档、UI / 样例 / 测试的只读核查；总控对关键链路作了交叉复核。未修改产品代码、Schema 或 Datapack 内容，未运行测试。

## 1. 调查结论

当前 Gameplay B 的实际基本单位仍是**一整段 Operation 任务**：Spot 入口启动一个 Operation Event，EventRun 持续经过多个 Location，并在 Location 完成后提交 Route。当前没有独立的 MapRun、Node 或 Encounter 内容定义；Strategy Park 虽然显示完整地图，玩家实际仍通过完成地点后的路线按钮移动。

当前实现有可靠的 Registry、单一 Run Owner、预览/提交、原子结算和 Save/Resume 机制，但玩家与作者看到的 Operation、Location、Scene、SceneAction、Profile、CardPool 等语义较多。目标迁移不能只增加一层 Map 包装：要分清地图位置、一次遭遇和长期玩家进度，并由真实 Datapack 入口驱动最小链路。

**阶段 A 支持从新的最小语义重新建模；它没有证明所有旧代码都应删除。**旧 Gameplay B 专属内容可以按 Task 的授权范围从零替换；共享世界/角色定义、通用 Registry、存档和事务能力必须逐项判断，不得与样例内容一起误删。

## 2. 当前内容与运行链路

```text
两个 Gameplay B bundle / 其他启用 Datapack
        ↓
PackManager 校验并按包顺序应用
        ↓
GameInstance → Registry 登记六类 Operation 顶层表
        ↓
RegistryOperationContentResolver 按 Event 引用组装运行内容
        ↓
Spot.operationEntry → Operation Entry / Participant Admission
        ↓
OperationRuntimeService（GameInstance 私有唯一活动 Owner）
        ↓
EventRun → OperationView 派生投影 → Operation Workspace / UI
        ↓
SaveData.operationRun 可选 checkpoint；读档时按当前 Registry 重建和校验
```

主要证据：

- Gameplay B bundles 在 `src/arona-clicker/runtime.ts:56-63, 932-963` 登记；`gameplay-b@1.0.0` 和 `gameplay-b-strategy-park@1.0.0` 是源码内的 `sourceKind: 'bundle'` 内容。新安装默认启用它们；既有包配置可能保留用户选择（`src/data-services/datapack/pack-manager.ts:223-277`）。
- `GameInstance` 按已应用数据包调用 `Registry.load()`（`src/arona-clicker/runtime-game-instance.ts:291-300`）；Registry 校验并登记各表（`src/data-services/registry/registry.ts:1327`）。Resolver 继续从 Event 解析 Locations、Actions、Profiles、CardPools 与 Strategy Profiles（`src/arona-clicker/services/registry-operation-content-resolver.ts:13-91`）。
- 玩家入口由 Spot 的 `operationEntry` 指向 Event ID。入口枚举当前 Init 中可解析的 Event，校验固定角色与准入，再调用 facade 启动 Runtime（`src/arona-clicker/services/operation-entry-service.ts:118-168`；UI 调用见 `src/ui/controller-actions-operation.ts:1142-1171`）。
- 一次 `GameInstance` 只有一个私有 `OperationRuntimeService` Owner（`src/arona-clicker/runtime-game-instance.ts:149-184`）。`RunSlot` 保持可变 Run；外部 `EventRun` snapshot 与 `OperationView` 是投影，不是并行可写 Owner（`src/arona-clicker/services/operation-runtime-service.ts:168-172, 1453-1459`）。

## 3. 当前内容定义与作者入口

| 现有对象 | 当前职责与边界 | 目标迁移提示 |
|---|---|---|
| Datapack 六张可选顶层表 | `operationEvents`、`operationLocations`、`operationActions`、`studentOperationProfiles`、`operationStrategyProfiles`、`operationCardPools`。Scene、SceneAction、RouteEdge、Objective、Outcome、Actor、Team、PurchaseOffer 等嵌在 Event 或 Location 中。 | 逐项决定哪些是目标核心、内部实现、进阶能力或 Retire；不因现有分表而保留旧作者语义。定义见 `src/data-services/contracts/datapack.ts:85-96` 与 `src/data-services/contracts/operation.ts`。生成 Schema 同样列出六表（`tools/datapack-editor/schema/engine-defs.gen.json:21`）。 |
| Operation Event | 一项关卡/任务容器：`initId`、`resumeVersion`、多个 `locationIds` 和起点，并承载 Track/Fact/HeldItem、目标、失败条件、参与者、费用、牌组、随机种子及奖励。 | 不能机械地等同于一个 Encounter；可能需要拆出 Map 内容与局部 Encounter 内容。 |
| Location / RouteEdge | Event 内地点；Location 规定 `stage: combat | scene`、本地状态/结果与动作入口；RouteEdge 指向同 Event 的另一个 Location，可使用 Event 持有物 Gate。 | Location 很接近节点，但目前包含“完成后选 Route”的任务推进语义；应按 Map Node、Edge 和可选 Encounter 拆分职责。 |
| Scene / SceneAction / Action | Scene 可隐式成为 `main`，也可显式分阶段；SceneAction 是局部可用行动入口，引用 Action 并可带范围、费用、执行者与选择规则；Action 定义目标、费用和 Effect。 | 普通 Encounter 不应被迫作者配置阶段。Action/Effect 可评估复用，入口 Offer 与结算原子需分别定性。 |
| Student Profile / CardPool / Strategy Profile | Profile 提供行为资格与若干角色规则；CardPool 提供匹配的加权候选；Strategy Profile 通过标签偏置影响候选权重；Profile priority 影响抽取后的自动计划，不等同 Tendency。 | 阶段 B 应明确新 Tendency 的唯一权威来源，把候选生成、自然准备行为、自动规划与玩家干预拆开。 |
| 玩家牌组 / PlayerCost | 真实物理 `PlayerSceneDeck` 及 Hand/Discard 是 Scene 牌区；PlayerCost 用于 SceneAction、玩家 SceneCard 和购买。Combat Intervention 目前可改角色行动/目标，但不支付 PlayerCost。 | 玩家指令、主动 Ability 和 Item 的入口、费用账户与触发时机尚需行为合同；不必强制统一数据结构。 |

Stage A 核实的路线 Gate 中 `heldItemIds` 是 EventRun 局部持有物，不是 `Datapack.items` / `PlayerState.inventory` 里的永久物品。RouteEdge 的引用也被限制在 Event 的地点范围（`src/data-services/registry/operation-content-validation.ts:626`）。

## 4. 状态 Owner 与三个生命周期范围

### 当前 Owner 图

```text
PlayerState ───────────────────────────── SaveData.playerState
  ├─ 全局与当前 Init 字段
  ├─ 角色持有 / 成长、玩家库存、长期资源
  └─ InitSnapshot 子集

GameInstance
  └─ 私有 OperationRuntimeService（唯一活动 Operation Owner）
       └─ 一个 EventRun（跨多个 Location）
            ├─ 当前 Location / Route / Location progress
            ├─ Event tracks / facts / held items
            ├─ Allies + Enemies + Team resources
            ├─ PlayerCost + 玩家物理牌区
            ├─ Character Hands / PreparedBeat / Intervention
            ├─ Resolution / route histories / RNG
            └─ SaveData.operationRun 可选 checkpoint（不是第二个活动 Owner）
```

`PlayerState` 的字段由 `src/arona-clicker/types/state.ts` 与 `PER_INIT_FIELD_SPECS` 区分为账号/全局、当前 Init 快照和运行时派生。Operation Run 不属于 `PlayerState` 或 `InitSnapshot`；主 `SaveData.operationRun` 保存可选 checkpoint（`src/arona-clicker/contracts/save-data.ts:28-29`）。读取时先清理内存 Run、恢复 PlayerState，再按当前 Registry 与 Event 的 `resumeVersion` 重建并校验（`src/arona-clicker/runtime-game-instance.ts:469-508`，`src/arona-clicker/contracts/operation-save.ts:4-18`）。

`EventRun` 现有字段把多个生命周期放在一个 Run：`currentLocationId`、`eventState`、`actorStates`、`teamStates`、`characterHands`、`playerRouteState`、`locationProgress`、`preparedBeat`、`interventionDraft`、`resolutions` 与随机状态等（`src/arona-clicker/contracts/operation.ts:213-299`）。当前“一个 Runtime Owner”清楚，但“Encounter 内局部状态”和“整局跨 Location 状态”的语义边界不完整。

### 三范围对照

| 目标状态范围 | 当前内容/状态 | 当前行为与主要风险 | Stage B 必须裁定 |
|---|---|---|---|
| **Persistent PlayerState** | AC 长期角色持有/成长、玩家库存、永久资源、世界线进度；资源还可分全局或 Init-local。 | Operation Admission 检查角色拥有/解锁；Actor HP/resources 按 Event Actor 初值创建，不直接等于 AC Character 成长状态。Operation 终局白名单资源奖励通过 `StateMutationService` 写回；Action 的 HeldItem 不自动成为背包 Item。 | Map Run 的起始阵容和初始数值如何从玩家资料读取；哪些奖励何时成为长期状态；新旧 Run 存档失效或提示策略。 |
| **Map-run-local** | 目标语义包含当前 Node、节点访问/完成进度、跨遭遇 HP、剩余 PlayerCost、临时持有物/通行证和本次地图进度。 | 当前大部分仍由一个 EventRun 保存：`currentLocationId`、`locationProgress`、Route history、PlayerCost、event tracks/facts/held items 和各 Actor/Team 状态。Route 转场保留 Actor/Team/event 状态，但重置目标 Location 的本次 Beat/batch/result，并重新生成角色 Hand、抽取玩家牌。 | 哪些角色/队伍状态跨 Encounter；临时物和 Track/Fact 是否跨节点；Map Run 结束时成功、失败、撤退、放弃的结算与清理。 |
| **Encounter-local** | 目标语义包含本遭遇敌我局部状态、行为候选、准备行动与目标、轮次、局部标记和结算历史。 | 当前没有单独 Encounter Owner。Enemy 和 Ally HP、Team resources 同样放在 Run 的 `actorStates` / `teamStates`；Character Hand、PreparedBeat、InterventionDraft 也在 EventRun，但经提交、Location 转场会被重算或清理。Beat 全局计数与 Location beatCount 并存。 | 何时创建与销毁 Encounter 状态；敌方/局部角色状态怎样初始化；当前 Round、随机流与历史是 Encounter 内还是 Map Run 内；哪些结果转入 MapRun。 |

**关键例子：**若 B 节点消耗 2 点 PlayerCost 后进入 C 休息，余额应按 Map-run-local 延续；B 的 Enemy 预备行为、目标和 Character Hand 属于 Encounter-local，不应带进 C。Map Run 中取得的通行证只属于该 Run；除非有明确奖励结算，否则不进入 AC 背包。

### 现有状态转换证据

- 一个 EventRun 从 `initialLocationId` 创建，Actor/Team、Track/Fact/HeldItem、PlayerCost、牌区与 LocationProgress 从 Event 定义初始化（`src/arona-clicker/services/operation-runtime-service.ts:373-425`）。
- Route 转场会在 detached Run 上校验完成状态、Gate 与访问次数；记录 Route history；重置目的 Location 的 Beat/batch/result；消耗/保留 Run HeldItem，扣离场/加入场 PlayerCost、抽玩家 Scene Card，重算 Character Hand 与 PreparedBeat，再一次替换 `slot.run`（`src/arona-clicker/services/operation-runtime-service.ts:2071-2085, 2157-2245`）。当前 Route 进入新地点时并不重置 Actor HP、Team resources 或 Event tracks/facts/held items。
- Terminal EventResult 保留在 Run/save 中；只有成功/部分成功白名单资源奖励经 AC Mutation 写回。`stop()` 保留 Run；GameInstance `init/reset/load/reload/dispose` 等路径会按生命周期清理或恢复 Run。
- 当前无玩家可执行的正式 Retreat/Abandon Operation 命令；失败路径主要来自 Event hard failure 或全体友方倒下。阶段 B 必须另外决定 MapRun/Encounter 的失败、撤退与可恢复状态。

## 5. Gameplay B 实际内容与“从零重建”边界

| 内容来源 | 具体现状 | 本 Task 可处置范围 / 保护边界 |
|---|---|---|
| `gameplay-b@1.0.0` bundle | Carousel 与 Atomic Scene、Purchase、Rest 等事件及一个 Spot 的多个 Operation 入口（`src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts:78-117`）。 | 其中 Gameplay B 专属 Operation 定义和入口内容可按阶段 B 清单替换/废弃；它是源码内 bundle，不是 PackManager 可移除的普通导入包。后续重建方式需替换源码内容与注册入口，不应把“Pack UI 删除 bundle”当施工手段。 |
| `gameplay-b-strategy-park@1.0.0` bundle | 独立 Event，13 Locations、25 Actions、3 Profiles、3 Strategy Profiles、7 CardPools；正式样例声明 3 个 combat / 10 个 scene 地点、20 条 Route（`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park.ts:458-475`；`tests/engine/gameplay-b-strategy-park-sample.test.ts:37-85`）。 | 其 Gameplay B 专属内容可从零重写，无需逐地点迁移。包引用 `base:init:schale_office`、`base:area:schale_main` 和 AC 角色；不能连带删除共享 Base 内容。 |
| Strategy Park UI 布局副本 | `gameplay-b-strategy-park-map.ts` 保存区域、地点标签和坐标；Workspace 静态表绘制位置，实际节点状态/路线来自 OperationView（`src/arona-clicker/content/operation-samples/gameplay-b-strategy-park-map.ts:3-61`；`src/ui/components/operation-workspace.ts:904-995`）。 | 它不是 Datapack/Registry 数据。迁移必须决定其替代或退役，不能只重写 bundle 内容却继续以旧 Event ID/静态常量绘图。 |
| Base 与通用基础能力 | Base 含 Init、Area、Spot、角色、普通背包 Item 及通用 PackManager/Registry/Resolver。两份 B bundle 的 `characters/items/inits/areas` 均为空。 | 不属于 Gameplay B 独占内容的删除授权；需要继续作为 AC 世界和角色基础，除非另有独立授权。 |
| `carousel-safety-slice` 回退 | `src/app/runtime-bootstrap.ts:13-33` 把一段 Carousel 内容直接接到 Resolver fallback，不通过普通 Datapack/Registry；不会进入正常入口 ID 列表。 | 属于 Gameplay B 专用代码旁支但不是 Datapack 表记录；阶段 B 应决定是否随旧入口退役。当前 Task 的“Datapack 从零”许可不能替代对这段代码/开发路径的处置记录。 |
| `prototypes/gameplay-b/` 独立原型 | README 说明其不导入 AC 内容、不走上述 Runtime/Registry 链路。 | 不是当前 Gameplay B Datapack 内容，也不是本次数据包重建范围的自动删除对象；若将来要处置，应另行明确范围。 |
| 用户本地导入包/旧 PackManager 快照 | 仓库代码可以确认存在可保存并恢复的 PackManager 配置，但不能从工作区检查用户机器上的导入包或本地启用快照。 | 源码调查不能承诺旧用户包全都不存在。未来迁移要在 Stage B 决定本地旧 Event ID / `resumeVersion` 不匹配时的提示、Run 失效或重置行为。 |

## 6. 旧对象到目标语义的初步迁移判定

下表是调查输入，不是已批准的迁移合同。

| 旧对象 | 目标语义映射候选 | 阶段 A 判定 |
|---|---|---|
| `OperationEvent` | 拆为 Map 及其内容/运行状态，并将其内局部遭遇分别表达为 Encounter。 | **Transform / Retire 候选。**整段 Event 混有路线图、参与者、局部 Encounter 和终局；不能一对一改名为 Map 或 Encounter。 |
| `OperationLocation` | `Node`，并可关联零个或一个 Encounter。 | **Transform。**现有 Location 同时是地点、阶段类型、动作容器、目标与结果边界。 |
| `RouteEdge` | Map `Edge`。 | **Transform / Retire。**转移能力可以复用，地点完成前置、Route ID 提交与 event-held-item Gate 是否保留需由行为合同决定。 |
| `Scene` / `SceneAction` | 常规 Encounter 的隐式阶段；特殊情况的高级 Phase；行动可用入口/Offer。 | **Internal / Advanced / Retire 候选。**不能成为普通节点遭遇的强制作者层。 |
| `OperationActionDef` / Effect / Condition | 新 Action 的可执行定义、效果、费用与受限条件。 | **Reuse / Transform 候选。**候选目标/费用/效果校验与原子结算有价值；是否复用现有契约由 B2 决定。 |
| Student Profile / CardPool / Strategy Profile | Character 合法行动资格、Tendency 候选权重及自动 planner 配置。 | **Merge / Transform / Advanced 候选。**要分开“候选合法性、倾向抽取、抽后自动选择”，禁止两个权威同时控制同一权重。 |
| `StudentSkillRule` | Profile 可引用的随机被动规则，按 Action 触发条件及概率带入额外效果；它不是玩家主动选择 Ability。 | **Advanced / Transform / Retire 候选。**不要将“自动概率触发”当作主动能力合同；若新玩法要保留，独立定义触发时机与作用域。 |
| `CombinationRule` | Location-local 的行动组合规则，依据行动标签槽位、目标关系等将多个角色行动合并/追加效果。 | **Advanced / Retire 候选。**不阻挡最小循环；不要与 Tendency、一般 Action 效果或玩家 Ability 混成一个不可读规则层。 |
| `Objective` / `Outcome` / Track / Fact / HeldItem | Node/Encounter 的 Condition、End Condition、Result 与 Run 临时状态。 | **Transform。**当前 Event 与 Location 两层条件可能并存；一次 Encounter 结果和整张 Map Run 结局需分界。 |
| `PurchaseOffer` | Shop 上可用交换行为或 Offer。 | **Reuse / Transform 候选。**当前是一次性 EventRun Scene Offer，不是通用商店定义；可用来复用费用/资源事务但不把它变成战斗。 |
| `PlayerSceneDeck` / PlayerCost | 玩家主动 SceneCard 的物理牌区、Scene 批次费用和购买费。 | **Advanced / Transform 候选。**物理卡牌牌区不属于角色 Action Hand；先定义 Ability/Item 的玩家行为，再决定是否保留为进阶来源。 |
| Actor / Team / Participant | Event 固定参战名单；Admission 解析角色并把 Event Actor 配置初值投影成 ActorState，Actor/Team resources 写入 Run。 | **Transform / Reuse 候选。**角色资格/来源与局内 HP/resources 必须分开；敌我当前状态混在同一 Run 集合中。 |
| `EventRun` / `OperationView` | MapRun/Encounter 的实际状态 Owner 与只读 View。 | **Reuse / Transform。**当前单一私有 Owner、snapshot、计划版本、事务与随机流有可复用价值；字段目前跨 Map/Encounter 生命周期混放，View 地图从 Location/Route 派生。 |
| Spot `operationEntry` / 入口 UI | Map 入口及可选的阵容准入。 | **Transform / Reuse 候选。**现有入口按 Event ID 启动；新 Map 入口可以复用受控入口和 Workspace 路由，但需变更 ID、准入、Map View/移动动作。 |

### 6.1 核心数据职责与验证入口

| 对象 | 定义 / 实际消费 | 当前写入与 Owner | 新目标迁移风险 / 验证入口 |
|---|---|---|---|
| Datapack 六张 Operation 表 | Contract 在 `src/data-services/contracts/datapack.ts:85-96` 与 `src/data-services/contracts/operation.ts`；Registry 校验登记，Resolver 组装 Event 运行内容。 | 静态 Datapack；Registry 表为加载后内容索引，不是玩家状态。 | 同步 Resolver、校验、生成 Schema/编辑器表定义和内容入口；核对 `tests/engine/registry.test.ts`、`tests/data/runtime-content-operation-references.test.ts`。 |
| Event / Location / Route | Contract：`src/data-services/contracts/operation.ts:165-350`；Entry/Resolver 找 Event 与各 Location；Route evaluator 和 Runtime 在 Location 完成时推进。 | 静态 Def 由 Pack/Registry 持有；当前地点/进度/Route history 由唯一 EventRun 写入。 | Map/Node/Encounter 可能改变 ID 与引用边界；UI/View 不能继续将 Location completion 当作移动许可。入口/路线测试：`tests/engine/gameplay-b-route-sample.test.ts`、`tests/ui/gameplay-b-strategy-park-map.test.ts`。 |
| Scene / SceneAction / Offer | Scene、Action entry、Purchase Offer 嵌入 Event/Location；Runtime 查当前隐式或显式 Scene，UI 渲染当前批次。 | 选择、费用、局部批次计数与草稿写入 EventRun；提交结果进入 Resolution。 | 普通 Encounter 不应被迫建 Scene；退役时同步 View/UI/controller，并保留必要事务能力。验证：`tests/engine/operation-scene-actions.test.ts`、`tests/engine/gameplay-b-multiscene-location.test.ts`。 |
| Action / Effect / Target / Cost | `OperationActionDef` 由 Resolver 提供；候选规划、目标校验、费用校验后转为 OperationResolution。 | 计划/干预草稿在 Run；效果通过 detached Run 规划后原子替换 Owner。 | 结算安全、合法目标和费用边界可作为复用候选，作者 Schema 是否复用要 Stage B 决定。验证：`operation-target-selection.test.ts`、`operation-resolution-planner.test.ts`、`operation-runtime-service.test.ts`。 |
| Profile / CardPool / Strategy / Hand | Admission 快照角色 Profile；candidate resolver 组合可用 Action、CardPool 条件/权重与 Strategy bias；plan preparation 排序/选取行动。 | Profile 是静态 Def 的冻结副本；Hand、PreparedBeat、InterventionDraft 是 EventRun 状态。 | Tendency 必须有单一候选权重权威；区分候选生成、自然行为抽取和无人干预的自动计划。验证：`operation-card-candidate-resolver.test.ts`、`operation-plan-preparation.test.ts`、`operation-intervention-preview.test.ts`。 |
| StudentSkillRule / CombinationRule | `StudentSkillRule` 在行动/结算规划中依 Profile 引用做概率触发；`CombinationRule` 由当前 Location 中兼容的行动组合触发。 | 规则定义随冻结内容传入 Run/Resolution 规划；不是玩家手牌，也没有玩家主动 Ability 生命周期。 | 若保留，应归为高级触发/协同规则；与新 Active Ability、Tendency 和基础 Action 分开。验证：`operation-tactical-rng.test.ts`、`operation-combination-resolver.test.ts`、`operation-resolution-planner.test.ts`。 |
| Actor / Team / Participant | Admission 将 AC 角色及 Event Actors 投影为参战 Actor；Runtime 依据初始 HP/resource、目标和 Effect 维护状态。 | `actorStates` / `teamStates` 在 EventRun，Route 转场不会重置，Operation 伤害没有自动写回长期角色状态。 | 按阵营和状态范围拆分初始来源、Encounter HP、跨遭遇 HP、Team resources。验证：`student-operation-runtime.test.ts`、`gameplay-b-event-runtime-integration.test.ts`。 |
| Objective / Outcome / Track / Fact / HeldItem | Validation/resolver 从 Event/Location 定义读取；Operation Runtime 评估 Scene/Location/Event 完成与 Route Gate。 | Track/fact/held item 与结果状态位于 Run；奖励只在明确 `claimOutcomeReward()` 时提交白名单 PlayerState 资源。 | 必须确定 Encounter End 与 Map Run End 不是同一个状态条件；临时物品不得自动进入 AC inventory。验证：`gameplay-b-route-sample.test.ts`、`gameplay-b-scene-offer-purchase.test.ts`、`gameplay-b-save-resume.test.ts`。 |
| SaveData / Resume | `SaveData.operationRun` 含 Event ID、`resumeVersion`、EventRun、EventResult；恢复重新解析 Registry 内容并校验。 | SaveData 是 checkpoint；活动 Owner 仍是 GameInstance 内的 OperationRuntimeService。 | 新 MapRun/Encounter checkpoint 需遵守已冻结的生命周期和兼容策略；移除旧 Event 可能使旧 checkpoint 被拒绝。验证：`gameplay-b-save-resume.test.ts`、`gameplay-b-event-runtime-integration.test.ts`。 |
| OperationView / UI Map / Presentation | View projector 从 EventRun + Registry 生成 Location、Route、Map node/edge 投影；Strategy Park 坐标/区域与 Carousel 文案另在 UI 常量。 | View 是只读数据；UI workspace 状态仅持 runId/临时返回上下文。 | 新内容 ID 不应再依赖事件专用静态 map/presentation 分支；迁移时同时核对 Controller、View 与 UI。验证：`operation-view-projector.test.ts`、`gameplay-b-strategy-park-map.test.ts`、`operation-workspace-view.test.ts`。 |

## 7. 可复用能力与不可直接照搬之处

| 能力 | 复用评估 |
|---|---|
| Datapack / PackManager / Registry / Resolver 的正式校验加载链 | **强复用候选。**C1a 应接入正常链路，目标语义应由实际内容定义解析，而不是额外 demo loader。Schema 与 resolver 表合同是否复用，由 Stage B 定义最小内容合同后决定。 |
| Operation Runtime 的单一 owner 写入、`runId` / `planVersion` 校验、detached plan、纯 Preview、原子 Commit、合法性/费用/目标校验 | **机制层强复用候选。**保留防止重复提交、部分扣费、过期计划与非法目标的安全能力；不要求继续让 `EventRun` 数据结构作为最终作者语义。 |
| OperationView 只读投影与 Workspace `runId` 定位 | **模式可复用。**具体字段、Location 路线 UI、样例专属静态布局不是目标合同，需要按 Map / Encounter 行为重新裁定。 |
| 确定性随机、checkpoint 结构与可校验恢复 | **条件复用。**现有随机流绑在 EventRun，需按 Encounter/MapRun 作用域决定 seed、cursor 和恢复范围。 |
| StateMutationService 白名单奖励写回 | **机制可复用。**目标仍需明确何时把 MapRun 结果变成 Persistent PlayerState；临时状态不可直接当持久奖励。 |

## 8. 真实作者链路与现有验收

已经有旧模型的正式端到端数据路径。`tests/engine/gameplay-b-authoring-workflow.test.ts` 构建一个 PackManager 编辑包，通过 Pack Configuration validate/apply/reload 后用 Registry Entry 启动同一个 Operation Event；验证坏引用拒绝 apply、保留旧 Registry 和 Run，并验证 `resumeVersion` 变化拒绝恢复旧 Run。它证明了**旧 Operation**内容链路可用，不证明新 Map/Encounter 模型可加载。

现有 UI 验证入口与地图：

- Spot Operation Entry 与角色准入：`tests/ui/gameplay-b-operation-entry-registry.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`。
- Strategy Park 只读地图和路线按钮：`tests/ui/gameplay-b-strategy-park-map.test.ts`；地图节点来自 `OperationView.map`，玩家路线操作依赖完成当前 Location。
- Operation View/View 投影：`tests/engine/operation-view-projector.test.ts`。
- EventRun、原子结算和状态保护：`tests/engine/operation-runtime-service.test.ts`、`tests/engine/gameplay-b-event-runtime-integration.test.ts`。
- 存档/续局与版本、坏 Run 拒绝：`tests/engine/gameplay-b-save-resume.test.ts`。
- 战斗/路线/Rest/Scene 内容：`tests/engine/gameplay-b-route-sample.test.ts`、`tests/engine/gameplay-b-strategy-park-virtual-play.test.ts`、`tests/ui/gameplay-b-rest-scene-ui.test.ts` 等。

现有这些测试应作为将来迁移时的回归参考，而不是要求新目标继续满足所有旧 Scene/UI 语义。阶段 C/D 要按目标玩家行为新增最小链路回归与正式 Datapack 验收。

## 9. C1a 最小 Datapack 竖切片建议

Stage A 的事实支持把 C1a 放在地图基础移动之后、Encounter 生命周期扩展之前。当前无新模型链路；若只用直接构造的对象做 C1/C2，再到 C5 才加载真实内容，Registry 引用、入口和 UI 对 Location 字段的隐式依赖会太晚暴露。

建议 C1a 仅创建：

1. 一份使用阶段 B 最小合同的真实 Gameplay B Datapack，声明 Map A/B/C、Edge A→B→C、B 上一个最简单 Encounter。
2. 走 PackManager/Registry/Resolver/游戏入口的普通内容路径；不走 `carousel-safety-slice` fallback，不直接造 Runtime fixture，不新增 demo-only loader。
3. 在正常游戏入口移动到 B，触发一个可用最简单合法动作/结束条件完成的 Encounter，再回到 Map B；UI 显示位置与触发/返回结果。
4. 让同一套 C1a 内容定义/加载/Runtime spine 供 C2 扩展，而非一次性并行 demo。

C1a 不承担战斗、敌方策略、Tendency、Character Hand、PlayerCost、Ability/Item 或完整结算；它先验证新语义可以从实际内容定义接通至玩家界面和回图。

## 10. 阶段 B 推荐议题与建议默认值

以下是总控根据事实提出的选项，不是已定合同。进入 C 施工前，负责人需确认或修改。

**负责人补充裁定（2026-10-17）：**Character Hand 与独立 Swap 是玩法 B 的核心产品交互，必须保留；不能把自然手牌简化成每轮只抽一个行为，再把 PlayerCost 作为唯一改变行动的方式。负责人已进一步冻结具体子合同：每轮最多 3 张、首张为默认 Prepared Action、每队每轮一个免费候选内 Swap / PlayerCost 覆盖槽、Hand 外 Command 每条 1 PlayerCost、成功 Commit 后才抽下一轮。其它 Map / Encounter 生命周期、Ability / Item 和内容/存档边界仍待阶段 B 收敛。

| 待确认主题 | 建议默认值 | 当前依据与需要负责人确认的边界 |
|---|---|---|
| Map / Node / Edge / Encounter 边界 | 玩家沿当前可通行相邻 Edge 移动；节点可无遭遇；进入未完成节点时触发一次当前 Encounter；完成后回到同一 Node，由玩家继续移动。 | 与 Task 0286 的探索推荐一致；地图形状/坐标不在阶段 B 预设。 |
| 旧内容处置 | `gameplay-b` 与 Strategy Park 的 Gameplay B 专属示例可按清单从零替换；保留 base 角色、世界线、通用 Item/Registry；单独审查 Strategy Park UI 常量和 fallback resolver。 | 用户已授权不为旧 Gameplay B 内容做逐条兼容；此处确认清单和非 B 边界即可，不应把“是否允许丢弃旧 B 内容”重新包装成未知问题。 |
| 状态生命周期 | Persistent PlayerState 只接收明示奖励；MapRun 保存节点进度、跨 Encounter 角色 HP、PlayerCost 和临时物；Encounter 保存敌人/局部状态、Prepared Action/Target、当前手牌/候选及 Encounter 轮次。 | 需对 resources、Team resources、Tracks/Facts、RNG、结果历史逐项作选择；一个字段只能有一个权威范围，Owner 可不与范围一一对应。 |
| Encounter 结果与失败/撤退 | Encounter 结果结算后清理 Encounter-local；成功进入 Map；失败/撤退如何结束、是否保留节点或重开应做成显式合同。 | 当前 Runtime 没有玩家撤退命令；不应默认让 `reset()` 承担玩法语义。 |
| Tendency / Draw / Hand / Prepared Action / Swap / Player Command | 每轮从当前 Encounter 合法行动中按 Tendency 加权、不放回地为角色抽出最多 3 张有限候选 Hand；Prepared Action 默认是 Hand 首张，目标可见。玩家可以独立 Swap 到 Hand 中另一候选；每队每轮只有一个覆盖槽。PlayerCost Command 用于选择 Hand 外行动，每条花费 1 点并占用同一覆盖槽。View / Preview / UI 重开 / Save-Resume 不得触发免费重抽；成功 Commit 后才进入下一轮候选生成。 | **具体 Hand / Swap / Command / Commit 值已由负责人冻结**。当前解析器默认抽 3 张（Event 可配置 1–10），加权且不放回；Hand 以 Action ID 快照保存在 Run，按确定性上下文在 Run 开始和成功结算后生成。其它敌方准备和 Map / Encounter 生命周期仍需阶段 B 定义。 |
| Ability / Item | 各自保留持有与使用语义，但最终经过共享的目标/费用校验和原子 Effect 提交；临时物品默认只在 MapRun 范围。 | 目前角色行动指令不扣 PlayerCost；Operation HeldItem 不等于 AC 普通库存。需要确认用户主动行为具体入口。 |
| 旧 Run 存档 | 新定义兼容号改变时拒绝恢复并显示明确状态；不得静默将旧 Run 解释为新 Map。需要确定是否提供重新开始入口、清理提示或一次性旧 Run 失效说明。 | 当前 checkpoint 绑定 Event ID + `resumeVersion`；旧玩法内容可丢弃，不代表 PlayerState 或用户存档可无提示丢失。 |
| C1a 顺序 | C1 地图移动后立即完成 C1a 真实 Datapack→Registry/Resolver→Map/Encounter→回图，再继续 C2 扩展和 C3/C4。 | 可以尽早验证内容语义、UI 和 Runtime 所有权可组合；旧 `gameplay-b-authoring-workflow` 只覆盖旧 Event。 |

## 11. 只读调查范围、限制与完成状态

- 三个 Luna Max 子 Agent 分别承担 Registry/Datapack、Runtime/状态/Save、UI/样例/测试的只读调查；总控复核任务与核心来源。没有子 Agent 写入文件。
- 没有运行测试或构建。测试文件名/断言是源码阅读所得，不是本轮新运行结果。
- 没有访问用户机器上的 PackManager 持久快照、真实用户导入包或生产存档；不能据此保证仓库内样例 ID 是唯一被引用的 B 内容。
- 没有裁定新 Schema、具体运行 Owner、交互 UI、状态失败/撤退策略、完整物品/Ability 合同或精确删除文件清单。
- 阶段 A 已完成。Stage B 的行为、数据生命周期、旧内容处置及旧 Run 存档合同必须由负责人审阅/确认后，才能建立正式施工 Task；本报告不授权 C 阶段改动。
