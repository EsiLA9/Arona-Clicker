# Task 0268：PB-18 分离 Scene 完成与 Location 离开

状态：completed — Scene completed 与 Location completed / Route transition 保持独立，并已通过 Runtime、View、正式入口 UI 行为验证。
> Goal Owner 统一裁定（2026-10-08）：PB-18 的当前完成边界见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；早期待裁定措辞保留为历史。
> 文档说明：事实表、架构门槛、施工切片与“当前核验”保留施工前记录；最终合同、验证结果和后续边界见“实施收尾与证据”。

## 目标

清楚区分微型 Scene 自身已完成与玩家已经完成 / 离开当前 Location。完成 Scene 只产生它自己的可读完成结果；Location / Event 继续按自身目标、Route Gate、访问上限和终局条件决定后续流程。Operation UI 不得按特定地点 ID 推断 Scene 完成、自动开放路线或自动离场。

本 Task 交付 G03 最后的玩家差异：场景已收尾，但玩家仍留在同一地点，且可以查看 Location / Route 流程当前允许什么、阻止什么。

## 设计边界

- 本 Task 包含：Scene completed 与 Location progress 的独立读取及呈现、Scene 完成后的留场行为、Location / Event 既有路线 Gate 不变。
- 明确非目标：Location graph / route rewrite、同一 Location 多 Scene 排程、根据 Scene completed 新建 Route 分支、任何地点 ID UI 特判、Scene 自有地图和全局奖励。
- 已裁定来源：draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md；多 Scene 连续流程与真实地点迁移在 G04。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 当前 Operation 表示 Location completed/result 和 EventRun status；没有 Scene completed。 | src/arona-clicker/contracts/operation.ts：OperationLocationProgress、OperationRunStatus、EventRun；src/arona-clicker/contracts/operation-view.ts：OperationView.locationProgress / map nodes。 | UI 需要将新 Scene 状态明确投影成与 Location 完成不同的数据；不能重用 Location.completed。 |
| Location 完成会运行 Location objective / outcome 评估；满足后发布 locationCompleted 并调用 advanceCompletedLocation。 | src/arona-clicker/services/operation-runtime-service.ts：evaluateLocationProgress、commitBeat、completeCurrentLocation。 | Scene completion 不能复用该命令或触发该链路。 |
| Location route evaluator 按当前 Location 的出口、Gate、持有物和访问次数计算开放原因；路线只有在来源 Location completed 且有 result 后才能转场。 | src/arona-clicker/services/operation-route-evaluator.ts：evaluateOperationRoutes；src/arona-clicker/services/operation-runtime-service.ts：transitionRoute / commitRouteTransition；tests/engine/operation-runtime-service.test.ts：credential gate、stale route 和 max visit 锁定理由。 | 保留 Location/Route 的现有职责与原因 projection；新 Scene完成不能偷偷变路线规则。 |
| 当前 SceneActionBatch 次数可以作为 Location objective / 完成门槛；跳过批次消耗额度但不伪造 Action effect。 | src/arona-clicker/services/operation-runtime-service.ts：evaluateLocationProgress / commitSceneActionBatch；tests/engine/operation-scene-actions.test.ts：skip batch leaves Location incomplete。 | 不把 sceneActionBatchesUsed >= limit 等同 Scene.completed；也不把 Scene 结束混入可跳过批次。 |
| UI map node 展示 Location visit / completed；Operation workspace 的 scene controls 按 actionMode、剩余批次与 draft 控制。 | src/arona-clicker/contracts/operation-view.ts：OperationViewMapNode / OperationView；src/arona-clicker/services/operation-view-projector.ts：projectOperationView；src/ui/components/operation-workspace.ts：renderRoutes / renderSceneControls。 | Scene 状态需单独展示；不能把它画成另一个 Location 或地图节点。 |
| Event 结局和 AC reward 分属 Location 完成后 Event outcome、显式 claimReward 流程。 | src/arona-clicker/services/operation-runtime-service.ts：finish / claimOutcomeReward；docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md。 | Scene 只给自己的结果，不结算 Event terminal award。 |

## 架构裁定门槛

- 在人类裁定的 Scene lifecycle 中，completed 是否允许再次启动 / 重入；状态是否是一次 instance 或稳定 SceneDefinition 的进度。
- 本 Task 的 Scene result 是布尔完成还是更细结果；不得照搬 Event / Location success / partialSuccess / failure 语义而无理由。
- Scene completed 后，UI 是等待玩家在同一 Location 继续、结束 Operation、还是由 Location / Event 规则另外开放下一流程；G03 仅保证 Scene 本身不会决定空间转场。
- Route remains locked / opened 的 criteria 只能来源于现有 Location / Event Gate；如需新声明逻辑，另立 Task / 由人类裁定。

## 施工切片

### P0：Scene 结果与空间流程边界

- 将 Scene completion 输入 / 输出和 OperationLocationProgress / RouteView 对照，列明各自状态来源与命令 owner。
- 不在 Scene 完成处理函数里调用 completeCurrentLocation、transitionRoute 或 finish。

### P1：留场与可解释的 Location 状态

- 提交 Scene 完成后刷新 Scene 结果；留在原 currentLocationId，RouteView 继续显示 Location / Event 条件。
- 在有阻塞路线的样例中呈现真实 Location Gate 原因；Scene UI 不按地点或事件名称硬编码路径。

## 测试与验收

- [x] Runtime tests assert completing an ordered Scene leaves `currentLocationId`, Location completion/result, Route history and EventRun status unchanged; explicit Location completion remains a separate command.
- [x] Existing Route evaluator tests still cover Location objective, held-item gates and visit limits; Scene completion does not call Route transition.
- [x] Operation workspace test asserts `data-scene-status="completed"` and visible “已完成” while the Location status stays `inProgress`; no map node is added for the Scene.
- [x] Registry click-flow test starts the formal micro Event, submits a SceneAction through the controller, and checks Scene completion, unchanged Location and empty route history.

## 施工前核验记录（2026-10-08）

- 阅读 EventRun / Location progress / OperationView 合同、route evaluator、Runtime complete / transition / finish 方法，核对 Operation Runtime 和 SceneAction tests 的 route 与 skipped-batch 案例。
- 当前 completeCurrentLocation() 是 Location 命令，且可能推动自动单出口路线；这与新 Scene completion 不可互换。
- 未修改源码、测试或机制文档；未运行测试 / 类型检查。

## 施工前 GALHCG 检索记录

- 发现路径：项目 acprogram；查 EventRun / OperationView Projection 节点及 source Location lifecycle、route gate、Scene batch 完成入口，直接核对当前文档 / tests。
- 变更审查：本 Task 仅新增规划文档，没有实现 paths 需审查。
- 地图维护：不将 proposed Scene / Location 分离写成 current implementation evidence；实现后按 GALHCG review_changes 定向维护。

## 实施收尾与证据（2026-10-08）

- Scene is complete only when the active Scene's declared predicate is satisfied by a successful non-empty commit; SceneAction empty skip cannot advance it. Completion is stored in `completedSceneIds` and derived separately from Location status.
- The sample does not declare Location objectives or routes, so its UI click test proves the intended state (`Scene=completed`, `Location=inProgress`, same location ID, no route history). A separately completed Location continues through the existing Route / Event outcome path.
- Implicit singleton `main` displays completed when the Location completes; this closes the one remaining projection edge found in review.

## 后续边界（G04 / G05）

- G04 handles real Location and multi-Scene scenario migration; G05 handles authoring editor UX and legacy special-case removal.

## 相关路由

draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/03-data-structures/player-state]] · [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/docs-829/05-conventions/testing]]
