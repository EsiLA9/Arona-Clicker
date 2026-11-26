# Flag 的行内状态、检查器与绑定

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## 需要局部标记的锚定列表

「需要局部标记」使用原输入操作行内的 anchored listbox：聚焦展开、外部交互关闭，Navi 按钮继续提供完整来源浏览。下拉复用 panel-light / ink-on-panel-light / line 主题角色，正常匹配使用实色，未匹配仅以 0.72 opacity 稍浅显示并保留选择能力。空值或首次打开已有值均全匹配。筛选不新增刷新调度，只原位切换行状态。`workspace.story-editor` 协调后恢复同一输入会话的展开 / 筛选状态，保留行与滚动容器。入口为 `story-editor/required-flag-dropdown.ts`，测试见 `tests/ui/story/story-editor-required-flag-dropdown.test.ts`。

## 节点和 Operation 属性

节点的可选局部标记条件沿用右栏 label/input。Operation 的局部标记作为“行为类型”下的分支，操作方式、名称和值与其他行为字段处于同一属性组。写入/移除使用浅层 select，仅写入分支显示值控件，移除分支收起值。控件按语义 key 局部协调，不隐藏编辑态节点，不重建三栏或流滚动容器。

## 流内 Flag 与拖放绑定

Story 编辑流的局部 Flag 使用纯色圆角矩形和代码字体，按钮和悬停提示都只显示单个 ID。节点与 Choice 选项需要的 Flag 位于左侧，选项提供的 Flag 位于右侧。点击切换至右栏 Flag 表，并展开该 Story 节点对应的同名条目。节点可拖到 Flag 上，Flag 也可拖到节点上，两种操作共用绑定判定并在拖拽时显示「可绑定／已绑定／不可绑定」。在 Choice 选项上拖放后续节点仍会声明 `marks[]` 并给节点写入 `requiresFlag`，解绑在 Choice 属性中。运行机制见 [[runtime-editor-and-project-checks]]。

## Flag 表的标题、来源和行内操作

Flag 标题行沿用流内 Flag 的稳定深色和 DM Mono，省略超长 ID，右侧按本篇／其他汇总提供／依赖／双向。展开后每篇 Story 只出现一张共用渐变卡，点击定位首个引用节点。左下角重命名胶囊在行内打开输入，提示外部引用风险后只修改本篇草稿。绑定判定只在拖拽经过标题行时显示。展开状态按当前内容与 Flag 作用域、类型和 ID 保留。入口为 `flag-catalog-view.ts`、`flag-table-binding.ts` 与 `controller.ts`。回归见 `tests/ui/story/story-editor-inspector-tabs.test.ts`。
