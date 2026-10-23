import { describe, expect, test } from 'vitest';
import type { OperationEventDef, OperationRunStartInput } from '../../src/arona-clicker/contracts/operation/operation';
import type { OperationActionDef } from '../../src/arona-clicker/contracts/operation/operation-action';
import { OperationRuntimeError, OperationRuntimeService } from '../../src/arona-clicker/services/operation/operation-runtime-service';
import { OPERATION_TACTICAL_RNG_ALGORITHM } from '../../src/arona-clicker/contracts/operation/operation';

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
    title: id,
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
        stage: 'scene',
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
        stage: 'scene',
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
      stage: 'scene',
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
  test('uses the preferred legal target when a selected Individual SceneAction has no explicit target', () => {
    const input = individualStartInput();
    const targetAction = action(ACTION_A, [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }], { kind: 'actor', relation: 'any' });
    const service = new OperationRuntimeService();
    const runId = service.start({ ...input, actionDefinitions: [targetAction, input.actionDefinitions[1]!] }).runId;
    const before = service.getSnapshot()!;
    const emptyTargetCommand = {
      runId,
      planVersion: before.planVersion,
      selections: [
        { sceneActionId: 'demo:scene-action:collect-pass', actorId: A, targetActorIds: [] },
        { sceneActionId: 'demo:scene-action:steady-lights', actorId: B, targetActorIds: [] },
      ],
    } as const;

    const defaultTargetPreview = service.previewSceneActionBatch(emptyTargetCommand);
    expect(defaultTargetPreview.selections).toEqual([
      { sceneActionId: 'demo:scene-action:collect-pass', actorId: A, targetActorIds: [B] },
      { sceneActionId: 'demo:scene-action:steady-lights', actorId: B, targetActorIds: [] },
    ]);
    expect(service.getSnapshot()).toEqual(before);

    const explicitOverride = service.previewSceneActionBatch({
      ...emptyTargetCommand,
      selections: [
        { sceneActionId: 'demo:scene-action:collect-pass', actorId: A, targetActorIds: [A] },
        { sceneActionId: 'demo:scene-action:steady-lights', actorId: B, targetActorIds: [] },
      ],
    });
    expect(explicitOverride.selections[0]?.targetActorIds).toEqual([A]);
    expect(service.getSnapshot()).toEqual(before);

    const resolution = service.commitSceneActionBatch(emptyTargetCommand);
    expect(resolution.sceneBatch?.selections).toEqual(defaultTargetPreview.selections);
  });

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
      timelineSequence: 1,
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
    expect(run.currentLocationId).toBe('demo:location:platform');
    expect(service.getView()?.currentRoutes.map(route => route.routeId)).toEqual(['demo:route:staff-gate']);
    run = service.transitionRoute({ runId: run.runId, planVersion: run.planVersion, routeId: 'demo:route:staff-gate' });
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

  test('resolves an explicit all-eligible Scene Action from the current set and records those IDs', () => {
    const base = globalStartInput();
    const groupAction = action(ACTION_GLOBAL, [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }], {
      kind: 'actor', relation: 'any', selectionMode: 'all-eligible',
    });
    const service = new OperationRuntimeService();
    const runId = service.start({ ...base, actionDefinitions: [groupAction] }).runId;
    const before = service.getSnapshot()!;
    const command = {
      runId,
      planVersion: before.planVersion,
      selections: [{ sceneActionId: 'demo:scene-action:calm-crowd', actorId: A, targetActorIds: [] }],
    } as const;

    const preview = service.previewSceneActionBatch(command);
    expect(preview.selections).toEqual([{
      sceneActionId: 'demo:scene-action:calm-crowd', actorId: A, targetActorIds: [B, A],
    }]);
    expect(service.getSnapshot()).toEqual(before);
    expect(() => service.commitSceneActionBatch({
      ...command,
      selections: [{ ...command.selections[0], targetActorIds: [B] }],
    })).toThrow(/must not include explicit target IDs/);
    expect(service.getSnapshot()).toEqual(before);

    const resolution = service.commitSceneActionBatch(command);
    expect(resolution.sceneBatch?.selections[0]?.targetActorIds).toEqual([B, A]);
    expect(service.getSnapshot()?.actorStates.map(actor => actor.hp)).toEqual([2, 2]);
  });

  test('blocks all-eligible Scene Actions when the live legal set is empty without mutation', () => {
    const base = globalStartInput();
    const groupAction = action(ACTION_GLOBAL, [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }], {
      kind: 'actor', relation: 'otherTeam', selectionMode: 'all-eligible',
    });
    const service = new OperationRuntimeService();
    const runId = service.start({ ...base, actionDefinitions: [groupAction] }).runId;
    const before = service.getSnapshot()!;

    expect(() => service.previewSceneActionBatch({
      runId,
      planVersion: before.planVersion,
      selections: [{ sceneActionId: 'demo:scene-action:calm-crowd', actorId: A, targetActorIds: [] }],
    })).toThrow(/all-eligible Action has no legal targets/);
    expect(service.getSnapshot()).toEqual(before);
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

  test('previews and atomically commits PlayerCost plus Action Actor-resource costs across SceneAction and SceneCard', () => {
    const base = globalStartInput();
    const actionWithCost = { ...base.actionDefinitions[0], cost: { scope: 'actor' as const, resourceId: 'sCost', amount: 1 } };
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      actors: base.eventDefinition.actors.map(actor => ({
        ...actor,
        resources: { sCost: { initial: 2, min: 0, max: 2 } },
      })),
      playerSceneDeck: {
        cards: [{ id: 'demo:card:costed', actionId: ACTION_GLOBAL, playerCost: 1, timing: 'scene', copies: 1 }],
        initialDraw: 1,
        locationEntryDraw: 1,
        maxHandSize: 1,
      },
    };
    const service = new OperationRuntimeService();
    const runId = service.start({ ...base, eventDefinition, actionDefinitions: [actionWithCost] }).runId;
    const run = service.getSnapshot()!;
    const cardInstanceId = run.playerRouteState.cards.hand[0];
    const command = {
      runId,
      planVersion: run.planVersion,
      selections: [{ sceneActionId: 'demo:scene-action:calm-crowd', actorId: A, targetActorIds: [B] }],
      cards: [{ cardInstanceId, actorId: A, targetActorIds: [B] }],
    };

    expect(service.previewSceneActionBatch(command)).toMatchObject({
      cost: { balanceBefore: 3, totalCost: 3, balanceAfter: 0 },
      actionCosts: [
        { actorId: A, actionId: ACTION_GLOBAL, scope: 'actor', scopeId: A, resourceId: 'sCost', amount: 1 },
        { actorId: A, actionId: ACTION_GLOBAL, scope: 'actor', scopeId: A, resourceId: 'sCost', amount: 1 },
      ],
    });
    expect(service.getSnapshot()!.actorStates.find(actor => actor.id === A)?.resources.sCost).toBe(2);

    const resolution = service.commitSceneActionBatch(command);
    expect(resolution.payments).toHaveLength(2);
    expect(service.getSnapshot()!.actorStates.find(actor => actor.id === A)?.resources.sCost).toBe(0);
    expect(service.getSnapshot()!.playerRouteState.playerCost).toBe(0);
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

  test('allows an empty batch to skip the scene, while insufficient PlayerCost remains atomic', () => {
    const input = individualStartInput();
    const service = new OperationRuntimeService();
    const runId = service.start({
      ...input,
      eventDefinition: {
        ...input.eventDefinition,
        playerRouteState: { ...input.eventDefinition.playerRouteState, playerCost: 0 },
        locations: input.eventDefinition.locations.map(location => location.id === 'demo:location:platform'
          ? { ...location, costGain: 1, sceneActionBatches: 2 }
          : location),
      },
    }).runId;
    const before = service.getSnapshot()!;
    const skipped = service.commitSceneActionBatch({
      runId,
      planVersion: before.planVersion,
      selections: [],
    });
    expect(skipped.sceneBatch).toMatchObject({ selections: [], playerCostPaid: 0, sceneActionBatchesUsed: 1 });
    expect(service.getSnapshot()!.locationProgress['demo:location:platform'].completed).toBe(false);
    const afterSkip = service.getSnapshot()!;
    expect(() => service.previewSceneActionBatch({
      runId,
      planVersion: afterSkip.planVersion,
      selections: [
        { sceneActionId: 'demo:scene-action:collect-pass', actorId: A, targetActorIds: [] },
        { sceneActionId: 'demo:scene-action:steady-lights', actorId: B, targetActorIds: [] },
      ],
    })).toThrow(/unaffordable/);
    expect(service.getSnapshot()).toEqual(afterSkip);
  });

  test('Skip bypasses optional choices but still settles a fixed PlayerSceneCard', () => {
    const input = individualStartInput();
    const service = new OperationRuntimeService();
    const runId = service.start({
      ...input,
      eventDefinition: {
        ...input.eventDefinition,
        playerSceneDeck: {
          cards: [{
            id: 'fixed-repair-card',
            actionId: ACTION_A,
            playerCost: 0,
            timing: 'scene',
            copies: 1,
            selectionPolicy: 'fixed',
          }],
          initialDraw: 1,
          locationEntryDraw: 0,
          maxHandSize: 1,
        },
      },
    }).runId;
    const started = service.getSnapshot()!;
    const cardInstanceId = started.playerRouteState.cards.hand[0]!;
    const skipped = service.commitSceneActionBatch({
      runId,
      planVersion: started.planVersion,
      selections: [],
      skip: true,
    });

    expect(skipped.sceneBatch).toMatchObject({ skip: true, playerCostPaid: 0 });
    expect(skipped.sceneBatch?.cards).toEqual([expect.objectContaining({ cardInstanceId, actionId: ACTION_A })]);
    expect(service.getSnapshot()!.eventState.knownFactIds).toContain('demo:fact:platform-secured');
    expect(service.getSnapshot()!.playerRouteState.cards.discard).toContain(cardInstanceId);
  });

  test('an empty skip never completes an explicit Scene even when its predicate is already satisfied', () => {
    const input = individualStartInput();
    const legacyLocation = input.eventDefinition.locations[0];
    const { actionMode: _actionMode, sceneActionBatches: _sceneActionBatches, sceneActions, ...locationFields } = legacyLocation;
    const explicitLocation = {
      ...locationFields,
      scenes: [{
        id: 'main',
        title: 'Stabilize the platform',
        actionMode: 'individual' as const,
        sceneActionBatches: 2,
        sceneActions: sceneActions?.map(action => ({
          ...action,
          id: action.id.slice(action.id.lastIndexOf(':') + 1),
        })),
        completion: { kind: 'knownFact' as const, factId: 'demo:fact:platform-secured', present: false },
      }],
    };
    const service = new OperationRuntimeService();
    const runId = service.start({
      ...input,
      eventDefinition: {
        ...input.eventDefinition,
        locations: [explicitLocation, ...input.eventDefinition.locations.slice(1)],
      },
    }).runId;
    const started = service.getSnapshot()!;
    expect(started.eventState.knownFactIds).not.toContain('demo:fact:platform-secured');

    const skipped = service.commitSceneActionBatch({ runId, planVersion: started.planVersion, selections: [] });
    expect(skipped.sceneId).toBe('main');
    expect(skipped.sceneBatch).toMatchObject({ selections: [], playerCostPaid: 0, sceneActionBatchesUsed: 1 });
    expect(service.getSnapshot()).toMatchObject({
      currentLocationId: 'demo:location:platform',
      locationProgress: {
        'demo:location:platform': {
          completed: false,
          completedSceneIds: [],
          sceneActionBatchesUsedByScene: { main: 1 },
        },
      },
    });
    expect(service.getView()).toMatchObject({
      currentSceneId: 'main',
      currentScene: { sceneId: 'main', status: 'active' },
    });

    const afterSkip = service.getSnapshot()!;
    const selections = [
      { sceneActionId: 'steady-lights', actorId: B, targetActorIds: [] },
    ];
    const preview = service.previewSceneActionBatch({ runId, planVersion: afterSkip.planVersion, selections });
    expect(preview.plan).toMatchObject({ runId, sceneId: 'main', selections });
    expect(service.getSnapshot()).toEqual(afterSkip);
    const committed = service.commitSceneActionBatch({ runId, planVersion: afterSkip.planVersion, selections });
    expect(committed.sceneId).toBe('main');
    expect(service.getSnapshot()).toMatchObject({
      currentLocationId: 'demo:location:platform',
      locationProgress: {
        'demo:location:platform': {
          completed: false,
          completedSceneIds: ['main'],
          sceneActionBatchesUsedByScene: { main: 2 },
        },
      },
    });
  });

  test('fails the Location when an explicit Scene batch cap is exhausted before Scene completion', () => {
    const input = individualStartInput();
    const location = input.eventDefinition.locations[0]!;
    const { actionMode: _actionMode, sceneActionBatches: _sceneActionBatches, sceneActions, ...locationFields } = location;
    const scene = {
      id: 'platform-work',
      title: 'Secure the platform',
      actionMode: 'individual' as const,
      sceneActionBatches: 1,
      sceneActions: sceneActions?.map(action => ({
        ...action,
        id: action.id.slice(action.id.lastIndexOf(':') + 1),
      })),
      completion: { kind: 'knownFact' as const, factId: 'demo:fact:platform-secured', present: true },
    };
    const service = new OperationRuntimeService();
    const runId = service.start({
      ...input,
      eventDefinition: {
        ...input.eventDefinition,
        locations: [{ ...locationFields, scenes: [scene] }, ...input.eventDefinition.locations.slice(1)],
      },
    }).runId;
    const started = service.getSnapshot()!;
    const committed = service.commitSceneActionBatch({
      runId,
      planVersion: started.planVersion,
      selections: [],
      skip: true,
    });

    expect(committed.sceneBatch?.sceneActionBatchesUsed).toBe(1);
    expect(service.getSnapshot()).toMatchObject({
      status: 'failure',
      locationProgress: {
        'demo:location:platform': {
          completed: true,
          result: 'failure',
          completedSceneIds: [],
          sceneActionBatchesUsedByScene: { 'platform-work': 1 },
        },
      },
    });
    expect(service.finish().kind).toBe('failure');
  });

  test('resets explicit Scene batch counts on Location revisit while preserving completed Scene IDs', () => {
    const input = individualStartInput();
    const location = input.eventDefinition.locations[0]!;
    const concourse = input.eventDefinition.locations[1]!;
    const { actionMode: _actionMode, sceneActionBatches: _sceneActionBatches, sceneActions, ...locationFields } = location;
    const explicitLocation = {
      ...locationFields,
      scenes: [{
        id: 'platform-work',
        title: 'Secure the platform',
        actionMode: 'individual' as const,
        sceneActionBatches: 3,
        sceneActions: sceneActions?.map(action => ({
          ...action,
          id: action.id.slice(action.id.lastIndexOf(':') + 1),
        })),
        completion: { kind: 'knownFact' as const, factId: 'demo:fact:platform-secured', present: true },
      }],
    };
    const routedConcourse = {
      ...concourse,
      routeEdges: [{
        id: 'demo:route:concourse-platform',
        targetLocationId: 'demo:location:platform',
        label: 'Return to the platform',
        description: 'Return to the platform for a follow-up visit.',
      }],
    };
    const service = new OperationRuntimeService();
    const runId = service.start({
      ...input,
      eventDefinition: {
        ...input.eventDefinition,
        locations: [explicitLocation, routedConcourse],
      },
    }).runId;
    const beforeCommit = service.getSnapshot()!;
    service.commitSceneActionBatch({
      runId,
      planVersion: beforeCommit.planVersion,
      selections: [{ sceneActionId: 'collect-pass', actorId: A, targetActorIds: [] }],
    });
    const completedPlatform = service.getSnapshot()!;
    const atConcourse = service.transitionRoute({
      runId,
      planVersion: completedPlatform.planVersion,
      routeId: 'demo:route:staff-gate',
    });
    expect(atConcourse.currentLocationId).toBe('demo:location:concourse');
    const completedConcourse = service.completeCurrentLocation();
    const returned = service.transitionRoute({
      runId,
      planVersion: completedConcourse.planVersion,
      routeId: 'demo:route:concourse-platform',
    });

    expect(returned.locationProgress['demo:location:platform']).toMatchObject({
      visitCount: 2,
      completedSceneIds: ['platform-work'],
      sceneActionBatchesUsedByScene: { 'platform-work': 0 },
    });
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
    } as never)).toThrow(/only runId, planVersion, selections, cards, purchases, and skip/);
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

  test('commits unlimited batches one at a time and resumes counters beyond the history window', () => {
    const base = individualStartInput();
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      resumeVersion: 1,
      locations: base.eventDefinition.locations.map(location => {
        if (location.id !== 'demo:location:platform') return location;
        const { sceneActionBatches: _limit, ...unboundedLocation } = location;
        return unboundedLocation;
      }),
    };
    const input: OperationRunStartInput = { ...base, eventDefinition };
    const paused = new OperationRuntimeService();
    let run = paused.start(input);
    for (let index = 0; index < 40; index += 1) {
      const resolution = paused.commitSceneActionBatch({
        runId: run.runId,
        planVersion: run.planVersion,
        selections: [],
        skip: true,
      });
      expect(resolution.sceneBatch?.sceneActionBatchesUsed).toBe(index + 1);
      run = paused.getSnapshot()!;
      expect(run.status).toBe('inProgress');
    }

    expect(run.locationProgress['demo:location:platform']).toMatchObject({ sceneActionBatchesUsed: 40, completed: false });
    expect(run.resolutionSequence).toBe(40);
    expect(run.resolutions).toHaveLength(32);
    expect(run.resolutions[0].resolutionSequence).toBe(9);
    expect(paused.previewSceneActionBatch({
      runId: run.runId,
      planVersion: run.planVersion,
      selections: [],
      skip: true,
    }).sceneActionBatchesLimit).toBeNull();

    const checkpoint = paused.createSaveSnapshot()!;
    const resumed = new OperationRuntimeService();
    expect(resumed.restoreSaveSnapshot(checkpoint, input)).toEqual(run);
    const beforeRejectedCommit = resumed.getSnapshot()!;
    expect(() => resumed.commitSceneActionBatch({
      runId: run.runId,
      planVersion: run.planVersion + 1,
      selections: [],
      skip: true,
    })).toThrow(/stale/);
    expect(resumed.getSnapshot()).toEqual(beforeRejectedCommit);

    const next = resumed.commitSceneActionBatch({
      runId: run.runId,
      planVersion: run.planVersion,
      selections: [],
      skip: true,
    });
    expect(next.sceneBatch?.sceneActionBatchesUsed).toBe(41);
    expect(resumed.getSnapshot()).toMatchObject({ resolutionSequence: 41, timelineSequence: 42 });
    expect(resumed.getSnapshot()!.resolutions).toHaveLength(32);
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

  test('allows a student SceneAction to narrow its relational targets with actor filters', () => {
    const input = individualStartInput();
    const actionDefinitions = input.actionDefinitions.map(actionDefinition => actionDefinition.id === ACTION_A
      ? { ...actionDefinition, target: { kind: 'actor' as const, relation: 'any' as const, allowedActorIds: [A] } }
      : actionDefinition);

    const service = new OperationRuntimeService();
    expect(service.start({ ...input, actionDefinitions }).status).toBe('inProgress');
  });

  test('allows a student PlayerSceneCard to narrow its relational targets with actor filters', () => {
    const base = globalStartInput();
    const sceneOnlyActionId = 'demo:action:scene-only';
    const actionDefinitions = [
      {
        ...base.actionDefinitions[0],
        target: { kind: 'actor' as const, relation: 'any' as const, allowedActorTypes: ['student'] },
      },
      action(sceneOnlyActionId, []),
    ];
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      locations: base.eventDefinition.locations.map(location => ({
        ...location,
        sceneActions: [{
          id: 'demo:scene-action:calm-crowd',
          actionId: sceneOnlyActionId,
          scope: 'global' as const,
          playerCost: 2,
        }],
      })),
      playerSceneDeck: {
        cards: [{ id: 'demo:card:team-aid', actionId: ACTION_GLOBAL, playerCost: 2, timing: 'scene', copies: 1 }],
        initialDraw: 1,
        locationEntryDraw: 1,
        maxHandSize: 2,
      },
    };

    const service = new OperationRuntimeService();
    expect(service.start({ ...base, eventDefinition, actionDefinitions }).status).toBe('inProgress');
  });

  test('optional-student Global action supports in-place absolute targeting and assigned-student targeting', () => {
    const base = globalStartInput();
    const actionWithAbsoluteTargets = {
      ...base.actionDefinitions[0]!,
      target: { kind: 'actor' as const, relation: 'any' as const, allowedActorIds: [A, B] },
    };
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      locations: base.eventDefinition.locations.map(location => ({
        ...location,
        sceneActions: [{ id: 'demo:scene-action:calm-crowd', actionId: ACTION_GLOBAL, scope: 'global', playerCost: 1,
          performerPolicy: 'optional-student' as const }],
      })),
    };
    const local = new OperationRuntimeService();
    const localRun = local.start({ ...base, eventDefinition, actionDefinitions: [actionWithAbsoluteTargets] });
    const localResolution = local.commitSceneActionBatch({ runId: localRun.runId, planVersion: localRun.planVersion,
      selections: [{ sceneActionId: 'demo:scene-action:calm-crowd', targetActorIds: [A] }] });
    expect(localResolution.sceneBatch?.selections).toEqual([{ sceneActionId: 'demo:scene-action:calm-crowd', targetActorIds: [A] }]);
    expect(local.getSnapshot()!.playerRouteState.playerCost).toBe(2);

    const assigned = new OperationRuntimeService();
    const assignedRun = assigned.start({ ...base, eventDefinition, actionDefinitions: [actionWithAbsoluteTargets] });
    assigned.commitSceneActionBatch({ runId: assignedRun.runId, planVersion: assignedRun.planVersion,
      selections: [{ sceneActionId: 'demo:scene-action:calm-crowd', actorId: A, targetActorIds: [B] }] });
    expect(assigned.getSnapshot()!.actorStates.find(actor => actor.id === B)?.hp).toBe(4);
  });

  test('optional-student PlayerSceneCard can resolve actorless with an absolute target', () => {
    const base = globalStartInput();
    const actionWithAbsoluteTargets = {
      ...base.actionDefinitions[0]!,
      target: { kind: 'actor' as const, relation: 'any' as const, allowedActorIds: [A, B] },
    };
    const sceneOnlyAction = action('demo:action:scene-only', []);
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      locations: base.eventDefinition.locations.map(location => ({
        ...location,
        sceneActions: [{ id: 'demo:scene-action:ambient', actionId: sceneOnlyAction.id, scope: 'global', playerCost: 0,
          performerPolicy: 'none' as const }],
      })),
      playerSceneDeck: {
        cards: [{ id: 'demo:card:optional-actor', actionId: ACTION_GLOBAL, playerCost: 1, timing: 'scene', copies: 1,
          performerPolicy: 'optional-student' as const }],
        initialDraw: 1,
        locationEntryDraw: 0,
        maxHandSize: 1,
      },
    };
    const service = new OperationRuntimeService();
    const started = service.start({ ...base, eventDefinition, actionDefinitions: [actionWithAbsoluteTargets, sceneOnlyAction] });
    const cardInstanceId = service.getSnapshot()!.playerRouteState.cards.hand[0]!;
    const resolution = service.commitSceneActionBatch({ runId: started.runId, planVersion: started.planVersion,
      selections: [], cards: [{ cardInstanceId, targetActorIds: [B] }] });
    expect(resolution.sceneBatch?.cards).toEqual([expect.objectContaining({ cardInstanceId, targetActorIds: [B] })]);
    expect(service.getSnapshot()!.playerRouteState.playerCost).toBe(2);
  });
});
