# Task 0237：修复 EventBus.flush 的处理器异常恢复

状态：proposed — 来自 Task 0235 的 P2 Code Review 发现；尚未修改产品代码。

## 目标

保证 EventBus 在 `flush()` 过程中某个订阅者抛错后仍可继续使用，并明确这一错误发生时当前批次、剩余队列及异常上报的行为。

## 设计边界

- 缺陷等级：P2。单个订阅者异常可使 EventBus 永久留在 flushing 状态，阻断该实例的后续事件响应。
- 受影响入口：`src/engine/core/event-bus.ts:EventBus.flush()`、`dispatch()`；宿主 `SessionService` 在 Tick 后调用 flush。
- 当前行为：`flush()` 设置 `flushing=true` 后批量派发；没有 `finally` 恢复该字段。若 handler 抛错，调用栈退出，后续 `emit()` 会只排队，后续 `flush()` 会因标志仍为 true 而直接返回。当前 `splice(0)` 取出的未派发事件也不再位于队列中。
- 本 Task 必须定义异常后的可观察行为：异常是否继续抛出/如何报告；当前事件剩余处理器和已取出批次中的其余事件如何处理；下一次 emit/flush 是否恢复派发。不得静默吞掉错误，也不得让总线永久锁死。
- 明确非目标：改变事件类型、订阅匹配语义、Trigger 顺序或产品服务错误策略；修改 SessionService 调度边界。

## Patch Unit

### U01：定义并实现 flush 异常后的恢复合同

**Allowed Files**

- `src/engine/core/event-bus.ts`
- `tests/engine/event-bus.test.ts`
- `docs/docs-829/03-data-structures/engine-contracts.md`
- `docs/docs-829/06-wiki/40-engine/effects-triggers-affectors.md`
- `docs/plan-work/task-0237-event-bus-flush-exception-recovery.md`

**Completion Criteria**

- [ ] 在某个 handler 抛出异常后，EventBus 不会永久锁定；之后的正常事件可以按所定合同派发。
- [ ] 当前事件中剩余 handler、已取出的批次内剩余事件及新入队事件的处置有明确、可验证的行为。
- [ ] 至少有回归测试覆盖 flush 中 handler 抛错、异常可观察性和后续事件恢复。
- [ ] Wiki 描述与实际选择的错误/剩余事件策略一致。
- [ ] Receipt 记录 P2 修复前因、代码改动、测试结果及未覆盖边界。

**Verification**

| 项 | 命令 / 方式 | 期望结果 |
| --- | --- | --- |
| EventBus 回归 | `npx vitest run tests/engine/event-bus.test.ts` | 通过，覆盖 throw 与恢复 |
| 文档链接 | `npm run check:docs` | 通过 |
| 差异检查 | `git --no-pager diff --check` | 无空白错误 |

## 当前事实与证据

| 事实 | 依据 | 说明 |
| --- | --- | --- |
| `flush()` 的 flushing 标志仅在队列完全排空后重置，异常路径没有 `finally`。 | `src/engine/core/event-bus.ts:EventBus.flush()` | 可由当前控制流直接确认。 |
| flush 中发出的嵌套事件排队，并由当前 flush 在后续批次排出。 | `src/engine/core/event-bus.ts:emit()/flush()`；`tests/engine/event-bus.test.ts` | 现有正常路径测试已覆盖。 |
| 已有测试没有处理器抛错后的恢复案例。 | `tests/engine/event-bus.test.ts` | Task 0235 只读审查；本 Task 补回归测试。 |

## 相关路由

[[archive/task-0235-newcomer-oriented-project-code-review]] · [[docs/docs-829/03-data-structures/engine-contracts]] · [[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/effect-trigger]]
