import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { GAMEPLAY_B_MAP_SPOT_ID, gameplayBCardModifierExampleMap, gameplayBMapDatapack, gameplayBShieldExampleMap } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { GAMEPLAY_B_STATUS_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-status-example';
import { GAMEPLAY_B_REVIVE_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-revive-example';
import { GAMEPLAY_B_DAMAGE_REDUCTION_EXAMPLE_MAP_ID } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-damage-reduction-example';
import type { MapRunEncounterSnapshot } from '../../src/arona-clicker/contracts/map/map-run';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/map/registry-map-content-resolver';
import { Registry } from '../../src/data-services/registry/registry';

function draftToken(encounter: MapRunEncounterSnapshot) {
  return { nodeId: encounter.nodeId, round: encounter.round, draftVersion: encounter.draftVersion };
}

function prepareAction(service: MapRunService, runId: string, actionId: string) {
  const before = service.getSnapshot(runId);
  if (!before?.activeEncounter) throw new Error('Expected an active status example Encounter');
  const preview = service.previewEncounterCommit(runId);
  const prepared = preview?.settlements?.find(row => row.characterId === 'shiroko')?.actionId;
  if (prepared !== actionId) {
    service.swapPreparedAction(runId, 'shiroko', actionId, draftToken(before.activeEncounter));
  }
  const selected = service.getSnapshot(runId);
  if (!selected?.activeEncounter) throw new Error('Expected a selected status example Action');
  service.setPreparedEnemyTarget(runId, 'shiroko', 'training-target', draftToken(selected.activeEncounter));
}

function commitAction(service: MapRunService, runId: string, actionId: string, requestId: string) {
  prepareAction(service, runId, actionId);
  const current = service.getSnapshot(runId);
  if (!current?.activeEncounter) throw new Error('Expected a ready status example Encounter');
  return service.commitEncounterRound({
    runId,
    requestId,
    expectedCommitVersion: current.commitVersion,
    draft: draftToken(current.activeEncounter),
  });
}

function prepareShieldAction(service: MapRunService, runId: string, actionId: string) {
  const before = service.getSnapshot(runId);
  if (!before?.activeEncounter) throw new Error('Expected an active Shield example Encounter');
  const preview = service.previewEncounterCommit(runId);
  const prepared = preview?.settlements?.find(row => row.characterId === 'shiroko')?.actionId;
  if (prepared !== actionId) {
    service.swapPreparedAction(runId, 'shiroko', actionId, draftToken(before.activeEncounter));
  }
  const selected = service.getSnapshot(runId);
  if (!selected?.activeEncounter) throw new Error('Expected a selected Shield example Action');
  if (actionId === 'grant-shield') {
    service.setPreparedTarget(runId, 'shiroko', 'serika', draftToken(selected.activeEncounter));
  }
}

function commitShieldAction(service: MapRunService, runId: string, actionId: string, requestId: string) {
  prepareShieldAction(service, runId, actionId);
  const current = service.getSnapshot(runId);
  if (!current?.activeEncounter) throw new Error('Expected a ready Shield example Encounter');
  return service.commitEncounterRound({ runId, requestId, expectedCommitVersion: current.commitVersion,
    draft: draftToken(current.activeEncounter) });
}

describe('Gameplay B Encounter Status author example', () => {
  test('registers an enterable AG-1 Map with categorized Status and apply, consume, remove, and category-cleanse Actions', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);

    const map = registry.maps.get(GAMEPLAY_B_STATUS_EXAMPLE_MAP_ID);
    expect(map).toBeDefined();
    expect(map?.executionContractId).toBe('AG-1');
    expect(map?.resumeVersion).toBe(4);
    expect(map?.statuses).toEqual([{
      id: 'burn', name: '燃烧', description: '回合末对持有者造成 HP 伤害。',
      kind: 'burn', hpPerStack: 1, maxStacks: 3, category: 'harmful',
    }, {
      id: 'regen', name: '再生', description: '回合末恢复持有者 HP。',
      kind: 'regen', hpPerStack: 1, maxStacks: 3, category: 'beneficial',
    }]);
    expect(map?.actions?.find(action => action.id === 'apply-burn-and-regen')?.effectProgram?.resolve).toEqual([
      { op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 1, durationRounds: 2 },
      { op: 'statusApply', target: 'primary', statusId: 'regen', stacks: 1, durationRounds: 2 },
    ]);
    expect(map?.actions?.find(action => action.id === 'remove-harmful')?.effectProgram?.resolve).toEqual([
      { op: 'statusRemoveCategory', target: 'primary', category: 'harmful' },
    ]);
    expect(map?.actions?.find(action => action.id === 'apply-burn')?.effectProgram?.resolve).toContainEqual({
      op: 'statusApply', target: 'primary', statusId: 'burn', stacks: 2, durationRounds: 2,
    });
    expect(map?.actions?.find(action => action.id === 'consume-burn')?.effectProgram?.resolve).toContainEqual({
      op: 'statusConsume', target: 'primary', statusId: 'burn', stacks: 1,
    });
    expect(map?.actions?.find(action => action.id === 'remove-burn')?.effectProgram?.resolve).toContainEqual({
      op: 'statusRemove', target: 'primary', statusId: 'burn',
    });
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: GAMEPLAY_B_STATUS_EXAMPLE_MAP_ID, mapEntryLabel: '进入状态原语演练',
    }));

    const resolver = createRegistryMapContentResolver(registry);
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const party = map!.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });

    const started = service.start(map!.id, party);
    const entered = service.move(started.runId, 'burn-test');
    expect(entered.activeEncounter?.nodeId).toBe('burn-test');
    expect(entered.activeEncounter?.enemies).toEqual([{ enemyId: 'training-target', currentHp: 8 }]);
    expect(entered.activeEncounter?.hands.find(hand => hand.characterId === 'shiroko')?.actionIds).toContain('apply-burn');
    expect(entered.activeEncounter?.hands.find(hand => hand.characterId === 'shiroko')?.actionIds).toContain('consume-burn');
    expect(entered.activeEncounter?.hands.find(hand => hand.characterId === 'shiroko')?.actionIds).toContain('remove-burn');
    expect(map?.nodes?.find(node => node.id === 'category-test')?.encounter?.participants?.[0]?.actions.map(row => row.actionId))
      .toEqual(['apply-burn-and-regen', 'remove-harmful']);
  });

  test('applies two stacks, consumes one on the next round, then clears the remainder; no match is a no-op', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_STATUS_EXAMPLE_MAP_ID);
    if (!map) throw new Error('Status example Map was not registered');
    const resolver = createRegistryMapContentResolver(registry);
    const service = new MapRunService(resolver,
      variantId => registry.characterVariants.get(variantId)?.proto ?? null);
    const party = map.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const started = service.start(map.id, party);
    service.move(started.runId, 'burn-test');

    const applied = commitAction(service, started.runId, 'apply-burn', 'status-example-apply');
    expect(applied.lastEncounterCommit).toMatchObject({ schedulerFormatVersion: 5 });
    expect(applied.lastEncounterCommit).not.toHaveProperty('shieldReceiptVersion');
    expect(applied.lastEncounterCommit).toMatchObject({ statusReceiptVersion: 4, statusConsumeTrace: [], statusCategoryRemoveTrace: [] });
    expect(applied.activeEncounter?.statuses).toMatchObject([{
      holder: { kind: 'enemy', id: 'training-target' },
      statusId: 'burn',
      source: { kind: 'partyCharacter', id: 'shiroko' },
      actionId: 'apply-burn',
      stacks: 2,
      remainingRounds: 2,
    }]);

    const consumed = commitAction(service, started.runId, 'consume-burn', 'status-example-consume');
    expect(consumed.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 4,
      statusConsumeTrace: [{
        sourceKey: expect.any(String),
        actionId: 'consume-burn',
        path: 'actions.consume-burn.effectProgram.resolve[0]',
        source: { kind: 'partyCharacter', id: 'shiroko' },
        mode: 'program',
        identity: { kind: 'enemy', id: 'training-target' },
        statusId: 'burn',
        requestedStacks: 1,
        consumedStacks: 1,
        unmetStacks: 0,
        changes: [{
          statusIndexBefore: 0,
          statusBefore: {
            holder: { kind: 'enemy', id: 'training-target' },
            statusId: 'burn', source: { kind: 'partyCharacter', id: 'shiroko' }, actionId: 'apply-burn',
            appliedRound: 1, lastTriggeredRound: null, stacks: 2, remainingRounds: 2,
          },
          consumedStacks: 1,
          statusAfter: {
            holder: { kind: 'enemy', id: 'training-target' },
            statusId: 'burn', source: { kind: 'partyCharacter', id: 'shiroko' }, actionId: 'apply-burn',
            appliedRound: 1, lastTriggeredRound: null, stacks: 1, remainingRounds: 2,
          },
        }],
      }],
      statusCategoryRemoveTrace: [],
    });
    expect(consumed.lastEncounterCommit?.plannedStatuses).toMatchObject([{
      stacks: 1, remainingRounds: 1, lastTriggeredRound: 2,
    }]);
    expect(consumed.activeEncounter?.statuses).toMatchObject([{
      holder: { kind: 'enemy', id: 'training-target' }, statusId: 'burn', stacks: 1,
      appliedRound: 1, lastTriggeredRound: 2, remainingRounds: 1,
    }]);

    const cleared = commitAction(service, started.runId, 'remove-burn', 'status-example-remove');
    expect(cleared.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 4,
      statusConsumeTrace: [],
      statusCategoryRemoveTrace: [],
      statusRemoveTrace: [{
        identity: { kind: 'enemy', id: 'training-target' },
        statusId: 'burn',
        removed: [{ status: { actionId: 'apply-burn', statusId: 'burn', stacks: 1 } }],
      }],
      plannedStatuses: [],
    });
    expect(cleared.activeEncounter?.statuses).toEqual([]);

    const noOpService = new MapRunService(resolver,
      variantId => registry.characterVariants.get(variantId)?.proto ?? null);
    const noOpRun = noOpService.start(map.id, party);
    noOpService.move(noOpRun.runId, 'burn-test');
    const noOp = commitAction(noOpService, noOpRun.runId, 'remove-burn', 'status-example-remove-no-op');
    expect(noOp.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 4,
      statusConsumeTrace: [],
      statusCategoryRemoveTrace: [],
      statusRemoveTrace: [{ identity: { kind: 'enemy', id: 'training-target' }, statusId: 'burn', removed: [] }],
      plannedStatuses: [],
    });
  });

  test('removes harmful Status from a holder with burn and regen while preserving beneficial regen', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_STATUS_EXAMPLE_MAP_ID);
    if (!map) throw new Error('Status example Map was not registered');
    const resolver = createRegistryMapContentResolver(registry);
    const service = new MapRunService(resolver,
      variantId => registry.characterVariants.get(variantId)?.proto ?? null);
    const party = map.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const started = service.start(map.id, party);
    service.move(started.runId, 'category-test');

    const applied = commitAction(service, started.runId, 'apply-burn-and-regen', 'status-example-apply-both');
    expect(applied.activeEncounter?.statuses).toMatchObject([
      { holder: { kind: 'enemy', id: 'training-target' }, statusId: 'burn', stacks: 1 },
      { holder: { kind: 'enemy', id: 'training-target' }, statusId: 'regen', stacks: 1 },
    ]);

    const cleansed = commitAction(service, started.runId, 'remove-harmful', 'status-example-remove-harmful');
    expect(cleansed.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 4,
      statusCategoryRemoveTrace: [{
        actionId: 'remove-harmful',
        path: 'actions.remove-harmful.effectProgram.resolve[0]',
        source: { kind: 'partyCharacter', id: 'shiroko' },
        mode: 'program',
        identity: { kind: 'enemy', id: 'training-target' },
        category: 'harmful',
        removed: [{ statusIndexBefore: 0, status: { statusId: 'burn', actionId: 'apply-burn-and-regen' } }],
      }],
      plannedStatuses: [{ statusId: 'regen', stacks: 1, remainingRounds: 1, lastTriggeredRound: 2 }],
    });
    expect(cleansed.activeEncounter?.statuses).toMatchObject([{
      holder: { kind: 'enemy', id: 'training-target' }, statusId: 'regen', stacks: 1,
      remainingRounds: 1, lastTriggeredRound: 2,
    }]);
  });
});

describe('Gameplay B Shield author example', () => {
  test('registers an enterable AG-1 Map at resume version 1 with a costed Party Shield Action', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(gameplayBShieldExampleMap.id);
    expect(map).toBeDefined();
    expect(map?.executionContractId).toBe('AG-1');
    expect(map?.resumeVersion).toBe(1);
    expect(map?.actions?.find(action => action.id === 'grant-shield')).toMatchObject({
      costs: [{ scope: 'actor', resourceId: 'focus', amount: 1 }],
      effectProgram: { resolve: [{ op: 'shieldAdd', target: 'primary', amount: 3 }] },
    });
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: gameplayBShieldExampleMap.id, mapEntryLabel: '进入友方护盾演练',
    }));
  });

  test('charges Focus, absorbs the first hit, and replays the remaining Shield into round two', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(gameplayBShieldExampleMap.id);
    if (!map) throw new Error('Shield example Map was not registered');
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
    expect(entered.activeEncounter?.enemies).toEqual([{ enemyId: 'training-robot', currentHp: 10 }]);
    expect(entered.activeEncounter?.shields).toEqual({});

    const first = commitShieldAction(service, started.runId, 'grant-shield', 'shield-example-first-hit');
    expect(first.lastEncounterCommit).toMatchObject({
      executionContractId: 'AG-1',
      schedulerFormatVersion: 6,
      shieldReceiptVersion: 1,
      shieldStart: {},
      plannedShields: { 'partyCharacter:serika': 1 },
      shieldTrace: [
        { op: 'shieldAdd', identity: { kind: 'partyCharacter', id: 'serika' }, requestedAmount: 3,
          shieldBefore: 0, added: 3, shieldAfter: 3 },
        { op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' }, requestedAmount: 2,
          shieldBefore: 3, absorbed: 2, shieldAfter: 1, remainingDamage: 0, hpBefore: 8, hpAfter: 8 },
      ],
    });
    expect(first.lastEncounterCommit?.settlements).toEqual(expect.arrayContaining([
      expect.objectContaining({ characterId: 'shiroko', actionId: 'grant-shield', resourceChanges: [
        { kind: 'cost', scope: 'actor', characterId: 'shiroko', resourceId: 'focus', delta: -1 },
      ] }),
    ]));
    expect(first.activeEncounter?.shields).toEqual({ 'partyCharacter:serika': 1 });
    expect(first.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(8);
    expect(first.actorResources.find(row => row.characterId === 'shiroko' && row.resourceId === 'focus')?.value).toBe(0);

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a save checkpoint with the Shield receipt');
    const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', mapId: map.id });
    expect(restored.getSnapshot()?.lastEncounterCommit).toEqual(first.lastEncounterCommit);
    expect(restored.getSnapshot()?.activeEncounter?.shields).toEqual({ 'partyCharacter:serika': 1 });

    const next = restored.getSnapshot();
    if (!next?.activeEncounter) throw new Error('Expected the restored second Shield round');
    const second = restored.commitEncounterRound({ runId: started.runId, requestId: 'shield-example-second-hit',
      expectedCommitVersion: next.commitVersion, draft: draftToken(next.activeEncounter) });
    expect(second.lastEncounterCommit).toMatchObject({
      schedulerFormatVersion: 6,
      shieldReceiptVersion: 1,
      shieldStart: { 'partyCharacter:serika': 1 },
      plannedShields: {},
      shieldTrace: [{ op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' }, requestedAmount: 2,
        shieldBefore: 1, absorbed: 1, shieldAfter: 0, remainingDamage: 1, hpBefore: 8, hpAfter: 7 }],
    });
    expect(second.activeEncounter?.shields).toEqual({});
    expect(second.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(7);
  });

});

describe('Gameplay B CardRef Modifier author example', () => {
  test('commits heal +2 for another Party member and replays the same receipt and HP on Restore', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(gameplayBCardModifierExampleMap.id);
    expect(map).toBeDefined();
    expect(map?.executionContractId).toBe('AG-1');
    expect(map?.actions?.find(action => action.id === 'amplify-heal')?.effectProgram?.resolve).toEqual([{
      op: 'cardEffectModifier', path: 'resolve[0].amount', operation: 'add', delta: 2,
    }]);
    expect(map?.actions?.find(action => action.id === 'prepared-heal')?.effectProgram?.resolve).toEqual([{
      op: 'heal', target: 'primary', amount: 2,
    }]);
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: gameplayBCardModifierExampleMap.id, mapEntryLabel: '进入卡牌效果修正演练',
    }));

    const resolver = { resolve: (id: string) => id === map!.id ? map! : null };
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const party = map!.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(map!.id, party);
    const entered = service.move(started.runId, 'practice');
    const active = entered.activeEncounter;
    if (!active) throw new Error('Expected active CardRef Modifier Encounter');
    const target = service.getCards(started.runId).find(card => card.owner.kind === 'partyCharacter'
      && card.owner.id === 'serika' && card.actionId === 'prepared-heal' && card.prepared)?.ref;
    if (!target) throw new Error('Expected Serika’s actual Prepared heal CardRef');
    service.setPreparedCardTarget(started.runId, 'shiroko', target, draftToken(active));
    const selected = service.getSnapshot(started.runId)!;
    service.setPreparedTarget(started.runId, 'serika', 'shiroko', draftToken(selected.activeEncounter!));
    const ready = service.getSnapshot(started.runId);
    if (!ready?.activeEncounter) throw new Error('Expected prepared Modifier selection');
    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'card-modifier-example',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter) });
    expect(committed.lastEncounterCommit).toMatchObject({
      programReceiptVersion: 2,
      cardEffectModifierReceipts: [{ sourceOwnerId: 'shiroko', sourceActionId: 'amplify-heal',
        targetOwnerId: 'serika', targetActionId: 'prepared-heal', sourceExecutionIndex: 0, targetExecutionIndex: 1,
        delta: 2, outcome: 'applied', hits: [{ op: 'heal', requestedAmount: 2, modifierDelta: 2,
          modifiedRequestedAmount: 4, before: 5, after: 9, hpDelta: 4 }] }],
    });
    expect(committed.partyHp.find(row => row.characterId === 'shiroko')?.currentHp).toBe(9);

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a save checkpoint with the Modifier receipt');
    const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
    const restoreResult = restored.restoreSaveSnapshot(checkpoint);
    expect(restoreResult).toMatchObject({ status: 'restored', mapId: map!.id });
    expect(restored.getSnapshot()?.lastEncounterCommit).toEqual(committed.lastEncounterCommit);
    expect(restored.getSnapshot()?.partyHp.find(row => row.characterId === 'shiroko')?.currentHp).toBe(9);
  });

  test('records notApplied when an intervening Enemy defeats the later Prepared heal source', () => {
    const base = gameplayBCardModifierExampleMap;
    const skippedMap: GameplayMapDef = {
      ...base,
      id: 'gameplay-b:map:card-modifier-example-skip',
      initialPartyHp: base.initialPartyHp.map(row => row.characterId === 'serika' ? { ...row, initialHp: 1 } : row),
      nodes: base.nodes.map(node => node.id === 'practice' && node.encounter
        ? { ...node, encounter: { ...node.encounter, enemies: [{ id: 'training-target', initialHp: 5, maxHp: 5,
          actions: [{ actionId: 'example-interrupt', tendencyWeight: 1 }] }] } }
        : node),
    };
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const resolver = createRegistryMapContentResolver(registry);
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const service = new MapRunService({ resolve: id => id === skippedMap.id ? skippedMap : resolver.resolve(id) }, resolveCharacterIdForVariant);
    const party = skippedMap.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const started = service.start(skippedMap.id, party);
    const entered = service.move(started.runId, 'practice');
    if (!entered.activeEncounter) throw new Error('Expected active CardRef Modifier skip Encounter');
    const target = service.getCards(started.runId).find(card => card.owner.kind === 'partyCharacter'
      && card.owner.id === 'serika' && card.actionId === 'prepared-heal' && card.prepared)?.ref;
    if (!target) throw new Error('Expected Serika’s actual Prepared heal CardRef');
    service.setPreparedCardTarget(started.runId, 'shiroko', target, draftToken(entered.activeEncounter));
    const selected = service.getSnapshot(started.runId)!;
    service.setPreparedTarget(started.runId, 'serika', 'shiroko', draftToken(selected.activeEncounter!));
    const ready = service.getSnapshot(started.runId)!;
    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'card-modifier-example-skipped',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter!) });
    expect(committed.lastEncounterCommit?.cardEffectModifierReceipts).toMatchObject([{
      sourceOwnerId: 'shiroko', targetOwnerId: 'serika', targetActionId: 'prepared-heal',
      outcome: 'notApplied', reason: 'defeated', hits: [],
    }]);
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(0);
  });
});

describe('Gameplay B Revive author example', () => {
  test('selects a downed primary, replays the receipt, and restores a later source that was revived in queue', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_REVIVE_EXAMPLE_MAP_ID);
    expect(map).toBeDefined();
    expect(map?.executionContractId).toBe('AG-1');
    expect(map?.actions?.find(action => action.id === 'revive-serika')?.target).toEqual({
      kind: 'partyCharacter', includeDefeated: true,
    });
    expect(map?.actions?.find(action => action.id === 'revive-serika')?.effectProgram?.resolve).toEqual([
      { op: 'revive', target: 'primary', amount: 3 },
    ]);
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: GAMEPLAY_B_REVIVE_EXAMPLE_MAP_ID, mapEntryLabel: '进入复苏原语演练',
    }));

    const resolver = { resolve: (id: string) => id === map!.id ? map! : null };
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const party = map!.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(map!.id, party);
    const entered = service.move(started.runId, 'revive-test');
    if (!entered.activeEncounter) throw new Error('Expected the active Revive example Encounter');
    expect(entered.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(1);
    service.setAbilityDraft(started.runId, 'revive-serika', { kind: 'partyCharacter', characterId: 'serika' },
      draftToken(entered.activeEncounter));
    const before = service.getSnapshot()!;
    const preview = service.previewEncounterCommit(started.runId)!;
    expect(preview.executionSequence?.map(row => row.sourceKind)).toEqual(['enemyAction', 'ability', 'partyAction']);
    expect(preview.effectTrace).toMatchObject([
      { op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' }, after: 0 },
      { op: 'revive', identity: { kind: 'partyCharacter', id: 'serika' }, beforeHp: 0, afterHp: 3, outcome: 'revived' },
      { op: 'hpChange', identity: { kind: 'partyCharacter', id: 'serika' }, before: 3, after: 4 },
    ]);
    const committed = service.commitEncounterRound({ runId: started.runId, requestId: 'revive-example-commit',
      expectedCommitVersion: before.commitVersion, draft: draftToken(before.activeEncounter!) });
    expect(committed.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(4);

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a checkpoint with the Revive trace');
    const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
    expect(restored.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', mapId: map!.id });
    expect(restored.getSnapshot()?.lastEncounterCommit?.effectTrace).toEqual(committed.lastEncounterCommit?.effectTrace);
    const forged = structuredClone(checkpoint) as any;
    forged.run.lastEncounterCommit.effectTrace.find((row: any) => row.op === 'revive').afterHp = 5;
    forged.run.activeEncounter.lastCommit.effectTrace.find((row: any) => row.op === 'revive').afterHp = 5;
    expect(new MapRunService(resolver, resolveCharacterIdForVariant).restoreSaveSnapshot(forged))
      .toMatchObject({ status: 'rejected', reason: 'invalid-run' });
  });
});

describe('Gameplay B damage-reduction author example', () => {
  test('applies fixed Status reduction before Shield, ticks duration, and replays Status Receipt v5', () => {
    const registry = new Registry();
    registry.load(defaultDatapack);
    registry.load(gameplayBMapDatapack);
    const map = registry.maps.get(GAMEPLAY_B_DAMAGE_REDUCTION_EXAMPLE_MAP_ID);
    expect(map).toBeDefined();
    expect(map?.statuses).toEqual([expect.objectContaining({
      id: 'cover', kind: 'damageReduction', category: 'beneficial', damageReductionPerStack: 2,
    })]);
    expect(registry.spots.get(GAMEPLAY_B_MAP_SPOT_ID)?.functionalities).toContainEqual(expect.objectContaining({
      kind: 'mapEntry', mapId: GAMEPLAY_B_DAMAGE_REDUCTION_EXAMPLE_MAP_ID, mapEntryLabel: '进入防御减伤演练',
    }));

    const resolver = { resolve: (id: string) => id === map!.id ? map! : null };
    const resolveCharacterIdForVariant = (variantId: string) => registry.characterVariants.get(variantId)?.proto ?? null;
    const party = map!.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const service = new MapRunService(resolver, resolveCharacterIdForVariant);
    const started = service.start(map!.id, party);
    const entered = service.move(started.runId, 'practice');
    if (!entered.activeEncounter) throw new Error('Expected the active damage-reduction example Encounter');
    service.setAbilityDraft(started.runId, 'cover-serika', { kind: 'partyCharacter', characterId: 'serika' },
      draftToken(entered.activeEncounter));
    const ready = service.getSnapshot(started.runId)!;
    const firstPreview = service.previewEncounterCommit(started.runId)!;
    expect(firstPreview.diagnostics).toEqual([]);
    expect(firstPreview.executionSequence?.map(row => row.sourceKind)).toEqual(['ability', 'enemyAction']);
    expect(firstPreview.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' }, amount: 1,
      damageReduction: { total: 2, sources: [expect.objectContaining({
        statusId: 'cover', actionId: 'cover-serika', stacks: 1, damageReductionPerStack: 2, reducedAmount: 2,
      })] },
    }));
    expect(firstPreview.shieldTrace).toContainEqual(expect.objectContaining({
      op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' }, requestedAmount: 1,
      absorbed: 1, remainingDamage: 0, hpBefore: 8, hpAfter: 8,
    }));

    const firstCommit = service.commitEncounterRound({ runId: started.runId, requestId: 'damage-reduction-r1',
      expectedCommitVersion: ready.commitVersion, draft: draftToken(ready.activeEncounter!) });
    expect(firstCommit.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(8);
    expect(firstCommit.lastEncounterCommit?.statusReceiptVersion).toBe(5);
    expect(firstCommit.lastEncounterCommit?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', amount: 1, damageReduction: expect.objectContaining({ total: 2 }),
    }));
    expect(firstCommit.lastEncounterCommit).toMatchObject({
      statusRemoveTrace: [], statusConsumeTrace: [], statusCategoryRemoveTrace: [],
    });
    expect(firstCommit.activeEncounter?.statuses).toEqual([expect.objectContaining({
      statusId: 'cover', appliedRound: 1, remainingRounds: 2, stacks: 1,
    })]);

    const checkpoint = service.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a checkpoint with the damage-reduction Status');
    expect(checkpoint.run.mapId).toBe(map!.id);
    expect(checkpoint.run.status).toBe('inProgress');
    expect(checkpoint.run.party.map(row => row.characterId)).toEqual(map!.partyCharacterIds);
    expect(checkpoint.run.lastEncounterCommit).not.toBeNull();
    expect(Number.isSafeInteger(checkpoint.run.playerCost)).toBe(true);
    expect(Array.isArray(checkpoint.run.visitedNodeIds)).toBe(true);
    expect(checkpoint.run.activeEncounter).not.toBeNull();
    const restored = new MapRunService(resolver, resolveCharacterIdForVariant);
    const restoreResult = restored.restoreSaveSnapshot(checkpoint);
    if (restoreResult.status !== 'restored') throw new Error(`U22 sample restore rejected: ${JSON.stringify(restoreResult)}`);
    expect(restoreResult).toMatchObject({ status: 'restored', mapId: map!.id });
    expect(restored.getSnapshot()?.lastEncounterCommit?.effectTrace).toEqual(firstCommit.lastEncounterCommit?.effectTrace);
    const forged = structuredClone(checkpoint) as any;
    const forgedTrace = forged.run.lastEncounterCommit.effectTrace.find((row: any) => row.op === 'damage');
    forgedTrace.damageReduction.total += 1;
    const forgedActiveTrace = forged.run.activeEncounter.lastCommit.effectTrace.find((row: any) => row.op === 'damage');
    forgedActiveTrace.damageReduction.total += 1;
    expect(new MapRunService(resolver, resolveCharacterIdForVariant).restoreSaveSnapshot(forged))
      .toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const secondPreview = restored.previewEncounterCommit(started.runId)!;
    expect(secondPreview.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', amount: 1, damageReduction: expect.objectContaining({ total: 2 }),
    }));
    expect(secondPreview.statusTrace).toContainEqual(expect.objectContaining({
      statusId: 'cover', statusKind: 'damageReduction', remainingRoundsBefore: 2, remainingRoundsAfter: 1, hpDelta: 0,
    }));
    const secondState = restored.getSnapshot(started.runId)!;
    const secondCommit = restored.commitEncounterRound({ runId: started.runId, requestId: 'damage-reduction-r2',
      expectedCommitVersion: secondState.commitVersion, draft: draftToken(secondState.activeEncounter!) });
    expect(secondCommit.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(7);

    const thirdPreview = restored.previewEncounterCommit(started.runId)!;
    expect(thirdPreview.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', amount: 1, damageReduction: expect.objectContaining({ total: 2 }),
    }));
    const thirdState = restored.getSnapshot(started.runId)!;
    const thirdCommit = restored.commitEncounterRound({ runId: started.runId, requestId: 'damage-reduction-r3',
      expectedCommitVersion: thirdState.commitVersion, draft: draftToken(thirdState.activeEncounter!) });
    expect(thirdCommit.partyHp.find(row => row.characterId === 'serika')?.currentHp).toBe(6);
    expect(thirdCommit.activeEncounter?.statuses).toEqual([]);

    const fourthPreview = restored.previewEncounterCommit(started.runId)!;
    expect(fourthPreview.effectTrace).toContainEqual(expect.objectContaining({
      op: 'damage', identity: { kind: 'partyCharacter', id: 'serika' }, amount: 3,
    }));
    expect(fourthPreview.effectTrace?.find(row => row.op === 'damage')).not.toHaveProperty('damageReduction');
  });
});
