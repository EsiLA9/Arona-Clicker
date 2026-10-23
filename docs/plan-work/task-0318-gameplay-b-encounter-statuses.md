# Task 0318：Gameplay B Encounter-local Status 首片

状态：completed（2026-10-22）— 已实施单位级、Encounter-local 的 burn / regen，在成功 MapRun 回合边界结算，并贯通保存、回执重放和只读展示。按用户指示豁免实屏／浏览器验收；组件行为测试与其余定向验证已完成。

## 目标

为 MapRun 增加有限、可审计的持续状态原语。Status 由 Map Action 的受限 Effect Program 施加，挂在当前 Encounter 的 Character / Enemy 身上；只在 MapRun 的成功回合提交边界结算。Status 不进入 PlayerState，不接 AC Tick、EventBus、Trigger 或 Affector。

本 Task 只交付 `burn` 与 `regen`。Shield、净化、复活、反击／受治触发、效果修正及跨 Encounter 状态留到独立后续 Task。

## 冻结合同

- Map 以 `statuses` 声明 Map-local 的静态状态定义：唯一 `id`、显示名称、可选说明、`kind: 'burn' | 'regen'`、正安全整数 `hpPerStack` 与 `maxStacks`（上限 99）。每个 Map 最多声明 64 个 Status，定义不含任意脚本或 AC 资源路径。
- Effect Program 的 `statusApply` 只通过 `source` 或 `primary` 单位目标施加已声明状态，显式声明正整数 `stacks`（不超过该定义 `maxStacks`）与 `durationRounds`（1–99）；Status 本身不能把 CardRef、Team 或 MapRun 当作持有者。source 为空的 Ability / Item 只能用 primary。
- Status 身份由 `(持有单位, statusId, MapEffectProgramSourceIdentity, actionId)` 唯一确定。现有 `MapEffectProgramSourceIdentity` 对 Character / Enemy 只记录来源单位，因此额外保留声明该 Status 的 `actionId`，确保同一单位使用不同 Action 时来源独立；Ability / Item 也保留该字段以形成统一键。相同来源再次施加时层数累加至定义上限，持续轮数重置为新申请时长；来源不能由 UI 名称或随机 ID 决定。
- 第 N 轮施加的全新实例不会在 N 轮末触发；首次在 N+1 轮末触发。持续轮数只在成功提交的回合边界递减。实例保存 `appliedRound`、`lastTriggeredRound`、层数和剩余轮数；同轮重施既刷新 duration / stacks，也保留已有实例本轮应触发的资格。
- 对非终局回合，普通 Party、Enemy、Ability、Item 来源全部规划完成后统一处理 roundEnd Status，再判终态／遭遇完成。固定顺序为 Map Party roster、Encounter Enemy roster；同一单位内按 `statusId` 与规范化来源身份稳定排序。若普通来源已达终局则跳过 Status tick 并清除 Encounter-local 状态；否则 tick 可以造成终局。tick 后若 Party 与 Enemy 同时全灭，失败优先于胜利。非战斗 rounds / condition 完成在 tick 后判定。
- burn / regen 都沿用 E2 HP 上限与不复活规则。倒地单位上的实例仍在轮末消耗时长，但伤害／治疗实际 HP 变化为 0；regen 不复活。多层效果量用安全整数计算，溢出拒绝整个 detached 计划。
- 状态实例最多 256 个；超过上限拒绝整个 detached 计划。状态状态只在 active Encounter 保存；进入新 Encounter、成功离开或 Run 终局后清除。Save/Resume 必须验证状态定义、持有者、来源、时间戳、层数和剩余时长，不能只反序列化 JSON。
- Preview 与 Commit 共用纯计划；状态、HP、费用、资源、locals、库存与终态必须原子安装。失败或 stale plan 不安装任何部分结果。Status tick 不消费 Action Program visit budget；`statusApply` 是普通 Effect Program statement，计入现有静态／动态预算。
- Action program 中的状态申请进入现有 `effectTrace` 与 `programVisits`。轮末派生 tick 是回合边界事件，不伪装成 Action 语句访问：通过版本化的独立 `statusTrace` 重放状态时长和 HP delta，并与 Receipt `plannedStatuses`、active Encounter Snapshot 交叉验证。新增 Status Receipt 字段使用 `statusReceiptVersion: 1`；E1/E2 的 Program Receipt 既有版本语义保持不变。
- `plannedStatuses` 表示本轮 Status 结算计划的回执证据。普通来源先使 Encounter 终局时跳过 tick，Receipt 中的 `plannedStatuses` 与 `statusTrace` 为空；tick 后才终局时 Receipt 保留轮末结算后的历史状态以供重放，实际终局 Run／active Encounter 仍清除全部状态。
- UI 从 Runtime ReadModel 读取状态名、层数和剩余轮数，在现有 Map Workspace 单位区域小幅展示；不在 UI 计算状态效果或持有状态。

## 验收

- Registry / Schema 接受合法 burn / regen 定义和 `statusApply`，拒绝重复／未知 ID、错目标、未声明引用、非法数值、越界层数／时长和闭合字段外数据。
- 两轮可观察样例证明第 N 轮施加不立即触发、N+1 轮末按定义 HP clamp 结算；可保存后恢复并从剩余时长继续。
- 覆盖同来源重施刷新与封顶、不同来源独立、状态固定顺序、倒地对象不复活、最后一次触发后移除、Encounter 退出清空、状态 tick 触发终局及失败优先。
- Preview 不改变 HP／状态／Receipt；安装失败不留下半次 HP 或 Status 变化；Receipt / Save 中状态篡改、来源不符、时长跳变或伪造 HP delta 被拒绝。
- 只读 UI 展示与 Runtime 当前 Status 一致；更新保留 Map Workspace 的 Frame、滚动 owner、有效按钮和范围外浮层。

## 施工单元

### U01 — 作者合同、语法、Registry 与 Schema（completed）

Allowed Files：

- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/contracts/gameplay-map.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `src/data-services/validation/gameplay-map-effect-context.ts`
- `src/data-services/normalization/gameplay-map-effect-program.ts`
- `src/data-services/registry/registry-validate.ts`
- `tests/data/gameplay-b-effect-syntax.test.ts`
- `tests/data/gameplay-b-effect-registry.test.ts`
- `tests/data/gameplay-b-effect-normalization.test.ts`
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（仅由生成器更新）

完成条件：静态 Status 定义与 `statusApply` 有闭合合同、上下文校验和 Schema；Registry 阻止未知状态与不可能的单位目标。

### U02 — Detached 规划、Status 生命周期、Receipt 与 Save/Resume（completed）

Allowed Files：

- `src/arona-clicker/contracts/map/map-effects.ts`
- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/services/map/map-encounter-statuses.ts`（新文件）
- `src/arona-clicker/services/map/map-effect-summary.ts`
- `src/arona-clicker/services/map/map-effect-planner.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `src/arona-clicker/services/map/map-effect-receipt-validator.ts`
- `tests/engine/gameplay-b-effect-planner.test.ts`
- `tests/engine/gameplay-b-effect-program-commit.test.ts`
- `tests/engine/gameplay-b-effect-receipt.test.ts`
- `tests/engine/gameplay-b-effect-save-resume.test.ts`
- `tests/engine/gameplay-b-effect-lifecycle.test.ts`
- `tests/engine/gameplay-b-effect-receipt-boundaries.test.ts`
- `tests/engine/gameplay-b-map-run.test.ts`

完成条件：Status 状态经过唯一 MapRun Owner 的 detached 整轮计划；所有状态变更能被 Receipt 重放和存档严格恢复；失败原子、幂等及旧 E1/E2 Receipt 行为保持。

### U03 — ReadModel、最小单位展示与作者示例（completed）

Allowed Files：

- `src/arona-clicker/contracts/runtime/runtime.ts`
- `src/arona-clicker/contracts/map/map-relations.ts`
- `src/arona-clicker/runtime/runtime-game-instance.ts`
- `src/arona-clicker/services/map/map-effect-summary.ts`
- `src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack.ts`
- `src/arona-clicker/content/gameplay-b/gameplay-b-status-example.ts`（新文件）
- `src/ui/components/map/map-workspace.ts`
- `src/ui/workspace/map-dom-updates.ts`（仅在状态行需稳定 keyed 更新时）
- `src/ui/css/map-workspace.css`
- `tests/engine/gameplay-b-effect-example.test.ts`
- `tests/engine/gameplay-b-effect-projection.test.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`
- `tests/ui/map-dom-updates.test.ts`
- `docs/docs-829/03-data-structures/datapack-contracts.md`
- `docs/examples/gameplay-b-statuses.md`（新文件）
- `docs/plan-work/draft-0312-gameplay-b-card-and-effect-primitives.md`
- `docs/plan-work/00-index.md`
- `docs/plan-work/task-0318-gameplay-b-encounter-statuses.md`

完成条件：真实 DataPack 与作者示例演示至少一种 burn；ReadModel 投影 Status 的名称／层数／剩余轮数；Map Workspace 用现有桌面风格、状态源与 keyed 更新显示，不持有玩法逻辑。

内容／作者文档子单元：新增 `gameplay-b:map:status-example`，通过“进入状态原语演练”Map entry 可访问；Map 声明 `burn` 并提供 `statusApply` Action。示例加载及进入测试为 `tests/engine/gameplay-b-effect-example.test.ts`；作者说明位于 [[docs/examples/gameplay-b-statuses]]。该子单元不替代本 U03 的 ReadModel 与 Workspace 验收。

## 验证计划

- 跑上述语法、Registry、Planner、Commit、Receipt、Save/Resume、Lifecycle、边界与 Map UI 定向测试。
- 跑 `npm run gen:schema`、`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs` 与 `git --no-pager diff --check`。
- 界面扩展沿用现有 Map Workspace 三列与 keyed unit 节点：Party 状态行继续在 Party 单位节点内，Enemy 状态行继续在 Enemy 区域的单位节点内；状态列表作为单位节点的局部子区域，新增或变化只替换状态子区域，不重建列、滚动 owner、手牌或焦点控件。无新路由、无新交互和无新视觉方向。
- 收尾时对直接影响文件做一次 GALHCG `changed` 只读核对；不执行 graph edit、refresh 或 freshness 写入。

## 收尾记录

- `statusApply`、burn／regen 轮末结算、状态来源身份、失败优先、终局清理、回执重放、Save/Resume、ReadModel、keyed 单位展示与可进入作者样例已完成。tick 后终局 Receipt 保留历史结算列表用于校验；该列表不是活动 Encounter 状态。
- 定向 Vitest 13 个文件、171 项通过；Schema 同步测试 15 项通过。`npm run gen:schema` 确认生成文件无需变更；`npx tsc --noEmit`、`npm run check:architecture`、`npm run check:docs`、`git --no-pager diff --check` 均通过。
- 用户已豁免实屏／浏览器验收；本次未操作浏览器、未产出屏幕验收截图。UI ReadModel 与 DOM 稳定更新由组件行为测试覆盖。
- GALHCG `changed` 只读复核未写图或刷新。`datapack-contracts.md` 已映射但报告 4 条旧 Evidence 为 stale；本 Task 的若干源码、计划及示例路径没有直接 Evidence / `maps_to` 关联。按项目边界保留为维护报告，不在本 Task 内改图。

## 后续边界

此 Task 不实现 Shield／伤害修正、Status 清除与层数消费、受伤或治疗反应事件、同一 Status 以外的无限脚本触发、跨 Encounter 持续状态或成长／外部 Adapter；这些未完成能力已统一归并到 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]]，并须冻结算点与 Receipt 证据，不能接入 AC EventBus 回调写 Run。
