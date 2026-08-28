// ============================================================
// engine/def-factory/pool-pack.test.ts — PassivePool / AffectorPack Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  passivePool,
  PassivePoolBuilder,
  affectorPack,
  AffectorPackBuilder,
  extra,
} from '../../../src/engine/types';
import { tagPath } from '../../../src/engine/core/tag';
import type { AffectorPackDef, PassivePoolDef } from '../../../src/engine/types';

describe('PassivePoolBuilder', () => {
  test('passivePool() 返回 PassivePoolBuilder 实例', () => {
    expect(passivePool('base:pool:schale_root')).toBeInstanceOf(PassivePoolBuilder);
  });

  test('build() 等价于字面量（schale_root 参照）', () => {
    const def = passivePool('base:pool:schale_root')
      .name('夏莱闲聊')
      .tags(tagPath('place', 'schale'))
      .child('base:pool:schale_daily', 3)
      .child('base:pool:schale_office_topic', 2)
      .child('base:pool:schale_night_owl', 2)
      .build();
    expect(def).toEqual<PassivePoolDef>({
      id: 'base:pool:schale_root',
      name: '夏莱闲聊',
      tags: [['place', 'schale']],
      children: [
        { id: 'base:pool:schale_daily', weight: 3 },
        { id: 'base:pool:schale_office_topic', weight: 2 },
        { id: 'base:pool:schale_night_owl', weight: 2 },
      ],
    });
  });

  test('child 缺省 weight 省略 / owner / cooldown / condition 输出', () => {
    const def = passivePool('base:pool:h')
      .name('星野对话空间')
      .owner('Hoshino')
      .cooldownFrames(1200)
      .child('base:story:conv_1')
      .build();
    expect(def.owner).toBe('Hoshino');
    expect(def.cooldownFrames).toBe(1200);
    expect(def.children).toEqual([{ id: 'base:story:conv_1' }]);
    expect(def).not.toHaveProperty('condition');
  });
});

describe('AffectorPackBuilder', () => {
  test('affectorPack() 返回 AffectorPackBuilder 实例', () => {
    expect(affectorPack('base:pack:x')).toBeInstanceOf(AffectorPackBuilder);
  });

  test('zoneModifier 构造等价于字面量（credit_system_mult 参照）', () => {
    const def = affectorPack('base:pack:credit_system_mult')
      .entry('base:aff:credit_system_mult')
      .modEntity('spot', '*', 'mul', 1.5)
      .build();
    expect(def).toEqual<AffectorPackDef>({
      id: 'base:pack:credit_system_mult',
      entries: [{
        id: 'base:aff:credit_system_mult',
        effects: [],
        zoneModifiers: [{ target: { kind: 'entity', ref: { kind: 'spot', id: '*' } }, category: 'mul', value: 1.5 }],
      }],
    });
  });

  test('多 modTag + 效果 + extra（field_logistics_mult / energy_drink 参照）', () => {
    const multi = affectorPack('base:pack:field_logistics_mult')
      .entry('base:aff:field_logistics_mult')
      .modTag(['field'], 'mul', 1.35)
      .modTag(['combat'], 'mul', 1.35)
      .modTag(['tactical'], 'mul', 1.35)
      .build();
    expect(multi.entries[0].zoneModifiers).toHaveLength(3);
    expect(multi.entries[0].zoneModifiers![0]).toEqual({ target: { kind: 'tag', tag: ['field'] }, category: 'mul', value: 1.35 });

    const drink = affectorPack('base:pack:energy_drink')
      .extra(extra.dict({ desc: extra.str('能量饮料：每次点击 +1 信用点'), tier: extra.int(1) }))
      .entry('base:aff:energy_drink')
      .effect({ op: 'addResource', target: 'base:resource:credit', value: 1 })
      .build();
    expect(drink.extra).toEqual(extra.dict({ desc: extra.str('能量饮料：每次点击 +1 信用点'), tier: extra.int(1) }));
    expect(drink.entries[0].zoneModifiers).toBeUndefined();
    expect(drink.entries[0].effects).toEqual([{ op: 'addResource', target: 'base:resource:credit', value: 1 }]);
  });

  test('缺 entry 抛错', () => {
    expect(() => affectorPack('base:pack:x').build()).toThrow(/entry/);
  });
});
