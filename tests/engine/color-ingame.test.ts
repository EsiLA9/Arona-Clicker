import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';

const OFFICE = 'base:init:office';

function freshGame(): GameInstance {
  const g = new GameInstance();
  g.init([baseDatapack]);
  g.inits.startNewGame(OFFICE);
  return g;
}

describe('色彩组在测试游戏(baseDatapack)内的解锁与激活链路', () => {
  let game: GameInstance;
  beforeEach(() => { game = freshGame(); });

  test('启动后色彩组库存为空（条件均未满足）', () => {
    expect(game.state.groupsOwned?.length ?? 0).toBe(0);
  });

  test('获得星野 → 自动解锁 hoshino 系全部色彩组(含泳装/墨蓝/黄沙)', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    for (const id of ['base:group:abydos-sand', 'base:group:hoshino-swim', 'base:group:ink']) {
      expect(game.colorSystem.isGroupOwned(game.state, id)).toBe(true);
    }
  });

  test('获得不同学生各自解锁对应色彩组', () => {
    game.mutations.acquireCharacter('Shiroko', 'gacha');
    expect(game.colorSystem.isGroupOwned(game.state, 'base:group:rose')).toBe(true);
    game.mutations.acquireCharacter('Serika', 'gacha');
    expect(game.colorSystem.isGroupOwned(game.state, 'base:group:emerald')).toBe(true);
    game.mutations.acquireCharacter('Yuuka', 'gacha');
    expect(game.colorSystem.isGroupOwned(game.state, 'base:group:violet')).toBe(true);
    game.mutations.acquireCharacter('Mika', 'gacha');
    expect(game.colorSystem.isGroupOwned(game.state, 'base:group:amber')).toBe(true);
    game.mutations.acquireCharacter('Iori', 'gacha');
    expect(game.colorSystem.isGroupOwned(game.state, 'base:group:crimson')).toBe(true);
    game.mutations.acquireCharacter('Miyako', 'gacha');
    expect(game.colorSystem.isGroupOwned(game.state, 'base:group:teal')).toBe(true);
    game.mutations.acquireCharacter('Saori', 'gacha');
    expect(game.colorSystem.isGroupOwned(game.state, 'base:group:indigo')).toBe(true);
    game.mutations.acquireCharacter('Arona', 'gacha');
    expect(game.colorSystem.isGroupOwned(game.state, 'base:group:schale-solid')).toBe(true);
    expect(game.colorSystem.isGroupOwned(game.state, 'base:group:sky')).toBe(true);
  });

  test('完成欢迎剧情(flag)解锁 flag 系色彩组(粉/青柠/珊瑚)', () => {
    game.mutations.setFlag('momotalk_pink_unlocked', '1');
    for (const id of ['base:group:momotalk-pink', 'base:group:lime', 'base:group:coral']) {
      expect(game.colorSystem.isGroupOwned(game.state, id)).toBe(true);
    }
  });

  test('已拥有的色彩组均能通过 activeThemeTokens 生成完整 7-token', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    const all = game.colorSystem.ownedGroups(game.state);
    expect(all.length).toBeGreaterThanOrEqual(3);
    for (const g of all) {
      game.mutations.activateTheme(g.id);
      const t = game.colorSystem.activeThemeTokens(game.state);
      expect(t).toBeTruthy();
      for (const k of ['primary', 'bg', 'bgAlt', 'text', 'textDim', 'border', 'accent', 'playerBubble', 'playerBubbleText', 'npcBubble', 'npcBubbleText']) {
        expect(t?.[k]).toBeTruthy();
      }
    }
  });

  test('激活珊瑚(全量显式 theme) → token 取显式覆盖值', () => {
    game.mutations.setFlag('momotalk_pink_unlocked', '1');
    game.mutations.activateTheme('base:group:coral');
    const t = game.colorSystem.activeThemeTokens(game.state);
    expect(t?.['bg']).toBe('#fff3ee');
    expect(t?.['primary']).toBe('#ff7a59');
  });
});