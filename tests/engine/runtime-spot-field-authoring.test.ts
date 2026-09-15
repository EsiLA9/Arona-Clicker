import { describe, expect, test, vi } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { defaultDatapack } from '../../src/arona-clicker/content';
import type { RuntimeSpotInput } from '../../src/arona-clicker/contracts/runtime-content';
import type { PlayerState } from '../../src/arona-clicker/types/state';

const AREA = 'base:area:schale_main';
const MOD = 'draft-mod';
const SPOT_ID = `${MOD}:spot:desk`;
const CREDIT = 'base:resource:credit';

const spotInput = (overrides: Partial<RuntimeSpotInput> = {}): RuntimeSpotInput => ({
  idName: 'desk',
  areaId: AREA,
  name: 'Desk',
  description: 'Temporary desk',
  baseCost: 0,
  baseCostResource: CREDIT,
  baseYield: 5,
  baseYieldResource: CREDIT,
  baseCapacity: 3,
  ...overrides,
});

const makeGame = () => {
  const game = new AronaClickerRuntime();
  game.init([defaultDatapack]);
  const content = game.spot.content;
  expect(content).toBeDefined();
  if (!content) throw new Error('SpotContentService 未接入');
  expect(content.setModMetadata({ modName: MOD, displayName: 'Draft Mod', version: '1.0.0', author: '', description: '' }).ok).toBe(true);
  // 热提交（setModMetadata / create）可能重建 PlayerState，因此每次断言都重新读取。
  const state = (): PlayerState => game.state as unknown as PlayerState;
  return { game, content, state };
};

describe('Spot 字段级 Authoring：Apply 后由对应消费者生效', () => {
  test('maxLevel：热改后立即约束升级', () => {
    const { game, content } = makeGame();
    expect(content.create(MOD, spotInput({ maxLevel: 1, upgradeCostBase: 0 }), 0).ok).toBe(true);
    expect(game.registry.spots.get(SPOT_ID)?.maxLevel).toBe(1);
    expect(game.spot.getEffectiveMaxLevel(SPOT_ID)).toBe(1);

    expect(game.spot.unlockSpot(SPOT_ID)).toMatchObject({ success: true });
    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: false, error: 'MaxLevel' });

    const applied = content.replace(MOD, 'desk', spotInput({ maxLevel: 3, upgradeCostBase: 0 }), content.getState().revision);

    expect(applied.ok).toBe(true);
    expect(game.spot.getEffectiveMaxLevel(SPOT_ID)).toBe(3);
    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: true, newLevel: 2 });
  });

  test('upgradeCostBase / upgradeCostGrowth：热改后立即参与升级报价', () => {
    const { game, content, state } = makeGame();
    expect(content.create(MOD, spotInput({ upgradeCostBase: 5, upgradeCostGrowth: 2 }), 0).ok).toBe(true);
    expect(game.registry.spots.get(SPOT_ID)).toMatchObject({ upgradeCostBase: 5, upgradeCostGrowth: 2 });

    state().resources[CREDIT] = 10_000;
    expect(game.spot.unlockSpot(SPOT_ID)).toMatchObject({ success: true });

    const charge = vi.spyOn(game.mutations, 'changeResource');
    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: true, newLevel: 2 });
    expect(charge).toHaveBeenCalledWith(CREDIT, -10);
    charge.mockClear();

    const applied = content.replace(MOD, 'desk', spotInput({ upgradeCostBase: 5, upgradeCostGrowth: 3 }), content.getState().revision);
    expect(applied.ok).toBe(true);

    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: true, newLevel: 3 });
    expect(charge).toHaveBeenCalledWith(CREDIT, -45);
    charge.mockRestore();
  });

  test('升级报价随热改上升到资源不足边界', () => {
    const { game, content, state } = makeGame();
    expect(content.create(MOD, spotInput({ upgradeCostBase: 5, upgradeCostGrowth: 2 }), 0).ok).toBe(true);
    state().resources[CREDIT] = 9;
    expect(game.spot.unlockSpot(SPOT_ID)).toMatchObject({ success: true });

    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: false, error: 'InsufficientResource' });

    const applied = content.replace(MOD, 'desk', spotInput({ upgradeCostBase: 5, upgradeCostGrowth: 1 }), content.getState().revision);
    expect(applied.ok).toBe(true);

    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: true, newLevel: 2 });
  });

  test('yieldPerLevel：热改后产出增量按新值生效', () => {
    const { game, content, state } = makeGame();
    expect(content.create(MOD, spotInput({ baseYield: 5 }), 0).ok).toBe(true);
    state().spotLevels[SPOT_ID] = 2;
    const before = game.gameNumSystem.evaluateResourceGain(CREDIT, state());
    expect(game.gameNumSystem.evaluateSpotYield(SPOT_ID, state())).toBe(5);

    const applied = content.replace(MOD, 'desk', spotInput({ baseYield: 5, yieldPerLevel: 3 }), content.getState().revision);
    expect(applied.ok).toBe(true);

    expect(game.gameNumSystem.evaluateSpotYield(SPOT_ID, state())).toBe(8);
    expect(game.gameNumSystem.evaluateResourceGain(CREDIT, state()) - before).toBe(3);
  });

  test('未设置的可选字段不写入 Def', () => {
    const { game, content } = makeGame();
    expect(content.create(MOD, spotInput(), 0).ok).toBe(true);

    const def = game.registry.spots.get(SPOT_ID)!;
    expect('maxLevel' in def).toBe(false);
    expect('yieldPerLevel' in def).toBe(false);
    expect('upgradeCostBase' in def).toBe(false);
    expect('upgradeCostGrowth' in def).toBe(false);
  });

  test('非法字段值不改变运行时（校验先于提交）', () => {
    const { game, content } = makeGame();
    expect(content.create(MOD, spotInput({ maxLevel: 2 }), 0).ok).toBe(true);

    const rejected = content.replace(MOD, 'desk', spotInput({ maxLevel: 1.5 }), content.getState().revision);

    expect(rejected.ok).toBe(false);
    expect(rejected.diagnostics[0]).toMatchObject({ code: 'invalid-field', path: 'spot.maxLevel' });
    expect(game.registry.spots.get(SPOT_ID)?.maxLevel).toBe(2);
    expect(content.getState().revision).toBe(1);
  });
});
