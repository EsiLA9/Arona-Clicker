# docs-824 — 04d 培养推进：经验曲线 / 突破

> 原文出处：`04-core-algorithms.md` 四章。`CultivateSystem.applyExp(variantId, exp)`。

## 曲线模型

```text
CurveDef = { levels: [{ level, exp, attachment }], ... }
resolveCurve(curveId, level) → 当前级与下一级节点（含经验门槛）
```

- 每条曲线为「等级 → 累计经验门槛」数组，逐级推进；
- `exp` 为累计值：当前级满足门槛即升级，多余经验结转下一级。

## applyExp 推进

```text
applyExp(variantId, exp)
 ├─ 取曲线 + 当前等级/经验
 ├─ 累计经验 += exp
 ├─ while 累计经验 >= 下一级门槛 && 等级 < maxLevel：
 │    ├─ 等级 +1
 │    ├─ 经验 -= 门槛
 │    └─ 应用该级 attachment（额外属性/奖励）
 └─ 发 cultivated（kind:'exp'）事件 → UI 刷新 ==new==（原 `expApplied` 不存在）
```

## 突破（breakthroughStar）

- 达到曲线顶（满级）后解锁突破：消耗资源 → 星级 +1 → 曲线重新开放（新曲线段）；
- `checkBreakthrough(variantId)` 只读判定当前是否可突破。

## 统计 / 事件

- 每级推进同步记统计（`statsService.record` 培养相关指标）；
- `cultivated` 事件（升级 `kind:'exp'` / 突破 `kind:'star'`）驱动 UI 动画与通知。==new==（原 `expApplied`/`starUpgraded` 不存在，统一为 `cultivated`）

---

上一篇：[[docs-824/04c-gacha]] · 下一篇：[[docs-824/04e-color-derivation]]