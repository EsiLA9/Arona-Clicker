import { describe, expect, test } from 'vitest';
import type { OperationActorDef, OperationEventDef } from '../../src/arona-clicker/contracts/operation/operation';
import type {
  OperationActionDef,
  OperationCombinationRuleDef,
} from '../../src/arona-clicker/contracts/operation/operation-action';
import type { OperationPreparedActorPlan, PreparedBeat } from '../../src/arona-clicker/contracts/operation/operation-beat';
import {
  OperationCombinationResolverError,
  resolveOperationCombinations,
} from '../../src/arona-clicker/services/operation/operation-combination-resolver';

function actor(id: string, type: 'student' | 'opponent' | 'environment'): OperationActorDef {
  return { id, type, hp: { initial: 1, min: 0, max: 1 } };
}

function action(
  id: string,
  tagIds: readonly string[],
  target: OperationActionDef['target'] = { kind: 'none' },
  kinds: OperationActionDef['allowedParticipantKinds'] = ['student'],
): OperationActionDef {
  return {
    id,
    title: id,
    allowedParticipantKinds: kinds,
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds,
    target,
    effects: [],
  };
}

function rule(
  id: string,
  priority: number,
  inputTagIds: readonly [string, string],
  targetMatch: OperationCombinationRuleDef['targetMatch'] = 'no-target',
): OperationCombinationRuleDef {
  return { id, priority, inputTagIds, targetMatch, effects: [] };
}

function plan(
  actorId: string,
  participantKind: 'student' | 'opponent' | 'environment',
  kind: OperationPreparedActorPlan['kind'],
  actionId: string,
  targetActorId: string | null = null,
): OperationPreparedActorPlan {
  return {
    actorId,
    participantKind,
    kind,
    source: participantKind === 'student' ? 'student-profile' : 'participant',
    actionId,
    targetActorId,
    cost: null,
    reasonIds: [],
  };
}

function eventDefinition(
  actors: readonly OperationActorDef[],
  rules: readonly OperationCombinationRuleDef[],
): OperationEventDef {
  return {
    id: 'test:operation:combination',
    locations: [{ id: 'location:office', stage: 'combat', enabledActionIds: [], combinationRules: rules, routeEdges: [] }, { id: 'location:arcade', stage: 'combat', enabledActionIds: [], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    initialLocationId: 'location:office',
    tracks: [],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors,
    playerRouteState: { playerCost: 0 },
  };
}

function beat(actorPlans: readonly OperationPreparedActorPlan[], locationId = 'location:office'): PreparedBeat {
  return { planVersion: 12, locationId, actorPlans };
}

function assertError(run: () => unknown, pattern: RegExp): void {
  try {
    run();
    expect.fail('expected OperationCombinationResolverError');
  } catch (error) {
    expect(error).toBeInstanceOf(OperationCombinationResolverError);
    expect((error as Error).message).toMatch(pattern);
  }
}

describe('current-Location Operation Combination resolver', () => {
  test('uses priority, code-unit rule ID, and Event pair order as one total ordering', () => {
    const first = actor('actor:first', 'student');
    const second = actor('actor:second', 'student');
    const third = actor('actor:third', 'student');
    const event = eventDefinition([first, second, third], [
      rule('rule:zeta', 0, ['slot:zeta:a', 'slot:zeta:b']),
      rule('rule:beta', 0, ['slot:beta:a', 'slot:beta:b']),
      rule('rule:alpha', 1, ['slot:beta:a', 'slot:beta:b']),
    ]);
    const actions = [
      action('action:first', ['slot:zeta:a', 'slot:beta:a']),
      action('action:second', ['slot:zeta:b', 'slot:beta:b']),
      action('action:third', ['slot:zeta:b', 'slot:beta:b']),
    ];
    const prepared = beat([
      plan(first.id, 'student', 'studentAction', 'action:first'),
      plan(second.id, 'student', 'studentAction', 'action:second'),
      plan(third.id, 'student', 'studentAction', 'action:third'),
    ]);

    const result = resolveOperationCombinations(event, prepared, actions);

    expect(result).toEqual({
      planVersion: 12,
      locationId: 'location:office',
      matches: [{
        ruleId: 'rule:beta',
        priority: 0,
        actorAId: first.id,
        actorBId: second.id,
        actionAId: 'action:first',
        actionBId: 'action:second',
        targetActorId: null,
      }],
    });
  });

  test('consumes each student once while allowing multiple disjoint pairs', () => {
    const students = [0, 1, 2, 3].map(index => actor('actor:' + index, 'student'));
    const event = eventDefinition(students, [rule('rule:pair', 0, ['tag:a', 'tag:b'])]);
    const actions = students.map((_, index) => action('action:' + index, ['tag:a', 'tag:b']));
    const prepared = beat(students.map((student, index) => plan(
      student.id, 'student', 'studentAction', 'action:' + index,
    )));

    const result = resolveOperationCombinations(event, prepared, actions);

    expect(result.matches.map(match => [match.actorAId, match.actorBId])).toEqual([
      [students[0].id, students[1].id],
      [students[2].id, students[3].id],
    ]);
    expect(new Set(result.matches.flatMap(match => [match.actorAId, match.actorBId])).size).toBe(4);
  });

  test('distinguishes same-target from no-target and excludes Wait and non-student Intent', () => {
    const noneA = actor('actor:none-a', 'student');
    const noneB = actor('actor:none-b', 'student');
    const sameA = actor('actor:same-a', 'student');
    const sameB = actor('actor:same-b', 'student');
    const differentA = actor('actor:different-a', 'student');
    const differentB = actor('actor:different-b', 'student');
    const waiting = actor('actor:wait', 'student');
    const opponent = actor('actor:opponent', 'opponent');
    const targetA = actor('actor:target-a', 'environment');
    const targetB = actor('actor:target-b', 'environment');
    const actors = [noneA, noneB, sameA, sameB, differentA, differentB, waiting, opponent, targetA, targetB];
    const event = eventDefinition(actors, [
      rule('rule:same', 0, ['tag:red', 'tag:blue'], 'same-target'),
      rule('rule:none', 1, ['tag:red', 'tag:blue'], 'no-target'),
    ]);
    const actions = [
      action('action:none-red', ['tag:red']),
      action('action:none-blue', ['tag:blue']),
      action('action:same-red', ['tag:red'], { kind: 'actor', relation: 'any' }),
      action('action:same-blue', ['tag:blue'], { kind: 'actor', relation: 'any' }),
      action('action:different-red', ['tag:red'], { kind: 'actor', relation: 'any' }),
      action('action:different-blue', ['tag:blue'], { kind: 'actor', relation: 'any' }),
      action('action:wait-matching', ['tag:red']),
      action('action:enemy-blue', ['tag:blue'], { kind: 'none' }, ['opponent']),
    ];
    const prepared = beat([
      plan(noneA.id, 'student', 'studentAction', 'action:none-red'),
      plan(noneB.id, 'student', 'studentAction', 'action:none-blue'),
      plan(sameA.id, 'student', 'studentAction', 'action:same-red', targetA.id),
      plan(sameB.id, 'student', 'studentAction', 'action:same-blue', targetA.id),
      plan(differentA.id, 'student', 'studentAction', 'action:different-red', targetA.id),
      plan(differentB.id, 'student', 'studentAction', 'action:different-blue', targetB.id),
      plan(waiting.id, 'student', 'wait', 'operation:action:wait'),
      plan(opponent.id, 'opponent', 'intent', 'action:enemy-blue'),
      plan(targetA.id, 'environment', 'wait', 'operation:action:wait'),
      plan(targetB.id, 'environment', 'wait', 'operation:action:wait'),
    ]);

    const result = resolveOperationCombinations(event, prepared, actions);

    expect(result.matches.map(match => [match.ruleId, match.actorAId, match.actorBId, match.targetActorId])).toEqual([
      ['rule:same', sameA.id, sameB.id, targetA.id],
      ['rule:none', noneA.id, noneB.id, null],
    ]);
  });

  test('does not reverse ordered tag slots and returns empty for another Location', () => {
    const first = actor('actor:first', 'student');
    const second = actor('actor:second', 'student');
    const event = eventDefinition([first, second], [rule('rule:ordered', 0, ['tag:a', 'tag:b'])]);
    const actions = [action('action:first', ['tag:b']), action('action:second', ['tag:a'])];
    const prepared = beat([
      plan(first.id, 'student', 'studentAction', 'action:first'),
      plan(second.id, 'student', 'studentAction', 'action:second'),
    ]);

    expect(resolveOperationCombinations(event, prepared, actions).matches).toEqual([]);
    expect(resolveOperationCombinations(event, beat(prepared.actorPlans, 'location:arcade'), actions).matches).toEqual([]);
  });

  test('rejects malformed plan order, duplicate rule IDs, and duplicate Action IDs', () => {
    const first = actor('actor:first', 'student');
    const second = actor('actor:second', 'student');
    const event = eventDefinition([first, second], [rule('rule:duplicate', 0, ['tag:a', 'tag:b'])]);
    const duplicateRules = eventDefinition([first, second], [
      rule('rule:duplicate', 0, ['tag:a', 'tag:b']),
      rule('rule:duplicate', 1, ['tag:a', 'tag:b']),
    ]);
    const actions = [action('action:first', ['tag:a']), action('action:second', ['tag:b'])];
    const prepared = beat([
      plan(first.id, 'student', 'studentAction', 'action:first'),
      plan(second.id, 'student', 'studentAction', 'action:second'),
    ]);

    assertError(() => resolveOperationCombinations(event, beat([...prepared.actorPlans].reverse()), actions), /declaration order/);
    assertError(() => resolveOperationCombinations(duplicateRules, prepared, actions), /duplicate rule ID/);
    assertError(() => resolveOperationCombinations(event, prepared, [actions[0], actions[0]]), /duplicate Action ID/);
  });
});
