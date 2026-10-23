import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { GAMEPLAY_B_DAMAGE_PROTECTION_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-damage-protection-example';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/map/registry-map-content-resolver';
import { Registry } from '../../src/data-services/registry/registry';

function draftToken(encounter: MapRunEncounterSnapshot) {
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

describe('Gameplay B damageProtection author example', () => {
  test('demonstrates a protected first hit, then Shield, actual HP loss, Trigger, and v6 Restore replay', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_DAMAGE_PROTECTION_EXAMPLE_MAP_ID);
    if (!map) throw new Error('damageProtection example Map was not registered');

    expect(map).toMatchObject({
      executionContractId: 'AG-1',
      statuses: [{ id: 'one-hit-ward', kind: 'damageProtection', category: 'beneficial', maxStacks: 1 }],
      actions: [
        { id: 'prepare-ward', effectProgram: { resolve: [
          { op: 'shieldAdd', target: 'primary', amount: 1 },
          { op: 'statusApply', target: 'primary', statusId: 'one-hit-ward', stacks: 1, durationRounds: 1 },
        ] } },
        { id: 'double-training-shot', effectProgram: { resolve: [
          { op: 'damage', target: 'primary', amount: 3, repeat: 2 },
        ], triggers: [{ id: 'guard-on-hit', event: 'damageApplied' }] } },
      ],
    });
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: GAMEPLAY_B_DAMAGE_PROTECTION_EXAMPLE_MAP_ID, mapEntryLabel: '进入一次性受击保护演练',
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
    if (!entered.activeEncounter) throw new Error('Expected active damageProtection example Encounter');
    service.setAbilityDraft(started.runId, 'prepare-ward', { kind: 'partyCharacter', characterId: 'serika' }, draftToken(entered.activeEncounter));

    const ready = service.getSnapshot(started.runId);
    if (!ready?.activeEncounter) throw new Error('Expected a ready damageProtection example Encounter');
    const preview = service.previewEncounterCommit(started.runId);
    expect(preview?.diagnostics).toEqual([]);
    expect(preview?.executionSequence?.map(row => row.sourceKind)).toEqual(['ability', 'enemyAction']);
    expect(preview?.effectTrace?.filter(row => row.op === 'damage')).toMatchObject([
      { identity: { kind: 'partyCharacter', id: 'serika' }, amount: 0, before: 8, after: 8, delta: 0,
        damageProtection: { requestedAmount: 3, blockedAmount: 3,
          statusBefore: { statusId: 'one-hit-ward', stacks: 1 }, statusAfter: null },
        batch: { hitIndex: 0, repeatCount: 2 } },
      { identity: { kind: 'partyCharacter', id: 'serika' }, amount: 3, before: 8, after: 6, delta: -2,
        batch: { hitIndex: 1, repeatCount: 2 } },
    ]);
    expect(preview?.shieldTrace?.filter(row => row.op === 'damage')).toMatchObject([
      { op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' }, shieldBefore: 1,
        absorbed: 1, shieldAfter: 0, remainingDamage: 2, hpBefore: 8, hpAfter: 6 },
    ]);
    expect(preview?.triggerTrace).toMatchObject([{
      queueIndex: 1, event: 'damageApplied', triggerId: 'guard-on-hit',
      target: { kind: 'partyCharacter', id: 'serika' }, requestedAmount: 3, actualAppliedAmount: 2,
    }]);

    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'damage-protection-two-hit-example',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter) });
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(6);
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'guard')?.value).toBe(1);
    expect(committed.activeEncounter).toMatchObject({ shields: {}, statuses: [] });
    expect(committed.lastEncounterCommit).toMatchObject({
      schedulerFormatVersion: 6,
      shieldReceiptVersion: 1,
      statusReceiptVersion: 6,
      plannedShields: {},
      plannedStatuses: [],
      statusTrace: [],
      statusRemoveTrace: [],
      statusConsumeTrace: [],
      statusCategoryRemoveTrace: [],
      triggerReceiptVersion: 1,
      triggerTrace: [{ triggerId: 'guard-on-hit', event: 'damageApplied', actualAppliedAmount: 2 }],
    });
    expect(committed.lastEncounterCommit?.effectTrace).toEqual(preview?.effectTrace);
    const intercepted = committed.lastEncounterCommit?.effectTrace?.find(row => row.op === 'damage');
    if (intercepted?.op !== 'damage' || !intercepted.damageProtection) throw new Error('Expected a deeply frozen damage protection trace');
    expect(Object.isFrozen(intercepted.damageProtection)).toBe(true);
    expect(Object.isFrozen(intercepted.damageProtection.statusBefore)).toBe(true);
    expect(Object.isFrozen(intercepted.damageProtection.statusBefore.holder)).toBe(true);

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a save with the damageProtection Receipt');
    const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
    const restoreResult = restored.restoreSaveSnapshot(checkpoint);
    expect(restoreResult).toMatchObject({ status: 'restored', mapId: map.id });
    expect(restored.getSnapshot()?.lastEncounterCommit?.effectTrace).toEqual(committed.lastEncounterCommit?.effectTrace);

    const tampered = JSON.parse(JSON.stringify(checkpoint));
    for (const receipt of [tampered.run.lastEncounterCommit, tampered.run.activeEncounter.lastCommit]) {
      if (!receipt) continue;
      const tamperedHit = receipt.effectTrace.find((row: any) => row.op === 'damage' && row.damageProtection);
      if (!tamperedHit) throw new Error('Expected a protected hit in the saved effect trace');
      tamperedHit.damageProtection.blockedAmount -= 1;
    }
    const rejected = new MapRunService(resolver, resolveCharacterIdForVariant);
    expect(rejected.restoreSaveSnapshot(tampered)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
    expect(rejected.getSnapshot()).toBeNull();
  });

  test('a still-charged protection Status gets the U26 expiry reward once at round end', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registered = registry.maps.get(GAMEPLAY_B_DAMAGE_PROTECTION_EXAMPLE_MAP_ID);
    if (!registered) throw new Error('damageProtection example Map was not registered');
    const expiryMap = {
      ...registered,
      id: 'gameplay-b:map:damage-protection-expiry-test',
      initialActorResources: [...(registered.initialActorResources ?? []), { characterId: 'shiroko', resourceId: 'guard', value: 0 }],
      statuses: registered.statuses?.map(status => ({ ...status, maxStacks: 2,
        onExpire: { resourceId: 'guard', delta: 1 } })),
      actions: registered.actions?.map(action => action.id === 'prepare-ward' ? {
        ...action,
        effectProgram: { resolve: [
          { op: 'shieldAdd' as const, target: 'primary' as const, amount: 1 },
          { op: 'statusApply' as const, target: 'primary' as const, statusId: 'one-hit-ward', stacks: 2, durationRounds: 1 },
        ] },
      } : action),
      nodes: registered.nodes.map(node => {
        if (node.id !== 'practice' || !node.encounter) return node;
        return { ...node, encounter: { ...node.encounter,
          enemies: [{ id: 'training-robot', initialHp: 20, maxHp: 20, actions: [] }] } };
      }),
    };
    const resolver = { resolve: (id: string) => id === expiryMap.id ? expiryMap : null };
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const party = registered.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(expiryMap.id, party);
    const entered = service.move(started.runId, 'practice');
    if (!entered.activeEncounter) throw new Error('Expected the protection expiry Encounter');
    service.setAbilityDraft(started.runId, 'prepare-ward', { kind: 'partyCharacter', characterId: 'serika' }, draftToken(entered.activeEncounter));
    const roundOne = service.getSnapshot(started.runId)!;
    const applied = service.commitEncounterRound({ runId: started.runId, requestId: 'protection-expiry-apply',
      expectedCommitVersion: roundOne.commitVersion, draft: draftToken(roundOne.activeEncounter!) });
    expect(applied.activeEncounter?.statuses).toMatchObject([{ statusId: 'one-hit-ward', stacks: 2, remainingRounds: 1 }]);

    const roundTwo = service.getSnapshot(started.runId)!;
    const expired = service.commitEncounterRound({ runId: started.runId, requestId: 'protection-expiry-tick',
      expectedCommitVersion: roundTwo.commitVersion, draft: draftToken(roundTwo.activeEncounter!) });
    expect(expired.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'guard')?.value).toBe(1);
    expect(expired.activeEncounter?.statuses).toEqual([]);
    expect(expired.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 6,
      plannedStatuses: [],
      statusTrace: [{ statusKind: 'damageProtection', stacks: 2, hpDelta: 0, removed: true }],
      triggerReceiptVersion: 2,
      statusExpiryTriggerTrace: [{ event: 'statusExpired', status: { stacks: 2 }, resourceId: 'guard', delta: 1 }],
    });
  });
});
