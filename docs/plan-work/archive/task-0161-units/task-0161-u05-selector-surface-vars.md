# Unit task-0161-U05：选择页可见表面变量同源

## Goal

选择页壳层/轮盘与 body 外背景宿主使用各自所属 selector snapshot 的 CSS 变量，不通过旧 document root 间接读取离开前主题值。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0161-theme-background-layer-lifecycle-pipeline.md`：P2、验收 | 明确不同页面 surface 的 snapshot 责任 |
| 文档 | `docs/docs-828/02-modules/ui.md`：选择页 / 背景宿主 | 当前 DOM / Host 边界 |
| 源码 | `src/ui/selector-page.ts`：`syncFocusedTheme` | 轮换焦点时同步 selector subtree |
| 源码 | `src/ui/components/selector-page.ts`：`renderSelectorPage` | 初始 HTML 写入 selector shell vars |
| 源码 | `src/ui/outer-background.ts`：`renderOuterBackground`、`syncOuterBackground` | body 直系背景与 app 子树没有变量继承关系 |
| 测试 | `tests/ui/controller-init-select.test.ts` | 检验焦点选择与外背景变量来源 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 8k–18k tokens |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 |
| 超预算处理 | 回到 Task owner 收敛范围，不扩展 CSS 全局策略 |

## Optional Read Set

- `src/ui/css/selectors.css`：只有变量作用域无法从模板 / 更新函数判定时读取。

## Do Not Read by Default

- `docs/plan-work/archive/**`；无历史视觉策略需要恢复。
- `src/ui/css/**` 其它分区；本 Unit 只修 snapshot 作用域，不做样式重构。

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| `.init-wheel` 与 `.selector-viewport` 是 selector shell 的兄弟/子树区域；focus 更新之前只对 viewport、disc、detail、super background 等逐个应用 ThemeTree。 | `components/selector-page.ts`、`selector-page.ts:syncFocusedTheme` | 轮盘颜色可能继续继承 document root。 |
| body 直系 `#ui-background-layer` 不在 `#app` 子树中；仅给 selector page 写变量不会修复其中 `var(--bg)`。 | `outer-background.ts:syncOuterBackground` | 背景 view 已带 `themeVars` 可供其自身使用。 |

## Constraints

- ThemeTree 必须来自当前 selector projection；body 外层使用其 `BackgroundView.themeVars`。
- 只设置作用域局部变量，不污染 document root 或 Runtime 场景来源。
- 不改轮盘布局、转场时长和背景图层数据。

## Allowed Files

- `src/ui/selector-page.ts`
- `src/ui/components/selector-page.ts`
- `src/ui/outer-background.ts`
- `tests/ui/controller-init-select.test.ts`

## Explicit Non-goals

- 不改 `document.documentElement` 全局主题变量。
- 不做选择页 CSS 视觉改版或 Game 页主题流程修改。

## Stop Conditions

按 `docs/ai/PROJECT-CONSTITUTION.md` §停止条件六项执行；若必须改其它 CSS 文件或全局 document root 所有权，停止并交回 Task owner。

## Completion Criteria

- [x] 初始 selector shell 与焦点变化后都持有焦点 ThemeTree。
- [x] body 外背景元素持有构建该 BackgroundView 时生成的主题变量表。
- [x] 定向控制器/投影回归断言 shell/theme tree 与 outer/global vars 同源，并覆盖旧 scene/story 隔离证据（见执行收据）。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/controller-init-select.test.ts --silent` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |
| 浏览器 | Init selector 切换焦点并观察轮盘 / 外背景 | 不从旧 document root 读色 |

## Pre-flight

- Goal：同步选择页 shell 和外层背景的主题变量来源。
- Allowed Files：以上四个文件。
- Explicit Non-goals：不改 document root 全局变量与 selector CSS 设计。
- Stop Conditions：遵守本 Unit 六项停止条件。
