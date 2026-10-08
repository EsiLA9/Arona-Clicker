# Task 0249：Gameplay B Operation 面板收纳与地图浮窗

状态：implemented — UI 实现、定向回归与类型检查通过；待人工检查实际游戏视口的布局与遮挡。

## 目标

收敛 Strategy Park Operation 工作区因全地图进入中央内容流而产生的纵向占用，并让左右栏复用 AC 游戏界面的经典三栏结构。右栏顶部增加视图切换，可查看敌方/现场或合并后的行动背景与持有物；地图以可关闭的流内地图卡片及可选的可拖动大图浮窗呈现。

施工按下述 DOM 刷新预算和交互边界执行；完成后保留人工视觉检查与验收记录。

## 当前实现核查

- `renderMain()` 把 `renderProgress()`、`renderStrategyParkMap()`、路线记录、行动记录和操作控件连续放入 `data-operation-log`。完整地图因此占用中央滚动流的纵向空间。
- `renderStrategyParkMap()` 仅在 Strategy Park 事件显示完整路线图；地图包含区域、路线摘要、图例、13 个地点和 SVG 连线。
- `operation-workspace.css` 中地图画布设有 `min-width: 1000px`、`min-height: 285px`，地图容器有最大宽度和横向溢出规则。静态源码能确认它体积大且在内容流内；实际视口下高度问题的视觉程度仍需施工后的人工验收。
- 工作区目前使用 `renderWorkspaceFrame()` 三栏结构，左栏为我方学生，右栏为敌方/现场；左右栏标题仍由各自内容内部渲染。Frame 已支持 `surface: 'panel'` 与 `header`。
- 只读 `OperationView` 已提供 `knownFactIds`、`heldItemIds`、地点描述、目标与场景状态，可支持背景/持有物视图，不需要为 UI 新建 Runtime 状态。
- 当前操作刷新会经 Operation workspace 更新并 morph 工作区树；不可让浮窗拖动或右栏切换因此重建无关区域。

## 方案范围

1. 左、中、右三栏均复用 AC 游戏界面的经典三栏结构与统一的面板外框/顶部栏。Operation 保留自己的业务内容和交互，不另造一套三栏框架；顶部栏与业务区域应维持稳定语义节点。
2. 右栏顶部提供稳定的两页 Switch：**敌人** 与 **背景 / 持有物**。后一页将地点背景、当前事实、持有物等信息合为一页，只读投影现有 OperationView 信息。每次进入新阶段时默认切回敌人页；同一阶段普通刷新不应反复重置用户选择。
3. 地图卡片可留在中央流内并可关闭。通常仅在首次进入地图时显示一次，供玩家了解路线；关闭后不因普通 Operation 刷新重复插入。地图卡片不默认自动弹出大图。
4. 地图同时支持用户主动打开可拖动的大图浮窗。它是面向玩法 B 的通用地图显示器，应呈现当前玩法/阶段所对应的地图目标，不应永久绑定 Strategy Park 的 13 地点数据。地图数据由当前 OperationView / 场景上下文选择，UI 不写入 EventRun、SaveData 或游戏机制状态。
5. 当前玩法或阶段离开某张地图的适用范围时，地图浮窗必须关闭，或切换到新阶段对应的地图；不得继续显示已过期地图。没有适用地图时关闭浮窗并清除旧目标。流内卡片也只在该地图首次进入时显示，不因切换地图而混入不相关地图内容。
6. 关闭流内卡片不影响路线选择、行动提交和其他操作；浮窗可从稳定入口再次打开。浮窗拖动限制在可视工作区内，窗口缩放后位置仍可见。
7. 不在本 Task 扩展地图拓扑或 Operation Runtime；若当前 View 缺少区分地图目标所需的稳定标识，先在 Task 实施时评估最小只读投影，不得把 UI 临时状态写进玩法存档。

## 状态与生命周期

- 右栏页签、流内地图卡片是否已展示/被关闭、浮窗是否打开及其位置，都属于 UI 临时状态；为当前 Operation run/阶段设置明确 owner 和生命周期，不进入存档或 Runtime。
- 阶段标识变化时，右栏自动回到敌人页；同阶段 Operation 状态刷新保留页签。
- 流内地图卡片只在第一次进入对应地图时自动出现一次；用户关闭后本次 run 不自动重现。再次查看可通过地图入口打开浮窗。
- 大图浮窗默认关闭，不在地图首次进入时自动弹出。玩家主动打开后，仅在当前地图适用范围内保持；阶段/玩法目标变化时按上文切换或关闭。
- 本方案按用户裁定合并背景与持有物为一页，不再保留拆成两个右栏页签的待决项。

## DOM 刷新与交互连续性硬约束

实现前必须在变更说明中给出 DOM budget 和刷新等级，按 `docs/ai/frontend-design-project-overlay.md` 执行：

```text
DOM budget（实现结果）
- 三栏继续复用 `renderWorkspaceFrame()` 与现有列 host；左右列启用既有 `surface: 'panel'` 和 header 支持，中栏也使用同一 panel surface。未引入新的三栏布局系统。
- 地图可用时新增 8 个语义容器：右栏 header 与 tablist、背景页容器、流内地图卡片及其 header、浮窗壳及其 header/content。另有两个 tab、独立地图入口、流内关闭和浮窗关闭按钮。地图入口保持在 tablist 外，以维持正确的 ARIA tab 语义。Strategy Park 的地图内容在流内卡片与浮窗各投影一次。
- 稳定节点：三栏 host、学生卡、中央日志、右栏 host、地图卡片和浮窗壳；Operation morph key 保留地图卡片与浮窗壳 identity。
- 左右 `workspace-column__body` 均为 `scroll: none` 且不滚动；左侧学生列表、右侧当前视图分别标为 `data-scroll-owner="content-region"` 并承担滚动，Workspace header / Switch 留在滚动容器之外。中心只由聊天日志流滚动。
- `ScrollManager.captureWorkspace/restoreWorkspace()` 在列 body 下存在显式 content-region 时对其保存/恢复滚动位置；其他 workspace 保持原 body 回退规则。
- Switch：behavior 更新 `aria-selected`/roving tabindex 与两个视图的 hidden 状态；不提交 workspace 更新。
- 地图拖动与键盘方向移动：behavior，只改浮窗 CSS 位置变量和 UI 临时坐标；不 render、不查询/写入 Runtime、不写存档。resize 只将浮窗位置约束回视口。
- 地图卡片/浮窗关闭和重开：behavior 改 hidden、aria 状态并更新 UI 临时状态；稳定入口与浮窗壳保留。
- Operation 命令与阶段变化沿用既有 `workspace.operation` region morph（此刷新同时更新多个玩法区域）；地图卡片/浮窗壳通过 morph key 保持 identity，右栏页签与浮窗位置由 run 级临时状态恢复。跨地点阶段变化切回敌人页；地图 provider 不可用时清空 mapId/content 并隐藏同一浮窗壳。拖动、切页、开关本身不调用该 region refresh。
- 不新增 full render 路径；现有 workspace owner/路由结构变化仍按原机制渲染。
```

交互约束：

- 拖动标题区使用 pointer capture；处理 pointer cancel、失焦和边界约束。可拖动区域应有键盘可访问的等效移动方式，浮窗关闭按钮可通过 Escape 关闭。
- 关闭浮窗后焦点返回打开地图的按钮；Switch 操作后焦点留在 Switch，aria-selected/pressed 与可见页同步。
- 普通 Switch、拖动、关闭、重开不得重建左栏学生卡、中央聊天流或未变化的右栏稳定节点；拖动期间不触发 DOM morph。
- Operation workspace 的同阶段刷新不得重置右栏页签、浮窗开关状态或位置；阶段变化按上述规则切回敌人页并更新/关闭地图目标。
- 地图浮窗不可遮挡必要的提交/导航控件；窄视口下须能关闭并恢复操作。

## 验收清单（后续施工）

- 完整地图不再强制占用中央日志流高度；首次进入地图时可显示可关闭的流内地图卡片；大图仅由玩家主动打开。
- 左、中、右三栏复用 AC 经典三栏外框和顶部栏，布局不引入重复滚动容器或横向溢出。
- 右栏敌人页与背景/持有物页可切换，后一页内容与 OperationView 一致；每个新阶段默认敌人页，同阶段刷新保留选择，切换不修改游戏状态。
- 地图卡片首次进入时只插入一份并由 morph 原位更新；浮窗可拖动、关闭和重新打开，拖动与 Switch 不触发 render/morph；Operation 阶段变化沿用既有 workspace region morph，同时保持无关栏位和地图壳 identity。
- 阶段或玩法目标变化时，地图目标同步切换；旧地图不适用时浮窗自动关闭，且不显示过期目标。
- 拖动、切换和关闭前后，左侧学生卡、中央日志、右栏稳定 host 的 DOM identity 符合上述预算；焦点、键盘操作、窄视口和 Escape 行为通过验收。
- 实际游戏视口由人工检查高度、遮挡、可读性与操作连续性后再收尾。

## 施工记录

- 修改 `src/ui/components/operation-workspace.ts`、`src/ui/controller-actions-operation.ts`、`src/ui/controller.ts`、`src/ui/css/operation-workspace.css`：左右列启用统一面板标题与外框，右栏提供“敌人 / 背景与持有物”页签；OperationView 当前阶段按 `eventId + currentLocationId` 识别，同阶段普通 `planVersion` 更新不会重置页签，阶段变化默认回到敌人页。
- 右栏敌方/场景角色只投影当前场景有敌方 Intent、或被当前学生行动/场景行动/玩家场景卡合法指向的角色。Operation Event roster 仍为 run 级；UI 不再把全 Event 的对手和场景参与者无条件铺到每个地点。当前 Strategy Park 初始非战斗地点因此不显示后续战斗敌人。
- 地图由 UI 侧 `OperationMapPresentation` adapter 按当前 OperationView 选择；Strategy Park 是当前 provider。中央流内地图卡片随地图首次进入插入一次并可关闭；大图默认关闭、由入口打开，支持 pointer 拖动、键盘方向移动、Escape/关闭按钮关闭及 resize 后回到视口范围。provider 不适用时清空目标并隐藏浮窗壳。UI 临时状态不写入 Runtime/存档，按 run 保留并限制缓存最多 8 个 run。
- 新增 `tests/ui/gameplay-b-strategy-park-map.test.ts` 回归覆盖右栏切换与阶段默认页、流内地图关闭、默认关闭的大图、地图浮窗身份跨 Operation morph 保持、键盘移动及关闭后焦点返回；并保留原地图/路线覆盖。`tests/ui/scroll.test.ts` 验证 delegated content-region 的滚动位置快照。
- 验证：`npx vitest run tests/ui/gameplay-b-strategy-park-map.test.ts tests/ui/scroll.test.ts tests/ui/operation-workspace-view.test.ts` 通过（3 个文件、23 个测试）；`npx tsc --noEmit` 通过；本任务涉及文件 `git diff --check` 通过。
- 人工视口验收尚未完成：需实际确认经典三栏高度、浮窗遮挡、窄视口可达性与地图视觉比例。自动化 DOM 测试不替代该项。
