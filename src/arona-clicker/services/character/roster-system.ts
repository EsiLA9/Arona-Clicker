import type { VariantId } from '../../../engine/types/index';
import type { PlayerState } from '../../types/state';
import type { CharacterVariantDef, ProtoStat, VariantProgress } from '../../types/character';
import { Character, CharacterRarity, CharacterSchool } from '../../types/ids';
import type { Registry } from '../../../data-services/registry/registry';
import { affectionExpToNext, affectionLevelCapOf as resolveAffectionLevelCap, resolveAffectionConfig } from './affection-system';
import { checkBreakthrough, expToNext, resolveCurve, resolveVariantLevelCap } from '../progression/cultivate-system';
import type { CharacterCultivationView, RosterContactGroup, RosterContactEntry, RosterQueryPort } from '../../contracts/character/roster-query';

export type ContactGroup = RosterContactGroup;
export type ContactEntry = RosterContactEntry;

const RARITY_ORDER: Record<CharacterRarity, number> = {
  [CharacterRarity.SuperRare]: 2,
  [CharacterRarity.Rare]: 1,
  [CharacterRarity.Common]: 0,
};

/** AronaClicker 通讯录与角色持有只读服务。 */
export class RosterSystem implements RosterQueryPort {
  constructor(private readonly registry: Registry) {}
  cultivationOf(state: PlayerState, variantId: VariantId): CharacterCultivationView | null {
    const entry = this.getOwned(state, variantId);
    const variant = this.getVariant(variantId);
    if (!entry || !variant) return null;

    const curve = resolveCurve(variant.curve ? this.registry.cultivateCurves.get(variant.curve) : undefined);
    const levelCap = resolveVariantLevelCap(curve, state.accountLevelCap);
    const level = entry.level;
    const affectionLevel = entry.affectionLevel ?? 1;
    const affectionConfig = resolveAffectionConfig(this.registry.affectionConfig);
    const affectionLevelCap = resolveAffectionLevelCap(affectionConfig, variant, entry.stars);
    const breakthrough = checkBreakthrough(curve, state, variant, entry);
    const nextLevelExp = level < levelCap ? expToNext(curve, level) : Number.POSITIVE_INFINITY;
    const nextAffectionExp = affectionLevel < affectionLevelCap
      ? affectionExpToNext(affectionConfig, affectionLevel)
      : Number.POSITIVE_INFINITY;

    return Object.freeze({
      level,
      exp: entry.exp,
      levelCap,
      expToNext: Number.isFinite(nextLevelExp) ? nextLevelExp : null,
      canTrain: level < levelCap && Number.isFinite(nextLevelExp),
      affectionLevel,
      affectionExp: entry.affectionExp ?? 0,
      affectionLevelCap,
      affectionExpToNext: Number.isFinite(nextAffectionExp) ? nextAffectionExp : null,
      canInteract: affectionLevel < affectionLevelCap,
      stars: entry.stars,
      shards: state.fragments?.[variantId] ?? 0,
      starCost: breakthrough.cost ?? null,
      canBreakthrough: breakthrough.ok,
      ...(!breakthrough.ok && breakthrough.reason ? { breakthroughReason: breakthrough.reason } : {}),
    });
  }
  affectionLevelOf(state: PlayerState, variantId: VariantId): number {
    const entry = this.getOwned(state, variantId);
    return entry ? entry.affectionLevel ?? 1 : 0;
  }
  affectionExpOf(state: PlayerState, variantId: VariantId): number { return this.getOwned(state, variantId)?.affectionExp ?? 0; }
  affectionLevelCapOf(state: PlayerState, variantId: VariantId): number {
    const entry = this.getOwned(state, variantId);
    if (!entry) return 0;
    return resolveAffectionLevelCap(resolveAffectionConfig(this.registry.affectionConfig), this.getVariant(variantId), entry.stars);
  }
  getVariant(variantId: VariantId): CharacterVariantDef | undefined { return this.registry.characterVariants.get(variantId); }
  getAllVariants(): CharacterVariantDef[] { return [...this.registry.characterVariants.values()]; }
  getOwned(state: PlayerState, variantId: VariantId): VariantProgress | undefined { return state.roster?.[variantId]; }
  isOwned(state: PlayerState, variantId: VariantId): boolean { return this.getOwned(state, variantId) !== undefined; }
  shardsOf(state: PlayerState, variantId: VariantId): number { return state.fragments?.[variantId] ?? 0; }
  acquiredCountOf(state: PlayerState, variantId: VariantId): number { return this.getOwned(state, variantId)?.acquiredCount ?? 0; }
  protoStatOf(state: PlayerState, proto: Character): ProtoStat | undefined { return state.protoStats?.[proto]; }
  contactGroups(state: PlayerState): ContactGroup[] {
    const bySchool = new Map<CharacterSchool, ContactEntry[]>();
    for (const variant of this.getAllVariants()) {
      const entry = this.getOwned(state, variant.id);
      if (!entry) continue;
      const list = bySchool.get(variant.school) ?? [];
      list.push({ variant, entry });
      bySchool.set(variant.school, list);
    }
    return [...bySchool].map(([school, entries]) => {
      entries.sort((a, b) => RARITY_ORDER[b.variant.rarity] - RARITY_ORDER[a.variant.rarity]);
      return { school, entries };
    });
  }
  codex(state: PlayerState): ContactEntry[] {
    return this.getAllVariants()
      .map(variant => ({ variant, entry: this.getOwned(state, variant.id) }))
      .sort((a, b) => RARITY_ORDER[b.variant.rarity] - RARITY_ORDER[a.variant.rarity]);
  }
}
