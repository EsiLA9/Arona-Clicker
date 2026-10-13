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
- `components/operation-workspace.ts` 按我方 / 信息 / 敌方三栏布局：Combat 与显式启用 `autoCharacterActions` 的 Scene 都显示我方 Character Hand、默认 Action/Target、Wait 与 Intervention 状态；普通 Decision、Shop 和 SceneAction Scene 不自动选择 Character 行动。对手 Intent 附在右栏角色卡，环境/设施独立分组；中心 AC 聊天流承载地点、目标、玩家选择、路线、fixed/required SceneAction、独立 PlayerSceneDeck 手牌与 Resolution。Strategy Park 试玩在 Workspace 中另显示只读全图，转场仍走当前出口命令。
- `controller-actions-operation.ts` 经 Controller 调用 Runtime 的窄 Operation Entry 写 facade；战斗 Commit、暂存/结算场景批次、路线转场和奖励领取更新单个 `workspace.operation` region，路由进出才重建 Workspace。
- 本地内容命令台仅在 DEV + 显式 `?devConsole=gameplay-b` 时动态挂载，是 Gameplay B 的内存态测试工具，不写存档。保留角色快捷命令；`getValue modid:typeid:itemid [valueNum]` 严格按来源 Datapack 与 Registry 定义解析，首期支持 `resource` 增量、`chara` 单次获得、`spot` 单级提升，不支持 Area。命令仅在夏莱办公室使用，不自动进入 Run；应用成功后刷新界面。

只读 DTO 与 Runtime 边界见 [[docs/docs-829/03-data-structures/operation-view]]；Workspace 与更新细节见 [[docs/docs-829/06-wiki/50-ui/workspace-routing]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]。

## 关键阅读与测试

| 主题 | 路径 |
| --- | --- |
| 命令与 Controller | `src/ui/controller.ts`、`src/ui/controller-actions-*.ts` |
| 只读上下文 | `src/ui/context.ts`、`src/arona-clicker/contracts/runtime.ts` |
| Workspace / 更新 | `src/ui/workspace/`、`src/ui/update/` |
| 测试 | `tests/ui/`，如 `controller-events.test.ts`、`workspace-router.test.ts` |
| Gameplay B 本地命令台 | `src/ui/development/gameplay-b-quick-test-console.ts`、`tests/ui/gameplay-b-quick-test-console.test.ts` |

职责协作见 [[docs/docs-829/06-wiki/50-ui/00-index]]；UI 目录不代表详细机制或样式规范。
