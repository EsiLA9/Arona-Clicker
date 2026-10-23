# Task 0316 U02：上下文绑定与归一化

状态：complete — [[docs/plan-work/task-0316-units/receipts/task-0316-u02-receipt]]。

## 目标

将安全通过语法校验的 E2 程序归一化为保留源路径的有限指令，并按具体 Encounter / Action 来源约束 Value 的单位、Counter 与目标集合上下文。

## 范围

- `src/data-services/normalization/gameplay-map-effect-program.ts`。
- `src/data-services/validation/gameplay-map-effect-context.ts`、Registry 和归一化测试。
- 未绑定 source 的 Ability/Item 不得读 source；primary 必须存在可选单位目标；target HP 只可用于集合 damage/heal amount；targetCount 只可用于集合目标。
- 暂不开放资源余额 Value 和任意语句体集合循环。

## 完成条件

- 每个表达式叶子与新增效果节点具有稳定 `originPath`。
- Registry 对上下文不可能的表达式给出带路径诊断；既有 E1 内容继续归一化。
