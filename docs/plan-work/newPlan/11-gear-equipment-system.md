# 新策划/11 — 装备（Gear）系统：三槽、经验成长与 tier 升级 MVP

状态：🟢 MVP 已实施（2026-09-11）：Def / Registry / Schema、写入口与服务、UI、base 示例内容全部落地并验收；effects 仍「只声明 + 预留接口」，运行时消费随 B 段
日期：2026-09-11

> 本文回答：BA 式「装备」在这个项目里应该如何命名、如何拆防御/状态/写入/UI 边界，第一版最小可玩形态包含什么、参数如何外置到 base 示例数据包，以及开工前必须裁定哪些问题。
>
> 本文不是机制事实源，也不替代 ADR。落地前先评审 → 裁定 → 再拆实现切片。

## 一、结论摘要

项目已有 `VariantProgressionDef.gearSlots`（三固定槽骨架）与 `VariantProgress.gear`（占位），但**没有经验/等级字段、没有服务、没有写入口、没有 UI、没有任何内容数据**。

第一版要做的是一个**最小闭环**：

```text
空槽 → 放入装备（消耗 T1 图纸）→ 升级装备经验（消耗经验材料）
     → 满级后升级 tier（消耗下一 tier 图纸 ×N）→ 继续升级经验 → …… T1…T10
```

四条边界先冻结：

1. **命名隔离**：本次「装备」用 **Gear** 命名（新 `GearId`），与已落地的**色彩装备 `ColorEquipment`**（`EquipmentId`）严格分家，避免两套「装备」在代码里撞名。中文 UI 仍显示「装备」。
2. **补丁/图纸与经验材料都是普通 Item**：走已有 `state.inventory`，不发明第二套库存。Gear 只存「成长进度」。
3. **Def 外置**：装备类型线、tier 参数、经验曲线、升级消耗、经验材料换算全部放 base 示例数据包，引擎不硬编码。
4. **无取下**：对齐 BA，`equipGear` 只在空槽可用，不提供 unequip 命令。

## 裁定记录（2026-09-11）

| # | 议题 | 裁定 |
| --- | --- | --- |
| 1 | 命名 | ✅ **分家**：本次用 `Gear` / `GearId`，`EquipmentId` 继续专指色彩装备；UI 文案色彩装备加「色彩」前缀区分 |
| 2 | Def 形态 | ✅ **形态 B**：新增 `GearDef` 表，`GearSlotDef` 只引用 `{ slot, gear }`（§4.1） |
| 3 | 经验来源 | ✅ **经验材料 item**（对齐 BA 强化素材），不做「直接消耗资源」 |
| 4 | 等级模型 | ✅ **累计等级 + tier 抬上限**：level 跨 tier 连续，tier 只决定等级上限与效果（§3） |
| 5 | effects 消费 | ✅ **只声明 + 预留接口/数据**（`GearTierDef` 效果字段 / `GearSystem.effectsOf`）；运行时消费随 B 段 `ProgressionEffectResolver`，MVP 不接入 |
| 6 | tier 效果模型 | ✅ **每 tier 自带基础效果 + 每级线性成长；升 tier 时新 tier 效果整体替换旧 tier（不叠加）**（§4.4） |

## 二、语义与命名边界

当前项目里存在三个容易混淆的概念，必须先分清：

| 概念 | 代码名 | 中文 | 现状 | 归属 |
| --- | --- | --- | --- | --- |
| 色彩装备 | `ColorEquipmentDef` / `EquipmentId` | 色彩装备 | ✅ 已落地（收集品 + 色彩组 + 单槽） | `state.equipmentsOwned` + `VariantProgress.colorEquipment` |
| 爱用品 | `FavoriteItemDef` | 爱用品 | 🟡 仅契约/Registry 占位 | 角色自己的 Progression Track，**不是库存装备** |
| **装备（本文）** | **`GearDef` / `GearId`** | **装备** | ❌ 仅 `GearSlotDef` 骨架 | 三固定槽 + tier + 等级 + 经验 |

结论：
- 本文对象固定称为 **Gear（装备）**；`EquipmentId` 继续专指色彩装备，**不复用、不合并**。
- `Gear` 与 `ColorEquipment` 是两条独立构筑轴：色彩装备是「跨体系异常规则槽」，Gear 是「常规成长槽」（与 ADR-0008 C0-4、task-0041 §6.4 一致）。
- 建议在 `src/engine/types/character.ts` 增 `export type GearId = string;`（沿用现有别名风格）。

## 三、玩法规则（对齐蔚蓝档案）

| 规则 | 内容 | 项目落地含义 |
| --- | --- | --- |
| 三槽类别 | 攻击 / 防御 / 特殊 | 新增枚举 `GearSlotKind = 'attack' \| 'defense' \| 'special'` |
| 槽内类型线 | 同一槽有多种类型（例：攻击有帽子 / 鞋子 / 手套 / 徽章），差分**只能装其中一种** | 差分在 `gearSlots` 里为该槽**声明唯一类型线**；玩家不能换类型 |
| 起始状态 | 角色一开始没有装备 | `VariantProgress.gear[slot]` 缺省 = 未装配 |
| 装配 | 消耗 **1 个 T1 图纸**直接装配 | 装配 = 扣 1 个 T1 图纸 item，写入 `{ tier:1, level:1, exp:0 }` |
| 升级经验 | 装配后升级装备经验/等级 | 消耗经验材料 item，加 `exp`；达到 `expPerLevel` 自动 level+1 |
| 升 tier | 当前 tier **满级**后，消耗 **N 个下一 tier 图纸**升为下一 tier | 校验 `level === levelCap(tier)`；扣下一 tier 图纸 ×N；`tier+1`；**新 tier 效果整体替换旧 tier** |
| tier 范围 | T1 – T10 | `GearDef.tiers` 长度 1–10，由数据包声明 |
| 取下 | **不提供** | 无 `unequipGear` 命令；空槽判断决定能否装配 |
| tier 效果 | 每个 tier 自带「基础效果 + 每级线性成长」，升 tier 整体更替 | 见 §4.4 效果模型 |

等级模型（✅ 已裁定）：**等级跨 tier 累计，tier 抬等级上限与效果**。即 T1 `levelCap=10`、T2 `levelCap=20`……升 tier 后保留当前 level 继续升。效果按 tier 整体更替（§4.4）。

## 四、概念模型与分层

### 4.1 Def 侧（Datapack 声明，外置）

现有骨架把 tiers inline 在差分里：

```ts
// 现状（A 段骨架）
GearSlotDef { type: string; tiers: GearTierDef[] }        // tiers 内联在 variant
GearTierDef { tier: number; cost?: ProgressionCostDef; effects: Effect[] }
```

装备 tier 参数是「类型线级」的（同一顶帽子对所有学生共享同一套 T1–T10）。这决定了两种 Def 形态，需在评审时二选一：

#### 形态 A：inline（现状骨架，tiers 内联在差分）

```ts
GearSlotDef { type: string; tiers: GearTierDef[] }   // 每个差分自带一套 tiers
```

| 优点 | 缺点 |
| --- | --- |
| 差分自包含，无新增顶层表、无跨表引用校验，Registry 零改动 | **数据重复**：同一条类型线的 T1–T10 会在每个可用学生身上各写一遍 |
| 可对单个差分做数值微调（per-variant tuning） | **一致性差**：改一处数值要改 N 处，极易漂移 |
| 与 ADR-0008「槽类型由角色声明」的字面表述最直接对应 | 类型线不是实体，无法做图鉴 / 商店 / 掉落引用 |
| — | 与 BA 语义不符：BA 的装备是全局设计，per-character 只是「允许装哪种」 |

#### 形态 B：外部化（新增 `GearDef` 表，variant 只引用）

```ts
GearDef { id; name; slot; tiers[] }
GearSlotDef { slot: GearSlotKind; gear: GearId }
```

| 优点 | 缺点 |
| --- | --- |
| **单一事实源**：类型线定义一次、所有差分引用，数值只改一处 | 新增顶层表 + Registry 表 + `gear→item` / `slot→gear` 引用校验（一次性成本） |
| 类型线成为可复用实体，可用于图鉴 / 商店 / 掉落引用 | 无法为单个学生做「同款装备数值不同」的微调（确需时在 `GearSlotDef` 加可选 `overrides?` 即可） |
| 与 BA 语义一致：装备设计图/装备品全局共享，只有「能否装」是 per-character | 破坏性重写 A 段骨架（项目允许清档，可接受） |
| 数据量小、内容好维护；与现有 `colorEquipments` / `favoriteItems` 等表模式一致 | — |

**✅ 已裁定采用形态 B**（2026-09-11）。若后续确有 per-variant 微调需求，在 `GearSlotDef` 上加可选 `overrides?`，不影响主结构。

形态 B 实现形态（破坏性重写 A 段骨架；不写迁移）：

```ts
type GearSlotKind = 'attack' | 'defense' | 'special';

/** 装备类型线（表 `gears`）：如「攻击装备·帽子」 */
interface GearDef {
  id: GearId;
  name: string;
  slot: GearSlotKind;            // 属于哪个槽
  tiers: GearTierDef[];          // T1..T10
  extra?: ExtraCompound;
}

/** 类型线的某一 tier */
interface GearTierDef {
  tier: number;                  // 1..10
  levelCap: number;              // 本 tier 的（累计）等级上限
  /** 本 tier 效果线性基准的等级；缺省 = 上一 tier 的 levelCap（T1 缺省 = 1） */
  baseLevel?: number;
  expPerLevel: number;           // 每级所需经验
  /** 达到本 tier 的消耗：T1 = 本 tier 图纸×1；T2+ = 本 tier 图纸×N */
  upgradeCost?: GearCostDef[];
  /** baseLevel 时的基础效果（tier 更替时整体替换，不叠加） */
  baseEffects?: Effect[];
  /** 每高出 baseLevel 一级叠加一次的线性成长效果（仅线性加法类 op） */
  perLevelEffects?: Effect[];
}

/** 差分在某槽声明的唯一类型线（不可换） */
interface GearSlotDef {
  slot: GearSlotKind;
  gear: GearId;                  // @ref gears
}

interface VariantProgressionDef {
  gearSlots?: [GearSlotDef, GearSlotDef, GearSlotDef];   // 定长三槽
  // …skills / favoriteItem / uniqueWeapon / initialTraits 不变
}
```

经验材料的换算统一放**全局配置**（新增 Datapack 字段 `gearConfig?`）：

```ts
/** 装备升级消耗：图纸/材料物品与数量。 */
interface GearCostDef {
  itemId: ItemId;
  amount: number;
}

/** 装备成长全局配置（经验材料换算与通用升级消耗） */
interface GearConfigDef {
  /** 经验材料：itemId → 单个提供的装备经验 */
  expItems: { itemId: ItemId; exp: number }[];
  /** 每级通用附加消耗（可选，如 Credit，用于后续接入） */
  levelCost?: GearCostDef;
}
```

> **MVP 简化**：装备消耗用专用 `GearCostDef`（物品 × 数量）而非 `ProgressionCostDef`。
> 后者 `amount` 是 `ValueExpression`，消费它需要引入整条 ValueExpression 求值链路；
> 装备消耗在 BA 里就是「图纸 ×N」，MVP 无收益，故保留原契约给技能/爱用品，装备走简化类型。

### 4.2 状态侧（PlayerState）

```ts
// src/arona-clicker/types/character.ts
interface GearProgress {
  tier: number;    // 当前 tier
  level: number;   // （累计）等级
  exp: number;     // 当前等级内累计经验
}

interface VariantProgress {
  // …
  gear?: [GearProgress?, GearProgress?, GearProgress?];  // 缺省项 = 该槽未装配
  // …
}
```

- 槽位索引 = 差分 `gearSlots` 的索引（0/1/2），槽类别由 def 声明，玩家不能选类别。
- 图纸与经验材料**不进 Gear 状态**，是 `state.inventory` 里的普通 Item（`ItemDef.type: 'material'`）。
- 归属：沿用 ADR-0008 A1——按 Variant 隔离，随 `roster` 走（当前 `global`，归属翻转待 roadmap-0004）。
- Memory：`VariantMemory.maxGearTier` 已存在；建议补 `maxGearLevel?: [number, number, number]`（可选）。写入口在同一次提交内维护单调性。

### 4.3 数据流

```text
Datapack: gears[] + items[] + gearConfig
        + VariantProgressionDef.gearSlots (slot→gear)
                 │
引擎 Registry: gears 表 + gear→item 引用校验
                 │
服务 GearSystem: 解析槽→gear→tier→经验/消耗；产出只读 GearView
                 │
写入口 StateMutationService: equipGear / feedGearExp / upgradeGearTier（原子：先校验后扣）
                 │
UI: 右栏角色面板三槽卡片（只读消费 GearView + 命令）
```

### 4.4 tier 效果模型（✅ 已裁定）

每个 tier **各自**提供一套「基础效果 + 每级线性成长」；升 tier 时**新 tier 整体替换旧 tier 的效果，不跨 tier 叠加**。解析公式（预留接口；MVP 只声明、不消费）：

```text
gearEffects(tier, level)
  = tier.baseEffects
  + tier.perLevelEffects × max(0, level - tier.baseLevel)
```

- `baseLevel` 缺省 = 上一 tier 的 `levelCap`（T1 缺省 = 1）。因此刚升到新 tier 时 `level === baseLevel`，只吃新 tier 的基础效果 → **tier 更替即一次跳档**：新基础值直接取代旧的「基础 + 已累积成长」。
- 数值意图：`tier.baseEffects` 占**决定性**权重，`perLevelEffects` 是次级线性补偿；即「不同 tier 的装备本身」才是培养主轴，等级是 tier 内的微调。
- 约束：`perLevelEffects` 只能承载**线性加法类** op（如 `addResource` / 加算数值）；乘算、条件、集合类效果只能放 `baseEffects`，因为它们无法按级数线性缩放。
- 效果按**槽**解析：`effectsOf(state, variantId)` 返回三个槽各自当前 `(tier, level)` 解析出的效果并集（同槽内不含旧 tier）。
- 运行时消费仍在 B 段（`ProgressionEffectResolver`）；本节公式与字段是**接口 / 数据预留**。

## 五、外部化内容（base 示例数据包）

新增 `src/arona-clicker/content/gears.ts`，并在 `default-datapack.ts` 组装：

1. **图纸物品**（`items` 表，`type: 'material'`）：
   `base:item:gear-blueprint-attack-hat-t1` … 每类型线每 tier 一个。
2. **经验材料物品**（`items` 表）：
   `base:item:gear-exp-basic`（+100 exp）、`base:item:gear-exp-advanced`（+500 exp）等。
3. **装备类型线**（`gears` 表）：攻击/防御/特殊各若干条，如
   `base:gear:attack-hat`、`base:gear:attack-shoes`、`base:gear:defense-vest`、`base:gear:special-badge` …，每条 T1–T10。
4. **全局配置** `gearConfig`：`expItems` 换算 + 可选 `levelCost`。
5. **差分挂载**：给 base 角色差分补 `progression.gearSlots`（每个差分按设定绑定三条类型线）。

示例数值（**占位、可调**）：

| tier | levelCap | expPerLevel | 升级到本 tier 的图纸消耗 |
| --- | --- | --- | --- |
| T1 | 10 | 100 | 本 tier 图纸 ×1（装配消耗） |
| T2 | 20 | 200 | T2 图纸 ×2 |
| T3 | 30 | 300 | T3 图纸 ×3 |
| … | … | … | … |
| T10 | 100 | 1000 | T10 图纸 ×10 |

> 以上仅为 base 示例，供 UI 联调与验收；正式数值由策划后续单独给表，不放引擎。

效果示例（示意「tier 基础效果决定性」，非最终数值）：

| tier | baseEffects（示意 stat） | perLevelEffects（示意 stat） |
| --- | --- | --- |
| T1 | 攻击 +100 | 攻击 +10 / 级 |
| T2 | 攻击 +300 | 攻击 +20 / 级 |
| T3 | 攻击 +600 | 攻击 +30 / 级 |

## 六、服务、写入口与端口

### 6.1 `GearSystem`（新，`src/arona-clicker/services/gear-system.ts`）

只读查询 + 校验编排（不直接改 State）：

- `slotsOf(variantId)`：解析差分三槽 → `{ kind, gearDef }[]`
- `gearDef(gearId)` / `tierDef(gearId, tier)`
- `expToNext(gearId, tier, level)`
- `canEquip / canFeedExp / canUpgradeTier`：返回 `{ ok, reason?, cost }`
- `viewOf(state, variantId)`：产出 `GearView`（UI 单一消费面）
- `effectsOf(state, variantId)`：按 §4.4 对每个槽解析当前 `(tier, level)` 的 `baseEffects + perLevelEffects × 级差`（**仅声明 + 预留接口**；运行时消费随 B 段 `ProgressionEffectResolver`）

### 6.2 `StateMutationService` 写入口

| 方法 | 前置校验 | 写入 |
| --- | --- | --- |
| `equipGear(variantId, slotIndex)` | 槽为空 + 拥有 T1 图纸 ≥1 | 扣图纸；`gear[slot] = { tier:1, level:1, exp:0 }` |
| `feedGearExp(variantId, slotIndex, itemId, count)` | 已装配 + 未满级 + 拥有经验材料 ≥count | 扣材料；加 `exp`；循环 `exp ≥ expPerLevel` → `level+1` |
| `upgradeGearTier(variantId, slotIndex)` | 已装配 + `level === levelCap` + 未到 T10 + 拥有下一 tier 图纸 ≥N | 扣图纸；`tier+1` |

- **原子性**：三个入口都先完整校验（槽状态 + 余额 + 上限），再一次性扣款写入；禁止边扣边写。可复用/对齐 task-0039 的 TransactionPlan 方向（本文不展开）。
- **不加** `unequipGear`。

### 6.3 事件

复用伞事件，不新增碎片事件（ADR-0008 C0-6）：

```ts
characterProgressChanged { variantId, domain: 'gear', before?, after?, source }
// source: 'equipGear' | 'feedGearExp' | 'upgradeGearTier'
```

`EVENT_CATALOG` 的 `characterProgressChanged` 已含 `gear` domain，只需补 emit 说明。

### 6.4 端口 / 命令面

- 新增 `GearQueryPort`（只读，仿 `ColorEquipmentQueryPort`），暴露给 UI context。
- `UiMutationPort` 增 `equipGear / feedGearExp / upgradeGearTier`。
- `GameCommands` 暴露同名命令；UI controller 绑定按钮。
- UI 全程只读消费 `GearView`，不持有写引用。

## 七、UI 设计

落点：`src/ui/components/contacts.ts` 的 `renderCharacterPanel`（右栏「角色成长」），在现有「色彩装备」区块**之上**新增「装备」区块。

```text
装备
├─ 攻击 · 帽子        T2  Lv.14 / 20   exp 320/400   [升级经验] [升级装备]
├─ 防御 · 防弹背心     T1  Lv.7  / 10   exp 40/100    [升级经验] [升级装备]
└─ 特殊 · 徽章        未装配              [放入装备]   (T1 图纸×1)
```

三态：

| 状态 | 展示 | 按钮 |
| --- | --- | --- |
| 空槽 | 类型线名 + 装配消耗 | `放入装备`（图纸不足则禁用 + 原因） |
| 已装配未满级 | `T{tier} Lv.{level}/{cap}` + 经验条 | `升级经验`（材料不足禁用） |
| 已装配满级 | 同上 + «可升级» | `升级装备`（下一 tier 图纸不足/已 T10 禁用） |

- 无「卸下」按钮。
- 经验材料：MVP 提供「喂 1 个基础经验材料」与可选「喂满直到升级」；具体交互待评审。
- 样式放 `src/ui/css/gear.css`（或并入 `equipment.css`），命名空间 `gear-*`，不污染色彩装备样式。

只读视图（示例）：

```ts
interface GearSlotView {
  slotIndex: number;
  kind: GearSlotKind;            // 攻击/防御/特殊
  gearId: GearId;
  gearName: string;
  tier: number;
  level: number;
  levelCap: number;
  exp: number;
  expPerLevel: number;
  equipped: boolean;
  canEquip: boolean;
  canLevelUp: boolean;           // 未满级且经验材料充足
  canUpgradeTier: boolean;
  equipCostText: string;
  upgradeCostText: string;
  reason?: string;               // 不可用原因（材料不足 / 已满级 / 已 T10）
}
```

## 八、Schema / Registry / 文档同步

按 [[docs/docs-828/05-conventions/schema-sync]] 协议，改 `src/engine/types/**` 或契约字段后必须同步：

1. `src/engine/types/character.ts`：新增 `GearId`。
2. `src/data-services/contracts/character-progression-def.ts`：重写 `GearSlotDef` / `GearTierDef`，新增 `GearSlotKind` / `GearDef` / `GearConfigDef`。
3. `src/data-services/contracts/datapack.ts`：新增 `gears?: GearDef[]`、`gearConfig?: GearConfigDef`。
4. `src/data-services/registry/registry.ts`：新增 `_gears` 表 + merge/clear/accessor；新增校验：`gear.tiers[].upgradeCost.item` → items 存在、`variant.gearSlots[].gear` → gears 存在、`gearConfig.expItems[].itemId` → items 存在。
5. `src/data-services/registry/registry-validate.ts`：id 去重（三段式 `mod:gear:id`）。
6. `src/data-services/datapack/fragment-parser.ts`：`DATAPACK_LIST_FIELDS` 增 `gears`（顺带补 A 段遗漏的 `favoriteItems` / `uniqueWeapons` / `traits`）。
7. `npm run gen:schema` + `tools/datapack-editor/schema/editor-extras.ts` 兜底；`engine-schema.sync.test.ts` 三向一致。
8. 文档：`docs/docs-828/03-data-structures/character-entities`、`02-modules/character`（或新增 `02-modules/gear`）、`04-mechanisms`（新增 gear 机制卡）、`03-data-structures/player-state`（gear 状态）、`04-mechanisms/state-mutation`（新写入口）。

## 九、待评审 / 待裁定项

1. ~~命名~~ ✅ **已裁定**（2026-09-11）：`Gear` / `GearId` 与「色彩装备」分家；UI 文案色彩装备加「色彩」前缀区分。
2. ~~Def 形态~~ ✅ **已裁定**（2026-09-11）：形态 B，`GearDef` 表 + `GearSlotDef { slot, gear }`（对比见 §4.1）。
3. ~~经验来源~~ ✅ **已裁定**（2026-09-11）：使用经验材料 item（对齐 BA 强化素材），不做「直接消耗资源」方案。
4. ~~等级模型~~ ✅ **已裁定**（2026-09-11）：累计等级 + tier 抬上限；并确认 **tier 效果整体替换、不叠加**（见 §4.4）。
5. ~~effects 消费~~ ✅ **已裁定**（2026-09-11）：MVP **只声明 + 预留接口/数据**（`GearTierDef` 效果字段 / `GearSystem.effectsOf`），运行时消费随 B 段 `ProgressionEffectResolver`。
6. **tier 图纸消耗 N** 的具体曲线与 T1–T10 数值表。
7. `GearConfigDef` 为全局单表 vs per-gear 覆盖。
8. 「升级经验」交互：单次喂 vs 一键喂满/连续升级。
9. 是否需要「材料不足跳转获取」等引导（MVP 建议不做）。

## 十、实现切片建议（评审通过后）

| 切片 | 内容 | 产出 |
| --- | --- | --- |
| P0 | 冻结边界（命名 / Def 形态 / 经验 / 等级模型 / tier 效果模型）已基本齐，转正式 ADR | 正式 ADR |
| P1 | Def + Registry + Schema：`GearId`/`GearDef`/`GearConfigDef`/`gears` 表/校验/gen:schema | 类型检查 + schema 同步测试 |
| P2 | State + 服务 + 写入口：`GearProgress` 扩展、`GearSystem`、三写入口、事件、端口 | vitest（装配/经验/升 tier/余额不足/满级/T10 边界） |
| P3 | UI：三槽卡片、三态、按钮接线、`GearView`、CSS | UI 组件/controller 测试 + 手动验收 |
| P4 | base 示例内容：图纸/经验材料/类型线/差分挂载 | 可在游戏内完整走通 T1→T2 |

## 十一、验收标准

- 能从空槽装配 T1（扣 1 张 T1 图纸），并看到 `T1 Lv.1`。
- 能消耗经验材料升级，经验溢出正确进位，等级不超过当前 tier `levelCap`。
- 满级后能消耗下一 tier 图纸升级 tier，等级保留并继续可升。
- 升 tier 后效果整体切换为新 tier（旧 tier 效果不再计入），且不出现跨 tier 叠加。
- 材料/图纸不足、已满级、已 T10 时按钮禁用且给出原因，且不产生任何扣款。
- 全程无「卸下」入口。
- 装备类型线、tier 参数、经验曲线、消耗全部来自数据包，引擎无硬编码数值。
- `npx tsc --noEmit`、`npm test`、`npm run check:architecture`、`npm run gen:schema` 全绿。

## 实施记录（2026-09-11）

按 P1 → P4 顺序落地，全部切片完成：

| 切片 | 落地内容 |
| --- | --- |
| P1 | `GearId`；`GearSlotKind` / `GearDef` / `GearTierDef` / `GearSlotDef` / `GearCostDef` / `GearConfigDef`；Datapack 增 `gears` / `gearConfig`；Registry `_gears` / `_gearConfig` 表步骤 + accessor + 三层引用校验（`slot→gear`、`tier→item`、`gearConfig→item`）；`registry-validate` 去重与三段式（`base:gear:*`）；`fragment-parser` 列表字段补 `gears`（顺带补 A 段遗漏的 `favoriteItems` / `uniqueWeapons` / `traits`）；`npm run gen:schema` |
| P2 | `GearProgress { tier; level; exp }`；`GearSystem`（只读）+ `GearQueryPort`；`StateMutationService` 新增 `equipGear` / `feedGearExp` / `upgradeGearTier`（先全量校验再扣款写入）；复用伞事件 `characterProgressChanged{ domain:'gear' }`；`UiMutationPort` / `GameCommands` / `runtime-commands` 接线；`character-memory.recordGearProgress` 维护 `maxGearTier` |
| P3 | `contacts.ts` 角色面板新增「装备」三槽卡片（空槽 / 已装配 / 满级三态）；`controller-actions-contacts.ts` 绑定 `data-gear-equip` / `data-gear-feed` / `data-gear-tierup`；新增 `ui/css/gear.css`（命名空间 `gear-*`）；**无卸下按钮** |
| P4 | `content/gears.ts`：6 条类型线（攻击 2 / 防御 2 / 特殊 2）× T1–T10、60 个图纸物品、2 种经验材料、`gearConfig`；`def-factory/gear.ts` 与 `variant.gearSlots()`；`default-datapack` 与 base 示例数据包挂载 |

**测试**：新增 `tests/engine/gear-system.test.ts`（13 例）：三槽声明、装配扣图纸、材料不足不扣款、经验进位与上限、非法材料 / 未装配 / 满级拒绝、未满级拒绝升阶、升阶保留等级、max-tier、**tier 效果整体替换与线性成长**、只读视图三态、跨线记忆单调、伞事件 source、base 内容回归。

**验收**：`npx tsc --noEmit` 通过；`npm test` **138 文件 / 1277 测试**通过；`npm run check:architecture` 通过；`npm run gen:schema` 已重生成；`npm run build` 通过。

**未做（B 段 / 后续）**：tier 效果的运行时消费（`ProgressionEffectResolver`）、装备图鉴页、per-variant 数值 override、掉落掉落来源接入（图纸目前只能靠背包/测试获得）。

## 相关路由

- [[docs/plan-work/active/adr-0008-character-progression-boundaries]]：C0-4 装备 tier 按 Variant 隔离、槽类型由 datapack 声明、只推进 tier；B 段投影推迟
- [[docs/plan-work/active/task-0041-character-progression-and-memory]]：§6.4 三固定槽 + 爱用品 + 色彩异常槽；P1/P2 施工切片
- [[docs/docs-828/02-modules/color]]：色彩装备（与本文严格分家）
- [[docs/docs-828/03-data-structures/character-entities]] · [[docs/docs-828/03-data-structures/player-state]]
- [[docs/docs-828/04-mechanisms/state-mutation]] · [[docs/docs-828/05-conventions/schema-sync]] · [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/plan-work/newPlan/00-index]]：本目录入口
