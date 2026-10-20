# Draft 0294：Gameplay B 三栏 UI 参考调查与第一步施工方案

状态：implemented — 第一阶段已按负责人授权施工；本文保留设计依据，实际实现与验证见 [[docs/plan-work/archive/task-0294-gameplay-b-three-column-button-ui]]。

日期：2026-10-18。

> 本文回答：如何参考玩法 B 外部普通游戏的 Talk 与顶部三栏结构，将新版 Map Workspace 改为“左我方／中信息流／右敌方与背景”，以及第一步具体改什么、如何验证。两位 Luna 子 Agent 分别核查外部布局参考和新版数据／命令／存档边界，主控回源交叉复核并汇总。

## 1. 负责人裁定与范围

以下是本轮负责人直接确定的方向，覆盖 [[docs/plan-work/archive/draft-0293-gameplay-b-old-new-entry-ui-comparison]] 中“不机械恢复角色／信息／对手栏位”的建议；0293 的入口与语义调查仍可参考。

- 游戏内采用左侧我方、中间类似外部 Talk 的信息流、右侧敌方与背景。
- 暂不移植任何卡牌结构：不做卡面、扇列、悬停卡片、关系线或拖拽；行动与目标均使用简单按钮和文本。
- 内容超出时使用内部滚动，标题与主要操作不被长内容挤出页面。
- 顶部区域参考外部普通游戏已经使用的三栏顶部分割模式，不给 Map 再设计一套标题栏。未来三栏宽度需要更丰富的支持。
- 需要起始到保存的基本页面流程，但此阶段不深入设计。

本文将“外部 Talk”解释为 Map Workspace 外的 AC 普通游戏聊天中栏，以 `center-panel.ts`、`chat.css` 和普通三栏为可核查参考；没有另外指定外部仓库或网页。将“起始页～保存页”先按 AC 现有起始／世界线选择、本地存档服务承接，独立的玩法 B 标题页、多存档槽等不属于第一步。

新版 Map、Node、Edge、Encounter、Hand、Swap、PlayerCommand、Ability、Item 和 Commit 语义保持现有合同。**取消卡牌表现不等于取消完整 Hand：所有候选仍须可见、可用按钮操作。**

## 2. 已核实的参考与差距

| 对象 | 当前依据 | 对施工的影响 |
| --- | --- | --- |
| 外部三栏顶部 | `src/ui/components/rail.ts`、`center-panel.ts:40-48`、`right-panels.ts` 经 `tabs.ts` 的 `renderPanelTabsRegion`；非页签顶部用 `renderPanelHeaderRegion` | 复用顶部宿主、主题、控件高度与底部分割线；不是只复制按钮外观 |
| 外部 Talk | `src/ui/components/center-panel.ts:75-91` 将 `.chat-stream` 与底部操作分离；`src/ui/css/chat.css:108-127` 让流独立滚动 | 借布局和文本层级，不接入剧情发送、打字门控或学生聊天历史 |
| 共享三栏 | `src/ui/components/workspace-frame.ts` 的 `renderWorkspaceFrame`、`renderWorkspaceColumn` | 保留三列 owner、Presentation host 与路由外壳；不新造另一套页面框架 |
| 现有 Map | `src/ui/components/map-workspace.ts:492-498` 当前左路线、中地点、右整个遭遇 | 必须调整内容职责，不能只给现有三列换标题 |
| Map 顶部与滚动 | `src/ui/css/map-workspace.css:1-44` 写死 22/48/30 比例，手写标题背景／底线／42px 高度，并给整列 body 加滚动 | 取消这套 Map 专用顶部规则；标题与内容滚动分离 |
| 共享宽度 | `src/ui/css/variables.css:40-42`、`layout.css:291-309` 已有 `--workspace-left-width`、`--workspace-center-width`、`--workspace-right-width` | Map 改为消费这些变量，未来沿共同入口扩展，不再写死局部比例 |
| 新版只读数据 | `src/arona-clicker/contracts/runtime.ts:303-447` 的 `MapRunWorkspaceView`；`contracts/map-run.ts` 的 Run party / partyHp | 现有投影足以显示我方、活动敌方、地点、行动候选和最近结算，不必新增 Runtime Owner |
| 信息流上限 | `actionPreview.recentCommit` 提供可读的最近结算；`view.run.lastEncounterCommit` 在 MapRun 内跨遭遇清理与移动保留，保存／恢复时也会校验重建（`contracts/map-run.ts:248-249`、`services/map-run-service.ts:1443-1515`） | 已有最近回执可以在重新进入／读档后继续显示；它不是完整逐回合历史，不另建日志存储或逐字 Talk 演出 |
| 敌方与背景 | 当前 Encounter 有敌方 ID、HP 等；Map 有 Node 标题／描述与 Edge，没有场景图、立绘或地图坐标投影 | 右侧先用文本和状态；无敌人显示空态，不复制旧 Park 坐标、Actor 或固定故事文案 |
| 局部刷新 | `src/ui/controller.ts:624-642,1792-1834` 当前将同一 Encounter 的命令收敛到右侧 `[data-map-encounter-region]` | 内容拆到三列后该刷新契约必须一起调整，否则左方行动与中间回执会滞后 |

旧 `operation-workspace.ts:589-620,1138-1235` 可参考我方／信息流／敌方背景的责任划分，但其自定义顶部与卡牌层不是本轮标准。新 Map 不导入旧 Carousel、Strategy Park、Scene 或 Event 专用渲染。

## 3. 第一步完成后玩家看到什么

**第一步结果：将当前 Map Workspace 做成可实际游玩的三栏按钮版，同时接回外部顶部结构、内部滚动与共享宽度入口。** 起始／存档先复用现有入口，不在本步新造页面体系。

| 区域 | 内容与按钮归属 |
| --- | --- |
| 左：我方 | 固定队伍姓名、可得的局内 HP／个人资源；每名角色自然准备、当前准备、当前目标、完整候选列表。候选内换牌、手牌外指令、目标选择均为按钮；明确显示选中、费用、不足原因和等待状态 |
| 中：信息流 | 当前地图／地点／遭遇的已有说明；最近一轮角色行动、目标、费用、HP／资源变化、技能／物品与敌袭回执。只呈现真实字段，无数据不编造人物对话或历史 |
| 中：底部操作区 | 共享资源／PlayerCost、共享换牌／指令槽状态；技能与物品选择、其目标与清除操作；本轮可提交状态、拒绝原因、提交按钮；手动完成遭遇的既有按钮。技能／物品仍与角色候选分开 |
| 右：敌方与背景 | 活动敌方及 HP；地图／当前 Node／Encounter 的文本背景；节点访问与完成状态、起点／出口、当前相邻地点与移动按钮、遭遇锁定原因。第一步用两段简单标题并列于同一滚动区，不先增加页签、弹层或视觉路线图 |
| 顶部 | 三列各有一个共享顶部区块，桌面下分割线对齐；中列显示精简地图标题和返回游戏按钮。较长说明移入信息流，不能靠多行副标题撑高顶部 |

左侧队伍在非遭遇期仍由 `view.run.party` 读取；有行动预览时再附上对应角色的按钮组，不因 `actionPreview === null` 就把我方清空。HP 缺失时不伪造满血。成功结果投影只含有限结果字段，不能为了凑齐三列而重建已清理的 Run；失败使用已有失败投影，终态不保留行动输入。

中栏第一步的“流”是可滚动的当前信息序列：地点说明、遭遇说明、最近一次回执。后续 Commit 更新同一最近回执区域；不在 render、hover、重新进入或读取 View 时向外部 ChatStream 追加消息。活动遭遇优先使用 `actionPreview.recentCommit` 的可读投影；它不可得时可由同一只读 `view.run.lastEncounterCommit` 显示既有回执摘要，注明原 Node 与轮次，不能误写为当前节点刚发生的事件。名称仅按已有只读查询补全，不为展示摘要增加状态或复制旧文案。最近回执在活动 Run 的保存／恢复后仍可读取；完整、可累积且可保存的逐回合行动日志属于后续独立数据需求，终态仍以实际结果投影为限。

## 4. 可施工结构与滚动归属

沿用 `renderWorkspaceFrame`。每列 `header` 经 `renderPanelHeaderRegion(ctx, 'left' | 'center' | 'right', ...)` 输出，避免只复制 `.panel-tabs-region` 类而漏掉宿主背景。Frame 自带 `.workspace-column__header` 只作结构容器，不再画第二层底线／背景或额外 padding。Map 的 active、success、failure、unavailable 四种状态都按同一顶部合同输出。

共享 shell 不自动保证纯标题与有按钮的顶部等高：三个标题内容块均使用 `min-height: var(--panel-tabs-control-height)` 并垂直居中，继承现有 30px 控件 token；不为凑高度添加无意义按钮，也不另写一个 42px 高度。长标题省略显示并保留可读的完整名称，额外说明放正文。浏览器须测量三列顶部高度和分割线 y 坐标，不能仅凭使用同一个函数宣称对齐。

```text
Map Workspace（稳定根；runId）
├─ left column / shared header：我方
│  └─ party scroll owner（稳定）：按 characterId 的队员行与按钮组
├─ center column / shared header：地图名称、返回游戏
│  └─ center pane（稳定；不滚动）
│     ├─ feed scroll owner（稳定）：地点／遭遇说明、最近结算
│     └─ action dock（稳定）：资源、技能／物品、目标、共享槽、提交／完成
│        └─ options scroll owner：过长的技能／物品／目标列表
└─ right column / shared header：敌方与背景
   └─ context scroll owner（稳定）：敌方状态、文本背景、路线与移动
```

最小新增结构职责：每列一个明确内容根，共 3 个；其中中列内容根内部再拆信息流与操作区 2 个，操作区内 1 个可滚动选项容器。优先改造现有节点承担这些职责，不为每条文字再加包装。现有 Frame、slot、header 和三列根保持复用，不增加覆盖层或全页滚动容器。

- Frame 与列 body 保持 `min-width: 0`、`min-height: 0` 和有界高度；列 body 使用 `scroll: 'none'`，由实际内容容器独立滚动，并把 `data-scroll-owner="content-region"` 放在真实滚动节点上。
- 左、右各一处主滚动；中间流独立滚动，底部提交区不随消息移走。技能／物品选项过长时在选项区滚动，不能把提交按钮顶出视口。
- 默认只滚动鼠标所在的内容区域；页面和标题栏不能随大量队员、长描述或回执一起滚走。禁止同时给同列 body 和其内容根都加 `overflow-y: auto`。
- 仅当读者原本在流底部且回执确实变化时跟随最新内容；正在读上文时保持位置。目标选择、换牌、选技能和普通重绘不强行滚到底部。
- 窄视口保持各区域可操作，允许既有响应式堆叠；不要继续以固定 `max-height: 320px` 作为唯一的内容可达方案。具体溢出与底部操作可见性必须浏览器核验。

## 5. 跨栏更新：与布局一起施工

将现有“Encounter 更新等于右侧内容替换”改成“同一命令按消费者更新”。沿用已有 Dispatcher 和一次命令的刷新收敛点，可由一个 Encounter 更新入口协调多个局部区域；不另起渲染调度器，也不把三列公共父节点当作常规替换范围。

| 触发 | 需要收敛的消费者 | 必须保留 |
| --- | --- | --- |
| 候选内换牌、手牌外指令、清除共享槽 | 相关队员的行动／目标按钮组；中栏共享槽、费用与提交状态 | 三列根、顶部、全部滚动容器、无关队员节点、背景区域 |
| 角色目标选择 | 所属队员目标组；中栏提交状态 | 当前按钮焦点与其它队员，不重绘整页 |
| 技能／物品与其目标、清除来源 | 中栏对应来源组、总费用和提交状态 | 左方队员、右方敌人、信息流节点与阅读位置 |
| 成功 Commit，仍在同一遭遇 | 左方变化的 HP／资源／准备与候选；中栏最近回执、来源与费用／提交；右方变化的敌方 HP | Run／Node 身份不变时保留 Frame、列根与各滚动 owner；回执用 requestId / resultingCommitVersion 判断变化，避免重复反馈 |
| 移动节点、遭遇结束、终态 | 协调变化的队伍、流、操作区、敌方／背景及移动状态 | 同一 Workspace 中尽可能保留三列与顶部；终态清理无效操作与锚点；不把遭遇完成误当作自动移动 |

施工时先一次读取 detached Workspace view，再将相同快照用于本次所有消费者。普通数字／文本／selected／disabled 状态优先原位 patch；候选集合确实变化时只替换角色内部按钮组，按角色与 action ID 区分身份。选项组被替换后按 `data-map-focus-key` 恢复有效焦点，原按钮仍在时保留原节点。流的“最近结算”子项允许替换，但流容器必须保持身份。

`structure` 仅用于首次进入／离开 Map、实际 Workspace 身份改变，或经验证无法恢复的根结构缺失。局部目标缺失时先补回对应列的内容根；runId／路由不符时取消过期更新并刷新当前路由，不将旧请求写到新页面。必须明确分区恢复失败后才允许 Map Workspace 级恢复，不能让每次普通 click 退回 `render()`。

替换范围前走既有 `dismissBeforeRootMutation(range)`，之后 `retainIfAnchored()`；范围外浮层保留。即使第一步没有新浮层，也不能跳过已有生命周期。Tick、scroll、hover、focus 不生成新信息流记录，不重建三栏。

## 6. 起始页与保存页：最小承接

```text
现有起始／世界线选择（可读取本地存档）
  → 普通游戏 → Spot 地图终端（开始／继续地图）
  → 新三栏 Map Workspace
  → 返回游戏（只退出界面，保留活动 Run）
  → 现有存档服务（保存／读取）
  → 读档后普通游戏 → 同一地图终端继续已恢复的 Run
```

依据：`src/ui/components/selector-page.ts` 的 `load-game-init`；`components/service-workspace.ts` 的 saves 内容与 `save-game`／`load-game`；`controller-save.ts` 的 `handleSave`／`handleLoad`；`components/map-entry.ts`；`controller-actions-operation.ts:1240-1325` 的 Map 开始、继续、移动、返回和命令委托。Map checkpoint 已在普通存档链路中，不建第二个 B 专属存档 Owner。

读档现状是返回 game service，并非直接恢复 Map 界面路由；活动 Map 从终端继续。文案与验收必须说明这一点，不承诺自动进入战斗。第一步保留简单按钮和已有本地保存反馈；不做多槽、缩略图、自动保存策略、独立 B 开始页动画或存档迁移。保存／读档不是“结束遭遇”或“离开地图”的替代命令。

## 7. 施工顺序与文件边界

以下为后续施工建议，不表示本轮已经实现，也不将整份 Task 0291／0292 标为完成。

1. **先写关键行为回归，再改三栏结构与更新边界。** 核对原按钮 `data-map-*`、draft／Commit token、View 与 Command；建立我方／流／敌方背景的断言，覆盖一次 Commit 后跨栏状态同步与节点 identity。把 `map-workspace.ts` 按三栏职责拆为局部渲染入口，调整 Controller 的局部更新，保持现有运行合同。
2. **接外部顶部、内部滚动与宽度变量。** 在三栏职责明确后移除 Map 自定义顶部绘制与固定比例；复用共享 header shell 和宽度入口，完成 long-content 的浏览器对照。不能只完成布局就宣称交互验收通过。
3. **跑通起始—地图—返回—保存—读取—继续。** 先验证已有链路；若只是缺少可发现的入口，仅补简单按钮与明确文案。需要新增路由或生命周期行为时另列具体范围，不顺手改存档系统。

首步核心修改候选：

- `src/ui/components/map-workspace.ts`：三栏内容与局部渲染、四种页面状态；简单按钮继续绑定既有命令。
- `src/ui/css/map-workspace.css`：顶部样式收敛、三列变量、内容滚动与流／操作区布局。
- `src/ui/controller.ts`：Encounter 命令跨栏消费者更新、稳定节点、焦点／滚动／浮层生命周期；移除“只右栏”的旧假设。
- `src/ui/controller-actions-operation.ts`：仅在新局部目标定位确有需要时调整 UI 委托；保留原命令语义与版本检查，不修改旧 Operation 拖拽逻辑。
- `tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts`：布局语义、真实按钮交互、跨栏更新和身份断言。
- `ui-style/patterns.md`：实现稳定后更新 Map 分栏与刷新入口；本文当前仍是提案，不提前写成现行约定。

共享 `tabs.ts`、`workspace-frame.ts`、`layout.css`、`chat.css` 为首步 Read Set，优先直接复用，不预设必须修改。若现有顶部入口确实无法承载，先说明具体缺口再作窄扩展，并运行 `tests/ui/workspace-frame.test.ts` 与命中宿主测试。未来宽度扩展在共享变量／布局契约统一处理；第一步不实现拖动分隔条、宽度偏好存档或全站所有页面的迁移。

恢复消费变量不等于修改 `variables.css` 的全局默认值。Map 将来需要加宽左右列时，在 Map 的作用域内调整三个已有宽度变量或采用共享 preset，并核对窄视口；全应用宽度配置与其它工作区顶部迁移另行实施。

不改 Map／Encounter／Save Schema、Run Owner、随机流、永久库存边界；不导入旧玩法专用地图或卡牌；不改独立 Datapack Editor、生成文件、历史快照。工作区已有大量迁移改动，施工须在当前文件之上增量处理，不回退其它任务。

## 8. 独立验收清单

- [ ] 桌面三栏语义为我方／信息流／敌方与背景；所有原有 Hand、Swap、Command、Target、Ability、Item、Commit 与手动完成操作仍可通过按钮访问。
- [ ] active、success、failure、unavailable 的三列顶部均经过共享顶部入口；主题背景与分割线只有一套，长地图名不撑坏对齐。
- [ ] 默认调查样例和合成战斗 fixture 分别验收；没有敌方、HP、背景资源或历史的数据不补造，终态不重建活动 Run。
- [ ] 多队员、长描述、多候选、长回执下内部滚动有效；标题与提交操作可达，无 body 与内容双滚动；键盘能到达所有按钮。
- [ ] Swap／Target／来源选择只更新消费者；普通交互保持三列、顶部、滚动 owner 和无关队员身份；Commit 后我方／流／敌方一致，阅读上文不被强制跳到底部。
- [ ] 切 Node、完成遭遇、成功／失败后，背景路线、按钮启禁与终态保持正确；重复／过期提交没有重复回执或副作用。
- [ ] 起始／加载、开始地图、返回游戏、保存、读取、终端继续链路明确；保存恢复不重抽、不重置当前 Node，不靠 UI 自造状态。
- [ ] Map 接受左／右宽度变量变化，中列保持可用；以普通游戏 Talk 与 Map 在同一窗口尺寸、同一主题下对照顶部和分割。至少记录桌面、较窄窗口与长内容截图／交互结果；headless 通过不能替代视觉验收。

后续实现验证入口：`tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts`；涉及保存承接时补 `tests/engine/gameplay-b-map-save-resume.test.ts`，涉及共享骨架时补 `tests/ui/workspace-frame.test.ts`；类型检查与浏览器验收按实际改动执行。结构设计先明确行为断言，不添加仅检查 class 拼写的占位测试。

本轮前序探索的实际测试基线：上述两组 Map UI 测试共 15 项通过；另跑旧 `operation-workspace-view.test.ts`，10 项通过、3 项失败（旧入口、选中状态、文案预期）。旧版不是全绿回归基线；这些失败不自动授权本轮修复旧玩法。此次文档调查未再次运行产品测试，亦未启动浏览器。

## 9. 第一阶段之后

后续再讨论完整信息流的事件来源／保留周期／存档、起始与保存页细化、共享三栏宽度设置与全站顶部收敛。卡牌表现继续暂缓，不能因旧代码已有就顺带移植。C4／C5 的内容作者链路、Rest／Shop／Branch 与旧内容退役仍由原 Task 管理，本 UI 方案不替代其验收。

相关路由：[[docs/plan-work/archive/draft-0293-gameplay-b-old-new-entry-ui-comparison]]、[[docs/plan-work/archive/task-0291-gameplay-b-hp-enemy-ability-item]]、[[docs/plan-work/archive/task-0292-gameplay-b-c5-authoring-and-retirement]]、[[docs/ai/frontend-design-project-overlay]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]、[[ui-style/00-index]]。
