# Task 0316 U06：行为回归

状态：complete — [[docs/plan-work/task-0316-units/receipts/task-0316-u06-receipt]]。

## 目标

用 E2 真实 Action / Encounter 夹具锁定集合与 Value 行为及 E1 边界。

## 范围

- Data Registry、normalizer、pure planner、MapRun commit、receipt mutation rejection、save/resume 和 Workspace trace。
- 覆盖 Party roster / Enemy 定义顺序、HP 比例排序同值稳定、0/32/33 集合、limit、living/all、空集合、damage/heal clamp、repeat 0/8/9、Value 溢出/负数/除零及 floor(-3/2)=-2。

## 完成条件

- Task 0316 行为矩阵逐项有测试或直接源证据，E1 旧测试继续通过。
- 不进行与本任务无关的全仓大范围替换。
