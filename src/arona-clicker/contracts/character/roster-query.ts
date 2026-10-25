import type { VariantId } from '../../../engine/types/index';
import type { PlayerState } from '../../types/state';
import type { CharacterVariantDef, ProtoStat, VariantProgress } from '../../types/character';
import type { Character, CharacterSchool } from '../../types/ids';

export interface RosterContactGroup { school: CharacterSchool; entries: RosterContactEntry[]; }
export interface RosterContactEntry { variant: CharacterVariantDef; entry?: VariantProgress; }

/** Read-only cultivation decisions and progress for one currently owned Variant. */
export interface CharacterCultivationView {
  readonly level: number;
  readonly exp: number;
  readonly levelCap: number;
  readonly expToNext: number | null;
  readonly canTrain: boolean;
  readonly affectionLevel: number;
  readonly affectionExp: number;
  readonly affectionLevelCap: number;
  readonly affectionExpToNext: number | null;
  readonly canInteract: boolean;
  readonly stars: number;
  readonly shards: number;
  readonly starCost: number | null;
  readonly canBreakthrough: boolean;
  readonly breakthroughReason?: string;
}

export interface RosterQueryPort {
  cultivationOf(state: PlayerState, variantId: VariantId): CharacterCultivationView | null;
  affectionLevelOf(state: PlayerState, variantId: VariantId): number;
  affectionExpOf(state: PlayerState, variantId: VariantId): number;
  affectionLevelCapOf(state: PlayerState, variantId: VariantId): number;
  getVariant(variantId: VariantId): CharacterVariantDef | undefined;
  getAllVariants(): CharacterVariantDef[];
  getOwned(state: PlayerState, variantId: VariantId): VariantProgress | undefined;
  isOwned(state: PlayerState, variantId: VariantId): boolean;
  shardsOf(state: PlayerState, variantId: VariantId): number;
  acquiredCountOf(state: PlayerState, variantId: VariantId): number;
  protoStatOf(state: PlayerState, proto: Character): ProtoStat | undefined;
  contactGroups(state: PlayerState): RosterContactGroup[];
  codex(state: PlayerState): RosterContactEntry[];
}
