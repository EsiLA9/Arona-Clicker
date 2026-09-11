import type { VariantId } from '../../engine/types';
import type { PlayerState } from '../types/state';
import type { CharacterVariantDef, ProtoStat, VariantProgress } from '../types/character';
import type { Character, CharacterSchool } from '../types/ids';

export interface RosterContactGroup { school: CharacterSchool; entries: RosterContactEntry[]; }
export interface RosterContactEntry { variant: CharacterVariantDef; entry?: VariantProgress; }

export interface RosterQueryPort {
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
