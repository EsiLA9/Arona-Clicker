# Init 生命周期与 Global 状态修正任务

> 本文回答：四种 Init 操作分别应如何处理 Global / per-Init 状态，以及本次修正的实现与验收范围。

## 1. 目标

统一“真正开始新游戏、不使用存档”“新进入 Init”“暂时离开 Init”“彻底 Init”四种操作的玩法语义，修复 GlobalEnh 和其他 Global 属性在世界线操作中被误清除或旧快照覆盖的问题。

## 2. 玩法语义

| 操作 | 玩法含义 | Global 数据 | Init 数据 |
|---|---|---|---|
| 真正开始新的游戏 | 创建完全独立的新游戏，不使用当前运行态或任何存档内容 | 全部不继承 | 由目标 Init 建立初始状态 |
| 新进入 Init | 进入一条没有历史快照的世界线 | 完整保留 | 使用该 Init 的初始状态 |
| 暂时离开 Init | 保存当前世界线，之后可恢复 | 完整保留 | 保存到对应 Init 快照，离开时清理当前运行态 |
| 彻底 Init | 删除目标世界线进度并重新开始 | 完整保留 | 删除目标快照并清除目标 Init 进度 |

Global 数据至少包括：

- Chara 的 Global 归属数据；
- Global Resource；
- `attachment.kind === 'global'` 的 Enhancement；
- 用户自定主题；
- 色彩收集、装备收集、已解锁 Init；
- Global Extra 与其他明确登记为 Global 的字段。

## 3. 当前问题

当前 `unlockedEnhancements` 被整体登记为 per-Init 字段：

- `startNewGame()` 创建新状态时只复制少量字段，但未复制 GlobalEnh；
- `InitSavepoint.clear()` 会清空完整 `unlockedEnhancements`；
- `InitSavepoint.save()` 会把 GlobalEnh 写进某个 Init 快照；
- `InitSavepoint.restore()` 会用旧快照整体覆盖当前强化集合。

因此 GlobalEnh 可能在新游戏、切换世界线、恢复旧快照或彻底重置 Init 时丢失。

## 4. 修正方案

### 4.1 Enhancement 作用域分离

以 Registry 中的 Enhancement 定义为权威：

- `attachment.kind === 'global'`：GlobalEnh；
- `attachment.kind === 'area'` / `init`：按当前 Init 处理；
- 未声明挂靠时沿用现有普通强化语义，并纳入 per-Init 处理。

增加可复用的 Global / local 筛选辅助逻辑，保存、清理、恢复和 Affector 对账均使用同一判定。

### 4.2 快照规则

`InitSnapshot.unlockedEnhancements` 只保存本地强化。

- 保存快照：过滤掉 GlobalEnh；
- 清空当前 Init：只清除本地强化；
- 恢复目标 Init：当前 GlobalEnh 与目标快照的本地强化去重合并；
- GlobalEnh 在不同 Init 之间不由快照复制或覆盖。

### 4.3 四种入口

- `startNewGame()`：直接使用新的默认状态，不从旧状态复制任何字段；
- `resumeInit()` 无快照：保留 Global，建立目标 Init 初始 per-Init 状态；
- `restartInit()`：保存当前 Init 快照后清理本地运行态，保留 Global；
- `hardRestartInit()`：删除当前 Init 快照并清理本地运行态，保留 Global。

### 4.4 其他 Global 字段审计

检查 `PlayerState` 顶层字段、`PER_INIT_FIELD_SPECS`、Character 归属配置和重建流程，保证以下操作不会误清 Global：

- Chara / roster / fragments / gacha 的 Global 分支；
- Global Resource；
- Enhancement；
- 用户主题、色彩、装备；
- `unlockedInits`、Global Extra 及收集类数据。

## 5. 测试验收

- 真正 `startNewGame()` 不继承任何旧 Global 或 Init 数据；
- GlobalEnh 在新进入 Init 后仍存在；
- 暂时离开并恢复 Init 后 GlobalEnh 仍存在；
- 在另一条 Init 获得 GlobalEnh 后恢复旧 Init，不被旧快照覆盖；
- 彻底重置 Init 不影响 GlobalEnh、Global Chara、Global Resource、用户主题、色彩和装备；
- 本地 Enhancement 仍能按目标 Init 保存、恢复和清除；
- Affector `reconcileMounts()` 在四种操作后挂载集合正确；
- `npm test`、`npx tsc --noEmit`、`npm run check:architecture` 通过。

## 6. 实施顺序

1. 增加 Enhancement 作用域筛选与快照合并辅助函数；
2. 改造 `PER_INIT_FIELD_SPECS` 和 `InitSavepoint`；
3. 修正 `InitService` 四种入口；
4. 检查 Character、Resource、用户主题、色彩和装备字段的清理路径；
5. 增加生命周期回归测试；
6. 更新状态分层文档与测试说明；
7. 执行完整验证并将本文标记为完成。

## 7. 实施结果

- 已增加 Global / local Enhancement 筛选辅助逻辑；
- 已使 Init 快照只保存本地 Enhancement，恢复时与当前 GlobalEnh 去重合并；
- `startNewGame()` 已改为创建全新状态，仅通过写入口登记当前目标 Init；
- `restartInit()`、`resumeInit()`、`hardRestartInit()` 已保留 GlobalEnh；
- 已增加跨 Init 生命周期回归测试；
- 全量测试 112 个文件、1045 项通过；类型检查与架构边界检查通过。

## 8. 状态

已完成。
