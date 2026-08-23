// ============================================================
// engine/character-system.test.ts — 原型元数据查询 + roster 解锁语义（F-04）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { CharacterSystem } from '../../src/engine/character-system';
import {
  Character,
  CharacterData,
  CharacterRarity,
  CharacterSchool,
  PlayerState,
} from '../../src/engine/types';

/** 精简测试用角色数据 */
const testCharacters: CharacterData[] = [
  {
    id: Character.Shiroko,
    name: '白子',
    displayName: '砂狼白子',
    school: CharacterSchool.Abydos,
    rarity: CharacterRarity.SuperRare,
    description: '测试描述',
    spotTagBonus: { 'field': 1.4 },
    passiveDescription: '',
  },
  {
    id: Character.Yuuka,
    name: '优香',
    displayName: '早濑优香',
    school: CharacterSchool.Millennium,
    rarity: CharacterRarity.Rare,
    description: '测试描述',
    spotTagBonus: {},
    passiveDescription: '',
  },
  {
    id: Character.Miyu,
    name: '美游',
    displayName: '霞沢美游',
    school: CharacterSchool.SRT,
    rarity: CharacterRarity.Common,
    description: '测试描述',
    spotTagBonus: {},
    passiveDescription: '',
  },
];

function emptyState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    resources: {},
    spotLevels: {},
    spotManagers: {},
    unlockedEnhancements: [],
    activeInit: '',
    totalFrames: 0,
    storyLog: [],
    inventory: {},
    flags: {},
    unlockedInits: [],
    ...overrides,
  };
}

/** 差分 → 原型解析桩（模拟 registry 视图）。 */
const variantProto: Record<string, Character> = {
  Shiroko: Character.Shiroko,
  HoshinoSwimsuit: Character.Hoshino,
};

describe('CharacterSystem（原型元数据）', () => {
  let cs: CharacterSystem;

  beforeEach(() => {
    cs = new CharacterSystem();
    cs.load(testCharacters);
    cs.setVariantProtoResolver(id => variantProto[id]);
  });

  test('should load and retrieve character data', () => {
    const shiroko = cs.get(Character.Shiroko);
    expect(shiroko).toBeDefined();
    expect(shiroko!.name).toBe('白子');
    expect(shiroko!.school).toBe(CharacterSchool.Abydos);
    expect(shiroko!.rarity).toBe(CharacterRarity.SuperRare);
  });

  test('should return undefined for unknown character', () => {
    expect(cs.get(Character.None)).toBeUndefined();
  });

  test('should check character existence', () => {
    expect(cs.exists(Character.Shiroko)).toBe(true);
    expect(cs.exists(Character.None)).toBe(false);
    expect(cs.exists('fake_char' as Character)).toBe(false);
  });

  test('should get all characters', () => {
    expect(cs.getAll()).toHaveLength(3);
  });

  test('should filter by school', () => {
    expect(cs.getBySchool(CharacterSchool.SRT).map(c => c.id)).toEqual([Character.Miyu]);
    expect(cs.getBySchool(CharacterSchool.Gehenna)).toHaveLength(0);
  });

  test('should filter by rarity', () => {
    expect(cs.getByRarity(CharacterRarity.Common)).toHaveLength(1);
    expect(cs.getByRarity(CharacterRarity.SuperRare)).toHaveLength(1);
  });

  test('should clear all data', () => {
    cs.clear();
    expect(cs.getAll()).toHaveLength(0);
    expect(cs.get(Character.Shiroko)).toBeUndefined();
  });
});

describe('CharacterSystem 解锁（F-04：roster 单一真相来源）', () => {
  let cs: CharacterSystem;

  beforeEach(() => {
    cs = new CharacterSystem();
    cs.load(testCharacters);
    cs.setVariantProtoResolver(id => variantProto[id]);
  });

  test('拥有任一差分即解锁其原型', () => {
    const state = emptyState({
      roster: { Shiroko: { variantId: 'Shiroko' } as never },
    });
    expect(cs.getUnlocked(state).map(c => c.id)).toContain(Character.Shiroko);
    expect(cs.getUnlocked(state)).toHaveLength(1);
  });

  test('同原型的差分共享解锁', () => {
    const state = emptyState({
      roster: { HoshinoSwimsuit: { variantId: 'HoshinoSwimsuit' } as never },
    });
    // 测试表未定义 Hoshino 原型 → 不出现；仅验证不抛错
    expect(cs.getUnlocked(state)).toHaveLength(0);
  });

  test('旧 flag / manager 分配协议不再触发解锁（冻结）', () => {
    const state = emptyState({
      flags: { char_unlock_yuuka: 'true' },
      spotManagers: { s1: Character.Miyu },
    });
    expect(cs.getUnlocked(state)).toHaveLength(0);
  });

  test('countSchoolMembers 按 roster 统计', () => {
    const state = emptyState({
      roster: { Shiroko: { variantId: 'Shiroko' } as never },
    });
    expect(cs.countSchoolMembers(CharacterSchool.Abydos, state)).toBe(1);
    expect(cs.countSchoolMembers(CharacterSchool.SRT, state)).toBe(0);
  });

  test('None 永不解锁', () => {
    const state = emptyState({
      roster: { none: { variantId: 'none' } as never },
    });
    expect(cs.getUnlocked(state)).toHaveLength(0);
  });
});
