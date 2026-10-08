# 03-data-structures/engine-contracts — 引擎跨层契约

Engine 通过显式查询、求值、写入和事件类型与宿主及其他子系统协作。

## 契约分组

`src/engine/contracts/` 定义跨实现边界的接口，`src/engine/types/` 定义声明数据与事件联合；它们回答不同问题。契约包括 `StateQuery`（子系统需要读取的最小状态面）、`EvaluationContext`（表达式、条件、GameNum 所需依赖）、`Mutation`（效果落入状态的写入口）、`EffectRuntimeHandler`（运行时宿主消费非持久效果）、`EngineEventShape` 与 Tick 结果等。`contracts/index.ts` 是公开汇总入口。

实现可依赖窄接口而不是完整 GameInstance。例如 `GameNumRegistryContext` 只要求相关定义索引和有效标签查询；`RevealRegistryContext` 只要求可揭示实体索引。`tests/engine/engine-contracts.test.ts` 验证 Value、Condition、Stats、GameNum、Reveal 可以用最小端口单独构造，也验证 GameInstance 接受注入装配函数。

## 声明类型

`types/expression.ts` 定义 Value/ValueExpression、Condition/ConditionGroup 与 Effect；`types/trigger.ts` 定义 Trigger 事件模式、条件和效果；`types/events.ts` 定义 `GameEvent` 判别联合。`contracts/event.ts` 将事件总线约束到最小 `{ type: string }` 形状，并以 `EventOf` 提取事件类型。

`Effect.value` 是宽联合，解释由操作及执行上下文决定。宿主运行时效果通过 `EffectRuntimeHandler` 返回是否已消费；状态效果交给 Mutation。该返回值边界避免 Engine 需要理解产品层临时呈现的具体内容。

## 写入与通知边界

`StateMutationPort` 描述状态效果操作；领域 GameInstance 将它连接到产品状态写服务。EffectEngine 可先把可求值数值解析，再将持久状态效果提交至 mutation port，并把 runtime effect 交给注入 handler。事件只表达发生了什么，不代替状态写入授权。

事件类型可比基础 Engine 更宽，`EventBus<TEvent>` 只要求类型字段。当前 `EventBus.emit()` 在总线未处于 `flush()` 时会立即调用订阅者；总线正在 flush 时，新事件先排队，当前 flush 会继续取出队列中的后续批次。宿主的 `SessionService` 在每次 Tick 后调用 flush。因而事件既不总是排队，也不总是等到稍后处理；要判断时序，必须同时看 emit 时总线是否正在 flush 和宿主在哪里调用 flush。

事件表达“某件事已经发生”，不是授权或要求消费者代替命令写状态。订阅者错误会沿当前调用路径向外抛出；`EventBus.flush()` 对订阅者错误的恢复行为目前有缺陷，详见对应 Code Review Receipt 与后续修复 Task。

## 相关页面

[[docs/docs-829/02-modules/engine]] · [[docs/docs-829/06-wiki/40-engine/core-contracts]] · [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]]
