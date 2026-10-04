# 06-wiki/50-ui/workspace-routing — 工作区路由

> 本文回答：游戏主界面、服务页和实体工作区如何确定当前页面与返回位置。

## 路由模型

`src/ui/workspace/workspace-router.ts` 定义 `WorkspaceRoute`：游戏、服务、商店、角色、通讯录和剧情。路由是当前页面身份；`WorkspaceLocation` 只保存单层返回时需要恢复的 UI 位置，包括旧式服务/工作区字段及左右中面板标签、选中角色和对话角色。

`enterWorkspaceNavigation()` 进入新工作区并记下返回位置；`replaceWorkspaceNavigation()` 替换当前路由而保留已有返回点；`backWorkspaceNavigation()` 恢复返回位置，缺少返回点时回到游戏页。服务页路由由 `routeForService()` 规范化。旧式 `service`/`workspace` 状态仍可通过 `routeFromLegacyState()` 投影为路由。

控制器在 `controller.ts` 执行进入、替换和返回；`components/app-shell.ts` 提供工作区状态类型，`workspace-renderer.ts` 将当前状态渲染为对应工作区。

## Surface 生命周期

`UISurfaceRuntime` 通过路由和工作区子状态产生稳定 `key`，并配合 `generation` 标识挂载代数。切换页面身份会递增代数并清除已挂载标记；重挂载也会让旧代次失效。更新请求携带 token，只有与当前且已挂载 Surface 一致时才可应用。

## 代码与测试

路由与 Surface 见 `src/ui/workspace/workspace-router.ts`、`src/ui/update/ui-surface.ts`。`tests/ui/workspace-router.test.ts` 验证进入、替换、返回与旧式状态转换；`tests/ui/workspace-lifecycle.test.ts`、`tests/ui/workspace-frame.test.ts` 覆盖工作区渲染和生命周期。
