# 08-roadmap/0003-gacha-pool-model — 卡池模型规范化（banner ↔ 角色池解耦）

> 本文回答：卡池规范化的目标、现状痛点、设计草案与待裁定问题。设计权威：待产出 ADR；本文只登记目标与追踪状态。

## 目标陈述

把"抽取入口池（banner）"与"实际角色池（候选集）"解耦：banner 按星级、角色子集等维度声明候选来源，从而支持——

1. **基础池跟随 Init 进度扩充**：随世界线推进，基础池候选自动扩容；
2. **限定池区隔**：限定差分只进指定 banner，不混入基础池。

## 现状与痛点

| 现状 | 位置 | 痛点 |
| --- | --- | --- |
| `GachaPoolDef` = `{ mode, currency, costPerPull, rates, featured?, pity?, 重复返还 }` | `src/engine/types/` | banner 与候选集未分家：候选来源只有"世界 Pool 隐式合并"单一路径 |
| `drawableOf(pool, state)`：世界 Pool 合并 + 排除已满收藏 | `system/character-availability.ts` | 无声明式成员过滤维度（星级/子集/tag），限定差分无法隔离出基础池 |
| Spot 可声明专有 `gachaPools`，否则全局通用池 | [[docs-828/04-algorithms/gacha]] | 池间关系（基础/限定）无模型 |
| `refreshWorldPool`（池关闭成员并入世界 Pool）**已实现无调用点** | character-availability.ts | 未接线的半成品语义，本目标需裁定去留 |
| `GachaMode` 为代码注册表（`ba-classic`），非数据包可插拔 | `system/gacha-service.ts` | 模式是否数据包化的取舍 |

## 设计方向（草案，待裁定）

- banner 定义**声明式候选来源**：按 rarity 过滤 / 按原型或差分列表 / 按 tag / 按 Init 解锁集合（v1 取舍见待裁定）。
- 基础池进度扩充：池成员资格 = 静态声明 + 进度条件追加（或接线 `refreshWorldPool` 语义，随 Init 进展把池成员转正）。
- 限定池：限定差分不进世界基础池、仅声明进限定 banner——用 `VariantSource` 或池成员资格字段表达，并在 registry 校验层防数据作者手误。

## 待裁定问题

1. **候选集过滤维度**：rarity / 原型列表 / tag / Init 集合——哪些进 v1？
2. **限定池语义强度**：限定不进基础池是数据作者约定，还是引擎校验（声明 `limited` 的差分出现在基础池候选即报错）？
3. **"跟随 Init 进度扩充"的判定载体**：进入某 Init 才生效，还是条件满足即全局生效（跨世界线）？
4. **`gachaState`（pity/pulls）的键与归属层**：banner 解耦后按 bannerId 记；归属 global 还是 per-Init——与 [[0x-plan&work/active/roadmap-0004-chara-ownership]] 的拥有体系联动裁定。
5. **`refreshWorldPool` 去留**：本目标内接线，还是废弃删除（[[docs-828/07-audit/dormant-machinery]] 已记录为休眠机制）？

## 前置与关联

- **强关联 [[0x-plan&work/active/roadmap-0004-chara-ownership]]**：拥有体系归属翻转影响 drawableOf 排除逻辑与统计口径，建议两目标设计裁定同场进行。
- 依赖 [[0x-plan&work/active/roadmap-0001-datapack-management]] S1c：character/variant id 三段化完成后，池成员引用统一三段 id。

## 状态

**待设计裁定**（建议与 0004 同场裁定）→ 产出 ADR 并拆实现切片。
