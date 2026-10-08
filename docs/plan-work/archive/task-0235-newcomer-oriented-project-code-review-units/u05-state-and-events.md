# Unit 0235-U05：状态写入、事件与 Operation 投影

## Goal

说明状态变更怎样更新统计、发出事件、驱动响应式系统，并区分 Gameplay B 的局内状态和产品 PlayerState。

## Must Read / Read Set

| 类型 | 路径 / 符号 | 读它的原因 |
| --- | --- | --- |
| 文档 | `03-data-structures/engine-contracts.md`、`operation-view.md`、`04-mechanisms/00-index.md`、`arona-clicker/state-mutation.md`、`engine/effect-trigger.md` | 事件/端口/状态/Operation 权威页 |
| 源码 | `src/arona-clicker/state/state-mutation-service.ts`、`src/engine/core/event-bus.ts`、`src/engine/effect/trigger-system.ts`、Operation runtime owner | 核对写入先后、事件消费和状态 owner |
| 测试 | `tests/engine/state-mutation-service.test.ts`、`trigger-system.test.ts`、`operation-runtime-service.test.ts` | 核实副作用与 Operation 生命周期 |

## Context Budget

| 项 | 预算 / 规则 |
| --- | --- |
| 目标上下文 | 18k–40k token |
| 文档 Read Set | 5 篇 |
| 历史文档 | 0 篇 |
| 超预算处理 | 将 StateMutation、EventBus、Trigger、EventRun 拆成独立解释；不读所有订阅者 |

## Optional Read Set

- `docs/docs-829/04-mechanisms/arona-clicker/operation-runtime.md`，仅为核对已链接 Operation owner 时阅读。

## Do Not Read by Default

- `docs/plan-work/archive/**`、所有服务类事件订阅代码；按本 Unit 的事件目录逐类扩展。

## Confirmed Facts

| 事实 | 依据 | 备注 |
| --- | --- | --- |
| 当前机制索引区分状态写入和 Effect/Trigger 主题。 | `04-mechanisms/00-index.md` | Unit 要核实页面与运行时代码是否一致。 |

## Constraints

- Event 是变更通知还是写入请求，必须按 EventBus、MutationService 和订阅者代码逐条区分。
- OperationView 是观察面；Run 是否属于 PlayerState 以 owner 和保存代码为准。
- 流程图标出“直接调用”和“EventBus 订阅”，不混为同一时序。

## Allowed Files

- `docs/plan-work/archive/task-0235-newcomer-oriented-project-code-review-units/u05-state-and-events.md`（填写本 Unit Receipt）
- `docs/docs-829/03-data-structures/engine-contracts.md`
- `docs/docs-829/03-data-structures/operation-view.md`
- `docs/docs-829/04-mechanisms/00-index.md`
- `docs/docs-829/04-mechanisms/arona-clicker/state-mutation.md`
- `docs/docs-829/04-mechanisms/engine/effect-trigger.md`

## Explicit Non-goals

- 不更改 Mutation API、事件顺序、Trigger 规则、EventRun 状态 owner 或 Operation 存档合同。
- 不推导出未被订阅者实现的“事件自动生效”行为。

## Stop Conditions

遵守 [[docs/ai/PROJECT-CONSTITUTION#停止条件]]；状态写入顺序或存档归属有冲突时，按相关源文件和测试分开记证据后暂停。

## Completion Criteria

- [ ] 读者可分别说明一次 mutation 和后续事件响应的先后顺序。
- [ ] 至少用一个有测试的状态变化例子走通 Stats/Event/Trigger/ReadModel。
- [ ] Operation Run 与 PlayerState 的边界链接清楚且有源码测试依据。

## Verification

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| 文档链接 | `npm run check:docs` | 通过 |
| 机制核验 | 对照 StateMutation、EventBus、Trigger 与对应测试 | 每条边有正确关系标签 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## Receipt

- **结果：** 已修正文档对“mutation、EventBus、Trigger”和 Operation 状态归属的概括；明确事件时序依赖当前 EventBus flushing 状态和宿主 flush 点。
- **源码/测试证据：** `StateMutationService.changeResource()` 先更新 PlayerState 与统计，再 emit `resourceChanged`；`completeMilestone()`、`revealInformationTarget()` 是有验证的直接内部进度写入，不发布 EventBus 事件。`EventBus.emit()` 未在 flush 时立即派发、flush 中则排队；`EventBus.flush()` 批量派发，`SessionService` 在 Tick 后调用它。`TriggerSystem` 按类型订阅事件后检查过滤、条件和 once，再调用 EffectEngine。`tests/engine/state-mutation-service.test.ts` 验证资源写入与事件；`tests/engine/event-bus.test.ts` 验证立即派发和 flush 中的排队；`tests/engine/trigger-system.test.ts` 验证匹配、条件和 once。未运行测试。
- **数据归属：** `OperationRuntimeService` 私有持有 EventRun；OperationView 是 detached 查询投影，不是 Run 或 PlayerState。`src/arona-clicker/runtime-game-instance.ts:save/load` 与 `src/arona-clicker/contracts/save-data.ts` 显示 SaveData 可另存 `operationRun` checkpoint；它不改变 EventRun 不属于 PlayerState 的事实。
- **Review Finding P2：EventBus 在 flush 期间处理器抛错后无法恢复。** 条件：`EventBus.flush()` 调用某个订阅者时，订阅者抛出异常。实际：异常中断 `flush()`，方法没有 `finally` 恢复 `flushing`；随后 `emit()` 将新事件留在队列，后续 `flush()` 因 `flushing` 仍为 true 而直接返回，事件响应停止。当前已 splice 的批次中尚未处理事件也会随局部数组丢失。影响：单个订阅者故障可使该 EventBus 实例后续 Trigger、派生刷新等事件响应全部失去派发。证据：`src/engine/core/event-bus.ts:56-69` 的控制流和 `src/engine/runtime/session-service.ts` 的宿主 flush 点；`tests/engine/event-bus.test.ts` 覆盖正常队列但没有处理器抛错恢复案例。置信度：高（源代码控制流可直接证明，未做运行复现）。建议另立窄修复 Task，裁定异常后 reset 标志及剩余事件策略，并补回归测试；本 Task 不修改产品源码。
- **Wiki 修改：** 更新 engine-contracts、OperationView、state-mutation、effect-trigger 和机制索引；标记事件是变化通知而非写入请求，给出同步 dispatch / flush queue 的当前实现及正确 Run/SaveData 归属。
- **边界与未完成：** 未逐行审查全部 Engine 订阅者；仅核对代表性 StateMutation、Trigger、EventBus 和 SessionService 路径。其他事件顺序必须按具体发布者/宿主检查。
- **验证：** 手工核对源码、既有测试名和文档互链；未运行 Vitest。最终 `npm run check:docs` 通过（681 Markdown，0 errors），`git --no-pager diff --check` 通过。
