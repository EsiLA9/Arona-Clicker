/** One already-legal unit target with its Encounter / MapRun HP snapshot. */
export interface GameplayBUnitTargetCandidate {
  readonly id: string;
  readonly currentHp: number;
  readonly maxHp: number;
}

export type GameplayBUnitTargetPreference = 'stableOrder' | 'lowestHpRatio' | 'highestMissingHpRatio';

/**
 * Picks from candidates in their supplied domain order. Equal ratios keep the
 * first candidate, so fixed-party and Enemy roster order remain the tie-break.
 */
export function selectGameplayBUnitTarget(
  candidates: readonly GameplayBUnitTargetCandidate[],
  preference: GameplayBUnitTargetPreference = 'stableOrder',
): string | null {
  if (candidates.length === 0) return null;
  if (!['stableOrder', 'lowestHpRatio', 'highestMissingHpRatio'].includes(preference)) {
    throw new Error('Gameplay B unit target preference is invalid');
  }
  if (preference === 'stableOrder') return candidates[0]!.id;

  let selected = candidates[0]!;
  for (const candidate of candidates) {
    for (const option of [candidate, selected]) {
      if (!Number.isSafeInteger(option.currentHp) || option.currentHp < 0
        || !Number.isSafeInteger(option.maxHp) || option.maxHp < 1 || option.currentHp > option.maxHp) {
        throw new Error('Gameplay B unit target has invalid HP bounds');
      }
    }
    const candidateHp = BigInt(candidate.currentHp);
    const candidateMax = BigInt(candidate.maxHp);
    const selectedHp = BigInt(selected.currentHp);
    const selectedMax = BigInt(selected.maxHp);
    const candidateWins = preference === 'lowestHpRatio'
      ? candidateHp * selectedMax < selectedHp * candidateMax
      : (candidateMax - candidateHp) * selectedMax > (selectedMax - selectedHp) * candidateMax;
    if (candidateWins) selected = candidate;
  }
  return selected.id;
}
