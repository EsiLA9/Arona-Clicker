# docs-824 — 03a PlayerState：运行时状态结构

> 原文出处：`03-data-structures.md` 二章。运行时状态三层分层，见 `[[src/engine/types/entities.ts]]`。

## 三层分层（跨世界线 / 世界线内 / 当前运行）

| 层 | 字段前缀 | 生命周期 | 代表字段 |
| --- | --- | --- | --- |
| **Global** | `global*` | 跨世界线永久 | `globalResources`、`unlockedInits`、`globalStats`、`characters`（收集全集） |
| **per-Init 快照** | `initSnapshots` | 离开时保存、回时恢复 | `snapshot: { flags, extra, resources, items, enhancements, spotLevels, stats }` |
| **per-Init 当前** | 顶层字段 | 当前世界线运行时 | `resources`、`flags`、`extra`、`items`、`spotLevels`、`activeAreaId`、`storyLog`、`visitedAreas` |

**关键约定**：读状态时「当前层有值用当前层，无值回退快照层」——由 `extraFromLayer` / `resourceBucket` 等访问器统一实现（`StateMutationService`）。

## 主要字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `activeInit` | string | 当前世界线 ID |
| `resources` | Record<string, number> | 当前资源（Global 资源合并自 `globalResources`） |
| `flags` / `extra` | Record | 世界线内标记 / 扩展数据（Extra 三层：global>init snapshot>init run） |
| `items` | Record<string, number> | 物品持有数 |
| `spotLevels` / `spotManagers` | Record | 设施等级 / 指派 Manager |
| `unlockedEnhancements` | string[] | 已解锁强化 |
| `storyLog` | StoryLogEntry[] | 剧情完成记录（跨 run 累计） |
| `completedStoryIdsThisRun` | string[] | 本次运行完成（供「本次游玩」统计） |
| `studentBlocks` | Record<string, string> | 学生阻断状态 |
| `gachaState` | { pity, pulls } | 卡池保底计数 |
| `activeColors` / `unlockedColors` | Record | 角色色彩装备/解锁 |
| `initSnapshots` | Record<string, InitSnapshot> | 各世界线快照 |
| `globalStats` / `initStats` / `currentRunStats` | StatsBucket | 三层统计（见 [[docs-824/03d-stats-views]]） |

## 变更纪律（AGENTS.md 纪律 1）

- **任何字段只经 `StateMutationService` 写**；写方法内部同时：改值 → 发事件 → 记统计。
- 新增字段前先想清楚放三层哪一层；不写存档迁移代码。

---

上一篇：[[docs-824/03-data-structures]] · 下一篇：[[docs-824/03b-registry]]
