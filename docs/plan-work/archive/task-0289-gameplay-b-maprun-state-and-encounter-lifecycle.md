# Task：Gameplay B MapRun 状态归属与 Encounter 生命周期

**状态：completed — C2 固定队伍、checkpoint 与成功终态已交付；失败触发按合同留给 C4**

## 目标

落实阶段 B 已冻结的固定队伍准入、MapRun 初始 PlayerCost、单一运行状态 Owner 与 Encounter 成功回图规则；让这些数据在进入不同 Node、保存和恢复时保持稳定。它覆盖总控 Task 0287 的 C2 前半段，为 C3 Hand / Swap 与 C4 Action / Effect 提供清晰的状态边界。

本 Task 只实现 C2 当前已有状态能够证明的准入、保存恢复与成功终态。负责人已冻结失败规则：固定队伍全员 HP 归零时终止当前 MapRun，不发成功奖励、不允许继续 / 重试当前 Run，清理 MapRun-local 状态并保留失败结果页至手动返回游戏；之后允许从 Spot 新开完整 MapRun。由于 C2 尚无 HP 状态，失败触发与失败结果 UI 归 C4 在引入真实 HP 后实现，不在本 Task 建立手动失败命令或空 HP 字段。

## 设计边界

- 每张 Map 明确列出固定的 `Character ID` 队伍和非负整数 `initialPlayerCost`。
- MapRun 启动前完整校验静态内容与当前玩家已拥有 / 解锁的角色；任何角色不满足准入时，不能产生部分 Run。
- MapRun 保存被准入角色的 `Character ID` 与对应已拥有 `Variant ID` 快照，以及当前 `playerCost` 余额。队伍和余额只由同一个 MapRun Owner 写入。
- 成功结束 Encounter 后，队伍与 PlayerCost 留在原 MapRun；进入下一 Node 或 Encounter 不自动恢复 PlayerCost。
- Persistent PlayerState 只用于只读准入检查；本 Task 不回写玩家状态，也不把临时角色状态变成长线养成值。
- C2 只加入确实会被读取、保存或验证的状态。友方 HP、Actor / Team 资源、敌方状态、行动轮次、Hand、Prepared Action、Target、Swap 与 Player Command 草稿按 C3 / C4 的实际机制加入，不建立空占位字段。
- 活动 Encounter 继续属于唯一 MapRun Owner。C1 的 `activeEncounterNodeId` 在没有实际局内状态前仍作当前活动标记；不为包裹单个 Node ID 而另建可写 Encounter Owner。
- 本 Task 不实现失败终态；具体失败规则已冻结并转由 C4 在 HP 机制就绪后接入，不得增加撤退 / 手动失败命令。

## 当前已核实事实

| 事实 | 源码 / 测试依据 | 对 Task 的影响 |
|---|---|---|
| `GameplayMapDef` 目前没有固定队伍或 PlayerCost 字段。 | `src/data-services/contracts/gameplay-map.ts:2` `GameplayMapDef`；`src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts` `gameplayBMap` | U1 增加 Map 作者数据并验证引用。 |
| `MapRunService` 是 GameInstance 私有 Owner；`MapRun` 目前保存位置、访问 / 清除进度及活动 Encounter Node 标记。 | `src/arona-clicker/services/map-run-service.ts` `MapRunService`；`src/arona-clicker/contracts/map-run.ts` `MapRun` | U2 扩展唯一 Run 状态与 checkpoint，不在 PlayerState / UI 建副本。 |
| `CharacterSystem.getUnlocked()` 通过已拥有 Variant 推出可用 Character；`RosterSystem` 可读取持有 Variant。 | `src/arona-clicker/services/character-system.ts`；`src/arona-clicker/services/roster-system.ts` | 使用 AC 现有只读归属信息做准入，不复制 Profile / Operation 装配体系。 |
| Save / Resume 按 Map ID 和 `resumeVersion` 校验活动 MapRun，恢复不重放移动或遭遇完成命令。 | `src/arona-clicker/contracts/map-run.ts` `MapRunSaveSnapshot`；`src/arona-clicker/services/map-run-service.ts` `restoreSaveSnapshot()`；`tests/engine/gameplay-b-map-save-resume.test.ts` | 新增的队伍与余额必须参与同一 checkpoint 的深拷贝和恢复校验。 |
| Encounter 成功后已能在当前 Node 标记清除；Map 移动只接受有向相邻 Edge。 | `src/arona-clicker/services/map-run-service.ts` `completeEncounter()` / `move()`；`tests/engine/gameplay-b-map-run.test.ts` | 保持该成功路径，验证重访不重开且不重置 MapRun-local 状态。 |

## Must Read / Read Set

| 类型 | 路径 / 符号 | 用途 |
|---|---|---|
| 设计 | `docs/plan-work/archive/draft-0287-gameplay-b-phase-b-contract.md` Map / 状态生命周期 / Save-Resume | 本 Task 的冻结行为边界 |
| 设计 | `docs/plan-work/archive/task-0287-gameplay-b-semantic-convergence-and-minimal-loop.md` C2 / C3 / C4 | 施工依赖与阶段界限 |
| 规范 | `docs/docs-829/03-data-structures/player-state.md`、`docs/docs-829/05-conventions/architecture-discipline.md` | 只读准入和运行状态所有权 |
| 契约 | `src/data-services/contracts/gameplay-map.ts`、`src/arona-clicker/contracts/map-run.ts` | 作者字段与运行快照 |
| 实现 | `src/data-services/registry/registry-validate.ts`、`src/arona-clicker/services/map-run-service.ts` | 内容与状态校验 |
| 装配 | `src/arona-clicker/runtime-game-instance.ts`、`src/arona-clicker/services/character-system.ts`、`src/arona-clicker/services/roster-system.ts` | 角色准入及唯一 Owner 的现有入口 |
| 内容 / 测试 | `src/arona-clicker/content/operation-samples/gameplay-b-datapack.ts`、`tests/data/gameplay-b-map-registry.test.ts`、`tests/engine/gameplay-b-map-run.test.ts`、`tests/engine/gameplay-b-map-save-resume.test.ts`、`tests/engine/gameplay-b-map-runtime-integration.test.ts` | 正常作者内容与直接受影响的验证 |

## Context Budget

| 项 | 预算 / 规则 |
|---|---|
| 目标上下文 | 约 15k–30k token，包含直接调用方和定向测试 |
| 文档 Read Set | 5–7 篇；优先读取本表命中的合同与机制 |
| 历史文档 | 默认 0 篇；本 Task 不追溯旧 Operation 设计 |
| 超预算处理 | 按 U1 / U2 白名单分别实施；超出一个 Unit 的文件或机制范围时停止并交回总控 |

## Optional Read Set

- `src/arona-clicker/services/operation-participant-admission.ts`：仅参照 Character / Variant 准入事实，不复用整套 Operation Profile / Action 装配。
- `docs/docs-829/03-data-structures/datapack-contracts.md`、`docs/docs-829/05-conventions/schema-sync.md`：若 U1 证明字段进入独立编辑器作者 Schema，再查其同步路径。

## Do Not Read by Default

- `docs/plan-work/archive/**`、旧 Operation 设计与迁移历史。
- `tools/datapack-editor/` UI 实现；除非作者 Schema 命中说明字段确实需在那里处理。
- C3 / C4 Action、Combat、Effect 目录；本 Task 不实现这些系统。

## Constraints

- 以 [[draft-0287-gameplay-b-phase-b-contract]] 的冻结合同为准；旧 Gameplay B 内容保留到 C5 重建 / 退役。
- 遵守 [[docs/docs-829/05-conventions/architecture-discipline]] 与 [[docs/docs-829/05-conventions/schema-sync]]。
- 生成 Schema 不直接手改。若 U1 发现现有正式作者 Schema 必须改动而可用生成流程将触及禁改产物，停止并报告同步边界，不得静默造成源类型 / 作者入口不一致。
- MapRun 的单一 Owner 仍为 GameInstance 内私有 MapRunService；读取使用 detached snapshot。
- 失败规则已由负责人冻结并列入 C4；本 C2 Task 只完成成功终态，不提前引入 HP 或失败 UI。

## Completion Criteria

- [x] 正常 Datapack Map 声明固定 Character 队伍与明确的初始 PlayerCost；Registry 拒绝缺失 / 重复 / 未知队伍引用及无效初始费用（U1 完成）。
- [x] 队伍所有成员均须是当前 AC PlayerState 中已拥有 / 解锁的角色；准入失败不创建半成品 MapRun（U2 完成）。
- [x] MapRun checkpoint 保存且校验已准入的 Character / Variant 身份及 PlayerCost；保存恢复不会重新初始化这些值（U3 完成）。
- [x] 成功完成 Encounter、沿合法 Edge 移动、进入下一 Encounter 与保存恢复都保留同一队伍 / PlayerCost；进入新 Node 不自动恢复余额（U2 / U3 完成）。
- [x] MapRun 不写 Persistent PlayerState；U2 / U3 未加入 HP / Hand / Action 等空字段。
- [x] MapRun 走到出口成功后清理 Party、PlayerCost、位置和进度等运行状态；仅由同一 Owner 保留不可恢复的最小只读成功结果供当前 Workspace 显示（U4 完成）。
- [x] 失败路径合同明确并安排到 C4：固定队伍全员 HP 归零时结束当前 Run、清理 MapRun-local 状态、不发成功奖励、失败结果保留到手动返回游戏；当前 Run 不可继续 / 重试，但之后可从 Spot 新开完整 Run。C2 不实现 HP 尚未支持的触发器。
- [x] C1 成功竖切片与相关 Save / Resume 回归仍通过（U5 / C2 端到端回归通过）。

## Patch Units

- [[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle-units/U1-map-author-contract]]：Map 作者字段与 Registry 校验。Receipt：[[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle-units/receipts/receipt-U1-map-author-contract]]。
- [[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle-units/U2-party-admission-and-maprun-state]]：固定队伍准入与 MapRun-local Party / PlayerCost。Receipt：[[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle-units/receipts/receipt-U2-party-admission-and-maprun-state]]。
- [[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle-units/U3-maprun-checkpoint]]：MapRun 新状态的存档往返与拒绝校验。Receipt：[[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle-units/receipts/receipt-U3-maprun-checkpoint]]。
- [[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle-units/U4-terminal-success-result]]：终止成功 Run，只保留最小只读结果。Receipt：[[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle-units/receipts/receipt-U4-terminal-success-result]]。
- [[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle-units/U5-terminal-success-workspace]]：Workspace 显示终态结果，不读取或保留完整 Run。Receipt：[[task-0289-gameplay-b-maprun-state-and-encounter-lifecycle-units/receipts/receipt-U5-terminal-success-workspace]]。

## Stop Conditions

使用 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件中的 6 条。另有以下本 Task 停止门：

- 若准入字段的真实 ID 类型或 Character / Variant 身份关系与 Confirmed Facts 不符，暂停 U1 / U2 并上报。
- 若需修改 `Allowed Files` 外的 GameInstance wiring、Datapack loader、作者 Schema、UI 或存档根契约，暂停并交总控拆分。
- 不得在 C2 实现失败触发、结果 UI 或空 HP 字段；这些工作留到 C4 与 HP 原子结算一起完成。

## Current Verification

- U1 的 Registry 定向测试 `npx vitest run tests/data/gameplay-b-map-registry.test.ts`：35/35 通过。
- U1 `npx tsc --noEmit`：通过。
- U1 只读 GALHCG：Registry validator 与样例为 `content_changed`，旧 Evidence 未刷新；Map contract 和两份测试为 `unreferenced_path`。未改写图或 freshness。
- U1 非施工 Luna Max 独立复核：无阻塞发现；一个逆序加载角色包的前向引用未覆盖，但当前正常内容按 base 角色包先于 Gameplay B Map 加载。详见 U1 Receipt。
- U1–U5 均完成，U2–U5 独立复核无阻塞发现。C2/C1 回归 8 个测试文件、60 项通过；`npx tsc --noEmit` 与 `npm run check:docs` 均通过。失败行为已冻结并安排至 C4，与真实 HP 状态一并交付。

## GALHCG 影响闭环

- 发现路径：在 project `acprogram` 下查询 `MapRun` 与 `CharacterSystem` 源码，再回到契约、Owner、准入实现和测试核实；结果为当前 MapRun 仍仅含 C1 路径状态，现有 Character / Roster 服务提供只读准入能力。
- 变更审查：每个 Unit 完成后仅对其直接改动路径执行 `graph_health(check="changed")` 只读复核。
- 地图维护：本 Task 不授权写图、刷新 freshness 或更新 Evidence / `maps_to`；若后续维护另行请求，遵守 [[docs/ai/galhcg-project-map]] 与 `.galhcg/agent-maintenance.md`。

## 剩余工作

- C4 接入失败终态：全队 HP 归零时失败，清理当前 Run、无成功奖励、保留失败结果页至手动返回；允许之后从 Spot 新开完整 Run。HP 起始值与上限的最小显式来源须在 C4 合同中说明，禁止隐式读取长期养成 HP。
- 进入 C3 Character Hand / Swap / Player Command / Commit；C4 实现 HP、资源与 Action / Effect 事务，并按冻结规则接入败北终态。

## 相关路由

- [[task-0287-gameplay-b-semantic-convergence-and-minimal-loop]]
- [[draft-0287-gameplay-b-phase-b-contract]]
- [[task-0288-gameplay-b-map-node-vertical-slice]]
- [[docs/ai/PROJECT-CONSTITUTION]]
- [[docs/docs-829/03-data-structures/player-state]]
- [[docs/docs-829/05-conventions/architecture-discipline]]
- [[docs/docs-829/05-conventions/schema-sync]]
