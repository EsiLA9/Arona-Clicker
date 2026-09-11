// ============================================================
// data-services/contracts/character-variant.ts — 数据包角色变体记录
// ============================================================

import type { Character, CharacterRarity, CharacterSchool } from '../../engine/types/ids';
import type { ExtraCompound } from '../../engine/types/extra';
import type { VariantId, ColorGroupId, CultivateCurveId } from '../../engine/types/character';
import type { ThemeDef } from '../../engine/types/theme';
import type { VariantProgressionDef } from './character-progression-def';

export interface CharacterVariantDef {
  /** @label ID */
  id: VariantId;
  /** @label 原型 @ref characters */
  proto: Character;
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
  /** @label 头像 */
  avatar?: string;
  /** @label 默认头像色组 @ref colorGroups */
  colorGroupId?: ColorGroupId;
  /** @label 默认差分 */
  isDefault?: boolean;
  /** @label 培养曲线 @ref cultivateCurves */
  curve?: CultivateCurveId;
  /** @label 对话主题 */
  theme?: ThemeDef;
  /** @label 好感星级锁 @int */
  affectionLevelCapByStar?: number[];
  /** @label 养成声明 */
  progression?: VariantProgressionDef;
  /** Extra 附加数据。 */
  extra?: ExtraCompound;
}
