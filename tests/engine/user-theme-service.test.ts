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

  test('新编辑会话默认沿用当前界面的首个主题色', () => {
    const g = fresh();
    const session = g.userThemeService.beginEdit(['#1456c0', '#ff4d8d']);
    expect(session).toMatchObject({ draft: { palette: ['#1456c0'], paletteUiEnabled: [true] } });
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

  test('用户主题保存主题色列表与语义节点覆盖', () => {
    const g = fresh();
    g.enhancements.purchaseEnhancement(USER_THEME);
    const session = g.userThemeService.beginEdit();
    if ('readonly' in session) {
      const result = g.userThemeService.apply(session.id, {
        version: 1,
        palette: ['#123456', '#abcdef'],
        nodes: { active: '#fedcba' },
      });
      expect(result.ok).toBe(true);
      expect(g.state.userTheme?.applied?.palette).toEqual(['#123456', '#abcdef']);
      expect(g.state.userTheme?.applied?.nodes?.active).toBe('#fedcba');
    }
  });

  test('保存时将旧区域图层与面板透明度收束到宿主', () => {
    const g = fresh();
    g.enhancements.purchaseEnhancement(USER_THEME);
    const session = g.userThemeService.beginEdit();
    if ('readonly' in session) {
      const result = g.userThemeService.apply(session.id, {
        version: 1,
        presentation: {
          layers: [{ id: 'legacy', region: 'leftPanel', kind: 'solid', value: '#ffffff' }],
          panels: [{ region: 'leftPanel', opacity: 0.65 }],
        },
      });
      expect(result.ok).toBe(true);
      expect(g.state.userTheme?.applied?.presentation?.layers).toBeUndefined();
      expect(g.state.userTheme?.applied?.presentation?.panels).toBeUndefined();
      expect(g.state.userTheme?.applied?.presentation?.hosts).toEqual([
        { id: 'leftPanel', layers: [{ id: 'legacy', region: 'leftPanel', kind: 'solid', value: '#ffffff' }], layerOrder: ['legacy'], opacity: 0.65 },
      ]);
    }
  });

  test('global 表现宿主只收束到外部背景，不参与内容宿主树', () => {
    const g = fresh();
    g.enhancements.purchaseEnhancement(USER_THEME);
    const session = g.userThemeService.beginEdit();
    if ('readonly' in session) {
      const result = g.userThemeService.apply(session.id, {
        version: 1,
        presentation: {
          hosts: [{ id: 'global', layers: [{ id: 'outer', kind: 'solid', value: '#ffffff' }], layerOrder: ['outer'] }],
        },
      });
      expect(result.ok).toBe(true);
      expect(g.state.userTheme?.applied?.background).toEqual([{ id: 'outer', kind: 'solid', value: '#ffffff' }]);
      expect(g.state.userTheme?.applied?.presentation?.hosts).toEqual([]);
    }
  });

  test('用户主题拒绝超过六个主题色', () => {
    const g = fresh();
    g.enhancements.purchaseEnhancement(USER_THEME);
    const session = g.userThemeService.beginEdit();
    if ('readonly' in session) {
      const result = g.userThemeService.apply(session.id, {
        version: 1,
        palette: ['#1', '#2', '#3', '#4', '#5', '#6', '#7'],
      });
      expect(result).toMatchObject({ ok: false, code: 'invalid-draft' });
    }
  });
});
