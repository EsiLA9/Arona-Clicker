# Unit 0289-U5：Map Workspace 显示成功结果

## Goal

保留现有 `map:runId` 终态路线体验；活动 Run 已清理后，Workspace 改读 U4 的最小成功结果，显示地图与出口完成信息，并允许用户返回游戏。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 用途 |
|---|---|---|
| 设计 | `docs/plan-work/task-0288-gameplay-b-map-node-vertical-slice.md` U8 验收与 Receipt | 保持正常 Spot → Map → Encounter 入口 |
| Query | `src/arona-clicker/contracts/runtime.ts` `MapRunWorkspaceView`；`src/arona-clicker/runtime-game-instance.ts` `getMapWorkspaceView()` | 将活动 Map 视图与终态只读结果作为同一查询的两个显式分支 |
| UI | `src/ui/components/map-workspace.ts` | 显示活动地图或不携带 Run 状态的成功结果 |
| 入口 / Controller | `src/ui/components/map-entry.ts`；`src/ui/controller.ts` Map route | 确认继续、返回行为不变 |
| 测试 | `tests/ui/gameplay-b-map-workspace.test.ts`、`tests/ui/gameplay-b-map-vertical-slice.test.ts` | 活动/成功 UI 路径 |

## Context Budget

| 项 | 预算 / 规则 |
|---|---|
| 目标上下文 | 10k–20k token |
| 文档 Read Set | 2–4 篇 |
| 历史文档 | 默认 0 篇 |
| 超预算处理 | 需要改样式系统或其他 Workspace 时停止并交回总控 |

## Optional Read Set

- `ui-style/patterns.md`：只有需要新增布局 / 样式时读取；默认复用已有成功结果区。

## Do Not Read by Default

- 独立 Datapack Editor、旧 Operation Workspace 与不相关的 UI 组件。

## Confirmed Facts

| 事实 | 依据 | 备注 |
|---|---|---|
| C1a 成功出口目前继续展示完整成功 Run；返回游戏按钮回到原游戏 route。 | `src/ui/components/map-workspace.ts`；`tests/ui/gameplay-b-map-vertical-slice.test.ts` | 保持同一 Map route 的结果可见性与返回操作。 |
| MapRun Entry 只以活动 Run 判断继续入口；完成 Run 可通过普通 Spot Entry 开始新 Run。 | `src/ui/components/map-entry.ts`；`tests/engine/gameplay-b-map-run.test.ts` | 终态结果不可恢复 / 继续。 |

## Constraints

- UI 只读 `GameReadModel.mapRun` 投影，不读取 Registry、不持有 MapRun 副本。
- 玩家未拥有固定队伍时由 Runtime 准入拒绝；此测试应显式取得 Map 所需角色，不在测试里绕过准入。
- 成功后 `getWorkspaceView(runId)` 返回只读结果分支，不再伪造 MapRun 或 Map 位置 / 节点进度。

## Allowed Files

- `src/ui/components/map-workspace.ts`
- `src/arona-clicker/contracts/runtime.ts`
- `src/arona-clicker/runtime-game-instance.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`
- `tests/ui/gameplay-b-map-vertical-slice.test.ts`

## Explicit Non-goals

- 不调整 Map Entry；失败结果页和其后的全新 Run 入口由 C4 按已冻结合同接入。
- 不实现失败结果 UI；失败规则已冻结，失败结果页由 C4 在 HP 触发接入时一并实现。
- 不增加 UI 专用 MapRun 状态，也不重设计 Map 版式或主题。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION]] §停止条件。若 U4 查询字段不满足 UI 需要，先与总控确认；不得让 UI 读 Registry 或把终态结果写回 Owner。

## Completion Criteria

- [x] 活动期间 Workspace 继续从真实 MapRun 投影显示 Map、当前位置、移动与 Encounter。
- [x] 成功后 `getWorkspaceView(runId)` 切换至 U4 的结果分支；不含完整 MapRun、Party、PlayerCost、当前位置或节点进度；Workspace 在当前 route 显示最小结果与出口名称。
- [x] 完成结果仍可返回游戏；返回后无活动 MapRun，普通 Spot 入口可以按合同开始新的完整 Run。
- [x] UI 测试正常准备/拥有固定队伍，不改变内容入口绕过准入。

实施与复核记录：[[receipts/receipt-U5-terminal-success-workspace]]。

## Verification

| 项 | 命令 / 方式 | 期望 |
|---|---|---|
| Map UI 定向测试 | `npx vitest run tests/ui/gameplay-b-map-workspace.test.ts tests/ui/gameplay-b-map-vertical-slice.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 通过 |
