// ============================================================
// engine/character-system.ts — 角色辅助系统
// ============================================================

import {
  Character,
  CharacterData,
  CharacterRarity,
  CharacterSchool,
  CharacterBonusTable,
  PlayerState,
} from './types';
import { TagPath, matchesTag } from './tag';

export class CharacterSystem {
  private characters: Map<Character, CharacterData> = new Map();
  private bonuses: Map<string, Map<Character, number>> = new Map(); // spotId → characterId → multiplier

  /** 从数据包加载角色数据 */
  load(characters: CharacterData[]): void {
    for (const ch of characters) {
      this.characters.set(ch.id, ch);
    }
  }

  /** 加载角色加成表 */
  loadBonuses(bonuses: CharacterBonusTable[]): void {
    for (const b of bonuses) {
      if (!this.bonuses.has(b.spotId)) {
        this.bonuses.set(b.spotId, new Map());
      }
      this.bonuses.get(b.spotId)!.set(b.characterId, b.multiplier);
    }
  }

  /** 获取角色数据 */
  get(id: Character): CharacterData | undefined {
    return this.characters.get(id);
  }

  /** 获取所有角色列表 */
  getAll(): CharacterData[] {
    return [...this.characters.values()];
  }

  /** 按学校筛选角色 */
  getBySchool(school: CharacterSchool): CharacterData[] {
    return this.getAll().filter(ch => ch.school === school);
  }

  /** 按稀有度筛选 */
  getByRarity(rarity: CharacterRarity): CharacterData[] {
    return this.getAll().filter(ch => ch.rarity === rarity);
  }

  /** 获取已解锁角色 (在 state.unlockedInits 中标记或通过 spotManagers 分配) */
  getUnlocked(state: PlayerState): CharacterData[] {
    const result: CharacterData[] = [];
    for (const ch of this.characters.values()) {
      if (ch.id === Character.None) continue;
      // 被分配到 Spot 的角色视为已解锁
      const assigned = Object.values(state.spotManagers).some(m => m === ch.id);
      // 通过 flag 标记解锁
      const flagged = state.flags[`char_unlock_${ch.id}`] === 'true';
      if (assigned || flagged) {
        result.push(ch);
      }
    }
    return result;
  }

  /** 获取可分配的角色列表 (已解锁但未分配) */
  getAssignable(state: PlayerState): CharacterData[] {
    const assigned = new Set(Object.values(state.spotManagers));
    return this.getUnlocked(state).filter(ch => !assigned.has(ch.id));
  }

  /** 获取某个 Spot 的角色加成倍率 */
  getBonus(spotId: string, characterId: Character): number {
    const spotBonuses = this.bonuses.get(spotId);
    if (!spotBonuses) return 1.0;
    return spotBonuses.get(characterId) ?? 1.0;
  }

  /**
   * 获取某个角色对给定 Spot 标签的加成（层级匹配）。
   * 角色 spotTagBonus 的 key 是查询标签；声明标签（含其 child）命中同前缀的 key。
   */
  getTagBonus(characterId: Character, tag: TagPath): number {
    const ch = this.characters.get(characterId);
    if (!ch) return 1.0;
    let bonus = 1.0;
    for (const [key, value] of Object.entries(ch.spotTagBonus)) {
      if (matchesTag(tag, [key])) bonus *= value;
    }
    return bonus;
  }

  /** 检查角色是否存在 */
  exists(id: Character): boolean {
    return this.characters.has(id);
  }

  /** 清空所有数据 */
  clear(): void {
    this.characters.clear();
    this.bonuses.clear();
  }

  /** 获取角色对应学校的已解锁同校数量 */
  countSchoolMembers(school: CharacterSchool, state: PlayerState): number {
    return this.getUnlocked(state).filter(ch => ch.school === school).length;
  }
}
