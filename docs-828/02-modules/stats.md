# 02-modules/stats — 三层统计 / Tag 统计 / 世界倾斜

> 一句话：`StatsService` 按 global / per-Init / 当前运行三层记账（随写入口同步记录）；`TagStatService` 维护按 tag 聚合的收集数反向索引。

## 职责边界

- **管**：三层计数累加与快照、统计 DSL 函数映射、tag 收集索引、`worldTilt` 定宽规范化。
- **不管**：写状态（由 mutations 调用 `record`）、条件判定（由 conditionSystem 读统计）。

## 关键文件（`src/engine/stats/`）

| 文件 | 职责 |
| --- | --- |
| `stats.ts` | `StatsService`：三层桶（`global` / `init` / `session`）累加、`recordTick()` 帧计数、`PersistedStats` 存档结构、读档恢复 |
| `stats-counters.ts` | 计数器结构与纯函数工具（`bump` / `emptyCounters` / `copyCounters` / `freshSnapshot`） |
| `tag-stats.ts` | `TagStatService`：7 种 `TagStatKind`（inits/areas/spots/characters/enhancements/passiveStories/activeStories）的「声明集 / 收集集 / 实体反查」索引；供条件 `tagCount`（`<kind>:<tagDisplay>`）查询；发 `tagCollectedChanged` |
| `world-tilt.ts` | `worldTilt` 世界线标识：定宽字符串「首位(0\|1).尾15位」（`normalizeWorldTilt` / `compareWorldTilt` 字典序比较）；缺省 `1.000000000000000` = 官方世界 |

## 核心概念

- **统计函数 30+**（`$GlobalProducedAmount` 等）经 `stat-dsl.ts` 映射到三层桶指标；条件系统 `stat` target 引用（见 [[docs-828/03-data-structures/stats-views]]）。
- 帧统计（`framesActive` 等）每帧 `recordTick()` 累计；资源/物品/剧情统计由写入口同步记账。
- `tagCount` 条件是「按 tag 聚合的收集数」（如 `spots:office`），与 `hasTag` / `countTags`（按已拥有 Spot）语义不同。

## 测试入口

`tests/engine/` 统计相关断言散布于 `game-instance.test.ts`、`spot-tag.test.ts` 等

## 相关文档

[[docs-828/03-data-structures/stats-views]] · [[docs-828/02-modules/expression]]（stat-dsl）
