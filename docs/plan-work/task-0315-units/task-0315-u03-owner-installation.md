# Task 0315 Unit U03：Owner 安装与 Damage / Heal Receipt

状态：completed — Owner 已安装新 HP trace，并验证 Preview、Commit 与同请求重放。

## Goal

将新 damage/heal 规划结果沿当前 MapRun Preview / Commit / Receipt 链安装；保持 Effect Program 事务边界与失败零写入。

## Allowed Files

- `src/arona-clicker/services/map/map-run-service.ts`
- `src/arona-clicker/contracts/map/map-run.ts`
- `tests/engine/gameplay-b-effect-program.test.ts`
- `tests/engine/gameplay-b-effect-program-commit.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- Owner 使用纯 planner 结果产出确定性 HP 状态与 Trace；Preview 不写状态，成功 Commit 才安装。
- 错误目标、过期计划、无效 HP 状态和冲突重放不安装 damage/heal 结果。
- Receipt / 重放能区分 damage 与 heal；保留 E1 当轮费用、资源和提交顺序。

## Stop Conditions

- 需要改 Save/Resume 之外的状态 Owner、全局存档格式、GameInstance 外部事务或旧模式移除时停止并上报；后续 Unit 处理这些范围。

## Validation

- `npx vitest run tests/engine/gameplay-b-effect-program.test.ts tests/engine/gameplay-b-effect-program-commit.test.ts`
- `git --no-pager diff --check`
