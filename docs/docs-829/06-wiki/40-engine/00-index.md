# 06-wiki/40-engine/00-index — Engine 功能导航

Engine 提供可组合的求值、效果响应、派生视图与时钟能力，供产品 Runtime 装配。

## 阅读路线

| 想了解 | 页面 |
| --- | --- |
| Engine 跨层端口与事件类型 | [[docs/docs-829/06-wiki/40-engine/core-contracts]] |
| Value、Condition、GameNum 与失效 | [[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]] |
| Effect、Trigger、Affector 及事件响应 | [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]] |
| 可见性、统计与 Extra | [[docs/docs-829/06-wiki/40-engine/visibility-stats-extra]] |
| Tick 与会话调度 | [[docs/docs-829/06-wiki/40-engine/tick-session]] |

## 源码总览

公开汇总入口 `src/engine/index.ts` 导出核心工具、类型、契约、工厂、表达式、效果、可见性、统计与 Extra。目录划分代表静态职责边界；运行时协作由 GameInstance 组合具体对象、端口和事件订阅。不要把目录树读成逐帧调用顺序。

模块卡：[[docs/docs-829/02-modules/engine]]。跨层数据契约：[[docs/docs-829/03-data-structures/engine-contracts]]。机制正文：[[docs/docs-829/04-mechanisms/engine/production]]、[[docs/docs-829/04-mechanisms/engine/effect-trigger]]。
