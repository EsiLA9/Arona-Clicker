import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { GAMEPLAY_B_HEAL_APPLIED_RESOURCE_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-heal-applied-resource-example';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/map/registry-map-content-resolver';
import { Registry } from '../../src/data-services/registry/registry';

function draftToken(encounter: MapRunEncounterSnapshot) {
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

function makeParty(map: GameplayMapDef, registry: Registry) {
  return map.partyCharacterIds.map(characterId => {
    const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
    if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
    return { characterId, variantId: variant.id };
  });
}

describe('Gameplay B healApplied resource author example', () => {
  test('heals Serika for the actual capped HP amount and grants her one local Focus', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_HEAL_APPLIED_RESOURCE_EXAMPLE_MAP_ID);
    if (!map) throw new Error('healApplied example Map was not registered');
    expect(map.executionContractId).toBe('AG-1');
    expect(map.initialPartyHp.find(row => row.characterId === 'serika')).toEqual({
      characterId: 'serika', initialHp: 9, maxHp: 10,
    });
    expect(map.initialActorResources).toContainEqual({ characterId: 'serika', resourceId: 'focus', value: 0 });
    expect(map.actions?.find(action => action.id === 'encourage')?.effectProgram).toMatchObject({
      resolve: [{ op: 'heal', target: 'primary', amount: 3 }],
      triggers: [{ id: 'focus-on-heal', event: 'healApplied', effect: {
        op: 'resourceChange', account: 'primaryActor', resourceId: 'focus', delta: 1,
      } }],
    });
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: GAMEPLAY_B_HEAL_APPLIED_RESOURCE_EXAMPLE_MAP_ID, mapEntryLabel: '进入受治资源回馈演练',
    }));

    const registryResolver = createRegistryMapContentResolver(registry);
    const resolver = { resolve: (id: string) => registryResolver.resolve(id) };
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(map.id, makeParty(map, registry));
    const entered = service.move(started.runId, 'practice');
    if (!entered.activeEncounter) throw new Error('Expected the active healApplied example Encounter');
    service.setAbilityDraft(started.runId, 'encourage', { kind: 'partyCharacter', characterId: 'serika' },
      draftToken(entered.activeEncounter));
    const ready = service.getSnapshot(started.runId);
    if (!ready?.activeEncounter) throw new Error('Expected the selected heal target');
    const preview = service.previewEncounterCommit(started.runId);
    expect(preview?.diagnostics).toEqual([]);
    expect(preview?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'heal', identity: { kind: 'partyCharacter', id: 'serika' }, amount: 3,
      before: 9, after: 10, delta: 1,
    }));
    expect(preview?.executionSequence?.map(row => row.sourceKind)).toEqual(['ability', 'partyAction']);
    expect(preview?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', identity: { kind: 'enemy', id: 'training-target' }, amount: 1, before: 5, after: 4,
    }));
    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'heal-applied-focus-once',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter) });
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(10);
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(1);
    expect(committed.lastEncounterCommit?.effectTrace).toEqual(preview?.effectTrace);
    const triggerReceipt = committed.lastEncounterCommit as unknown as {
      triggerReceiptVersion?: number;
      triggerTrace?: readonly unknown[];
    } | null;
    expect(triggerReceipt?.triggerReceiptVersion).toBe(1);
    expect(triggerReceipt?.triggerTrace).toMatchObject([{
      triggerId: 'focus-on-heal', event: 'healApplied', target: { kind: 'partyCharacter', id: 'serika' },
      requestedAmount: 3, actualAppliedAmount: 1, resourceId: 'focus', delta: 1,
    }]);

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a checkpoint with the Trigger Receipt');
    const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', mapId: map.id });
    expect(restored.getSnapshot()?.lastEncounterCommit?.triggerTrace).toEqual(triggerReceipt?.triggerTrace);
    const forged = structuredClone(checkpoint) as any;
    forged.run.lastEncounterCommit.triggerTrace[0].actualAppliedAmount = 2;
    forged.run.activeEncounter.lastCommit.triggerTrace[0].actualAppliedAmount = 2;
    expect(new MapRunService(resolver, resolveCharacterIdForVariant).restoreSaveSnapshot(forged))
      .toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });

  test('does not emit a healApplied trigger or resource reward when Serika is already at full HP', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registeredMap = registry.maps.get(GAMEPLAY_B_HEAL_APPLIED_RESOURCE_EXAMPLE_MAP_ID);
    if (!registeredMap) throw new Error('healApplied example Map was not registered');
    const fullHpMap: GameplayMapDef = {
      ...registeredMap,
      id: 'gameplay-b:map:heal-applied-resource-example-full',
      initialPartyHp: registeredMap.initialPartyHp?.map(row => row.characterId === 'serika'
        ? { ...row, initialHp: 10 }
        : row) ?? [],
    };
    const registryResolver = createRegistryMapContentResolver(registry);
    const resolver = { resolve: (id: string) => id === fullHpMap.id ? fullHpMap : registryResolver.resolve(id) };
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(fullHpMap.id, makeParty(fullHpMap, registry));
    const entered = service.move(started.runId, 'practice');
    if (!entered.activeEncounter) throw new Error('Expected the full-HP healApplied example Encounter');
    service.setAbilityDraft(started.runId, 'encourage', { kind: 'partyCharacter', characterId: 'serika' },
      draftToken(entered.activeEncounter));
    const ready = service.getSnapshot(started.runId);
    if (!ready?.activeEncounter) throw new Error('Expected the selected full-HP target');
    const preview = service.previewEncounterCommit(started.runId);
    expect(preview?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'heal', identity: { kind: 'partyCharacter', id: 'serika' }, amount: 3,
      before: 10, after: 10, delta: 0,
    }));
    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'heal-applied-full-no-op',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter) });
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(10);
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(0);
    expect(committed.lastEncounterCommit).not.toHaveProperty('triggerReceiptVersion');
    expect(committed.lastEncounterCommit).not.toHaveProperty('triggerTrace');
  });

  test('rejects 34 Trigger activations atomically without installing Heal or PlayerCost', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registeredMap = registry.maps.get(GAMEPLAY_B_HEAL_APPLIED_RESOURCE_EXAMPLE_MAP_ID);
    if (!registeredMap) throw new Error('healApplied example Map was not registered');
    const overBudgetMap: GameplayMapDef = {
      ...registeredMap,
      id: 'gameplay-b:map:heal-applied-resource-example-over-budget',
      initialPartyHp: registeredMap.initialPartyHp?.map(row => row.characterId === 'serika'
        ? { ...row, initialHp: 8 }
        : row) ?? [],
      actions: registeredMap.actions?.map(action => action.id === 'encourage'
        ? { ...action, effectProgram: {
          resolve: [
            { op: 'heal', target: 'primary' as const, amount: 1 },
            { op: 'heal', target: 'primary' as const, amount: 1 },
          ],
          triggers: Array.from({ length: 17 }, (_, index) => ({
            id: `focus-on-heal-${index + 1}`,
            event: 'healApplied' as const,
            effect: { op: 'resourceChange' as const, account: 'primaryActor' as const, resourceId: 'focus', delta: 1 },
          })),
        } }
        : action),
    };
    const registryResolver = createRegistryMapContentResolver(registry);
    const resolver = { resolve: (id: string) => id === overBudgetMap.id ? overBudgetMap : registryResolver.resolve(id) };
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(overBudgetMap.id, makeParty(overBudgetMap, registry));
    const entered = service.move(started.runId, 'practice');
    if (!entered.activeEncounter) throw new Error('Expected the over-budget Trigger Encounter');
    service.setAbilityDraft(started.runId, 'encourage', { kind: 'partyCharacter', characterId: 'serika' },
      draftToken(entered.activeEncounter));
    const ready = service.getSnapshot(started.runId);
    if (!ready?.activeEncounter) throw new Error('Expected the over-budget Trigger draft');
    const beforeHp = ready.partyHp.find(row => row.characterId === 'serika')?.currentHp;
    const beforeFocus = ready.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value;
    const beforeCost = ready.playerCost;
    const beforeVersion = ready.commitVersion;
    const beforeReceipt = ready.lastEncounterCommit;
    const readyDraft = draftToken(ready.activeEncounter);

    expect(() => service.commitEncounterRound({ runId: started.runId, requestId: 'heal-trigger-over-budget',
      expectedCommitVersion: ready.commitVersion, draft: readyDraft })).toThrow(/32/);

    const after = service.getSnapshot(started.runId);
    expect(after?.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(beforeHp);
    expect(after?.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(beforeFocus);
    expect(after?.playerCost).toBe(beforeCost);
    expect(after?.commitVersion).toBe(beforeVersion);
    expect(after?.lastEncounterCommit).toEqual(beforeReceipt);
  });
});
