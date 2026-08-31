// ============================================================
// tests/engine/entity-theme.test.ts — 实体主题槽 / 配色设计
// ============================================================

import { describe, test, expect, beforeAll } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { entityKeyOf } from '../../src/engine/system/color-system';
import { baseDatapack } from '../../src/data/index';
import type { ThemeDesignDef } from '../../src/engine/types/character';

const OFFICE = 'base:init:office';

let game: GameInstance;

/** 注册一个样例配色设计到 registry。 */
function addDesign(design: ThemeDesignDef): void {
  (game.registry as any)._themeDesigns.set(design.id, design);
}

describe('实体主题槽：entityThemeOverride', () => {
  beforeAll(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
    game.mutations.acquireCharacter('Arona', 'gacha');
    game.mutations.activateTheme('base:colorgroup:schale-solid');
    game.colorSystem.syncPlayerThemeFromState(game.state);
    // 注册一个样例设计（目标 Abydos 沙漠街道）
    addDesign({
      id: 'base:themedesign:abydos-sunset',
      name: '阿比多斯·落日',
      entityKey: entityKeyOf('area', 'base:area:abydos_pool'),
      theme: { colorGroupId: 'base:colorgroup:coral' },
      unlock: { target: 'flag', key: 'abydos_sunset_unlocked', comparator: '==', value: 1 },
    });
    // 第二个设计：专供「解锁流程」用例（未被前置用例解锁）
    addDesign({
      id: 'base:themedesign:abydos-dusk',
      name: '阿比多斯·暮色',
      entityKey: entityKeyOf('area', 'base:area:abydos_pool'),
      theme: { colorGroupId: 'base:colorgroup:indigo' },
      unlock: { target: 'flag', key: 'abydos_dusk_unlocked', comparator: '==', value: 1 },
    });
  });

  test('无主题槽 → null（走声明默认）', () => {
    expect(game.colorSystem.entityThemeOverride(game.state, entityKeyOf('area', 'base:area:abydos_pool'))).toBeNull();
  });

  test('default 槽 → null', () => {
    game.mutations.setEntityThemeSlot(entityKeyOf('area', 'base:area:abydos_pool'), { kind: 'default' });
    expect(game.colorSystem.entityThemeOverride(game.state, entityKeyOf('area', 'base:area:abydos_pool'))).toBeNull();
    // 清理
    game.mutations.setEntityThemeSlot(entityKeyOf('area', 'base:area:abydos_pool'), null);
  });

  test('custom 槽 → 返回 customTheme', () => {
    const key = entityKeyOf('area', 'base:area:abydos_pool');
    const custom = { colorGroupId: 'base:colorgroup:ink', tokens: { primary: '#1e3a5f' } };
    game.mutations.setEntityThemeSlot(key, { kind: 'custom', customTheme: custom });
    const override = game.colorSystem.entityThemeOverride(game.state, key);
    expect(override).toEqual(custom);
    // 清理
    game.mutations.setEntityThemeSlot(key, null);
  });

  test('design 槽 — 未拥有 → null', () => {
    const key = entityKeyOf('area', 'base:area:abydos_pool');
    game.mutations.setEntityThemeSlot(key, { kind: 'design', designId: 'base:themedesign:abydos-sunset' });
    expect(game.colorSystem.entityThemeOverride(game.state, key)).toBeNull();
    game.mutations.setEntityThemeSlot(key, null);
  });

  test('design 槽 — 已拥有 → 返回设计的 theme', () => {
    const key = entityKeyOf('area', 'base:area:abydos_pool');
    game.mutations.unlockEntityDesign(key, 'base:themedesign:abydos-sunset');
    game.mutations.setEntityThemeSlot(key, { kind: 'design', designId: 'base:themedesign:abydos-sunset' });
    const override = game.colorSystem.entityThemeOverride(game.state, key);
    expect(override).toBeTruthy();
    expect(override!.colorGroupId).toBe('base:colorgroup:coral');
    // 清理
    game.mutations.setEntityThemeSlot(key, null);
  });

  test('equipment 槽 — 未装备 → null', () => {
    const key = entityKeyOf('variant', 'Arona');
    game.mutations.setEntityThemeSlot(key, { kind: 'equipment', equipmentId: 'base:colorequipment:schale-badge' });
    expect(game.colorSystem.entityThemeOverride(game.state, key, null)).toBeNull();
    game.mutations.setEntityThemeSlot(key, null);
  });
});

describe('设计解锁 tryUnlockDesign', () => {
  const DESIGN = 'base:themedesign:abydos-dusk';

  test('未知设计 → false', () => {
    expect(game.colorSystem.tryUnlockDesign(entityKeyOf('area', 'base:area:abydos_pool'), 'nonexistent')).toBe(false);
  });

  test('条件不满足 → false', () => {
    const key = entityKeyOf('area', 'base:area:abydos_pool');
    const r = game.colorSystem.tryUnlockDesign(key, DESIGN);
    expect(r).toBe(false); // flag 未设置
  });

  test('flag 满足 → flagChanged 自动解锁并设为该实体当前生效主题（闭环）', () => {
    const key = entityKeyOf('area', 'base:area:abydos_pool');
    // setFlag 触发 flagChanged → game-instance 挂的 recheckDesignUnlocks 自动解锁
    game.mutations.setFlag('abydos_dusk_unlocked', '1');
    expect(game.colorSystem.isDesignOwned(game.state, key, DESIGN)).toBe(true);
    // 自动设为主题槽（获得即改默认）
    const slot = game.state.entityThemeSlots?.[key];
    expect(slot?.kind).toBe('design');
    expect(slot?.designId).toBe(DESIGN);
  });

  test('已拥有 → already', () => {
    const key = entityKeyOf('area', 'base:area:abydos_pool');
    expect(game.colorSystem.tryUnlockDesign(key, DESIGN)).toBe('already');
  });
});

describe('主题选项 entityThemeOptions', () => {
  test('区域无声明主题 → 空列表（无默认选项）', () => {
    // 用无 theme 声明的区域
    const key = entityKeyOf('area', 'base:area:schale_main');
    const opts = game.colorSystem.entityThemeOptions(game.state, key, {});
    expect(opts.length).toBe(0);
  });

  test('有声明主题 + 已解锁设计 → 包含默认 + 设计选项', () => {
    const key = entityKeyOf('area', 'base:area:abydos_pool');
    const opts = game.colorSystem.entityThemeOptions(game.state, key, {
      declaredTheme: { colorGroupId: 'base:colorgroup:abydos-sand' },
    });
    expect(opts.some(o => o.kind === 'default')).toBe(true);
    expect(opts.some(o => o.kind === 'design' && o.id === 'base:themedesign:abydos-sunset' && o.owned)).toBe(true);
  });
});

describe('setTheme effect scope 扩展', () => {
  test('scope=area + entityKey → 写入实体主题槽', () => {
    const key = entityKeyOf('area', 'base:area:schale_main');
    const handled = game.colorSystem.handleThemeEffect({
      op: 'setTheme',
      target: '',
      value: { scope: 'area', entityKey: key, colorGroupId: 'base:colorgroup:ink', tokens: { primary: '#1e3a5f' } },
    });
    expect(handled).toBe(true);
    const slot = game.state.entityThemeSlots?.[key];
    expect(slot?.kind).toBe('custom');
    expect(slot?.customTheme?.colorGroupId).toBe('base:colorgroup:ink');
    // 清理
    game.mutations.setEntityThemeSlot(key, null);
  });

  test('scope=ephemeral（缺省）→ 走临时演出层', () => {
    const handled = game.colorSystem.handleThemeEffect({
      op: 'setTheme',
      target: '',
      value: { colorGroupId: 'base:colorgroup:coral' },
    });
    expect(handled).toBe(true);
    const themed = game.colorSystem.runtimeTheme();
    expect(themed.tokens['primary']).toBe('#ff7a59');
    game.colorSystem.clearStoryTheme();
  });
});