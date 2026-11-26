# 试播、演出与覆盖层

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## 隔离试播

隔离试播以独立三栏复用 WorkspaceFrame，左栏滚动显示已走路线，Classic 在底部固定「从头试播」与「关闭试播」，Advanced 由 Workbench 工具带承载试播操作。中栏用正式聊天与演出部件承载隔离投影，右栏查看条件历史。Classic 的 Story 正文栏和 StoryEntry 页底部提供常显的「试播」，Advanced 将文档试播动作放在工具带，工具包继续提供入口选择。等待时中栏用主题面板样式呈现小窗，长条件可滚动。悬停摘要查看真实条件树，已确认记录可展开复查。三栏按稳定 key 协调，保持待决控件、已展开记录以及未贴底的聊天阅读位置。关闭恢复原编辑页、滚动与入口焦点。入口为 `story-editor/preview-view.ts` 与 `story-editor.css`。

## 定位演出与正文视口

节点设计器沿用 `renderTabs()` 与现有属性 label / select / input，「内容｜外观｜演出」三页按稳定 key 挂载，切换仅更新 hidden / 激活态。外观或演出已配置时提供对应的恢复默认按钮。中栏视口浮层提供纵向基准、横向基准与单位。仅当前选中节点已开启定位演出时显示一组工具，右栏保留 X/Y 输入。流中的定位节点保持正常渲染，附带超迷你“演出 / 结束演出”按钮，逐节点切换会话内编辑态。开启时选中该节点并显示演出属性页（旧 Operation 显示原属性页）。开启的预览通过共享 `bodyOverlay` 位于中栏正文视口，脱离流的滚动，切换属性对象不关闭其他节点。不再使用顶部小画布。拖拽命中区与蓝框随内容使用同一锚点平移，保留抓取偏移并写回所属节点的同一 performance.layout。取消拖拽不写入，九宫格基准同时对齐窗格和内容的同名点，百分比与 CSS 像素共用一组有符号偏移。旧定义继续读取左下原点与横向锚点。内容按自然宽度和锚点实际剩余空间排版，极贴边时保留可读空间。局部样式用于流内与定位内容。普通旁白、标题和 Choice 完成记录均走共用渲染。运行态定位展示在 `.chat-pane` 非滚动层，当前输入使用原 token，历史记录禁用。没有新的配色体系或滚动容器。新增视口包装层保留原 body、作者节点和表单身份，仍走 `workspace.story-editor` region 与 `patchEditorDOM`。入口为 `property-fields.ts` / `controller.ts`、`components/story/story.ts`，证据见 `tests/ui/story/story-editor-properties.test.ts`、`tests/ui/workspace/workspace-frame.test.ts` 与 `tests/ui/story/story-performance.test.ts`。

## 主题与覆盖层作者控件

Story 主题 / 覆盖层作者控件沿用同一右栏字段与中栏节点流，不再嵌套滚动容器。`presentation.theme` 的色板、token、语义颜色与背景层按具体合同呈现。空字段显示继承来源，显式覆盖可恢复继承。引用的 ColorGroup / 实体 ThemeDef 通过 `ThemeContentEditorService` 在选定编辑态包打开会话，使用其 preview / save / cancel 路径。旧 `overlay.show` 也通过所属节点的迷你按钮进入同一固定演出编辑层，重用 `renderChatTexts` 的作者预览模式，归一化 x/y 双向映射到同一草稿字段。拖动过程中只更新预览与所属节点当前表单的数值，释放时合并到 `workspace.story-editor` 区域刷新。稳定动作路径识别覆盖层，浮层锚点仍由 `patchEditorDOM` 的 mutation range 生命周期处理。执行影响说明跟随 Overlay / Transfer / Entry 动作字段。自动化行为入口为 `tests/ui/story/story-editor-properties.test.ts`、`tests/engine/story/story-authoring.test.ts` 与 `tests/engine/theme/theme-content-editor-service.test.ts`。
