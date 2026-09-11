// ============================================================
// data-services/contracts/character-data.ts — 数据包角色记录
// ============================================================

import type { TagPath } from '../../engine/core/tag';
import type { Character, CharacterRarity, CharacterSchool } from '../../engine/types/ids';
import type { ExtraCompound } from '../../engine/types/extra';
import type { CharacterBondDef } from './character-progression-def';

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
  /** @label 标签 */
  tags?: TagPath[];
  /** @label 羁绊里程碑 */
  bond?: CharacterBondDef;
  /** Extra 附加数据。 */
  extra?: ExtraCompound;
}
