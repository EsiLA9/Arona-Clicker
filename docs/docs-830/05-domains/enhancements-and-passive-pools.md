# docs-830/05-domains/enhancements-and-passive-pools — 强化与被动剧情池

本文回答：强化如何解锁产品功能，被动剧情池如何从可用入口中选择候选。

## Enhancement：可购买的功能解锁

`EnhancementService` 从 Registry 读取定义，购买前依次校验定义存在、尚未持有、当前可见、解锁条件满足和资源充足。通过后扣除费用并登记解锁；`autoApply` 定义的效果随后交给 `EffectEngine`。强化获得事件驱动可见性增量刷新。移除时还会检查定义是否标为不可逆，并在成功后复核可见性与 Affector。

强化不仅是一个解锁标记。`SpotFunctionalitySystem` 会把已解锁 Enhancement 的标签功能与 Spot 自身功能合并，供商店、地图等服务按功能类型查询。功能声明和实际消费分属两层。

## PassivePool：候选过滤与加权选择

`PassivePoolSystem.pick()` 遍历池树，将父子权重相乘，为叶子 StoryEntry 形成候选。池门禁条件、owner、故事资格、阻断状态和冷却都会过滤候选；最终按累计权重随机选一个入口。没有正权重候选时返回 `null`。

池条件使用 `ConditionDepIndex` 追踪依赖的状态事件，只在相关依赖变化后重算缓存门禁；`poolGateChanged` 表示池可用状态发生了变化。池选择结果仍需交给 `StoryService` 启动会话，故事会话本身负责推进。

源码入口：`src/arona-clicker/services/progression/enhancement-service.ts`、`services/world/spot-functionality.ts`、`services/economy/passive-pool-system.ts`。相关测试见 `tests/engine/global-enhancement.test.ts`、`tests/engine/passive-pool.test.ts`、`tests/engine/spot-functionality.test.ts`。

相关流程：[[world-and-spots]]、[[story-and-effects]]、[[state-and-events]]。

## 两类声明解决不同问题

| 机制 | 输入 | 结果 | 不负责 |
| --- | --- | --- | --- |
| Enhancement | 定义、购买条件与当前资源 | 已解锁状态，以及可能应用的 Effects / Spot 功能声明 | 不替商店或地图跳过自身准入。 |
| PassivePool | 树形池、权重、门禁和 StoryEntry 资格 | 一个候选 StoryEntry 或 `null` | 不自行推进剧情会话。 |

Enhancement 的定义不等于已持有，功能声明也不等于该功能必然可以在当前状态执行。购买检查当前可见性、解锁条件及资源；不可逆定义在获得后不允许撤回。`tests/engine/global-enhancement.test.ts` 同时覆盖可移除后重新购买和不可逆拒绝。

## 示例：有门禁的被动池

可以把池想成多层目录：系统沿每条有效路径合并父子权重；某个父池门禁失败时，该分支整体不进入候选。剩下的叶子还要满足 owner、StoryEntry 资格、阻断和冷却等条件。只有正权重候选参与最终随机选择；全部被过滤时返回 `null`，而不是强行启动某个故事。

`tests/engine/passive-pool.test.ts` 的“路径权重连乘”覆盖门禁剪枝；“叶子资格谓词剪除后无候选”覆盖 `null`。另有 owner 隔离及冷却恢复测试。池选择与实际剧情运行的边界见 [[story-and-effects]]。

`ConditionDepIndex` 用于标记需要重新计算的池门禁，相关状态事件到来时可更新；它不把所有事件都视为新剧情，也不替代最终选择时的资格检查。
