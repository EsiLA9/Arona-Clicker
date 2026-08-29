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
import type { PicId } from './pics';

// --- 基础 ID ---

export type VariantId = string;
export type ColorGroupId = string;
export type EquipmentId = string;
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
   * 头像：直连 URL 或 `mod:type(pic):id` 三段式图片索引（见 pics 表）。
   * 缺省渲染首字母圆形占位。
   * @label 头像
   */
  avatar?: string;
  /**
   * 默认头像颜色组（ColorGroup）：声明后该差分默认使用 Color 抽象图案头像，
   * 未装备色彩装备时以此兜底。装备了色彩装备时以装备的 ColorGroup 优先。
   * @label 默认头像色组
   * @ref colorGroups
   */
  colorGroupId?: ColorGroupId;
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
   * 对话空间特色主题：打开该学生的对话空间时界面自动切换。
   * @label 对话主题
   */
  theme?: ThemeDef;
  /**
   * 星级锁 per-variant 好感等级上限覆盖（索引 = 星级；缺省用 affectionConfig.defaultLevelCapByStar）。
   * 可做渐进式如 [1,5,10,15,20,100]。
   * @label 好感星级锁
   * @int
   */
  affectionLevelCapByStar?: number[];
  /** Extra 附加数据 */
  extra?: ExtraCompound;
}

// --- 色彩 ---

/**
 * UI 主题 token 键（primary 缺省取色彩组主色位色值；其余可由 primary 按 HSL 深/浅派生）。
 * 常用 token 见 ColorSystem 派生实现；任意字符串键均允许（全量自定义）。
 */
export type ThemeToken = string;

/**
 * 参与玩家自定义优先级排序的主题层（低→高）。
 * 剧情临时演出层（ephemeral）不参与排序，始终最高。
 */
export type ThemeOrderScope = 'player' | 'area' | 'student';

/**
 * 场景/演出声明式主题：引用某 ColorGroup 打底 + 可选局部 token 覆盖。
 * 引擎在进入 Area / 打开学生对话时据此推入场景层（见 theme-runtime.ts）。
 */
export interface ThemeDef {
  /**
   * 引用 ColorGroupDef id（其 theme-tree 预设整包打底）；缺省仅用 tokens 覆盖。
   * @label 引用色彩组
   * @ref colorGroups
   */
  colorGroupId?: ColorGroupId;
  /**
   * 局部 token 覆盖表（引擎 token 键，如 primary / bg / player-bubble）。
   * @label 局部覆盖
   */
  tokens?: Partial<Record<ThemeToken, string>>;
}

/**
 * 实体主题槽：玩家为某实体（`area:<id>` / `variant:<id>`）选定的主题来源。
 * - default：声明默认（无覆盖）
 * - equipment：装备提供的主题（theme，缺省回退装备引用的组；需已装备）
 * - design：已解锁的配色设计
 * - custom：剧情/Trigger 或玩家写入的临时主题
 */
export interface EntityThemeSlot {
  kind: 'default' | 'equipment' | 'design' | 'custom';
  /** kind='design' 时：ThemeDesignDef id。 */
  designId?: string;
  /** kind='equipment' 时：ColorEquipmentDef id。 */
  equipmentId?: string;
  /** kind='custom' 时：完整主题定义。 */
  customTheme?: ThemeDef;
}

/**
 * 实体配色设计：可解锁/授予的命名主题，作用于某个 Area / 学生差分。
 * 解锁后自动成为该实体当前生效主题（玩家可手动换回）。
 */
export interface ThemeDesignDef {
  /** @label ID */
  id: string;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /**
   * 目标实体键（`area:<id>` / `variant:<id>`）。声明后解锁条件满足即自动
   * 解锁到该实体；缺省 = 通用设计，由授予方（effect / 系统）显式指定落点。
   * @label 目标实体
   */
  entityKey?: string;
  /**
   * 主题定义（colorId 打底 + tokens 覆盖）
   * @label 主题
   */
  theme: ThemeDef;
  /**
   * 解锁条件；缺省 = 不可自动解锁
   * @label 解锁条件
   */
  unlock?: Condition | ConditionGroup;
}

// --- 色彩组（ColorGroup）：唯一色彩实体 ---
//
// 合并原 Color（主题预设）与 ColorGroup（头像模板）：一个 ColorGroupDef =
// 重点色彩组（slots 内联 hex）+ 头像渲染方案（compositionType）
// + theme-tree 预设（theme 覆盖表，primary 缺省取主色位 hex）+ 解锁条件。

/**
 * 颜色组构成方式：决定学生头像（抽象圆形图案）如何由组内颜色组合渲染。
 * - solid     单色填充（1 个色位）
 * - gradient  双色线性渐变（primary → secondary）
 * - duotone   双色阶调（primary 主体 + shadow 阴影层）
 * - pie       饼图分区（3~6 个色位按角色比例分配）
 * - radial    径向渐变（center 中心 → edge 边缘）
 */
export type CompositionType = 'solid' | 'gradient' | 'duotone' | 'pie' | 'radial';

/** 颜色组内某个色位的语义角色。 */
export type ColorGroupRole = 'primary' | 'secondary' | 'accent' | 'highlight' | 'shadow' | 'edge';

/** 颜色组中的单个色位：角色 + 内联色值（hex）。 */
export interface ColorGroupSlot {
  /**
   * 色位角色（决定该色在构成中承担的位置）
   * @label 角色
   * @enum primary=主色
   * @enum secondary=副色
   * @enum accent=强调
   * @enum highlight=高光
   * @enum shadow=阴影
   * @enum edge=边缘
   */
  role: ColorGroupRole;
  /**
   * 色值（#rrggbb）
   * @label 色值
   */
  color: string;
}

/**
 * 色彩组：唯一色彩实体。重点色彩组（slots）+ 头像渲染方案（compositionType）
 * + theme-tree 预设（theme 覆盖表）。可整体解锁/装备，不可自由组装。
 */
export interface ColorGroupDef {
  /** @label ID */
  id: ColorGroupId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /**
   * 构成方式
   * @label 构成方式
   * @enum solid=单色
   * @enum gradient=渐变
   * @enum duotone=双色阶调
   * @enum pie=饼图
   * @enum radial=径向
   */
  compositionType: CompositionType;
  /**
   * 色位表（数量与构成方式匹配）
   * @label 色位
   */
  slots: ColorGroupSlot[];
  /**
   * theme-tree 预设覆盖表（token 键，如 panel / playerBubble / bg / primary）。
   * 未给的 token 由主色位（role==='primary'，无则首个 slot）的色值经 HSL 规则
   * 确定性派生；显式给出的 token 覆盖派生值（支持近整 UI 配色自定义）。
   * @label 主题覆盖
   */
  theme?: Partial<Record<ThemeToken, string>>;
  /**
   * 解锁条件（引用 protoStats / story flag 等）；缺省 = 不可自动解锁。
   * 解锁后玩家可将其激活为全局主题；装备解锁会级联解锁其引用的组。
   * @label 解锁条件
   */
  unlock?: Condition | ConditionGroup;
}

/**
 * 色彩装备：核心收集品。捆绑色彩组（ColorGroup：头像视觉 + theme-tree 预设）
 * + 数值效用（effects）。装备到学生后同时决定头像与效用，并级联解锁该组。
 */
export interface ColorEquipmentDef {
  /** @label ID */
  id: EquipmentId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /**
   * 引用的颜色组（决定装备学生的头像视觉与主题预设）
   * @label 颜色组
   * @ref colorGroups
   */
  colorGroupId: ColorGroupId;
  /**
   * 数值效用（走现有 Effect 体系；装备后生效）
   * @label 效果
   */
  effects: Effect[];
  /**
   * 可选：装备提供的完整主题（用于该学生的实体主题槽 equipment 来源）。
   * 缺省时回退为引用组本身的主题预设（colorGroupId）。
   * @label 装备主题
   */
  theme?: ThemeDef;
  /**
   * 解锁条件；缺省 = 不可自动解锁
   * @label 解锁条件
   */
  unlock?: Condition | ConditionGroup;
  /**
   * 稀有度分类（UI 展示用）
   * @label 稀有度
   * @enum common=普通
   * @enum rare=稀有
   * @enum epic=史诗
   */
  category?: 'common' | 'rare' | 'epic';
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

// --- 好感配置 ---

/**
 * 好感数值配置（Datapack 顶层可选表；缺省用引擎内置阶梯，见 system/affection-system.ts）。
 * 好感值内嵌 RosterEntry，呈现为「等级 + 级内小值」，不作可见货币。
 */
export interface AffectionConfigDef {
  /**
   * 阶梯区升级需求：expCurve[i] = 第 (i+1)→(i+2) 级所需小值；长度 = 阶梯覆盖等级数。
   * @label 升级阶梯
   */
  expCurve?: number[];
  /**
   * 等值区需求：超出 expCurve 覆盖后每级固定需求
   * @label 等值需求
   * @int
   */
  expBeyond?: number;
  /**
   * 等级硬上限（含等值区）；缺省取 expCurve.length
   * @label 等级上限
   * @int
   */
  maxLevel?: number;
  /**
   * 星级锁默认表（索引 = 星级）：5 星前一律 20 级的默认形如 [20,20,20,20,20,100]
   * @label 星级锁默认表
   */
  defaultLevelCapByStar?: number[];
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
  /**
   * 已装备的色彩装备（单装备槽；null = 未装备）
   * @ref colorEquipments
   */
  equippedEquipment: EquipmentId | null;
  /** 该差分自身的累计获得次数（含首次；重复获得 +1，与原型聚合统计互不影响）。 */
  acquiredCount: number;
  /**
   * 好感等级（初始 1；运行时 ??= 1 兜底旧档）。
   * 随 RosterEntry 归属层自动进出存档与 per-Init 快照。
   */
  affectionLevel?: number;
  /** 当前级内积累的好感小值（隐藏内部值；UI 呈现为等级 + 进度）。 */
  affectionExp?: number;
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
