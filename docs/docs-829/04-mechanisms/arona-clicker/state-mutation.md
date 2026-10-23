# 04-mechanisms/arona-clicker/state-mutation — 领域状态写入路径

本文区分业务命令与统一 mutation 写入实现，并说明写入后如何同步统计和派发事件。它依据 AronaClicker mutation 端口及 `StateMutationService` 当前实现。

## 两层职责

业务服务接收用例并负责领域决策：例如检查卡池、费用与可抽成员，计算抽取结果或验证世界线移动。业务服务调用 mutation port 执行状态操作；它不应因此被视为 PlayerState 的所有者。

`StateMutationService` 是 PlayerState 基础变更的集中实现。会发布领域事件的普通操作按写入状态、更新 StatsService、发出 EventBus 事件的次序执行；订阅者再按事件兴趣更新派生系统。事件是已提交变化的通知，不是交给 EventBus 解析后才执行的写入请求。交易类方法可先应用完整 delta、更新统计，再统一派发事件，避免观察到半交易。

```text
UI / Engine effect → 领域业务命令 → 校验与计划 → mutation port
                                              ↓
                                      PlayerState + Stats
                                              ↓
                                         EventBus
                                              ↓
                                  Visibility / Affector 等派生系统
```

## 边界与例子

- `GachaService.roll()` 扣除每抽费用、选择差分、更新 pity/pulls，并经 mutation port 获得角色。
- Spot 事务由业务层先校验，再以一次提交应用资源、物品与等级变化。
- 效果执行器可调用 effect mutation 能力；写入仍落到同一状态变更实现。
- 不是每个状态变化都发布事件：例如 `completeMilestone()` 与 `revealInformationTarget()` 直接提交经过验证的内部进度身份并返回结果，没有调用 EventBus。不要仅凭“发生了 mutation”就推断一定有通知。
- 也不是所有 Runtime 变量都属于 PlayerState；Story cursor、当前播放状态等由对应运行时服务持有。Gameplay B 的 EventRun 归 Operation Runtime 所有；其状态与只读 OperationView 见 [[docs/docs-829/03-data-structures/operation-view]]。

部分初始化/重建流程会整体替换 PlayerState，并将新对象重新注入相关服务。这是状态生命周期操作，不能与普通业务 mutation 混为一谈。

## 帧计数待核对

`TickSystem` 当前直接执行 `state.totalFrames += 1`。其写入与“所有状态变化走 StateMutationService”的纪律关系尚未裁定；本文记录实现事实，不将其解释为例外或违规结论。

## 代码入口

- `src/arona-clicker/state/state-mutation-service.ts`
- `src/arona-clicker/contracts/runtime/mutation.ts`
- `src/engine/contracts/mutation.ts`
- `src/engine/system/tick-system.ts`
