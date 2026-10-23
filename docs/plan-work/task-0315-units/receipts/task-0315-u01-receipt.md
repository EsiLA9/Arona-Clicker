# Task 0315 U01 Receipt：Damage / Heal 作者语法

## 结果

- 在 `GameplayMapEffectStatementDef` 新增 `{ op: 'damage' | 'heal', target: 'primary', amount }` 作者节点；`amount` 由语法校验限制为正安全整数。
- 对 target、缺失 / 零 / 负 / 小数 / 超安全整数数量、未知字段和未知操作添加拒绝断言。
- 现有 `hpChange`、旧数组字段准入、Owner 与生成 Schema 均未改。

## 修改文件

- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `tests/data/gameplay-b-effect-syntax.test.ts`
- `docs/plan-work/task-0315-units/task-0315-u01-damage-heal-syntax.md`

## 验证

- `npx vitest run tests/data/gameplay-b-effect-syntax.test.ts`：通过，1 个测试文件、7 项测试。
- `git --no-pager diff --check`（U01 产品改动）：通过。

## 边界

- 未改 Owner `map-run-service.ts`、旧数组兼容路径、Schema 生成结果或内容。
- 未运行全量测试、类型检查或架构检查；留待对应 Unit / 收尾任务。
