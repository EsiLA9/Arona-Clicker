# 03-data-structures/player-state — PlayerState 与 InitSnapshot

本文描述玩家持久状态的当前结构、账号与世界线归属，以及哪些运行数据由别的系统持有。事实依据为 `src/arona-clicker/types/state.ts`、`state/per-init-fields.ts` 和 `state/init-savepoint.ts`。

## 状态所有者

`PlayerState` 是 AronaClicker 玩家进度的主要状态对象。它包含当前 Init 标识、资源、Spot 进度、解锁、物品、剧情记录、角色进度、主题偏好等字段。部分字段为可选，`createDefaultState()` 仅初始化默认运行所需的基础集合；不能仅凭类型的 `?` 推断字段不使用。

状态可概括为三类归属：

| 归属 | 示例 | 生命周期 |
| --- | --- | --- |
| Save / 账号范围 | `globalResources`、`unlockedInits`、`characterMemory`、`informationRevealProgress`、主题自定义数据 | 跨 Init 保留，随 Save 状态持有 |
| 当前 Init 快照字段 | `resources`、`spotLevels`、`visitedAreas`、`totalFrames`、`inventory`、`storyLog`、`flags`、部分角色与商店数据 | 由 `PER_INIT_FIELD_SPECS` 捕获、清除和恢复 |
| Runtime 派生 / 游标 | Visibility、Stats、Affector 实例、当前剧情游标 | 由各运行时系统计算或持有；其中部分游标可在快照时经 context 捕获 |

`InitSnapshot` 是按 InitId 索引的字段子集，不是完整 PlayerState 副本。`initSnapshots` 承载多个世界线的检查点；快照 spec 还可按 Registry 定义的 global/local 归属拆分 Spot 与 Enhancement 状态。

Gameplay B 的 `EventRun` 也不属于 `PlayerState` 或 `InitSnapshot`。`GameInstance.save()` 可将有界的 `operationRun` checkpoint 放入主 `SaveData`；读档时 Runtime 先清空内存 Run，再按当前 Registry 与 Event 的 `resumeVersion` 显式重建。它不会成为 per-Init 字段，也不改变 InitSnapshot 的捕获/清除/恢复登记。

## 快照登记

`PER_INIT_FIELD_SPECS` 是字段清除/捕获/恢复的登记表，并由类型守卫约束与 `InitSnapshot` 键一致。角色数据按 Registry 的 roster、gacha、chatRead、equips scope 决定是否纳入 Init 快照。Story cursor 通过可选 context 参与 capture/restore。

新增状态字段时，应先明确 Save 与 Init 生命周期，再判断是否加入 `InitSnapshot` 和登记表；只新增类型字段不会自动建立快照语义。

## 状态中不等于派生结果

`PlayerState` 保存可恢复的事实或玩家选择。Visibility、Stats、Affector 活跃实例和 UI 格式化结果由运行时系统维护。它们可以读取状态并通过事件响应变化，但其生命周期与存档字段不同。只读 UI 投影见 [[docs/docs-829/03-data-structures/game-view]]。

## 代码入口

- `src/arona-clicker/types/state.ts`
- `src/arona-clicker/state/state-factory.ts`
- `src/arona-clicker/state/per-init-fields.ts`
- `src/arona-clicker/state/init-savepoint.ts`
- `src/arona-clicker/state/snapshot.ts`
