# docs-824 — 04b 生产结算：GameNumSystem 数值树

> 原文出处：`04-core-algorithms.md` 二章。生产 = 数值树求值 + zone 聚合，见 `[[src/engine/expression/game-num.ts]]`。

## GameNum 数值树

- 节点种类：`add/sub/mul/div/min/max/pow/clamp/floor/ceil/round/cond/const/expr/ref/zone`；
- `valueSystem.evaluate(node, state)` 纯递归求值（`game-num-eval.ts`）；
- 节点带 `dirty/cached`：父节点失效沿 `parents` 反查表向上传播（局部失效）。

## 构建（buildAll）

```text
buildAll(state)
 ├─ 资源 → gain 树：baseYield + tagMultiplier(mul 区) + 全局累加（GlobalProducedAmount）
 ├─ spot → 产出子树（含所属 Area/Init 的逐级上抛，parents 链）
 ├─ zone 节点（每个 tagKey/entityKey 建 flat/mul 两个，zoneIndex 登记）
 └─ 命名数值（named，register 注册）
```

## zone 聚合（命名乘区）

- `tagMultiplier` = 该 tag 的 mul 区求值结果（`zone` 节点）；
- 注册 TagEffect/EntityEffect → 路由进对应 zone 节点的 `childMulMap`（flat 贡献 / mul 乘数 / bound 夹取）；
- Affector 的 `zoneModifiers` 由 `syncAffectorZoneEffects` 每帧同步进区表（见 [[docs-824/04f-trigger-effect]]）。

## 失效策略

| 触发 | 动作 |
| --- | --- |
| enhancement/tag/level/manager 变化 | `invalidateProduction()` 全树 dirty |
| 帧内产出 | 不清树，仅数值更新 |
| spotTagChanged | 重建 zoneIndex 反路由 + 失效 + 重同步 Affector |

## 求值入口

- `evaluateResourceGain(res)` / `evaluateSpotYield(spotId)` / `getSpotMultiplier(spotId)`；
- 每帧 TickSystem 调用 `evaluateResourceGain` 结算。

---

上一篇：[[docs-824/04a-state-mutation-pipeline]] · 下一篇：[[docs-824/04c-gacha]]