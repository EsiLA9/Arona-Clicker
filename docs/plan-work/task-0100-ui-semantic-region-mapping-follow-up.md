# Task：Init / 语义状态节点的局部刷新映射

状态：proposed — 由 task-0096 的核心刷新边界验收后拆出，待单独排期

## 来源与边界

task-0096 已完成 Panel / element / Region 刷新契约、Popover mutation range、Spot / Area / Enhancement 元素映射、Shop Region 刷新、Runtime Editor 批量边界、Tick fallback 去重和浏览器验收。本 Task 不回改已稳定的 `spot.card`、`area.nav`、`enhancement.card` 或 Shop Region 契约，只处理更高熵的语义节点。

## 待办

- [ ] 评估 Init / Area hero 文案是否可拆为 `element`，并明确名称、描述、当前归属变化时的 Panel fallback。
- [ ] 为状态 class、ARIA 状态、主题语义节点建立字段 / 元素组 / Region 映射表。
- [ ] 为每条新增映射补充节点身份、Popover、滚动、焦点和 stale-surface 测试。
- [ ] 为 Runtime Editor 批量 Apply 增加 behavior / Region / Panel / full 的前后计数断言。
- [ ] 若主题语义节点承载 tooltip anchor，接入统一 mutation range 生命周期后再启用局部替换。

## 约束

- 集合、路由、主题层级或 Workspace 身份变化时必须回退 Panel / Workspace / App 结构刷新。
- 不以临时 DOM 引用作为异步更新契约；目标必须使用稳定 host 与 data key。
- 主题正式提交继续遵循 task-0096 的安全 full-render 决策，除非本 Task 有新的范围证据。

## 关联

- [[task-0096-panel-granular-refresh-api-and-hover-continuity]]
- [[docs/docs-828/07-audit/dom-refresh-chains]]
