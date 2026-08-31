// ============================================================
// engine/enhancement-scope.test.ts — Enhancement 作用域（全局/当前 Init）
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const PRINTER = 'base:spot:credit_printer';
const HANGAR_SPOT = 'base:spot:hangar_supply';
const CREDIT_SYSTEM = 'base:enhancement:credit_system';

describe('Enhancement 作用域（全局/当前 Init）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('purchased enhancement applies across every area within the init', () => {
    game.state.resources[CREDIT] = 500;
    expect(game.enhancements.purchaseEnhancement(CREDIT_SYSTEM).success).toBe(true);

    // schale_main 的 credit_printer：5×1.5 + 功能 2（走 mutation 入口：事件驱动失效）
    for (const key of Object.keys(game.state.spotLevels)) game.mutations.setSpotLevel(key, 0);
    game.mutations.setSpotLevel(PRINTER, 1);
    game.mutations.setResource(CREDIT, 0);
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(5 * 1.5 + 2);

    // schale_hangar 的 hangar_supply（其它 Area）：同样受全局倍率 9×1.5
    for (const key of Object.keys(game.state.spotLevels)) game.mutations.setSpotLevel(key, 0);
    game.mutations.setSpotLevel(HANGAR_SPOT, 1);
    game.mutations.setResource(CREDIT, 0);
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(9 * 1.5);
  });

  test('no mysterious attachment label is exposed on the view', () => {
    // GameView 不暴露挂靠信息（挂靠仅为 def 级可选元数据，不参与作用域）
    expect(game.getView()).not.toHaveProperty('enhancementAttachments');
  });

  test('removing an enhancement disables it and allows re-purchase', () => {
    game.state.resources[CREDIT] = 500;
    expect(game.enhancements.purchaseEnhancement(CREDIT_SYSTEM).success).toBe(true);

    // 生效中：hangar 的 spot 受 ×1.5
    for (const key of Object.keys(game.state.spotLevels)) game.mutations.setSpotLevel(key, 0);
    game.mutations.setSpotLevel(HANGAR_SPOT, 1);
    game.mutations.setResource(CREDIT, 0);
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(9 * 1.5);

    // 移除 → 不再作用
    expect(game.enhancements.removeEnhancement(CREDIT_SYSTEM)).toBe(true);
    game.mutations.setResource(CREDIT, 0);
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(9);

    // 可重新购买
    game.state.resources[CREDIT] = 500;
    expect(game.enhancements.purchaseEnhancement(CREDIT_SYSTEM).success).toBe(true);
  });
});
