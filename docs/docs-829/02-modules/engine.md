# 02-modules/engine — 通用引擎模块卡

Engine 为产品 Runtime 提供通用表达式、事件、效果、派生计算与时钟机制。

## 职责与边界

入口为 `src/engine/index.ts`。主要目录是 `core/`、`contracts/`、`types/`、`expression/`、`effect/`、`visibility/`、`stats/`、`extra/`、`system/` 与 `runtime/`。产品专属状态流程由宿主装配并通过端口注入；Engine 本身不负责 AronaClicker 的业务编排。

## 依赖与运行

静态依赖上，产品 Runtime 组合 Engine，Engine 的部分查询和结算实现依赖宿主注入的契约；Engine 不依赖 UI 或产品内容层。运行时则由 GameInstance 装配事件、状态查询及写入端口，事件驱动系统在变更后维护或重算派生结果。装配/import 方向不等同于单次事件调用顺序。

## 深入阅读

- [[docs/docs-829/03-data-structures/engine-contracts]]：状态查询、Mutation、Evaluation 与事件契约。
- [[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/production]]：Tick 生产结算。
- [[1-项目/ACProgram/docs/docs-829/04-mechanisms/engine/effect-trigger]]：Effect、Trigger、Affector 协作。
- [[docs/docs-829/06-wiki/40-engine/00-index]]：按功能浏览源码与测试。

## 验证入口

- `tests/engine/engine-contracts.test.ts`：验证 Engine 契约可用最小端口装配。
- `tests/engine/event-bus.test.ts`：验证事件注册、立即派发和 flush 中的队列行为。
- `tests/engine/trigger-system.test.ts`：验证事件匹配、条件与 Trigger 效果。

这些定向测试覆盖各自列出的行为，不等价于对所有 Engine 子系统的完整证明。
