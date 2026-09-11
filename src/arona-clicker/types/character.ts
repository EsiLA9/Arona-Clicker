// AronaClicker 角色领域类型入口。

export type { CharacterData } from '../../data-services/contracts/character-data';
export type { CharacterVariantDef } from '../../data-services/contracts/character-variant';
export type { CultivateCurveDef } from '../../data-services/contracts/cultivate-curve';
export type { AffectionConfigDef } from '../../data-services/contracts/affection-config';
export type { CharacterPersistConfig, CharacterPersistScope } from '../../data-services/contracts/character-persist';
export type { DupRewards, GachaMode, GachaPityDef, GachaPoolDef, GachaRateEntry } from '../../data-services/contracts/gacha-pool';
export type { ColorEquipmentDef, ColorGroupDef, ColorGroupRole, ColorGroupSlot, CompositionType, ThemeDesignDef } from '../../data-services/contracts/color';
export type {
  CharacterBondDef,
  CharacterBondMilestoneDef,
  FavoriteItemDef,
  FavoriteStageDef,
  GearConfigDef,
  GearCostDef,
  GearDef,
  GearSlotDef,
  GearSlotKind,
  GearTierDef,
  ProgressionCostDef,
  SkillDef,
  TraitDef,
  UniqueWeaponDef,
  UniqueWeaponStarDef,
  VariantProgressionDef,
} from '../../data-services/contracts/character-progression-def';

export type {
  CharacterAcquireVia,
  VariantId,
  CultivateCurveId,
  ColorGroupId,
  EquipmentId,
  GachaPoolId,
  SkillId,
  TraitId,
  FavoriteItemId,
  UniqueWeaponId,
  GearId,
} from '../../engine/types/character';
import type { CharacterAcquireVia, EquipmentId, SkillId, TraitId, VariantId } from '../../engine/types/character';

/** 单差分（Variant）的当前可用养成进度；跨世界线归属由 `characterPersistConfig.roster` 声明。 */
export interface VariantProgress {
  variantId: VariantId;
  acquiredVia: CharacterAcquireVia;
  acquiredCount: number;
  level: number;
  exp: number;
  stars: number;
  affectionLevel: number;
  affectionExp: number;
  /** 已装备的色彩装备（异常规则槽）；null = 未装备。原 `equippedEquipment`。 */
  colorEquipment: EquipmentId | null;
  /** 技能进度（占位，A 段无写入口）。 */
  skills?: Record<SkillId, SkillProgress>;
  /** 三固定装备槽（占位，只存 tier；槽类型由 datapack `gearSlots` 声明）。 */
  gear?: [GearProgress?, GearProgress?, GearProgress?];
  /** 爱用品轨道（占位）。 */
  favorite?: { tier: number };
  /** 专武（占位）。 */
  uniqueWeapon?: { stars: number };
  /** 特性（占位）。 */
  traits?: Record<TraitId, TraitProgress>;
}

export interface SkillProgress {
  level: number;
  proficiency: number;
}

export interface GearProgress {
  tier: number;
  level: number;
  exp: number;
}

export interface TraitProgress {
  state: 'active' | 'inactive' | 'abandoned';
  learnedAt?: number;
  proficiency?: number;
}

/** 跨世界线角色记忆：永远 global（不进 PER_INIT_FIELD_SPECS），只存历史最大值与历史事实。 */
export interface CharacterMemory {
  variants: Record<VariantId, VariantMemory>;
  affectionTotalEver: number;
  variantsEverOwned: VariantId[];
  lifetime: { expGained: number; cultivateSpent: number; affectionGained: number };
}

/** 单差分的记忆（只增不减的历史最大值 / 事实）。 */
export interface VariantMemory {
  maxLevel: number;
  maxStars: number;
  maxAffection: number;
  maxSkillLevels?: Record<SkillId, number>;
  maxGearTier?: [number, number, number];
  maxFavoriteTier?: number;
  maxUniqueWeaponStars?: number;
  traitsEverLearned?: TraitId[];
}

export interface ProtoStat {
  acquiredTotal: number;
  cultTotal: number;
}

export interface GachaPoolState {
  pity: number;
  pulls: number;
}
export type { ThemeDef } from '../../engine/types/theme';

export type { Character } from './ids';
