// ============================================================
// engine/def-factory/passive-pool.ts — PassivePoolDef 链式 Builder
// ============================================================

import type { TagPath } from '../core/tag';
import type { ConditionGroup } from '../types/expression';
import type { PassivePoolChild, PassivePoolDef } from '../types/content';

export class PassivePoolBuilder {
  private readonly _id: string;
  private _name?: string;
  private _tags: TagPath[] = [];
  private _condition?: ConditionGroup;
  private _owner?: string;
  private _cooldownFrames?: number;
  private _children: PassivePoolChild[] = [];

  constructor(id: string) {
    this._id = id;
  }

  name(value: string): this { this._name = value; return this; }
  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  /** 池 gate：不满足时整棵子树退出候选。 */
  condition(group: ConditionGroup): this { this._condition = group; return this; }
  /** 归属某学生差分的对话空间（VariantId）。 */
  owner(variantId: string): this { this._owner = variantId; return this; }
  cooldownFrames(value: number): this { this._cooldownFrames = value; return this; }

  /** 子节点（子池或 entry 引用），weight 缺省 1。 */
  child(id: string, weight?: number): this {
    this._children.push(weight !== undefined ? { id, weight } : { id });
    return this;
  }

  build(): PassivePoolDef {
    const def: PassivePoolDef = { id: this._id, children: this._children };
    if (this._name) def.name = this._name;
    if (this._tags.length) def.tags = this._tags;
    if (this._condition) def.condition = this._condition;
    if (this._owner) def.owner = this._owner;
    if (this._cooldownFrames !== undefined) def.cooldownFrames = this._cooldownFrames;
    return def;
  }
}

export const passivePool = (id: string): PassivePoolBuilder => new PassivePoolBuilder(id);