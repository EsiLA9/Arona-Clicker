# 术语表：PassiveStoryEntry 主导聚集化抽选机制

> 配合 `11-passive-tag-selection.md`（ADR-001 rev2）。rev2 废弃 v1 的平铺 tags 模型。

## 主导维度（lead）
entry 声明的**单一一级聚合键**，决定分桶与 gate 判定。四种 kind：
`spot`（桶键为 spot tag，层级前缀登记）/ `character`（桶键为角色或 group）/
`area` / `init`。「无标签基础闲聊」用 `{kind:'area'}` 或 `{kind:'init'}` 表达，
不再特判。跨维度 AND 由结构保证：主导定桶 + 次级约束拒绝采样，不做任意布尔表达式。

## 活跃集合（active set）
每次抽选时**派生**、不持久化：
- `activeSpotTags` = 当前 Area 内所有在场 Spot 的 `tags`
- `activeChars` = `CharacterSystem.getUnlocked(state)`（被指派 manager OR flag 解锁）
- `validGroups` = 满足合法性条件的 `CharacterGroupDef`

## CharacterGroupDef（角色组）
Datapack 新实体（`characterGroups` 表）：`members` + 合法性条件
（`minUnlocked` 缺省全部解锁；`minUnlockedByTag` 如「防御部角色 ≥ 2」）。
**group 合法性是硬前置**：不合法 → 引用它的 entry 直接退出候选。
> 注意：`CharacterData.spotTagBonus` 是产出加成（tick 乘子），与本机制正交，不可混用。

## gate（准入/准出）
主导维度命中活跃集合即入候选桶；Spot 离场、角色未招募 → 对应 entry 自动准出。
spot 主导桶内多 tag 为 OR（任一命中即入桶），跨维度 AND 由结构保证。

## boost（提权）
`AreaTagRuntime.multipliers` 中 entry 命中 spot tag 的倍率（多命中取 max），
有效权重 = `weight × boost_A × boost_B × decay`。载体为 Area 运行时状态，
由 `setAreaTagWeight` 等 EffectOp 改写。

## lock（锁定池）
`lockedTags` 非空时仅锁定池可抽，**严格排除**一切非锁定 entry（含 area/init
主导基础闲聊）；entry 可用 `lockExempt: true` 主动豁免。由
`lockTagPool` / `unlockTagPool` / `clearTagPoolLock` 控制。

## 分桶索引（四张倒排表）
注册期按 lead.kind 维护：`spotTagToEntries`（含祖先前缀，父 tag 命中子 entry）、
`charToEntries`、`areaEntries`、`initEntries`。候选 = 命中桶并集，非全量扫描。

## 拒绝采样（rejection sampling，软约束）
转盘命中后校验 `requireCharacters`（角色已解锁或引用合法 group）；不满足则重掷
≤`REJECT_RETRY`(4) 次；**耗尽仍不满足则强制采纳最后命中者**——宁可不严格不空手。
与 group 硬前置分工：组合法性管「能不能进候选」，拒绝采样管「命中后是否顺延」。

## 双轨保底
- **A 轨（显式）**：entry `pityAfter`（数值或预设串，经 datapack `guaranteePresets`
  转义）。连续 N 次未命中 → 下轮在 stuck 集合内必中（多条卡住先救缺口最小者）。
- **B 轨（派生）**：registry 加载期扫描所有 ConditionGroup 中 hasReadStory /
  阅读次数谓词引用的 passive 可完成 storyId → wantedSet → 固定提权
  `WANTED_BOOST`(×3)。trigger 涉及收集判定时自动构建，编辑者零配置。

## 软衰减（decay）
有效权重乘 `DECAY ^ max(0, gap - GRACE)`，gap = 自上次播完后又播出的条数。
允许偶尔重复，实现简单、确定性、易测。默认 `DECAY=0.5`、`GRACE=0`。

## 计数三层归属
- global 层：`passivePlayCounter` / `passiveLastPlayed`（衰减跨世界线连续）
- per-Init 快照层：`passiveMissStreaks`（保底绑定世界线内收集任务）、
  `areaTagState`（multipliers + lockedTags，Area 从属于 Init）

## explain 视图（补偿的可查询面）
只读 API `explainPassivePool(areaId?)`：逐 entry 报告 `excludedBy`
（weight/init/condition/completed/group/lock）与 `missingRefs`
（声明 − 活跃集合的 spotTags/characters），供 UI 提示「去建造/去招募 XX」。

## 相关类型速查
- `PassiveLead` — spot/character/area/init 四种主导维度
- `PassiveStoryEntry.lead / requireCharacters / lockExempt / pityAfter`
- `CharacterGroupDef.minUnlocked / minUnlockedByTag`
- `PlayerState.passivePlayCounter / passiveLastPlayed`（global）
- `PlayerState.passiveMissStreaks / areaTagState`（快照）
- `EffectOp`: `setAreaTagWeight` / `lockTagPool` / `unlockTagPool` / `clearTagPoolLock`
