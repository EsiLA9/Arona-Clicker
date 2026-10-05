# 06-wiki/50-ui/workspace-routing — 工作区路由

> 本文回答：游戏主界面、服务页和实体工作区如何确定当前页面与返回位置。

## 路由模型

`src/ui/workspace/workspace-router.ts` 定义 `WorkspaceRoute`：游戏、服务、商店、角色、通讯录、剧情和 Operation。路由是当前页面身份；`WorkspaceLocation` 只保存单层返回时需要恢复的 UI 位置，包括旧式服务/工作区字段及左右中面板标签、选中角色和对话角色。

`enterWorkspaceNavigation()` 进入新工作区并记下返回位置；`replaceWorkspaceNavigation()` 替换当前路由而保留已有返回点；`backWorkspaceNavigation()` 恢复返回位置，缺少返回点时回到游戏页。服务页路由由 `routeForService()` 规范化。旧式 `service`/`workspace` 状态仍可通过 `routeFromLegacyState()` 投影为路由。

控制器在 `controller.ts` 执行进入、替换和返回；`components/app-shell.ts` 提供工作区状态类型，`workspace-renderer.ts` 将当前状态渲染为对应工作区。

Contacts 与 Story Workspace 的左、中、右列均以 `renderPanelHeaderRegion(ctx, slot, ...)` 标题区开始，分别复用 `leftPanel.tabs`、`centerPanel.tabs`、`rightPanel.tabs` 宿主和 `panel-tabs-region` 等高规则。只有左侧导航列的标题区带有无障碍名称的本地 SVG 返回键，并保留现有 Workspace 返回动作；它按进入时保存的返回位置退出当前工作区。中栏和右栏标题只标识该列内容，不承担页面跳转。

Operation route 以 `runId` 标识当前易失 Run，并由 `workspace-renderer.ts` 通过 `GameReadModel.operationEntry.getView(runId)` 请求 detached 投影。正式 Operation Surface 使用左 / 中 / 右三栏：左栏角色卡持有学生当前计划与战斗干预，中心 AC 聊天流承载事件、地点、目标、玩家决定、SceneAction/有限手牌、路线及结算，右栏角色卡持有敌方 Intent 并独立展示环境/设施。Cost 槽位留在中心底部 Action Dock。操作命令经 Controller 调用 Runtime 私有 Operation Entry facade；只读查询与写命令不混入全局 GameView / GameCommands。返回使用单层 Workspace 返回位置恢复 AC 聊天流；Run 本身仍由 GameInstance 私有 owner 持有，并按主 SaveData 中的可选 checkpoint 显式恢复。

## Surface 生命周期

`UISurfaceRuntime` 通过路由和工作区子状态产生稳定 `key`，并配合 `generation` 标识挂载代数。切换页面身份会递增代数并清除已挂载标记；重挂载也会让旧代次失效。更新请求携带 token，只有与当前且已挂载 Surface 一致时才可应用。

## 代码与测试

路由与 Surface 见 `src/ui/workspace/workspace-router.ts`、`src/ui/update/ui-surface.ts`。`tests/ui/workspace-router.test.ts` 验证进入、替换、返回与旧式状态转换；`tests/ui/workspace-lifecycle.test.ts`、`tests/ui/workspace-frame.test.ts` 覆盖工作区渲染和生命周期。
