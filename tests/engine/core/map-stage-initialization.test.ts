import { describe, expect, test } from 'vitest';
import type { MapContentResolver } from '../../../src/arona-clicker/contracts/map/map-content-resolver';
import type { MapRun } from '../../../src/arona-clicker/contracts/map/map-run';
import { getMapDefinitionAtNode, MapRunService } from '../../../src/arona-clicker/services/map/map-run-service';
import type { GameplayMapDef, GameplayMapNodeDef } from '../../../src/data-services/contracts/gameplay-map';

const party = [{ characterId: 'shiroko', variantId: 'Shiroko' }] as const;
const stageSetup = (initialHp: number, maxHp: number, agility: number, initialPlayerCost: number,
  actorFocus: number, teamEnergy: number) => ({
  initialPartyHp: [{ characterId: 'shiroko', initialHp, maxHp }],
  partyAgility: [{ characterId: 'shiroko', agility }],
  initialPlayerCost,
  initialActorResources: [{ characterId: 'shiroko', resourceId: 'focus', value: actorFocus }],
  initialTeamResources: [{ resourceId: 'energy', value: teamEnergy }],
});

const encounter = (title: string, actionId: string, enemyHp = 1) => ({
  title,
  enemies: [{ id: `${title}-enemy`, initialHp: enemyHp, maxHp: enemyHp }],
  participants: [{ characterId: 'shiroko', actions: [{ actionId, tendencyWeight: 1 }] }],
});

const nodes: readonly GameplayMapNodeDef[] = [
  { id: 'entry', title: 'Entry' },
  {
    id: 'owned', title: 'Owned', partySetup: stageSetup(4, 8, 1, 3, 2, 2),
    encounter: encounter('Owned', 'apply-cover-and-hit'),
  },
  {
    id: 'normal', title: 'Normal', partySetup: stageSetup(8, 16, 4, 5, 7, 6),
    encounter: encounter('Normal', 'heal-and-hit', 2),
  },
  {
    id: 'enhanced', title: 'Enhanced', partySetup: stageSetup(15, 20, 6, 8, 9, 10),
    encounter: encounter('Enhanced', 'heal-and-hit'),
  },
  { id: 'exit', title: 'Exit' },
];

const map: GameplayMapDef = {
  id: 'test:map:stage-initialization',
  name: 'Stage Initialization',
  resumeVersion: 1,
  executionContractId: 'AG-1',
  startNodeId: 'entry',
  exitNodeIds: ['exit'],
  partyCharacterIds: ['shiroko'],
  initialPartyHp: [{ characterId: 'shiroko', initialHp: 9, maxHp: 10 }],
  partyAgility: [],
  initialPlayerCost: 1,
  initialActorResources: [{ characterId: 'shiroko', resourceId: 'focus', value: 9 }],
  initialTeamResources: [{ resourceId: 'energy', value: 9 }],
  statuses: [{
    id: 'travel-cover', lifetime: 'mapRun', name: 'Travel Cover', category: 'beneficial',
    kind: 'damageReduction', damageReductionPerStack: 1, maxStacks: 1,
  }],
  actions: [
    {
      id: 'apply-cover-and-hit', name: 'Cover and Hit', eligibleCharacterIds: ['shiroko'],
      agility: { base: 10, max: 10 }, target: { kind: 'enemy' },
      costs: [
        { scope: 'actor', resourceId: 'focus', amount: 1 },
        { scope: 'team', resourceId: 'energy', amount: 1 },
      ],
      effectProgram: { resolve: [
        { op: 'statusApply', target: 'source', statusId: 'travel-cover', stacks: 1, durationRounds: 3 },
        { op: 'damage', target: 'primary', amount: 1 },
      ] },
    },
    {
      id: 'heal-and-hit', name: 'Heal and Hit', eligibleCharacterIds: ['shiroko'],
      agility: { base: 10, max: 10 }, target: { kind: 'enemy' },
      costs: [
        { scope: 'actor', resourceId: 'focus', amount: 1 },
        { scope: 'team', resourceId: 'energy', amount: 1 },
      ],
      effectProgram: { resolve: [
        { op: 'heal', target: { set: { side: 'party', order: 'definition', limit: 1 } }, amount: 20 },
        { op: 'damage', target: 'primary', amount: 1 },
      ] },
    },
  ],
  nodes,
  edges: [
    { fromNodeId: 'entry', toNodeId: 'owned' },
    { fromNodeId: 'owned', toNodeId: 'normal' },
    { fromNodeId: 'normal', toNodeId: 'owned' },
    { fromNodeId: 'normal', toNodeId: 'enhanced' },
    { fromNodeId: 'enhanced', toNodeId: 'exit' },
  ],
};

function makeService(): MapRunService {
  const resolver: MapContentResolver = { resolve: id => id === map.id ? map : null };
  return new MapRunService(resolver, variantId => variantId === 'Shiroko' ? 'shiroko' : null);
}

function draft(run: MapRun) {
  const active = run.activeEncounter;
  if (!active) throw new Error('Expected an active stage Encounter');
  return {
    nodeId: active.nodeId,
    ...(active.activityId === undefined ? {} : { activityId: active.activityId }),
    round: active.round,
    draftVersion: active.draftVersion,
  };
}

function commit(service: MapRunService, run: MapRun, requestId: string): MapRun {
  return service.commitEncounterRound({
    runId: run.runId,
    requestId,
    expectedCommitVersion: run.commitVersion,
    draft: draft(run),
  });
}

function expectPartyState(run: MapRun, values: {
  readonly hp: number;
  readonly agility: number;
  readonly playerCost: number;
  readonly actorFocus: number;
  readonly teamEnergy: number;
}) {
  expect(run.partyHp).toEqual([{ characterId: 'shiroko', currentHp: values.hp }]);
  expect(run.partyAgility).toEqual([{ characterId: 'shiroko', agility: values.agility }]);
  expect(run.playerCost).toBe(values.playerCost);
  expect(run.actorResources).toEqual([{ characterId: 'shiroko', resourceId: 'focus', value: values.actorFocus }]);
  expect(run.teamResources).toEqual([{ resourceId: 'energy', value: values.teamEnergy }]);
}

describe('MapRun node party setup', () => {
  test('resets each first-entered stage, uses its cap for settlement/restore, and restart begins at the first stage', () => {
    expect(getMapDefinitionAtNode(map, 'normal').initialPartyHp).toEqual([
      { characterId: 'shiroko', initialHp: 8, maxHp: 16 },
    ]);
    expect(getMapDefinitionAtNode(map, 'entry')).toBe(map);

    const service = makeService();
    const started = service.start(map.id, party);
    expectPartyState(started, { hp: 9, agility: 0, playerCost: 1, actorFocus: 9, teamEnergy: 9 });

    const owned = service.move(started.runId, 'owned');
    expectPartyState(owned, { hp: 4, agility: 1, playerCost: 3, actorFocus: 2, teamEnergy: 2 });
    expect(owned.mapRunStatuses).toEqual([]);
    expect(service.previewActions(started.runId)?.preparedActions).toMatchObject([
      { characterId: 'shiroko', preparedActionId: 'apply-cover-and-hit' },
    ]);

    const ownedComplete = commit(service, owned, 'owned-stage');
    expect(ownedComplete.activeEncounter).toBeNull();
    expect(ownedComplete.mapRunStatuses).toHaveLength(1);
    expect(ownedComplete.actorResources[0]?.value).toBe(1);
    expect(ownedComplete.teamResources[0]?.value).toBe(1);
    expect(() => service.move(started.runId, 'enhanced')).toThrow(/not reachable/);

    const normal = service.move(started.runId, 'normal');
    expectPartyState(normal, { hp: 8, agility: 4, playerCost: 5, actorFocus: 7, teamEnergy: 6 });
    expect(normal.mapRunStatuses).toEqual([]);
    expect(normal.lastEncounterCommit).toBeNull();
    expect(normal.activeEncounter?.round).toBe(1);
    expect(service.getEntrySnapshot(started.runId)?.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 8, maxHp: 16 },
    ]);
    expect(service.previewActions(started.runId)?.preparedActions).toMatchObject([
      { characterId: 'shiroko', preparedActionId: 'heal-and-hit' },
    ]);

    const stageStartCheckpoint = service.createSaveSnapshot();
    if (!stageStartCheckpoint) throw new Error('Expected a stage-start checkpoint');
    const stageStartResume = makeService();
    expect(stageStartResume.restoreSaveSnapshot(stageStartCheckpoint))
      .toMatchObject({ status: 'restored', mapId: map.id });
    const resumedStageStart = stageStartResume.getSnapshot(started.runId)!;
    expect(resumedStageStart.lastEncounterCommit).toBeNull();
    expectPartyState(resumedStageStart, { hp: 8, agility: 4, playerCost: 5, actorFocus: 7, teamEnergy: 6 });
    expect(resumedStageStart.activeEncounter?.hands).toEqual(normal.activeEncounter?.hands);

    const healingPreview = service.previewEncounterCommit(started.runId);
    expect(healingPreview?.effectTrace).toContainEqual(expect.objectContaining({
      op: 'heal', identity: { kind: 'partyCharacter', id: 'shiroko' }, before: 8, after: 16, delta: 8,
    }));
    const normalRoundOne = commit(stageStartResume, resumedStageStart, 'normal-round-one');
    expect(normalRoundOne.partyHp).toEqual([{ characterId: 'shiroko', currentHp: 16 }]);
    expect(normalRoundOne.activeEncounter?.round).toBe(2);

    const checkpoint = stageStartResume.createSaveSnapshot();
    if (!checkpoint) throw new Error('Expected a mid-stage checkpoint');
    const restoredService = makeService();
    expect(restoredService.restoreSaveSnapshot(checkpoint)).toMatchObject({ status: 'restored', mapId: map.id });
    const restored = restoredService.getSnapshot(started.runId)!;
    expect(restored.partyHp).toEqual(normalRoundOne.partyHp);
    expect(restored.partyAgility).toEqual(normalRoundOne.partyAgility);
    expect(restored.actorResources).toEqual(normalRoundOne.actorResources);
    expect(restored.teamResources).toEqual(normalRoundOne.teamResources);
    expect(restored.activeEncounter?.hands).toEqual(normalRoundOne.activeEncounter?.hands);
    expect(restored.activeEncounter?.round).toBe(2);

    const forged = structuredClone(checkpoint) as any;
    forged.run.partyHp[0].currentHp = 17;
    expect(makeService().restoreSaveSnapshot(forged)).toMatchObject({ status: 'rejected', reason: 'invalid-run' });

    const normalComplete = commit(restoredService, restored, 'normal-round-two');
    expect(normalComplete.activeEncounter).toBeNull();
    const revisitOwned = restoredService.move(started.runId, 'owned');
    expectPartyState(revisitOwned, { hp: 16, agility: 4, playerCost: 5, actorFocus: 5, teamEnergy: 4 });
    expect(revisitOwned.activeEncounter).toBeNull();
    const returnToNormal = restoredService.move(started.runId, 'normal');
    expectPartyState(returnToNormal, { hp: 16, agility: 4, playerCost: 5, actorFocus: 5, teamEnergy: 4 });
    const enhanced = restoredService.move(started.runId, 'enhanced');
    expectPartyState(enhanced, { hp: 15, agility: 6, playerCost: 8, actorFocus: 9, teamEnergy: 10 });
    expect(enhanced.mapRunStatuses).toEqual([]);
    expect(enhanced.lastEncounterCommit).toBeNull();
    expect(restoredService.getEntrySnapshot(started.runId)?.partyHp).toEqual([
      { characterId: 'shiroko', currentHp: 15, maxHp: 20 },
    ]);
    expect(restoredService.previewActions(started.runId)?.preparedActions).toMatchObject([
      { characterId: 'shiroko', preparedActionId: 'heal-and-hit' },
    ]);

    const restarted = restoredService.restart(started.runId);
    expect(restarted.runId).not.toBe(started.runId);
    expect(restarted.currentNodeId).toBe('entry');
    expectPartyState(restarted, { hp: 9, agility: 0, playerCost: 1, actorFocus: 9, teamEnergy: 9 });
    const restartedFirstStage = restoredService.move(restarted.runId, 'owned');
    expectPartyState(restartedFirstStage, { hp: 4, agility: 1, playerCost: 3, actorFocus: 2, teamEnergy: 2 });
  });
});
