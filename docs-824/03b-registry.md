# docs-824 — 03b Registry：注册表结构

> 原文出处：`03-data-structures.md` 三章。Registry = 编译态数据容器：表 + 关系索引 + 名称解析 + 校验。见 `[[src/engine/registry/registry.ts]]`。

## 表（Map 容器）

| 表 | 键 | 值类型 |
| --- | --- | --- |
| `spots` | spotId | SpotDef |
| `areas` | areaId | AreaDef |
| `inits` | initId | InitDef |
| `enhancements` | enhId | EnhancementDef |
| `items` | itemId | ItemDef |
| `stories`（active/passive 分表） | storyId | StoryEntryDef |
| `pools`（gacha/passive 分表） | poolId | PoolDef |
| `characters` | charId | CharacterDef |
| `variants` | variantId | CharacterVariantDef |
| `managers` | managerId | ManagerDef |
| `resources` / `tags` | id | ResourceDef / TagDef |
| `pics` | 完整索引（`mod:type(pic):id`） | PicDef；另有 `picsOfKind(kind)` 按 typeName 段索引（见 [[docs-824/07-pic-assets]]） |

## 关系索引（编译时构建）

| 索引 | 说明 |
| --- | --- |
| `spotsOfArea(areaId)` | Area → Spot 列表（含 inherited） |
| `areasOfInit(initId)` | Init → 默认 Area 链 |
| `tagsOf(id)` / `tagIndex` | 实体 → 标签；反向索引供条件系统查询 |
| `tagName` / `tagDescription` | 标签 → 中文名/描述（hover 用） |
| `nameOf(type, id)` | 任意实体 → 展示名（UI 统一调用） |

## 构建与校验

- `Registry.build(pack)`：建表 → 建关系索引 → 完整性校验；
- 校验失败即抛错（缺引用 / 重复 ID / 非法枚举），保证运行时「拿到的引用必有效」；
- 触发 `registry:built` 事件。

## 运行时 vs 声明

- Registry 是**不可变编译态**：只在 `init(datapacks)` 时构建一次；
- 运行时变化（解锁/升级/标签增减）全部在 `PlayerState` 层，不反向改 Registry；
- Spot 标签运行时增减会触发 `spotTagChanged` → GameNumSystem 重建反路由（见 [[docs-824/04b-production]]）。

---

上一篇：[[docs-824/03a-player-state]] · 下一篇：[[docs-824/03c-character-entities]]
