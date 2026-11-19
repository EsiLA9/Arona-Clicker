# docs-830/03-engine/affectors-and-contributions — Affector 生命周期与贡献

本文回答：Affector 如何挂载到运行对象、响应条件变化，并影响持续产出。

## 实例与状态

`AffectorEngine` 从 AffectorPackDef 取得条目，为物品、Enhancement、Spot 等宿主挂载运行实例。每个实例有 `Active`、`Latent` 或 `Removed` 状态；Pack 条件满足的 entry 组成当前有效集合。Registry / 状态整体重建时，`reconcileMounts()` 根据当前库存、解锁状态和 Spot 功能对账补挂或卸载实例。

```text
宿主与 Pack → 挂载实例 → 条件求值 → Active / Latent
                           ├─ Active entry.effects：激活沿执行一次
                           ├─ perTickEffects：每次 Tick 执行
                           └─ flows / zoneModifiers：贡献到 GameNum
```

## 条件新鲜度与更新

Affector 条目的条件登记到共享 `ConditionDepIndex`。相关资源、Spot 等级、标签、物品或角色进度事件命中时，只重新检查受影响实例。包含 `stat` 或未知 target 的条件进入轮询集合，在 Tick 时复核。`Active` 翻转、entry 集变化或 Pack 替换后，AffectorEngine 发出包含受影响实例 ID 的事件。GameNumSystem 按来源更新 zone 记录和 flow 贡献，仅使涉及的节点失效。

普通 `effects` 在实例由非 Active 转为 Active 时执行一次。读档重建与同 ID 热替换只更新条件、持续贡献及每帧效果的登记，跳过激活发奖。每帧只遍历有 `perTickEffects` 的活跃条目。数值贡献使用 `flows` 和 `zoneModifiers`，由 GameNumSystem 按需求值。`setSpotMaxLevel` 等声明型 Effect 由宿主按当前实例动态查询。

## 一次激活与持续贡献的区别

测试 `addResource grants once on Latent→Active edge` 使用一个条件为 `credit >= 10`、激活时加 1 credit 的 entry：

1. 起初条件不满足，实例为 `Latent`，没有发放奖励。
2. credit 变成 10 并复核后，实例转为 `Active`，一次性效果将 credit 改为 11。
3. 保持 Active 时再次复核或应用活动效果，不会再次执行这条普通激活效果。
4. 条件转为不满足再满足时，会发生新的 Latent→Active 转换，因此再次发放。

这表示“每次进入 Active 执行一次”，不是“整个存档只能执行一次”。如果挂载时条件已经满足，测试显示效果会在挂载激活时执行；被移除的实例不再重新激活。相关测试：`tests/engine/core/affector-engine.test.ts`。

| 内容 | 发生时机 | 用途 |
| --- | --- | --- |
| `effects` | 非 Active 转为 Active | 激活时的一次性动作 |
| `perTickEffects` | 当前 entry 活跃时的 Tick | 每帧效果 |
| `flows` / `zoneModifiers` | 由 GameNum 计算时读取当前贡献 | 持续产出及乘区 |

排查某个产出未更新时，先确认宿主是否挂载和条件是否满足，再区分它属于激活动作还是 GameNum 持续贡献；不要仅凭界面数值判断实例已经卸载。

源码：`src/engine/effect/affector-engine.ts`、`src/engine/expression/condition-deps.ts`、`src/engine/expression/game-num.ts`、`src/arona-clicker/runtime/runtime-wiring.ts`。测试：`tests/engine/core/affector-engine.test.ts`、`tests/engine/core/affector-reconcile.test.ts`、`tests/engine/core/affector-text.test.ts`。

条件与依赖索引见 [[conditions-and-visibility]]；产出树见 [[expressions-and-production]]。
