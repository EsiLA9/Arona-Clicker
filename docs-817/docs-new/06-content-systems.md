# 06 — 内容系统

## VisibilityEngine — 可见性引擎

四层可知性/可达性模型的第一层：**可见性**。

### 四层模型

```
可见性 (Visibility) → 揭示 (Reveal) → 可达性 (Accessibility) → 生效 (Active)
```

| 层级 | 控制方 | 含义 |
|------|--------|------|
| 可见性 | VisibilityEngine + revealTriggers 的 existence 目标 | 实体是否在 UI 中出现 |
| 揭示 | RevealDef (name / utility / effect) | 实体透露多少信息给玩家 |
| 可达性 | 游戏逻辑 | 玩家能否与实体交互 |
| 生效 | 满足条件且已被拥有 | 功能是否实际生效 |

### 核心方法

```typescript
class VisibilityEngine {
  /** 计算完整可见性快照 */
  compute(state: PlayerState): VisibilitySnapshot;

  /** 单个实体可见性检查 */
  isInitVisible(initId, state): boolean;
  isAreaVisible(areaId, state): boolean;
  isSpotVisible(spotId, state): boolean;
  isEnhancementVisible(enhId, state): boolean;
}

type VisibilitySnapshot = {
  inits: Record<string, boolean>;
  areas: Record<string, boolean>;
  spots: Record<string, boolean>;
  enhancements: Record<string, boolean>;
  items: Record<string, boolean>;
  stories: Record<string, boolean>;
}
```

### 规则

- 无 existence 门槛（`revealTriggers` 中无 `reveal: 'existence'`）的实体默认为**可见**
- 有条件则通过 `ConditionSystem.evaluateGroup(cond, state)` 判断（existence 门槛任一满足即可见）
- 所有实体类型共用同一个可见性判断框架

## TriggerSystem — 触发器系统

桥接 EventBus 事件与业务逻辑。数据包编辑者只需声明 TriggerDef。

### 生命周期

```typescript
class TriggerSystem {
  mount(def, group?)     // 挂载一个 Trigger（默认 global 组）
  load(defs[])           // 批量挂载
  unmount(id)            // 移除单个
  unmountGroup(group)    // 移除整组（场景：离开世界线时卸除专属 Trigger）
  clear()                // 清空全部
}
```

### 触发流程

```
EventBus 发射事件
  → TriggerSystem.onEvent(event)  // 注册在 EventBus.onAny
    → 遍历所有已挂载 Trigger（快照迭代，防止执行中动态修改）
      → matchesEvent(on, event)     // 事件类型匹配
      → !completed (if once)        // once 已完成则跳过
      → evaluateGroup(condition)    // 条件满足
      → fire(trigger)               // 执行
        → once 先落账再执行         // 避免级联重复触发
        → effectEngine.applyEffects(effects)
```

### 事件匹配规则 (matchesEvent)

| Event Type | 匹配规则 |
|------------|---------|
| `tick` | event.frame % every === 0 (if every) |
| `resource` | event.resource === on.resource (if on.resource) |
| `spotLevel` | event.spotId === on.spotId (if on.spotId) |
| `item` | event.itemId === on.itemId (if on.itemId) |
| `story` | event.storyId === on.storyId (if on.storyId) |
| `init` | event.initId === on.initId (if on.initId) |
| `area` | event.areaId === on.areaId (if on.areaId) |

### once 语义

- `once: true` 的 Trigger 在首次触发后将 ID 写入 `state.triggersCompleted`
- 卸载不会清除完成记录
- 重新挂载同 ID 且 once 已完成，不会再触发
- 读档时从 `state.triggersCompleted` 恢复

## LootSystem — 掉落抽选

基于权重的随机抽选系统。

### roll — 单次权重抽选

```typescript
roll(table: DropTableEntry[], state: PlayerState): Map<string, number>
```

1. 筛选满足条件的条目
2. 计算总权重
3. `Math.random() * totalWeight` 加权随机
4. 中选条目按 `[min, max]` 区间随机数量

### rollTable — 完整掉落表

```typescript
rollTable(tableId: string, state: PlayerState): Map<string, number>
```

1. 查表（表条件不满足则跳过）
2. 加入保底掉落
3. 执行 `maxRolls` 次 `roll()` 抽选
4. 合并重复物品数量

## CharacterSystem — 角色系统

管理角色数据、分配、加成计算。

### 核心方法

| 方法 | 说明 |
|------|------|
| `load(characters)` | 加载角色数据 |
| `loadBonuses(bonuses)` | 加载角色-Spot 加成表 |
| `get(id)` / `getAll()` | 查询角色 |
| `getBySchool(school)` | 按学院筛选 |
| `getByRarity(rarity)` | 按稀有度筛选 |
| `getUnlocked(state)` | 已解锁角色（管理员或 flag 标记） |
| `getAssignable(state)` | 可分配角色（已解锁未分配） |
| `getBonus(spotId, characterId)` | 获取角色对 Spot 的固定加成 |
| `getTagBonus(characterId, tag)` | 获取角色对标签的层级加成 |

### 解锁判定

角色通过以下方式标记为"已解锁"：
1. 被分配到 Spot 作为管理员（`state.spotManagers` 包含该角色）
2. 存在 `flags['char_unlock_{characterId}'] === 'true'`

### 标签加成 (spotTagBonus)

角色的 `spotTagBonus` 是一个 `Record<string, number>`，key 为标签路径。

- `getTagBonus(character, spotTag)` 使用 `matchesTag` 层级前缀匹配
- 匹配的 key 对应的值相乘得出最终加成倍率

## SpotFunctionalitySystem — Spot 功能

管理 Spot 附带的特殊功能。功能分为两种来源：

### 内源 (spot.functionalities)

Spot 自身声明的功能，如重启世界线的入口。

### 外源 (enhancement.addsFunctionalities)

已获得 Enhancement 注入到标签匹配的 Spot 的功能。

```typescript
// 外源匹配逻辑：
if (enh.productionTags 非空
    && enh.productionTags 中没有一个 prefix 命中 spot.tags 中任何一个 declared)
  → 不注入
else
  → 注入
```

### 功能类型

| kind | 说明 | 作用方式 |
|------|------|---------|
| `linearYield` | 持续产出加成 | 每帧结算 `level * amountPerLevel` 的额外产量 |
| `restartInit` | 软重启入口 | UI 展示交互按钮 |
| `hardResetInit` | 硬重置入口 | UI 展示交互按钮 |

### 核心方法

```typescript
functionalitiesOf(spot, state)   // Spot 的全部生效功能（内源 + 外源）
hasFunctionality(spot, state, kind)  // 是否有某类功能
extraYields(spot, level, state)      // 功能带来的额外产量
```
