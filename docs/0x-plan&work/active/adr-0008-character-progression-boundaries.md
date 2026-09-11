# ADR 0008：角色成长体系边界与 A 段状态骨架

**状态：🟢 A 段已实施（2026-09-11）；C0 全部收口，B 段推迟。**
**日期：2026-09-11**

## 背景

[[docs/0x-plan&work/active/task-0041-character-progression-and-memory]] 提出把 `RosterEntry` / `CultivateSystem` / `AffectionSystem` / 色彩装备提升为统一的角色成长领域，并新增跨世界线记忆与追赶。立项核对暴露三处结构问题：

1. 历史上三代「角色 → 生产」加成实现全部悬空（对产出贡献恒为 0），已在 0041 前置清理中移除（见 task-0041 §3.2），但缺少统一投影入口；
2. `spotManagers` 以 `Character`(proto) 为主体，而养成进度在 Variant——投影到 Spot 时主体不明确；
3. 归属翻转依赖 [[docs/0x-plan&work/active/roadmap-0001-datapack-management]] S1c（character/variant id 三段化，**未开工**）与 [[docs/0x-plan&work/active/roadmap-0004-chara-ownership]]（**未裁定**）。

经逐项裁定，把 0041 拆为 **A 段**（状态与记忆骨架，可施工）与 **B 段**（投影 / 追赶 / Chara-Spot，推迟另立子任务）。

## 决策（C0 裁定，2026-09-11）

1. **好感归属（C0-9）**：好感属 Variant（`VariantProgress.affection*` 保留）；Proto 总好感 = Σ 各 Variant 好感。维持已实现的 [[docs/0x-plan&work/completed/affection-planning]] 口径，`newPlan/01` 的「好感属于人、跨 Variant 共享」作废。
2. **Chara-Spot（C0-1）**：本轮**不设计**角色 ↔ Spot 机制，manager 主体问题就地消解。`spotManagers` / `setManager` / `managerChanged` / `manager` 条件仅保留门控用途，不承载加成。
3. **归属翻转（C0-2）**：**冻结**，待 roadmap-0003 / roadmap-0004 联合裁定；本轮 roster 归属维持 `global`。跨 Init 追赶随之推迟。
4. **等级上限（C0-3）**：废弃 `levelCapPerStar`；有效等级上限 = `min(Variant 绝对上限, state.accountLevelCap, 特殊 Condition 上限)`；**星级不再抬等级上限**。`accountLevelCap` 为 global 状态字段，默认无上限（`Infinity`），提升机制后续接入。
5. **装备（C0-4）**：装备 tier 按 Variant 隔离；槽类型由 datapack `gearSlots` 声明；玩家只推进 `tier`，不换类别。
6. **事件（C0-6）**：新增伞事件 `characterProgressChanged { variantId, domain, before, after, source }`，并**取代** `cultivated` / `affectionChanged`（两事件从 `GameEvent` 联合与 `EVENT_CATALOG` 移除，订阅方迁移到伞事件 + `domain` 过滤）；禁止 per-tier / per-slot 碎片事件。详见 A6。
7. **Memory 口径（C0-5）**：`CharacterMemory` 只存历史最大值与历史事实，永远 global（**不进** `PER_INIT_FIELD_SPECS`）；行为累计量归 roadmap-0004 统计，本轮仅登记接口、不实现合并。
8. **追赶（C0-7）**：catch-up 强度与开关随 B 段推迟。
9. **`equips` scope（C0-8）**：A 段修正 `equipmentsOwned` 未登记 `PER_INIT_FIELD_SPECS` 的现状不一致（默认仍 `global`）。
10. **分段**：A 段 = 状态与记忆骨架（无运行时投影，effects 只声明不消费）；B 段 = `ProgressionEffectResolver` + 单源 zone 注入 + Chara-Spot 消费者 + catch-up，另立子任务。

## A 段设计规格

### A1 状态形状（破坏性，清档；不写迁移）

`src/arona-clicker/types/character.ts`：

```ts
interface VariantProgress {            // 原 RosterEntry，更名
  variantId: VariantId;
  acquiredVia: CharacterAcquireVia;
  acquiredCount: number;
  level: number;
  exp: number;
  stars: number;
  affectionLevel: number;
  affectionExp: number;
  colorEquipment: EquipmentId | null;                  // 原 equippedEquipment，正名（异常规则槽）
  skills?: Record<SkillId, SkillProgress>;             // 占位
  gear?: [GearProgress?, GearProgress?, GearProgress?]; // 占位，只存 tier
  favorite?: { tier: number };                         // 占位
  uniqueWeapon?: { stars: number };                    // 占位
  traits?: Record<TraitId, TraitProgress>;             // 占位
}
interface SkillProgress { level: number; proficiency: number; }
interface GearProgress { tier: number; }
interface TraitProgress { state: 'active' | 'inactive' | 'abandoned'; learnedAt?: number; proficiency?: number; }
```

- `state.roster?: Record<VariantId, VariantProgress>` 字段名保留，仅类型更名。
- 新增 ID 别名（`src/engine/types/character.ts`）：`SkillId` / `TraitId` / `FavoriteItemId` / `UniqueWeaponId`（沿用现有 `string` 别名风格）。
- 保留现有等级 / 星级 / 好感 / 色彩行为不回退（等级上限除外，见 A3）。

### A2 CharacterMemory（global 只读骨架）

`src/arona-clicker/types/state.ts` 新增顶层 `characterMemory?: Record<Character, CharacterMemory>`，**不登记** `PER_INIT_FIELD_SPECS`：

```ts
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

- 写入口（`acquireCharacter` / `addExp` / `breakthroughStar` / `addAffectionExp` / `equipEquipment`）在同一提交内同步维护 Memory，保证跨线可信。
- `max*` 单调性有专项测试；Memory 是只读查询面（UI / 未来 catch-up）。
- `protoStats` 保留其「获得 / 培养累计」职责，不迁入 Memory。

### A3 等级上限定源（C0-3）

- 删除 `CultivateCurveDef.levelCapPerStar` 与 `CurveView.levelCapPerStar`（含 `def-factory/cultivate-curve.ts` builder、`content/cultivate-curves.ts`、`addition_test/04-records.json`，并重生成 `engine-defs.gen.json`）。
- `effectiveMaxLevel(curve, stars)` 改为 `resolveVariantLevelCap(def, state)`：`min(curve.maxLevel, state.accountLevelCap ?? Infinity, <特殊 Condition 上限占位>)`。
- 新增 global 状态字段 `state.accountLevelCap?: number`（缺省 = 无上限），提升机制后续接入。
- 注意 `spot-service.getEffectiveMaxLevel(spotId)` 是**设施**等级上限，与角色无关，不改名、不动。

### A4 Def 占位（只声明，无消费）

- `CharacterVariantDef.progression?: { skills?: SkillDef[]; gearSlots?: [GearSlotDef, GearSlotDef, GearSlotDef]; favoriteItem?: FavoriteItemId; uniqueWeapon?: UniqueWeaponId; initialTraits?: TraitId[] }`。
- 新实体：`SkillDef` / `GearSlotDef`（inline 于 variant）、`FavoriteItemDef`（表）、`UniqueWeaponDef`（表）、`TraitDef`（表）、`CharacterBondDef`（`CharacterData.bond`）。
- Datapack 增表 `favoriteItems?` / `uniqueWeapons?` / `traits?`；`CharacterData.bond?`。
- 流程：改实体 → `npm run gen:schema` → `editor-extras.ts` 兜底 → `engine-schema.sync.test.ts` 三向一致。
- **无运行时消费者**：effects / cost 只作声明；投影与消费统一留给 B 段。

### A5 Proto Bond Milestone

- 总好感 = Σ `variant.affectionLevel`（纯计算，不新存状态）。
- `CharacterBondDef.milestones` 为 Def；本轮只做只读计算 + 去重（同一 proto 的 milestone 只计一次），无 effect 消费。

### A6 事件：伞事件取代 `cultivated` / `affectionChanged`

新增（`src/engine/types/events.ts`）：

```ts
| { type: 'characterProgressChanged';
    variantId: string;
    domain: 'level'|'star'|'skill'|'gear'|'favorite'|'uniqueWeapon'|'affection'|'trait'|'colorEquipment';
    before?: number; after?: number; source: string }
```

**写入映射**（`state-mutation-service`）：

| 旧事件 | 旧触发时机 | 新事件 |
| --- | --- | --- |
| `cultivated(kind:'exp')` | 仅当升级（`leveledUp`） | `characterProgressChanged{ domain:'level', after:newLevel, source:'addExp' }` |
| `cultivated(kind:'star')` | 突破成功 | `characterProgressChanged{ domain:'star', after:newStars, source:'breakthroughStar' }` |
| `affectionChanged` | 好感成功入账（每次） | `characterProgressChanged{ domain:'affection', before:旧级, after:新级, source:'addAffectionExp' }` |
| `equipEquipment` 成功 | 装配 / 卸下 | `characterProgressChanged{ domain:'colorEquipment', source:'equipEquipment' }` |

**订阅方迁移**（全部消费点已核对，见下）：

| 订阅方 | 现状 | 迁移 |
| --- | --- | --- |
| `condition-deps` | `CONDITION_DEP_EVENT_TYPES` 含 `affectionChanged`；`eventEntityKeyOf` 返回 `variantId`；`affectionLevel` 叶子 index 到 `affectionChanged` | 两处改 `characterProgressChanged`；`eventEntityKeyOf` 仅 `domain === 'affection'` 返回 `variantId`；`affectionLevel` 叶子 indexKey 不变 |
| `ui-controller-events` | `on('affectionChanged')` 用 `leveledUp` + `newLevel` 播报 | `on('characterProgressChanged')`：`domain === 'affection' && after > before` 视为跨级；文案用 `after` |
| `trigger-system` | `TriggerEventKind 'cultivated'` → `'cultivated'`；`matchesEvent` 读 `event.kind` | `ON_KIND_TO_EVENT.cultivated = 'characterProgressChanged'`（**author 侧 kind 名与 `cultivation` 过滤保留**，不改数据包 DSL）；`matchesEvent` 改判 `event.domain === (on.cultivation === 'star' ? 'star' : 'level')` |
| `EVENT_CATALOG` | `cultivated` / `affectionChanged` 两条 | 删两条，新增 `characterProgressChanged`（补 emit/subscribe 说明） |
| `expression.ts` 注释 | 指向 `affectionChanged` | 改指 `characterProgressChanged(domain:'affection')` |

**同步面（编译期穷尽会强制补齐）**：

- `GameEvent` 联合 + `EVENT_CATALOG`（`Record<GameEvent['type'], …>` 闭集）；
- `condition-deps.CONDITION_DEP_EVENT_TYPES` + `eventEntityKeyOf` switch；
- `trigger-system.ON_KIND_TO_EVENT` + `matchesEvent`；
- 测试：`tests/engine/trigger-kind.test.ts`、`tests/engine/affection-system.test.ts`、`tests/engine/cultivate-system.test.ts`；
- 文档：`declarative-dsl` §5、`trigger-effect`、`state-mutation`、`cultivate`、`character.md`、`effect-trigger.md`、`affection-planning`（加取代注记）；
- 内容 / 数据包：已核对 `datapack/**` 与 `src/arona-clicker/content/**` **无** `kind:'cultivated'` 使用，无需内容改动；`editor-extras.ts` 的 `cultivated` trigger kind 选项保留。

**语义损失（已确认无消费方）**：`affectionChanged.delta` / `newExp` 不再携带；`cultivated.newStars` 以 `after` 承载。若未来确有需要，B 段再扩 payload。

**旁注**：`EVENT_CATALOG` 现标注 `affectionChanged` 订 `trigger-system`，但 `ON_KIND_TO_EVENT` 未映射该事件（实际未订阅）——迁移时一并核实纠正。

### A7 收尾

- C0-8：`InitSnapshot` 增 `equipmentsOwned?`，`PER_INIT_FIELD_SPECS` 增 `equips` scope 分支（`characterContainer` 的 scope 联合扩展为含 `'equips'`），保持 `PER_INIT_KEY_GUARD` 编译期绿。
- 文档同步：task-0041 状态、[[docs/docs-828/03-data-structures/character-entities]]、[[docs/docs-828/04-mechanisms/cultivate]]、[[docs/docs-828/04-mechanisms/roster]]、[[docs/docs-828/03-data-structures/player-state]]、`newPlan/01` 好感口径。
- 验收：`npx tsc --noEmit` + `npm test` + `npm run check:architecture` + `npm run gen:schema`。

## 后果

- **破坏性清档**（架构纪律 8：不写迁移代码，旧档失效重来）。
- A 段落地的 progression effects **暂时悬空**（无消费端）；必须在 B 段设计出消费者后才有玩家可见度，期间不得对外宣称角色加成已生效。
- B 段强依赖 roadmap-0004 归属裁定与 S1c id 三段化，未完成前不可启动。
- `newPlan/01` 存在与 C0-9 相反的口径，需回修以免双源漂移。

## 实施前检查单（A 段开工第一步）

1. 前置清理（task-0041 §3.2，三代加成移除）当前在 working tree **未提交**；先单独提交并跑绿，建立可回滚基线。
2. 跑 `npx tsc --noEmit` + `npm test` + `npm run check:architecture` 确认基线（立项记录 1239 测试通过）。
3. 按 A1 → A7 顺序施工，每步带 vitest 测试。

## A 段实现记录（2026-09-11）

全部切片落地，验收命令全绿：

| 切片 | 落地 |
| --- | --- |
| A1 | `RosterEntry` → `VariantProgress`；`equippedEquipment` → `colorEquipment`；新增 ID 别名与 `SkillProgress`/`GearProgress`/`TraitProgress` 占位 |
| A2 | `state.characterMemory` + `state/character-memory.ts` 助手；写入口同源维护；`max*` 单调（专项测试） |
| A3 | 废弃 `levelCapPerStar`；新增 `resolveVariantLevelCap` + global `state.accountLevelCap`（缺省无上限） |
| A4 | `CharacterVariantDef.progression` + `favoriteItems` / `uniqueWeapons` / `traits` 表 + `CharacterData.bond`；`gen:schema` + editor 兜底 |
| A5 | Proto Bond Milestone 仅 Def 声明；总好感历史值由 `CharacterMemory.affectionTotalEver` 承载（去重求解随 B 段，暂无消费端） |
| A6 | `characterProgressChanged` 取代 `cultivated` / `affectionChanged`（Trigger author 侧 kind `cultivated` 保留映射） |
| A7 | `equipmentsOwned` 纳入 per-Init 快照（`equips` scope，缺省 global）；docs-828 与 newPlan/01 同步 |

验收：`npx tsc --noEmit` 通过；`npm test` **133 文件 / 1248 测试**通过；`npm run check:architecture` 通过；`npm run gen:schema` 已重生成。

未做（B 段 / 后续）：投影链与 Chara-Spot、catch-up、技能 / 装备写入口与 UI、Proto milestone effects 消费。代码改动未提交（遵用户未要求不 commit）。

## 相关路由

- [[docs/0x-plan&work/active/task-0041-character-progression-and-memory]]（原始设计草案、§3.2 清理记录）
- [[docs/0x-plan&work/active/roadmap-0004-chara-ownership]] / [[docs/0x-plan&work/active/roadmap-0003-gacha-pool-model]] / [[docs/0x-plan&work/active/roadmap-0001-datapack-management]]（B 段前置）
- [[docs/docs-828/01-architecture/state-layers]] · [[docs/docs-828/03-data-structures/player-state]] · [[docs/docs-828/05-conventions/schema-sync]] · [[docs/docs-828/05-conventions/architecture-discipline]]
- [[docs/0x-plan&work/newPlan/01-ownership-and-development]]（好感口径需回修）
