import type { TagPath } from '../../../engine/core/tag';
import type { ExtraCompound } from '../../../engine/types/extra';
import type { Condition, ConditionGroup, Effect } from '../../../engine/types/expression';
import type { AreaId, EnhancementId, InitId } from '../../../engine/types/ids';
import type { RevealTarget, RevealTrigger } from '../../../engine/types/reveal';
import type { ResourceAmount } from '../../../data-services/contracts/common';
import type { AffectorPackRef } from '../../../engine/types/trigger';
import type { SpotFunctionalityDef } from '../../../data-services/contracts/world';
import type { EnhancementAttachment, EnhancementDef } from '../../../data-services/contracts/enhancement';

export class EnhancementBuilder {
  private readonly _id: EnhancementId;
  private _name = '';
  private _description = '';
  private _effects: Effect[] = [];
  private _autoApply = false;
  private _maxStacks?: number;
  private _price?: ResourceAmount[];
  private _tags: TagPath[] = [];
  private _attachment?: EnhancementAttachment;
  private _irreversible = false;
  private _addsFunctionalities: SpotFunctionalityDef[] = [];
  private _affectorPackIds: AffectorPackRef[] = [];
  private _revealTriggers: RevealTrigger[] = [];
  private _extra?: ExtraCompound;
  constructor(id: EnhancementId) { this._id = id; }
  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  effects(...effs: Effect[]): this { this._effects.push(...effs); return this; }
  autoApply(): this { this._autoApply = true; return this; }
  maxStacks(value: number): this { this._maxStacks = value; return this; }
  price(...entries: ResourceAmount[]): this { this._price = entries; return this; }
  cost(resourceId: string, amount: number): this { this._price = [{ resourceId, amount }]; return this; }
  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  attachArea(areaId: AreaId): this { this._attachment = { kind: 'area', areaId }; return this; }
  attachInit(initId: InitId): this { this._attachment = { kind: 'init', initId }; return this; }
  attachGlobal(): this { this._attachment = { kind: 'global' }; return this; }
  irreversible(): this { this._irreversible = true; return this; }
  addsFunctionality(...defs: SpotFunctionalityDef[]): this { this._addsFunctionalities.push(...defs); return this; }
  affectorPack(id: AffectorPackRef): this { this._affectorPackIds.push(id); return this; }
  affectorPacks(...ids: AffectorPackRef[]): this { this._affectorPackIds.push(...ids); return this; }
  reveal(target: RevealTarget, condition?: Condition | ConditionGroup): this { this._revealTriggers.push(condition ? { reveal: target, condition } : { reveal: target }); return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }
  build(): EnhancementDef {
    if (!this._name) throw new Error(`EnhancementBuilder(${this._id}): name 未设置`);
    if (!this._description) throw new Error(`EnhancementBuilder(${this._id}): description 未设置`);
    const def: EnhancementDef = { id: this._id, name: this._name, description: this._description, effects: this._effects, autoApply: this._autoApply };
    if (this._maxStacks !== undefined) def.maxStacks = this._maxStacks;
    if (this._price) def.price = this._price;
    if (this._tags.length) def.tags = this._tags;
    if (this._attachment) def.attachment = this._attachment;
    if (this._irreversible) def.irreversible = true;
    if (this._addsFunctionalities.length) def.addsFunctionalities = this._addsFunctionalities;
    if (this._affectorPackIds.length) def.affectorPackIds = this._affectorPackIds;
    if (this._revealTriggers.length) def.revealTriggers = this._revealTriggers;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}
export const enhancement = (id: EnhancementId): EnhancementBuilder => new EnhancementBuilder(id);
