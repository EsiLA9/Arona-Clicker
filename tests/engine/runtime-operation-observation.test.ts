import { describe, expect, test } from 'vitest';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { createGameCommands } from '../../src/arona-clicker/runtime-commands';

const INIT = 'test:init:operation-observation';
const AREA = 'test:area:operation-observation';
const SPOT = 'test:spot:operation-observation';
const CREDIT = 'test:resource:credit';
const TOKEN = 'test:item:token';

function datapack(): Datapack {
  return {
    name: 'operation observation',
    version: '1',
    inits: [{ id: INIT, name: 'Observation', description: '', defaultAreas: [AREA] }],
    areas: [{ id: AREA, initId: INIT, name: 'Observation', description: '', defaultSpots: [SPOT] }],
    spots: [{
      id: SPOT,
      areaId: AREA,
      name: 'Observation Spot',
      description: '',
      tags: [],
      purchaseOptions: [],
      levelUpgrades: [{
        level: 2,
        paymentOptions: [{
          id: 'mixed',
          costs: [
            { type: 'resource', resourceId: CREDIT, amount: { type: 'const', value: 5 } },
            { type: 'item', itemId: TOKEN, amount: { type: 'const', value: 1 } },
          ],
        }],
        effects: [],
      }],
    }],
    enhancements: [],
    activeStories: [],
    passiveStories: [],
    stories: [],
    items: [{ id: TOKEN, name: 'Token', description: '', maxStack: 99, rarity: 'common', type: 'material' }],
    funcletDefs: [],
    characters: [],
  };
}

function setup() {
  const game = new GameInstance();
  game.init([datapack()]);
  game.state.spotLevels[SPOT] = 1;
  game.state.resources[CREDIT] = 10;
  game.state.inventory[TOKEN] = 2;
  return { game, commands: createGameCommands(game) };
}

describe('Runtime Spot upgrade operation observation', () => {
  test('captures the completed command result, scoped state delta, and synchronous log window', () => {
    const { game, commands } = setup();
    const previousLogIds = new Set(game.getDevLogs().map(entry => entry.id));

    expect(commands.upgradeSpot(SPOT, 'mixed')).toMatchObject({ success: true, newLevel: 2 });

    const [observation] = game.getOperationObservations({ limit: 1 });
    expect(observation).toMatchObject({
      schemaVersion: 1,
      operation: { kind: 'spot-upgrade', spotId: SPOT, paymentOptionId: 'mixed' },
      result: { success: true, newLevel: 2 },
      identity: { activeInit: INIT, contentRevision: 'unknown' },
      before: {
        spotLevel: 1,
        resources: { global: {}, currentInit: { [CREDIT]: 10 } },
        inventory: { [TOKEN]: 2 },
      },
      after: {
        spotLevel: 2,
        resources: { global: {}, currentInit: { [CREDIT]: 5 } },
        inventory: { [TOKEN]: 1 },
      },
      changes: {
        spotLevel: { from: 1, to: 2 },
        resources: [{ scope: 'currentInit', resourceId: CREDIT, from: 10, to: 5 }],
        inventory: [{ itemId: TOKEN, from: 2, to: 1 }],
      },
      logs: { association: 'captured-during-command' },
    });
    expect(observation.logs.entries.every(entry => !previousLogIds.has(entry.id))).toBe(true);
    expect(observation.captureId).toMatch(/^runtime-local-\d+$/);
  });

  test('captures a structured rejection with unchanged state and no partial commit', () => {
    const { game, commands } = setup();
    game.state.resources[CREDIT] = 0;
    game.state.inventory[TOKEN] = 0;
    const events: string[] = [];
    game.eventBus.onAny(event => events.push(event.type));

    expect(commands.upgradeSpot(SPOT, 'mixed')).toMatchObject({ success: false, error: 'InsufficientResource' });

    const [observation] = game.getOperationObservations({ limit: 1 });
    expect(observation.result).toMatchObject({ success: false, error: 'InsufficientResource' });
    expect(observation.after).toEqual(observation.before);
    expect(events).toEqual([]);
  });

  test('does not claim to capture direct SpotService calls', () => {
    const { game } = setup();

    game.spot.upgradeSpot(SPOT, 'mixed');

    expect(game.getOperationObservations()).toEqual([]);
  });

  test('clears volatile observations at init, reset, and load boundaries', () => {
    const { game, commands } = setup();
    commands.upgradeSpot(SPOT, 'mixed');
    expect(game.getOperationObservations()).toHaveLength(1);

    game.init([datapack()]);
    expect(game.getOperationObservations()).toEqual([]);
    game.state.spotLevels[SPOT] = 1;
    game.state.resources[CREDIT] = 10;
    game.state.inventory[TOKEN] = 2;
    createGameCommands(game).upgradeSpot(SPOT, 'mixed');
    expect(game.getOperationObservations()).toHaveLength(1);

    const save = game.save();
    game.load(save);
    expect(game.getOperationObservations()).toEqual([]);
    createGameCommands(game).upgradeSpot(SPOT, 'mixed');
    expect(game.getOperationObservations()).toHaveLength(1);
    game.reset();
    expect(game.getOperationObservations()).toEqual([]);
  });

  test('query results are defensive copies and query does not run GameNum evaluation', () => {
    const { game, commands } = setup();
    commands.upgradeSpot(SPOT, 'mixed');
    const observation = game.getOperationObservations({ limit: 1 })[0];
    const evalResource = game.gameNumSystem.evaluateResourceGain;
    const evalSpot = game.gameNumSystem.evaluateSpotYield;
    let resourceCalls = 0;
    let spotCalls = 0;
    game.gameNumSystem.evaluateResourceGain = ((...args: Parameters<typeof evalResource>) => {
      resourceCalls += 1;
      return evalResource.apply(game.gameNumSystem, args);
    }) as typeof evalResource;
    game.gameNumSystem.evaluateSpotYield = ((...args: Parameters<typeof evalSpot>) => {
      spotCalls += 1;
      return evalSpot.apply(game.gameNumSystem, args);
    }) as typeof evalSpot;

    (observation.before.resources.currentInit as Record<string, number>)[CREDIT] = 999;
    expect(game.getOperationObservation(observation.captureId)?.before.resources.currentInit[CREDIT]).toBe(10);
    expect(resourceCalls).toBe(0);
    expect(spotCalls).toBe(0);
  });
});
