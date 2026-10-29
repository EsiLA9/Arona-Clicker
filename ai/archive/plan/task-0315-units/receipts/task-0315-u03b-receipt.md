# Task 0315 U03b Receipt：Damage / Heal Receipt 校验

状态：completed

## 实际修改

- `src/arona-clicker/services/map/map-effect-receipt-validator.ts`：将 `damage` / `heal` 加入精确 Trace 字段白名单与 identity 校验；按声明 `amount`、`primary`、声明 cap、前后 HP 和 signed delta 重算 Clamp 结果。Damage/heal 的事件按其真实 Program 指令顺序进入 HP projection 链，0 delta 仍须逐条对应 Receipt `hpChanges`。
- `tests/engine/gameplay-b-effect-receipt.test.ts`：新增 Owner 生成的 Damage→Heal Receipt，有 overkill、倒地治疗不复活和 0 delta；分别篡改 op、amount、identity、path、before、after、trace delta 与 settlement delta，均断言拒绝。
- `tests/engine/gameplay-b-effect-receipt-boundaries.test.ts`：覆盖 `Number.MAX_SAFE_INTEGER` damage/heal 与倒地零变化 Trace；验证最大合法请求可以正确 Clamp，并拒绝越界 amount、伪造 identity 和 path。
- 旧 `hpChange` 与旧数组 Receipt 验证逻辑保留；未修改 Schema、SaveData 版本、Owner 或 Task 范围外文件。

## 验证

- `npx vitest run tests/engine/gameplay-b-effect-receipt.test.ts tests/engine/gameplay-b-effect-receipt-boundaries.test.ts`：通过，2 个文件、45 项测试。
- `git --no-pager diff --check -- src/arona-clicker/services/map/map-effect-receipt-validator.ts tests/engine/gameplay-b-effect-receipt.test.ts tests/engine/gameplay-b-effect-receipt-boundaries.test.ts`：通过。
- 对新增 boundary 测试做尾随空白扫描：无匹配。
