# 07-audit/stats-ledgers — 统计多套并记

> 本文回答：**「收集 / 产出了多少」为何被五处机制反复记账、worldTilt 为何是预留体系，怎么收敛。**
> 多 Datapack 前提不影响本组——统计是引擎内部事实，与包数量无关。

## 问题清单

| # | 现象 | 位置 | 严重度 |
| --- | --- | --- | --- |
| 1 | 同类计数五处并记：三层桶 + 写入口内联 + TagStatService 三索引 + protoStats 派生视图 + GameView 快照 | 见下 | 高 |
| 2 | worldTilt 定宽 16 字符世界标识体系（缺省恒官方世界） | 见下 | 中 |

### 1. 统计五套并记

- **位置**：`02-modules/stats.md:14,16,22`（三层桶累加、写入口同步记账）；`04-mechanisms/roster.md:15`（收集类统计「同步三层统计」义务）；`03-data-structures/player-state.md:35`（`protoStats` 派生视图，Trigger 维护）；`03-data-structures/stats-views.md:5-25`（TagStatService 7 kind × 「声明集 / 收集集 / 实体反查」三套索引 + GameView 快照）。
- **原因**：每个收集/产出动作隐含「三层桶 + tag 索引 + proto 聚合 + 视图」同步义务；protoStats 由 Trigger 增量维护，是第三种派生同步机制。而消费方仅 `tagCount` / `protoStat` / `stat` 三类条件与 UI 展示——「收集了多少」一个事实被五层机制反复记账。
- **方案组**：
  - **A（推荐）**：三层桶为唯一记账点；TagStatService 改**查询时聚合**（spots 域用 `spotsByTag` 索引、characters 域扫 roster——规模均小）；`protoStats` 字段删除，`protoStat` 条件改读时按 proto 聚合 roster；写入口回归「改值 + 发事件」两件事。
  - B：保留 TagStatService 索引（若 `tagCount` 条件高频），仅删 protoStats 派生视图。
  - C：维持现状。
- **收益注**：A 删掉一条 Trigger 维护链与 7×3 索引重建；写入口从「三件事」减回「两件事」，降低「新增写方法要记得三件事齐全」的纪律负担（对照 [[docs/docs-828/04-mechanisms/state-mutation]]）。

### 2. worldTilt 预留体系

- **位置**：`02-modules/stats.md:17`、`03-data-structures/stats-views.md:25`（定宽「首位(0|1).尾15位」、`WORLD_TILT_TAIL_DIGITS = 15`、`normalizeWorldTilt` / `compareWorldTilt` 字典序比较、缺省 `1.000000000000000` = 官方世界）。
- **原因**：为「世界倾斜」玩法预留的整套标识体系——规范化、比较器、常量、缺省值俱全；当前缺省值恒不变，无任何倾斜来源。
- **方案组**：
  - **A（推荐）**：删除（纪律 8 下存档结构破坏性变更零成本；玩法立项时重加）。
  - B：冻结（保留字段与文档，不再扩展）；若世界倾斜已立项则保留。
