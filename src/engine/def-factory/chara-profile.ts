// ============================================================
// engine/def-factory/chara-profile.ts — CharaProfileDef 链式 Builder
// ============================================================

import type { Character } from '../types/ids';
import type { CharaProfileDef, CharaNameEntry, CharaAvatarEntry } from '../types/chara-profile';
import type { PicId } from '../types/pics';

export class CharaProfileBuilder {
  private readonly _id: Character;
  private readonly _names: CharaNameEntry[] = [];
  private readonly _avatars: CharaAvatarEntry[] = [];
  private _activeName?: string;
  private _activeAvatar?: string;

  constructor(id: Character) {
    this._id = id;
  }

  /** 添加 name 表条目。第一条自动成为 activeName（若未显式设）。 */
  name(id: string, text: string): this {
    this._names.push({ id, text });
    return this;
  }

  /** 添加 avatar 表条目。第一条自动成为 activeAvatar（若未显式设）。 */
  avatar(id: string, pic: PicId): this {
    this._avatars.push({ id, pic });
    return this;
  }

  /** 当前使用的 name id（缺省 = names[0]）。 */
  activeName(id: string): this {
    this._activeName = id;
    return this;
  }

  /** 当前使用的 avatar id（缺省 = avatars[0]）。 */
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