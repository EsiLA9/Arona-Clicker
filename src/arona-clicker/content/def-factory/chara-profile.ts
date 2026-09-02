import type { Character } from '../../types/ids';
import type { CharaProfileDef, CharaNameEntry, CharaAvatarEntry } from '../../../data-services/contracts/chara-profile';
import type { PicId } from '../../../data-services/contracts/pic';

export class CharaProfileBuilder {
  private readonly _id: Character;
  private readonly _names: CharaNameEntry[] = [];
  private readonly _avatars: CharaAvatarEntry[] = [];
  private _activeName?: string;
  private _activeAvatar?: string;

  constructor(id: Character) {
    this._id = id;
  }

  name(id: string, text: string): this {
    this._names.push({ id, text });
    return this;
  }

  avatar(id: string, pic: PicId): this {
    this._avatars.push({ id, pic });
    return this;
  }

  activeName(id: string): this {
    this._activeName = id;
    return this;
  }

  activeAvatar(id: string): this {
    this._activeAvatar = id;
    return this;
  }

  build(): CharaProfileDef {
    if (this._names.length === 0) {
      throw new Error(`CharaProfileBuilder(${this._id}): name 表至少一条`);
    }
    const def: CharaProfileDef = {
      id: this._id,
      names: this._names,
      avatars: this._avatars,
    };
    if (this._activeName) def.activeName = this._activeName;
    if (this._activeAvatar) def.activeAvatar = this._activeAvatar;
    return def;
  }
}

export const charaProfile = (id: Character): CharaProfileBuilder =>
  new CharaProfileBuilder(id);
