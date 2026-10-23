# 06-wiki/30-arona-clicker-domain/state-and-mutation — 状态、命令与派生系统

本文以一次玩家操作为线索说明领域服务、PlayerState、派生系统和 UI 只读数据之间的关系。

一句话：业务服务决定一项操作是否合法、要花什么或产生什么；`StateMutationService` 是领域状态写入入口；事件让依赖状态变化的系统重新处理；View / ReadModel 给界面整理可读结果。这里说的“事件”是运行时消息，不是剧情 Story，也不是 Datapack 里的 Event 内容。

## 协作关系

```text
玩家意图 → 业务命令 → 校验 / 计算 → StateMutation
                                  ↓
                       PlayerState / Stats / 事件
                                  ↓
                Visibility、Affector 等派生系统
                                  ↓
                    GameView / 专用 ReadModel → UI
```

业务命令表达用例并决定是否可执行；StateMutation 执行基础写入并同步相关统计/事件；事件订阅者维护各自派生状态。ReadModel 为 UI 提供查询投影。四者职责不同，Runtime 初始化或加载时的整体状态替换又属于生命周期操作。

例如，资源变更由使用该资源的业务服务发起，最后调用 `StateMutationService.changeResource()`。写入口依据资源定义选择 `globalResources` 或当前 Init 的 `resources` 桶，并发送 `resourceChanged`，让订阅该事件的机制更新。生命周期里的整包状态替换、恢复快照是另一类操作；不能据本例推成每个状态字段的变化都走同一种单字段方法。

PlayerState 与 InitSnapshot 的范围见 [[docs/docs-829/03-data-structures/player-state]]；写入顺序见 [[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]；UI 投影见 [[docs/docs-829/03-data-structures/game-view]]。

## 从哪里核对

- `src/arona-clicker/state/state-mutation-service.ts`：`changeResource()`、`setFlag()` 等写入方法，以及资源桶选择和事件发射；服务不负责替每个业务命令做全部资格判断。
- `src/arona-clicker/runtime/runtime-game-instance.ts`：Runtime 将 mutation、事件系统、各领域服务和查询面组合起来；UI 查询走 `getView()` 或专用 ReadModel。
- `tests/engine/state-mutation-service.test.ts` 的“mutates state and emits one resource event”验证资源写入和单一事件；“rejects removing more items than owned”验证资源不足时状态不变。
- 接着看状态字段归属：[[docs/docs-829/03-data-structures/player-state]]；机制的具体先后及触发规则：[[1-项目/ACProgram/docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]。
