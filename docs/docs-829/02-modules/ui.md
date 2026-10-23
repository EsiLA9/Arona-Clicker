# 02-modules/ui — 游戏 UI 模块卡

> 本文回答：`src/ui/` 如何处理游戏界面输入、页面路由、渲染与只读数据消费。

## 职责边界

- `main.ts` 启动 App Runtime 并挂载 `UIController`。
- Controller / Actions 将输入变成 `GameCommands`，处理 UI 生命周期、刷新和 Workspace 路由。
- Components 根据 `UIContext` 生成视图；不直接持有 PlayerState 写引用。
- `runtime/context.ts` 组合 GameView、GameReadModel 与表现查询；样式位于 `css/`。
- 游戏内内容编辑器位于 `runtime-editor/`，独立 Datapack Editor 位于 `tools/datapack-editor/`。

## 源码组织

- `components/` 按地图、世界、Operation、角色、库存、剧情、设置、提示信息与共享界面归组。
- `controller/` 集中 Controller 与用户动作；`runtime/` 放置 UI 运行时上下文和宿主注册；`presentation/`、`interaction/`、`navigation/` 与 `utilities/` 分别容纳表现、交互、导航和通用工具。
- `workspace/`、`flow/`、`update/`、`runtime-editor/` 与 `css/` 保持独立职责。

## Gameplay B Operation Surface

- `workspace/workspace-router.ts` 将 Operation Run ID 表达为独立 route；`workspace/workspace-renderer.ts` 通过只读 `GameReadModel.operationEntry.getView(runId)` 获取投影。
- `components/operation/operation-workspace.ts` 按我方 / 信息 / 敌方三栏布局：Combat 与显式启用 `autoCharacterActions` 的 Scene 都显示我方 Character Hand、默认 Action/Target、Wait 与 Intervention 状态；普通 Decision、Shop 和 SceneAction Scene 不自动选择 Character 行动。对手 Intent 附在右栏角色卡，环境/设施独立分组；中心 AC 聊天流承载地点、目标、玩家选择、路线、fixed/required SceneAction、独立 PlayerSceneDeck 手牌与 Resolution。Strategy Park 试玩在 Workspace 中另显示只读全图，转场仍走当前出口命令。
- `controller/controller-actions-operation.ts` 经 Controller 调用 Runtime 的窄 Operation Entry 写 facade；战斗 Commit、暂存/结算场景批次、路线转场和奖励领取更新单个 `workspace.operation` region，路由进出才重建 Workspace。
- 本地内容命令台仅在 DEV + 显式 `?devConsole=gameplay-b` 时动态挂载，是 Gameplay B 的内存态测试工具，不写存档。保留角色快捷命令；`getValue modid:typeid:itemid [valueNum]` 严格按来源 Datapack 与 Registry 定义解析，首期支持 `resource` 增量、`chara` 单次获得、`spot` 单级提升，不支持 Area。`startMap modid:map:itemid` 仅能启动已加载 Map；`--enter-office` 经现有 Init 恢复流程从选择页进入夏莱办公室，`--move-to nodeId`、`--ability actionId`、`--target-party characterId` / `--target-enemy enemyId` 与 `--commit-rounds 1–20` 可在同一白名单命令中自动准备并提交有限回合，便于重复运行样例。固定队伍准入与 MapRun Owner 仍是启动权威；进行中的 MapRun 不可覆盖。其他命令仍要求当前处于夏莱办公室。参数语法与执行顺序见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U14g-gameplay-b-console-map-operations]]。

只读 DTO 与 Runtime 边界见 [[docs/docs-829/03-data-structures/operation-view]]；Workspace 与更新细节见 [[docs/docs-829/06-wiki/50-ui/workspace-routing]]、[[docs/docs-829/06-wiki/50-ui/refresh-update]]。

## 关键阅读与测试

| 主题 | 路径 |
| --- | --- |
| 命令与 Controller | `src/ui/controller/controller.ts`、`src/ui/controller/controller-actions-*.ts` |
| 只读上下文 | `src/ui/runtime/context.ts`、`src/arona-clicker/contracts/runtime/runtime.ts` |
| Workspace / 更新 | `src/ui/workspace/`、`src/ui/update/` |
| 测试 | `tests/ui/`，如 `controller-events.test.ts`、`workspace-router.test.ts` |
| Gameplay B 本地命令台 | `src/ui/development/gameplay-b-quick-test-console.ts`、`tests/ui/gameplay-b-quick-test-console.test.ts` |

职责协作见 [[docs/docs-829/06-wiki/50-ui/00-index]]；UI 目录不代表详细机制或样式规范。
