# 02-modules/affector — Affector 持续效果

> 一句话：`AffectorEngine` 管理「挂载即持续生效」的效果实例——四条通道（激活沿 / perTick / flows / zoneModifiers），实例不落存档、靠 `reconcileMounts()` 对账。

## 职责边界

- **管**：`AffectorPackDef` 注册、实例生命周期（Latent→Active→Removed）、四通道执行、与 GameNum 区表的桥接信号。
- **不管**：数值求值（GameNum 惰性查询）、状态写入（经 mutations）。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `effect/affector-engine.ts` | `AffectorEngine`：pack 注册（同 id 后注册覆盖）/ `mount`（幂等，已存在只 recheck 不重建）/ `recheck`（条件翻转执行激活沿 `effects`）/ `applyActiveEffects`（每帧只跑 `perTickEffects`）/ `reconcileMounts()`（按 inventory / enhancements / spotLevels 对账，接线 init / enterInit / restoreFromSave / reset）/ `getSpotMaxLevelOverrides`（缓存） |
| `effect/affector-text.ts` | Affector 文本/描述解析（穷尽式 switch + `never` 守卫，值得推广的模式） |
| `expression/game-num-tag.ts` | 桥接终点：`registerAffectorModifier` 把 zoneModifiers 并入区表 |

## 四通道语义（数据作者必读）

| 通道               | 时机                             | 用途                                                                         |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `effects`        | **仅激活沿**（Latent→Active 翻转）执行一次 | 一次性奖励（`addResource` 发放、setFlag/addItem 等）；声明类 op 不执行                       |
| `perTickEffects` | Active 期间每帧                    | 仅限幂等/维持类 op                                                                |
| `flows`          | 激活期间每帧经 GameNum 懒求值            | **唯一持续产出通道**（Spot `linearYield` 即转译为 flow）；Phase 6 起按 `mountEntityId` 层级分发 |
| `zoneModifiers`  | 事件驱动同步进区表                      | 命名乘区（flat/mul/custom/bound），见 [[docs-828/04-mechanisms/trigger-effect]]    |

- ⚠️ **双通道警告**：`flows` 与 `effects[addResource]` 并存 = 激活沿发一次 + 每帧持续入账 = **双倍**。数据作者二选一。
- **依赖方向**（T7）：Affector 只发事件（`affectorMounted/StateChanged/Unmounted/EntriesChanged`），GameNum 构造期自订阅重同步区表——不再互持。

## 测试入口

`tests/engine/affector-engine.test.ts`、`affector-reconcile.test.ts`、`affector-text.test.ts`

## 相关文档

[[docs-828/04-mechanisms/trigger-effect]] · [[docs-828/02-modules/game-num]] · 评审历史见 [[0x-plan&work/completed/adr-0002-gamenum-tree]]
