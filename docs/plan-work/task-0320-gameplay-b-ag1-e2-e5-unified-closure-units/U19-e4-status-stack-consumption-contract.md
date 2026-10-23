# U19-E4：按精确 Status ID 消费部分层数

> **状态：合同已冻结，U19a–e 已完成。** 自动化和静态检查通过；屏幕人工验收未执行，见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/U19-screen-acceptance-report]]；回执见 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure-units/receipts/U19-receipt]]。本 Unit 在 U16 全量 `statusRemove` 之上增加一个可重放的按 ID 部分层数消费原语；不定义 Status 类别、净化类别、复苏或 Trigger。

## 目标与当前基线

Task 0318 已交付 Encounter-local `burn` / `regen`、按来源与 Action 归属的 Status 实例以及 roundEnd 结算。Task 0320 U16 已交付 AG-1 `statusRemove`：按一个已解析单位与精确 Map-local Status ID 清除该目标全部匹配实例，空匹配是 no-op；它保持 scheduler v5、使用 Status Receipt v2，E1/legacy Status Receipt v1 不变。

U19 只补“消耗指定 ID 的至多 N 层”，用于玩法在不移除整个 Status 的情况下减少强度。Status 仍由 Encounter Owner 持有，不能改变生效时机或长期归属。

## 冻结合同

### 作者语义

- 新增闭合 AG-1 Effect Program 语句 `{ op: 'statusConsume', target, statusId, stacks }`。
- `target` 仅为 `source` 或单位 `primary`；`source` 仅适用于 Party Character / Enemy Actor 来源，Ability / Item 必须使用有效单位 `primary`。CardRef、additionalTarget、TargetSet、`loopTarget` 与 Team 均不是 Status holder。
- `statusId` 必须存在于 Map 声明的 Status；`stacks` 是 1–99 的正 safe-integer 字面量。此 Unit 不为消费量开放 Value、动态计算、条件或类别过滤。
- `statusConsume` 只允许 AG-1 Program；E1/legacy 行为和独立 Validator 路径不变。它作为普通语句计入既有静态/动态 Program 访问预算。Status 已归属倒地单位也可被消费，因为此操作不读写 HP。

### 消费顺序与状态变化

- 每条语句在执行时解析一次 holder identity，并只匹配该单位、该 `statusId` 的活动实例。前序语句的状态变化对后序语句可见；`statusApply`、`statusRemove` 与 `statusConsume` 按 Effect Program 语句顺序组合。
- 若匹配多个来源实例，优先消费 `remainingRounds` 较小（较早到期）的实例；相同时按既有稳定顺序 `statusId → stable source key → actionId`。不使用数组偶然顺序、来源执行顺序或 UI 顺序。
- 每个实例消费 `min(该实例 stacks, 剩余请求 stacks)`。剩余层数大于 0 时只更新 `stacks`；降至 0 时移除该实例。`appliedRound`、`lastTriggeredRound`、`remainingRounds`、source、Action 与 holder 均不变。
- 匹配层数少于请求时消费全部可用层数并成功；无匹配时成功 no-op。Receipt 显式记录请求、实际消费、未满足量和完整受影响实例，因而恢复不依赖“成功/失败”推断。
- 每条 Trace 行包含 `sourceKey`、`actionId`、`path`、来源与 `mode: 'program'`、holder `identity`、`statusId`、`requestedStacks`、`consumedStacks`、`unmetStacks` 及 `changes`。每个 change 包含执行前在 detached 数组中的 `statusIndexBefore`、完整 `statusBefore`、`consumedStacks` 和完整 `statusAfter`（移除实例时为 `null`）。零匹配时 `changes: []`、`consumedStacks: 0`、`unmetStacks: requestedStacks`。
- Status 定义的 `maxStacks` 仍约束单一实例的既有申请／刷新语义；一次 `statusConsume.stacks` 可跨来源实例分配，最多请求 99 层。操作不增加实例、不续期或缩短持续时间，也不触发到期事件。

### Receipt、版本与恢复

- Status 专用 Receipt 升为 `statusReceiptVersion: 3`，仅对包含 `statusConsume` 作者语义的 Map。每次该 Map 的 AG-1 Commit 都带版本 3 和显式 `statusConsumeTrace`（即使本轮来源全部 skip 或没有实际匹配）。Trace 按执行顺序记录来源、Action、语句路径、完整 holder identity、Status ID、请求/消费/未满足层数及每个实例消费前后的完整值和原数组索引。
- 既有 statusApply Map 继续 v1；只含 U16 `statusRemove` 的 Map 继续 v2；无 `statusConsume` 的历史 Receipt 字段与 Restore 必须保持精确兼容。Program Receipt 版本仍独立：CardRef Modifier evidence 按既有规则 v2，否则 v1。Shield Map 仍独立使用 scheduler v6 / Shield Receipt v1；U19 本身不提升 scheduler version。
- Restore 使用 scheduler 起点与真实来源重放，逐字段校验 Status Apply / Remove / Consume / roundEnd trace、最终 `plannedStatuses`、HP 与活动 Owner；缺失、重复、改序或篡改证据拒绝恢复。E1/legacy Status Receipt v1 路径保留。
- 只新增 `statusConsume` 的既有 AG-1 Map 必须提高自身 `resumeVersion`；U19 正式示例 `gameplay-b:map:status-example` 从 U16 的 version 2 升到 3。不写存档迁移器。

### 原子性与明确边界

- Preview 在副本上运行，不改 live Status。Consume trace、Status 列表、roundEnd HP、费用、资源、Shield、Facts、库存与 Commit Receipt 仍由 MapRun 唯一 Owner 一次 detached 计划安装。
- 后续语句失败、预算超限、stale draft、Restore 校验失败或 Owner 安装失败时，不安装任何部分结果。
- 本 Unit 不增加 `category` 字段或类别净化，不改变 burn/regen tick，不恢复 HP、不改 Shield、不触发 `damageApplied`/`healApplied`/`onExpire`，不跨 Encounter 或 Node 保留 Status，也不修改 Trigger 资格。

## 施工切片

按依赖串行审查、可并行实现；各片只修改所列文件。新增文件须先补入本表。

### U19a：作者 AST / Context / Registry / Schema

- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `src/data-services/validation/gameplay-map-effect-context.ts`
- `src/data-services/registry/registry-validate.ts`
- `tests/data/gameplay-b-effect-syntax.test.ts`
- `tests/data/gameplay-b-effect-registry.test.ts`
- `tools/datapack-editor/schema/engine-schema.sync.test.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（只运行 Schema 生成器）

### U19b：纯 Planner 与版本化 trace 结构

- `src/arona-clicker/contracts/map/map-effects.ts`
- `src/arona-clicker/services/map/map-effect-planner.ts`
- `src/arona-clicker/services/map/map-encounter-statuses.ts`（仅当共享稳定排序/拷贝 helper 必需）
- `tests/engine/gameplay-b-effect-planner.test.ts`

### U19c：AG-1 Owner / Receipt / Restore / Save

- `src/arona-clicker/contracts/map/map-run.ts`
- `src/arona-clicker/services/map/map-run-service.ts`
- `src/data-services/validation/gameplay-map-effect-context.ts`（仅在 U19a 暴露 Map feature helper）
- `tests/engine/gameplay-b-map-ag1-commit.test.ts`
- `tests/engine/gameplay-b-map-ag1-restore.test.ts`
- `tests/engine/gameplay-b-effect-save-resume.test.ts`

### U19d：ReadModel / Workspace

- `src/arona-clicker/contracts/runtime/runtime.ts`
- `src/arona-clicker/runtime/runtime-game-instance.ts`
- `src/ui/flow/map-flow-model.ts`
- `src/ui/components/map/map-workspace.ts`
- `tests/ui/map-flow-adapter.test.ts`
- `tests/ui/gameplay-b-map-workspace.test.ts`

### U19e：正式作者样例

- `src/arona-clicker/content/gameplay-b/gameplay-b-status-example.ts`
- `tests/engine/gameplay-b-effect-example.test.ts`
- `docs/examples/gameplay-b-statuses.md`

## 完成证据

- AST、Context、Registry、Schema 接受合法字面量与目标，并拒绝未知 ID、闭合字段外、非正整数、非法 source/primary 和 E1/legacy 不兼容用法。
- Planner 覆盖单实例部分消费、多来源到期优先、层数不足/no-op、remove/apply/consume 次序、倒地 holder 与输入不变。
- Owner 覆盖 scheduler v5/v6 与 Status Receipt v1/v2/v3 共存、来源 skip 的空 Trace、Commit 与 Save/Restore 重放、Trace 篡改拒绝及失败原子性。
- 正式 Status 示例演示 `2 → 1` 部分消费和 exact-ID 全清并存；工作台 RecentCommit 可解释受影响实例，不把实时 Runtime 写引用暴露给 Component。
