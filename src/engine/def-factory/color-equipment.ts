// ============================================================
// engine/def-factory/color-equipment.ts — ColorEquipmentDef 链式 Builder
// 构造色彩装备（收集品：颜色组 + 效用 + 可选主题色）。.build() 返回标准 ColorEquipmentDef。
// ============================================================

import type { Condition, ConditionGroup, Effect } from '../types/expression';
import type { Character } from '../types/ids';
import type {
  ColorEquipmentDef,
  ColorGroupId,
  ColorId,
  EquipmentId,
} from '../types/character';
import { cond } from './condition';

export class ColorEquipmentBuilder {
  private readonly _id: EquipmentId;
  private _name = '';
  private _description?: string;
  private _colorGroupId = '';
  private readonly _effects: Effect[] = [];
  private _themeColorId?: ColorId;
  private _unlock?: Condition | ConditionGroup;
  private _category?: 'common' | 'rare' | 'epic';

  constructor(id: EquipmentId) {
    this._id = id;
  }

  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }

  /** 引用的颜色组（决定装备学生的头像视觉）。 */
  colorGroup(id: ColorGroupId): this { this._colorGroupId = id; return this; }

  /** 追加数值效用（装备后生效）。 */
  effects(...effs: Effect[]): this { this._effects.push(...effs); return this; }

  /** 关联主题色（激活为 UI 全局主题时使用）。 */
  themeColor(id: ColorId): this { this._themeColorId = id; return this; }

  /** 稀有度分类（UI 展示用）。 */
  category(value: 'common' | 'rare' | 'epic'): this { this._category = value; return this; }

  unlock(condition: Condition | ConditionGroup): this { this._unlock = condition; return this; }

  /** 获得指定原型角色 ≥ 次数后解锁。 */
  unlockProtoStat(character: Character, minAcquired = 1): this {
    this._unlock = cond('protoStat', String(character), '>=', minAcquired);
    return this;
  }

  /** flag 置 1 后解锁。 */
  unlockFlag(flag: string): this {
    this._unlock = cond('flag', flag, '>=', 1);
    return this;
  }

  build(): ColorEquipmentDef {
    if (!this._name) throw new Error(`ColorEquipmentBuilder(${this._id}): name 未设置`);
    if (!this._colorGroupId) throw new Error(`ColorEquipmentBuilder(${this._id}): colorGroup 未设置`);
    const def: ColorEquipmentDef = {
      id: this._id,
      name: this._name,
      colorGroupId: this._colorGroupId,
      effects: this._effects,
    };
    if (this._description) def.description = this._description;
    if (this._themeColorId) def.themeColorId = this._themeColorId;
    if (this._unlock) def.unlock = this._unlock;
    if (this._category) def.category = this._category;
    return def;
  }
}

export const colorEquipment = (id: EquipmentId): ColorEquipmentBuilder => new ColorEquipmentBuilder(id);
