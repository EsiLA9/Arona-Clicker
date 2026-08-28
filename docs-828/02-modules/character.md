# 02-modules/character — 角色 / 抽卡 / 培养 / 通讯录

> 一句话：角色域 = 原型（Character）与差分（Variant）两层实体，配抽卡、培养、图鉴三个子系统。

## 职责边界

- **管**：角色收集/差分/碎片、卡池抽取结算、经验曲线与突破、通讯录只读查询。
- **不管**：色彩（[[docs-828/02-modules/color]]）、剧情与聊天（[[docs-828/02-modules/story]]）。

## 关键文件（`src/engine/system/`）

| 文件 | 职责 |
| --- | --- |
| `character-system.ts` | Character 系统容器：注册表视图 + 归属层解析 |
| `character-availability.ts` | 可抽取集合（`drawableOf`：世界 Pool 合并、排除已满收藏）。⚠️ `refreshWorldPool`（池关闭并入世界 Pool）已实现但无调用点（未接线） |
| `roster-system.ts` | 通讯录/图鉴只读查询：`contactGroups`（按校分组）/ `codex`（全差分）/ `getVariant` / `getOwned` / `shardsOf` |
| `gacha-service.ts` | 抽取模式注册表 + `ba-classic` 结算（稀有度权重 roll + featured UP + 天井）；发 `gachaResolved` / `characterAcquired` |
| `cultivate-system.ts` | 培养纯计算：`resolveCurve` / `applyExp` 推演（累计经验结转）/ `checkBreakthrough`；发 `cultivated`（`kind: 'exp'` / `'star'`） |

## 核心概念

- **原型与差分**：`CharacterDef` 是「全集」概念（收集/分组按原型）；`CharacterVariantDef` 是具体差分（独立实体，带 name/rarity 副本，`proto` 仅作聚合键——意义引用）。实体结构见 [[docs-828/03-data-structures/character-entities]]。
- **招募入口**：在 Spot 的 `gacha` 功能项（Spot 可声明 `gachaPools` 专有卡池；无声明仅开放全局通用卡池）。
- **重复转换**：重复差分转碎片（图鉴兑换用）；新差分发 `characterAcquired` → 色彩解锁联动（`ColorUnlockReactor`）。
- 结算细节：抽卡 [[docs-828/04-algorithms/gacha]]、培养 [[docs-828/04-algorithms/cultivate]]、通讯录 [[docs-828/04-algorithms/roster]]。

## 测试入口

`tests/engine/character-system.test.ts`、`gacha-service.test.ts`、`cultivate-system.test.ts`、`roster-system.test.ts`、`character-availability.test.ts` 等

## 相关文档

[[docs-828/03-data-structures/character-entities]] · [[docs-828/02-modules/color]]
