import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';

const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const PYROXENE = 'base:resource:pyroxene';
const FOUNDATION = 'base:enhancement:foundation';
const ETERNAL = 'base:enhancement:eternal_contract';

describe('Init 生命周期：Global 数据与 per-Init 数据分离', () => {
  const games: GameInstance[] = [];
  const createGame = (): GameInstance => {
    const game = new GameInstance();
    games.push(game);
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
    return game;
  };

  afterEach(() => games.forEach(game => game.stop()));

  test('真正开始新游戏不继承旧 GlobalEnh', () => {
    const game = createGame();
    game.state.resources[PYROXENE] = 100;
    expect(game.enhancements.purchaseEnhancement(FOUNDATION).success).toBe(true);
    expect(game.inits.startNewGame(OFFICE)).toBe(true);
    expect(game.state.unlockedEnhancements).not.toContain(FOUNDATION);
  });

  test('新进入 Init、暂时离开和彻底 Init 都保留 GlobalEnh', () => {
    const game = createGame();
    game.state.resources[PYROXENE] = 300;
    expect(game.enhancements.purchaseEnhancement(FOUNDATION).success).toBe(true);
    game.inits.unlockInit(MILLENNIUM);

    game.inits.restartInit();
    expect(game.inits.resumeInit(MILLENNIUM)).toBe(true);
    expect(game.state.unlockedEnhancements).toContain(FOUNDATION);

    game.inits.restartInit();
    expect(game.inits.resumeInit(OFFICE)).toBe(true);
    expect(game.state.unlockedEnhancements).toContain(FOUNDATION);

    game.inits.hardRestartInit();
    expect(game.state.unlockedEnhancements).toContain(FOUNDATION);
  });

  test('恢复旧 Init 不会覆盖后来获得的 GlobalEnh', () => {
    const game = createGame();
    game.state.resources[PYROXENE] = 400;
    expect(game.enhancements.purchaseEnhancement(FOUNDATION).success).toBe(true);
    game.inits.restartInit();
    game.inits.unlockInit(MILLENNIUM);
    expect(game.inits.resumeInit(MILLENNIUM)).toBe(true);

    game.mutations.addEnhancement(ETERNAL);
    game.inits.restartInit();
    expect(game.inits.resumeInit(OFFICE)).toBe(true);
    expect(game.state.unlockedEnhancements).toEqual(expect.arrayContaining([FOUNDATION, ETERNAL]));
  });
});
