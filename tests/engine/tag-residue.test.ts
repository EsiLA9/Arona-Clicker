import { describe, expect, test } from 'vitest';
import { clearTagResidueByMod, mergeTagEffects, mergeTagOverrides, splitTagEffects, splitTagOverrides, summarizeTagResidue } from '../../src/arona-clicker/state/tag-residue';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';

describe('dynamic Tag save residue', () => {
  test('splits active and disabled-mod Tag overrides', () => {
    const result = splitTagOverrides({
      'base:spot:a': { added: [['office']], removed: [['my-mod:haunted']] },
      'my-mod:spot:b': { added: [['my-mod:haunted']], removed: [] },
    }, new Set(['base']));
    expect(result.active).toEqual({ 'base:spot:a': { added: [['office']], removed: [] } });
    expect(result.residue).toEqual({ spotTagOverrides: {
      'base:spot:a': { added: [], removed: [['my-mod:haunted']] },
      'my-mod:spot:b': { added: [['my-mod:haunted']], removed: [] },
    } });
  });

  test('merges retained overrides without mutating inputs', () => {
    const active = { 'base:spot:a': { added: [['office']], removed: [] } };
    const residue = { spotTagOverrides: { 'base:spot:a': { added: [['my-mod:haunted']], removed: [] } } };
    const merged = mergeTagOverrides(active, residue);
    expect(merged['base:spot:a'].added).toEqual([['office'], ['my-mod:haunted']]);
    expect(active['base:spot:a'].added).toEqual([['office']]);
  });

  test('summarizes residue by namespace', () => {
    expect(summarizeTagResidue({ spotTagOverrides: {
      a: { added: [['my-mod:haunted']], removed: [['my-mod:haunted/underground']] },
      b: { added: [['other:sealed']], removed: [] },
    } })).toEqual({ 'my-mod': 2, other: 1 });
  });

  test('splits and merges TagEffect state by tag namespace', () => {
    const effects = {
      'base:office': [{ id: 'base-effect', category: 'mul' as const }],
      'my-mod:haunted': [{ id: 'mod-effect', category: 'flat' as const }],
    };
    const split = splitTagEffects(effects, new Set(['base']));
    expect(split.active).toEqual({ 'base:office': effects['base:office'] });
    expect(split.residue).toEqual({ 'my-mod:haunted': effects['my-mod:haunted'] });
    expect(mergeTagEffects(split.active, { spotTagOverrides: {}, tagEffects: split.residue })).toEqual(effects);
  });

  test('clears one namespace without mutating other residue', () => {
    const source = {
      spotTagOverrides: {
        spot: { added: [['my-mod:haunted'], ['other:open']], removed: [] },
      },
      tagEffects: {
        'my-mod:haunted': [{ id: 'e1', category: 'flat' as const }],
        'other:open': [{ id: 'e2', category: 'flat' as const }],
      },
    };
    const result = clearTagResidueByMod(source, 'my-mod');
    expect(result.removed).toBe(2);
    expect(result.residue).toEqual({
      spotTagOverrides: { spot: { added: [['other:open']], removed: [] } },
      tagEffects: { 'other:open': [{ id: 'e2', category: 'flat' }] },
    });
    expect(source.spotTagOverrides.spot.added).toHaveLength(2);
  });

  test('keeps malformed qualified Tag values out of active state', () => {
    const overrides = splitTagOverrides({ spot: {
      added: [['bad:tag:path'], ['office']], removed: [],
    } }, new Set(['bad', 'base']));
    const effects = splitTagEffects({
      'bad:tag:path': [{ id: 'bad-effect', category: 'flat' as const }],
      'base:office': [{ id: 'base-effect', category: 'flat' as const }],
    }, new Set(['bad', 'base']));
    expect(overrides.active).toEqual({ spot: { added: [['office']], removed: [] } });
    expect(overrides.residue.spotTagOverrides.spot.added).toEqual([['bad:tag:path']]);
    expect(effects.active).toEqual({ 'base:office': [{ id: 'base-effect', category: 'flat' }] });
    expect(effects.residue).toEqual({ 'bad:tag:path': [{ id: 'bad-effect', category: 'flat' }] });
  });

  test('runtime save/load keeps disabled namespace residue out of active state', () => {
    const source = new GameInstance();
    const restored = new GameInstance();
    try {
      source.init([baseDatapack]);
      Object.assign(source.state, { spotTagOverrides: {
        'base:spot:credit_printer': { added: [['extension:haunted']], removed: [] },
      } });
      Object.assign(source.state, { tagEffects: {
        'extension:haunted': [{ id: 'extension-effect', category: 'flat' }],
      } });
      const saved = source.save();
      expect(saved.playerState.spotTagOverrides).toEqual({});
      expect(saved.playerState.tagEffects).toEqual({});
      expect(saved.retained).toEqual({
        spotTagOverrides: {
          'base:spot:credit_printer': { added: [['extension:haunted']], removed: [] },
        },
        tagEffects: {
          'extension:haunted': [{ id: 'extension-effect', category: 'flat' }],
        },
      });
      restored.init([baseDatapack]);
      restored.load(saved);
      expect(restored.state.spotTagOverrides).toEqual({});
      expect(restored.state.tagEffects).toEqual({});
      expect(restored.getTagResidueSummary()).toEqual({ extension: 2 });
      expect(restored.clearTagResidueByMod('extension')).toBe(2);
      expect(restored.getTagResidueSummary()).toEqual({});
      expect(restored.save().retained?.tagEffects).toBeUndefined();
    } finally {
      source.stop();
      restored.stop();
    }
  });
});
