# 03 — Engine Subsystems 引擎子系统详解

所有子系统在 [[src/engine/game-instance.ts]] 构造函数中组装并接线。本章逐一详解每个子系统。

---

## 1. GameInstance 游戏实例

**文件**：[[src/engine/game-instance.ts]]（758 行）

GameInstance 是门面（Facade），组装全部子系统并暴露统一 API。领域逻辑委托给 game/ 服务：剧情 → [[src/engine/game/story-service.ts]]，Spot → [[src/engine/game/spot-service.ts]]，世界线 → [[src/engine/game/init-service.ts]]，物品/掉落 → [[src/engine/game/item-service.ts]]，强化购买/移除/诊断 → [[src/engine/game/enhancement-service.ts]]，帧循环与离线收益 → [[src/engine/game/session-service.ts]]。门面仅保留纯委托 + `getView()` + `save()/load()`。

### 公开 API

| 方法 | 说明 |
|------|------|
| `init(datapacks)` | 加载数据包 → 进入默认 Init |
| `start()` / `stop()` | 启动/停止帧循环 |
| `tick()` | 手动推进一帧 |
| `getView()` | 返回只读 GameView 快照 |
| `save()` / `load(data)` | 存档导出/恢复 |
| `enterInit(initId)` | 进入世界线 |
| `startNewGame(initId)` | 开启新游戏 |
| `restartInit()` | 软重启（保存快照） |
| `resumeInit(initId)` | 恢复世界线（有快照则恢复） |
| `hardRestartInit()` | 硬重启（删除快照） |
| `travelToArea(areaId)` | 移动到区域 |
| `upgradeSpot(spotId)` | 升级设施 |
| `unlockSpot(spotId)` | 解锁设施 |
| `assignManager(spotId, character)` | 分配 Manager |
| `purchaseEnhancement(enhId)` | 购买强化 |
| `purchaseInit(initId)` | 购买世界线 |
| `startActiveStory(storyId)` | 启动主动剧情 |
| `triggerPassiveStory()` | 触发被动闲聊 |
| `advanceStory(choiceIndex?)` | 推进剧情 |
| `clickSend()` | 点击回复按钮 |
| `getSendState()` | 查询回复按钮状态 |
| `giveItem(itemId, count)` | 发放物品 |
| `useItem(itemId)` | 使用物品 |
| `rollDropTable(tableId)` | 执行掉落表 |
| `getExtra(path)` / `setExtra(path, value)` | Extra 读写 |
| `reload(datapacks)` | 运行时替换数据包 |

### 存档结构 SaveData

```typescript
interface SaveData {
  version: string;
  timestamp: number;
  playerState: PlayerState;
  visibility: VisibilitySnapshot;
  pendingStoryId: string | null;
  pendingStoryPageIndex: number;
  pendingStoryChoiceIndex?: number;
  pendingTalkletClicks?: { total: number; done: number } | null;
  pendingStoryDefId?: string | null;          // 当前实际播放的 Story.id（跳转链中可变）
  pendingInsertStack?: { storyId: string; pageIndex: number }[];  // insert 返回点栈
  pendingVisitedStoryIds?: string[];          // 本链已访问 Story.id（去重）
  pendingIsReplay?: boolean;                  // 是否重阅读模式
  stats?: PersistedStats;
}
```

---

## 2. EventBus 事件总线

**文件**：[[src/engine/event-bus.ts]]（83 行）

发布-订阅模式的事件派发器，支持按类型订阅和通配订阅。

### 核心方法

| 方法 | 说明 |
|------|------|
| `on(type, handler)` | 注册特定类型处理器，返回取消函数 |
| `onAny(handler)` | 注册通配处理器 |
| `emit(event)` | 发送事件（flushing 时排队） |
| `flush()` | 批量清队列 |
| `clear()` | 清除所有处理器 |

### 排队机制

`emit()` 在 `flushing` 状态下将事件推入队列而非立即派发，避免递归触发。`flush()` 在每帧 tick 结束时调用，批量派发所有排队事件。

---

## 3. StateMutationService 状态写入口

**文件**：[[src/engine/state-mutation-service.ts]]（273 行）

所有 PlayerState 写入的唯一入口。每个 mutation 走固定管道：**写状态 → 同步统计 → emit 事件**。

### 资源路由

全局资源（`isGlobalResource()` 返回 true）写 `globalResources`，其余写 `resources`。

### 核心方法

| 方法 | 说明 |
|------|------|
| `changeResource(resource, delta)` | 增减资源（自动路由桶） |
| `setResource(resource, value)` | 设置资源值 |
| `setSpotLevel(spotId, level)` | 设置设施等级 |
| `addSpotLevel(spotId, delta)` | 增加设施等级 |
| `setManager(spotId, character)` | 设置 Manager |
| `addEnhancement(enhId)` | 获得强化 |
| `removeEnhancement(enhId)` | 移除强化 |
| `addItem(itemId, count, maxStack)` | 获得物品 |
| `removeItem(itemId, count)` | 移除物品 |
| `unlockInit(initId)` | 解锁世界线 |
| `setFlag(flag, value)` | 设置标记 |
| `completeStory(story)` | 完成剧情 |
| `setExtra(path, value)` | 写 Extra 全局层 |
| `addExtra(path, delta)` | Extra 数值增量 |
| `removeExtra(path)` | 删除 Extra 节点 |
| `applyEffects(effects)` | 批量执行效果 |

### 事件携带统计上下文

每个 emit 的事件都携带 `stats: StatsContext`（变更时点的三层统计摘要），供 TriggerSystem 等订阅者判断条件。

---

## 4. ValueSystem 数值求值

**文件**：[[src/engine/value-system.ts]]（98 行）

求值 `ValueExpression` → number。

### ValueSource 求值逻辑

| source | 逻辑 |
|--------|------|
| `const` | 直接返回 params.value |
| `res` | 返回 state.resources[params.resource] |
| `spotLevel` | 返回 state.spotLevels[params.spot] |
| `spotCount` | 遍历 state.spotLevels，spotId 以 params.area 开头且 level > 0 的数量 |
| `managerCount` | 遍历 state.spotManagers，spotId 以 params.init 开头且 char !== 'none' 的不同角色数 |
| `data` | 调用 extraReader(path) 读三层合并视图并转数值 |
| `funclet` | 查找 FuncletDef，将参数注入 flags 后递归求值 |

### Extra 读取器

通过 `setExtraReader()` 注入，由 GameInstance.getExtra 提供。

---

## 5. ConditionSystem 条件求值

**文件**：[[src/engine/condition-system.ts]]（126 行）

### 核心方法

| 方法 | 说明 |
|------|------|
| `evaluate(cond, state)` | 求值单条原子条件 |
| `evaluateGroup(group, state)` | 求值条件组（AND/OR） |
| `evaluateExpr(expr, state)` | 求值原子或组（自动判断） |

### 注入的读取器

| setter | 提供者 | 用途 |
|--------|--------|------|
| `setTagIndex` | Registry.spotsWithTag | hasTag / countTags 条件 |
| `setStatReader` | StatsService.evaluate | stat 条件（DSL） |
| `setStoryRunChecker` | StatsService.hasCompletedStoryThisRun | hasReadStoryInRun 条件 |
| `setStoryChainChecker` | StoryService.isVisitedInChain | visitedStoryInChain 条件（当前 Entry 跳转链） |
| `setExtraReader` | GameInstance.getExtra | extra 条件 |

### ConditionTarget 求值

| target | 逻辑 |
|--------|------|
| `resource` | state.resources[key] ?? 0 |
| `spotLevel` | state.spotLevels[key] ?? 0 |
| `manager` | state.spotManagers[key] 存在且非 none → 1，否则 0 |
| `flag` | value=1 检查 flag 存在且非空；value=0 检查不存在或为空 |
| `hasEnh` | state.unlockedEnhancements.includes(key) → 1，否则 0 |
| `hasTag` | countOwnedTagSpots > 0 → 1 |
| `countTags` | countOwnedTagSpots 的实际数量 |
| `stat` | 调用 statReader(key) |
| `hasReadStory` | state.storyLog.some(s => s.storyId === key) |
| `hasReadStoryInRun` | storyRunChecker(key) |
| `visitedStoryInChain` | storyChainChecker(key)：当前 Entry 跳转链是否经过该 Story（含初始与全部 jumpToStory 目标，去重） |
| `extra` | toNumber(extraReader(key)) |

---

## 6. EffectEngine 效果执行

**文件**：[[src/engine/effect-engine.ts]]（38 行）

`applyEffects(effects)`：先把 value 为 ValueExpression 的效果按当前状态求值为数字，再交给 mutations.applyEffects。

`loot` / `triggerStory` 两种 op 在状态层被忽略，由上层系统处理。

---

## 7. GameNumSystem 统一数值注册 + 懒求值

**文件**：[[src/engine/game-num.ts]]（213 行）＋ [[src/engine/game-num-eval.ts]]（140 行）

**产出主路径**。每个资源一棵 `primitiveGain` 树（add 根节点），构建时展开到最末端叶子，求值时懒读取 PlayerState。game-num.ts 持有索引/缓存生命周期（gains / spotNodes / spotEnhIndex / enhCache）；节点求值语义（const/expr/add/mul/owned/levelLinear/managerBonus/tagMultiplier/enhancementMultiplier/affectorFlows）为纯函数 `evaluateGameNum()`，位于 game-num-eval.ts（GameNum 类型亦定义于此）。

### primitiveGain 树结构（以 credit 为例）

```
primitiveGain:credit (add)
├── spot:credit_printer (mul)
│   ├── owned (叶子：等级>0 → 1)
│   ├── baseLine (add: base + levelLinear)
│   ├── managerBonus (叶子)
│   ├── tagMultiplier (叶子：角色标签加成累乘)
│   └── enhancementMultiplier (叶子：Enhancement 倍率累乘)
├── spot:field_work (mul) ...
└── affectors:credit (叶子：所有活跃 Affector 的 addResource 之和)
```

### GameNum 节点类型

| kind | 说明 |
|------|------|
| `const` | 常量 |
| `expr` | ValueExpression 求值 |
| `add` | 子节点求和 |
| `mul` | 子节点累乘 |
| `owned` | 设施是否拥有（level > 0 → 1） |
| `levelLinear` | 每级线性产出增量 |
| `managerBonus` | Manager 额外产出 |
| `tagMultiplier` | 角色标签加成倍率 |
| `enhancementMultiplier` | Enhancement 倍率累乘 |
| `affectorFlows` | Affector 的 addResource 贡献之和 |

### 核心方法

| 方法 | 说明 |
|------|------|
| `buildAll()` | 数据加载后构建所有资源的 gain 树 |
| `evaluateResourceGain(resource, state)` | 懒求值：某资源本 Tick 的获取量 |
| `evaluateSpotYield(spotId, state)` | 懒求值：某 Spot 的最终产出值 |

---

## 8. TickSystem 帧推进

**文件**：[[src/engine/tick-system.ts]]（127 行）

`TICK_INTERVAL_MS = 1000`（1 秒 = 1 帧）。

### tick() 流程

1. `state.totalFrames += 1`
2. GameNum 统一结算各资源产出（有 gameNumSystem 时）
3. 每个资源：`evaluateResourceGain` → `mutations.changeResource` → emit `spotProduced`
4. emit `tick`

旧路径（无 GameNum，仅测试用）：逐 Spot 计算 baseYield + managerBonus + tag 倍率 + enhancement 倍率。

---

## 9. AffectorEngine 持续效果生命周期

**文件**：[[src/engine/affector-engine.ts]]（280 行）

### 生命周期

```
mount(packId, entityId) → Latent
    ↓ 条件满足
  Active
    ↓ 卸载/条件不满足
  Removed
```

### 挂载源

| 来源 | 触发 |
|------|------|
| 物品 | `item.affectorPackIds`，itemCollected 事件 |
| 强化 | `enh.affectorPackIds`，enhancementAdded 事件 |
| Spot 功能 | `linearYield` 动态构造 pack，spotLevelChanged 事件 |

### 每 tick 处理

`applyActiveEffects()` 全量重估条件 → 对 Active 实例执行**非 addResource** 效果（addResource 合流进 GameNum 的 affectorFlows 叶子）。

### 等级上限覆盖

`getSpotMaxLevelOverrides()` → `{ lifted, maxLevels }`

优先级：`removeSpotMaxLevel`（无限制，最高优先级）→ 多个 `setSpotMaxLevel` 取最高值 → SpotDef.maxLevel

### 事件订阅

- `itemCollected` → 挂载/卸载物品 Affector
- `spotLevelChanged` → 重估 + Spot 功能同步
- `enhancementAdded` / `enhancementRemoved` → 挂载/卸载强化 Affector + Spot 功能同步
- `spotTagChanged` → Spot 功能同步

---

## 10. TriggerSystem Trigger DSL 桥接

**文件**：[[src/engine/trigger-system.ts]]（132 行）

对外（数据包）只暴露 `TriggerDef`（`on` 事件模式 + `condition` + `effects` + `once`），内部桥接到 EventBus → ConditionSystem → EffectEngine。

### 生命周期

| 方法 | 说明 |
|------|------|
| `mount(def, group?)` | 挂载 Trigger（重复 id 覆盖） |
| `unmount(id)` | 移除单个 Trigger |
| `unmountGroup(group)` | 移除整组（世界线专属） |
| `load(defs)` | 批量挂载 |
| `clear()` | 清空 |

### 匹配逻辑

`eventBus.onAny` → `matchesEvent(on, event)`（tick 支持 `every` 帧间隔）→ 条件求值 → `fire`。

### once 语义

先落账再执行（防级联重复触发），完成记录持久化进 `state.triggersCompleted`。

### 分组

默认归入 `global` 组。世界线专属 Trigger 以 `init:<id>` 分组，进入时挂载、离开时卸载。

---

## 11. VisibilityEngine 可见性快照

**文件**：[[src/engine/visibility-engine.ts]]（119 行）＋ [[src/engine/visibility-index.ts]]（202 行）＋ [[src/engine/visibility-eval.ts]]（93 行）

三层分工：visibility-engine.ts 为编排层（快照持有 + 增量 dirty 标记 + 对外 API）；visibility-index.ts 持有「事件 → 受影响实体」反向索引（构建 + `collectAffected()` 标脏收集，含 extra 前缀 / tag / stat 宽依赖）；visibility-eval.ts 为求值层（`evaluateEntity` / 整类重算 / `existenceMet` 桥接），并定义共享类型 EntityKind/EntityKey。

`compute(state)` 一次性算出全部实体可见性快照（inits/areas/spots/enhancements/items/stories）。

可见性由 `revealTriggers` 中的 `existence` 目标承担：无门槛 = 默认可见；有门槛 = 任一满足即可见。

单点查询：`isInitVisible` / `isAreaVisible` / `isSpotVisible` / `isEnhancementVisible`

---

## 12. LootSystem 掉落表

**文件**：[[src/engine/loot-system.ts]]（79 行）

### roll(table, state)

1. 筛选满足条件的条目
2. 计算总权重
3. 加权随机抽选 → 返回 `Map<itemId, count>`

### rollTable(tableId, state)

1. 查找 DropTableDef
2. 条件过滤
3. guaranteed 保底
4. maxRolls 次 `roll()`

---

## 13. CharacterSystem 角色数据

**文件**：[[src/engine/character-system.ts]]（114 行）

### 核心方法

| 方法 | 说明 |
|------|------|
| `load(characters)` | 从数据包加载角色数据 |
| `loadBonuses(bonuses)` | 加载角色加成表 |
| `get(id)` | 获取角色数据 |
| `getAll()` | 获取所有角色 |
| `getBySchool(school)` | 按学校筛选 |
| `getByRarity(rarity)` | 按稀有度筛选 |
| `getUnlocked(state)` | 获取已解锁角色 |
| `getAssignable(state)` | 获取可分配角色 |
| `getBonus(spotId, characterId)` | 获取角色加成倍率 |
| `getTagBonus(characterId, tag)` | 获取角色对 Spot 标签的加成（层级匹配） |

### 解锁判定

被分配到 Spot 的角色或 flag `char_unlock_<id>` 为 'true' 的角色视为已解锁。

---

## 14. SpotFunctionalitySystem Spot 功能

**文件**：[[src/engine/spot-functionality.ts]]（65 行）

Spot 功能 = 内源（`spot.functionalities`）+ 外源（Enhancement `addsFunctionalities` 按 tag 注入）。

### 功能类型

| kind | 说明 |
|------|------|
| `linearYield` | 每级额外产出（走 Affector 挂载） |
| `restartInit` | 软重启（UI 提供操作入口） |
| `hardResetInit` | 硬重置（UI 提供操作入口） |

### 核心方法

| 方法 | 说明 |
|------|------|
| `functionalitiesOf(spot, state)` | 获取 Spot 的生效功能（内源+外源） |
| `hasFunctionality(spot, state, kind)` | Spot 是否拥有某类功能 |
| `extraYields(spot, level, state)` | 计算功能提供的额外产出 |

---

## 15. StatsService 三层统计

**文件**：[[src/engine/stats.ts]]（262 行）＋ [[src/engine/stats-counters.ts]]（66 行）

计数器纯函数（`bump` / `emptyCounters` / `copyCounters` / `copyInitMap` / `freshSnapshot`）拆至 stats-counters.ts；stats.ts 保留 StatsService（record 钩子 + DSL 求值 + 持久化）。

### 三层

| 层级 | 说明 |
|------|------|
| `global` | 贯穿所有世界线的总数据 |
| `init[id]` | 各世界线内的总数据（含 framesInInit） |
| `session` | 当前一次游玩（正在进行的 Init 从头到尾） |

### StatCounters 指标

| 指标 | 类型 | 说明 |
|------|------|------|
| `produced` | `Record<string, number>` | 累计产出 |
| `consumed` | `Record<string, number>` | 累计消耗 |
| `itemsCollected` | `Record<string, number>` | 获得物品 |
| `itemsUsed` | `Record<string, number>` | 使用物品 |
| `spotsUnlocked` | `number` | 解锁设施数 |
| `spotsUpgraded` | `number` | 升级设施数 |
| `storiesCompleted` | `number` | 完成剧情数 |
| `enhancementsUnlocked` | `number` | 获得强化数 |
| `initsUnlocked` | `number` | 解锁世界线数 |
| `framesActive` | `number` | 活跃帧数 |

### 统计查询 DSL

**文件**：[[src/engine/stat-dsl.ts]]

受限函数库，如 `$GlobalProducedAmount base:resource:credit`。供条件 `stat` target 引用。

### record 同步钩子

由 StateMutationService 在 mutation 时同步调用：`recordResourceChange` / `recordItemChange` / `recordSpotLevel` / `recordEnhancementUnlocked` / `recordStoryCompleted` / `recordInitUnlocked` / `recordTick`

---

## 16. DevLog 运行时日志

**文件**：[[src/engine/dev-log.ts]]（196 行）

UI 面向的运行时追踪日志，verbose 模式用于开发期排障。

### 核心方法

| 方法 | 说明 |
|------|------|
| `record(message, options)` | 记录一条日志 |
| `recordEvent(event, frame?)` | 事件自动转日志 |
| `recordTick(result)` | 帧结算汇总（非 verbose 每 30 帧一条） |
| `getEntries()` | 获取日志条目 |
| `clear()` | 清空 |
| `export(meta?)` | 导出 JSON（按时间正序） |

---

## 17. Registry 数据包注册表

**文件**：[[src/engine/registry.ts]]（261 行）＋ [[src/engine/registry-validate.ts]]（139 行）

数据摄取与查询分层：registry.ts 持有主存储 / 关系索引 / 合并（merge）与运行时 Tag 增删；静态校验为纯函数 `validateDatapack()`（ID 唯一性、引用完整性、Extra 合法性），位于 registry-validate.ts（RegistryError 亦定义于此，registry.ts re-export 保持兼容）。

### 主存储

inits / areas / spots / enhancements / stories / items / dropTables / funcletDefs / characters / characterBonuses / resourceDisplays / tags / extras

### 关系索引

| 索引 | 说明 |
|------|------|
| `areasOfInit(initId)` | 查询 Init 下的所有 Area |
| `spotsOfArea(areaId)` | 查询 Area 下的所有 Spot |
| `spotsOfInit(initId)` | 查询 Init 下所有 Area 覆盖的 Spot |
| `spotsWithTag(tag)` | 查询拥有指定标签的 Spot（层级前缀匹配） |

### 校验项

- ID 唯一性
- 引用完整性（area→init、spot→area、defaultAreas/defaultSpots）
- Extra 合法性

### 运行时修改

`addSpotTag()` / `removeSpotTag()` 同步更新层级索引。
