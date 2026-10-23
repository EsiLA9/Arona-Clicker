# 06-wiki/40-engine/core-contracts — Engine 的协作端口

Engine 负责可复用的计算和响应能力；产品 Runtime 提供游戏定义、当前状态及写入服务，再把具体系统连起来。**契约（contract）**是双方共同遵守的接口形状，让 Engine 不必依赖整个产品实现。

## 三类关系先分清

| 关系 | 例子 | 含义 |
| --- | --- | --- |
| 静态依赖 | `expression/value-system.ts` 导入 `contracts/state-query.ts` 的类型 | 编译时某模块依赖什么接口；不说明程序每次怎样调用。 |
| 运行时调用 | `wireGameInstance()` 创建 `ValueSystem`、`TriggerSystem`、`GameNumSystem` 等对象并注入依赖 | 实际把哪一个实现传给哪个消费者。 |
| 数据 / 事件流 | 求值方法收到状态查询对象；Mutation 写入后 EventBus 发布事件 | 调用输入、返回值或通知怎样流动；事件本身不代替写入。 |

## 契约解决什么问题

`src/engine/contracts/` 按用途定义最小接口：`StateQuery` 描述需要读取的状态字段；`EvaluationContext` 提供表达式或条件求值需要的查询器；`Mutation` 是引擎效果提交状态变化的写入口；`EffectRuntimeHandler` 让宿主接手不直接落入持久状态的表现请求。`src/engine/types/` 则定义表达式、触发器与事件的数据结构。接口入口汇总在 `src/engine/contracts/index.ts`。

例如 `GameNumSystem` 收到 `ValueSystem`、Registry 查询端口和 Affector 查询端口；它不用知道产品 Runtime 内部如何管理完整游戏实例。`tests/engine/engine-contracts.test.ts` 用最小 Registry / Affector 对象构造 GameNum，也分别验证 Value、Condition、Stats 能力满足窄接口。这是“可以用接口替换依赖”的证据，不意味着它们在正式产品装配中互相独立运行。

## Arona Clicker 怎样装配

`src/arona-clicker/runtime/runtime-wiring.ts` 的 `wireGameInstance()` 是产品侧组合根（负责创建并连接对象的入口）：先创建 EventBus、Registry、查询和 Mutation 服务，再创建 Effect / Affector / GameNum / Tick / Trigger / Visibility 等 Engine 系统，并把它们需要的端口注入进去。此处是运行时对象的装配顺序，不应直接当成玩家每次操作的调用顺序。

常见写入方向是：产品服务验证操作 → `StateMutationService` 应用状态变化 → 发布描述变化的 `GameEvent` → 订阅者更新索引、标脏或触发规则。查询方向则是 Engine 通过只读端口读取状态、内容索引或 Stats。UI 的具体读写边界见 [[docs/docs-829/06-wiki/50-ui/00-index]]；状态写入规则见 [[docs/docs-829/04-mechanisms/state-mutation]]。

## EventBus 只负责投递

`src/engine/core/event-bus.ts` 通过 `on(type, handler)` 注册事件类别对应的处理器；`emit(event)` 在普通情况下同步派发，正在 `flush()` 时产生的新事件会排队，并由队列处理循环派发。EventBus 不会解析 Trigger 条件、选择游戏规则或改 PlayerState。Trigger 的条件匹配与效果执行见 [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]]。

## 继续阅读

表达式如何读取这些查询端口：[[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]]。数据契约列表：[[docs/docs-829/03-data-structures/engine-contracts]]。模块职责卡：[[docs/docs-829/02-modules/engine]]。返回 [[docs/docs-829/06-wiki/40-engine/00-index]]。
