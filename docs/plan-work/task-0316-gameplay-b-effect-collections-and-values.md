# Task 0316：Gameplay B Effect 集合与 Value

状态：completed — U01–U07 与收尾证据均完成；交付 E2 确定性集合 damage/heal、受限 Value 与每目标 repeat。本 Task 不代表随机目标、任意语句体 forTargets 或资源余额 Value 已实现。

## 目标

在 E1 `effectProgram` 上增加有限的确定性集合伤害／治疗、整数 Value 与有界重复。效果集合在语句到达时从当前 detached HP 解析并固定；规划器继续只写独立计划，Owner 仍负责费用预检、原子安装、回执和 Save/Resume。

本 Task 明确实现：

- `damage` / `heal` 可使用单一 `primary` 或显式目标集合；目标集合按 Party roster / Enemy 定义顺序展开，可选择 living / all、HP 比例排序及最多 32 个目标。
- damage/heal amount 和 hit repeat 可使用安全整数 Value。Value 包含字面量、source/primary/当前受击目标 HP/cap/missingHP、Counter、Round、集合人数，以及 add/sub/mul/floor-div/min/max/clamp/abs。
- 每个 damage/heal 语句的 repeat 为 0–8；每个来源展开操作不超过 1024，整轮仍受 4096 Program visit 限制。除法向负无穷取整；零除、越安全整数范围、负伤害／治疗量及 repeat 越界拒绝。
- 目标集合求值和实际结果写入可验证 Receipt；遭遇仍活动且有同 scope checkpoint 时，Restore 按已保存最终 Owner 状态反向还原规划起点并重放 E2 来源计划，校验目标顺序、Value、重复命中、HP 结果与 source order。遭遇关闭后不再有可信 Enemy HP snapshot，Receipt 仍校验定义、批次形状、目标阵营／roster、HP projection 和结算摘要，但不声称可重算已离场 Encounter 的目标完整性。

随机无放回选择暂留独立 E2R：它需要单独的 Owner 随机算法、checkpoint、Preview 克隆与 Commit 安装合同，不能消费 Hand RNG。任意声明语句体的 `forTargets` 暂缓；本 Task 的有界重复只作用于 damage/heal 命中。资源余额 Value 与资源条件暂缓，费用次序合同未改变。E3 Card Tag / Pool、E4 Status / Shield / revive、E5 相对位置／跨卡修正均不在范围内。`hpChange` 保留为 E1 Program 节点，与 Task0315 移除的 Action 旧数组无关。

## 冻结的作者形状

```ts
{
  op: 'damage' | 'heal',
  target: 'primary' | {
    set: {
      side: 'party' | 'enemy',
      filter?: 'living' | 'all', // 默认 living
      order?: 'definition' | 'hpRatioAscending' | 'hpRatioDescending',
      limit?: 1..32,
    }
  },
  amount: positiveInteger | ValueExpression,
  repeat?: 0..8 | ValueExpression, // 默认 1
}
```

集合先按领域顺序枚举并过滤，再以 HP 比例排序（交叉相乘；相同值保留领域顺序），最后应用显式 `limit`。不提供 limit 且候选超过 32 个时拒绝，不静默截断。`all` 可包含倒地单位，但 damage/heal 不复活零 HP；默认 living 集合排除倒地单位。对每个集合成员连续完成其 repeat 命中；命中间重新读取当前 HP，集合成员本身不重算。空集合合法，Receipt 明确记录零成员。

## 施工单元

见 [[docs/plan-work/task-0316-units/task-0316-units-index]]。Unit Receipt 在对应单元完成后登记。

## 关键验证

- syntax / Registry / 生成 Schema 拒绝非法 op、字段、引用、深度、节点数与边界值。
- planner 验证集合固定、领域顺序、精确 HP 比例排序和稳定平手、空集合、显式 limit、普通治疗不复活、Value 安全边界、向负无穷除法、repeat 次序及多层预算。
- Owner Commit 验证费用／Enemy 顺序不变，目标集合结果经同一 HP 账本投影，Preview 不写 Owner，失败无安装。
- Receipt 篡改集合、数值、命中顺序、HP 链、source order、或回执字段必须拒绝；保存恢复能重放有效 E2 回执。
- `npm run gen:schema`、Schema 同步测试、直接影响范围 Vitest、`npx tsc --noEmit`、文档检查、`git diff --check`。

## 基线与约束

- Task0315 已移除 Map Action 旧 `effects` / `hpEffects` / `cardEffects`；Shop Offer `effects` 保留。
- 当前 `damage` / `heal` 为常量、primary、正安全整数；E1 `hpChange`、有序 resourceChange、Counter/Flag、when、Prepare 与现行 source schedule 继续兼容。
- E1 Receipt 当前严格验证每轮最多 4096 visits；E2 不允许重复 statement visits 或跳过 Trace / Receipt / Save 校验。
- 不改 `dist/`、`web-dist/`、`src/ui/dist/`、`node_modules/` 和生成 Schema 手写内容。

## 收尾

完成后更新 [[docs/docs-829/03-data-structures/datapack-contracts]]、作者示例和受影响的 Workspace / MapRun 说明；同步 `docs/plan-work/00-index.md`。只读检查 GALHCG 直接影响范围，不执行 graph edit、refresh 或 freshness 写入。

## 最终结果

- U01–U07 全部完成；实现、行为证据和文件边界见 [[docs/plan-work/task-0316-units/task-0316-units-index]] 与各 Unit Receipt。
- 直接影响验证：10 个测试文件／131 项通过；TypeScript、架构边界、生成 Schema 同步、文档检查及差异检查通过。实际浏览器验收不在本 Task 范围。
- E2 后续能力已统一归并到 [[docs/plan-work/task-0320-gameplay-b-ag1-e2-e5-unified-closure]]：随机无放回抽选与独立效果 RNG、任意语句体 `forTargets`、资源余额 Value／条件。此路由不改变本 Task 已完成范围。
- 共享工作树中的 Task 0312 / 0315 先前改动予以保留；本 Task 未提交或清理它们。
