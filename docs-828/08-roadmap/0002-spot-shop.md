# 08-roadmap/0002-spot-shop — Spot 商店（购买集 / 发现限制）

> 本文回答：商店功能的定位、现状挂钩点、设计草案与待裁定问题。设计权威：待产出 ADR（编号顺延，现为 06-adr/0005 起）；本文只登记目标与追踪状态。

## 目标陈述

商店作为 Spot 的功能项挂靠（与 `gacha` 功能项同类形态），玩家在 Spot 界面消耗资源购买商品。**购买集依托 Affector 体系提供发现限制**：货架内容不是全量静态暴露，而是随游戏进度（Affector 激活/条件达成）逐步上架浮现。

## 现状挂钩点

| 挂钩 | 位置 | 说明 |
| --- | --- | --- |
| Spot 功能项 kind 注册 | `src/arona-clicker/services/spot-functionality.ts` | 现有 `linearYield` / `restartInit` / `hardResetInit` / `gacha` 四种；`shop` 为新增 kind |
| RevealStage 揭示阶梯 | `src/engine/types/reveal.ts` | 7 级中已含 `purchaseable` 级，商店发现限制可直接复用该语义 |
| 物品发放先例 | `game/item-service.ts`（pickupEffects / giveItem）、`system/loot-system.ts`（`loot` effect） | 购买发货可复用既有链路 |
| 扣费购买先例 | `game/init-service.ts`（purchaseInit）、Spot 升级购买 | 门面只读判定 + mutations 写入的门槛链模式 |
| Spot 功能项面板 | [[docs-828/02-modules/ui]] | UI 落点：功能项面板扩展商店弹层 |

## 设计方向（草案，待裁定）

- 新增 ShopDef（Datapack 表，进 `src/engine/types/` 后跑 `npm run gen:schema`，协议见 [[docs-828/05-conventions/schema-sync]]）；货架条目 = `{ 商品 ref, 价格, 限购, 可见/可购条件 }`。
- **发现限制的 Affector 承载**：货架条目或分组引用 AffectorPack——Affector 条件达成激活（Latent→Active）即对应商品上架，未激活时隐藏；激活沿 `effects` 可承担"上架"一次性动作。
- 购买结算走 `StateMutationService` 单一写入口（扣费 → 发货 → 记账），发 `purchased` 类事件登记进 `EVENT_CATALOG` 供 Trigger 联动。

## 待裁定问题

1. **货币与定价**：复用现有 resources/items，还是引入专用商店货币？价格是否表达式化（Funclet 动态定价，如随进度涨价）？
2. **购买集与 Affector 的耦合形态**：货架条目直接声明 affectorpack 引用（激活 = 上架），还是 ShopDef 静态条目 + 条件门控、Affector 只负责呈现限制？前者声明成本高但统一，后者直观但两套条件体系。
3. **限购语义**：per-Init 一次性 / 全局一次性 / 周期刷新（项目无日历时间，刷新以 tick 计数表达？）；限购计数放哪一层（per-Init 快照 vs global）。
4. **商品类型边界**：v1 仅 item？还是含 enhancement / 资源 / 卡池相关凭证？
5. **与 0003 卡池的衔接**：若出现"卡池券"类商品，池货币模型需同步对齐。

## 前置与关联

- 与 [[docs-828/08-roadmap/0001-datapack-management-rollout]] 无强依赖，但新表/实体 id 自即日起须符合三段式（S1a 强校验已生效）。
- 独立于 0003/0004，可并行设计。

## 状态

**待设计裁定** → 裁定后产出 ADR 并拆实现切片。
