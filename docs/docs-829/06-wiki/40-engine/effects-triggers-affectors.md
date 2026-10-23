# 06-wiki/40-engine/effects-triggers-affectors — 事件与规则执行

事件（event）是“某件事已发生”或“宿主需要处理某类请求”的带类型通知。Effect、Trigger 与 Affector 负责不同工作：Effect 描述要执行的操作，Trigger 在匹配的事件发生时判断条件并执行 Effect，Affector 管理可持续生效的规则实例。

## 一次 Trigger 响应

```text
状态服务先写入状态
  → EventBus 派发变化事件
  → TriggerSystem 按事件类别找到候选规则
  → 匹配事件模式与 Condition；通过后执行 Effect
  → EffectEngine 将状态操作交给 Mutation，或让 Runtime 处理表现请求
```

这里区分了静态依赖和运行时数据流：`TriggerSystem` 静态依赖 EventBus、ConditionSystem 与 EffectEngine；运行时由 `EventDrivenReactor` 按声明事件类别订阅。EventBus 只负责派发，不会“解析”Trigger。Condition 决定规则是否通过；EffectEngine 决定如何转交操作。

`StateMutationService` 的 `changeResource()` 先改资源并更新统计，再发 `resourceChanged`，所以资源 Trigger 看到的是变更后的状态。事件类别与 `TriggerEventKind` 的对应表在 `src/engine/effect/trigger-system.ts` 的 `ON_KIND_TO_EVENT`。并非每种领域事件都触发 Trigger；只有定义的事件模式会匹配。Trigger 的 `once` 完成记录在执行 Effects 前登记，避免级联事件再次执行同一规则。

## Effect：把声明交给合适的写入者

`EffectEngine.applyEffects()` 会先用当前状态求值表达式型 value。随后，它让宿主注入的 Runtime handler 处理该 handler 认识的临时表现操作；其余状态效果交给 `StateMutationPort`。Engine 不直接选择产品 UI，也不绕过宿主 Mutation 自行写产品状态。产品组合中的 handler 示例见 `src/arona-clicker/runtime/runtime-wiring.ts` 对 `themeEffectRequested`、`storyEffectRequested` 和 `chatFlowEffectRequested` 等事件的处理。

## Affector：有条件的持续规则

Affector 是挂载到物品、强化或 Spot 等来源的规则包实例。引擎根据 Condition 依赖的事件重估受影响 entry；条件由假变真时执行一次性 Effects，条件持续为真时仅执行明确声明的 `perTickEffects`，持续 `flows` 和区修饰则由 GameNum 等查询消费者读取。stat 条件没有专属变更事件时，当前实现会把对应实例加入每 Tick 重估集合。挂载 / 卸载或活跃 entry 变化通过 `affectorRuntimeChanged` 通知派生系统同步。

## 不要混淆三种事件时序

- **同步派发**：`EventBus.emit()` 在普通调用中立即调用该事件的处理器；若总线正在 `flush()`，嵌套产生的事件先入队，flush 循环再继续派发。
- **触发器匹配**：`TriggerSystem` 收到已订阅类别后检查声明的事件字段、Condition 和 `once` 状态。它不是 EventBus 的职责。
- **批量 flush**：`EventBus.flush()` 只排空当前队列及派发过程中追加的事件。Session 的自动 Tick 在帧函数返回后更新 EffectEngine 状态并 flush；这不表示每次 emit 都在等待统一的异步“事件解析”。

## 代码与测试

实现入口：`src/engine/core/event-bus.ts`、`src/engine/effect/event-driven-reactor.ts`、`effect-engine.ts`、`trigger-system.ts`、`affector-engine.ts`。`tests/engine/event-bus.test.ts` 验证同步派发和 flush 中嵌套事件的排队；`trigger-system.test.ts` 验证事件类别、`once` 与执行边界；`anonymous-affector-trigger.test.ts` 验证匿名 Trigger 的稳定身份和存档恢复。Affector 挂载和重估见 `tests/engine/affector-engine.test.ts` 与 `affector-reconcile.test.ts`。

更深入的声明与写入规则：[[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/effect-trigger]]。接口装配背景：[[docs/docs-829/06-wiki/40-engine/core-contracts]]；数值效果如何汇总：[[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]]。返回 [[docs/docs-829/06-wiki/40-engine/00-index]]。
