import { describe, expect, test } from 'vitest';
import { Expr } from '../../src/engine/def-factory/expr';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { Datapack } from '../../src/data-services/contracts/datapack';

const ITEM = 'base:item:ticket';
const SHOP = 'base:shop:counter';

function datapack(): Datapack {
  return {
    name: 'shop-test', version: '0',
    inits: [], areas: [], spots: [], enhancements: [], activeStories: [], passiveStories: [], stories: [],
    funcletDefs: [], characters: [], characterBonuses: [],
    items: [{ id: ITEM, name: '票券', description: '', maxStack: 99, rarity: 'common', type: 'material' }],
    shops: [{
      id: SHOP, name: '柜台',
      sections: [{ id: 'general', name: '常规' }],
      entries: [{
        id: 'snack', name: '零食', sectionId: 'general',
        offer: { type: 'item', itemId: ITEM, amount: 1 },
        price: { unitCosts: [{ type: 'resource', resourceId: 'base:resource:credit', amount: Expr.const(10) }] },
        stock: { type: 'limited', max: 3 },
      }],
    }],
  };
}

describe('Shop Registry（P1）', () => {
  test('注册 Shop 表并保留结构化的 Item / Resource 提案', () => {
    const game = new GameInstance();
    game.init([datapack()], { enterDefaultInit: false });
    expect(game.registry.shops.get(SHOP)?.entries[0].price.unitCosts).toHaveLength(1);
  });

  test('未知 Item 引用在完整 Registry 校验时拒绝', () => {
    const bad = datapack();
    bad.shops![0].entries[0].offer = { type: 'item', itemId: 'base:item:missing', amount: 1 };
    expect(() => new GameInstance().init([bad], { enterDefaultInit: false })).toThrow(/未定义的 Item/);
  });

  test('重复 Entry 与不存在的 Section 被拒绝', () => {
    const duplicate = datapack();
    duplicate.shops![0].entries.push({ ...duplicate.shops![0].entries[0] });
    expect(() => new GameInstance().init([duplicate], { enterDefaultInit: false })).toThrow(/重复 Entry/);

    const badSection = datapack();
    badSection.shops![0].entries[0].sectionId = 'missing';
    expect(() => new GameInstance().init([badSection], { enterDefaultInit: false })).toThrow(/未定义的 Section/);
  });
});
