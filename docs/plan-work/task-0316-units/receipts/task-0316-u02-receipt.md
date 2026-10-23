# Task 0316 U02 Receipt：上下文绑定与归一化

状态：complete

## 交付

- E2 指令沿用 Program AST 与来源路径；target-set selector、Value 树和 repeat 在归一化后保持原序且不改写作者输入。
- Registry 限制 `target` HP 读取只出现在集合 damage/heal amount 中，`targetCount` 只用于集合语境；source/primary、Counter 按真实 Encounter / Action 来源绑定。
- 未开放资源余额 Value 或资源条件。

## 验证

- `tests/data/gameplay-b-effect-normalization.test.ts`：6/6。
- `tests/data/gameplay-b-effect-registry.test.ts`：12/12。
- Registry 接受合法集合表达，拒绝集合外 target 读取和未声明 Counter；E1 合同上下文回归通过。
