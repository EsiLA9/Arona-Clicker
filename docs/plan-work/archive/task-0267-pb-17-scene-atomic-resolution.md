# Task 0267：PB-17 Scene 原子结算边界

状态：completed — Scene commit 复用现有两个版本保护的原子写入路径；Resolution 标注 Scene ID，Scene 完成在同一 Run 替换中计算。
> Goal Owner 统一裁定（2026-10-08）：PB-17 明确不合并 Beat / SceneAction / Route 提交命令；细节见 [[draft-0256-gameplay-b-atomic-scenes-task-rulings]]。施工前裁定问题保留为历史。
> 文档说明：事实表、架构门槛、施工切片与“当前核验”保留施工前记录；最终合同、验证结果和后续边界见“实施收尾与证据”。

## 目标

将 ScenePlan 的提交作为一项与当前 Scene instance / Run 版本匹配的命令。Runtime 重新验证所有 Action、执行者、目标和费用，复用可信 Operation planner / resolution 格式及受控状态写入；完整成功后提供与实际 EventRun 一致的 Resolution。任何非法、stale、不可支付或规划失败都不留下部分效果、部分扣费、弃牌、批次或 Scene lifecycle 更新。

## 设计边界

- 本 Task 包含：Scene 提交适配、候选 Resolution 核对、单次 owner replacement 和可观察回执；在 Operation 工作区中显示结果。
- 明确非目标：将 commitBeat / commitSceneActionBatch / transitionRoute 合并为单一万能命令；自己重写效果、Cost、目标、随机数或 StateMutation 子系统；本 Task 不完成 Location 路线或 AC 奖励。
- 已裁定来源：draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md；优先复用既有 Atomic planner 和 OperationResolution，保留不同提交行为边界。

## 当前事实与代码落点

| 已核实事实 | 源码 / 测试依据 | 对本 Task 的影响 |
| --- | --- | --- |
| commitBeat 以当前 Run 快照和冻结规则调用 planOperationResolution，校验 Run / Event / version / Location / RNG，再在 detached 副本应用并一次替换 slot。 | src/arona-clicker/services/operation-runtime-service.ts：commitBeat；src/arona-clicker/services/operation-resolution-planner.ts：planOperationResolution；src/arona-clicker/contracts/operation-resolution.ts：OperationResolutionBatch。 | Battle 已有可信原子写入边界，Scene task 不重建该事务引擎。 |
| commitSceneActionBatch 同样规划、克隆 Run，联合应用 Action effect、费用、牌区移动、批次计数与 Resolution，所有步骤成功才把 Run slot 更新。 | src/arona-clicker/services/operation-runtime-service.ts：planSceneActionBatchForSlot、commitSceneActionBatch；src/arona-clicker/contracts/operation-resolution.ts：OperationResolution.sceneBatch。 | 现有 Scene batch 不是“UI 半结算”；它已是可复用的原子入口之一。新 Scene 完成状态应在同一个经裁定的 owner commit boundary 一起应用，或明确为何不能如此。 |
| OperationResolution 记录 numeric / membership / position changes、费用、Action plans、可选 sceneBatch 与序号，不携带完整 Run。 | src/arona-clicker/contracts/operation-resolution.ts：OperationResolutionBatch / OperationResolution。 | 新 Resolution 可以描述 Scene result，但不能让 UI 制作可信效果数据。 |
| 失败提交有全快照不变行为证据，stale 输入和 caller-supplied cost / effects 被拒绝。 | tests/engine/operation-scene-actions.test.ts：unaffordable batch atomic rejection、stale selections、caller-supplied cost / effects rejection；tests/engine/operation-runtime-service.test.ts：错误 state delta 不部分写入。 | 新 Scene commit 需要相同或更强的 no-partial-write 行为回归。 |
| Save / Resume 可恢复显式 staged scene batch；只读预览本身不会进入 EventRun。 | src/arona-clicker/services/operation-runtime-service.ts：stageSceneActionBatch、restoreSaveSnapshot；tests/engine/gameplay-b-save-resume.test.ts：round-trips a staged Individual batch。 | 如果 ScenePlan 状态要存档，必须复用既有 Versioned EventRun checkpoint，并重新核验费用；不能凭 Scene 自己开存档。 |
| Runtime claimOutcomeReward 只对白名单 Event terminal rewards 走 StateMutationService。 | src/arona-clicker/services/operation-runtime-service.ts：claimOutcomeReward；docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md。 | SceneResolution 不直接发 AC 全局奖励。 |

## 架构裁定门槛

- Scene 计划在提交时调用哪些可信既有计算路径；是否支持一个 Scene 提交含多个 Operation Action source，还是由多个分离 Commit 顺序执行。
- Scene 完成结果是否必须与 numeric / membership / position delta、Cost、card zone、scene status 同一原子 Run replacement。
- Resolution 的稳定返回结构与重试幂等键；既有 batch Commit 对最近一次相同 basePlanVersion 返回已完成记录的行为是否足以复用。
- 即使状态 owner 最终是 EventRun，也不得让 UI 直接调用 StateMutationService 或提交 caller-supplied delta。

## 施工切片

### P0：提交方式和单 owner write 定义

- 以既有 Battle / Scene batch 入口对照，指出新 Scene adapter 调用哪一个 planning / commit 机制以及不接受哪些用户输入。
- 定义提交成功 / 失败响应与重复提交行为；不能出现 UI 和 Runtime 各自推算 Resolution。

### P1：原子候选 / 应用 / 回执

- 在 detached Run 上验证完整计划，应用全部费用与效果、状态和历史，然后一次性安装新快照。
- 只在同一 commit 成功时保存 Scene.completed 和 Resolution；任何中断 / 校验失败时保留提交前快照。

## 测试与验收

- [x] SceneAction batch Runtime tests cover performer-based selection, cost/effect resolution, completion predicate and no-write rejection for invalid / unaffordable input. The transaction keeps SceneAction and player-card costs and effects in one Resolution.
- [x] Resolution records `sceneId`; View and EventRun agree after commit. Existing Runtime retry behavior returns the same Resolution without repeating effects, cost, discard, RNG or notification.
- [x] Battle and SceneAction remain separate atomic commands; `commitBeat()` now rejects a Scene-stage direct call before any Run mutation or notification.
- [x] Registry UI test clicks the actual SceneAction choice and submit button, then verifies the completed Resolution and unchanged Location. The broader multi-source / actorless failure examples remain covered by existing SceneAction tests, not folded into this small sample.

## 施工前核验记录（2026-10-08）

- 直接读取 Operation Runtime 的 commitBeat / commitSceneActionBatch / planner / Resolution 契约，确认两类已有事务分别 atomic；对照 SceneAction 批次费用失败、stale 输入、保存恢复和 Run lifecycle 测试。
- 没有将路线图“新增原子结算”误记为当前缺失的通用 atomic commit：当前已有两个不同的原子入口，缺的是独立 ScenePlan / Scene completion 的 adapter contract。
- 未修改代码或测试；未运行测试 / 类型检查。

## 施工前 GALHCG 检索记录

- 发现路径：project_id acprogram；map EventRun 命中 Run Lifecycle / View projection；source 查询 SceneResolution 无结果后从 OperationResolution、Runtime commit 和测试直接核证。
- 变更审查：只有规划文件，无实现路径 review_changes。
- 地图维护：不将 proposed SceneResolution adapter 记录为已实现 maps_to。

## 实施收尾与证据（2026-10-08）

- `commitBeat()` and `commitSceneActionBatch()` continue to use separate version-checked command boundaries. Both build detached candidates and replace one Run slot after planner outputs validate; SceneAction batch commit includes effects, resource payments, card movement, batch count, Scene completion and Resolution append in that replacement.
- Each successful Resolution includes the active `sceneId`; Save/Resume validates every persisted Resolution identity. The Registry demo uses two Registry-defined students, one environment participant, a student-performed SceneAction and an actorless SceneCard, and is playable through the Operation entry.
- A direct `commitBeat` call in `stage: scene` now rejects with no snapshot or lifecycle change. Scene-stage `preparedBeat` is retained only as the deterministic candidate / restore-validation snapshot; Runtime stage validation is authoritative for whether a battle commit may occur.
- Verification: Runtime, SceneAction, View and Registry UI behavior tests passed; TypeScript and generated schema synchronization passed.

## 后续边界（G04）

- G04 migrates real scenarios and proves SceneAction A→B sequencing in its own Event; this Task does not merge the different command contracts.

## 相关路由

draft-0253-gameplay-b-atomic-scenes-phase-iii-foundation.md · [[docs/docs-829/04-mechanisms/arona-clicker/operation-runtime]] · [[docs/docs-829/03-data-structures/operation-view]] · [[docs/docs-829/03-data-structures/player-state]] · [[docs/docs-829/05-conventions/architecture-discipline]] · [[docs/docs-829/05-conventions/testing]]
