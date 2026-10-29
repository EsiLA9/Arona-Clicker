# Task-0066：主题色语义节点 CSS 渐进迁移与收尾裁定

状态：proposed — 待施工

> 本文承接 [[roadmap-0008-theme-color-system-refactor]]。该 Roadmap 的双轨主题、作用域继承、编辑器与关键 UI 迁移已完成，只剩 CSS 渐进迁移与两项收尾裁定；此处把它们拆成独立任务，避免已完成路线长期滞留在 `active/`。

## 目标

- 把仍依赖旧 `primary` 派生与固定 CSS 变量的组件继续迁移到语义节点（`ThemeNodeName`）；
- 收掉兼容别名，明确「哪些固定状态色有意保留」；
- 完成 Roadmap 收尾所需的文档同步。

## 当前事实与代码落点

- 主题色列表与节点解析：`src/ui/theme-palette.ts`、`src/ui/theme-tree.ts`、`src/arona-clicker/services/color-system.ts`。
- 运行时层合并：`src/engine/core/theme-runtime.ts`。
- 卡片强调色注册表：`src/ui/color-scheme.ts`（当前保留标签语义色）。
- 样式分区：`src/ui/css/`（`variables` / `layout` / `chat` / `cards` / `selectors` / `codex` 等）。

## 施工切片

| 切片 | 内容 |
| --- | --- |
| M1 | 盘点仍直接引用旧固定 token / 硬编码主题色的 CSS 与组件，形成迁移清单 |
| M2 | 按清单把基础 Panel、Tab、按钮、卡片、气泡迁移到语义节点，清理已可移除的兼容别名 |
| M3 | 裁定 `color-scheme.ts` 卡片强调色是否继续保留固定语义色，并记录理由 |
| M4 | 同步 [[docs/docs-828/02-modules/color]]、[[docs/docs-828/04-mechanisms/color-derivation]] 与相关模块卡片 |

## 非目标

- 不重新设计主题色派生算法，不改 `--bg` / `--bg-alt` 的颜色来源；
- 不开放任意 CSS 选择器或用户 CSS 注入；
- 不改变用户主题编辑器的既有字段语义。

## 测试与验收

```text
npm test
npx tsc --noEmit
npm run check:architecture
```

- 只设置 1 个主题色时全部登记节点仍有稳定可读结果；
- 组件不再自行决定「第几个主题色」；
- 移除兼容别名后 `docs/docs-828/` 无残留旧节点名。

## 剩余工作

- 本文自身全部切片待施工。

## 相关路由

- [[roadmap-0008-theme-color-system-refactor]]
- [[roadmap-0010-presentation-layer-service]]
- [[roadmap-0012-flat-presentation-targets]]
- [[docs/docs-828/02-modules/color]]
- [[docs/docs-828/04-mechanisms/color-derivation]]
