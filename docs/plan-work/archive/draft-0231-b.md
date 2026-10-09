# Draft 0231-B：玩法 B 原始 Demo 内容的 AC 聊天流移植调查

状态：reviewed — 2026-10-05 完成审阅，已转制为 [[task-0232]]；以下调查正文保留为设计来源，候选项的最终采用范围以 Task 的裁定区为准，施工尚未开始。

## 2026-10-05 审阅与转制结论

- 用户确认倾向尽可能移植 Demo 的人物卡片风格，而不是下拉栏和大量选择项；Task 0232 因此包含实际卡片交互改造，不限于摘要文案。
- 保留三栏、战斗一名学生干预和整轮/整批提交；Individual 场景行动移到各自学生身份卡，Global 为中心一张全队行动卡，玩家牌独立呈现。以当前行动默认展示、替代项按需展开，避免把下拉列表简单摊成按钮墙。
- 下文中心逐人表单、是否全面卡片化等候选已由 Task 明确取舍；不把候选正文继续当作未决施工输入。
- 当前 `OperationRouteTransitionRecord` 没有与 Resolution 共同的顺序键；重复访问时不能可靠重建统一时间轴。因此结算保持有序有界记录，路线先作独立摘要；新叙事存档合同、完整原图和原战斗数值仍暂缓。
- 当前事实、交互草稿边界、三个 Patch Unit、验证与后续范围见 [[task-0232]]；本轮只完成审阅/文档转制，不声明 UI 已实现。

## 目的与范围

本文回答：在 AC 已经完成的 Gameplay B V1 重建基础上，如何把原始 `prototypes/gameplay-b/` 的非战斗场所行为和战斗回合表达出来，同时继续让中心 AC 聊天流占据主要阅读空间，并避免把原 Demo 的所有固定面板、状态栏、选择列表和卡片照搬成大量并列组件。

本文以 `draft-0231-gameplay-b-original-demo-activity-and-battle-round` 作为原始 Demo 的事实索引，以当前源码、测试和 `docs/docs-829/` 作为 AC V1 实现事实。它只做移植侧调查与候选设计；不改 Runtime/UI/测试，不把尚未裁定的候选项写成当前机制，也不扩写成 Task 或 Goal。

### 术语与基线

- **原始 Demo**：由 `prototypes/gameplay-b/src/main.ts` 实际启动的 `GameplayBRouteRuntime(parkGraphRouteInput)`，当前主图为 13 个地点的路线体验，含 Global / Individual 场所行为、独立牌组和多个战斗点。
- **AC Gameplay B V1**：独立 `gameplay-b@1.0.0` Datapack bundle、GameInstance 私有 EventRun、OperationView、窄 Operation Entry 命令和正式三栏 Operation Workspace。当前游乐园正式样例为 3 个地点的闭环切片，不等于原始 Demo 全图或完整内容移植。
- **聊天流**：此文指 Operation 三栏中的中心信息区域，使用 AC 熟悉的对话消息视觉和纵向阅读顺序；它不意味着 Runtime 必须改用通用 `ChatStream` 存状态，也不意味着所有交互都要改造成聊天按钮。

## 结论先行：移植语义，不复制 Demo 面板

建议继续使用已经裁定并实现的职责分工：

```text
左栏：学生身份卡 + 该学生的自动计划 / 玩家修订 / 战斗干预
中栏：按事件时间阅读的地点与事件信息 + 当前阶段必要操作 + 结算记录
右栏：对手身份卡 + 对手 Intent；环境/设施有独立分类
```

原 Demo 的「角色卡、准备行动卡、Intent 卡、场所效果关系」提供的是行动归属和玩家当前可读状态。AC 已把学生计划与战斗干预放到左栏身份卡、敌方 Intent 放到右栏身份卡下；这部分应继续保持卡片式归属，不要再生成一份完整的中栏计划列表或把每个人的计划逐条复制成聊天消息。中心流负责讲清楚事件推进与已发生结果；只有明确属于玩家操作的现有选择控件才留在相应阶段的中心信息区。

这条边界已由 Draft 0212 与 Task 0222 裁定，并在当前 `operation-workspace.ts` 与 View 测试中落实。本文对更细的消息形态、地点履历和当前行动控件如何逐步内嵌于流中，只提出候选方案，需要产品裁定后再进入新阶段。

## 已核实的 AC V1 实现事实

| 范围 | 当前已经实现 | 不能由此推出 |
| --- | --- | --- |
| 三栏宿主 | `renderOperationWorkspace()` 通过 `renderWorkspaceFrame()` 输出 `left/center/right` 三槽；我方、信息、敌方/设施分别占槽。 | 不等于通用 AC 聊天 UI 已切换为三栏；这是 Operation 专属 Surface。 |
| 学生和敌方卡 | 学生身份卡内含当前计划、理由与战斗行动选项；右侧 opponent 卡显示所属 Intent；environment 独立分组。测试验证 actor 归属、分类、可见内容和局部更新 identity。 | 原 Demo 的战斗卡配方、拖拽、关系 SVG、属性数值、敌方策略和布局动画没有整体移植。AC 当前合同不包含这些原型 View 对象。 |
| 中央内容 | 当前包括正式样例开场气泡、当前地点/轨道/目标卡、已揭示事实摘要、场景行动与有限玩家手牌控件、待提交批次、路线选项、终局结果、OperationResolution 消息，以及底部 PlayerCost 和阶段提交区。 | 这还不是完整历史聊天 transcript：地点内容卡与操作表单仍是独立语义区；系统没有通用聊天消息模型记录全部地点进入、玩家动作草稿和路线选择。 |
| 战术回合 | OperationView 提供冻结基础计划、有效计划、合法 Action/Target 候选、理由、阻塞原因、Resolution 历史；一次 `commitBeat()` 完成整轮并准备下一轮。UI 只允许在一个学生上做有限干预。 | 不等于已照搬原 Demo 学生 AI 优先级、资源保留线、d4 技能和 CardTag 配方规则；两侧只共享「自动准备—有限查看/修订—整轮提交」的体验骨架。 |
| 非战斗场所 | Datapack 可配置 Individual / Global、批次数、SceneAction、共享 PlayerCost、有限场景卡、路线、单持有物 Gate、Cost 进出规则。中心控件按当前 OperationView 展示和提交。 | UI 目前没有把每次选择、玩家出牌、地点转场做成有说话者、顺序和阅读历史的对话条目。 |
| 记录和存档 | EventRun 在 Run 内保存最多 32 条 Resolution；Save/Resume 恢复 EventRun checkpoint，不保存 UI 或完整规则副本。OperationView 是 detached projection。 | Resolution 有序号不等于有可无限回放的叙事日志；存档没有 `ChatEntry[]`，UI 临时输入/滚动/展示状态不属于 Run。 |
| 内容入口与展示 | 事件、地点、Action、SceneAction、玩家卡组和规则由 Datapack/Registry 供给；固定样例名称与叙述映射在 `gameplay-b-presentation.ts` 等产品表现模块。 | V1 不是任意 Gameplay B Datapack 的自动 UI：入口仍固定到夏莱办公室中的单一正式事件与固定三人阵容，展示文案映射也按当前样例 ID 硬编码，未形成完整数据驱动内容目录。 |

## 移植原则候选

以下是依据现有结构提出的候选，而非新增已批准规则。

### 1. 一个事实只选一个主要宿主

| 信息事实 | 候选主要宿主 | 避免的重复 |
| --- | --- | --- |
| 学生是谁、HP 与当前自动/修改后计划 | 左侧该学生身份卡；战斗可选行动仍在此卡内 | 不再把完整计划作为独立中栏列表或每轮重复三条计划气泡。 |
| 对手是谁、当前 Intent / 目标 | 右侧对应对手卡 | 中栏只叙述已发生的攻击和结果，不重复整张 Intent。 |
| 环境设施身份与当前意图 | 右侧独立的设施/环境分组；场景变化和影响留在中心 | 不把设施计入敌方人数；不为没有具体目标投影的设施画关系线。 |
| 当前地点、目标进度、关键轨道与已知事实 | 中心流顶端的精简当前情境摘要；具体行动和变化追加到流内 | 不在每条聊天消息中复制全套轨道；不另造全屏地图面板作为 V1 移植前提。 |
| 玩家手牌与场景行为选择 | 中心信息区域当前地点/当前阶段的操作块 | 玩家有限 SceneCard 独立于学生行动卡；不把它伪装成某名学生的自动计划。 |
| 玩家一次结算后的数值与事实结果 | 中心流中的 Resolution 记录 | 结果文字不重复未变化的身份、计划、Intent。 |
| 地点变化、路线决定、目标达到、结案 | 中心流中的短系统叙述/事件条目（提案） | 仅在确有 EventRun / OperationView 事实时叙述，不用 UI 文案推断未发生的因果。 |

### 2. 中心使用“事件时间轴 + 当前上下文”，不要把所有当前状态都聊天化

中心信息区可以视觉上像一条连续 AC 聊天流，同时保留一种低占用的当前情境区和当前可操作区：

1. **事件消息**按发生顺序呈现开场、进入新地点、揭示事实、行动结算、路线选择结果与结局。每条只表达一个新事实或玩家决定，短于说明书式大段规则。
2. **当前情境**显示当前地点、未完成目标/轨道与少量当前状态；它作为流顶端或地点切换时更新的紧凑摘要，不在每次重渲染后重复追加同样气泡。
3. **当前阶段操作块**承载此刻可以做的事情：Individual/Global 选择、有限玩家 SceneCard、战斗提交、开放路线。交互形态仍以已有命令和投影为边界，不在 Draft 阶段新增聊天指令/卡牌弹窗等交互体系。
4. **行动执行/意图的归属**继续留在人物/设施卡；中心只记录玩家决定摘要（若需要）及结算结果，摘要不得成为第二份计划 UI。

这一提案的目的，是把固定世界说明、阶段说明与关键变更按叙事顺序读出来，同时让静态状态无需占用多块常驻面板。中心流对话化是呈现方式，不应导致 Runtime 对规则状态进行文本解析，也不要求把所有 OperationView 字段都复制入日志。

### 原 Demo 固定显示项 → AC 宿主逐项映射

此表把原型界面上的固定内容逐项拆开。候选宿主不是“全部做成聊天消息”；只有发生一次、值得按时间回看的信息才候选为流条目。

| 原 Demo 固定显示项 | AC 候选宿主 | 当前 AC 实现状态 | 去重/边界 |
| --- | --- | --- | --- |
| 当前地点名称、固定场所说明、事件开场 | 开场内容可用一条中心聊天气泡；当前地点名和简短说明留在可更新的当前情境摘要；地点切换时可追加一条地点进入消息（待裁定）。 | 开场气泡与当前地点/说明卡已实现，但文案来自固定样例映射；逐地点进入的历史消息未实现。 | 不应每轮重复发同一地点说明，也不把整段活动规则作为气泡重复占据流。 |
| 完整地图、访问节点/路线图、当前开放出口 | 地图若要保留，候选为中心流上方的小型路线摘要/轨迹；当前可选择出口仍以当前阶段操作块显示；成功转场可记短消息。 | V1 只投影当前地点和 Route 选项/历史，不展示完整地图；路线按钮已实现，完整地图 UI 未实现。 | 不复制 Demo 的大地图面板；不能把未提供给 View 的完整拓扑从 UI 猜出来。 |
| PlayerCost、每次场景行为费用、有限场景手牌/抽牌堆 | 当前余额固定留在 Action Dock；Cost 和手牌实例留在中心场景阶段操作块；已完成的支付与效果进入 Resolution/事件记录。 | Action Dock Cost 槽、独立玩家手牌、费用与场景批次已实现；成本预览和提交闭环有测试。 | 余额是可变当前状态，不要每次变化都同时追加“当前余额”气泡；牌保持独立玩家牌区，不附着到学生行动卡。 |
| 战斗轮次、准备阶段/敌方存活数等轮次状态 | 当前轮次/阶段适合并入中心当前情境摘要或底部提交区；每轮结算后可新增一条短记录。 | 中心标题下当前显示 beat/地点，底部显示阶段提交状态；逐轮“准备完成”消息未实现。 | 当前轮号不必每条消息都写；不要复制一份常驻全宽战斗状态面板。 |
| 学生普通预备卡、技能卡、行动/目标关系线 | 学生当前计划和可编辑 Action 保留在左侧学生身份卡内；关系只可依据明确目标字段做局部目标提示。 | 学生计划、理由、候选行动和一名学生干预已实现；原 Demo 的技能卡样式、配方层叠、拖拽、关系 SVG 未移植。 | 不把预备卡逐张复制进中心流；不移植没有 AC DTO/规则依据的卡片或关系线。 |
| 敌方 Intent 卡与对敌方/学生/设施的连线 | Intent 附着右侧对应 opponent/环境身份卡；真实目标若由当前计划投影支持，可在所属卡内文字说明。 | 右侧身份卡与 intent 投影已实现；环境独立分组；通用关系图层未实现。 | 不生成第二份中央 Intent 清单；无目标投影时不画线、不推断受影响者。 |
| 已结算场所/战斗效果、事件日志和路线系统记录 | 中心流按 Resolution 顺序显示已发生结果；地点发现、路线转场等仅在后续投影明确支持后才追加简短事件条目。 | Resolution 聊天气泡与有界记录已实现；完整事件流、逐项 Route 进入/Cost 抽牌叙述未实现。 | 不把 Action 卡完整规则重复为结果文本；结算消息只列实际变化/重要事实，保留侧栏当前身份与计划信息。 |

因此，候选的视觉主轴是：**中心流叙述新发生的事，当前情境摘要说明现在处于什么状态，Action Dock 保持共享 Cost 与提交，左右角色卡持续承载各行动者的身份与当前行动。**是否把地点与转场历史做成可回看的新消息，以及它们是否要进入 Save/Resume，是后续独立裁定点。

### 3. 非战斗场所：保留分批选择/资源决策，精简信息重复

原 Demo 场所行动的关键体验是：到达场所、理解当前情况、按 Individual 或 Global scope 选行为、在有限 PlayerCost 内选择是否打玩家场景卡、点击一次结算整批，再根据结果处理新事实/持有物/出口。

AC 侧已有 SceneActionBatch 与 PlayerSceneCard 规则、成本统一校验、待提交草稿和原子提交。可考虑这样映射：

- 到达地点时在中心流新增一条短地点介绍；当前地点摘要同时指出行动模式、目标进度及持有物门槛的可观察提示。
- Individual / Global 操作保留在中心当前操作块中，说明本批需要谁选择、剩余批数和当前费用；选择不结算，只有提交后的 Resolution 产生结果消息。
- 玩家有限场景牌仍以 hand 实例展示，有独立身份、费用与目标输入；提交后显示它参与了哪批行动以及效果，不放进学生卡的行动计划层。
- 路线只在地点完成后显示可用出口；成功转场后追加一条短地点变更记录，消费持有物/费用/抽牌仅在真实 transition 结果可证时显示。
- 不把 Demo 中多个固定活动卡、场景效果卡、地图按钮和活动日志全部一对一翻译成中心独立 widget。保留可操作性所需的真实控件，其余作为短消息或摘要。

**需裁定的问题**：玩家具体选项是否要像 AC 对话中的结构化回应一样以气泡形式出现，还是保留 V1 的表单式操作块；地点履历需要只显示本次转场，还是允许回看小地图/已访问节点；场景卡的结算叙述要展示哪些效果细节。不能仅从“聊天流占据大多数空间”推导出必须使用哪一种交互形式。

### 4. 战斗回合：保留“看角色卡—有限干预—一次提交”，中心负责叙事与回放

原 Demo 战斗每轮有冻结的学生普通行动、技能触发、配方结果和敌方意图；玩家可修订行动/目标，再一次结算整轮。AC V1 已保留受限的计划准备与一名学生干预，但实现细节不同。

候选呈现：

- 左右角色卡继续显示当前回合所属行动/Intent 及目标；角色卡身份和计划卡形成一个归属单元。
- 中央可以出现精简的“新一轮准备完成”或阶段提示；行动选择本身不要再重复列在信息流。
- 玩家修改计划时，变化应可从对应学生卡的“自动计划 / 本回合修订”状态直接辨认；是否在中心补一条短的“已修订某学生计划”属于产品选择，若添加只写决定摘要，不复制卡牌详情。
- 点击提交后，中心依序追加本次结算摘要；详细数值只显示 Runtime/OperationView 暴露的变化，不能还原原始 Demo 未移植的公式或随机 roll。
- 下一轮的计划重新成为卡上当前状态；上一轮的结算消息留在中心历史中，形成“当前计划在侧栏、行动结果在时间轴”的互补阅读方式。

战斗呈现尤其不能把 Demo 的 4 学生/2 敌人静态 fixture、卡片动画、拖拽关系、技能 d4 结果直接写成 AC V1 通用能力。V1 样例仅以当前 Datapack/OperationView 提供的数据为准；将原 Demo 完整数值战斗重建需要独立规则核对与裁定。

### 5. 叙述来自 Runtime 事实，表现文案与规则定义分层

现有数据源可分三层理解：

1. **Datapack 规则与局内事实**：Event/Location/Action/Route/目标/卡组规则、当前 Run 状态、SceneAction 草稿与 Resolution，是判断“发生了什么”的权威源。
2. **OperationView 的 UI-safe 投影**：为界面提供 Actor 快照、计划、候选选项、目标、轨道、事实、路线、批次、卡牌与有界 Resolution。UI 不直接读 EventRun、Registry 或 mutable GameInstance。
3. **产品呈现映射**：把样例中的 ID 映射为名称、角色/动作/地点说明、开场文案与结果文本。当前主要位于 `gameplay-b-presentation.ts`、`carousel-safety-copy.ts` 以及 `operation-workspace.ts` 的常量映射。

移植新内容时，规则结果必须由 1/2 层决定；3 层负责可读性，不可成为隐含规则。若希望不同 Datapack 作者能自由定义开场、地点到达、事实发现或结案叙述，当前 AC 还没有通用事件叙事内容合同，需单独裁定叙述文案应写入 Event/Location schema、Datapack 的产品扩展表现字段，还是先仅由 Gameplay B 样例映射承载。

## 示例映射草图（提案）

下表将原始 Demo 玩家体验抽象到 AC V1 已有操作与呈现能力；右列的新增话术/自动记录仍属提案。

| 阶段 | 左 / 右栏 | 中心流中的内容 | 当前 AC 支持情况 |
| --- | --- | --- | --- |
| 事件开始 | 学生卡和对手/设施卡出现；准备计划可见 | 一次性开场气泡 + 当前地点/目标摘要 | 开场/摘要已渲染；入场历史叙事的一般数据源未建立。 |
| 战斗准备 | 学生卡带当前计划与合法干预；右栏带敌方 Intent | 仅保留轮次/阶段状态，不建立重复行动列表 | 角色卡附着已实现；阶段提示/初始牌面具体来自当前 UI。 |
| 战斗提交 | 卡片显示当前行动归属 | 新增一条结算摘要，之后显示下一轮已准备（提案） | Resolution 投影和日志已有；逐轮叙述摘要尚未标准化。 |
| Individual / Global 场景 | 身份卡继续表现角色现状 | 当前地点/目标摘要 + 当前批次选择块 + 独立玩家手牌 | 规则、投影与中心表单式控件已实现；选择记录气泡未实现。 |
| 完成地点 / 路线 | 角色卡保持身份和状态 | 完成结果 + 开放路线选择；选后显示短转场事件 | 出口显示、统一转场事实已实现；路线时间轴条目当前缺少独立记录。 |
| 事件结案 | 保留队伍身份 | 一条结局叙述、目标结果与领取奖励动作 | 终局状态、结果卡与奖励命令已实现；结局文本目前由样例展示映射提供。 |

## 当前差距与未知事实门槛

这些问题会影响后续方案，需在新 Task/Goal 之前由产品侧挑选必要项，不在本文擅自扩建。

| 问题 | 当前可确认事实 | 待裁定点 |
| --- | --- | --- |
| 聊天流是否为真实历史记录 | Operation 当前根据 View 重绘固定开场、当前状态卡和所有保存的有限 Resolution；不是 `ChatStream` 的 ChatEntry。 | 后续想要的地点到达/路线/玩家决定记录是否必须写进 EventRun checkpoint，还是可从现有 routeHistory/resolutions 派生？哪些内容应在超出历史上限后保留？ |
| 地点文本是否数据驱动 | 名称/介绍由当前 Gameplay B 样例 presentation map 提供；规则 Datapack 内有 Location 定义，但并未形成通用文学脚本字段。 | 多事件/可编辑 Datapack 是否需要原生叙事字段，以及其 schema、校验、插值与文本长度边界。 |
| 当前地图表现 | RouteView 投影提供当前 Location、出口、路线历史和访问数，不提供完整地图副本；当前 UI 显示路线选项，不显示原 Demo 那张完整地图。 | 后续要不要展示小型路线轨迹，以及是否需要从 routeHistory 构建只读迷你地图；不可把 13 个节点原图直接搬入中心。 |
| 战斗轮的细节程度 | 当前 V1 的角色计划、干预、Intent 和 Resolution 可读；操作规则见 operation-runtime。 | 要移植哪些原始 Demo 技能卡/配方/行动逻辑、是否扩展结算文本、是否增加卡片关系视觉，分别都是规则/表现决定。 |
| UI 样例泛化 | `operation-workspace.ts` 导入当前样例 ID 与文案映射；Office 入口用常量指定事件与三名学生。 | 需要扩成事件选择器、通用 presentation contract 或阵容选择 UI 的时机和范围。Task 0222 已明确这些不在 V1。 |
| 操作控件是否彻底“聊天化” | SceneAction、玩家卡、Route 按钮当前均是中心流里的独立交互区；已有命令接口。 | 是否以气泡按钮、卡片、选择条等具体形式替换，不可只为统一外观抽象通用交互框架。 |

## 建议的后续讨论切口（不是施工顺序）

为避免把可读性设计与大范围 UI/Runtime 工程绑在一起，下一轮若要裁定，可以先只回答：

1. 中心流必须新增哪几种有历史性的叙述条目（建议最多先考虑地点进入、玩家行动结果、路线转场、结局）；
2. 哪些信息继续固定显示为当前上下文摘要，哪些只在新事实发生时进流；
3. 场景选择控件与路线选择控件是否维持当前中心内嵌表单，还是只调整为更像 AC 对话回应的视觉；
4. 本阶段是否仍只针对固定游乐园示例，还是要让多事件内容由 Datapack/表现字段自描述。

若只调整当前样例的阅读排序和摘要文案，可独立形成窄 UI Task；若要新增可存档的事件叙事流水、Datapack 文本字段或完整路线图，则先明确数据 owner、Save/Resume 与 authoring 边界，再另行规划，不把这些隐藏在“聊天流优化”标题下。

## 源码与测试索引

### 原始玩法 B Demo（描述性参考）

详见 `draft-0231-gameplay-b-original-demo-activity-and-battle-round` 的逐段索引。最相关路径：

- `prototypes/gameplay-b/src/main.ts:1–28`：实际 Route Demo 入口和命令路由。
- `prototypes/gameplay-b/src/view.ts:1169–1202,1383–1405`：路线主入口三栏；`:302–390`：Prepared Battle Cards；`:750–791`：回合文字预览；`:1281–1318,1539–1734`：路线节点/场景选择/资源与场景批次 UI。
- `prototypes/gameplay-b/src/runtime.ts:875–1014,1159–1338`：Global/Individual 选择、玩家卡选择、Click 分发与场所批次结算；`:338–455`、`battle/prepare.ts:96–162`：战斗准备及 Runtime 视图；`:420–447`：整轮结算后准备下一轮。
- `prototypes/gameplay-b/src/battle/resolve.ts`、`battle/player-card-edit.ts`、`battle/skills.ts`、`battle/match.ts`：战斗规则子机制。它们说明原型实现，不是 AC 目前的规则合同。

### AC Gameplay B V1（当前实现事实）

- `src/arona-clicker/contracts/operation-view.ts:1–170`：OperationView 的目标、行动选项、SceneAction、玩家牌、路线、Actor、Resolution 和当前场景字段；`:35–38` Resolution 使用面向 UI 的投影类型，隐藏 RNG cursor/原始测量。
- `src/arona-clicker/services/operation-view-projector.ts`：EventRun 到 detached OperationView 的投影。
- `src/arona-clicker/services/operation-entry-service.ts`、`src/arona-clicker/services/operation-runtime-service.ts`：可用命令、Run owner、受控提交与有界 Resolution 历史。
- `src/arona-clicker/contracts/operation-scene-action.ts`、`operation-action.ts`、`operation.ts`：玩家场景行为、行动效果、Event/Location/Route/Run 合同。
- `src/arona-clicker/content/operation-samples/carousel-scene-action-slice.ts:50–`：当前三地点切片、Individual/Global、路线门禁、Cost 与有限玩家牌组。
- `src/arona-clicker/content/operation-samples/gameplay-b-presentation.ts`、`carousel-safety-copy.ts`：样例文案/表现 ID 映射。
- `src/ui/components/operation-workspace.ts:1–`：当前左/中/右 DOM、身份卡、场景控制、路线、结算消息和样例映射的集中位置。
- `src/ui/controller-actions-operation.ts:1–`：固定事件/阵容入口、当前 Operation 命令及错误表现。
- `src/ui/workspace/workspace-renderer.ts:35–60`：Operation route 查询 detached View 并交给 workspace。
- `tests/ui/operation-workspace-view.test.ts:1–`：三栏、角色/敌方/环境、事实、Individual/Global、玩家手牌和路线投影断言。
- `tests/ui/gameplay-b-operation-controller.test.ts:80–210`：固定入口、返回与恢复、命令操作、稳定节点/焦点和日志滚动行为。
- `tests/engine/gameplay-b-operation-sample.test.ts`、`gameplay-b-scene-action-sample.test.ts`、`gameplay-b-route-sample.test.ts`、`gameplay-b-save-resume.test.ts`：正式样例战术/场景/路线/续局覆盖。

### 规划与机制

- `docs/plan-work/archive/draft-0212-gameplay-b-ac-native-design-roadmap.md`：聊天流和角色卡的信息归属裁定，明确其它流内交互暂缓到后续大型阶段。
- `docs/plan-work/archive/task-0222-gameplay-b-packaged-event-entry-and-end-to-end-slice.md`：V1 三栏产品要求、Demo 卡牌映射、中心固定信息/Resolution 归属与 V1 范围边界。
- `docs/docs-829/03-data-structures/operation-view.md`：UI-safe projection 与读写边界。
- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`：EventRun、SceneAction、玩家卡、路线、Resolution、Save/Resume 事实。
- `docs/docs-829/06-wiki/50-ui/workspace-routing.md`：三栏 Operation Surface 和 AC 聊天流入口路由。

## 核验记录

- 原 Demo 的行为/战斗体验以 `draft-0231-gameplay-b-original-demo-activity-and-battle-round` 已完成的逐项事实说明为参照；当前设计没有把原 Demo 的完整固定组件或旧 README 路线表误当 AC 当前实现。
- AC 核对覆盖正式 V1 机制文档、OperationView 契约/投影、UI renderer、命令入口、正式 Datapack 样例和 UI/engine 定向测试；已区分数据包可配置规则与样例 UI 硬编码表现/入口。
- GALHCG：绑定项目 `acprogram` 后按 Gameplay B / Operation 概念和 `renderOperationWorkspace`、`operationRun` 源码字面量查询候选，再回到源文件/测试确认。图中 `concept:operation-event-run-runtime` 与 `concept:ui-command-to-runtime` 是实现导航候选；新增计划 Draft 归属既有 `concept:goal-workflow`。新文件证据及索引变更在落盘后复核。
- 本轮不修改 Runtime、UI、Datapack、Schema 或测试，也未提出已获准的具体产品实现。

## 相关文档

[[draft-0231-gameplay-b-original-demo-activity-and-battle-round]] · [[docs/plan-work/archive/draft-0212-gameplay-b-ac-native-design-roadmap]] · [[docs/plan-work/archive/task-0222-gameplay-b-packaged-event-entry-and-end-to-end-slice]] · [[docs/docs-829/03-data-structures/operation-view]] · [[operation-runtime]] · [[docs/docs-829/06-wiki/50-ui/workspace-routing]] · [[docs/ai/goal-workflow]]
