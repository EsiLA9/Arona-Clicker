# 01-architecture/state-layers — 三层状态与写入口

> 本文回答：**运行时状态分几层、各层放什么、新增数据该放哪一层。**
> 字段级结构见 [[docs-828/03-data-structures/player-state]]；写入管道见 [[docs-828/04-algorithms/state-mutation]]。

## 三层分层

| 层 | 载体 | 生命周期 | 代表内容 |
| --- | --- | --- | --- |
| **Global** | `PlayerState` 顶层 `global*` 字段与收集类字段 | 跨世界线永久 | `globalResources`、`unlockedInits`、`globalStats`、`characters`（收集全集）、色彩/装备收集 |
| **per-Init 快照** | `PlayerState.initSnapshots[initId]` | 离开世界线时保存、回来时恢复 | flag / extra / resources / items / enhancements / spotLevels / stats / storyReadLogs 等 |
| **per-Init 当前** | `PlayerState` 顶层字段 | 当前世界线运行时 | `resources`、`flags`、`extra`、`items`、`spotLevels`、`activeAreaId`、`storyLog` |

**关键约定**：读状态时「当前层有值用当前层，无值回退快照层」——由 `StateMutationService` 的访问器（`extraFromLayer` / `resourceBucket` 等）统一实现。

## per-Init 字段单一事实源（T3）

- `src/arona-clicker/state/per-init-fields.ts` 的 `PER_INIT_FIELD_SPECS` 是 per-Init 字段清单的**唯一登记处**（17 字段）：普通字段 `field()` / Spot 容器 `spotField()` / Character 归属容器 `characterContainer()`。
- `src/arona-clicker/state/init-savepoint.ts` 的 save / clear / restore 全部遍历 SPECS；`state-factory.createDefaultState` 负责产品运行时初始状态。
- **编译期键守卫**（`PER_INIT_KEY_GUARD`）：SPECS 键集合与 `InitSnapshot` 键集合双向 `Exclude` 断言——新增 per-Init 字段漏登记直接编译错误。
- 新增 per-Init 字段流程：`PlayerState` + `InitSnapshot` 加字段 → `PER_INIT_FIELD_SPECS` 登记（含 `scope` 归属，Character 容器字段声明 `characterPersistConfig` 三分支：roster/gacha/chatRead）。

## Character 归属层（`CharacterPersistScope`）

角色域字段声明各自归属：`global`（跨世界线保留）/ `init`（随世界线重置）。`characterPersistConfig` 可按域覆盖默认（如 chatRead 默认 init）。

## 变更纪律

1. **任何字段只经 `StateMutationService` 写**（写方法内：改值 → 记统计 → 发事件）。
2. 新增字段前先想清楚放三层哪一层；收集类资产通常 global，运行时进度通常 per-Init。
3. **不写存档迁移代码**（架构纪律 7）：旧档缺字段用 `??=` 兜底或清档重来。

---

相关：[[docs-828/01-architecture/data-flow]]（数据从声明到 UI 的四层流动）
