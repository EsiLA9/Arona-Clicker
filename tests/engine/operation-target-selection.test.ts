import { describe, expect, test } from 'vitest';
import type { OperationEventDef, OperationActorDef } from '../../src/arona-clicker/contracts/operation';
import type { OperationActionTargetDef } from '../../src/arona-clicker/contracts/operation-action';
import { OperationTargetSelectionError, selectOperationTarget } from '../../src/arona-clicker/services/operation-target-selection';

function actor(
  id: string,
  teamId?: string,
  targetPriorityActorIds?: readonly string[],
): OperationActorDef {
  return {
    id,
    type: 'test-actor',
    hp: { initial: 1, min: 0, max: 1 },
    ...(teamId ? { teamId } : {}),
    ...(targetPriorityActorIds ? { targetPriorityActorIds } : {}),
  };
}

function event(actors: readonly OperationActorDef[], teams: readonly string[] = ['team:red', 'team:blue']): OperationEventDef {
  return {
    id: 'test:operation:target-selection',
    locations: [{ id: 'test:location:office', enabledActionIds: [], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    initialLocationId: 'test:location:office',
    tracks: [],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors,
    teams: teams.map(id => ({ id })),
    playerRouteState: { playerCost: 0 },
  };
}

describe('Operation automatic target selection', () => {
  test('a no-target Action returns an explicit none selection', () => {
    const definition = event([actor('source')]);

    expect(selectOperationTarget(definition, 'source', { kind: 'none' })).toEqual({
      kind: 'none',
      targetActorId: null,
    });
  });

  test('self always selects the source even when another Actor has higher listed priority', () => {
    const definition = event([
      actor('source', 'team:red', ['ally']),
      actor('ally', 'team:red'),
    ]);

    expect(selectOperationTarget(definition, 'source', { kind: 'actor', relation: 'self' })).toEqual({
      kind: 'actor',
      targetActorId: 'source',
    });
  });

  test('sameTeam skips preferred enemy and teamless Actors before choosing the preferred ally', () => {
    const definition = event([
      actor('source', 'team:red', ['teamless', 'enemy', 'ally']),
      actor('enemy', 'team:blue'),
      actor('teamless'),
      actor('ally', 'team:red'),
    ]);

    expect(selectOperationTarget(definition, 'source', { kind: 'actor', relation: 'sameTeam' })).toEqual({
      kind: 'actor',
      targetActorId: 'ally',
    });
  });

  test('sameTeam has no target for a teamless source', () => {
    const definition = event([actor('source'), actor('ally', 'team:red')]);

    expect(selectOperationTarget(definition, 'source', { kind: 'actor', relation: 'sameTeam' })).toMatchObject({
      kind: 'unavailable',
      targetActorId: null,
    });
  });

  test('otherTeam requires declared, different teams and skips teamless preferences', () => {
    const definition = event([
      actor('source', 'team:red', ['teamless', 'same-team', 'blue']),
      actor('same-team', 'team:red'),
      actor('teamless'),
      actor('blue', 'team:blue'),
    ]);

    expect(selectOperationTarget(definition, 'source', { kind: 'actor', relation: 'otherTeam' })).toEqual({
      kind: 'actor',
      targetActorId: 'blue',
    });
  });

  test('otherTeam has no target when the source has no declared Team', () => {
    const definition = event([actor('source'), actor('opponent', 'team:blue')]);

    expect(selectOperationTarget(definition, 'source', { kind: 'actor', relation: 'otherTeam' })).toMatchObject({
      kind: 'unavailable',
      targetActorId: null,
    });
  });

  test('any can select a teamless Actor and follows explicit preference before Event order', () => {
    const definition = event([
      actor('first', 'team:red'),
      actor('source', 'team:blue', ['teamless']),
      actor('teamless'),
    ]);

    expect(selectOperationTarget(definition, 'source', { kind: 'actor', relation: 'any' })).toEqual({
      kind: 'actor',
      targetActorId: 'teamless',
    });
  });

  test('any falls back to Event Actor declaration order when no preference is configured', () => {
    const definition = event([actor('first'), actor('source'), actor('third')]);

    expect(selectOperationTarget(definition, 'source', { kind: 'actor', relation: 'any' })).toEqual({
      kind: 'actor',
      targetActorId: 'first',
    });
  });

  test('reports undeclared preferred Actors and unknown source Actors concretely', () => {
    const undeclaredPriority = event([actor('source', undefined, ['missing'])]);
    const normal = event([actor('source')]);

    expect(() => selectOperationTarget(undeclaredPriority, 'source', { kind: 'actor', relation: 'any' }))
      .toThrow(/targetPriorityActorIds references an undeclared Event Actor: missing/);
    expect(() => selectOperationTarget(normal, 'missing', { kind: 'actor', relation: 'self' }))
      .toThrow(/target source references an undeclared Event Actor: missing/);
  });

  test('rejects malformed target relations instead of treating them as no-target', () => {
    const definition = event([actor('source')]);
    const malformed = { kind: 'actor', relation: 'faction' } as unknown as OperationActionTargetDef;

    expect(() => selectOperationTarget(definition, 'source', malformed)).toThrow(OperationTargetSelectionError);
    expect(() => selectOperationTarget(definition, 'source', null as unknown as OperationActionTargetDef))
      .toThrow(/target definition must be an object/);
  });

  test('rejects undeclared Team membership even for a no-target selection', () => {
    const definition = event([actor('source', 'team:missing')]);

    expect(() => selectOperationTarget(definition, 'source', { kind: 'none' }))
      .toThrow(/event actor source references an undeclared Team: team:missing/);
  });
});
