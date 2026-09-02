import type { Condition, ConditionGroup } from '../../../engine/types/expression';
import type { Character } from '../../types/ids';
import type { ColorGroupDef, ColorGroupRole, ColorGroupSlot, CompositionType } from '../../../data-services/contracts/color';
import type { ColorGroupId } from '../../../engine/types/character';
import type { ThemeToken } from '../../../engine/types/theme';
import { cond } from '../../../engine/def-factory/condition';

export class ColorGroupBuilder {
  private readonly _id: ColorGroupId;
  private _name = '';
  private _description?: string;
  private _compositionType: CompositionType = 'solid';
  private readonly _slots: ColorGroupSlot[] = [];
  private _theme: Partial<Record<ThemeToken, string>> = {};
  private _unlock?: Condition | ConditionGroup;

  constructor(id: ColorGroupId) { this._id = id; }
  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  type(value: CompositionType): this { this._compositionType = value; return this; }
  slot(role: ColorGroupRole, color: string): this { this._slots.push({ role, color }); return this; }
  primary(color: string): this { return this.slot('primary', color); }
  theme(tokens: Partial<Record<ThemeToken, string>>): this { this._theme = { ...this._theme, ...tokens }; return this; }
  unlock(condition: Condition | ConditionGroup): this { this._unlock = condition; return this; }
  unlockProtoStat(character: Character, minAcquired = 1): this { this._unlock = cond('protoStat', String(character), '>=', minAcquired); return this; }
  unlockFlag(flag: string): this { this._unlock = cond('flag', flag, '>=', 1); return this; }

  build(): ColorGroupDef {
    if (!this._name) throw new Error(`ColorGroupBuilder(${this._id}): name 未设置`);
    if (this._slots.length === 0) throw new Error(`ColorGroupBuilder(${this._id}): 至少 1 个色位`);
    const def: ColorGroupDef = { id: this._id, name: this._name, compositionType: this._compositionType, slots: this._slots };
    if (this._description) def.description = this._description;
    if (Object.keys(this._theme).length > 0) def.theme = this._theme;
    if (this._unlock) def.unlock = this._unlock;
    return def;
  }
}

export const colorGroup = (id: ColorGroupId): ColorGroupBuilder => new ColorGroupBuilder(id);
