import type { VariantId } from '../../engine/types';
import type { PlayerState } from '../types/state';
import type { CharacterVariantDef, ProtoStat, RosterEntry } from '../types/character';
import { Character, CharacterRarity, CharacterSchool } from '../types/ids';
import type { Registry } from '../../data-services/registry/registry';
import { affectionLevelCapOf, resolveAffectionConfig } from './affection-system';
import type { RosterContactGroup, RosterContactEntry, RosterQueryPort } from '../contracts/roster-query';

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
  affectionLevelOf(state: PlayerState, variantId: VariantId): number {
    const entry = this.getOwned(state, variantId);
    return entry ? entry.affectionLevel ?? 1 : 0;
  }
  affectionExpOf(state: PlayerState, variantId: VariantId): number { return this.getOwned(state, variantId)?.affectionExp ?? 0; }
  affectionLevelCapOf(state: PlayerState, variantId: VariantId): number {
    const entry = this.getOwned(state, variantId);
    if (!entry) return 0;
    return affectionLevelCapOf(resolveAffectionConfig(this.registry.affectionConfig), this.getVariant(variantId), entry.stars);
  }
  getVariant(variantId: VariantId): CharacterVariantDef | undefined { return this.registry.characterVariants.get(variantId); }
  getAllVariants(): CharacterVariantDef[] { return [...this.registry.characterVariants.values()]; }
  getOwned(state: PlayerState, variantId: VariantId): RosterEntry | undefined { return state.roster?.[variantId]; }
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
