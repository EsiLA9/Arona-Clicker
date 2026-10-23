import { describe, expect, test } from 'vitest';
import type {
  OperationActorDef,
  OperationActorInitialization,
  OperationEventDef,
  OperationStudentProfileSnapshot,
  OperationTeamState,
} from '../../src/arona-clicker/contracts/operation/operation';
import type { OperationActionDef, OperationActionTargetDef } from '../../src/arona-clicker/contracts/operation/operation-action';
import type {
  OperationInterventionDraft,
  OperationInterventionPreviewInput,
  OperationPreparationActorSnapshot,
  OperationPreparationContent,
  OperationPreparationSnapshot,
} from '../../src/arona-clicker/contracts/operation/operation-beat';
import { prepareOperationBeat } from '../../src/arona-clicker/services/operation/operation-plan-preparation';
import {
  OperationInterventionPreviewError,
  previewOperationIntervention,
} from '../../src/arona-clicker/services/operation/operation-intervention-preview';

function actor(
  id: string,
  participantKind: 'student' | 'opponent' | 'environment',
  options: { type?: string; teamId?: string; targetPriorityActorIds?: readonly string[]; resources?: OperationActorDef['resources'] } = {},
): OperationActorDef {
  return {
    id,
    type: options.type ?? participantKind,
    hp: { initial: 3, min: 0, max: 3 },
    ...(options.teamId ? { teamId: options.teamId } : {}),
    ...(options.targetPriorityActorIds ? { targetPriorityActorIds: options.targetPriorityActorIds } : {}),
    ...(options.resources ? { resources: options.resources } : {}),
  };
}

function action(
  id: string,
  kinds: OperationActionDef['allowedParticipantKinds'],
  options: { target?: OperationActionTargetDef; cost?: OperationActionDef['cost'] } = {},
): OperationActionDef {
  return {
    id,
    title: id,
    allowedParticipantKinds: kinds,
    requiredCapabilityIds: [],
    reasonIds: ['reason:' + id],
    tagIds: [],
    ...(options.cost ? { cost: options.cost } : {}),
    target: options.target ?? { kind: 'none' },
    effects: [],
  };
}

function studentInitialization(actorId: string, candidateActionIds: readonly string[]): OperationActorInitialization {
  const actionCandidates = candidateActionIds.map(actionId => ({
    actionId,
    eligible: true,
    requiredCapabilityIds: [],
    missingCapabilityIds: [],
    reasonIds: ['reason:' + actionId],
  }));
  const profile: OperationStudentProfileSnapshot = {
    id: 'profile:' + actorId,
    characterId: 'character:' + actorId,
    candidateActionIds,
    actionPriorityIds: [],
    capabilityIds: [],
    reasonIds: [],
    actionCandidates,
    eligibleActionIds: candidateActionIds,
  };
  return { actorId, participantKind: 'student', characterId: profile.characterId, profile };
}

function studentInitializationWithPriority(
  actorId: string,
  candidateActionIds: readonly string[],
  actionPriorityIds: readonly string[],
): OperationActorInitialization {
  const initialization = studentInitialization(actorId, candidateActionIds);
  if (initialization.participantKind !== 'student') return initialization;
  return { ...initialization, profile: { ...initialization.profile, actionPriorityIds } };
}

function opponentInitialization(actorId: string, candidateActionIds: readonly string[]): OperationActorInitialization {
  return { actorId, participantKind: 'opponent', candidateActionIds };
}

function eventDefinition(
  actors: readonly OperationActorDef[],
  options: { teams?: OperationEventDef['teams']; enabledActionIds?: readonly string[] } = {},
): OperationEventDef {
  return {
    id: 'test:operation:intervention',
    locations: [{ id: 'location:office', stage: 'combat', enabledActionIds: [], combinationRules: [], routeEdges: [] }, { id: 'location:arcade', stage: 'combat', enabledActionIds: [], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    initialLocationId: 'location:office',
    tracks: [],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors,
    ...(options.teams ? { teams: options.teams } : {}),
    ...(options.enabledActionIds ? {
      locations: [{ id: 'location:office', stage: 'combat', enabledActionIds: options.enabledActionIds, combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    } : {}),
    playerRouteState: { playerCost: 9 },
  };
}

function snapshot(
  actors: readonly OperationPreparationActorSnapshot[],
  teams: readonly OperationTeamState[] = [],
  planVersion = 7,
): OperationPreparationSnapshot {
  return {
    eventId: 'test:operation:intervention',
    planVersion,
    currentLocationId: 'location:office',
    actors,
    teams,
  };
}

function previewInput(
  event: OperationEventDef,
  actors: readonly OperationActorInitialization[],
  actions: readonly OperationActionDef[],
  actorSnapshots: readonly OperationPreparationActorSnapshot[],
  draft: OperationInterventionDraft,
  teams: readonly OperationTeamState[] = [],
  currentDraft: OperationInterventionDraft | null = null,
): OperationInterventionPreviewInput {
  const preparationSnapshot = snapshot(actorSnapshots, teams);
  const trustedContent: OperationPreparationContent = { eventDefinition: event, actors, actionDefinitions: actions };
  return {
    snapshot: preparationSnapshot,
    trustedContent,
    preparedBeat: prepareOperationBeat(preparationSnapshot, trustedContent),
    currentDraft,
    draft,
  };
}

function errorCode(run: () => unknown, expected: string): void {
  try {
    run();
    expect.fail('expected OperationInterventionPreviewError');
  } catch (error) {
    expect(error).toBeInstanceOf(OperationInterventionPreviewError);
    expect((error as OperationInterventionPreviewError).code).toBe(expected);
  }
}

describe('pure Operation Intervention Draft preview', () => {
  test('selects an Action from the current Character Hand and rejects a Profile Action outside that Hand', () => {
    const student = actor('actor:student', 'student');
    const event = eventDefinition([student], { enabledActionIds: ['student:static', 'student:pool-only'] });
    const initialization = studentInitialization(student.id, ['student:static']);
    const actions = [action('student:static', ['student']), action('student:pool-only', ['student'])];
    const handInput = previewInput(
      event,
      [initialization],
      actions,
      [{ actorId: student.id, participantKind: 'student', resources: {} }],
      { actorId: student.id, actionId: 'student:pool-only' },
    );
    const snapshotWithHand = {
      ...handInput.snapshot,
      studentActionIdsByActorId: { [student.id]: ['student:pool-only'] },
    };
    const input = {
      ...handInput,
      snapshot: snapshotWithHand,
      preparedBeat: prepareOperationBeat(snapshotWithHand, handInput.trustedContent),
    };

    expect(previewOperationIntervention(input).preparedBeat.actorPlans[0].actionId).toBe('student:pool-only');
    errorCode(() => previewOperationIntervention({
      ...input,
      draft: { actorId: student.id, actionId: 'student:static' },
    }), 'operation:intervention:action-not-in-hand');
  });

  test('action-only Draft uses U4 auto-targeting and leaves every other Actor plan unchanged', () => {
    const student = actor('actor:student', 'student', { targetPriorityActorIds: ['actor:ally'] });
    const ally = actor('actor:ally', 'student');
    const opponent = actor('actor:opponent', 'opponent');
    const event = eventDefinition([student, ally, opponent], {
      enabledActionIds: ['student:observe', 'student:assist', 'enemy:watch'],
    });
    const input = previewInput(event, [
      studentInitializationWithPriority(student.id, ['student:observe', 'student:assist'], ['student:observe']),
      studentInitialization(ally.id, ['student:observe']),
      opponentInitialization(opponent.id, ['enemy:watch']),
    ], [
      action('student:observe', ['student']),
      action('student:assist', ['student'], { target: { kind: 'actor', relation: 'any' } }),
      action('enemy:watch', ['opponent']),
    ], [
      { actorId: student.id, participantKind: 'student', resources: {} },
      { actorId: ally.id, participantKind: 'student', resources: {} },
      { actorId: opponent.id, participantKind: 'opponent', resources: {} },
    ], { actorId: student.id, actionId: 'student:assist', reasonId: 'reason:student:assist' });

    const first = previewOperationIntervention(input);
    const second = previewOperationIntervention(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      planVersion: 7,
      draft: { actorId: student.id, actionId: 'student:assist', reasonId: 'reason:student:assist' },
      preparedBeat: {
        planVersion: 7,
        actorPlans: [
          { actorId: student.id, kind: 'studentAction', actionId: 'student:assist', targetActorId: ally.id },
          { actorId: ally.id, kind: 'studentAction', actionId: 'student:observe' },
          { actorId: opponent.id, kind: 'intent', actionId: 'enemy:watch' },
        ],
      },
    });
    expect(first.preparedBeat.actorPlans.slice(1)).toEqual(input.preparedBeat.actorPlans.slice(1));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.draft)).toBe(true);
    expect(Object.isFrozen(first.preparedBeat.actorPlans)).toBe(true);
  });

  test('target-only and action-plus-target Drafts require and preserve explicit legal targets', () => {
    const student = actor('actor:student', 'student', { targetPriorityActorIds: ['actor:ally'] });
    const ally = actor('actor:ally', 'student');
    const opponent = actor('actor:opponent', 'opponent');
    const event = eventDefinition([student, ally, opponent], {
      enabledActionIds: ['student:aim', 'student:observe', 'student:assist'],
    });
    const actors = [
      studentInitializationWithPriority(student.id, ['student:aim', 'student:observe', 'student:assist'], ['student:aim']),
      studentInitialization(ally.id, ['student:observe']),
      opponentInitialization(opponent.id, []),
    ];
    const actions = [
      action('student:aim', ['student'], { target: { kind: 'actor', relation: 'any' } }),
      action('student:observe', ['student']),
      action('student:assist', ['student'], { target: { kind: 'actor', relation: 'any' } }),
    ];
    const states = [
      { actorId: student.id, participantKind: 'student' as const, resources: {} },
      { actorId: ally.id, participantKind: 'student' as const, resources: {} },
      { actorId: opponent.id, participantKind: 'opponent' as const, resources: {} },
    ];
    const targetInput = previewInput(event, actors, actions, states, { actorId: student.id, targetActorId: opponent.id });
    const targetOnly = previewOperationIntervention(targetInput);
    const actionAndTarget = previewOperationIntervention(previewInput(
      event, actors, actions, states, { actorId: student.id, actionId: 'student:assist', targetActorId: opponent.id },
    ));

    expect(targetOnly.preparedBeat.actorPlans[0]).toMatchObject({ actionId: 'student:aim', targetActorId: opponent.id });
    expect(actionAndTarget.preparedBeat.actorPlans[0]).toMatchObject({ actionId: 'student:assist', targetActorId: opponent.id });
    expect(targetOnly.preparedBeat.actorPlans.slice(1)).toEqual(targetInput.preparedBeat.actorPlans.slice(1));
  });

  test('rejects explicit targets outside an Action ID allowlist or declared Actor type scope', () => {
    const student = actor('actor:student', 'student', { targetPriorityActorIds: ['actor:streetlight'] });
    const carousel = actor('actor:carousel', 'environment', { type: 'carousel-platform' });
    const streetlight = actor('actor:streetlight', 'environment', { type: 'streetlight' });
    const event = eventDefinition([student, carousel, streetlight], {
      enabledActionIds: ['student:type-scope', 'student:id-scope'],
    });
    const actors = [
      studentInitializationWithPriority(student.id, ['student:type-scope', 'student:id-scope'], ['student:type-scope']),
      { actorId: carousel.id, participantKind: 'environment' as const, candidateActionIds: [] },
      { actorId: streetlight.id, participantKind: 'environment' as const, candidateActionIds: [] },
    ];
    const actions = [
      action('student:type-scope', ['student'], {
        target: { kind: 'actor', relation: 'any', allowedActorTypes: ['carousel-platform'] },
      }),
      action('student:id-scope', ['student'], {
        target: { kind: 'actor', relation: 'any', allowedActorIds: [carousel.id] },
      }),
    ];
    const states = [
      { actorId: student.id, participantKind: 'student' as const, resources: {} },
      { actorId: carousel.id, participantKind: 'environment' as const, resources: {} },
      { actorId: streetlight.id, participantKind: 'environment' as const, resources: {} },
    ];
    const legalTypePreview = previewOperationIntervention(previewInput(
      event, actors, actions, states,
      { actorId: student.id, actionId: 'student:type-scope', targetActorId: carousel.id },
    ));

    expect(legalTypePreview.preparedBeat.actorPlans[0]).toMatchObject({
      actionId: 'student:type-scope',
      targetActorId: carousel.id,
    });
    errorCode(() => previewOperationIntervention(previewInput(
      event, actors, actions, states,
      { actorId: student.id, actionId: 'student:type-scope', targetActorId: streetlight.id },
    )), 'operation:intervention:invalid-target');
    errorCode(() => previewOperationIntervention(previewInput(
      event, actors, actions, states,
      { actorId: student.id, actionId: 'student:id-scope', targetActorId: streetlight.id },
    )), 'operation:intervention:invalid-target');
  });

  test('rejects stale plans, untrusted fields, a second student, and action/reason/target violations', () => {
    const student = actor('actor:student', 'student');
    const secondStudent = actor('actor:second', 'student');
    const opponent = actor('actor:opponent', 'opponent');
    const event = eventDefinition([student, secondStudent, opponent], {
      enabledActionIds: ['student:self', 'student:other'],
    });
    const actors = [
      studentInitialization(student.id, ['student:self', 'student:other']),
      studentInitialization(secondStudent.id, ['student:self']),
      opponentInitialization(opponent.id, []),
    ];
    const actions = [
      action('student:self', ['student'], { target: { kind: 'actor', relation: 'self' } }),
      action('student:other', ['student']),
    ];
    const states = [
      { actorId: student.id, participantKind: 'student' as const, resources: {} },
      { actorId: secondStudent.id, participantKind: 'student' as const, resources: {} },
      { actorId: opponent.id, participantKind: 'opponent' as const, resources: {} },
    ];
    const base = previewInput(event, actors, actions, states, { actorId: student.id, actionId: 'student:other' });

    errorCode(() => previewOperationIntervention({
      ...base,
      snapshot: { ...base.snapshot, planVersion: base.snapshot.planVersion + 1 },
    }), 'operation:intervention:stale-plan');
    errorCode(() => previewOperationIntervention({
      ...base,
      draft: { actorId: student.id, actionId: 'student:other', cost: { scope: 'actor', resourceId: 'x', amount: 1 } } as OperationInterventionDraft,
    }), 'operation:intervention:invalid-draft');
    errorCode(() => previewOperationIntervention({
      ...base,
      currentDraft: { actorId: student.id, actionId: 'student:self' },
      draft: { actorId: secondStudent.id, actionId: 'student:self' },
    }), 'operation:intervention:student-slot-occupied');
    errorCode(() => previewOperationIntervention({ ...base, draft: { actorId: 'actor:missing', actionId: 'student:other' } }), 'operation:intervention:invalid-actor');
    errorCode(() => previewOperationIntervention({ ...base, draft: { actorId: student.id, actionId: 'student:missing' } }), 'operation:intervention:invalid-action');
    errorCode(() => previewOperationIntervention({
      ...base,
      draft: { actorId: student.id, actionId: 'student:other', reasonId: 'reason:unknown' },
    }), 'operation:intervention:invalid-reason');
    errorCode(() => previewOperationIntervention({
      ...base,
      draft: { actorId: student.id, actionId: 'student:self', targetActorId: opponent.id },
    }), 'operation:intervention:invalid-target');
  });

  test('rejects disabled Actions and target-only edits of a student Wait plan', () => {
    const student = actor('actor:student', 'student');
    const opponent = actor('actor:opponent', 'opponent');
    const event = eventDefinition([student, opponent], { enabledActionIds: ['student:enabled'] });
    const actors = [studentInitialization(student.id, ['student:enabled', 'student:disabled']), opponentInitialization(opponent.id, [])];
    const actions = [action('student:enabled', ['student']), action('student:disabled', ['student'])];
    const states = [
      { actorId: student.id, participantKind: 'student' as const, resources: {} },
      { actorId: opponent.id, participantKind: 'opponent' as const, resources: {} },
    ];
    const base = previewInput(event, actors, actions, states, { actorId: student.id, actionId: 'student:enabled' });

    errorCode(() => previewOperationIntervention({
      ...base,
      draft: { actorId: student.id, actionId: 'student:disabled' },
    }), 'operation:intervention:action-not-enabled');
    const waitEvent = eventDefinition([student, opponent], { enabledActionIds: [] });
    const waitBase = previewInput(waitEvent, [studentInitialization(student.id, ['student:disabled']), opponentInitialization(opponent.id, [])],
      [action('student:disabled', ['student'], { target: { kind: 'actor', relation: 'any' } })], states,
      { actorId: student.id, targetActorId: opponent.id });
    errorCode(() => previewOperationIntervention(waitBase), 'operation:intervention:invalid-action');
  });

  test('rejects an Action the Actor cannot afford and preserves unchanged input on rejection', () => {
    const student = actor('actor:student', 'student', { resources: { focus: { initial: 1, min: 0, max: 1 } } });
    const event = eventDefinition([student], { enabledActionIds: ['student:free', 'student:costly'] });
    const actors = [studentInitializationWithPriority(student.id, ['student:free', 'student:costly'], ['student:free'])];
    const actions = [
      action('student:free', ['student']),
      action('student:costly', ['student'], { cost: { scope: 'actor', resourceId: 'focus', amount: 2 } }),
    ];
    const input = previewInput(event, actors, actions, [
      { actorId: student.id, participantKind: 'student', resources: { focus: 1 } },
    ], { actorId: student.id, actionId: 'student:costly' });
    const originalSnapshot = structuredClone(input.snapshot);
    const originalContent = structuredClone(input.trustedContent);
    const originalBeat = input.preparedBeat;

    errorCode(() => previewOperationIntervention(input), 'operation:intervention:action-not-affordable');

    expect(input.snapshot).toEqual(originalSnapshot);
    expect(input.trustedContent).toEqual(originalContent);
    expect(input.preparedBeat).toBe(originalBeat);
  });

  test('rejects revisions that would alter another Actor through shared Team affordability', () => {
    const student = actor('actor:student', 'student', { teamId: 'team:students' });
    const opponent = actor('actor:opponent', 'opponent', { teamId: 'team:students' });
    const event = eventDefinition([student, opponent], {
      teams: [{ id: 'team:students', resources: { support: { initial: 2, min: 0, max: 2 } } }],
      enabledActionIds: ['student:light', 'student:heavy', 'opponent:spend'],
    });
    const actors = [
      studentInitializationWithPriority(student.id, ['student:light', 'student:heavy'], ['student:light']),
      opponentInitialization(opponent.id, ['opponent:spend']),
    ];
    const actions = [
      action('student:light', ['student'], { cost: { scope: 'team', resourceId: 'support', amount: 1 } }),
      action('student:heavy', ['student'], { cost: { scope: 'team', resourceId: 'support', amount: 2 } }),
      action('opponent:spend', ['opponent'], { cost: { scope: 'team', resourceId: 'support', amount: 1 } }),
    ];
    const base = previewInput(event, actors, actions, [
      { actorId: student.id, participantKind: 'student', resources: {} },
      { actorId: opponent.id, participantKind: 'opponent', resources: {} },
    ], { actorId: student.id, actionId: 'student:light' }, [
      { id: 'team:students', resources: { support: 2 } },
    ]);

    expect(base.preparedBeat.actorPlans.map(plan => plan.kind)).toEqual(['studentAction', 'intent']);
    errorCode(() => previewOperationIntervention({ ...base, draft: { actorId: student.id, actionId: 'student:heavy' } }),
      'operation:intervention:plan-conflict');
  });

  test('keeps a later Wait plan unchanged when the revised student Action costs less', () => {
    const student = actor('actor:student', 'student', { teamId: 'team:students' });
    const opponent = actor('actor:opponent', 'opponent', { teamId: 'team:students' });
    const event = eventDefinition([student, opponent], {
      teams: [{ id: 'team:students', resources: { support: { initial: 2, min: 0, max: 2 } } }],
      enabledActionIds: ['student:expensive', 'student:free', 'opponent:expensive', 'opponent:backup'],
    });
    const actors = [
      studentInitializationWithPriority(student.id, ['student:expensive', 'student:free'], ['student:expensive']),
      opponentInitialization(opponent.id, ['opponent:expensive', 'opponent:backup']),
    ];
    const actions = [
      action('student:expensive', ['student'], { cost: { scope: 'team', resourceId: 'support', amount: 2 } }),
      action('student:free', ['student']),
      action('opponent:expensive', ['opponent'], { cost: { scope: 'team', resourceId: 'support', amount: 2 } }),
      action('opponent:backup', ['opponent'], { cost: { scope: 'team', resourceId: 'support', amount: 1 } }),
    ];
    const base = previewInput(event, actors, actions, [
      { actorId: student.id, participantKind: 'student', resources: {} },
      { actorId: opponent.id, participantKind: 'opponent', resources: {} },
    ], { actorId: student.id, actionId: 'student:free' }, [{ id: 'team:students', resources: { support: 2 } }]);

    expect(base.preparedBeat.actorPlans[1].kind).toBe('wait');
    const preview = previewOperationIntervention(base);
    expect(preview.preparedBeat.actorPlans[0]).toMatchObject({ kind: 'studentAction', actionId: 'student:free' });
    expect(preview.preparedBeat.actorPlans[1]).toEqual(base.preparedBeat.actorPlans[1]);
  });
});
