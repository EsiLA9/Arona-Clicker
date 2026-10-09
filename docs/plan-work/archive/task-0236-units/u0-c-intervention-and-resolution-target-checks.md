# Unit 0236-U0-C：干预预览与结算目标复核

## Goal
保证明确指定的 Action / Actor 目标经同一目标合同在干预预览与最终 Resolution 规划再次校验，越界目标无法保存或结算。

## Must Read / Read Set
| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 任务 | `docs/plan-work/archive/task-0236-gameplay-b-typed-action-cards-and-target-layers.md`、`docs/plan-work/archive/task-0236-units/u0-a-target-scope-contract.md`、`u0-b-target-selection-and-preparation.md` | 目标契约、运行时匹配规则 |
| 协议 | `docs/ai/PROJECT-CONSTITUTION.md`、`docs/ai/galhcg-project-map.md` | Unit / Evidence 护栏 |
| 文档 | `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md` | 干预、版本和原子 Commit 语义 |
| 源码 | `src/arona-clicker/services/operation-intervention-preview.ts:previewOperationIntervention`、`operation-resolution-planner.ts:planOperationResolution` | 显式目标校验和结算边界 |
| 测试 | `tests/engine/operation-intervention-preview.test.ts`、`operation-resolution-planner.test.ts` | 非法干预 / 最终计划回归 |

## Context Budget
| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 10k–25k tokens |
| 文档 Read Set | 4 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 拆分或上报，不扩大白名单 |

## Optional Read Set
- U0-A / U0-B Receipt，仅用于核对目标过滤最终实现。

## Do Not Read by Default
- `docs/plan-work/archive/**`、Operation UI 与无关 SceneAction 规则。

## Confirmed Facts
| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| 显式干预预览把候选目标交给 `selectOperationTarget` 验证。 | `src/arona-clicker/services/operation-intervention-preview.ts:previewOperationIntervention` | 需保留此单一目标语义。 |
| Resolution planner 重建规范计划并验证行动 / 目标，不信任 UI 草稿作为终态。 | `src/arona-clicker/services/operation-resolution-planner.ts:planOperationResolution` | Commit 边界必须独立拒绝越界 Actor。 |
| 通用 `relation: 'any'` 目前接受同一 Event 的所有 Actor。 | `tests/engine/operation-intervention-preview.test.ts` | 未设范围的通用内容仍须维持行为。 |

## Constraints
- 按 Task 保留单名学生干预、Run 版本和原子提交边界。
- 不添加 UI 绕过 Runtime 的快捷写入。

## Allowed Files
- `src/arona-clicker/services/operation-intervention-preview.ts`
- `src/arona-clicker/services/operation-resolution-planner.ts`
- `tests/engine/operation-intervention-preview.test.ts`
- `tests/engine/operation-resolution-planner.test.ts`
- `docs/plan-work/archive/task-0236-units/u0-c-intervention-and-resolution-target-checks.md`
- `docs/plan-work/archive/task-0236-units/receipts/receipt-u0-c-intervention-and-resolution-target-checks.md`

## Explicit Non-goals
- 不改 target 合同、自动准备、View 投影、首幕内容或 UI。
- 不修改战斗数值、槽位限制或结算效果。

## Stop Conditions
按 [[docs/ai/PROJECT-CONSTITUTION#停止条件]] 默认六条执行；若 Runtime 需要额外状态字段或架构选择，停止并上报。

## Completion Criteria
- [x] 干预预览拒绝 action 规则过滤范围之外的目标。
- [x] Resolution 规划独立拒绝相同越界目标，失败时不形成可提交变化。
- [x] 对目标过滤未声明的 Action，旧显式预览 / 结算行为保持不变。

## Verification
| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-intervention-preview.test.ts tests/engine/operation-resolution-planner.test.ts` | 通过 |
| Receipt | 填写本 Unit Receipt | 记录实际改动 / 验证 |
