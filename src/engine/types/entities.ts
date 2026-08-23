// ============================================================
// engine/types/entities.ts — 数据包实体定义（Def）
// ============================================================

import type { TagPath } from '../core/tag';
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
import type {
  CharacterPersistConfig,
  CharacterVariantDef,
  ChatMessageDef,
  ColorDef,
  CultivateCurveDef,
  GachaPoolDef,
  GachaPoolId,
} from './character';

/**
 * 数据包可声明的资源显示条目：驱动 UI 资源条渲染哪些资源、如何标注。
 * 将 header 等 UI 中硬编码的货币注解（信用点 / 青辉石）解耦为数据配置，
 * 数据包编辑者可自定义显示的货币、标签、可选策略与排序。
 */
export interface ResourceDisplayDef {
  /**
   * 资源 ID（三段式，如 base:resource:credit）。
   * @label 资源 ID
   */
  resourceId: string;
  /**
   * 资源条上显示的标签（如「信用点」「青辉石」）。
   * @label 标签
   */
  label: string;
  /**
   * 详情面板 / tooltip 中显示的完整名称（可选，默认回退 label）。
   * @label 详情标签
   */
  detailLabel?: string;
  /**
   * 显示策略：always 常显；hasAmount 仅持有量 > 0 时显示（稀有/可选货币）。默认 always。
   * @label 显示条件
   * @enum always=常显
   * @enum hasAmount=仅持有量>0 显示
   */
  showWhen?: 'always' | 'hasAmount';
  /**
   * 资源条上的排序权重（越小越靠前，默认 0）。
   * @label 排序
   */
  order?: number;
}

// --- 标签（Tag）表现 ---

export interface TagDef {
  /**
   * 层级标签路径串（与 spot.tags / enhancement.productionTags 的 TagPath 对齐），
   * 如 'office' 或 'office/defense'。
   * @label 路径
   */
  id: string;
  /**
   * 展示名（如「办公室」）。
   * @label 名称
   */
  name: string;
  /**
   * 简介（可选）：tooltip 中展示的补充说明。
   * @label 简介
   */
  description?: string;
}

// --- 角色元数据 ---

export interface CharacterData {
  /** @label ID */
  id: Character;
  /** @label 名称 */
  name: string;
  /** @label 显示名 */
  displayName: string;
  /** @label 学校 */
  school: CharacterSchool;
  /** @label 稀有度 */
  rarity: CharacterRarity;
  /** @label 描述 */
  description: string;
  /**
   * 对特定标签 Spot 的产出加成倍率 (1.0 = 无加成)
   * @label 标签产出加成
   */
  spotTagBonus: Record<string, number>;
  /**
   * 全局效果描述
   * @label 被动描述
   */
  passiveDescription: string;
  /**
   * 层级标签（用于按 tag 聚合的收集统计；如 school/combat 主题）。
   * @label 标签
   */
  tags?: TagPath[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export interface CharacterBonusTable {
  /** @label 角色 */
  characterId: Character;
  /** @label 设施 */
  spotId: string;
  /** @label 倍率 */
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
  /** @label ID */
  id: InitId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  /** 进入条目列表：进入该 Init 时按声明顺序评估执行（支持首次/条件进入）。 */
  enterEffects?: EntryEffectDef[];
  /** @label 默认区域 */
  defaultAreas: AreaId[];
  /**
   * 进入该 Init 时自动触发的起始剧情（active）。缺省 = 不自动展开。
   * @label 起始剧情
   */
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
  /**
   * 世界倾斜数值（神圣之塔对地极坐标概念，表述世界变动率）：
   * 1 = 蔚蓝档案官方世界，0 = Vol.Final 指示的前世界。
   * 写法：首位（0 或 1）+ 小数尾数；尾数不足 15 位自动补 0（如 "0.98" → "0.980000000000000"）。
   * 缺省视为 "1.000000000000000"。支持十进制或科学计数法字符串。
   * @label 世界倾斜数值
   */
  worldTilt?: string;
  /**
   * 倾斜值伪装展示字符串：填入后代替「首.尾15」的原始数值展示。
   * @label 倾斜值展示别名
   */
  worldTiltAlias?: string;
  /**
   * 层级标签（用于按 tag 聚合的收集统计）。
   * @label 标签
   */
  tags?: TagPath[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

/** 购买世界线的返回结果。 */
export type InitPurchaseError = 'NotFound' | 'AlreadyUnlocked' | 'InsufficientResource';

export type InitPurchaseResult =
  | { success: true; initId: InitId }
  | { success: false; initId: InitId; error: InitPurchaseError };

export interface AreaDef {
  /** @label ID */
  id: AreaId;
  /** @label 所属世界线 */
  initId: InitId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  /** @label 默认设施 */
  defaultSpots: SpotId[];
  /** 进入条目列表：进入该 Area 时按声明顺序评估执行（支持首次/条件进入）。 */
  enterEffects?: EntryEffectDef[];
  /**
   * 可达的相邻 Area（有向）。仅在当前 Init 内有效，跨 Init 移动不适用。
   * @label 相邻区域
   */
  adjacentAreaIds?: AreaId[];
  /** 揭示 Trigger 列表：existence 目标即「实体是否出现」（原 visibilityCondition 的职责）。 */
  revealTriggers?: RevealTrigger[];
  /**
   * 层级标签（用于按 tag 聚合的收集统计）。
   * @label 标签
   */
  tags?: TagPath[];
  /**
   * 场景特色主题：进入该 Area 时界面自动切换为对应色彩/局部覆盖。
   * @label 场景主题
   */
  theme?: import('./character').ThemeDef;
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

export interface SpotDef {
  /** @label ID */
  id: SpotId;
  /** @label 所属区域 */
  areaId: AreaId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  baseCost: ValueExpression;
  baseCostResource: string;
  baseYield: ValueExpression;
  baseYieldResource: string;
  /** @label 基础容量 */
  baseCapacity: number;
  managerBonusYield: ValueExpression;
  /** @label 条件文本 */
  conditionText?: string;
  levelUpgrades?: LevelUpgradeDef[];
  /**
   * 通用升级（优先级高于 levelUpgrades 的 cost 段）：
   * - 产出线性提升：level N 的基础产出 = baseYield + (N-1) * yieldPerLevel。
   * - 花费指数增长：升到 level N 花费 = floor(upgradeCostBase * upgradeCostGrowth^(N-1))。
   * 通用路径下 levelUpgrades 仍可用于指定特定等级的附加效果（cost 为空时自动走公式）。
   * 缺省 upgradeCostBase → 回退 levelUpgrades 逐级定义（兼容旧数据）。
   * @label 每级产出
   */
  yieldPerLevel?: number;
  /** @label 升级基价 */
  upgradeCostBase?: number;
  /** @label 升级增长 */
  upgradeCostGrowth?: number;
  /**
   * 等级上限（undefined = 无限制）。Affector 可修改上限，优先级见 effectiveMaxLevel 文档。
   * @label 等级上限
   */
  maxLevel?: number;
  /**
   * 层级标签（路径数组，如 ['field','combat']）。child 从属 parent。
   * @label 层级标签
   */
  tags: TagPath[];
  /**
   * 跨世界线共享设施（脱离 Init）：
   * - 等级与管理角色不随世界线切换 / 软重启 / 硬重启 / 开新游戏而重置
   *   （进度存于全局层，不写入各 Init 快照）。
   * - 产出不受"是否身处所属世界线"限制，任何世界线运行期间都持续生效。
   * - 仍按其 areaId 归属展示（进入对应 Init/Area 时可见、可升级）。
   * 缺省 false = 普通设施，进度按世界线隔离。
   * @label 跨世界线共享
   */
  global?: boolean;
  /**
   * 揭示 Trigger 列表：未满足时名称/条件/效用被遮挡，购买需先揭示。
   * unlock 目标 = 自动解锁条件（条件满足时 spot 无需购买即被授予）。
   */
  revealTriggers?: RevealTrigger[];
  /** Spot 提供的功能：持续生效的加成效果，随等级线性增强，可带生效条件。 */
  functionalities?: SpotFunctionalityDef[];
  /** 专有卡池：可在该 Spot 的招募界面访问，区别于全局通用卡池。 */
  gachaPools?: GachaPoolId[];
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
  /** 功能类型：linearYield = 升级提供线性额外产出；restartInit = 软重启（保留快照+统计）；hardResetInit = 硬重置（删除快照，下次进入该 Init 为崭新，保留统计）；gacha = 招募功能入口。 */
  kind: 'linearYield' | 'restartInit' | 'hardResetInit' | 'gacha';
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
  /** @label ID */
  id: EnhancementId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  effects: Effect[];
  /** @label 自动应用 */
  autoApply: boolean;
  /** @label 最大层数 */
  maxStacks?: number;
  /** 购买所需资源（为空表示仅需满足条件即可获得）。 */
  price?: ResourceAmount[];
  /**
   * 解锁后对 Spot 产出的倍率（如 1.5 = +50%）。聚合时组内累乘。
   * @label 产出倍率
   */
  productionMultiplier?: number;
  /**
   * 该倍率只作用于带有这些 tag 的 Spot（层级匹配：query 命中 declared 前缀）。
   * 为空/未设置 = 作用于全部 Spot；否则匹配 productionTags 中的任一 tag。
   */
  productionTags?: TagPath[];
  /**
   * 层级标签（用于按 tag 聚合的收集统计；与 productionTags 的产出匹配语义无关）。
   * @label 标签
   */
  tags?: TagPath[];
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

/**
 * 故事触发入口（Entry）—— 负责「何时何地可触发」与「入口揭示」。
 * 揭示的是『可触发的剧情入口』（revealTriggers / 名称遮挡归 Entry 管）；
 * 演出本体经 `storyId` 重定向到 stories 表中的纯演出 Story。
 * 对外故事 id（startStoryId / hasReadStory / triggerStory / storyTriggered event 均引用本入口 id）。
 */
/**
 * 条件分支奖励包：完结时按条件评估，首个满足的生效。
 * 用于 Story 跳转链产生不同 flag/判定后，Entry 输出不同奖励。
 */
export interface ConditionalReward {
  /** 生效条件：满足时发放此奖励包。 */
  condition: ConditionGroup;
  /** 奖励效果列表。 */
  effects: Effect[];
}

/**
 * 分歧点准入守卫：重阅读时，若玩家尝试进入某条分支（jumpToStory 目标 Story），
 * 但 storyReadLogs 中缺乏指定前置阅读记录，则拒绝该跳转。
 */
export interface BranchGuard {
  /** 受保护的分支目标 Story.id（进入该 Story 前需满足前置阅读）。 */
  storyId: StoryId;
  /**
   * 前置阅读要求列表。
   * talkletIndex = -1 表示要求该 Story 的全部 Talklet 已读。
   */
  prerequisites: { storyId: StoryId; talkletIndex: number }[];
  /** 拒绝时的提示文本。 */
  denialMessage: string;
}

export interface StoryEntryBase {
  /** @label ID */
  id: StoryId;
  /** 演出本体引用：指向 stories 表。当前与 id 1:1 同值，未来允许多 Entry 复用同一 Story。 */
  storyId: StoryId;
  /** 可触发的初始场景（空数组表示所有 Init 均可触发）。 */
  availableInits: InitId[];
  /**
   * 层级标签（用于按 tag 聚合的收集统计与池归类）。
   * @label 标签
   */
  tags?: TagPath[];
  /** 触发条件 —— 仅当条件满足时才会被自动展开 / 进入抽选池。 */
  triggerCondition: ConditionGroup;
  /** 揭示 Trigger 列表：未满足时名称/触发条件被遮挡。 */
  revealTriggers?: RevealTrigger[];
  /**
   * 是否允许重阅读。缺省 false = 不提供重阅读入口。
   * true 时玩家可从 StoryEntry 入口重新阅读关联的 Story 链。
   */
  replayable?: boolean;
  /**
   * 完结奖励策略。缺省 'simple' 兼容现有行为。
   * - simple: PassiveStoryEntry 使用 completionReward 的 first/repeat
   * - conditional: 使用 conditionalRewards 按条件评估，首个满足的生效
   */
  completionStrategy?: 'simple' | 'conditional';
  /**
   * 条件分支奖励列表（completionStrategy = 'conditional' 时使用）。
   * 按声明顺序评估，第一个满足条件的奖励包生效。
   * 适用于：Story 跳转链中不同分支产生不同 flag/判定后，Entry 输出不同奖励。
   */
  conditionalRewards?: ConditionalReward[];
  /**
   * 分歧点准入守卫列表（replayable = true 时生效）。
   * 重阅读时，若玩家尝试进入某个 Talklet 索引（该索引指向一个重大分歧点），
   * 但 storyReadLogs 中缺乏指定的前置 Talklet 阅读记录，则拒绝进入。
   */
  branchGuards?: BranchGuard[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

/** 主线 / 支线剧情入口：进入场景时自动展开，不可重复。 */
export interface ActiveStoryEntry extends StoryEntryBase {
  type: 'active';
}

/** 随机闲聊入口：当无剧情进行时，按权重随机抽取。 */
export interface PassiveStoryEntry extends StoryEntryBase {
  type: 'passive';
  /** 是否允许多次触发。 */
  repeatable: boolean;
  /** 抽选权重。 */
  weight: number;
  /**
   * 完结奖励：闲聊完整播放到最后一页后发放。
   * first = 当前世界线内首次完成该闲聊；repeat = 重复完成。
   * 用于发放跨世界线保留的全局资源（如青辉石）。
   * 当 completionStrategy = 'conditional' 时，此字段被 conditionalRewards 替代。
   */
  completionReward?: { first?: Effect[]; repeat?: Effect[] };
  /**
   * 归属某学生差分的聊天空间（VariantId）。设置后该闲聊仅在该学生的对话空间被抽取，
   * 一般聊天空间只抽 owner 为空的全局闲聊。实现「聊天空间壁垒」。
   */
  owner?: string;
  /**
   * 抽取后冷却帧数：被抽取（最后一页播完）后需经过 N 帧（tick）才能再次被选取。
   * 复用 PlayerState.totalFrames 计数。0 或不设置表示无冷却。
   */
  cooldownFrames?: number;
  /**
   * 阻断/重启条件：播完最后一页后锁定该学生的对话空间，直到该条件组满足才「重启」
   * （解除锁定）。用于如「剧情结束后要求玩家前往某地继续下一步」的关卡式剧情。
   */
  block?: ConditionGroup;
  /**
   * 是否可被「移动 Area」打断（默认 true）。false 时进入该闲聊后不会被移动打断，
   * 其播放状态一直保留，直到剧情自然播完或主动切换。
   */
  interruptible?: boolean;
  /**
   * 播放中是否允许离开 Area（默认 true）。false 时该闲聊播放期间禁止移动
   * （等同 active 的移动锁定，配合 interruptible:false 实现「演出中途不可离场」）。
   */
  leaveArea?: boolean;
}

/** 被动闲聊池子节点：子池引用或叶子 entry 引用。 */
export interface PassivePoolChild {
  /** 子池 id 或 被动闲聊 Entry id。 */
  id: string;
  /** 抽选权重（缺省 1）。叶子实际权重 = 路径上各池权重连乘 × entry 自身权重。 */
  weight?: number;
  /**
   * 抽取后冷却帧数：该子池（或叶子 entry）被选中后需经过 N 帧才能再次被选取。
   * 0 或不设置表示无冷却。
   */
  cooldownFrames?: number;
}

/**
 * 被动闲聊池：把 passiveStories 包装为可策划的树状抽选结构。
 * - gate（condition）经 EventDrivenReactor 反射判定（条件翻转事件定向失效）；
 * - 树状抽取：gate 不过的分支整枝剪除，叶子按「路径权重连乘」加权抽取；
 * - 未被任何池引用的 entry 由引擎自动归入默认根池（平铺语义的退化形态）；
 *   未声明任何池时，全部 entry 进入默认根池——等价于无池的旧模型。
 */
export interface PassivePoolDef {
  /** @label ID */
  id: string;
  /** @label 名称 */
  name?: string;
  /** 层级标签（用于统计与外部 lock/boost 机制定位池）。 @label 标签 */
  tags?: TagPath[];
  /** 池 gate：不满足时整棵子树退出候选。缺省 = 无条件可用。 */
  condition?: ConditionGroup;
  /**
   * 归属某学生差分的聊天空间（VariantId）。设置后该池仅在该学生的对话空间被抽取。
   * 与 PassiveStoryEntry.owner 共同决定壁垒路由。
   */
  owner?: string;
  /**
   * 抽取后冷却帧数：该池被抽取（命中任一内条目）后需经过 N 帧才能再次被选取。
   * 0 或不设置表示无冷却。
   */
  cooldownFrames?: number;
  /** 子节点列表：子池 id 或被动闲聊 Entry id。 */
  children: PassivePoolChild[];
}

/** 活跃剧情入口 与 被动闲聊入口 的联合类型。 */
export type StoryEntryDef = ActiveStoryEntry | PassiveStoryEntry;

/**
 * Story —— 纯演出本体，不含任何触发/揭示逻辑。
 * 仅保留自身 id 供日志记录（storyLog / storyReadLogs 均按 Story.id 记），
 * 支持通过 Talklet.jumpToStory 进行跨 Story 跳转（goto/insert）。
 */
export interface StoryDef {
  /** @label ID */
  id: StoryId;
  /** @label 名称 */
  name: string;
  /** @label Talklet 列表 */
  talklets: Talklet[];
  /** Extra 附加数据（数据包声明的结构化元数据，见 docs/13）。 */
  extra?: ExtraCompound;
}

/** Talklet：微小的演示片段，内嵌于 Story，不可跨故事复用。 */
export interface Talklet {
  /** @label 文本 */
  text: string;
  /** @label 说话人 */
  speaker?: string;
  /** @label 选项 */
  choices?: StoryChoice[];
  /** @label 效果 */
  effects?: Effect[];
  /**
   * 回复按钮文案（该 Talklet 由底部"回复"按钮承载推进）。
   * 缺省 = 用 text 作为按钮文案。
   * 完成本页推进时，该文案默认会作为「老师」回复气泡回显到聊天流；
   * 若无需回显（按钮文案不便以玩家口吻进流），设 muteReply = true。
   */
  sendText?: string;
  /**
   * @label 静默回复
   * 完成本页推进时，是否把 sendText 作为玩家回复回显到聊天流。
   * 缺省 false = 回显；true = 仅推进、不回显。
   * click 页恒不回显（与 muteReply 无关）。
   */
  muteReply?: boolean;
  /**
   * 点击工作：要求玩家连续点击该 Talklet 的回复按钮 `base + rand(0, rand)` 次
   * （rand 缺省 = 0）从左往右填满进度条（进入该页时计数为 0/N）；填满后还需再点一次才结束该页并推进。
   * 按钮上会显示进度条，用于模拟回消息/完成复杂任务。
   * click 页缺省视为 { base: 1 }（"点一下推进"为最小形态，增强健壮性）。
   * 注意：页面存在 choices 时该字段被忽略（选项优先）。
   */
  clickWork?: { base: number; rand?: number };
  /**
   * @label 类型
   * @enum talk=对话
   * @enum narration=旁白
   * @enum click=点击阻塞
   * 演出类型。缺省 = talk（普通对话气泡）。
   * narration 渲染为横跨聊天流宽度的场间旁白（align 控制对齐）。
   * click 为纯底部按钮交互页：text/sendText 作按钮文案，不进入聊天流，默认不承载选项/联动效果。
   */
  kind?: 'talk' | 'narration' | 'click';
  /**
   * @label 对齐
   * @enum center=居中
   * @enum left=靠左
   * @enum right=靠右
   * 仅 narration 生效。缺省 = center。
   */
  align?: 'center' | 'left' | 'right';
  /**
   * @label 头像
   * 可选头像 URL / 资源路径。缺省渲染首字母圆形占位。
   */
  avatar?: string;
  /**
   * @label 气泡侧
   * @enum left=靠左
   * @enum right=靠右
   * 仅 talk 生效：本气泡出现于聊天流左侧或右侧。
   * 缺省 = left。右侧通常表示玩家/对话方（speaker 为该侧自定义名）；
   * 玩家回复回显（sendText）恒为 right，与本字段无关。
   */
  side?: 'left' | 'right';
  /**
   * @label 隐藏头像
   * 是否不渲染圆形头像（纯文本气泡）。缺省 false = 渲染圆形头像
   * （有 avatar 渲染图片，否则渲染首字母占位）。
   */
  noAvatar?: boolean;
  /**
   * 跳转到另一个 Story（当前 Talklet 的效果执行完毕后跳转）。
   * - goto（缺省）: 转移演出流到目标 Story，本 Story 不再返回。目标 Story 完结即 Entry 完结。
   * - insert: 暂停当前 Story，播放目标 Story；播完后返回当前 Story 的下一页继续。
   *
   * 适用于：将超长 Story 拆分为多个短 Story 串联演出（goto），
   * 或在主 Story 中插入一段子剧情后返回（insert）。
   */
  jumpToStory?: StoryId;
  /**
   * 跳转模式。缺省 'goto'。
   * goto = 完全转移，不返回；insert = 插入子剧情，播完后返回原地。
   */
  jumpMode?: 'goto' | 'insert';
}

export interface StoryChoice {
  text: string;
  effects: Effect[];
  condition?: ConditionGroup;
  /**
   * 选择本选项后跳转到另一个 Story（选项效果执行完毕后跳转）。
   * 语义与 Talklet.jumpToStory 一致：
   * - goto（缺省）: 完全转移，不返回；目标 Story 完结即 Entry 完结。
   * - insert: 插入子剧情，播完后返回当前 Story 的下一页。
   */
  jumpToStory?: StoryId;
  /**
   * 跳转模式。缺省 'goto'。
   */
  jumpMode?: 'goto' | 'insert';
}

export interface ItemDef {
  /** @label ID */
  id: ItemId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description: string;
  /** @label 图标 */
  icon?: string;
  /** @label 堆叠上限 */
  maxStack: number;
  /** @label 稀有度 @enum common=普通 @enum rare=稀有 @enum epic=史诗 @enum legendary=传说 */
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  /** @label 类型 @enum consumable=消耗品 @enum material=材料 @enum key=钥匙 */
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
  /** @label ID */
  id: string;
  entries: DropTableEntry[];
  guaranteed?: { itemId: ItemId; count: number }[];
  /** @label 最大掷数 */
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
  /** @label ID */
  id: string;
  entries: AffectorEffect[];
  /** @label 持久 */
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
  /** @label ID */
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
  /**
   * 一次性触发（默认 true）。once:false 时条件满足即可重复触发。
   * @label 一次性
   */
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
  /** 主线 / 支线剧情入口：进入场景时自动展开，不可重复。 */
  activeStories: ActiveStoryEntry[];
  /** 随机闲聊入口：当无剧情进行时，按权重随机抽取。 */
  passiveStories: PassiveStoryEntry[];
  /**
   * 被动闲聊池（可选）：树状抽选结构。未声明时全部 entry 进入引擎默认根池。
   */
  passivePools?: PassivePoolDef[];
  stories: StoryDef[];
  items: ItemDef[];
  dropTables?: DropTableDef[];
  affectorPacks?: AffectorPackDef[];
  triggerDefs?: TriggerDef[];
  funcletDefs: FuncletDef[];
  characters: CharacterData[];
  /**
   * @deprecated 冻结：Character 重构后不再参与任何计算（见 docs-818/12-character-rework.md §4.4）。
   * 加载期忽略并 devLog 警告；字段将在 M7 冻结回归时移除。
   */
  characterBonuses: CharacterBonusTable[];
  /**
   * 角色差分（变体）表
   * @label 角色差分
   */
  characterVariants?: CharacterVariantDef[];
  /**
   * 培养曲线表（缺省曲线由引擎默认提供）
   * @label 培养曲线
   */
  cultivateCurves?: CultivateCurveDef[];
  /**
   * 色彩表
   * @label 色彩
   */
  colors?: ColorDef[];
  /**
   * 卡池表
   * @label 卡池
   */
  gachaPools?: GachaPoolDef[];
  /**
   * 聊天流内容表
   * @label 聊天消息
   */
  chatMessages?: ChatMessageDef[];
  /**
   * Character 系统三层归属声明（缺省见各字段说明）
   * @label 归属配置
   * @collapsible
   */
  characterPersistConfig?: CharacterPersistConfig;
  /** 资源条显示条目（可选）：数据包自定义 UI 中展示的资源、标签与可选策略。 */
  resourceDisplays?: ResourceDisplayDef[];
  /** 标签表现定义（可选）：为层级 Tag 提供名称、简介等辅助表现，未定义的 Tag 回退路径串。 */
  tags?: TagDef[];
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
