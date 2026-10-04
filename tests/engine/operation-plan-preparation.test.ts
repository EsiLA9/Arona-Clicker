import { describe, expect, test } from 'vitest';
import {
  OPERATION_NO_ELIGIBLE_ACTION_REASON_ID,
  OPERATION_WAIT_ACTION_ID,
  type OperationActorDef,
  type OperationActorInitialization,
  type OperationEventDef,
  type OperationTeamState,
  type OperationStudentProfileSnapshot,
} from '../../src/arona-clicker/contracts/operation';
import {
  OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE,
  OPERATION_WAIT_REASON_NO_CANDIDATE_ACTION,
  OPERATION_WAIT_REASON_NO_ENABLED_ACTION,
  OPERATION_WAIT_REASON_NO_LEGAL_TARGET,
  type OperationPreparationContent,
  type OperationPreparationSnapshot,
} from '../../src/arona-clicker/contracts/operation-beat';
import type { OperationActionDef, OperationActionTargetDef } from '../../src/arona-clicker/contracts/operation-action';
import { OperationPlanPreparationError, prepareOperationBeat } from '../../src/arona-clicker/services/operation-plan-preparation';

function actor(
  id: string,
  participantKind: 'student' | 'opponent' | 'environment',
  options: { teamId?: string; targetPriorityActorIds?: readonly string[]; resources?: OperationActorDef['resources'] } = {},
): OperationActorDef {
  return {
    id,
    type: participantKind,
    hp: { initial: 3, min: 0, max: 3 },
    ...(options.teamId ? { teamId: options.teamId } : {}),
    ...(options.targetPriorityActorIds ? { targetPriorityActorIds: options.targetPriorityActorIds } : {}),
    ...(options.resources ? { resources: options.resources } : {}),
  };
}

function action(
  id: string,
  kinds: OperationActionDef['allowedParticipantKinds'],
  options: {
    target?: OperationActionTargetDef;
    cost?: OperationActionDef['cost'];
    reasonIds?: readonly string[];
    requiredCapabilityIds?: readonly string[];
  } = {},
): OperationActionDef {
  return {
    id,
    allowedParticipantKinds: kinds,
    requiredCapabilityIds: options.requiredCapabilityIds ?? [],
    reasonIds: options.reasonIds ?? ['reason:' + id],
    tagIds: [],
    ...(options.cost ? { cost: options.cost } : {}),
    target: options.target ?? { kind: 'none' },
    effects: [],
  };
}

function studentProfile(
  id: string,
  candidateActionIds: readonly string[],
  actionPriorityIds: readonly string[] = [],
): OperationStudentProfileSnapshot {
  const candidates = new Set(candidateActionIds);
  const prioritySet = new Set(actionPriorityIds);
  const orderedIds = [
    ...actionPriorityIds.filter(actionId => candidates.has(actionId)),
    ...candidateActionIds.filter(actionId => !prioritySet.has(actionId)),
  ];
  const actionCandidates = orderedIds.map(actionId => ({
    actionId,
    eligible: true,
    requiredCapabilityIds: [],
    missingCapabilityIds: [],
    reasonIds: ['reason:' + actionId],
  }));
  return {
    id: 'profile:' + id,
    characterId: 'character:' + id,
    candidateActionIds,
    actionPriorityIds,
    capabilityIds: [],
    reasonIds: [],
    actionCandidates,
    eligibleActionIds: orderedIds,
  };
}

function waitOnlyStudentProfile(id: string): OperationStudentProfileSnapshot {
  return {
    id: 'profile:' + id,
    characterId: 'character:' + id,
    candidateActionIds: [],
    actionPriorityIds: [],
    capabilityIds: [],
    reasonIds: [],
    actionCandidates: [],
    eligibleActionIds: [],
    fallback: { actionId: OPERATION_WAIT_ACTION_ID, reasonIds: [OPERATION_NO_ELIGIBLE_ACTION_REASON_ID] },
  };
}

function studentInitialization(actorId: string, profile: OperationStudentProfileSnapshot): OperationActorInitialization {
  return { actorId, participantKind: 'student', characterId: profile.characterId, profile };
}

function opponentInitialization(actorId: string, candidateActionIds: readonly string[]): OperationActorInitialization {
  return { actorId, participantKind: 'opponent', candidateActionIds };
}

function eventDefinition(
  actors: readonly OperationActorDef[],
  options: {
    teams?: NonNullable<OperationEventDef['teams']>;
    locations?: OperationEventDef['locations'];
    maxLocationVisits?: number;
  } = {},
): OperationEventDef {
  return {
    id: 'test:operation:preparation',
    locations: [{ id: 'location:office', enabledActionIds: [], combinationRules: [], routeEdges: [] }, { id: 'location:arcade', enabledActionIds: [], combinationRules: [], routeEdges: [] } ],
    maxLocationVisits: options.maxLocationVisits ?? 20,
    initialLocationId: 'location:office',
    tracks: [],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors,
    ...(options.teams ? { teams: options.teams } : {}),
    ...(options.locations ? { locations: options.locations } : {}),
    playerRouteState: { playerCost: 9, cards: { drawPile: [], hand: [], discard: [], played: [] } },
  };
}

function snapshot(
  actors: readonly OperationPreparationSnapshot['actors'][number][],
  teams: readonly OperationTeamState[] = [],
  currentLocationId = 'location:office',
  planVersion = 7,
): OperationPreparationSnapshot {
  return { eventId: 'test:operation:preparation', planVersion, currentLocationId, actors, teams };
}

function content(
  event: OperationEventDef,
  actors: readonly OperationActorInitialization[],
  actionDefinitions: readonly OperationActionDef[],
): OperationPreparationContent {
  return { eventDefinition: event, actors, actionDefinitions };
}

describe('pure Operation Beat preparation', () => {
  test('uses Profile priority, Event actor order, participant candidates, Location filtering, and target preference', () => {
    const studentA = actor('actor:student-a', 'student', { targetPriorityActorIds: ['actor:student-b'] });
    const opponent = actor('actor:opponent', 'opponent');
    const studentB = actor('actor:student-b', 'student');
    const event = eventDefinition([studentA, opponent, studentB], {
      locations: [{ id: 'location:office', enabledActionIds: ['student:priority', 'student:observe', 'opponent:enabled'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    });
    const profileA = studentProfile('a', ['student:observe', 'student:priority'], ['student:priority']);
    const profileB = studentProfile('b', ['student:observe']);
    const trusted = content(event, [
      opponentInitialization('actor:opponent', ['opponent:disabled', 'opponent:enabled']),
      studentInitialization(studentB.id, profileB),
      studentInitialization(studentA.id, profileA),
    ], [
      action('student:observe', ['student']),
      action('student:priority', ['student'], { target: { kind: 'actor', relation: 'any' } }),
      action('opponent:disabled', ['opponent']),
      action('opponent:enabled', ['opponent']),
    ]);
    const dynamic = snapshot([
      { actorId: studentB.id, participantKind: 'student', resources: {} },
      { actorId: studentA.id, participantKind: 'student', resources: {} },
      { actorId: opponent.id, participantKind: 'opponent', resources: {} },
    ]);

    const prepared = prepareOperationBeat(dynamic, trusted);

    expect(prepared).toMatchObject({
      planVersion: 7,
      locationId: 'location:office',
      actorPlans: [
        { actorId: studentA.id, kind: 'studentAction', source: 'student-profile', actionId: 'student:priority', targetActorId: studentB.id },
        { actorId: opponent.id, kind: 'intent', source: 'participant', actionId: 'opponent:enabled', targetActorId: null },
        { actorId: studentB.id, kind: 'studentAction', source: 'student-profile', actionId: 'student:observe', targetActorId: null },
      ],
    });
    expect(prepared.actorPlans[0].reasonIds).toEqual(['reason:student:priority']);
  });

  test('skips a statically capability-blocked Profile candidate and selects the next eligible candidate', () => {
    const student = actor('actor:student', 'student');
    const event = eventDefinition([student], {
      locations: [{ id: 'location:office', enabledActionIds: ['student:blocked', 'student:eligible'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    });
    const baseProfile = studentProfile('capability', ['student:blocked', 'student:eligible'], ['student:blocked']);
    const profile: OperationStudentProfileSnapshot = {
      ...baseProfile,
      actionCandidates: baseProfile.actionCandidates.map(candidate => candidate.actionId === 'student:blocked'
        ? { ...candidate, eligible: false, requiredCapabilityIds: ['capability:trained'], missingCapabilityIds: ['capability:trained'] }
        : candidate),
      eligibleActionIds: ['student:eligible'],
    };
    const trusted = content(event, [studentInitialization(student.id, profile)], [
      action('student:blocked', ['student'], { requiredCapabilityIds: ['capability:trained'] }),
      action('student:eligible', ['student']),
    ]);

    const prepared = prepareOperationBeat(snapshot([
      { actorId: student.id, participantKind: 'student', resources: {} },
    ]), trusted);

    expect(prepared.actorPlans[0]).toMatchObject({ kind: 'studentAction', actionId: 'student:eligible' });
  });

  test('reserves shared Team resources in Event order and tries the next candidate after insufficient cost', () => {
    const first = actor('actor:first', 'opponent', { teamId: 'team:enemy' });
    const second = actor('actor:second', 'opponent', { teamId: 'team:enemy' });
    const event = eventDefinition([first, second], {
      teams: [{ id: 'team:enemy', resources: { pressure: { initial: 2, min: 0, max: 2 } } }],
      locations: [{ id: 'location:office', enabledActionIds: ['enemy:large', 'enemy:small', 'enemy:free'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    });
    const trusted = content(event, [
      opponentInitialization(second.id, ['enemy:small', 'enemy:free']),
      opponentInitialization(first.id, ['enemy:large']),
    ], [
      action('enemy:large', ['opponent'], { cost: { scope: 'team', resourceId: 'pressure', amount: 2 } }),
      action('enemy:small', ['opponent'], { cost: { scope: 'team', resourceId: 'pressure', amount: 1 } }),
      action('enemy:free', ['opponent']),
    ]);
    const dynamic = snapshot([
      { actorId: second.id, participantKind: 'opponent', resources: {} },
      { actorId: first.id, participantKind: 'opponent', resources: {} },
    ], [{ id: 'team:enemy', resources: { pressure: 2 } }]);

    const prepared = prepareOperationBeat(dynamic, trusted);

    expect(prepared.actorPlans.map(plan => [plan.actorId, plan.actionId, plan.cost])).toEqual([
      [first.id, 'enemy:large', { scope: 'team', resourceId: 'pressure', amount: 2 }],
      [second.id, 'enemy:free', null],
    ]);
    expect(dynamic.teams[0].resources.pressure).toBe(2);
  });

  test('never prepares an Actor or Team cost that would cross the declared resource minimum', () => {
    const student = actor('actor:student', 'student', {
      resources: { focus: { initial: 1, min: 1, max: 2 } },
    });
    const opponent = actor('actor:opponent', 'opponent', { teamId: 'team:opponents' });
    const event = eventDefinition([student, opponent], {
      teams: [{
        id: 'team:opponents',
        resources: { pressure: { initial: 1, min: 1, max: 2 } },
      }],
      locations: [{ id: 'location:office', enabledActionIds: ['student:spend-focus', 'opponent:spend-pressure'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    });
    const trusted = content(event, [
      studentInitialization(student.id, studentProfile('minimum', ['student:spend-focus'])),
      opponentInitialization(opponent.id, ['opponent:spend-pressure']),
    ], [
      action('student:spend-focus', ['student'], {
        cost: { scope: 'actor', resourceId: 'focus', amount: 1 },
      }),
      action('opponent:spend-pressure', ['opponent'], {
        cost: { scope: 'team', resourceId: 'pressure', amount: 1 },
      }),
    ]);

    const prepared = prepareOperationBeat(snapshot([
      { actorId: student.id, participantKind: 'student', resources: { focus: 1 } },
      { actorId: opponent.id, participantKind: 'opponent', resources: {} },
    ], [{ id: 'team:opponents', resources: { pressure: 1 } }]), trusted);

    expect(prepared.actorPlans).toMatchObject([
      { actorId: student.id, kind: 'wait', reasonIds: [OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE] },
      { actorId: opponent.id, kind: 'wait', reasonIds: [OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE] },
    ]);
  });

  test('reserves decimal costs exactly at the minimum and across shared Team payments', () => {
    const student = actor('actor:decimal-student', 'student', {
      resources: { focus: { initial: 0.3, min: 0.1, max: 0.3 } },
    });
    const opponents = [
      actor('actor:decimal-opponent-1', 'opponent', { teamId: 'team:decimal' }),
      actor('actor:decimal-opponent-2', 'opponent', { teamId: 'team:decimal' }),
      actor('actor:decimal-opponent-3', 'opponent', { teamId: 'team:decimal' }),
    ];
    const event = eventDefinition([student, ...opponents], {
      teams: [{ id: 'team:decimal', resources: { pressure: { initial: 0.3, min: 0, max: 0.3 } } }],
      locations: [{ id: 'location:office', enabledActionIds: ['student:decimal-cost', 'opponent:decimal-cost'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    });
    const trusted = content(event, [
      studentInitialization(student.id, studentProfile('decimal', ['student:decimal-cost'])),
      ...opponents.map(opponent => opponentInitialization(opponent.id, ['opponent:decimal-cost'])),
    ], [
      action('student:decimal-cost', ['student'], {
        cost: { scope: 'actor', resourceId: 'focus', amount: 0.2 },
      }),
      action('opponent:decimal-cost', ['opponent'], {
        cost: { scope: 'team', resourceId: 'pressure', amount: 0.1 },
      }),
    ]);

    const prepared = prepareOperationBeat(snapshot([
      { actorId: student.id, participantKind: 'student', resources: { focus: 0.3 } },
      ...opponents.map(opponent => ({ actorId: opponent.id, participantKind: 'opponent' as const, resources: {} })),
    ], [{ id: 'team:decimal', resources: { pressure: 0.3 } }]), trusted);

    expect(prepared.actorPlans.map(plan => plan.kind)).toEqual(['studentAction', 'intent', 'intent', 'intent']);
  });

  test('keeps large shared Team balances exact across fractional reservations', () => {
    const first = actor('actor:large-balance-first', 'opponent', { teamId: 'team:large-balance' });
    const second = actor('actor:large-balance-second', 'opponent', { teamId: 'team:large-balance' });
    const event = eventDefinition([first, second], {
      teams: [{ id: 'team:large-balance', resources: { pressure: { initial: 1e16, min: 0, max: 1e16 } } }],
      locations: [{ id: 'location:office', enabledActionIds: ['enemy:small-decimal', 'enemy:full-balance'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    });
    const trusted = content(event, [
      opponentInitialization(first.id, ['enemy:small-decimal']),
      opponentInitialization(second.id, ['enemy:full-balance']),
    ], [
      action('enemy:small-decimal', ['opponent'], {
        cost: { scope: 'team', resourceId: 'pressure', amount: 0.1 },
      }),
      action('enemy:full-balance', ['opponent'], {
        cost: { scope: 'team', resourceId: 'pressure', amount: 1e16 },
      }),
    ]);

    const prepared = prepareOperationBeat(snapshot([
      { actorId: first.id, participantKind: 'opponent', resources: {} },
      { actorId: second.id, participantKind: 'opponent', resources: {} },
    ], [{ id: 'team:large-balance', resources: { pressure: 1e16 } }]), trusted);

    expect(prepared.actorPlans).toMatchObject([
      { actorId: first.id, kind: 'intent', actionId: 'enemy:small-decimal' },
      { actorId: second.id, kind: 'wait', reasonIds: [OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE] },
    ]);
  });

  test('a target failure does not reserve cost and falls through to the next candidate', () => {
    const source = actor('actor:source', 'opponent', { teamId: 'team:enemy' });
    const ally = actor('actor:ally', 'opponent', { teamId: 'team:enemy' });
    const event = eventDefinition([source, ally], {
      teams: [{ id: 'team:enemy', resources: { pressure: { initial: 2, min: 0, max: 2 } } }],
      locations: [{ id: 'location:office', enabledActionIds: ['enemy:targeted', 'enemy:backup'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    });
    const trusted = content(event, [
      opponentInitialization(source.id, ['enemy:targeted', 'enemy:backup']),
      opponentInitialization(ally.id, []),
    ], [
      action('enemy:targeted', ['opponent'], {
        cost: { scope: 'team', resourceId: 'pressure', amount: 2 },
        target: { kind: 'actor', relation: 'otherTeam' },
      }),
      action('enemy:backup', ['opponent'], { cost: { scope: 'team', resourceId: 'pressure', amount: 2 } }),
    ]);

    const prepared = prepareOperationBeat(snapshot([
      { actorId: source.id, participantKind: 'opponent', resources: {} },
      { actorId: ally.id, participantKind: 'opponent', resources: {} },
    ], [{ id: 'team:enemy', resources: { pressure: 2 } }]), trusted);

    expect(prepared.actorPlans[0]).toMatchObject({
      actorId: source.id,
      actionId: 'enemy:backup',
      cost: { scope: 'team', resourceId: 'pressure', amount: 2 },
    });
  });

  test('a missing current-location tactics row fails closed and returns a stable Wait reason', () => {
    const enemy = actor('actor:enemy', 'opponent');
    const event = eventDefinition([enemy]);
    const trusted = content(event, [opponentInitialization(enemy.id, ['enemy:action'])], [action('enemy:action', ['opponent'])]);

    const prepared = prepareOperationBeat(snapshot([
      { actorId: enemy.id, participantKind: 'opponent', resources: {} },
    ]), trusted);

    expect(prepared.actorPlans[0]).toMatchObject({
      kind: 'wait',
      actionId: OPERATION_WAIT_ACTION_ID,
      cost: null,
      reasonIds: [OPERATION_WAIT_REASON_NO_ENABLED_ACTION],
    });
  });

  test('uses stable Wait reasons for empty candidates, legal-target failure, cost failure, and static Profile gates', () => {
    const emptyCandidateActor = actor('actor:empty', 'opponent');
    const student = actor('actor:student', 'student', { teamId: 'team:students', resources: { focus: { initial: 1, min: 0, max: 2 } } });
    const event = eventDefinition([emptyCandidateActor, student], {
      teams: [{ id: 'team:students' }],
      locations: [{ id: 'location:office', enabledActionIds: ['student:needs-target', 'student:too-expensive'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    });
    const studentProfileWithCandidates = studentProfile('blocked-by-runtime', ['student:needs-target', 'student:too-expensive']);
    const staticProfile = waitOnlyStudentProfile('static-wait');
    const studentWithoutAction = actor('actor:static-wait', 'student');
    const eventWithStaticWait = eventDefinition([emptyCandidateActor, student, studentWithoutAction], {
      teams: [{ id: 'team:students' }],
      locations: event.locations,
    });
    const trusted = content(eventWithStaticWait, [
      studentInitialization(student.id, studentProfileWithCandidates),
      opponentInitialization(emptyCandidateActor.id, []),
      studentInitialization(studentWithoutAction.id, staticProfile),
    ], [
      action('student:needs-target', ['student'], { target: { kind: 'actor', relation: 'otherTeam' } }),
      action('student:too-expensive', ['student'], { cost: { scope: 'actor', resourceId: 'focus', amount: 2 } }),
    ]);

    const prepared = prepareOperationBeat(snapshot([
      { actorId: studentWithoutAction.id, participantKind: 'student', resources: {} },
      { actorId: student.id, participantKind: 'student', resources: { focus: 1 } },
      { actorId: emptyCandidateActor.id, participantKind: 'opponent', resources: {} },
    ], [{ id: 'team:students', resources: {} }]), trusted);

    expect(prepared.actorPlans[0]).toMatchObject({
      actorId: emptyCandidateActor.id,
      kind: 'wait',
      reasonIds: [OPERATION_WAIT_REASON_NO_CANDIDATE_ACTION],
    });
    expect(prepared.actorPlans[1]).toMatchObject({
      actorId: student.id,
      kind: 'wait',
      reasonIds: [OPERATION_WAIT_REASON_NO_LEGAL_TARGET, OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE],
    });
    expect(prepared.actorPlans[2]).toMatchObject({
      actorId: studentWithoutAction.id,
      kind: 'wait',
      reasonIds: [OPERATION_NO_ELIGIBLE_ACTION_REASON_ID],
    });
  });

  test('returns equal frozen output for repeated input and never mutates snapshot or content', () => {
    const student = actor('actor:student', 'student');
    const event = eventDefinition([student], {
      locations: [{ id: 'location:office', enabledActionIds: ['student:observe'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    });
    const trusted = content(event, [studentInitialization(student.id, studentProfile('student', ['student:observe']))], [action('student:observe', ['student'])]);
    const dynamic = snapshot([{ actorId: student.id, participantKind: 'student', resources: {} }]);
    const beforeSnapshot = structuredClone(dynamic);
    const beforeContent = structuredClone(trusted);

    const first = prepareOperationBeat(dynamic, trusted);
    const second = prepareOperationBeat(dynamic, trusted);

    expect(first).toEqual(second);
    expect(first.planVersion).toBe(dynamic.planVersion);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.actorPlans)).toBe(true);
    expect(dynamic).toEqual(beforeSnapshot);
    expect(trusted).toEqual(beforeContent);
  });

  test('rejects a candidate that references missing Action content with a concrete diagnostic', () => {
    const enemy = actor('actor:enemy', 'opponent');
    const event = eventDefinition([enemy], {
      locations: [{ id: 'location:office', enabledActionIds: ['enemy:missing'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    });
    const trusted = content(event, [opponentInitialization(enemy.id, ['enemy:missing'])], []);

    expect(() => prepareOperationBeat(snapshot([
      { actorId: enemy.id, participantKind: 'opponent', resources: {} },
    ]), trusted)).toThrow(OperationPlanPreparationError);
    expect(() => prepareOperationBeat(snapshot([
      { actorId: enemy.id, participantKind: 'opponent', resources: {} },
    ]), trusted)).toThrow(/references a missing Action: enemy:missing/);
  });

  test('rejects Run snapshots paired with another Event ruleset', () => {
    const enemy = actor('actor:enemy', 'opponent');
    const event = eventDefinition([enemy]);
    const trusted = content(event, [opponentInitialization(enemy.id, [])], []);

    expect(() => prepareOperationBeat({
      ...snapshot([{ actorId: enemy.id, participantKind: 'opponent', resources: {} }]),
      eventId: 'test:operation:other',
    }, trusted)).toThrow(/snapshot eventId does not match trusted Event definition/);
  });

  test('rejects undeclared Team membership, malformed Profile gates, and inconsistent bounded resources', () => {
    const teamlessEventActor = actor('actor:enemy', 'opponent', { teamId: 'team:missing' });
    const teamlessEvent = eventDefinition([teamlessEventActor]);
    const teamlessContent = content(teamlessEvent, [opponentInitialization(teamlessEventActor.id, [])], []);
    expect(() => prepareOperationBeat(snapshot([
      { actorId: teamlessEventActor.id, participantKind: 'opponent', resources: {} },
    ]), teamlessContent)).toThrow(/teamId references an undeclared Team/);

    const student = actor('actor:student', 'student');
    const baseProfile = studentProfile('inconsistent-gate', ['student:trained']);
    const profile = {
      ...baseProfile,
      actionCandidates: baseProfile.actionCandidates.map(row => ({
        ...row,
        requiredCapabilityIds: ['capability:trained'],
        missingCapabilityIds: ['capability:trained'],
      })),
    };
    const capabilityContent = content(eventDefinition([student], {
      locations: [{ id: 'location:office', enabledActionIds: ['student:trained'], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    }), [studentInitialization(student.id, profile)], [
      action('student:trained', ['student'], { requiredCapabilityIds: ['capability:trained'] }),
    ]);
    expect(() => prepareOperationBeat(snapshot([
      { actorId: student.id, participantKind: 'student', resources: {} },
    ]), capabilityContent))
      .toThrow(/eligibility does not match required capabilities/);

    const resourceActor = actor('actor:resourceful', 'student', {
      resources: { energy: { initial: 1, min: 0, max: 2 } },
    });
    const resourceEvent = eventDefinition([resourceActor]);
    const resourceContent = content(resourceEvent, [studentInitialization(resourceActor.id, waitOnlyStudentProfile('resourceful'))], []);
    expect(() => prepareOperationBeat(snapshot([
      { actorId: resourceActor.id, participantKind: 'student', resources: {} },
    ]), resourceContent)).toThrow(/is missing declared resource: energy/);
    expect(() => prepareOperationBeat(snapshot([
      { actorId: resourceActor.id, participantKind: 'student', resources: { energy: 3 } },
    ]), resourceContent)).toThrow(/is outside its declared bounds/);
    expect(() => prepareOperationBeat(snapshot([
      { actorId: resourceActor.id, participantKind: 'student', resources: { energy: 1, focus: 0 } },
    ]), resourceContent)).toThrow(/contains undeclared resource: focus/);
  });
});
