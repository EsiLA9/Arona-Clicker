# OperationView — Gameplay B 只读投影

> 本文说明 Gameplay B EventRun 面向 UI 的独立只读快照；精确字段以 `src/arona-clicker/contracts/operation-view.ts` 为准。

## 归属与边界

- `EventRun` 是当前 Gameplay B 战斗的真实局内状态，由 Runtime 私有的 `OperationRuntimeService` 持有；它不是 `PlayerState` 的字段。`OperationView` 是从 Run 计算出的 detached 只读 UI 投影，不是状态 owner，也不会写进存档。
- 产品 `SaveData` 可另带可选的 `operationRun` 检查点；`save()` 通过 Operation Entry 生成它，`load()` 再单独恢复。这个保存片段不改变 EventRun 与 PlayerState 的分开归属；当前 View 也不是保存格式。
- `GameReadModel.operationEntry` 只暴露 `OperationViewQuery.getView(expectedRunId?)`；启动、修订、取消和 Commit 由 Controller action 调用 Runtime 上的窄 Operation Entry facade。两者是分离的读写边界。
- Runtime owner 保持私有。UI 不读取 EventRun、冻结规则、resolver、ActionDef 或 mutable GameInstance 内容。
- `expectedRunId` 与当前 Run 不一致、Run 不可用或缺少 UI 所需战术内容时返回 `null`，防止过期 route 显示另一个 Run。

## 投影内容

投影包括当前 Event / Location、版本与 Beat、轨道/事实/持有物、事件与地点目标进度、Actor 与 Team、基础计划和干预后计划、合法战术 Action / Target 候选及阻塞理由、协同预览、Commit 状态、Resolution 历史和序号。`OperationViewActor` 带 detached `displayName`、`avatarRef`、`hp`、`maxHp` 与 `participantKind`，左/右身份卡不需要 UI 反查可变角色或 Runtime 数据。玩家场景投影提供当前共享 PlayerCost、离场 `maxCarryCost`、Location `actionMode`、SceneAction 的作者文案、费用、`performerPolicy` / `selectionPolicy`、合格执行学生与按执行者区分的合法目标，以及可就地激活时按绝对 Actor ID/type 过滤的 `legalActorlessTargetActorIds`；同时投影批次已用/剩余、待提交批次草稿、实际选择费用预览、drawPile/discard 数量、可用 hand 实例的作者文案和选择策略，以及每次地点入场的 Cost 记录。Action、SceneAction 与 PlayerSceneCard 的当前及历史显示文案均来自内容投影；候选只含 UI-safe 数据，不暴露 Action 定义，也不依赖 Location SceneAction 的当前模式筛选。RouteView 包含每个 Location 的访问计数/上限/当前位置/已访问/完成状态，以及全图 RouteEdge 的来源、目标、标签、凭证要求和是否消费。仅当前 Location 的出口投影可用或锁定原因；其他地点的边为未评估状态，不代表可立即转场。它还提供当前出口列表、转场历史、总访问数与事件访问上限；不包含可写规则或完整 Run。角色技能结果只保留是否成功；tactical RNG cursor、roll 测量、原始规则对象和完整 Run 不出现在 UI DTO。终局还投影奖励是否已领取。

写命令重算候选时，projector 复用冻结规则上的纯干预预览与 Combination resolver；读取 View 不调用内容 resolver、不写 EventRun、不推进随机游标。返回结构深度脱离 owner 当前状态。

## AC UI 消费路径

Operation route 持有 `runId`，由 Workspace Renderer 在进入或重建 route 时查询投影。已挂载 Workspace 中的战斗行动/目标/取消、SceneAction 与玩家卡批次暂存/结算、路线转场和奖励领取由 Controller 经 `operationEntry` 执行；每次命令最多读取一次新投影，再请求一个 `workspace.operation` region 更新。route 进出属于 workspace structure 更新。

学生卡同时是统一的角色持牌锚点（`data-operation-actor-hand`）。UI adapter `projectOperationActorHand()` 将战斗候选、已分配的场景行动和 SceneDraft 中的玩家实体牌规整为 `OperationActorHandCardView`（身份、牌种/来源、owner、锁定/选中状态、执行者候选、合法目标和费用）；组件再按来源绘制牌面。战斗 CharacterHand 行动牌由只读 Action options 与当前计划在角色锚点附近呈现；非战斗 SceneAction 和已分配执行者的 PlayerSceneCard 则从当前 View 加上 UI 内存中的可撤销 SceneDraft 投影到该角色牌槽。未分配或就地激活的 SceneAction / PlayerSceneCard 留在公共场景区/手牌区。`performerPolicy` 可指定必须学生、禁止学生（就地激活）或 `optional-student`（就地激活/学生执行二选一）；Actorless Actor Target 由绝对 ID/type filters 限定。Scene 批次的 `required` 项是玩家可选项，不再要求每名学生/全局必须选满；每名学生至多选一项、Global 至多选一项，零选等价跳过当前批次。fixed 牌仍自动加入且不可取消。PlayerCost 按固定项与实际加入项汇总，只要不超过余额即可提交，余额剩余保留。多名合法目标可拖放改选；唯一合法目标作为固定指向展示，无目标牌不开放目标拖放。卡牌关系线按出牌与目标的几何方位连接左右/上下边，卡片重叠时连接到目标最靠近卡牌的一侧；hover/focus 与拖放共享算法，只更新现有 SVG path。

实现与回归测试：`src/arona-clicker/contracts/operation-view.ts`、`src/arona-clicker/services/operation-view-projector.ts`、`src/ui/workspace/workspace-renderer.ts`、`src/ui/components/operation-workspace.ts`、`tests/engine/gameplay-b-event-runtime-integration.test.ts`、`tests/ui/operation-workspace-view.test.ts`、`tests/ui/gameplay-b-operation-controller.test.ts`、`tests/ui/gameplay-b-card-inspector.test.ts`。

相关机制：[[operation-runtime]]；UI 路由：[[docs/docs-829/06-wiki/50-ui/workspace-routing]]。
