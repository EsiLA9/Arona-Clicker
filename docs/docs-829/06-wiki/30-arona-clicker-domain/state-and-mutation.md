# 06-wiki/30-arona-clicker-domain/state-and-mutation — 状态、命令与派生系统

本文以一次玩家操作为线索说明领域服务、PlayerState、派生系统和 UI 只读数据之间的关系。

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

PlayerState 与 InitSnapshot 的范围见 [[docs/docs-829/03-data-structures/player-state]]；写入顺序见 [[docs/docs-829/04-mechanisms/arona-clicker/state-mutation]]；UI 投影见 [[docs/docs-829/03-data-structures/game-view]]。
