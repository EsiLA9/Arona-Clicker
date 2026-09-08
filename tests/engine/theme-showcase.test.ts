import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import {
  THEME_SHOWCASE_AREA,
  THEME_SHOWCASE_ENHANCEMENTS,
  THEME_SHOWCASE_INIT,
  THEME_SHOWCASE_SPOTS,
  THEME_SHOWCASE_VARIANTS,
} from '../../src/arona-clicker/content/theme-showcase';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';

describe('主题系统展示 Init', () => {
  test('无需求可进入，并首次进入赠送展示内容与主题编辑权限', () => {
    const game = new GameInstance();
    game.init([defaultDatapack]);
    expect(game.inits.startNewGame(THEME_SHOWCASE_INIT)).toBe(true);

    expect(game.state.activeInit).toBe(THEME_SHOWCASE_INIT);
    expect(game.state.currentAreaId).toBe(THEME_SHOWCASE_AREA);
    expect(THEME_SHOWCASE_SPOTS.every(id => game.state.spotLevels[id] === 1)).toBe(true);
    expect(THEME_SHOWCASE_ENHANCEMENTS.every(id => game.state.unlockedEnhancements.includes(id))).toBe(true);
    expect(game.state.unlockedEnhancements).toContain('base:enhancement:user-theme-editor');
    expect(THEME_SHOWCASE_VARIANTS.every(id => Boolean(game.state.roster?.[id]))).toBe(true);
    expect(game.registry.passiveStories.has('base:passivestory:theme_showcase')).toBe(true);

    const theme = game.registry.inits.get(THEME_SHOWCASE_INIT)?.theme;
    expect(theme?.background?.[0]).toMatchObject({
      id: 'theme-showcase-atmosphere',
      kind: 'gradient',
    });
    expect(theme?.background?.[0]?.value).toContain('#cffafe');
  });
});
