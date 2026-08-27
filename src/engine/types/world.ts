// ============================================================
// engine/types/world.ts — 世界地图实体（Init / Area / Spot / Entry）
// ============================================================

import type { TagPath } from '../core/tag';
import type {
  AreaId,
  InitId,
  SpotId,
  StoryId,
} from './ids';
import type { ExtraCompound } from './extra';
import type {
  ConditionGroup,
  Effect,
  ValueExpression,
} from './expression';
import type { ColorGroupId, GachaPoolId, ThemeDef } from './character';
import type { ResourceAmount } from './common';
import type { RevealTrigger } from './reveal';
import type { TriggerDef } from './trigger';

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
  /**
   * 设施特色主题：声明后该 Spot 卡片/详情以自身 ThemeTree 渲染（绕过全局参考树、作用域化落到卡片）。
   * 缺省跟随全局参考树。
   * @label 设施主题
   */
  theme?: ThemeDef;
  /**
   * 默认色组：声明后设施卡片以该 ColorGroup 主色构建自身 ThemeTree（缩略/强调），
   * 未声明则跟随 theme 或全局参考树。
   * @label 默认色组
   * @ref colorGroups
   */
  colorGroupId?: ColorGroupId;
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
