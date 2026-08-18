// ============================================================
// engine/character-system.test.ts
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { CharacterSystem } from './character-system';
import {
  Character,
  CharacterData,
  CharacterRarity,
  CharacterSchool,
  CharacterBonusTable,
  PlayerState,
} from './types';
import { tagPath } from './tag';

/** 精简测试用角色数据 */
const testCharacters: CharacterData[] = [
  {
    id: Character.Shiroko,
    name: '白子',
    displayName: '砂狼白子',
    school: CharacterSchool.Abydos,
    rarity: CharacterRarity.SuperRare,
    description: '测试描述',
    spotTagBonus: { 'field': 1.4, 'combat': 1.2 },
    passiveDescription: '野外+40%, 战斗+20%',
  },
  {
    id: Character.Yuuka,
    name: '优香',
    displayName: '早濑优香',
    school: CharacterSchool.Millennium,
    rarity: CharacterRarity.Rare,
    description: '测试描述',
    spotTagBonus: { 'credit': 1.5, 'math': 1.3 },
    passiveDescription: '信用点+50%, 数学+30%',
  },
  {
    id: Character.Miyu,
    name: '美游',
    displayName: '霞沢美游',
    school: CharacterSchool.SRT,
    rarity: CharacterRarity.Common,
    description: '测试描述',
    spotTagBonus: { 'sniper': 1.5, 'stealth': 1.3 },
    passiveDescription: '狙击+50%, 隐匿+30%',
  },
  {
    id: Character.Saki,
    name: '咲',
    displayName: '風倉咲',
    school: CharacterSchool.SRT,
    rarity: CharacterRarity.Common,
    description: '测试描述',
    spotTagBonus: { 'demolition': 1.4, 'energy': 1.2 },
    passiveDescription: '爆破+40%, 活力+20%',
  },
];

const testBonuses: CharacterBonusTable[] = [
  { characterId: Character.Shiroko, spotId: 'spot_field', multiplier: 1.4 },
  { characterId: Character.Yuuka, spotId: 'spot_bank', multiplier: 1.5 },
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

describe('CharacterSystem', () => {
  let cs: CharacterSystem;

  beforeEach(() => {
    cs = new CharacterSystem();
    cs.load(testCharacters);
    cs.loadBonuses(testBonuses);
  });

  // --- 基础查询 ---
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
    expect(cs.getAll()).toHaveLength(4);
  });

  // --- 筛选 ---
  test('should filter by school', () => {
    const srt = cs.getBySchool(CharacterSchool.SRT);
    expect(srt).toHaveLength(2);
    expect(srt.map(c => c.id)).toContain(Character.Miyu);
    expect(srt.map(c => c.id)).toContain(Character.Saki);
  });

  test('should filter by rarity', () => {
    const commons = cs.getByRarity(CharacterRarity.Common);
    expect(commons).toHaveLength(2);
    const rare = cs.getByRarity(CharacterRarity.Rare);
    expect(rare).toHaveLength(1);
    const sr = cs.getByRarity(CharacterRarity.SuperRare);
    expect(sr).toHaveLength(1);
  });

  test('should return empty for non-matching school', () => {
    expect(cs.getBySchool(CharacterSchool.Gehenna)).toHaveLength(0);
  });

  // --- 标签加成 ---
  test('should return tag bonus for matching tag', () => {
    expect(cs.getTagBonus(Character.Shiroko, tagPath('field'))).toBe(1.4);
    expect(cs.getTagBonus(Character.Shiroko, tagPath('combat'))).toBe(1.2);
  });

  test('should return 1.0 for non-matching tag', () => {
    expect(cs.getTagBonus(Character.Shiroko, tagPath('credit'))).toBe(1.0);
    expect(cs.getTagBonus(Character.Shiroko, tagPath('unknown'))).toBe(1.0);
  });

  test('should return 1.0 for unknown character', () => {
    expect(cs.getTagBonus('fake' as Character, tagPath('field'))).toBe(1.0);
  });

  test('should apply prefix matching: child tag hits parent bonus', () => {
    expect(cs.getTagBonus(Character.Shiroko, tagPath('field', 'combat'))).toBe(1.4);
    expect(cs.getTagBonus(Character.Shiroko, tagPath('sniper', 'field'))).toBe(1.0);
  });

  // --- 角色加成表 ---
  test('should get spot-specific bonus from bonus table', () => {
    expect(cs.getBonus('spot_field', Character.Shiroko)).toBe(1.4);
    expect(cs.getBonus('spot_bank', Character.Yuuka)).toBe(1.5);
  });

  test('should return 1.0 for unbonused spot', () => {
    expect(cs.getBonus('spot_unknown', Character.Shiroko)).toBe(1.0);
    expect(cs.getBonus('spot_field', Character.Yuuka)).toBe(1.0);
  });

  test('should handle empty bonus table', () => {
    const empty = new CharacterSystem();
    expect(empty.getBonus('spot_x', Character.Shiroko)).toBe(1.0);
    expect(empty.getTagBonus(Character.Shiroko, tagPath('field'))).toBe(1.0);
  });

  // --- 解锁与可分配查询 ---
  test('should detect assigned characters as unlocked', () => {
    const state = emptyState({
      spotManagers: { spot_a: Character.Shiroko },
    });
    const unlocked = cs.getUnlocked(state);
    expect(unlocked.map(c => c.id)).toContain(Character.Shiroko);
  });

  test('should detect flag-unlocked characters', () => {
    const state = emptyState({
      flags: { char_unlock_yuuka: 'true' },
    });
    const unlocked = cs.getUnlocked(state);
    expect(unlocked.map(c => c.id)).toContain(Character.Yuuka);
  });

  test('should get assignable characters (unlocked but not assigned)', () => {
    const state = emptyState({
      spotManagers: { spot_a: Character.Shiroko },
      flags: { char_unlock_yuuka: 'true', char_unlock_miyu: 'true' },
    });
    const assignable = cs.getAssignable(state);
    // Shiroko is already assigned and should NOT be assignable
    expect(assignable.map(c => c.id)).not.toContain(Character.Shiroko);
    // Yuuka and Miyu are unlocked but not assigned → should be assignable
    expect(assignable.map(c => c.id)).toContain(Character.Yuuka);
    expect(assignable.map(c => c.id)).toContain(Character.Miyu);
  });

  test('should not count None character as unlocked', () => {
    const state = emptyState({
      spotManagers: { spot_a: Character.None },
    });
    expect(cs.getUnlocked(state)).toHaveLength(0);
  });

  // --- 同校计数 ---
  test('should count school members', () => {
    const state = emptyState({
      spotManagers: { spot_a: Character.Miyu },
      flags: { char_unlock_saki: 'true' },
    });
    expect(cs.countSchoolMembers(CharacterSchool.SRT, state)).toBe(2);
    expect(cs.countSchoolMembers(CharacterSchool.Abydos, state)).toBe(0);
  });

  // --- 数据加载 ---
  test('should clear all data', () => {
    cs.clear();
    expect(cs.getAll()).toHaveLength(0);
    expect(cs.get(Character.Shiroko)).toBeUndefined();
    expect(cs.getBonus('spot_field', Character.Shiroko)).toBe(1.0);
  });
});
