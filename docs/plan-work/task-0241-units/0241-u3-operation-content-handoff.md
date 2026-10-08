# Unit 0241-U3：Operation 内容解析与 Admission handoff

## Goal

将 Registry 中受引用的 StrategyProfile/CardPool/Action definitions 冻结并传入现有 Admission DTO，供后续 RunStart Builder 消费。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| Task | `docs/plan-work/archive/task-0241-gameplay-b-strategy-pools-and-interaction-context.md` E0 | 规则选择及候选身份快照合同 |
| 源码 | `src/arona-clicker/contracts/operation-content-resolver.ts` | resolver 输出边界 |
| 源码 | `src/arona-clicker/contracts/operation-participant.ts` | Admission DTO |
| 源码 | `src/arona-clicker/services/registry-operation-content-resolver.ts` | Registry 规则收集与 Action 解析 |
| 源码 | `src/arona-clicker/services/operation-participant-admission.ts` | Content 验证和 Admission freeze |
| 测试 | `tests/engine/operation-participant-admission.test.ts` | resolver/admission 行为入口 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 15k–25k tokens |
| 文档 Read Set | Task E0 与 Admission 源测试 |
| 历史文档 | 0 篇 |
| 超预算处理 | 超 60k tokens 时停止并交还 Task Owner |

## Optional Read Set

- `src/arona-clicker/services/student-operation-profile-resolver.ts`（只核对 RunStart consumer 接口）。

## Do Not Read by Default

- `docs/plan-work/archive/**`
- UI、Editor、样例大包与 Data authoring 文件

## Confirmed Facts

| 事实 | 依据（路径 / 符号） | 备注 |
| --- | --- | --- |
| Registry-backed Operation resolver 按 Event/Location/Profile references 收集当前 Run 所需 ActionDef | `registry-operation-content-resolver.ts` | Pool entries 需要并入这一解析范围 |
| Operation Admission clone-freeze event、participants、profiles、actions、skills 后再返回 | `operation-participant-admission.ts` | 新定义应走同一受控快照 |

## Constraints

- 仅解析 Event/Location/参与学生 Profiles 实际引用的 Pool/Strategy；不把整个 Registry 暴露给 Runtime。
- 不引入可变 Registry 引用或 UI 写能力。
- legacy Profile `candidateActionIds` 继续被解析到 Operation Action definitions。
- Admission 对 custom resolver 内容维持 fail-fast 和 detached freeze 行为。

## Allowed Files

- `src/arona-clicker/contracts/operation-content-resolver.ts`
- `src/arona-clicker/contracts/operation-participant.ts`
- `src/arona-clicker/services/registry-operation-content-resolver.ts`
- `src/arona-clicker/services/operation-participant-admission.ts`
- `tests/engine/operation-participant-admission.test.ts`

## Explicit Non-goals

- Candidate resolve/weighted draw、Run state、Preparation/Commit。
- Editor/UI 和任何示例数据包改造。

## Stop Conditions

使用 PROJECT-CONSTITUTION §停止条件全部 6 条；若 RunStart 消费者需要调整，本 Unit 只报告接口并由后续白名单扩展，不顺手修改。

## Completion Criteria

- [ ] Registry resolver 只带入当前 Event 真正引用的 pools、strategies 和 actions。
- [ ] Admission 回传 detached content definitions，包含新表且能复核缺失/重复引用。
- [ ] 保留既有 Carousel Profile 的 static Action definitions。
- [ ] Registry resolver 与 custom resolver 两条准入路径通过测试。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 定向测试 | `npx vitest run tests/engine/operation-participant-admission.test.ts` | 通过 |
| 类型检查 | `npx tsc --noEmit` | 无新增错误 |

## Receipt

见 `receipts/receipt-0241-u3-operation-content-handoff.md`。
