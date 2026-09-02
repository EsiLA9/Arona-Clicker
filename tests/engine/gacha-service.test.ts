import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/gacha-service.test.ts — 抽取模式与卡池（G 组）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import type { } from '../../src/engine/types';
import { GachaMode } from '../../src/data-services/contracts/gacha-pool';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';

const POOL = 'test:gachapool:pool-main';
const CURRENCY = 'base:resource:pyroxene';

/** mulberry32 确定性 RNG（G-08）。 */
function seededRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
      v('Hoshino', Character.Hoshino, CharacterRarity.Rare),
      v('HoshinoSwimsuit', Character.Hoshino, CharacterRarity.SuperRare),
      v('Shiroko', Character.Shiroko, CharacterRarity.SuperRare),
      v('Serika', Character.Serika, CharacterRarity.Common),
    ],
    gachaPools: [
      {
        id: POOL,
        name: '测试池',
        mode: GachaMode.BaClassic,
        currency: CURRENCY,
        costPerPull: 120,
        rates: [
          { rarity: CharacterRarity.Common, weight: 79 },
          { rarity: CharacterRarity.Rare, weight: 18 },
          { rarity: CharacterRarity.SuperRare, weight: 3 },
        ],
        featured: ['HoshinoSwimsuit'],
        pity: { guaranteedAt: 10 },
        dupRewards: { shards: 8, bonusResources: { 'base:resource:credit': 50 } },
        members: ['Hoshino', 'HoshinoSwimsuit', 'Shiroko', 'Serika'],
      },
    ],
  };
}

function v(id: string, proto: Character, rarity: CharacterRarity) {
  return {
    id,
    proto,
    name: id,
    displayName: id,
    school: CharacterSchool.Abydos,
    rarity,
    description: '',
  };
}

describe('gacha（G-01 ~ G-10）', () => {
  let game: GameInstance;
  const state = () => (game as any)._state;
  const balance = () => (game.initService as any).getResourceAmount(CURRENCY);
  const credit = () =>
    (game.initService as any).getResourceAmount('base:resource:credit');

  function grantCurrency(amount: number): void {
    game.mutations.changeResource(CURRENCY, amount);
  }

  beforeEach(() => {
    game = new GameInstance();
    game.init([makeDatapack()]);
    game.gachaService.setRng(seededRng(42));
    grantCurrency(100000);
  });

  test('G-00/G-07 未注册模式的卡池加载期报错', () => {
    const bad = makeDatapack();
    (bad.gachaPools![0] as any).mode = 'fgo-style';
    expect(() => new GameInstance().init([bad])).toThrow(/抽取模式/);
  });

  test('G-01 正常抽取：扣费、pulls+1、结果在成员集合内', () => {
    const before = balance();
    const summary = game.gachaService.roll(POOL, 1);
    expect(summary.results).toHaveLength(1);
    expect(summary.stopped).toBeUndefined();
    const after = balance();
    expect(before - after).toBe(120);
    expect(game.gachaService.countersOf(POOL).pulls).toBe(1);
    expect(makeDatapack().gachaPools![0].members).toContain(summary.results[0].variantId);
  });

  test('G-02 资源不足拒绝：无事件、无扣费、计数不变', () => {
    const pullsBefore = game.gachaService.countersOf(POOL).pulls;
    grantCurrency(-100000); // 清空
    const summary = game.gachaService.roll(POOL, 1);
    expect(summary.results).toHaveLength(0);
    expect(summary.stopped).toBe('insufficient-currency');
    expect(game.gachaService.countersOf(POOL)).toEqual({ pity: 0, pulls: pullsBefore });
  });

  test('G-03 天井：pity 达 guaranteedAt 必出 UP 并归零', () => {
    // pity=9 时再抽：pity+1 >= 10 → 强制 featured（天井判定先于 roll，确定性）
    state().gachaState = { [POOL]: { pity: 9, pulls: 0 } };
    const summary = game.gachaService.roll(POOL, 1);
    expect(summary.results[0].variantId).toBe('HoshinoSwimsuit');
    expect(state().gachaState[POOL].pity).toBe(0);
  });

  test('G-04 pity 计数：非最高稀有度命中时累加', () => {
    // seed 选定后首抽若为 SuperRare 则 pity 归零，否则 +1；断言单调性即可
    const before = game.gachaService.countersOf(POOL).pity;
    game.gachaService.roll(POOL, 1);
    const after = state().gachaState[POOL].pity;
    expect([before + 1, 0]).toContain(after);
  });

  test('G-05 UP 偏向：featured 在其稀有度内以 50% 权重优先', () => {
    // 大样本统计：SuperRare 命中中 UP 应约占一半（容忍区间放宽防 flaky）
    state().gachaState = { [POOL]: { pity: 0, pulls: 0 } };
    let sr = 0;
    let up = 0;
    const rng = seededRng(20260822);
    for (let i = 0; i < 400; i++) {
      grantCurrency(120);
      const s = game.gachaService.roll(POOL, 1);
      const r = s.results[0];
      if (!r) continue;
      if (r.variantId === 'HoshinoSwimsuit') {
        up++;
        sr++;
      } else if (r.variantId === 'Shiroko') {
        sr++;
      }
      state().gachaState[POOL].pity = 0; // 关掉天井干扰
    }
    expect(sr).toBeGreaterThan(0);
    expect(up / sr).toBeGreaterThan(0.2);
    expect(up / sr).toBeLessThan(0.85);
  });

  test('G-06 重复出货：返还该变体碎片 + 池配置附加资源', () => {
    // 预持有 Common（79% 权重）→ 短序列内必出重复
    game.mutations.acquireCharacter('Serika', 'story');
    const creditBefore = credit();
    let dupCount = 0;
    let sawDup = false;
    for (let i = 0; i < 30 && !sawDup; i++) {
      grantCurrency(120);
      const r = game.gachaService.roll(POOL, 1).results[0];
      if (!r) break;
      if (r.duplicate) {
        sawDup = true;
        expect(r.variantId).toBe('Serika'); // 只持有过 Serika
        expect(r.shards).toBe(8); // 池配置 dupRewards.shards
        expect(r.bonusResources).toEqual({ 'base:resource:credit': 50 });
        state().gachaState[POOL].pity = 0;
        state().gachaState[POOL].pulls = 0;
        dupCount++;
        // 重置持有以制造下一次重复场景（此处直接收尾）
      }
    }
    expect(sawDup).toBe(true);
    const creditAfter = credit();
    expect(creditAfter - creditBefore).toBe(50 * dupCount);
  });

  test('G-08 结果确定性：同 seed 同序列', () => {
    const run = () => {
      const g = new GameInstance();
      g.init([makeDatapack()]);
      g.gachaService.setRng(seededRng(7));
      g.mutations.changeResource(CURRENCY, 100000);
      return g.gachaService.roll(POOL, 20).results.map(r => r.variantId);
    };
    expect(run()).toEqual(run());
  });

  test('G-09 十连中止语义：资源不足返回已完成部分', () => {
    grantCurrency(-100000);
    grantCurrency(300); // 够 2 抽
    const summary = game.gachaService.roll(POOL, 10);
    expect(summary.results.length).toBe(2);
    expect(summary.stopped).toBe('insufficient-currency');
    expect(balance()).toBeLessThan(120);
  });

  test('G-10 多模式注册表互不影响（未知池报错路径）', () => {
    expect(() => game.gachaService.roll('test:gachapool:pool-ghost', 1)).toThrow(/未知卡池/);
  });
});
