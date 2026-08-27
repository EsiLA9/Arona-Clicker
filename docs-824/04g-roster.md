# docs-824 — 04g 通讯录分组 / 图鉴 / 招募

> 原文出处：`04-core-algorithms.md` 八章。`RosterSystem` 是角色收集 + 图鉴 + 招募的统一门面。

## 分组（通讯录）

- 按 `characterGrouping` 规则分组：默认分组 + 玩家自定义分组；
- 分组信息持久化在 PlayerState（`rosterGroups`），可增删改；
- 每个分组内显示已收集差分（未收集显示占位 + 来源提示）。

## 图鉴

- `getCollection()`：已收集差分（含碎片数、收藏、培养进度）；
- 悬停详情走 tooltip 揭示阶梯（未揭示信息遮挡）；
- 收藏/碎片/图鉴进度统计同步三层统计。

## 招募（gacha 入口）

- 招募入口 = Spot 的 `gacha` 功能项（见 AGENTS.md）；
- `drawableOf(pool)` 过滤已满收藏差分 → 卡池抽取（见 [[docs-824/04c-gacha]]）；
- 新差分 → `characterAcquired` 事件 → 图鉴/色彩解锁联动。

---

上一篇：[[docs-824/04f-trigger-effect]] · 返回 [[docs-824/04-core-algorithms]]