// ============================================================
// engine/character-profile.test.ts — Chara 头像-人名对（charaProfile）
// 覆盖：声明层 / 玩家覆写层 / 调用点覆写层 / 表查询 / 校验
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import { Character } from '../../src/engine/types/ids';
import { Registry } from '../../src/engine/registry/registry';
import { RegistryError } from '../../src/engine/registry/registry-validate';
import type { Datapack } from '../../src/engine/types';

describe('characterProfile（chara 声明层）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
  });

  test('base 数据包：Hoshino 取声明 name 表 + 解析后的头像 URL', () => {
    const p = game.charaProfiles.characterProfile(Character.Hoshino);
    expect(p.character).toBe(Character.Hoshino);
    expect(p.name).toBe('小鸟游星野');
    expect(p.nameId).toBe('default');
    expect(p.nameFrom).toBe('declared');
    expect(p.avatar).toBeTruthy(); // 已解析 URL
    expect(p.avatarId).toBe('default');
    expect(p.avatarFrom).toBe('declared');
  });

  test('未声明 profile 的角色回退原型表 / 兜底', () => {
    const p = game.charaProfiles.characterProfile(Character.Shiroko);
    expect(p.name).toBeTruthy(); // CharacterData.displayName 或 id 串
    expect(p.nameFrom).toBe('proto');
    expect(p.avatar).toBeUndefined();
    expect(p.avatarFrom).toBe('none');
  });

  test('charaNames / charaAvatars 暴露表', () => {
    expect(game.charaProfiles.charaNames(Character.Hoshino).map(n => n.id)).toEqual(['default', 'nickname']);
    expect(game.charaProfiles.charaAvatars(Character.Hoshino).map(a => a.id)).toEqual(['default']);
    expect(game.charaProfiles.charaNames(Character.Shiroko)).toEqual([]);
  });
});

describe('characterProfile（玩家覆写层）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
  });

  test('setCharaProfile 表内选 nameId/avatarId → player 层', () => {
    game.charaProfiles.setCharaProfile(Character.Hoshino, { nameId: 'nickname', avatarId: 'default' });
    const p = game.charaProfiles.characterProfile(Character.Hoshino);
    expect(p.name).toBe('星野酱');
    expect(p.nameId).toBe('nickname');
    expect(p.nameFrom).toBe('player');
    expect(p.avatarFrom).toBe('player');
    // 存档持久化
    expect(game.state.charaCustom?.[Character.Hoshino]).toEqual({ nameId: 'nickname', avatarId: 'default' });
  });

  test('setCharaProfile 完全自定义 name/avatar → 优先于表', () => {
    game.charaProfiles.setCharaProfile(Character.Hoshino, { name: '自定义星野' });
    const p = game.charaProfiles.characterProfile(Character.Hoshino);
    expect(p.name).toBe('自定义星野');
    expect(p.nameFrom).toBe('player');
  });

  test('clearCharaProfile 回到声明层', () => {
    game.charaProfiles.setCharaProfile(Character.Hoshino, { nameId: 'nickname' });
    expect(game.charaProfiles.characterProfile(Character.Hoshino).name).toBe('星野酱');
    game.charaProfiles.clearCharaProfile(Character.Hoshino);
    expect(game.charaProfiles.characterProfile(Character.Hoshino).name).toBe('小鸟游星野');
    expect(game.state.charaCustom?.[Character.Hoshino]).toBeUndefined();
  });
});

describe('characterProfile（调用点覆写层）', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
  });

  test('overrides 优先于 player 与 declared，且不落盘', () => {
    game.charaProfiles.setCharaProfile(Character.Hoshino, { nameId: 'nickname' });
    const p = game.charaProfiles.characterProfile(Character.Hoshino, { name: '本次临时名' });
    expect(p.name).toBe('本次临时名');
    expect(p.nameFrom).toBe('override');
    // 未落盘
    expect(game.charaProfiles.characterProfile(Character.Hoshino).name).toBe('星野酱');
  });

  test('overrides.avatar 经 PicDef 解析', () => {
    const p = game.charaProfiles.characterProfile(Character.Hoshino, { avatar: 'base:sticker(pic):hoshino_selfie' });
    expect(p.avatarFrom).toBe('override');
    expect(p.avatar).toBeTruthy();
  });
});

describe('Registry charaProfiles 校验', () => {
  const empty = (): Datapack => ({
    name: 't', version: '1.0.0',
    inits: [], areas: [], spots: [], enhancements: [],
    activeStories: [], passiveStories: [], stories: [], items: [],
    funcletDefs: [], characters: [], characterBonuses: [],
  });

  test('name 表为空 → RegistryError', () => {
    const reg = new Registry();
    expect(() => reg.load({ ...empty(), charaProfiles: [{ id: Character.Hoshino, names: [], avatars: [] }] }))
      .toThrow(RegistryError);
  });

  test('activeName 不在表 → RegistryError', () => {
    const reg = new Registry();
    expect(() => reg.load({
      ...empty(),
      charaProfiles: [{
        id: Character.Hoshino,
        names: [{ id: 'default', text: '星野' }],
        avatars: [],
        activeName: 'nope',
      }],
    })).toThrow(/activeName/);
  });

  test('avatar 持有裸 URL（非 PicId）→ RegistryError', () => {
    const reg = new Registry();
    expect(() => reg.load({
      ...empty(),
      charaProfiles: [{
        id: Character.Hoshino,
        names: [{ id: 'default', text: '星野' }],
        avatars: [{ id: 'default', pic: 'https://example.com/x.png' }],
      }],
    })).toThrow(/PicId/);
  });
});