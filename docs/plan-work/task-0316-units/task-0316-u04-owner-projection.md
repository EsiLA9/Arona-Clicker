# Task 0316 U04：Owner 接线与投影

状态：complete — [[docs/plan-work/task-0316-units/receipts/task-0316-u04-receipt]]。

## 目标

将固定 Party roster、Enemy 定义顺序、当前 Round、集合命中和 trace 接入 MapRun；Owner 继续统一安装 HP delta。

## 范围

- `src/arona-clicker/services/map/map-run-service.ts`、MapEffect contracts、MapRun trace / HP Projection。
- 更新已存在的 declared-effect / preview / flow trace 文案，让作者集合与动态 Value 易读。
- 不改费用预检、Party/Ability/Item/Enemy source schedule、目标主选、Hand RNG 与 Owner 生命周期。

## 完成条件

- 所有 E2 命中进入原有结算 HP Changes；一次 Commit 内后续来源看到先前 E2 计划状态。
- 普通 heal 不复活；Preview 不安装；失败保持 HP、locals、资源及 Hand RNG 不变。
