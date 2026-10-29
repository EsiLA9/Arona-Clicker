# Task：数据包编辑态新建目标指示

状态：done — 2026-09-19 实现、自动化核验与浏览器验收完成，待归档

## 来源与问题

编辑器面板关闭后，编辑态数据包仍然是 Runtime Editor 创建新 Init / Area / Spot 等内容的目标，但数据包列表按钮会直接退回普通“编辑态”文案，用户无法确认新内容将写入哪个 ModId。

## 目标

1. 编辑面板打开时继续显示金色“编辑中”。
2. 编辑面板关闭但编辑目标仍保留时，编辑态按钮显示“新建：`ModId`”，并使用区别于金色编辑中的额外主题色。
3. 真正退出编辑态、编辑目标被清除后，按钮恢复为“编辑态”。
4. 目标指示仍按 `packRecordId` 精确匹配，不影响其他 Pane。

## 状态契约

```text
编辑态按钮
  ├─ 无编辑目标：编辑态
  ├─ 编辑面板已打开：编辑中（warning / 金色）
  ├─ 面板已关闭但目标保留：新建：ModId（accent 色）
  └─ 退出编辑态并清除目标：编辑态
```

## 施工切片

### P0：目标指示

- [x] 将编辑目标判断拆为“新建目标”和“编辑面板目标”。
- [x] 为面板关闭状态显示 ModId 和 accent 颜色。
- [x] 保证打开状态的金色规则覆盖新建目标颜色。

### P1：回归核验

- [x] 测试打开面板显示“编辑中”。
- [x] 测试关闭面板显示“新建：ModId”与新建目标样式。
- [x] 测试真正退出编辑态后清除目标指示。
- [x] 完成类型检查、定向测试、构建、架构检查、文档检查和浏览器验收。

## 最终核验（2026-09-19）

- 定向 Vitest：数据包工作区、顶栏与设置工作区、Runtime Editor 持久化、Pane 排序与状态，46/46 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过；仅保留既有大 chunk 警告。
- `npm run check:architecture` 通过。
- `npm run check:docs` 通过。
- 浏览器验收通过：编辑面板打开时显示金色“编辑中”；关闭面板后显示“新建：base”并带独立 `is-create-target` 目标色；真正退出编辑态后恢复“编辑态”。

## 非目标

- 不改变编辑器目标的创建、持久化和退出逻辑。
- 不改变普通态 / 编辑态 Selection 或 Runtime Apply。
- 不为普通态提供新建内容目标。

## 相关路由

[[task-0117-datapack-editing-visible-label]]
[[task-0116-datapack-editing-active-gold-theme-token]]
[[docs/docs-828/02-modules/ui]]
[[docs/docs-828/05-conventions/testing]]
