// ============================================================
// data-services/contracts/common.ts — Datapack 通用声明
// ============================================================

import type { Character } from '../../engine/types/ids';

export type { ResourceAmount } from '../../engine/contracts/resource';

export interface ResourceDisplayDef {
  /** @label 资源 ID */
  resourceId: string;
  /** @label 标签 */
  label: string;
  /** @label 详情标签 */
  detailLabel?: string;
  /** @label 显示条件 @enum always=常显 @enum hasAmount=仅持有量>0 显示 */
  showWhen?: 'always' | 'hasAmount';
  /** @label 排序 */
  order?: number;
}

export interface TagDef {
  /** @label 路径 */
  id: string;
  /** @label 名称 */
  name: string;
  /** @label 简介 */
  description?: string;
}

export interface CharacterBonusTable {
  /** @label 角色 */
  characterId: Character;
  /** @label 设施 */
  spotId: string;
  /** @label 倍率 */
  multiplier: number;
}
