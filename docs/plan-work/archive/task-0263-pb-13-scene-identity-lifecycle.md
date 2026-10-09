# Task 0263：PB-13 Scene 身份与独立生命周期

状态：completed — PB-13 已按 Goal Owner 裁定实现并通过 Runtime、View、checkpoint 与正式入口点击行为验证。
> Goal Owner 统一裁定（2026-10-08）：本 Task 原先待裁定的项目由 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]] 明确；下方“待裁定”条目是施工前历史，不再代表当前状态。
> 文档说明：事实表、架构门槛、施工切片与“当前核验”保留施工前记录；最终合同、验证结果和后续边界见“实施收尾与证据”。

## 目标

为一个由内容声明并可从 Operation 工作区启动的微型玩法 Scene 建立稳定身份、一次运行实例身份、最小生命周期和只读当前状态投影。此 Task 只建立可辨认的 Scene 边界，不重写战术 Beat、SceneAction、Location、路线或存档系统。

本 Task 覆盖 G03 中“玩家能够知道当前 Scene 是什么、处于什么阶段，并观察其完成与 Location 状态不同”的部分。

## 设计边界

- 本 Task 包含：提出并在人类裁定后实现 Scene ID、Scene instance identity、运行状态及其投影；为正式 Gameplay B 可选 bundle 加入一小段可点击样例；核对 Run/Location/Scene 生命周期边界。
- 明确非目标：Action 文案、统一 Offer / Plan / Resolution、内容编辑器、多 Scene 路由、全地图迁移、战斗或场景批次规则重写。
- 已裁定来源：draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md 记录目标与未决项。Roadmap 的 SceneDef / SceneRuntime 示例不作当前合同或已批设计。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| 当前 Operation Run 没有 sceneId、sceneInstanceId 或 Scene 状态字段。Run 公开 currentLocationId、locationProgress、beatIndex 和 EventRun 状态。 | src/arona-clicker/contracts/operation.ts：EventRun、OperationRunStatus、OperationLocationProgress；src/arona-clicker/services/operation-runtime-service.ts：MutableRun、createRun、OperationRuntimeService.start。 | 新身份与状态必须明确插入何层，不要复用 Location.completed 或 EventRun.status。 |
| 服务私有 RunSlot 持有唯一可变 Run；getSnapshot 返回冻结 detached 副本。 | src/arona-clicker/services/operation-runtime-service.ts：RunSlot、slot getter、getSnapshot；src/arona-clicker/runtime-game-instance.ts：GameInstance.#operationRuntimeOwner、operationEntry。 | Scene 状态不得被 UI 另持一份权威副本；owner 设计需人类裁定。 |
| Location 有访问次数、completed、beatCount、sceneActionBatchesUsed 和结果；事件拥有 Run 状态而非 PlayerState / InitSnapshot。 | src/arona-clicker/contracts/operation.ts：OperationLocationProgress / EventRun；docs/docs-829/03-data-structures/player-state.md：Gameplay B EventRun 归属。 | Scene lifecycle 与 Location / Event 生命周期分开；现有玩家进度不应混进该局内状态。 |
| interactionSceneId 是候选筛选上下文，不是场景运行身份。 | src/data-services/contracts/operation.ts：OperationLocationDef.interactionSceneId、OperationCardConditionDef.sceneIds；src/arona-clicker/services/operation-card-candidate-resolver.ts：matchesCondition；tests/engine/gameplay-b-strategy-park-sample.test.ts。 | 新 Scene ID 不得沿用该字段语义；避免名字相同但意义不同。 |
| 当前生命周期事件只报告 Run、Location、Beat、SceneAction batch 和 Event 结束。 | src/arona-clicker/contracts/operation.ts：OperationLifecycleEvent；tests/engine/operation-runtime-service.test.ts：“publishes only Run and Location lifecycle boundaries”。 | 是否需要 Scene 专属通知及其对 UI 刷新的价值由实施设计判断；不得把当前存在说成已有。 |
| Location completion 可自动完成路线决策；单出口时会推进 Location。 | src/arona-clicker/services/operation-runtime-service.ts：evaluateLocationProgress、completeCurrentLocation、advanceCompletedLocation、transitionRoute；tests/engine/operation-runtime-service.test.ts：路线转场 / 完成测试。 | Scene.completed 不能调用 Location completion 来伪装“场景完成”，除非另有明确 Location 规则。 |
| operationRun checkpoint 保存 EventRun，并以当前 Registry 内容和 resumeVersion 恢复。 | src/arona-clicker/contracts/save-data.ts：SaveData.operationRun；src/arona-clicker/contracts/operation-save.ts：OperationRunSaveSnapshot；src/arona-clicker/services/operation-runtime-service.ts：createSaveSnapshot、restoreSaveSnapshot、validateRestoredRun；tests/engine/gameplay-b-save-resume.test.ts。 | 若 SceneRuntime 需重启后保留，须明确是 EventRun 检查点内局部状态；不创建 Scene 自己的 SaveSystem，不加迁移层。 |
| SceneAction 包装与 sceneActionBatches 当前属于 Location。 | src/data-services/contracts/operation.ts：OperationSceneActionDef / OperationLocationDef；src/arona-clicker/contracts/operation.ts：OperationLocationProgress；tests/engine/operation-scene-actions.test.ts。 | 名称中含 Scene 的既有契约不能充当新 Scene lifecycle。 |

## 架构裁定门槛

开始 P1 代码前，人类须在 Draft 决定并写回：

1. Scene 是 Registry 独立定义还是由 Location / Event 嵌套声明；稳定 sceneId 的 ID 命名空间及引用边。
2. sceneInstanceId 是每次进入 Scene 生成、每个 Run/Location 首次生成，还是按其他明确的实例边界生成；再次完成、失败或重新进入时如何处理。
3. Scene 运行状态由 EventRun owner 统一持有还是由另一已有/新 owner 管理；什么服务是唯一写入口。
4. Scene 的 ready / active / completed 状态是否足够，哪些用户操作会触发状态转移，重复命令是否幂等。
5. Scene 局部状态是否要随现有 operationRun checkpoint 保存；若是，内容版本怎样由 resumeVersion 表达。不得因未决定而擅加 SaveData 层或历史迁移。

本 Task 的规划不替人类决定上述类型、字段、对象关系或状态 owner。

## 施工切片

### P0：架构裁定

- 在 Draft 记录上述决定及对应证据，并收敛本 Task 的实现边界、Read Set、Allowed Files 和行为测试要求。
- 如果需要新 Runtime owner、SaveData 新键、PlayerState / InitSnapshot 字段或新全局 EventBus 关系，应暂停本 Task 并先拆分/裁定 ADR；不得靠 Scene 名称推导。

### P1：最小身份与运行状态

- 按已裁定定义实现当前 Scene 身份和实例状态的唯一 owner、校验与只读 OperationView 投影。
- 对 stale runId / planVersion 和无效实例引用做行为覆盖。
- 为可见验收提供正式 Gameplay B bundle 内的小型 Scene 样例；不放在测试专用 test-datapack 作为玩家交付。

## 测试与验收

- [x] Runtime / projector tests verify ordered Scene progress is Run-local, detached, and restored from the existing EventRun checkpoint; stable identity is Event/Location/Scene path plus a Location-local Scene ID, without `sceneInstanceId`.
- [x] Operation Runtime, View and UI behavior tests plus TypeScript and generated-schema synchronization completed; see implementation closeout below.
- [x] **Clickable case**: the Registry UI test clicks the Operation entry, verifies exactly two Registry-derived students plus one environment Actor, the Scene title/active status, submits its SceneAction, then verifies Scene completed while the same Location remains in progress.

## 施工前核验记录（2026-10-08）

- 直接读取 operation.ts、runtime service、SaveData / OperationRunSaveSnapshot、player-state 机制文档、OperationView、相关 Runtime 与 save-resume 测试。
- 完整 GALHCG source 查询 sceneInstanceId 和 SceneRuntime 无命中；随后直接核对 Operation 契约。完整 source 查询 interactionSceneId 命中 OperationLocationDef、候选解析器和策略园样例。
- 未修改源码、测试、机制文档或索引；未运行测试 / 类型检查。

## 施工前 GALHCG 检索记录

- 发现路径：项目 acprogram；map EventRun 命中 operation-event-run-runtime、operation-run-lifecycle、operation-view-projection；sceneInstanceId / SceneRuntime / SceneAction 的 Concept 查询无命中（完整结果）。通过 source 字面查询并直接读取合同、服务与测试确认身份边界。
- 变更审查：本 Task 只新增规划文件，没有实现 paths 的 review_changes。
- 地图维护：不把 proposed Task 映射为实现证据；此阶段没有新的当前 Scene 实现关系可写。

## 实施收尾与证据（2026-10-08）

- Content contract: `OperationLocationDef.scenes[]` embeds ordered Scene definitions; omitted lists project an implicit singleton `main`. The ID is stable only within its Location; no separate Scene instance ID is created.
- State owner: `EventRun.locationProgress[locationId]` stores ordered `completedSceneIds` and per-Scene batch counts. Runtime validates completion as an ordered prefix, derives current Scene from the first incomplete definition, and keeps that progress across checkpoint resume and Location revisit within the same Run.
- Behavioral evidence: `tests/engine/operation-runtime-service.test.ts` covers A→B in one Location, commit-based Scene completion, same-Location progression and checkpoint restore; `tests/engine/operation-view-projector.test.ts` covers the implicit `main` status after Location completion; `tests/ui/gameplay-b-operation-entry-registry.test.ts` exercises actual Controller click/start/submit through the formal bundle.
- Verification: targeted Runtime/SceneAction/View/entry UI tests passed (see final task report); `npx tsc --noEmit` and `npm run gen:schema` passed.

## 后续边界（G04 / G05）

- PB-22 still requires a separate Event proving SceneAction-driven A→B; the G03 two-Scene Battle Beat test is not that acceptance case.
- G05 owns authoring editor UX and any content authoring workflow expansion.

## 相关路由

draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/03-data-structures/player-state]] · [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/docs-829/05-conventions/testing]] · [[docs/ai/context-packs/world-lifecycle]]
