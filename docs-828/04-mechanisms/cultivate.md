# 04-mechanisms/cultivate — 培养推进：经验曲线 / 突破

> 本文回答：**差分升级与突破怎么结算。** `CultivateSystem.applyExp(variantId, exp)` / `breakthroughStar`；实体结构见 [[docs-828/03-data-structures/character-entities]]。

## 曲线模型（CultivateCurveDef）

| 字段 | 语义 |
| --- | --- |
| `maxLevel` | 等级上限 |
| `expTable?` | 各级升级需求（长度 = maxLevel - 1）；缺省用全局默认线性曲线 |
| `starMax?` | 星级上限 |
| `starCost?` | 各级突破消耗（单位：该差分碎片），`starCost[s]` = 从 s 升 s+1 所需 |

- 差分 `curve` 字段是真引用；缺省回落全局默认曲线；
- 玩家进度（等级/经验/星级/碎片）按 variantId 存 `state.roster` / `state.fragments` 副本（意义引用）。

## applyExp 推进

```text
applyExp(variantId, exp)
 ├─ 取曲线 + 当前等级/经验
 ├─ 累计经验 += exp
 ├─ while 累计经验 >= 下一级门槛 && 等级 < maxLevel：
 │    ├─ 等级 +1
 │    └─ 经验 -= 门槛
 └─ 发 `cultivated`（kind:'exp'）事件 → Trigger kind `cultivated` 侦测、UI 刷新
```

## 突破（breakthroughStar）

- 消耗该差分碎片（按 `starCost`）→ 星级 +1（上限 `starMax`）；
- `checkBreakthrough(variantId)` 只读判定当前是否可突破；
- 完成后发 `cultivated`（kind:'star'）。

## 统计 / 事件

- 每级推进经单一写入口同步记统计；
- `cultivated` 事件统一承载升级（`kind:'exp'`）与突破（`kind:'star'`），负载含 `variantId`——事件名以 `EVENT_CATALOG` 登记为准。

## 相关文档

[[docs-828/04-mechanisms/gacha]] · [[docs-828/03-data-structures/declarative-dsl]] §5（`cultivated` Trigger kind）

