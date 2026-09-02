import type { TagPath } from '../../../engine/core/tag';
import type { ExtraCompound } from '../../../engine/types/extra';
import type { Character, CharacterRarity, CharacterSchool } from '../../types/ids';
import type { CharacterData } from '../../types/character';

export class CharacterBuilder {
  private readonly _id: Character;
  private _name = '';
  private _displayName = '';
  private _school?: CharacterSchool;
  private _rarity?: CharacterRarity;
  private _description = '';
  private _spotTagBonus: Record<string, number> = {};
  private _passiveDescription = '';
  private _tags: TagPath[] = [];
  private _extra?: ExtraCompound;
  constructor(id: Character) { this._id = id; }
  name(value: string): this { this._name = value; return this; }
  displayName(value: string): this { this._displayName = value; return this; }
  school(value: CharacterSchool): this { this._school = value; return this; }
  rarity(value: CharacterRarity): this { this._rarity = value; return this; }
  desc(value: string): this { this._description = value; return this; }
  bonus(tag: string, multiplier: number): this { this._spotTagBonus[tag] = multiplier; return this; }
  passive(value: string): this { this._passiveDescription = value; return this; }
  tags(...paths: TagPath[]): this { this._tags.push(...paths); return this; }
  extra(value: ExtraCompound): this { this._extra = value; return this; }
  build(): CharacterData {
    if (!this._name) throw new Error(`CharacterBuilder(${this._id}): name 未设置`);
    if (!this._displayName) throw new Error(`CharacterBuilder(${this._id}): displayName 未设置`);
    if (!this._school) throw new Error(`CharacterBuilder(${this._id}): school 未设置`);
    if (!this._rarity) throw new Error(`CharacterBuilder(${this._id}): rarity 未设置`);
    if (!this._description) throw new Error(`CharacterBuilder(${this._id}): description 未设置`);
    const def: CharacterData = { id: this._id, name: this._name, displayName: this._displayName, school: this._school, rarity: this._rarity, description: this._description, spotTagBonus: this._spotTagBonus, passiveDescription: this._passiveDescription };
    if (this._tags.length) def.tags = this._tags;
    if (this._extra) def.extra = this._extra;
    return def;
  }
}
export const character = (id: Character): CharacterBuilder => new CharacterBuilder(id);
