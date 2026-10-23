# Task 0315 Unit U03b：Damage / Heal Receipt 校验

状态：completed — Receipt 校验和两份边界回归已接入并通过指定验证。

## Goal

使 Map Effect Receipt 校验器按新 damage/heal 指令重算并验证 Trace 与实际 HP delta，拒绝损坏或伪造的记录。

## Allowed Files

- `src/arona-clicker/services/map/map-effect-receipt-validator.ts`
- `tests/engine/gameplay-b-effect-receipt.test.ts`
- `tests/engine/gameplay-b-effect-receipt-boundaries.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- damage/heal Trace 分别按正 amount 与实际 signed delta 重算；身份、路径、前后 HP、cap 与行程顺序均须匹配。
- 修改 op、amount、身份、path、实际 delta 或结算 HP 时校验拒绝；合法 0 actual delta 仍通过且保留 Trace。
- 旧数组 Receipt 行为暂时保持，后续 U07 才移除。

## Stop Conditions

- 需要改变 Receipt schema、SaveData 顶层版本或实现无法证明的历史快照迁移时停止上报。

## Validation

- `npx vitest run tests/engine/gameplay-b-effect-receipt.test.ts tests/engine/gameplay-b-effect-receipt-boundaries.test.ts`
- `git --no-pager diff --check`
