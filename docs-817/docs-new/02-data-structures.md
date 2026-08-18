# 02 — 数据结构

## 核心 ID 类型

所有实体 ID 均为 string 类型别名，命名格式为 `{namespace}:{type}:{name}`：

```typescript
type InitId        = string;  // "base:init:schale_office"
type AreaId        = string;  // "base:area:schale_main"
type SpotId        = string;  // "base:spot:schale_desk"
type EnhancementId = string;  // "base:enh:test_and"
type StoryId       = string;  // "base:story:schale_welcome"
type ItemId        = string;  // "base:item:energy_drink"
```

## 资源枚举

```typescript
enum Resource {
  Credit   = 'base:resource:credit',
  Pyroxene = 'base:resource:pyroxene',
}
```

## 定义层 (Def) — 数据包中的静态内容

所有 Def 由数据包（`src/data/base/*.ts`）定义，加载到 Registry 后只读。

### InitDef — 世界线

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | InitId | 唯一标识 |
| `name` | string | 显示名称 |
| `description` | string | 描述文本 |
| `defaultAreas` | AreaId[] | 初始默认区域 |
| `revealTriggers?` | RevealTrigger[] | 揭示 Trigger 列表；`existence` 目标即可见性条件（原 `visibilityCondition`） |
| `reveal?` | RevealDef | 揭示阶段定义（name / utility / effect） |
| `globalEnhancements?` | EnhancementId[] | 世界线内始终生效的 Enhancement |
| `onEnterEffects?` | GameEffect[] | 进入世界线时执行的效果 |
| `onExitEffects?` | GameEffect[] | 离开世界线时执行的效果 |

### AreaDef — 区域

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | AreaId | 唯一标识 |
| `initId` | InitId | 所属世界线 |
| `name` | string | 显示名称 |
| `description` | string | 描述 |
| `defaultSpots` | SpotId[] | 区域默认包含的 Spot |
| `adjacentAreaIds` | AreaId[] | 相邻区域 |
| `revealTriggers?` | RevealTrigger[] | 揭示 Trigger 列表；`existence` 目标即可见性条件（原 `visibilityCondition`） |
| `reveal?` | RevealDef | 揭示阶段 |

### SpotDef — 设施

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | SpotId | 唯一标识 |
| `areaId` | AreaId | 所属区域 |
| `name` | string | 显示名称 |
| `description` | string | 描述 |
| `baseCost` | Expr | 解锁成本（表达式） |
| `baseCostResource` | Resource | 成本资源类型 |
| `baseYield` | Expr | 基础产出量（表达式） |
| `baseYieldResource` | Resource | 产出资源类型 |
| `baseCapacity` | number | 容量上限 |
| `managerBonusYield` | Expr | 管理员加成产量（表达式） |
| `tags` | TagPath[] | 标签数组，用于 Enhancement 匹配 |
| `functionalities?` | SpotFunctionalityDef[] | 特殊功能（内源） |
| `levelUpgrades?` | SpotLevelUpgrade[] | 升级配置 |
| `revealTriggers?` | RevealTrigger[] | 揭示 Trigger 列表；`existence` 目标即可见性条件（原 `visibilityCondition`） |
| `reveal?` | RevealDef | 揭示阶段 |

**Spot 等级系统**：
- 等级 0: 未解锁
- 等级 1: 已解锁（基础）
- 等级 2+: 已升级
- 升级通过 `levelUpgrades` 配置，每次升级有独立的 `cost` 和 `effects`

### EnhancementDef — 增强

| 字段                       | 类型                     | 说明                                |
| ------------------------ | ---------------------- | --------------------------------- |
| `id`                     | EnhancementId          | 唯一标识                              |
| `name`                   | string                 | 显示名称                              |
| `description`            | string                 | 描述                                |
| `revealTriggers?`        | RevealTrigger[]        | 揭示 Trigger 列表（`unlock` 目标 = 实际解锁条件） |
| `effects`                | GameEffect[]           | 解锁时执行的效果                          |
| `autoApply?`             | boolean                | 是否自动应用（条件满足时自动购买）                 |
| `productionMultiplier?`  | number                 | 产出倍率（作用于 productionTags 匹配的 Spot） |
| `productionTags?`        | TagPath[]              | 产出倍率作用范围（空 = 全局，有值 = 层级前缀匹配）      |
| `consumptionMultiplier?` | number                 | 消耗倍率                              |
| `price?`                 | PriceItem[]            | 购买价格                              |
| `attachment?`            | EnhancementAttachment  | 挂载到特定 Area 或 Spot                 |
| `addsFunctionalities?`   | SpotFunctionalityDef[] | 注入到匹配 Spot 的外部功能                  |
| `revealTriggers?`           | RevealTrigger[]         | 揭示 Trigger 列表；`existence` 目标即可见性条件（原 `visibilityCondition`） |

**Enhancement 的生命周期**：
1. 可见 → 2. 揭示 → 3. 条件满足可解锁 → 4. 购买/自动应用 → 5. 进入 `state.unlockedEnhancements` → 6. 倍率/功能生效

### StoryDef — 剧情

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | StoryId | 唯一标识 |
| `name` | string | 标题 |
| `type` | 'active' \| 'passive' | active = 主动触发（玩家选择），passive = 被动触发（随机出现） |
| `triggerCondition` | ConditionGroup | 触发条件 |
| `repeatable` | boolean | 是否可重复 |
| `cooldownFrames` | number | 冷却帧数 |
| `weight` | number | 随机权重（passive 类型） |
| `availableInits` | InitId[] | 可用世界线 |
| `pages` | StoryPage[] | 对话页数组 |

**StoryPage（对话页）**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `speaker?` | string | 说话者名称 |
| `text` | string | 对话文本 |
| `sendText?` | string | MomoTalk 回复文本 |
| `choices?` | StoryChoice[] | 分支选择 |
| `effects?` | GameEffect[] | 页面结算效果 |
| `condition?` | ConditionGroup | 页面条件 |

### ItemDef — 物品

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | ItemId | 唯一标识 |
| `name` | string | 名称 |
| `description` | string | 描述 |
| `maxStack` | number | 最大堆叠数 |
| `rarity` | 'common' \| 'rare' \| 'epic' \| 'legendary' | 稀有度 |
| `type` | 'consumable' \| 'material' \| 'key' \| 'equipment' | 物品类型 |
| `useEffects?` | GameEffect[] | 使用效果 |
| `affectorPackIds?` | string[] | 附加的 Affector 包 |
| `revealTriggers?` | RevealTrigger[] | 揭示 Trigger 列表；`existence` 目标即可见性条件（原 `visibilityCondition`） |

### DropTableDef — 掉落表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识 |
| `maxRolls` | number | 抽选次数 |
| `guaranteed?` | { itemId, count }[] | 保底掉落 |
| `entries` | DropTableEntry[] | 抽选条目 |
| `condition?` | ConditionGroup | 掉落表条件 |

**DropTableEntry**：`{ itemId, min, max, weight, condition? }`

### TriggerDef — 触发器

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识 |
| `on` | TriggerEventDef | 监听事件模式 |
| `condition?` | ConditionGroup | 附加条件 |
| `effects` | GameEffect[] | 执行效果 |
| `once` | boolean | 是否仅触发一次 |

**TriggerEventDef 支持的 kind**：
- `tick` — 每帧或每 N 帧
- `resource` — 资源变化
- `spotLevel` — Spot 等级变化
- `item` — 物品获得
- `story` — 剧情完成
- `init` — 进入世界线
- `area` — 进入区域

### CharacterData — 角色

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Character | 角色枚举 |
| `name` | string | 显示名称 |
| `school` | CharacterSchool | 所属学院 |
| `rarity` | CharacterRarity | N / R / SR / SSR |
| `spotTagBonus?` | Record<string, number> | 对特定标签的 Spot 加成倍率 |

## 运行时状态 (PlayerState)

```typescript
interface PlayerState {
  // 基础
  totalFrames: number;                  // 总帧数
  activeInit: InitId | null;            // 当前世界线
  currentAreaId: AreaId | null;         // 当前位置（区域）

  // 资源
  resources: Record<string, number>;    // 当前资源量

  // Spot 状态
  spotLevels: Record<SpotId, number>;   // 各 Spot 等级 (0 = 未解锁)
  spotManagers: Record<SpotId, Character>;  // 各 Spot 的管理员角色

  // 容量与存储
  spotCapacities: Record<SpotId, number>;   // 各 Spot 当前容量
  spotStored: Record<SpotId, number>;       // 各 Spot 已存储量

  // 解锁状态
  unlockedInits: InitId[];              // 已解锁的世界线
  unlockedAreas: AreaId[];             // 已解锁的区域
  unlockedEnhancements: EnhancementId[]; // 已获得的增强

  // 故事
  completedStories: StoryId[];          // 已完成的故事

  // 背包
  inventory: Record<ItemId, number>;    // 物品数量

  // 冷却
  cooldowns: Record<CooldownId, number>; // 冷却剩余帧数

  // 标记
  flags: Record<string, string>;        // 通用标记键值对

  // 触发器
  triggersCompleted?: string[];         // 已完成的 once 触发器 ID

  // 当前故事播放状态
  activeStory?: { storyId, pageIndex };
}
```

## 表达式系统 (Expr)

表达式以 JSON 结构内联在数据定义中，支持：

```typescript
// 常量: { type: 'const', value: 10 }
// 变量:
//   - 资源: { type: 'var', key: 'base:resource:credit' }
//   - Spot 等级: { type: 'var', key: 'base:spot:schale_desk', field: 'level' }
//   - 标志: { type: 'var', key: 'myflag', field: 'flag' }
// 运算: { type: 'add'|'mul'|'sub'|'div'|'max'|'min', args: Expr[] }
```

## 标签系统 (TagPath)

TagPath = `string[]`，每个元素为标签名的一部分。

- `tagPath('a', 'b')` = `['a', 'b']`
- `tagDisplay(['a', 'b'])` = `'a/b'`
- `matchesTag` 支持层级前缀匹配：`['office', 'desk']` 命中查询 `['office']`

用途：
- Spot 声明标签：定义其类别
- Enhancement.productionTags：定义倍率作用范围
- Character.spotTagBonus：角色对特定标签 Spot 的加成
