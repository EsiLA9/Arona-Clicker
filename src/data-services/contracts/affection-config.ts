// ============================================================
// data-services/contracts/affection-config.ts — 数据包好感配置
// ============================================================

export interface AffectionConfigDef {
  /** @label 升级阶梯 */
  expCurve?: number[];
  /** @label 等值需求 @int */
  expBeyond?: number;
  /** @label 等级上限 @int */
  maxLevel?: number;
  /** @label 星级锁默认表 */
  defaultLevelCapByStar?: number[];
}
