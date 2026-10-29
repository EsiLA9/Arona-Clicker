# context-packs/production — 生产、GameNum 与响应机制

> 本文回答：Engine 生产、表达式、Affector、Effect 和 Trigger 任务应从哪里进入。

| 任务 | 入口 |
| --- | --- |
| Session / Tick 与单帧结算 | [[session-and-tick]] |
| Value、GameNum 与生产计算 | [[expressions-and-production]] |
| Condition 与可见性 | [[conditions-and-visibility]] |
| Affector 与贡献 | [[affectors-and-contributions]] |
| EventBus、Effect、Trigger | [[event-effects-triggers]] |
| Stats 与 TagStats | [[statistics]] |

只读命中的主题与源码、测试。改跨层依赖或状态写入口时，补读 [[ai/guide/conventions/architecture-discipline]]。