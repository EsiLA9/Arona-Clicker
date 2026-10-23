# Task 0315 Unit U06b：Receipt Legacy 路径移除

状态：completed — Receipt validator 仅重建新 Program 结果；旧格式夹具已迁移，定向测试通过。

## Goal

从 Receipt 校验器中删除旧 Action 数组的分相位投影路径；只按 effectProgram Trace / settlement 重新计算与校验。

## Allowed Files

- `src/arona-clicker/services/map/map-effect-receipt-validator.ts`
- `tests/engine/gameplay-b-effect-receipt.test.ts`
- `tests/engine/gameplay-b-effect-receipt-boundaries.test.ts`
- 本 Unit 与对应 Receipt

## Completion Criteria

- Receipt 校验不再接受无 Program header 的历史 Receipt，也不从旧 Action 数组重建 resource / HP / prepare 投影。
- 迁移后的成功夹具只使用 effectProgram；伪造 `mode: legacy`、缺失 Program header 或实际变化无 Program 声明均拒绝。
- Program Receipt 的 damage / heal / hpChange / resource / Counter / Flag / when / prepare 链继续验证准确的 identity、path、amount、phase、末值与实际 delta。
- 损坏或旧模式 Receipt 拒绝；合法 zero-delta 与同 requestId replay 证据保留。

## Stop Conditions

- 需要改变存档主格式、Engine 事务或未裁定历史迁移策略时停止。

## Validation

- `npx vitest run tests/engine/gameplay-b-effect-receipt.test.ts tests/engine/gameplay-b-effect-receipt-boundaries.test.ts`
- `git --no-pager diff --check`
