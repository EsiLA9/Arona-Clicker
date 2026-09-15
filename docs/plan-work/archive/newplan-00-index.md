# 学生获取与关系资产化：新策划汇总

> 来源：Sol 策划询问回复。本文组只保存方案汇总与待裁定方向，不代表已经形成最终 ADR，也不直接替代 `docs/docs-828/` 的机制事实源。

## 核心目标

把 Spot、商店、招募、角色仓库和关系内容统一为一套“学生获取与关系资产化”系统：

> Spot 决定玩家在哪里、以什么方式接触学生；商店与卡池决定如何获得；拥有体系决定获得之后拥有什么。

## 文件路由

| 文件 | 主题 |
| --- | --- |
| [[01-ownership-and-development]] | Character / Variant / Development、拥有状态、好感与培养分离 |
| [[02-unified-acquisition]] | Acquisition / Offer、统一获取入口与重复处理 |
| [[03-spot-shop]] | Spot 商店、Offer、库存、刷新与 Reveal |
| [[04-recruitment-v2]] | Pool / Banner 解耦、Recruitment Point 与 Spark |
| [[05-fragments-and-currency]] | Eleph、确定性角色获取、货币控制与 World Token |
| [[06-meta-loop-and-ui]] | Spot × 商店 × 学生闭环、空间化 UI 与完整样例 |
| [[07-mvp-scope]] | MVP 范围、切片顺序与验收重点 |
| [[16-runtime-datapack-authoring]] | 运行时内嵌数据包创作：受控运行时主机模式、图形化编写与数据双向转换（待评审） |

以上仍属待评审草案；评审后再分别沉淀为正式 ADR、Roadmap 与实现任务。本索引只登记仍待裁定的设计。

### 已退出本目录

以下草案已完成裁定或转化，正文已移入 `completed/` 历史区；此处只保留来源关系：

| 原文件 | 处理 |
| --- | --- |
| [[08-passive-story-sol-review]] | 已裁定，施工归入 [[task-0032-passive-story-scheduling]] |
| [[09-shop-transaction-draft]] | 已落地，剩余裁定归入 [[task-0039-spot-shop-transaction-system]] 与 [[roadmap-0002-spot-shop]] |
| [[10-inventory-workspace]] | 首版已落地，剩余能力归入 [[task-0068-inventory-workspace-remaining-capabilities]] |
| [[11-gear-equipment-system]] | MVP 已落地，效果消费归入 [[adr-0008-character-progression-boundaries]] |
| [[12-ui-geometry-workspace-reshape]] | 已转 Task-0044 并实施完成 |
| [[13-unified-workspace-refresh-boundaries]] | 已转 [[task-0045-ui-incremental-update-workspace-isolation]] 与 [[task-0047-contacts-story-workspace-ownership]] |
| [[14-contacts-story-workspace-ownership]] | 已转 [[task-0047-contacts-story-workspace-ownership]] 并完成核心迁移 |
| [[15-user-theme-background-layer-manager]] | 已转 [[task-0049-user-theme-background-layer-manager]] 及后续任务链 |

## 与现有计划的关系

- `roadmap-0002-spot-shop`：对应本组 Spot 商店方案，待将草案裁定为正式设计。
- `roadmap-0003-gacha-pool-model`：对应 Pool / Banner 解耦与招募点方案。
- `roadmap-0004-chara-ownership`：对应 Character / Variant / Development 拆分及拥有体系。
- 本组暂不修改上述 Roadmap 的状态；待评审后再拆成 ADR 与实现切片。

## 总原则

**抽卡只是遇见学生的一种方式，而拥有学生是一段长期关系的开始。**
