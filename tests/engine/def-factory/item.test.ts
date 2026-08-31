// ============================================================
// engine/def-factory/item.test.ts — Item 链式 Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import { item, ItemBuilder, Resource, extra } from '../../../src/engine/types';
import type { ItemDef } from '../../../src/engine/types';

const CREDIT = Resource.Credit;

describe('ItemBuilder', () => {
  test('item() 返回 ItemBuilder 实例', () => {
    expect(item('base:item:x')).toBeInstanceOf(ItemBuilder);
  });

  test('build() 产出最小 ItemDef（缺省 material/common/maxStack 1）', () => {
    const def = item('base:item:x').name('测试').desc('测试').build();
    expect(def).toEqual<ItemDef>({
      id: 'base:item:x',
      name: '测试',
      description: '测试',
      maxStack: 1,
      rarity: 'common',
      type: 'material',
    });
  });

  test('缺 name / description 时 build() 抛错', () => {
    expect(() => item('base:item:x').build()).toThrow(/name/);
    expect(() => item('base:item:x').name('x').build()).toThrow(/description/);
  });

  test('消耗品等价于字面量（energy_drink 参照）', () => {
    const def = item('base:item:energy_drink')
      .name('战术能量饮料')
      .desc('恢复少量信用点，适合测试背包使用流程。')
      .maxStack(5)
      .rarity('common')
      .type('consumable')
      .useEffects({ op: 'addResource', target: CREDIT, value: 25 })
      .build();
    expect(def).toEqual<ItemDef>({
      id: 'base:item:energy_drink',
      name: '战术能量饮料',
      description: '恢复少量信用点，适合测试背包使用流程。',
      maxStack: 5,
      rarity: 'common',
      type: 'consumable',
      useEffects: [{ op: 'addResource', target: CREDIT, value: 25 }],
    });
  });

  test('素材/钥匙与其余字段输出', () => {
    const def = item('base:item:schale_pass')
      .name('夏莱通行证').desc('联邦搜查部「夏莱」的官方通行证。')
      .maxStack(1).rarity('epic').type('key')
      .sellPrice(CREDIT, 500)
      .pickupEffects({ op: 'setFlag', target: 'pass', value: '1' })
      .affectorPack('base:affectorpack:credit_system_mult')
      .icon('icon.png')
      .extra(extra.dict({ tier: extra.int(3) }))
      .build();
    expect(def.rarity).toBe('epic');
    expect(def.type).toBe('key');
    expect(def.sellPrice).toEqual({ resourceId: CREDIT, amount: 500 });
    expect(def.pickupEffects).toEqual([{ op: 'setFlag', target: 'pass', value: '1' }]);
    expect(def.affectorPackIds).toEqual(['base:affectorpack:credit_system_mult']);
    expect(def.icon).toBe('icon.png');
    expect(def.extra).toEqual(extra.dict({ tier: extra.int(3) }));
  });

  test('未调用可选 setter 时不输出该字段', () => {
    const def = item('base:item:x').name('x').desc('x').build();
    expect(def).not.toHaveProperty('useEffects');
    expect(def).not.toHaveProperty('icon');
    expect(def).not.toHaveProperty('sellPrice');
    expect(def).not.toHaveProperty('revealTriggers');
  });
});
