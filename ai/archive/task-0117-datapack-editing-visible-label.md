# Task：数据包编辑中可见状态文案

状态：done — 2026-09-19 实现、自动化核验与浏览器验收完成，待归档

## 来源与问题

数据包编辑态进入条件和金色活动样式已经生效，但编辑态按钮的可见文案仍固定为“编辑态”。“编辑中”只存在于 `title` 与 ARIA 描述中，用户在界面上无法直接看到当前正在编辑的 Mod。

## 目标

1. 当前编辑器实际打开并指向该 `packRecordId` 时，按钮可见文案显示为“编辑中”。
2. 首次选择编辑态、仅有 Debug 预加载状态或编辑器关闭时，按钮可见文案保持“编辑态”。
3. 保留现有金色活动态、ARIA 描述、Selection 和编辑器进入逻辑。

## 施工切片

### P0：可见状态文案

- [x] 在 Pane 状态按钮渲染中复用 `editingTarget` 判断切换可见文案。
- [x] 保持普通态文案、创建编辑态文案和未创建状态不变。

### P1：回归核验

- [x] 测试首次选择显示“编辑态”，二次进入显示“编辑中”。
- [x] 完成定向测试、类型检查、构建、架构检查、文档检查和浏览器核验。

## 最终核验（2026-09-19）

- 定向 Vitest：数据包工作区、顶栏与设置工作区、Runtime Editor 持久化、Pane 排序与状态，46/46 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过；仅保留既有大 chunk 警告。
- `npm run check:architecture` 通过。
- `npm run check:docs` 通过。
- 浏览器验收通过：进入目标编辑态后按钮可见文案为“编辑中”，同时保留 `is-editing-target`、ARIA 描述和 `mod` 编辑面板；首次选择时仍显示“编辑态”。

## 非目标

- 不改变编辑态目标匹配、金色主题变量或 hover 规则。
- 不改变编辑态创建、Apply、持久化和退出行为。

## 相关路由

[[task-0116-datapack-editing-active-gold-theme-token]]
[[task-0115-datapack-editing-active-gold-state]]
[[docs/docs-828/02-modules/ui]]
[[docs/docs-828/05-conventions/testing]]
