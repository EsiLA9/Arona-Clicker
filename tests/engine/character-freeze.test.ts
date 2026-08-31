// ============================================================
// engine/character-freeze.test.ts — M7 冻结回归验收（F 组收口）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import type { Datapack } from '../../src/engine/types';
import { Character } from '../../src/engine/types';

describe('F-02：characterBonuses 废弃', () => {
  test('携带旧表时 devLog 警告且不生效', () => {
    const dp: Datapack = {
      ...baseDatapack,
      name: 'legacy',
      characterBonuses: [{ characterId: Character.Shiroko, spotId: 'base:spot:credit_printer', multiplier: 99 }],
    };
    const game = new GameInstance();
    game.init([dp]);
    const warned = game.devLog.getEntries().some(l => l.message.includes('characterBonuses'));
    expect(warned).toBe(true);
    // 冻结后无任何 bonus 生效路径：registry 不再存储
    expect(game.registry.characterBonuses).toHaveLength(0);
  });
});

describe('grantCharacter Effect', () => {
  test('applyEffect 经统一入口获得差分（重复自动转碎片）', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.mutations.applyEffect({ op: 'grantCharacter', target: 'HoshinoSwimsuit', value: '' });
    expect(game.rosterSystem.isOwned(game.state, 'HoshinoSwimsuit')).toBe(true);

    game.mutations.applyEffect({ op: 'grantCharacter', target: 'HoshinoSwimsuit', value: '' });
    // 默认 dupRewards 缺省 = +1 该变体碎片
    expect(game.rosterSystem.shardsOf(game.state, 'HoshinoSwimsuit')).toBe(1);
    // 原型聚合统计同步
    expect(game.state.protoStats![Character.Hoshino].acquiredTotal).toBe(2);
  });

  test('未知差分抛错', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    expect(() =>
      game.mutations.applyEffect({ op: 'grantCharacter', target: 'Ghost', value: '' }),
    ).toThrow();
  });
});

describe('base 数据包 Character 重构内容冒烟', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
  });

  test('变体/曲线/色彩/卡池/好感台阶全部加载', () => {
    expect(game.registry.characterVariants.size).toBeGreaterThanOrEqual(10);
    expect(game.registry.cultivateCurves.get('base:cultivatecurve:standard')).toBeDefined();
    expect(game.registry.colorGroups.size).toBeGreaterThanOrEqual(3);
    expect(game.registry.gachaPools.size).toBeGreaterThanOrEqual(2);
    expect(game.registry.passiveStories.get('base:passivestory:affinity_hoshino_1')).toBeDefined();
  });

  test('卡池引用完整性通过（validateCharacterRefs 已在 init 执行）', () => {
    const pool = game.gachaService.getPool('base:gachapool:swimsuit-up')!;
    expect(pool.featured).toContain('HoshinoSwimsuit');
    const drawable = game.availabilityService.drawableOf(pool, game.state);
    expect(drawable.length).toBeGreaterThan(0);
  });

  test('端到端：抽卡 → 获得差分 → 培养 → 色彩解锁 → 主题激活', () => {
    game.mutations.changeResource('base:resource:pyroxene', 100000);
    const summary = game.gachaService.roll('base:gachapool:swimsuit-up', 10);
    expect(summary.results.length).toBeGreaterThan(0);

    // 拿到任一差分后培养
    const variantId = summary.results[0].variantId;
    expect(game.mutations.addExp(variantId, 500).ok).toBe(true);

    // 夏莱蓝条件（Arona 获得）可能未触发；用无条件路径验证主题链路
    const owned = [...game.registry.colorGroups.values()].find(g =>
      !g.unlock || game.colorSystem.tryUnlockGroup(g.id) === 'unlocked');
    if (owned) {
      expect(game.mutations.activateTheme(owned.id)).toBe(true);
      expect(game.colorSystem.activeThemeTokens(game.state)?.['primary'])
        .toBe(game.colorSystem.themeSwatchColor({ colorGroupId: owned.id }));
    }
  });
});
