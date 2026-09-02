// ============================================================
// data-services/contracts/character-data.ts — 数据包角色记录
// ============================================================

import type { TagPath } from '../../engine/core/tag';
import type { Character, CharacterRarity, CharacterSchool } from '../../engine/types/ids';
import type { ExtraCompound } from '../../engine/types/extra';

export interface CharacterData {
  /** @label ID */
  id: Character;
  /** @label 名称 */
  name: string;
  /** @label 显示名 */
  displayName: string;
  /** @label 学校 */
  school: CharacterSchool;
  /** @label 稀有度 */
  rarity: CharacterRarity;
  /** @label 描述 */
  description: string;
  /** 对特定标签 Spot 的产出加成倍率 (1.0 = 无加成)。 @label 标签产出加成 */
  spotTagBonus: Record<string, number>;
  /** @label 被动描述 */
  passiveDescription: string;
  /** @label 标签 */
  tags?: TagPath[];
  /** Extra 附加数据。 */
  extra?: ExtraCompound;
}
