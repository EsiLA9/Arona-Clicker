# Unit 0289-U4：结束 MapRun 并保留最小成功结果

## Goal

Map 到出口成功时清理当前 MapRun 的队伍、PlayerCost、位置与节点进度，只由同一 Owner 暂存一个不可恢复、不可继续操作的只读成功结果，供当前 Workspace 显示。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 用途 |
|---|---|---|
| 设计 | `docs/plan-work/archive/draft-0287-gameplay-b-phase-b-contract.md` MapRun 生命周期 / 奖励边界 | 终止时清理运行态 |
| Owner | `src/arona-clicker/contracts/map-run.ts`、`src/arona-clicker/services/map-run-service.ts` | 当前 `success` Run 被保留的实现 |
| Query | `src/arona-clicker/contracts/runtime.ts` `MapRunQuery`；`src/arona-clicker/runtime-game-instance.ts` MapRun query facade | 输出结果，不复制运行状态 |
| 测试 | `tests/engine/gameplay-b-map-run.test.ts` | 出口成功、不能恢复与新 Run 行为 |

## Context Budget

| 项 | 预算 / 规则 |
|---|---|
| 目标上下文 | 12k–22k token |
| 文档 Read Set | 2–4 篇 |
| 历史文档 | 默认 0 篇 |
| 超预算处理 | 新增独立终态 Owner、改变存档根或改 UI 时停止并交回总控拆分 |

## Optional Read Set

- `src/ui/components/map-workspace.ts`：只读确认当前成功结果需要展示哪些字段；实际 UI 调整留给 U5。

## Do Not Read by Default

- 失败处理与撤退相关旧 Operation 实现；本 Unit 只处理已存在的 Map 出口成功路径。

## Confirmed Facts

| 事实 | 依据 | 备注 |
|---|---|---|
| MapRun 出口成功时当前 Owner 保留 `status: 'success'` 的完整 Run，但不保存为 checkpoint。 | `src/arona-clicker/services/map-run-service.ts` `move()` / `createSaveSnapshot()` | 完整 Run 继续携带 MapRun-local 状态。 |
| Workspace 需要在成功后展示完成结果；当前 UI 直接读取终止 Run。 | `src/arona-clicker/contracts/runtime.ts` `MapRunWorkspaceView`；`src/ui/components/map-workspace.ts` | 改用最小成功结果 query。 |

## Constraints

- 成功地图结果仅含渲染摘要所需身份：`runId`、`mapId`、成功 outcome、出口 Node ID 与显示所需静态名称；不得含 Party、PlayerCost、visited/completed 状态或遭遇局部状态。
- 成功结果不进入 SaveData，也不能被继续移动、完成遭遇或恢复。
- 仅一个 MapRunService Owner；新 Run / dispose 按 Task 生命周期清除上一成功结果。失败结果随后由 C4 按独立冻结规则实现。
- 本 Unit 只实现成功终态。失败规则已冻结，但依赖 C4 的 HP 状态；失败结果生命周期与触发一并由 C4 实现。

## Allowed Files

- `src/arona-clicker/contracts/map-run.ts`
- `src/arona-clicker/services/map-run-service.ts`
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `tests/engine/gameplay-b-map-run.test.ts`

## Explicit Non-goals

- 不实现失败状态、失败触发、撤退、重试或失败结果。
- 不调整 Map Workspace UI；由 U5 消费新 query。
- 不结算长期奖励或改 PlayerState；奖励按后续 C4/C5 的授权接入。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。若终态最小摘要无法在同一 Owner 内提供，或需修改 SaveData / Controller / UI 白名单外文件，停止并交回总控拆分。

## Completion Criteria

- [x] MapRun 到达出口成功后，`getSnapshot()` 不再返回活动 Run。
- [x] `getResult(runId)` 能返回 detached、冻结的最小成功结果，不携带 MapRun-local 字段。
- [x] 成功结果不保存、不恢复，也不能用于 Map 命令；新 Run 开始后旧结果失效。
- [x] 命令返回值可作即时反馈，但唯一运行 Owner 不保留完整终态 MapRun。

实施与复核记录：[[receipts/receipt-U4-terminal-success-result]]。

## Verification

| 项 | 命令 / 方式 | 期望 |
|---|---|---|
| MapRun 定向测试 | `npx vitest run tests/engine/gameplay-b-map-run.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 通过 |
