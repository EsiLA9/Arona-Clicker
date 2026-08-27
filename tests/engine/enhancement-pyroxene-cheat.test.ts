// ============================================================
// engine/enhancement-pyroxene-cheat.test.ts — 测试用青辉石灌注 Enhancement
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';

const PYROXENE = 'base:resource:pyroxene';
const OFFICE = 'base:init:schale_office';
const CHEAT = 'base:enh:test_pyroxene_cheat';

describe('测试用青辉石灌注（每 tick +2500）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  /** 青辉石为全局资源（globalResources），非 per-Init resources。 */
  const pyroxeneAmount = () => game.state.globalResources?.[PYROXENE] ?? 0;

  test('免费购买后每 tick +2500 青辉石', () => {
    // 免费：无 price → 立即可购
    const enh = game.registry.enhancements.get(CHEAT)!;
    expect(enh.price).toBeUndefined();
    expect(game.purchaseEnhancement(CHEAT).success).toBe(true);

    expect(pyroxeneAmount()).toBe(0);
    game.tick();
    expect(pyroxeneAmount()).toBeGreaterThanOrEqual(2500);
    game.tick();
    expect(pyroxeneAmount()).toBeGreaterThanOrEqual(5000);
  });

  test('未购买时不产出青辉石', () => {
    game.tick();
    expect(pyroxeneAmount()).toBe(0);
  });
});
