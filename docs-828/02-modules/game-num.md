# 02-modules/game-num — 统一数值系统（产出树）

> 一句话：每资源一棵**四级层级产出树**，事件驱动增量失效；是生产结算的唯一数值真相。

## 职责边界

- **管**：`primitiveGain` 树构建/求值/缓存、zone 命名乘区区表维护、Affector flows/zoneModifiers 桥接、定向失效。
- **不管**：资源入账（TickSystem 经 mutations）、Affector 生命周期（只订阅其事件）。

## 关键文件（`src/engine/expression/`）

| 文件 | 职责 |
| --- | --- |
| `game-num.ts` | `GameNumSystem` 门面：构造注入 + 事件订阅（含构造期自订阅 4 个 affector 事件，T7 后单向依赖）+ 求值入口 `evaluateResourceGain` / `evaluateSpotYield` |
| `game-num-build.ts` | `buildAll`：显式四级层级树构建（`primitiveGain → initFull → areaFull → spotFull`）+ flows 按 `mountEntityId` 层级分发 + zone 节点共享去重（模块内 `WeakMap`）+ `gainResourceDeps` 静态扫描 |
| `game-num-eval.ts` | `evaluateGameNum`：递归求值（两级缓存 + `dirty/cached` 脏位）+ `scanActiveFlows` |
| `game-num-tag.ts` | 区表维护：TagEffect/EntityEffect 路由、Affector modifier 桥接（`registerAffectorModifier`）、脏位传播（`markDirty`/`markSubtreeDirty`/`markZoneDirty`） |
| `game-num-internal.ts` | 内部共享类型（ZoneNode / ZoneIndexEntry） |
| `tag-effect.ts` | `TagEffectRecord` / 区表记录结构（`state.tagEffects` / `state.entityEffects` 是唯一真相） |

## 核心概念

- **四级树公式**：`primitiveGain = globalProduct×globalMulZone + globalFlat + globalFlows`；`initFull = (Σ areaProduct) × initMulZone + initExtra`；area / spot 同构。乘区只乘下一级 base 链，逐级连乘。
- **节点 kind**（9 种）：`add / sub / mul / const / expr / owned / levelLinear / zone / affectorFlows`；通用算术经 `expr` 下沉 `ValueExpression`。
- **事件驱动失效**：`resourceChanged` 三路定向（依赖子树向下 + 区表 + flows 向上）；其余变化全树 `invalidateProduction()`；tick 不再每帧失效。
- **区表真相在 state**：`state.tagEffects` / `state.entityEffects`；Affector 的 `zoneModifiers` 由事件驱动 `syncAffectorZoneEffects` 并入（不再每帧全量重建）。

## 测试入口

`tests/engine/game-num*.test.ts`（5 个）、`tests/engine/affector-reconcile.test.ts`

## 相关文档

[[docs-828/04-algorithms/production]]（构建/失效全细节）· [[0x-plan&work/completed/adr-0002-gamenum-tree]]（决策记录）· [[docs-828/02-modules/affector]]
