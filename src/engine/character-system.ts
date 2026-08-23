// ============================================================
// engine/character-system.ts — 角色原型元数据查询
//
// Character 重构后本系统只负责原型表（CharacterData）的加载与筛选。
// 解锁判定以 roster 为单一真相来源（拥有任一差分即解锁其原型）；
// 旧 flag / manager 分配协议已冻结（docs-818/12-character-rework.md §4.4）。
// 持有实例/碎片/培养见 roster-system 与 cultivate-system。
// ============================================================

import {
  Character,
  CharacterData,
  CharacterRarity,
  CharacterSchool,
  PlayerState,
} from './types';

export class CharacterSystem {
  private characters: Map<Character, CharacterData> = new Map();
  /** 差分 id → 原型 id 解析器（GameInstance 注入 registry 视图）。 */
  private variantProto?: (variantId: string) => Character | undefined;

  setVariantProtoResolver(fn: (variantId: string) => Character | undefined): void {
    this.variantProto = fn;
  }

  /** 从数据包加载角色数据 */
  load(characters: CharacterData[]): void {
    for (const ch of characters) {
      this.characters.set(ch.id, ch);
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

  /**
   * 获取已解锁角色（roster 单一真相来源）：
   * 玩家拥有该原型的任一差分即视为解锁。
   */
  getUnlocked(state: PlayerState): CharacterData[] {
    const ownedProtos = new Set<Character>();
    for (const variantId of Object.keys(state.roster ?? {})) {
      const proto = this.variantProto?.(variantId);
      if (proto !== undefined) ownedProtos.add(proto);
    }
    const result: CharacterData[] = [];
    for (const ch of this.characters.values()) {
      if (ch.id === Character.None) continue;
      if (ownedProtos.has(ch.id)) result.push(ch);
    }
    return result;
  }

  /** 检查角色是否存在 */
  exists(id: Character): boolean {
    return this.characters.has(id);
  }

  /** 清空所有数据 */
  clear(): void {
    this.characters.clear();
  }

  /** 获取角色对应学校的已解锁同校数量 */
  countSchoolMembers(school: CharacterSchool, state: PlayerState): number {
    return this.getUnlocked(state).filter(ch => ch.school === school).length;
  }
}
