# 07-audit/dual-track-state — 双轨与副本状态

> 本文回答：**同一逻辑数据存两份 / 两轨的问题清单与合并方案。**
> 引用语义的权威评审在 [[docs-828/03-data-structures/id-reference-semantics]] §六，本篇不重复其结论，只补方案组。

## 问题清单

| # | 现象 | 位置 | 严重度 |
| --- | --- | --- | --- |
| 1 | StoryEntry.id 与 StoryDef.id 副本主键 + passive 覆盖 active 静默吞数据 | 见下 | 高 |
| 2 | 阅读记录双轨 `storyLog` / `storyReadLogs` | 见下 | 高 |
| 3 | `EntityThemeSlot.equipmentId` 写而不读（双真相源） | 见下 | 中 |
| 4 | per-Init 字段三重登记 + `characterPersistConfig` 三分支 | 见下 | 中 |
| 5 | 差分实体内容副本 name/rarity/school | 见下 | 低 |

### 1. 剧情 id 副本主键与静默覆盖

- **位置**：`02-modules/story.md:34`（`entry.id === storyId` 仅为 builder 约定，无强制）；`03-data-structures/registry.md:18`（`storyEntries` 合并视图同 id 时 passive 静默覆盖 active）；`03-data-structures/id-reference-semantics.md:93-98`（§六.1，自评「最危险」）。
- **原因**：两实体共用主键靠巧合重合；跨表（active/passive、story/entry）不查重。多包前提下第三方包更容易撞 id，静默吞数据不可接受。
- **方案组**：
  - **A（推荐）**：合并 Entry 与 Story 为单实体（触发/奖励字段并入 StoryDef，触发入口用条件表达）——副本 id 与跨表查重问题整体消失。
  - B：保留两实体：加载期校验 `id === storyId` + story/entry 跨表同 id 抛错（覆盖 passive 覆盖 active 的路径）。

### 2. 阅读记录双轨

- **位置**：`02-modules/story.md:36`（`storyLog` 跨 run 累计 vs `storyReadLogs` per-Init 快照）；`03-data-structures/player-state.md:10,27`（两者同入快照）。
- **原因**：「读过没有」这一事实存两份，两种生命周期；`hasReadStory` / `hasReadStoryInRun` / `visitedStoryInChain` / BranchGuard 四个条件分轨消费（`declarative-dsl.md:59-61`），一致性靠约定维护。
- **方案组**：
  - **A（推荐）**：合并为单轨完成记录（含 runId）——「当前 run 是否读过」改为过滤派生，`hasReadStoryInRun` 条件随之简化。
  - B：保留双轨，但统一 id 空间并收口到同一访问器（消歧说明只写一处）。

### 3. equipmentId 写而不读

- **位置**：`03-data-structures/id-reference-semantics.md:54,114`（「写入但从不被读取——装备槽实际跟随当前已装备装备」）。
- **原因**：同一槽位保留「存的 id」与「运行时实时解析」两个真相源，换装备不改槽，字段语义与行为脱节。
- **方案组**：
  - **A（推荐）**：删字段（含 schema 同步）。
  - B：改语义为「槽位锁定该装备」（需产品意图支持：换装备是否应改变实体配色）。

### 4. per-Init 字段多重登记

- **位置**：`02-modules/world.md:18`（SPECS 单一事实源 + 键守卫）；`01-architecture/state-layers.md:20-21`（双向 `Exclude` 断言 + `characterPersistConfig` 三分支 roster/gacha/chatRead）；`03-data-structures/player-state.md:9-10`（归属逐块声明）。
- **原因**：一个 per-Init 字段出现在 PlayerState 类型、InitSnapshot 类型、SPECS 三处，再加守卫与角色域归属声明——「单一事实源」实为多重登记；一次新增字段牵动 4 处。
- **方案组**：
  - **A（推荐）**：InitSnapshot 类型由 SPECS 派生（`type InitSnapshot = FromSpecs<...>`），角色域归属并入 SPECS 项的 `scope`，键守卫随之删除——登记回归一处。
  - B：保留现状（编译期成本已付、运行时无成本），仅把「新增字段流程」压缩为一页 checklist（见 [[docs-828/07-audit/sync-burden]] #2）。

### 5. 差分内容副本

- **位置**：`02-modules/character.md:22`（差分独立实体，带 name/rarity 副本，proto 仅作聚合键）；`03-data-structures/id-reference-semantics.md:46`。
- **原因**：副本靠「意义引用」约定与原型保持分组一致；BA 题材差分≈时装，副本成本可控、聚合路径简单。
- **方案组**：
  - **A（推荐）**：维持现状，标记「可接受」——改「原型 + override」收益低。
  - B：仅当出现大规模差分复用需求（类似「多 Entry 复用 Story」）时再评估 override 化。
