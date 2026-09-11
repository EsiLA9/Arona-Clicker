// ============================================================
// arona-clicker/services/gear-system.ts — 装备（Gear）领域服务（只读）
//
// 解析「差分槽 → 类型线 → tier → 等级/经验/消耗」，产出 UI 只读视图与效果声明。
// 不直接改 State：写入一律经 StateMutationService（架构纪律 #1）。
//
// tier 效果模型（ADR 前置裁定）：每 tier 自带 baseEffects + perLevelEffects 线性成长；
// 升 tier 时新 tier 整体替换旧 tier，不跨 tier 叠加。
// ============================================================

import type { Effect } from '../../engine/types/expression';
import type { GearCostDef, GearDef, GearTierDef } from '../../data-services/contracts/character-progression-def';
import type { Registry } from '../../data-services/registry/registry';
import type { GearId, GearProgress, VariantId } from '../types/character';
import type { PlayerState } from '../types/state';
import type {
  GearCostView,
  GearExpMaterialView,
  GearQueryPort,
  GearSlotRef,
  GearSlotView,
} from '../contracts/gear-query';

export class GearSystem implements GearQueryPort {
  constructor(
    private readonly registry: Registry,
    private readonly getState: () => PlayerState,
  ) {}

  getDef(gearId: GearId): GearDef | undefined { return this.registry.gears.get(gearId); }

  tierDefOf(gearId: GearId, tier: number): GearTierDef | undefined {
    return this.getDef(gearId)?.tiers.find(t => t.tier === tier);
  }

  slotsOf(variantId: VariantId): GearSlotRef[] {
    const defs = this.registry.characterVariants.get(variantId)?.progression?.gearSlots ?? [];
    return defs.map((slot, slotIndex) => ({ slotIndex, kind: slot.slot, gear: slot.gear }));
  }

  viewOf(state: PlayerState, variantId: VariantId): GearSlotView[] {
    const progress = state.roster?.[variantId]?.gear;
    return this.slotsOf(variantId).map(ref =>
      this.buildSlotView(state, ref, progress?.[ref.slotIndex]));
  }

  effectsOf(state: PlayerState, variantId: VariantId): Effect[] {
    const out: Effect[] = [];
    const progress = state.roster?.[variantId]?.gear;
    for (const ref of this.slotsOf(variantId)) {
      const gear = this.getDef(ref.gear);
      const p = progress?.[ref.slotIndex];
      if (!gear || !p) continue;
      const tierDef = gear.tiers.find(t => t.tier === p.tier);
      if (!tierDef) continue;
      out.push(...this.resolveTierEffects(gear, tierDef, p.level));
    }
    return out;
  }

  /** 解析某 tier 在指定（累计）等级下的效果：base + perLevel × 级差（线性加法类按倍率展开）。 */
  resolveTierEffects(gear: GearDef, tierDef: GearTierDef, level: number): Effect[] {
    const steps = Math.max(0, level - this.baseLevelOf(gear, tierDef));
    const effects: Effect[] = [...(tierDef.baseEffects ?? [])];
    for (const effect of tierDef.perLevelEffects ?? []) {
      if (steps <= 0) continue;
      if (typeof effect.value === 'number') effects.push({ ...effect, value: effect.value * steps });
      else effects.push(effect);
    }
    return effects;
  }

  /** tier 效果线性基准等级：显式 baseLevel，否则取上一 tier 的 levelCap（T1 为 1）。 */
  private baseLevelOf(gear: GearDef, tierDef: GearTierDef): number {
    if (tierDef.baseLevel !== undefined) return tierDef.baseLevel;
    const prev = gear.tiers.find(t => t.tier === tierDef.tier - 1);
    return prev ? prev.levelCap : 1;
  }

  private buildSlotView(state: PlayerState, ref: GearSlotRef, progress: GearProgress | undefined): GearSlotView {
    const gear = this.getDef(ref.gear);
    const expMaterials = this.expMaterialsOf(state);
    if (!gear) {
      return {
        slotIndex: ref.slotIndex, kind: ref.kind, gearId: ref.gear, gearName: ref.gear,
        equipped: false, tier: 0, level: 0, levelCap: 0, exp: 0, expPerLevel: 0,
        canEquip: false, equipCost: [], canLevelUp: false, expMaterials: [],
        canUpgradeTier: false, upgradeCost: [], reason: 'unknown',
      };
    }
    if (!progress) {
      const tier1 = gear.tiers.find(t => t.tier === 1);
      const equipCost = this.costViews(state, tier1?.upgradeCost);
      const canEquip = !!tier1 && equipCost.every(c => c.owned >= c.amount);
      return {
        slotIndex: ref.slotIndex, kind: ref.kind, gearId: gear.id, gearName: gear.name,
        equipped: false, tier: 0, level: 0, levelCap: tier1?.levelCap ?? 0, exp: 0,
        expPerLevel: tier1?.expPerLevel ?? 0,
        canEquip, equipCost, canLevelUp: false, expMaterials,
        canUpgradeTier: false, upgradeCost: [],
        reason: canEquip ? undefined : 'insufficient-material',
      };
    }
    const tierDef = gear.tiers.find(t => t.tier === progress.tier);
    const levelCap = tierDef?.levelCap ?? progress.level;
    const expPerLevel = tierDef?.expPerLevel ?? 0;
    const atMax = progress.level >= levelCap;
    const nextTier = gear.tiers.find(t => t.tier === progress.tier + 1);
    const upgradeCost = this.costViews(state, nextTier?.upgradeCost);
    const canUpgradeTier = atMax && !!nextTier && upgradeCost.every(c => c.owned >= c.amount);
    const canLevelUp = !atMax && expMaterials.some(m => m.owned > 0);
    let reason: GearSlotView['reason'];
    if (atMax) reason = canUpgradeTier ? undefined : nextTier ? 'insufficient-material' : 'max-tier';
    else reason = canLevelUp ? undefined : 'insufficient-material';
    return {
      slotIndex: ref.slotIndex, kind: ref.kind, gearId: gear.id, gearName: gear.name,
      equipped: true, tier: progress.tier, level: progress.level, levelCap,
      exp: progress.exp, expPerLevel, canEquip: false, equipCost: [],
      canLevelUp, expMaterials, canUpgradeTier, upgradeCost, reason,
    };
  }

  private costViews(state: PlayerState, costs?: GearCostDef[]): GearCostView[] {
    return (costs ?? []).map(cost => ({
      itemId: cost.itemId,
      itemName: this.registry.items.get(cost.itemId)?.name ?? cost.itemId,
      amount: cost.amount,
      owned: state.inventory[cost.itemId] ?? 0,
    }));
  }

  private expMaterialsOf(state: PlayerState): GearExpMaterialView[] {
    return (this.registry.gearConfig?.expItems ?? []).map(material => ({
      itemId: material.itemId,
      name: this.registry.items.get(material.itemId)?.name ?? material.itemId,
      exp: material.exp,
      owned: state.inventory[material.itemId] ?? 0,
    }));
  }
}
