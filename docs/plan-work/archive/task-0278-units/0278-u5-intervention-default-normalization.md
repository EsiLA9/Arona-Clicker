# Unit 0278-U5：基础计划与 Intervention 归一化

## Goal

Runtime 不把与基础 PreparedBeat 完全相同的请求存成玩家 Intervention；已有覆盖选回基础方案时，清空唯一槽并恢复自动计划。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md | 单槽 Intervention 合同 |
| 文档 | docs/ai/PROJECT-CONSTITUTION.md | 原子写入与边界 |
| 源码 | src/arona-clicker/services/operation-runtime-service.ts：reviseIntervention、clearIntervention | 唯一槽写入 / 撤销 |
| 源码 | src/arona-clicker/services/operation-intervention-preview.ts：previewOperationIntervention | 纯计算有效计划 |
| 测试 | tests/engine/operation-runtime-service.test.ts、tests/engine/operation-intervention-preview.test.ts | 同方案、单槽、撤销及失败不写入 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–22k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 不扩展为每学生多槽；任何新费用机制须停工上报 |

## Optional Read Set

- 无；UI 表现由 U6 处理。

## Do Not Read by Default

- docs/plan-work/archive/**
- 新货币 / 费用或通用干预框架

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| Run 只存一个 interventionDraft，Preview 校验一名学生并以基础 Beat 生成单 Actor 覆盖。 | operation-runtime-service.ts；operation-intervention-preview.ts | 保留唯一槽 |
| Runtime 当前会写入每个有效 Preview，即使结果计划与基础 PreparedBeat 一样。 | operation-runtime-service.ts：reviseIntervention | 需将完全相同的计划视为无干预 |

## Constraints

- 继续在 Runtime Preview 位置检查行动资格、Target 与 Actor / Team resource cost；不实现新增干预费用。
- 失败预览 / Commit 不改变 Run；清除恢复基础 PreparedBeat。

## Allowed Files

- src/arona-clicker/services/operation-runtime-service.ts
- tests/engine/operation-runtime-service.test.ts
- tests/engine/operation-intervention-preview.test.ts
- docs/plan-work/task-0278-units/receipts/0278-u5-receipt.md

## Explicit Non-goals

- 不创建每学生独立槽、不引入货币、不改变指挥次数 / 费用、不重构 UI。

## Stop Conditions

按 docs/ai/PROJECT-CONSTITUTION.md 停止条件；若 Preview 无法可靠比较候选计划与基础计划，先更新 Unit 与 Task。

## Completion Criteria

- [x] 选择与当前基础行动 / 默认目标完全相同不保存 Intervention，也不递增 Run 版本。
- [x] 现有覆盖切回基础方案时清空干预槽，其他 Actor 方案保持基础计划。
- [x] 清除覆盖恢复自动 Target；失败命令前后 Run 深相等。
- [x] 一次只存在一个 Intervention 槽，费用仍由当前 Runtime Preview / Planner 校验。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | npx vitest run tests/engine/operation-runtime-service.test.ts tests/engine/operation-intervention-preview.test.ts | 通过 |
