# docs-830/04-presentation/ui-style-conventions — UI 风格体系与复用约定

本文回答：项目如何记录游戏 UI 的视觉基础，以及新界面如何复用既有组件和表现。

## UI Style 知识入口

根目录 `ui-style/` 维护基础视觉角色、布局/组件模式和复用入口：`00-index.md` 负责导航，`foundations.md` 说明色彩、层级、排版等基础角色，`patterns.md` 记录工作区、面板、输入、状态与内容组件模式。文档用于定位和复用现有表现语言，具体运行行为仍以 `src/ui/` 当前组件和 CSS 为准。

新页面通常沿用已有的 App 框架、Workspace、共享面板、主题 Host 与只读查询入口；只有不同的交互语义或内容类型需要独立表现组件。主题 token、宿主层级及 `hostId` 查询见 [[story-chat-and-theme-presentation]]。

## 新 UI 的复用路径

```text
确认页面所属 Workspace
  → 查询既有组件/视觉模式
  → 复用 UIContext、Host 与主题 token
  → 需要时增加语义组件和局部 CSS
  → 用现有刷新/焦点/滚动路径保持状态
```

组件接入仍遵守 [[workspace-navigation-and-rendering]] 的路由与渲染边界，以及 [[ui-refresh-focus-scroll]] 的增量更新约定。

来源：`ui-style/00-index.md`、`ui-style/foundations.md`、`ui-style/patterns.md`、`src/ui/css/`、`src/ui/components/`。这是视觉复用入口，不替代交互行为和无障碍验收。

## 修改时如何定位

先在 `ui-style/` 查页面所属布局与视觉角色，再核对实际组件与 CSS；主题视觉结果还受宿主、作用域及运行时主题层影响。`ui-style/` 描述复用原则，具体运行流程应回到主题投影和组件源码确认。不同交互语义不应只因为外观相似就假定可以共用同一组件。
