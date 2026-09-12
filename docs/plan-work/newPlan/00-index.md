# 学生获取与关系资产化：新策划汇总

> 来源：Sol 策划询问回复。本文组只保存方案汇总与待裁定方向，不代表已经形成最终 ADR，也不直接替代 `docs/docs-828/` 的机制事实源。

## 核心目标

把 Spot、商店、招募、角色仓库和关系内容统一为一套“学生获取与关系资产化”系统：

> Spot 决定玩家在哪里、以什么方式接触学生；商店与卡池决定如何获得；拥有体系决定获得之后拥有什么。

## 文件路由

| 文件 | 主题 |
| --- | --- |
| [[docs/plan-work/docs/newPlan/01-ownership-and-development]] | Character / Variant / Development、拥有状态、好感与培养分离 |
| [[docs/plan-work/docs/newPlan/02-unified-acquisition]] | Acquisition / Offer、统一获取入口与重复处理 |
| [[docs/plan-work/docs/newPlan/03-spot-shop]] | Spot 商店、Offer、库存、刷新与 Reveal |
| [[docs/plan-work/docs/newPlan/04-recruitment-v2]] | Pool / Banner 解耦、Recruitment Point 与 Spark |
| [[docs/plan-work/docs/newPlan/05-fragments-and-currency]] | Eleph、确定性角色获取、货币控制与 World Token |
| [[docs/plan-work/docs/newPlan/06-meta-loop-and-ui]] | Spot × 商店 × 学生闭环、空间化 UI 与完整样例 |
| [[docs/plan-work/docs/newPlan/07-mvp-scope]] | MVP 范围、切片顺序与验收重点 |
| [[docs/plan-work/docs/newPlan/08-passive-story-sol-review]] | PassiveStory / StoryChain 设计意见与逐条审阅 | 🟡 已裁定，施工见 task-0032 |
| [[docs/plan-work/newPlan/09-shop-transaction-draft]] | Spot 商店与通用交易系统策划草案 | 🔵 待评审，重点裁定交易原子性与购买记录 scope |
| [[docs/plan-work/newPlan/10-inventory-workspace]] | 背包三栏 Workspace 与物品整理服务 | 🟡 首版已实施，待体验评审 |
| [[docs/plan-work/newPlan/11-gear-equipment-system]] | 装备（Gear）三槽、经验成长与 tier 升级 MVP 策划 | 🟢 MVP 已实施，effects 消费随 B 段 |
| [[docs/plan-work/newPlan/12-ui-geometry-workspace-reshape]] | UI Geometry Contract、Workspace Frame 与视觉基础设施重塑 | ✅ 已转 Task-0044，实施完成 |
| [[docs/plan-work/newPlan/13-unified-workspace-refresh-boundaries]] | Workspace 刷新边界、路由隔离与 Reveal 失效草案 | 🔵 待评审，事实核验完成 |
| [[docs/plan-work/newPlan/14-contacts-story-workspace-ownership]] | 通讯录 / 故事独立 Workspace 所有权与路由草案 | ✅ 已转 [[docs/plan-work/active/task-0047-contacts-story-workspace-ownership]]，Workspace 前置任务优先施工 |

## 与现有计划的关系

- `roadmap-0002-spot-shop`：对应本组 Spot 商店方案，待将草案裁定为正式设计。
- `roadmap-0003-gacha-pool-model`：对应 Pool / Banner 解耦与招募点方案。
- `roadmap-0004-chara-ownership`：对应 Character / Variant / Development 拆分及拥有体系。
- 本组暂不修改上述 Roadmap 的状态；待评审后再拆成 ADR 与实现切片。

## 总原则

**抽卡只是遇见学生的一种方式，而拥有学生是一段长期关系的开始。**
