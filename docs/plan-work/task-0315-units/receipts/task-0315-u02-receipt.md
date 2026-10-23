# Task 0315 U02 Receipt：Damage / Heal 纯规划与 Trace

## 结果

- 将 U01 的 damage/heal AST 纳入 `NormalizedGameplayMapEffectInstruction`，未修改旧数组和 legacy mode。
- Detached Planner 按单个 primary 规划 damage/heal；damage 降 HP，heal 增 HP，HP=0 不复活，按 cap/0 clamp。
- Trace 区分 `op: damage | heal`，保留请求 `amount` 与 clamp 后的实际 signed `delta`；即使实际 delta 为 0 仍记录事件。
- 后续指令失败时没有返回部分计划，输入快照保持不变。

## 修改文件

- `src/arona-clicker/services/map/map-effect-planner.ts`
- `src/arona-clicker/contracts/map/map-effects.ts`
- `src/data-services/normalization/gameplay-map-effect-program.ts`
- `tests/engine/gameplay-b-effect-planner.test.ts`
- `docs/plan-work/task-0315-units/task-0315-u02-damage-heal-planner.md`

## 验证

- `npx vitest run tests/engine/gameplay-b-effect-planner.test.ts`：通过，1 个测试文件、12 项测试。
- `git --no-pager diff --check`（U02 白名单代码）：通过。

## 边界

- 未改真实 Owner `map-run-service.ts`、费用／调度、effect summary、旧数组兼容移除、Schema 或内容。
- 未运行全量测试、类型检查或架构检查；由后续 Unit / 收尾任务处理。
