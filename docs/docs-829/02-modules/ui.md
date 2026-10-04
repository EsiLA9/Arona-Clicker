# 02-modules/ui — 游戏 UI 模块卡

> 本文回答：`src/ui/` 如何处理游戏界面输入、页面路由、渲染与只读数据消费。

## 职责边界

- `main.ts` 启动 App Runtime 并挂载 `UIController`。
- Controller / Actions 将输入变成 `GameCommands`，处理 UI 生命周期、刷新和 Workspace 路由。
- Components 根据 `UIContext` 生成视图；不直接持有 PlayerState 写引用。
- `context.ts` 组合 GameView、GameReadModel 与表现查询；样式位于 `css/`。
- 游戏内内容编辑器位于 `runtime-editor/`，独立 Datapack Editor 位于 `tools/datapack-editor/`。

## 关键阅读与测试

| 主题 | 路径 |
| --- | --- |
| 命令与 Controller | `src/ui/controller.ts`、`src/ui/controller-actions-*.ts` |
| 只读上下文 | `src/ui/context.ts`、`src/arona-clicker/contracts/runtime.ts` |
| Workspace / 更新 | `src/ui/workspace/`、`src/ui/update/` |
| 测试 | `tests/ui/`，如 `controller-events.test.ts`、`workspace-router.test.ts` |

职责协作见 [[docs/docs-829/06-wiki/50-ui/00-index]]；UI 目录不代表详细机制或样式规范。
