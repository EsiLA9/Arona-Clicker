# Unit 0278-U8：Selectable SceneAction 默认目标

## Goal

对玩家已选择的目标型 SceneAction，Runtime 在传入空 `targetActorIds: []` 时按现有合法目标顺序选择默认单目标；UI 展示相同目标。Action 与 performer 仍须显式选择。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| Runtime | src/arona-clicker/services/operation-resolution-planner.ts：planSceneBatch、resolveDefaultTargets | 统一 selectable / fixed SceneAction 目标归一化 |
| Target | src/arona-clicker/services/operation-target-selection.ts：getOperationTargetActorIds | 复用存活、资格、目标限制和 targetPriorityActorIds 顺序 |
| UI | src/ui/components/operation-workspace.ts；src/ui/controller-actions-operation.ts | 默认目标投影、操作覆盖、提交命令 |
| 测试 | tests/engine/operation-scene-actions.test.ts；tests/engine/gameplay-b-multiscene-location.test.ts；tests/ui/operation-workspace-view.test.ts；tests/ui/gameplay-b-operation-controller.test.ts | Runtime 与正式 Carousel 行为回归 |

## Confirmed Facts

- `getOperationTargetActorIds()` 已按 Actor 的 `targetPriorityActorIds` 对当前存活、合法候选排序；未列入偏好的候选按 Event Actor 声明顺序追加。
- `planSceneBatch()` 目前只为 fixed SceneAction / fixed SceneCard 调用 `resolveDefaultTargets()`；selectable SceneAction 空 targetActorIds 仍因目标数量为 0 而失败。
- Workspace 对 selectable SceneAction 只在唯一合法目标时显示默认目标；有多个合法目标时要求点击 Target。PlayerSceneCard 走独立入口和草稿字段。
- Carousel Atomic Scene 的“检查故障设备”是需玩家选择的 SceneAction，其 Action Target 限定旋转木马 Actor；不属于 Combat Beat PreparedBeat。

## Constraints

- 不自动选择 SceneAction，不自动选择 performer；只有已有 selection 明确指向 Action / performer 后才默认 Target。
- `selectionMode: all-eligible` 仍按既有 SceneAction group 合同处理；Combat Beat / Intervention 目标合同不变。
- 合法显式目标优先于默认；失效目标仍拒绝整批，不静默改选。
- 不把 Character Hand / 战斗 Action 与 PlayerSceneCard 合并。保留 atomic Scene demo 的通用数据路径，不写 Carousel 特判。
- 无候选目标仍失败，no-target Action 与 Wait / Skip 不改变既有语义。

## Allowed Files

- src/arona-clicker/services/operation-resolution-planner.ts
- src/ui/components/operation-workspace.ts
- src/ui/controller-actions-operation.ts
- tests/engine/operation-scene-actions.test.ts
- tests/engine/gameplay-b-multiscene-location.test.ts
- tests/ui/operation-workspace-view.test.ts
- tests/ui/gameplay-b-operation-controller.test.ts
- docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md
- docs/plan-work/task-0278-gameplay-b-unbounded-loop-and-character-autonomy.md
- docs/plan-work/task-0278-units/0278-u8-scene-action-target-default.md
- docs/plan-work/task-0278-units/receipts/0278-u8-receipt.md
- docs/plan-work/00-index.md

## Completion Criteria

- [x] An explicitly selected SceneAction with empty targetActorIds previews and commits using the first currently legal target by targetPriorityActorIds, then Event Actor order.
- [x] A valid explicit target override is retained; stale/illegal target and no-target cases keep their existing behavior and atomicity.
- [x] UI shows the same default target for one or multiple legal candidates; choosing another legal target changes the staged selection; no SceneAction or performer is auto-selected.
- [x] “检查故障设备” can be submitted with explicit SceneAction / performer and `targetActorIds: []`; Runtime resolves its authored device target.
- [x] SceneAction `all-eligible`, Combat Beat, Intervention, and PlayerSceneCard contracts remain distinct.
- [x] Relevant Engine / UI tests, `npx tsc --noEmit`, `npm run check:docs`, and `git diff --check` pass. No browser replay was run.

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向 Runtime | `npx vitest run tests/engine/operation-scene-actions.test.ts tests/engine/gameplay-b-multiscene-location.test.ts` | 默认目标、优先级、覆盖与失败原子性通过 |
| 定向 UI | `npx vitest run tests/ui/operation-workspace-view.test.ts tests/ui/gameplay-b-operation-controller.test.ts` | 默认目标与用户改选投影通过 |
| 类型 | `npx tsc --noEmit` | 通过 |
| 文档 | `npm run check:docs` | 通过 |
| 差异 | `git diff --check` | 通过 |
