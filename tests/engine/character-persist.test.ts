// ============================================================
// engine/character-persist.test.ts — Character 容器三层归属（PS 组）
// ============================================================
import { describe, test, expect } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import type { Datapack, PlayerState } from '../../src/engine/types';
import { Character, CharacterRarity, CharacterSchool } from '../../src/engine/types';

function makeDatapack(persist: Datapack['characterPersistConfig']): Datapack {
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
      {
        id: 'Hoshino',
        proto: Character.Hoshino,
        name: '星野',
        displayName: '小鸟游星野',
        school: CharacterSchool.Abydos,
        rarity: CharacterRarity.Rare,
        description: '',
      },
    ],
    characterPersistConfig: persist,
  };
}

function seededState(game: GameInstance): PlayerState {
  const state = (game as any)._state as PlayerState;
  game.mutations.acquireCharacter('Hoshino', 'gacha');
  game.mutations.markChatRead('msg-1');
  return state;
}

describe('characterScopeOf 缺省值（PS-01）', () => {
  test('未配置：roster/gacha/equips=global，chatRead=init', () => {
    const game = new GameInstance();
    game.init([makeDatapack(undefined)]);
    expect(game.registry.characterScopeOf('roster')).toBe('global');
    expect(game.registry.characterScopeOf('gacha')).toBe('global');
    expect(game.registry.characterScopeOf('equips')).toBe('global');
    expect(game.registry.characterScopeOf('chatRead')).toBe('init');
  });
});

describe('快照归属行为（PS-02 ~ PS-04）', () => {
  test('默认（roster=global, chatRead=init）：软重启 roster 保留、chatRead 清空且不进快照', () => {
    const game = new GameInstance();
    game.init([makeDatapack(undefined)]);
    const savepoint = (game.initService as any).savepoint;
    const state = seededState(game);

    savepoint.save('init-a');
    expect(state.initSnapshots!['init-a'].roster).toBeUndefined();
    expect(state.initSnapshots!['init-a'].chatRead).toEqual({ 'msg-1': true });

    savepoint.clear();
    expect(state.roster!['Hoshino']).toBeDefined(); // global 保留
    expect(state.chatRead ?? {}).toEqual({}); // init 重置

    // 模拟另一世界线写入后 restore
    state.chatRead = { 'other': true };
    savepoint.restore(state.initSnapshots!['init-a']);
    expect(state.roster!['Hoshino']).toBeDefined(); // restore 不覆盖 global 块
    expect(state.chatRead).toEqual({ 'msg-1': true }); // init 块从快照恢复
  });

  test('声明 roster=init / chatRead=global：行为按声明翻转', () => {
    const game = new GameInstance();
    game.init([makeDatapack({ roster: 'init', chatRead: 'global' })]);
    const savepoint = (game.initService as any).savepoint;
    const state = seededState(game);

    savepoint.save('init-a');
    expect(state.initSnapshots!['init-a'].roster).toBeDefined(); // init 块进快照
    expect(state.initSnapshots!['init-a'].chatRead).toBeUndefined(); // global 块不进快照

    savepoint.clear();
    expect(state.roster ?? {}).toEqual({}); // init 块重置
    expect(state.fragments ?? {}).toEqual({});
    expect(state.chatRead!['msg-1']).toBe(true); // global 保留

    savepoint.restore(state.initSnapshots!['init-a']);
    expect(state.roster!['Hoshino']).toBeDefined(); // 从快照恢复
    expect(state.chatRead).toEqual({ 'msg-1': true }); // global 以当前值为准
  });

  test('PS-06 gacha=global 时软重启保留 pity 计数', () => {
    const game = new GameInstance();
    game.init([makeDatapack(undefined)]);
    const savepoint = (game.initService as any).savepoint;
    const state = (game as any)._state as PlayerState;
    state.gachaState = { 'pool-1': { pity: 7, pulls: 9 } };

    savepoint.clear();
    expect(state.gachaState!['pool-1']).toEqual({ pity: 7, pulls: 9 });
  });

  test('PS-04 快照往返内容一致', () => {
    const game = new GameInstance();
    game.init([makeDatapack({ roster: 'init' })]);
    const savepoint = (game.initService as any).savepoint;
    const state = seededState(game);

    savepoint.save('init-a');
    const snap = state.initSnapshots!['init-a'];
    expect(snap.roster).toEqual(state.roster);
    expect(snap.fragments).toEqual(state.fragments);
    expect(snap.chatRead).toEqual(state.chatRead);
  });
});

describe('非法归属配置 fail-fast（PS-05）', () => {
  test('characterPersistConfig 含非法值 → RegistryError', () => {
    const game = new GameInstance();
    expect(() =>
      game.init([makeDatapack({ roster: 'foo' as any })]),
    ).toThrow(/characterPersistConfig\.roster/);
  });
});
