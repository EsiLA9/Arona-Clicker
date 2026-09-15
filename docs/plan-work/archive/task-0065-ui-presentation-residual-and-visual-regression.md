# Task-0065：UI 表现层体验尾项与视觉回归收尾

状态：proposed — 待施工

> 本文承接 Task-0064 准出批次中，从各已完成 UI 文档拆出的**非阻塞体验增强与视觉/回归验证**尾项。原任务的原定范围已在各自文档内完成；本文只承载它们明确延后、且不能继续挂在旧任务上的内容。

## 目标

- 把散落在已完成 UI 任务里的「专用预览、体验开关、多设备视觉回归」集中到一处；
- 明确区分「体验增强」与「必须补的验证」，不把二者混成同一优先级；
- 让已完成文档可以干净归档，不因体验尾项长期滞留 `active/`。

## 来源（上游已归档文档）

| 上游 | 遗留项 |
| --- | --- |
| `completed/task-0025-selector-dynamic-theme` | 选择页背景资源专用预览、用户可配置的动态背景开关、更完整的多设备视觉回归 |
| `completed/roadmap-0015-ui-dom-recalculation` | 正常游玩 DOM 重算的后续专项回归 |
| `completed/roadmap-0026-presentation-inset-decoration` | 外部光晕曲度（原计划列为非目标，按用户决定保留现状） |
| `completed/roadmap-0013-presentation-editor-ux` | 主题编辑器视觉回归；原记录的「全量 UI 测试缺少 `localStorage` 的 21 项失败」**已失效**，2026-09-15 核验为 157 文件 / 1463 测试全部通过 |
| `completed/task-0031-svg-button-state-color-audit` | 普通按钮仍待 [[task-0030-button-rendering-convergence-solution]] 接入统一 Host，不在本文重复 |

## 当前事实与代码落点

- 选择页场景背景与局部主题投影：`src/ui/selector-theme.ts`、`src/ui/components/selector-page.ts`、`src/ui/components/init-select.ts`。
- 背景层与表现宿主：`src/ui/background-service.ts`、`src/ui/presentation-service.ts`。
- 主题编辑器：`src/ui/components/user-theme-editor.ts`、`src/ui/controller-modals.ts`。
- 刷新观测入口：`UIController.getRefreshStats()`、`#app[data-ui-refresh-*]`（详见 [[roadmap-0015-ui-dom-recalculation]]）。

## 施工切片

### P0：体验开关与专用预览

- [ ] 为选择页 / 主题编辑器的背景图层提供专用预览入口，不改运行时主题契约；
- [ ] 落实用户可配置的动态背景开关，并保持 `prefers-reduced-motion` 低动态分支行为。

### P1：多设备视觉回归

- [ ] 在 1280 / 900 / 760 / 640 / 375 宽度下完成选择页、主题编辑器与三栏 Workspace 的视觉回归；
- [ ] 记录基线结果，明确哪些差异属于有意保留。

## 非目标

- 不改变运行时主题解析顺序、Host Registry 或 `PlayerState` 结构；
- 不重新打开已归档任务的实现范围，也不改写它们的验证结论；
- 不引入新的背景图层类型或动效系统。

## 测试与验收

```text
npx tsc --noEmit
npm test
npm run check:architecture
```

浏览器逐项回归并留有记录；未执行的项目写「待验收」，不以设计完成代替验证完成。

## 剩余工作

- 本文自身全部切片待施工。

## 相关路由

- [[docs/docs-828/02-modules/ui]]
- [[task-0025-selector-dynamic-theme]]
- [[roadmap-0013-presentation-editor-ux]]
- [[roadmap-0015-ui-dom-recalculation]]
- [[roadmap-0026-presentation-inset-decoration]]
- [[task-0030-button-rendering-convergence-solution]]
