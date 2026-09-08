# 机制聚合：色彩、主题与 UI 表现

## 机制范围

- ColorGroup、ColorEquipment、ThemeDef、ThemeDesign 和用户自定义主题；
- 主题层级、语义色、背景/组件图层、表现目标和 UI Host；
- 服务工作区、主题编辑器和 DOM 刷新表现。

## 当前事实源

- [[docs/docs-828/02-modules/color]]
- [[docs/docs-828/02-modules/ui]]
- [[docs/docs-828/04-mechanisms/color-derivation]]
- [[docs/0x-plan&work/completed/color-system-plan]]

## 计划与决策

| 生命周期 | 文档 | 用途 |
| --- | --- | --- |
| active | [[docs/0x-plan&work/active/adr-0006-ui-background-layering]] | 背景视觉层叠 ADR |
| active | [[docs/0x-plan&work/active/roadmap-0006-ui-background-layering]] | 背景图层施工 |
| active | [[docs/0x-plan&work/active/roadmap-0008-theme-color-system-refactor]] | 主题色与语义节点 |
| active | [[docs/0x-plan&work/active/roadmap-0009-theme-control-backgrounds]] | 控件背景与定位 |
| active | [[docs/0x-plan&work/active/roadmap-0010-presentation-layer-service]] | 统一表现层服务 |
| active | [[docs/0x-plan&work/active/roadmap-0011-ui-component-layer-backgrounds]] | 组件背景图层 |
| active | [[docs/0x-plan&work/active/roadmap-0012-flat-presentation-targets]] | 平级表现目标 |
| active | [[docs/0x-plan&work/active/roadmap-0013-presentation-editor-ux]] | 表现编辑器体验 |
| active | [[docs/0x-plan&work/active/roadmap-0014-theme-editor-convergence]] | 主题编辑器收敛 |
| active | [[docs/0x-plan&work/active/roadmap-0015-ui-dom-recalculation]] | DOM 重算治理 |
| active | [[docs/0x-plan&work/active/roadmap-0016-cluster-region-context-overrides]] | 簇/区域作用域 |
| active | [[docs/0x-plan&work/active/roadmap-0017-theme-state-and-semantic-storage]] | 状态表现与语义色 |
| active | [[docs/0x-plan&work/active/roadmap-0018-button-state-unification]] | 控件状态统一 |
| active | [[docs/0x-plan&work/active/roadmap-0018-ui-host-registry]] | UI Host Registry |
| active | [[docs/0x-plan&work/active/task-0022-theme-definition-and-custom-theme-repair]] | 自定义主题修复 |
| active | [[docs/0x-plan&work/active/task-0025-selector-dynamic-theme]] | Init / GlobalEnh 选择页场景主题、背景变体与快照状态投影 |
| active | [[docs/0x-plan&work/active/task-0033-system-color-layer-scope]] | 系统颜色层职责收敛与重复背景清理 |
| completed | [[docs/0x-plan&work/completed/roadmap-0019-presentation-text-color]] | 表现宿主文字颜色 |
| docs/newPlan | [[docs/0x-plan&work/docs/newPlan/06-meta-loop-and-ui]] | 元循环与空间化 UI |

## 当前判断

主题/表现是 active 计划最多的机制族。这里的路线图按子问题拆分，但共同事实源仍是 `docs/docs-828/02-modules/color`、`ui` 和 `04-mechanisms/color-derivation`；选择页动态主题另以 Task-0025 作为当前执行入口。
