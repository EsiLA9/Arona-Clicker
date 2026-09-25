# Task：Reveal Condition / Event Coverage Audit

状态：done — 只读核验完成；17 个 ConditionTarget 已分别记录 DepIndex、EB-T、activation/invalidation 覆盖及首期建议

## 目标

在开始 EB-T-Reveal 首个消费者切片前，核实 Reveal 条件从状态变化到事件派发的真实覆盖情况，形成 `Condition dependency → state mutation/event → ConditionDepIndex → TriggerEventDef` 对照矩阵，并据此建议首期支持、限制或暂缓的条件目标。

本 Task 只查代码、测试与现有内容事实；不修改源码、数据包、Schema 或运行时行为。

## 设计边界

- Task A（[[task-0144-trigger-runtime-registration-withdrawal]]）已完成并封板；本审计不修改 RegistrationKey、Token、group/tag、once 或 dispatch revalidation 契约。
- 按三条状态轴区分审计对象：`existence` 属于动态 Visibility；`name`、`condition`、`utility` 属于信息 Reveal 的首期候选；`unlock` 属于实时可达性。需盘点所有 RevealTrigger target，但分开标注语义归属，不将它们合并成一个进度状态机。
- 审计 `Condition` 与嵌套 `ConditionGroup` 的所有 `ConditionTarget`。同时区分“引擎允许声明的目标”与“当前 Reveal 内容实际使用的目标”。
- “有同名事件类型”不等于已覆盖。必须沿真实状态写入路径核实 Event 的发出时机、payload 过滤字段、状态转换边沿和遗漏情形。
- 分别记录 ConditionDepIndex 的失效覆盖和 EB-T TriggerEventDef 的监听覆盖。ConditionDepIndex 的事件失效能力不能推定 EB-T 已具备相同唤醒能力。
- 对每个 ConditionTarget，`DepIndex` 与 `EB-T` 必须各自独立给出覆盖结论，不合并成一个“覆盖”字段。统一状态词为：`complete`（所有会改变该条件结果的受支持状态写入都有状态提交后的真实事件，且事件/过滤足以定位需重算候选，无已知 false-negative）、`partial`（存在有效事件链，但至少一种合法写入、重置、作用域变化或过滤情形不能可靠唤醒）、`uncovered`（当前没有足以可靠重新求值的事件链）、`admission-only`（适合在准入/显式 reconcile 时检查，但没有必要或没有能力依靠运行期事件持续唤醒）。每个维度都需解释其判断依据。
- 信息 Reveal 单独记录 `false→true` activation coverage 与 `true→false` invalidation coverage。Sticky Reveal 的首要支持判据是 activation coverage；invalidation 缺失不自动使它判为不可用，但动态 Visibility 仍需单独按双向行为判定。
- Condition / ConditionGroup 的 Event 覆盖表示“重新求值覆盖”，不表示将条件逻辑编译为 Trigger 逻辑。任何可能改变叶子真值的 dependency event 都唤醒整个候选；ConditionSystem 仍对完整 AND/OR 树求值。
- 形成事实性的 `ConditionWakeProfile` 审计表，至少记录 target、DepIndex 覆盖、EB-T 覆盖、activation/invalidation events、过滤精度与限制。它只是本次审计产物，不实现 API，也不预设通用 dependency→wake 架构。
- 不实现 dirty/cache、依赖订阅 adapter、新 TriggerEventKind、Typed Runtime Action 或 Reveal adapter；不以 tick 轮询作为默认兜底方案。
- 审计结果只给出证据与首期建议，不在本 Task 中冻结 RevealProgress、Prerequisite、WatchScope/ProgressScope 或最终唤醒架构。

## 当前核验基线

- `ConditionTarget` 在 `src/engine/types/expression.ts` 声明 17 种目标。
- 条件依赖反向索引位于 `src/engine/expression/condition-deps.ts`；其 `STAT_DEP_EVENTS` 与 `ConditionDepIndex.addLeaf()` 决定当前失效行为，未知或未显式分支的目标可能走 stat 宽依赖。
- EB-T 的事件触发定义及事件匹配位于 `src/engine/types/trigger.ts` 与 `src/engine/effect/trigger-system.ts`。审计应以源码映射和真实事件 producer 为准，不以文档中的事件数或表格替代核验。
- `RevealTrigger` 定义在 `src/engine/contracts/reveal.ts`；当前 Reveal 与 Visibility 的边界及 EB-T-Reveal 目标方向见 [[draft-0143-trigger-runtime-registration-withdrawal]]。

## Read Set

- `docs/docs-828/00-INDEX.md`
- `docs/docs-828/02-modules/visibility.md`
- `docs/docs-828/02-modules/effect-trigger.md`
- `docs/docs-828/03-data-structures/declarative-dsl.md`
- `docs/docs-828/04-mechanisms/trigger-effect.md`
- `docs/docs-828/04-mechanisms/state-mutation.md`
- `docs/docs-828/05-conventions/architecture-discipline.md`
- `docs/docs-828/05-conventions/testing.md`
- `docs/plan-work/draft-0143-trigger-runtime-registration-withdrawal.md`
- `src/engine/types/expression.ts`
- `src/engine/types/reveal.ts`（如该出口存在，以 `src/engine/contracts/reveal.ts` 的类型定义为准）
- `src/engine/types/trigger.ts`
- `src/engine/contracts/reveal.ts`
- `src/engine/expression/condition-system.ts`
- `src/engine/expression/condition-deps.ts`
- `src/engine/effect/trigger-system.ts`
- `src/engine/effect/event-driven-reactor.ts`
- `src/engine/core/event-bus.ts`
- `src/arona-clicker/contracts/event-catalog.ts`
- 对应条件目标的 `StateMutationService` 与领域写入方、事件 producer
- 默认内容及仓库数据包中实际包含 `revealTriggers` 的内容文件
- 相关 Condition、Reveal、Visibility 与 Trigger 测试

## 执行步骤

1. 从 `ConditionTarget` 类型建立完整目标清单；扫描默认内容及仓库内可运行数据包，按实体类别和 RevealTarget 记录实际使用的条件目标。区分引擎能力与内容样本，不把测试 fixture 误计为正式默认内容。
2. 对每个目标核实 condition key/value 的含义、读取状态来源、嵌套 ConditionGroup 展开方式，以及 `ConditionSystem.evaluateExpr()` 的实际求值路径。
3. 逐目标追踪状态写入方：确认 mutation/API、发出的真实 GameEvent、事件触发时状态是否已提交、payload 是否携带精确实体 key，以及重置、离开作用域或跨 Run 变化是否另有事件。
4. 记录 ConditionDepIndex 为该目标登记的依赖及 `affected(event)` 命中范围；特别标明 stat/未知目标的宽失效、全局候选以及没有登记依赖的目标。
5. 对照 TriggerSystem 的 `ON_KIND_TO_EVENT` 与 `matchesEvent()`，核实 EB-T 是否可监听对应真实事件、过滤粒度是否足够、多个状态变化是否会漏唤醒；分别判断 false→true 与 true→false。
6. 对每个目标分别为 DepIndex 与 EB-T 标注 `complete`、`partial`、`uncovered` 或 `admission-only`，附源码路径和必要的测试/内容证据。另给出 activation/invalidation 覆盖，不能用双向合并状态掩盖 sticky Reveal 可用性。
7. 汇总 Reveal 首期建议：哪些信息 target/Condition 可以安全进入首期；哪些需限制 ConditionTarget 子集；哪些需先扩展真实事件或另建依赖唤醒协议；哪些目标留在 Visibility/Unlock 域。
8. 将矩阵、证据、限制、推荐结论及未决问题写入本 Task 的“审计结果”与“当前核验”；更新 `docs/plan-work/00-index.md` 状态。不得顺带实施后续 Domain Model 或 Trigger 改造。

## 覆盖矩阵

执行时逐项填写 `ConditionTarget` 全集，并为实际出现于 Reveal 内容的组合补充实体与 RevealTarget 信息。

| ConditionTarget / RevealTarget | 状态来源与 key 语义 | 当前状态写入方与真实事件 | DepIndex：状态 / 事件 | EB-T：状态 / 事件 | Activation `false→true` | Invalidation `true→false` | 过滤精度 / 证据与限制 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `alwaysTrue` | 常量 `1`；无状态 key | 无写入；无事件 | `admission-only`：登记为空依赖 | `admission-only`：事件到达才运行 Trigger；不应为常量制造事件 | 准入时可直接为真 | 无回退 | none；Admission 查询即可处理 |
| `resource` | `resources` / `globalResources[key]`；资源 ID | `StateMutationService.changeResource/setResource` 写后发 `resourceChanged(resource, delta, newValue)`；Init 切换也会替换当前资源投影并发 `initEntered` | `partial`：按资源精确索引 `resourceChanged`，但不命中 per-Init 投影切换的 `initEntered` | `complete`*：`resource` 精确监听增减；另以 `init` 监听范围切换 | complete：资源增减及 Init 准入可唤醒 | complete：正负 delta 均发事件；Init 切换同样可唤醒 | exact + init scope broad；`TriggerEventDef` 单条只接受一种 kind，Watch 需物化两个事件 Registration |
| `spotLevel` | `spotLevels[spotId]`；SpotId | `setSpotLevel` 与原子 Spot/Shop transaction 提交后发 `spotLevelChanged(oldLevel,newLevel)`；Init 切换恢复局部 Spot 时发 `initEntered` | `partial`：SpotId 精确事件完整，但不命中 Init 切换恢复的等级变化 | `complete`*：`spotLevel(spotId)` + `init` 可覆盖运行变化与局部快照切换 | complete：等级增加/进入 Init 都可到达阈值 | complete：降级/离开作用域事件可唤醒 | exact + init scope broad；Spot Def 热替换另走重建/reconcile |
| `manager` | `spotManagers[spotId]` 是否为 `none` | `setManager` 写后发 `managerChanged(spotId,newManager)`；Init 切换会清理/恢复局部经理并发 `initEntered` | `partial`：索引 `managerChanged`，但不监听 Init 切换 | `partial`：EB-T 没有 manager kind；`init` 只能覆盖范围重建，普通换经理无 TriggerEventKind | partial：准入/切 Init 可发现，运行中改派无人唤醒 | partial：同左；没有经理撤销专用事件能力 | Dep exact；EB-T direct filter none，只有 init coarse |
| `flag` | `flags[key]` 是否非空；比较值 0 特判“缺失/空” | `setFlag` 写后发 `flagChanged(flag,value)`；flags 为 per-Init，切换发 `initEntered` | `partial`：精确 `flagChanged`，漏掉当前 Init 投影切换 | `partial`：无 flag kind；`init` 仅覆盖 Init 切换，不覆盖运行中写入 | partial：写标志时无 EB-T 唤醒 | partial：无清旗标 API，但写空值可改变结果且同样无 EB-T 唤醒 | Dep exact + Init gap；EB-T none + init broad |
| `hasEnh` | `unlockedEnhancements.includes(enhancementId)` | `addEnhancement/removeEnhancement` 写后发 `enhancementAdded/Removed`；状态可按 Init 切换 | `partial`：精确 add/remove 事件，漏 Init 作用域重建 | `partial`：没有 enhancement kind；`init` 只覆盖 Init 切换 | partial：获得强化没有 EB-T 唤醒 | partial：移除强化没有 EB-T 唤醒 | Dep exact；EB-T direct none，init broad |
| `hasTag` | 当前定义具有 Tag 且已拥有的 Spot 数 `>0`；TagPath | Spot 等级跨 0、`applySpotTagChange` 的 `spotTagChanged`；Def/Registry 热变更走定义事件与可见性重建 | `partial`：Tag 倒排索引处理 `spotTagChanged` 与等级 0 边沿；定义替换/Init 投影变更需显式重建 | `partial`：`spotLevel` 覆盖拥有沿；无 Tag 或 Spot 定义变化 kind | partial：买入已拥有 Spot 可唤醒；纯加 Tag/换定义不能 | partial：移除 Tag/售出 Spot 部分可唤醒，定义替换缺口 | Dep Tag 精确；EB-T spotLevel 精确、Tag/Def none |
| `countTags` | 具有 Tag 且已拥有的 Spot 数量 | 与 `hasTag` 同源；计数变化由 Tag 覆盖变化或 Spot 拥有沿产生 | `partial`：同 `hasTag`，目标计数会被两种状态源改变 | `partial`：只支持 spotLevel，缺 spotTagChanged/Def 变更 | partial | partial | 同 `hasTag`；OR/AND 仍整组重算 |
| `tagCount` | `TagStatService` 的 `<kind>:<tagDisplay>` collected 集数量 | `tagCollectedChanged(kind)` 由收集集实际变化发出；来源含 Init/Area/Spot/角色/强化/故事；状态全量替换与索引重建静默 | `partial`：按 kind 宽命中可覆盖增量事件；重建静默且 TagDef/Registry 改变需 reconcile | `partial`：无 tagCollected kind；底层有些来源可用 spot/area/story/character/init 事件，有些（强化、Init 解锁、收集索引重建）不能由单一匹配覆盖 | partial：部分收集沿能唤醒 | partial：Spot/强化移除等部分撤回能唤醒，静默重建不行 | Dep broad per kind（不是 tag 精确）；EB-T 多源、部分缺口；非 Reveal 当前内容目标 |
| `stat` | 由 Stat DSL 注册函数读取 global/currentRun/Init 统计项 | `StatsService` 由资源、物品、Spot、强化、剧情、Init、帧数等多个写路径同步记账 | `partial`：`statDeps` 宽失效命中 `STAT_DEP_EVENTS`；缺 `tick`（frames）、`characterAcquired`、`shopPurchased` 等可改统计的来源 | `partial`：多种事件 kind 可各自唤醒，但单 Trigger 仅一种；没有通用 StatChanged；tick 轮询不作为本 Task 的默认方案 | partial：当前内容用 Global/Run Produced/UnlockedInits，有部分事件可覆盖，Tick frame 与其他统计不全 | partial：累计量多单调；Run/Init 切换和重置需额外准入，普通派发不能代表回退 | Dep broad all candidates；EB-T source-specific multi-kind only；实际 Reveal 内容频用此目标 |
| `hasReadStory` | `storyLog` 是否有 StoryId | `completeStory` 写日志后发 `storyCompleted(storyId)`；Init 快照切换也可能改变当前 storyLog | `partial`：StoryId 精确命中完成事件，漏 `initEntered` 投影切换 | `complete`*：`story(storyId)` 覆盖完成；`init` 覆盖范围投影切换 | complete：剧情完成事件精确可唤醒 | partial：Init 切换能失去当前可见记录；持久 sticky Reveal 不需回退 | exact story + broad init；需要两种 Watch 事件 |
| `hasReadStoryInRun` | `StatsService` 当前 Run 已完成集合 | `recordStoryCompleted` 更新后发 `storyCompleted`；新 Run/Init 重置统计投影时发 `initEntered` | `partial`：按 StoryId 完成事件索引，不监听 Run/Init 重置 | `complete`*：story completion + init admission | complete：故事完成路径有事件 | partial：Run 重建/重置时的回退按准入处理 | exact story + scope broad；不是永久事实 |
| `visitedStoryInChain` | 当前 `StoryCursorState.visitedStoryIds` 是否含 StoryId | 启动时 `storyTriggered`；`performJump` 直接追加 visited ID，不发事件；链结束清游标 | `partial`：有 storyTriggered/storyCompleted 宽依赖，但每次 jump 和 clear 无事件 | `partial`：仅 `storyCompleted` kind，不能观察 start/jump 的中间变化 | partial：start 有真实事件，jump 无事件 | uncovered by runtime event：cursor clear 无事件，completed 可能晚于变化 | broad story events；瞬态目标，不在当前 Reveal 内容用例 |
| `extra` | ConditionSystem 的 Extra 三层合并视图指定路径数值 | `setExtra/addExtra/removeExtra` 写后发 `extraChanged(path)`；Init Extra 快照/覆盖切换走 `initEntered` | `partial`：双向路径前缀匹配精确失效；漏 Init 范围变化/状态替换 | `partial`：无 Extra kind；`init` 仅覆盖准入范围变化 | partial：直接写可发 extraChanged，Init Extra 变化需 init | partial：删除/覆盖直接发事件，切 Init 缺口 | path 前缀双向 broad；EB-T none + init broad |
| `protoStat` | `protoStats[CharacterId].acquiredTotal` | `acquireCharacter` 递增后发 `characterAcquired(variantId)`；读档/重建无专用变化事件 | `uncovered`：该 target 落 stat fallback，但 `STAT_DEP_EVENTS` 不含 `characterAcquired` | `complete`*：`character` 无 variant filter 可接住所有 acquire；若按 VariantId 限制则需领域映射，payload 本身没有 protoId | complete：每次原型获得/重复获得都发 characterAcquired | admission-only：计数只增；整体状态替换由准入重建 | EB-T broad by kind；payload 是 VariantId，不能直接精确 proto 过滤 |
| `affectionLevel` | VariantId 当前好感等级（由 Roster 读取；Roster 是 Init 局部状态） | `addAffectionExp` 写进度后发 `characterProgressChanged(domain:'affection')`；Init 切换恢复/清除 Roster 后发 `initEntered` | `partial`：按 VariantId 精确索引 affection 事件，但不命中 Init 切换 | `partial`：`cultivated` 虽映射同事件，但 `matchesEvent` 只接 level/star；`init` 可覆盖作用域切换，普通好感变化无匹配 kind | partial：好感变化可使条件变真，但 EB-T 没有接受 affection domain 的 kind | admission-only for sticky value；动态回退的 Init 切换可用 `init` 唤醒，移除/重置写入仍需核实 | Dep exact；EB-T 无好感变化过滤能力；当前默认 Reveal 内容未使用 |
| `area` | `currentAreaId === areaId` | `InitService.travelToArea` 写 currentArea 后发 `areaEntered(areaId,fromAreaId)`；Init 进入时先发 `initEntered`，之后才赋默认 Area，且不补发 `areaEntered` | `partial`：stat 宽依赖包含 `areaEntered` 与 `initEntered`，但 Init 进入事件早于默认 Area 赋值 | `partial`：`area` kind 覆盖正常移动；`init` 事件早于 Init 默认 Area 赋值，之后没有对应事件 | partial：正常移动到目标 Area 可精确唤醒；首次/切换 Init 到默认 Area 需完成后的显式 reconcile | partial：正常离开目标 Area 可由新目的地事件唤醒；Init 切换时旧 Area 失效可能发生在 `initEntered` 之后且无 `areaEntered` | 目标 Area 精确过滤只覆盖正常进入；完整双向需 broad area event，并在 Init 准入完成后 reconcile；是动态位置目标 |

`ConditionGroup` 不增加新的 ConditionTarget 行；审计须记录 AND/OR 中所有叶子依赖，并说明候选的唤醒集合是叶子依赖事件的并集：任一可能改变叶子真值的事件都唤醒候选，随后重新求值完整 ConditionGroup。不得把 AND/OR 条件树编译成 Trigger 组合。

逐目标的 ConditionWakeProfile 是审计记录，不是运行时 API：

```text
target
DepIndex runtimeCoverage
EB-T runtimeCoverage
activationEvents (false→true)
invalidationEvents (true→false)
filterPrecision: exact | broad | none
limitations / evidence
```

## 验收标准

- 17 个 `ConditionTarget` 全部有审计结论；每个目标都分别给出 DepIndex 与 EB-T 状态，并区分 admission、false→true activation 和 true→false invalidation。
- 所有实际出现在默认内容和仓库正式数据包 RevealTrigger 中的条件，均记录实体类别、RevealTarget、条件目标与条件组关系。
- `complete`/`partial`/`uncovered`/`admission-only` 四种判定均按本 Task 定义执行，并分别用于 DepIndex 和 EB-T；每项结论追溯真实状态写入和事件 producer。
- 信息 Reveal 首期支持建议依据 activation coverage；单独报告 invalidation coverage，不能因 Sticky Reveal 不需要回退而误降级，也不能把双向不完整的依赖直接当成动态 Visibility 可用。
- 对 Condition/ConditionGroup 的事件结论代表完整表达式的重新求值唤醒覆盖；AND/OR 由 ConditionSystem 求真，未被编译为 Trigger 组合。
- 形成概念性的 ConditionWakeProfile 审计结果，可供后续 Reveal/Achievement/Milestone 等消费者复用；不新增代码 API。
- 对 EB-T 的覆盖结论以其 TriggerEventDef 匹配范围为准，指出 payload/filter 的精度、条件不为真的回退变化及缺失事件。
- 矩阵明确指出 ConditionDepIndex 宽依赖、未知目标 fallback 和 EB-T 事件面的差异；对无法从源码证明的链路标成不确定，不猜测。
- 结论提供首个 Reveal 消费者的可支持目标范围和缺口，不扩展 TriggerEventKind、不修改 ConditionDepIndex/VisibilityEngine/TriggerSystem/数据包/Schema。
- `npm run check:docs` 通过；本任务是只读审计，不要求也不运行测试套件。

## 审计结果

### 核验结论

ConditionSystem 会对完整 Condition/ConditionGroup 求值；`ConditionDepIndex.collectConditionLeaves()` 递归收集所有叶子，AND/OR 的唤醒集合因此是叶子依赖事件的并集。Event 只应触发整组重新求值，不能把 AND/OR 翻译成 Trigger 组合。

StateMutationService 的 `emit()` 在调用前已执行对应状态写入；核心状态路径可在 `src/arona-clicker/state/state-mutation-service.ts` 核对。正常 Area 移动是在写入 `currentAreaId` 后发 `areaEntered`。但 `InitService.enterInit()` 在写入默认 `currentAreaId` 之前就发 `initEntered`，后续默认 Area 赋值不会补发 `areaEntered`；因此仅凭 Init 事件不能可靠唤醒依赖新默认 Area 的候选。`TriggerSystem` 只订阅 `ON_KIND_TO_EVENT` 映射的类型，每个 `TriggerEventDef` 只有一个 kind；因此表中带 `*` 的 `complete` 需要 Adapter 对一个 Watch 物化多个 Registration（例如 resource + init），不是一条 Trigger 同时监听两种事件。一次事件只负责唤醒，Trigger 条件仍重新读取当前状态。

`ConditionDepIndex` 的 `statDeps` 是宽集合，不是每帧轮询：它只在 `STAT_DEP_EVENTS` 中列举的事件上命中。该集合不含 `tick`、`characterAcquired`、`shopPurchased`；`stat` 目标并不因此获得可靠的完整状态唤醒。对显式依赖目标，索引只按其登记事件处理，不能假定 stat 宽依赖会额外补上 Init/Run 切换。

### ConditionWakeProfile 与首期样本

当前正式默认内容（`src/arona-clicker/content/`）实际在 Reveal 条件中使用：`resource`、`stat`、`spotLevel`、`hasEnh`、`hasReadStory`、`hasReadStoryInRun`、`countTags`。使用位置包括 Init 的阶段/里程碑、Hangar Spot 的 existence/name/condition/utility、Enhancement 的 existence/unlock，以及 ActiveStoryEntry 的 name/condition。默认 RevealTarget 覆盖 `existence`、`name`、`condition`、`utility`、`unlock`。仓库 JSON 包 `datapack/AronaClickerCore/` 的 Reveal 样例使用 `resource` 与 `stat`；`datapack/addition_test/` 的 Init.name 和 Enhancement.unlock 样例仅使用 `resource`。`hasReadStoryInRun` 只见于默认 StoryEntry 的信息 Reveal。

所以引擎能力的 17 个目标远大于当前数据内容实际使用的 7 个目标。`tagCount`、`flag`、`visitedStoryInChain` 等虽在其他玩法条件出现，不计为当前 Reveal 样本；不要把普通 Trigger、StoryEntry 条件、商店条件或测试 fixture 混入 Reveal 内容样本。

### 首个 Reveal 消费者建议

- **首期可支持的事件候选**：`resource`、`spotLevel`、`hasReadStory`、`hasReadStoryInRun`。它们有可用的真实事件与 TriggerEventKind 对应；需要为 per-Init 投影另物化 `init` 唤醒，并在 Registration 准入时检查当前完整条件。`area` 的普通移动具备真实唤醒，但 Init 进入默认 Area 的写入晚于 `initEntered` 且没有后续 `areaEntered`，所以必须由 Init 流程完成后的显式 reconcile 补齐，不能声称事件覆盖 complete。它属于动态位置条件，不要因此把 Visibility 改成 sticky progress。
- **实际内容中暂限为“先准入求值，运行期谨慎”**：`stat`。虽然 EB-T 有 tick，但 Stat DSL 同时读取资源、物品、Spot、强化、故事、Init 和帧数等统计，既没有统一变化事件，ConditionDepIndex 也有遗漏；不以 tick 默认兜底。当前内容含 GlobalProduced、CurrentRunProduced、GlobalUnlockedInits。首期如不另行限定 Stat DSL 子集，应暂不承诺 Reactive Reveal。
- **暂缓等待真实事件能力**：`hasEnh`、`countTags` / `hasTag`、`manager`、`flag`、`tagCount`、`extra`、`affectionLevel`。其中有些 ConditionDepIndex 当前失效链已经存在，但 EB-T 缺对应 kind；`hasTag/countTags` 还依赖运行时 Tag 变化与定义变更；`affectionLevel` 的伞事件在 TriggerSystem 中被过滤掉，且 ConditionDepIndex 未索引 Init 切换。
- **不进入首期信息 Reveal**：`visitedStoryInChain`（执行游标瞬态，jump/clear 无唤醒事件）。`protoStat` 的 EB-T 事件覆盖本身为 complete：可用不带 VariantId 过滤的 `character` 监听唤醒所有原型候选，再由完整 Condition 求值；但 ConditionDepIndex 缺少 `characterAcquired` 依赖，且事件只能按 VariantId 过滤、不能精确映射 proto，因此首期若依赖 DepIndex 或要求精细筛选则暂缓，若接受宽唤醒可支持。`alwaysTrue` 仅在 admission/reconcile 直接求值，不应创建事件监听。

以上是覆盖审计建议，不是 RevealDomain Model 决策，也不修改当前 Visibility、Reveal 或 EB-T 运行时。

### 证据与限制

- 条件语义与叶子 evaluator：`src/engine/types/expression.ts`、`src/engine/expression/condition-system.ts`。
- DepIndex 事件键、宽统计事件、Tag/Extra 匹配：`src/engine/expression/condition-deps.ts`。
- Trigger kind 到事件映射、过滤条件与派发：`src/engine/types/trigger.ts`、`src/engine/effect/trigger-system.ts`。
- 状态写入与事件 producer：`src/arona-clicker/state/state-mutation-service.ts`、`src/arona-clicker/services/init-service.ts`、`src/engine/stats/tag-stats.ts`、`src/engine/system/tick-system.ts`、`src/arona-clicker/services/story-flow.ts`、`src/arona-clicker/services/story-jump.ts`。
- 全量状态替换、读档、Registry/TagStat 索引重建可能静默重建派生视图；它们必须进入 admission/reconcile，而不能伪装成普通状态事件。`ConditionDepIndex` 本身不是依赖订阅服务，也不负责补发事件。
- `ConditionWakeProfile` 目前是这张事实矩阵，不新增 API。Filter `broad` 可保证不漏候选但会多唤醒；它不等同于缺失覆盖。

## 后续范围

本 Task 完成后，依据审计结果另立 Reveal Domain Model Task，裁定 RevealedTarget 集合、prerequisite、WatchScope/ProgressScope 和 RevealProgress 存储字段。Typed Runtime Action、Reveal Adapter、并行消费者与 UI 迁移均不属于本 Task。\n\n### 终态核验\n\n- 2026-09-24：17 个 `ConditionTarget` 均已核验；矩阵按 DepIndex 与 EB-T 分别判定，另列 false→true activation、true→false invalidation、过滤精度与限制。\n- 核实 `InitService.enterInit()` 的 `initEntered` 早于默认 Area 赋值；`area` 因此标为 partial，并要求 Init 完成后的显式 reconcile。\n- `ConditionGroup` 唤醒按叶子事件并集理解，完整 AND/OR 真值仍由 ConditionSystem 求值；未将逻辑编译为 Trigger 组合。\n- `npm run check:docs` 通过；本 Task 为只读审计，未运行测试套件，未修改源码、数据包或 Schema。

## 相关文档

- [[draft-0143-trigger-runtime-registration-withdrawal]]
- [[task-0144-trigger-runtime-registration-withdrawal]]
- [[docs/docs-828/02-modules/visibility]]
- [[docs/docs-828/04-mechanisms/trigger-effect]]
- [[docs/docs-828/04-mechanisms/state-mutation]]
