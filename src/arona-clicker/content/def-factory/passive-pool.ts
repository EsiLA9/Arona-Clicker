import type { TagPath } from '../../../engine/core/tag';
import type { ConditionGroup } from '../../../engine/types/expression';
import type { PassivePoolChild, PassivePoolDef } from '../../../data-services/contracts/passive-pool';

export class PassivePoolBuilder {
  private readonly _id: string; private _name?: string; private _tags: TagPath[] = [];
  private _condition?: ConditionGroup; private _owner?: string; private _cooldownFrames?: number;
  private _children: PassivePoolChild[] = [];
  constructor(id: string) { this._id = id; }
  name(value: string): this { this._name = value; return this; }
  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  condition(group: ConditionGroup): this { this._condition = group; return this; }
  owner(variantId: string): this { this._owner = variantId; return this; }
  cooldownFrames(value: number): this { this._cooldownFrames = value; return this; }
  child(id: string, weight?: number): this { this._children.push(weight !== undefined ? { id, weight } : { id }); return this; }
  build(): PassivePoolDef {
    const def: PassivePoolDef = { id: this._id, children: this._children };
    if (this._name) def.name = this._name; if (this._tags.length) def.tags = this._tags;
    if (this._condition) def.condition = this._condition; if (this._owner) def.owner = this._owner;
    if (this._cooldownFrames !== undefined) def.cooldownFrames = this._cooldownFrames; return def;
  }
}
export const passivePool = (id: string): PassivePoolBuilder => new PassivePoolBuilder(id);
