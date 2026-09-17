import { describe, expect, test } from 'vitest';
import { Expr, and, cond } from '../../src/engine/types';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';

const INIT = 'test:init:payments';
const AREA = 'test:area:payments';
const SPOT = 'test:spot:payments';
const LOCKED_SPOT = 'test:spot:locked-payments';
const NO_ROUTE_SPOT = 'test:spot:no-purchase-route';
const CREDIT = 'test:resource:credit';
const TOKEN = 'test:item:token';

function datapack(): Datapack {
  return {
    name: 'spot payments',
    version: '1',
    inits: [{ id: INIT, name: 'Payments', description: '', defaultAreas: [AREA] }],
    areas: [{ id: AREA, initId: INIT, name: 'Payments', description: '', defaultSpots: [SPOT, LOCKED_SPOT, NO_ROUTE_SPOT] }],
    spots: [
      {
        id: SPOT,
        areaId: AREA,
        name: '支付测试设施',
        description: '',
        tags: [],
        purchaseOptions: [
          { id: 'credits', label: '信用点', costs: [{ type: 'resource', resourceId: CREDIT, amount: Expr.const(10) }] },
          {
            id: 'tokens', label: '代币', condition: and(cond('flag', 'token_route', '==', 1)),
            costs: [{ type: 'item', itemId: TOKEN, amount: Expr.const(2) }],
          },
        ],
        levelUpgrades: [{
          level: 2,
          paymentOptions: [{
            id: 'mixed',
            label: '混合支付',
            costs: [
              { type: 'resource', resourceId: CREDIT, amount: Expr.const(5) },
              { type: 'item', itemId: TOKEN, amount: Expr.const(1) },
            ],
          }],
          effects: [],
        }],
      },
      {
        id: NO_ROUTE_SPOT,
        areaId: AREA,
        name: '外部解锁设施',
        description: '',
        tags: [],
        purchaseOptions: [],
      },
      {
        id: LOCKED_SPOT,
        areaId: AREA,
        name: '不足测试设施',
        description: '',
        tags: [],
        purchaseOptions: [{
          id: 'mixed',
          costs: [
            { type: 'resource', resourceId: CREDIT, amount: Expr.const(5) },
            { type: 'item', itemId: TOKEN, amount: Expr.const(2) },
          ],
        }],
      },
    ],
    enhancements: [],
    activeStories: [],
    passiveStories: [],
    stories: [],
    items: [{ id: TOKEN, name: '代币', description: '', maxStack: 99, rarity: 'common', type: 'material' }],
    funcletDefs: [],
    characters: [],
  };
}

function gameWithUnownedSpots(): GameInstance {
  const game = new GameInstance();
  game.init([datapack()]);
  delete game.state.spotLevels[SPOT];
  delete game.state.spotLevels[LOCKED_SPOT];
  delete game.state.spotLevels[NO_ROUTE_SPOT];
  return game;
}

describe('Spot payment options', () => {
  test('多个支付途径要求明确选择，单个方案可直接解锁', () => {
    const game = gameWithUnownedSpots();
    game.state.resources[CREDIT] = 0;
    game.state.inventory[TOKEN] = 2;

    expect(game.spot.getPaymentOptions(SPOT, 'unlock')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'credits', status: 'insufficient' }),
      expect.objectContaining({ id: 'tokens', status: 'condition-failed' }),
    ]));
    expect(game.spot.unlockSpot(SPOT)).toMatchObject({ success: false, error: 'InsufficientResource' });
    expect(game.state.spotLevels[SPOT]).toBeUndefined();
    game.state.resources[CREDIT] = 10;
    game.state.flags.token_route = '1';
    expect(game.spot.unlockSpot(SPOT)).toMatchObject({ success: false, error: 'PaymentOptionRequired', paymentOptionIds: ['credits', 'tokens'] });
    expect(game.spot.unlockSpot(SPOT, 'tokens')).toMatchObject({ success: true, spotId: SPOT });
    expect(game.state.inventory[TOKEN]).toBeUndefined();
    expect(game.state.resources[CREDIT]).toBe(10);
  });

  test('单一方案可同时扣除多个 Resource / Item，并与升级方案共用解析', () => {
    const game = gameWithUnownedSpots();
    game.state.resources[CREDIT] = 15;
    game.state.inventory[TOKEN] = 3;
    game.state.spotLevels[SPOT] = 1;

    const events: string[] = [];
    game.eventBus.onAny(event => events.push(event.type));
    expect(game.spot.upgradeSpot(SPOT)).toMatchObject({ success: true, newLevel: 2 });
    expect(game.state.resources[CREDIT]).toBe(10);
    expect(game.state.inventory[TOKEN]).toBe(2);
    expect(events).toEqual(['resourceChanged', 'itemCollected', 'spotLevelChanged']);
  });

  test('多项成本不足时不发生部分扣费、等级变更或事件', () => {
    const game = gameWithUnownedSpots();
    game.state.resources[CREDIT] = 5;
    game.state.inventory[TOKEN] = 1;
    const events: string[] = [];
    game.eventBus.onAny(event => events.push(event.type));

    expect(game.spot.unlockSpot(LOCKED_SPOT)).toMatchObject({ success: false, error: 'InsufficientResource' });
    expect(game.state.resources[CREDIT]).toBe(5);
    expect(game.state.inventory[TOKEN]).toBe(1);
    expect(game.state.spotLevels[LOCKED_SPOT]).toBeUndefined();
    expect(events).toEqual([]);
  });

  test('缺少升级价格组时不会形成默认支付方案', () => {
    const game = new GameInstance();
    game.init([datapack()]);
    delete game.state.spotLevels[SPOT];
    delete game.state.spotLevels[LOCKED_SPOT];
    delete game.state.spotLevels[NO_ROUTE_SPOT];
    game.state.spotLevels[LOCKED_SPOT] = 1;
    expect(game.spot.getPaymentOptions(LOCKED_SPOT, 'upgrade')).toEqual([]);
    expect(game.spot.upgradeSpot(LOCKED_SPOT)).toMatchObject({ success: false, error: 'PaymentNotDeclared' });
  });

  test('显式空购买方案表示当前不可购买，而不是免费', () => {
    const game = gameWithUnownedSpots();
    expect(game.spot.getPaymentOptions(NO_ROUTE_SPOT, 'unlock')).toEqual([]);
    expect(game.spot.unlockSpot(NO_ROUTE_SPOT)).toMatchObject({ success: false, error: 'NoPurchaseRoute' });
    expect(game.state.spotLevels[NO_ROUTE_SPOT]).toBeUndefined();
  });
});
