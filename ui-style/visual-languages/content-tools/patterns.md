# 内容检索布局与交互模式

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

表面、局部变量与网格例外见 [[ui-style/visual-languages/content-tools/foundations|内容检索工具基础]]。

## 内容工作区三栏

把已渲染的导航／条目／详情作为 Frame 直接子项。使用 `pane-switch` 窄屏显隐。该入口不创建游戏列 Host、surface 或 Presentation host。工具自己拥有表面和滚动区。可选操作 footer 仅在有内容时出现，当前图鉴不挂载。搜索留在固定区域，条目与详情各自拥有内容滚动。Runtime Draft 浏览器仍自行生成类似 Grid，详见本页的 Draft 检索。

源码入口为 `src/ui/components/shared/workspace-frame.ts` 的纯布局 `renderWorkspaceLayout`、`src/ui/runtime-editor/codex/workspace.ts` 的 `renderContentWorkspace`。超级图鉴实际使用。

## 超级图鉴资料与技术详情

超级图鉴的中文分类与类型标签由 `src/ui/runtime-editor/codex/content-labels.ts` 提供。名称、说明、关系与可靠来源来自只读内容查询。主路径为资料／被引用，完整出向关系、字段树和 JSON 进入技术详情。未知字段仍可展开。`tests/ui/workspace/workspace-frame.test.ts` 验证内容工具 Frame 的直接子项、`pane-switch`、无游戏主题 Host，以及有操作内容时才输出 footer。更新边界与来源限制见 [[ui-refresh-focus-scroll]]、[[read-model-and-ui]]。此为已采用的工具特例，不改变游戏工作区默认主题规则。

## Draft 检索与编辑

Runtime 内容浏览器参考图鉴的分类、条目、详情，现由 `renderRuntimeEditorWorkspace()` 直接生成 Grid、检查器和固定应用栏。待应用计数和提交由编辑态 Draft 持有。使用已有区域更新，保持列表选择、表单身份与各窗格滚动。入口为 `src/ui/runtime-editor/view.ts`、`src/ui/css/runtime-editor.css`，应用机制见 [[runtime-editor-and-project-checks]]。
