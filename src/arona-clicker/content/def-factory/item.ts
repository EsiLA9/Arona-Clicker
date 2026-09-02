import type { ExtraCompound } from '../../../engine/types/extra';
import type { Condition, ConditionGroup, Effect } from '../../../engine/types/expression';
import type { ItemId } from '../../../engine/types/ids';
import type { RevealTarget, RevealTrigger } from '../../../engine/types/reveal';
import type { ResourceAmount } from '../../../data-services/contracts/common';
import type { AffectorPackRef } from '../../../engine/types/trigger';
import type { ItemDef } from '../../../data-services/contracts/item';

export class ItemBuilder {
  private readonly _id: ItemId;
  private _name = '';
  private _description = '';
  private _icon?: string;
  private _maxStack = 1;
  private _rarity: ItemDef['rarity'] = 'common';
  private _type: ItemDef['type'] = 'material';
  private _revealTriggers: RevealTrigger[] = [];
  private _useCondition?: ConditionGroup;
  private _useEffects: Effect[] = [];
  private _pickupEffects: Effect[] = [];
  private _sellPrice?: ResourceAmount;
  private _affectorPackIds: AffectorPackRef[] = [];
  private _extra?: ExtraCompound;

  constructor(id: ItemId) { this._id = id; }
  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  icon(url: string): this { this._icon = url; return this; }
  maxStack(value: number): this { this._maxStack = value; return this; }
  rarity(value: ItemDef['rarity']): this { this._rarity = value; return this; }
  type(value: ItemDef['type']): this { this._type = value; return this; }
  useEffects(...effs: Effect[]): this { this._useEffects.push(...effs); return this; }
  pickupEffects(...effs: Effect[]): this { this._pickupEffects.push(...effs); return this; }
  useCondition(condition: ConditionGroup): this { this._useCondition = condition; return this; }
  sellPrice(resourceId: string, amount: number): this { this._sellPrice = { resourceId, amount }; return this; }
  affectorPack(id: AffectorPackRef): this { this._affectorPackIds.push(id); return this; }
  reveal(target: RevealTarget, condition?: Condition | ConditionGroup): this {
    this._revealTriggers.push(condition ? { reveal: target, condition } : { reveal: target }); return this;
  }
  extra(value: ExtraCompound): this { this._extra = value; return this; }
  build(): ItemDef {
    if (!this._name) throw new Error(`ItemBuilder(${this._id}): name 未设置`);
    if (!this._description) throw new Error(`ItemBuilder(${this._id}): description 未设置`);
    const def: ItemDef = { id: this._id, name: this._name, description: this._description, maxStack: this._maxStack, rarity: this._rarity, type: this._type };
    if (this._icon) def.icon = this._icon;
    if (this._revealTriggers.length) def.revealTriggers = this._revealTriggers;
    if (this._useCondition) def.useCondition = this._useCondition;
    if (this._useEffects.length) def.useEffects = this._useEffects;
    if (this._pickupEffects.length) def.pickupEffects = this._pickupEffects;
    if (this._sellPrice) def.sellPrice = this._sellPrice;
    if (this._affectorPackIds.length) def.affectorPackIds = this._affectorPackIds;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}
export const item = (id: ItemId): ItemBuilder => new ItemBuilder(id);
