import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { gameplayBMapRunStatusExampleMap } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-maprun-status-example';
import type { MapRun, MapRunEncounterDraftToken, MapRunShopDraftToken } from '../../src/arona-clicker/contracts/map/map-run';
import type { GameplayMapDef } from '../../src/data-services/contracts/gameplay-map';
import { MapRunService } from '../../src/arona-clicker/services/map/map-run-service';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/map/registry-map-content-resolver';
import { Registry } from '../../src/data-services/registry/registry';

function encounterDraft(run: MapRun): MapRunEncounterDraftToken {
  const encounter = run.activeEncounter;
  if (!encounter) throw new Error('Expected the MapRun Status example to have an active Encounter');
  return {
    nodeId: encounter.nodeId,
    ...(encounter.activityId === undefined ? {} : { activityId: encounter.activityId }),
    round: encounter.round,
    draftVersion: encounter.draftVersion,
  };
}

function shopDraft(run: MapRun): MapRunShopDraftToken {
  const activity = run.activeActivity;
  if (!activity || activity.kind !== 'shop') throw new Error('Expected the MapRun Status example to be in its Shop activity');
  return { nodeId: activity.nodeId, activityId: activity.activityId, draftVersion: activity.shopDraftVersion };
}

function commitRound(service: MapRunService, runId: string, requestId: string): MapRun {
  const run = service.getSnapshot(runId);
  if (!run?.activeEncounter) throw new Error('Expected an active MapRun Status example Encounter');
  return service.commitEncounterRound({
    runId,
    requestId,
    expectedCommitVersion: run.commitVersion,
    draft: encounterDraft(run),
  });
}

function createService(overrideMap?: GameplayMapDef): { readonly registry: Registry; readonly service: MapRunService } {
  const registry = new Registry();
  registry.load(defaultDatapack);
  registry.load(gameplayBMapDatapack);
  const registeredResolver = createRegistryMapContentResolver(registry);
  const resolver = overrideMap ? {
    resolve: (id: string) => id === overrideMap.id ? overrideMap : registeredResolver.resolve(id),
  } : registeredResolver;
  const service = new MapRunService(
    resolver,
    variantId => registry.characterVariants.get(variantId)?.proto ?? null,
  );
  return { registry, service };
}

describe('Gameplay B MapRun Status author example', () => {
  test('carries a direct Party Status through Shop and Save/Resume into a later Encounter, then clears it at Exit', () => {
    const { registry, service } = createService();
    const map = registry.maps.get(gameplayBMapRunStatusExampleMap.id);
    expect(map).toMatchObject({
      executionContractId: 'AG-1',
      resumeVersion: 1,
      statuses: [expect.objectContaining({ id: 'travelling-cover', lifetime: 'mapRun' })],
    });
    if (!map) throw new Error('The MapRun Status example was not loaded into Registry');

    const party = map.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const started = service.start(map.id, party);
    const origin = service.move(started.runId, 'practice');
    expect(origin.activeActivity).toMatchObject({ activityId: 'origin', kind: 'rest' });
    expect(origin.activeEncounter?.activityId).toBe('origin');
    expect(origin.mapRunStatuses).toEqual([]);

    const originPreview = service.previewEncounterCommit(started.runId);
    expect(originPreview).toMatchObject({ canCommit: true, statusReceiptVersion: 7, schedulerFormatVersion: 7 });
    expect(originPreview?.settlements).toContainEqual(expect.objectContaining({
      characterId: 'shiroko', actionId: 'apply-travelling-cover',
    }));

    const atShop = commitRound(service, started.runId, 'maprun-status-origin');
    expect(atShop.activeActivity).toMatchObject({ activityId: 'supply-stop', kind: 'shop' });
    expect(atShop.activeEncounter).toBeNull();
    expect(atShop.commitVersion).toBe(1);
    expect(atShop.mapRunStatuses).toEqual([expect.objectContaining({
      holder: { kind: 'partyCharacter', id: 'shiroko' },
      statusId: 'travelling-cover',
      source: { kind: 'partyCharacter', id: 'shiroko' },
      actionId: 'apply-travelling-cover',
      originNodeId: 'practice',
      originActivityId: 'origin',
      appliedCommitVersion: 0,
      lastTriggeredCommitVersion: null,
      stacks: 1,
      remainingRounds: 3,
    })]);
    expect(atShop.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 7,
      statusTrace: [],
      plannedMapRunStatuses: atShop.mapRunStatuses,
    });

    const shopCheckpoint = service.createSaveSnapshot();
    if (!shopCheckpoint) throw new Error('Expected a Save/Resume checkpoint in the Shop gap');
    const forgedRootOrigin = structuredClone(shopCheckpoint) as any;
    forgedRootOrigin.run.mapRunStatuses[0].originActivityId = 'demonstration';
    expect(createService().service.restoreSaveSnapshot(forgedRootOrigin)).toMatchObject({ status: 'rejected' });
    const forgedReceiptOrigin = structuredClone(shopCheckpoint) as any;
    forgedReceiptOrigin.run.lastEncounterCommit.plannedMapRunStatuses[0].originActivityId = 'demonstration';
    expect(createService().service.restoreSaveSnapshot(forgedReceiptOrigin)).toMatchObject({ status: 'rejected' });
    const shopResumed = createService().service;
    expect(shopResumed.restoreSaveSnapshot(shopCheckpoint)).toMatchObject({ status: 'restored', mapId: map.id });
    const restoredShop = shopResumed.getSnapshot(started.runId)!;
    expect(restoredShop.activeActivity).toEqual(atShop.activeActivity);
    expect(restoredShop.activeEncounter).toBeNull();
    expect(restoredShop.mapRunStatuses).toEqual(atShop.mapRunStatuses);
    expect(restoredShop.lastEncounterCommit).toEqual(atShop.lastEncounterCommit);

    const shopToken = shopDraft(restoredShop);
    const beforeShopPurchaseStatuses = restoredShop.mapRunStatuses;
    const purchased = shopResumed.purchaseShopOffer(started.runId, 'serika-ration', 'maprun-status-shop-buy', shopToken);
    expect(purchased.activeActivity?.kind).toBe('shop');
    expect(purchased.activeActivity?.lastPurchase?.offerId).toBe('serika-ration');
    expect(purchased.commitVersion).toBe(restoredShop.commitVersion);
    expect(purchased.mapRunStatuses).toEqual(beforeShopPurchaseStatuses);
    const afterShop = shopResumed.leaveShop(started.runId, shopDraft(purchased));
    expect(afterShop.activeActivity).toMatchObject({ activityId: 'demonstration', kind: 'battle' });
    expect(afterShop.activeEncounter?.activityId).toBe('demonstration');
    expect(afterShop.mapRunStatuses).toEqual(beforeShopPurchaseStatuses);
    expect(afterShop.activeEncounter?.statuses ?? []).not.toContainEqual(expect.objectContaining({ statusId: 'travelling-cover' }));

    const demonstrationPreview = shopResumed.previewEncounterCommit(started.runId);
    expect(demonstrationPreview).toMatchObject({ canCommit: true, statusReceiptVersion: 7, schedulerFormatVersion: 7 });
    const reducedHit = demonstrationPreview?.effectTrace?.find(trace => trace.op === 'damage'
      && trace.identity?.kind === 'partyCharacter' && trace.identity.id === 'shiroko');
    expect(reducedHit).toMatchObject({
      op: 'damage',
      identity: { kind: 'partyCharacter', id: 'shiroko' },
      amount: 1,
      damageReduction: { total: 2 },
    });
    expect(demonstrationPreview?.statusTrace).toContainEqual(expect.objectContaining({
      kind: 'mapRunRoundEnd',
      statusId: 'travelling-cover',
      commitVersion: 1,
      remainingRoundsBefore: 3,
      remainingRoundsAfter: 2,
      hpDelta: 0,
    }));

    const firstDemonstrationRound = commitRound(shopResumed, started.runId, 'maprun-status-demonstration-r1');
    expect(firstDemonstrationRound.partyHp).toContainEqual(expect.objectContaining({ characterId: 'shiroko', currentHp: 7 }));
    expect(firstDemonstrationRound.mapRunStatuses).toEqual([expect.objectContaining({
      statusId: 'travelling-cover',
      remainingRounds: 2,
      lastTriggeredCommitVersion: 1,
    })]);
    const activeReceipt = firstDemonstrationRound.lastEncounterCommit;
    if (!activeReceipt) throw new Error('Expected the demonstration Commit Receipt');

    const battleCheckpoint = shopResumed.createSaveSnapshot();
    if (!battleCheckpoint) throw new Error('Expected a Save/Resume checkpoint in the demonstration Encounter');
    const nextRoundPreview = shopResumed.previewEncounterCommit(started.runId);
    const battleResumed = createService().service;
    expect(battleResumed.restoreSaveSnapshot(battleCheckpoint)).toMatchObject({ status: 'restored', mapId: map.id });
    const restoredBattle = battleResumed.getSnapshot(started.runId)!;
    expect(restoredBattle.mapRunStatuses).toEqual(firstDemonstrationRound.mapRunStatuses);
    expect(restoredBattle.lastEncounterCommit).toEqual(activeReceipt);
    expect(restoredBattle.lastEncounterCommit?.statusTrace).toEqual(activeReceipt.statusTrace);
    expect(battleResumed.previewEncounterCommit(started.runId)).toEqual(nextRoundPreview);

    const secondProtectedRound = commitRound(battleResumed, started.runId, 'maprun-status-demonstration-r2');
    expect(secondProtectedRound.activeEncounter?.round).toBe(3);
    expect(secondProtectedRound.partyHp).toContainEqual(expect.objectContaining({ characterId: 'shiroko', currentHp: 6 }));
    expect(secondProtectedRound.mapRunStatuses).toEqual([expect.objectContaining({
      statusId: 'travelling-cover', remainingRounds: 1, lastTriggeredCommitVersion: 2,
    })]);

    const finalProtectedRound = commitRound(battleResumed, started.runId, 'maprun-status-demonstration-r3-expire');
    expect(finalProtectedRound.activeEncounter?.round).toBe(4);
    expect(finalProtectedRound.partyHp).toContainEqual(expect.objectContaining({ characterId: 'shiroko', currentHp: 5 }));
    expect(finalProtectedRound.mapRunStatuses).toEqual([]);
    expect(finalProtectedRound.lastEncounterCommit?.statusTrace).toContainEqual(expect.objectContaining({
      kind: 'mapRunRoundEnd', statusId: 'travelling-cover', remainingRoundsBefore: 1,
      remainingRoundsAfter: 0, removed: true,
    }));

    const afterExpiryPreview = battleResumed.previewEncounterCommit(started.runId);
    const unprotectedHit = afterExpiryPreview?.effectTrace?.find(trace => trace.op === 'damage'
      && trace.identity?.kind === 'partyCharacter' && trace.identity.id === 'shiroko');
    expect(unprotectedHit).toMatchObject({
      op: 'damage', identity: { kind: 'partyCharacter', id: 'shiroko' }, amount: 3,
    });
    expect(unprotectedHit).not.toHaveProperty('damageReduction');
    const completedDemonstration = commitRound(battleResumed, started.runId, 'maprun-status-demonstration-r4');
    expect(completedDemonstration.activeEncounter).toBeNull();
    expect(completedDemonstration.status).toBe('inProgress');
    expect(completedDemonstration.lastEncounterCommit).toMatchObject({
      statusReceiptVersion: 7,
      plannedMapRunStatuses: [],
      statusTrace: [],
    });
    expect(completedDemonstration.partyHp).toContainEqual(expect.objectContaining({ characterId: 'shiroko', currentHp: 2 }));

    const atExit = battleResumed.move(started.runId, 'exit');
    expect(atExit.status).toBe('success');
    expect(atExit.mapRunStatuses).toEqual([]);
    expect(battleResumed.getSnapshot()).toBeNull();
    expect(battleResumed.getResult(started.runId)).toMatchObject({ outcome: 'success', mapId: map.id });
  });

  test('clears a still-active MapRun Status when an intermediate activity reaches the Exit', () => {
    const earlyVictoryMap = structuredClone(gameplayBMapRunStatusExampleMap) as any;
    earlyVictoryMap.id = 'gameplay-b:map:maprun-status-early-victory-test';
    const demonstration = earlyVictoryMap.nodes.find((node: any) => node.id === 'practice')
      ?.activities?.find((activity: any) => activity.id === 'demonstration');
    if (!demonstration?.encounter?.enemies?.[0]) throw new Error('Expected the demonstration target to be present');
    demonstration.encounter.enemies[0].initialHp = 6;
    demonstration.encounter.enemies[0].maxHp = 6;
    const map = earlyVictoryMap as GameplayMapDef;
    const { registry, service } = createService(map);
    const party = map.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const started = service.start(map.id, party);
    expect(service.move(started.runId, 'practice').activeEncounter?.activityId).toBe('origin');
    commitRound(service, started.runId, 'maprun-status-early-victory-origin');
    const inShop = service.getSnapshot(started.runId);
    if (!inShop?.activeActivity || inShop.activeActivity.kind !== 'shop') throw new Error('Expected the Shop after the origin Encounter');
    const demonstrationRun = service.leaveShop(started.runId, shopDraft(inShop));
    expect(demonstrationRun.activeEncounter?.activityId).toBe('demonstration');

    const firstRound = commitRound(service, started.runId, 'maprun-status-early-victory-round-1');
    expect(firstRound.mapRunStatuses).toEqual([expect.objectContaining({ statusId: 'travelling-cover', remainingRounds: 2 })]);
    const terminalRound = commitRound(service, started.runId, 'maprun-status-early-victory-round-2');
    expect(terminalRound.activeEncounter).toBeNull();
    expect(terminalRound.mapRunStatuses).toEqual([expect.objectContaining({ statusId: 'travelling-cover', remainingRounds: 2 })]);

    const exited = service.move(started.runId, 'exit');
    expect(exited.status).toBe('success');
    expect(exited.mapRunStatuses).toEqual([]);
    expect(service.getSnapshot()).toBeNull();
  });

  test('clears MapRun Status on terminal failure without treating it as natural expiry', () => {
    const failureMap = structuredClone(gameplayBMapRunStatusExampleMap) as any;
    failureMap.id = 'gameplay-b:map:maprun-status-failure-test';
    failureMap.initialPartyHp = failureMap.initialPartyHp.map((row: any) => ({ ...row, initialHp: 1 }));
    const trainingShot = failureMap.actions.find((action: any) => action.id === 'training-shot');
    trainingShot.effectProgram.resolve[0].amount = 5;
    const map = failureMap as GameplayMapDef;
    const { registry, service } = createService(map);
    const party = map.partyCharacterIds.map(characterId => {
      const variant = [...registry.characterVariants.values()].find(candidate => candidate.proto === characterId);
      if (!variant) throw new Error(`Registry has no Variant for Map party Character "${characterId}"`);
      return { characterId, variantId: variant.id };
    });
    const started = service.start(map.id, party);
    service.move(started.runId, 'practice');
    commitRound(service, started.runId, 'maprun-status-failure-origin');
    const inShop = service.getSnapshot(started.runId)!;
    service.leaveShop(started.runId, shopDraft(inShop));

    const firstHit = commitRound(service, started.runId, 'maprun-status-failure-round-1');
    expect(firstHit.status).toBe('inProgress');
    expect(firstHit.mapRunStatuses).toEqual([expect.objectContaining({ statusId: 'travelling-cover', remainingRounds: 2 })]);
    const failed = commitRound(service, started.runId, 'maprun-status-failure-round-2');
    expect(failed.status).toBe('failure');
    expect(failed.activeEncounter).toBeNull();
    expect(failed.mapRunStatuses).toEqual([]);
    expect(failed.lastEncounterCommit).toMatchObject({ plannedMapRunStatuses: [], statusTrace: [] });
    expect(failed.lastEncounterCommit).not.toHaveProperty('statusExpiryTriggerTrace');
    expect(service.getFailureResult(started.runId)).toMatchObject({ outcome: 'failure', mapId: map.id });
  });
});
