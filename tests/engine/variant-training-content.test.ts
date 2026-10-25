import { describe, expect, test } from 'vitest';
import { Registry } from '../../src/data-services/registry/registry';
import type { VariantTranslationSnapshot } from '../../src/arona-clicker/contracts/character/variant-translation';
import { VariantTranslationService } from '../../src/arona-clicker/services/character/variant-translation-service';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { baseDatapackSource } from '../../src/arona-clicker/content/base-datapack-source';
import {
  VARIANT_TRAINING_SOURCES,
  VARIANT_TRAINING_TEMPLATE_VERSION,
  VARIANT_TRAINING_VARIANT_ID,
  buildVariantTrainingMap,
  variantTrainingContent,
  variantTrainingRequest,
} from '../../src/arona-clicker/content/gameplay-b/variant-training-content';
import { createDefaultState } from '../../src/arona-clicker/state/state-factory';
import type { PlayerState } from '../../src/arona-clicker/types/state';

function translate(source: 'owned' | 'normal' | 'enhanced', readiness = 20): VariantTranslationSnapshot {
  const state = createDefaultState();
  state.activeInit = 'test:init:training';
  state.roster = {
    Hoshino: {
      variantId: 'Hoshino', acquiredVia: 'gacha', acquiredCount: 1,
      level: 1, exp: 0, stars: 0, affectionLevel: 1, affectionExp: 0,
      colorEquipment: null,
    },
  } as PlayerState['roster'];
  const content = source === 'owned' && readiness !== 20
    ? {
      ...variantTrainingContent,
      resolveProfile: (ref: { id: string; revision: number }) => ref.id === 'variant-training:profile:hoshino'
        ? { id: ref.id, revision: ref.revision, variantId: 'Hoshino', capabilityIds: [], tags: [], candidateSourceIds: [],
          attributes: [{ id: 'readiness', base: readiness, perLevel: 0, perStar: 0, perAffectionLevel: 0 }] }
        : undefined,
    }
    : variantTrainingContent;
  const service = new VariantTranslationService({
    content,
    getState: () => state,
    getVariant: id => id === 'Hoshino' ? { id, proto: 'hoshino' } : undefined,
  });
  const preview = service.preview(variantTrainingRequest(source));
  expect(preview.status).toBe('ready');
  if (preview.status !== 'ready') throw new Error('Expected valid training translation');
  const confirmation = service.confirm(preview.token);
  expect(confirmation.status).toBe('confirmed');
  if (confirmation.status !== 'confirmed') throw new Error('Expected confirmed training translation');
  return confirmation.snapshot;
}

describe('Variant training content', () => {
  test('exposes the fixed Hoshino sources and translates owned progression and both provided slices', () => {
    expect(VARIANT_TRAINING_VARIANT_ID).toBe('Hoshino');
    expect(VARIANT_TRAINING_TEMPLATE_VERSION).toBe(1);
    expect(VARIANT_TRAINING_SOURCES.map(source => source.id)).toEqual(['owned', 'normal', 'enhanced']);
    expect(variantTrainingContent.resolveEntry('other')).toBeUndefined();

    const owned = translate('owned');
    expect(owned.members[0]).toMatchObject({
      slotId: 'trainee', variantId: 'Hoshino', statisticsCharacterId: 'hoshino',
      input: { attributes: [{ id: 'readiness', value: 20 }] },
      build: { parameters: { maxHp: 10, baseAgility: 2, maxAgility: 8 } },
    });
    const normal = translate('normal');
    const enhanced = translate('enhanced');
    expect(normal.members[0].build.parameters).toEqual({ maxHp: 10, baseAgility: 2, maxAgility: 8 });
    expect(enhanced.members[0].build.parameters).toEqual({ maxHp: 16, baseAgility: 6, maxAgility: 8 });
  });

  test('does not expose mutable resolver refs through requests or resolved entry content', () => {
    const request = variantTrainingRequest('normal') as any;
    const resolvedEntry = variantTrainingContent.resolveEntry(request.entryId) as any;
    expect(Object.isFrozen(request.members[0].source)).toBe(true);
    expect(Object.isFrozen(request.members[0].source.slice)).toBe(true);
    expect(Object.isFrozen(resolvedEntry.rules)).toBe(true);
    expect(Object.isFrozen(resolvedEntry.owned[0].profile)).toBe(true);
    expect(Object.isFrozen(resolvedEntry.slices[0].slice)).toBe(true);
    try { request.members[0].source.slice.id = 'forged:slice'; } catch { /* frozen in strict mode */ }
    try { resolvedEntry.rules.id = 'forged:rules'; } catch { /* frozen in strict mode */ }
    try { resolvedEntry.owned[0].profile.revision = 99; } catch { /* frozen in strict mode */ }
    try { resolvedEntry.slices[0].slice.id = 'forged:slice'; } catch { /* frozen in strict mode */ }

    expect(variantTrainingRequest('normal').members[0].source).toEqual({
      kind: 'slice', slice: { id: 'variant-training:slice:normal', revision: 1 },
    });
    expect(variantTrainingContent.resolveEntry('variant-training:entry:hoshino')?.rules)
      .toEqual({ id: 'variant-training:rules:gameplay-b', revision: 1 });
    expect(translate('normal').members[0].build.parameters).toEqual({ maxHp: 10, baseAgility: 2, maxAgility: 8 });
  });

  test('builds an AG-1 map whose HP and speed values drive normal and enhanced order', () => {
    const normal = buildVariantTrainingMap(translate('normal'));
    const enhanced = buildVariantTrainingMap(translate('enhanced'));
    expect(normal).toMatchObject({
      id: 'gameplay-b:map:variant-translation-training', executionContractId: 'AG-1',
      startNodeId: 'entry', exitNodeIds: ['exit'], partyCharacterIds: ['hoshino'],
      initialPartyHp: [{ characterId: 'hoshino', initialHp: 10, maxHp: 10 }],
      partyAgility: [{ characterId: 'hoshino', agility: 2 }],
    });
    expect(enhanced.initialPartyHp).toEqual([{ characterId: 'hoshino', initialHp: 16, maxHp: 16 }]);
    expect(enhanced.partyAgility).toEqual([{ characterId: 'hoshino', agility: 6 }]);
    const partyAction = normal.actions?.find(action => action.id === 'trainee-strike');
    const enemyAction = normal.actions?.find(action => action.id === 'training-strike');
    expect(partyAction).toMatchObject({ agility: { base: 0, max: 8 }, effectProgram: { resolve: [{ op: 'damage', amount: 2 }] } });
    expect(enemyAction).toMatchObject({ agility: { base: 4, max: 4 }, effectProgram: { resolve: [{ op: 'damage', amount: 2 }] } });
    expect(normal.nodes.find(node => node.id === 'battle')?.encounter).toMatchObject({
      enemies: [{ id: 'training-target', initialHp: 6, maxHp: 6, agility: 0 }],
    });

    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load({ ...baseDatapackSource, maps: [normal] });
    expect(registry.maps.get(normal.id)).toMatchObject({ id: normal.id, executionContractId: 'AG-1' });
  });

  test('rejects another Variant, a multi-member build, forged grades, and out-of-range parameters', () => {
    const snapshot = translate('normal');
    expect(() => buildVariantTrainingMap({ ...snapshot, members: [
      ...snapshot.members, { ...snapshot.members[0], slotId: 'extra' },
    ] })).toThrow(/supported Variant training build/);
    expect(() => buildVariantTrainingMap({ ...snapshot, members: [
      { ...snapshot.members[0], variantId: 'HoshinoSwimsuit' },
    ] })).toThrow(/fixed Hoshino trainee/);
    expect(() => buildVariantTrainingMap({ ...snapshot, members: [{
      ...snapshot.members[0], build: { ...snapshot.members[0].build,
        parameters: { maxHp: 10, baseAgility: 99, maxAgility: 8 } },
    }] })).toThrow(/outside the training bounds/);
    expect(() => buildVariantTrainingMap({ ...snapshot, members: [{
      ...snapshot.members[0], input: { ...snapshot.members[0].input, attributes: [{ id: 'readiness', value: 60 }] },
      build: { ...snapshot.members[0].build, parameters: { maxHp: 10, baseAgility: 2, maxAgility: 8 } },
    }] })).toThrow(/do not match its readiness grade/);
    expect(() => buildVariantTrainingMap({ ...snapshot, members: [{
      ...snapshot.members[0], input: { ...snapshot.members[0].input, attributes: [{ id: 'readiness', value: 10_001 }] },
    }] })).toThrow(/outside the training bounds/);
    expect(() => buildVariantTrainingMap({ ...snapshot, entry: { id: 'another:entry', revision: 1 } }))
      .toThrow(/supported Variant training build/);
  });
});
