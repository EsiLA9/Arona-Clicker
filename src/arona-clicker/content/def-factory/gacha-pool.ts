import type { Condition, ConditionGroup } from '../../../engine/types/expression';
import type { CharacterRarity } from '../../types/ids';
import { GachaMode } from '../../../data-services/contracts/gacha-pool';
import type { DupRewards, GachaPoolDef, GachaRateEntry } from '../../../data-services/contracts/gacha-pool';
import type { GachaPoolId, VariantId } from '../../../engine/types/character';

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

  constructor(id: GachaPoolId) { this._id = id; }
  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  mode(value: GachaMode): this { this._mode = value; return this; }
  currency(value: string): this { this._currency = value; return this; }
  costPerPull(value: number): this { this._costPerPull = value; return this; }
  rate(rarity: CharacterRarity, weight: number): this { this._rates.push({ rarity, weight }); return this; }
  featured(...ids: VariantId[]): this { this._featured.push(...ids); return this; }
  pity(guaranteedAt: number, keepOnHit?: boolean): this {
    this._pity = keepOnHit !== undefined ? { guaranteedAt, keepOnHit } : { guaranteedAt };
    return this;
  }
  dupRewards(shards: number, bonusResources?: Record<string, number>): this {
    this._dupRewards = bonusResources ? { shards, bonusResources } : { shards };
    return this;
  }
  members(...ids: VariantId[]): this { this._members = ids; return this; }
  closeWhen(condition: Condition | ConditionGroup): this { this._closeWhen = condition; return this; }

  build(): GachaPoolDef {
    if (!this._name) throw new Error(`GachaPoolBuilder(${this._id}): name 未设置`);
    const def: GachaPoolDef = {
      id: this._id, name: this._name, mode: this._mode, currency: this._currency,
      costPerPull: this._costPerPull, rates: this._rates, members: this._members,
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
