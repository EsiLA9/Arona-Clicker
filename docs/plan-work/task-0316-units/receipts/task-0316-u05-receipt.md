# Task 0316 U05 Receipt：Receipt 与 Save/Resume

状态：complete

## 交付

- E2 Trace 包含 selector、解析后的 identities、repeatCount，以及按目标序号／hitIndex 分组的逐次 damage/heal before/after/amount/delta。
- 同 scope 活动 checkpoint 可用时，Receipt 按 source order 反向还原 HP 与 Counter/Flag 起点，调用同一纯 Planner 重放并比较完整 E2 Trace；E1 Receipt 原路径保留。遭遇关闭后没有可信 Enemy HP checkpoint，只验证定义、集合身份／side、批次顺序、HP projection 和结算摘要。
- MapRun 从活动检查点验证 run 级最近 Receipt 时，传入匹配 scope 的活动 HP、locals 和资源余额，避免跨 Activity 带入的 Party HP 被误当作 Map 初值。
- 保存恢复接受 E2 多目标 HP projection；篡改成员、repeat 数、amount 或命中序号会拒绝。

## 验证

- `tests/engine/gameplay-b-effect-receipt.test.ts`：43/43。
- `tests/engine/gameplay-b-effect-save-resume.test.ts`：5/5；覆盖同 Encounter 恢复、跨 Activity 继承 Party HP 的 E2 source Value、Receipt 篡改拒绝和关闭 Encounter 后的胜利回执恢复。
