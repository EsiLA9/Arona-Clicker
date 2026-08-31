# 08-roadmap/0004-chara-ownership — Chara 拥有体系 Init 化 + 追赶统计

> 本文回答：角色拥有体系改造的目标、现状归属、设计草案与待裁定问题。设计权威：待产出 ADR；本文只登记目标与追踪状态。

## 目标陈述

1. **拥有体系改为一般为 Init 级**：角色收集/差分/碎片随世界线（Init）独立拥有与重置，不再默认跨世界线保留。
2. **新增大量统计项支撑追赶进度**：按池/按角色记录抽取与培养投入类统计，为 Gacha 卡池（垫抽/保底修正）与好感度培养（追赶补偿）提供数据与条件依据。

## 现状归属

| 数据 | 当前层 | 位置 |
| --- | --- | --- |
| `state.characters`（收集全集） | **Global** | [[docs-828/01-architecture/state-layers]] 分层表 |
| `state.roster`（RosterEntry 进度副本，内嵌好感值） | **Global**（`characterPersistConfig` 可声明 global/init，机制已存在） | `character-persist.ts` 系 |
| `state.fragments`（碎片） | Global | [[docs-828/03-data-structures/character-entities]] |
| `gachaState`（pity/pulls，按 poolId 意义引用） | PlayerState 持久化 | [[docs-828/04-algorithms/gacha]] |
| 统计底座 | StatsService 三层桶 + TagStatService（characters 维度已有 protoStats / acquiredCount） | [[docs-828/02-modules/stats]] |

关键点：`CharacterPersistScope` / `characterPersistConfig` 机制**已存在**（roster/gacha/chatRead 三分支可声明 global/init），本目标主要是默认值翻转与字段拆分，不是从零造归属机制。

## 设计方向（草案，待裁定）

- **归属翻转**：roster / characters / fragments 缺省改 `init`（随世界线重置）；"曾拥有过"的图鉴认知若需跨线保留，另立 global 副本（图鉴发现记录 vs 当前拥有分离）。
- **追赶统计项（候选）**：累计抽数（按池 / 按 Init）、自上次高稀有度出金抽数、重复转化碎片累计、每角色获得次数 / 碎片 / 好感 exp / 培养投入、限定池出率历史——登记进 stats 三层桶并映射 stat-dsl，供条件（`ConditionSystem` 新 stat 函数）与 UI 消费。
- **追赶机制形态（候选）**：pity 修正读取统计、抽取权重向未持有差分倾斜、好感 exp 补偿——形态与强度待裁定。

## 待裁定问题

1. **"一般为 Init 级"的例外清单**：哪些域保留 global（图鉴发现记录？跨线总收集统计？聊天已读 chatRead 现默认 init 是否维持）？
2. **统计的消费者**：GachaService 权重 / ConditionSystem 新 stat 函数 / 纯 UI 展示——v1 范围？
3. **roster 改 per-Init 的工程面**：`PER_INIT_FIELD_SPECS` 登记（characterContainer 三分支）、快照/恢复路径、`??=` 兜底清档（纪律 7，无迁移代码）。
4. **与好感系统的交互**：好感值内嵌 RosterEntry、随 roster 归属层走（[[docs-828/06-adr/planning]]）——好感随 Init 重置是否为期望行为？"好感追赶"是否意味着部分好感投入需跨线补偿？

## 前置与关联

- **强关联 [[docs-828/08-roadmap/0003-gacha-pool-model]]**：两目标同处角色域、统计口径互相引用，建议同场设计裁定。
- 建议排在 [[docs-828/08-roadmap/0001-datapack-management-rollout]] S1c 之后实施：先完成 character/variant id 三段化，避免归属翻转与 id 改名叠加。

## 状态

**待设计裁定**（建议与 0003 同场裁定）→ 产出 ADR 并拆实现切片。
