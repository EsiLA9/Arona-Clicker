// ============================================================
// engine/def-factory/gacha-pool.ts — GachaPoolDef 链式 Builder
// ============================================================

import type { Condition, ConditionGroup } from '../types/expression';
import type { CharacterRarity } from '../types/ids';
import { GachaMode } from '../types/character';
import type {
  DupRewards,
  GachaPoolDef,
  GachaPoolId,
  GachaRateEntry,
  VariantId,
} from '../types/character';

export class GachaPoolBuilder {
  private readonly _id: GachaPoolId;
  private _name = '';
  private _description?: string;
  private _mode: GachaMode = GachaMode.BaClassic;
  private _currency = '';
  private _costPerPull = 0;
  private _rates: GachaRateEntry[] = [];
  private _featured: VariantId[] = [];
  private _pity?: { guaranteedAt: number; keepOnHit?: boolean };
  private _dupRewards?: DupRewards;
  private _members: VariantId[] = [];
  private _closeWhen?: Condition | ConditionGroup;

  constructor(id: GachaPoolId) {
    this._id = id;
  }

  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  mode(value: GachaMode): this { this._mode = value; return this; }
  /** @label 货币 */
  currency(value: string): this { this._currency = value; return this; }
  /** @label 单价 */
  costPerPull(value: number): this { this._costPerPull = value; return this; }
  /** 稀有度权重项（追加）。 */
  rate(rarity: CharacterRarity, weight: number): this {
    this._rates.push({ rarity, weight });
    return this;
  }
  featured(...ids: VariantId[]): this { this._featured.push(...ids); return this; }
  /** @label 保底 */
  pity(guaranteedAt: number, keepOnHit?: boolean): this {
    this._pity = keepOnHit !== undefined ? { guaranteedAt, keepOnHit } : { guaranteedAt };
    return this;
  }
  /** 重复获得返还：碎片数 + 附加资源表。 */
  dupRewards(shards: number, bonusResources?: Record<string, number>): this {
    this._dupRewards = bonusResources ? { shards, bonusResources } : { shards };
    return this;
  }
  /** 可及性成员（池关闭后并入世界 Pool）。 */
  members(...ids: VariantId[]): this { this._members = ids; return this; }
  closeWhen(condition: Condition | ConditionGroup): this { this._closeWhen = condition; return this; }

  build(): GachaPoolDef {
    if (!this._name) throw new Error(`GachaPoolBuilder(${this._id}): name 未设置`);
    const def: GachaPoolDef = {
      id: this._id,
      name: this._name,
      mode: this._mode,
      currency: this._currency,
      costPerPull: this._costPerPull,
      rates: this._rates,
      members: this._members,
    };
    if (this._description) def.description = this._description;
    if (this._featured.length) def.featured = this._featured;
    if (this._pity) def.pity = this._pity;
    if (this._dupRewards) def.dupRewards = this._dupRewards;
    if (this._closeWhen) def.closeWhen = this._closeWhen;
    return def;
  }
}

export const gachaPool = (id: GachaPoolId): GachaPoolBuilder => new GachaPoolBuilder(id);