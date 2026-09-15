# 机制聚合：色彩、主题与 UI 表现

> 冻结考古层的反向索引：从当前机制出发，找它的设计理由与历史来源。本页不写状态、不写结论。

## 机制范围

- ColorGroup、ColorEquipment、ThemeDef、ThemeDesign 和用户自定义主题；
- 主题层级、语义色、背景 / 组件图层、表现目标和 UI Host；
- 服务工作区、主题编辑器和 DOM 刷新表现。

## 当前事实源

- [[docs/docs-828/02-modules/color]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/04-mechanisms/color-derivation]]
- [[docs/docs-828/01-architecture/design-constraints]]（背景层叠、系统颜色层归属等仍生效约束）

## 仍生效的设计约束

见 [[docs/docs-828/01-architecture/design-constraints]] 的「UI 背景层叠」一节；未落地的部分（编辑器专用预览、表现层调试视图、簇—区域深合并等）见 [[docs/plan-work/00-index]] 的「未决方向 · UI / 主题表现层」。

## 历史来源与设计理由

### 裁定

| 文档 | 用途 |
| --- | --- |
| [[adr-0006-ui-background-layering]] | 背景视觉层叠 ADR |

### 路线与施工记录

| 文档 | 用途 |
| --- | --- |
| [[roadmap-0006-ui-background-layering]] | 背景图层施工 |
| [[roadmap-0008-theme-color-system-refactor]] | 主题色双轨与语义节点（后段见 [[task-0066-theme-css-progressive-migration]]） |
| [[roadmap-0009-theme-control-backgrounds]] | 控件背景与定位 |
| [[roadmap-0010-presentation-layer-service]] | 统一表现层服务 |
| [[roadmap-0011-ui-component-layer-backgrounds]] | 组件背景图层 |
| [[roadmap-0012-flat-presentation-targets]] | 平级表现目标 |
| [[roadmap-0013-presentation-editor-ux]] | 表现编辑器体验 |
| [[roadmap-0014-theme-editor-convergence]] | 主题编辑器信息架构收敛 |
| [[roadmap-0015-ui-dom-recalculation]] | DOM 重算治理 |
| [[roadmap-0016-cluster-region-context-overrides]] | 簇 / 区域作用域 |
| [[roadmap-0017-theme-state-and-semantic-storage]] | 状态表现与语义色 |
| [[roadmap-0018-button-state-unification]] | 控件状态统一（已被取代） |
| [[roadmap-0018-ui-host-registry]] | UI Host Registry |
| [[roadmap-0019-presentation-text-color]] | 表现宿主文字颜色 |
| [[roadmap-0026-presentation-inset-decoration]] | 表现宿主内嵌装饰线 |

### 关键任务

| 文档 | 用途 |
| --- | --- |
| [[task-0022-theme-definition-and-custom-theme-repair]] | 自定义主题修复 |
| [[task-0025-selector-dynamic-theme]] | Init / GlobalEnh 选择页场景主题、背景变体与快照状态投影 |
| [[task-0030-button-rendering-convergence-solution]] | 按钮渲染统一（未完成部分见「未决方向」） |
| [[task-0033-system-color-layer-scope]] | 系统颜色层职责收敛与重复背景清理 |
| [[task-0065-ui-presentation-residual-and-visual-regression]] | 表现层体验尾项与视觉回归 |
| [[task-0066-theme-css-progressive-migration]] | 语义节点 CSS 渐进迁移 |
| [[task-0067-ui-update-dispatcher-stage2]] | UI 更新调度第二阶段 |

### 更早的历史

| 文档 | 用途 |
| --- | --- |
| [[color-system-plan]] | ColorGroup / ColorEquipment 早期设计与施工清单 |
| [[06-meta-loop-and-ui]] | 元循环与空间化 UI 草案（未裁定） |
