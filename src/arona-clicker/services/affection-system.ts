import type { AffectionConfigDef, CharacterVariantDef, RosterEntry } from '../types/character';

export const DEFAULT_AFFECTION_EXP_CURVE: readonly number[] = [
  15, 30, 30, 35, 35, 35, 40, 40, 40, 60, 90, 105, 120, 140, 160, 180, 205, 230, 255, 285,
  315, 345, 375, 410, 445, 480, 520, 560, 600, 645, 690, 735, 780, 830, 880, 930, 985, 1040,
  1095, 1155, 1215, 1275, 1335, 1400, 1465, 1530, 1600, 1670, 1740, 1815, 1890, 1965, 2040,
  2120, 2200, 2280, 2365, 2450, 2535, 2625, 2715, 2805, 2895, 2990, 3085, 3180, 3280, 3380,
  3480, 3585, 3690, 3795, 3900, 4010, 4120, 4230, 4345, 4460, 4575, 4695, 4815, 4935, 5055,
  5180, 5305, 5430, 5560, 5690, 5820, 5955, 6090, 6225, 6360, 6500, 6640, 6780, 6925, 7070,
  7215, 7365,
];

export const DEFAULT_AFFECTION_CONFIG: Required<AffectionConfigDef> = {
  expCurve: [...DEFAULT_AFFECTION_EXP_CURVE],
  expBeyond: DEFAULT_AFFECTION_EXP_CURVE[DEFAULT_AFFECTION_EXP_CURVE.length - 1]!,
  maxLevel: DEFAULT_AFFECTION_EXP_CURVE.length,
  defaultLevelCapByStar: [20, 20, 20, 20, 20, 100],
};

export interface AffectionConfigView {
  maxLevel: number;
  expCurve: number[];
  expBeyond: number;
  defaultLevelCapByStar: number[];
}

export function resolveAffectionConfig(def: AffectionConfigDef | undefined): AffectionConfigView {
  if (!def) return { ...DEFAULT_AFFECTION_CONFIG, expCurve: [...DEFAULT_AFFECTION_CONFIG.expCurve], defaultLevelCapByStar: [...DEFAULT_AFFECTION_CONFIG.defaultLevelCapByStar] };
  const curve = def.expCurve && def.expCurve.length > 0 ? [...def.expCurve] : [...DEFAULT_AFFECTION_EXP_CURVE];
  return {
    expCurve: curve,
    expBeyond: def.expBeyond ?? curve[curve.length - 1]!,
    maxLevel: def.maxLevel ?? curve.length,
    defaultLevelCapByStar: def.defaultLevelCapByStar && def.defaultLevelCapByStar.length > 0
      ? [...def.defaultLevelCapByStar]
      : [...DEFAULT_AFFECTION_CONFIG.defaultLevelCapByStar],
  };
}

export function affectionExpToNext(config: AffectionConfigView, level: number): number {
  if (level >= config.maxLevel) return Number.POSITIVE_INFINITY;
  return config.expCurve[level - 1] ?? config.expBeyond;
}

export function affectionLevelCapOf(config: AffectionConfigView, variant: CharacterVariantDef | undefined, stars: number): number {
  const table = variant?.affectionLevelCapByStar ?? config.defaultLevelCapByStar;
  const idx = Math.max(0, Math.min(stars, table.length - 1));
  return Math.min(table[idx] ?? config.maxLevel, config.maxLevel);
}

export interface AffectionApplyResult { ok: boolean; entry: RosterEntry; leveledUp: boolean; }

export function applyAffectionExp(config: AffectionConfigView, entry: RosterEntry, cap: number, _variant: CharacterVariantDef | undefined, delta: number): AffectionApplyResult {
  let level = entry.affectionLevel ?? 1;
  let exp = entry.affectionExp ?? 0;
  if (delta <= 0 || level >= cap) return { ok: false, entry, leveledUp: false };
  let leveledUp = false;
  let remaining = delta;
  while (level < cap) {
    const need = affectionExpToNext(config, level);
    if (!Number.isFinite(need) || remaining < need) break;
    remaining -= need;
    level += 1;
    leveledUp = true;
  }
  exp = level >= cap ? 0 : exp + remaining;
  return { ok: true, entry: { ...entry, affectionLevel: level, affectionExp: exp }, leveledUp };
}
