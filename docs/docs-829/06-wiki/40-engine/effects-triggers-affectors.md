# 06-wiki/40-engine/effects-triggers-affectors — 事件与规则执行

Effect 是可执行操作声明，Trigger 是事件条件响应规则，Affector 是有生命周期的持续规则实例。

## 三种角色

`EffectEngine` 解析可计算值并把操作分发到 Mutation 或宿主 runtime handler。`TriggerSystem` 把声明的事件模式映射至 EventBus 事件，匹配后验证条件与 once 状态并请求执行 Effect。`AffectorEngine` 管理包、挂载实例及 entry 活跃状态：激活沿产生一次性效果，持续 flow 与区修饰由派生系统消费，每 Tick 专用效果单独执行。

## 跨系统事件流

```text
状态/领域操作 → GameEvent → Trigger 条件 → EffectEngine
                               ↘ Affector 条件重估 → 激活/撤销 → GameNum 等消费者
```

此图表示运行协作。静态代码依赖是多个 Engine 类共享契约和事件类型，运行时通过 Runtime 注入实例并订阅事件；箭头不能用来推断全体模块之间存在直接 import。

## 关键约束

- Trigger 内容使用声明式事件 kind，而不是直接持有 EventBus 回调。
- Affector 的事件依赖可定向重估；无法由专属事件保证新鲜的规则会轮询。
- Effect 的具体产品呈现可以由宿主消费，通用 Engine 不必知道其展示实现。
- Affector 区修饰和 flow 的数值效果由 GameNum 汇总，不等同于一次性状态写入。

源码依据：`effect/effect-engine.ts`、`effect/trigger-system.ts`、`effect/affector-engine.ts`、`contracts/affector.ts`。测试依据：`effect-engine.test.ts`、`trigger-system.test.ts`、`affector-engine.test.ts`、`affector-reconcile.test.ts`。

[[docs/docs-829/04-mechanisms/engine/effect-trigger]] · [[docs/docs-829/06-wiki/40-engine/core-contracts]] · [[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]]
