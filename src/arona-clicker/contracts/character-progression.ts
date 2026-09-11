import type { AffectionConfigDef, CharacterVariantDef, CultivateCurveDef, VariantProgress } from '../types/character';
import type { PlayerState } from '../types/state';

export interface CurveView {
  maxLevel: number;
  expTable: number[];
  starMax: number;
  starCost: number[];
}

export interface AffectionConfigView {
  maxLevel: number;
  expCurve: number[];
  expBeyond: number;
  defaultLevelCapByStar: number[];
}

export interface CharacterProgressionPort {
  resolveCurve(def: CultivateCurveDef | undefined): CurveView;
  resolveVariantLevelCap(curve: CurveView, accountLevelCap: number | undefined): number;
  applyExp(curve: CurveView, entry: VariantProgress, amount: number, cap: number): { ok: boolean; entry: VariantProgress; leveledUp: boolean };
  checkBreakthrough(curve: CurveView, state: PlayerState, variant: CharacterVariantDef, entry: VariantProgress): { ok: boolean; reason?: string; cost?: number };
  resolveAffectionConfig(def: AffectionConfigDef | undefined): AffectionConfigView;
  affectionLevelCapOf(config: AffectionConfigView, variant: CharacterVariantDef | undefined, stars: number): number;
  applyAffectionExp(config: AffectionConfigView, entry: VariantProgress, cap: number, variant: CharacterVariantDef | undefined, delta: number): { ok: boolean; entry: VariantProgress; leveledUp: boolean };
}
