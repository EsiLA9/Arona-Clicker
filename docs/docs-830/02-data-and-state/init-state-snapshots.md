# Init 状态快照：切换世界线时保存什么

本文说明当前 Init 的部分状态如何在切换时保存和恢复。完整存档与存储介质见 [[save-system-and-recovery]]；状态写入和事件见 [[state-and-events]]。

## 先区分三种状态

| 状态 | 例子 | 作用 |
| --- | --- | --- |
| 跨 Init 状态 | 全局资源、已解锁 Init | 切换世界线时仍可供其他 Init 使用。 |
| 当前 Init 的活动状态 | 资源、库存、当前位置等 | 当前世界线运行时读写的数据。 |
| `initSnapshots` 中的 Init 快照 | 资源、库存等被保存的字段集合 | 离开某个 Init 后，为之后恢复该 Init 保留进度。 |

快照不是第二份完整游戏存档。`SaveData` 包含整个 PlayerState 及其他持久化内容，而 `InitSavepoint` 只处理 `PER_INIT_FIELD_SPECS` 描述的 Init 字段。

## 捕获、清理与恢复

`InitSavepoint` 对字段规范逐项执行 `capture()`、`clear()` 和 `restore()`。普通字段在捕获与恢复时复制可序列化值；缺失时使用各字段的初始值。这使字段切换行为有统一入口，而不是由每个调用方手写一组赋值。

以当前 Init 的 `resources` 为例：捕获时把当前资源表复制到该 Init 的快照；清理时替换为空表；恢复时从目标快照复制资源表。随后在该 Init 产生的资源变化不会直接修改已捕获的另一份表。具体切换入口、触发顺序和异常处理应以 InitService 为准。

`storyEntryReads` 与逐 Story 的 `storyReadLogs` 一同按 Init 保存。前者按实际入口记录已读或已完成，供缺省重读许可使用。`storyDirectoryPaths` 同步按 Init 保存这些入口已知的公开目录路径。应用数据包导致运行时重建时，已持有的入口进度与已知路径进入按原 Init 索引的 `retainedStoryDirectoryProgress`。当前 Init 只合并自己的记录；未加载的入口仍能浏览历史位置，重新加载后按相同 Entry 身份恢复。见 [[story-and-effects]]。

## 有些字段不能整表归类

- `spotLevels` 和 `spotManagers` 可能同时包含全局及局部 Spot：捕获取局部条目，清理保留全局条目，恢复时合并保留的全局条目与目标快照的局部条目。
- `unlockedEnhancements` 也按全局和局部条目处理，而非简单清空整个列表。
- `roster`、`fragments`、`gachaState`、`chatRead` 和 `equipmentsOwned` 是否参与 Init 快照，依 `registry.characterScopeOf(...)` 返回的对应 scope 而定。
- `storyCursors` 通过可选的上下文接口捕获、清理与恢复；`extras` 对应当前 Init 的 Extra 数据。

因此，查看一个字段时不仅要问“名字是什么”，还要查它的 `PerInitFieldSpec` 和 Registry 对其 scope 的判定。

## 新增字段时核对什么

先确定该状态是全局、当前 Init 或按内容配置决定归属，再核对 `AronaClickerInitSnapshot` 与 `PER_INIT_FIELD_SPECS` 的类型约束，明确缺省、捕获、清理和恢复行为。还要检查完整存档编解码、相关服务重新绑定和测试；仅把字段加进 PlayerState 不代表跨 Init 切换已经正确。

存档结构变化遵循项目明确的清档策略，不自行编写旧存档迁移兼容层。避免在机制说明中把计划中的兼容能力写成当前实现。

## 源码与测试

- 快照操作：`src/arona-clicker/state/init-savepoint.ts`。
- 字段规则及类型守卫：`src/arona-clicker/state/per-init-fields.ts`。
- 全局 / 局部条目过滤：`src/arona-clicker/state/snapshot.ts`。
- 切换与恢复入口：`src/arona-clicker/services/world/init-service.ts`。
- 字段清单与快照三操作测试：`tests/engine/world/per-init-fields.test.ts`；完整存档与恢复测试见 [[save-system-and-recovery]]。
