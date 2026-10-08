import { describe, expect, test } from 'vitest';
import type { OperationEventDef, OperationRunStartInput } from '../../src/arona-clicker/contracts/operation';
import type { OperationActionDef } from '../../src/arona-clicker/contracts/operation-action';
import type { OperationCardPoolDef, OperationStrategyProfileDef } from '../../src/data-services/contracts/operation';
import { OperationRuntimeService } from '../../src/arona-clicker/services/operation-runtime-service';

const ACTOR_ID = 'test:actor:student';
const ACTION_ID = 'test:action:protect';
const POOL_ID = 'test:pool:backline';
const STRATEGY_ID = 'test:strategy:protective';

function runStartInput(): OperationRunStartInput {
  const eventDefinition: OperationEventDef = {
    id: 'test:operation:view-hand',
    cardPoolIds: [POOL_ID],
    characterHandSize: 1,
    locations: [{ id: 'test:location:room', enabledActionIds: [ACTION_ID], combinationRules: [],
      maxVisits: 1,
      routeEdges: [{ id: 'stay', targetLocationId: 'test:location:room', label: 'Return', description: 'Return to the room.' }] }],
    maxLocationVisits: 1,
    initialLocationId: 'test:location:room',
    tracks: [],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors: [{ id: ACTOR_ID, type: 'student', positionId: 'back', hp: { initial: 4, min: 0, max: 4 } }],
    playerRouteState: { playerCost: 0 },
    randomSeed: 29,
  };
  const action: OperationActionDef = {
    id: ACTION_ID,
    title: ACTION_ID,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['reason:protect'],
    tagIds: [],
    strategyTagIds: ['protect'],
    target: { kind: 'none' },
    effects: [],
  };
  const profile = {
    id: 'test:profile:student',
    characterId: 'test:character:student',
    candidateActionIds: [ACTION_ID],
    actionPriorityIds: [ACTION_ID],
    capabilityIds: [],
    reasonIds: ['reason:student'],
    strategyProfileId: STRATEGY_ID,
    cardPoolIds: [],
    actionCandidates: [{
      actionId: ACTION_ID,
      eligible: true,
      requiredCapabilityIds: [],
      missingCapabilityIds: [],
      reasonIds: ['reason:student', 'reason:protect'],
    }],
    eligibleActionIds: [ACTION_ID],
  } as const;
  const operationCardPools: readonly OperationCardPoolDef[] = [{
    id: POOL_ID,
    selector: { positionIds: ['back'] },
    entries: [{ actionId: ACTION_ID, weight: 5 }],
  }];
  const operationStrategyProfiles: readonly OperationStrategyProfileDef[] = [{
    id: STRATEGY_ID,
    biases: [{ tagId: 'protect', biasBps: 12000 }],
  }];
  return {
    eventDefinition,
    actors: [{ actorId: ACTOR_ID, participantKind: 'student', characterId: profile.characterId, profile }],
    actionDefinitions: [action],
    studentSkillRules: [],
    operationCardPools,
    operationStrategyProfiles,
  };
}

describe('OperationView Character Hand projection', () => {
  test('projects saved Hand diagnostics as detached actor data without using the player scene deck', () => {
    const runtime = new OperationRuntimeService();
    const run = runtime.start(runStartInput());
    const beforeView = runtime.getSnapshot();
    const view = runtime.getView();

    expect(view?.actorStates[0]).toMatchObject({
      id: ACTOR_ID,
      positionId: 'back',
      characterHand: {
        actorId: ACTOR_ID,
        actionIds: [ACTION_ID],
        matchedPoolIds: [POOL_ID],
        candidates: [{
          actionId: ACTION_ID,
          sourcePoolIds: [POOL_ID],
          eligible: true,
          baseWeight: 5,
          strategyFactorBps: 12000,
          finalWeight: 60000,
        }],
      },
    });
    expect(view?.playerCards.hand).toEqual([]);
    expect(view?.playerCards.drawPileCount).toBe(0);
    expect(view?.map).toEqual({
      nodes: [{ locationId: 'test:location:room', visitCount: 1, maxVisits: 1, current: true, visited: true, completed: false }],
      edges: [{ routeId: 'stay', sourceLocationId: 'test:location:room', targetLocationId: 'test:location:room',
        label: 'Return', description: 'Return to the room.', available: false,
        lockedReason: 'operation:route:location-incomplete', requiredHeldItemId: null, anyOfHeldItemIds: [], consumesHeldItem: false }],
    });
    expect(runtime.getSnapshot()).toEqual(beforeView);
    expect(runtime.getSnapshot()?.random).toEqual(run.random);

    const editable = structuredClone(view!);
    (editable.actorStates[0].characterHand!.candidates[0].sourcePoolIds as string[]).push('test:pool:mutated');
    expect(runtime.getView()).toEqual(view);
    expect(runtime.getSnapshot()).toEqual(beforeView);
  });
});
