// ============================================================
// engine/types/entities.ts — 数据包实体定义（Def）
// ============================================================

import type { TagPath } from '../tag';
import type {
  AreaId,
  Character,
  CharacterRarity,
  CharacterSchool,
  EnhancementId,
  InitId,
  ItemId,
  SpotId,
  StoryId,
} from './ids';
import type { ExtraCompound, ExtraValue } from './extra';
import type { Condition, ConditionGroup, Effect, FuncletDef, ValueExpression } from './expression';

/**
 * 数据包可声明的资源显示条目：驱动 UI 资源条渲染哪些资源、如何标注。
 * 将 header 等 UI 中硬编码的货币注解（信用点 / 青辉石）解耦为数据配置，
 * 数据包编辑者可自定义显示的货币、标签、可选策略与排序。
 */
export interface ResourceDisplayDef {
  /** 资源 ID（三段式，如 base:resource:credit）。 */
  resourceId: string;
  /** 资源条上显示的标签（如「信用点」「青辉石」）。 */
  label: string;
  /** 详情面板 / tooltip 中显示的完整名称（可选，默认回退 label）。 */
  detailLabel?: string;
  /** 显示策略：always 常显；hasAmount 仅持有量 > 0 时显示（稀有/可选货币）。默认 always。 */
  showWhen?: 'always' | 'hasAmount';
  /** 资源条上的排序权重（越小越靠前，默认 0）。 */
  order?: number;
}

// --- 角色元数据 ---

export interface CharacterData {
  id: Character;
  name: string;
  displayName: string;
  school: CharacterSchool;
  rarity: CharacterRarity;
  description: string;
  /** 对特定标签 Spot 的产出加成倍率 (1.0 = 无加成) */
  spotTagBonus: Record<string, number>;
  /** 全局效果描述 */
  passiveDescription: string;
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export interface CharacterBonusTable {
  characterId: Character;
  spotId: string;
  multiplier: number;
}

// --- 实体定义 (Datapack) ---

/**
 * 进入条目（Entry）：Init / Area 被进入时按声明顺序评估执行。
 *
 * 机制：
 * - 缺省条目（无 first / condition）= 每次进入都执行；
 * - `first = true` 仅在该实体首次被进入时执行（Init 以 PlayerState.visitedInits 判定，Area 以 visitedAreas 判定）；
 * - `condition` 满足才执行；`first` 与 `condition` 可组合（两者皆满足才执行）。
 *
 * 与 Trigger 的 on:init / on:area 区别：Entry 由进入流程直接驱动、无事件竞态与顺序开销，
 * 适合确定性初始化；Trigger 则用于与其它事件源统一的响应式逻辑。
 */
export interface EntryEffectDef {
  /** 仅首次进入时执行。缺省 false = 每次进入都评估。 */
  first?: boolean;
  /** 进入条件：满足才执行。缺省 = 无条件。 */
  condition?: ConditionGroup;
  /** 满足条件时按顺序执行的效果。 */
  effects: Effect[];
}

export interface InitDef {
  id: InitId;
  name: string;
  description: string;
  /** 进入条目列表：进入该 Init 时按声明顺序评估执行（支持首次/条件进入）。 */
  enterEffects?: EntryEffectDef[];
  defaultAreas: AreaId[];
  /** 进入该 Init 时自动触发的起始剧情（active）。缺省 = 不自动展开。 */
  startStoryId?: StoryId;
  /** 该世界线专属 Trigger：进入时挂载，离开时移除。 */
  triggers?: TriggerDef[];
  /**
   * 揭示 Trigger 列表：existence 目标即「实体是否出现」（原 visibilityCondition 的职责），
   * name / condition / utility 分别控制信息块揭示。
   */
  revealTriggers?: RevealTrigger[];
  /**
   * 解锁该 Init 所需的一次性购买费用。
   * 为空或空数组 = 免费 Init，初次 startNewGame 即可直接进入。
   * 非空 = 需在任意世界线中积累足量资源后购买，购买解锁后永久可用。
   */
  purchaseCost?: ResourceAmount[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

/** 购买世界线的返回结果。 */
export type InitPurchaseError = 'NotFound' | 'AlreadyUnlocked' | 'InsufficientResource';

export type InitPurchaseResult =
  | { success: true; initId: InitId }
  | { success: false; initId: InitId; error: InitPurchaseError };

export interface AreaDef {
  id: AreaId;
  initId: InitId;
  name: string;
  description: string;
  defaultSpots: SpotId[];
  /** 进入条目列表：进入该 Area 时按声明顺序评估执行（支持首次/条件进入）。 */
  enterEffects?: EntryEffectDef[];
  /** 可达的相邻 Area（有向）。仅在当前 Init 内有效，跨 Init 移动不适用。 */
  adjacentAreaIds?: AreaId[];
  /** 揭示 Trigger 列表：existence 目标即「实体是否出现」（原 visibilityCondition 的职责）。 */
  revealTriggers?: RevealTrigger[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export interface SpotDef {
  id: SpotId;
  areaId: AreaId;
  name: string;
  description: string;
  baseCost: ValueExpression;
  baseCostResource: string;
  baseYield: ValueExpression;
  baseYieldResource: string;
  baseCapacity: number;
  managerBonusYield: ValueExpression;
  conditionText?: string;
  levelUpgrades?: LevelUpgradeDef[];
  /**
   * 通用升级（优先级高于 levelUpgrades 的 cost 段）：
   * - 产出线性提升：level N 的基础产出 = baseYield + (N-1) * yieldPerLevel。
   * - 花费指数增长：升到 level N 花费 = floor(upgradeCostBase * upgradeCostGrowth^(N-1))。
   * 通用路径下 levelUpgrades 仍可用于指定特定等级的附加效果（cost 为空时自动走公式）。
   * 缺省 upgradeCostBase → 回退 levelUpgrades 逐级定义（兼容旧数据）。
   */
  yieldPerLevel?: number;
  upgradeCostBase?: number;
  upgradeCostGrowth?: number;
  /** 等级上限（undefined = 无限制）。Affector 可修改上限，优先级见 effectiveMaxLevel 文档。 */
  maxLevel?: number;
  /** 层级标签（路径数组，如 ['field','combat']）。child 从属 parent。 */
  tags: TagPath[];
  /**
   * 跨世界线共享设施（脱离 Init）：
   * - 等级与管理角色不随世界线切换 / 软重启 / 硬重启 / 开新游戏而重置
   *   （进度存于全局层，不写入各 Init 快照）。
   * - 产出不受"是否身处所属世界线"限制，任何世界线运行期间都持续生效。
   * - 仍按其 areaId 归属展示（进入对应 Init/Area 时可见、可升级）。
   * 缺省 false = 普通设施，进度按世界线隔离。
   */
  global?: boolean;
  /**
   * 揭示 Trigger 列表：未满足时名称/条件/效用被遮挡，购买需先揭示。
   * unlock 目标 = 自动解锁条件（条件满足时 spot 无需购买即被授予）。
   */
  revealTriggers?: RevealTrigger[];
  /** Spot 提供的功能：持续生效的加成效果，随等级线性增强，可带生效条件。 */
  functionalities?: SpotFunctionalityDef[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

/**
 * Spot 功能定义（插件式接口：以 kind 区分功能类型，未来可扩展新类型）。
 * 功能分两种来源：
 * - 内源：SpotDef.functionalities（Spot 自身声明）。
 * - 外源：已获得的 Enhancement 通过 addsFunctionalities 注入（作用于匹配 tag 的 Spot）。
 * 持续型功能（linearYield）类比 Affector，在结算时按 Spot 等级生效；
 * 交互型功能（restartInit / hardResetInit）由 UI 提供操作入口。
 */
export interface SpotFunctionalityDef {
  id: string;
  /** 生效条件（可选）：满足才计入功能效果。可引用统计 DSL 等。 */
  condition?: ConditionGroup;
  /** 功能类型：linearYield = 升级提供线性额外产出；restartInit = 软重启（保留快照+统计）；hardResetInit = 硬重置（删除快照，下次进入该 Init 为崭新，保留统计）。 */
  kind: 'linearYield' | 'restartInit' | 'hardResetInit';
  /** linearYield：线性产出目标资源（三段式 base:resource:xxx）。 */
  resource?: string;
  /** linearYield：每级线性额外产出量。 */
  amountPerLevel?: number;
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export interface LevelUpgradeDef {
  level: number;
  /** 升级花费；缺省时走通用公式 upgradeCostBase × growth^(N-1)。 */
  cost?: ValueExpression;
  condition?: ConditionGroup;
  effects: Effect[];
}

/**
 * Enhancement 的挂靠元数据（仅 UI 展示用，不参与作用域结算）。
 * 作用域统一为全局（一般即当前 Init，除非有特别的全局特性）。
 * - area / init / global 描述该增强"挂靠/来源"的位置信息。
 */
export type EnhancementAttachment =
  | { kind: 'area'; areaId: AreaId }
  | { kind: 'init'; initId: InitId }
  | { kind: 'global' };

export interface EnhancementDef {
  id: EnhancementId;
  name: string;
  description: string;
  effects: Effect[];
  autoApply: boolean;
  maxStacks?: number;
  /** 购买所需资源（为空表示仅需满足条件即可获得）。 */
  price?: ResourceAmount[];
  /** 解锁后对 Spot 产出的倍率（如 1.5 = +50%）。聚合时组内累乘。 */
  productionMultiplier?: number;
  /**
   * 该倍率只作用于带有这些 tag 的 Spot（层级匹配：query 命中 declared 前缀）。
   * 为空/未设置 = 作用于全部 Spot；否则匹配 productionTags 中的任一 tag。
   */
  productionTags?: TagPath[];
  /** 挂靠元数据（仅 UI 展示用，不参与作用域结算）。 */
  attachment?: EnhancementAttachment;
  /** 获得后为匹配 Spot 注入的外源功能（作用于 productionTags 命中的 Spot；空 = 全局）。 */
  addsFunctionalities?: SpotFunctionalityDef[];
  /**
   * 获得后挂载的 Affector 包 ID 列表（用于持续被动效果）。
   * 推荐用法：消耗品的效果应在 useEffects 中声明；需要"持有即生效"的持续效果应
   * 通过 Enhancement 的此字段挂载，而非直接挂在 Item 上。
   */
  affectorPackIds?: string[];
  /**
   * 揭示 Trigger 列表：每个 Trigger 独立负责一个信息块的揭示。
   * unlock 目标 = 实际解锁条件（条件满足才可购买 / 获得，缺省 = 无条件）。
   * 缺省 = 立即可见（兼容现状）。级别见 RevealStage。
   */
  revealTriggers?: RevealTrigger[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

/**
 * 信息揭示阶梯（可购买实体）：
 *   invisible    L0 不可见（未满足存在条件）
 *   presence     L1 知晓这里有一个未解锁内容
 *   partial      L2 知晓名称 或 解锁条件
 *   known        L3 知晓名称与解锁条件
 *   utility      L4 并知晓效用
 *   purchaseable L5 解锁条件满足，可购买
 *   owned        L6 已购买
 */
export type RevealStage =
  | 'invisible'
  | 'presence'
  | 'partial'
  | 'known'
  | 'utility'
  | 'purchaseable'
  | 'owned';

/**
 * 揭示目标：信息阶梯中由单个 Trigger 负责揭示的信息块。
 * existence = 实体是否出现（原 visibilityCondition 的职责，已并入本系统）。
 * unlock    = 实际解锁 / 自动解锁条件（可达性层，engine 直接消费；其余 target 仅做信息揭示）。
 */
export type RevealTarget = 'existence' | 'name' | 'condition' | 'utility' | 'unlock';

/**
 * 揭示 Trigger：负责单一揭示任务的信息块揭示条款。
 * 条件满足即揭示对应信息块；同一信息块可有多个 Trigger（任一满足即揭示）。
 * Def 原型上的揭示信息由可变 Trigger 列表（revealTriggers）表达，而非固定四段阶梯。
 */
export interface RevealTrigger {
  /** 本 Trigger 负责揭示的信息块。 */
  reveal: RevealTarget;
  /** 触发条件：满足时揭示。可为单条原子条件（Condition）或组合条件（ConditionGroup）。缺省 = 恒真。 */
  condition?: Condition | ConditionGroup;
}

/** Active / Passive 共享的基底字段。 */
export interface BaseStoryDef {
  id: StoryId;
  name: string;
  /** 可触发的初始场景（空数组表示所有 Init 均可触发）。 */
  availableInits: InitId[];
  pages: StoryPage[];
  /** 揭示 Trigger 列表：未满足时名称/触发条件被遮挡。 */
  revealTriggers?: RevealTrigger[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

/** 主线 / 支线剧情：进入场景时自动展开，不可重复。 */
export interface ActiveStoryDef extends BaseStoryDef {
  type: 'active';
  /**
   * 触发条件 —— 仅当条件满足时才会被自动展开。
   * active 故事由 `InitDef.startStoryId` 或手动 `startActiveStory()` 触发，
   * 不参与被动抽选池，因此没有 `weight` / `repeatable` 字段。
   */
  triggerCondition: ConditionGroup;
}

/** 随机闲聊：当无剧情进行时，按权重随机抽取。 */
export interface PassiveStoryDef extends BaseStoryDef {
  type: 'passive';
  /** 触发条件 —— 仅当条件满足时才会进入抽选池。 */
  triggerCondition: ConditionGroup;
  /** 是否允许多次触发。 */
  repeatable: boolean;
  /** 多次被动闲聊之间的冷却帧数。 */
  cooldownFrames: number;
  /** 抽选权重。 */
  weight: number;
  /**
   * 完结奖励：闲聊完整播放到最后一页后发放。
   * first = 当前世界线内首次完成该闲聊；repeat = 重复完成。
   * 用于发放跨世界线保留的全局资源（如青辉石）。
   */
  completionReward?: { first?: Effect[]; repeat?: Effect[] };
}

/** 活跃剧情 与 被动闲聊 的联合类型。 */
export type StoryDef = ActiveStoryDef | PassiveStoryDef;

export interface StoryPage {
  text: string;
  speaker?: string;
  choices?: StoryChoice[];
  effects?: Effect[];
  /**
   * 回复按钮文案（该 Talklet 由底部"回复"按钮承载推进）。
   * 缺省 = 用 text 作为按钮文案。
   */
  sendText?: string;
  /**
   * 点击工作：要求玩家连续点击该 Talklet 的回复按钮
   * `base + rand(0, rand)` 次（rand 缺省 = 0）才能推进到下一条。
   * 按钮上会显示从左往右填充的进度条，用于模拟回消息/完成复杂任务。
   * 注意：页面存在 choices 时该字段被忽略（选项优先）。
   */
  clickWork?: { base: number; rand?: number };
}

export interface StoryChoice {
  text: string;
  effects: Effect[];
  condition?: ConditionGroup;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  description: string;
  icon?: string;
  maxStack: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'consumable' | 'material' | 'key';
  /** 揭示 Trigger 列表：existence 目标即「实体是否出现」（原 visibilityCondition 的职责，已并入本系统）。 */
  revealTriggers?: RevealTrigger[];
  useCondition?: ConditionGroup;
  useEffects?: Effect[];
  pickupEffects?: Effect[];
  sellPrice?: ResourceAmount;
  affectorPackIds?: string[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export interface ResourceAmount {
  resourceId: string;
  amount: number;
}

export interface DropTableDef {
  id: string;
  entries: DropTableEntry[];
  guaranteed?: { itemId: ItemId; count: number }[];
  maxRolls: number;
  condition?: ConditionGroup;
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export type AffectorState = 'Latent' | 'Active' | 'Removed';

export interface AffectorEffect {
  id: string;
  condition?: ConditionGroup;
  effects: Effect[];
}

export interface AffectorPackDef {
  id: string;
  entries: AffectorEffect[];
  persistent?: boolean;
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export interface AffectorInstance {
  instanceId: string;
  packId: string;
  mountEntityId: string;
  state: AffectorState;
  activeEntryIds: string[];
}

export interface DropTableEntry {
  itemId: ItemId;
  min: number;
  max: number;
  weight: number;
  condition?: ConditionGroup;
}

// --- Trigger 系统（对外 DSL：事件侦测 → 条件 → 执行） ---

/** 侦测来源：由哪些运行时事件驱动检查。 */
export type TriggerEventDef =
  | { kind: 'tick'; every?: number }
  | { kind: 'resource'; resource?: string }
  | { kind: 'spotLevel'; spotId?: string }
  | { kind: 'item'; itemId?: string }
  | { kind: 'story'; storyId?: string }
  | { kind: 'init'; initId?: string }
  | { kind: 'area'; areaId?: string };

export interface TriggerDef {
  id: string;
  /** 侦测条件：事件模式决定"何时检查"（内容作者不直接接触 EventBus）。 */
  on: TriggerEventDef;
  /**
   * 附加条件：满足才执行（可引用统计 DSL / tag / 状态）。
   * 可为单条原子条件（Condition）或组合条件（ConditionGroup）。
   */
  condition?: Condition | ConditionGroup;
  /** 执行效果：桥接到内部 Effect 系统。 */
  effects: Effect[];
  /** 一次性触发（默认 true）。once:false 时条件满足即可重复触发。 */
  once?: boolean;
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

// --- Datapack 汇总 ---

export interface Datapack {
  name: string;
  version: string;
  inits: InitDef[];
  areas: AreaDef[];
  spots: SpotDef[];
  enhancements: EnhancementDef[];
  stories: StoryDef[];
  items: ItemDef[];
  dropTables?: DropTableDef[];
  affectorPacks?: AffectorPackDef[];
  triggerDefs?: TriggerDef[];
  funcletDefs: FuncletDef[];
  characters: CharacterData[];
  characterBonuses: CharacterBonusTable[];
  /** 资源条显示条目（可选）：数据包自定义 UI 中展示的资源、标签与可选策略。 */
  resourceDisplays?: ResourceDisplayDef[];
  /**
   * Extra 全局常量表（扁平键 → 节点值）：加载时展开为树并合并进 Registry.extras。
   * 键即 ExtraPath（如 'meta/author'），/ 分隔、禁空段；与各 Def 的 extra 字段、
   * 运行时 PlayerState.extras 构成三层合并视图（见 docs/13 §5.3）。
   */
  extras?: Record<string, ExtraValue>;
}

// --- 可知性 / 可达性层级（Access Stage） ---

/**
 * 实体在系统中的状态阶段，自上而下层层收窄：
 *
 *   可见性层  hidden      实体不出现在界面（revealTriggers 的 existence 门槛不满足）
 *   揭示层    obfuscated  可见但数值以 ??? 遮挡（未满足揭示条件）
 *   揭示层    revealed    可见且数值完整展示（已拥有/已激活）
 *   可达性层  accessible  可进入 / 解锁 / 使用（Init 解锁、Area 相邻、Spot 购买、
 *                         Enhancement 条件满足、Story 可演出等逐级放行）
 *   生效层    active      运行时持续生效（Affector Latent/Active、Trigger 命中执行、
 *                         Spot 功能按条件产出生效、动态 Tag 增删触发重估）
 *
 * 顺序：可见性 → 揭示 → 可达性 → 生效。先看见，再看全，再进得去，才持续生效。
 * 可见性由 revealTriggers 中的 existence 目标承担（原 visibilityCondition 的职责）。
 */
export type AccessStage = 'hidden' | 'obfuscated' | 'revealed' | 'accessible' | 'active';
