import { describe, expect, test } from 'vitest';
import type { OperationEventDef, OperationRunStartInput, OperationStudentProfileSnapshot } from '../../src/arona-clicker/contracts/operation';
import type { OperationActionDef } from '../../src/arona-clicker/contracts/operation-action';
import { OperationRuntimeService } from '../../src/arona-clicker/services/operation-runtime-service';
import { operationCharacterSceneHandWordAt } from '../../src/arona-clicker/services/operation-tactical-rng';

const ACTOR_A = 'scene-test:actor:a';
const ACTOR_B = 'scene-test:actor:b';
const ACTION_A_COSTLY = 'scene-test:action:a-costly';
const ACTION_A_FALLBACK = 'scene-test:action:a-fallback';
const ACTION_B = 'scene-test:action:b';
const ACTION_B_FALLBACK = 'scene-test:action:b-fallback';
const ACTION_FIXED = 'scene-test:action:fixed';
const ACTION_CARD = 'scene-test:action:player-card';
const SCENE_ACTION_FIXED = 'fixed';

function student(actorId: string, actionIds: readonly string[], priorityIds = actionIds) {
  const profile: OperationStudentProfileSnapshot = {
    id: 'scene-test:profile:' + actorId,
    characterId: 'scene-test:character:' + actorId,
    candidateActionIds: [...actionIds],
    actionPriorityIds: [...priorityIds],
    capabilityIds: [],
    reasonIds: [],
    actionCandidates: actionIds.map(actionId => ({
      actionId,
      eligible: true,
      requiredCapabilityIds: [],
      missingCapabilityIds: [],
      reasonIds: [],
    })),
    eligibleActionIds: [...actionIds],
  };
  return {
    actorId,
    participantKind: 'student' as const,
    characterId: profile.characterId,
    profile,
  };
}

function action(
  id: string,
  target: OperationActionDef['target'],
  effects: OperationActionDef['effects'],
  cost?: OperationActionDef['cost'],
): OperationActionDef {
  return {
    id,
    title: id,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target,
    effects,
    ...(cost ? { cost } : {}),
  };
}

function restStartInput(): OperationRunStartInput {
  const eventDefinition: OperationEventDef = {
    id: 'scene-test:event:rest',
    resumeVersion: 1,
    initialLocationId: 'scene-test:location:rest',
    maxLocationVisits: 3,
    randomSeed: 481516,
    actors: [
      {
        id: ACTOR_A,
        type: 'student',
        hp: { initial: 3, min: 0, max: 3 },
        resources: { energy: { initial: 1, min: 0, max: 1 } },
        teamId: 'scene-test:team:party',
        targetPriorityActorIds: [ACTOR_B],
      },
      {
        id: ACTOR_B,
        type: 'student',
        hp: { initial: 3, min: 0, max: 3 },
        resources: { energy: { initial: 1, min: 0, max: 1 } },
        teamId: 'scene-test:team:party',
        targetPriorityActorIds: [ACTOR_A],
      },
    ],
    teams: [{ id: 'scene-test:team:party', resources: { focus: { initial: 1, min: 0, max: 1 } } }],
    locations: [{
      id: 'scene-test:location:rest',
      stage: 'scene',
      enabledActionIds: [ACTION_A_COSTLY, ACTION_A_FALLBACK, ACTION_B, ACTION_B_FALLBACK, ACTION_CARD, ACTION_FIXED],
      combinationRules: [],
      objectives: [{
        id: 'scene-test:objective:rest-progress',
        description: 'The Characters have completed enough Rest rounds.',
        kind: 'primary',
        predicate: { kind: 'track', trackId: 'scene-test:track:progress', operator: 'gte', value: 5 },
      }],
      routeEdges: [],
      scenes: [{
        id: 'rest',
        title: 'Rest',
        autoCharacterActions: true,
        actionMode: 'global',
        sceneActions: [{
          id: SCENE_ACTION_FIXED,
          actionId: ACTION_FIXED,
          scope: 'global',
          playerCost: 0,
          performerPolicy: 'selected-student',
          selectionPolicy: 'fixed',
        }],
        completion: { kind: 'track', trackId: 'scene-test:track:progress', operator: 'gte', value: 5 },
      }],
    }],
    tracks: [
      { id: 'scene-test:track:progress', initial: 0, min: 0, max: 20 },
      { id: 'scene-test:track:fixed', initial: 0, min: 0, max: 20 },
    ],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    playerRouteState: { playerCost: 0 },
  };
  const actions = [
    action(ACTION_A_COSTLY, { kind: 'actor', relation: 'any' }, [
      { kind: 'eventTrackDelta', trackId: 'scene-test:track:progress', amount: 1 },
    ], { scope: 'team', resourceId: 'focus', amount: 1 }),
    action(ACTION_A_FALLBACK, { kind: 'actor', relation: 'any' }, [
      { kind: 'actorHpDelta', recipient: 'target', amount: -1 },
      { kind: 'eventTrackDelta', trackId: 'scene-test:track:progress', amount: 1 },
    ]),
    action(ACTION_B, { kind: 'none' }, [
      { kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'energy', amount: 1 },
      { kind: 'eventTrackDelta', trackId: 'scene-test:track:progress', amount: 1 },
    ], { scope: 'team', resourceId: 'focus', amount: 1 }),
    action(ACTION_B_FALLBACK, { kind: 'none' }, [
      { kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'energy', amount: 1 },
      { kind: 'eventTrackDelta', trackId: 'scene-test:track:progress', amount: 1 },
    ]),
    action(ACTION_CARD, { kind: 'none' }, [
      { kind: 'teamResourceDelta', recipient: 'actorTeam', resourceId: 'focus', amount: 1 },
      { kind: 'eventTrackDelta', trackId: 'scene-test:track:fixed', amount: 2 },
    ], { scope: 'team', resourceId: 'focus', amount: 1 }),
    action(ACTION_FIXED, { kind: 'none' }, [
      { kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'energy', amount: 1 },
      { kind: 'teamResourceDelta', recipient: 'actorTeam', resourceId: 'focus', amount: 1 },
      { kind: 'eventTrackDelta', trackId: 'scene-test:track:fixed', amount: 1 },
    ], { scope: 'team', resourceId: 'focus', amount: 1 }),
  ];
  return {
    eventDefinition,
    actors: [student(ACTOR_A, [ACTION_A_COSTLY, ACTION_A_FALLBACK]), student(ACTOR_B, [ACTION_B, ACTION_B_FALLBACK])],
    actionDefinitions: actions,
    studentSkillRules: [],
  };
}

function waitOnlyInput(): OperationRunStartInput {
  const input = restStartInput();
  const eventDefinition: OperationEventDef = {
    ...input.eventDefinition,
    id: 'scene-test:event:rest-wait',
    locations: input.eventDefinition.locations.map(location => ({
      ...location,
      enabledActionIds: [],
      objectives: [{
        id: 'scene-test:objective:wait-exit',
        description: 'An external fact controls completion.',
        kind: 'primary' as const,
        predicate: { kind: 'knownFact' as const, factId: 'scene-test:fact:finish', present: true },
      }],
      scenes: location.scenes?.map(scene => ({
        ...scene,
        actionMode: undefined,
        sceneActions: undefined,
        completion: { kind: 'knownFact' as const, factId: 'scene-test:fact:finish', present: true },
      })),
    })),
    factIds: ['scene-test:fact:finish'],
  };
  return { ...input, eventDefinition };
}

describe('Scene Character automatic plans', () => {
  test('reserves the fixed Player operation first, falls through to affordable Character actions, and completes by Scene predicates', () => {
    const service = new OperationRuntimeService();
    let run = service.start(restStartInput());
    expect(service.getView()!.basePreparedBeat?.actorPlans).toEqual([
      expect.objectContaining({ actorId: ACTOR_A, kind: 'studentAction', actionId: ACTION_A_COSTLY, targetActorId: ACTOR_B }),
      expect.objectContaining({ actorId: ACTOR_B, kind: 'studentAction', actionId: ACTION_B_FALLBACK, targetActorId: null }),
    ]);

    const first = service.commitSceneActionBatch({ runId: run.runId, planVersion: run.planVersion, selections: [], skip: true });
    run = service.getSnapshot()!;
    expect(first.sceneBatch).toMatchObject({ skip: true, autoCharacterActions: true, sceneActionBatchesUsed: 1 });
    expect(first.sceneBatch?.selections).toContainEqual(expect.objectContaining({ sceneActionId: SCENE_ACTION_FIXED, actorId: ACTOR_A }));
    expect(first.actorPlans).toEqual([
      expect.objectContaining({ actorId: ACTOR_A, kind: 'studentAction', actionId: ACTION_A_FALLBACK, targetActorId: ACTOR_B }),
      expect.objectContaining({ actorId: ACTOR_B, kind: 'studentAction', actionId: ACTION_B_FALLBACK, targetActorId: null }),
    ]);
    expect(first.payments).toEqual([
      expect.objectContaining({ actorId: ACTOR_A, actionId: ACTION_FIXED }),
    ]);
    expect(first.numericChanges).toContainEqual(expect.objectContaining({ target: { kind: 'track', trackId: 'scene-test:track:fixed' }, delta: 1 }));
    expect(first.numericChanges).toContainEqual(expect.objectContaining({ target: { kind: 'track', trackId: 'scene-test:track:progress' }, delta: 2 }));
    expect(run.actorStates.find(actor => actor.id === ACTOR_B)?.hp).toBe(2);

    for (let round = 2; round <= 3; round += 1) {
      service.commitSceneActionBatch({ runId: run.runId, planVersion: run.planVersion, selections: [], skip: true });
      run = service.getSnapshot()!;
      if (round < 3) expect(run.status).toBe('inProgress');
    }
    expect(run.locationProgress['scene-test:location:rest']).toMatchObject({ completed: true, result: 'success' });
  });

  test('one Intervention changes only its Character plan and survives staged preview, cancellation, save/resume, and commit', () => {
    const input = restStartInput();
    const source = new OperationRuntimeService();
    let run = source.start(input);
    const defaultBeat = source.getView()!.effectivePreparedBeat!;
    expect(defaultBeat.actorPlans.find(plan => plan.actorId === ACTOR_A)?.targetActorId).toBe(ACTOR_B);
    const originalB = defaultBeat.actorPlans.find(plan => plan.actorId === ACTOR_B);

    const intervention = { runId: run.runId, planVersion: run.planVersion, draft: { actorId: ACTOR_A, targetActorId: ACTOR_A } } as const;
    expect(source.previewIntervention(intervention).preparedBeat.actorPlans.find(plan => plan.actorId === ACTOR_A)?.targetActorId).toBe(ACTOR_A);
    source.reviseIntervention(intervention);
    expect(source.getView()!.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === ACTOR_A)?.targetActorId).toBe(ACTOR_A);
    expect(source.getView()!.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === ACTOR_B)).toEqual(originalB);

    run = source.clearIntervention({ runId: run.runId, planVersion: source.getSnapshot()!.planVersion });
    expect(run.interventionDraft).toBeNull();
    expect(source.getView()!.effectivePreparedBeat?.actorPlans.find(plan => plan.actorId === ACTOR_A)?.targetActorId).toBe(ACTOR_B);
    const revised = source.reviseIntervention({
      runId: run.runId,
      planVersion: run.planVersion,
      draft: { actorId: ACTOR_A, targetActorId: ACTOR_A },
    });
    const beforeBadSelection = source.getSnapshot()!;
    expect(() => source.commitSceneActionBatch({
      runId: revised.runId,
      planVersion: revised.planVersion,
      selections: [{ sceneActionId: 'missing', targetActorIds: [] }],
    })).toThrow(/unavailable|unknown/);
    expect(source.getSnapshot()).toEqual(beforeBadSelection);
    const command = { runId: revised.runId, planVersion: revised.planVersion, selections: [], skip: true } as const;
    const preview = source.previewSceneActionBatch(command);
    expect(preview.actorPlans).toEqual([
      expect.objectContaining({ actorId: ACTOR_A, actionId: ACTION_A_FALLBACK, targetActorId: ACTOR_A }),
      expect.objectContaining({ actorId: ACTOR_B, actionId: ACTION_B_FALLBACK }),
    ]);
    expect(preview.intervention).toMatchObject({ actorId: ACTOR_A, before: { actionId: ACTION_A_FALLBACK, targetActorId: ACTOR_B }, after: { targetActorId: ACTOR_A } });

    const staged = source.stageSceneActionBatch(command);
    expect(source.getView()!.pendingSceneActionBatch?.preview.actorPlans).toEqual(preview.actorPlans);
    const afterStage = source.getSnapshot()!;
    source.clearSceneActionBatchDraft({ runId: staged.runId, planVersion: staged.planVersion });
    expect(source.getSnapshot()!.interventionDraft).toEqual(revised.interventionDraft);
    expect(source.getSnapshot()!.pendingSceneActionBatch).toBeNull();
    const stagedAgain = source.stageSceneActionBatch({
      runId: staged.runId,
      planVersion: source.getSnapshot()!.planVersion,
      selections: [],
      skip: true,
    });
    const checkpoint = source.createSaveSnapshot()!;
    const resumed = new OperationRuntimeService();
    expect(resumed.restoreSaveSnapshot(checkpoint, input)).toEqual(stagedAgain);
    const beforeRejected = resumed.getSnapshot()!;
    expect(() => resumed.commitSceneActionBatch({ runId: stagedAgain.runId, planVersion: stagedAgain.planVersion + 1, selections: [], skip: true })).toThrow(/stale/);
    expect(resumed.getSnapshot()).toEqual(beforeRejected);
    expect(resumed.getSnapshot()!.random.tacticalCursor).toBe(afterStage.random.tacticalCursor);

    const resolution = resumed.commitStagedSceneActionBatch({ runId: stagedAgain.runId, planVersion: stagedAgain.planVersion });
    expect(resolution.actorPlans.find(plan => plan.actorId === ACTOR_A)?.targetActorId).toBe(ACTOR_A);
    expect(resumed.getSnapshot()!.interventionDraft).toBeNull();
    expect(resumed.getSnapshot()!.preparedBeat?.actorPlans.find(plan => plan.actorId === ACTOR_A)?.targetActorId).toBe(ACTOR_B);
  });

  test('reserves a selected PlayerSceneCard before Character plans in the same Resolution', () => {
    const base = restStartInput();
    const input: OperationRunStartInput = {
      ...base,
      eventDefinition: {
        ...base.eventDefinition,
        teams: [{ id: 'scene-test:team:party', resources: { focus: { initial: 2, min: 0, max: 2 } } }],
        playerSceneDeck: {
          cards: [{ id: 'player-energy', actionId: ACTION_CARD, playerCost: 0, timing: 'scene', copies: 1 }],
          initialDraw: 1,
          locationEntryDraw: 0,
          maxHandSize: 1,
        },
      },
    };
    const service = new OperationRuntimeService();
    const run = service.start(input);
    const cardInstanceId = run.playerRouteState.cards.hand[0]!;
    const command = {
      runId: run.runId,
      planVersion: run.planVersion,
      selections: [],
      cards: [{ cardInstanceId, actorId: ACTOR_B, targetActorIds: [] }],
    } as const;
    const preview = service.previewSceneActionBatch(command);
    expect(preview.actorPlans).toEqual([
      expect.objectContaining({ actorId: ACTOR_A, actionId: ACTION_A_FALLBACK }),
      expect.objectContaining({ actorId: ACTOR_B, actionId: ACTION_B_FALLBACK }),
    ]);
    expect(preview.actionCosts).toEqual(expect.arrayContaining([
      expect.objectContaining({ actorId: ACTOR_A, actionId: ACTION_FIXED, resourceId: 'focus' }),
      expect.objectContaining({ actorId: ACTOR_B, actionId: ACTION_CARD, resourceId: 'focus' }),
    ]));
    const resolution = service.commitSceneActionBatch(command);
    expect(resolution.payments.map(payment => payment.actionId)).toEqual([ACTION_FIXED, ACTION_CARD]);
    expect(resolution.actorPlans.map(plan => plan.actionId)).toEqual([ACTION_A_FALLBACK, ACTION_B_FALLBACK]);
    expect(service.getSnapshot()!.playerRouteState.cards.discard).toContain(cardInstanceId);
  });

  test('all-Wait Scene batches remain in progress and do not turn Skip into automatic success', () => {
    const service = new OperationRuntimeService();
    const run = service.start(waitOnlyInput());
    expect(service.getView()!.canCommit).toBe(true);
    const resolution = service.commitSceneActionBatch({ runId: run.runId, planVersion: run.planVersion, selections: [], skip: true });
    expect(resolution.actorPlans).toEqual([
      expect.objectContaining({ actorId: ACTOR_A, kind: 'wait' }),
      expect.objectContaining({ actorId: ACTOR_B, kind: 'wait' }),
    ]);
    expect(service.getSnapshot()).toMatchObject({ status: 'inProgress' });
    expect(service.getSnapshot()!.locationProgress['scene-test:location:rest']).toMatchObject({ completed: false, sceneActionBatchesUsedByScene: { rest: 1 } });
  });

  test('restores the Scene Hand round from visit and batch counters without advancing Combat beatIndex', () => {
    const input = restStartInput();
    const uninterrupted = new OperationRuntimeService();
    let expected = uninterrupted.start(input);
    uninterrupted.commitSceneActionBatch({ runId: expected.runId, planVersion: expected.planVersion, selections: [], skip: true });
    expected = uninterrupted.getSnapshot()!;
    const checkpoint = uninterrupted.createSaveSnapshot()!;

    const resumed = new OperationRuntimeService();
    expect(resumed.restoreSaveSnapshot(checkpoint, input)).toEqual(expected);
    expect(resumed.getSnapshot()!.beatIndex).toBe(expected.beatIndex);
    expect(resumed.getSnapshot()!.characterHands).toEqual(expected.characterHands);
    expect(resumed.getSnapshot()!.preparedBeat).toEqual(expected.preparedBeat);

    const expectedNext = uninterrupted.commitSceneActionBatch({
      runId: expected.runId, planVersion: expected.planVersion, selections: [], skip: true,
    });
    const resumedNext = resumed.commitSceneActionBatch({
      runId: expected.runId, planVersion: expected.planVersion, selections: [], skip: true,
    });
    expect(resumedNext).toEqual(expectedNext);
    expect(resumed.getSnapshot()!.beatIndex).toBe(expected.beatIndex);
  });

  test('Scene Hand random words are pure and address Event/Actor/Location/Scene/visit/batch context', () => {
    const context = [481516, ACTOR_A, 'scene-test:location:rest', 'rest', 2, 3, 0] as const;
    const word = operationCharacterSceneHandWordAt(...context);
    expect(operationCharacterSceneHandWordAt(...context)).toBe(word);
    expect(operationCharacterSceneHandWordAt(481516, ACTOR_B, 'scene-test:location:rest', 'rest', 2, 3, 0)).not.toBe(word);
    expect(operationCharacterSceneHandWordAt(481516, ACTOR_A, 'scene-test:location:other', 'rest', 2, 3, 0)).not.toBe(word);
    expect(operationCharacterSceneHandWordAt(481516, ACTOR_A, 'scene-test:location:rest', 'other', 2, 3, 0)).not.toBe(word);
    expect(operationCharacterSceneHandWordAt(481516, ACTOR_A, 'scene-test:location:rest', 'rest', 3, 3, 0)).not.toBe(word);
    expect(operationCharacterSceneHandWordAt(481516, ACTOR_A, 'scene-test:location:rest', 'rest', 2, 4, 0)).not.toBe(word);
  });
});
