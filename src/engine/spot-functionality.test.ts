// ============================================================
// engine/spot-functionality.test.ts — Spot 功能系统
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from './game-instance';
import { baseDatapack } from '../data/index';
import { and } from './types';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';

describe('SpotFunctionalitySystem', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.startNewGame(OFFICE);
  });

  afterEach(() => {
    game.stop();
  });

  test('linearYield functionality scales with spot level', () => {
    const spot = game.registry.spots.get('base:spot:credit_printer')!;
    const ys = (level: number) =>
      game.spotFunctionalitySystem.extraYields(spot, level, game.state);
    expect(ys(1)).toEqual([{ spotId: spot.id, resource: CREDIT, amount: 2 }]);
    expect(ys(3)).toEqual([{ spotId: spot.id, resource: CREDIT, amount: 6 }]);
  });

  test('conditioned functionality is ignored while its condition is unmet', () => {
    // field_work 功能条件：全局累计产出 > 100 信用点
    const spot = game.registry.spots.get('base:spot:field_work')!;
    expect(game.spotFunctionalitySystem.extraYields(spot, 1, game.state)).toEqual([]);

    // 累计产出超过阈值后生效（level 1 → 每级 +1）
    game.mutations.changeResource(CREDIT, 101);
    expect(game.spotFunctionalitySystem.extraYields(spot, 1, game.state)).toEqual([
      { spotId: spot.id, resource: CREDIT, amount: 1 },
    ]);
  });

  test('tick settles functionality output alongside base yield', () => {
    // 仅结算 credit_printer（base 5 + 功能 2）
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.resources[CREDIT] = 0;
    game.tick();
    expect(game.state.resources[CREDIT]).toBe(7);
  });

  test('upgrading to a higher level raises linear functionality output', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 3;
    game.state.resources[CREDIT] = 0;
    game.tick();
    // base 5 + 线性 2×2 + 功能 3×2 = 15
    expect(game.state.resources[CREDIT]).toBe(15);
  });

  test('primitiveGain aggregates base + functionality without per-spot capacity cap', () => {
    for (const key of Object.keys(game.state.spotLevels)) delete game.state.spotLevels[key];
    game.state.spotLevels['base:spot:credit_printer'] = 1;
    game.state.resources[CREDIT] = 499;
    game.tick();
    // 统一 primitiveGain 路径：base 5 + 功能 2，直接入账（spot capacity 不再截断 gain）
    expect(game.state.resources[CREDIT]).toBe(506);
  });

  test('condition system can reference the stat DSL inside a functionality', () => {
    const group = and({
      target: 'stat',
      key: `$GlobalProducedAmount ${CREDIT}`,
      comparator: '>',
      value: 100,
    });
    const spot = game.registry.spots.get('base:spot:field_work')!;
    const fn = spot.functionalities?.find(f => f.condition);
    expect(fn).toBeDefined();
    expect(fn!.condition).toEqual(group);
  });

  test('spot functionality is mounted as a real Affector instance', () => {
    const creditInstances = game.affectorEngine.getActiveInstances()
      .filter(i => i.mountEntityId === 'base:spot:credit_printer');
    expect(creditInstances).toHaveLength(1);
    expect(creditInstances[0].packId).toBe('base:func:credit_printer_linear');

    // field_work 的条件功能初始不满足 → 挂载但保持 Latent（不在 active 列表）
    const fieldInstances = game.affectorEngine.getActiveInstances()
      .filter(i => i.mountEntityId === 'base:spot:field_work');
    expect(fieldInstances).toHaveLength(0);
  });

  test('conditioned functionality becomes Active once its stat condition is met', () => {
    // field_work 现在为购买获得，先解锁（level 1）
    game.mutations.setSpotLevel('base:spot:field_work', 1);
    // 累计产出超过阈值；条件由统计驱动，tick 时会全量重估 Affector
    game.mutations.changeResource(CREDIT, 101);
    game.tick();

    const field = game.affectorEngine.getActiveInstances()
      .filter(i => i.mountEntityId === 'base:spot:field_work');
    expect(field).toHaveLength(1);
  });

  test('external functionalities are injected from an unlocked enhancement by tag match', () => {
    // 购买 field_logistics（解锁条件 field_work>=2），其 addsFunctionalities 注入 field/combat/tactical Spot
    game.state.resources[CREDIT] = 500;
    game.state.spotLevels['base:spot:field_work'] = 2;
    expect(game.purchaseEnhancement('base:enh:field_logistics').success).toBe(true);

    const fieldWork = game.registry.spots.get('base:spot:field_work')!;
    expect(game.spotFunctionalitySystem.hasFunctionality(fieldWork, game.state, 'restartInit')).toBe(true);
    // 不匹配 tag 的 Spot（archive 为 office/archive）不获得外源功能
    const archive = game.registry.spots.get('base:spot:archive')!;
    expect(game.spotFunctionalitySystem.hasFunctionality(archive, game.state, 'restartInit')).toBe(false);
  });

  test('removing the enhancement drops its external functionalities', () => {
    game.state.resources[CREDIT] = 500;
    game.state.spotLevels['base:spot:field_work'] = 2;
    expect(game.purchaseEnhancement('base:enh:field_logistics').success).toBe(true);

    const fieldWork = game.registry.spots.get('base:spot:field_work')!;
    expect(game.spotFunctionalitySystem.hasFunctionality(fieldWork, game.state, 'restartInit')).toBe(true);
    expect(game.removeEnhancement('base:enh:field_logistics')).toBe(true);
    expect(game.spotFunctionalitySystem.hasFunctionality(fieldWork, game.state, 'restartInit')).toBe(false);
  });

  test('restartInit ends the current game and resets state', () => {
    game.mutations.changeResource(CREDIT, 50);
    game.restartInit();
    expect(game.running).toBe(false);
    expect(game.state.resources[CREDIT]).toBeUndefined();
    expect(game.state.activeInit).toBe('');
  });
});
