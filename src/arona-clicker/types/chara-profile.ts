import type { Character } from './ids';
import type { PicId } from '../../data-services/contracts/pic';

export interface CharaCustomOverride {
  nameId?: string;
  avatarId?: string;
  name?: string;
  avatar?: PicId;
}

export interface CharaProfile {
  character: Character | null;
  name: string;
  avatar?: string;
  nameId?: string;
  avatarId?: string;
  nameFrom: 'declared' | 'player' | 'override' | 'proto' | 'none';
  avatarFrom: 'declared' | 'player' | 'override' | 'none';
}
