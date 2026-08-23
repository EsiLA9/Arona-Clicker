# 12-character-rework — Character 系统重构设计

> 配套测试规格：[[1-项目/ACProgram/docs-818/12-character-rework-tests]]（验收以该文档 ID 为准）
> 状态：**原型设计稿**。本文档定义玩法概念、实体字段、引擎落点与原型里程碑。

## 1. 概念模型

```
CharacterData（原型，沿用现有实体）
 └─ CharacterVariantDef（差分，Datapack 声明，≥1 个）
      ├─ 独立培养曲线 / 加成 / 碎片余额
      └─ RosterEntry（玩家持有实例，PlayerState）
ColorDef（色彩 = 可装备收藏品）
EquipDef（通用装备）/ ExclusiveWeaponDef（专属武器）  ← 第二迭代
GachaPoolDef（卡池声明）→ GachaMode（代码定义，不可插拔）
Availability：限定池 ∪ 世界 Pool → 角色可获得渠道
```

### 核心规则

1. **获得**：一切获得途径收敛为 Effect `grantCharacter(variantId)`；重复获得 → 返还**该变体自己的碎片** + 卡池配置的附加资源（`dupRewards`）。差分碎片互不相通（Hoshino ≠ HoshinoSwimsuit ≠ HoshinoArmed）
2. **培养四轨**：经验等级 / 星级（碎片突破）/ 装备（第二迭代）/ 色彩槽。培养曲线按 `CultivateCurveDef` 声明
3. **色彩**：至少配一个首选色 `primary`，UI 其余 token 按 HSL 深/浅确定性派生；显式多色配置覆盖派生项；效果走现有 Effect 体系（轻量）
4. **抽取模式**：GachaMode 是引擎代码注册表（首实现 `ba-classic`），数据包只声明池参数，不提供模式可插拔
5. **可及性**：Pool Def 自声明成员；角色仅在「活动限定池」或「世界 Pool」（事件/池结束后进入的常驻集合）中可获得；story/event 显式授予不受限
6. **三层归属**：`CharacterPersistConfig` 由数据包作者声明 roster/gacha/equips/chatRead 各自 `global | init`
7. **不做存档迁移**（AGENTS.md 纪律 #7）：旧结构直接废弃清档
8. **旧机制冻结**：manager 产出加成路径移除、`characterBonuses` 废弃、`spotManagers` 字段保留不生效

---

## 2. Datapack 新增实体

### 2.1 CharacterVariantDef（角色差分）

```ts
interface CharacterVariantDef {
  /** @label ID */ id: string;                       // 如 'HoshinoSwimsuit'
  /** @label 原型 @ref characters */ proto: Character;
  name: string; displayName: string;
  school: CharacterSchool; rarity: CharacterRarity;
  description: string;
  /** @label 默认差分 */ isDefault?: boolean;        // 迁移/图鉴主展示用，每原型至多一个
  /** 对标签 Spot 的产出加成（当前冻结，字段预留） */
  spotTagBonus?: Record<string, number>;
  /** @label 培养曲线 @ref cultivateCurves */ curve?: CultivateCurveRef; // 缺省全局默认
  /** 色彩槽位数（缺省 1） */ colorSlots?: int;
  extra?: ExtraCompound;
}
```

### 2.2 CultivateCurveDef（培养曲线）

```ts
interface CultivateCurveDef {
  /** @label ID */ id: string;
  /** @label 等级上限 */ maxLevel: int;
  /** 各级升级需求（长度 = maxLevel-1）；缺省线性默认曲线 */
  expTable?: number[];
  /** 星级上限与各级突破消耗（单位：该变体碎片） */
  starMax?: int;
  starCost?: number[];        // starCost[s] = 从 s 升 s+1 所需碎片
  /** @label 每级加成 */ levelBonusPerLevel?: ValueExpression; // 预留：培养驱动的数值来源
}
```

### 2.3 ColorDef（色彩）

```ts
interface ColorDef {
  /** @label ID */ id: string;
  name: string; description?: string;
  /**
   * 主题 token。至少给 primary；
   * 其余 token 缺省时由 primary 经 HSL 明度/饱和度深浅规则确定性派生。
   * 支持全量 token（近整 UI 配色自定义）。
   */
  theme: Partial<Record<ThemeToken, string>>;   // ThemeToken = 'primary'|'bg'|'bgAlt'|'text'|'accent'|...
  /** 可选轻数值效果（Effect 体系） */ effects?: Effect[];
  /** 解锁条件：引用 protoStats / story flag 等 */ unlock?: Condition | ConditionGroup;
  /** 装备后的槽位表现（占位，第二迭代细化） */ slotCost?: int;
}
```

### 2.4 GachaPoolDef（卡池）

```ts
type GachaMode = 'ba-classic';   // 代码注册表，非数据包可扩展

interface GachaPoolDef {
  /** @label ID */ id: string;
  name: string; description?: string;
  /** @label 抽取模式 */ mode: GachaMode;          // 未知值加载期报错
  /** @label 货币 */ currency: Resource;
  costPerPull: int;
  /** 稀有度权重表 */ rates: { rarity: CharacterRarity; weight: number }[];
  featured?: VariantRef[];                          // UP 差分
  pity?: { guaranteedAt: int; keepOnHit?: boolean };
  /** 重复获得返还（该变体碎片数量 + 附加资源） */
  dupRewards?: { shards: int; bonusResources?: Record<Resource, int> };
  /** 可及性：本池成员；关闭后成员进入世界 Pool */
  members: VariantRef[];
  /** 池关闭条件（事件完成等）；缺省 = 常驻开放 */ closeWhen?: Condition | ConditionGroup;
}
```

### 2.5 ChatMessageDef（聊天流，原型仅基础版）

```ts
interface ChatMessageDef {
  /** @label ID */ id: string;
  /** @label 所属差分 @ref characterVariants */ owner: VariantRef;
  order: int;
  content: string;
  /** 解锁条件（缺省 = 获得即可读） */ unlock?: Condition | ConditionGroup;
}
```

### 2.6 CharacterPersistConfig（三层归属声明）

```ts
interface CharacterPersistConfig {
  /** @label 通讯录归属 */ roster?:   'global' | 'init';   // 默认 global
  /** @label 卡池计数归属 */ gacha?:   'global' | 'init';   // 默认 global
  equips?: 'global' | 'init';
  /** @label 已读记录归属 */ chatRead?: 'global' | 'init'; // 默认 init
}
```

### 2.7 第二迭代实体（本期只预留命名，不实现）

- `EquipDef`（BA 式通用装备：槽位类别 × Tn 品质层）
- `ExclusiveWeaponDef`（每差分 1 件，unlockCost = 该差分碎片 + 材料）

### 2.8 Datapack 汇总变更

```ts
// Datapack 新增：
characterVariants: CharacterVariantDef[];
cultivateCurves?: CultivateCurveDef[];
colors?: ColorDef[];
gachaPools?: GachaPoolDef[];
chatMessages?: ChatMessageDef[];
characterPersistConfig?: CharacterPersistConfig;
// 移除：
characterBonuses   // 废弃，携带时 devLog 警告并忽略
// 冻结：
characters: CharacterData[]   // 保留为原型元数据表（school/rarity/描述/extra），
                              // spotTagBonus 不再参与任何计算
```

---

## 3. PlayerState 新增

```ts
interface RosterEntry {
  variantId: VariantRef;
  acquiredVia: 'gacha' | 'story' | 'event';
  level: int; exp: number;
  stars: int;
  equippedColors: ColorId[];
}

roster: Record<VariantRef, RosterEntry>;       // persist 按 CharacterPersistConfig.roster
fragments: Record<VariantRef, int>;            // 按差分隔离
gachaState: Record<PoolId, { pity: int; pulls: int }>;
activeColor: ColorId | null;
chatRead: Record<MessageId, true>;
worldPool: VariantRef[];                        // 已进入常驻集合的差分
protoStats: Record<Character, ProtoStat>;       // 派生视图，Trigger 维护，不持久化承诺
// ProtoStat = { acquiredTotal: int; cultTotal: number; }
```

---

## 4. 引擎落点

### 4.1 服务划分（重构 `src/engine/character-system.ts`）

| 服务 | 文件 | 职责 |
|---|---|---|
| RosterSystem | `src/engine/roster-system.ts` | 持有查询（通讯录分组/图鉴）、碎片余额 |
| CultivateSystem | `src/engine/cultivate-system.ts` | 升级/突破判定（纯计算，写经 MutationService） |
| GachaService | `src/engine/gacha-service.ts` | GachaMode 注册表 + `ba-classic` roll 流程 + pity |
| ColorSystem | `src/engine/color-system.ts` | 色彩库存/解锁判定/HSL 派生（派生纯函数供 UI 复用） |
| AvailabilityService | `src/engine/character-availability.ts` | 限定池 ∪ 世界 Pool 判定 |

### 4.2 写入口与事件（StateMutationService）

| 方法 | 事件 |
|---|---|
| `acquireCharacter(variantId, via, rewards?)` | `characterAcquired` |
| `addExp(variantId, amount)` / `breakthroughStar(variantId)` | `cultivated` |
| `equipColor(variantId, colorId)` / `activateTheme(colorId)` | `colorEquipped` / `themeChanged` |
| `markChatRead(messageId)` | `chatRead` |
| `rollGacha(poolId, count)` | `gachaResolved`（内含逐次 `characterAcquired`） |

### 4.3 Trigger/Affector 联动

- Trigger：监听 `characterAcquired` / `cultivated` → 更新 `protoStats`
- Trigger：监听池 `closeWhen` 条件满足 → 成员并入 `worldPool`
- 效果求值：色彩 `effects` 走现有 Effect/Affector 通道，无新机制

### 4.4 冻结清单（实现时执行）

- 移除 `tick-system.ts` / `game-num-eval.ts` / `spot-service.ts` / `tooltip.ts` 中 getTagBonus 产出路径
- `tag-stats.ts` 角色统计改消费 roster（单一真相来源）
- `condition-system.ts` 的 hasManager 条件保留（字段未删）

---

## 5. UI 原型布局

```
┌────────┬──────────────────────┬──────────────┐
│ 通讯录  │   中栏：信息流         │ 右栏：培养面板 │
│ 左侧栏  │   （选中角色的         │ （等级/星级/  │
│ 学校分组 │    Momotalk 式流）    │  色彩/碎片）  │
│ +卡池入口│                      │              │
└────────┴──────────────────────┴──────────────┘
```

- 全部只读消费 `getView()` 派生数据；写操作走 controller → StateMutationService
- 主题切换：`activeColor` → ColorSystem 派生完整 token 表 → 注入 CSS 变量

---

## 6. 原型里程碑（任务目标）

> 测试用例编号见 [[12-character-rework-tests]]。每个里程碑以对应测试组全绿收口。

| 里程碑 | 内容 | 验收测试组 |
|---|---|---|
| **M0 类型骨架** | types 新增 §2/§3 全部实体 → `npm run gen:schema` → sync 测试通过 | S 组 |
| **M1 Roster 核心** | acquireCharacter / 差分碎片隔离 / dupRewards / persist 归属（global/init） | R 组、PS 组 |
| **M2 培养** | 经验跨级 / 曲线上限 / 星级突破（差分碎片消费） | C 组 |
| **M3 抽卡** | GachaMode 注册表 + ba-classic / pity / dupRewards / seeded RNG | G 组 |
| **M4 可及性** | 限定池独占 / closeWhen 并入世界 Pool | A 组 |
| **M5 色彩** | 解锁幂等 / HSL 派生纯函数 / activeColor 单选 / 轻数值接入 | CL 组、CT 组 |
| **M6 UI 三栏原型** | 通讯录左栏 / 信息流中栏（基础消息）/ 培养右栏 / 卡池界面 / 主题切换 | U 组 |
| **M7 冻结回归** | manager 加成路径移除 / tag-stats 对齐 / 旧套件清理 | F 组、验收标准 |

**明确不在原型内**（第二迭代）：通用装备、专属武器、聊天流高级交互（红点/分支选项）、色彩数值效果的平衡表。

---

## 9. 聊天空间壁垒 / 被动闲聊冷却 / 阻断重启

对话空间（学生 Conversation）与一般聊天共用 `ChatStream` 与 `Story` 机制，按 `PanelState.conversationVariantId` 隔离语境。本次为「每个 Character 从自己独特的聊天空间抽取内容」与「关卡式剧情阻断」提供三项引擎能力：

### 9.1 聊天空间壁垒（owner 路由）
- `PassiveStoryEntry.owner?: VariantId` 与 `PassivePoolDef.owner?: VariantId` 声明归属学生。
- `StoryService.triggerPassiveStory(initId, owner)`：`owner` 为空抽全局闲聊（owner 未设置的 entry/pool）；`owner` 为某 VariantId 时只抽归该学生的内容。
- 抽取层 `PassivePoolSystem.pick` 的壁垒语义：
  - 叶子 entry 的 **effective owner = `entry.owner ?? 最近声明 owner 的祖先池`**（池内 entry 继承池归属）；
  - **无 owner 的中间池是中立容器**，放行其子树，不约束归属；
  - 仅"显式声明 owner 的池"整体受壁垒约束，整枝仅对该学生可见。
- UI 层 `controller.ts` 在对话空间抽取时传 `this.panelState.conversationVariantId` 作 owner，实现壁垒。

### 9.2 抽取冷却（cooldownFrames）
- `PassiveStoryEntry.cooldownFrames?` 与 `PassivePoolChild.cooldownFrames?` / `PassivePoolDef.cooldownFrames?`。
- 命中后 `StoryService` 在完结落账点写入 `PlayerState.passiveCooldowns[id] = totalFrames`；池级冷却对"命中其内任一 entry"的池一并写入。
- 抽选时 `totalFrames - 上次帧 < cooldownFrames` 的 entry/池被剪枝，过期后自动恢复。计时复用以 `PlayerState.totalFrames`（帧/tick）。

### 9.3 对话空间阻断 / 重启（block）
- `PassiveStoryEntry.block?: ConditionGroup`：播完最后一页后，`StateMutationService.setStudentBlock(owner, entryId)` 锁定该学生对话空间。
- 锁定期间该学生对话空间抽取被剪枝，UI 在对话空间渲染锁定横幅（含 `describeCondition` 翻译的解锁条件）。
- 解除检测：`GameInstance.recheckStudentBlocks()` 在每帧 `tick()` 与 `travelToArea()` 成功后调用，若 `block` 条件组现已满足则 `clearStudentBlock` 解除锁定——实现「剧情要求前往某地（到达某区域 / 持有物品 / 置某 flag）后对话空间重启继续下一步」。
- 状态落在 `PlayerState.studentBlocks`（key = VariantId），归属层随 entry 自身（多为 init）。

### 9.4 数据示例
`src/data/base/stories-conversation-walls.ts` 提供可运行示例：星野对话空间池（`owner: 'Hoshino'`，含 600 帧冷却 entry 与带 `block` 的关卡式 entry）、全局冷却演示池（`cooldownFrames: 1200`）。合入 `src/data/base/stories.ts` 的 `basePassiveStories` / `basePassivePools`。

