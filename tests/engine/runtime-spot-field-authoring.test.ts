import { describe, expect, test, vi } from 'vitest';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { defaultDatapack } from '../../src/arona-clicker/content';
import type { RuntimeSpotInput } from '../../src/arona-clicker/contracts/runtime-content';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import { MISSING_DEF_TIME } from '../../src/data-services';

const AREA = 'base:area:schale_main';
const MOD = 'draft-mod';
const SPOT_ID = `${MOD}:spot:desk`;
const CREDIT = 'base:resource:credit';

const spotInput = (overrides: Partial<RuntimeSpotInput> = {}): RuntimeSpotInput => ({
  idName: 'desk',
  areaId: AREA,
  name: 'Desk',
  description: 'Temporary desk',
  purchaseOptions: [{ id: 'free', costs: [] }],
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
    expect(content.create(MOD, spotInput({ maxLevel: 1, levelUpgrades: [
      { level: 2, paymentOptions: [{ id: 'free', costs: [] }], effects: [] },
      { level: 3, paymentOptions: [{ id: 'free', costs: [] }], effects: [] },
    ] }), 0).ok).toBe(true);
    expect(game.registry.spots.get(SPOT_ID)?.maxLevel).toBe(1);
    expect(game.spot.getEffectiveMaxLevel(SPOT_ID)).toBe(1);

    expect(game.spot.unlockSpot(SPOT_ID)).toMatchObject({ success: true });
    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: false, error: 'MaxLevel' });

    const applied = content.replace(MOD, 'desk', spotInput({ maxLevel: 3, levelUpgrades: [
      { level: 2, paymentOptions: [{ id: 'free', costs: [] }], effects: [] },
      { level: 3, paymentOptions: [{ id: 'free', costs: [] }], effects: [] },
    ] }), content.getState().revision);

    expect(applied.ok).toBe(true);
    expect(game.spot.getEffectiveMaxLevel(SPOT_ID)).toBe(3);
    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: true, newLevel: 2 });
  });

  test('逐级价格组：热改后立即参与升级报价', () => {
    const { game, content, state } = makeGame();
    expect(content.create(MOD, spotInput({ levelUpgrades: [
      { level: 2, paymentOptions: [{ id: 'credit', costs: [{ type: 'resource', resourceId: CREDIT, amount: 10 }] }], effects: [] },
      { level: 3, paymentOptions: [{ id: 'credit', costs: [{ type: 'resource', resourceId: CREDIT, amount: 20 }] }], effects: [] },
    ] }), 0).ok).toBe(true);

    state().resources[CREDIT] = 10_000;
    expect(game.spot.unlockSpot(SPOT_ID)).toMatchObject({ success: true });

    const charge = vi.spyOn(game.mutations, 'commitSpotTransaction');
    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: true, newLevel: 2 });
    expect(charge).toHaveBeenCalledWith(expect.objectContaining({ resourceDeltas: { [CREDIT]: -10 } }));
    charge.mockClear();

    const applied = content.replace(MOD, 'desk', spotInput({ levelUpgrades: [
      { level: 2, paymentOptions: [{ id: 'credit', costs: [{ type: 'resource', resourceId: CREDIT, amount: 10 }] }], effects: [] },
      { level: 3, paymentOptions: [{ id: 'credit', costs: [{ type: 'resource', resourceId: CREDIT, amount: 45 }] }], effects: [] },
    ] }), content.getState().revision);
    expect(applied.ok).toBe(true);

    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: true, newLevel: 3 });
    expect(charge).toHaveBeenCalledWith(expect.objectContaining({ resourceDeltas: { [CREDIT]: -45 } }));
    charge.mockRestore();
  });

  test('升级报价随热改上升到资源不足边界', () => {
    const { game, content, state } = makeGame();
    expect(content.create(MOD, spotInput({ levelUpgrades: [
      { level: 2, paymentOptions: [{ id: 'credit', costs: [{ type: 'resource', resourceId: CREDIT, amount: 10 }] }], effects: [] },
    ] }), 0).ok).toBe(true);
    state().resources[CREDIT] = 9;
    expect(game.spot.unlockSpot(SPOT_ID)).toMatchObject({ success: true });

    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: false, error: 'InsufficientResource' });

    const applied = content.replace(MOD, 'desk', spotInput({ levelUpgrades: [
      { level: 2, paymentOptions: [{ id: 'credit', costs: [{ type: 'resource', resourceId: CREDIT, amount: 5 }] }], effects: [] },
    ] }), content.getState().revision);
    expect(applied.ok).toBe(true);

    expect(game.spot.upgradeSpot(SPOT_ID)).toMatchObject({ success: true, newLevel: 2 });
  });

  test('旧的 Spot 直接产出字段不再被 Runtime Editor 接受', () => {
    const { game, content, state } = makeGame();
    const legacy = { ...spotInput(), baseYield: 5, baseYieldResource: CREDIT, yieldPerLevel: 3 } as RuntimeSpotInput & Record<string, unknown>;
    const rejected = content.create(MOD, legacy, 0);
    expect(rejected.ok).toBe(false);
    expect(rejected.diagnostics[0]).toMatchObject({ code: 'invalid-field', path: 'spot.baseYield' });
    expect(game.registry.spots.has(SPOT_ID)).toBe(false);
    expect(state().spotLevels[SPOT_ID]).toBeUndefined();
  });

  test('未设置的可选字段不写入 Def', () => {
    const { game, content } = makeGame();
    expect(content.create(MOD, spotInput(), 0).ok).toBe(true);

    const def = game.registry.spots.get(SPOT_ID)!;
    expect('maxLevel' in def).toBe(false);
    expect('baseCost' in def).toBe(false);
    expect('upgradeCostBase' in def).toBe(false);
  });

  test('Runtime Spot 创建与修改维护 Def 审计时间', () => {
    const { game, content } = makeGame();
    const created = content.create(MOD, spotInput(), 0);
    expect(created.ok).toBe(true);
    const first = game.registry.spots.get(SPOT_ID)?.metadata;
    expect(first?.createdAt).toEqual(expect.any(Number));
    expect(first?.updatedAt).toEqual(expect.any(Number));
    expect(first?.updatedAt).toBeGreaterThanOrEqual(first?.createdAt ?? 0);

    const replaced = content.replace(MOD, 'desk', spotInput({ name: 'Updated Desk' }), content.getState().revision);
    expect(replaced.ok).toBe(true);
    const second = game.registry.spots.get(SPOT_ID)?.metadata;
    expect(second?.createdAt).toBe(first?.createdAt);
    expect(second?.updatedAt).toBeGreaterThanOrEqual(first?.updatedAt ?? 0);
  });

  test('Registry 对缺失 Def 时间提供极早值但不改写原定义', () => {
    const { game } = makeGame();
    const original = game.registry.spots.get('base:spot:credit_printer')!;
    expect(original.metadata).toBeUndefined();
    expect(game.registry.getEffectiveSpotMetadata(original.id)).toEqual({
      createdAt: MISSING_DEF_TIME,
      updatedAt: MISSING_DEF_TIME,
      createdAtKnown: false,
      updatedAtKnown: false,
    });
    expect(original.metadata).toBeUndefined();
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
