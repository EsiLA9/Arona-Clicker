# 06-wiki/50-ui/refresh-update — 刷新与增量更新

> 本文回答：状态变化时，UI 怎样选择更新范围并阻止过期 DOM 更新。

## 更新层级

控制器提供整页 `render()`、`refreshPanels()`、轻量刷新和工作区区域刷新；更细的更新通过 `UIUpdateDispatcher` 调度。请求分为行为补丁、元素替换、命名区域刷新、工作区结构重建和应用结构重建。控制器记录各类更新命中、未命中和丢弃计数，便于观察刷新路径。

`UIUpdateDispatcher` 在微任务中合并相同身份的请求，过滤失效 Surface token，并优先处理结构、区域、元素、行为更新。应用结构更新会覆盖同批更新；工作区结构更新覆盖较窄的更新；已刷新的区域会抑制其子宿主上的元素/行为更新。控制器对商店区域批量合并后应用。

行为补丁只处理已挂载节点中的明确语义值，当前注册项包括资源数值、资源增益和 Spot 产出。元素更新针对 Spot 卡、强化卡和 Area 导航项；找不到宿主或节点时会回报未应用，由调用方按需采用更大范围刷新。

## 事件与节流

`controller-events.ts` 将游戏事件映射到适合的更新范围；`controller-core.ts` 处理揭示变化和轻量刷新。定时轻量刷新用于持续变化的读数，聊天打字状态变化只刷新聊天面板。结构或工作区身份改变时需要重新渲染；普通值变化优先使用已存在的局部更新入口。

Gameplay B Operation route 进入/退出时更新 Workspace structure。战斗行动、对手 / 设施意图、Individual / Global SceneAction 与每个玩家 `cardInstanceId` 都有独立牌面；牌面按所属人物、共享场地或手牌层锚定。已挂载 Surface 的战斗行动/目标/取消、SceneAction/玩家卡批次暂存与 Commit、路线转场及奖励领取命令经 Controller 获取一次新的 `OperationView`，并提交单一 `workspace.operation` region 请求；region morph 按稳定学生 / opponent / environment / card / route 身份同步内容，保留 Workspace frame、角色卡、主日志流、Action Dock、滚动锚点与可恢复焦点。SceneAction、执行者、目标和玩家卡选择只更新当前 Surface、内存 `OperationSceneDraft` 与总 Cost 预览，不查询 `OperationView`、不写 Run，也不重建 Workspace；Stage 优先从本地草稿构造批次，首次没有草稿时从本次已有 `OperationView` 初始化默认选择，再用同一投影校验后调用既有 Runtime 命令。普通悬停、滚动和焦点不触发 Resolver 或全 Workspace render。战斗行动与目标选择会提交修订命令，因此按单次 region 更新处理。该投影由 `GameReadModel.operationEntry.getView(expectedRunId?)` 窄查询提供，不扩展全局 GameView。

## 代码与测试

更新协议见 `src/ui/update/ui-update-types.ts`，Surface 代次见 `ui-surface.ts`，合并与优先级见 `ui-update-dispatcher.ts`，行为注册见 `ui-behaviors.ts`。Operation 局部更新见 `src/ui/controller.ts` 与 `src/ui/controller-actions-operation.ts`。测试见 `tests/ui/ui-update-dispatcher.test.ts`、`tests/ui/workspace-lifecycle.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`。
