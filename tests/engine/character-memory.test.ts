// ============================================================
// character-memory.test.ts — A2：跨世界线记忆骨架（max* 单调）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { Datapack } from '../../src/data-services/contracts/datapack';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';

const CURVE_ID = 'test:cultivatecurve:mem';

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
    cultivateCurves: [
      { id: CURVE_ID, maxLevel: 5, expTable: [10, 10, 10, 10], starMax: 2, starCost: [1, 1] },
    ],
    characterVariants: [
      { id: 'Hoshino', proto: Character.Hoshino, name: '星野', displayName: '星野', school: CharacterSchool.Abydos, rarity: CharacterRarity.Rare, description: '', curve: CURVE_ID },
      { id: 'HoshinoSwimsuit', proto: Character.Hoshino, name: '泳装星野', displayName: '泳装星野', school: CharacterSchool.Abydos, rarity: CharacterRarity.SuperRare, description: '', curve: CURVE_ID },
    ],
  };
}

describe('CharacterMemory（A2）', () => {
  let game: GameInstance;
  const state = () => (game as any)._state;
  const mem = () => state().characterMemory?.[Character.Hoshino];

  beforeEach(() => {
    game = new GameInstance();
    game.init([makeDatapack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
  });

  test('获得即建立记忆：variantsEverOwned / maxLevel / affectionTotalEver', () => {
    expect(mem().variantsEverOwned).toEqual(['Hoshino']);
    expect(mem().variants['Hoshino']).toMatchObject({ maxLevel: 1, maxStars: 0, maxAffection: 1 });
    expect(mem().affectionTotalEver).toBe(1);
  });

  test('培养推进刷新 maxLevel，且只增不减', () => {
    game.mutations.addExp('Hoshino', 25); // L1→2→3（每级 10）
    expect(state().roster['Hoshino'].level).toBe(3);
    expect(mem().variants['Hoshino'].maxLevel).toBe(3);
    expect(mem().lifetime.expGained).toBe(25);
    // 手动回退当前等级后再次记录 → max 不降低
    state().roster['Hoshino'].level = 1;
    state().roster['Hoshino'].exp = 0;
    game.mutations.addExp('Hoshino', 5);
    expect(mem().variants['Hoshino'].maxLevel).toBe(3);
  });

  test('突破刷新 maxStars 与 lifetime.cultivateSpent', () => {
    (state().fragments ??= {})['Hoshino'] = 3;
    game.mutations.breakthroughStar('Hoshino');
    expect(mem().variants['Hoshino'].maxStars).toBe(1);
    expect(mem().lifetime.cultivateSpent).toBe(1);
  });

  test('好感入账刷新 maxAffection 与 lifetime.affectionGained', () => {
    game.mutations.addAffectionExp('Hoshino', 100);
    expect(mem().variants['Hoshino'].maxAffection).toBeGreaterThan(1);
    expect(mem().lifetime.affectionGained).toBe(100);
  });

  test('Proto 总好感 = Σ 各 Variant 好感（取历史最高）', () => {
    game.mutations.acquireCharacter('HoshinoSwimsuit', 'gacha');
    expect(mem().affectionTotalEver).toBe(2);
    game.mutations.addAffectionExp('Hoshino', 100);
    const sum = (state().roster['Hoshino'].affectionLevel ?? 1)
      + (state().roster['HoshinoSwimsuit'].affectionLevel ?? 1);
    expect(mem().affectionTotalEver).toBe(sum);
  });
});
