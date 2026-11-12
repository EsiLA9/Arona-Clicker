# docs-830/03-engine/statistics — Stats 与 TagStats

本文回答：统计查询如何积累全局、世界线和会话数据，以及标签进度如何从状态派生。

## StatsService

StatsService 保存三层计数：`global` 跨 Init 累计，`init[id]` 按世界线累计，`session` 记录当前一次游玩。计数包括资源产出/消耗、物品收集/使用、据点解锁与升级、剧情完成、Enhancement、Init 和活动帧。状态写入时同步更新统计，再派发携带变更时点 StatsContext 的事件；这让 Trigger 等订阅者可以按事件发生时的统计条件求值。

服务可生成只读快照、持久化数据并从存档恢复；进入新会话会重置 session 层，不清空 global 和每个 Init 的历史。统计 DSL 通过受限函数表解析，供 Condition / Trigger 等查询使用；未知查询返回 `null`。

### 一次资源变化会记到哪里

在 `tests/engine/core/stats.test.ts` 的测试初始状态中，先增加 50 credit，再消耗 20：global 和当前 Init 分别记录 produced 50、consumed 20；session 的 counters 记录 produced 50，当前资源视图为 30。生产量和余额因此不是同一个数字。

切换 Init 时开启新的 session 计数，但先前 Init 的累计和 global 仍保留。部分实现局部变量与统计 DSL 使用 `run` / `currentRun` 名称，指向当前 session 的 counters，不是第四套持久化统计层。`$GlobalProducedAmount base:resource:credit` 查询全局累计，`$InitProducedAmount <initId> <resourceId>` 查询指定 Init；调用参数不足或函数未知时解析失败。

## TagStatService

TagStatService 从 Registry 定义构造 `declared` 索引，再根据当前 PlayerState 构造 `collected` 索引。两侧按实体种类分别统计，不把不同类型合并为一个总量；父级 tag 查询会包含子 tag 的登记。解锁、Area 进入、Spot、角色获得、Enhancement 与剧情事件增量更新 collected。状态整体替换或读档时则静默重建，不额外写入 PlayerState 字段。

`StatsService` 表达玩家行为计数；`TagStatService` 表达带标签实体的收集进度。Condition 的 `stat` 与 `tagCount` 分别通过注入查询口读取这两类数据。

## 如何选择查询

| 想知道什么 | 对应数据 | 示例 |
| --- | --- | --- |
| 玩家累计获得或消耗多少资源 | StatsService | 按 global 或指定 Init 查询累计值 |
| 当前一轮内完成了多少剧情 | StatsService | 使用 `currentRun` 范围查询 |
| 某类带标签实体有多少已收集 | TagStatService | 对比定义侧 declared 与状态侧 collected |

TagStats 的父级 tag 会纳入子级登记，但不同实体种类仍分别统计。读档或整体替换状态后的重建不应被解释成又发生了一次收集行为。

源码：`src/engine/stats/stats.ts`、`stats-counters.ts`、`tag-stats.ts`、`src/engine/expression/stat-dsl.ts`、`src/arona-clicker/runtime/runtime-wiring.ts`。测试：`tests/engine/core/stats.test.ts`、`tests/engine/core/tag-stats.test.ts`。

条件消费统计查询见 [[conditions-and-visibility]]；状态更新与事件顺序见 [[state-and-events]]。
