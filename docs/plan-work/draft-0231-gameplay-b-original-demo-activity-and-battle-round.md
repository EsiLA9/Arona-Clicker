# Draft：原始玩法 B Demo 的场所行动与战斗回合实装说明

状态：draft — 源码与定向测试已核对；本文是原始独立 Demo 的事实说明，不是 AC 移植版规格，也不提出新机制。

## 目标与范围

完整记录 `prototypes/gameplay-b/` 当前入口实际装配的游园会路线 Demo 中，两类可游玩的核心行为：**非战斗场所行动批次**与**战斗回合**。记录覆盖玩家能看到什么、内容如何显示、具体规则、显示反馈和输入操作，并为每项行为附带源码/测试索引。

本文所称“原始 Demo”特指 `prototypes/gameplay-b/src/main.ts` 入口创建的 `GameplayBRouteRuntime(parkGraphRouteInput)`，不指 AC 移植版，不把 Demo 早期的单线路线或 README 表格视作当前入口事实。本文只做事实记录；规则仍以当前源码和测试为准。

## 先看整体界面与推进单位

当前路线界面是左、中、右三栏。左栏持续显示我方队员卡，右栏显示当前敌方卡，中栏集中显示当前位置、路线图、当前行动、预览/选择区、事件日志与底部 Action Dock。战斗界面也采用我方—信息—敌方三栏结构。桌面 Grid 比例由 `.desk-layout` 给出；两个界面都由 `view.ts` 内不同的 mount 函数构建。

- 左栏角色卡显示角色身份、阵营/定位、HP 数值与条、ATK/DEF；战斗及路线视图还会投影可用的角色 sCost。卡牌与关系线占位时，角色卡会扩展预留区域，而不是把行动信息只塞入日志。
- 中栏的主行动按钮仍称 Click。场所模式下，一个 Click 结算一批已经选好的场所行为与玩家场景卡；战斗模式下，一个 Click 结算已经冻结的一整轮。没有实时计时，按钮文字随当前模式切换。
- 路线出口是独立的地图按钮；完成场景后需点开放出口，不是把“移动”混进场所结算 Click。出口选择本身增加路线的 Click 计数，但不是场景批次或战斗轮。
- `main.ts` 把界面命令分派给 route Runtime，并把底部 Click 接到 `runtime.click()`；因此这份说明针对真实主入口而非仅存在于测试中的单独 battle fixture。

**源码索引**：`prototypes/gameplay-b/src/main.ts:1–28`（`GameplayBRouteRuntime`、`mountRouteGameView`、命令路由与 Click handler）；`prototypes/gameplay-b/src/view.ts:1169–1202,1383–1405`（实际入口 RouteView 的左/中/右栏）；`prototypes/gameplay-b/src/view.ts:446–495,891–913`（角色卡构建与同步）；`prototypes/gameplay-b/src/style.css:24–28,66–83,129–152`（三栏、Action Dock、编辑面板和角色卡样式）。`mountBattleGameView()`（`view.ts:793–888`）是单独的战斗演示挂载函数，不是当前 Route 主入口，本 Draft 不把它的静态文案当作路线实装事实。

**交叉核对**：`prototypes/gameplay-b/tests/park-graph-route.test.ts:25–` 覆盖路线 Runtime 与场景选择；`prototypes/gameplay-b/tests/route-ui.test.ts:6–` 覆盖路线地图投影和 Cost Dock；`prototypes/gameplay-b/tests/battle-cards.test.ts:20–` 覆盖准备卡及卡牌关系投影。

## A. 非战斗场所行为

### A1. 进入场所时的玩家可见内容

路线图在中栏地点卡内，以“地面园区 / 地下设备层”分区显示节点。可折叠态突出当前位置；展开态以节点与 SVG 连线显示完整路线。当前节点高亮，到访节点显示访问次数，走过的边和当下开放出口分别使用不同状态样式；摘要文字给出已走路径、当前场景状态或等待选择出口。完成当前场景后，只有合法的开放出口按钮可以选；按钮文案同时包含出口描述、目的地点，以及是否消耗持有物。

地点卡下方显示当前节点名称/描述和行动状态。资源摘要列出 Cost、持有物、手牌张数/手牌上限、牌堆余量和已打出数量。进入地点即增加该地点配置的 Cost；路线牌组在首次入场抽 opening hand，后续每次地点进入按 `drawPerNodeEntry` 抽牌，受手牌上限和抽牌堆余量限制。进入地点、获得 Cost、抽牌、加入角色等都追加到有序的路线事件日志。

**源码索引**：`prototypes/gameplay-b/src/view.ts:1281–1318`（路线节点、分区和出口区域）；`prototypes/gameplay-b/src/view.ts:1539–1570`（`syncMapAndResources()`、高亮、资源摘要和出口按钮）；`prototypes/gameplay-b/src/view.ts:1026–1088`（地图摘要、已走边、出口描述）；`prototypes/gameplay-b/src/runtime.ts:836–925`（`getView()`、场景选择与牌组投影）；`prototypes/gameplay-b/src/runtime.ts:1048–1111`（`enterNode()`、Cost 收益、进场行为、抽牌及抽牌事件）；`prototypes/gameplay-b/src/view.ts:1345–1357,2644–2691`（路线事件日志追加）。

**交叉核对**：`prototypes/gameplay-b/tests/park-graph-route.test.ts:5–` 检查当前图有多区域、环、回退出口和持有物门禁；`prototypes/gameplay-b/tests/route-ui.test.ts:6–` 检查摘要及只呈现真实出口；`prototypes/gameplay-b/tests/route-cards.test.ts` 与 `route-runtime.test.ts` 覆盖有限牌组与 Runtime 流程。

### A2. 两种场所选择作用域

有 `sceneChoices` 的活动地点在点击结算前要求先完成行为选择。界面会明确显示当前模式、所需选择和本批总费用；选择行为会显示费用和效果/检定摘要。

- **Global**：玩家从行为按钮中为全队选择一个行为。若该行为要求角色目标，Demo 当前按钮回调按可行动队员顺序自动选一人或多名；全队目标无需额外角色 ID。一次本批只有一个共享行为选择。
- **Individual**：每名尚存 HP 的在队队员各自都必须选择一项行为。每行显示角色名、已选/待选状态、行为按钮和所选行为摘要；倒地角色不在 required actor 集合中。每个角色可选不同项，费用按所选角色行为累计。
- 行为可以再次点选改变；选择过程不是结算，Cost 尚未扣除。必要选择未齐、Cost 不足或玩家卡目标仍在草稿态时，Click 主按钮不可用。
- 不是所有非战斗地点都有 sceneChoices。有些早期/测试活动直接在一次 Click 后执行已配置活动；当前主图地点定义大多通过上述选择批次。

**源码索引**：`prototypes/gameplay-b/src/runtime.ts:875–912`（`getSceneChoiceView()` 与 required actors / ready / cost gate）；`prototypes/gameplay-b/src/runtime.ts:938–968`（`selectIndividualBehavior()` 与 `selectGlobalBehavior()` 校验）；`prototypes/gameplay-b/src/view.ts:1572–1673`（`syncSceneChoices()`、两种界面结构和选择状态）；`prototypes/gameplay-b/src/view.ts:1779–1784`（`updateAdvanceAvailability()`）；`prototypes/gameplay-b/src/content/park-graph-route.ts:46–203`（正式图上的逐地点 Global / Individual 内容配置）。

**交叉核对**：`prototypes/gameplay-b/tests/route-runtime.test.ts` 覆盖 Global/Individual 选择、必选项和费用；`prototypes/gameplay-b/tests/park-graph-route.test.ts:25–` 覆盖正式图上的推进与完成后出口选择。

### A3. 一次场所 Click 的结算顺序

当必选场所行为完成选择后，玩家可以同时选入零张或多张当前手牌里的场景卡。场景行为费用与被选卡费用合并，从玩家共享 Player Cost 扣除。卡牌的目标是全队、一人或多人；需指定目标的卡先出现选择控件并点“确认目标并选入本批”，这一步才写入待结算选择。再次点已选卡可撤销。仅卡牌的目标选择未确认，不能 Click。

结算按以下顺序发生：

1. 先计算并支付行为和已选卡的合计 Cost。
2. 解析玩家卡效果：检定加值进入本批检定；治疗立即作用于指定队员并按 HP 上限封顶；获得持有物会更新队伍持有物集合，已经持有的同一物品不会重复增加。
3. 对所选场景行为生成独立的目标快照。Individual 行为目标是选择该行为的角色；Global 行为的默认目标是全队，支持其他 target mode 时按所选目标执行。
4. 场所固定 HP 效果先执行，再为仍有效的目标各自掷配置骰。属性检定使用 `骰值 + ATK/DEF + activityTag 命中加值` 对抗难度，达到难度算成功；chance 检定按骰面结果映射内容。玩家卡的 check-bonus 加到相应角色骰值上，但骰值被封顶在该检定骰面的最大值。
5. 依结果追加个人成功/失败事件与 HP 改变量；成功的角色可取得行为配置的 successItems。个人结果为 `effect` 时，效果写到该角色；所有 HP 都受上下限约束。
6. 清除本批选择、减少剩余活动批次并追加进度事件。若全队 HP 均为 0，路线立即失败；否则最后一个批次会开始计算可用出口。

无 `sceneChoices` 的纯活动则由 `resolveActivityClick()` 对当场全队直接执行同一类固定效果/个人检定，跳过“行为选择 + 场景卡批次”步骤。场所结果依旧由 Click 后才产生，不在输入阶段预掷并泄露结果。

**源码索引**：`prototypes/gameplay-b/src/runtime.ts:970–998`（玩家场景牌选择/撤销校验）；`prototypes/gameplay-b/src/runtime.ts:1000–1014`（Click 分发及阻止未就绪批次）；`prototypes/gameplay-b/src/runtime.ts:1159–1261`（`resolveSceneChoiceClick()` 的支付、卡牌效果、检定、物品与进度）；`prototypes/gameplay-b/src/runtime.ts:1263–1292`（`resolvePlayerCard()`）；`prototypes/gameplay-b/src/runtime.ts:1294–1338`（不带场景选择的纯活动 Click）；`prototypes/gameplay-b/src/locations/activity.ts:109–168`（纯结算器：固定效果先于个人检定、结果与 partyDefeated）；`prototypes/gameplay-b/src/view.ts:1674–1733`（卡牌选择反馈、目标控件）；`prototypes/gameplay-b/src/view.ts:2626–2631`（场所 Click 文案和完成前等待状态）。

**当前正式图示例**：`node-4` 逐人搜索抽屉/控制台；`node-7` 逐人跟随标记或搜索侧廊；`node-8` 逐人检查检修面板或员工入口。`node-1/2/3/6/10/13` 配置 Global 行为。配置可参见 `prototypes/gameplay-b/src/content/park-graph-route.ts:47–203`；行为详情以这些配置及 `view.ts:1121–1146` 的摘要构造为准。

### A4. 场所的待行动与已结算表现

场景选择展开后，原活动预览暂时隐藏，替换为“本批必选行为”和“可选玩家卡”区；顶部状态显示总 Cost 及是否仍缺行为。选择内容以按钮选中态和角色行摘要显示。主动卡实例带序号，如“紧急照明 #A”；费用直接标在卡按钮上。玩家卡待选目标以确认/取消控件暂存。

没有场景选择面板时，活动预览可将每位可行动角色的检定显示为贴近角色卡的“场地探索”意图牌，并画出到当前位置的关系；固定场所效果显示成场地效果牌并关联全队。Click 结算后，个人检定结果牌关联执行角色与场地，展示骰面、属性加值/修正值及 outcome；固定/个人效果牌展示“已结算”和作用范围。此处的关系线是解释投影，不是额外操作或游戏状态。

场所卡的目标选择采用原生 select；单目标用单选，多目标用 multiple select，确认前可取消。Cost Dock 采用一个余额槽预览本次 Click 扣费；缺选择、缺目标、出口等待、余额不足或终局时不虚构 Click 后余额。已选费用在槽内表达消耗量，帮助玩家看到当前余额与预计本次扣费。

**源码索引**：`prototypes/gameplay-b/src/view.ts:211–281`（`projectRouteActivityCards()` 生成活动意图/结果/效果牌）；`prototypes/gameplay-b/src/view.ts:1121–1167`（行为、卡牌、目标摘要）；`prototypes/gameplay-b/src/view.ts:1320–1343`（地点活动/预览/选择 DOM）；`prototypes/gameplay-b/src/view.ts:1510–1516,1572–1733`（Cost Dock 与场景选择 UI）；`prototypes/gameplay-b/src/view.ts:2392–2404,2477–2527`（场景行动牌锚定于队员或场地效果区）；`prototypes/gameplay-b/src/view.ts:1040–1064`（Cost 预览状态）；`prototypes/gameplay-b/src/style.css:190–246`（路线图和场景选择样式）。

## B. 战斗回合

### B1. 每轮准备阶段：先冻结双方意图

进入战斗地点时自动建立 encounter，不额外消耗一个“进入战斗”Click。当前队伍 HP 继承自路线；本战所有队员的初始 sCost 由路线 Runtime 初始化为 2，并叠加营地的一次性入场 bonus；敌方没有 sCost。

战斗准备生成不可变的 Prepared Round：

- 每名存活学生根据自己的 AI 优先级表，按规则检查行动条件、资源成本、目标合法性与保留线，选择最高优先级可执行普通卡；没有满足项时变为“观察 / 待机”。每名倒地学生不获得普通行动。
- 存活敌人按轮次意图循环选动作；若内容定义 previous-round-damage reaction 且上一轮对该敌人造成 HP 伤害，则优先使用反应意图。敌人意图及其目标在当前准备阶段锁定。
- sCost 在第二轮及以后准备时，存活队员自动获得普通回充 +1（上限 5）；配置的下一战营地回充可从指定轮次叠加。首轮营地起始加成仅首轮适用。
- 对当轮符合条件的学生技能按队伍顺序判定。每项符合条件的技能掷一次 seed 驱动的 d4；本 Demo 触发面为 1。技能结果、免费额外行动、动作修正和卡牌配方匹配一并冻结成当前预览。未满足技能条件者不掷骰。

本轮所有信息在主 Click 之前展示。预备事实是快照：更改玩家普通卡/目标会在原快照规则下重建匹配配方，并按需要让依赖失效行动回退，但不会重新抽技能骰或多推进一轮。

**源码索引**：`prototypes/gameplay-b/src/runtime.ts:338–369,420–455`（战斗 Runtime 建立、只读投影与结算后准备下一轮）；`prototypes/gameplay-b/src/runtime.ts:1136–1157`（路线节点进入后的队伍、SCost、营地修正快照）；`prototypes/gameplay-b/src/battle/prepare.ts:96–162`（Cost、意图、AI 行动、目标及战斗技能准备）；`prototypes/gameplay-b/src/battle/skills.ts:84–113,202–244`（条件/d4 与技能准备）；`prototypes/gameplay-b/src/battle/match.ts:100–`（Prepared 行动配方匹配）；`prototypes/gameplay-b/src/model.ts:94–224`（战斗行动、目标、快照、配方与结算数据合同）。

**交叉核对**：`prototypes/gameplay-b/tests/battle-prepare.test.ts:66–` 覆盖队伍顺序、资源不足回退、目标规则、保留线和回充；`prototypes/gameplay-b/tests/skills.test.ts:44–` 覆盖符合条件才掷骰、触发率/顺序及冻结；`prototypes/gameplay-b/tests/runtime.test.ts:194–` 与 `:405–` 覆盖首轮预备及技能/配方运行时不重掷。

### B2. 战斗三栏内看到的内容

- **左侧我方值勤队**：按前排/后排分组展示角色卡、HP/HP 条、ATK/DEF 及当前回合的 sCost。
- **中央信息区**：路线标题和地点卡说明当前地点；回合状态提示当前轮号、敌方存活数和准备冻结状态。下面是事件流；战斗准备时写“敌方预告”“我方行动”“技能检定”“配方预览”，结算后追加“Click 结算”、伤害、治疗、护盾、Cost 和终局结果等行。历史记录置于可滚动区域；如果玩家已滚离末尾，新增记录不会强制把视口拉到底。
- **右侧敌方队伍**：按前排/后排显示敌方角色卡、HP/HP 条和 ATK/DEF；摘要标记存活敌人数。
- **叠放预备卡**：学生普通行动卡和触发技能卡叠在该学生角色卡上；敌方意图卡叠在敌方卡上。卡片标出标题、效果说明、sCost（或“免费 · sCost 0”）。卡片由轻微倾角/入场动画呈现。观察/待机是一张明确显示的零费用行动卡。卡片之间、卡片与人物目标、技能与被修正行动之间的关系按需显示曲线。
- **底部 Action Dock**：按钮文案为“Click · 结算第 N 轮”；终局后显示对应胜利/失败/平局，不再继续生效。

中央战斗记录与叠卡不是重复的两种玩法：记录可按序回看发生了什么，叠卡让当前行动/目标直接挂在对应角色上，关系线提供可视化的行动对象或组合关系。

**源码索引**：`prototypes/gameplay-b/src/view.ts:1189–1213,1383–1405`（路线入口真实使用的三栏 DOM 和标题/战斗区）；`prototypes/gameplay-b/src/view.ts:302–390`（`projectPreparedBattleCards()`）；`prototypes/gameplay-b/src/view.ts:750–791`（`appendPreparedRound()` 文本日志预览）；`prototypes/gameplay-b/src/view.ts:861–884,2644–2691`（准备/结算事件及实际路线日志追加、HP/sCost 更新）；`prototypes/gameplay-b/src/style.css:166–180`（牌面尺寸、类型色条与动画）；`prototypes/gameplay-b/src/view.ts:1852–1972`（卡牌、队员、目标之间的关系曲线与 hover/focus 高亮）。

**交叉核对**：`prototypes/gameplay-b/tests/battle-cards.test.ts:20–` 覆盖投影内容、牌与目标/配方关系、卡片叠放和非触发技能不显示；`prototypes/gameplay-b/tests/battle-prepare.test.ts:66–` 覆盖冻结数据；`prototypes/gameplay-b/tests/runtime.test.ts:194–` 检查首个 Click 前就有四我方/两敌方和已准备回合。

### B3. 玩家如何介入战斗准备

战斗预备卡不是手牌抽选面板，而是对 AI 已准备行动的有限修改入口。玩家可以在回合 Click 前，对仍有合法行动的存活我方队员：

1. 点击普通行动卡或聚焦后按 Enter/Space，打开“重选普通行动”面板。列表列出该角色所有普通卡与“观察 / 待机”，标出效果、sCost、不可用原因。所选卡需在本轮起始 sCost 内可支付，且必须有合法目标；选择更贵卡时以本轮起始值判断，不借用下回合回充。
2. 可直接选卡并保留已有默认目标，也可继续调整其合法目标。目标候选以角色按钮显示，所需数量/已选数量明确展示；固定目标不可取消；数量和合法目标校验失败时不可确认。
3. 当某张行动的目标组允许修改时，可从可拖拽的准备卡拖到合法角色卡。单目标、没有固定目标的组在放下时提交；复数或含固定目标的组打开目标确认面板。拖拽阈值为 6px，候选目标高亮，连线随鼠标显示；按 Escape、指针取消或窗口失焦会取消正在进行的编辑。
4. 点击可编辑的免费技能卡也可编辑其独立目标；如果技能效果已绑定某行动或某伤害效果，目标可能锁定。由此技能不是随意新增可编辑卡，而是受运行时目标组限制。
5. 修改成功后更新被冻结的我方动作并重算牌组配方。若其他行动依赖被移除的攻击/目标而变得不合法，受影响行动会回退到“观察 / 待机”并退还该行动本轮 sCost，UI 给出回退提示。AI held cost 或保留线不限制玩家手动重选，但普通卡的费用仍不能超过本轮起始 sCost。

编辑时主 Click 禁用，直至退出编辑；终局、出口等待、场景目标草稿和未确认状态也会禁用各自当前模式的 Click。点击卡片本身不会结算，点击底部结算按钮才提交整轮。

**源码索引**：`prototypes/gameplay-b/src/view.ts:2002–2015`（提示玩家点击/拖拽/技能卡编辑边界）；`prototypes/gameplay-b/src/view.ts:2027–2155`（chooser/target 面板、键盘、确认/取消和回退提示）；`prototypes/gameplay-b/src/view.ts:2170–2299`（drag / threshold / 合法目标和取消）；`prototypes/gameplay-b/src/runtime.ts:372–418`（校验编辑普通行动或技能目标）；`prototypes/gameplay-b/src/battle/player-card-edit.ts:103–154,176–305`（目标组和原子重选）；`prototypes/gameplay-b/src/runtime.ts:467–`（行动与技能耦合限制）；`prototypes/gameplay-b/src/style.css:101–110`（拖拽与合法目标高亮）。

**交叉核对**：`prototypes/gameplay-b/tests/player-card-edit.test.ts:38–` 覆盖可选卡、合法目标和 fallback；`prototypes/gameplay-b/tests/battle-cards.test.ts:20–` 覆盖拖拽阈值/多目标确认；`prototypes/gameplay-b/tests/runtime.test.ts:273–` 覆盖编辑不推进 Click/RNG/事件且原子重算依赖。

### B4. Click 结算顺序与反馈

主 Click 只结算当前 Prepared Round。Runtime 将当轮行动、敌方意图、技能和配方交给 `resolveBattleRound()`，所有结果汇总后写回。

- 结算依据准备快照；角色在该轮稍后被打倒，并不会撤销已经准备的攻击/支援行动。
- 未被配方替代的攻击，基础伤害是 `max(1, ATK − DEF)`；行动修正、临时攻击标记和技能加值叠加，结果下限为 0。固定伤害不套同一 ATK−DEF 公式。
- 护盾、治疗先聚合。对多次伤害，单个目标只用聚合盾值抵消总伤害；净 HP 结果为当前 HP + 治疗 − max(0, 伤害 − 护盾)，最终封顶于 HP 上限。超额伤害不转移给其他角色。因而同一 Click 中的治疗可以抵消本轮的致命伤。
- 配方命中时原有配对行动被替换为配置效果；中央记录写出配方、两张参与牌和替代结果。未消费的一次性攻击标记会继续保留至未来某张造成伤害的行动。
- 生还者的“观察 / 待机”在本轮结算后最多回复 1 点 sCost；其他行动支付已显示的费用。若本轮仍在战斗，下一轮自动准备并应用每轮回充/营地规则。
- 任一方存活且另一方全灭得到胜利/失败；双方同时全灭则平局。终局会清除我方 sCost。普通胜利通过路线 Runtime 完成本战场并计算开放出口；失败或平局立即终止路线。成功后地图出点不消耗额外场所行为 Click，也不自动结算下个节点的新回合。
- 下一轮准备是在当前战斗 Click 内准备，不等于继续结算，因此同一次输入不会连结两轮。

**源码索引**：`prototypes/gameplay-b/src/battle/resolve.ts:81–`（`resolveBattleRound()`）；`prototypes/gameplay-b/src/runtime.ts:420–447`（battle click 与只准备下一轮）；`prototypes/gameplay-b/src/runtime.ts:1340–1359`（路线接收战斗事件、胜利完成节点、失败/平局终止）；`prototypes/gameplay-b/src/view.ts:861–884,2621–2625`（战斗日志与 Click 状态反馈）。

**交叉核对**：`prototypes/gameplay-b/tests/battle-resolve.test.ts:31–` 明确覆盖被击中后仍执行冻结行动、治疗抵消伤害、单盾聚合、最低伤害/防御、固定目标、互殴平局和终局幂等；`prototypes/gameplay-b/tests/runtime.test.ts:194–` 覆盖一次 Click 结算已显示轮次并准备下一轮但不连结算；`:405–` 覆盖技能与配方；`prototypes/gameplay-b/tests/park-graph-route.test.ts:25–` 覆盖主图路线进出战斗。

## 当前正式内容切片（仅作机制实例）

当前主入口使用 `parkGraphRouteInput`，路线包含 13 个地点、活动地点和战斗地点，并有环/分支/持有物门禁；路线节点以 `parkGraphRouteNodes` 显式配置。活动行为包括 Global 与 Individual 两种；玩家场景卡是一套独立于学生战斗行动卡的有限牌组；战斗地点配置三场 encounter。角色行动卡和敌方行动由内容文件定义，战斗 Runtime 负责按有限规则选取、冻结与结算。

**不可误读**：`prototypes/gameplay-b/README.md:21–38,50–63` 的路线表、活动/点击合计、旧 seed 与旧完整回放描述与当前 `main.ts:2–4` 的主图入口、`park-graph-route.ts:46–254` 的 13 节点当前配置不是同一版快照。本文不据 README 统计当前主图的通关 Click 或固定 seed 回放轮数；需要这些数据时应从当前路线内容与对应 calibration/park-demo 测试重新回放。

## 事实索引：按责任查代码

| 主题 | 原始 Demo 路径与入口 | 证据位置 |
| --- | --- | --- |
| 实际主入口/命令分派 | `prototypes/gameplay-b/src/main.ts` | `1–28`：`GameplayBRouteRuntime(parkGraphRouteInput)`、界面命令与 Click |
| 活动/地点输入模型 | `prototypes/gameplay-b/src/runtime.ts` | `548–623`：节点、行为、选择模式、出点、输入类型；`875–912`：选择视图 |
| 场所行为纯解析 | `prototypes/gameplay-b/src/locations/activity.ts` | `1–63,109–168`：骰子规则、事件结果、HP Delta |
| 场所结算/持有物/牌 | `prototypes/gameplay-b/src/runtime.ts` | `970–1014,1159–1338`：选择、支付、活动解析和 Click |
| 场所 UI/预览/事件 | `prototypes/gameplay-b/src/view.ts` | `211–281,1026–1167,1169–1734,2392–2527,2555–2698` |
| 战斗数据模型 | `prototypes/gameplay-b/src/model.ts` | `94–224`：side/row、目标/效果、Prepared Round、配方与结算 |
| 自动回合准备 | `prototypes/gameplay-b/src/battle/prepare.ts` | `19–162`：Cost、AI、敌方意图、目标、冻结 |
| 玩家行动编辑 | `prototypes/gameplay-b/src/battle/player-card-edit.ts` | `6–305`：行动选择、目标分组、费用、合法性与回退 |
| 技能/配方/结算 | `prototypes/gameplay-b/src/battle/skills.ts`、`match.ts`、`resolve.ts` | `skills.ts:1–244`；`match.ts:1–`、`resolve.ts:1–` |
| 战斗 Runtime | `prototypes/gameplay-b/src/runtime.ts` | `302–546`：战斗 view、编辑、click 与下一轮准备；`1136–1157`：路线装配 encounter |
| 主图当前内容 | `prototypes/gameplay-b/src/content/park-graph-route.ts`、`first-battle.ts`、`enemies.ts`、`characters.ts` | `park-graph-route.ts:43–255`；`first-battle.ts:1–54`；`enemies.ts:1–39`；`characters.ts:1–` |
| 正式 UI 构建/表现 | `prototypes/gameplay-b/src/view.ts`、`style.css` | `view.ts:551–717,793–888,1169–2698`；`style.css:24–246` |
| 自动化校验 | `prototypes/gameplay-b/tests/` | `location-activity.test.ts`；`battle-prepare.test.ts`；`battle-resolve.test.ts`；`player-card-edit.test.ts`；`battle-cards.test.ts`；`skills.test.ts`；`route-runtime.test.ts`；`route-ui.test.ts`；`park-graph-route.test.ts`；`runtime.test.ts` |

## 范围边界

- 这篇 Draft 解释独立 Demo 的实现和玩家可见/可操作行为，不是玩法 B 在 AC 的当前实现文档；两者 API、内容装配、UI 宿主和持久化边界不同。
- 不将 UI 上的文案、README 的路线统计或测试夹具推广成通用承诺。关键规则按 Runtime/纯函数源和对应测试确认。
- 不提出 Demo 之外的新卡牌系统、地图系统、战斗系统、编辑器或泛化机制；也不在本轮改动 Runtime、界面、样例内容或测试。

## 核对结果

| 核对项 | 结果 |
| --- | --- |
| 实际入口 | 已核实为 `src/main.ts` 加载 `parkGraphRouteInput`，不是 README 所列旧单线快照 |
| 场所行为规则 | 已交叉核对 route Runtime、`resolveActivity`、界面交互和活动/路线测试 |
| 战斗回合规则 | 已交叉核对 prepare/edit/skill/match/resolve/Runtime、战斗 UI 和定向测试 |
| GALHCG | 已绑定 `acprogram` 项目；查询独立 Demo 路径及 Gameplay B 运行时概念后回源码确认；新 Draft 后续按 `concept:goal-workflow` 作为计划文档证据维护 |
| 源码改动 | 无；本 Draft 只增加计划说明并更新索引 |

## 下一步

将本文作为原始 Demo 的可追踪玩法参考。如需将其中的既有概念进一步整理为 AC 移植版 UI 内容需求，再以这份事实说明为输入单独裁定，不直接把独立 Demo 的当前细节视为 AC 的要求。

## 相关路由

[[docs/plan-work/archive/draft-0207-gameplay-b-low-cognitive-load-ui-and-core-play-acceptance]] · [[docs/plan-work/archive/draft-0209-gameplay-b-current-loop-and-identity-review]] · [[docs/plan-work/archive/draft-0212-gameplay-b-ac-native-design-roadmap]] · [[docs/ai/goal-workflow]] · [[docs/docs-829/00-INDEX]]
