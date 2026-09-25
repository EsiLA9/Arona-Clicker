import { describe, expect, test } from 'vitest';
import type { Registry } from '../../src/data-services/registry/registry';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import { deriveDesiredInformationWatches, queryInformationReveal } from '../../src/arona-clicker/services/information-reveal-domain';

const gate = (target: string, key: string) => ({ reveal: target as 'name', condition: { target: 'resource' as const, key, comparator: '>=' as const, value: 1 } });
const fixture = () => {
  const maps = {
    inits: new Map([['i', { id: 'i', revealTriggers: [gate('name', 'r')] }]]),
    areas: new Map([['a', { id: 'a', initId: 'i', revealTriggers: [gate('name', 'r')] }], ['other-area', { id: 'other-area', initId: 'j' }]]),
    spots: new Map([['s', { id: 's', areaId: 'a', revealTriggers: [gate('name', 'r')] }], ['global-spot', { id: 'global-spot', areaId: 'other-area', global: true, revealTriggers: [gate('name', 'r')] }]]),
    enhancements: new Map([['e', { id: 'e', revealTriggers: [gate('name', 'r')] }]]),
    items: new Map([['it', { id: 'it', revealTriggers: [gate('name', 'r')] }], ['no-gates', { id: 'no-gates' }]]),
    activeStories: new Map([['entry-a', { id: 'entry-a', availableInits: ['i'], revealTriggers: [gate('name', 'r')] }]]),
    passiveStories: new Map([['entry-p', { id: 'entry-p', availableInits: ['i'], revealTriggers: [gate('name', 'r')] }], ['entry-any', { id: 'entry-any', availableInits: [] }]]),
  };
  return maps as unknown as Registry;
};
const state = (extra: Partial<PlayerState> = {}) => ({ activeInit: 'i', informationRevealProgress: { revealed: [] }, ...extra } as PlayerState);

describe('information reveal domain', () => {
  test('derives watches for all seven entity kinds using current Init and StoryEntry identity', () => {
    const watches = deriveDesiredInformationWatches(fixture(), state(), 'i');
    expect(watches.map(w => `${w.key.entityKind}:${w.key.entityId}`)).toEqual([
      'init:i', 'area:a', 'spot:s', 'spot:global-spot', 'enhancement:e', 'item:it', 'activeStoryEntry:entry-a', 'passiveStoryEntry:entry-p',
    ]);
    expect(watches[0].wakePlan.kind).toBe('reactive');
    expect(watches[0].fullCondition).toEqual({ target: 'resource', key: 'r', comparator: '>=', value: 1 });
  });

  test('classifies unresolved, no gate, known progress, and out of scope separately', () => {
    const registry = fixture();
    expect(queryInformationReveal(registry, state(), { entityKind: 'item', entityId: 'it', target: 'future' }, 'i').status).toBe('unresolved');
    expect(queryInformationReveal(registry, state(), { entityKind: 'item', entityId: 'it', target: 'utility' }, 'i').status).toBe('known-no-gate');
    expect(queryInformationReveal(registry, state({ informationRevealProgress: { revealed: [{ entityKind: 'item', entityId: 'it', target: 'name' }] } }), { entityKind: 'item', entityId: 'it', target: 'name' }, 'i').status).toBe('known-progress');
    expect(queryInformationReveal(registry, state(), { entityKind: 'area', entityId: 'a', target: 'name' }, 'other').status).toBe('unresolved');
    expect(queryInformationReveal(registry, state(), { entityKind: 'item', entityId: 'no-gates', target: 'name' }, 'i').status).toBe('known-no-gate');
    expect(queryInformationReveal(registry, state(), { entityKind: 'spot', entityId: 'global-spot', target: 'name' }, 'i').status).toBe('pending-gate');
    expect(queryInformationReveal(registry, state(), { entityKind: 'passiveStoryEntry', entityId: 'entry-any', target: 'name' }, 'i').status).toBe('known-no-gate');
    expect(queryInformationReveal(registry, state(), { entityKind: 'activeStoryEntry', entityId: 'entry-a', target: 'name' }, 'j').status).toBe('unresolved');
  });

  test('combines same target gates with OR, preserving nested expressions and deduplicating wake sources', () => {
    const registry = fixture() as unknown as { inits: Map<string, { revealTriggers: unknown[] }> };
    registry.inits.set('i', { revealTriggers: [
      { reveal: 'name', condition: { type: 'AND', conditions: [gate('name', 'r').condition, gate('name', 'r').condition] } },
      { reveal: 'name', condition: gate('name', 'r').condition },
    ] });
    const watch = deriveDesiredInformationWatches(registry as unknown as Registry, state(), 'i')[0];
    expect(watch.fullCondition).toEqual({ type: 'OR', conditions: [
      { type: 'AND', conditions: [gate('name', 'r').condition, gate('name', 'r').condition] }, gate('name', 'r').condition,
    ] });
    expect(watch.wakePlan.kind === 'reactive' && watch.wakePlan.sources.filter(s => s.kind === 'resource-change')).toHaveLength(1);
  });

  test('plans all seven actual targets, marking partial mixed gates and admission-only gaps', () => {
    const registry = fixture() as unknown as { items: Map<string, { revealTriggers: unknown[] }>; inits: Map<string, { revealTriggers: unknown[] }> };
    const targets = ['resource', 'spotLevel', 'hasReadStory', 'hasReadStoryInRun', 'stat', 'hasEnh', 'countTags'];
    targets.forEach((target, n) => registry.items.set(`cond-${n}`, { revealTriggers: [{
      reveal: 'name', condition: { target, key: target, comparator: '>=', value: 1 },
    }] }));
    const watches = deriveDesiredInformationWatches(registry as unknown as Registry, state(), 'i').filter(w => w.key.entityId.startsWith('cond-'));
    expect(watches.filter(w => w.wakePlan.kind === 'reactive')).toHaveLength(4);
    expect(watches.filter(w => w.wakePlan.kind === 'admission-only')).toHaveLength(3);
    registry.inits.get('i')!.revealTriggers.push({ reveal: 'utility', condition: { type: 'AND', conditions: [
      { target: 'resource', key: 'x', comparator: '>=', value: 1 }, { target: 'stat', key: 's', comparator: '>=', value: 1 },
    ] } });
    const mixed = deriveDesiredInformationWatches(registry as unknown as Registry, state(), 'i').find(w => w.key.target === 'utility')!;
    expect(mixed.wakePlan).toMatchObject({ kind: 'reactive', activationCoverage: 'partial' });
  });

  test('fails closed on missing, self, and cyclic prerequisites; progress survives definition unload', () => {
    const registry = fixture();
    const key = { entityKind: 'init' as const, entityId: 'i', target: 'name' };
    const run = (map: Record<string, string[]>) => queryInformationReveal(registry, state(), key, 'i', map).status;
    expect(run({ ['init\u0000i\u0000name']: ['missing'] })).toBe('prerequisite-unmet');
    expect(run({ ['init\u0000i\u0000name']: ['name'] })).toBe('prerequisite-unmet');
    expect(run({ ['init\u0000i\u0000name']: ['condition'], ['init\u0000i\u0000condition']: ['name'] })).toBe('prerequisite-unmet');
    const empty = { ...registry, inits: new Map() } as unknown as Registry;
    expect(queryInformationReveal(empty, state({ informationRevealProgress: { revealed: [key] } }), key, 'i').status).toBe('unresolved');
    expect(state({ informationRevealProgress: { revealed: [key] } }).informationRevealProgress?.revealed).toContainEqual(key);
  });

  test('rejects existence and unlock while retaining extensible information targets', () => {
    const registry = fixture() as unknown as { items: Map<string, { revealTriggers: unknown[] }> };
    registry.items.set('it', { revealTriggers: [
      { reveal: 'future-label', condition: { target: 'resource', key: 'r', comparator: '>=', value: 1 } },
      { reveal: 'existence', condition: { target: 'resource', key: 'r', comparator: '>=', value: 1 } },
      { reveal: 'unlock', condition: { target: 'resource', key: 'r', comparator: '>=', value: 1 } },
    ] });
    const r = registry as unknown as Registry;
    expect(queryInformationReveal(r, state(), { entityKind: 'item', entityId: 'it', target: 'future-label' }, 'i').status).toBe('pending-gate');
    expect(queryInformationReveal(r, state(), { entityKind: 'item', entityId: 'it', target: 'existence' }, 'i').status).toBe('unresolved');
    expect(queryInformationReveal(r, state(), { entityKind: 'item', entityId: 'it', target: 'unlock' }, 'i').status).toBe('unresolved');
  });

  test('hasReadStoryInRun invalidation is complete within a Run', () => {
    const registry = fixture() as unknown as { items: Map<string, { revealTriggers: unknown[] }> };
    registry.items.set('run-gate', { revealTriggers: [{
      reveal: 'name', condition: { target: 'hasReadStoryInRun', key: 'story', comparator: '==', value: 1 },
    }] });
    const watch = deriveDesiredInformationWatches(registry as unknown as Registry, state(), 'i').find(w => w.key.entityId === 'run-gate')!;
    expect(watch.wakePlan).toMatchObject({ kind: 'reactive', invalidationCoverage: 'complete' });
  });
});
