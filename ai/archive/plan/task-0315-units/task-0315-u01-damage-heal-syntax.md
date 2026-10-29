# Task 0315 Unit U01：Damage / Heal 作者语法

状态：completed — damage/heal AST 与严格语法校验落地；U02 可继续。

## Goal

在有限 `effectProgram` AST 中加入 `damage` / `heal` 语句语法及结构校验，不改变现有 HP Owner、旧兼容模式或字段准入行为。

## Confirmed Facts

- `GameplayMapEffectStatementDef` 位于 `src/data-services/contracts/gameplay-map-effects.ts`，当前 HP 节点为带符号 `hpChange`。
- `src/data-services/validation/gameplay-map-effect-syntax.ts` 负责递归语法、节点和数量校验。
- Task 0315 冻结新节点 `{ op: 'damage' | 'heal', target: 'primary', amount: positive safe integer }`；不支持 `source`、集合、Value 或负数。

## Allowed Files

- `src/data-services/contracts/gameplay-map-effects.ts`
- `src/data-services/validation/gameplay-map-effect-syntax.ts`
- `tests/data/gameplay-b-effect-syntax.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- 有效 damage/heal 节点通过语法验证；`amount` 必须为正安全整数，target 固定为 `primary`。
- 错误 op、缺失字段、错误 target、0、负数、小数、超安全整数和未知字段均被定位拒绝。
- 旧 `hpChange` 与现有旧字段校验此 Unit 内保持不变；不改生成 Schema 文件。

## Stop Conditions

- 需要改 Allowed Files 外的文件、改变目标范围／数量边界，或需要集合 / Value 才能表达当前内容时停止并上报。

## Validation

- `npx vitest run tests/data/gameplay-b-effect-syntax.test.ts`
- `git --no-pager diff --check`
