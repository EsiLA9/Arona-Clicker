// ============================================================
// data-services/contracts/character-progression-def.ts — 角色养成声明式定义
//
// 数据包声明「可能性」，State（VariantProgress）描述「玩家做到哪」（见 ADR-0008 A4）。
// A 段只做声明：effects / cost 均无运行时消费，投影与消费统一留待 B 段。
// ============================================================

import type { Condition, ConditionGroup, Effect, ValueExpression } from '../../engine/types/expression';
import type { ExtraCompound } from '../../engine/types/extra';
import type { ItemId } from '../../engine/types/ids';
import type { FavoriteItemId, GearId, SkillId, TraitId, UniqueWeaponId, VariantId } from '../../engine/types/character';

/**
 * 养成消耗（占位）：引用资源或物品。
 * 事务语义（扣款 / 失败回滚）留待 task-0039 与 ADR-0007 落地后接入。
 */
export interface ProgressionCostDef {
  /** @label 引用资源 */
  resource?: string;
  /** @label 引用物品 @ref items */
  item?: ItemId;
  /** @label 数量 */
  amount: ValueExpression;
}

/** 技能定义（inline 于 Variant.progression.skills）。 */
export interface SkillDef {
  /** @label ID */
  id: SkillId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /** @label 等级上限 @int */
  maxLevel: number;
  /** @label 每级消耗 */
  levelCosts?: ProgressionCostDef[];
  /** @label 每级效果 */
  levelEffects?: Effect[];
  extra?: ExtraCompound;
}

/** 装备槽类别：攻击 / 防御 / 特殊。 */
export type GearSlotKind = 'attack' | 'defense' | 'special';

/** 装备升级消耗：图纸/材料物品与数量。 */
export interface GearCostDef {
  /** @label 物品 @ref items */
  itemId: ItemId;
  /** @label 数量 @int */
  amount: number;
}

/**
 * 装备类型线的某一层（tier）。
 * 每 tier 自带「基础效果 + 每级线性成长」；升 tier 时新 tier 整体替换旧 tier（不叠加）。
 */
export interface GearTierDef {
  /** @label 层级 @int */
  tier: number;
  /** @label 等级上限 @int */
  levelCap: number;
  /** @label 效果基准等级 @int */
  baseLevel?: number;
  /** @label 每级所需经验 @int */
  expPerLevel: number;
  /** @label 达到本层的消耗 */
  upgradeCost?: GearCostDef[];
  /** @label 基础效果 */
  baseEffects?: Effect[];
  /** @label 每级成长效果 */
  perLevelEffects?: Effect[];
  extra?: ExtraCompound;
}

/** 装备类型线（表 `gears`）：如「攻击装备·帽子」。 */
export interface GearDef {
  /** @label ID */
  id: GearId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /** @label 槽类别 */
  slot: GearSlotKind;
  /** @label 层级 */
  tiers: GearTierDef[];
  extra?: ExtraCompound;
}

/** 固定装备槽（差分声明唯一类型线；玩家只推进 tier/等级，不换类别）。 */
export interface GearSlotDef {
  /** @label 槽类别 */
  slot: GearSlotKind;
  /** @label 装备类型线 @ref gears */
  gear: GearId;
}

/** 装备成长全局配置（经验材料换算与通用升级消耗）。 */
export interface GearConfigDef {
  /** @label 经验材料 */
  expItems: { itemId: ItemId; exp: number }[];
  /** @label 每级附加消耗（可选） */
  levelCost?: GearCostDef;
}

/** 爱用品阶段（角色自己的 Progression Track）。 */
export interface FavoriteStageDef {
  /** @label 阶段 @int */
  tier: number;
  /** @label 解锁条件 */
  unlock?: Condition | ConditionGroup;
  /** @label 消耗 */
  cost?: ProgressionCostDef;
  /** @label 效果 */
  effects: Effect[];
}

/** 爱用品定义：改变该 Variant 某个已有机制的成长轨道（非 Inventory 装备）。 */
export interface FavoriteItemDef {
  /** @label ID */
  id: FavoriteItemId;
  /** @label 所属差分 @ref characterVariants */
  owner: VariantId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /** @label 阶段 */
  stages: FavoriteStageDef[];
  extra?: ExtraCompound;
}

/** 专武星级定义。 */
export interface UniqueWeaponStarDef {
  /** @label 星级 @int */
  star: number;
  /** @label 消耗 */
  cost?: ProgressionCostDef;
  /** @label 效果 */
  effects: Effect[];
}

/** 专武定义（纵向突破链的延伸）。 */
export interface UniqueWeaponDef {
  /** @label ID */
  id: UniqueWeaponId;
  /** @label 所属差分 @ref characterVariants */
  owner: VariantId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /** @label 星级 */
  stars: UniqueWeaponStarDef[];
  extra?: ExtraCompound;
}

/** 特性定义（习得 / 激活 / 抛弃；记录 abandoned 而非删除）。 */
export interface TraitDef {
  /** @label ID */
  id: TraitId;
  /** @label 名称 */
  name: string;
  /** @label 描述 */
  description?: string;
  /** @label 效果 */
  effects?: Effect[];
  /** @label 习得条件 */
  learnCondition?: Condition | ConditionGroup;
  /** @label 抛弃条件 */
  abandonCondition?: Condition | ConditionGroup;
  extra?: ExtraCompound;
}

/** Variant 的养成可能性声明（State 描述玩家做到哪）。 */
export interface VariantProgressionDef {
  /** @label 技能 */
  skills?: SkillDef[];
  /** @label 装备槽（三固定槽） */
  gearSlots?: [GearSlotDef, GearSlotDef, GearSlotDef];
  /** @label 爱用品 @ref favoriteItems */
  favoriteItem?: FavoriteItemId;
  /** @label 专武 @ref uniqueWeapons */
  uniqueWeapon?: UniqueWeaponId;
  /** @label 初始特性 */
  initialTraits?: TraitId[];
}

/** 原型级羁绊里程碑（总好感台阶；effects 只声明，聚合去重留待 B 段）。 */
export interface CharacterBondMilestoneDef {
  /** @label 总好感门槛 @int */
  totalAffection: number;
  /** @label 效果 */
  effects: Effect[];
}

/** 原型级羁绊定义（挂 CharacterData.bond）。 */
export interface CharacterBondDef {
  /** @label 里程碑 */
  milestones: CharacterBondMilestoneDef[];
}
