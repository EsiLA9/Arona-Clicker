# Visibility（统一可见性系统）

## 概念

游戏中所有实体（Init / Area / Spot / Enhancement / ActiveStoryEntry / PassiveStoryEntry）共享一套统一的 5 级可见性，控制玩家能"看"到实体的什么程度。

```
Lv.0 Unknown      玩家完全不知道此实体存在
Lv.1 Known        知晓存在（列表占位/灰色图标/???
Lv.2 NameShown    展示名称
Lv.3 DescShown    展示名称 + 介绍文字
Lv.4 Purchasable  可购买/可获取（交互按钮激活）
Lv.5 Fetched      已获得（player already owns this）
```

可见性等级**累积不可逆**，达到 Lv.3 意味着 Lv.1 和 Lv.2 的信息也自动满足。

## 数据模型

### 实体定义上的可见性条件

每个实体通过 `visibility` 字段声明各等级的触发条件。Level 5（Fetched）不由 Condition 驱动，而是实体的获取/购买操作写入。

```typescript
// 各实体 Definition 新增字段：
visibility?: {
  // 1-4 级各自的条件。缺省 = 不设条件，该级永不自动触发
  1?: Condition
  2?: Condition
  3?: Condition
  4?: Condition
}
```

### Instance 上的持久化状态

```typescript
// PlayerState 新增字段：
visibilityState: Record<string, VisibilityLevel>
// FullKey → 当前已达到的最高等级（0-5）
// 由 Condition-Trigger 写入，Effect 也可直接提升
```

### 实体自身状态的 isFetched 统一接口

每个实体类型的运行时状态统一提供 `isFetched` 字段（或其等价语义），避免"实体出现 = 自动获得"的陷阱：

```typescript
// 各实体状态中的等效字段：
// SpotState.level > 0          ↔ isFetched == true
// EnhancementState.level > 0   ↔ isFetched == true
// AreaState.unlocked == true   ↔ isFetched == true
// StoryInstance.triggerCount > 0  ↔ isFetched == true
// Init (completedInits)        ↔ isFetched == true

// 引擎提供统一接口：
function isFetched(fullKey: string, player: PlayerState): boolean
function getVisibility(fullKey: string, player: PlayerState): VisibilityLevel
function setVisibility(fullKey: string, level: VisibilityLevel, player: PlayerState): void
```

## 可见性来源

可见性来自两条路径：

### 来源 A：自身 Condition（Trigger 驱动）

实体定义上的 `visibility` 条件通过 EventBus-Trigger 机制绑定：

```
1. 引擎扫描所有实体的 visibility 条件
2. 对每个非 always 条件，创建 EventBus Trigger（一次性）
3. 当条件满足时：
   → 检查当前 visibilityState[fullKey] 是否 < 目标等级
   → 若是 → 提升至目标等级
   → 删除该 Trigger
   → 删除所有低于此等级的 Trigger（避免重复运算）
4. 条件为 always 的 → 直接设定，不创建 Trigger
```

**高级触发自动清理低级：**
```
例：实体 ascension_shrine:
  level3: { type: "cmp", op: "gte", left: { type: "resource_gained", target: "gold" }, right: { type: "const", value: 500 } }
  level4: { type: "has_enhancement", target: "mod/enh/key" }

  当 level4 trigger 先触发（玩家获得 key）：
    → visibilityState = 4
    → 删除 level3 的 trigger（不需要再等 500 金了）
```

### 来源 B：外部 Effect 授予

其他实体（如 Enhancement、Story ContextBehavior）通过 Effect 系统直接提升可见性：

```
新增 EffectType:
  - "reveal_entity"           # 直接设定某实体的可见性等级
    target: string            # 目标实体的 FullKey
    value: number             # 目标 VisibilityLevel（1-4）

  - "grant_purchase_access"   # 快捷：跳过前 3 级，直接设为 Lv.4
    target: string
```

Effect 授予的可见性直接写入 `visibilityState`，**不创建 Trigger**（立即生效）。

## 各实体类型的可见性映射

### Init

| 等级 | 含义 | 影响 |
|---|---|---|
| 1 Known | 出现在 Init 选择列表中 | 玩家知道此 Init 存在 |
| 2 Name | 显示名称 | 可看到名称 |
| 3 Desc | 显示介绍 | 可看到描述 |
| 4 Purchasable | 可选为起始 Init | 可点击进入 |
| 5 Fetched | 已进入/已完成 | 记录在 completedInits |

### Area

| 等级 | 含义 | 影响 |
|---|---|---|
| 1 Known | Area 出现在地图/列表中 | 显示为 ??? |
| 2 Name | 显示区域名 | |
| 3 Desc | 显示介绍 | |
| 4 Purchasable | 可传送/可进入 | 与 AreaState.unlocked 同步 |
| 5 Fetched | 已解锁 | AreaState.unlocked = true |

### Spot

| 等级 | 含义 | 影响 |
|---|---|---|
| 1 Known | 出现在 Area 的 Spot 列表中 | 显示为 ??? |
| 2 Name | 显示名称 | |
| 3 Desc | 显示介绍+产出预览 | |
| 4 Purchasable | 可购买 | 购买按钮激活 |
| 5 Fetched | 已拥有 | SpotState.level > 0 |

### Enhancement

| 等级 | 含义 | 影响 |
|---|---|---|
| 1 Known | 出现在商店/升级栏中 | 显示为 ??? |
| 2 Name | 显示名称 | |
| 3 Desc | 显示介绍+效果预览 | |
| 4 Purchasable | 可购买 | 购买按钮激活 |
| 5 Fetched | 已拥有 | EnhancementState.level > 0 |

### ActiveStoryEntry / PassiveStoryEntry

| 等级 | 含义 | 影响 |
|---|---|---|
| 1 Known | 出现在故事列表中 | 显示为 ??? |
| 2 Name | 显示标题 | |
| 3 Desc | 显示描述 | |
| 4 Purchasable | 可触发/可进入 | 按钮激活 |
| 5 Fetched | 已触发/已完成 | StoryInstance.triggerCount > 0 |

## 与现有系统的集成

### 改造映射

| 旧字段 | 新归属 |
|---|---|
| `SpotDefinition.unlockCondition` | → `visibility.3`（自动发现=看到介绍） |
| `AreaDefinition.unlockCondition` | → `visibility.4`（解锁=可进入） |
| `EnhancementDefinition.prerequisites` | → 保留（仍做购买时的二次校验），同时拆出可见性部分到 `visibility` |
| `ActiveStoryEntryDefinition.prerequisites` | → 同上 |
| `PassiveStoryEntryDefinition.conditions` | → 拆分：过滤条件仍保留，可见性部分移到 `visibility` |
| `InitDefinition.entryRequirements` | → 等效于 `visibility.4` |

### 与 Effect 系统的配合

```
Effect.reveal_entity
  → 目标实体如果 visibilityState < value → 直接提升

Effect.grant_purchase_access
  → 等价于 reveal_entity 且 value = 4
```

## 参见

- [Player](player.md) — PlayerState 内的 visibilityState
- [Effect](effect.md) — reveal_entity / grant_purchase_access 类型
- [Value & Condition](value-condition.md) — visibility 中的 Condition 定义
- [StoryEntry](story-entry.md) — EventBus-Trigger 的绑定和生命周期
- [Save Construction](save-construction.md) — 新游戏时 visibilityState 的初始化
