import { describe, expect, test } from 'vitest';
import type { MapEffectRandomState } from '../../src/arona-clicker/contracts/map/map-effects';
import {
  copyMapEffectRandomState,
  createMapEffectRandomState,
  drawMapEffectRandomBelow,
  fmix32,
  MAP_EFFECT_RANDOM_ALGORITHM,
  nextMapEffectRandomWord,
  sampleMapEffectRandomSubset,
} from '../../src/arona-clicker/services/map/gameplay-b-effect-rng';

const state = (seed = 0, cursor = 0): MapEffectRandomState => ({
  algorithm: MAP_EFFECT_RANDOM_ALGORITHM, seed, cursor,
});

describe('Gameplay B Effect Random', () => {
  test('matches frozen fmix32, domain-derived seed, and counter-addressed words', () => {
    expect(fmix32(0)).toBe(0);
    expect(fmix32(1)).toBe(1_364_076_727);
    const initial = createMapEffectRandomState(0x1234_5678);
    expect(initial).toEqual({ algorithm: MAP_EFFECT_RANDOM_ALGORITHM, seed: 2_380_299_466, cursor: 0 });
    expect(nextMapEffectRandomWord(initial)).toEqual({ value: 15_319_579, state: { ...initial, cursor: 1 } });
    expect(nextMapEffectRandomWord(state(0, 0x1_0000_0000))).toEqual({
      value: 1_633_962_652,
      state: state(0, 0x1_0000_0001),
    });
  });

  test('rejects invalid seeds, state shape, algorithm, and unsafe cursors', () => {
    expect(() => createMapEffectRandomState(-1)).toThrow(/unsigned 32-bit/);
    expect(() => copyMapEffectRandomState({ ...state(), extra: true })).toThrow(/invalid.*shape/);
    expect(() => copyMapEffectRandomState({ ...state(), algorithm: 'hand-rng' })).toThrow(/invalid.*shape/);
    expect(() => copyMapEffectRandomState({ ...state(), cursor: Number.MAX_SAFE_INTEGER + 1 })).toThrow(/invalid.*shape/);
  });

  test('uses rejection sampling and advances cursor for every rejected raw word', () => {
    const result = drawMapEffectRandomBelow(state(0, 0), 0x8000_0001);
    expect(result).toEqual({ value: 222_075_322, state: state(0, 3) });
    expect(() => drawMapEffectRandomBelow(state(), 0)).toThrow(/range/);
  });

  test('uses ordered partial Fisher–Yates without replacement and preserves empty-sample cursor', () => {
    const selected = sampleMapEffectRandomSubset(['a', 'b', 'c', 'd'], 3, state());
    expect(selected).toEqual({ values: ['c', 'b', 'a'], state: state(0, 3) });
    expect(new Set(selected.values).size).toBe(selected.values.length);
    expect(sampleMapEffectRandomSubset(['only'], 0, state(9, 7))).toEqual({ values: [], state: state(9, 7) });
    expect(sampleMapEffectRandomSubset(['a', 'b'], 2, state()).values).toHaveLength(2);
  });

  test('allows the final safe cursor value but rejects any further raw word', () => {
    const last = nextMapEffectRandomWord(state(7, Number.MAX_SAFE_INTEGER - 1));
    expect(last.state.cursor).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => nextMapEffectRandomWord(last.state)).toThrow(/cursor exhausted/);
    expect(() => nextMapEffectRandomWord(state(7, Number.MAX_SAFE_INTEGER))).toThrow(/cursor exhausted/);
  });
});
