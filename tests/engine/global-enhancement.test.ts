// ============================================================
// engine/global-enhancement.test.ts — GlobalEnhancement（global 挂靠强化）
// 购买/热插拔/不可撤回 语义
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';

const CREDIT = 'base:resource:credit';
const PYROXENE = 'base:resource:pyroxene';
const OFFICE = 'base:init:schale_office';
const PRINTER = 'base:spot:credit_printer';
const FOUNDATION = 'base:enh:foundation';
const UNIFIED = 'base:enh:unified_logistics';
const ETERNAL = 'base:enh:eternal_contract';

describe('GlobalEnhancement（global 挂靠强化）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('global 强化经全局乘区作用（可购买、全局生效）', () => {
    game.state.resources[PYROXENE] = 100;
    expect(game.enhancements.purchaseEnhancement(FOUNDATION).success).toBe(true);

    // credit_printer：5 × 2.0（foundation）+ 功能 2
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels[PRINTER] = 1;
    game.state.resources[CREDIT] = 0;
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(5 * 2.0 + 2);
  });

  test('可热插拔的 global 强化可移除并重新购买', () => {
    game.state.resources[PYROXENE] = 100;
    expect(game.enhancements.purchaseEnhancement(FOUNDATION).success).toBe(true);
    expect(game.enhancements.removeEnhancement(FOUNDATION)).toBe(true);
    expect(game.state.unlockedEnhancements).not.toContain(FOUNDATION);
    game.state.resources[PYROXENE] = 100;
    expect(game.enhancements.purchaseEnhancement(FOUNDATION).success).toBe(true);
  });

  test('irreversible 的 global 强化获得后不可撤回（移除被拒）', () => {
    game.state.resources[PYROXENE] = 200;
    game.state.resources[CREDIT] = 500;
    expect(game.enhancements.purchaseEnhancement(ETERNAL).success).toBe(true);
    expect(game.enhancements.removeEnhancement(ETERNAL)).toBe(false);
    expect(game.state.unlockedEnhancements).toContain(ETERNAL);
    // 非 irreversible 的 global 强化不受影响，仍可移除
    expect(game.enhancements.purchaseEnhancement(UNIFIED).success).toBe(true);
    expect(game.enhancements.removeEnhancement(UNIFIED)).toBe(true);
  });

  test('global 强化的 id 与 attachment 元数据可在注册表中解析', () => {
    const def = game.registry.enhancements.get(FOUNDATION)!;
    expect(def.attachment?.kind).toBe('global');
    expect(game.registry.enhancements.get(ETERNAL)!.irreversible).toBe(true);
  });
});
