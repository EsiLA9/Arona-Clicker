import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-status-expiry-reward-example';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import type { GameplayMapActionDef, GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import type { GameplayMapEffectStatementDef } from '../../src/data-services/contracts/gameplay-map-effects';
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

function createServiceForMap(registry: Registry, map: GameplayMapDef) {
  const registeredResolver = createRegistryMapContentResolver(registry);
  const resolver = { resolve: (id: string) => id === map.id ? map : registeredResolver.resolve(id) };
  const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
  return new MapRunService(resolver, resolveCharacterIdForVariant);
}

function startPractice(registry: Registry, map: GameplayMapDef) {
  const service = createServiceForMap(registry, map);
  const started = service.start(map.id, makeParty(map, registry));
  const entered = service.move(started.runId, 'practice');
  if (!entered.activeEncounter) throw new Error('Expected active Status expiry Encounter');
  return { service, runId: started.runId, encounter: entered.activeEncounter };
}

function commitCurrentRound(service: MapRunService, runId: string, requestId: string) {
  const current = service.getSnapshot(runId);
  if (!current?.activeEncounter) throw new Error('Expected an active Status expiry Encounter');
  return service.commitEncounterRound({ runId, requestId, expectedCommitVersion: current.commitVersion,
    draft: draftToken(current.activeEncounter) });
}

describe('Gameplay B Status expiry reward author example', () => {
  test('ticks Regen before one holder reward, restores its Receipt, and leaves Round 4 unchanged', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID);
    if (!map) throw new Error('Status expiry reward Map was not registered');
    expect(map.executionContractId).toBe('AG-1');
    expect(map.resumeVersion).toBe(1);
    expect(map.statuses).toEqual([expect.objectContaining({
      id: 'patient-regen', kind: 'regen', hpPerStack: 1, onExpire: { resourceId: 'focus', delta: 1 },
    })]);
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID, mapEntryLabel: '进入 Status 自然到期回馈演练',
    }));

    const resolver = createRegistryMapContentResolver(registry);
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(map.id, makeParty(map, registry));
    const entered = service.move(started.runId, 'practice');
    if (!entered.activeEncounter) throw new Error('Expected active Status expiry Encounter');
    service.setAbilityDraft(started.runId, 'apply-regen', { kind: 'partyCharacter', characterId: 'serika' },
      draftToken(entered.activeEncounter));

    const round1 = commitCurrentRound(service, started.runId, 'status-expiry-r1-apply');
    expect(round1.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(6);
    expect(round1.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(0);
    expect(round1.activeEncounter?.statuses).toMatchObject([{ statusId: 'patient-regen', remainingRounds: 2 }]);
    expect(round1.lastEncounterCommit).not.toHaveProperty('statusExpiryTriggerTrace');

    const round2 = commitCurrentRound(service, started.runId, 'status-expiry-r2-last-one');
    expect(round2.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(7);
    expect(round2.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(0);
    expect(round2.lastEncounterCommit?.statusTrace).toMatchObject([{
      holder: { kind: 'partyCharacter', id: 'serika' }, statusId: 'patient-regen',
      remainingRoundsBefore: 2, remainingRoundsAfter: 1, hpBefore: 6, hpAfter: 7, hpDelta: 1, removed: false,
    }]);
    expect(round2.lastEncounterCommit).not.toHaveProperty('statusExpiryTriggerTrace');

    const round3 = commitCurrentRound(service, started.runId, 'status-expiry-r3-expire');
    expect(round3.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(8);
    expect(round3.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(1);
    expect(round3.activeEncounter?.statuses).toEqual([]);
    expect(round3.lastEncounterCommit).toMatchObject({
      triggerReceiptVersion: 2,
      triggerTrace: [],
      statusExpiryTriggerTrace: [{
        queueIndex: 1,
        event: 'statusExpired',
        statusTraceIndex: 0,
        round: 3,
        status: { holder: { kind: 'partyCharacter', id: 'serika' }, statusId: 'patient-regen',
          source: { kind: 'ability', actionId: 'apply-regen' }, actionId: 'apply-regen',
          appliedRound: 1, stacks: 1, remainingRounds: 1 },
        holder: { kind: 'partyCharacter', id: 'serika' }, resourceId: 'focus', delta: 1,
        balanceBefore: 0, balanceAfter: 1,
      }],
      statusTrace: [{ statusId: 'patient-regen', remainingRoundsBefore: 1, remainingRoundsAfter: 0,
        hpBefore: 7, hpAfter: 8, hpDelta: 1, removed: true }],
    });

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a checkpoint with the Status expiry Receipt v2');
    const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', mapId: map.id });
    expect(restored.getSnapshot()?.lastEncounterCommit?.statusExpiryTriggerTrace)
      .toEqual(round3.lastEncounterCommit?.statusExpiryTriggerTrace);
    const forged = structuredClone(checkpoint) as any;
    forged.run.lastEncounterCommit.statusExpiryTriggerTrace[0].balanceAfter = 2;
    forged.run.activeEncounter.lastCommit.statusExpiryTriggerTrace[0].balanceAfter = 2;
    expect(new MapRunService(resolver, resolveCharacterIdForVariant).restoreSaveSnapshot(forged))
      .toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const round4Preview = restored.previewEncounterCommit(started.runId);
    expect(round4Preview?.statusTrace).toEqual([]);
    expect(round4Preview).not.toHaveProperty('statusExpiryTriggerTrace');
    const round4 = commitCurrentRound(restored, started.runId, 'status-expiry-r4-no-more-tick');
    expect(round4.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(8);
    expect(round4.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(1);
    expect(round4.lastEncounterCommit).not.toHaveProperty('statusExpiryTriggerTrace');
  });

  test('does not reward a Status explicitly removed before roundEnd', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registeredMap = registry.maps.get(GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID);
    if (!registeredMap) throw new Error('Status expiry reward Map was not registered');
    const applyAndRemove: GameplayMapActionDef = {
      id: 'apply-and-remove',
      name: '施加后立即清除',
      eligibleCharacterIds: [],
      target: { kind: 'partyCharacter' },
      effectProgram: { resolve: [
        { op: 'statusApply', target: 'primary', statusId: 'patient-regen', stacks: 1, durationRounds: 2 },
        { op: 'statusRemove', target: 'primary', statusId: 'patient-regen' },
      ] },
    };
    const explicitRemovalMap: GameplayMapDef = {
      ...registeredMap,
      id: 'gameplay-b:map:status-expiry-explicit-remove-test',
      actions: [...(registeredMap.actions ?? []), applyAndRemove],
      nodes: registeredMap.nodes.map(node => node.id === 'practice' && node.encounter
        ? { ...node, encounter: { ...node.encounter, abilityActionIds: ['apply-and-remove'] } }
        : node),
    };
    const registryResolver = createRegistryMapContentResolver(registry);
    const resolver = { resolve: (id: string) => id === explicitRemovalMap.id ? explicitRemovalMap : registryResolver.resolve(id) };
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(explicitRemovalMap.id, makeParty(explicitRemovalMap, registry));
    const entered = service.move(started.runId, 'practice');
    if (!entered.activeEncounter) throw new Error('Expected active explicit Status removal Encounter');
    service.setAbilityDraft(started.runId, 'apply-and-remove', { kind: 'partyCharacter', characterId: 'serika' },
      draftToken(entered.activeEncounter));
    const committed = commitCurrentRound(service, started.runId, 'status-expiry-explicit-remove');
    expect(committed.activeEncounter?.statuses).toEqual([]);
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(6);
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(0);
    expect(committed.lastEncounterCommit).not.toHaveProperty('statusExpiryTriggerTrace');
    expect(committed.lastEncounterCommit).not.toHaveProperty('triggerReceiptVersion');
  });

  test('does not reward Status instances consumed or category-cleansed before roundEnd', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registeredMap = registry.maps.get(GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID);
    if (!registeredMap) throw new Error('Status expiry reward Map was not registered');
    const clearModes: Array<{ readonly id: string; readonly statement: GameplayMapEffectStatementDef }> = [
      { id: 'consume', statement: { op: 'statusConsume', target: 'primary', statusId: 'patient-regen', stacks: 1 } },
      { id: 'cleanse', statement: { op: 'statusRemoveCategory', target: 'primary', category: 'beneficial' } },
    ];

    for (const mode of clearModes) {
      const action: GameplayMapActionDef = {
        id: `apply-and-${mode.id}`, name: `Apply and ${mode.id}`, eligibleCharacterIds: [],
        target: { kind: 'partyCharacter' },
        effectProgram: { resolve: [
          { op: 'statusApply', target: 'primary', statusId: 'patient-regen', stacks: 1, durationRounds: 2 },
          mode.statement,
        ] },
      };
      const map: GameplayMapDef = {
        ...registeredMap,
        id: `gameplay-b:map:status-expiry-${mode.id}-test`,
        actions: [...(registeredMap.actions ?? []), action],
        nodes: registeredMap.nodes.map(node => node.id === 'practice' && node.encounter
          ? { ...node, encounter: { ...node.encounter, abilityActionIds: [action.id] } } : node),
      };
      const { service, runId, encounter } = startPractice(registry, map);
      service.setAbilityDraft(runId, action.id, { kind: 'partyCharacter', characterId: 'serika' }, draftToken(encounter));
      const committed = commitCurrentRound(service, runId, `status-expiry-${mode.id}-clear`);
      expect(committed.activeEncounter?.statuses).toEqual([]);
      expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(0);
      expect(committed.lastEncounterCommit).not.toHaveProperty('statusExpiryTriggerTrace');
      expect(committed.lastEncounterCommit).not.toHaveProperty('triggerReceiptVersion');
    }
  });

  test('places Action Trigger rows before expiry rows and shares the 32-activation budget atomically', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registeredMap = registry.maps.get(GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID);
    if (!registeredMap) throw new Error('Status expiry reward Map was not registered');

    const runWithTriggerCount = (triggerCount: number) => {
      const applyAction: GameplayMapActionDef = {
        ...registeredMap.actions!.find(action => action.id === 'apply-regen')!,
        effectProgram: { resolve: [{
          op: 'statusApply', target: 'primary', statusId: 'patient-regen', stacks: 1, durationRounds: 1,
        }] },
      };
      const healAction: GameplayMapActionDef = {
        id: `heal-with-${triggerCount}-triggers`, name: 'Heal and trigger', eligibleCharacterIds: [],
        agility: { base: 10, max: 10 }, target: { kind: 'partyCharacter' },
        effectProgram: {
          resolve: [{ op: 'heal', target: 'primary', amount: 1 }],
          triggers: Array.from({ length: triggerCount }, (_, index) => ({
            id: `focus-${index + 1}`, event: 'healApplied' as const,
            effect: { op: 'resourceChange' as const, account: 'primaryActor' as const, resourceId: 'focus', delta: 1 },
          })),
        },
      };
      const map: GameplayMapDef = {
        ...registeredMap,
        id: `gameplay-b:map:status-expiry-trigger-budget-${triggerCount}`,
        initialPlayerCost: 4,
        actions: [...(registeredMap.actions ?? []).filter(action => action.id !== applyAction.id), applyAction, healAction],
        nodes: registeredMap.nodes.map(node => node.id === 'practice' && node.encounter
          ? { ...node, encounter: { ...node.encounter, abilityActionIds: [...(node.encounter.abilityActionIds ?? []), healAction.id] } }
          : node),
      };
      const { service, runId, encounter } = startPractice(registry, map);
      service.setAbilityDraft(runId, 'apply-regen', { kind: 'partyCharacter', characterId: 'serika' }, draftToken(encounter));
      commitCurrentRound(service, runId, `status-expiry-budget-${triggerCount}-apply`);
      const next = service.getSnapshot(runId)?.activeEncounter;
      if (!next) throw new Error('Expected the second Status expiry round');
      service.setAbilityDraft(runId, healAction.id, { kind: 'partyCharacter', characterId: 'serika' }, draftToken(next));
      return { service, runId, next };
    };

    const withinBudget = runWithTriggerCount(31);
    const committed = commitCurrentRound(withinBudget.service, withinBudget.runId, 'status-expiry-budget-31-commit');
    expect(committed.lastEncounterCommit?.triggerTrace).toHaveLength(31);
    expect(committed.lastEncounterCommit?.triggerTrace?.[0]?.queueIndex).toBe(1);
    expect(committed.lastEncounterCommit?.triggerTrace?.[30]?.queueIndex).toBe(31);
    expect(committed.lastEncounterCommit?.statusExpiryTriggerTrace?.[0]).toMatchObject({
      queueIndex: 32, event: 'statusExpired', balanceBefore: 31, balanceAfter: 32,
    });
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(32);

    const overBudget = runWithTriggerCount(32);
    expect(() => commitCurrentRound(overBudget.service, overBudget.runId, 'status-expiry-budget-32-reject'))
      .toThrow(/Trigger activation budget exceeds 32 after Status expiry/);
    const unchanged = overBudget.service.getSnapshot(overBudget.runId);
    expect(unchanged?.activeEncounter?.round).toBe(2);
    expect(unchanged?.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(6);
    expect(unchanged?.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(0);
  });

  test('rewards a holder even when its final Burn tick downs it', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registeredMap = registry.maps.get(GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID);
    if (!registeredMap) throw new Error('Status expiry reward Map was not registered');
    const map: GameplayMapDef = {
      ...registeredMap,
      id: 'gameplay-b:map:status-expiry-downed-holder',
      actions: registeredMap.actions?.map(action => action.id === 'apply-regen' ? {
        ...action,
        effectProgram: { resolve: [{
          op: 'statusApply' as const, target: 'primary' as const, statusId: 'patient-regen', stacks: 1, durationRounds: 1,
        }] },
      } : action),
      initialPartyHp: [
        { characterId: 'shiroko', initialHp: 10, maxHp: 10 },
        { characterId: 'serika', initialHp: 1, maxHp: 10 },
      ],
      statuses: [{
        id: 'patient-regen', name: 'Burning patience', category: 'harmful', kind: 'burn', hpPerStack: 1,
        maxStacks: 1, onExpire: { resourceId: 'focus', delta: 1 },
      }],
    };
    const { service, runId, encounter } = startPractice(registry, map);
    service.setAbilityDraft(runId, 'apply-regen', { kind: 'partyCharacter', characterId: 'serika' }, draftToken(encounter));
    commitCurrentRound(service, runId, 'status-expiry-downed-apply');
    const committed = commitCurrentRound(service, runId, 'status-expiry-downed-tick');
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(0);
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(1);
    expect(committed.lastEncounterCommit?.statusTrace).toMatchObject([{
      holder: { kind: 'partyCharacter', id: 'serika' }, hpBefore: 1, hpAfter: 0, removed: true,
    }]);
    expect(committed.lastEncounterCommit?.statusExpiryTriggerTrace?.[0]).toMatchObject({
      holder: { kind: 'partyCharacter', id: 'serika' }, resourceId: 'focus', balanceBefore: 0, balanceAfter: 1,
    });
  });

  test('natural damageReduction expiry rewards its holder without changing HP or Status Receipt versions', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registeredMap = registry.maps.get(GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID);
    if (!registeredMap) throw new Error('Status expiry reward Map was not registered');
    const map: GameplayMapDef = {
      ...registeredMap,
      id: 'gameplay-b:map:status-expiry-damage-reduction',
      actions: registeredMap.actions?.map(action => action.id === 'apply-regen' ? {
        ...action,
        effectProgram: { resolve: [{
          op: 'statusApply' as const, target: 'primary' as const, statusId: 'patient-regen', stacks: 1, durationRounds: 1,
        }] },
      } : action),
      statuses: [{
        id: 'patient-regen', name: 'Brief Guard', category: 'beneficial', kind: 'damageReduction',
        damageReductionPerStack: 1, maxStacks: 1, onExpire: { resourceId: 'focus', delta: 1 },
      }],
    };
    const { service, runId, encounter } = startPractice(registry, map);
    service.setAbilityDraft(runId, 'apply-regen', { kind: 'partyCharacter', characterId: 'serika' }, draftToken(encounter));
    commitCurrentRound(service, runId, 'status-expiry-reduction-apply');
    const committed = commitCurrentRound(service, runId, 'status-expiry-reduction-expire');
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(6);
    expect(committed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(1);
    expect(committed.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 5,
      statusTrace: [{ statusKind: 'damageReduction', hpBefore: 6, hpAfter: 6, hpDelta: 0, removed: true }],
      triggerReceiptVersion: 2,
      statusExpiryTriggerTrace: [{ event: 'statusExpired', resourceId: 'focus', balanceBefore: 0, balanceAfter: 1 }],
    });
  });

  test('refreshing an active Status does not count as natural expiry', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID);
    if (!map) throw new Error('Status expiry reward Map was not registered');
    const refreshMap = { ...map, id: 'gameplay-b:map:status-expiry-refresh-test', initialPlayerCost: 4 };
    const { service, runId, encounter } = startPractice(registry, refreshMap);
    service.setAbilityDraft(runId, 'apply-regen', { kind: 'partyCharacter', characterId: 'serika' }, draftToken(encounter));
    commitCurrentRound(service, runId, 'status-expiry-refresh-first-apply');
    const next = service.getSnapshot(runId)?.activeEncounter;
    if (!next) throw new Error('Expected the Status refresh round');
    service.setAbilityDraft(runId, 'apply-regen', { kind: 'partyCharacter', characterId: 'serika' }, draftToken(next));
    const refreshed = commitCurrentRound(service, runId, 'status-expiry-refresh-again');
    expect(refreshed.activeEncounter?.statuses).toMatchObject([{ statusId: 'patient-regen', remainingRounds: 1 }]);
    expect(refreshed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(7);
    expect(refreshed.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(0);
    expect(refreshed.lastEncounterCommit).not.toHaveProperty('statusExpiryTriggerTrace');
    expect(refreshed.lastEncounterCommit).not.toHaveProperty('triggerReceiptVersion');
  });

  test('skips expiry rewards when an earlier source ends the Encounter before roundEnd', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registeredMap = registry.maps.get(GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID);
    if (!registeredMap) throw new Error('Status expiry reward Map was not registered');
    const applyAction: GameplayMapActionDef = {
      ...registeredMap.actions!.find(action => action.id === 'apply-regen')!,
      effectProgram: { resolve: [{
        op: 'statusApply', target: 'primary', statusId: 'patient-regen', stacks: 1, durationRounds: 1,
      }] },
    };
    const finisher: GameplayMapActionDef = {
      id: 'finish-round', name: 'Finish the Encounter', eligibleCharacterIds: [],
      target: { kind: 'enemy' },
      effectProgram: { resolve: [{ op: 'damage', target: 'primary', amount: 1 }] },
    };
    const map: GameplayMapDef = {
      ...registeredMap,
      id: 'gameplay-b:map:status-expiry-terminal-skip',
      initialPlayerCost: 4,
      actions: [...(registeredMap.actions ?? []).filter(action => action.id !== applyAction.id), applyAction, finisher],
      nodes: registeredMap.nodes.map(node => node.id === 'practice' && node.encounter
        ? { ...node, encounter: {
          ...node.encounter,
          enemies: [{ id: 'training-target', initialHp: 1, maxHp: 5 }],
          abilityActionIds: [applyAction.id, finisher.id],
        } } : node),
    };
    const { service, runId, encounter } = startPractice(registry, map);
    service.setAbilityDraft(runId, applyAction.id, { kind: 'partyCharacter', characterId: 'serika' }, draftToken(encounter));
    const first = commitCurrentRound(service, runId, 'status-expiry-terminal-apply');
    expect(first.activeEncounter?.statuses).toMatchObject([{ statusId: 'patient-regen', remainingRounds: 1 }]);
    const next = first.activeEncounter;
    if (!next) throw new Error('Expected the second terminal-skip round');
    service.setAbilityDraft(runId, finisher.id, { kind: 'enemy', enemyId: 'training-target' }, draftToken(next));
    const terminal = commitCurrentRound(service, runId, 'status-expiry-terminal-finish');
    expect(terminal.actorResources.find(row => row.characterId === 'serika' && row.resourceId === 'focus')?.value).toBe(0);
    expect(terminal.lastEncounterCommit?.schedulerTerminal).toMatchObject({ outcome: 'victory', checkpoint: 'afterSource' });
    expect(terminal.lastEncounterCommit?.statusTrace).toEqual([]);
    expect(terminal.lastEncounterCommit).not.toHaveProperty('statusExpiryTriggerTrace');
  });

  test('credits the Encounter-local Enemy Actor balance when an Enemy-owned Status expires', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const registeredMap = registry.maps.get(GAMEPLAY_B_STATUS_EXPIRY_REWARD_EXAMPLE_MAP_ID);
    if (!registeredMap) throw new Error('Status expiry reward Map was not registered');
    const enemyStatusAction: GameplayMapActionDef = {
      id: 'enemy-apply-expiring-regen', name: 'Prepare own recovery', eligibleCharacterIds: [],
      target: { kind: 'partyCharacter' },
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      effectProgram: { resolve: [{
        op: 'statusApply', target: 'source', statusId: 'patient-regen', stacks: 1, durationRounds: 1,
      }] },
    };
    const map: GameplayMapDef = {
      ...registeredMap,
      id: 'gameplay-b:map:status-expiry-enemy-holder',
      actions: [...(registeredMap.actions ?? []), enemyStatusAction],
      nodes: registeredMap.nodes.map(node => node.id === 'practice' && node.encounter
        ? { ...node, encounter: { ...node.encounter, enemies: [{
          id: 'training-target', initialHp: 5, maxHp: 5,
          initialResources: [{ resourceId: 'focus', value: 1 }],
          actions: [{ actionId: enemyStatusAction.id, tendencyWeight: 1 }],
        }] } } : node),
    };
    const { service, runId } = startPractice(registry, map);
    const first = commitCurrentRound(service, runId, 'status-expiry-enemy-apply');
    expect(first.activeEncounter?.enemyActorResources).toContainEqual({ enemyId: 'training-target', resourceId: 'focus', value: 0 });
    const committed = commitCurrentRound(service, runId, 'status-expiry-enemy-expire');
    expect(committed.activeEncounter?.enemyActorResources).toContainEqual({ enemyId: 'training-target', resourceId: 'focus', value: 1 });
    expect(committed.lastEncounterCommit?.statusExpiryTriggerTrace?.[0]).toMatchObject({
      holder: { kind: 'enemy', id: 'training-target' }, resourceId: 'focus', balanceBefore: 0, balanceAfter: 1,
    });
  });
});
