import { afterEach, describe, expect, test } from 'vitest';
import { OPERATION_WAIT_ACTION_ID, type OperationEventDef } from '../../src/arona-clicker/contracts/operation';
import type { OperationContentResolver, OperationResolvedContent } from '../../src/arona-clicker/contracts/operation-content-resolver';
import type { StudentOperationProfileDef } from '../../src/arona-clicker/contracts/student-operation-profile';
import type { OperationActionDef } from '../../src/arona-clicker/contracts/operation-action';
import type { OperationStudentSkillRuleDef } from '../../src/arona-clicker/contracts/operation-skill';
import {
  OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE,
  OPERATION_WAIT_REASON_NO_LEGAL_TARGET,
} from '../../src/arona-clicker/contracts/operation-beat';
import { Character } from '../../src/arona-clicker/types/ids';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { OperationRuntimeError } from '../../src/arona-clicker/services/operation-runtime-service';
import { baseDatapack } from '../../src/data/test-datapack';

const EVENT_ID = 'test:operation:integration';
const HOSHINO_PROFILE: StudentOperationProfileDef = {
  id: 'test:operation-profile:hoshino',
  characterId: Character.Hoshino,
  candidateActionIds: ['observe', 'protect'],
  actionPriorityIds: ['protect', 'observe'],
  capabilityIds: ['frontline-protection'],
  reasonIds: ['hoshino-veteran'],
  randomSkillRuleId: 'test:skill-rule:hoshino',
};
const SERIKA_PROFILE: StudentOperationProfileDef = {
  id: 'test:operation-profile:serika',
  characterId: Character.Serika,
  candidateActionIds: ['observe', 'organize'],
  actionPriorityIds: ['organize', 'observe'],
  capabilityIds: ['resourcefulness'],
  reasonIds: ['serika-practical'],
};

function eventDef(): OperationEventDef {
  return {
    id: EVENT_ID,
    locations: [{ id: 'test:location:office', enabledActionIds: ['observe', 'protect', 'organize'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    initialLocationId: 'test:location:office',
    tracks: [{ id: 'danger', initial: 1, min: 0, max: 5 }],
    factIds: ['door_open'],
    knownFactIds: [],
    itemIds: ['archive_key'],
    heldItemIds: [],
    actors: [
      { id: 'test:actor:student-slot', type: 'student', hp: { initial: 4, min: 0, max: 4 } },
      { id: 'test:actor:opponent', type: 'opponent', hp: { initial: 5, min: 0, max: 5 } },
    ],
    playerRouteState: {
      playerCost: 2,
    },
    randomSeed: 17,
  };
}

function actionDefinitions(): OperationActionDef[] {
  return [
    { id: 'observe', allowedParticipantKinds: ['student'], requiredCapabilityIds: [], reasonIds: ['test:reason:observe'], tagIds: [], target: { kind: 'none' }, effects: [] },
    { id: 'protect', allowedParticipantKinds: ['student'], requiredCapabilityIds: ['frontline-protection'], reasonIds: ['test:reason:protection'], tagIds: [], target: { kind: 'none' }, effects: [] },
    { id: 'organize', allowedParticipantKinds: ['student'], requiredCapabilityIds: ['resourcefulness'], reasonIds: ['test:reason:organize'], tagIds: [], target: { kind: 'none' }, effects: [] },
  ];
}

function studentSkillRules(): OperationStudentSkillRuleDef[] {
  return [{ id: 'test:skill-rule:hoshino', triggerActionIds: ['protect'], chanceBps: 2000, effects: [] }];
}

function resolvedContent(changes: Partial<OperationResolvedContent> = {}): OperationResolvedContent {
  return {
    eventDefinition: eventDef(),
    participants: [
      { actorId: 'test:actor:student-slot', kind: 'student' },
      { actorId: 'test:actor:opponent', kind: 'opponent', factionId: 'test:faction:enemy', candidateActionIds: [] },
    ],
    studentProfiles: [HOSHINO_PROFILE, SERIKA_PROFILE],
    actionDefinitions: actionDefinitions(),
    studentSkillRules: studentSkillRules(),
    ...changes,
  };
}

function resolverOf(content: OperationResolvedContent | null = resolvedContent()): OperationContentResolver {
  return { resolve: eventId => eventId === EVENT_ID ? content : null };
}

function stateSnapshot(game: GameInstance): string {
  return JSON.stringify(game.state);
}

describe('Gameplay B Operation entry integration', () => {
  const games: GameInstance[] = [];

  function createGame(resolver: OperationContentResolver = resolverOf()): GameInstance {
    const game = new GameInstance({ operationContentResolver: resolver });
    games.push(game);
    game.init([baseDatapack], { enterDefaultInit: false });
    return game;
  }

  function ownHoshino(game: GameInstance): void {
    game.mutations.acquireCharacter('Hoshino', 'story');
  }

  afterEach(() => {
    for (const game of games.splice(0)) {
      if (game.running) game.stop();
    }
  });

  test('keeps EventRuns isolated per GameInstance and exposes only ID entry plus detached snapshots', () => {
    const first = createGame();
    const second = createGame();
    ownHoshino(first);
    ownHoshino(second);
    const firstState = stateSnapshot(first);
    const secondState = stateSnapshot(second);

    expect('operationRuntime' in first).toBe(false);
    expect(Object.keys(first.operationEntry).sort()).toEqual([
      'clearIntervention', 'clearSceneActionBatchDraft', 'commitBeat', 'commitSceneActionBatch',
      'commitStagedSceneActionBatch', 'createSaveSnapshot', 'getLastRestoreResult', 'getResult',
      'getSnapshot', 'getView', 'previewIntervention', 'previewSceneActionBatch', 'restoreSaveSnapshot',
      'reviseIntervention', 'stageSceneActionBatch', 'start', 'transitionRoute',
    ]);
    expect('reset' in first.operationEntry).toBe(false);
    expect('dispose' in first.operationEntry).toBe(false);

    const firstRun = first.operationEntry.start(EVENT_ID, [Character.Hoshino]);
    const secondRun = second.operationEntry.start(EVENT_ID, [Character.Hoshino]);
    expect(firstRun.runId).not.toBe(secondRun.runId);
    expect(firstRun.actorStates[0]).toMatchObject({
      participantKind: 'student',
      characterId: Character.Hoshino,
      profile: {
        id: HOSHINO_PROFILE.id,
        eligibleActionIds: ['protect', 'observe'],
      },
    });
    expect(firstRun.actorStates[1]).toMatchObject({
      participantKind: 'opponent',
      factionId: 'test:faction:enemy',
    });
    expect(first.operationEntry.getSnapshot()).toEqual(firstRun);
    expect(second.operationEntry.getSnapshot()).toEqual(secondRun);
    expect(Object.isFrozen(first.operationEntry.getSnapshot())).toBe(true);
    expect(first.operationEntry.getSnapshot()).not.toBe(first.operationEntry.getSnapshot());
    expect(stateSnapshot(first)).toBe(firstState);
    expect(stateSnapshot(second)).toBe(secondState);
    expect(firstRun).toMatchObject({
      planVersion: 0,
      beatIndex: 0,
      preparedBeat: { planVersion: 0 },
      interventionDraft: null,
      resolutions: [],
      resolutionSequence: 0,
      random: { seed: 17, tacticalCursor: 0 },
    });
    expect(firstRun.preparedBeat?.actorPlans.find(plan => plan.actorId === 'test:actor:student-slot'))
      .toMatchObject({ kind: 'studentAction', actionId: 'protect' });
  });

  test('projects detached legal choices and combinations without resolving content or advancing the Run', () => {
    let resolverCalls = 0;
    const game = createGame({
      resolve: eventId => {
        resolverCalls += 1;
        return resolverOf().resolve(eventId);
      },
    });
    ownHoshino(game);
    const run = game.operationEntry.start(EVENT_ID, [Character.Hoshino]);
    expect(resolverCalls).toBe(1);
    const before = game.operationEntry.getSnapshot()!;
    const stateBefore = stateSnapshot(game);

    const view = game.operationEntry.getView(run.runId)!;
    expect(view).toMatchObject({
      runId: run.runId,
      eventId: EVENT_ID,
      status: 'inProgress',
      planVersion: before.planVersion,
      beatIndex: before.beatIndex,
      canCommit: true,
      combinationPreview: { planVersion: before.planVersion, matches: [] },
    });
    const student = view.actorStates.find(actor => actor.characterId === Character.Hoshino)!;
    expect(student.currentPlan).toMatchObject({ kind: 'studentAction', actionId: 'protect' });
    expect(student.profile?.actionOptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionId: 'protect', eligible: true, selectable: true }),
      expect.objectContaining({ actionId: 'observe', eligible: true, selectable: true }),
    ]));
    expect('random' in view).toBe(false);
    expect('actionDefinitions' in view).toBe(false);
    expect(Object.isFrozen(view.actorStates[0].resources)).toBe(true);
    expect(Object.isFrozen(student.profile?.actionOptions)).toBe(true);
    expect(game.operationEntry.getView('a-stale-run-id')).toBeNull();

    const viewJson = JSON.stringify(view);
    game.operationEntry.getView(run.runId);
    expect(resolverCalls).toBe(1);
    expect(JSON.stringify(game.operationEntry.getSnapshot())).toBe(JSON.stringify(before));
    expect(stateSnapshot(game)).toBe(stateBefore);
    expect(game.operationEntry.getView(run.runId)).not.toBe(view);
    expect(JSON.stringify(game.operationEntry.getView(run.runId))).toBe(viewJson);
    expect(() => { (view.tracks as Record<string, number>).danger = 99; }).toThrow();
  });

  test('combination view follows a revised plan and committed view records its Resolution', () => {
    const game = createGame();
    ownHoshino(game);
    const run = game.operationEntry.start(EVENT_ID, [Character.Hoshino]);
    const command = { runId: run.runId, planVersion: run.planVersion };
    game.operationEntry.reviseIntervention({
      ...command,
      draft: { actorId: 'test:actor:student-slot', actionId: 'observe', reasonId: 'test:reason:observe' },
    });
    const revised = game.operationEntry.getSnapshot()!;
    expect(game.operationEntry.getView(run.runId)?.effectivePreparedBeat?.actorPlans[0])
      .toMatchObject({ actionId: 'observe', kind: 'studentAction' });

    const resolution = game.operationEntry.commitBeat({ runId: run.runId, planVersion: revised.planVersion });
    const beforeRead = game.operationEntry.getSnapshot()!;
    const viewAfterCommit = game.operationEntry.getView(run.runId)!;
    expect(viewAfterCommit).toMatchObject({
      resolutionSequence: resolution.resolutionSequence,
      beatIndex: beforeRead.beatIndex,
      planVersion: beforeRead.planVersion,
    });
    expect(viewAfterCommit.resolutions[0]).toMatchObject({
      runId: resolution.runId,
      eventId: resolution.eventId,
      resolutionSequence: resolution.resolutionSequence,
      actorPlans: resolution.actorPlans,
      combinations: resolution.combinations,
      numericChanges: resolution.numericChanges,
    });
    expect('randomCursorBefore' in viewAfterCommit.resolutions[0]).toBe(false);
    expect('randomCursorAfter' in viewAfterCommit.resolutions[0]).toBe(false);
    expect(viewAfterCommit.resolutions[0].studentSkillChecks.every(check => !('rollBps' in check)
      && !('chanceBps' in check) && !('rawWordsConsumed' in check))).toBe(true);
    expect(game.operationEntry.getSnapshot()?.random).toEqual(beforeRead.random);
    expect(game.operationEntry.getView('a-stale-run-id')).toBeNull();
  });

  test('projects Team costs, target priority, rejected Team-cost alternatives, and non-empty combinations', () => {
    const base = resolvedContent();
    const teamId = 'test:team:students';
    const hoshinoActorId = 'test:actor:hoshino';
    const serikaActorId = 'test:actor:serika';
    const opponentActorId = 'test:actor:opponent';
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      teams: [{ id: teamId, resources: { coordination: { initial: 1, min: 0, max: 1 } } }],
      actors: [
        { id: hoshinoActorId, type: 'student', hp: { initial: 4, min: 0, max: 4 }, teamId, targetPriorityActorIds: [opponentActorId, serikaActorId] },
        { id: serikaActorId, type: 'student', hp: { initial: 4, min: 0, max: 4 }, teamId, targetPriorityActorIds: [opponentActorId, hoshinoActorId] },
        { id: opponentActorId, type: 'opponent', hp: { initial: 5, min: 0, max: 5 } },
      ],
      locations: [{ id: 'test:location:office', enabledActionIds: ['protect', 'observe', 'organize'], combinationRules: [{
          id: 'test:combination:protect-signal',
          priority: 10,
          inputTagIds: ['brace', 'signal'],
          targetMatch: 'same-target',
          effects: [{ kind: 'eventTrackDelta', trackId: 'danger', amount: -1 }],
        }], routeEdges: [] } ], maxLocationVisits: 20,
    };
    const actionDefinitions: OperationActionDef[] = [
      {
        id: 'protect',
        allowedParticipantKinds: ['student'],
        requiredCapabilityIds: ['frontline-protection'],
        reasonIds: ['test:reason:protection'],
        tagIds: ['brace'],
        target: { kind: 'actor', relation: 'any' },
        effects: [],
      },
      {
        id: 'observe',
        allowedParticipantKinds: ['student'],
        requiredCapabilityIds: [],
        reasonIds: ['test:reason:observe'],
        tagIds: [],
        cost: { scope: 'team', resourceId: 'coordination', amount: 1 },
        target: { kind: 'none' },
        effects: [],
      },
      {
        id: 'organize',
        allowedParticipantKinds: ['student'],
        requiredCapabilityIds: ['resourcefulness'],
        reasonIds: ['test:reason:organize'],
        tagIds: ['signal'],
        cost: { scope: 'team', resourceId: 'coordination', amount: 1 },
        target: { kind: 'actor', relation: 'any' },
        effects: [],
      },
    ];
    const content = resolvedContent({
      eventDefinition,
      participants: [
        { actorId: hoshinoActorId, kind: 'student' },
        { actorId: serikaActorId, kind: 'student' },
        { actorId: opponentActorId, kind: 'opponent', factionId: 'test:faction:enemy', candidateActionIds: [] },
      ],
      studentProfiles: [HOSHINO_PROFILE, SERIKA_PROFILE],
      actionDefinitions,
    });
    const game = createGame(resolverOf(content));
    ownHoshino(game);
    game.mutations.acquireCharacter('Serika', 'story');
    const run = game.operationEntry.start(EVENT_ID, [Character.Hoshino, Character.Serika]);
    const view = game.operationEntry.getView(run.runId)!;
    const hoshino = view.actorStates.find(actor => actor.id === hoshinoActorId)!;
    const hoshinoOptions = hoshino.profile!.actionOptions;
    const protect = hoshinoOptions.find(option => option.actionId === 'protect')!;
    const observe = hoshinoOptions.find(option => option.actionId === 'observe')!;

    expect(protect.defaultTargetActorId).toBe(opponentActorId);
    expect(protect.legalTargetActorIds[0]).toBe(opponentActorId);
    expect(protect.legalTargetActorIds).toEqual([opponentActorId, serikaActorId, hoshinoActorId]);
    expect(observe).toMatchObject({
      cost: { scope: 'team', resourceId: 'coordination', amount: 1 },
      selectable: false,
      blockedReasonIds: ['operation:intervention:plan-conflict'],
    });
    expect(view.combinationPreview?.matches).toEqual([expect.objectContaining({
      ruleId: 'test:combination:protect-signal',
      actorAId: hoshinoActorId,
      actorBId: serikaActorId,
      targetActorId: opponentActorId,
    })]);

    for (const targetActorId of protect.legalTargetActorIds) {
      const preview = game.operationEntry.previewIntervention({
        runId: run.runId,
        planVersion: run.planVersion,
        draft: { actorId: hoshinoActorId, actionId: 'protect', targetActorId },
      });
      expect(preview.preparedBeat.actorPlans.find(plan => plan.actorId === hoshinoActorId)?.targetActorId)
        .toBe(targetActorId);
    }
  });

  test('sanitizes RNG measurements from committed OperationView resolutions', () => {
    const game = createGame();
    ownHoshino(game);
    const run = game.operationEntry.start(EVENT_ID, [Character.Hoshino]);
    game.operationEntry.commitBeat({ runId: run.runId, planVersion: run.planVersion });
    const viewResolution = game.operationEntry.getView(run.runId)!.resolutions[0];

    expect(viewResolution.studentSkillChecks).toHaveLength(1);
    expect(viewResolution.studentSkillChecks[0]).toMatchObject({
      actorId: 'test:actor:student-slot',
      skillRuleId: 'test:skill-rule:hoshino',
      actionId: 'protect',
    });
    expect(viewResolution.studentSkillChecks[0]).toHaveProperty('succeeded');
    expect('randomCursorBefore' in viewResolution).toBe(false);
    expect('randomCursorAfter' in viewResolution).toBe(false);
    expect('rollBps' in viewResolution.studentSkillChecks[0]).toBe(false);
    expect('chanceBps' in viewResolution.studentSkillChecks[0]).toBe(false);
    expect('rawWordsConsumed' in viewResolution.studentSkillChecks[0]).toBe(false);
  });

  test('returns no OperationView before a run exists or when the configured content is absent', () => {
    const withoutRun = createGame();
    expect(withoutRun.operationEntry.getView()).toBeNull();

    const withoutContent = createGame(resolverOf(null));
    ownHoshino(withoutContent);
    expect(() => withoutContent.operationEntry.start(EVENT_ID, [Character.Hoshino])).toThrow();
    expect(withoutContent.operationEntry.getView()).toBeNull();
  });

  test.each([
    ['insufficient actor resource', OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE],
    ['no legal target', OPERATION_WAIT_REASON_NO_LEGAL_TARGET],
  ])('disables Commit and exposes a reason when every student Action is blocked by %s', (_label, expectedReason) => {
    const base = resolvedContent();
    const studentActions = base.actionDefinitions.map(action => ({
      ...action,
      ...(expectedReason === OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE
        ? { cost: { scope: 'actor' as const, resourceId: 'stamina', amount: 1 } }
        : { target: { kind: 'actor' as const, relation: 'sameTeam' as const } }),
    }));
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      actors: base.eventDefinition.actors.map(actor => actor.type === 'student'
        ? {
          ...actor,
          ...(expectedReason === OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE
            ? { resources: { stamina: { initial: 0, min: 0, max: 1 } } }
            : {}),
        }
        : actor),
    };
    const game = createGame(resolverOf({ ...base, eventDefinition, actionDefinitions: studentActions }));
    ownHoshino(game);
    const run = game.operationEntry.start(EVENT_ID, [Character.Hoshino]);
    const view = game.operationEntry.getView(run.runId)!;
    const student = view.actorStates.find(actor => actor.characterId === Character.Hoshino)!;

    expect(student.currentPlan).toMatchObject({ kind: 'wait', reasonIds: [expectedReason] });
    expect(view.canCommit).toBe(false);
    expect(view.commitBlockedReasonIds).toContain(expectedReason);
    expect(student.profile?.actionOptions.every(option => !option.selectable)).toBe(true);
    if (expectedReason === OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE) {
      expect(student.profile?.actionOptions.every(option => option.cost?.scope === 'actor'
        && option.cost.resourceId === 'stamina' && option.cost.amount === 1)).toBe(true);
    }
    expect(student.profile?.actionOptions.some(option => option.blockedReasonIds.includes(
      expectedReason === OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE
        ? 'operation:intervention:action-not-affordable'
        : 'operation:intervention:no-legal-target',
    ))).toBe(true);
  });

  test('previews, revises, clears, commits, and retries one versioned Beat through the narrow facade', () => {
    const game = createGame();
    ownHoshino(game);
    const initial = game.operationEntry.start(EVENT_ID, [Character.Hoshino]);
    const startState = game.operationEntry.getSnapshot()!;
    const command = { runId: initial.runId, planVersion: initial.planVersion };
    const preview = game.operationEntry.previewIntervention({
      ...command,
      draft: { actorId: 'test:actor:student-slot', actionId: 'observe', reasonId: 'test:reason:observe' },
    });

    expect(preview.preparedBeat.actorPlans[0]).toMatchObject({ actionId: 'observe', kind: 'studentAction' });
    expect(game.operationEntry.getSnapshot()).toEqual(startState);
    expect(Object.isFrozen(preview)).toBe(true);
    expect(() => game.operationEntry.reviseIntervention({
      ...command,
      draft: { actorId: 'test:actor:opponent', actionId: 'observe' },
    })).toThrow(OperationRuntimeError);
    expect(game.operationEntry.getSnapshot()).toEqual(startState);

    const revised = game.operationEntry.reviseIntervention({
      ...command,
      draft: { actorId: 'test:actor:student-slot', actionId: 'observe', reasonId: 'test:reason:observe' },
    });
    expect(revised).toMatchObject({
      planVersion: 1,
      preparedBeat: { planVersion: 1 },
      interventionDraft: { actorId: 'test:actor:student-slot', actionId: 'observe' },
    });
    expect(revised.preparedBeat?.actorPlans.find(plan => plan.actorId === 'test:actor:student-slot'))
      .toMatchObject({ actionId: 'protect' });
    expect(() => game.operationEntry.commitBeat(command)).toThrow(/stale/);
    const cleared = game.operationEntry.clearIntervention({ runId: initial.runId, planVersion: 1 });
    expect(cleared).toMatchObject({ planVersion: 2, interventionDraft: null, preparedBeat: { planVersion: 2 } });
    expect(game.operationEntry.clearIntervention({ runId: initial.runId, planVersion: 2 })).toEqual(cleared);
    expect(() => game.operationEntry.previewIntervention({
      runId: initial.runId,
      planVersion: 2,
      draft: { actorId: 'test:actor:opponent', actionId: 'observe' },
    })).toThrow(OperationRuntimeError);
    expect(game.operationEntry.getSnapshot()).toEqual(cleared);

    const beforeCommit = game.operationEntry.getSnapshot()!;
    const resolution = game.operationEntry.commitBeat({ runId: initial.runId, planVersion: 2 });
    expect(resolution).toMatchObject({
      runId: initial.runId,
      basePlanVersion: 2,
      locationId: 'test:location:office',
      resolutionSequence: 1,
      studentSkillChecks: [{ actorId: 'test:actor:student-slot', skillRuleId: 'test:skill-rule:hoshino', actionId: 'protect' }],
    });
    expect(resolution.actorPlans.find(plan => plan.actorId === 'test:actor:student-slot')).toMatchObject({ actionId: 'protect' });
    expect(game.operationEntry.getSnapshot()).toMatchObject({
      planVersion: 3,
      beatIndex: 1,
      interventionDraft: null,
      resolutionSequence: 1,
      random: { tacticalCursor: 1 },
      resolutions: [resolution],
    });
    expect(game.operationEntry.getSnapshot()!.playerRouteState).toEqual(beforeCommit.playerRouteState);
    const afterCommit = game.operationEntry.getSnapshot();
    expect(game.operationEntry.commitBeat({ runId: initial.runId, planVersion: 2 })).toEqual(resolution);
    expect(game.operationEntry.getSnapshot()).toEqual(afterCommit);
    expect(Object.isFrozen(resolution)).toBe(true);
  });

  test('public GameInstance entry rejects an unowned student without creating a Run', () => {
    const game = createGame();

    expect(() => game.operationEntry.start(EVENT_ID, [Character.Hoshino])).toThrow(/no owned Registry Variant/);
    expect(game.operationEntry.getSnapshot()).toBeNull();

    ownHoshino(game);
    expect(game.operationEntry.start(EVENT_ID, [Character.Hoshino]).eventId).toBe(EVENT_ID);
    expect(game.operationEntry.getSnapshot()).not.toBeNull();
  });

  test('rejects the reserved Wait action as a Profile candidate before the owner creates a Run', () => {
    const waitProfile: StudentOperationProfileDef = {
      ...HOSHINO_PROFILE,
      candidateActionIds: [OPERATION_WAIT_ACTION_ID],
      actionPriorityIds: [OPERATION_WAIT_ACTION_ID],
    };
    const game = createGame(resolverOf(resolvedContent({ studentProfiles: [waitProfile] })));
    ownHoshino(game);

    expect(() => game.operationEntry.start(EVENT_ID, [Character.Hoshino]))
      .toThrow(/reserved Wait fallback action ID/);
    expect(game.operationEntry.getSnapshot()).toBeNull();
  });

  test('clears volatile Runs at init, reset, load, and reload while stop preserves a Run', () => {
    const game = createGame();
    ownHoshino(game);
    const startRun = () => game.operationEntry.start(EVENT_ID, [Character.Hoshino]);

    startRun();
    game.stop();
    expect(game.operationEntry.getSnapshot()).not.toBeNull();

    game.reset();
    expect(game.operationEntry.getSnapshot()).toBeNull();
    expect(() => startRun()).toThrow(/no owned Registry Variant/);
    ownHoshino(game);
    expect(() => startRun()).not.toThrow();

    const save = game.save();
    game.load(save);
    expect(game.operationEntry.getSnapshot()).toBeNull();
    expect(() => startRun()).not.toThrow();

    game.reload([baseDatapack], { enterDefaultInit: false });
    expect(game.operationEntry.getSnapshot()).toBeNull();
    ownHoshino(game);
    expect(() => startRun()).not.toThrow();

    game.init([], { enterDefaultInit: false });
    expect(game.operationEntry.getSnapshot()).toBeNull();
    expect(() => startRun()).toThrow(/unknown or invalid Character/);
  });

  test('dispose clears the Run and prevents later admission from writing', () => {
    const game = createGame();
    ownHoshino(game);
    game.operationEntry.start(EVENT_ID, [Character.Hoshino]);

    game.dispose();

    expect(game.running).toBe(false);
    expect(game.operationEntry.getSnapshot()).toBeNull();
    expect(() => game.operationEntry.start(EVENT_ID, [Character.Hoshino])).toThrow(/disposed/);
    expect(game.operationEntry.getSnapshot()).toBeNull();
  });

  test('custom no-op Wiring receives a closed entry facade, never the owner', () => {
    const game = new GameInstance({ wiring: () => undefined, operationContentResolver: resolverOf() });

    expect(game.operationEntry.getSnapshot()).toBeNull();
    expect(() => game.operationEntry.start(EVENT_ID, [Character.Hoshino])).toThrow(/services are not wired/);
    expect('operationRuntime' in game).toBe(false);
  });
});
