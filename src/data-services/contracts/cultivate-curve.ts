// ============================================================
// data-services/contracts/cultivate-curve.ts — 数据包培养曲线记录
// ============================================================

import type { ValueExpression } from '../../engine/types/expression';
import type { CultivateCurveId } from '../../engine/types/character';

export interface CultivateCurveDef {
  /** @label ID */
  id: CultivateCurveId;
  /** @label 等级上限 @int */
  maxLevel: number;
  /** @label 经验表 */
  expTable?: number[];
  /** @label 星级上限 @int */
  starMax?: number;
  /** @label 突破消耗 */
  starCost?: number[];
  /** @label 每星上限 @int */
  levelCapPerStar?: number;
  /** @label 每级加成 */
  levelBonusPerLevel?: ValueExpression;
}
