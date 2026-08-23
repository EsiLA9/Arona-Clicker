// ============================================================
// engine/gacha-service.ts — 抽取模式注册表 + ba-classic 结算
//
// GachaMode 为代码定义（不可由数据包扩展）；数据包只声明池参数。
// 货币扣除 / 计数写入 / 角色获得全部经 StateMutationService。
// ============================================================

import type {
  DupRewards,
  GachaMode,
  GachaPoolDef,
  PlayerState,
  VariantId,
} from './types';
import { CharacterRarity, CharacterVariantDef } from './types';
import type { Registry } from './registry';
import type { StateMutationService } from './state-mutation-service';
import type { EventBus } from './event-bus';

export type Rng = () => number;

/** 单次抽取结果。 */
export interface PullResult {
  variantId: VariantId;
  duplicate: boolean;
  shards: number;
  bonusResources: Record<string, number>;
}

export interface RollSummary {
  results: PullResult[];
  /** 中止原因：资源不足且已完成部分返回（G-09）。 */
  stopped?: 'insufficient-currency';
}

/** 模式实现：给定池与 rng，产出本次抽中的差分 id。 */
type ModeImpl = (ctx: {
  pool: GachaPoolDef;
  /** 本池当前可抽集合（成员 ∪ 世界 Pool；已关闭池为空，由调用方先行拒绝）。 */
  drawable: VariantId[];
  variants: (id: VariantId) => CharacterVariantDef | undefined;
  pity: number;
  rng: Rng;
}) => VariantId;

/** UP 命中概率：稀有度内存在 featured 时，featured 的合计权重。 */
const FEATURED_WEIGHT = 0.5;

const RARITY_ORDER: Record<CharacterRarity, number> = {
  [CharacterRarity.SuperRare]: 2,
  [CharacterRarity.Rare]: 1,
  [CharacterRarity.Common]: 0,
};

/** ba-classic：稀有度权重 roll → 稀有度内选差分（featured 半数权重偏向）+ 天井必出。 */
const baClassic: ModeImpl = ({ pool, drawable, variants, pity, rng }) => {
  if (pool.pity && pity + 1 >= pool.pity.guaranteedAt && pool.featured?.length) {
    return pool.featured[0];
  }
  const totalWeight = pool.rates.reduce((s, r) => s + r.weight, 0);
  if (totalWeight <= 0) throw new Error(`[gacha] 卡池 ${pool.id} 概率表权重非法`);
  let roll = rng() * totalWeight;
  let rarity = pool.rates[pool.rates.length - 1].rarity;
  for (const rate of pool.rates) {
    roll -= rate.weight;
    if (roll < 0) {
      rarity = rate.rarity;
      break;
    }
  }
  const members = drawable.map(variants).filter((v): v is CharacterVariantDef => !!v);
  if (members.length === 0) throw new Error(`[gacha] 卡池 ${pool.id} 无可抽成员`);
  const inRarity = members.filter(v => v.rarity === rarity);
  const featuredInRarity = inRarity.filter(v => pool.featured?.includes(v.id));
  if (featuredInRarity.length > 0 && rng() < FEATURED_WEIGHT) {
    return featuredInRarity[Math.floor(rng() * featuredInRarity.length)].id;
  }
  // 该稀有度无成员 → 回退全池随机（防呆）
  const candidates = inRarity.length > 0 ? inRarity : members;
  return candidates[Math.floor(rng() * candidates.length)].id;
};

export class GachaService {
  private modes = new Map<GachaMode, ModeImpl>();
  private rng: Rng = Math.random;

  constructor(
    private readonly registry: Registry,
    private readonly mutations: StateMutationService,
    private readonly eventBus: EventBus,
    private readonly getState: () => PlayerState,
    /** 余额读取（含全局资源桶语义；由 GameInstance 接到 initService.getResourceAmount）。 */
    private readonly getBalance: (resource: string) => number,
    /** 可抽集合读取（限定 ∪ 世界 Pool；由 GameInstance 接 AvailabilityService）。缺省 = 池成员。 */
    private readonly getDrawable: (pool: GachaPoolDef) => VariantId[] = pool => pool.members,
  ) {
    this.modes.set('ba-classic' as GachaMode, baClassic);
  }

  /** 注入确定性 RNG（测试用；默认 Math.random）。 */
  setRng(rng: Rng): void {
    this.rng = rng;
  }

  getPool(poolId: string): GachaPoolDef | undefined {
    return this.registry.gachaPools.get(poolId);
  }

  countersOf(poolId: string): { pity: number; pulls: number } {
    return this.getState().gachaState?.[poolId] ?? { pity: 0, pulls: 0 };
  }

  /**
   * 抽取 count 次：逐次扣费、逐次结算 pity、逐次获得/转化。
   * 中途资源不足则中止并返回已完成部分（G-09）。
   */
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
      if (this.getBalance(pool.currency) < pool.costPerPull) {
        summary.stopped = 'insufficient-currency';
        break;
      }
      this.mutations.changeResource(pool.currency, -pool.costPerPull);

      const variantId = impl({
        pool,
        drawable,
        variants: id => this.registry.characterVariants.get(id),
        pity: counters.pity,
        rng: this.rng,
      });
      const pulled = this.registry.characterVariants.get(variantId);
      if (!pulled) throw new Error(`[gacha] 卡池 ${poolId} 引用未知差分: ${variantId}`);

      // pity 结算：天井命中归零；非天井抽中最高稀有度按 keepOnHit 决定归零或累加
      if (pool.pity && counters.pity + 1 >= pool.pity.guaranteedAt) {
        counters = { ...counters, pity: 0 };
      } else if (pulled.rarity === highestRarity && !pool.pity?.keepOnHit) {
        counters = { ...counters, pity: 0 };
      } else {
        counters = { ...counters, pity: counters.pity + 1 };
      }

      const acquired = this.mutations.acquireCharacter(variantId, 'gacha', pool.dupRewards);
      counters = { ...counters, pulls: counters.pulls + 1 };
      this.mutations.setGachaCounters(poolId, counters);

      summary.results.push({
        variantId,
        duplicate: acquired.duplicate,
        shards: acquired.shards,
        bonusResources: acquired.bonusResources,
      });
    }

    if (summary.results.length > 0 || summary.stopped) {
      this.eventBus.emit({ type: 'gachaResolved', poolId, count: summary.results.length });
    }
    return summary;
  }

  private highestRarity(pool: GachaPoolDef): CharacterRarity | undefined {
    let best: CharacterRarity | undefined;
    let bestOrder = -1;
    for (const rate of pool.rates) {
      const order = RARITY_ORDER[rate.rarity] ?? -1;
      if (order > bestOrder) {
        bestOrder = order;
        best = rate.rarity;
      }
    }
    return best;
  }
}
