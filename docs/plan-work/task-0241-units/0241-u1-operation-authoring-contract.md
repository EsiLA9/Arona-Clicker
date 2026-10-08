# Unit 0241-U1：Operation 行动池内容合同

## Goal

将 E0 裁定的 StrategyProfile、CardPool、selector、position/action 效果及 Hand 容量声明为 Operation Datapack 源类型。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0241-gameplay-b-strategy-pools-and-interaction-context.md` E0 | 最终 schema 裁定 |
| 文档 | `docs/docs-829/03-data-structures/datapack-contracts.md` | Datapack 合同边界 |
| 文档 | `docs/docs-829/05-conventions/schema-sync.md` | 源类型同步要求 |
| 源码 | `src/data-services/contracts/operation.ts` | Operation 作者类型 |
| 源码 | `src/data-services/contracts/datapack.ts` | Registry 输入口 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–20k tokens |
| 文档 Read Set | 3 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超 60k tokens 时停止并交还 Task Owner |

## Optional Read Set

- `scripts/gen-engine-schema.mjs`：仅核对源类型是否被生成器收录。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `tools/datapack-editor/**` 的交互/编辑器实现

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Operation 四表合同定义于 data-services，Datapack 汇总包含 Event/Location/Action/Profile | `src/data-services/contracts/operation.ts`、`datapack.ts` | E0 新增内容仍属此领域 |
| `OperationActionDef.tagIds` 已用于 Combination | `operation.ts:OperationActionDef` 与 `OperationCombinationRuleDef` | Strategy tags 必须独立 |

## Constraints

- 服从 `AGENTS.md`、Architecture Discipline、Schema Sync；不改变通用 Engine。
- 仅实现 Task E0 schema，不实现 Registry 校验与运行时消费。

## Allowed Files

- `src/data-services/contracts/operation.ts`
- `src/data-services/contracts/datapack.ts`
- `tools/datapack-editor/schema/engine-defs.gen.json`（只允许 `npm run gen:schema` 生成）

## Explicit Non-goals

- Editor UI、表格 UX、Editor 校验流。
- Operation Registry、运行时、样例内容及测试实现。

## Stop Conditions

使用 PROJECT-CONSTITUTION §停止条件全部 6 条；schema 与 Task 裁定冲突时停止，不自行改方向。

## Completion Criteria

- [ ] 新作者合同完整表达 E0 所列 Strategy/Profile/Pool/Condition/Hand/Position 能力。
- [ ] TSDoc 清楚说明空 selector、OR/AND、BPS、权重、Hand 容量边界。
- [ ] 运行 Schema 生成器；不手改生成结果。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| Schema 生成 | `npm run gen:schema` | 成功 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |

## Receipt

见 `receipts/receipt-0241-u1-operation-authoring-contract.md`。
