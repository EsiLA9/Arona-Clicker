# Task 0316 U05：Receipt 与 Save/Resume

状态：complete — [[docs/plan-work/task-0316-units/receipts/task-0316-u05-receipt]]。

## 目标

保持 E2 回执严格且可重放：记录空集合、解析顺序、Value 结果和 repeat 命中；恢复时拒绝伪造、漏项、乱序或越界数据。

## 范围

- `src/arona-clicker/services/map/map-effect-receipt-validator.ts`、MapRun Save/Resume 和 Trace 冻结。
- 遭遇仍活动且同 scope checkpoint 可用时，使用最终 HP/locals 状态逆向还原规划起点，再按 source schedule 重放 E2 计划并和 Receipt 对比。遭遇关闭后没有可信 Enemy HP snapshot，改由结构、roster/目标阵营、HP projection 与结算摘要校验，不伪称可认证完整历史。
- Preserve E1 Receipt compatibility; no RNG state added in this slice.

## 完成条件

- 合法 E2 receipt 完整保存恢复。
- 修改集合成员/排序/重复次数、Value 结果、HP before/after、Receipt shape 或 source order 均被拒绝。
- 旧 E1 receipts 继续通过原验证路径。
