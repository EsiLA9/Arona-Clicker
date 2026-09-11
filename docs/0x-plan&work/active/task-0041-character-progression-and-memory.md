# Task 0041：角色成长与记忆体系（Character Progression & Memory）

状态：🟢 A 段已实施（2026-09-11）→ 见 [[docs/0x-plan&work/active/adr-0008-character-progression-boundaries]]：C0 已收口；**A 段**（状态与记忆骨架）已落地，**B 段**（投影 / 追赶 / Chara-Spot）推迟另立子任务。本文保留原始设计草案与 §3.2 清理记录。

> 本文回答：如何把现有 `RosterEntry` / `CultivateSystem` / `AffectionSystem` / 色彩装备提升为一个统一的**角色成长领域**，并跨世界线提供「记忆—追赶」；而不是再起一套并行的养成系统。
>
> 来源：2026-09-11 与 SOL/GPT 的角色培养设计草案。本文采纳其分层骨架，但以**当前仓库实况**重写边界、指出提案未覆盖的结构矛盾，并给出可从 P0 落地的切片。
>
> 设计权威：代码与 [[docs/docs-828/00-INDEX]]。本文只登记目标、边界、切口与待裁定；机制正文仍在 `docs/docs-828/`。
>
> 命名冲突提醒：仓库已有 `CharacterProgressionPort`（`src/arona-clicker/contracts/character-progression.ts`，**纯计算端口**，非本任务）。本任务新增能力一律用 `CharacterProgress*` / `CharacterMemory*` / `ProgressionEffectResolver` 等名字，避免与既有端口混淆。

## 一、结论先行（本文的判断）

一句话：**这个方案值得做，但最值钱的不是「加等级字段」，而是把已经断掉的角色→生产链路重新接通，并让「跨世界线的记忆」成为 AronaClicker 自己的养成节奏。**

| 提案要点 | 本文判断 | 说明 |
| --- | --- | --- |
| Proto / Variant / Loadout / Memory 四层 | ✅ 采纳 | 与现有 Character/Variant 两层结构天然契合 |
| 从 `RosterEntry` 提升为 `VariantProgress` | ✅ 采纳（破坏性，清档） | 无存档迁移纪律下可自由重塑 |
| 等级与星级解绑 | ✅ 采纳 | 这是跨 Init 追赶成立的前提 |
| 三槽固定装备 + 只存 `tier` | ✅ 采纳 | 效果从 Def 重解析，防平衡污染存档 |
| 爱用品是 Progression Track 而非 Inventory | ✅ 采纳 | 全案最好的一个区分 |
| Proto 总好感 = 差分求和 | ⚠️ 修正 | 必须走**台阶 Milestone 去重**，不能线性叠战力 |
| Trait（习得 / 激活 / 抛弃） | ✅ 采纳，但放 P3 | 与多世界线/Story 极其契合，是长期深度来源 |
| Color Equipment 作异常规则槽 | ✅ 采纳 | 但当前它连效果都没接进生产（见 §三） |
| `characterProgressChanged` 单一事件 + 少量语义事件 | ✅ 采纳 | 尊重 `EVENT_CATALOG` 闭集纪律 |
| 卡牌只作为 consumer，预留三接口 | ✅ 采纳 | 现在不设计 Card Stats |
| **角色加成如何投影到生产** | 🔴 补充（提案未提） | 立项时该链路有三代悬空实现（已移除，见 §3.2）；本任务需从零建立统一投影，否则对玩家可见度为零 |
| **manager 是 proto、progression 是 variant** | 🔴 补充（提案未提） | 结构性矛盾，必须在 C0 裁定 |

## 二、三条不可动摇的边界

这三条边界决定未来几十种养成内容的返工量；其余都是往槽里装东西。

```text
① Proto   vs Variant      「她这个人」vs「这张差分」
② Current vs Memory vs Stats   现在是什么 vs 达到过什么 vs 做了多少
③ Progression State vs Effect Projection   玩家做到哪 vs 这些进度解释成什么效果
```

- **① Proto / Variant**：战力式培养（等级/技能/装备/专武/星级）属于 Variant；「我和这个人相处多久」属于 Proto（总好感、记忆、跨差分解锁）。直接解决「同角色所有差分好感总和」的归属。
- **② Current / Memory / Stats**：
  - `Current Progress` = 当前真正可用的养成状态（随 roster 归属层 global/init）；
  - `Memory` = 跨世界线历史事实 / 历史最大值（**永远 global**，独立于 roster scope）；
  - `Stats` = 行为累计量（三层桶，已有）。
- **③ State / Effect**：养成系统只写状态，**绝不直接改产出**；一切经统一 resolver 投影成 `Effect[]`，再交给现有 Effect / Affector / zone 体系。

## 三、当前事实与代码落点

### 3.1 已有地基（本任务不重造）

| 能力 | 现状 | 落点 |
| --- | --- | --- |
| 进度对象 | `RosterEntry { variantId, acquiredVia, level, exp, stars, equippedEquipment, acquiredCount, affectionLevel?, affectionExp? }` | `src/arona-clicker/types/character.ts` |
| 培养纯计算 | `resolveCurve / applyExp / checkBreakthrough`；`effectiveMaxLevel = maxLevel + stars × levelCapPerStar` | `src/arona-clicker/services/cultivate-system.ts` |
| 好感纯计算 | 100 级阶梯曲线、`affectionLevelCapOf`（星级锁，默认 `[20,20,20,20,20,100]`） | `src/arona-clicker/services/affection-system.ts` |
| 纯计算端口 | `CharacterProgressionPort`（经 `runtime-wiring` `setProgression` 注入） | `src/arona-clicker/contracts/character-progression.ts` |
| 写入口 | `acquireCharacter / addExp / breakthroughStar / addAffectionExp / equipEquipment`（改值→记统计→发事件） | `src/arona-clicker/state/state-mutation-service.ts` |
| 归属层 | `characterPersistConfig`（roster/gacha/equips/chatRead，默认 `global/global/global/init`）+ `PER_INIT_FIELD_SPECS` 的 `characterContainer` 三 scope | `character-persist.ts`、`per-init-fields.ts`、`registry.ts` |
| 原型统计 | `state.protoStats: Record<Character, { acquiredTotal, cultTotal }>` | `types/state.ts` |
| 色彩装备 | 定义/收集/`effectsOf()` 查询面齐全 | `color-equipment-system.ts` |
| 效果语言 | Effect 25 op / Trigger 9 kind / Affector 四通道（含 `zoneModifiers`） | `docs/docs-828/02-modules/effect-trigger` |
| 事件目录 | `EVENT_CATALOG` 对 `GameEvent['type']` **闭集编译期锁定** | `src/arona-clicker/contracts/event-catalog.ts` |

### 3.2 角色 → 生产链路：三代旧实现已移除（2026-09-11）

> 立项时发现历史上叠了**三代**「角色直接加成生产」的实现，且全部悬空/冻结，对产出的贡献**恒为 0**。已在 Task 0041 前置清理中整体移除（类型检查 / 架构检查 / 全量 131 文件·1239 测试通过），为统一的 `ProgressionEffectResolver` 投影链腾出唯一入口。

```text
第 1 代  CharacterBonusTable { characterId, spotId, multiplier }         [已移除]
第 2 代  SpotDef.managerBonusYield + SpotBuilder.managerBonus(n)         [已移除]
第 3 代  CharacterData.spotTagBonus / CharacterVariantDef.spotTagBonus   [已移除]
辅助     getManagerBonus / getSpotYield / assignManager / UI「Manager 加成」行  [已移除]

保留     spotManagers / setManager（Effect op）/ managerChanged / manager 条件   [非加成链路]
```

移除范围（本次同步）：契约 + 解析器（`fragment-parser` / `zip-loader`）+ Registry + runtime 警告 + 默认/示例数据包（`AronaClickerCore`、`addition_test` 的 JSON 与重打包 zip）+ 编辑器 Schema（`gen:schema` 重生成）+ 相关测试（含 `character-freeze.test.ts` 整文件删除）。

**保留说明**：`spotManagers` / `setManager` / `managerChanged` / `manager` 条件不属于加成链路，仍用于「是否已指派学生」的门控与条件判定，故保留。

**剩余悬空项**：色彩装备 `effectsOf()` 仍无运行时消费点（`equipmentEquipped` 的 `subscribe: []`）；`equips` 归属 scope 已声明但 `equipmentsOwned` 未进 `PER_INIT_FIELD_SPECS`（恒 global）。二者留待 §九 P1 的投影链统一处理。

## 四、目标数据模型

### 4.1 State（现状与目标）

```ts
PlayerState {
  // 当前可用进度（Variant 级，随 characterPersistConfig.roster 归属）
  roster: Record<VariantId, VariantProgress>;
  fragments: Record<VariantId, number>;

  // 跨世界线历史（Proto 级，永远 global，不进 PER_INIT_FIELD_SPECS）
  characterMemory?: Record<Character, CharacterMemory>;
}

interface VariantProgress {
  variantId: VariantId;
  acquiredVia: CharacterAcquireVia;
  acquiredCount: number;

  level: number;
  exp: number;
  stars: number;

  affectionLevel: number;   // v1 保留扁平，减少聊天/条件/UI 的改动面
  affectionExp: number;

  skills?: Record<SkillId, SkillProgress>;          // P1 起
  gear?: [GearProgress?, GearProgress?, GearProgress?]; // 只存 tier
  favorite?: { tier: number };
  uniqueWeapon?: { stars: number };
  colorEquipment?: EquipmentId;                     // 原 equippedEquipment 正名
  traits?: Record<TraitId, TraitProgress>;          // P3
}

interface SkillProgress { level: number; proficiency: number; }
interface GearProgress { tier: number; }
interface TraitProgress { state: 'active' | 'inactive' | 'abandoned'; learnedAt?: number; proficiency?: number; }

interface CharacterMemory {
  variants: Record<VariantId, VariantMemory>;
  affectionTotalEver: number;
  variantsEverOwned: VariantId[];
  lifetime: { expGained: number; cultivateSpent: number; affectionGained: number };
}
interface VariantMemory {
  maxLevel: number; maxStars: number; maxAffection: number;
  maxSkillLevels?: Record<SkillId, number>;
  maxGearTier?: [number, number, number];
  maxFavoriteTier?: number; maxUniqueWeaponStars?: number;
  traitsEverLearned?: TraitId[];
}
```

要点：
- **Memory 只存 `max*` 与历史事实，不持有当前状态**；它是 global 顶层字段，**不登记进 `PER_INIT_FIELD_SPECS`**。
- `equippedEquipment` → `colorEquipment` 是语义正名（它是「异常规则槽」，不是第四件 BA 装备）；属 P0 破坏性更名，随清档一起做。
- `ProtoStat` 不继续膨胀；保留其「获得/培养累计」职责，其余历史迁入 `CharacterMemory`，避免变成垃圾桶对象。

### 4.2 Def（数据包声明「可能性」，State 描述「玩家做到哪」）

```ts
CharacterVariantDef {
  curve?: CultivateCurveId;                 // 已有
  progression?: {
    skills?: SkillDef[];
    gearSlots?: [GearSlotDef, GearSlotDef, GearSlotDef]; // 槽类型由角色声明
    favoriteItem?: FavoriteItemId;
    uniqueWeapon?: UniqueWeaponId;
    initialTraits?: TraitId[];
  };
}

GearSlotDef { type: string; tiers: { tier: number; cost?: Cost; effects: Effect[] }[] }
FavoriteItemDef { owner: VariantId; stages: { unlock?: Condition; cost?: Cost; effects: Effect[] }[] }
UniqueWeaponDef { owner: VariantId; stars: { star: number; cost?: Cost; effects: Effect[] }[] }
CharacterBondDef { milestones: { totalAffection: number; effects: Effect[] }[] }   // 挂在 Character
TraitDef { id: TraitId; name: string; effects?: Effect[]; learnCondition?: Condition; abandonCondition?: Condition }
```

- 所有 tier/stage/star 效果**只存定义，不存解析值**：存档只记 `tier=4`，效果每次从 Def 重解析 → datapack 改平衡不污染存档。
- 改这些实体字段后**必须** `npm run gen:schema` 并在 `editor-extras.ts` 兜底；`engine-schema.sync.test.ts` 三向一致检查（见 [[docs/docs-828/05-conventions/schema-sync]]）。

## 五、玩法轴：四条主 + 两条缀

这是「AronaClicker 自己」而非「网页版 BA 养成菜单」的关键。每条轴都要能被玩家感知，并落回经营/世界线循环。

| 轴 | 玩家感受 | 重置性 | AronaClicker 落点 |
| --- | --- | --- | --- |
| **培养**（等级/技能/装备） | 这一世界的她现在多强 | 随 Init | 直接改善 Spot 产出/构筑 |
| **突破**（星级/专武） | 我在这个 Variant 上投入多深 | 随归属 | 解锁 Affector / 能力上限 / 专属剧情 |
| **关系**（好感 + Proto Bond） | 我和「这个人」建立了什么 | 较永久 | 台阶剧情、尾巴、Proto Milestone |
| **记忆**（Memory + 追赶） | 我们一起做到过什么 | 永久 | 跨世界线快速追赶、重启动机 |
| **经历**（Trait） | 她因为经历变成了谁 | 永久事实 | 行为习得，Story/Condition 可引用 |
| **构筑**（Color Equipment） | 用怪规则改造她的定位 | 收集永久 | 跨常规体系的特殊规则 |

### 5.1 为什么先做「记忆」而不是「专武」

- 专武/爱用品本质是**数值与机制的包装**，晚做不返工；
- 记忆/追赶是 AronaClicker **区别于 BA 的独有节奏**：它让 roadmap-0004 的「roster 改 init 级」从「惩罚玩家」变成「老师学会了怎么培养她」。**Memory 就是 roadmap-0004 的答案**；
- 因此 P2 里 Memory + catch-up 的优先级高于专武。

### 5.2 玩法风险（必须正面处理）

若养成只产数值，放置游戏会退化成「等待→升级数值」。真正有深度的是**角色作为 Spot 管理者/构筑件**。所以本文反复强调：**本任务最有价值的施工是把 progression 接进 Effect/zone 系统**，让「把谁放到哪个 Spot」「用哪条爱用品/色彩规则」成为决策，而不是让数字被动增长。

## 六、各子系统设计

### 6.1 等级与等级上限（解绑星级）

现状 `effectiveMaxLevel = maxLevel + stars × levelCapPerStar` 是早期原型。目标：

```text
有效等级上限 = min(Variant 绝对上限, 当前 Init/账号开放上限, 特殊 Condition 上限)
```

- 等级代表「当前世界线的普通培养」，星级代表「纵向突破」，**星级不再直接抬等级上限**；
- 于是 catch-up 不被星级绑死：新 Init 里角色从 Lv.1 起，随世界线上限提高而快速追赶；
- `levelCapPerStar` 的去留与兼容属 C0-3。

### 6.2 星级 + 专武：一条纵向链，数据分开

```text
Variant 1★→2★→3★→4★→5★ ──解锁──▶ Unique Weapon 1★→2★→…
```

升级节点主要解锁 **Effect / Affector / 能力上限 / 剧情**，而非硬编码「攻击 +N」。碎片继续 Variant 隔离（`checkBreakthrough` 只读 `fragments[variant.id]`）。

### 6.3 技能：level + proficiency 两维

- `level`：离散、玩家主动、消耗材料升级；
- `proficiency`：由实际行为积累（对应提案的「其他技能经验」）。
- 预留统一行为入口，卡牌未来只需上报 `CharacterActionPerformed { skill, amount, context }`，无需重造 `cardSkillExperience`。
- v1 只做 `level`；`proficiency` 放 P3（但字段在 P0 留好）。

### 6.4 装备：三固定槽 + 爱用品 Track + 色彩异常槽

- 三槽类型由 Variant 声明（`gearSlots`），玩家只推进 `tier`，不能换类别 → 状态极简、平衡不脏档；
- **爱用品 = 角色自己的 Progression Track**（`FavoriteItemDef`），不是 Inventory Equipment，用来改变该 Variant 某个已有机制；
- 色彩装备保持独立，重新定位为「跨常规体系的特殊构筑槽」，避免沦为「紫装备 +15%」。

### 6.5 好感 + Proto Bond Milestone

- Variant 级 `affectionLevel/affectionExp` 保留；
- Proto 级总好感 = Σ 各 Variant 好感；
- **不线性给战力**，改走台阶：

| 总好感 | 效果 |
| ---: | --- |
| 10 | 解锁角色档案 |
| 25 | Proto Effect I |
| 50 | 特殊对话 |
| 100 | Proto Effect II |
| 200 | 特殊 Character Trait |
| 400 | 收藏/展示效果 |

- resolver 以 proto 为 key 聚合并**去重**：同一 proto 的 milestone 只计一次，避免「差分越多越膨胀」。

### 6.6 Trait（P3，但 P0 要留位置）

`TraitProgress.state ∈ { active, inactive, abandoned }`。**记录 abandoned 而非删除**，让世界「记得」：

```text
hasTrait(x) / hadTrait(x) / abandonedTrait(x)   // 进 Condition DSL 才成立
Story 才能写：「你以前可不是这样的。」
```

习得来源：Story、Spot 工作时长、资源消费行为、等级、好感、特殊 Init、未来卡牌。

### 6.7 统一 Effect 投影（本任务的施工核心）

```text
Character Progress ──▶ ProgressionEffectResolver ──▶ Effect[] / ZoneModifier
                                                        └─▶ 现有 Effect / Affector / Condition
```

```ts
type CharacterEffectContext =
  | { kind: 'spot'; spotId: SpotId }
  | { kind: 'production' }
  | { kind: 'story' }
  | { kind: 'passiveTalk' }
  | { kind: 'card'; battleId?: string };

resolveCharacterEffects(state, variantId, context): Effect[]
```

聚合来源：星级 / 技能 / 普通装备 / 爱用品 / 专武 / Proto Bond / Trait / Color Equipment。

工程纪律：
- **单源注入**：把某 Variant 的累计效果作为一个 zone 源 `progression:<variantId>`（或单一 Affector 实例）同步进 GameNum，而不是每帧全量求值；
- **事件驱动重同步**：`cultivated` / `affectionChanged` / `characterAcquired` / `equipmentEquipped` / `managerChanged` / 新 `characterProgressChanged` 触发失效，与 [[docs/0x-plan&work/active/task-0034-affector-performance-review]] 的性能结论对齐；
- 未来卡牌**只是新增一个 context**，不为卡牌重写养成。

## 七、Memory / Stats / Catch-up

### 7.1 三者分工（不混成一种东西）

```text
Stats   = 行为累计量（做了多少）      → 已有三层桶
Memory  = 历史事实 / 历史最大值（达到过什么） → 新增，永远 global
Current = 当前可用养成状态            → roster，随 scope
```

- Memory 与 Stats **都在写入口同一提交内更新**（与统计同源）；否则跨 Init 追赶不可信；
- Memory 不进 `PER_INIT_FIELD_SPECS`：它必须比 roster 更持久。

### 7.2 追赶（Catch-up）

```text
若 current < memory.max：
  等级：经验需求 × 0.2
  技能：素材需求 × 0.35
  装备：强化资源需求 × 0.5
  好感：获得好感 × 2
直到追上历史值为止
```

- 不直接白送资源，而是提供**追赶修正**；玩家感受是「老师已经知道怎么培养她」；
- **追赶必须可观察**：UI 明确显示「世界线记忆修正 ×0.2 经验需求」之类，符合 [[docs/abstract]] §15.4 可解释性；隐藏系数会直接损害信任；
- catch-up 强度可配置、可关闭（C0-7）。

## 八、事件设计纪律

- 新增**单一伞事件** `characterProgressChanged { variantId, domain, before, after, source }`，`domain ∈ level|star|skill|gear|favorite|uniqueWeapon|affection|trait|colorEquipment`；
- 仅对真正有游戏意义的动作再提供语义事件：`characterLeveled` / `characterStarUp` / `characterAffectionLevelUp` / `characterTraitLearned` / `characterTraitAbandoned`；
- **禁止** `equipmentTier3Reached` / `equipmentSlot1Changed` 式碎片事件，否则 `EVENT_CATALOG` 疯长；
- 所有新事件必须进 `EVENT_CATALOG`（`Record<GameEvent['type'], …>` 闭集会在编译期强制补齐 emit/subscribe 说明）；
- 现有 `cultivated` / `affectionChanged` 是否被伞事件取代、还是保留给订阅方，属 C0-6。

## 九、施工切片

### P0：统一数据骨架（破坏性，清档）

- [ ] `VariantProgress` 形状定型（含 `gear` / `skills` / `favorite` / `uniqueWeapon` / `traits` 占位，允许为空）；
- [ ] `equippedEquipment` → `colorEquipment` 正名；
- [ ] 新增 global 顶层 `characterMemory` 骨架（空实现，先只读）；
- [ ] `CharacterVariantDef.progression` 与各 Def 表占位 + `npm run gen:schema` + editor 兜底；
- [ ] 保留现有等级/星级/好感/色彩装备行为不回退；
- [ ] 迁移现有 cultivate/affection/roster 测试。

### P1：经典闭环 + 接线（对玩家可见）

- [ ] 等级上限定源改造（star 解绑）；
- [ ] 技能 `level` + 三槽装备 `tier` 写入口与 UI；
- [ ] **`ProgressionEffectResolver` + 单源 zone/Affector 注入 + 失效链**；
- [ ] 从零建立 progression → 生产投影（旧 `managerBonusYield` / `spotTagBonus` 已移除，不做「解冻」而是新建统一 resolver）；
- [ ] UI 只读消费（`getView()` / `createUIContext()`）。

### P2：AronaClicker 化

- [ ] Proto Bond Milestone；
- [ ] `CharacterMemory` + catch-up（依赖 C0-2 roster scope，见 roadmap-0004）；
- [ ] 爱用品 Track；
- [ ] 专武。

### P3：扩展成长

- [ ] Trait（learned/active/abandoned + Condition DSL）；
- [ ] Skill proficiency + `CharacterActionPerformed`；
- [ ] Color Equipment 特殊能力；
- [ ] `CharacterCapabilitySnapshot` 供卡牌 consumer。

> 提案建议**先不施工**专武/爱用品/Trait 的完整玩法——本文同意；P0/P1 只需把它们的**数据位置与投影入口**留对。

## 十、待裁定问题

### C0（阻塞施工）

1. **manager 主体**：`spotManagers` 存 `Character`(proto)，progression 在 Variant。角色加成投影到 manager 所在 Spot 时，用「该 proto 的哪个 Variant」？可选：manager 改存 `variantId`（破坏性但清晰）／保留 proto + 引入「出战差分」概念。**必须裁定**。
2. **roster 默认 scope**：`global`（现状）还是 `init`（roadmap-0004 方向）？Memory/catch-up 只在 init 级下才有意义。**与 [[docs/0x-plan&work/active/roadmap-0004-chara-ownership]] 联合裁定**。
3. **等级上限来源**与 `levelCapPerStar` 去留。
4. **装备 tier 的隔离粒度**（Variant 隔离？）与槽类型是否必须由 datapack 声明。
5. **Memory 与 roadmap-0004 的「追赶统计」是否合并**，避免两套历史口径。
6. 事件：保留 `cultivated`/`affectionChanged` 还是由 `characterProgressChanged` 取代。
7. catch-up 强度与是否可关闭。
8. `equips` scope 的实际归属（当前 `equipmentsOwned` 恒 global，与 config 声明不一致）。

### C1（可后置）

- Trait 的 Condition DSL 具体函数名与求值时机；
- Proto Bond milestone 的数值表；
- 爱用品/专武是否需要独立 ID 命名空间。

## 十一、测试与验收

每个切片至少：

```text
npx tsc --noEmit
npm test
npm run check:architecture
npm run gen:schema   # 改实体字段时
```

新增专项测试方向：

- `VariantProgress` 形状与 `Memory` 的 `max*` 单调性；
- 等级上限 `min(...)` 各级来源与边界；
- catch-up 系数：不得越过 `memory.max`；
- `resolveCharacterEffects` 各 context 分支与 Proto milestone 去重；
- 失效链：`cultivated`/`affectionChanged`/`equipmentEquipped`/`managerChanged` → GameNum 重算一致；
- `PER_INIT_KEY_GUARD` 编译期守卫仍成立；
- `engine-schema.sync.test.ts` 三向一致。

浏览器验收：角色页各轴可视、追赶修正有明示、重启后角色手感验证。

## 十二、非目标与风险

### 非目标

- 不编写任何存档迁移/版本兼容代码（纪律 8，旧档失效直接清档）；
- 不设计 Card Stats / 卡牌战斗数值；
- 不做装备词条随机、强化失败等概率系统；
- 不铺开 BA 式的海量培养材料（第一阶段只保留：角色经验、通用技能材料、装备强化材料、角色碎片、少量特殊突破材料）；
- 不把「所有养成」一次性做进 UI。

### 风险

| 风险 | 处理方式 |
| --- | --- |
| 新建投影链引发产出回归 | 先做只读诊断/可比对快照，再灰度接通 |
| GameNum 失效风暴 | 单源 `progression:<id>` + 事件合批，参考 task-0034 结论 |
| 养成只涨数值、缺构筑感 | P1 即接线 Effect/zone，而非只加等级 |
| 事件目录膨胀 | 伞事件 + 少量语义事件，禁止 per-tier 事件 |
| Schema 漂移 | 改实体即 `gen:schema` + editor 兜底 + 三向测试 |
| 与 roadmap-0003/0004 顺序冲突 | 先完成 roadmap-0001 S1c 的 character/variant id 三段化，再做归属翻转 |
| UI 大改返工 | 只读接口先行，Presenter 一次派生 View |

## 十三、关联文档与代码入口

- 上游路线：[[docs/0x-plan&work/active/roadmap-0004-chara-ownership]]、[[docs/0x-plan&work/active/roadmap-0003-gacha-pool-model]]、[[docs/0x-plan&work/active/roadmap-0001-datapack-management]]
- 策划草案：[[docs/0x-plan&work/newPlan/01-ownership-and-development]]、[[docs/0x-plan&work/newPlan/05-fragments-and-currency]]、[[docs/0x-plan&work/newPlan/06-meta-loop-and-ui]]、[[docs/0x-plan&work/newPlan/07-mvp-scope]]
- 相邻任务：[[docs/0x-plan&work/active/task-0039-spot-shop-transaction-system]]（培养消费的 Cost 事务语义）、[[docs/0x-plan&work/active/task-0032-passive-story-scheduling]]（Story 消费者）、[[docs/0x-plan&work/active/task-0034-affector-performance-review]]（失效性能）
- 已实现机制：[[docs/0x-plan&work/completed/affection-planning]]、[[docs/0x-plan&work/completed/color-system-plan]]
- 机制文档：[[docs/docs-828/02-modules/character]]、[[docs/docs-828/04-mechanisms/cultivate]]、[[docs/docs-828/02-modules/stats]]、[[docs/docs-828/02-modules/color]]、[[docs/docs-828/01-architecture/state-layers]]、[[docs/docs-828/03-data-structures/player-state]]、[[docs/docs-828/05-conventions/schema-sync]]
- 玩法上下文：[[docs/abstract]]
- 代码入口：
  - `src/arona-clicker/types/character.ts`、`src/arona-clicker/types/state.ts`
  - `src/arona-clicker/contracts/character-progression.ts`
  - `src/arona-clicker/services/cultivate-system.ts`、`affection-system.ts`、`roster-system.ts`、`color-equipment-system.ts`
  - `src/arona-clicker/state/state-mutation-service.ts`、`per-init-fields.ts`
  - `src/arona-clicker/runtime-wiring.ts`、`runtime-game-instance.ts`
  - `src/arona-clicker/contracts/event-catalog.ts`
  - `src/arona-clicker/services/spot-service.ts`
  - `src/data-services/contracts/character-variant.ts`、`cultivate-curve.ts`、`affection-config.ts`、`character-persist.ts`
