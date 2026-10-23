import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { GAMEPLAY_B_ENEMY_DEFEATED_REWARD_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-enemy-defeated-reward-example';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/map/registry-map-content-resolver';
import { Registry } from '../../src/data-services/registry/registry';

function draftToken(encounter: MapRunEncounterSnapshot) {
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

describe('Gameplay B enemyDefeated resource author example', () => {
  test('rewards the Party source after a lethal direct hit and replays the distinct recipient', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_ENEMY_DEFEATED_REWARD_EXAMPLE_MAP_ID);
    if (!map) throw new Error('Enemy defeated reward example Map was not registered');
    expect(map.executionContractId).toBe('AG-1');
    expect(map.resumeVersion).toBe(1);
    expect(map.actions?.find(action => action.id === 'finish-training-target')?.effectProgram).toMatchObject({
      resolve: [{ op: 'damage', target: 'primary', amount: 3 }],
      triggers: [{ id: 'ammo-on-defeat', event: 'enemyDefeated',
        effect: { op: 'resourceChange', account: 'sourceActor', resourceId: 'ammo', delta: 1 } }],
    });
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: GAMEPLAY_B_ENEMY_DEFEATED_REWARD_EXAMPLE_MAP_ID, mapEntryLabel: '进入单体击杀回馈演练',
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
    service.move(started.runId, 'practice');
    const ready = service.getSnapshot(started.runId);
    if (!ready?.activeEncounter) throw new Error('Expected a ready enemy defeated reward Encounter');
    const preview = service.previewEncounterCommit(started.runId);
    expect(preview?.diagnostics).toEqual([]);
    expect(preview?.triggerTrace).toMatchObject([{
      event: 'enemyDefeated', triggerId: 'ammo-on-defeat',
      target: { kind: 'enemy', id: 'training-target' },
      rewardRecipient: { kind: 'partyCharacter', id: 'shiroko' },
      requestedAmount: 3, actualAppliedAmount: 3,
    }]);
    expect(preview?.executionSequence?.findIndex(row => row.actionId === 'finish-training-target'))
      .toBeLessThan(preview?.executionSequence?.findIndex(row => row.actionId === 'observe-ammo') ?? -1);
    expect(preview?.effectTrace).toContainEqual(expect.objectContaining({
      source: expect.objectContaining({ kind: 'enemy', id: 'observer' }), op: 'when', result: true,
    }));

    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'enemy-defeated-reward-once',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter) });
    expect(committed.actorResources.find(row => row.characterId === 'shiroko' && row.resourceId === 'ammo')?.value).toBe(1);
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'ammo')?.value).toBe(0);
    expect(committed.partyHp.find(row => row.characterId === 'shiroko')?.currentHp).toBe(8);
    expect(committed.activeEncounter?.enemies.find(row => row.enemyId === 'training-target')?.currentHp).toBe(0);
    expect(committed.lastEncounterCommit).toMatchObject({
      triggerReceiptVersion: 3,
      statusExpiryTriggerTrace: [],
      triggerTrace: [{
        queueIndex: 1, event: 'enemyDefeated', triggerId: 'ammo-on-defeat',
        target: { kind: 'enemy', id: 'training-target' },
        rewardRecipient: { kind: 'partyCharacter', id: 'shiroko' },
        requestedAmount: 3, actualAppliedAmount: 3, resourceId: 'ammo', delta: 1,
      }],
    });

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a checkpoint with Trigger Receipt v3');
    const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', mapId: map.id });
    expect(restored.getSnapshot()?.lastEncounterCommit?.triggerTrace)
      .toEqual(committed.lastEncounterCommit?.triggerTrace);

    const forged = structuredClone(checkpoint) as any;
    forged.run.lastEncounterCommit.triggerTrace[0].rewardRecipient.id = 'serika';
    forged.run.activeEncounter.lastCommit.triggerTrace[0].rewardRecipient.id = 'serika';
    expect(new MapRunService(resolver, resolveCharacterIdForVariant).restoreSaveSnapshot(forged))
      .toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });

  test('Trigger Receipt v3 retains natural Status expiry feedback in the same Commit', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registered = registry.maps.get(GAMEPLAY_B_ENEMY_DEFEATED_REWARD_EXAMPLE_MAP_ID);
    if (!registered) throw new Error('Enemy defeated reward example Map was not registered');
    const baseResolver = createRegistryMapContentResolver(registry);
    const applyStatusAction = {
      id: 'apply-expiry-status', name: '准备恢复', description: '', eligibleCharacterIds: ['serika'],
      agility: { base: 30, max: 30 }, target: { kind: 'self' },
      effectProgram: { resolve: [{
        op: 'when', condition: { kind: 'flag', flagId: 'expiryGranted', value: false },
        then: [
          { op: 'statusApply', target: 'primary', statusId: 'one-round-regen', stacks: 1, durationRounds: 1 },
          { op: 'flagSet', flagId: 'expiryGranted', value: true },
        ],
      }] },
    };
    const mapWithExpiry = {
      ...registered,
      resumeVersion: 2,
      initialActorResources: [...(registered.initialActorResources ?? []),
        { characterId: 'serika', resourceId: 'focus', value: 0 }],
      statuses: [{ id: 'one-round-regen', name: '一次恢复', description: '', category: 'beneficial',
        kind: 'regen', hpPerStack: 1, maxStacks: 1, onExpire: { resourceId: 'focus', delta: 1 } }],
      actions: [...(registered.actions ?? []), applyStatusAction],
      nodes: registered.nodes.map(node => node.id !== 'practice' || !node.encounter ? node : {
        ...node,
        encounter: {
          ...node.encounter,
          locals: { flags: [{ id: 'expiryGranted', initial: false }] },
          enemies: node.encounter.enemies?.map(enemy => enemy.id === 'training-target'
            ? { ...enemy, initialHp: 6, maxHp: 6 } : enemy),
          participants: node.encounter.participants?.map(participant => participant.characterId !== 'serika'
            ? participant : { ...participant, actions: [{ actionId: 'apply-expiry-status', tendencyWeight: 1 }] }),
        },
      }),
    } as typeof registered;
    const resolver = { resolve: (mapId: string) => mapId === mapWithExpiry.id ? mapWithExpiry : baseResolver.resolve(mapId) };
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const party = mapWithExpiry.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(mapWithExpiry.id, party);
    service.move(started.runId, 'practice');

    for (const [roundIndex, requestId] of ['defeat-with-expiring-status-r1', 'defeat-with-expiring-status-r2'].entries()) {
      const ready = service.getSnapshot(started.runId);
      if (!ready?.activeEncounter) throw new Error(`Expected active Encounter before round ${roundIndex + 1}`);
      const result = service.commitEncounterRound({ runId: started.runId, requestId,
        expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter) });
      if (roundIndex === 0) {
        expect(result.lastEncounterCommit).not.toHaveProperty('triggerReceiptVersion');
        expect(result.activeEncounter?.statuses).toMatchObject([{ statusId: 'one-round-regen', remainingRounds: 1 }]);
      } else {
        expect(result.actorResources.find(row => row.characterId === 'shiroko' && row.resourceId === 'ammo')?.value).toBe(1);
        expect(result.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(1);
        expect(result.lastEncounterCommit).toMatchObject({
          triggerReceiptVersion: 3,
          triggerTrace: [{ event: 'enemyDefeated', queueIndex: 1 }],
          statusExpiryTriggerTrace: [{ event: 'statusExpired', queueIndex: 2, holder: { kind: 'partyCharacter', id: 'serika' } }],
        });
        const checkpoint = service.createSaveSnapshot();
        if (!checkpoint) throw new Error('Expected a checkpoint with mixed Trigger Receipt v3');
        const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
        expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', mapId: mapWithExpiry.id });
      }
    }
  });
});
