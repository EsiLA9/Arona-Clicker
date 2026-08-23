// ============================================================
// engine/types/character.ts — Character 重构实体（变体/培养/色彩/抽卡/聊天流）
//
// 设计文档：docs-818/12-character-rework.md
// 测试规格：docs-818/12-character-rework-tests.md
// ============================================================

import type {
  Character,
  CharacterRarity,
  CharacterSchool,
} from './ids';
import type { ExtraCompound } from './extra';
import type { Condition, ConditionGroup, Effect, ValueExpression } from './expression';

// --- 基础 ID ---

export type VariantId = string;
export type ColorId = string;
export type GachaPoolId = string;
export type ChatMessageId = string;
export type CultivateCurveId = string;

// --- 抽取模式（代码注册表，非数据包可插拔） ---

export enum GachaMode {
  /** 蔚蓝档案经典：稀有度权重 roll + UP + 天井 */
  BaClassic = 'ba-classic',
}

// --- 获得来源 ---

export type CharacterAcquireVia = 'gacha' | 'story' | 'event';

// --- 培养曲线 ---

export interface CultivateCurveDef {
  /** @label ID */
  id: CultivateCurveId;
  /**
   * 等级上限
   * @label 等级上限
   * @int
   */
  maxLevel: number;
  /**
   * 各级升级需求（长度 = maxLevel - 1）；缺省用全局默认线性曲线
   * @label 经验表
   */
  expTable?: number[];
  /**
   * 星级上限
   * @label 星级上限
   * @int
   */
  starMax?: number;
  /**
   * 各级突破消耗（单位：该变体碎片）；starCost[s] = 从 s 升 s+1 所需
   * @label 突破消耗
   */
  starCost?: number[];
  /**
   * 每星提升的等级上限；有效上限 = maxLevel + stars × levelCapPerStar
   * @label 每星上限
   * @int
   */
  levelCapPerStar?: number;
  /**
   * 培养驱动的数值来源（预留：每级加成）
   * @label 每级加成
   */
  levelBonusPerLevel?: ValueExpression;
}

// --- 角色变体（差分） ---

export interface CharacterVariantDef {
  /**
   * 差分 ID（如 'HoshinoSwimsuit'）
   * @label ID
   */
  id: VariantId;
  /**
   * 追溯的原型角色
   * @label 原型
   * @ref characters
   */
  proto: Character;
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
   * 默认差分（图鉴主展示/旧 flag 迁移指向）；每原型至多一个
   * @label 默认差分
   */
  isDefault?: boolean;
  /**
   * 对标签 Spot 的产出加成（当前冻结，字段预留）
   * @label 标签产出加成
   */
  spotTagBonus?: Record<string, number>;
  /**
   * 培养曲线；缺省用全局默认
   * @label 培养曲线
   * @ref cultivateCurves
   */
  curve?: CultivateCurveId;
  /**
   * 色彩装备槽位数（缺省 1）
   * @label 色彩槽位
   * @int
   */
  colorSlots?: number;
  /**
   * 对话空间特色主题：打开该学生的对话空间时界面自动切换。
   * @label 对话主题
   */
  theme?: ThemeDef;
  /** Extra 附加数据 */
  extra?: ExtraCompound;
}

// --- 色彩 ---

/**
 * UI 主题 token 键（primary 必配；其余可由 primary 按 HSL 深/浅派生）。
 * 常用 token 见 ColorSystem 派生实现；任意字符串键均允许（全量自定义）。
 */
export type ThemeToken = string;

/**
 * 场景/演出声明式主题：引用某 Color 打底 + 可选局部 token 覆盖。
 * 引擎在进入 Area / 打开学生对话时据此推入场景层（见 theme-runtime.ts）。
 */
export interface ThemeDef {
  /**
   * 引用 ColorDef id；缺省仅用 tokens 覆盖。
   * @label 引用色彩
   * @ref colors
   */
  colorId?: ColorId;
  /**
   * 局部 token 覆盖表（引擎 token 键，如 primary / bg / player-bubble）。
   * @label 局部覆盖
   */
  tokens?: Partial<Record<ThemeToken, string>>;
}

export interface ColorDef {
  /** @label ID */
  id: ColorId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /**
   * 主题 token 表。至少给 primary；未给的 token 由 primary 经 HSL 规则确定性派生，
   * 显式给出的 token 覆盖派生值（支持近整 UI 配色自定义）
   * @label 主题
   */
  theme: Record<ThemeToken, string>;
  /**
   * 可选轻数值效果（走现有 Effect 体系）
   * @label 效果
   */
  effects?: Effect[];
  /**
   * 解锁条件（引用 protoStats / story flag 等）；缺省 = 不可自动解锁
   * @label 解锁条件
   */
  unlock?: Condition | ConditionGroup;
}

// --- 抽卡 ---

/** 重复获得返还：该变体碎片数量 + 附加资源 */
export interface DupRewards {
  /**
   * 返还该变体碎片数量（差分隔离，不并入原型）
   * @label 碎片
   * @int
   */
  shards: number;
  /**
   * 附加资源
   * @label 附加资源
   */
  bonusResources?: Record<string, number>;
}

/** 硬保底（天井）配置 */
export interface GachaPityDef {
  /**
   * 抽取次数达到该值时必出 UP
   * @label 天井
   * @int
   */
  guaranteedAt: number;
  /**
   * 出高稀有度时是否保留 pity 计数（缺省归零）
   * @label 命中保留
   */
  keepOnHit?: boolean;
}

/** 稀有度权重项 */
export interface GachaRateEntry {
  /** @label 稀有度 */
  rarity: CharacterRarity;
  /**
   * 权重（同池内相对值）
   * @label 权重
   * @float
   */
  weight: number;
}

export interface GachaPoolDef {
  /** @label ID */
  id: GachaPoolId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /**
   * 抽取模式（代码注册表；未知值加载期报错）
   * @label 抽取模式
   */
  mode: GachaMode;
  /**
   * 单抽货币
   * @label 货币
   */
  currency: string;
  /**
   * 单抽消耗
   * @label 单价
   * @int
   */
  costPerPull: number;
  /**
   * 稀有度权重表
   * @label 概率表
   * @collapsible
   */
  rates: GachaRateEntry[];
  /**
   * UP 差分（在所属稀有度内优先命中）
   * @label UP
   * @refList characterVariants
   */
  featured?: VariantId[];
  /** @label 保底 */
  pity?: GachaPityDef;
  /**
   * 重复获得返还；缺省用全局默认（1 碎片）
   * @label 重复返还
   * @collapsible
   */
  dupRewards?: DupRewards;
  /**
   * 可及性成员：本池可获得的差分；池关闭后成员并入世界 Pool
   * @label 成员
   * @refList characterVariants
   */
  members: VariantId[];
  /**
   * 池关闭条件（事件完成等）；缺省 = 常驻开放
   * @label 关闭条件
   */
  closeWhen?: Condition | ConditionGroup;
}

// --- 聊天流 ---

export interface ChatMessageDef {
  /** @label ID */
  id: ChatMessageId;
  /**
   * 所属差分
   * @label 所属
   * @ref characterVariants
   */
  owner: VariantId;
  /**
   * 排序（越小越先）
   * @label 排序
   * @int
   */
  order: number;
  /** @label 内容 */
  content: string;
  /**
   * 解锁条件；缺省 = 获得即可读
   * @label 解锁条件
   */
  unlock?: Condition | ConditionGroup;
}

// --- 三层归属声明 ---

export type CharacterPersistScope = 'global' | 'init';

export interface CharacterPersistConfig {
  /**
   * 通讯录/碎片归属（默认 global）
   * @label 通讯录归属
   * @enum global=跨世界线保留
   * @enum init=随世界线重置
   */
  roster?: CharacterPersistScope;
  /**
   * 卡池计数归属（默认 global）
   * @label 卡池归属
   * @enum global=跨世界线保留
   * @enum init=随世界线重置
   */
  gacha?: CharacterPersistScope;
  /**
   * 装备归属（默认 global；第二迭代启用）
   * @label 装备归属
   * @enum global=跨世界线保留
   * @enum init=随世界线重置
   */
  equips?: CharacterPersistScope;
  /**
   * 聊天已读归属（默认 init）
   * @label 已读归属
   * @enum global=跨世界线保留
   * @enum init=随世界线重置
   */
  chatRead?: CharacterPersistScope;
}

// --- 运行时状态 ---

/** 玩家持有的变体实例 */
export interface RosterEntry {
  variantId: VariantId;
  acquiredVia: CharacterAcquireVia;
  /** @int */
  level: number;
  exp: number;
  /** @int */
  stars: number;
  equippedColors: ColorId[];
  /** 该差分自身的累计获得次数（含首次；重复获得 +1，与原型聚合统计互不影响）。 */
  acquiredCount: number;
}

/** 原型层聚合统计（派生视图，Trigger 维护；供色彩解锁条件/图鉴使用） */
export interface ProtoStat {
  /** @int */
  acquiredTotal: number;
  cultTotal: number;
}

/** 单卡池计数状态 */
export interface GachaPoolState {
  /** @int */
  pity: number;
  /** @int */
  pulls: number;
}
