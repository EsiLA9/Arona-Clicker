// ============================================================
// engine/def-factory/variant-gacha-chat.test.ts
// CharacterVariantDef / GachaPoolDef Builder
// ============================================================
import { describe, test, expect } from 'vitest';
import {
  variant,
  CharacterVariantBuilder,
  gachaPool,
  GachaPoolBuilder,
  cond,
  Character,
  CharacterRarity,
  CharacterSchool,
  GachaMode,
  Resource,
} from '../../../src/engine/types';
import type { CharacterVariantDef, GachaPoolDef } from '../../../src/engine/types';

describe('CharacterVariantBuilder', () => {
  test('variant() 返回 CharacterVariantBuilder 实例', () => {
    expect(variant('HoshinoSwimsuit', Character.Hoshino)).toBeInstanceOf(CharacterVariantBuilder);
  });

  test('build() 等价于字面量（泳装星野参照）', () => {
    const def = variant('HoshinoSwimsuit', Character.Hoshino)
      .name('泳装星野').displayName('小鸟游星野（泳装）')
      .school(CharacterSchool.Abydos).rarity(CharacterRarity.SuperRare)
      .desc('换上泳装的星野学长。夏日限定，慵懒依旧。')
      .curve('base:cultivatecurve:standard')
      .build();
    expect(def).toEqual<CharacterVariantDef>({
      id: 'HoshinoSwimsuit',
      proto: Character.Hoshino,
      name: '泳装星野',
      displayName: '小鸟游星野（泳装）',
      school: CharacterSchool.Abydos,
      rarity: CharacterRarity.SuperRare,
      description: '换上泳装的星野学长。夏日限定，慵懒依旧。',
      curve: 'base:cultivatecurve:standard',
    });
  });

  test('default() 与 theme/bonus 输出', () => {
    const def = variant('Yuuka', Character.Yuuka)
      .name('优香').displayName('优香')
      .school(CharacterSchool.Millennium).rarity(CharacterRarity.Rare)
      .desc('x')
      .default()
      .bonus('credit', 1.5)
      .theme('base:colorgroup:violet', { primary: '#8b5cf6' })
      .build();
    expect(def.isDefault).toBe(true);
    expect(def.spotTagBonus).toEqual({ credit: 1.5 });
    expect(def.theme).toEqual({ colorGroupId: 'base:colorgroup:violet', tokens: { primary: '#8b5cf6' } });
  });
});

describe('GachaPoolBuilder', () => {
  test('gachaPool() 返回 GachaPoolBuilder 实例', () => {
    expect(gachaPool('base:gachapool:regular')).toBeInstanceOf(GachaPoolBuilder);
  });

  test('build() 等价于字面量（regular 参照）', () => {
    const def = gachaPool('base:gachapool:regular')
      .name('常规招募').desc('常驻开放的招募池。')
      .mode(GachaMode.BaClassic)
      .currency(Resource.Pyroxene)
      .costPerPull(120)
      .rate(CharacterRarity.Common, 79)
      .rate(CharacterRarity.Rare, 18)
      .rate(CharacterRarity.SuperRare, 3)
      .dupRewards(5, { [Resource.Credit]: 200 })
      .members('Arona', 'Hoshino')
      .build();
    expect(def).toEqual<GachaPoolDef>({
      id: 'base:gachapool:regular',
      name: '常规招募',
      description: '常驻开放的招募池。',
      mode: GachaMode.BaClassic,
      currency: Resource.Pyroxene,
      costPerPull: 120,
      rates: [
        { rarity: CharacterRarity.Common, weight: 79 },
        { rarity: CharacterRarity.Rare, weight: 18 },
        { rarity: CharacterRarity.SuperRare, weight: 3 },
      ],
      dupRewards: { shards: 5, bonusResources: { [Resource.Credit]: 200 } },
      members: ['Arona', 'Hoshino'],
    });
  });

  test('featured / pity / closeWhen 输出', () => {
    const def = gachaPool('base:gachapool:up')
      .name('UP').currency(Resource.Pyroxene).costPerPull(120)
      .featured('HoshinoSwimsuit')
      .pity(50)
      .closeWhen(cond('flag', 'done', '==', 1))
      .members()
      .build();
    expect(def.featured).toEqual(['HoshinoSwimsuit']);
    expect(def.pity).toEqual({ guaranteedAt: 50 });
    expect(def.closeWhen).toEqual(cond('flag', 'done', '==', 1));
  });
});
