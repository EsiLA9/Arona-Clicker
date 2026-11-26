# 工作区骨架与栏位装配

**已采用的复用约定。** 本页以列出的现有实现为准。组件专用尺寸、构成和特例适用于对应界面。

## 页面内容区、Frame 与 Presentation surface

页面内容区拥有剩余高度和顶栏下间距，Frame 仅提供填父容器的网格。列的 header / body / 可选 footer 各自分离，复用单份 Presentation surface，不另手写相似外框。

源码入口为 `src/ui/components/shared/workspace-frame.ts` 的 `renderWorkspaceFrame` / `renderWorkspaceColumn`。`src/ui/workspace/workspace-renderer.ts`。

## 有序栏数组、栏身份和跨宿主复用

用有序栏数组与单项 width 设计页面。稳定 key 跟随展示组，`definitionId` / `bindingKey` 表达当前正文和业务目标，slot 只作旧外观别名。跨宿主沿用来源主题与 `data-column-origin` 样式。返回由调用方显式绑定，换序/改宽保留原节点。复杂 Map/Operation 仍需各自业务动作适配。

源码入口为 `src/ui/columns/index.ts`、`src/ui/workspace/workspace-columns.ts`。机制见 [[workspace-columns-and-layout]]。

## 滚动归属与更新边界

`WorkspaceColumnSpec.scroll` 的 `auto` 标记栏体滚动，`content` 标记内容区域滚动，`none` 将滚动交给内层独立组件。头尾固定区放在栏 body 之外。完整工作区用 `hostId`、`workspaceOwner`、`surface` 声明身份与表面，纯几何入口只收预渲染栏。结构、列身份与布局消费见 `tests/ui/workspace/workspace-frame.test.ts`，路由与更新见 [[workspace-navigation-and-rendering]]、[[ui-refresh-focus-scroll]]。

## 工作区几何与面板节奏

工作区默认保留 `--workspace-gap`、`--workspace-left-width`、`--workspace-center-width`、`--workspace-right-width`。有序栏数组决定顺序和栏数，每项 `width` 声明 CSS track。页面内容区拥有剩余高度和顶部间距，嵌入 Frame 填充父容器。`--panel-radius`、`--panel-shadow`、`--panel-content-padding`、`--panel-region-gap` 由适用的面板宿主消费。

内容名称、数值、状态来自 `UIContext`／`GameView` 或只读查询并沿用目标页面已有格式化。入口为 `src/ui/runtime/context.ts` 与 [[read-model-and-ui]]。
