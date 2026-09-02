import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/color-system.test.ts — 色彩系统（CL 组 + CT 组）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import {
  contrastRatio,
  deriveThemeTokens,
  resolveTheme,
} from '../../src/arona-clicker/services/color-system';
import type { ColorGroupDef, } from '../../src/data-services/contracts/color';
import { Character, CharacterRarity, CharacterSchool } from '../../src/arona-clicker/types/ids';

function v(id: string, proto: Character) {
  return {
    id,
    proto,
    name: id,
    displayName: id,
    school: CharacterSchool.Abydos,
    rarity: CharacterRarity.Rare,
    description: '',
  };
}

/** solid 单主色位组。 */
function g(id: string, name: string, primary: string, extra?: Partial<ColorGroupDef>): ColorGroupDef {
  return {
    id,
    name,
    compositionType: 'solid',
    slots: [{ role: 'primary', color: primary }],
    ...extra,
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
    characterVariants: [v('Hoshino', Character.Hoshino), v('Multi', Character.Mika)],
    colorGroups: [
      g('test:colorgroup:color-flag', '旗标色', '#3b82f6', {
        unlock: { target: 'flag', key: 'unlock_blue', comparator: '>=', value: 1 },
      }),
      g('test:colorgroup:color-stat', '经历色', '#ef4444', {
        unlock: { target: 'protoStat', key: String(Character.Hoshino), comparator: '>=', value: 2 },
      }),
      g('test:colorgroup:color-free', '无条件色', '#22c55e'),
      g('test:colorgroup:color-custom', '全量自定义', '#a855f7', {
        theme: {
          primary: '#a855f7',
          bg: '#ffffff',
          bgAlt: '#f5f5f5',
          text: '#111111',
          textDim: '#666666',
          border: '#dddddd',
          accent: '#a855f7',
        },
      }),
      g('test:colorgroup:color-auto', '获得即解锁', '#f59e0b', {
        unlock: { target: 'protoStat', key: String(Character.Hoshino), comparator: '>=', value: 1 },
      }),
      g('test:colorgroup:color-contrast-bad', '低对比度防呆', '#888888', {
        // text 与 bg 几乎同明度 → 应被翻转
        theme: { primary: '#888888', bg: '#cccccc', text: '#bbbbbb' },
      }),
    ],
  };
}

describe('CT 主题派生（纯函数）', () => {
  test('CT-01 仅 primary → HSL 确定性派生全套 token', () => {
    const a = deriveThemeTokens('#3b82f6');
    const b = deriveThemeTokens('#3b82f6');
    expect(a).toEqual(b); // 同输入同输出
    for (const key of ['primary', 'bg', 'bgAlt', 'text', 'border', 'accent']) {
      expect(a[key]).toBeDefined();
    }
    // 深浅跟随 primary 明度：亮 primary → 亮背景
    const light = deriveThemeTokens('#fde68a');
    const dark = deriveThemeTokens('#1e3a8a');
    expect(light['bg']).not.toBe(dark['bg']);
  });

  test('CT-02 显式多色配置覆盖派生值', () => {
    const tokens = resolveTheme(g('g', 'g', '#3b82f6', { theme: { primary: '#3b82f6', bg: '#123456' } }));
    expect(tokens['bg']).toBe('#123456');
    expect(tokens['primary']).toBe('#3b82f6');
    expect(tokens['text']).not.toBe('#123456'); // 其余仍为派生
  });

  test('CT-03 全量自定义：无派生介入', () => {
    const custom = makeDatapack().colorGroups!.find(c => c.id === 'test:colorgroup:color-custom')!;
    const tokens = resolveTheme(custom);
    expect(tokens['bg']).toBe('#ffffff');
    expect(tokens['text']).toBe('#111111');
    expect(tokens['textDim']).toBe('#666666');
    expect(tokens['border']).toBe('#dddddd');
  });

  test('CT-04 对比度防呆：text/bg 不足阈值时翻转', () => {
    expect(contrastRatio('#bbbbbb', '#cccccc')).toBeLessThan(4.5);
    const bad = makeDatapack().colorGroups!.find(c => c.id === 'test:colorgroup:color-contrast-bad')!;
    const tokens = resolveTheme(bad);
    expect(contrastRatio(tokens['text'], tokens['bg'])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('CL 色彩组获得与主题', () => {
  let game: GameInstance;
  const state = () => (game as any)._state;
  const events: any[] = [];

  beforeEach(() => {
    events.length = 0;
    game = new GameInstance();
    game.eventBus.on('groupUnlocked', e => events.push(e));
    game.eventBus.on('equipmentCollected', e => events.push(e));
    game.eventBus.on('equipmentEquipped', e => events.push(e));
    game.eventBus.on('themeChanged', e => events.push(e));
    game.init([makeDatapack()]);
    game.mutations.acquireCharacter('Hoshino', 'gacha');
  });

  test('CL-02 条件不满足拒绝；CL-08 protoStat 条件随统计即时判定', () => {
    expect(game.colorSystem.tryUnlockGroup('test:colorgroup:color-flag')).toBe(false);
    expect(game.colorSystem.tryUnlockGroup('test:colorgroup:color-stat')).toBe(false);
    // 获得星野两次 → acquiredTotal=2 → 条件满足，characterAcquired 事件自动解锁
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    expect(game.colorSystem.isGroupOwned(state(), 'test:colorgroup:color-stat')).toBe(true);
  });

  test('CL-01 条件满足解锁入库存并发事件', () => {
    game.mutations.setFlag('unlock_blue', '1');
    // setFlag 经 flagChanged 事件自动 recheck 解锁（行为闭环），手动再解锁为幂等
    expect(game.colorSystem.tryUnlockGroup('test:colorgroup:color-flag')).toBe('already');
    expect(game.colorSystem.isGroupOwned(state(), 'test:colorgroup:color-flag')).toBe(true);
    expect(events.filter(e => e.type === 'groupUnlocked' && e.groupId === 'test:colorgroup:color-flag')).toHaveLength(1);
  });

  test('CL-03 重复解锁幂等：不重复入库存、不重复发事件', () => {
    game.mutations.setFlag('unlock_blue', '1');
    game.colorSystem.tryUnlockGroup('test:colorgroup:color-flag');
    const n = state().groupsOwned.length;
    expect(game.colorSystem.tryUnlockGroup('test:colorgroup:color-flag')).toBe('already');
    expect(state().groupsOwned.length).toBe(n);
    expect(events.filter(e => e.type === 'groupUnlocked' && e.groupId === 'test:colorgroup:color-flag')).toHaveLength(1);
  });

  test('CL-05/06 激活主题全局单选，未拥有拒绝，切换只改 activeGroupId', () => {
    expect(game.mutations.activateTheme('test:colorgroup:color-free')).toBe(false); // 未拥有
    game.colorSystem.tryUnlockGroup('test:colorgroup:color-free');
    expect(game.mutations.activateTheme('test:colorgroup:color-free')).toBe(true);
    expect(state().activeGroupId).toBe('test:colorgroup:color-free');
    // 不影响装备槽（equippedEquipment 维持 null）
    expect(state().roster['Hoshino'].equippedEquipment).toBeNull();
  });

  test('activeThemeTokens 返回激活色彩组的最终 token 表', () => {
    game.colorSystem.tryUnlockGroup('test:colorgroup:color-free');
    game.mutations.activateTheme('test:colorgroup:color-free');
    const tokens = game.colorSystem.activeThemeTokens(state());
    expect(tokens?.['primary']).toBe('#22c55e');
  });

  test('CL-09 获得变体经 characterAcquired 事件自动解锁满足条件色彩组', () => {
    // beforeEach 已 acquire('Hoshino') 一次 → protoStat>=1 满足
    // 事件挂钩应在获得时自动 recheckUnlocks，无需手动 tryUnlock
    expect(game.colorSystem.isGroupOwned(state(), 'test:colorgroup:color-auto')).toBe(true);
    expect(events.filter(e => e.type === 'groupUnlocked' && e.groupId === 'test:colorgroup:color-auto')).toHaveLength(1);
    // 条件未满足者（需两次）仍不在库存
    expect(game.colorSystem.isGroupOwned(state(), 'test:colorgroup:color-stat')).toBe(false);
  });
});
