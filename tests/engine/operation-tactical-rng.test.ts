import { describe, expect, test } from 'vitest';
import {
  OPERATION_TACTICAL_RNG_ALGORITHM,
  type OperationActorDef,
  type OperationActorInitialization,
  type OperationEventDef,
  type OperationStudentProfileSnapshot,
  type OperationTacticalRandomState,
} from '../../src/arona-clicker/contracts/operation';
import type { OperationStudentSkillRuleDef } from '../../src/arona-clicker/contracts/operation-skill';
import type { OperationPreparedActorPlan, PreparedBeat } from '../../src/arona-clicker/contracts/operation-beat';
import {
  OperationTacticalRngError,
  operationTacticalWordAt,
  sampleOperationTacticalBelow,
  sampleOperationTacticalIntegerRange,
  rollOperationStudentSkills,
} from '../../src/arona-clicker/services/operation-tactical-rng';

const UINT64 = 1n << 64n;

function actor(id: string, type: 'student' | 'opponent' | 'environment'): OperationActorDef {
  return { id, type, hp: { initial: 1, min: 0, max: 1 } };
}

function studentInitialization(actorId: string, randomSkillRuleId?: string): OperationActorInitialization {
  const profile: OperationStudentProfileSnapshot = {
    id: 'profile:' + actorId,
    characterId: 'character:' + actorId,
    candidateActionIds: [],
    actionPriorityIds: [],
    capabilityIds: [],
    reasonIds: [],
    actionCandidates: [],
    eligibleActionIds: [],
    ...(randomSkillRuleId ? { randomSkillRuleId } : {}),
  };
  return { actorId, participantKind: 'student', characterId: profile.characterId, profile };
}

function eventDefinition(actors: readonly OperationActorDef[]): OperationEventDef {
  return {
    id: 'test:operation:rng',
    locations: [{ id: 'location:office', enabledActionIds: [], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    initialLocationId: 'location:office',
    tracks: [],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors,
    playerRouteState: { playerCost: 0, cards: { drawPile: [], hand: [], discard: [], played: [] } },
  };
}

function plan(
  actorId: string,
  participantKind: 'student' | 'opponent' | 'environment',
  kind: OperationPreparedActorPlan['kind'],
  actionId: string,
): OperationPreparedActorPlan {
  return {
    actorId,
    participantKind,
    kind,
    source: participantKind === 'student' ? 'student-profile' : 'participant',
    actionId,
    targetActorId: null,
    cost: null,
    reasonIds: [],
  };
}

function preparedBeat(actorPlans: readonly OperationPreparedActorPlan[]): PreparedBeat {
  return { planVersion: 3, locationId: 'location:office', actorPlans };
}

const state = (seed = 0, tacticalCursor = 0): OperationTacticalRandomState => ({
  algorithm: OPERATION_TACTICAL_RNG_ALGORITHM,
  seed,
  tacticalCursor,
});

function wordHex(seed: number, cursor: number): string {
  return operationTacticalWordAt(seed, cursor).toString(16).padStart(16, '0');
}

describe('counter-addressed Operation tactical RNG', () => {
  test('matches fixed SplitMix64 word vectors for the fixed tactical stream tag', () => {
    expect([
      wordHex(0, 0),
      wordHex(0, 1),
      wordHex(0, 2),
      wordHex(1, 0),
      wordHex(42, 0),
      wordHex(-1, 0),
    ]).toEqual([
      'edfa4a494ac668b9',
      '26ea6f28a37dcbe9',
      '926be09dd2b8c690',
      'f5785b133a7b0908',
      'd33e4845ff7c25b6',
      '8580424329beb0ad',
    ]);
    expect(operationTacticalWordAt(0, 0)).not.toBe(operationTacticalWordAt(0, 1));
    expect(operationTacticalWordAt(0, 0)).not.toBe(operationTacticalWordAt(1, 0));
  });

  test('samples unbiased [0,10000) values and returns a provisional next cursor', () => {
    const input = state(0, 0);
    const first = sampleOperationTacticalBelow(input, 10000n);
    const second = sampleOperationTacticalBelow(first.nextRandomState, 10000n);
    const third = sampleOperationTacticalBelow(second.nextRandomState, 10000n);

    expect([first.value, second.value, third.value]).toEqual([9785n, 457n, 960n]);
    expect([first.rawWordsConsumed, second.rawWordsConsumed, third.rawWordsConsumed]).toEqual([1, 1, 1]);
    expect(third.nextRandomState).toEqual(state(0, 3));
    expect(input).toEqual(state(0, 0));
  });

  test('counts rejected raw words and matches the large-bound rejection vector', () => {
    const sample = sampleOperationTacticalBelow(state(0, 1), (1n << 63n) + 1n);

    expect(sample.value).toBe(1327401483640555151n);
    expect(sample.rawWordsConsumed).toBe(2);
    expect(sample.nextRandomState).toEqual(state(0, 3));
  });

  test('accepts bounds one and 2^64, and rejects empty ranges without changing input', () => {
    const input = state(42, 8);
    expect(sampleOperationTacticalBelow(input, 1n)).toMatchObject({ value: 0n, rawWordsConsumed: 1, nextRandomState: state(42, 9) });
    expect(sampleOperationTacticalBelow(input, UINT64)).toMatchObject({
      value: operationTacticalWordAt(42, 8),
      rawWordsConsumed: 1,
      nextRandomState: state(42, 9),
    });
    expect(() => sampleOperationTacticalBelow(input, 0n)).toThrow(OperationTacticalRngError);
    expect(() => sampleOperationTacticalBelow(input, UINT64 + 1n)).toThrow(OperationTacticalRngError);
    expect(() => sampleOperationTacticalIntegerRange(input, 5n, 5n)).toThrow(/non-empty half-open interval/);
    expect(() => sampleOperationTacticalIntegerRange(input, 10n, 9n)).toThrow(/non-empty half-open interval/);
    expect(sampleOperationTacticalIntegerRange(input, -3n, 0n).value).toBeGreaterThanOrEqual(-3n);
    expect(sampleOperationTacticalIntegerRange(input, -3n, 0n).value).toBeLessThan(0n);
    expect(input).toEqual(state(42, 8));
  });

  test('rejects invalid state and cursor overflow without returning partial advancement', () => {
    expect(() => operationTacticalWordAt(1.5, 0)).toThrow(/seed must be a safe integer/);
    expect(() => operationTacticalWordAt(0, -1)).toThrow(/tacticalCursor must be a non-negative safe integer/);
    expect(() => sampleOperationTacticalBelow({ ...state(), algorithm: 'unknown' as typeof OPERATION_TACTICAL_RNG_ALGORITHM }, 10n))
      .toThrow(/random algorithm/);
    expect(() => sampleOperationTacticalBelow(state(0, Number.MAX_SAFE_INTEGER), 10n))
      .toThrow(/cannot advance/);

    let seed = 0;
    let firstWord = operationTacticalWordAt(seed, Number.MAX_SAFE_INTEGER - 1);
    while (firstWord >= (UINT64 - 2n) / 2n) {
      seed += 1;
      firstWord = operationTacticalWordAt(seed, Number.MAX_SAFE_INTEGER - 1);
    }
    const cursorState = state(seed, Number.MAX_SAFE_INTEGER - 1);
    const boundThatRejectsFirstWord = UINT64 - firstWord - 1n;
    expect(() => sampleOperationTacticalBelow(cursorState, boundThatRejectsFirstWord))
      .toThrow(/cannot advance/);
    expect(cursorState).toEqual(state(seed, Number.MAX_SAFE_INTEGER - 1));
  });

  test('checks triggered Skills once in Event order and consumes samples even at 0 or 10000 bps', () => {
    const first = actor('actor:first', 'student');
    const second = actor('actor:second', 'student');
    const unmatched = actor('actor:unmatched', 'student');
    const waiting = actor('actor:waiting', 'student');
    const opponent = actor('actor:opponent', 'opponent');
    const event = eventDefinition([first, second, unmatched, waiting, opponent]);
    const initializations = [
      studentInitialization(first.id, 'skill:never'),
      studentInitialization(second.id, 'skill:always'),
      studentInitialization(unmatched.id, 'skill:unmatched'),
      studentInitialization(waiting.id, 'skill:waiting'),
      { actorId: opponent.id, participantKind: 'opponent' as const, candidateActionIds: [] },
    ];
    const rules: OperationStudentSkillRuleDef[] = [
      { id: 'skill:never', triggerActionIds: ['action:trigger'], chanceBps: 0, effects: [] },
      { id: 'skill:always', triggerActionIds: ['action:trigger'], chanceBps: 10000, effects: [] },
      { id: 'skill:unmatched', triggerActionIds: ['action:other'], chanceBps: 10000, effects: [] },
      { id: 'skill:waiting', triggerActionIds: ['action:trigger'], chanceBps: 10000, effects: [] },
    ];
    const beat = preparedBeat([
      plan(first.id, 'student', 'studentAction', 'action:trigger'),
      plan(second.id, 'student', 'studentAction', 'action:trigger'),
      plan(unmatched.id, 'student', 'studentAction', 'action:trigger'),
      plan(waiting.id, 'student', 'wait', 'operation:action:wait'),
      plan(opponent.id, 'opponent', 'intent', 'action:trigger'),
    ]);
    const inputState = state(0, 0);

    const result = rollOperationStudentSkills(event, initializations, beat, rules, inputState);

    expect(result.checks).toEqual([
      { actorId: first.id, skillRuleId: 'skill:never', actionId: 'action:trigger', chanceBps: 0, rollBps: 9785, succeeded: false, rawWordsConsumed: 1 },
      { actorId: second.id, skillRuleId: 'skill:always', actionId: 'action:trigger', chanceBps: 10000, rollBps: 457, succeeded: true, rawWordsConsumed: 1 },
    ]);
    expect(result.nextRandomState).toEqual(state(0, 2));
    expect(inputState).toEqual(state(0, 0));
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.checks)).toBe(true);
  });

  test('does not consume words for unmatched triggers and rejects missing referenced rules', () => {
    const student = actor('actor:student', 'student');
    const event = eventDefinition([student]);
    const initialization = studentInitialization(student.id, 'skill:unmatched');
    const beat = preparedBeat([plan(student.id, 'student', 'studentAction', 'action:other')]);
    const inputState = state(42, 7);
    const noRoll = rollOperationStudentSkills(event, [initialization], beat, [
      { id: 'skill:unmatched', triggerActionIds: ['action:trigger'], chanceBps: 10000, effects: [] },
    ], inputState);
    expect(noRoll.checks).toEqual([]);
    expect(noRoll.nextRandomState).toEqual(state(42, 7));
    expect(inputState).toEqual(state(42, 7));
    expect(Object.isFrozen(inputState)).toBe(false);
    expect(() => rollOperationStudentSkills(event, [initialization], beat, [], state()))
      .toThrow(/references a missing Student Skill rule/);
  });
});
