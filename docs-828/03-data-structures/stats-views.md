# 03-data-structures/stats-views — 三层统计 & UI 只读视图

> 本文回答：**统计桶怎么分层、统计 DSL 怎么写、UI 视图长什么样。** 模块卡片见 [[docs-828/02-modules/stats]] 与 [[docs-828/02-modules/visibility]]。

## 三层统计（StatsService）

| 层 | 键 | 生命周期 | 累加范围 |
| --- | --- | --- | --- |
| **Global** | `globalStats` | 跨世界线永久 | 全部运行 |
| **per-Init** | `initStats` | 世界线生命周期 | 该世界线全部运行 |
| **当前运行** | `currentRunStats` | 本次游玩 | 当前 runId |

- 每个 `StatsBucket` 是统一计数累加器（`resourceProduced/consumed`、`itemsCollected/used`、`storiesCompleted`、`framesActive` 等）；
- 每帧一次 `statsService.tick()` 累计帧数；每次 `StateMutationService` 写资源/物品/剧情同步记统计（纪律 1 的内建收益）。

## 统计 DSL（`$GlobalProducedAmount base:resource:credit` 等）

- `parseStatCall(dsl)` → `{ fn, key, initId }`；
- 统计函数（`$GlobalProducedAmount` 等 30+ 个）统一映射到三层桶的特定指标；
- 条件系统经 `stat` 条件 target 求值（`evaluateStatCondition`）。

## 标签统计（TagStatService）

- 按实体类型聚合收集数：`TagStatKind` 7 种（spots/areas/characters/…），键格式 `<kind>:<tagDisplay>`；
- 供条件 `tagCount` 引用与图鉴展示；世界倾向 `worldTilt` 为定宽串「首位(0|1).尾15位」（`WORLD_TILT_TAIL_DIGITS = 15`），默认 `1.000000000000000` = 官方世界（`stats/world-tilt.ts`）。

## UI 只读视图（GameView / UIContext）

- `getView()` → `GameView`：资源快照 + spotLevels + unlockedInits + storyLog + visibility 等；
- `createUIContext(game)` → `UIContext`：GameView + nameOf/formatNumber/escapeHtml 等 UI 辅助；
- 组件层只持 `GameReadModel` 只读视图；每帧 `refreshLight` 更新数字，揭示指纹变化 → `refreshRevealIfChanged` → 重建 DOM。

## 可见性（VisibilityEngine）

- `visibility` 快照：`{ spots, areas, inits }` 布尔掩码；
- 计算依据：`revealTriggers` 的 `existence` 目标（reveal 部分见 [[docs-828/04-algorithms/trigger-effect]]）；
- 读档 / 运行时标签变化 → `refresh()` 重建快照。注意 `RevealStage`（7 级）与 `AccessStage`（5 阶段）是两套概念，勿混淆（见 [[docs-828/02-modules/visibility]]）。

## 相关文档

[[docs-828/03-data-structures/player-state]] · [[docs-828/02-modules/ui]]
