import { describe, expect, test } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { gameplayBMapDatapack } from '../../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';

function gameWithTraining(): GameInstance {
  const game = new GameInstance();
  game.init([baseDatapack, gameplayBMapDatapack]);
  return game;
}

function startTraining(game: GameInstance): void {
  const preview = game.variantTraining.preview('normal');
  if (preview.status !== 'ready') throw new Error(preview.issues[0]?.message);
  game.variantTraining.start(preview.token);
}

describe('Variant training Runtime isolation', () => {
  test('runs real combat independently of a normal active MapRun and the player save', () => {
    const game = gameWithTraining();
    game.mutations.acquireCharacter('Shiroko', 'story');
    game.mutations.acquireCharacter('Serika', 'story');
    game.startMap('gameplay-b:map:minimal-battle');
    const player = JSON.stringify(game.state);
    const normalMap = JSON.stringify(game.mapRun.getSnapshot());
    const normalSave = JSON.stringify(game.save().mapRun);

    startTraining(game);
    game.variantTraining.commitRound(game.variantTraining.getView().commitVersion);
    const point = JSON.parse(JSON.stringify(game.variantTraining.save()));
    game.variantTraining.commitRound(game.variantTraining.getView().commitVersion);
    const restored = game.variantTraining.load(point);

    expect(restored.phase).toBe('battle');
    expect(restored.partyHp).toBe(8);
    expect(JSON.stringify(game.state)).toBe(player);
    expect(JSON.stringify(game.mapRun.getSnapshot())).toBe(normalMap);
    expect(JSON.stringify(game.save().mapRun)).toBe(normalSave);
    expect(game.save()).not.toHaveProperty('variantTraining');
    expect(game.state.roster).not.toHaveProperty('Hoshino');
    game.dispose();
  });

  test.each(['init', 'load', 'reset', 'dispose'] as const)('%s clears the dedicated test owner and tokens', operation => {
    const game = gameWithTraining();
    startTraining(game);
    const pending = game.variantTraining.preview('enhanced');
    if (pending.status !== 'ready') throw new Error('Expected training preview');
    const save = game.save();
    if (operation === 'init') game.init([baseDatapack, gameplayBMapDatapack]);
    if (operation === 'load') game.load(save);
    if (operation === 'reset') game.reset();
    if (operation === 'dispose') game.dispose();
    expect(game.variantTraining.getView().phase).toBe('preparation');
    expect(() => game.variantTraining.start(pending.token)).toThrow();
    game.dispose();
  });

  test('Init A→B→A clears testing state even if no query runs in between', () => {
    const game = gameWithTraining();
    startTraining(game);
    const pending = game.variantTraining.preview('normal');
    if (pending.status !== 'ready') throw new Error('Expected training preview');
    game.inits.enterInit('base:init:millennium');
    game.inits.enterInit('base:init:schale_office');
    expect(game.variantTraining.getView().phase).toBe('preparation');
    expect(() => game.variantTraining.start(pending.token)).toThrow();
    game.dispose();
  });
});
