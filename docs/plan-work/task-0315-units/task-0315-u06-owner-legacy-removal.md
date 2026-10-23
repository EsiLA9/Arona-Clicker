# Task 0315 Unit U06：MapRun 旧执行模式移除

状态：completed — 依赖 U03b、U04、U05、U05b、U05c 已完成；Owner 不再按旧数组分相位执行。

## Goal

删除 MapRun Owner 中由旧 Action 数组驱动的 legacy phase / fallback 执行路径，保留当前 effectProgram、费用结算、Enemy 调度和 CardRef prepare。

## Allowed Files

- `src/arona-clicker/services/map/map-run-service.ts`
- `src/arona-clicker/services/map/map-card-effects.ts`
- `tests/engine/gameplay-b-effect-legacy-goldens.test.ts`
- `tests/engine/gameplay-b-effect-card-prepare.test.ts`
- `tests/engine/gameplay-b-map-run.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- Runtime 只执行 effectProgram；不再按 `legacyPhase` 将 HP / 资源插回旧来源相位。
- prepare 折扣仍按真实 CardRef / Actor sCost 工作；Shop 与 Item 事务不变。
- 命中旧数组的金样输入已转新格式或删除；MapRun 关键行为回归通过。

## Stop Conditions

- 修改 Save/Resume Receipt、Runtime ReadModel / UI 投影或动作源 Schema 时停止；由 U06b/U07/U07c/U08/U09 收尾。

## Validation

- `npx vitest run tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-map-run.test.ts`
- `npx vitest run tests/engine/gameplay-b-effect-card-prepare.test.ts`
- `git --no-pager diff --check`

Receipt：[[docs/plan-work/task-0315-units/receipts/task-0315-u06-receipt]]
