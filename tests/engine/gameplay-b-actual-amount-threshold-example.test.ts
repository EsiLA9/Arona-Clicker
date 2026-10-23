import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { GAMEPLAY_B_ACTUAL_AMOUNT_THRESHOLD_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-actual-amount-threshold-example';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/map/registry-map-content-resolver';
import { Registry } from '../../src/data-services/registry/registry';

function draftToken(encounter: MapRunEncounterSnapshot) {
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

describe('Gameplay B actual amount threshold author example', () => {
  test('skips a shielded one-HP loss, triggers on two actual HP loss, and exposes reward to Serika', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_ACTUAL_AMOUNT_THRESHOLD_EXAMPLE_MAP_ID);
    if (!map) throw new Error('Actual amount threshold example Map was not registered');
    expect(map.executionContractId).toBe('AG-1');
    expect(map.resumeVersion).toBe(1);
    expect(map.actions?.find(action => action.id === 'threshold-shot')?.effectProgram).toMatchObject({
      resolve: [
        { op: 'shieldAdd', target: 'primary', amount: 2 },
        { op: 'damage', target: 'primary', amount: 3 },
        { op: 'damage', target: 'primary', amount: 2 },
      ],
      triggers: [{ id: 'guard-on-two-hp-loss', event: 'damageApplied', minimumActualAmount: 2,
        effect: { op: 'resourceChange', account: 'primaryActor', resourceId: 'guard', delta: 1 } }],
    });
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: GAMEPLAY_B_ACTUAL_AMOUNT_THRESHOLD_EXAMPLE_MAP_ID, mapEntryLabel: '进入实际变化阈值演练',
    }));

    const resolver = createRegistryMapContentResolver(registry);
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const party = map.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(map.id, party);
    const entered = service.move(started.runId, 'practice');
    if (!entered.activeEncounter) throw new Error('Expected active actual amount threshold Encounter');
    const ready = service.getSnapshot(started.runId);
    if (!ready?.activeEncounter) throw new Error('Expected a ready actual amount threshold Encounter');
    const preview = service.previewEncounterCommit(started.runId);
    expect(preview?.diagnostics).toEqual([]);
    expect(preview?.executionSequence?.map(row => row.sourceKind)).toEqual(['enemyAction', 'partyAction']);
    expect(preview?.shieldTrace?.filter(row => row.actionId === 'threshold-shot')).toMatchObject([
      { op: 'shieldAdd', requestedAmount: 2, added: 2 },
      { op: 'damage', requestedAmount: 3, absorbed: 2, remainingDamage: 1, hpBefore: 9, hpAfter: 8 },
      { op: 'damage', requestedAmount: 2, absorbed: 0, remainingDamage: 2, hpBefore: 8, hpAfter: 6 },
    ]);
    expect(preview?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' }, amount: 3, before: 9, after: 8, delta: -1,
    }));
    expect(preview?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' }, amount: 2, before: 8, after: 6, delta: -2,
    }));
    expect(preview?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', identity: { kind: 'enemy', id: 'training-target' }, amount: 1, before: 5, after: 4, delta: -1,
    }));

    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'actual-amount-threshold-once',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter) });
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(6);
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'guard')?.value).toBe(1);
    expect(committed.activeEncounter?.enemies.find(row => row.enemyId === 'training-target')?.currentHp).toBe(4);
    expect(committed.lastEncounterCommit).toMatchObject({
      triggerReceiptVersion: 1,
      triggerTrace: [{
        queueIndex: 1,
        triggerId: 'guard-on-two-hp-loss',
        event: 'damageApplied',
        target: { kind: 'partyCharacter', id: 'serika' },
        requestedAmount: 2,
        actualAppliedAmount: 2,
        resourceId: 'guard',
        delta: 1,
      }],
    });
    expect(committed.lastEncounterCommit?.triggerTrace).toHaveLength(1);
    expect(committed.lastEncounterCommit?.effectTrace).toEqual(preview?.effectTrace);

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a checkpoint with the threshold Trigger Receipt');
    const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', mapId: map.id });
    expect(restored.getSnapshot()?.lastEncounterCommit?.triggerTrace).toEqual(committed.lastEncounterCommit?.triggerTrace);

    const changedThresholdMap = {
      ...map,
      actions: map.actions?.map(action => action.id !== 'threshold-shot' ? action : {
        ...action,
        effectProgram: action.effectProgram && {
          ...action.effectProgram,
          triggers: action.effectProgram.triggers?.map(trigger => ({ ...trigger, minimumActualAmount: 3 })),
        },
      }),
    };
    const thresholdChangedResolver = {
      resolve: (mapId: string) => mapId === map.id ? changedThresholdMap : resolver.resolve(mapId),
    };
    const thresholdChanged = new MapRunService(thresholdChangedResolver, resolveCharacterIdForVariant);
    expect(thresholdChanged.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });
});
