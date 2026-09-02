import type { Character } from '../../engine/types/ids';
import type { PicId } from './pic';

export interface CharaNameEntry {
  id: string;
  text: string;
}

export interface CharaAvatarEntry {
  id: string;
  pic: PicId;
}

export interface CharaProfileDef {
  id: Character;
  names: CharaNameEntry[];
  avatars: CharaAvatarEntry[];
  activeName?: string;
  activeAvatar?: string;
}
