// AronaClicker 角色领域类型入口。

export type { CharacterData } from '../../data-services/contracts/character-data';
export type { CharacterVariantDef } from '../../data-services/contracts/character-variant';
export type { CultivateCurveDef } from '../../data-services/contracts/cultivate-curve';
export type { AffectionConfigDef } from '../../data-services/contracts/affection-config';
export type { CharacterPersistConfig, CharacterPersistScope } from '../../data-services/contracts/character-persist';
export type { DupRewards, GachaMode, GachaPityDef, GachaPoolDef, GachaRateEntry } from '../../data-services/contracts/gacha-pool';
export type { ColorEquipmentDef, ColorGroupDef, ColorGroupRole, ColorGroupSlot, CompositionType, ThemeDesignDef } from '../../data-services/contracts/color';

export type {
  CharacterAcquireVia,
  VariantId,
  CultivateCurveId,
  ColorGroupId,
  EquipmentId,
  GachaPoolId,
} from '../../engine/types/character';
import type { CharacterAcquireVia, EquipmentId, VariantId } from '../../engine/types/character';

export interface RosterEntry {
  variantId: VariantId;
  acquiredVia: CharacterAcquireVia;
  level: number;
  exp: number;
  stars: number;
  equippedEquipment: EquipmentId | null;
  acquiredCount: number;
  affectionLevel?: number;
  affectionExp?: number;
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
