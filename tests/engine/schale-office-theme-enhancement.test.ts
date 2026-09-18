import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { entityKeyOf } from '../../src/arona-clicker/services/color-system';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';

const CREDIT = 'base:resource:credit';
const OFFICE = 'base:init:schale_office';
const AREA = 'base:area:schale_main';
const ENHANCEMENT = 'base:enhancement:schale_night_mode';

describe('夏莱办公室主题强化', () => {
  test('获得后将夏莱主厅主题切换为墨蓝，并保留玩家切回声明默认的选项', () => {
    const game = new GameInstance();
    game.init([defaultDatapack]);
    expect(game.inits.startNewGame(OFFICE)).toBe(true);

    const area = game.registry.areas.get(AREA)!;
    const entityKey = entityKeyOf('area', AREA);
    const before = game.colorSystem.resolveEntityTheme(game.state, entityKey, { declaredTheme: area.theme });
    expect(before).toMatchObject({ sourceKind: 'declared-default', theme: { colorGroupId: 'base:colorgroup:schale-solid' } });

    game.state.resources[CREDIT] = 240;
    expect(game.enhancements.purchaseEnhancement(ENHANCEMENT)).toEqual({ success: true, enhancementId: ENHANCEMENT });

    const after = game.colorSystem.resolveEntityTheme(game.state, entityKey, { declaredTheme: area.theme });
    expect(after).toMatchObject({ sourceKind: 'custom', theme: { colorGroupId: 'base:colorgroup:ink' } });
    expect(game.colorSystem.entityThemeOptions(game.state, entityKey, { declaredTheme: area.theme })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'default', active: false }),
        expect.objectContaining({ kind: 'custom', active: true }),
      ]),
    );
    expect(game.registry.areas.get(AREA)?.theme).toEqual(area.theme);
    expect(game.enhancements.removeEnhancement(ENHANCEMENT)).toBe(false);
  });
});
