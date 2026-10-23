# Task 0315 Unit U02：Damage / Heal 纯规划与 Trace

状态：completed — detached Planner 与 Trace 已支持 damage/heal；U03 可继续 Owner 接线。

## Goal

让 detached effect planner 将 damage/heal 规划为有序 HP 变化与可区分的结果 Trace；仍只产生计划，不写真实 Owner 状态。

## Confirmed Facts

- `src/arona-clicker/services/map/map-effect-planner.ts` 在隔离计划状态中执行 `hpChange` 并按 HP cap 约束结果。
- `src/arona-clicker/contracts/map/map-effects.ts` 定义执行 Trace 结果。
- Damage/heal 共用 HP 账本；damage 降 HP，heal 增 HP 但不复活，零实际变化仍记录新语句身份。

## Allowed Files

- `src/arona-clicker/services/map/map-effect-planner.ts`
- `src/data-services/normalization/gameplay-map-effect-program.ts`
- `src/arona-clicker/contracts/map/map-effects.ts`
- `tests/engine/gameplay-b-effect-planner.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- damage/heal 按 U01 语法解析，顺序结果进入计划与 Trace，HP clamp 与不复活语义正确。
- 覆盖伤害到 0、对已倒地目标治疗、治疗到 cap、伤害 overkill、零实际变化和原子失败计划。
- 现有 hpChange / resource / Counter / Flag 与 when 行为无变化。

## Stop Conditions

- 需要写真实 Owner、修改预算或更改费用／调度时序，或超出 Allowed Files 时停止并上报。

## Validation

- `npx vitest run tests/engine/gameplay-b-effect-planner.test.ts`
- `git --no-pager diff --check`
