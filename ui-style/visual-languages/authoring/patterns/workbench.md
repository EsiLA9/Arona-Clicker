# Workbench、Ribbon 与工作区会话

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## Classic／Advanced 外壳

Story／StoryEntry 编辑器在 Classic 模式使用原 Workspace 布局。高级模式通过 `editor-workspace.ts` 在同一 Frame 外装配占满视口的工具组、实例条、工作类型 SVG 栏和单行状态栏。工具组用竖线、组名和图标区分命令，当前对象名称放在实例条。高级工具栏默认展开，拖动底边可在带状工具栏和单行之间切换，选择跟随界面偏好保存。顶部工具组使用 panel-light 表面及对应文字角色，实例条以同一层半透明黑色覆盖未选中标签、间隙与两端留白，选中标签露出与三栏间隙相连的主题画布。实例条高 36px，Story 和 Entry 复用各自 SVG，关闭按钮独立占 24px。底部状态栏直接使用工作区底色。SVG 工作类型栏与导航栏共用左栏外框，三栏外框采用 5px 圆角。顶部与三栏之间保留 6px 空隙，工具栏下沿可直接拖动切换高度。两条 6px 栏缝以纵向三点提示拖宽，双击恢复侧栏默认宽度。正文底部的插入工具沿用 `.mini-action`。三栏、双栏查阅、专注正文共用原滚动宿主。回归入口为 `tests/ui/story/story-editor-workspace.test.ts`。

## 共享栏位、只读审阅与视图折叠

Story、StoryEntry 与世界使用 `editor-workspace-frame.ts` 的面板、标题与轨道。高级模式从已有栏位派生可用视图，世界默认双栏，可切三栏或专注，三栏右侧预留便捷信息。左栏目录通过共享的行、折叠与滚动组件呈现。只读审阅区复用区块和标签／值行。折叠保留已挂载栏位与滚动宿主，专注时侧栏轨道为零。分隔线只在可见侧栏的栏缝显示。

## 会话主题与共享布局偏好

编辑器会话从外部采样有效主题，工作类型切换沿用已提交主题，真正退出交还给目的页面。高级编辑器布局由公共 `editorLayout` 跨工作类型共享。Ribbon 密度不是按工作类型隔离。颜色缺项沿用 `theme-tree.ts` 的浅色角色。主题解析或投影失败时切到浅色纯色画布，移除旧背景及表现宿主图层。入口见 `editor-workspace.ts`、`editor-workspace-appearance.ts` 与 `controller-theme.ts`。

## 顶部主题浮窗与场景采样

Story 编辑器的顶部主题浮窗沿用现有 `.theme-palette` / `.theme-swatches` / `.theme-editor-entry`，列出全部色组，标记当前编辑器主题，并复用用户主题表单编辑本会话自定义主题。Area / 通讯录场景卡片以 title 提示可双击应用目标完整主题。单击仍查看属性。选择色组、双击和颜色预览只更新主题变量、背景、表现宿主与浮窗选中属性，保留顶部按钮、浮窗、Workspace、输入焦点和滚动。组件位置修改沿用既有表单结构刷新。来源、隔离和会话边界见 [[runtime-editor-and-project-checks]]，实现为 `workspace/editor-workspace-appearance.ts`、`controller-theme.ts` 与共享 header / theme actions。验证为 `tests/ui/story/story-editor-theme.test.ts`。

## 中栏标题与浏览历史的位置

Story / Entry 中栏的历史按钮与 workspace-heading 共用一行，按钮组位于左侧且不收缩，标题占余下宽度。仅 `story-editor.css` 对中栏 titlebar-layout 进行横排与历史组排序，不增加 DOM 包装，不改变其他工作区标题栏或刷新范围。

Story 编辑器浏览历史复用中栏 `renderWorkspaceTitlebar` 的 accessory 与 `.workspace-back` 控件，按钮位于既有 `panel-tabs-region`，不新增滚动宿主。切换走 `workspace.story-editor` 区域协调，保留顶部和正文滚动宿主，历史返回后恢复对应位置。状态边界见 [[runtime-editor-and-project-checks]]，DOM 与导航行为见 `tests/ui/story/story-editor-workspace.test.ts`。

## 绑定、尺寸与生命周期

`src/ui/workspace/editor-workspace.ts` 的 `renderEditorWorkspace()` 包装 Frame，`bindEditorWorkspace()` 绑定视图选择、退出、ResizeObserver 和拖拽。在挂载处传 `AbortSignal` 和工作类型回调，并在切换前后捕获、恢复所属实例滚动。当前侧栏预设 300／320px，可拖范围 150–720px，中栏保留 340px。公用外壳与目录样式分别在 `src/ui/css/editor-workspace.css`、`src/ui/css/editor-directory.css`，由 `src/ui/utilities/surface-styles.ts` 按表面加载。实例状态复用见 [[workspace-columns-and-layout]]。
