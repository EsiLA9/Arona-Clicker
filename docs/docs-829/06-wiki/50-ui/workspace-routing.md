# 06-wiki/50-ui/workspace-routing — 页面身份与返回位置

Workspace 是一个承载完整页面内容的界面工作区，例如游戏页、服务页、商店、角色、通讯录、剧情或 Operation。**路由（route）**说明当前显示哪种 Workspace；路由本身不拥有 PlayerState 或业务流程数据。

## 当前页面与返回位置

`src/ui/workspace/workspace-router.ts` 定义 `WorkspaceRoute`、路由身份 key 以及纯状态变换函数。`WorkspaceNavigationState` 保存当前路由和一个可选的 `returnTo`；它是单层返回位置，不是可无限前进 / 后退的历史栈。返回位置额外记录左右中面板标签、所选角色和对话角色等可恢复的 UI 位置。

- `enterWorkspaceRoute()` 进入 Workspace 时记下来源位置。
- `replaceWorkspaceRoute()` 改变当前轻量定位时保留已有返回点，不再额外叠一层。
- `disposeWorkspace()` 根据保存位置恢复路由及相关 UI 选择。
- `routeFromLegacyState()` 兼容旧的 `service` / `workspace` 状态表示。

`src/ui/workspace/workspace-renderer.ts` 根据当前路由调用对应 `render*Workspace()`；所以路由选择是组件调用的输入，并不直接生成 DOM。

## UI 路由不是 Run 数据

Operation route 用 `runId` 标识正在显示的 Run。`workspace-renderer.ts` 再通过 `GameReadModel.operationEntry.getView(runId)` 查询只读投影。路由只负责选中并定位 Workspace；Run 内容由专用只读查询和 Operation Runtime 持有。其它 Workspace 也会通过专用状态对象 / 查询端口补充界面所需内容。

## Surface 身份保护

`UISurfaceRuntime` 将 Workspace 身份映射为 `key`，并在 DOM 挂载或身份变化时更新 `generation`（挂载代数）。一次局部更新带着生成请求时的 token；若页面已切换或重新挂载，旧 token 与当前 Surface 不符，该更新会被丢弃，避免把旧页面内容写进新页面。

## 测试入口

`tests/ui/workspace-router.test.ts` 验证服务页映射、进入 / 替换 / 返回、Operation `runId` 身份和旧式状态转换；`tests/ui/workspace-lifecycle.test.ts`、`workspace-frame.test.ts` 验证 Workspace 生命周期与框架。旧请求过滤另见 `tests/ui/ui-update-dispatcher.test.ts`。

工作区如何触发 DOM 更新：[[docs/docs-829/06-wiki/50-ui/refresh-update]]。写入与只读查询边界：[[docs/docs-829/06-wiki/50-ui/controller-commands]]、[[docs/docs-829/06-wiki/50-ui/read-model-context]]。返回 [[docs/docs-829/06-wiki/50-ui/00-index]]。
