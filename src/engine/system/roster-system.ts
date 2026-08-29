// ============================================================
// engine/roster-system.ts — 通讯录查询服务（只读）
//
// 玩家持有的差分实例（RosterEntry）与碎片余额的统一查询入口。
// 写操作一律经 StateMutationService.acquireCharacter / cultivate*。
// 好感只读查询（docs-828/06-adr/planning.md §1）。
// ============================================================

import type {
  Character,
  CharacterSchool,
  CharacterVariantDef,
  PlayerState,
  ProtoStat,
  RosterEntry,
  VariantId,
} from '../types';
import { CharacterRarity } from '../types';
import type { Registry } from '../registry/registry';
import { affectionLevelCapOf, resolveAffectionConfig } from './affection-system';

/** 通讯录分组：按学校聚合，组内稀有度降序。 */
export interface ContactGroup {
  school: CharacterSchool;
  entries: ContactEntry[];
}

export interface ContactEntry {
  variant: CharacterVariantDef;
  /** 未获得时为 undefined（图鉴占位）。 */
  entry?: RosterEntry;
}

const RARITY_ORDER: Record<CharacterRarity, number> = {
  [CharacterRarity.SuperRare]: 2,
  [CharacterRarity.Rare]: 1,
  [CharacterRarity.Common]: 0,
};

export class RosterSystem {
  constructor(private readonly registry: Registry) {}

  /** 好感等级（未拥有 → 0；已拥有缺字段 ??= 1）。 */
  affectionLevelOf(state: PlayerState, variantId: VariantId): number {
    const entry = this.getOwned(state, variantId);
    if (!entry) return 0;
    return entry.affectionLevel ?? 1;
  }

  /** 当前级内积累的好感小值（未拥有 → 0）。 */
  affectionExpOf(state: PlayerState, variantId: VariantId): number {
    return this.getOwned(state, variantId)?.affectionExp ?? 0;
  }

  /**
   * 好感等级有效上限 = min(星级锁(stars), maxLevel)。
   * 星级突破后等级只升不降：当前等级高于新 cap 时保持不变，仅阻止继续积累。
   */
  affectionLevelCapOf(state: PlayerState, variantId: VariantId): number {
    const entry = this.getOwned(state, variantId);
    if (!entry) return 0;
    const config = resolveAffectionConfig(this.registry.affectionConfig);
    return affectionLevelCapOf(config, this.getVariant(variantId), entry.stars);
  }

  /** 获取差分定义；未知 id 返回 undefined。 */
  getVariant(variantId: VariantId): CharacterVariantDef | undefined {
    return this.registry.characterVariants.get(variantId);
  }

  getAllVariants(): CharacterVariantDef[] {
    return [...this.registry.characterVariants.values()];
  }

  /** 玩家持有的差分实例；未拥有返回 undefined。 */
  getOwned(state: PlayerState, variantId: VariantId): RosterEntry | undefined {
    return state.roster?.[variantId];
  }

  isOwned(state: PlayerState, variantId: VariantId): boolean {
    return this.getOwned(state, variantId) !== undefined;
  }

  /** 某差分的碎片余额（按差分隔离，不并入原型）。 */
  shardsOf(state: PlayerState, variantId: VariantId): number {
    return state.fragments?.[variantId] ?? 0;
  }

  /** 某差分自身的累计获得次数（含首次；按差分隔离）。 */
  acquiredCountOf(state: PlayerState, variantId: VariantId): number {
    return this.getOwned(state, variantId)?.acquiredCount ?? 0;
  }

  /** 原型聚合统计（派生视图，由 characterAcquired/cultivated 事件维护）。 */
  protoStatOf(state: PlayerState, proto: Character): ProtoStat | undefined {
    return state.protoStats?.[proto];
  }

  /**
   * 通讯录视图：按学校分组，组内稀有度降序（SuperRare > Rare > Common）。
   * 仅包含已获得的差分（未获得的走 codex 图鉴占位）。
   */
  contactGroups(state: PlayerState): ContactGroup[] {
    const bySchool = new Map<CharacterSchool, ContactEntry[]>();
    for (const variant of this.getAllVariants()) {
      const entry = this.getOwned(state, variant.id);
      if (!entry) continue;
      const list = bySchool.get(variant.school) ?? [];
      list.push({ variant, entry });
      bySchool.set(variant.school, list);
    }
    const groups: ContactGroup[] = [];
    for (const [school, entries] of bySchool) {
      entries.sort((a, b) => RARITY_ORDER[b.variant.rarity] - RARITY_ORDER[a.variant.rarity]);
      groups.push({ school, entries });
    }
    return groups;
  }

  /**
   * 图鉴视图：全部差分 + 持有标记（未获得为占位）。
   * 同原型多变体全部列出。
   */
  codex(state: PlayerState): ContactEntry[] {
    return this.getAllVariants()
      .map(variant => ({ variant, entry: this.getOwned(state, variant.id) }))
      .sort((a, b) => RARITY_ORDER[b.variant.rarity] - RARITY_ORDER[a.variant.rarity]);
  }
}
