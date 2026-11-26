# 区域地图、MapRun 与 Operation

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## 区域地图交通

区域地图交通沿用 `area-map-workspace.ts` 的节点和详情区：当前区域通过主题色实心节点标记，详情显示到访状态，固定动作区区分普通前往、乘交通前往与快速返回。`area-map-dom.ts` 按节点身份原位更新。连线只显示领域中的真实连接，单向通路使用箭头。地图不授予通行资格。此为现有地图组件的扩展，行为覆盖见 `tests/ui/area-map/area-map-controller.test.ts`。

区域导航图复用游戏三栏 Frame/Titlebar 和左侧真实 Area rail。中栏为平面 SVG 节点画布，右栏为独立详情滚动区与操作反馈。point/landmark/portal 仅区分外观，选中/Focus 用既有 cyan 与主题文字色，行为来自领域脱敏投影。图册切换复用中栏工具条，更新只协调图册控件与地图区域，保留现有地图节点和视口。复用入口：`src/ui/components/map/area-map-workspace.ts`、`src/ui/workspace/area-map-dom.ts`、`src/ui/css/area-map.css`。稳定节点 / 刷新与会话语义见 [[area-map-overview]]。不复制 Init / GlobalEnh 的母子图层级。

## MapEntry 行前与续行

route-only `map-entry` 复用三栏 WorkspaceFrame：中栏承载地图简介、提示、当前进度和明确的开始／继续操作。右栏固定显示队伍与局内资源。左栏保留游戏区域导航。复用 titlebar、panel surface、主题宿主与内容滚动区。不在准备页混入完整现场战斗操作或玩家选队。资料来自 MapEntryView，局部变更按稳定语义 key 保留 Frame、滚动和焦点。机制见 [[ui-refresh-focus-scroll]]。

源码入口为 `src/ui/components/map/map-entry-workspace.ts`、`workspace-router.ts`、`workspace-frame.ts`。

MapRun 与 MapEntry 的 wrapper 仅保留业务身份并承接共享 `.workspace-page-content` 的尺寸。顶栏下间距统一在页面内容区产生，不由 wrapper 与 Frame 叠加。公共 `.topbar` 不参与收缩，保留底部分隔。MapEntry 的说明、队伍与资源分别在内容区滚动，主操作位于固定 footer。实现入口为共享 Frame、`layout.css` 与两页内容 CSS，回归见 `tests/ui/area-map/map-shell-layout.test.ts`。

## MapRun 和 Encounter 工作区

左我方身份／HP／角色行动按钮，中 Node／Encounter 说明与最近结算文本流及固定操作区，右活动敌方／背景／节点进度。相邻地点移动选项在中部 Talklet 内按需出现。Node / Event 顶部操作组提供地图查看、重新游戏与放弃游戏：重新游戏和放弃游戏保持独立操作与反馈。重开和放弃的队伍、收尾与档案边界见 [[gameplay-maprun-overview]]、[[gameplay-maprun-save-and-workspace]]。三列顶部经 `renderPanelHeaderRegion` 复用统一宿主、控件高度与分割。消费共享三列宽度变量。实际滚动 owner 是 `data-map-region-key` 为 `party-scroll`、`talk-feed`、`action-options`、`context-scroll` 的内容区，窄屏另由 Map 根承接堆叠结构滚动。`UIController.refreshMapWorkspaceRegion()` 使用一份 detached View，经 `workspace/map-dom-updates.ts` 按语义 key 协调变化的消费者，保留 Frame、列根、顶部、滚动容器和有效按钮。缺失子区局部补回，只有 Map 根缺失等恢复失败才回退当前路由。命令继续由 `controller-actions-operation.ts` 一次性事件委托进入 GameCommands。只处理可视卡牌与反馈，不新增领域卡实例、完整历史日志或 UI 自有 Run 状态。

源码入口为 `workspace-router.ts` 的 `map` runId 路由、`src/ui/components/map/map-workspace.ts`、`workspace-frame.ts` 与 `tabs.ts`。

## 相邻地点行动卡

Map 的相邻地点选择由类型化 `FlowMapLocations` 投影到标准 Talklet。Talklet 只提供一个静态卡牌落点宿主。`renderMapActionCardButton()` 共用角色当前行动卡与 Flow 地点选择卡的卡面骨架，地点卡保持 82×58px 固定尺寸，并按宿主的左右对齐、间距配置排列。卡片角度从稳定实例身份派生，刷新不会改变。宿主 / 插槽通过 `mapCardHostAttributes()` 与 `mapCardAttachmentAttributes()` 静态表达。地点卡只提供 `selectLocation` 入口，通过点击或键盘选中，再由 Map Workspace 统一 Click 按钮调用 Controller 和现有 MapRun 移动命令。空选择时该按钮阻塞。地点卡不提供卡牌目标或目标编辑入口。静态 DOM 附着、Hover 状态与作用关系保持为不同信息。当前地点与路线状态来自 Map View。锁定边不可选。遭遇或活动阻挡期间不显示。成功移动后回收旧选择条目并留下斜体旁白“从……移动到了……”。待选项只在当前 Workspace 交互会话中保留，不进入存档或历史。

## 目标、操作区和结算回执

Map Encounter 的按钮版将角色 Target／完整候选保留左栏，Ability／Item 草稿、共享覆盖槽与 Commit 放中栏底部，敌方 HP 在右栏。Action 声明 `additionalTarget` 时，Party Prepared 与当前选定的 Ability／Item 在 primary 组后增加独立“额外目标”按钮组。选择、清除和回显仍来自 MapRun Draft，按钮命令按当前来源分别写入，不覆盖 primary。该显式选择使用普通 DOM 委托，不扩展 map relation 拖放或关系高亮。`[data-map-encounter-region]` 仅作敌方信息锚点，不再代表整个遭遇的刷新边界。普通命令按消费者原位协调，保留 `data-map-focus-key` 控件、各滚动 owner 与范围外浮层。替换或移除节点前执行范围内浮层生命周期。最近回执来自 `actionPreview.recentCommit` 或同一只读 Run 的 `lastEncounterCommit`，按 requestId 标识更新。读者已在流底部时跟随新回执，阅读上文时保留位置。AG-1 的 Preview Dock 与最近回执 Feed 直接显示 ReadModel 的 `executionSequence` 来源顺序、目标、skip 和实际账本结果。E1 继续显示旧分组结果。卡牌目标按完整 CardRef scope 从当前只读卡牌视图解析名称，历史不可解析时显示通用“卡牌目标”。失败／成功按实际终态投影显示只读结果，不重建已清理的 Run。机制边界见 [[ui-refresh-focus-scroll]]。

当前 Encounter 单位卡在原有 HP／sCost 数值区内，仅当只读 `MapEncounterQueryView` 投影的 Shield 大于 0 时增加独立 Shield 数值行。最近 Commit 回执按 `shieldTrace` 顺序呈现每笔 Shield grant 与受击吸收／剩余伤害，数据只来自只读 ReadModel，不从 HP 或 Status 推导。一次性受击保护沿用 Effect Trace 的原有位置，在同一行显示目标、Status 来源与 Action、层数变化和拦截量，并明确标出 HP 不变、Shield 未消耗。Status 自然到期回馈沿用同一 Talk Feed，在 Action Trigger 后按独立 `statusExpiryTriggerTrace` 显示 Status、持有者、应用来源、到期前剩余时长及局内资源余额变化，不伪造 Action/Card 来源或新增容器。实现入口为 `src/arona-clicker/runtime/runtime-game-instance.ts` 与 `src/ui/flow/map-flow-model.ts`。投影和保存回执均由 `tests/ui/area-map/map-flow-adapter.test.ts` 覆盖。此扩展不增加 Workspace wrapper、CSS 或滚动区。

卡牌修正目标仍用同一组带稳定 key 的目标按钮。按钮内显示目标 Action 名和「伤害／治疗 ±delta」，失效时拒绝原选择并提示重选，避免相同 Action ID 的不同实例被互换。候选来自 `actionPreview.preparedActions[].legalTargetCards` 与 `cardEffectModifierPreviews`，界面只展示 Runtime 投影的合法候选。该场景是 AG-1 中另一队员当前实际 Prepared、比来源更晚执行的伤害或治疗卡。筛选由 `src/arona-clicker/services/map/gameplay-b-action-preview-resolver.ts` 提供，界面入口为 `src/ui/components/map/map-workspace.ts`，回合草稿边界见 [[gameplay-maprun-encounters]]。

## 单位关系与替换浮层

Map 的单位关系检查使用 `src/ui/workspace/map-relation-presentation.ts` 与 `map-relation-interaction.ts`，只消费 Runtime 的 `relations`。当前已验证的单位阶段：来源牌上浮与发起标记、选中单位的中性包围框 / 目标角标、弱虚线合法候选。自身可以叠加发起与目标标记。单位与牌面保持原节点，角色只是属性补丁，不按敌我或效果正负决定受用角色。

当前牌点击继续展开右侧替换浮层。候选是既有 Swap / PlayerCommand 的展示，不是第二套 Hand 或独立战斗卡。独立“固定作用关系”与“修改目标”入口避免同一次点击同时换牌和确认目标。Hover / Focus / 候选预览不写领域状态。单位或真实卡牌的点击 / 键盘 / 拖拽确认走 MapRun 草稿命令，只有显式提交才结算。真实卡牌的当前牌、Hand 展示与目标选择代理共享 Owner object key。代理仅选择受用牌，不换牌、不创建实例，未选 Command offer 无卡实例身份。进入目标编辑先关闭替换浮层，再安装编辑状态，避免关闭动作误选目标。目标编辑 / 拖拽优先于替换浮层、固定、普通 Hover / Focus。未知敌方目标只提示未知。sCost 显示实际余额。本轮减免按所选卡实际执行计算。同角色卡牌只高亮。

## Operation 手牌扇列

公共手牌、角色持有牌与场景行动候选共用横向交叠。卡面在独立顶层副本中显示抬高、焦点与光晕，原卡继续承接点击和拖拽。固定锚定的预备行动／敌方意图卡与购买项列表保留各自布局。

源码入口为 `src/ui/components/operation/operation-workspace.ts` 的 `.operation-card-fan` 持有区。悬停展示由 `src/ui/presentation/operation-card-hover-overlay.ts` 承担。

## Spot 行动入口

沿用 `.mini-action` 和 `card.action` 主题宿主。同一 `operationEntry` 类型每按钮绑定一个关卡，放在设施操作组内，不插入聊天流。准入与继续状态从领域查询取得。

源码入口为 `src/ui/components/operation/operation-entry.ts` 的 `renderOperationSpotFunctions`，由 `production.ts` 组合。

## 转译演练场入口

转译演练场 Spot 沿用 `.mini-action`，点击后直接进入现有 MapWorkspace，不打开训练 Modal 或 MapEntry。战次、来源和构筑说明来自可信节点的 title/description。Hand、Prepared、目标、AG-1预览及回执复用既有卡牌区域与局部更新。返回保留来源场所位置，再入续行。旧 `components/character/variant-training-panel.ts` 仅供开发诊断。证明入口为 `tests/ui/core/variant-training-spot-entry.test.ts`。开发面板验证独立见 `variant-training-panel.test.ts`。
