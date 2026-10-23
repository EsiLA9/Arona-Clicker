import { describe, expect, it } from 'vitest';
import {
  resolveGameplayBAg1SourceOrder,
  type GameplayBAg1SourceOrderCandidate,
} from '../../src/arona-clicker/services/map/gameplay-b-ag1-scheduler';

const candidate = (sourceKey: string, overrides: Partial<GameplayBAg1SourceOrderCandidate> = {}): GameplayBAg1SourceOrderCandidate => ({
  sourceKey,
  finalAgility: 5,
  baseAgility: 3,
  sideRank: 0,
  sourceRank: 0,
  ownerDeclarationIndex: 0,
  logicalIndex: 0,
  ...overrides,
});

describe('Gameplay B AG-1 pure source order', () => {
  it('sorts by final/base agility then the complete stable tie-break key', () => {
    const rows = [
      candidate('z-enemy', { finalAgility: 10, sideRank: 1, sourceRank: 0 }),
      candidate('b-party-base-low', { finalAgility: 8, baseAgility: 2 }),
      candidate('a-party-base-high', { finalAgility: 8, baseAgility: 4 }),
      candidate('z-party-owner-late', { finalAgility: 7, ownerDeclarationIndex: 1, logicalIndex: 0 }),
      candidate('c-party-logical-late', { finalAgility: 7, ownerDeclarationIndex: 0, logicalIndex: 2 }),
      candidate('b-party-logical-early', { finalAgility: 7, ownerDeclarationIndex: 0, logicalIndex: 1 }),
      candidate('a-party-logical-early', { finalAgility: 7, ownerDeclarationIndex: 0, logicalIndex: 1 }),
      candidate('z-ability', { finalAgility: 7, sourceRank: 1 }),
      candidate('z-item', { finalAgility: 7, sourceRank: 2 }),
      candidate('a-enemy-slower', { finalAgility: 7, sideRank: 1, sourceRank: 0 }),
    ];

    expect(resolveGameplayBAg1SourceOrder(rows).map(row => row.sourceKey)).toEqual([
      'z-enemy',
      'a-party-base-high',
      'b-party-base-low',
      'a-party-logical-early',
      'b-party-logical-early',
      'c-party-logical-late',
      'z-party-owner-late',
      'z-ability',
      'z-item',
      'a-enemy-slower',
    ]);
  });

  it('produces the same full ordering for different candidate input permutations', () => {
    const rows = [
      candidate('party', { finalAgility: 4, baseAgility: 2 }),
      candidate('ability', { finalAgility: 4, baseAgility: 2, sourceRank: 1 }),
      candidate('item', { finalAgility: 4, baseAgility: 2, sourceRank: 2 }),
      candidate('enemy', { finalAgility: 4, baseAgility: 2, sideRank: 1, sourceRank: 0 }),
      candidate('fast-party', { finalAgility: 7, baseAgility: 1 }),
    ];
    const expected = resolveGameplayBAg1SourceOrder(rows).map(row => row.sourceKey);
    const visitPermutations = (remaining: readonly GameplayBAg1SourceOrderCandidate[], prefix: GameplayBAg1SourceOrderCandidate[] = []) => {
      if (remaining.length === 0) {
        expect(resolveGameplayBAg1SourceOrder(prefix).map(row => row.sourceKey)).toEqual(expected);
        return;
      }
      remaining.forEach((row, index) => visitPermutations(
        [...remaining.slice(0, index), ...remaining.slice(index + 1)], [...prefix, row]));
    };
    visitPermutations(rows);
  });

  it('returns a fresh array and leaves frozen input candidates unchanged', () => {
    const rows = Object.freeze([
      Object.freeze(candidate('later', { logicalIndex: 1 })),
      Object.freeze(candidate('earlier', { logicalIndex: 0 })),
    ]);
    const before = structuredClone(rows);
    const ordered = resolveGameplayBAg1SourceOrder(rows);

    expect(ordered).not.toBe(rows);
    expect(ordered.map(row => row.sourceKey)).toEqual(['earlier', 'later']);
    expect(rows).toEqual(before);
    expect(rows[0]).toMatchObject({ sourceKey: 'later', logicalIndex: 1 });
  });

  it('rejects empty/duplicate source keys, extra fields, and invalid side/rank pairs', () => {
    expect(() => resolveGameplayBAg1SourceOrder([candidate(' ')] )).toThrow(/sourceKey/);
    expect(() => resolveGameplayBAg1SourceOrder([candidate('same'), candidate('same')])).toThrow(/duplicate sourceKey/);
    expect(() => resolveGameplayBAg1SourceOrder([{ ...candidate('extra'), unmodeled: 1 } as GameplayBAg1SourceOrderCandidate]))
      .toThrow(/exactly/);
    expect(() => resolveGameplayBAg1SourceOrder([candidate('enemy-ability', { sideRank: 1, sourceRank: 1 })]))
      .toThrow(/sideRank\/sourceRank/);
    const accessor = { ...candidate('accessor') } as Record<string, unknown>;
    Object.defineProperty(accessor, 'logicalIndex', { enumerable: true, get: () => { throw new Error('must not evaluate accessors'); } });
    expect(() => resolveGameplayBAg1SourceOrder([accessor as unknown as GameplayBAg1SourceOrderCandidate])).toThrow(/data property/);
  });

  it.each(['finalAgility', 'baseAgility', 'ownerDeclarationIndex', 'logicalIndex'] as const)(
    'rejects unsafe, negative, and fractional %s values', field => {
      for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
        expect(() => resolveGameplayBAg1SourceOrder([candidate('invalid', { [field]: value })]))
          .toThrow(new RegExp(field));
      }
    },
  );

  it.each(['sideRank', 'sourceRank'] as const)('rejects invalid integer encodings for %s', field => {
    for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const row = { ...candidate('invalid-rank'), [field]: value } as unknown as GameplayBAg1SourceOrderCandidate;
      expect(() => resolveGameplayBAg1SourceOrder([row])).toThrow(new RegExp(field));
    }
  });

  it('accepts maximum safe integer keys without subtraction overflow', () => {
    const rows = [
      candidate('small', { finalAgility: 0, baseAgility: 0 }),
      candidate('large', { finalAgility: Number.MAX_SAFE_INTEGER }),
    ];
    expect(resolveGameplayBAg1SourceOrder(rows).map(row => row.sourceKey)).toEqual(['large', 'small']);
  });

  it('rejects finalAgility below baseAgility', () => {
    expect(() => resolveGameplayBAg1SourceOrder([
      candidate('inconsistent', { finalAgility: 2, baseAgility: 3 }),
    ])).toThrow(/finalAgility must be greater than or equal to baseAgility/);
  });
});
