# Task 0266：PB-16 Scene 计划及纯预览

状态：completed — 已实现轻量 `OperationScenePlan` 值投影、Runtime 纯 Preview 与可撤销 UI-local SceneDraft；提交前仍由 Runtime 重新校验。
> Goal Owner 统一裁定（2026-10-08）：本 Task 的 Plan / Preview / Draft 默认边界见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]；原待裁定段落为施工前记录。
> 文档说明：事实表、架构门槛、施工切片与“当前核验”保留施工前记录；最终合同、验证结果和后续边界见“实施收尾与证据”。

## 目标

为独立 Scene 提供一个可撤销的计划视图和纯预览入口。预览根据当前可信 Action / Offer、执行者、目标与费用返回选择结果、资源变化预测和阻塞原因；未提交预览不改变 EventRun、HP、Cost、事实、物品、手牌或随机流。复用现有 Runtime 合法性和 Cost 计算，不在 Controller 重算规则。

## 设计边界

- 本 Task 包含：Scene 计划的编辑 / 读取 / 纯预览，并根据 Run ID、Scene 身份和版本拒绝过期选择；Operation workspace 提供即时反馈。
- 明确非目标：提交 / 结算、Effect 重写、全局 StateMutation、save schema 迁移、战术与场景命令统一、Location route 逻辑。
- 已裁定来源：draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md；ScenePlan 是选择描述，不是状态写入；preview 只读。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| SceneActionBatchCommand 接收 runId、planVersion、selections / cards；命令不接收 cost 或 effect。 | src/arona-clicker/contracts/operation-scene-action.ts：OperationSceneActionBatchCommand；src/arona-clicker/services/operation-runtime-service.ts：parseSceneActionBatchCommand。 | ScenePlan 若开放作者输入，也只接受选择引用，由 Runtime 重算可信规则。 |
| previewSceneActionBatch 纯计算；stageSceneActionBatch 另将 draft / preview 写进 Run；clear 可撤销；commitStaged 再校验版本和 preview。 | src/arona-clicker/services/operation-runtime-service.ts：previewSceneActionBatch、stageSceneActionBatch、clearSceneActionBatchDraft、commitStagedSceneActionBatch；tests/engine/operation-scene-actions.test.ts：preview 不改余额、staged batch round-trip。 | 需明确 ScenePlan 与既有暂存命令分别承担什么，不假称 Scene draft 自动存档。 |
| UI OperationSceneDraft 以 runId、planVersion、locationId 存在 UI 本地 draft 存储，不是独立的 Runtime ScenePlan。 | src/ui/components/operation-workspace.ts：readOperationSceneDraft / saveOperationSceneDraft；src/ui/controller-actions-operation.ts：saveSceneDraftFromWorkspace。 | 计划投影与可写 Runtime 暂存分开；仅允许一种权威写入源。 |
| 战术 PreparedBeat 是 Runtime 生成的规范计划；interventionDraft 有单学生槽和纯 preview。 | src/arona-clicker/contracts/operation-beat.ts：PreparedBeat、OperationInterventionDraft、OperationInterventionPreview；src/arona-clicker/services/operation-intervention-preview.ts。 | ScenePlan 可能复用合法性算法但不应强行伪装为 PreparedBeat 或改写战术干预合同。 |
| 现有批次预览同时返回 PlayerCost 与 ActionDef Actor/Team resource costs。 | src/arona-clicker/contracts/operation-scene-action.ts：OperationSceneActionBatchPreview；src/arona-clicker/services/operation-runtime-service.ts：sceneActionBatchPreview；src/arona-clicker/services/operation-resolution-planner.ts：planSceneBatch。 | 预览不得把不同费用 owner 混为相同资源字段；要显示规则来源。 |
| stale plan / 不可负担批次拒绝并保持 Run 快照不变。 | tests/engine/operation-scene-actions.test.ts：“stale selections and caller-supplied cost/effects are not accepted”、“counts a PlayerSceneCard with the SceneAction fee and rejects an unaffordable batch atomically”；tests/engine/operation-intervention-preview.test.ts。 | 新计划预览需沿用版本和纯计算不变式。 |

## 架构裁定门槛

- ScenePlan 是 UI 当前编辑态的只读投影、Runtime 保存的 staged draft，或两者分离；不可复用同一词表达不同生命周期。
- ScenePlan 是否跨 Action 来源混合、由哪些稳定 ID 引用 offer，以及空计划 / fixed item 的展示和选择语义。
- preview 接口是否按既有 Scene batch 扩展，或只作薄 Scene adapter；是否可组合 Battle PreparedBeat 与 Scene batch需明确，不由“统一”一词自动决定。
- version 是否复用 Run planVersion，如何同时校验 sceneInstanceId / 当前 Scene 身份。

## 施工切片

### P0：Plan / Draft / stage 名称和 owner

- 将 UI 的 SceneDraft、OperationRun.pendingSceneActionBatch、PreparedBeat 与新 ScenePlan 放在一张对照表，明确各自生命周期。
- 锁定纯预览不会写 EventRun、扣费、移牌、发 effect 或推进 random cursor 的边界。

### P1：纯预览与交互反馈

- 从 Runtime 可信快照计算选中行为、执行者、目标、预计费用 / 资源变动和不可用理由。
- UI 选择修改后只刷新所需 Operation 区域；commit 前展示完整的费用与目标反馈。

## 测试与验收

- [x] Scene batch pure preview is detached and repeatable; Runtime tests prove preview does not write Run state or tactical RNG, while stale / invalid / unaffordable inputs are rejected.
- [x] `OperationScenePlan` binds Run, Event, version, Location, Scene, selected actions and card instances; `OperationSceneDraft` remains UI-local, while `pendingSceneActionBatch` exists only after explicit Runtime staging.
- [x] Registry UI behavior test selects a valid SceneAction and submits through Runtime; scene batch tests cover empty skip, target/cost validation and no-write failures.

## 施工前核验记录（2026-10-08）

- 核对 OperationSceneActionBatchCommand / Preview / Draft、Operation Beat preparation / intervention preview、Runtime scene batch methods、UI SceneDraft 存储及 scene-action / intervention tests。
- 明确现有 scene batch preview 不能代表独立 ScenePlan 已经存在。
- 未修改源码或测试；未运行测试 / 类型检查。

## 施工前 GALHCG 检索记录

- 发现路径：map EventRun 与 OperationView 概念；查 source ScenePlan / SceneRuntime 完整无命中后，读取 Operation contracts、Runtime、UI draft 和对应测试。
- 变更审查：只新增规划文件，不涉及实现 review_changes。
- 地图维护：ScenePlan 仍是 proposed，不映射为当前 Runtime 实现。

## 实施收尾与证据（2026-10-08）

- `OperationScenePlan` is a value in the preview result, not an owner. It binds the current Scene and version to selected SceneAction / card instances; trusted Action content, eligibility, targets and costs are recalculated by Runtime.
- UI-local selections use `OperationSceneDraft` and can be cleared without a Run write. `previewSceneActionBatch()` is pure; explicit `stageSceneActionBatch()` is separately persisted in EventRun and revalidated on restore/commit.
- `tests/engine/operation-scene-actions.test.ts` verifies preview and skip behavior; `tests/engine/operation-runtime-service.test.ts` covers same-Location Scene sequencing and versioned commit. The Registry click-flow test exercises the real Controller selection/submit route.

## 后续边界（G04）

- PB-22 will test multiple SceneAction Scenes A→B in a dedicated Event. The G03 multi-Scene Runtime fixture is a Battle Beat case and does not replace that acceptance.

## 相关路由

draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/05-conventions/testing]] · [[docs/ai/PROJECT-CONSTITUTION]]
