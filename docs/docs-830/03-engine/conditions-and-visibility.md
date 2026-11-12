# docs-830/03-engine/conditions-and-visibility — 条件求值与可见性

本文回答：条件如何读取当前状态，以及定义可见性如何随相关事件更新。

## ConditionSystem

原子 Condition 读取一个数值 target，再用 comparator 与期望值比较。target 覆盖资源、Spot 等级、旗标、Enhancement、标签数量、统计 DSL、阅读进度、Extra、好感和当前 Area 等状态。ConditionGroup 支持嵌套 `AND` / `OR` 并短路求值；它只查询状态，不负责写入。

外部查询通过构造期注入的读口接入，例如 StatsService、TagStatService、StoryService、RosterSystem 与 Extra 查询。缺省或未知 target 读作 0；未知 comparator 判为不满足。ConditionSystem 不持有这些领域服务。

### 例子：资源和据点一起满足

测试中的状态含 `credit: 100` 和 `spot_a: 5`。组合条件 `and(cond('resource', 'credit', '>=', 50), cond('spotLevel', 'spot_a', '>=', 3))` 两个分支都成立，结果为真；如果资源门槛改为 200，资源分支为假，整体为假。`OR` 则只需要一个分支成立。该实例来自 `tests/engine/core/condition-system.test.ts`，其中 `cond()`、`and()` 构造的是声明，求值由 `ConditionSystem` 完成。

条件结果只代表**求值当时**的状态，并不会为使用者自动执行效果。Trigger 需要匹配事件后再求值；VisibilityEngine 则在依赖变更后维护显示结果。

## ConditionDepIndex 与 VisibilityEngine

ConditionDepIndex 将条件叶子反向登记为“事件类型 / 实体键 → 依赖者”。资源、Spot、旗标等可按事件携带的 key 精确命中；Extra 路径按父子前缀关系匹配；标签条件受 Spot 解锁和标签变化影响；`stat` 是宽依赖，使用一组相关事件触发复核。

VisibilityEngine 在 Registry 就绪后建立定义反向索引，订阅条件依赖事件。事件到达时只将受影响实体标脏；`getVisibility()` 在读取时重算这些实体，形成按需增量更新。注册表重载或显式刷新时使用全量重建。关键入口 `isInitVisible()` / `isSpotVisible()` 会对当前状态直接求值，作为移动和解锁等门槛的即时判定。

剧情入口的可见性由触发条件控制，因此 VisibilitySnapshot 中的 StoryEntry 保持可见；启动剧情时仍由 StoryService 单独检查触发条件。

### 更新路径与即时检查

例如某实体的可见条件读取资源余额：状态写入产生相关资源事件后，依赖索引找到该实体，VisibilityEngine 将它标为需要重算；下次 `getVisibility()` 读取时更新结果。显示快照是增量维护的派生结果，不是另一个持久化状态。

行动准入不能只凭旧 UI 快照：`isInitVisible()` / `isSpotVisible()` 会直接根据当前状态判断。若排查“显示没有更新”或“明明显示了却无法进入”，应分别核对事件、依赖索引和行动时的即时检查。

源码：`src/engine/expression/condition-system.ts`、`condition-deps.ts`、`src/engine/visibility/visibility-engine.ts`、`visibility-index.ts`、`visibility-eval.ts`。测试：`tests/engine/core/condition-system.test.ts`、`tests/engine/world/visibility-hot-spot.test.ts`。

Affector 对同一依赖索引的使用见 [[affectors-and-contributions]]；状态事件入口见 [[state-and-events]]。
