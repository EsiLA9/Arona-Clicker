# docs-824 — 03d 三层统计 & UI 只读视图

> 原文出处：`03-data-structures.md` 五、七章。

## 三层统计（StatsService）

| 层 | 键 | 生命周期 | 累加范围 |
| --- | --- | --- | --- |
| **Global** | `globalStats` | 跨世界线永久 | 全部运行 |
| **per-Init** | `initStats` | 世界线生命周期 | 该世界线全部运行 |
| **当前运行** | `currentRunStats` | 本次游玩 | 当前 runId |

- 每个 `StatsBucket` 统一计数累加器结构（`resourceProduced/consumed`、`itemsCollected/used`、`storiesCompleted`、`framesActive` 等）；
- 每帧一次 `statsService.tick()` 累计帧数；每次 mutations 写资源/物品/剧情同步记统计。

## 统计 DSL（`$GlobalProducedAmount base:resource:credit` 等）

- `parseStatCall(dsl)` → `{ fn, key, initId }`；
- 统计函数（`$GlobalProducedAmount` 等 30+ 个）统一映射到三层桶的特定指标；
- 条件系统可通过 `stat` 条件引用统计值（`evaluateStatCondition`）。

## UI 只读视图（GameView / UIContext）

- `getView()` → `GameView`：资源快照 + spotLevels + unlockedInits + storyLog + visibility 等；
- `createUIContext(game)` → `UIContext`：GameView + nameOf/formatNumber/escapeHtml 等 UI 辅助；
- 每帧 UI 用 `refreshLight` 更新资源数字；条件变化触发 `refreshRevealIfChanged` → 重算揭示指纹 → 重建 DOM。

## 可见性（VisibilityEngine）

- `visibility` 快照：`{ spots: {...}, areas: {...}, inits: {...} }` 布尔掩码；
- 计算依据：`revealTriggers` 的 `existence` 目标（见 [[docs-824/04f-trigger-effect]] 中 reveal 部分）；
- 读档 / 运行时标签变化 → `refresh()` 重建快照。

---

上一篇：[[docs-824/03c-character-entities]] · 返回 [[docs-824/03-data-structures]]