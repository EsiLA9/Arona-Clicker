import { describe, expect, test } from 'vitest';
import type {
  OperationActorDef,
  OperationActorInitialization,
  OperationEventDef,
  OperationStudentProfileSnapshot,
  OperationTeamState,
} from '../../src/arona-clicker/contracts/operation';
import type { OperationActionDef } from '../../src/arona-clicker/contracts/operation-action';
import type {
  OperationPreparationContent,
  OperationPreparationSnapshot,
} from '../../src/arona-clicker/contracts/operation-beat';
import type { OperationResolutionPlannerInput } from '../../src/arona-clicker/contracts/operation-resolution';
import { prepareOperationBeat } from '../../src/arona-clicker/services/operation-plan-preparation';
import {
  OperationResolutionPlannerError,
  planOperationResolution,
} from '../../src/arona-clicker/services/operation-resolution-planner';
import { OPERATION_TACTICAL_RNG_ALGORITHM } from '../../src/arona-clicker/contracts/operation';

const TEAM_BLUE = 'team:blue';
const STUDENT_A = 'actor:student-a';
const STUDENT_B = 'actor:student-b';
const ENEMY = 'actor:enemy';
const ACTION_A = 'action:student-a';
const ACTION_B = 'action:student-b';
const ENEMY_ACTION = 'action:enemy';

function actor(id: string, type: 'student' | 'opponent', options: { teamId?: string; targetPriorityActorIds?: readonly string[] } = {}): OperationActorDef {
  return {
    id,
    type,
    hp: { initial: 2, min: 0, max: 3 },
    resources: type === 'student' ? { focus: { initial: 1, min: 0, max: 5 } } : {},
    ...(options.teamId ? { teamId: options.teamId } : {}),
    ...(options.targetPriorityActorIds ? { targetPriorityActorIds: options.targetPriorityActorIds } : {}),
  };
}

function studentInitialization(actorId: string, actionId: string): OperationActorInitialization {
  const profile: OperationStudentProfileSnapshot = {
    id: 'profile:' + actorId,
    characterId: 'character:' + actorId,
    candidateActionIds: [actionId],
    actionPriorityIds: [actionId],
    capabilityIds: [],
    reasonIds: [],
    actionCandidates: [{
      actionId,
      eligible: true,
      requiredCapabilityIds: [],
      missingCapabilityIds: [],
      reasonIds: ['reason:' + actionId],
    }],
    eligibleActionIds: [actionId],
    randomSkillRuleId: 'skill:focus',
  };
  return { actorId, participantKind: 'student', characterId: profile.characterId, profile };
}

function studentAction(id: string, tagId: string): OperationActionDef {
  return {
    id,
    title: id,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['reason:' + id],
    tagIds: [tagId],
    cost: { scope: 'team', resourceId: 'energy', amount: 0.1 },
    target: { kind: 'actor', relation: 'any' },
    effects: [{ kind: 'actorHpDelta', recipient: 'actor', amount: -3 }],
  };
}

interface FixtureOptions {
  readonly invalidActionEffect?: boolean;
  readonly positionEffects?: readonly OperationActionDef['effects'][number][];
  readonly disableCombinations?: boolean;
  readonly targetlessAction?: boolean;
}

function fixture(options: FixtureOptions = {}): OperationResolutionPlannerInput {
  const actors = [
    actor(STUDENT_A, 'student', { teamId: TEAM_BLUE, targetPriorityActorIds: [ENEMY] }),
    actor(STUDENT_B, 'student', { teamId: TEAM_BLUE, targetPriorityActorIds: [ENEMY] }),
    actor(ENEMY, 'opponent'),
  ];
  const eventDefinition: OperationEventDef = {
    id: 'event:test:resolution',
    locations: [{ id: 'location:office', enabledActionIds: [ACTION_A, ACTION_B, ENEMY_ACTION], combinationRules: options.invalidActionEffect || options.disableCombinations ? [] : [{
        id: 'combo:focus',
        priority: 0,
        inputTagIds: ['tag:a', 'tag:b'],
        targetMatch: 'same-target',
        effects: [
          { kind: 'actorHpDelta', recipient: 'actor', amount: 1 },
          { kind: 'eventTrackDelta', trackId: 'track:momentum', amount: 2 },
        ],
      }], routeEdges: [] } ], maxLocationVisits: 20,
    initialLocationId: 'location:office',
    tracks: [{ id: 'track:momentum', initial: 0, min: 0, max: 3 }],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors,
    teams: [{ id: TEAM_BLUE, resources: { energy: { initial: 0.3, min: 0, max: 1 } } }],
    playerRouteState: { playerCost: 9 },
  };
  const actionDefinitions: OperationActionDef[] = [
    studentAction(ACTION_A, 'tag:a'),
    studentAction(ACTION_B, 'tag:b'),
    {
      id: ENEMY_ACTION,
      title: ENEMY_ACTION,
      allowedParticipantKinds: ['opponent'],
      requiredCapabilityIds: [],
      reasonIds: ['reason:' + ENEMY_ACTION],
      tagIds: [],
      target: { kind: 'none' },
      effects: [],
    },
  ];
  if (options.invalidActionEffect) {
    actionDefinitions[0] = {
      ...actionDefinitions[0],
      effects: [{ kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'resource:missing', amount: 1 }],
    };
  }
  if (options.positionEffects) actionDefinitions[0] = { ...actionDefinitions[0], effects: options.positionEffects };
  if (options.targetlessAction) actionDefinitions[0] = { ...actionDefinitions[0], target: { kind: 'none' } };
  const actorInitializations: OperationActorInitialization[] = [
    studentInitialization(STUDENT_A, ACTION_A),
    studentInitialization(STUDENT_B, ACTION_B),
    { actorId: ENEMY, participantKind: 'opponent', candidateActionIds: [ENEMY_ACTION] },
  ];
  const preparationSnapshot: OperationPreparationSnapshot = {
    eventId: eventDefinition.id,
    planVersion: 4,
    currentLocationId: 'location:office',
    actors: [
      { actorId: STUDENT_A, participantKind: 'student', resources: { focus: 1 } },
      { actorId: STUDENT_B, participantKind: 'student', resources: { focus: 1 } },
      { actorId: ENEMY, participantKind: 'opponent', resources: {} },
    ],
    teams: [{ id: TEAM_BLUE, resources: { energy: 0.3 } } satisfies OperationTeamState],
  };
  const trustedContent: OperationPreparationContent & OperationResolutionPlannerInput['trustedContent'] = {
    eventDefinition,
    actors: actorInitializations,
    actorInitializations,
    actionDefinitions,
    studentSkillRules: [{
      id: 'skill:focus',
      triggerActionIds: [ACTION_A, ACTION_B],
      chanceBps: 10000,
      effects: [{ kind: 'actorHpDelta', recipient: 'actor', amount: 1 }],
    }],
  };
  const preparedBeat = prepareOperationBeat(preparationSnapshot, trustedContent);
  return {
    snapshot: {
      runId: 'run:test:resolution',
      eventId: eventDefinition.id,
      planVersion: preparationSnapshot.planVersion,
      currentLocationId: preparationSnapshot.currentLocationId,
      actors: [
        { actorId: STUDENT_A, participantKind: 'student', hp: 2, resources: { focus: 1 }, positionId: 'back' },
        { actorId: STUDENT_B, participantKind: 'student', hp: 2, resources: { focus: 1 }, positionId: 'back' },
        { actorId: ENEMY, participantKind: 'opponent', hp: 2, resources: {}, positionId: 'front' },
      ],
      teams: [{ id: TEAM_BLUE, resources: { energy: 0.3 } }],
      tracks: { 'track:momentum': 0 },
      knownFactIds: [],
      heldItemIds: [],
      randomState: { algorithm: OPERATION_TACTICAL_RNG_ALGORITHM, seed: 77, tacticalCursor: 5 },
    },
    trustedContent,
    preparedBeat,
    interventionDraft: null,
  };
}

function expectPlannerError(run: () => unknown, code: string): void {
  try {
    run();
    expect.fail('expected OperationResolutionPlannerError');
  } catch (error) {
    expect(error).toBeInstanceOf(OperationResolutionPlannerError);
    expect((error as OperationResolutionPlannerError).code).toBe(code);
  }
}

describe('pure Operation Resolution planner', () => {
  test('plans actor and target position changes without mutating the snapshot', () => {
    const input = fixture({ positionEffects: [
      { kind: 'actorPosition', recipient: 'actor', positionId: 'front' },
      { kind: 'actorPosition', recipient: 'actor', positionId: 'brace' },
      { kind: 'actorPosition', recipient: 'target', positionId: 'protected' },
    ], disableCombinations: true });
    const before = structuredClone(input);
    const result = planOperationResolution(input);
    expect(input).toEqual(before);
    expect(result.positionChanges).toEqual([
      { actorId: STUDENT_A, before: 'back', after: 'brace', sources: [
        expect.objectContaining({ kind: 'action', actorId: STUDENT_A, effectIndex: 0 }),
        expect.objectContaining({ kind: 'action', actorId: STUDENT_A, effectIndex: 1 }),
      ] },
      { actorId: ENEMY, before: 'front', after: 'protected', sources: [expect.objectContaining({ kind: 'action', actorId: STUDENT_A, effectIndex: 2 })] },
    ]);
  });

  test('rejects a target position effect when the selected action has no target', () => {
    const input = fixture({
      positionEffects: [{ kind: 'actorPosition', recipient: 'target', positionId: 'protected' }],
      disableCombinations: true,
      targetlessAction: true,
    });
    expectPlannerError(() => planOperationResolution(input), 'operation:resolution:invalid-effect');
  });

  test('preflights shared decimal costs, resolves combinations and skills, then clamps aggregated deltas once', () => {
    const input = fixture();
    const before = structuredClone(input);
    const result = planOperationResolution(input);
    const repeated = planOperationResolution(input);

    expect(result).toEqual(repeated);
    expect(input).toEqual(before);
    expect(result).toMatchObject({
      runId: 'run:test:resolution',
      eventId: 'event:test:resolution',
      basePlanVersion: 4,
      locationId: 'location:office',
      payments: [
        { actorId: STUDENT_A, actionId: ACTION_A, scopeId: TEAM_BLUE, cost: { scope: 'team', resourceId: 'energy', amount: 0.1 } },
        { actorId: STUDENT_B, actionId: ACTION_B, scopeId: TEAM_BLUE, cost: { scope: 'team', resourceId: 'energy', amount: 0.1 } },
      ],
      combinations: { matches: [{ ruleId: 'combo:focus', actorAId: STUDENT_A, actorBId: STUDENT_B, targetActorId: ENEMY }] },
      studentSkillChecks: [
        { actorId: STUDENT_A, skillRuleId: 'skill:focus', actionId: ACTION_A, succeeded: true },
        { actorId: STUDENT_B, skillRuleId: 'skill:focus', actionId: ACTION_B, succeeded: true },
      ],
      randomCursorBefore: 5,
      randomCursorAfter: 7,
    });
    expect(result.numericChanges).toEqual([
      {
        target: { kind: 'actorHp', actorId: STUDENT_A },
        before: 2,
        requestedDelta: 2,
        delta: 1,
        after: 3,
        contributions: [
          { amount: 1, source: { kind: 'combination', ruleId: 'combo:focus', actorAId: STUDENT_A, actorBId: STUDENT_B, effectIndex: 0 } },
          { amount: 1, source: { kind: 'studentSkill', actorId: STUDENT_A, skillRuleId: 'skill:focus', actionId: ACTION_A, effectIndex: 0 } },
        ],
      },
      {
        target: { kind: 'actorHp', actorId: STUDENT_B },
        before: 2,
        requestedDelta: 1,
        delta: 1,
        after: 3,
        contributions: [
          { amount: 1, source: { kind: 'studentSkill', actorId: STUDENT_B, skillRuleId: 'skill:focus', actionId: ACTION_B, effectIndex: 0 } },
        ],
      },
      {
        target: { kind: 'teamResource', teamId: TEAM_BLUE, resourceId: 'energy' },
        before: 0.3,
        requestedDelta: -0.2,
        delta: -0.2,
        after: 0.1,
        contributions: [
          { amount: -0.1, source: { kind: 'payment', actorId: STUDENT_A, actionId: ACTION_A, scopeId: TEAM_BLUE, resourceId: 'energy' } },
          { amount: -0.1, source: { kind: 'payment', actorId: STUDENT_B, actionId: ACTION_B, scopeId: TEAM_BLUE, resourceId: 'energy' } },
        ],
      },
      {
        target: { kind: 'track', trackId: 'track:momentum' },
        before: 0,
        requestedDelta: 2,
        delta: 2,
        after: 2,
        contributions: [
          { amount: 2, source: { kind: 'combination', ruleId: 'combo:focus', actorAId: STUDENT_A, actorBId: STUDENT_B, effectIndex: 1 } },
        ],
      },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.numericChanges[0].contributions)).toBe(true);
    expect(Object.isFrozen(input.trustedContent.actionDefinitions[0].cost)).toBe(false);
  });

  test('opposing contributions cancel before the pool is clamped', () => {
    const input = fixture();
    const eventDefinition = {
      ...input.trustedContent.eventDefinition,
      locations: input.trustedContent.eventDefinition.locations!.map(row => ({
        ...row,
        combinationRules: row.combinationRules.map(rule => ({
          ...rule,
          effects: [
            { kind: 'actorHpDelta' as const, recipient: 'actor' as const, amount: 3 },
            { kind: 'actorHpDelta' as const, recipient: 'actor' as const, amount: -3 },
          ],
        })),
      })),
    };
    const result = planOperationResolution({
      ...input,
      trustedContent: { ...input.trustedContent, eventDefinition },
    });
    const studentAChange = result.numericChanges.find(change => change.target.kind === 'actorHp' && change.target.actorId === STUDENT_A);

    expect(studentAChange).toMatchObject({ before: 2, requestedDelta: 1, delta: 1, after: 3 });
    expect(studentAChange?.contributions.map(contribution => contribution.amount)).toEqual([3, -3, 1]);
  });

  test('rejects stale base plans without changing the supplied Run snapshot', () => {
    const input = fixture();
    const before = structuredClone(input);
    const plans = [...input.preparedBeat.actorPlans];
    plans[0] = { ...plans[0], actionId: 'action:forged' };
    const stale = { ...input, preparedBeat: { ...input.preparedBeat, actorPlans: plans } };

    expectPlannerError(() => planOperationResolution(stale), 'operation:resolution:stale-plan');
    expect(input).toEqual(before);
    expect(stale).toEqual({ ...input, preparedBeat: { ...input.preparedBeat, actorPlans: plans } });
  });

  test('returns a planner diagnostic for malformed stored plan rows', () => {
    const input = fixture();
    const malformed = {
      ...input,
      preparedBeat: { ...input.preparedBeat, actorPlans: [null, ...input.preparedBeat.actorPlans.slice(1)] },
    } as unknown as OperationResolutionPlannerInput;

    expectPlannerError(() => planOperationResolution(malformed), 'operation:resolution:stale-plan');
  });

  test('rejects undeclared effect resources before returning a partial batch', () => {
    const input = fixture({ invalidActionEffect: true });
    const before = structuredClone(input);

    expectPlannerError(() => planOperationResolution(input), 'operation:resolution:invalid-effect');
    expect(input).toEqual(before);
  });

  test('applies stored InterventionDraft before the skill and Combination calculations', () => {
    const input = fixture();
    const directed = { ...input, interventionDraft: { actorId: STUDENT_A, targetActorId: STUDENT_B } };
    const before = structuredClone(directed);
    const result = planOperationResolution(directed);

    expect(directed).toEqual(before);
    expect(Object.isFrozen(directed.interventionDraft)).toBe(false);
    expect(result.intervention).toMatchObject({
      actorId: STUDENT_A,
      before: { actorId: STUDENT_A, targetActorId: ENEMY },
      after: { actorId: STUDENT_A, targetActorId: STUDENT_B },
    });
    expect(result.combinations.matches).toEqual([]);
    expect(result.studentSkillChecks.map(check => check.actorId)).toEqual([STUDENT_A, STUDENT_B]);
    expect(result.numericChanges.find(change => change.target.kind === 'actorHp' && change.target.actorId === STUDENT_A))
      .toMatchObject({ requestedDelta: -2, before: 2, after: 0, delta: -2 });
    expect(result.numericChanges.find(change => change.target.kind === 'actorHp' && change.target.actorId === STUDENT_B))
      .toMatchObject({ requestedDelta: -2, before: 2, after: 0, delta: -2 });
  });

  test('rechecks an intervention target against the Action Actor ID and type scopes at Resolution', () => {
    const input = fixture();
    const actionDefinitions = input.trustedContent.actionDefinitions.map(actionDefinition => actionDefinition.id === ACTION_A
      ? {
        ...actionDefinition,
        target: {
          kind: 'actor' as const,
          relation: 'any' as const,
          allowedActorIds: [ENEMY],
          allowedActorTypes: ['opponent'],
        },
      }
      : actionDefinition);
    const trustedContent = { ...input.trustedContent, actionDefinitions };
    const preparationSnapshot: OperationPreparationSnapshot = {
      eventId: input.snapshot.eventId,
      planVersion: input.snapshot.planVersion,
      currentLocationId: input.snapshot.currentLocationId,
      actors: input.snapshot.actors.map(({ actorId, participantKind, resources }) => ({ actorId, participantKind, resources })),
      teams: input.snapshot.teams,
    };
    const preparationContent: OperationPreparationContent = {
      eventDefinition: trustedContent.eventDefinition,
      actors: trustedContent.actorInitializations,
      actionDefinitions: trustedContent.actionDefinitions,
    };
    const preparedBeat = prepareOperationBeat(preparationSnapshot, preparationContent);
    const invalidIntervention = {
      ...input,
      trustedContent,
      preparedBeat,
      interventionDraft: { actorId: STUDENT_A, targetActorId: STUDENT_B },
    };
    const before = structuredClone(invalidIntervention);

    expectPlannerError(() => planOperationResolution(invalidIntervention), 'operation:resolution:invalid-content');
    expect(invalidIntervention).toEqual(before);
  });

  test('records independent Actor-scope payments and cannot use an earlier Action gain to pay a later plan', () => {
    const actorCostInput = fixture();
    const actorCostActions = actorCostInput.trustedContent.actionDefinitions.map((actionDefinition, index) => index < 2
      ? { ...actionDefinition, cost: { scope: 'actor' as const, resourceId: 'focus', amount: index === 0 ? 0.2 : 0.4 } }
      : actionDefinition);
    const actorCostContent = { ...actorCostInput.trustedContent, actionDefinitions: actorCostActions };
    const actorCostPrepContent = { ...actorCostContent, actors: actorCostContent.actorInitializations };
    const actorCostPreparationSnapshot: OperationPreparationSnapshot = {
      eventId: actorCostInput.snapshot.eventId,
      planVersion: actorCostInput.snapshot.planVersion,
      currentLocationId: actorCostInput.snapshot.currentLocationId,
      actors: actorCostInput.snapshot.actors.map(state => ({ actorId: state.actorId, participantKind: state.participantKind, resources: state.resources })),
      teams: actorCostInput.snapshot.teams,
    };
    const actorCostResult = planOperationResolution({
      ...actorCostInput,
      trustedContent: actorCostContent,
      preparedBeat: prepareOperationBeat(actorCostPreparationSnapshot, actorCostPrepContent),
    });
    expect(actorCostResult.payments.map(payment => [payment.actorId, payment.scopeId, payment.cost.amount])).toEqual([
      [STUDENT_A, STUDENT_A, 0.2],
      [STUDENT_B, STUDENT_B, 0.4],
    ]);
    expect(actorCostResult.numericChanges.filter(change => change.target.kind === 'actorResource'))
      .toMatchObject([
        { target: { actorId: STUDENT_A, resourceId: 'focus' }, before: 1, after: 0.8, delta: -0.2 },
        { target: { actorId: STUDENT_B, resourceId: 'focus' }, before: 1, after: 0.6, delta: -0.4 },
      ]);

    const gainEvent = {
      ...actorCostInput.trustedContent.eventDefinition,
      actors: actorCostInput.trustedContent.eventDefinition.actors.map(actorDefinition => actorDefinition.id === STUDENT_A
        ? { ...actorDefinition, targetPriorityActorIds: [STUDENT_B] }
        : actorDefinition),
      locations: [{ id: 'location:office', enabledActionIds: [ACTION_A, ACTION_B, ENEMY_ACTION], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    };
    const gainActions = [
      { ...actorCostActions[0], cost: undefined, target: { kind: 'actor' as const, relation: 'any' as const }, effects: [
        { kind: 'actorResourceDelta' as const, recipient: 'target' as const, resourceId: 'focus', amount: 5 },
      ] },
      { ...actorCostActions[1], cost: { scope: 'actor' as const, resourceId: 'focus', amount: 5 }, target: { kind: 'none' as const }, effects: [] },
      actorCostActions[2],
    ];
    const gainContent = { ...actorCostContent, eventDefinition: gainEvent, actionDefinitions: gainActions };
    const gainPrepContent = { ...gainContent, actors: gainContent.actorInitializations };
    const gainSnapshot = {
      ...actorCostInput.snapshot,
      actors: actorCostInput.snapshot.actors.map(state => state.actorId === STUDENT_B
        ? { ...state, resources: { focus: 0 } }
        : state),
    };
    const gainPreparationSnapshot: OperationPreparationSnapshot = {
      eventId: gainSnapshot.eventId,
      planVersion: gainSnapshot.planVersion,
      currentLocationId: gainSnapshot.currentLocationId,
      actors: gainSnapshot.actors.map(state => ({ actorId: state.actorId, participantKind: state.participantKind, resources: state.resources })),
      teams: gainSnapshot.teams,
    };
    const gainBeat = prepareOperationBeat(gainPreparationSnapshot, gainPrepContent);
    const gainResult = planOperationResolution({
      ...actorCostInput,
      snapshot: gainSnapshot,
      trustedContent: gainContent,
      preparedBeat: gainBeat,
    });
    expect(gainResult.actorPlans[1]).toMatchObject({ kind: 'wait', actorId: STUDENT_B });
    expect(gainResult.payments.some(payment => payment.actorId === STUDENT_B)).toBe(false);
    expect(gainResult.numericChanges.find(change => change.target.kind === 'actorResource' && change.target.actorId === STUDENT_B))
      .toMatchObject({ before: 0, requestedDelta: 5, after: 5 });
  });

  test('keeps delimiter-containing Actor and resource IDs in separate numeric pools', () => {
    const input = fixture();
    const event = input.trustedContent.eventDefinition;
    const remappedActors = event.actors.map(actorDefinition => {
      if (actorDefinition.id === STUDENT_A) {
        return { ...actorDefinition, id: 'a:b', teamId: undefined, resources: { c: { initial: 0, min: 0, max: 2 } }, targetPriorityActorIds: undefined };
      }
      if (actorDefinition.id === STUDENT_B) {
        return { ...actorDefinition, id: 'a', teamId: undefined, resources: { 'b:c': { initial: 0, min: 0, max: 2 } }, targetPriorityActorIds: undefined };
      }
      return actorDefinition;
    });
    const eventDefinition: OperationEventDef = {
      ...event,
      actors: remappedActors,
      teams: [],
      locations: [{ id: 'location:office', enabledActionIds: [ACTION_A, ACTION_B, ENEMY_ACTION], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    };
    const actionDefinitions = input.trustedContent.actionDefinitions.map((actionDefinition, index) => index < 2
      ? {
        ...actionDefinition,
        cost: undefined,
        target: { kind: 'none' } as const,
        effects: [{
          kind: 'actorResourceDelta' as const,
          recipient: 'actor' as const,
          resourceId: index === 0 ? 'c' : 'b:c',
          amount: 1,
        }],
      }
      : actionDefinition);
    const actorInitializations = input.trustedContent.actorInitializations.map(initialization => {
      if (initialization.actorId === STUDENT_A) return { ...initialization, actorId: 'a:b' };
      if (initialization.actorId === STUDENT_B) return { ...initialization, actorId: 'a' };
      return initialization;
    });
    const snapshot = {
      ...input.snapshot,
      actors: input.snapshot.actors.map(state => {
        if (state.actorId === STUDENT_A) return { ...state, actorId: 'a:b', resources: { c: 0 } };
        if (state.actorId === STUDENT_B) return { ...state, actorId: 'a', resources: { 'b:c': 0 } };
        return state;
      }),
      teams: [],
    };
    const preparationSnapshot: OperationPreparationSnapshot = {
      eventId: snapshot.eventId,
      planVersion: snapshot.planVersion,
      currentLocationId: snapshot.currentLocationId,
      actors: snapshot.actors.map(state => ({ actorId: state.actorId, participantKind: state.participantKind, resources: state.resources })),
      teams: [],
    };
    const trustedContent = {
      ...input.trustedContent,
      eventDefinition,
      actorInitializations,
      actors: actorInitializations,
      actionDefinitions,
    };
    const preparedBeat = prepareOperationBeat(preparationSnapshot, trustedContent);
    const result = planOperationResolution({ ...input, snapshot, trustedContent, preparedBeat });
    const resourceChanges = result.numericChanges.filter(change => change.target.kind === 'actorResource');

    expect(resourceChanges).toEqual([
      { target: { kind: 'actorResource', actorId: 'a:b', resourceId: 'c' }, before: 0, requestedDelta: 1, delta: 1, after: 1, contributions: [expect.objectContaining({ amount: 1 })] },
      { target: { kind: 'actorResource', actorId: 'a', resourceId: 'b:c' }, before: 0, requestedDelta: 1, delta: 1, after: 1, contributions: [expect.objectContaining({ amount: 1 })] },
    ]);
  });
});
