import { describe, expect, test } from 'vitest';
import type { OperationEventDef } from '../../src/arona-clicker/contracts/operation';
import { OperationRuntimeService } from '../../src/arona-clicker/services/operation-runtime-service';
import { createOperationPlayerSceneCardInstances, shuffleOperationPlayerSceneDeck } from '../../src/arona-clicker/services/operation-player-scene-deck';

function deckEvent(seed = 17): OperationEventDef {
  const route = (id: string, targetLocationId: string) => ({
    id,
    targetLocationId,
    label: 'Continue',
    description: 'Move to the next location.',
  });
  return {
    id: 'test:operation:card-deck',
    locations: [
      { id: 'test:location:a', stage: 'scene', enabledActionIds: [], combinationRules: [], routeEdges: [route('test:route:a-b', 'test:location:b')] },
      { id: 'test:location:b', stage: 'scene', enabledActionIds: [], combinationRules: [], routeEdges: [route('test:route:b-c', 'test:location:c')] },
      { id: 'test:location:c', stage: 'scene', enabledActionIds: [], combinationRules: [], routeEdges: [] },
    ],
    initialLocationId: 'test:location:a',
    maxLocationVisits: 5,
    tracks: [],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors: [],
    playerRouteState: { playerCost: 0 },
    playerSceneDeck: {
      cards: [
        { id: 'test:player-card:aid', actionId: 'test:action:aid', playerCost: 1, timing: 'scene', copies: 3 },
        { id: 'test:player-card:signal', actionId: 'test:action:signal', playerCost: 0, timing: 'scene', copies: 2 },
      ],
      initialDraw: 1,
      locationEntryDraw: 2,
      maxHandSize: 3,
    },
    randomSeed: seed,
  };
}

describe('Operation finite player SceneCard deck', () => {
  test('derives unique physical IDs from seed, definition, and copy ordinal with an isolated shuffle order', () => {
    const event = deckEvent();
    const instances = createOperationPlayerSceneCardInstances(event);
    expect(instances).toHaveLength(5);
    expect(new Set(instances.map(card => card.cardInstanceId)).size).toBe(5);
    expect(instances.filter(card => card.cardDefId === 'test:player-card:aid').map(card => card.cardInstanceId))
      .toEqual([0, 1, 2].map(ordinal => expect.stringContaining(encodeURIComponent('test:player-card:aid') + ':' + ordinal)));

    expect(shuffleOperationPlayerSceneDeck(event)).toEqual(shuffleOperationPlayerSceneDeck(deckEvent()));
    expect(shuffleOperationPlayerSceneDeck(event)).not.toEqual(shuffleOperationPlayerSceneDeck(deckEvent(18)));
  });

  test('draws at Run start and Location entry up to the hand limit; discarded cards never return', () => {
    const service = new OperationRuntimeService();
    let run = service.start(deckEvent());
    expect(run.playerRouteState.cards.hand).toHaveLength(1);
    expect(run.playerRouteState.cards.drawPile).toHaveLength(4);
    const seedOrder = [...run.playerRouteState.cards.drawPile];

    let completed = service.completeCurrentLocation();
    service.transitionRoute({ runId: completed.runId, planVersion: completed.planVersion, routeId: 'test:route:a-b' });
    run = service.getSnapshot()!;
    expect(run.currentLocationId).toBe('test:location:b');
    expect(run.playerRouteState.cards.hand).toHaveLength(3);
    expect(run.playerRouteState.cards.drawPile).toHaveLength(2);

    const hand = [...run.playerRouteState.cards.hand];
    service.applyStateDelta({
      playerRouteState: {
        cards: {
          drawPile: [...run.playerRouteState.cards.drawPile],
          hand: [],
          discard: hand,
        },
      },
    });
    completed = service.completeCurrentLocation();
    service.transitionRoute({ runId: completed.runId, planVersion: completed.planVersion, routeId: 'test:route:b-c' });
    run = service.getSnapshot()!;
    expect(run.currentLocationId).toBe('test:location:c');
    expect(run.playerRouteState.cards.hand).toHaveLength(2);
    expect(run.playerRouteState.cards.drawPile).toHaveLength(0);
    expect(run.playerRouteState.cards.discard).toEqual(hand);
    expect(seedOrder).toHaveLength(4);
  });
});
