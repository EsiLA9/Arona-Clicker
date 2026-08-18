# 游戏运行时数据模型 & 多 Datapack/Mod 问题分析

> 状态: 分析阶段 | 日期: 2026-08-08

---

## 1. 数据全景图

### 1.1 两层结构：静态定义 + 运行时状态

```
┌────────────────────────────────────────────────────┐
│ 静态数据 (Datapack)                                  │
│ ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌───────┐ │
│ │ Init │  │ Area │  │ Spot │  │Story │  │Enhance│ │
│ │Def   │  │Def   │  │Def   │  │Def   │  │Def    │ │
│ └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬────┘ │
│    │ triggers│         │         │         │        │
│ ┌──┴─────────┴─────────┴─────────┴─────────┴──────┐ │
│ │ TriggerDef (inline, 附加于 Init)                 │ │
│ └──────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────┤
│ 运行时状态 (PlayerState, 单例)                        │
│ ┌───────────┐ ┌────────────┐ ┌───────────────────┐ │
│ │ SpotSlot[]│ │Resources{}  │ │ StoryLog[]        │ │
│ │ InitSlots │ │Map<Res,val> │ │ {storyId, time...}│ │
│ └───────────┘ └────────────┘ └───────────────────┘ │
│ ┌───────────┐ ┌────────────┐ ┌───────────────────┐ │
│ │Enhancement│ │Cooldown     │ │ currentAreaId     │ │
│ │State[]    │ │Timestamps{} │ │ currentInitId     │ │
│ └───────────┘ └────────────┘ └───────────────────┘ │
└────────────────────────────────────────────────────┘
```

### 1.2 实体一览

| 实体 | 文件 | 职责 |
|---|---|---|
| `InitDef` | types.ts:284 | 世界线定义：包含默认区域、发起故事、触发器 |
| `AreaDef` | types.ts:299 | 区域定义：包含默认 Spot、相邻区域 |
| `SpotDef` | types.ts:312 | 设施定义：生产/消耗资源，可升级，可放置角色 |
| `ActiveStoryDef` | types.ts:341 | 主动故事：跨多个 Talklet 的叙事主线 |
| `PassiveStoryDef` | types.ts:361 | 被动故事：单 Talklet，条件满足时自动触发 |
| `TalkletDef` | types.ts:395 | 对话单元：对话行 + 选项 + 效果 |
| `EnhancementDef` | types.ts:409 | 强化项：全局加成，带条件树解锁 |
| `TriggerDef` | types.ts:807 | 触发器：事件 → 条件 → 效果 |
| `ItemDef` | types.ts:471 | 物品定义：消耗品，带可使用效果 |
| `Character` | types.ts:11 | 角色枚举：`enum Character { SERIKA = 'serika', ... }` |

---

## 2. 实体间的引用关系

```
                        ┌──────────┐
                        │ InitDef  │  (世界线)
                        └────┬─────┘
               defaultAreas│startStoryId│triggers (inline)
          ┌────────────────┼────────────┼──────────┐
          ▼                ▼            ▼          │
   ┌──────────┐    ┌──────────────┐  ┌──────────┐ │
   │ AreaDef  │    │ActiveStoryDef│  │TriggerDef│ │
   └────┬─────┘    └──────┬───────┘  └────┬─────┘ │
defaultSpots│adjacentAreaIds│talklets    effects│  │
      ┌────┼─────┐         │         (ref any ID) │
      ▼    ▼     ▼         ▼                      │
  ┌──────┐ ┌──────┐ ┌─────────────┐               │
  │SpotDef│ │Area  │ │ TalkletDef  │               │
  └──┬───┘ │(自指)│ └──────┬──────┘               │
     │     └──────┘  dialogue│effects              │
     │                      │                     │
     │ levelUpgrades        ▼                     │
     │ (自指增强)     ┌──────────┐                 │
     └───────────────▶│ Effect[] │ (统一效果系统)   │
                      └──────────┘                 │
                                                    │
  ┌──────────────┐                                  │
  │PassiveStoryDef│ ─── triggerCondition ───────────┼──▶ ConditionGroup
  └──────────────┘                                  │     (包含各种 Target)
                                                    │
  ┌────────────────┐                                │
  │ EnhancementDef │ ─── conditions ────────────────┘
  └────────────────┘
```

### 2.1 引用矩阵

| 被引用 \ 引用方 | InitDef | AreaDef | SpotDef | StoryDef | TriggerDef | EnhancementDef | Condition |
|---|---|---|---|---|---|---|---|
| **InitId** | — | ✅ initId | — | ✅ availableInits | — | ✅ initId | — |
| **AreaId** | ✅ defaultAreas | ✅ adjacentAreaIds | ✅ areaId | — | — | — | — |
| **SpotId** | — | ✅ defaultSpots | — | — | — | — | ✅ (via conditions) |
| **StoryId** | ✅ startStoryId | — | — | ✅ (via conditions) | — | — | ✅ hasReadStory |
| **ItemId** | — | — | — | — | — | — | ✅ hasItem |
| **EnhancementId** | — | — | — | — | — | — | ✅ hasEnhancement |
| **Resource** | — | — | ✅ cost/yield | — | — | — | ✅ (via conditions) |
| **Character** | — | — | ✅ placed/assigned | ✅ | — | — | — |

### 2.2 引用的"强弱"

| 引用类型 | 验证时机 | 空指针风险 |
|---|---|---|
| `areaId` (SpotDef → AreaDef) | Registry 加载时 | 低，同 datapack 内校验 |
| `defaultSpots` (AreaDef → SpotDef) | Registry 加载时 | 低，同 datapack 内校验 |
| `initId` (AreaDef → InitDef) | Registry 加载时 | 低，同 datapack 内校验 |
| `defaultAreas` (InitDef → AreaDef) | Registry 加载时 | 低 |
| `adjacentAreaIds` (AreaDef → AreaDef) | **未校验** | 中，可指向不存在的 Area |
| `startStoryId` (InitDef → StoryDef) | **运行时解析** | 中，可指向不存在的 Story |
| `triggerCondition` (StoryDef) | **未校验** | **高**，可引用跨 pack 实体 |
| `revealTriggers` 的 `unlock` 条件 (EnhancementDef) | **未校验** | **高** |
| `revealTriggers` 的 `unlock` 条件 (SpotDef) | **未校验** | **高** |
| `revealTriggers` 的 `existence` 条件 | **未校验** | **高** |
| `effects` (Trigger/Talklet) | 运行时查找 | **高**，Effect 目标的 ID 可能不存在 |
| `reveal.condition` | **未校验** | 中 |

**结论**：当前只有 `areaId`、`defaultSpots`、`initId`、`defaultAreas` 这些"硬结构"引用在 Registry 加载时有校验。其余引用（包括所有 Condition 内引用）全是运行时隐式解析，解析失败时静默返回 0/false。

---

## 3. 运行时状态 (PlayerState)

```typescript
interface PlayerState {
  currentInitId: InitId | null;
  currentAreaId: AreaId | null;
  
  // Spot 实例 (从 SpotDef 创建，可多个)
  spotSlots: SpotSlot[];
  
  // 按 Init 分组的 Spot 记录
  initSpotSlots: Record<InitId, Record<SpotId, SpotSlot[]>>;
  
  // 资源池
  resources: Record<string, number>;  // "base:resource:credit" → 100
  
  // 故事日志
  storyLog: StoryLogEntry[];
  
  // 增强项状态
  enhancementLevels: Record<string, number>;
  
  // 全局计时
  totalFrames: number;
  
  // 角色位置
  characterPlacements: Record<Character, SpotId | null>;
  
  // Cooldown 时间戳
  cooldowns: Record<string, number>;
  
  // Items
  items: Record<string, number>;
  
  // 标记 (可切换 Flag)
  flags: Record<string, boolean>;
  
  // 已访问区域 (信息展示用)
  visitedAreas: AreaId[];
}
```

### 3.1 SpotSlot — 从静态定义到运行时实例

```typescript
interface SpotSlot {
  spotId: SpotId;           // → SpotDef.id
  level: number;            // 当前等级
  assignedCharacter: Character | null;  // 派驻角色
  placed: boolean;          // 是否已放置
}
```

`SpotSlot` 是 SpotDef 的运行时实例。一个 SpotDef 可以创建多个 SpotSlot（如其 `baseCapacity` 允许重复放置）。SpotSlot 与 SpotDef 通过 `spotId` 关联。

---

## 4. 当前 Datapack 结构

### 4.1 文件布局

```
src/data/
├── base/                      # 基础 datapack
│   ├── index.ts               # 入口，导出 BaseDatapack
│   ├── inits.ts               # InitDef[]
│   ├── areas.ts               # AreaDef[]
│   ├── spots.ts               # SpotDef[]
│   ├── enhancements.ts         # EnhancementDef[]
│   ├── stories.ts              # StoryDef[]
│   ├── items.ts               # ItemDef[]
│   ├── triggers.ts            # TriggerDef[] (global)
│   └── templates/             # 内部子包
│       ├── index.ts
│       └── schale/
│           ├── areas.ts
│           ├── spots.ts
│           └── stories.ts
└── test/                      # 测试 datapack
    └── index.ts
```

### 4.2 Datapack 类型定义

```typescript
interface Datapack {
  name: string;                    // e.g. "base", "test"
  version: string;                 // e.g. "1.0.0"
  dependencies?: string[];         // e.g. ["base"] (依赖其他 pack)
  inits: InitDef[];
  areas: AreaDef[];
  spots: SpotDef[];
  enhancements: EnhancementDef[];
  stories: StoryDef[];            // 包含 ActiveStoryDef | PassiveStoryDef
  items: ItemDef[];
  triggers: TriggerDef[];         // 全局触发器
}
```

### 4.3 加载流程

```
loadDatapack(pack: Datapack):
  1. 检查依赖: pack.dependencies 中的每个 pack 必须已加载
  2. 注入到 Registry:
     registry.inits.set(def.id, def)        // 重复 ID → 报错
     registry.areas.set(def.id, def)        // 重复 ID → 报错
     registry.spots.set(def.id, def)        // ...
     ...
  3. 校验硬引用 (当前仅校验):
     - SpotDef.areaId ∈ areas Map
     - AreaDef.initId ∈ inits Map
     - InitDef.defaultAreas ⊆ areas Map  // 仅检查第一个 pack 的
     - AreaDef.defaultSpots ⊆ spots Map  // 仅检查第一个 pack 的
  4. 挂载默认实体 (第一个 Init 的 defaultAreas/Spots)
```

---

## 5. 多 Datapack/Mod 场景的问题

### 5.1 问题总览

```
┌──────────────────────────────────────────────────────────────┐
│ 加载顺序:  base → modA → modB                                 │
│                                                              │
│ modA 的 ActiveStory 引用了 base 的 Spot (OK, 已验证存在)        │
│ modA 的 Condition 引用了 modB 的物品 (⚠ 交叉引用, 未校验)        │
│ modA 的 Spot 放在 base 的 Area 里 (OK)                        │
│ modB 的 PassiveStory 引用了 modA 的 Enhancement (⚠ 未校验)     │
│ modB 试图给 base 的 Spot 加 levelUpgrade (❌ Immutable)        │
│ modC 卸载后，modB 中对其 Item/Story 的引用变空悬 (❌ 无检查)     │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 问题分类

#### A. 空引用 (Dangling Reference)

**场景**：modA 的 Condition 里写了 `hasItem(key='modB:item:special_key')`，但 modB 未安装。

**当前行为**：`ConditionSystem.getActualValue()` 中 `resolveItemCount` 找不到该 ItemId → 返回 0。PassiveStory 永远不会触发，玩家无感知，但数据设计者无错误提示。

**严重程度**：中 — 静默失效，难以调试。如果出现在 `triggerCondition` / revealTriggers 的 `unlock` 或 `existence` 条件 / `reveal.condition` / Effect 目标中，都可能成为不可达内容。

**建议**：
- 加载时对 Condition 内的所有实体引用做"尽力校验"（至少 log warning）。
- Effect 目标 ID 也应校验。

#### B. 不可变定义的扩展 (Immutable Def Extension)

**场景**：modB 想给 `base:spot:credit_printer` 添加一个 `levelUpgrade`。但 SpotDef 是只读的，modB 无法 patch。

**当前行为**：不可能做到。所有 SpotDef 在加载时一次性写入 Registry。

**严重程度**：低到中 — 取决于设计目标。如果 mod 的主要功能就是扩展已有内容，这就是核心限制。

**建议**：
- 引入 `patch` 机制：`Datapack` 增加 `patches: { spots: { [id]: Partial<SpotDef> } }`，加载时合并。
- 或引入"ModSpot"独立实体。

#### C. 跨 Pack 依赖顺序 (Load Order)

**场景**：modA 依赖 modB（`dependencies: ['modB']`），但 modB 在 condition 中又引用了 modA 的 Enhancement。形成循环依赖。

**当前行为**：Registry 按加载顺序写入，可能 modA 引用 modB 时 modB 尚未加载（如果加载器只检查单向依赖）。

**严重程度**：中 — 取决于加载器的依赖解析能力。

**建议**：
- 所有静态引用校验推迟到所有 pack 加载完毕后再执行。
- 循环依赖在加载时直接报错。

#### D. 卸载与热更新 (Unload / Hot-reload)

**场景**：玩家安装 modB 并玩了一段时间（storyLog 里有 modB 的故事记录），然后卸载 modB。运行时状态中包含对已卸载内容的引用。

**当前行为**：未设计卸载路径。`storyLog`、`enhancementLevels`、`spotSlots` 等都会持有对不存在 ID 的引用。访问这些 ID 时，Registry 查找返回 undefined，可能 crash。

**严重程度**：**高** — 可能导致运行时崩溃。

**建议**：
- 卸载时清理相关状态（storyLog 条目、enhancementLevels、spotSlots 中被卸载的项）。
- 或禁止运行时卸载。

#### E. ID 冲突 (ID Collision)

**场景**：modA 和 modB 都定义了 `custom:enh:super_boost`。

**当前行为**：Registry 加载时报 `Duplicate ID` 错误，拒绝加载后一个。

**严重程度**：低 — 有明确的报错。

**建议**：当前行为合理。可考虑在错误信息中展示两个 pack 的来源。

#### F. Condition 中的框架引用 (Framework Condition Reference)

**场景**：Condition 中有 `hasReadStory(key='modB:story:mystery')` 和 `hasReadStoryInRun(key='modB:story:mystery')`。这些引用不区分"这个 story 在哪个 pack 里"——它们只检查 `storyLog` 中是否有匹配 ID 的条目。但如果 story 来自未加载的 pack，它的 ID 永远不会出现在 storyLog 中。

**当前行为**：静默返回 false，条件不满足。

**严重程度**：低到中 — 逻辑正确但不透明。

#### G. Visibility 依赖链断裂

**场景**：modA 的 Area 的 existence 门槛（`revealTriggers`）依赖于玩家持有 modB 的物品。modB 未安装 → 物品永远为 0 → Area 永远不可见。但这个 Area 本身是 modA 的内容。

**当前行为**：静默不可见。

**严重程度**：中 — 结果正确（条件不满足），但依赖不透明。可能让 mod 作者困惑。

#### H. SpotSlot 跨 Pack 放置

**场景**：modA 的 SpotDef (`modA:spot:laser_turret`) 的 `areaId` 指向 `base:area:schale_main`。玩家在 `schale_main` 放置了这个 Spot。然后 modA 被卸载。运行时状态 `spotSlots` 中仍有 `{ spotId: 'modA:spot:laser_turret' }`。

**当前行为**：Tick 系统查找 SpotDef 失败 → crash 或静默跳过。

**严重程度**：**高** — 可能导致生产计算 crash。

#### I. Story 跨 Pack 引用 Talklet

**场景**：modA 的 ActiveStoryDef 的 `talklets` 引用了 modB 的 Talklet。Talklet 是内嵌在 StoryDef 里的，不是独立实体，不能跨 pack 引用。

**当前行为**：Talklet 不是独立实体，无法被其他 pack 引用。这是结构限制，不是 bug。

**严重程度**：低 — 设计约束，文档化即可。

---

## 6. 设计建议汇总

| 优先级 | 建议 | 说明 |
|---|---|---|
| 🔴 P0 | **加载后统一校验所有跨引用** | 所有 Condition、Effect 目标、startStoryId 在全部 pack 加载完后检查一致性，至少 log warning |
| 🔴 P0 | **SpotSlot 的 spotId 在 tick 前做防御检查** | 如果 Registry 中不存在，跳过该 Slot 并记录 warning，避免 crash |
| 🟡 P1 | **提供 patch/merge 机制** | 允许 mod 扩展已有 SpotDef 的 levelUpgrades、添加 Enhancement 条件分支等 |
| 🟡 P1 | **循环依赖检测** | 加载时构建依赖 DAG，检测环 |
| 🟢 P2 | **卸载时清理运行时状态** | 如果支持运行时卸载 mod，需清理 storyLog / spotSlots / enhancementLevels 中的相关条目 |
| 🟢 P2 | **运行时诊断工具** | `registry.validate()` 方法输出所有 unreachable 内容（visibility 永远为 false、triggerCondition 永远不满足等） |

---

## 7. 总结

当前数据模型的**核心问题**可以归纳为两点：

1. **硬引用有校验，软引用无校验**：`areaId`、`defaultSpots` 等结构引用在加载时检查；Condition/Effect 中的内容引用全部在运行时隐式解析，失败时静默。这在单 pack 场景没问题，但在多 pack 场景下会积累大量"暗坑"。

2. **Def 是不可变的，但运行时状态持有它们的 ID**：卸载一个 pack 后，运行时状态中残留的 ID 会成为悬空指针。目前整个系统没有"卸载"这个概念，但多 pack 场景下这是必然会遇到的问题。
