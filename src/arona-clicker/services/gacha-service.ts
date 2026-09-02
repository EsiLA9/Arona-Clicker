import type { GachaPoolDef, GachaMode } from '../../data-services/contracts/gacha-pool';
import type { VariantId } from '../types/character';
import type { PlayerState } from '../types/state';
import { CharacterRarity } from '../types/ids';
import type { CharacterVariantDef } from '../types/character';
import type { Registry } from '../../data-services/registry/registry';
import type { GachaMutationPort } from '../contracts/mutation';
import type { EventBus } from '../../engine/core/event-bus';
import type { GachaQueryPort } from '../contracts/gacha-query';

export type Rng = () => number;

export interface PullResult {
  variantId: VariantId;
  duplicate: boolean;
  shards: number;
  bonusResources: Record<string, number>;
}

export interface RollSummary {
  results: PullResult[];
  stopped?: 'insufficient-currency';
}

type ModeImpl = (ctx: {
  pool: GachaPoolDef;
  drawable: VariantId[];
  variants: (id: VariantId) => CharacterVariantDef | undefined;
  pity: number;
  rng: Rng;
}) => VariantId;

const FEATURED_WEIGHT = 0.5;
const RARITY_ORDER: Record<CharacterRarity, number> = {
  [CharacterRarity.SuperRare]: 2,
  [CharacterRarity.Rare]: 1,
  [CharacterRarity.Common]: 0,
};

const baClassic: ModeImpl = ({ pool, drawable, variants, pity, rng }) => {
  if (pool.pity && pity + 1 >= pool.pity.guaranteedAt && pool.featured?.length) return pool.featured[0];
  const totalWeight = pool.rates.reduce((s, r) => s + r.weight, 0);
  if (totalWeight <= 0) throw new Error(`[gacha] 卡池 ${pool.id} 概率表权重非法`);
  let roll = rng() * totalWeight;
  let rarity = pool.rates[pool.rates.length - 1].rarity;
  for (const rate of pool.rates) {
    roll -= rate.weight;
    if (roll < 0) { rarity = rate.rarity; break; }
  }
  const members = drawable.map(variants).filter((v): v is CharacterVariantDef => !!v);
  if (members.length === 0) throw new Error(`[gacha] 卡池 ${pool.id} 无可抽成员`);
  const inRarity = members.filter(v => v.rarity === rarity);
  const featuredInRarity = inRarity.filter(v => pool.featured?.includes(v.id));
  if (featuredInRarity.length > 0 && rng() < FEATURED_WEIGHT) {
    return featuredInRarity[Math.floor(rng() * featuredInRarity.length)].id;
  }
  const candidates = inRarity.length > 0 ? inRarity : members;
  return candidates[Math.floor(rng() * candidates.length)].id;
};

/** AronaClicker 抽卡服务：模式结算、资源扣除与角色获得编排。 */
export class GachaService implements GachaQueryPort {
  private modes = new Map<GachaMode, ModeImpl>();
  private rng: Rng = Math.random;

  constructor(
    private readonly registry: Registry,
    private readonly mutations: GachaMutationPort,
    private readonly eventBus: EventBus,
    private readonly getState: () => PlayerState,
    private readonly getBalance: (resource: string) => number,
    private readonly getDrawable: (pool: GachaPoolDef) => VariantId[] = pool => pool.members,
  ) { this.modes.set('ba-classic' as GachaMode, baClassic); }

  setRng(rng: Rng): void { this.rng = rng; }
  getPool(poolId: string): GachaPoolDef | undefined { return this.registry.gachaPools.get(poolId); }
  countersOf(poolId: string): { pity: number; pulls: number } {
    return this.getState().gachaState?.[poolId] ?? { pity: 0, pulls: 0 };
  }

  roll(poolId: string, count: number): RollSummary {
    const pool = this.getPool(poolId);
    if (!pool) throw new Error(`[gacha] 未知卡池: ${poolId}`);
    const impl = this.modes.get(pool.mode);
    if (!impl) throw new Error(`[gacha] 未注册的抽取模式: ${pool.mode}`);
    if (!pool.rates.length || !pool.members.length) throw new Error(`[gacha] 卡池 ${poolId} 配置不完整`);
    const drawable = this.getDrawable(pool);
    if (drawable.length === 0) throw new Error(`[gacha] 卡池 ${poolId} 已关闭或无可抽成员`);
    const summary: RollSummary = { results: [] };
    let counters = this.countersOf(poolId);
    const highestRarity = this.highestRarity(pool);
    for (let i = 0; i < count; i++) {
      if (this.getBalance(pool.currency) < pool.costPerPull) { summary.stopped = 'insufficient-currency'; break; }
      this.mutations.changeResource(pool.currency, -pool.costPerPull);
      const variantId = impl({ pool, drawable, variants: id => this.registry.characterVariants.get(id), pity: counters.pity, rng: this.rng });
      const pulled = this.registry.characterVariants.get(variantId);
      if (!pulled) throw new Error(`[gacha] 卡池 ${poolId} 引用未知差分: ${variantId}`);
      if (pool.pity && counters.pity + 1 >= pool.pity.guaranteedAt) counters = { ...counters, pity: 0 };
      else if (pulled.rarity === highestRarity && !pool.pity?.keepOnHit) counters = { ...counters, pity: 0 };
      else counters = { ...counters, pity: counters.pity + 1 };
      const acquired = this.mutations.acquireCharacter(variantId, 'gacha', pool.dupRewards);
      counters = { ...counters, pulls: counters.pulls + 1 };
      this.mutations.setGachaCounters(poolId, counters);
      summary.results.push({ variantId, duplicate: acquired.duplicate, shards: acquired.shards, bonusResources: acquired.bonusResources });
    }
    if (summary.results.length > 0 || summary.stopped) this.eventBus.emit({ type: 'gachaResolved', poolId, count: summary.results.length });
    return summary;
  }

  private highestRarity(pool: GachaPoolDef): CharacterRarity | undefined {
    let best: CharacterRarity | undefined;
    let bestOrder = -1;
    for (const rate of pool.rates) {
      const order = RARITY_ORDER[rate.rarity] ?? -1;
      if (order > bestOrder) { bestOrder = order; best = rate.rarity; }
    }
    return best;
  }
}
