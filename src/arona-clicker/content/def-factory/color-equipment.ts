import type { Condition, ConditionGroup, Effect } from '../../../engine/types/expression';
import type { Character } from '../../types/ids';
import type { ColorEquipmentDef } from '../../../data-services/contracts/color';
import type { ColorGroupId } from '../../../engine/types/character';
import type { EquipmentId } from '../../types/character';
import { cond } from '../../../engine/def-factory/condition';

export class ColorEquipmentBuilder {
  private readonly _id: EquipmentId;
  private _name = '';
  private _description?: string;
  private _colorGroupId = '';
  private readonly _effects: Effect[] = [];
  private _unlock?: Condition | ConditionGroup;
  private _category?: 'common' | 'rare' | 'epic';

  constructor(id: EquipmentId) { this._id = id; }
  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  colorGroup(id: ColorGroupId): this { this._colorGroupId = id; return this; }
  effects(...effs: Effect[]): this { this._effects.push(...effs); return this; }
  category(value: 'common' | 'rare' | 'epic'): this { this._category = value; return this; }
  unlock(condition: Condition | ConditionGroup): this { this._unlock = condition; return this; }
  unlockProtoStat(character: Character, minAcquired = 1): this { this._unlock = cond('protoStat', String(character), '>=', minAcquired); return this; }
  unlockFlag(flag: string): this { this._unlock = cond('flag', flag, '>=', 1); return this; }

  build(): ColorEquipmentDef {
    if (!this._name) throw new Error(`ColorEquipmentBuilder(${this._id}): name 未设置`);
    if (!this._colorGroupId) throw new Error(`ColorEquipmentBuilder(${this._id}): colorGroup 未设置`);
    const def: ColorEquipmentDef = { id: this._id, name: this._name, colorGroupId: this._colorGroupId, effects: this._effects };
    if (this._description) def.description = this._description;
    if (this._unlock) def.unlock = this._unlock;
    if (this._category) def.category = this._category;
    return def;
  }
}

export const colorEquipment = (id: EquipmentId): ColorEquipmentBuilder => new ColorEquipmentBuilder(id);
