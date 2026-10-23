# UI 复用模式 — 组件、布局与内容

> 本文回答：已有页面从哪些组件和内容入口组合。范围为 ACProgram 游戏 UI；入口已核对源码，用法作为复用约定，不复制渲染函数、机制正文或完整 DOM 树。

## 复用模式

区域地图交通沿用 `area-map-workspace.ts` 的节点和详情区：当前区域通过主题色实心节点标记，详情显示到访状态，固定动作区区分普通前往、乘交通前往与快速返回。`area-map-dom.ts` 按节点身份原位更新；连线只显示领域中的真实连接，单向通路使用箭头；地图不授予通行资格。此为现有地图组件的扩展，行为覆盖见 `tests/ui/area-map-controller.test.ts`。

| 模式 | 入口 / 已有例子 | 用途与例外 |
| --- | --- | --- |
| 工作区骨架 | `src/ui/components/shared/workspace-frame.ts` 的 `renderWorkspaceFrame` / `renderWorkspaceColumn`；`src/ui/components/character/contacts-workspace.ts` 与 `src/ui/components/inventory/inventory-workspace.ts` | 复用列宿主、surface、布局与滚动归属，按业务配置内容，不另手写相似外框 |
| 经典游戏右栏 | `src/ui/components/shared/right-panels.ts`；几何对齐由 `src/ui/presentation/presentation-service.ts` 的 `renderPresentationHostGeometryStyle` 提供 | 顶部 switch 在资源条之前；资源条只出现在“设施”和“强化”页签；经典面板外框使用与背景层一致的圆角值 |
| 区域 Workspace | `src/ui/components/world/area-workspace.ts`、`src/ui/workspace/workspace-router.ts`；area-hero 由 `src/ui/components/shared/rail.ts` 进入 | 独立路由携带 Area ID；左栏保留区域导航，中栏显示区域概览与可滚动的待接取 ActiveStoryEntry 列表，右栏显示区域详情占位；主题 panel surface 与宿主圆角沿用 WorkspaceFrame。点击接取经 GameCommands 启动，成功后返回一般 Game chat 并切到 Entry owner；当前 Area 改变时退出旧 Area 路由。行为覆盖见 `tests/ui/workspace-lifecycle.test.ts` |
| 选择页节点图谱 | `src/ui/components/navigation/selector-graph.ts`、`src/ui/navigation/selector-page.ts`、`src/ui/css/selectors.css` | 顶栏保留在最上层；SVG 轴测平面铺满选择页背景，不套画布卡片框；右侧独立浮动工作台承载详情与命令；比例尺固定在图面左下角，进入子图时提供较大的返回按钮，不额外显示状态图例。节点用 `g[role=button]`，位置 / 连线只作呈现；可见性、拥有、价格与动作仍来自 RevealStage、`UIContext` 与 GameCommands。比例尺 / 滚轮锚定缩放只改相机，购买后原位刷新节点与工作台，不整页重建 |
| 内容工具三栏 | `src/ui/components/shared/workspace-frame.ts` 的纯布局 `renderWorkspaceLayout`、`src/ui/runtime-editor/codex/workspace.ts` 的 `renderContentWorkspace`；超级图鉴实际使用 | 把已渲染的导航／条目／详情作为 Frame 直接子项；使用 `pane-switch` 窄屏显隐。该入口不创建游戏列 Host、surface 或 Presentation host；工具自己拥有表面和滚动区。可选操作 footer 仅在有内容时出现，当前图鉴不挂载。搜索留在固定区域，条目与详情各自拥有内容滚动；现有编辑器尚未迁入新骨架 |
| Tabs 与顶部区域 | `src/ui/components/shared/tabs.ts` 的 `renderTabs`、`renderPanelTabsRegion`、`renderPanelHeaderRegion` | 保持顶部宿主、主题状态与标题区域一致，不只复制按钮 class 而漏掉宿主元数据 |
| 工作区返回标题 | `src/ui/components/shared/workspace-titlebar.ts` 的 `renderWorkspaceTitlebar`；Contacts / Story 使用 | 复用支持的 panel 与返回动作；新增业务动作需窄扩展，不伪装成已有动作 |
| 同类 Mini card | `src/ui/css/cards.css` 的 `.mini-card` 与 `--card-*` | 继承视觉规则；业务渲染与内容来源由目标组件负责，没有宣称存在通用卡片渲染器 |
| Operation 手牌扇列 | `src/ui/components/operation/operation-workspace.ts` 的 `.operation-card-fan` 持有区；悬停展示由 `src/ui/presentation/operation-card-hover-overlay.ts` 承担 | 公共手牌、角色持有牌与场景行动候选共用横向交叠；卡面在独立顶层副本中显示抬高、焦点与光晕，原卡继续承接点击和拖拽。固定锚定的预备行动／敌方意图卡与购买项列表保留各自布局 |
| Spot 行动入口按钮 | `src/ui/components/operation/operation-entry.ts` 的 `renderOperationSpotFunctions`，由 `production.ts` 组合 | 沿用 `.mini-action` 和 `card.action` 主题宿主；同一 `operationEntry` 类型每按钮绑定一个关卡，放在设施操作组内，不插入聊天流。准入与继续状态从领域查询取得；已核对源码与定向测试 |
| Map / Encounter Run Workspace | `workspace-router.ts` 的 `map` runId 路由、`src/ui/components/map/map-workspace.ts`、`workspace-frame.ts` 与 `tabs.ts` | 左我方身份／HP／角色行动按钮，中 Node／Encounter 说明与最近结算文本流及固定操作区，右活动敌方／背景／节点进度；相邻地点移动选项在中部 Talklet 内按需出现。Node / Event 顶部操作组提供地图查看、重新游戏与放弃游戏：重新游戏以同一准入队伍从地图起点建立全新 MapRun；放弃游戏清除活动 MapRun 并返回进入前的位置，两者不回滚已写入的长期档案变化。三列顶部经 `renderPanelHeaderRegion` 复用统一宿主、控件高度与分割；消费共享三列宽度变量。实际滚动 owner 是 `data-map-region-key` 为 `party-scroll`、`talk-feed`、`action-options`、`context-scroll` 的内容区，窄屏另由 Map 根承接堆叠结构滚动。`UIController.refreshMapWorkspaceRegion()` 使用一份 detached View，经 `workspace/map-dom-updates.ts` 按语义 key 协调变化的消费者，保留 Frame、列根、顶部、滚动容器和有效按钮；缺失子区局部补回，只有 Map 根缺失等恢复失败才回退当前路由。命令继续由 `controller-actions-operation.ts` 一次性事件委托进入 GameCommands；只处理可视卡牌与反馈，不新增领域卡实例、完整历史日志或 UI 自有 Run 状态。行为与连续性由 Map Workspace、vertical-slice 和 map-dom-updates 测试覆盖 |
| MapEntry 行前／续行准备页 | `src/ui/components/map/map-entry-workspace.ts`、`workspace-router.ts`、`workspace-frame.ts` | route-only `map-entry` 复用三栏 WorkspaceFrame：中栏承载地图简介、提示、当前进度和明确的开始／继续操作；右栏固定显示队伍与局内资源；左栏保留游戏区域导航。复用 titlebar、panel surface、主题宿主与内容滚动区；不在准备页混入完整现场战斗操作或玩家选队。资料来自 MapEntryView，局部变更按稳定语义 key 保留 Frame、滚动和焦点；机制见 [[docs/docs-829/06-wiki/50-ui/refresh-update]]。桌面浏览器已核验有效队伍 fresh、受伤续行、缺员／Story 门控、重开／放弃管理、终局及隔离 Origin 刷新读档后重入续行。 |
| 宿主与实体表现 | `src/ui/presentation/presentation-service.ts` 的 `renderUIHost`；`src/ui/components/presentation/entity-presentation.ts` 与 `src/ui/runtime/context.ts` 的查询 | 经只读上下文解析适用表现，不自行拼接全套主题规则或绕过实体揭示条件 |
| 弹窗与提示层 | `src/ui/interaction/modal.ts`、`src/ui/interaction/popovers.ts`；`src/ui/css/modal.css`、`src/ui/css/popover.css` | 先查共享生命周期、锚点与焦点处理入口，再扩展内容，不复制独立浮层管理系统 |

Map 的相邻地点选择由类型化 `FlowMapLocations` 投影到标准 Talklet。Talklet 只提供一个静态卡牌落点宿主；`renderMapActionCardButton()` 共用角色当前行动卡与 Flow 地点选择卡的卡面骨架，地点卡保持 82×58 固定尺寸，并按宿主的左右对齐、间距配置排列。卡片角度从稳定实例身份派生，刷新不会改变。宿主 / 插槽通过 `mapCardHostAttributes()` 与 `mapCardAttachmentAttributes()` 静态表达。地点卡只提供 `selectLocation` 入口，通过点击或键盘选中，再由 Map Workspace 统一 Click 按钮调用 Controller 和现有 MapRun 移动命令；空选择时该按钮阻塞。地点卡不提供卡牌目标或目标编辑入口。静态 DOM 附着、Hover 状态与作用关系保持为不同信息。当前地点与路线状态来自 Map View；锁定边不可选。遭遇或活动阻挡期间不显示；成功移动后回收旧选择条目并留下斜体旁白“从……移动到了……”。待选项只在当前 Workspace 交互会话中保留，不进入存档或历史。

Map Encounter 的按钮版将角色 Target／完整候选保留左栏，Ability／Item 草稿、共享覆盖槽与 Commit 放中栏底部，敌方 HP 在右栏。Action 声明 `additionalTarget` 时，Party Prepared 与当前选定的 Ability／Item 在 primary 组后增加独立“额外目标”按钮组；选择、清除和回显仍来自 MapRun Draft，按钮命令按当前来源分别写入，不覆盖 primary。该显式选择使用普通 DOM 委托，不扩展 map relation 拖放或关系高亮。`[data-map-encounter-region]` 仅作敌方信息锚点，不再代表整个遭遇的刷新边界；普通命令按消费者原位协调，保留 `data-map-focus-key` 控件、各滚动 owner 与范围外浮层。替换或移除节点前执行范围内浮层生命周期。最近回执来自 `actionPreview.recentCommit` 或同一只读 Run 的 `lastEncounterCommit`，按 requestId 标识更新；读者已在流底部时跟随新回执，阅读上文时保留位置。AG-1 的 Preview Dock 与最近回执 Feed 直接显示 ReadModel 的 `executionSequence` 来源顺序、目标、skip 和实际账本结果；E1 继续显示旧分组结果。卡牌目标按完整 CardRef scope 从当前只读卡牌视图解析名称，历史不可解析时显示通用“卡牌目标”。失败／成功按实际终态投影显示只读结果，不重建已清理的 Run。机制边界见 [[docs/docs-829/06-wiki/50-ui/refresh-update]]。

当前 Encounter 单位卡在原有 HP／sCost 数值区内，仅当只读 `MapEncounterQueryView` 投影的 Shield 大于 0 时增加独立 Shield 数值行；最近 Commit 回执按 `shieldTrace` 顺序呈现每笔 Shield grant 与受击吸收／剩余伤害，数据只来自只读 ReadModel，不从 HP 或 Status 推导。一次性受击保护沿用 Effect Trace 的原有位置，在同一行显示目标、Status 来源与 Action、层数变化和拦截量，并明确标出 HP 不变、Shield 未消耗。Status 自然到期回馈沿用同一 Talk Feed，在 Action Trigger 后按独立 `statusExpiryTriggerTrace` 显示 Status、持有者、应用来源、到期前剩余时长及局内资源余额变化，不伪造 Action/Card 来源或新增容器。实现入口为 `src/arona-clicker/runtime/runtime-game-instance.ts` 与 `src/ui/flow/map-flow-model.ts`；投影和保存回执均由 `tests/ui/map-flow-adapter.test.ts` 覆盖。此扩展不增加 Workspace wrapper、CSS 或滚动区。

CardRef Modifier 目标复用同一 keyed 目标按钮组：Runtime 只投影另一个 Party Owner 当前实际 Prepared 且 AG-1 顺序严格后于来源的 damage/heal 卡，按钮内显示目标 Action 名与 `伤害/治疗 ±delta`。候选来源于 `actionPreview.preparedActions[].legalTargetCards` 与 `cardEffectModifierPreviews`，Draft/选择仍由 MapRun Owner 持有；CardRef 失效时拒绝原选择并要求重选，不按 Action ID 替换实例。复用入口：`src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts`、`src/arona-clicker/runtime/runtime-game-instance.ts`、`src/ui/components/map/map-workspace.ts`、`tests/ui/gameplay-b-map-workspace.test.ts`；此扩展未增加 Workspace wrapper 或 CSS。

## 内容与结构

区域导航图复用游戏三栏 Frame/Titlebar 和左侧真实 Area rail；中栏为平面 SVG 节点画布，右栏为独立详情滚动区与操作反馈。point/landmark/portal 仅区分外观，选中/Focus 用既有 cyan 与主题文字色，行为来自领域脱敏投影。复用入口：src/ui/components/map/area-map-workspace.ts、src/ui/css/area-map.css；当前状态为已实现并经桌面浏览器验收。稳定节点/刷新与会话语义见 [[docs/docs-829/04-mechanisms/arona-clicker/area-map-navigation]]；不复制 Init/GlobalEnh 的母子图层级。

选择页右侧详情通过稳定的收起／展开按钮切换 `hidden` 与 `aria-expanded`，不替换工作台、滚动容器或画布。Init 的进入 CTA 先打开左侧世界线概览中转页（`renderInitOverview`），隐藏星图与右侧详情，保留顶栏、相机、子图历史和选中项；背景沿用 Init 投影，不叠加恢复区域的 Area 背景。概览只读取当前 View 或对应 Init 快照，确认进入才调用既有新建／恢复命令；返回星图或 Escape 恢复原按钮焦点与原画布。从世界线的结束游戏或硬重置入口离开时，也先停留在刚离开的 Init 概览；玩家主动返回星图后再展开节点图，排队的页面刷新保留该停留状态。该状态只由 `SelectorPage` 持有，不进入存档。复用与行为入口：`src/ui/components/world/init-select.ts`、`src/ui/controller/controller-panels.ts`、`tests/ui/controller-init-select.test.ts`、`tests/ui/selector-graph-navigation.test.ts`。

选择页图间导航由 `src/ui/navigation/selector-graph-transition.ts` 在同一 SVG 中暂存新旧 world 与过渡图层，保留顶栏、画布与工作台外壳。Portal 显示母图星座时，进入按“图收成真实星座 → 沿跨图曲线绘线 → 展开子图”呈现；返回先沿曲线反向绘线，再由 Portal 比例、关联星点和两端相机推导共同的空间变换，让母图星座恢复完整母图布局，原子图的节点、边、高程与网格同步放大并可移出屏幕。原子图围绕关联星点额外扩张至三倍，逐渐失焦并在后段淡出，母图完全恢复后再整体回收；连线持续跟随关联端点，节点与高程投影的渲染尺寸最多为原尺寸的 1.5 倍。进入约 1.3 秒、返回约 1.4 秒，线抵达后才切换详情。绘线遵守 Portal 的独立开关，无星座时使用放慢的节点过渡；初次进入按图与星座的实际范围取景。节点聚焦及导航抵达的背景交接由 `src/ui/presentation/selector-scene-background.ts` 承担：保留不透明旧底，只淡入新层；快速切换冻结当前合成画面，图片就绪后交接，完成后复用已加载的新层并回收旧层。沿用原有主题与约 420ms 背景淡入，不新增装饰。行为证明入口：`tests/ui/selector-graph-navigation.test.ts`、`tests/ui/selector-scene-background.test.ts`。

Map 的单位关系检查使用 `src/ui/workspace/map-relation-presentation.ts` 与 `map-relation-interaction.ts`，只消费 Runtime 的 `relations`。当前已验证的单位阶段：来源牌上浮与发起标记、选中单位的中性包围框 / 目标角标、弱虚线合法候选；自身可以叠加发起与目标标记。单位与牌面保持原节点，角色只是属性补丁，不按敌我或效果正负决定受用角色。

当前牌点击继续展开右侧替换浮层；候选是既有 Swap / PlayerCommand 的展示，不是第二套 Hand 或独立战斗卡。独立“固定作用关系”与“修改目标”入口避免同一次点击同时换牌和确认目标。Hover / Focus / 候选预览不写领域状态；单位或真实卡牌的点击 / 键盘 / 拖拽确认走 MapRun 草稿命令，只有显式提交才结算。真实卡牌的当前牌、Hand 展示与目标选择代理共享 Owner object key；代理仅选择受用牌，不换牌、不创建实例，未选 Command offer 无卡实例身份。进入目标编辑先关闭替换浮层，再安装编辑状态，避免关闭动作误选目标。目标编辑 / 拖拽优先于替换浮层、固定、普通 Hover / Focus；未知敌方目标只提示未知。sCost 显示实际余额；本轮减免按所选卡实际执行计算。同角色卡牌只高亮。Flow 独立玩法卡、保留的相对规则与作用线仍属 [[docs/plan-work/task-0298-gameplay-b-relations-hover-and-target-interaction]] 后续范围。

- 内容来源：通过 `UIContext` / `GameView` / 只读查询取得名称、描述、数值与状态，优先沿用目标页面的格式化方式；读写边界见 [[docs/docs-829/06-wiki/50-ui/read-model-context]]。
- 结构依据：完整游戏工作区通过 `renderWorkspaceFrame()` 和 `WorkspaceColumnSpec` 声明 `hostId`、`workspaceOwner`、`surface` 与 `scroll`；纯布局入口接收预渲染列，不提供这些 Host 语义。按入口选择机制，不把游戏 Host 结构机械套到内容工具。
- 路由与更新边界见 [[docs/docs-829/06-wiki/50-ui/workspace-routing]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]。

结构验证入口：`tests/ui/workspace-frame.test.ts` 覆盖 Frame、列身份和顶部区域组合。浮层、状态与目标页面测试按改动选择。本表只覆盖已核对入口，不表示所有业务页面都共用一个组件。


超级图鉴的中文分类与类型标签由 `src/ui/runtime-editor/codex/content-labels.ts` 提供；名称、说明、关系与可靠来源来自只读内容查询。主路径为资料／被引用，完整出向关系、字段树和 JSON 进入技术详情；未知字段仍可展开。`tests/ui/workspace-frame.test.ts` 验证内容工具 Frame 的直接子项、`pane-switch`、无游戏主题 Host，以及有操作内容时才输出 footer。更新边界与来源限制见 [[docs/docs-829/06-wiki/50-ui/refresh-update]]、[[docs/docs-829/06-wiki/50-ui/read-model-context]]。此为已采用的工具特例，不改变游戏工作区默认主题规则。
