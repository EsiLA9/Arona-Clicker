# 机制聚合：色彩、主题与 UI 表现

## 机制范围

- ColorGroup、ColorEquipment、ThemeDef、ThemeDesign 和用户自定义主题；
- 主题层级、语义色、背景/组件图层、表现目标和 UI Host；
- 服务工作区、主题编辑器和 DOM 刷新表现。

## 当前事实源

- [[docs-828/02-modules/color]]
- [[docs-828/02-modules/ui]]
- [[docs-828/04-mechanisms/color-derivation]]
- [[0x-plan&work/completed/color-system-plan]]

## 计划与决策

| 生命周期 | 文档 | 用途 |
| --- | --- | --- |
| active | [[0x-plan&work/active/adr-0006-ui-background-layering]] | 背景视觉层叠 ADR |
| active | [[0x-plan&work/active/roadmap-0006-ui-background-layering]] | 背景图层施工 |
| active | [[0x-plan&work/active/roadmap-0008-theme-color-system-refactor]] | 主题色与语义节点 |
| active | [[0x-plan&work/active/roadmap-0009-theme-control-backgrounds]] | 控件背景与定位 |
| active | [[0x-plan&work/active/roadmap-0010-presentation-layer-service]] | 统一表现层服务 |
| active | [[0x-plan&work/active/roadmap-0011-ui-component-layer-backgrounds]] | 组件背景图层 |
| active | [[0x-plan&work/active/roadmap-0012-flat-presentation-targets]] | 平级表现目标 |
| active | [[0x-plan&work/active/roadmap-0013-presentation-editor-ux]] | 表现编辑器体验 |
| active | [[0x-plan&work/active/roadmap-0014-theme-editor-convergence]] | 主题编辑器收敛 |
| active | [[0x-plan&work/active/roadmap-0015-ui-dom-recalculation]] | DOM 重算治理 |
| active | [[0x-plan&work/active/roadmap-0016-cluster-region-context-overrides]] | 簇/区域作用域 |
| active | [[0x-plan&work/active/roadmap-0017-theme-state-and-semantic-storage]] | 状态表现与语义色 |
| active | [[0x-plan&work/active/roadmap-0018-button-state-unification]] | 控件状态统一 |
| active | [[0x-plan&work/active/roadmap-0018-ui-host-registry]] | UI Host Registry |
| active | [[0x-plan&work/active/task-0022-theme-definition-and-custom-theme-repair]] | 自定义主题修复 |
| completed | [[0x-plan&work/completed/roadmap-0019-presentation-text-color]] | 表现宿主文字颜色 |
| newPlan | [[0x-plan&work/newPlan/06-meta-loop-and-ui]] | 元循环与空间化 UI |

## 当前判断

主题/表现是 active 计划最多的机制族。这里的路线图按子问题拆分，但共同事实源仍是 `docs-828/02-modules/color`、`ui` 和 `04-mechanisms/color-derivation`。
