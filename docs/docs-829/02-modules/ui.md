# 02-modules/ui — 游戏 UI 模块卡

> 本文回答：`src/ui/` 如何处理游戏界面输入、页面路由、渲染与只读数据消费。

## 职责边界

- `main.ts` 启动 App Runtime 并挂载 `UIController`。
- Controller / Actions 将输入变成 `GameCommands`，处理 UI 生命周期、刷新和 Workspace 路由。
- Components 根据 `UIContext` 生成视图；不直接持有 PlayerState 写引用。
- `context.ts` 组合 GameView、GameReadModel 与表现查询；样式位于 `css/`。
- 游戏内内容编辑器位于 `runtime-editor/`，独立 Datapack Editor 位于 `tools/datapack-editor/`。

## Gameplay B Operation Surface

- `workspace/workspace-router.ts` 将 Operation Run ID 表达为独立 route；`workspace/workspace-renderer.ts` 通过只读 `GameReadModel.operationEntry.getView(runId)` 获取投影。
- `components/operation-workspace.ts` 按我方 / 信息 / 敌方三栏布局：学生行动计划附在左栏身份卡，对手 Intent 附在右栏角色卡，环境/设施独立分组；中心 AC 聊天流承载地点、目标、玩家选择、路线、SceneAction、独立手牌与 Resolution。
- `controller-actions-operation.ts` 经 Controller 调用 Runtime 的窄 Operation Entry 写 facade；战斗 Commit、暂存/结算场景批次、路线转场和奖励领取更新单个 `workspace.operation` region，路由进出才重建 Workspace。
- 本地内容命令台是 DEV + 显式 `?devConsole=gameplay-b` 才动态挂载的测试工具；命令白名单仅允许为当前夏莱办公室内存状态获得试玩角色，不自动进入 Run，也不写存档；命令完成后只刷新入口聊天区域，使固定阵容准入状态即时更新。

只读 DTO 与 Runtime 边界见 [[docs/docs-829/03-data-structures/operation-view]]；Workspace 与更新细节见 [[docs/docs-829/06-wiki/50-ui/workspace-routing]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]。

## 关键阅读与测试

| 主题 | 路径 |
| --- | --- |
| 命令与 Controller | `src/ui/controller.ts`、`src/ui/controller-actions-*.ts` |
| 只读上下文 | `src/ui/context.ts`、`src/arona-clicker/contracts/runtime.ts` |
| Workspace / 更新 | `src/ui/workspace/`、`src/ui/update/` |
| 测试 | `tests/ui/`，如 `controller-events.test.ts`、`workspace-router.test.ts` |

职责协作见 [[docs/docs-829/06-wiki/50-ui/00-index]]；UI 目录不代表详细机制或样式规范。
