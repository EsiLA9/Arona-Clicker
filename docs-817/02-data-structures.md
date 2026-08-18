# 02 — 关键数据结构

所有共享类型定义在 `src/engine/types.ts`（约 940 行）。实体定义用三段式 ID：`mod:idType:name`（如 `base:resource:credit`、`base:init:schale_office`）。

## 1. 运行时状态：PlayerState

`src/engine/types.ts:149`。所有可变状态集中于此，单一对象贯穿全引擎。

```
PlayerState
├─ 全局层（跨世界线保留）
│  ├─ globalResources?: {resId: number}      # 青辉石等，见 GLOBAL_RESOURCE_IDS
│  ├─ unlockedInits: InitId[]
│  ├─ visitedInits?: InitId[]                # 首次进入判定
│  ├─ extras?: ExtraCompound                 # 全局层额外数据（三层视图最高优先级）
│  └─ initSnapshots?: Record<InitId, InitSnapshot>  # 各世界线快照（软重启保存/恢复）
├─ per-Init 层（随世界线隔离，进 Init 快照）
│  ├─ resources: Record<string, number>
│  ├─ spotLevels: Record<SpotId, number>     # 0 = 未拥有
│  ├─ spotManagers: Record<SpotId, Character>
│  ├─ unlockedEnhancements: EnhancementId[]
│  ├─ inventory: Record<ItemId, number>
│  ├─ flags: Record<string, string>
│  ├─ storyLog: CompletedStory[]             # 跨 Run，全局完成记录
│  ├─ storyCooldowns?: Record<StoryId, number>
│  ├─ triggersCompleted?: string[]           # 已触发过的 once Trigger
│  ├─ visitedAreas?: AreaId[]
│  ├─ currentAreaId?: AreaId
│  ├─ totalFrames: number
│  ├─ initExtras?: ExtraCompound             # per-Init 层额外数据
│  └─ activeInit: InitId
```

要点：
- **资源读取合并**：`getResourceAmount()` = `globalResources[id] + resources[id]`（全局优先覆盖）。
- **global Spot**（`SpotDef.global=true`）等级/管理角色存于 per-Init 字段但跨世界线保留（进/出快照时特殊处理）。
- `game.getView()` 返回只读 `GameView` 快照供 UI 使用，不暴露写引用。

## 2. 数据包：Datapack

`types.ts:821`。一个 Datapack = 若干实体数组 + extras 常量表。

```
Datapack
├─ name / version
├─ inits: InitDef[]        # 世界线
├─ areas: AreaDef[]        # 区域（属于某 Init）
├─ spots: SpotDef[]        # 设施（属于某 Area）
├─ enhancements: EnhancementDef[]
├─ stories: StoryDef[]     # ActiveStoryDef | PassiveStoryDef
├─ items: ItemDef[]
├─ dropTables?: DropTableDef[]
├─ affectorPacks?: AffectorPackDef[]
├─ triggerDefs?: TriggerDef[]
├─ funcletDefs: FuncletDef[]
├─ characters / characterBonuses
├─ resourceDisplays?: ResourceDisplayDef[]
└─ extras?: Record<string, ExtraValue>   # 扁平键 → 展开为树，合并进全局常量树
```

加载：`Registry.load()` 先**校验**（ID 唯一、引用完整、Extra 合法）再**合并**到内存 Map。
支持多数据包叠加 + 运行时 `reload()`。

## 3. 核心实体定义（节选关键字段）

### InitDef（世界线）
`id/name/description` · `defaultAreas` · `enterEffects?: EntryEffectDef[]`（first/condition/effects）·
`startStoryId?` · `triggers?`（世界线专属，进入挂载/离开卸载）· `revealTriggers?` · `purchaseCost?`（收费解锁）· `extra?`

### AreaDef（区域）
`id/initId/name` · `defaultSpots` · `enterEffects?` · `adjacentAreaIds?`（有向邻接，移动规则）· `revealTriggers?` · `extra?`

### SpotDef（设施，放置经营的核心）
```
id/areaId/name/description
baseCost: ValueExpression / baseCostResource
baseYield: ValueExpression / baseYieldResource / baseCapacity
managerBonusYield: ValueExpression
levelUpgrades?: LevelUpgradeDef[]          # 逐级效果/花费
yieldPerLevel? / upgradeCostBase? / upgradeCostGrowth?   # 通用升级公式
maxLevel?
tags: TagPath[]                            # 层级标签（child 从属 parent）
global?: boolean                           # 跨世界线共享设施
revealTriggers?                            # existence → 是否出现；unlock → 自动解锁
functionalities?: SpotFunctionalityDef[]   # linearYield / restartInit / hardResetInit
extra?
```

### EnhancementDef（强化/购买物）
`effects` · `autoApply` · `maxStacks` · `price?: ResourceAmount[]` · `productionMultiplier?` + `productionTags?`
（对匹配 tag 的 Spot 产出的累乘倍率）· `attachment?`（UI 挂靠元数据）· `addsFunctionalities?`（外源功能注入）·
`affectorPackIds?`（持有即生效）· `revealTriggers?` · `extra?`

### StoryDef（剧情）
- `ActiveStoryDef`：主线/支线，`startStoryId` 或 `startActiveStory()` 触发，不可重复，无权重。
- `PassiveStoryDef`：随机闲聊，按 `weight` 抽选，`repeatable` / `cooldownFrames` / `completionReward`（first/repeat，发全局资源）。
- `StoryPage`：`text` · `speaker?` · `choices?` · `effects?` · `sendText?` · `clickWork?`（连续点击进度条）。

### ItemDef（物品）
`maxStack` · `rarity` · `type: consumable|material|key` · `useCondition/useEffects` · `pickupEffects` · `sellPrice` · `affectorPackIds`

### 其余
- **AffectorPackDef**：`id` + `entries: AffectorEffect[]`（condition + effects）+ `persistent`。挂载后由条件决定 Latent/Active。
- **TriggerDef**：`id` + `on: TriggerEventDef`（tick/resource/spotLevel/item/story/init/area）+ `condition` + `effects` + `once`。
- **FuncletDef**：命名参数化的可复用计算公式（`calc: ValueExpression`），供数值引用复用。
- **DropTableDef**：`entries`（权重抽选）+ `guaranteed`（保底）+ `maxRolls` + `condition`。

## 4. 数值表达式：ValueExpression / Value

数据包中所有"数值"几乎都是结构化的表达式，运行时由 ValueSystem 求值（见 03-§2）。

```
ValueExpression = { type:'const', value } | { type:'value', value: Value } | { type:'mul', left, right }
Value = { source: 'const'|'res'|'spotLevel'|'spotCount'|'managerCount'|'funclet'|'data', params: {...} }
```
构造器：`Expr.const/val/mul`、`value(...)`。

## 5. 条件：Condition / ConditionGroup

```
Condition = { target, key, comparator('=='|'!='|'>='|'<='|'>'|'<'), value: number }
ConditionGroup = { type:'AND'|'OR', conditions: (Condition|ConditionGroup)[] }
```
`target` 支持：`resource` `spotLevel` `manager` `flag` `hasEnh` `hasTag` `countTags` `stat`（DSL）`hasReadStory` `hasReadStoryInRun` `extra`。
构造器：`cond(...)`、`and(...)`、`or(...)`。

## 6. 效果：Effect

```
Effect = { op: EffectOp, target: string, value: number|string|boolean|ValueExpression|ExtraValue }
```
`EffectOp` 全集（`types.ts:295`）：
`setResource` `addResource` `setSpotLevel` `addSpotLevel` `setManager` `addEnhancement` `addItem` `loot`
`unlockInit` `setFlag` `triggerStory` `travelToArea`（剧情专用移动）`setSpotMaxLevel` `removeSpotMaxLevel`（Affector 专用）
`setExtra` `addExtra` `removeExtra`（写全局层额外数据）。

## 7. 额外数据：ExtraValue（类 NBT 树）

```
ExtraValue = { t:'int'|'float'|'str'|'bool'|'list'|'dict', v: ... }
```
- 便捷构造器：`extra.int/float/str/bool/list/dict`（`src/engine/extra.ts`）。
- **三层合并视图**（GameInstance.getExtra，`game-instance.ts:1570`）：全局层(PlayerState.extras) → per-Init 层(initExtras) → 数据包常量表(registry.extras)，命中即返回。
- 路径：`/` 分隔（如 `meta/author`），dict key 禁 `/`，list 用数字索引。
- 操作：`getAtPath` / `setAtPath` / `deleteAtPath` / `mergeExtra` / `expandFlatKeys`，深度上限 32。

## 8. 事件：GameEvent（联合类型）

`types.ts:966`。事件种类：`resourceChanged` `spotLevelChanged` `managerChanged` `enhancementAdded/Removed`
`itemCollected` `initEntered` `initUnlocked` `areaEntered` `storyTriggered` `storyCompleted` `tick` `flagChanged`
`extraChanged` `conditionGroupMet` `spotProduced` `spotTagChanged` `affectorMounted/StateChanged/Unmounted`。
每个事件可带 `stats?: StatsContext`（变更时点的三层统计摘要）。
