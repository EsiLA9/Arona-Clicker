# Task 0315 U06b Receipt：Receipt Legacy 路径移除

状态：completed。

## 结果

- 本 Unit 从原 U07b 调整并改名为 U06b；主 Task 施工序列现已同步引用新编号。
- `map-effect-receipt-validator.ts` 不再重建旧 HP/resource phase、不再验证旧 Action 投影，也不再接受无 Program header 的历史 Receipt。Resource、HP、Prepare 投影必须由 Program visits / trace 与 settlements 对应；新格式 `damage`、`heal`、`hpChange`、条件、Counter/Flag、费用和资源账本重算仍保留。
- Program normalizer 只接收从 Action 白名单字段重组的 Program 视图；Receipt validator 不从 `effects`、`hpEffects`、`cardEffects` 读取旧数据。
- 两个 Receipt 测试文件中的旧数组成功夹具迁移为 Program：真实 CardRef prepare、Ability heal 与 Item guard、Team resource projection、缺少可信终余额的 resource receipt。`item.hpChanges` 空数组断言按当前 Owner 回执形状记录。
- 增加缺失 Program header、伪造 `mode:'legacy'` trace / visit 的拒绝覆盖；保留合法 HP 零 delta、Counter/Flag、Item/Ability 来源、replay 和篡改 Receipt 边界。

## 验证

- 最终运行 `npx vitest run tests/engine/gameplay-b-effect-receipt.test.ts tests/engine/gameplay-b-effect-receipt-boundaries.test.ts --silent`：**2 files / 48 tests passed**。
- 实际执行白名单 `git --no-pager diff --check`，通过；未跟踪 Unit 与 Receipt 的尾随空白检查无命中。
- 首次运行时共享工作树的 Owner 代码仍在并行变化，出现9项失败；后续复跑收敛为一条断言与当前回执形状不符（无 HP 变化时显式为 `[]`），只更新了 U06b 测试断言，未修改 U06 Owner 实现。最终指定测试全绿，无剩余 U06 依赖。
