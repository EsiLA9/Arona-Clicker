# 03-data-structures/player-state — PlayerState 运行时状态结构

> 本文回答：**PlayerState 长什么样、字段怎么分层。** 分层原则见 [[docs/docs-828/01-architecture/state-layers]]；类型权威在 `src/arona-clicker/types/state.ts`。

## 三层分层（跨世界线 / 世界线内 / 当前运行）

| 层 | 字段前缀/载体 | 生命周期 | 代表字段 |
| --- | --- | --- | --- |
| **Global** | `global*` / 收集类顶层字段 | 跨世界线永久 | `globalResources`、`globalShopPurchaseRecords`、`unlockedInits`、`visitedInits`、`groupsOwned`/`equipmentsOwned`、色彩/装备收集、`spotTagOverrides`、`roster`/`fragments`（归属层由 `characterPersistConfig` 逐块声明，声明为 global 时不进快照） |
| **per-Init 快照** | `initSnapshots[initId]` | 离开时保存、回时恢复 | `InitSnapshot`：`{ resources, spotLevels, spotManagers, visitedAreas, totalFrames, inventory, 本地 unlockedEnhancements, storyLog, storyReadLogs, flags, triggersCompleted, currentAreaId, extras, shopPurchaseRecords, roster?, fragments?, gachaState?, chatRead? }`（GlobalEnh 不进入快照） |
| **per-Init 当前** | 顶层字段 | 当前世界线运行时 | `resources`、`flags`、`initExtras`、`inventory`、`spotLevels`、`currentAreaId`、`storyLog`、`visitedAreas` |

**关键约定**：读状态时「当前层有值用当前层，无值回退快照层」——由 `extraFromLayer` / `resourceBucket` 等访问器统一实现（`StateMutationService`）。

## 主要字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `activeInit` | InitId | 当前世界线 ID |
| `resources` / `globalResources` | Record<string, number> | per-Init 资源 / 跨世界线全局资源（`isGlobalResource` 判定，青辉石唯一全局） |
| `flags` / `initExtras` / `extras` | Record / ExtraCompound | 世界线标记 / per-Init Extra / 全局 Extra（三层见 [[docs/docs-828/02-modules/extra]]） |
| `inventory` | Record<ItemId, number> | 物品持有数 |
| `spotLevels` / `spotManagers` | Record | 设施等级 / 指派 Manager |
| `currentAreaId` / `visitedAreas` / `visitedInits` | — | 当前所在 / 已访问 Area / 已进入过 Init |
| `spotTagOverrides` | Record<SpotId, {added, removed}> | Spot 标签运行时增减（T6，global 层，随存档保留） |
| `unlockedEnhancements` / `enhancementAttachments` | string[] / Record | 已解锁强化；GlobalEnh 跨 Init 保留，本地强化进入对应 Init 快照 / 挂靠元数据（仅 UI 展示） |
| `storyLog` | CompletedStory[] | 剧情完成记录（按 StoryDef.id）；`storyReadLogs` 另存阅读日志（重读/分歧守卫） |
| `triggersCompleted` | string[] | 已触发的一次性 Trigger（once）id 集合 |
| `roster` / `fragments` | Record<VariantId, RosterEntry> / Record | 通讯录（持有差分实例）/ 碎片余额（归属随 characterPersistConfig.roster） |
| `gachaState` | Record<GachaPoolId, GachaPoolState> | 各卡池保底/抽取计数（pity/pulls） |
| `globalShopPurchaseRecords` / `shopPurchaseRecords` | Record<string, { purchasedQuantity }> | Shop 的 global / 当前 Init 限购事实；key 由 scope 的 owner 与 Shop/Spot 身份派生，余量不写回 Datapack |
| `studentBlocks` | Record<VariantId, {entryId, setAtFrame}> | 学生对话空间阻断态 |
| `chatRead` / `passiveCooldowns` | Record | 聊天已读（基础设施保留，消息成分已移除、当前无写入方）/ 被动闲聊冷却表 |
| `charaCustom` | Record<Character, CharaCustomOverride> | 玩家头像-人名对覆写（见 [[docs/docs-828/02-modules/pics]]） |
| `worldPool` | VariantId[] | 世界 Pool：已并入常驻集合的差分（`refreshWorldPool` 未接线） |
| `protoStats` | Record<string, ProtoStat> | 原型聚合统计（派生视图，Trigger 维护） |
| `tagEffects` / `entityEffects` | Record | 区表：命名乘区记录唯一真相（见 [[docs/docs-828/04-mechanisms/production]]） |
| `groupsOwned` / `activeTheme` / `equipmentsOwned` | — | 色彩组收集、全局主题来源（system / color-group / custom）与装备收集（见 [[docs/docs-828/02-modules/color]]） |
| `entityThemeSlots` / `entityThemeDesignsOwned` | Record | 实体配色槽 / 已解锁配色设计（global） |
| `customThemes` / `themeAttachments` | Record | 独立用户主题记录 / Area、学生等实体主题挂靠；全局当前来源只由 `activeTheme` 表达 |
| `themeLayerOrder` | string[] | player/init/area/student 四层优先级自定义；user、preview、ephemeral 不进入该排列 |
| `initSnapshots` | Record<string, InitSnapshot> | 各世界线快照 |
| `StatsSnapshot.global` / `StatsSnapshot.init` / `StatsSnapshot.session` | StatsSnapshot | 三层统计（`completedStoryIdsThisRun` 在 session 层；见 [[docs/docs-828/03-data-structures/stats-views]]） |

## 变更纪律

- **任何字段只经 `StateMutationService` 写**；写方法内部同时：改值 → 发事件 → 记统计。
- 新增字段前先想清楚放三层哪一层（[[docs/docs-828/01-architecture/state-layers]]）；per-Init 字段必须登记 `PER_INIT_FIELD_SPECS`。
- 不写存档迁移代码（架构纪律 8）。
