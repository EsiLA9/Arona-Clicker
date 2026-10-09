# Unit 0241-U9：OperationView 角色 Hand 诊断

## Goal

把逐角色 Hand、Context、Pool 来源、合法过滤及权重解释投影到 detached OperationView。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0241-gameplay-b-strategy-pools-and-interaction-context.md` E0 | UI-safe 诊断范围 |
| 文档 | `docs/docs-829/03-data-structures/operation-view.md` | View 所有权边界 |
| 源码 | `src/arona-clicker/contracts/operation-view.ts` | DTO |
| 源码 | `src/arona-clicker/services/operation-view-projector.ts` | 纯投影接线 |
| 测试 | `tests/engine/operation-view-projector.test.ts` | Detached/view snapshot 行为 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 12k–20k tokens |
| 文档 Read Set | Task E0 + OperationView mechanism |
| 历史文档 | 0 篇 |
| 超预算处理 | 超 60k tokens 时停止并交还 Task Owner |

## Optional Read Set

- `tests/ui/operation-workspace-view.test.ts` 不作为默认输入；若新增 View 字段影响既有 UI contract，只确认编译消费。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- `src/ui/**` 的交互、渲染与 CSS

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| OperationView 是 detached 只读快照，不持有写能力 | `operation-view.ts`、`operation-view-projector.ts` | 展示结果而非 Runtime mutable state |
| RNG cursor 不向 UI DTO 暴露 | `operation-view.ts:OperationViewResolution` | 仅给 weight/bias explain 数据 |

## Constraints

- 不增加 UI 组件、DOM、Browser 或 Editor 文件。
- View 给出从 Hand 能选哪些 Action 与过滤理由；不向 Game UI 引入作者 DSL。
- 不暴露 seed、抽样 word、cursor、原始冻结定义。

## Allowed Files

- `src/arona-clicker/contracts/operation-view.ts`
- `src/arona-clicker/services/operation-view-projector.ts`
- `tests/engine/operation-view-projector.test.ts`

## Explicit Non-goals

- UI 展示改动或人手试玩入口（Director 阶段）。
- Run/Save 状态管理、Editor 视图。

## Stop Conditions

使用 PROJECT-CONSTITUTION §停止条件全部 6 条；只读投影无法解释候选来源时先上报抽象缺口，不改 UI 绕过。

## Completion Criteria

- [ ] View 为每名学生投影当前 Hand 及逐牌 Pool 来源/合法状态/基础与策略权重。
- [ ] View 与 Run/Registry 定义 detached，读取不解析候选、不消费 RNG。
- [ ] scene deck View 与学生 Hand 的字段清晰分离。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-view-projector.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |

## Receipt

见 `receipts/receipt-0241-u9-operation-view.md`。
