# 03-data-structures/registry — Registry 注册表结构

> 本文回答：**Registry 有哪些表、关系索引、校验规则。** 模块卡片见 [[docs/docs-828/02-modules/registry]]；实现位于 `src/data-services/registry/registry.ts`。

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
| `funcletDefs` | funcletId | FuncletDef |
| `characters` / `characterBonuses` | 原型 Character | CharacterData / 加成表 |
| `characterVariants` | variantId | CharacterVariantDef |
| `cultivateCurves` | curveId | CultivateCurveDef |
| `gachaPools` | poolId | GachaPoolDef |
| `colorGroups` / `colorEquipments` / `themeDesigns` | id | ColorGroupDef / ColorEquipmentDef / ThemeDesignDef |
| `affectionConfig` | —（单值，部分覆盖合并） | AffectionConfigDef（好感阶梯/星级锁，缺省用引擎内置） |
| `characterPersistConfig` | —（单值） | CharacterPersistConfig（三层归属声明） |
| `resourceDisplays` | resourceId | ResourceDisplayDef |
| `tagDefs` | 标签路径串 | TagDef |
| `pics` / `picsByKind` | 完整索引 / typeName | PicDef / 索引集合（见 [[docs/docs-828/02-modules/pics]]） |
| `charaProfiles` | 原型 id | CharaProfileDef |
| `extras` | —（单值树） | ExtraCompound（多包深合并常量表） |

## 关系索引（装载时构建）

| 索引 | 说明 |
| --- | --- |
| `areasByInit` / `spotsByArea` | Init→Area、Area→Spot 归属链 |
| `spotsByTag` | 层级标签 → Spot 集合（登记所有前缀，父含子） |
| `effectiveSpotTags(spotId, overrides?)` | 纯查询：声明标签 + 运行时增撤覆盖（`state.spotTagOverrides`，global 层，T6）合成后的有效标签 |

## 构建与校验

- 装载流程：`clear()` → 逐包 `merge(dp)`（tableSteps 统一驱动）→ 完整性校验；
- 校验失败即抛错（缺引用 / 重复 ID / 非法枚举），保证运行时「拿到的引用必有效」；校验覆盖面并非全量——真/意义引用的校验差异见 [[docs/docs-828/03-data-structures/id-reference-semantics]] §六。

## 运行时不可变

- Registry 是**只读编译态**：只在 `init(datapacks)` 时装载一次；
- 运行时变化（解锁/升级/标签增减）全部在 `PlayerState` 层，不反向改 Registry；
- Spot 标签运行时增减经 `StateMutationService` 落 `spotTagOverrides` → `spotTagChanged` 事件 → GameNum 重建（见 [[docs/docs-828/02-modules/affector]] / [[docs/docs-828/02-modules/game-num]]）。

## 相关文档

[[docs/docs-828/02-modules/registry]] · [[docs/docs-828/01-architecture/data-flow]]
