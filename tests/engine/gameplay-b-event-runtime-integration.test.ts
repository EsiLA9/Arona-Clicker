import { afterEach, describe, expect, test } from 'vitest';
import type { OperationEventDef } from '../../src/arona-clicker/contracts/operation';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';

function eventDef(): OperationEventDef {
  return {
    id: 'test:operation:integration',
    locationIds: ['test:location:office'],
    initialLocationId: 'test:location:office',
    tracks: [{ id: 'danger', initial: 1, min: 0, max: 5 }],
    factIds: ['door_open'],
    knownFactIds: [],
    itemIds: ['archive_key'],
    heldItemIds: [],
    actors: [],
    playerRouteState: {
      playerCost: 2,
      cards: { drawPile: ['test:card:inspect'], hand: [], discard: [], played: [] },
    },
    randomSeed: 17,
  };
}

function stateSnapshot(game: GameInstance): string {
  return JSON.stringify(game.state);
}

describe('Gameplay B Event Runtime integration', () => {
  const games: GameInstance[] = [];

  function createGame(): GameInstance {
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack], { enterDefaultInit: false });
    return game;
  }

  afterEach(() => {
    for (const game of games.splice(0)) {
      if (!game.running) continue;
      game.stop();
    }
  });

  test('wires a separate Run service per GameInstance and leaves PlayerState untouched', () => {
    const first = createGame();
    const second = createGame();
    const firstState = stateSnapshot(first);
    const secondState = stateSnapshot(second);

    expect(first.operationRuntime).not.toBe(second.operationRuntime);
    const firstRun = first.operationRuntime.start(eventDef());
    const secondRun = second.operationRuntime.start(eventDef());
    first.operationRuntime.applyStateDelta({
      tracks: { danger: 4 },
      knownFacts: [{ id: 'door_open', present: true }],
      heldItems: [{ id: 'archive_key', present: true }],
      playerRouteState: { playerCost: 7 },
    });

    expect(first.operationRuntime.getSnapshot()).toMatchObject({
      runId: firstRun.runId,
      eventState: { tracks: { danger: 4 }, knownFactIds: ['door_open'], heldItemIds: ['archive_key'] },
      playerRouteState: { playerCost: 7 },
    });
    expect(second.operationRuntime.getSnapshot()).toMatchObject({
      runId: secondRun.runId,
      eventState: { tracks: { danger: 1 }, knownFactIds: [], heldItemIds: [] },
      playerRouteState: { playerCost: 2 },
    });
    expect(stateSnapshot(first)).toBe(firstState);
    expect(stateSnapshot(second)).toBe(secondState);
  });

  test('clears volatile Runs at init, reset, load, and reload while stop preserves a Run', () => {
    const game = createGame();
    const startRun = () => game.operationRuntime.start(eventDef());

    startRun();
    game.stop();
    expect(game.operationRuntime.getSnapshot()).not.toBeNull();

    game.reset();
    expect(game.operationRuntime.getSnapshot()).toBeNull();
    expect(() => startRun()).not.toThrow();

    const save = game.save();
    game.load(save);
    expect(game.operationRuntime.getSnapshot()).toBeNull();

    startRun();
    game.reload([baseDatapack], { enterDefaultInit: false });
    expect(game.operationRuntime.getSnapshot()).toBeNull();

    startRun();
    game.init([], { enterDefaultInit: false });
    expect(game.operationRuntime.getSnapshot()).toBeNull();
  });

  test('disposes the local Operation Runtime and stops the GameInstance tick loop', () => {
    const game = createGame();
    game.operationRuntime.start(eventDef());
    game.start();

    game.dispose();

    expect(game.running).toBe(false);
    expect(game.operationRuntime.getSnapshot()).toBeNull();
    expect(() => game.operationRuntime.applyStateDelta({ tracks: { danger: 2 } })).toThrow(/disposed/);
  });

  test('provides the Operation Runtime fallback for custom no-op Wiring', () => {
    const game = new GameInstance({ wiring: () => undefined });

    expect(game.operationRuntime).toBeDefined();
    expect(game.operationRuntime.start(eventDef()).eventId).toBe('test:operation:integration');
  });
});
