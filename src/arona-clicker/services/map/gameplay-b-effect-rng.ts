import type { MapEffectRandomState } from '../../contracts/map/map-effects';

export const MAP_EFFECT_RANDOM_ALGORITHM = 'counter-addressed-murmur3-fmix32-v1' as const;
const UINT32_RANGE = 0x1_0000_0000;
const DOMAIN_TAG = 0x45464658;
const GOLDEN_RATIO = 0x9e3779b9;
const FMIX_MULTIPLIER_A = 0x85ebca6b;
const FMIX_MULTIPLIER_B = 0xc2b2ae35;

export class MapEffectRandomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapEffectRandomError';
  }
}

export interface MapEffectRandomDraw<T> {
  readonly value: T;
  readonly state: MapEffectRandomState;
}

export interface MapEffectRandomSubset<T> {
  readonly values: readonly T[];
  readonly state: MapEffectRandomState;
}

export function fmix32(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, FMIX_MULTIPLIER_A);
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, FMIX_MULTIPLIER_B);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}

function checkedState(value: unknown): MapEffectRandomState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MapEffectRandomError('Effect Random state must be an object');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 3 || !Object.prototype.hasOwnProperty.call(record, 'algorithm')
    || !Object.prototype.hasOwnProperty.call(record, 'seed') || !Object.prototype.hasOwnProperty.call(record, 'cursor')
    || record.algorithm !== MAP_EFFECT_RANDOM_ALGORITHM
    || !Number.isSafeInteger(record.seed) || (record.seed as number) < 0 || (record.seed as number) > 0xffff_ffff
    || !Number.isSafeInteger(record.cursor) || (record.cursor as number) < 0) {
    throw new MapEffectRandomError('Effect Random state has an invalid algorithm, seed, cursor, or shape');
  }
  return Object.freeze({
    algorithm: MAP_EFFECT_RANDOM_ALGORITHM,
    seed: record.seed as number,
    cursor: record.cursor as number,
  });
}

export function createMapEffectRandomState(handInitialSeed: number, cursor = 0): MapEffectRandomState {
  if (!Number.isSafeInteger(handInitialSeed) || handInitialSeed < 0 || handInitialSeed > 0xffff_ffff) {
    throw new MapEffectRandomError('Initial Hand seed must be an unsigned 32-bit integer');
  }
  return checkedState({
    algorithm: MAP_EFFECT_RANDOM_ALGORITHM,
    seed: fmix32(((handInitialSeed >>> 0) ^ DOMAIN_TAG) >>> 0),
    cursor,
  });
}

export function copyMapEffectRandomState(value: unknown): MapEffectRandomState {
  return checkedState(value);
}

export function nextMapEffectRandomWord(value: MapEffectRandomState): MapEffectRandomDraw<number> {
  const state = checkedState(value);
  if (state.cursor >= Number.MAX_SAFE_INTEGER) {
    throw new MapEffectRandomError('Effect Random cursor exhausted');
  }
  const low = state.cursor >>> 0;
  const high = Math.floor(state.cursor / UINT32_RANGE) >>> 0;
  const word = fmix32((state.seed ^ low ^ Math.imul((high ^ GOLDEN_RATIO) >>> 0, FMIX_MULTIPLIER_A)) >>> 0);
  return Object.freeze({
    value: word,
    state: Object.freeze({ ...state, cursor: state.cursor + 1 }),
  });
}

export function drawMapEffectRandomBelow(value: MapEffectRandomState, range: number): MapEffectRandomDraw<number> {
  let state = checkedState(value);
  if (!Number.isSafeInteger(range) || range < 1 || range > UINT32_RANGE) {
    throw new MapEffectRandomError('Effect Random range must be an integer in 1..2^32');
  }
  const cutoff = Math.floor(UINT32_RANGE / range) * range;
  for (;;) {
    const raw = nextMapEffectRandomWord(state);
    state = raw.state;
    if (raw.value < cutoff) return Object.freeze({ value: raw.value % range, state });
  }
}

export function sampleMapEffectRandomSubset<T>(
  candidates: readonly T[], count: number, value: MapEffectRandomState,
): MapEffectRandomSubset<T> {
  let state = checkedState(value);
  if (!Number.isSafeInteger(count) || count < 0 || count > candidates.length) {
    throw new MapEffectRandomError('Effect Random sample count is outside the candidate range');
  }
  if (candidates.length > UINT32_RANGE) throw new MapEffectRandomError('Effect Random candidate range exceeds uint32');
  const remaining = [...candidates];
  for (let index = 0; index < count; index += 1) {
    const draw = drawMapEffectRandomBelow(state, remaining.length - index);
    state = draw.state;
    const selectedIndex = index + draw.value;
    [remaining[index], remaining[selectedIndex]] = [remaining[selectedIndex]!, remaining[index]!];
  }
  return Object.freeze({ values: Object.freeze(remaining.slice(0, count)), state });
}
