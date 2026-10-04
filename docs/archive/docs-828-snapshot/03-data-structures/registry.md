# 03-data-structures/registry — Registry 注册表结构

> 本文回答：**Registry 有哪些表、关系索引、校验规则。** 模块卡片见 [[docs/archive/docs-828-snapshot/02-modules/registry]]；实现位于 `src/data-services/registry/registry.ts`。

## 表（Map 容器，表驱动 `tableSteps`）

Registry 内部所有表经 `tableSteps: TableStep[]` 单一声明（table 名 + merge + clear）驱动装载/合并/清空（T6），新增表只加一个 step：

| 表 | 键 | 值类型 |
| --- | --- | --- |
| `inits` | initId | InitDef |
| `areas` | areaId | AreaDef |
| `spots` | spotId | SpotDef |
| `enhancements` | enhId | EnhancementDef |
| `stories` | storyId | StoryDef |
| `activeStories` / `passiveStories` | entryId | ActiveStoryEntry / PassiveStoryEntry |
| `passivePools` | poolId | PassivePoolDef |
| `storyEntries`（合并视图 getter） | entryId | StoryEntryDef（同 id 时 passive 覆盖 active） |
| `items` / `dropTables` | id | ItemDef / DropTableDef |
| `shops` | shopId | ShopDef |
| `milestones` | milestoneId | MilestoneDef |
| `milestoneListeners` | listenerId | MilestoneListenerDef |
| `achievements` | achievementId | AchievementDef |
| `funcletDefs` | funcletId | FuncletDef |
| `characters` | 原型 Character | CharacterData |
| `characterVariants` | variantId | CharacterVariantDef |
| `cultivateCurves` | curveId | CultivateCurveDef |
| `favoriteItems` / `uniqueWeapons` / `traits` / `gears` | id | FavoriteItemDef / UniqueWeaponDef / TraitDef / GearDef |
| `gearConfig` | —（单值，部分覆盖合并） | GearConfigDef |
| `gachaPools` | poolId | GachaPoolDef |
| `colorGroups` / `colorEquipments` / `themeDesigns` | id | ColorGroupDef / ColorEquipmentDef / ThemeDesignDef |
| `affectionConfig` | —（单值，部分覆盖合并） | AffectionConfigDef（好感阶梯/星级锁，缺省用引擎内置） |
| `characterPersistConfig` | —（单值） | CharacterPersistConfig（三层归属声明） |
| `resourceDisplays` | resourceId | ResourceDisplayDef |
| `tagDefs` | 标签路径串 | TagDef |
| `pics` / `picsByKind` | 完整索引 / typeName | PicDef / 索引集合（见 [[docs/archive/docs-828-snapshot/02-modules/pics]]） |
| `charaProfiles` | 原型 id | CharaProfileDef |
| `extras` | —（单值树） | ExtraCompound（多包深合并常量表） |

## 关系索引（装载时构建）

| 索引 | 说明 |
| --- | --- |
| `areasByInit` / `spotsByArea` | Init→Area、Area→Spot 归属链 |
| `spotsByTag` | 层级标签 → Spot 集合（登记所有前缀，父含子） |
| `effectiveSpotTags(spotId, overrides?)` | 纯查询：声明标签 + 运行时增撤覆盖（`state.spotTagOverrides`，global 层，T6）合成后的有效标签 |

## 构建与校验

- 每个包由 `Registry.load(dp)` 执行单包校验后逐表合并（`tableSteps`）；Runtime 应用启用集时负责整体清理/重建，并在全部包加载后调用跨表校验。`clear()` 与 merge 共用 `tableSteps` 清单；
- Milestone 关系在合并后的 Registry 上校验：Listener 必须引用存在的 Milestone 和 Area，Achievement 必须引用存在的 Listener；同一 Milestone 至多被一个 Listener 引用，同一 Listener 至多被一个 Achievement 引用。旧 Milestone 可保持未关联。
- 校验失败即抛错（缺引用 / 重复 ID / 非法枚举），保证运行时「拿到的引用必有效」；校验覆盖面并非全量——真/意义引用的校验差异见 [[docs/archive/docs-828-snapshot/03-data-structures/id-reference-semantics]] §六。

## 查询边界与热内容变更

- Registry getter 暴露只读查询接口；玩家运行时状态（解锁/升级/标签增减）仍属于 `PlayerState`，不会因此写回定义表。
- Init / Area / Spot 支持受控热 CRUD，通过 Registry mutation API 校验实体归属、候选定义和关系约束，并同步对应索引；入口与回滚约束见 [[docs/archive/docs-828-snapshot/02-modules/registry-wiki]]。
- Spot 标签运行时增减经 `StateMutationService` 落 `spotTagOverrides` → `spotTagChanged` 事件 → GameNum 重建（见 [[docs/archive/docs-828-snapshot/02-modules/affector]] / [[docs/archive/docs-828-snapshot/02-modules/game-num]]）。查询时可用 `effectiveSpotTags(spotId, overrides)` 合成声明标签与状态覆盖。

## 相关文档

[[docs/archive/docs-828-snapshot/02-modules/registry]] · [[docs/archive/docs-828-snapshot/01-architecture/data-flow]]
