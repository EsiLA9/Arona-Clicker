# 06-wiki/40-engine/visibility-stats-extra — 派生查询能力

Visibility、Stats、TagStats 与 Extra 都提供查询或派生信息；它们不是 PlayerState 的替代品，也不由 UI 自己计算游戏规则。

## Visibility：变化时标记，读取时重算

VisibilityEngine 使用条件定义和实体索引计算 Init、Area、Spot、强化、物品等是否可见。`rebuild()` 会建立反向依赖索引并生成初始快照；订阅到可能影响条件的事件后，它通常只把受影响实体标记为 dirty（待重算），不在事件处理器里立即重算所有项目。之后 `getVisibility()` 按需重算脏实体；入口门槛查询 `isInitVisible()`、`isAreaVisible()` 等会直接按当前 Registry 与状态计算，以保证关键入口判断新鲜。

Spot 定义创建、替换和删除会单独维护 Spot 反向索引。`tests/engine/visibility-hot-spot.test.ts` 验证这些操作只更新受影响 Spot，并验证依赖资源变化后揭示结果能在查询时更新。

## Stats 和 TagStat：两种不同的统计

`StatsService` 记录资源、物品、Spot、故事、Init、Area 和 Tick 等累计 / 会话统计，并通过统计 DSL（受限的统计查询表达式）供条件读取。ConditionSystem 的统计读取器在 Runtime 装配时注入；因此静态依赖是接口，运行时调用才到具体 StatsService。

`TagStatService` 按实体类别维护“当前收集了多少个带此标签的实体”索引。它订阅 Init、Area、Spot 等获得或状态变化，按需发出 `tagCollectedChanged`；依赖 `tagCount` / 标签条件的查询方据此定向重估。切换或恢复状态时索引也可重建，重建本身不必发出收集变化事件。实现和条件接线见 `src/engine/stats/tag-stats.ts`、`src/arona-clicker/runtime/runtime-wiring.ts`；测试见 `tests/engine/stats.test.ts`、`tag-stats.test.ts`。

## Extra：结构化的扩展数据

Extra 是可携带类型的扩展值及路径读取、合并和校验工具。ValueSystem / ConditionSystem 可经注入的 reader 查询合并后的 Extra；写入则仍交给宿主的 Mutation 服务。Extra 工具不会替产品决定字段属于全局还是某个 Init，也不会定义存档生命周期。类型和状态归属见 [[docs/docs-829/03-data-structures/player-state]] 与 [[docs/docs-829/06-wiki/40-engine/core-contracts]]。

## 关系路线

静态依赖：这些 Engine 系统面向查询契约、条件类型和事件类型编程。运行时调用：`wireGameInstance()` 将 Registry、ConditionSystem、StatsService 和 EventBus 等具体对象注入。事件响应：消费者更新索引或设置 dirty 标记；数据真正求值通常发生在查询入口。`tests/engine/engine-contracts.test.ts` 说明部分系统可由最小契约构造，并不表示产品装配可以省略。

更多条件响应规则见 [[docs/docs-829/06-wiki/40-engine/effects-triggers-affectors]]；接口装配见 [[docs/docs-829/06-wiki/40-engine/core-contracts]]；返回 [[docs/docs-829/06-wiki/40-engine/00-index]]。
