// ============================================================
// character-progression-def.test.ts — A4：养成 Def 声明（只声明，无消费）
// ============================================================
import { describe, test, expect } from 'vitest';
import { Registry } from '../../src/data-services/registry/registry';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';

function makeDatapack(): Datapack {
  return {
    name: 'test',
    version: '0',
    inits: [],
    areas: [],
    spots: [],
    enhancements: [],
    activeStories: [],
    passiveStories: [],
    stories: [],
    items: [],
    funcletDefs: [],
    characters: [],
    favoriteItems: [{ id: 'test:favorite:f1', owner: 'Hoshino', name: '爱用品', stages: [{ tier: 1, effects: [] }] }],
    uniqueWeapons: [{ id: 'test:uniqueweapon:w1', owner: 'Hoshino', name: '专武', stars: [{ star: 1, effects: [] }] }],
    traits: [{ id: 'test:trait:t1', name: '特性' }],
    characterVariants: [
      {
        id: 'Hoshino',
        proto: Character.Hoshino,
        name: '星野',
        displayName: '星野',
        school: CharacterSchool.Abydos,
        rarity: CharacterRarity.Rare,
        description: '',
        progression: {
          favoriteItem: 'test:favorite:f1',
          uniqueWeapon: 'test:uniqueweapon:w1',
          initialTraits: ['test:trait:t1'],
        },
      },
    ],
  };
}

describe('角色养成 Def 声明（A4）', () => {
  test('registry 暴露新表并保留 variant.progression', () => {
    const reg = new Registry();
    reg.load(makeDatapack());
    expect(reg.favoriteItems.size).toBe(1);
    expect(reg.uniqueWeapons.size).toBe(1);
    expect(reg.traits.size).toBe(1);
    expect(reg.characterVariants.get('Hoshino')?.progression?.favoriteItem).toBe('test:favorite:f1');
    expect(() => reg.validateCharacterRefs()).not.toThrow();
  });

  test('未定义的养成引用在 validateCharacterRefs 抛错', () => {
    const dp = makeDatapack();
    dp.favoriteItems = [];
    const reg = new Registry();
    reg.load(dp);
    expect(() => reg.validateCharacterRefs()).toThrow(/爱用品/);
  });
});
