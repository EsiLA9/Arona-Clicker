import type { ExtraCompound } from '../../../engine/types/extra';
import type { Effect } from '../../../engine/types/expression';
import type { ItemId } from '../../../engine/types/ids';
import type { GearCostDef, GearDef, GearId, GearSlotKind, GearTierDef } from '../../types/character';

/** 构造装备升级消耗条目（图纸/材料物品 × 数量）。 */
export const gearCost = (itemId: ItemId, amount: number): GearCostDef => ({ itemId, amount });

/** 追加 tier 时的可选参数。 */
export interface GearTierOptions {
  /** 达到本 tier 的消耗（T1 即装配消耗） */
  upgradeCost?: GearCostDef[];
  /** 本 tier 的基础效果 */
  baseEffects?: Effect[];
  /** 每高出 baseLevel 一级叠加一次的线性成长效果 */
  perLevelEffects?: Effect[];
  /** 效果线性基准等级；缺省 = 上一 tier 的 levelCap */
  baseLevel?: number;
}

export class GearBuilder {
  private readonly _id: GearId;
  private _name = '';
  private _description?: string;
  private _slot: GearSlotKind = 'attack';
  private readonly _tiers: GearTierDef[] = [];
  private _extra?: ExtraCompound;

  constructor(id: GearId) { this._id = id; }

  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  slot(value: GearSlotKind): this { this._slot = value; return this; }
  /** 追加一个 tier（tier / 累计等级上限 / 每级所需经验）。 */
  tier(tier: number, levelCap: number, expPerLevel: number, options: GearTierOptions = {}): this {
    this._tiers.push({ tier, levelCap, expPerLevel, ...options });
    return this;
  }
  extra(value: ExtraCompound): this { this._extra = value; return this; }

  build(): GearDef {
    if (!this._name) throw new Error(`GearBuilder(${this._id}): name 未设置`);
    if (!this._tiers.length) throw new Error(`GearBuilder(${this._id}): 至少需要一个 tier`);
    const def: GearDef = {
      id: this._id,
      name: this._name,
      slot: this._slot,
      tiers: [...this._tiers].sort((a, b) => a.tier - b.tier),
    };
    if (this._description) def.description = this._description;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}

export const gear = (id: GearId): GearBuilder => new GearBuilder(id);
