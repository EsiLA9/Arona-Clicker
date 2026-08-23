import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';

const OFFICE = 'base:init:office';

function freshGame(): GameInstance {
  const g = new GameInstance();
  g.init([baseDatapack]);
  g.startNewGame(OFFICE);
  return g;
}

describe('色彩在测试游戏(baseDatapack)内的解锁与激活链路', () => {
  let game: GameInstance;
  beforeEach(() => { game = freshGame(); });

  test('启动后色彩库存为空（条件均未满足）', () => {
    expect(game.state.colorsOwned?.length ?? 0).toBe(0);
  });

  test('获得星野 → 自动解锁 hoshino 系全部色彩(含泳装/墨蓝/黄沙)', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    for (const id of ['base:color:abydos-sand', 'base:color:hoshino-swim', 'base:color:ink']) {
      expect(game.colorSystem.isOwned(game.state, id)).toBe(true);
    }
  });

  test('获得不同学生各自解锁对应色彩', () => {
    game.mutations.acquireCharacter('Shiroko', 'gacha');
    expect(game.colorSystem.isOwned(game.state, 'base:color:rose')).toBe(true);
    game.mutations.acquireCharacter('Serika', 'gacha');
    expect(game.colorSystem.isOwned(game.state, 'base:color:emerald')).toBe(true);
    game.mutations.acquireCharacter('Yuuka', 'gacha');
    expect(game.colorSystem.isOwned(game.state, 'base:color:violet')).toBe(true);
    game.mutations.acquireCharacter('Mika', 'gacha');
    expect(game.colorSystem.isOwned(game.state, 'base:color:amber')).toBe(true);
    game.mutations.acquireCharacter('Iori', 'gacha');
    expect(game.colorSystem.isOwned(game.state, 'base:color:crimson')).toBe(true);
    game.mutations.acquireCharacter('Miyako', 'gacha');
    expect(game.colorSystem.isOwned(game.state, 'base:color:teal')).toBe(true);
    game.mutations.acquireCharacter('Saori', 'gacha');
    expect(game.colorSystem.isOwned(game.state, 'base:color:indigo')).toBe(true);
    game.mutations.acquireCharacter('Arona', 'gacha');
    expect(game.colorSystem.isOwned(game.state, 'base:color:schale-blue')).toBe(true);
    expect(game.colorSystem.isOwned(game.state, 'base:color:sky')).toBe(true);
  });

  test('完成欢迎剧情(flag)解锁 flag 系色彩(粉/青柠/珊瑚)', () => {
    game.mutations.setFlag('momotalk_pink_unlocked', '1');
    for (const id of ['base:color:momotalk-pink', 'base:color:lime', 'base:color:coral']) {
      expect(game.colorSystem.isOwned(game.state, id)).toBe(true);
    }
  });

  test('已拥有的色彩均能通过 activeThemeTokens 生成完整 7-token', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    const all = game.colorSystem.ownedColors(game.state);
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const c of all) {
      game.mutations.activateTheme(c.id);
      const t = game.colorSystem.activeThemeTokens(game.state);
      expect(t).toBeTruthy();
      for (const k of ['primary', 'bg', 'bgAlt', 'text', 'textDim', 'border', 'accent', 'playerBubble', 'playerBubbleText', 'npcBubble', 'npcBubbleText']) {
        expect(t?.[k]).toBeTruthy();
      }
    }
  });

  test('激活珊瑚(全量显式 theme) → token 取显式覆盖值', () => {
    game.mutations.setFlag('momotalk_pink_unlocked', '1');
    game.mutations.activateTheme('base:color:coral');
    const t = game.colorSystem.activeThemeTokens(game.state);
    expect(t?.['bg']).toBe('#fff3ee');
    expect(t?.['primary']).toBe('#ff7a59');
  });
});
