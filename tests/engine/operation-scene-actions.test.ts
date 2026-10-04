import { describe, expect, test } from 'vitest';
import type { OperationEventDef, OperationRunStartInput } from '../../src/arona-clicker/contracts/operation';
import type { OperationActionDef } from '../../src/arona-clicker/contracts/operation-action';
import { OperationRuntimeError, OperationRuntimeService } from '../../src/arona-clicker/services/operation-runtime-service';
import { OPERATION_TACTICAL_RNG_ALGORITHM } from '../../src/arona-clicker/contracts/operation';

const A = 'demo:actor:one';
const B = 'demo:actor:two';
const ACTION_A = 'demo:action:collect-pass';
const ACTION_B = 'demo:action:steady-lights';
const ACTION_GLOBAL = 'demo:action:calm-crowd';

function student(actorId: string, actionId: string) {
  return {
    actorId,
    participantKind: 'student' as const,
    characterId: 'demo:character:' + actorId,
    profile: {
      id: 'demo:profile:' + actorId,
      characterId: 'demo:character:' + actorId,
      candidateActionIds: [actionId],
      actionPriorityIds: [actionId],
      capabilityIds: [],
      reasonIds: [],
      actionCandidates: [{
        actionId,
        eligible: true,
        requiredCapabilityIds: [],
        missingCapabilityIds: [],
        reasonIds: [],
      }],
      eligibleActionIds: [actionId],
    },
  };
}

function action(id: string, effects: OperationActionDef['effects'], target: OperationActionDef['target'] = { kind: 'none' }): OperationActionDef {
  return {
    id,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target,
    effects,
  };
}

function individualStartInput(): OperationRunStartInput {
  const actionA = action(ACTION_A, [
    { kind: 'heldItem', itemId: 'demo:item:staff-pass', op: 'grant' },
    { kind: 'eventFact', factId: 'demo:fact:platform-secured', op: 'reveal' },
  ]);
  const actionB = action(ACTION_B, [{ kind: 'eventTrackDelta', trackId: 'demo:track:order', amount: 1 }]);
  const eventDefinition: OperationEventDef = {
    id: 'demo:event:scene-cost',
    locations: [
      {
        id: 'demo:location:platform',
        enabledActionIds: [],
        combinationRules: [],
        actionMode: 'individual',
        sceneActionBatches: 1,
        sceneActions: [
          { id: 'demo:scene-action:collect-pass', actionId: ACTION_A, scope: 'individual', playerCost: 1 },
          { id: 'demo:scene-action:steady-lights', actionId: ACTION_B, scope: 'individual', playerCost: 1 },
        ],
        costGain: 2,
        maxCarryCost: 3,
        objectives: [{
          id: 'demo:objective:pass',
          description: 'Collect the staff pass.',
          kind: 'primary',
          predicate: { kind: 'knownFact', factId: 'demo:fact:platform-secured', present: true },
        }],
        routeEdges: [{
          id: 'demo:route:staff-gate',
          targetLocationId: 'demo:location:concourse',
          label: 'Staff gate',
          description: 'Use the pass and enter the concourse.',
          requiredHeldItemId: 'demo:item:staff-pass',
          consumeRequiredHeldItem: true,
        }],
      },
      {
        id: 'demo:location:concourse',
        enabledActionIds: [],
        combinationRules: [],
        costGain: 4,
        routeEdges: [],
      },
    ],
    initialLocationId: 'demo:location:platform',
    maxLocationVisits: 4,
    tracks: [{ id: 'demo:track:order', initial: 0, min: 0, max: 5 }],
    factIds: ['demo:fact:platform-secured'],
    knownFactIds: [],
    itemIds: ['demo:item:staff-pass'],
    heldItemIds: [],
    actors: [
      { id: A, type: 'student', hp: { initial: 3, min: 0, max: 4 }, targetPriorityActorIds: [B] },
      { id: B, type: 'student', hp: { initial: 3, min: 0, max: 4 }, targetPriorityActorIds: [A] },
    ],
    playerRouteState: { playerCost: 5 },
    randomSeed: 42,
  };
  return {
    eventDefinition,
    actors: [student(A, ACTION_A), student(B, ACTION_B)],
    actionDefinitions: [actionA, actionB],
    studentSkillRules: [],
  };
}

function globalStartInput(): OperationRunStartInput {
  const globalAction = action(ACTION_GLOBAL, [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }], { kind: 'actor', relation: 'any' });
  const eventDefinition: OperationEventDef = {
    ...individualStartInput().eventDefinition,
    id: 'demo:event:global-scene',
    locations: [{
      id: 'demo:location:platform',
      enabledActionIds: [],
      combinationRules: [],
      actionMode: 'global',
      sceneActionBatches: 2,
      sceneActions: [{ id: 'demo:scene-action:calm-crowd', actionId: ACTION_GLOBAL, scope: 'global', playerCost: 2 }],
      routeEdges: [],
    }],
    actors: individualStartInput().eventDefinition.actors,
    playerRouteState: { playerCost: 3 },
    itemIds: [],
    heldItemIds: [],
    factIds: [],
    knownFactIds: [],
    tracks: [],
  };
  return {
    eventDefinition,
    actors: [student(A, ACTION_GLOBAL), student(B, ACTION_GLOBAL)],
    actionDefinitions: [globalAction],
    studentSkillRules: [],
  };
}

describe('Operation SceneAction batches and shared route Cost', () => {
  test('previews without mutation, then commits one Individual batch through Resolution and the sole route path', () => {
    const service = new OperationRuntimeService();
    const runId = service.start(individualStartInput()).runId;
    let run = service.getSnapshot()!;
    const initialCursor = run.random.tacticalCursor;
    const command = {
      runId,
      planVersion: run.planVersion,
      selections: [
        { sceneActionId: 'demo:scene-action:collect-pass', actorId: A, targetActorIds: [] },
        { sceneActionId: 'demo:scene-action:steady-lights', actorId: B, targetActorIds: [] },
      ],
    } as const;

    expect(run.playerRouteState.playerCost).toBe(7);
    expect(run.locationEntryCostHistory).toEqual([{
      visitSequence: 1,
      locationId: 'demo:location:platform',
      visitCount: 1,
      costGain: 2,
      balanceBefore: 5,
      balanceAfter: 7,
    }]);
    expect(service.previewSceneActionBatch(command)).toMatchObject({
      actionMode: 'individual',
      cost: { balanceBefore: 7, totalCost: 2, balanceAfter: 5 },
      sceneActionBatchesUsed: 1,
      sceneActionBatchesLimit: 1,
    });
    expect(service.getSnapshot()!.playerRouteState.playerCost).toBe(7);

    const resolution = service.commitSceneActionBatch(command);
    run = service.getSnapshot()!;
    expect(resolution.sceneBatch).toMatchObject({ playerCostBefore: 7, playerCostPaid: 2, playerCostAfter: 5, sceneActionBatchesUsed: 1 });
    expect(resolution.numericChanges).toEqual([expect.objectContaining({ target: { kind: 'track', trackId: 'demo:track:order' }, delta: 1 })]);
    expect(resolution.membershipChanges).toContainEqual(expect.objectContaining({ target: { kind: 'knownFact', id: 'demo:fact:platform-secured' }, after: true }));
    expect(resolution.membershipChanges).toContainEqual(expect.objectContaining({ target: { kind: 'heldItem', id: 'demo:item:staff-pass' }, after: true }));
    expect(run.random.tacticalCursor).toBe(initialCursor);
    expect(run.locationProgress['demo:location:platform']).toMatchObject({ completed: true, result: 'success', sceneActionBatchesUsed: 1 });
    expect(run.currentLocationId).toBe('demo:location:concourse');
    expect(run.eventState.heldItemIds).toEqual([]);
    expect(run.playerRouteState.playerCost).toBe(7);
    expect(run.routeHistory[0]).toMatchObject({ playerCostBeforeExit: 5, playerCostAfterCarryLimit: 3, consumedHeldItemId: 'demo:item:staff-pass' });
    expect(run.locationEntryCostHistory?.[1]).toMatchObject({ locationId: 'demo:location:concourse', costGain: 4, balanceBefore: 3, balanceAfter: 7 });
    expect(run.resolutions).toHaveLength(1);
    expect(service.commitSceneActionBatch(command)).toEqual(resolution);
  });

  test('accepts one Global choice with multiple legal Actor targets and spends one batch', () => {
    const service = new OperationRuntimeService();
    const runId = service.start(globalStartInput()).runId;
    const run = service.getSnapshot()!;
    const resolution = service.commitSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: [{
        sceneActionId: 'demo:scene-action:calm-crowd',
        actorId: A,
        targetActorIds: [A, B],
      }],
    });
    expect(resolution.sceneBatch?.playerCostPaid).toBe(2);
    expect(service.getSnapshot()!.actorStates.map(actor => actor.hp)).toEqual([4, 4]);
    expect(service.getSnapshot()!.playerRouteState.playerCost).toBe(1);
    expect(service.getSnapshot()!.locationProgress['demo:location:platform']).toMatchObject({ sceneActionBatchesUsed: 1, completed: false });
  });

  test('counts a PlayerSceneCard with the SceneAction fee and rejects an unaffordable batch atomically', () => {
    const base = globalStartInput();
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      playerSceneDeck: {
        cards: [{ id: 'demo:card:team-aid', actionId: ACTION_GLOBAL, playerCost: 2, timing: 'scene', copies: 1 }],
        initialDraw: 1,
        locationEntryDraw: 1,
        maxHandSize: 2,
      },
    };
    const service = new OperationRuntimeService();
    const runId = service.start({ ...base, eventDefinition }).runId;
    const before = service.getSnapshot()!;
    const cardInstanceId = before.playerRouteState.cards.hand[0];
    expect(cardInstanceId).toMatch(/^operation-card:v1:/);
    const command = {
      runId,
      planVersion: before.planVersion,
      selections: [{ sceneActionId: 'demo:scene-action:calm-crowd', actorId: A, targetActorIds: [B] }],
      cards: [{ cardInstanceId, actorId: A, targetActorIds: [B] }],
    };
    expect(() => service.previewSceneActionBatch(command)).toThrow(/unaffordable/);
    expect(() => service.commitSceneActionBatch(command)).toThrow(/unaffordable/);
    expect(service.getSnapshot()).toEqual(before);

    const duplicate = {
      ...command,
      cards: [command.cards[0], command.cards[0]],
    };
    expect(() => service.previewSceneActionBatch(duplicate)).toThrow(/unique instance currently in hand/);
    expect(service.getSnapshot()).toEqual(before);
  });

  test('restores a staged Global SceneAction and card batch with its exact fee preview', () => {
    const base = globalStartInput();
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      resumeVersion: 1,
      playerSceneDeck: {
        cards: [{ id: 'demo:card:team-aid', actionId: ACTION_GLOBAL, playerCost: 1, timing: 'scene', copies: 1 }],
        initialDraw: 1,
        locationEntryDraw: 0,
        maxHandSize: 1,
      },
    };
    const input: OperationRunStartInput = { ...base, eventDefinition };
    const uninterrupted = new OperationRuntimeService();
    const uninterruptedRun = uninterrupted.start(input);
    const uninterruptedCommand = {
      runId: uninterruptedRun.runId,
      planVersion: uninterruptedRun.planVersion,
      selections: [{ sceneActionId: 'demo:scene-action:calm-crowd', actorId: A, targetActorIds: [B] }],
      cards: [{ cardInstanceId: uninterruptedRun.playerRouteState.cards.hand[0], actorId: A, targetActorIds: [B] }],
    };
    const expected = uninterrupted.commitSceneActionBatch(uninterruptedCommand);

    const paused = new OperationRuntimeService();
    const pausedRun = paused.start(input);
    const command = {
      ...uninterruptedCommand,
      runId: pausedRun.runId,
      cards: [{ cardInstanceId: pausedRun.playerRouteState.cards.hand[0], actorId: A, targetActorIds: [B] }],
    };
    const staged = paused.stageSceneActionBatch(command);
    expect(staged.pendingSceneActionBatch?.preview.cost).toEqual({ balanceBefore: 3, totalCost: 3, balanceAfter: 0 });
    expect(staged.playerRouteState).toEqual(pausedRun.playerRouteState);
    expect(staged.random).toEqual(pausedRun.random);
    const checkpoint = paused.createSaveSnapshot()!;

    const restored = new OperationRuntimeService();
    expect(restored.restoreSaveSnapshot(checkpoint, input)).toEqual(staged);
    const actual = restored.commitStagedSceneActionBatch({ runId: staged.runId, planVersion: staged.planVersion });
    expect(actual.sceneBatch).toEqual(expected.sceneBatch);
    expect(actual.numericChanges).toEqual(expected.numericChanges);
    expect(restored.getSnapshot()).toMatchObject({
      status: uninterrupted.getSnapshot()!.status,
      currentLocationId: uninterrupted.getSnapshot()!.currentLocationId,
      eventState: uninterrupted.getSnapshot()!.eventState,
      actorStates: uninterrupted.getSnapshot()!.actorStates,
      playerRouteState: uninterrupted.getSnapshot()!.playerRouteState,
      resolutions: [{ ...expected, runId: pausedRun.runId }],
      pendingSceneActionBatch: null,
      random: uninterrupted.getSnapshot()!.random,
    });
  });

  test('rejects an incomplete Individual batch or insufficient PlayerCost without any Run mutation', () => {
    const input = individualStartInput();
    const service = new OperationRuntimeService();
    const runId = service.start({
      ...input,
      eventDefinition: {
        ...input.eventDefinition,
        playerRouteState: { ...input.eventDefinition.playerRouteState, playerCost: 0 },
        locations: input.eventDefinition.locations.map(location => location.id === 'demo:location:platform'
          ? { ...location, costGain: 1 }
          : location),
      },
    }).runId;
    const before = service.getSnapshot()!;
    expect(() => service.commitSceneActionBatch({
      runId,
      planVersion: before.planVersion,
      selections: [{ sceneActionId: 'demo:scene-action:collect-pass', actorId: A, targetActorIds: [] }],
    })).toThrow(OperationRuntimeError);
    expect(() => service.previewSceneActionBatch({
      runId,
      planVersion: before.planVersion,
      selections: [
        { sceneActionId: 'demo:scene-action:collect-pass', actorId: A, targetActorIds: [] },
        { sceneActionId: 'demo:scene-action:steady-lights', actorId: B, targetActorIds: [] },
      ],
    })).toThrow(/unaffordable/);
    expect(service.getSnapshot()).toEqual(before);
  });

  test('stale selections and caller-supplied cost/effects are not accepted', () => {
    const service = new OperationRuntimeService();
    const runId = service.start(individualStartInput()).runId;
    const run = service.getSnapshot()!;
    expect(() => service.previewSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      playerCost: 0,
      selections: [],
    } as never)).toThrow(/only runId, planVersion, selections, and cards/);
    const command = {
      runId,
      planVersion: run.planVersion + 1,
      selections: [
        { sceneActionId: 'demo:scene-action:collect-pass', actorId: A, targetActorIds: [] },
        { sceneActionId: 'demo:scene-action:steady-lights', actorId: B, targetActorIds: [] },
      ],
    };
    expect(() => service.previewSceneActionBatch(command)).toThrow(/stale/);
    expect(service.getSnapshot()).toEqual(run);
  });

  test('validates SceneAction wrapper scope, definition references, and finite visit budget', () => {
    const input = individualStartInput();
    const service = new OperationRuntimeService();
    expect(() => service.start({
      ...input,
      eventDefinition: {
        ...input.eventDefinition,
        locations: input.eventDefinition.locations.map(location => location.id === 'demo:location:platform'
          ? { ...location, sceneActionBatches: Number.POSITIVE_INFINITY, sceneActions: [{
            id: 'demo:scene-action:wrong', actionId: ACTION_A, scope: 'global', playerCost: 0,
          }] }
          : location),
      },
    })).toThrow(/sceneActionBatches|scope/);
  });
});
