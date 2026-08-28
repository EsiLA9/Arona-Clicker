# docs-824 — 04b 生产结算：GameNumSystem 数值树

> 原文出处：`04-core-algorithms.md` 二章。生产 = 数值树求值 + zone 聚合，见 `[[src/engine/expression/game-num.ts]]`。

## GameNum 数值树

- 节点种类：`add/sub/mul/const/expr/owned/levelLinear/zone/affectorFlows`（Phase 3 收敛双表达式系统：删 `div/min/max/pow/clamp/floor/ceil/round/cond/ref` 9 类算子，一元/二元运算统一由 `ValueExpression` 经 `expr` 叶子承载）==new==；
- `valueSystem.evaluate(node, state)` 纯递归求值（`game-num-eval.ts`）；
- 节点带 `dirty/cached`：父节点失效沿 `parents` 反查表向上传播（局部失效）。

## 构建（buildAll）==new==

Phase 6 起为**显式四级层级树**（每资源一棵，`game-num-build.ts` 构造；旧「baseYield + tagMultiplier + 全局累加」隐式上抛结构废止）：

```text
primitiveGain:<res> = globalProduct(×globalMulZone) + globalFlat + globalFlows
initFull  = (Σ areaProduct) × initMulZone + initExtra
areaFull  = (Σ spotProduct) × areaMulZone + areaExtra
spotFull  = spotBase × spotMulZone + spotExtra
```

- **乘区只乘下一级 base 链**：spotProduct / areaProduct 进上级 base 和，逐级连乘（旧 hierarchy 组内相加语义废止）；
- **flat/flows 不进乘区**：spotFlat 经 `spotFlatGated`（owned 门控）进 spotExtra；flows 不受 owned 门控；
- **spot 子树在所有资源树统一构建**：非本资源树 spotBase 恒 0（const），仅承载跨资源 flows；孤儿 spot（registry 无 area/init 链）base 链直挂根；
- **flows 按 mountEntityId 层级分发**（`ensureFlowsNodes` 幂等创建）：spot → spotExtra；area/init → 各自 Extra；enhancement/item 等非层级实体 → 资源树根 global 兜底节点；
- zone 节点：scope × part（flat/mul）；无 resource 限定的 zone 节点（global/area/init scope）跨资源树共享，去重表为 build 模块内部 `WeakMap`（Phase 7 起不再是 GameNumSystem 公开字段）；spot scope 节点带 resource 限定按树独立；
- 构建收尾静态扫描 `gainResourceDeps`（resourceChanged 定向失效的数据基础）。

## zone 聚合（命名乘区）

- `zone` 节点求值 = `aggregateZone` 扫描 state 区表（`state.tagEffects` / `state.entityEffects` 唯一真相，见 [[docs-824/03c]]）；
- TagEffect/EntityEffect 注册 → 写 state 区表；
- Affector 的 `zoneModifiers` 由 `syncAffectorZoneEffects` 在挂载/翻转/世界线切换时同步进区表（**不再每 tick 全量重建**，见 [[docs-824/04f-trigger-effect]]）==new==。

## 失效策略（Phase 5 事件驱动）

| 触发 | 动作 |
| --- | --- |
| resourceChanged | 定向：`gainResourceDeps` 子树 `markSubtreeDirty`（向下）+ 区表依赖 `markZoneDirty` + flows 节点 `markDirty`（向上） |
| enhancement/tag/level/manager/extra 变化 | `invalidateProduction()` 全树 dirty |
| Affector 状态翻转 / activeEntryIds 变化 | `notifyGameNum` → 重同步区表 + flows 节点 `markDirty` |
| spotTagChanged | 重建 zoneIndex 反路由 + 失效 + 重同步 Affector |
| 帧内产出 | 不清树，仅数值更新 |

- `markDirty` 沿 parents 向上传播；`markSubtreeDirty` 沿 children 向下（resourceChanged 定向失效需两者配合）。
- tick 不再每帧失效：未受影响的 gain 子树跨帧保持缓存；直接改 state 的调用方必须走 StateMutationService，否则陈旧读。

## 求值入口

- `evaluateResourceGain(res)` / `evaluateSpotYield(spotId)`（层级视图含自身 flat/flows）；
- `getSpotMultiplier` 已删（Phase 6）：UI 读数改经 `buildZoneNode({kind:'spot',id},'mul',resource)` + `evaluate` 精确读 spot 自身 mul 区 ==new==；
- 每帧 TickSystem 调用 `evaluateResourceGain` 结算。

---

上一篇：[[docs-824/04a-state-mutation-pipeline]] · 下一篇：[[docs-824/04c-gacha]]