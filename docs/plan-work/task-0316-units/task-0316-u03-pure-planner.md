# Task 0316 U03：Pure Planner

状态：complete — [[docs/plan-work/task-0316-units/receipts/task-0316-u03-receipt]]。

## 目标

在 detached Planner 内实现安全整数 Value、稳定目标集合、固定成员快照、显式 repeat 与可验证结果 Trace。

## 范围

- `src/arona-clicker/services/map/map-effect-planner.ts` 与 MapEffect contracts。
- 算术用 BigInt 检查范围；负除法向负无穷取整；Value 结果在用作量前必须非负。
- 每个集合最多 32 人，每个命中 repeat 最多 8，每来源展开单位最多 1024；现有整轮 visits 4096 仍由 MapRun 统一计数。
- HP 比例以精确整数交叉相乘排序，平手稳定保留领域顺序。
- 规划器不能写入 Owner，异常时不返回部分计划。

## 完成条件

- 边界、空集合、倒地过滤、HP 排序、Expression 与 repeat 顺序均有纯 Planner 回归。
