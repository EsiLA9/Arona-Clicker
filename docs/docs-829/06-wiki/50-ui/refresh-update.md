# 06-wiki/50-ui/refresh-update — 按影响范围更新 DOM

状态变化后，UI 不需要总是重建整页。DOM 更新有不同范围：改已有节点中的值、替换一个元素或内容区域、刷新一个 Workspace，或在页面身份 / 结构变化时重建整个 App。**DOM** 是浏览器里的界面节点树。

## 更新范围从窄到宽

| 范围 | 作用 | 例子 |
| --- | --- | --- |
| behavior | 只改已挂载节点的文本、class 或属性 | Tick 更新资源数字、产出文本。 |
| element | 重画一个已有语义身份的元素 | 替换一个 Spot 卡片或 Area 导航项。 |
| region / panel | 替换明确的内容区域 | 更新某个面板、日志或 Operation region。 |
| structure | 重建 Workspace 或整个 `#app` | 页面路由、工作区 owner 或结构改变。 |

这是可选的刷新范围，实际采用哪种取决于调用入口是否能找到稳定节点、该区域内容集合是否变化以及对应回退路径。`UIController.render()` 会重建 `#app`；`refreshPanels()` 尽可能只替换目标 Panel，并在特定 Workspace 上调用其专用区域刷新；`refreshLight()` 通过已有 behavior patch 改数值。任何单个控制器方法都不意味着“所有更新都走同一条 dispatcher”。

## Dispatcher 怎样合并请求

区域地图的 workspace.area-map region 由 AreaMapController 消费：按 Map+Node 身份协调 SVG 节点/连线，保留 Frame、工具条、viewport、world 与详情滚动宿主；选中、公开投影、反馈变化只更新实际消费者，投影指纹不变不改图。相机仅补 world transform；拖动达到阈值后才捕获指针，普通节点点击仍到达节点。替换/移除前关闭范围内 popover，缺失子区只在所属列补回；地图根/路由错配才恢复 Workspace。Hero/地图入口门控变化单独补属性。源码与行为测试见 [[docs/docs-829/04-mechanisms/arona-clicker/area-map-navigation]]。

`src/ui/update/ui-update-dispatcher.ts` 按更新身份合并同一微任务中的重复请求，先检查 Surface token 是否仍有效，再按结构、区域、元素、行为的顺序处理。App 结构更新覆盖同批次的窄更新；Workspace 结构更新也覆盖其下窄更新；区域更新可压掉同宿主及子宿主的元素 / behavior 请求。控制器通过稳定宿主 ID 找目标；目标不存在时专用调用方可选择面板或结构回退。

Surface key / generation 令旧 Workspace 发出的请求不会落入新页面，见 [[docs/docs-829/06-wiki/50-ui/workspace-routing]]。更新请求的四种类型在 `src/ui/update/ui-update-types.ts`；具体已有 DOM 目标的 behavior 在 `ui-behaviors.ts`。

## 事件怎样选刷新

`src/ui/controller-events.ts` 把引擎事件映射成界面响应：资源、Spot 产出和 Tick 的高频数字由轻量刷新覆盖；可见性变化尝试刷新单张 Spot 卡片 / Area 项，集合发生改变或目标找不到时回退面板更新。应用主题相关事件可以安排结构刷新；单个实体表现事件则调用针对该实体的更新入口。收到事件不等于无条件 `render()`。

项目交互边界还规定，scroll、hover、focus、普通 click 和单项选择默认不得调用全量 render；优先复用 behavior / region 更新并保留无关节点。规范来源：[[docs/ai/frontend-design-project-overlay]]。

## 超级图鉴的局部更新

图鉴是 body 级工具，浏览状态由 `CodexShellState` 持有。`src/ui/runtime-editor/actions.ts` 的 `bindRuntimeEditorCodexActions()` 委托交互并调用 `refreshRuntimeEditorCodexPanel()`；`src/ui/runtime-editor/view.ts` 汇总视图与状态，`src/ui/runtime-editor/codex/view.ts` 输出三个 Pane，`src/ui/runtime-editor/codex/dom-updates.ts` 的 `patchCodexPane()` 只协调所属 Pane，并按稳定键重排或更新条目。框架由 `src/ui/runtime-editor/codex/workspace.ts` 组合已渲染的导航、列表和详情；局部动作不会重建共享图鉴根。

搜索 input、条目列表及其滚动宿主、详情 Pane、身份标题和详情 slot 在相邻更新中保留身份。页签切换保留按钮与标题，只更新被协调的详情内容和页签属性；普通搜索原位更新输入，不靠替换后恢复光标。输入法组合期间不提交查询，`compositionend` 后再提交。窄屏选栏只改变选中状态和可见性，不重挂三栏内容。

引用跳转保留分类／包／搜索范围；筛选外条目显示定位动作，主动定位才清筛选。引用历史（上限 50 条）保存条目、范围、页签、列表与详情 `scrollTop`，返回／前进恢复阅读位置并清理失效键；列表直接选择不压关系栈。局部 owner 跳转保留位置提示，只有找到匹配的已渲染语义节点才滚动定位。

替换内容或移除节点前关闭该范围内浮层；保留且目标未变的锚点继续存在，更新后调用 `retainIfAnchored()` 复核。缺失 Pane 时只补入对应 Pane，并按导航、列表、详情顺序放回网格；未受影响 Pane 和滚动宿主继续复用。普通图鉴操作不调用游戏全量 `render()`；工具首次挂载和工作视图切换沿用 Runtime Editor 外壳生命周期，Editor 草稿与应用流程仍由原状态对象持有。

证明入口：`tests/ui/runtime-editor-codex-integration.test.ts`、`tests/ui/runtime-editor-codex-dom-updates.test.ts` 验证节点身份、输入法、键盘页签、跨范围历史／阅读位置、缺失 Pane 顺序与浮层边界；`tests/ui/runtime-editor-codex-shell.test.ts` 验证三栏语义与响应式样式合同；共享工具 Frame 结构由 `tests/ui/workspace-frame.test.ts` 验证。测试不代替浏览器视觉与交互验收。

## 聊天流与 Map 信息流的共享条目

普通 Chat 与 Gameplay B 中部信息流共用一套条目标识与滚动实现：条目根元素带 `data-flow-entry-key`，宿主带 `data-flow-host-key`／`data-flow-stream-key` 与 `role="log"`。条目渲染统一走 `src/ui/components/story.ts` 的 `renderChatEntry`，Map 只提供投影，不另拼条目 HTML；正文附加行、受控 `FlowContent.actions` 按钮及 `data-*`／`role` 语义标记由渲染器统一转义与白名单输出，不接受任意 HTML 或内联事件。

滚动状态由 `src/ui/flow/flow-scroll.ts` 按**流实例键**保存，而不是按 DOM 元素：普通 Chat 全量 render 会换 `.chat-stream` 节点，Map 的 feed 由 `patchMapDOM` 保留，两者都能恢复阅读位置。只有原本贴底且出现新条目时才跟随到底；上翻阅读时按条目实例键与相对偏移恢复，锚点被回收则退到相邻稳定条目。

`src/ui/chat-stream.ts` 的追加与 Gameplay B 的条目投递共用 `src/ui/flow/flow-entry.ts` 的 `append`／`replaceSameId` 与 200 条上限。`replaceSameId` 只用于显式声明非空逻辑 ID 的条目（如 `gameplay-b:current-enemy-info`），普通 Chat 条目不写该字段，仍按数字 ID 与 `storyPageKey` 去重。

## Map Workspace 的跨栏更新

Map 的左方队员／行动、中央说明与最近回执／操作区、右方敌人／背景共用一份 detached `MapRunWorkspaceView`。`UIController.refreshMapWorkspaceRegion()` 生成目标标记后，经 `src/ui/workspace/map-dom-updates.ts` 的 `patchMapDOM()` 按区域与控件 key 协调实际变化；沿用原 Dispatcher 的一次命令收敛点，不新增调度器。同一 Encounter 的更新不再等同于只替换右侧 `[data-map-encounter-region]`。

Frame、列根、共享顶部、真实滚动 owner 与仍有效的按钮保持身份；数值、文字、选中／禁用状态原位更新，候选集合变化只协调对应角色内的节点。主题背景增删也不得导致内容宿主被无谓重建。被删除的语义区域先走范围内浮层清理，再移除节点；范围外锚点继续保留，之后校验锚点连接。

更新前记录真实滚动 owner 与有效焦点；按 `data-map-focus-key` 保留或恢复焦点，原按钮失效后转到可操作来源或当前遭遇标题。中部信息流按条目实例键协调：同一来源的快照刷新原位更新、不重排；只在出现新实例键且原本贴底时才跟随，正在阅读上文或仅选择草稿时不跳动。会话内保留的旧回执只带 `data-map-commit-receipt`，`data-map-recent-commit` 与 `feed-recent-commit` 仅属于最新一条。右栏「查看情报」是只读 UI 临时条目，使用固定逻辑槽回收，不发送命令、不改变目标选择。跨遭遇保留的最近回执不等于完整历史日志。

相邻地点移动器属于中部流的 `gameplay-b:move-choices` 当前条目，按 Node 实例键协调；当前活动／遭遇或未完成的 Node 活动会收起它，Node 完成与空闲地点选择下一站时自动唤起。边条件与资源门槛从 detached View 读取。按钮委托沿用 Map 命令入口，并携带来源 Node 身份拒绝过期点击；只有移动命令成功才调用 `MapFlowModel.recordMovement()` 回收旧移动器，追加“从……移动到了……”的 observed 旁白。失败不消费选择器、不追加旁白；下一地点需要移动时生成自己的新移动器。历史只保留在当前 Run 的 UI 会话，离开或读档重建时不伪造此前移动记录。

同一 Map 中移动、完成遭遇和进入终态仍需同步所有受影响消费者，不能误降为敌方区更新。缺失的内容区域可在所属列中补回；根或路由身份不匹配时取消旧请求或按当前路由恢复，不把全页 render 当作普通点击路径。验证入口为 `tests/ui/map-dom-updates.test.ts`、`tests/ui/gameplay-b-map-workspace.test.ts` 与 `tests/ui/gameplay-b-map-vertical-slice.test.ts`，视觉复用入口见 [[ui-style/patterns]]。

## MapEntry 准备页的局部更新

`map-entry` 是只携带 `mapId` 的 route-only Workspace。`MapEntryView` 通过 `MapRunQuery.getEntryView()` 读取；页面不写入 Run。准备页内的 Map 状态刷新与 Story / 前台门控重算使用专属 `workspace.map-entry` region 请求，Controller 只重绘 `map-entry` 根并经 `patchMapDOM()` 按 `data-map-region-key`、队员、资源项、焦点和 Frame / column / theme host key 协调。左右栏内容滚动宿主与仍有效的主操作节点保持身份，滚动位置恢复；管理区等 keyed DOM 自身状态保留。替换范围先通知 Popover owner，局部 patch 后再复核锚点。

MapEntry 局部刷新检查当前仍是同一 mapId 路由，并用 UI 会话里的 `mapEntrySource` 重验 Spot 所属当前 Area、utility reveal、MapEntry functionality 与条件。正常 `render()` 也做同样检查。入口无法验证时，只退回最初 `returnTo` 并清除这次 UI 来源；不 abandon 有效 MapRun。来源绑定不进入 SaveData，读档或 Controller 重建后缺少有效来源时，玩家需从设施重新打开准备页。常规生产 Tick 不属于此页的独立刷新来源；实际更新由 Map / 门控变化的定向调用发起。实现入口：`src/ui/controller.ts` 的 `requestMapEntryWorkspaceRefresh()` / `refreshMapEntryWorkspaceRegion()` 与 `src/ui/components/map-entry-workspace.ts`；视觉复用见 [[ui-style/patterns]]。

## Map 单位关系的临时交互更新

`MapRunActiveWorkspaceView.relations` 提供当前准备关系，区分选定目标与各项效果受用方；结算实际结果仍来自回执。`MapRunQuery.previewReplacement()` 由 Owner 校验候选 / 草稿版本，在 detached 假设快照上重新解析，不安装草稿或推进抽牌随机流。

`src/ui/workspace/map-relation-interaction.ts` 的 `MapRelationInteraction` 由 Controller 持有，只保存 Hover / Focus、固定、目标编辑与拖拽临时状态。`map-relation-presentation.ts` 在既有可视实例上补属性；Map 局部协调完成后 Controller 同次重核呈现，防止临时 role 属性被新 HTML 清掉。不为这些交互请求全页 render，也不增加渲染调度器。

单位或真实卡牌的点击、Enter 和拖拽合法释放经同一 Controller adapter 发草稿命令；6px 拖拽阈值之前保留原卡点击，成功拖拽抑制尾随点击，新的物理按下 / Enter / Space 恢复独立操作。取消 / 无效释放不写入。命中按最上层元素身份与领域候选核对，不根据坐标推导相对目标；选择不依赖 SVG 或连接锚点。卡牌当前展示、Hand 展示和可访问目标代理共享 object key，不创建领域副本；关闭浮层先于安装目标编辑状态。确认仍通过一次 Map patch 保留 Frame / 列 / Flow，sCost 与 cardEffects 只消费 Runtime 投影。Scope / draft 变化重核来源，离开 Run / 读档沿 `disposeMapFlow()` 清理临时态，Controller 销毁移除监听与指针捕获。对应行为证明见 `tests/ui/map-relation-interaction.test.ts` 与 `gameplay-b-map-workspace.test.ts`；Flow 独立玩法卡与连接线尚未属于该实现。

## 测试与验证边界

`tests/ui/ui-update-dispatcher.test.ts` 验证重复合并、区域 / 结构优先级及过期 Surface 丢弃；`tests/ui/controller-events.test.ts` 验证事件映射到当前导航、局部区域和主题响应；`tests/ui/workspace-frame.test.ts`、`workspace-lifecycle.test.ts` 覆盖工作区结构 / 生命周期。它们不替代真实浏览器中的视觉或交互验收。

读命令和查询输入：[[docs/docs-829/06-wiki/50-ui/controller-commands]]、[[docs/docs-829/06-wiki/50-ui/read-model-context]]。返回 [[docs/docs-829/06-wiki/50-ui/00-index]]。
