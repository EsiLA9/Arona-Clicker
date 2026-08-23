# 02 — Data Structures 数据结构

所有共享类型定义在 `src/engine/types/` 目录，由 `[[src/engine/types/index.ts]]` re-export。实体 ID 采用三段式格式：`mod:idType:name`（如 `base:resource:credit`）。

---

## 1. PlayerState 运行时状态

**定义位置**：[[src/engine/types/state.ts]]

所有可变状态集中于此，单一对象贯穿全引擎。

### 全局层（跨世界线保留）

| 字段 | 类型 | 说明 |
|------|------|------|
| `globalResources` | `Record<string, number>` | 全局资源（如青辉石），不受 Init 切换影响 |
| `unlockedInits` | `InitId[]` | 已解锁的世界线列表 |
| `visitedInits` | `InitId[]` | 已进入过的 Init（首次进入判定） |
| `extras` | `ExtraCompound` | 全局层额外数据（三层视图最高优先级） |
| `initSnapshots` | `Record<InitId, InitSnapshot>` | 各世界线快照（软重启保存/恢复） |

### per-Init 层（随世界线隔离）

| 字段 | 类型 | 说明 |
|------|------|------|
| `resources` | `Record<string, number>` | 当前世界线资源 |
| `spotLevels` | `Record<SpotId, number>` | 设施等级（0 = 未拥有） |
| `spotManagers` | `Record<SpotId, Character>` | 设施管理角色 |
| `unlockedEnhancements` | `EnhancementId[]` | 已获得的强化 |
| `inventory` | `Record<ItemId, number>` | 背包物品 |
| `flags` | `Record<string, string>` | 自定义标记 |
| `storyLog` | `CompletedStory[]` | 已完成的剧情（跨 Run，全局） |
| `storyReadLogs` | `Record<StoryId, StoryReadLog>` | 按 Story.id 的阅读日志（重阅读/分歧守卫） |
| `triggersCompleted` | `string[]` | 已触发过的 once Trigger |
| `visitedAreas` | `AreaId[]` | 已访问过的 Area |
| `currentAreaId` | `AreaId` | 当前所在 Area |
| `totalFrames` | `number` | 总帧数 |
| `initExtras` | `ExtraCompound` | per-Init 层额外数据 |
| `activeInit` | `InitId` | 当前激活的世界线 |

### 资源读取合并

`getResourceAmount()` = `globalResources[id] + resources[id]`（全局优先覆盖）。

### InitSnapshot 快照

**定义位置**：[[src/engine/types/state.ts]]

软重启时保存，重新进入时恢复。包含 per-Init 层全部数据。global Spot 的等级/管理角色不写入快照（跨世界线保留）。

---

## 2. Datapack 数据包

**定义位置**：[[src/engine/types/entities.ts]]

一个 Datapack = 若干实体数组 + extras 常量表：

| 字段                 | 类型                           | 必填  |
| ------------------ | ---------------------------- | --- |
| `name`             | `string`                     | Yes |
| `version`          | `string`                     | Yes |
| `inits`            | `InitDef[]`                  | Yes |
| `areas`            | `AreaDef[]`                  | Yes |
| `spots`            | `SpotDef[]`                  | Yes |
| `enhancements`     | `EnhancementDef[]`           | Yes |
| `storyEntries`     | `StoryEntryDef[]`            | Yes |
| `stories`          | `StoryDef[]`                 | Yes |
| `items`            | `ItemDef[]`                  | Yes |
| `dropTables`       | `DropTableDef[]`             | No  |
| `affectorPacks`    | `AffectorPackDef[]`          | No  |
| `triggerDefs`      | `TriggerDef[]`               | No  |
| `funcletDefs`      | `FuncletDef[]`               | Yes |
| `characters`       | `CharacterData[]`            | Yes |
| `characterBonuses` | `CharacterBonusTable[]`      | Yes |
| `resourceDisplays` | `ResourceDisplayDef[]`       | No  |
| `tags`             | `TagDef[]`                   | No  |
| `extras`           | `Record<string, ExtraValue>` | No  |

加载：[[src/engine/registry.ts]] `load()` 先校验（ID 唯一、引用完整、Extra 合法）再合并到内存 Map。

---

## 3. 实体定义

### InitDef（世界线）

**定义位置**：[[src/engine/types/entities.ts]]

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `InitId` | 三段式 ID |
| `name` | `string` | 显示名 |
| `description` | `string` | 描述 |
| `defaultAreas` | `AreaId[]` | 默认区域列表 |
| `enterEffects` | `EntryEffectDef[]` | 进入条目（first/condition/effects） |
| `startStoryId` | `StoryId` | 自动展开的起始剧情 |
| `triggers` | `TriggerDef[]` | 世界线专属 Trigger（进入挂载/离开卸载） |
| `revealTriggers` | `RevealTrigger[]` | 揭示 Trigger 列表 |
| `purchaseCost` | `ResourceAmount[]` | 购买费用（空=免费） |
| `extra` | `ExtraCompound` | 额外数据 |

### AreaDef（区域）

**定义位置**：[[src/engine/types/entities.ts]]

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `AreaId` | 三段式 ID |
| `initId` | `InitId` | 所属世界线 |
| `name` | `string` | 显示名 |
| `description` | `string` | 描述 |
| `defaultSpots` | `SpotId[]` | 默认设施 |
| `enterEffects` | `EntryEffectDef[]` | 进入条目 |
| `adjacentAreaIds` | `AreaId[]` | 可达的相邻 Area（有向） |
| `revealTriggers` | `RevealTrigger[]` | 揭示 Trigger 列表 |
| `extra` | `ExtraCompound` | 额外数据 |

### SpotDef（设施）

**定义位置**：[[src/engine/types/entities.ts]]

放置经营的核心实体：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `SpotId` | 三段式 ID |
| `areaId` | `AreaId` | 所属区域 |
| `name` | `string` | 显示名 |
| `description` | `string` | 描述 |
| `baseCost` | `ValueExpression` | 基础花费 |
| `baseCostResource` | `string` | 花费资源 ID |
| `baseYield` | `ValueExpression` | 基础产出 |
| `baseYieldResource` | `string` | 产出资源 ID |
| `baseCapacity` | `number` | 容量上限 |
| `managerBonusYield` | `ValueExpression` | Manager 额外产出 |
| `levelUpgrades` | `LevelUpgradeDef[]` | 逐级效果/花费 |
| `yieldPerLevel` | `number` | 每级线性产出增量 |
| `upgradeCostBase` | `number` | 通用升级基础花费 |
| `upgradeCostGrowth` | `number` | 通用升级花费增长因子 |
| `maxLevel` | `number` | 等级上限 |
| `tags` | `TagPath[]` | 层级标签 |
| `global` | `boolean` | 跨世界线共享设施 |
| `revealTriggers` | `RevealTrigger[]` | 揭示 Trigger 列表 |
| `functionalities` | `SpotFunctionalityDef[]` | Spot 功能定义 |
| `extra` | `ExtraCompound` | 额外数据 |

### EnhancementDef（强化）

**定义位置**：[[src/engine/types/entities.ts]]

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `EnhancementId` | 三段式 ID |
| `name` | `string` | 显示名 |
| `description` | `string` | 描述 |
| `effects` | `Effect[]` | 获得时效果 |
| `autoApply` | `boolean` | 自动应用 |
| `price` | `ResourceAmount[]` | 购买花费 |
| `productionMultiplier` | `number` | Spot 产出倍率 |
| `productionTags` | `TagPath[]` | 作用范围（tag 匹配） |
| `attachment` | `EnhancementAttachment` | 挂靠元数据（UI 位置） |
| `addsFunctionalities` | `SpotFunctionalityDef[]` | 外源功能注入 |
| `affectorPackIds` | `string[]` | 持有即生效的 Affector |
| `revealTriggers` | `RevealTrigger[]` | 揭示 Trigger 列表 |
| `extra` | `ExtraCompound` | 额外数据 |

### StoryEntryDef（剧情触发入口）

**定义位置**：[[src/engine/types/entities.ts]]

联合类型 = `ActiveStoryEntry` | `PassiveStoryEntry`。

职责：只负责「何时何地可触发」与「入口揭示」。**对外故事 id（`startStoryId` / `hasReadStory` / `triggerStory` / `storyTriggered` event 均引用本表 id）**；演出本体经 `storyId` 重定向到 `stories` 表。当前 Entry.id 与 Story.id 1:1 同值，未来允许多 Entry 复用同一 Story。

**ActiveStoryEntry**：主线/支线，`startStoryId` 或 `startActiveStory()` 触发，不可重复。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `StoryId` | 三段式 ID（对外故事 id） |
| `storyId` | `StoryId` | 演出本体引用（stories 表） |
| `type` | `'active'` | 类型标识 |
| `availableInits` | `InitId[]` | 可触发的初始场景 |
| `triggerCondition` | `ConditionGroup` | 触发条件 |
| `revealTriggers` | `RevealTrigger[]` | 揭示 Trigger 列表（名称遮挡归 Entry） |
| `replayable` | `boolean` | 是否允许重阅读（replayStory 入口） |
| `completionStrategy` | `'simple' \| 'conditional'` | 完结奖励策略（缺省 simple） |
| `conditionalRewards` | `ConditionalReward[]` | 条件分支奖励（conditional 时按序评估，首个满足生效） |
| `branchGuards` | `BranchGuard[]` | 重阅读分歧点准入守卫 |
| `extra` | `ExtraCompound` | 额外数据 |

**PassiveStoryEntry**：随机闲聊，按 `weight` 抽选。

额外字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `repeatable` | `boolean` | 是否允许多次触发 |
| `weight` | `number` | 抽选权重 |
| `completionReward` | `{ first?: Effect[]; repeat?: Effect[] }` | 完结奖励（simple 策略；conditional 时被 conditionalRewards 替代） |

### StoryDef（剧情演出本体）

**定义位置**：[[src/engine/types/entities.ts]]

纯演出，不含任何触发/揭示逻辑。仅保留自身 id 供日志记录（`storyLog` / `storyReadLogs` 均按 Story.id 记），
支持通过 Talklet / StoryChoice 的 `jumpToStory` 跨 Story 跳转（详见 [[10-story-graph]]）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `StoryId` | 三段式 ID（与 Entry.id 当前 1:1 同值） |
| `name` | `string` | 显示名 |
| `talklets` | `Talklet[]` | 演示片段列表（内嵌，不可跨故事复用） |
| `extra` | `ExtraCompound` | 额外数据 |

### Talklet（微小演示片段）

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 对话文本 |
| `speaker` | `string` | 说话人 |
| `choices` | `StoryChoice[]` | 选项 |
| `effects` | `Effect[]` | 页面效果 |
| `sendText` | `string` | 回复按钮文案 |
| `clickWork` | `{ base: number; rand?: number }` | 点击工作（连续点击进度条） |
| `jumpToStory` | `StoryId` | 离开本页后跳转到另一 Story |
| `jumpMode` | `'goto' \| 'insert'` | 跳转模式（缺省 goto） |

**StoryChoice** 额外支持 `jumpToStory` / `jumpMode`（选择后跳转）。

### ItemDef（物品）

**定义位置**：[[src/engine/types/entities.ts]]

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `ItemId` | 三段式 ID |
| `name` | `string` | 显示名 |
| `description` | `string` | 描述 |
| `maxStack` | `number` | 最大堆叠 |
| `rarity` | `'common' \| 'rare' \| 'epic' \| 'legendary'` | 稀有度 |
| `type` | `'consumable' \| 'material' \| 'key'` | 类型 |
| `useCondition` | `ConditionGroup` | 使用条件 |
| `useEffects` | `Effect[]` | 使用效果 |
| `pickupEffects` | `Effect[]` | 拾取效果 |
| `sellPrice` | `ResourceAmount` | 售价 |
| `affectorPackIds` | `string[]` | 持有即生效的 Affector |

### TriggerDef（触发器）

**定义位置**：[[src/engine/types/entities.ts]]

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 唯一 ID |
| `on` | `TriggerEventDef` | 侦测事件模式 |
| `condition` | `Condition \| ConditionGroup` | 附加条件 |
| `effects` | `Effect[]` | 执行效果 |
| `once` | `boolean` | 一次性触发（默认 true） |

**TriggerEventDef** 侦测来源：

| kind | 说明 | 特殊字段 |
|------|------|----------|
| `tick` | 每帧检查 | `every?: number`（帧间隔） |
| `resource` | 资源变化 | `resource?: string` |
| `spotLevel` | 设施等级变化 | `spotId?: string` |
| `item` | 物品变化 | `itemId?: string` |
| `story` | 剧情完成 | `storyId?: string` |
| `init` | 进入世界线 | `initId?: string` |
| `area` | 进入区域 | `areaId?: string` |

### AffectorPackDef（持续效果包）

**定义位置**：[[src/engine/types/entities.ts]]

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 唯一 ID |
| `entries` | `AffectorEffect[]` | 效果条目（condition + effects） |
| `persistent` | `boolean` | 是否持久 |
| `extra` | `ExtraCompound` | 额外数据 |

### DropTableDef（掉落表）

**定义位置**：[[src/engine/types/entities.ts]]

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 唯一 ID |
| `entries` | `DropTableEntry[]` | 权重抽选条目 |
| `guaranteed` | `{ itemId; count }[]` | 保底物品 |
| `maxRolls` | `number` | 最大抽选次数 |
| `condition` | `ConditionGroup` | 触发条件 |

### FuncletDef（命名公式）

**定义位置**：[[src/engine/types/entities.ts]]

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `FuncletId` | 唯一 ID |
| `description` | `string` | 描述 |
| `params` | `{ name; type }[]` | 参数列表 |
| `calc` | `ValueExpression` | 计算公式 |

### CharacterData（角色）

**定义位置**：[[src/engine/types/entities.ts]]

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `Character` | 角色枚举 |
| `name` | `string` | 名称 |
| `displayName` | `string` | 显示名 |
| `school` | `CharacterSchool` | 学校 |
| `rarity` | `CharacterRarity` | 稀有度 |
| `description` | `string` | 描述 |
| `spotTagBonus` | `Record<string, number>` | 对特定标签 Spot 的产出加成倍率 |
| `passiveDescription` | `string` | 全局效果描述 |

---

## 4. 数值表达式

### ValueExpression

**定义位置**：[[src/engine/types/expression.ts]]

```
ValueExpression =
  | { type: 'const'; value: number }
  | { type: 'value'; value: Value }
  | { type: 'mul'; left: ValueExpression; right: ValueExpression }
```

构造器：`Expr.const(v)` / `Expr.val(v)` / `Expr.mul(l, r)`

### Value

**定义位置**：[[src/engine/types/expression.ts]]

```
Value = { type: 'value'; source: ValueSource; params: Record<string, string | number> }
```

`ValueSource` 来源：

| source | 说明 |
|--------|------|
| `const` | 常量（params.value） |
| `res` | 读 state.resources（params.resource） |
| `spotLevel` | 读设施等级（params.spot） |
| `spotCount` | 某 Area 已拥有数量（params.area，前缀匹配） |
| `managerCount` | 某 Init 已分配的不同 Manager 数（params.init） |
| `data` | 读 Extra 三层视图（params.path） |
| `funclet` | 调用命名公式（params.funclet + 参数） |

---

## 5. 条件系统

### Condition

**定义位置**：[[src/engine/types/expression.ts]]

```
Condition = {
  target: ConditionTarget;
  key: string;
  comparator: '==' | '!=' | '>=' | '<=' | '>' | '<';
  value: number;
}
```

构造器：`cond(target, key, comparator, value)`

### ConditionTarget

| target | 说明 | key 语义 |
|--------|------|----------|
| `resource` | 资源持有量 | resourceId |
| `spotLevel` | 设施等级 | spotId |
| `manager` | 是否已分配 Manager | spotId |
| `flag` | 自定义标记 | flag name |
| `hasEnh` | 是否拥有强化 | enhancementId |
| `hasTag` | 是否拥有带该 tag 的 Spot | tag name |
| `countTags` | 带该 tag 的 Spot 数量 | tag name |
| `stat` | 统计函数 DSL | `$FunctionName 参数...` |
| `hasReadStory` | 是否完成过剧情（跨 Run） | storyId |
| `hasReadStoryInRun` | 是否在当前 Run 完成过 | storyId |
| `extra` | Extra 三层视图数值比较 | ExtraPath |

### ConditionGroup

```
ConditionGroup = { type: 'AND' | 'OR'; conditions: (Condition | ConditionGroup)[] }
```

构造器：`and(...conditions)` / `or(...conditions)`

---

## 6. 效果系统

### Effect

**定义位置**：[[src/engine/types/expression.ts]]

```
Effect = {
  op: EffectOp;
  target: string;
  value: number | string | boolean | ValueExpression | ExtraValue;
}
```

### EffectOp 全集

| op | 说明 |
|----|------|
| `setResource` | 设置资源值 |
| `addResource` | 增加资源值 |
| `setSpotLevel` | 设置设施等级 |
| `addSpotLevel` | 增加设施等级 |
| `setManager` | 设置 Manager |
| `addEnhancement` | 获得强化 |
| `addItem` | 获得物品 |
| `loot` | 执行掉落表 |
| `unlockInit` | 解锁世界线 |
| `setFlag` | 设置标记 |
| `triggerStory` | 触发剧情 |
| `travelToArea` | 移动到区域（剧情专用） |
| `setSpotMaxLevel` | 设置设施等级上限（Affector 专用） |
| `removeSpotMaxLevel` | 解除设施等级限制（最高优先级） |
| `setExtra` | 写 Extra 全局层 |
| `addExtra` | Extra 全局层数值增量 |
| `removeExtra` | 删除 Extra 全局层节点 |

---

## 7. Extra 额外数据系统

### ExtraValue

**定义位置**：[[src/engine/types/extra.ts]]

树形额外数据节点（类 NBT）：

```
ExtraValue =
  | { t: 'int'; v: number }
  | { t: 'float'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'list'; v: ExtraValue[] }
  | { t: 'dict'; v: Record<string, ExtraValue> }
```

便捷构造器（[[src/engine/extra.ts]]，聚合出口）：`extra.int()` / `extra.float()` / `extra.str()` / `extra.bool()` / `extra.list()` / `extra.dict()`

> 实现按关注点拆分：[[src/engine/extra-core.ts]]（常量/错误/守卫/构造）、extra-construct（fromJson/clone）、[[src/engine/extra-path.ts]]（路径寻址）、[[src/engine/extra-merge.ts]]（合并/展开）、[[src/engine/extra-read.ts]]（宽松读取）、[[src/engine/extra-validate.ts]]（校验）。`from './extra'` 全项目兼容。

### 三层合并视图

读取优先级：**全局层** (PlayerState.extras) → **per-Init 层** (initExtras) → **数据包常量表** (Registry.extras)

实现在 [[src/engine/game-instance.ts]] `getExtra()` 方法。

### 路径格式

`/` 分隔（如 `meta/author`），dict key 禁 `/`，list 用数字索引。

操作函数（[[src/engine/extra.ts]]）：`getAtPath()` / `setAtPath()` / `deleteAtPath()` / `mergeExtra()` / `expandFlatKeys()`

---

## 8. GameEvent 事件

**定义位置**：[[src/engine/types/events.ts]]

| 事件类型 | 携带数据 |
|----------|----------|
| `resourceChanged` | resource, delta, newValue |
| `spotLevelChanged` | spotId, newLevel |
| `managerChanged` | spotId, newManager |
| `enhancementAdded` | enhancementId |
| `enhancementRemoved` | enhancementId |
| `itemCollected` | itemId, count, newTotal |
| `initEntered` | initId |
| `initUnlocked` | initId |
| `areaEntered` | areaId, fromAreaId |
| `storyTriggered` | storyId |
| `storyCompleted` | storyId |
| `tick` | frame |
| `flagChanged` | flag, value |
| `extraChanged` | path, value? |
| `conditionGroupMet` | triggerId |
| `spotProduced` | spotId, resource, amount |
| `spotTagChanged` | spotId, tag, added |
| `affectorMounted` | instanceId, packId, mountEntityId |
| `affectorStateChanged` | instanceId, oldState, newState |
| `affectorUnmounted` | instanceId, reason |

每个事件可带 `stats?: StatsContext`（变更时点的三层统计摘要）。

---

## 9. 操作返回结果

**定义位置**：[[src/engine/types/results.ts]]

| 类型 | 说明 |
|------|------|
| `TickResult` | 帧结算结果（frame + productions） |
| `UseItemResult` | 物品使用结果 |
| `TravelResult` | 移动结果 |
| `EnhancementPurchaseResult` | 强化购买结果 |
| `SpotUnlockResult` | 设施解锁结果 |
| `SpotUpgradeResult` | 设施升级结果 |
| `StoryStartResult` | 剧情启动结果 |
| `StoryAdvanceResult` | 剧情推进结果 |
| `SendState` | 回复按钮状态 |
| `SendResult` | 回复按钮点击结果 |
| `InitPurchaseResult` | 世界线购买结果 |

---

## 10. AccessStage 可知性层级

**定义位置**：[[src/engine/types/entities.ts]]

```
hidden → obfuscated → revealed → accessible → active
```

| 层级 | 含义 |
|------|------|
| `hidden` | 实体不出现（revealTriggers 的 existence 门槛不满足） |
| `obfuscated` | 可见但数值以 ??? 遮挡（未满足揭示条件） |
| `revealed` | 可见且数值完整展示 |
| `accessible` | 可进入/解锁/使用 |
| `active` | 运行时持续生效（Affector / Trigger / Spot 功能） |
