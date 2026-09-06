# 03-data-structures/character-entities — Character 实体：原型 / 差分 / 曲线 / 色彩

> 本文回答：**角色体系的实体结构与关系。** 模块卡片见 [[docs-828/02-modules/character]]；数据包实体契约权威在 `src/data-services/contracts/character-variant.ts`、`character-persist.ts`、`gacha-pool.ts`、`color.ts` 与 `cultivate-curve.ts`，产品状态入口在 `src/arona-clicker/types/character.ts`。

## 实体结构

```text
Character（原型 id）     → 角色基础原型（name/rarity/school，Registry `characters` 表）
    └─ CharacterVariantDef → 差分：不同时装的独立实体（id/displayName/theme/curves）
         ├─ VariantSource    → 产出方式（gacha / story / event）
         ├─ unlockCondition  → 差分解锁条件
         ├─ curve            → CultivateCurveDef 真引用（培养见 04-mechanisms/cultivate）
         └─ colorGroupId     → 默认头像色彩组 ColorGroupDef
```

- 原型是角色的「全集」概念：`protoStats` 按原型记账（获得总量等）；
- 差分是具体可持有实体：`state.roster`（Record<VariantId, RosterEntry>）按 variantId 存进度副本，碎片在 `state.fragments`——即典型「意义引用」（见 [[docs-828/03-data-structures/id-reference-semantics]]）。

## 图鉴与通讯录（RosterSystem）

- `contactGroups(state)` → 按学校（CharacterSchool）分组的已持有差分，组内按稀有度降序；
- `codex(state)` → 全差分图鉴列表（含未持有，按稀有度降序）；
- `getVariant(variantId)` / `getOwned(state, variantId)` / `shardsOf` → 单个差分详情/持有/碎片；
- 可抽取列表 `drawableOf(pool, state)` 在 `CharacterAvailabilityService`（character-availability.ts），供卡池用。

## 曲线（CultivateCurveDef）

- 曲线含 `expTable` / `starCost` / `maxLevel`；差分 `curve` 缺省用全局默认曲线；
- 培养系统沿曲线推进升级/突破（见 [[docs-828/04-mechanisms/cultivate]]）。

## 色彩（ColorGroupDef）

- `ColorGroupDef`：{ id, name, compositionType, slots[{role,color}], theme?, unlock? }，是唯一色彩实体 = 头像渲染方案 + theme-tree 预设；
- 实体配色槽 `EntityThemeSlot`（kind: default/equipment/design/custom）与配色设计 `ThemeDesignDef` 见 [[docs-828/02-modules/color]]。

## 三层归属（CharacterPersistScope）

角色相关字段的跨世界线归属由 `registry.characterPersistConfig` 声明：`global`（跨世界线保留）/ `init`（随世界线重置），缺省见 `characterScopeOf`（实现见 `character-persist.ts` 系）。

## 相关文档

[[docs-828/04-mechanisms/gacha]] · [[docs-828/04-mechanisms/cultivate]] · [[docs-828/04-mechanisms/color-derivation]]
