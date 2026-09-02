import { Character } from '../types/ids';
import type { CharacterData } from '../types/character';
import type { PlayerState } from '../types/state';
import type { CharacterRarity, CharacterSchool } from '../types/ids';

/** AronaClicker 角色原型元数据与 roster 解锁查询服务。 */
export class CharacterSystem {
  private characters: Map<Character, CharacterData> = new Map();
  private variantProto?: (variantId: string) => Character | undefined;

  setVariantProtoResolver(fn: (variantId: string) => Character | undefined): void { this.variantProto = fn; }
  load(characters: CharacterData[]): void { for (const ch of characters) this.characters.set(ch.id, ch); }
  get(id: Character): CharacterData | undefined { return this.characters.get(id); }
  getAll(): CharacterData[] { return [...this.characters.values()]; }
  getBySchool(school: CharacterSchool): CharacterData[] { return this.getAll().filter(ch => ch.school === school); }
  getByRarity(rarity: CharacterRarity): CharacterData[] { return this.getAll().filter(ch => ch.rarity === rarity); }
  getUnlocked(state: PlayerState): CharacterData[] {
    const ownedProtos = new Set<Character>();
    for (const variantId of Object.keys(state.roster ?? {})) {
      const proto = this.variantProto?.(variantId);
      if (proto !== undefined) ownedProtos.add(proto);
    }
    return [...this.characters.values()].filter(ch => ch.id !== Character.None && ownedProtos.has(ch.id));
  }
  exists(id: Character): boolean { return this.characters.has(id); }
  clear(): void { this.characters.clear(); }
  countSchoolMembers(school: CharacterSchool, state: PlayerState): number {
    return this.getUnlocked(state).filter(ch => ch.school === school).length;
  }
}
