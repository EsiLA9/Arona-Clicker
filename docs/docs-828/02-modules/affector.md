# 02-modules/affector — Affector 持续效果

> 一句话：`AffectorEngine` 管理「挂载即持续生效」的效果实例——四条通道（激活沿 / perTick / flows / zoneModifiers），实例不落存档、靠 `reconcileMounts()` 对账。

## 职责边界

- **管**：`AffectorPackDef` 注册、实例生命周期（Latent→Active→Removed）、四通道执行、与 GameNum 区表的桥接信号。
- **不管**：数值求值（GameNum 惰性查询）、状态写入（经 mutations）。

Spot 的 `flow`（常量或数值表达式）与 `linearYield`（`amountPerLevel`，可选 `startLevel`）都会在运行时转译为自己的 Affector pack，并以 `mountEntityId=spotId` 挂载。这样一个 Spot 可以同时提供多种资源、各自不同的数量；`linearYield` 的表达式读取该 Spot 自身等级。Spot-mounted flow 在等级为 0 时由 GameNum 门控，不会因为残留实例而产出。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `effect/affector-engine.ts` | `AffectorEngine`：pack 注册（同 id 后注册覆盖）/ `mount`（幂等，已存在只 recheck 不重建）/ `recheck`（条件翻转执行激活沿 `effects`）/ `applyActiveEffects`（每帧只跑 `perTickEffects`）/ `disposeRuntime()`（清理当前实例、条件依赖、轮询与派生同步记录）/ `reconcileMounts()`（按 inventory / enhancements / spotLevels 对账，接线 init / enterInit / restoreFromSave / reset）/ `getSpotMaxLevelOverrides`（缓存） |
| `effect/affector-text.ts` | Affector 文本/描述解析（穷尽式 switch + `never` 守卫，值得推广的模式） |
| `expression/game-num-tag.ts` | 桥接终点：`registerAffectorModifier` 把 zoneModifiers 并入区表 |

## 四通道语义（数据作者必读）

| 通道               | 时机                             | 用途                                                                         |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `effects`        | **仅激活沿**（Latent→Active 翻转）执行一次 | 一次性奖励（`addResource` 发放、setFlag/addItem 等）；声明类 op 不执行                       |
| `perTickEffects` | Active 期间每帧                    | 仅限幂等/维持类 op                                                                |
| `flows`          | 激活期间每帧经 GameNum 懒求值            | **唯一持续产出通道**（Spot `flow` / `linearYield` 均转译为 flow）；Phase 6 起按 `mountEntityId` 层级分发 |
| `zoneModifiers`  | 事件驱动同步进区表                      | 命名乘区（flat/mul/custom/bound），见 [[docs/docs-828/04-mechanisms/trigger-effect]]    |
| `areaConnections` | Active 期间提供动态 Area 连通边          | 追加单向或双向 Area→Area 移动边；entry 失活/实例卸载后立即失效                         |

- ⚠️ **双通道警告**：`flows` 与 `effects[addResource]` 并存 = 激活沿发一次 + 每帧持续入账 = **双倍**。数据作者二选一。
- **依赖方向**（T7）：Affector 只发事件（`affectorMounted/StateChanged/Unmounted/EntriesChanged`），GameNum 构造期自订阅重同步区表——不再互持。
- **动态连通性**：`entry.areaConnections` 是 Affector 的声明通道，不修改 `AreaDef.adjacentAreaIds`。默认 `oneWay`，`twoWay` 同时开放反向边；移动仍要求目标 Area 存在、属于当前 Init 且满足 `existence` 可见性。多个活跃 Affector 的边取并集。

## 测试入口

`tests/engine/affector-engine.test.ts`、`affector-reconcile.test.ts`、`affector-text.test.ts`

## 相关文档

[[docs/docs-828/04-mechanisms/trigger-effect]] · [[docs/docs-828/02-modules/game-num]] · 评审历史见 [[adr-0002-gamenum-tree]]
