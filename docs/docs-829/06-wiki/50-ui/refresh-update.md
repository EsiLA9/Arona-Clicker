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

## 测试与验证边界

`tests/ui/ui-update-dispatcher.test.ts` 验证重复合并、区域 / 结构优先级及过期 Surface 丢弃；`tests/ui/controller-events.test.ts` 验证事件映射到当前导航、局部区域和主题响应；`tests/ui/workspace-frame.test.ts`、`workspace-lifecycle.test.ts` 覆盖工作区结构 / 生命周期。它们不替代真实浏览器中的视觉或交互验收。

读命令和查询输入：[[docs/docs-829/06-wiki/50-ui/controller-commands]]、[[docs/docs-829/06-wiki/50-ui/read-model-context]]。返回 [[docs/docs-829/06-wiki/50-ui/00-index]]。
