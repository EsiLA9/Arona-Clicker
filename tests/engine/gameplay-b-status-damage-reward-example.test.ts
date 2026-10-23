import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { GAMEPLAY_B_STATUS_DAMAGE_REWARD_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-status-damage-reward-example';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/map/registry-map-content-resolver';
import { Registry } from '../../src/data-services/registry/registry';

function token(encounter: MapRunEncounterSnapshot) {
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

describe('Gameplay B Status actual damage reward author example', () => {
  test('captures the active holder Status at Hit time and restores the canonical v4 Receipt', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_STATUS_DAMAGE_REWARD_EXAMPLE_MAP_ID);
    if (!map) throw new Error('Status damage reward Map was not registered');
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: map.id, mapEntryLabel: '进入 Status 受伤回馈演练',
    }));
    expect(map.statuses?.[0]).toMatchObject({ id: 'steadfast', onDamageTaken: { resourceId: 'focus', delta: 1 } });

    const resolver = createRegistryMapContentResolver(registry);
    const service = new MapRunService(resolver, variantId => registry.characterVariants.get(variantId)?.proto ?? null);
    const party = map.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(row => row.proto === characterId);
      if (!variant) throw new Error(`Missing Variant for ${characterId}`);
      return { characterId, variantId: variant.id };
    });
    const started = service.start(map.id, party);
    const entered = service.move(started.runId, 'practice');
    if (!entered.activeEncounter) throw new Error('Expected active damage reward Encounter');
    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'status-damage-hit',
      expectedCommitVersion: entered.commitVersion, draft: token(entered.activeEncounter) });

    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(6);
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(1);
    expect(committed.lastEncounterCommit).toMatchObject({
      triggerReceiptVersion: 4,
      triggerTrace: [],
      statusExpiryTriggerTrace: [],
      statusDamageTriggerTrace: [{ queueIndex: 1, event: 'statusDamageTaken', actualAppliedAmount: 2,
        holder: { kind: 'partyCharacter', id: 'serika' }, status: { statusId: 'steadfast', stacks: 1 },
        resourceId: 'focus', delta: 1, balanceBefore: 0, balanceAfter: 1 }],
    });
    const damageTrace = committed.lastEncounterCommit!.statusDamageTriggerTrace!;
    expect(Object.isFrozen(damageTrace)).toBe(true);
    expect(Object.isFrozen(damageTrace[0])).toBe(true);
    expect(Object.isFrozen(damageTrace[0]!.status)).toBe(true);
    expect(Object.isFrozen(damageTrace[0]!.status.holder)).toBe(true);
    expect(Object.isFrozen(damageTrace[0]!.status.source)).toBe(true);

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected save checkpoint for Trigger Receipt v4');
    const restored = new MapRunService(resolver, variantId => registry.characterVariants.get(variantId)?.proto ?? null);
    const restoreResult = restored.restoreSaveSnapshot(checkpoint);
    expect(restoreResult).toMatchObject({ status: 'restored', mapId: map.id });
    expect(restored.getSnapshot()?.lastEncounterCommit?.statusDamageTriggerTrace)
      .toEqual(committed.lastEncounterCommit?.statusDamageTriggerTrace);
    const forged = structuredClone(checkpoint) as any;
    forged.run.lastEncounterCommit.statusDamageTriggerTrace[0].delta = 2;
    forged.run.activeEncounter.lastCommit.statusDamageTriggerTrace[0].delta = 2;
    expect(new MapRunService(resolver, variantId => registry.characterVariants.get(variantId)?.proto ?? null)
      .restoreSaveSnapshot(forged)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });

  test('writes an empty v4 Trigger Receipt on a Commit with no damage Hit or matching Status', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const base = registry.maps.get(GAMEPLAY_B_STATUS_DAMAGE_REWARD_EXAMPLE_MAP_ID);
    if (!base) throw new Error('Status damage reward Map was not registered');
    const map: GameplayMapDef = { ...base, id: 'gameplay-b:map:status-damage-empty-receipt',
      nodes: base.nodes.map(node => node.id === 'practice' && node.encounter ? { ...node,
        encounter: { ...node.encounter, participants: [], enemies: node.encounter.enemies?.map(enemy => ({ ...enemy, actions: [] })) } } : node) };
    const service = new MapRunService({ resolve: id => id === map.id ? map : null },
      variantId => registry.characterVariants.get(variantId)?.proto ?? null);
    const party = map.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(row => row.proto === characterId)!;
      return { characterId, variantId: variant.id };
    });
    const started = service.start(map.id, party);
    const entered = service.move(started.runId, 'practice');
    const encounter = entered.activeEncounter!;
    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'status-damage-empty',
      expectedCommitVersion: entered.commitVersion, draft: token(encounter) });
    expect(committed.lastEncounterCommit).toMatchObject({ triggerReceiptVersion: 4,
      triggerTrace: [], statusExpiryTriggerTrace: [], statusDamageTriggerTrace: [] });
    const checkpoint = service.createSaveSnapshot()!;
    const restored = new MapRunService({ resolve: id => id === map.id ? map : null },
      variantId => registry.characterVariants.get(variantId)?.proto ?? null);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', mapId: map.id });
  });

  test('executes exactly 32 holder callbacks and rejects 33 atomically', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const base = registry.maps.get(GAMEPLAY_B_STATUS_DAMAGE_REWARD_EXAMPLE_MAP_ID);
    if (!base) throw new Error('Status damage reward Map was not registered');
    const runCount = (count: number) => {
      const statuses = Array.from({ length: count }, (_, index) => ({ id: `reward-${index}`,
        name: `Reward ${index}`, kind: 'regen' as const, hpPerStack: 1, maxStacks: 1,
        onDamageTaken: { resourceId: 'focus', delta: 1 } }));
      const action = { id: 'apply-many', name: 'Apply many', eligibleCharacterIds: [],
        agility: { base: 9, max: 9 }, target: { kind: 'partyCharacter' as const },
        effectProgram: { resolve: statuses.map(status => ({ op: 'statusApply' as const, target: 'primary' as const,
          statusId: status.id, stacks: 1, durationRounds: 3 })) } };
      const map: GameplayMapDef = { ...base, id: `gameplay-b:map:status-damage-budget-${count}`,
        initialPlayerCost: 1, statuses, actions: [...(base.actions ?? []), action],
        nodes: base.nodes.map(node => node.id === 'practice' && node.encounter ? { ...node,
          encounter: { ...node.encounter, abilityActionIds: ['apply-many'], participants: [] } } : node) };
      const resolver = { resolve: (id: string) => id === map.id ? map : null };
      const service = new MapRunService(resolver, variantId => registry.characterVariants.get(variantId)?.proto ?? null);
      const party = map.partyCharacterIds.map(characterId => {
        const variant = [...registry.characterVariants.values()].find(row => row.proto === characterId)!;
        return { characterId, variantId: variant.id };
      });
      const started = service.start(map.id, party);
      const entered = service.move(started.runId, 'practice');
      if (!entered.activeEncounter) throw new Error('Expected budget Encounter');
      service.setAbilityDraft(started.runId, 'apply-many', { kind: 'partyCharacter', characterId: 'serika' }, token(entered.activeEncounter));
      const before = service.getSnapshot(started.runId)!;
      if (count === 33) {
        expect(() => service.commitEncounterRound({ runId: started.runId, requestId: 'status-damage-budget-33',
          expectedCommitVersion: before.commitVersion, draft: token(before.activeEncounter!) })).toThrow(/activation budget/);
        expect(service.getSnapshot(started.runId)).toEqual(before);
      } else {
        const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'status-damage-budget-32',
          expectedCommitVersion: before.commitVersion, draft: token(before.activeEncounter!) });
        expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(32);
        expect(committed.lastEncounterCommit?.statusDamageTriggerTrace).toHaveLength(32);
        expect(committed.lastEncounterCommit?.statusDamageTriggerTrace?.[31]?.queueIndex).toBe(32);
      }
    };
    runCount(32);
    runCount(33);
  });
});
