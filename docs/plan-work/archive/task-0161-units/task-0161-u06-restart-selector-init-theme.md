# Unit task-0161-U06：Restart 选择页保持 Init 自身主题

## Goal

从活动 Init 点击“结束游戏”进入 Restart 选择页时，焦点 Init 只投影自己的主题，不受仍保留在运行快照中的当前 Area 主题覆盖；普通游戏中途打开选择面仍允许按既有策略预览当前 Area。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/task-0161-theme-background-layer-lifecycle-pipeline.md`：新发现、P1、验收 | 确定新增场景边界 |
| 源码 | `src/ui/context.ts`：`UIContext`、`createUIContext` | 传递选择页投影策略 |
| 源码 | `src/ui/controller-panels.ts`、`src/ui/controller.ts`：`renderSelectorPage`、`selectorContext` | 初次渲染与轮盘刷新均绑定 Restart 状态 |
| 源码 | `src/ui/selector-theme.ts`：`projectSelectorTheme` | 将 Restart 策略应用于 Area 色彩、背景和 transition key |
| 测试 | `tests/ui/controller-init-select.test.ts` | 从真实结束游戏按钮覆盖控制器转场 |
| 机制文档 | `docs/docs-828/04-mechanisms/color-derivation.md`、`docs/docs-828/02-modules/ui.md` | 把已验证行为写入当前事实源 |

## Allowed Files

- `src/ui/context.ts`
- `src/ui/controller-panels.ts`
- `src/ui/controller.ts`
- `src/ui/selector-theme.ts`
- `tests/ui/controller-init-select.test.ts`

机制文档与根 Task 的更新由 U04 承接。

## Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| Restart 按钮保留活动 Init 运行快照并直接渲染选择页。 | `controller-actions-inventory.ts` 的 `[data-restart-init]` handler |
| 活动 Init 的当前 Area 在普通选择投影中覆盖 Init 主题。 | `selector-theme.ts` 的 `projectSelectorTheme`；`selector-theme.test.ts` 原有投影用例 |
| Restart 选择页初始焦点与后续焦点投影共享 `selectorContext()`。 | `controller-panels.ts` 与 `SelectorPage.syncFocusedTheme()` |

## Constraints

- 不清空 Runtime 场景栈，不改 PlayerState、主题数据、背景 DOM 或普通游戏主题。
- Restart 模式只排除当前 Area 对选择页 Init 焦点的色彩/背景贡献；player/user 全局主题与 Init 声明主题保留。
- 游戏中途打开选择面时继续允许当前 Init 的 Area 预览。

## Explicit Non-goals

- 不调整 Init 选择、恢复、软重启和硬重启的业务行为。
- 不改变选择页布局、轮盘动画、焦点切换时序或 GlobalEnhancement 的数据。

## Completion Criteria

- [x] 初次选择页上下文按 `pendingRestart` 传递 `includeResumedArea`。
- [x] 后续焦点轮换读取相同策略，Restart transition key 不含当前 Area。
- [x] 控制器回归验证活动 Area 主色不会覆盖 Init 自身主题。
- [x] 游戏中途 selector 投影原有 Area 行为保持不变。

## Verification

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/ui/controller-init-select.test.ts tests/ui/selector-theme.test.ts --silent` | 2 files, 15 tests passed |
| 类型检查 | `npx tsc --noEmit` | passed |
