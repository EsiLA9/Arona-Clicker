# Task 0315 Unit U05c：Planner / Program 旧夹具迁移

状态：completed — 旧 Action 数组成功执行夹具已移除；新 Program Planner / Owner 覆盖保持并通过定向测试。

## Goal

删除 Planner / E1 Program 定向测试里仅用于旧 Action 数组的成功夹具，保留新 Program 的纯规划与 Owner 覆盖。

## Allowed Files

- `tests/engine/gameplay-b-effect-planner.test.ts`
- `tests/engine/gameplay-b-effect-program.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- 两份测试中的有效内容都使用新 effectProgram；不得继续把 `normalizeMapActionEffects` 的 legacy 结果当可执行合同。
- 保留 damage/heal planner、E1 conditions/resources、真实 Owner Preview / Commit 与费用失败覆盖。
- 若某个旧测试只验证已废弃数组可被解析，移除该用例并由 U09/U10 的 Registry 拒绝测试承接。

## Stop Conditions

- 需要更改产品源码、Receipt validator 或其他测试文件时停止并上报。

## Validation

- `npx vitest run tests/engine/gameplay-b-effect-planner.test.ts tests/engine/gameplay-b-effect-program.test.ts`
- `git --no-pager diff --check`
