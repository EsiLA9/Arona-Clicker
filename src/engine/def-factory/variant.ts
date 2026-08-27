// ============================================================
// engine/def-factory/variant.ts — CharacterVariantDef 链式 Builder
// ============================================================

import type { ExtraCompound } from '../types/extra';
import type { Character, CharacterRarity, CharacterSchool } from '../types/ids';
import type { CharacterVariantDef, ColorGroupId, CultivateCurveId, ThemeDef, VariantId } from '../types/character';

export class CharacterVariantBuilder {
  private readonly _id: VariantId;
  private readonly _proto: Character;
  private _name = '';
  private _displayName = '';
  private _school?: CharacterSchool;
  private _rarity?: CharacterRarity;
  private _description = '';
  private _isDefault = false;
  private _spotTagBonus?: Record<string, number>;
  private _curve?: CultivateCurveId;
  private _theme?: ThemeDef;
  private _avatar?: string;
  private _colorGroupId?: ColorGroupId;
  private _extra?: ExtraCompound;

  constructor(id: VariantId, proto: Character) {
    this._id = id;
    this._proto = proto;
  }

  name(value: string): this { this._name = value; return this; }
  displayName(value: string): this { this._displayName = value; return this; }
  school(value: CharacterSchool): this { this._school = value; return this; }
  rarity(value: CharacterRarity): this { this._rarity = value; return this; }
  desc(value: string): this { this._description = value; return this; }

  /** 默认差分（图鉴主展示，每原型至多一个）。 */
  default(): this { this._isDefault = true; return this; }

  bonus(tag: string, multiplier: number): this {
    this._spotTagBonus = { ...(this._spotTagBonus ?? {}), [tag]: multiplier };
    return this;
  }

  /** @label 培养曲线 */
  curve(id: CultivateCurveId): this { this._curve = id; return this; }
  /** @label 对话主题 */
  theme(colorId?: string, tokens?: Record<string, string>): this {
    this._theme = tokens ? { colorId, tokens } : (colorId ? { colorId } : {});
    return this;
  }
  /** @label 头像 */
  avatar(value: string): this { this._avatar = value; return this; }
  /** @label 默认头像色组 */
  colorGroup(id: ColorGroupId): this { this._colorGroupId = id; return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }

  build(): CharacterVariantDef {
    if (!this._name) throw new Error(`CharacterVariantBuilder(${this._id}): name 未设置`);
    if (!this._displayName) throw new Error(`CharacterVariantBuilder(${this._id}): displayName 未设置`);
    if (!this._school) throw new Error(`CharacterVariantBuilder(${this._id}): school 未设置`);
    if (!this._rarity) throw new Error(`CharacterVariantBuilder(${this._id}): rarity 未设置`);
    if (!this._description) throw new Error(`CharacterVariantBuilder(${this._id}): description 未设置`);
    const def: CharacterVariantDef = {
      id: this._id,
      proto: this._proto,
      name: this._name,
      displayName: this._displayName,
      school: this._school,
      rarity: this._rarity,
      description: this._description,
    };
    if (this._isDefault) def.isDefault = true;
    if (this._spotTagBonus) def.spotTagBonus = this._spotTagBonus;
    if (this._curve) def.curve = this._curve;
    if (this._theme) def.theme = this._theme;
    if (this._avatar) def.avatar = this._avatar;
    if (this._colorGroupId) def.colorGroupId = this._colorGroupId;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}

export const variant = (id: VariantId, proto: Character): CharacterVariantBuilder =>
  new CharacterVariantBuilder(id, proto);