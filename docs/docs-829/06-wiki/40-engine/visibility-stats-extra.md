# 06-wiki/40-engine/visibility-stats-extra — 派生查询能力

Visibility、Stats 与 Extra 分别解决内容揭示判断、聚合统计查询和结构化扩展数据读取。

## Visibility

`VisibilityEngine` 基于 RevealRegistryContext 与 ConditionSystem 计算实体揭示状态，维护快照及条件依赖反向索引。相关状态事件使受影响条目标脏，读取时按需重算；Spot 定义 create/replace/delete 事件更新对应索引与快照。`visibility-hot-spot.test.ts` 验证热创建、替换和删除仅影响目标 Spot 的揭示索引。

## Stats 与 TagStats

`StatsService` 记录资源、物品、Spot、强化、剧情、世界线、区域与 Tick 等统计，并通过受限 DSL 查询。`TagStatService` 根据声明标签和收集状态构建类型化索引，变更时发出 tag 收集事件。二者被 ConditionSystem 作为可选查询依赖注入，不构成条件系统对具体 Stats 实现的静态依赖。

## Extra

`extra/` 提供结构化值、路径读取、合并与校验能力；宿主可暴露合并视图供 Value、Condition 查询，也可将全局层写入操作交由 Mutation。Extra 的具体归属由状态与定义宿主决定，Engine 的 Extra 工具不单独定义存档生命周期。

## 关系说明

静态依赖由契约与类型连接各查询服务；运行时由 Engine wiring 注入 reader，并由 EventBus 通知索引更新。事件导致重算属于运行流，不表示 Stats 或 Extra 实现被 Visibility 静态调用。

源码：`visibility/`、`stats/`、`extra/`、`contracts/evaluation-context.ts`。测试：`visibility-hot-spot.test.ts`、`stats.test.ts`、`tag-stats.test.ts`、`extra.test.ts`。

[[docs/docs-829/06-wiki/40-engine/core-contracts]] · [[docs/docs-829/06-wiki/40-engine/expressions-and-game-num]]
