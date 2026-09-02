// ============================================================
// engine/def-factory/pool-pack.test.ts — PassivePool / AffectorPack Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  affectorPack,
  AffectorPackBuilder,
  extra,
} from '../../../src/engine/types';
import { tagPath } from '../../../src/engine/core/tag';
import type { AffectorPackDef } from '../../../src/engine/types';
import type { PassivePoolDef } from '../../../src/data-services/contracts/passive-pool';
import { passivePool, PassivePoolBuilder } from '../../../src/arona-clicker/content/def-factory';

describe('PassivePoolBuilder', () => {
  test('passivePool() 返回 PassivePoolBuilder 实例', () => {
    expect(passivePool('base:passivepool:schale_root')).toBeInstanceOf(PassivePoolBuilder);
  });

  test('build() 等价于字面量（schale_root 参照）', () => {
    const def = passivePool('base:passivepool:schale_root')
      .name('夏莱闲聊')
      .tags(tagPath('place', 'schale'))
      .child('base:passivepool:schale_daily', 3)
      .child('base:passivepool:schale_office_topic', 2)
      .child('base:passivepool:schale_night_owl', 2)
      .build();
    expect(def).toEqual<PassivePoolDef>({
      id: 'base:passivepool:schale_root',
      name: '夏莱闲聊',
      tags: [['place', 'schale']],
      children: [
        { id: 'base:passivepool:schale_daily', weight: 3 },
        { id: 'base:passivepool:schale_office_topic', weight: 2 },
        { id: 'base:passivepool:schale_night_owl', weight: 2 },
      ],
    });
  });

  test('child 缺省 weight 省略 / owner / cooldown / condition 输出', () => {
    const def = passivePool('base:passivepool:h')
      .name('星野对话空间')
      .owner('Hoshino')
      .cooldownFrames(1200)
      .child('base:passivestory:conv_1')
      .build();
    expect(def.owner).toBe('Hoshino');
    expect(def.cooldownFrames).toBe(1200);
    expect(def.children).toEqual([{ id: 'base:passivestory:conv_1' }]);
    expect(def).not.toHaveProperty('condition');
  });
});

describe('AffectorPackBuilder', () => {
  test('affectorPack() 返回 AffectorPackBuilder 实例', () => {
    expect(affectorPack('base:affectorpack:x')).toBeInstanceOf(AffectorPackBuilder);
  });

  test('zoneModifier 构造等价于字面量（credit_system_mult 参照）', () => {
    const def = affectorPack('base:affectorpack:credit_system_mult')
      .entry('base:affector:credit_system_mult')
      .modEntity('spot', '*', 'mul', 1.5)
      .build();
    expect(def).toEqual<AffectorPackDef>({
      id: 'base:affectorpack:credit_system_mult',
      entries: [{
        id: 'base:affector:credit_system_mult',
        effects: [],
        zoneModifiers: [{ target: { kind: 'entity', ref: { kind: 'spot', id: '*' } }, category: 'mul', value: 1.5 }],
      }],
    });
  });

  test('多 modTag + 效果 + extra（field_logistics_mult / energy_drink 参照）', () => {
    const multi = affectorPack('base:affectorpack:field_logistics_mult')
      .entry('base:affector:field_logistics_mult')
      .modTag(['field'], 'mul', 1.35)
      .modTag(['combat'], 'mul', 1.35)
      .modTag(['tactical'], 'mul', 1.35)
      .build();
    expect(multi.entries[0].zoneModifiers).toHaveLength(3);
    expect(multi.entries[0].zoneModifiers![0]).toEqual({ target: { kind: 'tag', tag: ['field'] }, category: 'mul', value: 1.35 });

    const drink = affectorPack('base:affectorpack:energy_drink')
      .extra(extra.dict({ desc: extra.str('能量饮料：每次点击 +1 信用点'), tier: extra.int(1) }))
      .entry('base:affector:energy_drink')
      .effect({ op: 'addResource', target: 'base:resource:credit', value: 1 })
      .build();
    expect(drink.extra).toEqual(extra.dict({ desc: extra.str('能量饮料：每次点击 +1 信用点'), tier: extra.int(1) }));
    expect(drink.entries[0].zoneModifiers).toBeUndefined();
    expect(drink.entries[0].effects).toEqual([{ op: 'addResource', target: 'base:resource:credit', value: 1 }]);
  });

  test('缺 entry 抛错', () => {
    expect(() => affectorPack('base:affectorpack:x').build()).toThrow(/entry/);
  });
});
