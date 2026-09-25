# Task：Information Reveal Runtime Lifecycle

状态：done — Init、读档、重置与热内容生命周期接线完成（2026-09-25）

## 目标

将 [[task-0148-information-reveal-adapter-v1]] 已建成的 Reveal 域与 EB-T Adapter 接入真实 Runtime 生命周期。进入 Init 后在 admission 完成点 reconcile；状态/内容替换时撤出旧 Watch 并按当前定义、Save Progress 和当前 Init 重建。旧 UI Reveal 消费者仍按现行路径工作，本 Task 只建立并行的持久信息事实链。

## 设计边界

- `initEntered` 在默认 Area 和 Spot 建立前发出，不能作为 post-admission 唯一入口；必须由 InitService 在进入流程末尾显式 reconcile。
- 读档应在 PlayerState、Stats、Story、Trigger 等恢复完成后 reconcile；重置、切换与内容卸载先撤出旧 Registration。
- 内容 Apply/热 CRUD 后按当前 Registry 重新推导；Progress 不因定义卸载而删除。
- 不迁移 UI，不改变 `existence`/`unlock`，不新增迁移、tick 轮询、通用事件编译器或 Event catalog 事件。
- 当前工作区有大量既有未提交变动；Unit 修改白名单内也须保留原有改动。

## 当前事实与代码落点

| 已核实事实 | 位置 |
| --- | --- |
| InitService.enterInit 在 `initEntered` 之后才设置默认 Area/Spot，末尾重建 Affector 与 Visibility | `src/arona-clicker/services/init-service.ts` |
| restoreFromSave 在恢复 State、Story、Stats 后完成运行时重建 | `src/arona-clicker/runtime-save.ts` |
| resetRuntime 与 reloadRuntime 清空状态/Registry/Trigger | `src/arona-clicker/runtime-reset.ts` |
| Runtime 热 Init/Area 内容提交调用 `reconcileAfterWorldDefinitionChange`；Spot 提交发 `spotDefinitionChanged` | `src/arona-clicker/runtime.ts` |
| Adapter 当前提供 `reconcile(watches, immediateTargets)` 与 `withdrawAll()`；内部能从当前 Registry 重新推导 | `src/arona-clicker/services/information-reveal-adapter.ts` |

## 施工切片

### Unit 0149-U1：Init admission 与 Runtime 装配

#### Goal

在组合根创建一个 InformationRevealAdapter，并由 InitService 在进入 Init 的最终稳定点、Init 离开和热 Init/Area 定义变化处管理它。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 裁定 | [[task-0146-reveal-domain-model-v1]] §WatchScope、准入顺序；[[task-0148-information-reveal-adapter-v1]] U1–U3 | 合同与已实现接口 |
| 规范 | [[docs/docs-828/01-architecture/state-layers]]、[[docs/docs-828/02-modules/world]]、[[docs/docs-828/05-conventions/architecture-discipline]] | Init/状态边界 |
| 源码 | `src/arona-clicker/runtime-wiring.ts`、`services/init-service.ts`、`services/information-reveal-adapter.ts` | 装配与生命周期 |
| 测试 | `tests/engine/information-reveal-adapter.test.ts`、现有 Init 相关测试 | 集成样式 |

#### Context Budget

目标 15k–30k tokens；超过 5 文件或 500 净行停止并上交。

#### Optional Read Set

- `src/arona-clicker/runtime-game-instance.ts`：仅当组合根接口无法不修改宿主类时读取。

#### Do Not Read by Default

- UI、Datapack 编辑器与无关历史 Task。

#### Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| Adapter 当前 `reconcileCurrent` 为 private，需要提供受控显式入口 | `src/arona-clicker/services/information-reveal-adapter.ts` |
| `enterInit` 末尾晚于默认 Area/Spot、起始剧情和进入效果 | `src/arona-clicker/services/init-service.ts` |

#### Constraints

- 保留现有 Init/Trigger/Story/Visibility 行为；不以 `initEntered` 单独触发最终 reconcile。
- 在旧 WatchScope 失效时先撤出，再以新 scope 建立；Lobby 中不保留 Watch，Save Progress 不清。
- 准入后触发的嵌套状态变化须以 Adapter 的重入收敛处理，不在 GameInstance 主体塞额外跨系统业务逻辑。

#### Allowed Files

- `src/arona-clicker/services/information-reveal-adapter.ts`
- `src/arona-clicker/runtime-wiring.ts`
- `src/arona-clicker/services/init-service.ts`
- tests/engine/information-reveal-lifecycle.test.ts（新建）

#### Explicit Non-goals

- 不改读档、reset/reload 或 Runtime Spot 内容热提交；留给 U2。

#### Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] 六项停止条件；若需要修改其他文件或当前事实与合同冲突，停止报告。

#### Completion Criteria

- [x] 真实 Runtime 进入 Init 后自动揭示满足的 gate，并在当前 Init 下挂载仍未满足的 Watch。
- [x] 切换/离开 Init 与热 Init/Area 定义变化撤出旧 Watch、保留 Save Progress，并能重建。
- [x] `initEntered` 之后、最终 admission 之前发生的变化由 post-admission reconcile 捕获。

#### Verification

npx vitest run tests/engine/information-reveal-lifecycle.test.ts；`npx tsc --noEmit`。

### Unit 0149-U2：读档、重置与内容更新

#### Goal

在读档完成后按新 State 重建 Reveal Watch，重置旧 Runtime 前撤出旧 Watch；不处理内容热提交。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 裁定 | [[task-0146-reveal-domain-model-v1]] §ProgressScope/WatchScope；本 Task U1 | 保留/重建合同 |
| 规范 | [[docs/docs-828/01-architecture/state-layers]]、[[docs/docs-828/02-modules/world]]、[[docs/docs-828/05-conventions/architecture-discipline]] | Save 与 Runtime 边界 |
| 源码 | `src/arona-clicker/runtime-save.ts`、`runtime-reset.ts`、`services/init-service.ts` 的 U1 接口、`services/information-reveal-adapter.ts` | 恢复和撤出时序 |
| 测试 | U1 生命周期测试、现有 save/reload 定向测试 | 真实 Save 行为 |

#### Context Budget

目标 10k–25k tokens；超 5 文件或 500 净行停止上交。

#### Optional Read Set

- `src/arona-clicker/runtime-game-instance.ts`：只有测试无法通过现有 load/reset 门面覆盖时读取。

#### Do Not Read by Default

- UI、编辑器、无关数据包与历史 Task。

#### Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| restoreFromSave 在 State/Stats/Story/Trigger 恢复后完成 | `src/arona-clicker/runtime-save.ts` |
| resetRuntime 清理旧状态与 Trigger，再建立默认状态 | `src/arona-clicker/runtime-reset.ts` |
| U1 的 Adapter 由 InitService 持有，可经窄公开方法转发 reconcile/withdraw | `src/arona-clicker/services/init-service.ts` |

#### Constraints

- Save Progress 由 PlayerState 序列化，读档不做迁移或重新解释为 per-Init；无 active Init 时只撤 Watch。
- 在旧 Trigger/State 替换前撤旧 Watch，全部相关状态恢复后再 reconcile；不得依赖 `initEntered` 伪造读档事件。
- 不改变普通 Trigger、Affector、Story 的恢复顺序和 once 记录。

#### Allowed Files

- `src/arona-clicker/services/init-service.ts`
- `src/arona-clicker/runtime-save.ts`
- `src/arona-clicker/runtime-reset.ts`
- tests/engine/information-reveal-save-rebuild.test.ts（新建）

#### Explicit Non-goals

- 不改 Runtime Spot 热内容、Init admission、Adapter 核心语义或 UI。

#### Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] 六项停止条件；若需要修改 GameInstance 或其他白名单外文件，先报告。

#### Completion Criteria

- [x] Save 中已揭示事实跨读档保留，读档后仅当前仍未揭示的 Watch 重新挂载。
- [x] 重置/重载旧 Watch 被撤出，Lobby 无 Reveal Registration；新 Init 准入能重建。
- [x] 与现有 Trigger/Story/Stats 恢复路径的顺序有集成测试。

#### Verification

npx vitest run tests/engine/information-reveal-save-rebuild.test.ts；`npx tsc --noEmit`。

### Unit 0149-U3：Spot 热内容与终态对账

#### Goal

在 Spot 与 Init/Area 热内容成功提交后才对账 Information Reveal，撤出旧定义 Watch 并按当前 Registry 重建；失败回滚不得因 Reveal 提前提交 Save Progress。

#### Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 裁定 | [[task-0146-reveal-domain-model-v1]] §WatchScope、定义缺失；本 Task U1/U2 | Progress/Watch 分离 |
| 规范 | [[docs/docs-828/02-modules/runtime-editor]]、[[docs/docs-828/05-conventions/architecture-discipline]] | 热内容事务边界 |
| 源码 | `src/arona-clicker/runtime.ts` 的 Spot onCommitted 与 applyRuntimeSpotMutation/applyRuntimeWorldDraft；`services/runtime-content-coordinator.ts` 与 `runtime-world-content-coordinator.ts` 的 callback/rollback 顺序；`services/init-service.ts` 的 Reveal 对账点 | 确定成功提交后时机 |
| 测试 | `tests/engine/runtime-hot-content.test.ts`、`runtime-world-hot-crud.test.ts`、U1/U2 集成测试 | 现行热路径样式 |

#### Context Budget

目标 15k–30k tokens；超过 5 文件或 500 净行停止上交。

#### Optional Read Set

- `tests/engine/runtime-spot-field-authoring.test.ts`：仅当 Spot replace 测试需要具体字段输入时读取。

#### Do Not Read by Default

- UI、独立 Datapack 编辑器、无关机制与历史 Task。

#### Confirmed Facts

| 事实 | 依据 |
| --- | --- |
| Spot coordinator 在 `onCommitted` 之后才 `commitState`；callback 抛错会回滚 Registry | `src/arona-clicker/services/runtime-content-coordinator.ts:240` |
| World coordinator 的 callback 位于可回滚 try 内，返回成功后才是确定的提交结果 | `src/arona-clicker/services/runtime-world-content-coordinator.ts:242` |
| U1 把 Reveal 对账加入 `reconcileAfterWorldDefinitionChange`，该方法当前在 World callback 中被调用；需要将 Reveal 部分移至提交成功之后 | `src/arona-clicker/services/init-service.ts`、`src/arona-clicker/runtime.ts` |

#### Constraints

- 不在可回滚 `onCommitted` callback 中提交 Reveal Progress。Spot/World coordinator 返回成功后，以当前 Registry 调用 InitService 的 Reveal reconcile；失败结果不调用。
- 移动 U1 在 InitService 热 World 方法内加入的 Reveal reconcile，保留既有位置修复、Trigger、Affector 和 Visibility 行为。
- Watch 更新不删除 Save Progress；定义卸载仅撤出 Registration，恢复定义后按原事实过滤。
- 不改变 coordinator、Event catalog、UI、Datapack Schema 或存档结构。

#### Allowed Files

- `src/arona-clicker/runtime.ts`
- `src/arona-clicker/services/init-service.ts`
- tests/engine/information-reveal-hot-content.test.ts（新建）

#### Explicit Non-goals

- 不重构热内容事务、位置回退、普通 Trigger/Visibility 事件路径，也不接旧 UI 消费者。

#### Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] 六项停止条件；若实际成功提交点与上述源码事实不同，停止报告，不在事务内部写 Progress。

#### Completion Criteria

- [x] Spot 热提交成功后，旧 Watch 撤出、新 Watch 准入，Progress 保留；定向测试覆盖 create/replace 与过期 revision 失败。delete/suspend/resume 复用同一成功提交对账入口。
- [x] Init/Area 热更新在成功返回后对账；回滚/失败不凭未提交的新定义写入 Progress。
- [x] 定向测试覆盖成功与失败两条热路径。

#### Verification

npx vitest run tests/engine/information-reveal-hot-content.test.ts；`npx tsc --noEmit`。

## 测试与验收

- Unit 定向测试和类型检查；全部接线完成后运行 `npm test`、`npm run check:architecture`、`npm run check:docs`、`npm run build`。
- 覆盖：Init 切换、Run 重启、Save 读写、Lobby、定义卸载/重载、Spot/Init/Area 热内容、AdmissionOnly 的显式 reconcile、四类 reactive 事件、重复事件与旧 Registration 撤出。
- 由我独立复核 Luna 的每个 Unit，核对现有脏工作树与 Task 白名单；实际命令结果写入当前核验。

## 当前核验（2026-09-25）

- U1 由 Luna 实施；我独立重跑生命周期/Adapter 定向测试（11/11 通过）及 `npx tsc --noEmit`（通过），并核对 post-admission 与切换。
- U2 由 Luna 实施；我独立重跑 Save/生命周期定向测试（6/6 通过）及 `npx tsc --noEmit`（通过）。U3 尚未执行。验收 U1 热内容时发现 Reveal 对账位于可回滚 callback，已在 U3 明确改到成功提交之后。
- U3 由 Luna 实施；我发现直接调用世界定义修复入口的回归并要求修正，随后独立合跑热内容/Save/Init 生命周期测试（8/8 通过）与类型检查（通过）。
- 全量 Vitest 194 文件 / 1777 测试通过；`npm run build`、`npm run check:architecture`、`npm run check:docs`、`git --no-pager diff --check` 均通过。当前机制与状态文档已同步。

## 剩余工作

工程与验证已完成；本 Task 归档后按仓库协议维护 AOCI 受影响条目。旧 UI 消费者迁移和三类 AdmissionOnly 条件的事件能力扩展均未纳入本 Task。

## 相关路由

- [[task-0146-reveal-domain-model-v1]]
- [[task-0148-information-reveal-adapter-v1]]
- [[docs/docs-828/02-modules/visibility]]
- [[docs/docs-828/02-modules/effect-trigger]]
- [[docs/docs-828/05-conventions/architecture-discipline]]
