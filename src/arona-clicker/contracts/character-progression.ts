import type { AffectionConfigDef, CharacterVariantDef, CultivateCurveDef, RosterEntry } from '../types/character';
import type { PlayerState } from '../types/state';

export interface CurveView {
  maxLevel: number;
  expTable: number[];
  starMax: number;
  starCost: number[];
  levelCapPerStar: number;
}

export interface AffectionConfigView {
  maxLevel: number;
  expCurve: number[];
  expBeyond: number;
  defaultLevelCapByStar: number[];
}

export interface CharacterProgressionPort {
  resolveCurve(def: CultivateCurveDef | undefined): CurveView;
  applyExp(curve: CurveView, entry: RosterEntry, amount: number): { ok: boolean; entry: RosterEntry; leveledUp: boolean };
  checkBreakthrough(curve: CurveView, state: PlayerState, variant: CharacterVariantDef, entry: RosterEntry): { ok: boolean; reason?: string; cost?: number };
  resolveAffectionConfig(def: AffectionConfigDef | undefined): AffectionConfigView;
  affectionLevelCapOf(config: AffectionConfigView, variant: CharacterVariantDef | undefined, stars: number): number;
  applyAffectionExp(config: AffectionConfigView, entry: RosterEntry, cap: number, variant: CharacterVariantDef | undefined, delta: number): { ok: boolean; entry: RosterEntry; leveledUp: boolean };
}
