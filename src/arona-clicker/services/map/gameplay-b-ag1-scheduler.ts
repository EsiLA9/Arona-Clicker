/** Scalar AG-1 sorting input for one already-resolved execution source. */
export interface GameplayBAg1SourceOrderCandidate {
  readonly sourceKey: string;
  readonly finalAgility: number;
  readonly baseAgility: number;
  /** party = 0, enemy = 1. */
  readonly sideRank: 0 | 1;
  /** Party Character = 0, Ability = 1, Item = 2, Enemy = 0. */
  readonly sourceRank: 0 | 1 | 2;
  readonly ownerDeclarationIndex: number;
  readonly logicalIndex: number;
}

const CANDIDATE_FIELDS = [
  'sourceKey', 'finalAgility', 'baseAgility', 'sideRank', 'sourceRank', 'ownerDeclarationIndex', 'logicalIndex',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareDescending(left: number, right: number): number {
  return left > right ? -1 : left < right ? 1 : 0;
}

function compareAscending(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateCandidate(value: unknown, index: number): GameplayBAg1SourceOrderCandidate {
  const path = `AG-1 source order candidate[${index}]`;
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError(`${path} must be a plain data object`);
  }
  const ownKeys = Reflect.ownKeys(value);
  const extraField = ownKeys.find(key => typeof key !== 'string' || !(CANDIDATE_FIELDS as readonly string[]).includes(key));
  if (extraField !== undefined || ownKeys.length !== CANDIDATE_FIELDS.length
    || CANDIDATE_FIELDS.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new TypeError(`${path} must contain exactly ${CANDIDATE_FIELDS.join(', ')}`);
  }
  for (const field of CANDIDATE_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor || !('value' in descriptor)) throw new TypeError(`${path}.${field} must be a data property`);
  }
  if (typeof value.sourceKey !== 'string' || value.sourceKey.trim().length === 0) {
    throw new TypeError(`${path}.sourceKey must be a non-empty string`);
  }
  for (const field of ['finalAgility', 'baseAgility', 'ownerDeclarationIndex', 'logicalIndex'] as const) {
    if (!Number.isSafeInteger(value[field]) || (value[field] as number) < 0) {
      throw new TypeError(`${path}.${field} must be a non-negative safe integer`);
    }
  }
  if ((value.finalAgility as number) < (value.baseAgility as number)) {
    throw new TypeError(`${path}.finalAgility must be greater than or equal to baseAgility`);
  }
  if (value.sideRank !== 0 && value.sideRank !== 1) {
    throw new TypeError(`${path}.sideRank must be party (0) or enemy (1)`);
  }
  if (value.sourceRank !== 0 && value.sourceRank !== 1 && value.sourceRank !== 2) {
    throw new TypeError(`${path}.sourceRank must be 0, 1, or 2`);
  }
  if ((value.sideRank === 1 && value.sourceRank !== 0)
    || (value.sideRank === 0 && value.sourceRank !== 0 && value.sourceRank !== 1 && value.sourceRank !== 2)) {
    throw new TypeError(`${path} has an invalid sideRank/sourceRank combination`);
  }
  return value as unknown as GameplayBAg1SourceOrderCandidate;
}

/** Sort an already assembled AG-1 source list using its complete, deterministic key. */
export function resolveGameplayBAg1SourceOrder(
  candidates: readonly GameplayBAg1SourceOrderCandidate[],
): readonly GameplayBAg1SourceOrderCandidate[] {
  if (!Array.isArray(candidates)) throw new TypeError('AG-1 source order candidates must be an array');
  const validated = candidates.map(validateCandidate);
  const seenSourceKeys = new Set<string>();
  for (const candidate of validated) {
    if (seenSourceKeys.has(candidate.sourceKey)) {
      throw new TypeError(`AG-1 source order contains duplicate sourceKey "${candidate.sourceKey}"`);
    }
    seenSourceKeys.add(candidate.sourceKey);
  }

  return [...validated].sort((left, right) =>
    compareDescending(left.finalAgility, right.finalAgility)
    || compareDescending(left.baseAgility, right.baseAgility)
    || compareAscending(left.sideRank, right.sideRank)
    || compareAscending(left.sourceRank, right.sourceRank)
    || compareAscending(left.ownerDeclarationIndex, right.ownerDeclarationIndex)
    || compareAscending(left.logicalIndex, right.logicalIndex)
    || compareCodeUnits(left.sourceKey, right.sourceKey));
}
