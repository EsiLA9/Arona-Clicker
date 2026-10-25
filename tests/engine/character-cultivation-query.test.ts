import { describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/base/datapack';

function gameWithHoshino(): GameInstance {
  const game = new GameInstance();
  game.init([baseDatapack]);
  game.mutations.acquireCharacter('Hoshino', 'story');
  return game;
}

describe('RosterSystem.cultivationOf', () => {
  test('projects default curve, affection config, owned shards and read-only decisions', () => {
    const game = gameWithHoshino();
    const before = JSON.stringify(game.state);
    const view = game.rosterSystem.cultivationOf(game.state, 'Hoshino');

    expect(view).toMatchObject({
      level: 1, exp: 0, levelCap: 30, expToNext: 100, canTrain: true,
      affectionLevel: 1, affectionExp: 0, affectionLevelCap: 20, affectionExpToNext: 15, canInteract: true,
      stars: 0, shards: 0, starCost: 1, canBreakthrough: false, breakthroughReason: 'insufficient-shards',
    });
    expect(view && Object.isFrozen(view)).toBe(true);
    expect(JSON.stringify(game.state)).toBe(before);
  });

  test('returns null unless the Variant is both registered and owned', () => {
    const game = gameWithHoshino();
    expect(game.rosterSystem.cultivationOf(game.state, 'HoshinoSwimsuit')).toBeNull();
    (game as any)._state.roster.Ghost = { variantId: 'Ghost', level: 1, exp: 0, stars: 0 };
    expect(game.rosterSystem.cultivationOf(game.state, 'Ghost')).toBeNull();
  });

  test('uses the account cap, level caps, star cap and breakthrough validation', () => {
    const game = gameWithHoshino();
    const state = (game as any)._state;
    state.accountLevelCap = 2;
    state.roster.Hoshino.level = 2;
    state.roster.Hoshino.affectionLevel = 20;
    const capped = game.rosterSystem.cultivationOf(game.state, 'Hoshino');
    expect(capped).toMatchObject({
      level: 2, levelCap: 2, expToNext: null, canTrain: false,
      affectionLevel: 20, affectionLevelCap: 20, affectionExpToNext: null, canInteract: false,
      starCost: 1, canBreakthrough: false, breakthroughReason: 'insufficient-shards',
    });

    state.fragments.Hoshino = 1;
    expect(game.rosterSystem.cultivationOf(game.state, 'Hoshino')).toMatchObject({
      shards: 1, starCost: 1, canBreakthrough: true,
    });
    state.roster.Hoshino.stars = 5;
    expect(game.rosterSystem.cultivationOf(game.state, 'Hoshino')).toMatchObject({
      stars: 5, starCost: null, canBreakthrough: false, breakthroughReason: 'at-max',
    });
  });
});
