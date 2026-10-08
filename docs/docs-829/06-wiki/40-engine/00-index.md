# 06-wiki/40-engine/00-index — Engine 功能导航

Engine 是一组可组合的通用引擎能力：它计算声明式数值、响应事件、提供派生查询并执行 Tick。产品 Runtime 负责把这些能力接到具体游戏状态与服务上。

## 第一次阅读

如果你只想知道“Engine 是什么”，先读 [[docs/docs-829/06-wiki/40-engine/core-contracts]]。要看一条数值怎样被读取，接着读 [[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]]；要看状态变化后谁会响应，再读 [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]] 和 [[docs/docs-829/06-wiki/40-engine/visibility-stats-extra]]。自动生产和离线补算见 [[docs/docs-829/06-wiki/40-engine/tick-session]]。

| 想了解 | 页面 | 读后可以回答 |
| --- | --- | --- |
| Engine 与产品 Runtime 怎样合作 | [[docs/docs-829/06-wiki/40-engine/core-contracts]] | 谁提供状态与服务，谁组合 Engine？ |
| Value、Condition 和 GameNum 怎样求值 | [[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]] | 声明的表达式怎样变成数字，缓存怎样失效？ |
| Effect、Trigger、Affector 怎样协作 | [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]] | 状态变更事件怎样匹配规则并请求效果？ |
| Visibility、Stats 与 Extra 做什么 | [[docs/docs-829/06-wiki/40-engine/visibility-stats-extra]] | 这些查询如何更新，以及谁拥有状态？ |
| Tick 与 Session 怎样运行 | [[docs/docs-829/06-wiki/40-engine/tick-session]] | 单次结算和每秒调度有什么区别？ |

## 源码入口与关系

`src/engine/index.ts` 是 Engine 的聚合导出入口。`contracts/` 是可供实现依赖的窄接口，`types/` 是声明和事件的数据形状；目录和 `import` 表示静态依赖方向，运行时调用顺序要看 Runtime 组合和对应方法，数据在系统间的传递则要看参数与返回值。EventBus 只派发通知；它不会替 Trigger 解释事件或替状态服务提交写入。

Arona Clicker 的具体组合见 `src/arona-clicker/runtime-wiring.ts` 中的 `wireGameInstance()`。模块卡介绍 Engine 的职责边界：[[docs/docs-829/02-modules/engine]]；接口清单：[[docs/docs-829/03-data-structures/engine-contracts]]；Effect / Trigger 的领域规则：[[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/effect-trigger]]。

## 代表性测试

`tests/engine/engine-contracts.test.ts` 展示引擎能力可以使用小型契约单独组合；数值计算见 `tests/engine/value-system.test.ts` 与 `tests/engine/game-num.test.ts`；事件响应见 `tests/engine/trigger-system.test.ts`；帧结算见 `tests/engine/tick-system.test.ts`。测试文件证明其中列出的例子与断言，不等于覆盖所有 Engine 行为。
