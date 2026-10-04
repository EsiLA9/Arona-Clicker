# 04-mechanisms/engine/effect-trigger — 效果与事件响应

Effect 描述一次操作，Trigger 按事件筛选后请求执行，Affector 则维护持续有效的规则实例。

## Effect 执行

`EffectEngine.applyEffects()` 将声明拆分为宿主可消费的运行时效果和状态效果：运行时效果交给 `EffectRuntimeHandler`，已消费的效果不再进入状态 mutation；其余效果按序交给 `StateMutationPort`。带 `ValueExpression` 的值由注入的 `ValueSystem` 依据当前状态解析。`DECLARATIVE_EFFECT_OPS` 中的声明类效果不进入普通执行流，由专用查询消费。

`tests/engine/effect-engine.test.ts` 验证基础状态效果、顺序执行、运行时 handler 消费、Extra 字面量和增量表达式行为。

## Trigger

内容侧 `TriggerDef.on` 描述观察的事件类别；TriggerSystem 把类别映射到 GameEvent，挂载时按事件类型登记索引。收到匹配事件后，系统还会检查具体过滤字段、条件及 once 状态，再通过 EffectEngine 执行效果。无 ID 声明由确定性匿名身份支持。`tests/engine/trigger-system.test.ts` 覆盖剧情完成触发、条件与一次性行为；`trigger-kind.test.ts` 锁定 kind 到事件映射。

## Affector

AffectorEngine 将包挂载到实体，按条件维护 Latent/Active/Removed 实例状态。激活沿执行 `effects`；每 Tick 仅执行显式 `perTickEffects`。持续 `flows`、`zoneModifiers`、区域连接与服务能力作为活跃实例的派生贡献同步给消费者。事件驱动重估条件；包含 stat 等缺少专属变更事件的条件会进入每 Tick 轮询。状态重建时 `reconcileMounts()` 按当前拥有物品、强化与已解锁 Spot 功能对账挂载。

`tests/engine/affector-engine.test.ts`、`affector-reconcile.test.ts` 和 `affector-reconcile` 相关测试验证挂载生命周期、条件响应与状态重建。GameNum 的区效果及 flow 贡献见 [[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]]。

## 链路边界

代表性运行流是“状态/系统发事件 → Trigger 或 Affector 重估 → EffectEngine 分发 → runtime handler 或 Mutation”。静态 import 关系并不表示每次写入都会同步触发所有订阅者；EventBus 的排队与 flush 由宿主调度。产品业务条件和最终状态写入仍由宿主/Mutation 负责。

## 相关页面

[[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]] · [[docs/docs-829/03-data-structures/engine-contracts]]
