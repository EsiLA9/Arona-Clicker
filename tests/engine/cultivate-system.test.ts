import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/cultivate-system.test.ts — 培养（C 组）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { } from '../../src/engine/types';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';

const CURVE_ID = 'test:cultivatecurve:curve-main';

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
      {
        id: CURVE_ID,
        maxLevel: 3,
        expTable: [100, 200, 150], // L1→2 需 100，L2→3 需 200，L3→4 需 150（星扩展后可达）
        starMax: 2,
        starCost: [1, 3], // 0→1 星需 1 碎片，1→2 星需 3 碎片
      },
    ],
    characterVariants: [
      {
        id: 'Hoshino',
        proto: Character.Hoshino,
        name: '星野',
        displayName: '小鸟游星野',
        school: CharacterSchool.Abydos,
        rarity: CharacterRarity.Rare,
        description: '',
        curve: CURVE_ID,
      },
      {
        id: 'HoshinoSwimsuit',
        proto: Character.Hoshino,
        name: '泳装星野',
        displayName: '小鸟游星野（泳装）',
        school: CharacterSchool.Abydos,
        rarity: CharacterRarity.SuperRare,
        description: '',
        curve: CURVE_ID,
      },
      {
        id: 'NoCurve',
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

describe('addExp（C-01 ~ C-06）', () => {
  let game: GameInstance;
  const state = () => (game as any)._state;

  beforeEach(() => {
    game = new GameInstance();
    game.init([makeDatapack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
  });

  test('C-01 加经验不跨级', () => {
    const r = game.mutations.addExp('Hoshino', 99);
    expect(r).toEqual({ ok: true, newLevel: 1, newExp: 99 });
  });

  test('C-02 跨级：level+1，扣除本级需求，余量进下级', () => {
    const r = game.mutations.addExp('Hoshino', 150);
    expect(r).toEqual({ ok: true, newLevel: 2, newExp: 50 });
  });

  test('C-03 一次跨多级：逐级扣减', () => {
    const r = game.mutations.addExp('Hoshino', 300);
    expect(r).toEqual({ ok: true, newLevel: 3, newExp: 0 });
  });

  test('C-04 曲线上限：溢出截断为 0，等级封顶', () => {
    const r = game.mutations.addExp('Hoshino', 9999);
    expect(r.newLevel).toBe(3);
    expect(r.newExp).toBe(0); // 截断
    // 继续加经验无效（已封顶）
    const r2 = game.mutations.addExp('Hoshino', 500);
    expect(r2.ok).toBe(false);
    expect(r2.newLevel).toBe(3);
  });

  test('C-05 上限 = min(曲线上限, accountLevelCap)；星级不再抬升', () => {
    // accountLevelCap 收紧到 2 → cap = min(3, 2) = 2
    state().accountLevelCap = 2;
    expect(game.mutations.addExp('Hoshino', 9999).newLevel).toBe(2);
    // 放开账号上限 → cap = 3（曲线上限）
    state().accountLevelCap = undefined;
    expect(game.mutations.addExp('Hoshino', 9999).newLevel).toBe(3);
    // 星级突破不再抬升等级上限：仍在 L3 封顶
    (state().fragments ??= {})['Hoshino'] = 5;
    expect(game.mutations.breakthroughStar('Hoshino')).toEqual({ ok: true, newStars: 1 });
    expect(game.mutations.addExp('Hoshino', 150).ok).toBe(false);
    expect(state().roster['Hoshino'].level).toBe(3);
  });

  test('C-06 未拥有变体拒绝培养', () => {
    expect(game.mutations.addExp('NoCurve', 100).ok).toBe(false);
    expect(game.mutations.breakthroughStar('NoCurve').ok).toBe(false);
  });

  test('未知差分抛错', () => {
    expect(() => game.mutations.addExp('GhostX', 10)).toThrow();
    expect(() => game.mutations.breakthroughStar('GhostX')).toThrow();
  });
});

describe('breakthroughStar（C-10 ~ C-13）', () => {
  let game: GameInstance;
  const state = () => (game as any)._state;

  beforeEach(() => {
    game = new GameInstance();
    game.init([makeDatapack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.acquireCharacter('HoshinoSwimsuit', 'gacha');
    (state().fragments ??= {})['Hoshino'] = 4;
    (state().fragments ??= {})['HoshinoSwimsuit'] = 0;
  });

  test('C-10 碎片足够 → 突破并扣碎片，发 characterProgressChanged(star) 事件', () => {
    const events: any[] = [];
    game.eventBus.on('characterProgressChanged', e => events.push(e));
    const r = game.mutations.breakthroughStar('Hoshino');
    expect(r).toEqual({ ok: true, newStars: 1 });
    expect(state().fragments['Hoshino']).toBe(3);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ variantId: 'Hoshino', domain: 'star', after: 1 });
  });

  test('C-11 碎片不足拒绝，余额与星级不变', () => {
    (state().fragments ??= {})['Hoshino'] = 0;
    const before = state().roster['Hoshino'].stars;
    const r = game.mutations.breakthroughStar('Hoshino');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('insufficient-shards');
    expect(state().fragments['Hoshino']).toBe(0);
    expect(state().roster['Hoshino'].stars).toBe(before);
  });

  test('C-12 星级上限拒绝', () => {
    (state().fragments ??= {})['Hoshino'] = 99;
    game.mutations.breakthroughStar('Hoshino'); // 1 星（-1）
    game.mutations.breakthroughStar('Hoshino'); // 2 星（-3）= 上限
    const r = game.mutations.breakthroughStar('Hoshino');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('at-max');
    expect(state().roster['Hoshino'].stars).toBe(2);
  });

  test('C-13 碎片按差分隔离：A 突破只消耗 A 的碎片，B 的不可替代', () => {
    // Hoshino 只有 4 碎片；1→2 星需 3。若可跨变体借用泳装的 0 碎片无影响；
    // 关键断言：消耗后 Hoshino 扣减、HoshinoSwimsuit 恒为 0
    game.mutations.breakthroughStar('Hoshino');
    game.mutations.breakthroughStar('Hoshino');
    expect(state().fragments['Hoshino']).toBe(0);
    expect(state().fragments['HoshinoSwimsuit']).toBe(0);
    // 泳装差分无碎片 → 突破失败
    const r = game.mutations.breakthroughStar('HoshinoSwimsuit');
    expect(r.ok).toBe(false);
  });
});

describe('P-02 培养驱动 protoStats.cultTotal', () => {
  test('升级按经验量累计、突破按碎片消耗累计', () => {
    const game = new GameInstance();
    game.init([makeDatapack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.mutations.addExp('Hoshino', 150);
    ((game as any)._state.fragments ??= {})['Hoshino'] = 1;
    game.mutations.breakthroughStar('Hoshino');
    const stat = (game as any)._state.protoStats![Character.Hoshino];
    expect(stat.cultTotal).toBe(150 + 1);
  });
});
