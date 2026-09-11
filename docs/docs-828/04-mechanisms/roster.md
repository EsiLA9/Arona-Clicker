# 04-mechanisms/roster — 通讯录分组 / 图鉴 / 招募入口

> 本文回答：**角色收集怎么查询与展示。** `RosterSystem` 是角色收集 + 图鉴的只读查询门面；模块卡片见 [[docs/docs-828/02-modules/character]]。

## 分组（通讯录）

- `contactGroups(state)` → 按 `variant.school`（CharacterSchool，11 校）分组的**已持有**差分，组内按稀有度降序；
- 分组是**运行时派生**（无持久化分组表）；未持有差分不出现在通讯录，进图鉴（codex）。

## 图鉴（codex）

- `codex(state)` → 全差分列表（含未持有），按稀有度降序，条目含持有记录（`VariantProgress | undefined`）；
- 单查：`getVariant` / `getOwned` / `shardsOf` / `acquiredCountOf` / `protoStatOf`；
- 悬停详情走 tooltip 揭示阶梯（未揭示信息遮挡，见 [[docs/docs-828/02-modules/visibility]]）；
- 收集类统计经 `TagStatService`（characters 维度）同步三层统计。

## 招募（gacha 入口）

- 招募入口 = Spot 的 `gacha` 功能项（弹窗在专有卡池/通用卡池间切换）；
- 可抽取集合 `drawableOf(pool, state)` 在 `CharacterAvailabilityService`（世界 Pool 合并、排除条件过滤）；
- 抽取结算见 [[docs/docs-828/04-mechanisms/gacha]]；新差分 → `characterAcquired` 事件 → 图鉴统计/色彩解锁联动（`ColorUnlockReactor`）。

## 相关文档

[[docs/docs-828/03-data-structures/character-entities]] · [[docs/docs-828/02-modules/stats]]

