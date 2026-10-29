# Task 0316 U03 Receipt：Pure Planner

状态：complete

## 交付

- detached Planner 以固定 Party / Enemy 领域顺序解析集合；living 默认过滤、精确 HP 比例排序、稳定平手、显式 limit 和安全去重均可复放。
- Value 支持 literal、source/primary/target HP/cap/missingHP、Counter、Round、targetCount 与 add/sub/mul/divFloor/min/max/clamp/abs；全程安全整数，负除法向负无穷取整。
- 集合成员解析后固定；每名目标连续执行repeat，后续命中使用更新后的 HP。空集合保留 TargetSet Trace，普通 heal 不复活。
- 非负命中量、repeat/集合边界、每来源1024展开额度由 Planner 再次防守；输入和真实 Owner 不被改动。

## 验证

- `tests/engine/gameplay-b-effect-planner.test.ts`：15/15。
- 覆盖稳定比例平手、空集、source/primary/target 与 Counter/round/count 读取、floor(-3/2)=-2、溢出／除零／负数量拒绝及展开预算。
