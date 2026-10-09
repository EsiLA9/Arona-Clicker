# Unit 0278-U1：无上限内容与 Runtime 定义校验

## Goal

让 Datapack 与 Runtime 定义校验均接受缺省 SceneAction 批次上限，并由 Datapack 校验拒绝明显没有 Location / Event 退出路径的无上限内容。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 原因 |
| --- | --- | --- |
| 文档 | docs/docs-829/03-data-structures/datapack-contracts.md | Operation Location / Scene 内容契约 |
| 文档 | docs/docs-829/05-conventions/testing.md | Registry 校验验证级别 |
| 源码 | src/data-services/registry/operation-content-validation.ts：checkLocation、checkEvent | Datapack 结构与交叉引用校验 |
| 源码 | src/arona-clicker/services/operation-definition-validation.ts：SceneAction / PurchaseOffer 校验 | Runtime Admission 定义结构校验 |
| 测试 | tests/engine/gameplay-b-authoring-workflow.test.ts、tests/engine/registry.test.ts、tests/engine/operation-runtime-service.test.ts | 正式包、Registry 与 Runtime 定义路径 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–22k token |
| 文档 Read Set | 2 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 不读全仓；需要改白名单时更新 Task 后再继续 |

## Optional Read Set

- 无；除非确认 Registry 输入结构不足以识别当前 Location 的 Participant 行动。

## Do Not Read by Default

- docs/plan-work/archive/**
- tools/datapack-editor/** 与生成 Schema

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| sceneActionBatches 在类型中可选，但 Registry 当前要求 actionMode 出现时必须为 1–10。 | src/data-services/registry/operation-content-validation.ts：checkLocation | 缺省应保留可选，显式值范围不变 |
| Runtime 的 validateOperationEventDef 也要求 Location / Scene 的 actionMode 配置正数 sceneActionBatches。 | src/arona-clicker/services/operation-definition-validation.ts：validateLocation | 需与 Registry 同步放宽缺省值 |
| OperationEventContentDef 暴露 participants、Location ID 与 Event hardFailureConditions；校验器能做有限的静态出口检查。 | src/data-services/contracts/operation.ts：OperationEventContentDef；src/data-services/registry/operation-content-validation.ts：checkEvent | 不尝试证明谓词、目标或费用必然可达 |

## Constraints

- 使用现有 Location / Scene / Participant 字段；不加 Registry 服务或 Schema 字段。
- 显式批次数范围与完成语义不变；无上限检查只拒绝明显没有 primary objective / partial outcome / failure condition / 敌方清场出口 / Event 硬失败的定义；secondary objective 不视为 Location 结果出口。
- 只有当前 Location / Scene 启用且由 opponent Participant 候选的行动才算结构性 combat 清场出口。

## Allowed Files

- src/data-services/registry/operation-content-validation.ts
- src/arona-clicker/services/operation-definition-validation.ts
- tests/engine/gameplay-b-authoring-workflow.test.ts
- tests/engine/registry.test.ts
- tests/engine/operation-runtime-service.test.ts
- docs/plan-work/task-0278-units/receipts/0278-u1-receipt.md

## Explicit Non-goals

- 任意条件可达性证明、Action 目标可达性证明、有限上限的语义变更、Schema 生成。

## Stop Conditions

按 docs/ai/PROJECT-CONSTITUTION.md 停止条件；若当前内容结构不能区分当前 Location 的敌方 Participant 行动，停止并上报，不以 Actor type 字符串推断。

## Completion Criteria

- [x] 缺省 sceneActionBatches 在 implicit 与 explicit Scene 上通过 Registry 校验。
- [x] 显式 1–10 上限仍通过；零、负数、非安全整数和大于 10 仍拒绝。
- [x] 无上限 Scene Action 且没有 Location primary objective / partial outcome / failure condition / Event hard failure 被拒绝；secondary objective 不算完成出口。
- [x] 无上限 combat 没有 Location primary objective / partial outcome / failure condition、当前启用敌方行动或 Event hard failure 时被拒绝；Carousel 与 Strategy Park 原内容仍通过。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | npx vitest run tests/engine/gameplay-b-authoring-workflow.test.ts tests/engine/registry.test.ts tests/engine/operation-runtime-service.test.ts | 通过 |
| 类型检查 | 未要求本 Unit 单独运行 | 由 U2–U4 后统一执行 |
