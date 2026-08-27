# docs-824 — 03c Character 实体：差分 / 卡池 / 曲线 / 色彩

> 原文出处：`03-data-structures.md` 四章。Character 跨文档重点，独立成文避免与 PlayerState 混读。

## 实体结构

```text
CharacterDef          → 角色基础原型（id/name/rarity/profile）
    └─ CharacterVariantDef  → 差分：不同时装的独立实体（id/displayName/theme/curves）
         ├─ VariantSource   → 产出方式（gacha / story / event）
         ├─ unlockCondition → 差分解锁条件
         └─ colors          → 可用色彩方案 ColorDef
```

- `CharacterDef` 是角色的「全集」概念：`unlockedCharacters` 记录已收集角色；
- `CharacterVariantDef` 是具体差分：`rosterSystem.getVariant(id)` 可查单个，`rosterSystem.drawableOf()` 可得当前可抽取列表。

## 图鉴（RosterSystem）

- `getCollection()` → 已收集差分列表（含碎片数 + 收藏标签）；
- `getVariant(variantId)` → 单个差分详情（含曲线/色彩/来源）；
- `drawableOf()` → 按当前状态过滤可抽取差分列表（卡池用）。

## 曲线（Curve）

- 每条曲线（`CurveDef`）是一个 `{ level, exp, attachment }` 数组，按 `resolveCurve(id, level)` 解析；
- 培养系统用 `applyExp` 沿曲线推进（见 [[docs-824/04d-cultivate]]）。

## 色彩（Color）

- `ColorDef`：{ id, name, tokens, ... }，装备在差分上改变主题色；
- `ColorSystem` 管理解锁/装备/运行时主题合并（见 [[docs-824/04e-color-derivation]]）。

---

上一篇：[[docs-824/03b-registry]] · 下一篇：[[docs-824/03d-stats-views]]