// ============================================================
// engine/roster-system.test.ts — 通讯录/获得/碎片（R 组 + P-01）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import type { Datapack } from '../../src/engine/types';
import { Character, CharacterRarity, CharacterSchool, Resource } from '../../src/engine/types';

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
    characterBonuses: [],
    characterVariants: [
      {
        id: 'Hoshino',
        proto: Character.Hoshino,
        name: '星野',
        displayName: '小鸟游星野',
        school: CharacterSchool.Abydos,
        rarity: CharacterRarity.Rare,
        description: '',
      },
      {
        id: 'HoshinoSwimsuit',
        proto: Character.Hoshino,
        name: '泳装星野',
        displayName: '小鸟游星野（泳装）',
        school: CharacterSchool.Abydos,
        rarity: CharacterRarity.SuperRare,
        description: '',
      },
      {
        id: 'Shiroko',
        proto: Character.Shiroko,
        name: '白子',
        displayName: '砂狼白子',
        school: CharacterSchool.Abydos,
        rarity: CharacterRarity.SuperRare,
        description: '',
      },
      {
        id: 'Serika',
        proto: Character.Serika,
        name: '芹香',
        displayName: '黑见芹香',
        school: CharacterSchool.Abydos,
        rarity: CharacterRarity.Common,
        description: '',
      },
      {
        id: 'Yuuka',
        proto: Character.Yuuka,
        name: '优香',
        displayName: '早濑优香',
        school: CharacterSchool.Millennium,
        rarity: CharacterRarity.Rare,
        description: '',
      },
    ],
  };
}

describe('acquireCharacter（R-01 ~ R-06, P-01）', () => {
  let game: GameInstance;
  const events: any[] = [];

  beforeEach(() => {
    game = new GameInstance();
    events.length = 0;
    game.eventBus.on('characterAcquired', e => events.push(e));
    game.init([makeDatapack()]);
  });

  test('R-01 首次获得：创建 entry（level=1/exp=0/stars=0/acquiredCount=1/好感 1 级 0 小值），不发碎片，发事件', () => {
    const r = game.mutations.acquireCharacter('Hoshino', 'story');
    expect(r.duplicate).toBe(false);
    expect(r.shards).toBe(0);
    const state = (game as any)._state;
    expect(state.roster['Hoshino']).toEqual({
      variantId: 'Hoshino',
      acquiredVia: 'story',
      level: 1,
      exp: 0,
      stars: 0,
      equippedEquipment: null,
      acquiredCount: 1,
      affectionLevel: 1,
      affectionExp: 0,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ variantId: 'Hoshino', via: 'story', duplicate: false, shards: 0 });
  });

  test('R-02 重复获得：转该变体碎片（默认 +1），培养不变，事件 duplicate=true', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    const before = (game as any)._state.roster['Hoshino'];
    const r = game.mutations.acquireCharacter('Hoshino', 'gacha');
    expect(r.duplicate).toBe(true);
    expect(r.shards).toBe(1);
    const state = (game as any)._state;
    expect(state.fragments['Hoshino']).toBe(1);
    expect(state.roster['Hoshino']).toBe(before);
    expect(events[1]).toMatchObject({ variantId: 'Hoshino', duplicate: true, shards: 1 });
  });

  test('R-03 卡池配置 dupRewards：按配置返还碎片与附加资源', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    const creditBefore = game.getView().resources[Resource.Credit] ?? 0;
    const r = game.mutations.acquireCharacter('Hoshino', 'gacha', {
      shards: 5,
      bonusResources: { [Resource.Credit]: 100 },
    });
    expect(r.shards).toBe(5);
    const state = (game as any)._state;
    expect(state.fragments['Hoshino']).toBe(5);
    expect(game.getView().resources[Resource.Credit]).toBe(creditBefore + 100);
  });

  test('R-04 未知差分：抛错且状态不变', () => {
    expect(() => game.mutations.acquireCharacter('Ghost', 'gacha')).toThrow();
    const state = (game as any)._state;
    expect(state.roster ?? {}).toEqual({});
  });

  test('R-05 acquiredVia 记录首次来源；重复获得不覆盖', () => {
    game.mutations.acquireCharacter('Hoshino', 'story');
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    expect((game as any)._state.roster['Hoshino'].acquiredVia).toBe('story');
  });

  test('R-06 同原型多变体独立：entry 与碎片均按差分隔离', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.acquireCharacter('HoshinoSwimsuit', 'gacha');
    game.mutations.acquireCharacter('Hoshino', 'gacha'); // Hoshino 重复
    const state = (game as any)._state;
    expect(Object.keys(state.roster).sort()).toEqual(['Hoshino', 'HoshinoSwimsuit']);
    expect(state.fragments['Hoshino']).toBe(1);
    expect(state.fragments['HoshinoSwimsuit'] ?? 0).toBe(0);
  });

  test('R-06b 累计获得次数按差分隔离（不挂靠原型）', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.acquireCharacter('Hoshino', 'gacha'); // Hoshino ×3
    game.mutations.acquireCharacter('HoshinoSwimsuit', 'gacha'); // 泳装 ×1
    const state = (game as any)._state;
    expect(game.rosterSystem.acquiredCountOf(state, 'Hoshino')).toBe(3);
    expect(game.rosterSystem.acquiredCountOf(state, 'HoshinoSwimsuit')).toBe(1);
  });

  test('P-01 原型聚合统计 acquiredTotal 随获得（含重复）递增', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.acquireCharacter('HoshinoSwimsuit', 'gacha');
    const stat = (game as any)._state.protoStats![Character.Hoshino];
    expect(stat.acquiredTotal).toBe(3);
  });
});

describe('roster 查询（R-10 ~ R-12）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([makeDatapack()]);
    game.mutations.acquireCharacter('HoshinoSwimsuit', 'gacha');
    game.mutations.acquireCharacter('Serika', 'story');
  });

  test('R-10 contactGroups 按学校分组，组内稀有度降序', () => {
    const groups = game.rosterSystem.contactGroups((game as any)._state);
    expect(groups).toHaveLength(1);
    expect(groups[0].school).toBe(CharacterSchool.Abydos);
    expect(groups[0].entries.map(e => e.variant.id)).toEqual(['HoshinoSwimsuit', 'Serika']);
  });

  test('R-11 codex 全量差分含未获得占位', () => {
    const codex = game.rosterSystem.codex((game as any)._state);
    expect(codex).toHaveLength(5);
    const hoshino = codex.find(e => e.variant.id === 'Hoshino')!;
    expect(hoshino.entry).toBeUndefined();
    const swimsuit = codex.find(e => e.variant.id === 'HoshinoSwimsuit')!;
    expect(swimsuit.entry).toBeDefined();
  });

  test('R-12 getOwned/isOwned/shardsOf', () => {
    const state = (game as any)._state;
    expect(game.rosterSystem.isOwned(state, 'HoshinoSwimsuit')).toBe(true);
    expect(game.rosterSystem.isOwned(state, 'Yuuka')).toBe(false);
    expect(game.rosterSystem.shardsOf(state, 'HoshinoSwimsuit')).toBe(0);
    expect(game.rosterSystem.getOwned(state, 'Yuuka')).toBeUndefined();
  });
});
