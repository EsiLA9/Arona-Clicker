// ============================================================
// arona-clicker/contracts/gear-query.ts — 装备（Gear）只读查询面
//
// UI 只消费本端口产出的 GearSlotView / effectsOf，不持有写引用。
// 装备写入一律经 StateMutationService（equipGear / feedGearExp / upgradeGearTier）。
// ============================================================

import type { Effect } from '../../engine/types/expression';
import type { GearDef, GearSlotKind, GearTierDef } from '../../data-services/contracts/character-progression-def';
import type { GearId, VariantId } from '../types/character';
import type { PlayerState } from '../types/state';

/** 装备操作被拒绝的原因（UI 文案映射用）。 */
export type GearActionReason =
  | 'no-entry'
  | 'no-slot'
  | 'no-tier'
  | 'already-equipped'
  | 'not-equipped'
  | 'max-level'
  | 'not-max-level'
  | 'max-tier'
  | 'insufficient-material'
  | 'invalid-material'
  | 'unknown';

/** 单条消耗的展示视图。 */
export interface GearCostView {
  itemId: string;
  itemName: string;
  amount: number;
  owned: number;
}

/** 经验材料展示视图。 */
export interface GearExpMaterialView {
  itemId: string;
  name: string;
  exp: number;
  owned: number;
}

/** 差分某槽的只读视图（空槽 / 已装配 / 满级三态由字段组合表达）。 */
export interface GearSlotView {
  slotIndex: number;
  kind: GearSlotKind;
  gearId: GearId;
  gearName: string;
  equipped: boolean;
  /** 空槽时为 0。 */
  tier: number;
  level: number;
  levelCap: number;
  exp: number;
  expPerLevel: number;
  canEquip: boolean;
  equipCost: GearCostView[];
  canLevelUp: boolean;
  expMaterials: GearExpMaterialView[];
  canUpgradeTier: boolean;
  upgradeCost: GearCostView[];
  /** 当前可执行动作的阻塞原因；无可执行动作时为 undefined。 */
  reason?: GearActionReason;
}

/** 差分声明的槽引用（未经状态过滤）。 */
export interface GearSlotRef {
  slotIndex: number;
  kind: GearSlotKind;
  gear: GearId;
}

export interface GearQueryPort {
  getDef(gearId: GearId): GearDef | undefined;
  tierDefOf(gearId: GearId, tier: number): GearTierDef | undefined;
  /** 差分声明的三槽（槽类别 + 类型线）；不含运行时进度。 */
  slotsOf(variantId: VariantId): GearSlotRef[];
  /** 三槽只读视图（含可用性与消耗预览）。 */
  viewOf(state: PlayerState, variantId: VariantId): GearSlotView[];
  /** 聚合各槽当前 tier 解析出的效果（仅声明 + 预留接口；运行时消费随 B 段）。 */
  effectsOf(state: PlayerState, variantId: VariantId): Effect[];
}
