import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';

const OFFICE = 'base:init:schale_office';
const USER_THEME = 'base:enhancement:user-theme-editor';
const PYROXENE = 'base:resource:pyroxene';

describe('UserThemeService：Affector 能力闸门与全局保存', () => {
  let game: GameInstance | undefined;
  afterEach(() => game?.stop());

  function fresh(): GameInstance {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
    game.state.resources['base:resource:pyroxene'] = 100;
    return game;
  }

  test('没有 Active 能力来源时不可保存，获得任意能力 Affector 后开放', () => {
    const g = fresh();
    expect(g.userThemeService.capability().active).toBe(false);
    expect(g.registry.enhancements.get(USER_THEME)?.price).toBeUndefined();
    expect(g.userThemeService.beginEdit()).toMatchObject({ readonly: true });
    expect(g.enhancements.purchaseEnhancement(USER_THEME).success).toBe(true);
    expect(g.userThemeService.capability().active).toBe(true);
    const session = g.userThemeService.beginEdit();
    expect('readonly' in session && session.readonly).toBe(false);
  });

  test('主题编辑权限暂时免费赠送：没有青辉石也可以购买并开放能力', () => {
    const g = fresh();
    delete g.state.resources[PYROXENE];
    if (g.state.globalResources) delete g.state.globalResources[PYROXENE];

    expect(g.enhancements.purchaseEnhancement(USER_THEME).success).toBe(true);
    expect(g.userThemeService.capability().active).toBe(true);
  });

  test('保存用户主题只更新 Global 状态，并由 revision 保护旧会话', () => {
    const g = fresh();
    g.enhancements.purchaseEnhancement(USER_THEME);
    const first = g.userThemeService.beginEdit();
    const second = g.userThemeService.beginEdit();
    if ('readonly' in first && 'readonly' in second) {
      expect(g.userThemeService.apply(first.id, { version: 1, tokens: { primary: '#123456' } }).ok).toBe(true);
      expect(g.userThemeService.apply(second.id, { version: 1, tokens: { primary: '#abcdef' } })).toMatchObject({ ok: false, code: 'revision-conflict' });
    }
    expect(g.state.userTheme?.applied?.tokens?.primary).toBe('#123456');
    expect(g.state.initSnapshots).toEqual({});
  });

  test('危险表现值被拒绝且不会覆盖已保存主题', () => {
    const g = fresh();
    g.enhancements.purchaseEnhancement(USER_THEME);
    const session = g.userThemeService.beginEdit();
    if ('readonly' in session) {
      const result = g.userThemeService.apply(session.id, {
        version: 1,
        tokens: { primary: 'red; background:url(javascript:alert(1))' as never },
      });
      expect(result).toMatchObject({ ok: false, code: 'invalid-draft' });
      expect(g.state.userTheme?.applied).toBeUndefined();
    }
  });
});
