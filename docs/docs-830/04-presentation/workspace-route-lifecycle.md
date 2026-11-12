# Workspace 路由：页面身份、进入与返回

本文解释游戏界面如何识别当前 Workspace、保存来源位置和决定返回目标。Workspace 总览见 [[workspace-navigation-and-rendering]]。

## 路由是什么

`WorkspaceRoute` 是一个带 `kind` 的页面描述：例如 `game`、`service`、`shop`、`character`、`story`、`area`、`map` 或 `operation`。需要区分具体实例的种类同时携带 `sessionId`、`variantId`、`areaId`、`mapId` 或 `runId`。

路由负责**显示哪个页面**。例如 Operation 路由携带 `runId` 以定位只读视图，但本身不保存 Operation Run；业务过程仍由 Runtime owner 管理。`workspaceRouteKey()` 根据路由种类和标识符构造身份 key；`sameWorkspaceRoute()` 比较这些 key。

## 返回位置不是历史栈

`WorkspaceNavigationState` 包含当前 route 和可选的一个 `returnTo`。返回位置 `WorkspaceLocation` 记录来源路由、左中右面板选择、所选角色与对话角色；它不是无限页面历史，也不是业务状态快照。

| 操作 | 函数 | 返回位置 |
| --- | --- | --- |
| 进入新 Workspace | `enterWorkspaceNavigation()` | 使用调用方传入的来源位置；如果此前已有返回位置，会被新的来源覆盖。 |
| 在当前流程中替换页面 | `replaceWorkspaceNavigation()` | 保留原有返回位置，不增加一层历史。 |
| 返回 | `backWorkspaceNavigation()` | 恢复来源路由并清除 `returnTo`；没有来源时默认回到 game。 |

## 例子：从游戏进入商店，再进入剧情

1. 当前为游戏页，保存游戏页的面板和角色选择作为 `gameLocation`。
2. 进入商店：当前路由变成该商店，返回位置为 `gameLocation`。
3. 从商店进入剧情，并传入商店位置：当前为剧情，返回位置变为商店位置。
4. 返回时回到商店，并清空这次返回位置；导航对象没有保留更早的一整串历史。

上述路由状态由 `tests/ui/workspace/workspace-router.test.ts` 的 `进入新 Workspace 时只保留一个返回位置` 覆盖。Controller 还负责实际恢复面板位置和处理页面相关会话，不能把纯路由测试视为完整界面验收。

## 身份与刷新如何配合

同种路由的不同实例可能具有不同 route key，例如两个不同 `runId` 的 Operation 路由不是同一页面。Surface 使用自己的 key 和挂载 generation 判断更新是否过期；Surface key 不一定与 route key 完全相同，具体见 [[update-dispatch-and-surface]]。

源码：`src/ui/workspace/workspace-router.ts`、`src/ui/workspace/workspace-renderer.ts`、`src/ui/controller/controller.ts`、`src/ui/update/ui-surface.ts`。测试：`tests/ui/workspace/workspace-router.test.ts`、`tests/ui/workspace/workspace-lifecycle.test.ts`。
