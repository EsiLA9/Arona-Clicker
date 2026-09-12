# Task 0034：Affector / GameNum 性能判别与整改排序

状态：🟡 P1 与低风险 P2/P3 已落地；Tag 精确命中及读模型 Set / Effect 基准待 profiler 决策

本文回答：来自 Sol 的 Affector → ConditionDepIndex → GameNum/flow → Tick 性能审查，哪些判断已被当前源码证实、哪些只是规模化风险，以及它们当前的整改紧迫性。

## 核验口径

- 核验基线：2026-09-09 当前工作树源码；证据以 `src/` 中的实现为准。
- 核验的是路径复杂度、分配行为和事件链；“几百个实例”等假设规模不视为当前线上事实。
- “真实性”分为：已证实、部分成立、未证实/表述过强。
- 紧迫性：P1 = 规模增长或集中变更时可能形成明显尖峰；P2 = 当前通常不是瓶颈但会随规模放大；P3 = 低风险微优化，除非 profiler 证实否则不单独占用大改造窗口。

## 逐条判别

| 编号 | 判别 | 真实性 | 当前紧迫性 | 结论 |
| --- | --- | --- | --- | --- |
| 1 | `syncAffectorZoneEffects()` 对每个 Active source 调用全局 source 删除 | 已证实 | P1 | 建立 source → 已登记记录位置的反向索引 |
| 2 | `affectorFlows` 求值重新扫描 Active Affector → entries → flows | 已证实 | P1 | 按 `(resource, mount)` 建活跃 flow 索引 |
| 3 | `getActiveInstances()` 每次复制并 filter | 已证实 | P2 | 维护 active 集合；UI 快照仍需复制 |
| 4 | 一次状态变化可能触发多次 GameNum 重同步 | 已证实（边界需修正） | P1/P2 | `entriesChanged` 与 `stateChanged` 分开发出；unmount 还会发两类事件，应显式 coalesce |
| 5 | `activeEntryIds.includes()` 在内层循环造成二次复杂度 | 已证实 | P2 | 加 Set 或数组 + Set，保留数组顺序语义 |
| 6a | `ConditionDepIndex.unregister()` 扫描所有反向索引桶 | 已证实 | P2 | 增加 key → dependency handles，精确删除 |
| 6b | `extraChanged` 扫全部 extra 依赖并逐条 `JSON.parse()` | 已证实 | P2 | 注册时预解析 path；Trie 后置 |
| 7 | 任意 `spotLevelChanged` 让全部 tag 条件依赖失效 | 已证实 | P2 | 先区分 0↔正数与正数之间升级，再按 tag 收窄 |
| 8 | `ConditionGroup` 先 map 全部条件，失去 AND/OR 短路 | 已证实 | P3 | 低风险微优化，保持条件顺序 |
| 9 | `hasEnh` / `hasReadStory` 使用线性 includes/some | 已证实 | P3 | 随内容规模观察，优先改只读查询结构 |
| 10 | `EffectEngine.applyEffects()` 有 map/filter/spread 分配；perTickEffects 可能制造事件链 | 部分成立 | P2/P3 | 分配事实成立；事件风暴取决于具体 DSL 与订阅规模 |

## 逐条执行文档

以下各节是可独立实施的任务说明。每条都必须先补行为等价测试，再替换内部索引或求值路径；不得改变 Affector、GameNum、StateMutationService 和 UI 只读面的公开语义。

### 任务 1：ZoneModifier 建立 source → records 反向索引

#### 背景

Affector 激活 entry 或状态翻转时，GameNum 需要把该实例贡献的 `zoneModifiers` 写入 `state.tagEffects` / `state.entityEffects`。同步前必须删除该 source 的旧记录，防止条件变化后留下失效修饰器。

#### 问题

`removeTagEffectsBySource()` 逐项扫描两张全局表，再检查每条记录的 `source`。`syncAffectorZoneEffects()` 又对每个 Active Affector 执行一次删除并重注册，因而同步成本随 Active source 数和全局记录数相乘增长。当前 `TagEffectRecord` 注释描述了 O(k) 目标，但源码没有记录每条记录所在的表和 key。

#### 处理方案

1. 在 GameNumSystem 内部增加 source 记录索引，例如 `Map<source, Set<RecordLocation>>`；位置至少包含 `table`、`key`、`recordId`。
2. `registerTagEffect()` / `registerEntityEffect()` 在新增或替换记录时同步维护索引；同 id 替换不得重复登记位置。
3. 将 `removeTagEffectsBySource()` 改为读取 source 的位置集合，按位置删除记录并只对受影响 key 执行 `markZoneDirty()`。
4. 同步完成后清理 source 索引；整体 `buildAll()`、状态替换和显式清空必须一起清空索引。
5. 保留全局扫描实现作为测试基准或调试断言，不作为生产删除路径。

#### 最终预期

删除一个 source 的复杂度变为 O(该 source 贡献的记录数)，不再与全局 tag/entity effect 表大小线性相关；删除后所有受影响 zone 节点仍正确失效，重复同步不会产生重复记录。

### 任务 2：Affector flow 建立 `(resource, mount)` 活跃来源索引

#### 背景

`affectorFlows` 是 GameNum 资源树中的持续产出节点。节点已经按 resource 和 mount 建立，但节点求值时仍需要从 AffectorEngine 重新发现哪些 flow 真正属于该节点。

#### 问题

`evaluateAffectorFlowsNode()` 每次重算都遍历 active instances、pack entries 和 flows，再过滤 mount/resource。一次大规模失效会让多个 flow node 重复检查同一批无关 Affector。

#### 处理方案

1. 定义运行时 flow 来源记录：source、mount、resource、entry/flow 身份及求值所需的 `AffectorFlow` 引用。
2. 在 Affector 激活、entry 集变化和卸载时增量更新索引；建议按 `FlowBucketKey = resource + mount bucket` 分桶。
3. 对层级实体使用已解析的 spot/area/init mount；非层级实体统一进入 global bucket，保持当前 `isLevelEntity()` 语义。
4. `evaluateAffectorFlowsNode()` 只读取对应 bucket，并逐条调用现有 `resolveFlowValue()`；不改变表达式求值状态和求和顺序要求。
5. `ensureFlowsNodes()` 继续负责节点结构存在性，但不得再被误认为 flow 值来源索引。
6. 资源依赖表应从同一 flow 来源注册过程维护，避免同步时再次全量扫描 active flows。

#### 最终预期

flow 节点求值成本从“全部 active Affector 候选扫描”降为“该 resource/mount bucket 中的实际 flow 数”；激活、失活和 entry 翻转后的索引不会残留旧 flow，也不会漏算新 flow。

### 任务 3：Affector runtime change 事件合并

#### 背景

GameNum 需要在 Affector 实例集合或 Active entry 集变化后重同步 zone 表、flow 来源和缓存失效。当前事件模型分别暴露 mounted、unmounted、stateChanged、entriesChanged，便于各订阅方理解生命周期。

#### 问题

同一次 `recheck()` 可能同时发 `affectorEntriesChanged` 和 `affectorStateChanged`；`unmount()` 还会发 stateChanged 与 unmounted。GameNum 对这些事件分别执行完整同步，导致一次逻辑变化重复做重活。EventBus 的 queue 只保证嵌套派发顺序，不做去重。

#### 处理方案

1. 不直接删除现有事件，先在 GameNumSystem 增加待同步标记：按 instanceId 记录 runtime change。
2. 在明确的 mutation/flush 边界执行一次 `syncAffectorZoneEffects()`、一次 flow 索引刷新和一次相关 dirty 操作。
3. 若当前运行链缺少统一 flush 边界，则先提供最小的 `scheduleAffectorSync()` / `flushAffectorSync()` 生命周期，确保同步不会延迟到错误 tick。
4. mounted、unmounted、stateChanged、entriesChanged 的外部事件继续发出，日志和其他订阅者不因 GameNum 优化而失去事件。
5. 对同一 instance 的多事件合并；不同 instance 的变化可在同一批次合并，但不能遗漏任一 source 的增删。

#### 最终预期

一次逻辑状态变化最多触发一次 GameNum 重同步；事件可观察性和生命周期语义保持不变，嵌套事件、连续挂载和批量卸载均不会出现重复记录、漏同步或错误缓存。

### 任务 4：维护 activeInstances 集合

#### 背景

AffectorEngine 的主实例表包含 Latent、Active、Removed 三类实例，但数值计算、服务能力和 UI 主要只需要 Active 实例。

#### 问题

`getActiveInstances()` 每次都展开 `instances.values()` 并 `filter`，在 flow node、zone 同步、每 Tick effects 和查询接口中重复分配数组。

#### 处理方案

1. 增加私有 `activeInstances` Map 或 Set，与主 `instances` 表保持双向一致。
2. 在 mount/recheck/unmount 的状态边沿维护集合：Latent→Active 加入，Active→Latent/Removed 删除。
3. 提供内部只读迭代接口供引擎求值使用；公开 `getActiveInstances()` 是否返回数组按 UI 快照边界决定，不能暴露可变内部容器。
4. 增加一致性断言或测试，覆盖重复 mount、Removed 实例重建、reconcileMounts 和 setState/buildAll 场景。

#### 最终预期

内部 active 遍历不再为每次调用复制并筛选全实例表；状态边沿是唯一维护成本，外部 GameView 仍获得隔离且稳定的只读快照。

### 任务 5：为 activeEntryIds 增加 Set 查询面

#### 背景

数组形式的 `activeEntryIds` 适合序列化、稳定顺序和 UI 展示；引擎内部频繁需要判断某个 entry 是否激活。

#### 问题

多个 active instance/entry 内层循环调用 `includes()`，entry 数量增加时产生重复线性查找，并放大任务 1、2、4 的扫描成本。

#### 处理方案

1. 运行时在实例旁维护非持久化 `activeEntryIdSet`，或由引擎侧维护 `instanceId → Set`。
2. `recheck()` 生成 active entry 集时一次性同步数组和 Set；数组顺序保持 pack entry 顺序。
3. 所有内部 membership 查询改用 Set；GameView、序列化和日志继续使用数组。
4. 明确旧状态结构不做迁移；Set 是派生运行时字段，恢复/重建时重新生成。

#### 最终预期

entry membership 查询平均降为 O(1)，不改变 active entry 的顺序、重复 id 警告和一次性 effects 语义。

### 任务 6：ConditionDepIndex 精确注销与 Extra path 预解析

#### 背景

ConditionDepIndex 已将事件条件从每 Tick 全量检查收窄为按事件命中；Affector 挂载和卸载时需要注册/注销多种依赖。

#### 问题

`unregister()` 遍历所有 event、extra、tag 桶执行删除；`extraChanged` 还会遍历全部 Extra 依赖并对序列化 path 重复 `JSON.parse()`，形成与依赖总量相关的慢路径。

#### 处理方案

1. 注册时为每个 key 创建 dependency handles，记录所属桶和索引键。
2. 注销时只沿 handles 删除；空桶及时清理，避免桶数量无限增长。
3. Extra 依赖注册时保存解析后的 `string[]` path；Map key 可继续序列化，但命中比较不得每次 parse。
4. 保持 Extra 路径的前缀双向命中语义：依赖父节点时子路径变化仍命中，依赖子节点时父节点替换也仍命中。
5. Trie 作为后续规模化切片，只有基准显示全量 path 扫描仍是热点时再引入。

#### 最终预期

依赖注销成本与该 key 自身依赖数相关；Extra 事件不再为每个候选依赖重复 JSON 解析，同时保持现有前缀失效正确性。

### 任务 7：收窄 spotLevelChanged 的 Tag 条件失效

#### 背景

`hasTag` / `countTags` 查询的是“拥有指定 tag 的 Spot”集合。Spot 从未拥有到拥有、或反向归零时，相关条件结果可能改变。

#### 问题

当前任意 `spotLevelChanged` 都把全部 `tagDeps` 加入命中集；例如 5→6 不改变 owned 集合，却会令所有 tag 条件重新计算。

#### 处理方案

1. 为 `spotLevelChanged` 补充 `oldLevel`，或在事件生产处只发显式 owned-edge 信息；不得在 ConditionDepIndex 内猜测旧值。
2. 只有 `(oldLevel <= 0) !== (newLevel <= 0)` 时触发 Tag 条件失效。
3. 进一步读取该 Spot 的有效 tag 集合，只命中对应 tag 及其必要父路径依赖。
4. 与 `spotTagChanged` 的精确 tag 命中规则对齐，确保动态 tag、层级 tag 和 owned 状态组合正确。

#### 最终预期

普通 Spot 升级不再触发无关 Tag 条件重估；0↔正数仍完整刷新受影响 tag，动态 tag 变更仍按现有精确路径命中。

### 任务 8：ConditionGroup 求值恢复短路

#### 背景

ConditionGroup 的 AND/OR 语义天然支持短路，条件顺序也是当前数据定义的一部分。

#### 问题

`evaluateGroup()` 先 map 求出所有子条件结果，再调用 every/some；当前缀已经决定结果时，后续可能包含 stat、tag count 或 Extra 查询的条件仍被执行。

#### 处理方案

1. AND 改为顺序循环，首个 false 立即返回 false；全部通过后返回 true。
2. OR 改为顺序循环，首个 true 立即返回 true；全部失败后返回 false。
3. 保留空数组语义：AND 为 true，OR 为 false，或以现有测试所确认的结果为准。
4. 增加嵌套 group、异常/未知 target 和调用计数测试，确保只改变无效求值次数。

#### 最终预期

条件结果完全不变，但可跳过确定结果之后的查询和分配；短路收益随条件组长度和前置条件命中率增加。

### 任务 9：Enhancement/Story 条件只读查询 Set 化

#### 背景

`hasEnh` 和 `hasReadStory` 是常见存在性条件，可能被多个 Affector、Visibility 或 Trigger 重复读取。

#### 问题

当前分别使用数组 `includes()` 与 `storyLog.some()`；内容量增大、同一事件触发多个条件求值时，会积累线性查询成本。

#### 处理方案

1. 先建立只读查询层的派生 Set，例如已解锁 Enhancement Set、已完成 Story ID Set。
2. 在状态写入、Init 切换、读档恢复和 reset 后重建派生 Set；不把 Set 直接作为新的持久化状态字段，避免扩大状态迁移面。
3. ConditionSystem 通过注入的只读 reader 查询 Set，保持现有数组状态和条件语义。
4. 只有 benchmark 证明收益稳定后才替换高频路径；低规模场景可保留简单数组实现。

#### 最终预期

存在性查询在大内容量下接近 O(1)，不改变状态结构、存档语义或 storyLog 的顺序展示。

### 任务 10：规范 perTickEffects，并评估 EffectEngine 分配

#### 背景

Affector 同时提供 `flows`、`zoneModifiers`、一次性 `effects` 和显式 `perTickEffects`。它们分别对应连续数值、持续修饰、激活边行为和离散 Tick 副作用。

#### 问题

`EffectEngine.applyEffects()` 会为每批 effects 创建 resolved 数组和 stateEffects 数组；表达式 value 还会创建 spread 对象。若把连续资源产出误写成 perTickEffects，则每 Tick 可能进入 StateMutation、EventBus、ConditionDepIndex 和 GameNum 失效链。

#### 处理方案

1. 在 Affector/Datapack 机制文档和编辑器提示中明确：连续资源产出优先使用 flow，持续修饰使用 zoneModifier，一次性行为使用 effects，只有离散副作用才使用 perTickEffects。
2. 为 perTickEffects 增加专项测试和计数基准，记录每 Tick 的 effect 批次、mutation 次数和事件数量。
3. 先不为所有 Effect 做对象池或原地改写；评估实际 profiler/benchmark 后，再选择单循环过滤、惰性解析或结构复用。
4. 任何优化必须保持 runtime effect handler 的调用顺序、value expression 的当前状态读取和 StateMutationService 单一写入口。

#### 最终预期

数据作者不会用 perTickEffects 模拟普通生产；高频离散效果的事件成本可观测。只有基准确认 GC/分配成为实际瓶颈时，才对 EffectEngine 做局部优化。

## 代码证据与判别说明

### 1. ZoneModifier source 删除

`src/engine/expression/game-num-tag.ts` 的 `removeTagEffectsBySource()` 会遍历 `state.tagEffects` 和 `state.entityEffects` 的所有 key，再检查每条记录的 `source`。`syncAffectorZoneEffects()` 对每个 active instance 先调用该函数，再重新注册 modifiers；因此“每个 active source × 全局区表”的判断成立。`TagEffectRecord` 注释所说的 O(k) 是目标语义，不是当前实现。

### 2. Affector flow 扫描

`src/engine/expression/game-num-eval.ts` 的 `evaluateAffectorFlowsNode()` 每次从 `getActiveInstances()` 开始，逐实例检查挂载层级、pack、entries、`activeEntryIds.includes()` 和 flows。`affectorFlowsNodes`、`flowsResourceDeps` 只用于节点/资源失效，没有提供 flow 值来源索引；该项是当前最明确的扩展性热点之一。

### 3–5. 实例与 entry 查询

`AffectorEngine.getActiveInstances()` 当前为数组展开后 `filter`，调用点包括 flow 求值、区表同步、每 Tick effects、max-level 查询和 UI read model。公开返回不能直接改成可变内部 iterator，因为 UI 快照需要隔离。`activeEntryIds` 在多个上述内层循环中使用 `includes()`，加 Set 属于低风险配套改动。

### 4. 重复重同步

`AffectorEngine.recheck()` 在 entry 集变化时发 `affectorEntriesChanged`，状态翻转时再发 `affectorStateChanged`；`GameNumSystem` 对两者都绑定 `onAffectorInstancesChanged()`。该函数会同步 zone 表、补齐 flow 节点、重建 flow resource deps 并使 flow 节点变脏。`unmount()` 还连续发 `stateChanged` 与 `unmounted`。EventBus 的 nested emit 只排队，不会去重或合并。

### 6–7. ConditionDepIndex

`unregister()` 当前遍历 `byEvent`、`extraDeps`、`tagDeps` 的全部桶并执行 `set.delete(key)`；`affected(extraChanged)` 也遍历全部 `extraDeps`，逐 key `JSON.parse()` 后做双向 prefix 比较。预解析是直接收益，Trie 只有在依赖数量达到规模后才值得引入。任意 `spotLevelChanged` 当前会把 `tagDeps` 全部加入命中集；但事件只有 `newLevel`，收窄前需补充 old/new 边沿信息。

### 8–9. 条件求值

`ConditionSystem.evaluateGroup()` 先 map 再 every/some，短路损失成立且语义风险低。`hasEnh` 使用 `unlockedEnhancements.includes()`，`hasReadStory` 使用 `storyLog.some()`，线性查询成立，但当前没有 profiler 或内容规模证据证明它们已是瓶颈，列为 P3。

### 10. Effect/perTick 路径

`EffectEngine.applyEffects()` 确实先 `map(resolveValue)`，再 `filter`，表达式解析时还会创建 spread 对象。`AffectorEngine.applyActiveEffects()` 每 Tick 处理 polling instance 的 recheck，并执行 active entries 的显式 `perTickEffects`。连续资源产出使用 `flows` 更符合 GameNum 设计；“必然造成事件风暴”依赖具体 effects、mutation 和订阅数量，当前只能记为条件性风险。

## 整改顺序

1. P1：ZoneModifier 的 source → records 反向索引。
2. P1：活跃 flow 的 `(resource, mount)` 来源索引。
3. P1/P2：Affector runtime change 事件在一次 mutation/flush 内合并，至少保证同一 instance 只触发一次 GameNum 同步。
4. P2：activeInstances 集合与 `activeEntryIds` Set。
5. P2：ConditionDepIndex 正向依赖句柄、Extra path 预解析。
6. P2：spotLevelChanged 的边沿信息与 tag 依赖收窄。
7. P3：ConditionGroup 短路、Enhancement/Story 读模型 Set 化。
8. P2/P3：补充 perTickEffects 使用规范和基准测试，再决定 EffectEngine 分配优化。

## 实施记录（2026-09-09）

- 已完成：1（source→区记录位置索引）、2（`(resource, mount)` 活跃 flow bucket）、3（Affector runtime 批量事件）、4（Active 实例集合）、5（active entry Set）、6（精确注销句柄与 Extra path 预解析）、8（ConditionGroup 短路）。
- 已完成第一阶段：7 为 `spotLevelChanged` 补齐 `oldLevel`；仅 0↔正数边沿重估 tag 依赖。事件尚未携带有效 tag 集合，因此没有在索引层猜测 Spot 标签，精确 tag 收窄留待生产端能提供该上下文时再做。
- 未实施：9 需要先以 profiler/基准证明派生只读 Set 的稳定收益；10 保持当前 flow / zoneModifier / effects / perTickEffects 的文档边界，尚未观察到值得改变 EffectEngine 分配策略的证据。

## 测试与验收

### 当前核验（2026-09-09）

- 已执行源码定向检索，确认上述实现落点与事件链。
- 尚未执行 profiler；本文不宣称当前内容规模下的 CPU/GC 占比。
- 尚未修改运行时代码，因此未因本任务新增专项测试。

### 后续验收口径

- 为 source 删除、flow 索引、active 集合和事件 coalesce 增加行为等价测试；
- 增加可控规模 benchmark/计数断言，比较整改前后的扫描记录数；
- `npm test`、`npx tsc --noEmit`、`npm run check:architecture` 全部通过后，才可把对应切片标记为完成。

## 相关路由

- [[docs/docs-828/00-INDEX]]
- [[docs/docs-828/07-audit/affector-performance]]
- [[docs/docs-828/02-modules/affector]]
- [[docs/docs-828/02-modules/game-num]]
- [[docs/docs-828/04-mechanisms/production]]
- [[docs/plan-work/review/code-review-roadmap]]
- [[docs/plan-work/mechanisms/review-documentation]]
