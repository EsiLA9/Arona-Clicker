import { beforeEach, describe, expect, test } from 'vitest';
import { Expr } from '../../src/engine/def-factory/expr';
import { value } from '../../src/engine/def-factory/expr';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { ShopSession } from '../../src/arona-clicker/services/shop-service';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';

const INIT = 'test:init:shop';
const AREA = 'test:area:shop';
const SPOT_A = 'test:spot:counter-a';
const SPOT_B = 'test:spot:counter-b';
const SHOP = 'test:shop:counter';
const CREDIT = 'test:resource:credit';
const TOKEN = 'test:item:token';
const SNACK = 'test:item:snack';

function datapack(): Datapack {
  const spot = (id: string) => ({
    id, areaId: AREA, name: id, description: '', baseCost: Expr.const(0), baseCostResource: CREDIT,
    baseYield: Expr.const(0), baseYieldResource: CREDIT, baseCapacity: 0, managerBonusYield: Expr.const(0), tags: [],
    functionalities: [{ id: `${id}:shop`, kind: 'shop' as const, shopId: SHOP }],
  });
  return {
    name: 'shop service', version: '0',
    inits: [{ id: INIT, name: 'Init', description: '', defaultAreas: [AREA] }],
    areas: [{ id: AREA, initId: INIT, name: 'Area', description: '', defaultSpots: [SPOT_A, SPOT_B] }],
    spots: [spot(SPOT_A), spot(SPOT_B)], enhancements: [], activeStories: [], passiveStories: [], stories: [],
    funcletDefs: [], characters: [], characterBonuses: [],
    items: [
      { id: TOKEN, name: '代币', description: '', maxStack: 99, rarity: 'common', type: 'material' },
      { id: SNACK, name: '零食', description: '', maxStack: 99, rarity: 'common', type: 'consumable' },
    ],
    shops: [{ id: SHOP, name: '柜台', entries: [
      { id: 'snack', name: '零食', offer: { type: 'item', itemId: SNACK, amount: 1 }, price: { unitCosts: [{ type: 'resource', resourceId: CREDIT, amount: Expr.const(10) }] }, stock: { type: 'limited', max: 3 }, purchase: { quantity: 'multiple', scope: { lifetime: 'init', owner: 'shop' } } },
      { id: 'token-exchange', name: '交换', offer: { type: 'item', itemId: SNACK, amount: 1 }, price: { unitCosts: [{ type: 'item', itemId: TOKEN, amount: Expr.const(2) }] } },
      { id: 'rewarded', name: '附赠商品', offer: { type: 'item', itemId: SNACK, amount: 1 }, price: { unitCosts: [] }, onPurchase: [{ op: 'addResource', target: CREDIT, value: 3 }] },
      { id: 'once', name: '一次性商品', offer: { type: 'item', itemId: SNACK, amount: 1 }, price: { unitCosts: [] }, stock: { type: 'once' } },
      { id: 'global-per-spot', name: '地点限定', offer: { type: 'item', itemId: SNACK, amount: 1 }, price: { unitCosts: [] }, stock: { type: 'limited', max: 1 }, purchase: { scope: { lifetime: 'global', owner: 'spot' } } },
    ] }],
  };
}

describe('ShopService（P2）', () => {
  let game: GameInstance;
  beforeEach(() => { game = new GameInstance(); game.init([datapack()]); });

  test('冻结价格后聚合扣款、发货、购买记录，并在完整提交后按 line 发事件', () => {
    game.mutations.changeResource(CREDIT, 30);
    const seen: number[] = [];
    game.eventBus.on('shopPurchased', () => seen.push(game.state.resources[CREDIT] ?? 0));
    const result = game.shopService.checkout(SHOP, SPOT_A, [{ entryId: 'snack', quantity: 2 }]);
    expect(result.success).toBe(true);
    expect(game.state.resources[CREDIT]).toBe(10);
    expect(game.state.inventory[SNACK]).toBe(2);
    expect(Object.values(game.state.shopPurchaseRecords ?? {})[0]).toEqual({ purchasedQuantity: 2 });
    expect(seen).toEqual([10]);
  });

  test('聚合购物车支付不足时没有扣款、发货、记录、Stats 或事件泄露', () => {
    game.mutations.changeResource(CREDIT, 15);
    const statsBefore = game.statsService.getSnapshot();
    const events: string[] = [];
    game.eventBus.onAny(event => events.push(event.type));
    const result = game.shopService.checkout(SHOP, SPOT_A, [
      { entryId: 'snack', quantity: 1 }, { entryId: 'snack', quantity: 1 },
    ]);
    expect(result).toMatchObject({ success: false, reason: 'insufficient-funds' });
    expect(game.state.resources[CREDIT]).toBe(15);
    expect(game.state.inventory[SNACK]).toBeUndefined();
    expect(game.state.shopPurchaseRecords).toEqual({});
    expect(game.statsService.getSnapshot()).toEqual(statsBefore);
    expect(events).toEqual([]);
  });

  test('限购使用 owner=shop 的 Init 记录，因此同 Shop 的不同 Spot 共享库存', () => {
    game.mutations.changeResource(CREDIT, 100);
    expect(game.shopService.checkout(SHOP, SPOT_A, [{ entryId: 'snack', quantity: 2 }]).success).toBe(true);
    const result = game.shopService.checkout(SHOP, SPOT_B, [{ entryId: 'snack', quantity: 2 }]);
    expect(result).toMatchObject({ success: false, reason: 'stock-insufficient' });
    expect(game.state.inventory[SNACK]).toBe(2);
  });

  test('shop Trigger 只在提交完成后运行，产生的后续 mutation 不会改变 receipt', () => {
    game.mutations.changeResource(CREDIT, 20);
    game.triggerSystem.mount({ id: 'test:trigger:shop', on: { kind: 'shop', shopId: SHOP }, effects: [{ op: 'addResource', target: CREDIT, value: 5 }] });
    const result = game.shopService.checkout(SHOP, SPOT_A, [{ entryId: 'snack', quantity: 1 }]);
    expect(result).toMatchObject({ success: true, receipt: { lines: [{ entryId: 'snack', quantity: 1 }] } });
    expect(game.state.resources[CREDIT]).toBe(15);
  });

  test('global × spot 的记录跨 Init 层保存，但不同 Spot 不共享 owner', () => {
    expect(game.shopService.checkout(SHOP, SPOT_A, [{ entryId: 'global-per-spot', quantity: 1 }]).success).toBe(true);
    expect(game.shopService.checkout(SHOP, SPOT_A, [{ entryId: 'global-per-spot', quantity: 1 }])).toMatchObject({ success: false, reason: 'stock-insufficient' });
    expect(game.shopService.checkout(SHOP, SPOT_B, [{ entryId: 'global-per-spot', quantity: 1 }]).success).toBe(true);
    expect(Object.values(game.state.globalShopPurchaseRecords ?? {})).toHaveLength(2);
    expect(game.state.shopPurchaseRecords).toEqual({});
  });

  test('once 是 limited: 1 的语法糖', () => {
    expect(game.shopService.checkout(SHOP, SPOT_A, [{ entryId: 'once', quantity: 1 }]).success).toBe(true);
    expect(game.shopService.checkout(SHOP, SPOT_A, [{ entryId: 'once', quantity: 1 }])).toMatchObject({ success: false, reason: 'stock-insufficient' });
  });

  test('transaction-safe onPurchase 按 CartLine 仅执行一次，不随 quantity 展开', () => {
    const result = game.shopService.checkout(SHOP, SPOT_A, [{ entryId: 'rewarded', quantity: 2 }]);
    expect(result).toMatchObject({ success: true, receipt: { lines: [{ entryId: 'rewarded', resourceGrants: { [CREDIT]: 3 }, itemGrants: { [SNACK]: 2 } }] } });
    expect(game.state.resources[CREDIT]).toBe(3);
    expect(game.state.inventory[SNACK]).toBe(2);
  });

  test('preview 是临时快照；checkout 重新求值动态价格，Session 不写入 Save', () => {
    const entry = game.registry.shops.get(SHOP)!.entries[0];
    entry.price.unitCosts[0] = { type: 'resource', resourceId: CREDIT, amount: Expr.add(Expr.const(5), Expr.val(value('res', { resource: CREDIT }))) };
    game.mutations.changeResource(CREDIT, 10);
    const session = new ShopSession();
    session.setQuantity('snack', 1);
    expect(game.shopService.preview(SHOP, session.lines())?.resourceCosts[CREDIT]).toBe(15);
    game.mutations.changeResource(CREDIT, 5);
    expect(game.shopService.checkout(SHOP, SPOT_A, session.lines())).toMatchObject({ success: false, reason: 'insufficient-funds' });
    expect(game.save().playerState).not.toHaveProperty('shopSession');
    session.clear();
    expect(session.lines()).toEqual([]);
  });
});

test('默认内容提供真实 Spot Shop 与四类交易样例', () => {
  const game = new GameInstance();
  game.init([defaultDatapack], { enterDefaultInit: false });
  const shop = game.registry.shops.get('base:shop:abydos-cafe');
  expect(shop?.entries.map(entry => entry.id)).toEqual(expect.arrayContaining(['energy-drink', 'field-note-exchange', 'premium-drink', 'mystery-fragment']));
  const spot = game.registry.spots.get('base:spot:abydos_cafe')!;
  expect(game.spotFunctionalitySystem.functionalitiesOf(spot, game.state).some(fn => fn.kind === 'shop' && fn.shopId === shop?.id)).toBe(true);
  const showcaseSpot = game.registry.spots.get('base:spot:theme_showcase_b')!;
  expect(game.spotFunctionalitySystem.functionalitiesOf(showcaseSpot, game.state).some(fn => fn.kind === 'shop' && fn.shopId === shop?.id)).toBe(true);
});
