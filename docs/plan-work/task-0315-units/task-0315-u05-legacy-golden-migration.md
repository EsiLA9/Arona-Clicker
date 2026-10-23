# Task 0315 Unit U05：旧金样转新语义回归

状态：completed — 两份回归测试已迁移到冻结的新 Program 节点并通过指定验证。

## Goal

保留旧模式金样所代表的行为覆盖，但将有效输入转成新 effectProgram，逐项明确相同结果和新顺序下的预期差异。

## Allowed Files

- `tests/engine/gameplay-b-effect-legacy-goldens.test.ts`
- `tests/engine/gameplay-b-effect-card-prepare.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- OLD 行为矩阵不再要求 Runtime 接受 legacy 数组；有效场景均以新 AST 运行。
- 所有因旧分相位改为显式 Program 顺序而改变的结果都在用例命名／断言中明确，不把旧语义作为暗中兼容要求。
- 保留费用不足、HP=0/倒地、Enemy skip、准备期折扣与资源结算边界的回归覆盖。

## Stop Conditions

- 新语法或 Owner 安装尚不可用时，只读整理并等待；不得扩写第二种 AST 或改产品代码。

## Validation

- `npx vitest run tests/engine/gameplay-b-effect-legacy-goldens.test.ts tests/engine/gameplay-b-effect-card-prepare.test.ts`
- `git --no-pager diff --check`
