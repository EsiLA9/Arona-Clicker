import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { GAMEPLAY_B_DAMAGE_APPLIED_RESOURCE_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-damage-applied-resource-example';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/map/registry-map-content-resolver';
import { Registry } from '../../src/data-services/registry/registry';

function draftToken(encounter: MapRunEncounterSnapshot) {
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

describe('Gameplay B damageApplied resource author example', () => {
  test('rewards the actual damage recipient and lets her later source read guard', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_DAMAGE_APPLIED_RESOURCE_EXAMPLE_MAP_ID);
    if (!map) throw new Error('damageApplied example Map was not registered');
    expect(map.executionContractId).toBe('AG-1');
    expect(map.resumeVersion).toBe(1);
    expect(map.initialPartyHp.find(row => row.characterId === 'serika')).toEqual({
      characterId: 'serika', initialHp: 9, maxHp: 10,
    });
    expect(map.initialActorResources).toContainEqual({ characterId: 'serika', resourceId: 'guard', value: 0 });
    expect(map.actions?.find(action => action.id === 'training-shot')?.effectProgram).toMatchObject({
      resolve: [{ op: 'damage', target: 'primary', amount: 1 }],
      triggers: [{ id: 'guard-on-hit', event: 'damageApplied', effect: {
        op: 'resourceChange', account: 'primaryActor', resourceId: 'guard', delta: 1,
      } }],
    });
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: GAMEPLAY_B_DAMAGE_APPLIED_RESOURCE_EXAMPLE_MAP_ID, mapEntryLabel: '进入受伤资源回馈演练',
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
    if (!entered.activeEncounter) throw new Error('Expected active damageApplied example Encounter');
    const ready = service.getSnapshot(started.runId);
    if (!ready?.activeEncounter) throw new Error('Expected a ready damageApplied example Encounter');

    const preview = service.previewEncounterCommit(started.runId);
    expect(preview?.diagnostics).toEqual([]);
    expect(preview?.executionSequence?.map(row => row.sourceKind)).toEqual(['enemyAction', 'partyAction']);
    expect(preview?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' },
      amount: 1, before: 9, after: 8, delta: -1,
    }));
    expect(preview?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', identity: { kind: 'enemy', id: 'training-target' },
      amount: 1, before: 5, after: 4, delta: -1,
    }));

    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'damage-applied-guard-once',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter) });
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(8);
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'guard')?.value).toBe(1);
    expect(committed.activeEncounter?.enemies.find(row => row.enemyId === 'training-target')?.currentHp).toBe(4);
    expect(committed.lastEncounterCommit).toMatchObject({
      triggerReceiptVersion: 1,
      triggerTrace: [{
        triggerId: 'guard-on-hit', event: 'damageApplied', target: { kind: 'partyCharacter', id: 'serika' },
        requestedAmount: 1, actualAppliedAmount: 1, resourceId: 'guard', delta: 1,
      }],
    });
    expect(committed.lastEncounterCommit?.effectTrace).toEqual(preview?.effectTrace);

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a checkpoint with the damageApplied Trigger Receipt');
    const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', mapId: map.id });
    expect(restored.getSnapshot()?.lastEncounterCommit?.triggerTrace).toEqual(committed.lastEncounterCommit?.triggerTrace);
  });
});
