// ============================================================
// engine/def-factory/color-group.ts — ColorGroupDef 链式 Builder
// 构造颜色组（预制头像构成模板）。.build() 返回标准 ColorGroupDef。
// ============================================================

import type {
  ColorGroupDef,
  ColorGroupId,
  ColorGroupRole,
  ColorGroupSlot,
  ColorId,
  CompositionType,
} from '../types/character';

export class ColorGroupBuilder {
  private readonly _id: ColorGroupId;
  private _name = '';
  private _description?: string;
  private _compositionType: CompositionType = 'solid';
  private readonly _slots: ColorGroupSlot[] = [];

  constructor(id: ColorGroupId) {
    this._id = id;
  }

  name(value: string): this { this._name = value; return this; }
  desc(value: string): this { this._description = value; return this; }

  /** 构成方式（solid/gradient/duotone/pie/radial）。 */
  type(value: CompositionType): this { this._compositionType = value; return this; }

  /** 追加一个色位（role + colorId）。 */
  slot(role: ColorGroupRole, colorId: ColorId): this {
    this._slots.push({ role, colorId });
    return this;
  }

  build(): ColorGroupDef {
    if (!this._name) throw new Error(`ColorGroupBuilder(${this._id}): name 未设置`);
    if (this._slots.length === 0) throw new Error(`ColorGroupBuilder(${this._id}): 至少 1 个色位`);
    const def: ColorGroupDef = {
      id: this._id,
      name: this._name,
      compositionType: this._compositionType,
      slots: this._slots,
    };
    if (this._description) def.description = this._description;
    return def;
  }
}

export const colorGroup = (id: ColorGroupId): ColorGroupBuilder => new ColorGroupBuilder(id);
