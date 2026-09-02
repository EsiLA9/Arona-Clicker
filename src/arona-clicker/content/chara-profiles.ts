import { charaProfile } from './def-factory/chara-profile';
import { Character } from '../types/ids';
import type { CharaProfileDef } from '../../data-services/contracts/chara-profile';

export const baseCharaProfiles: CharaProfileDef[] = [
  charaProfile(Character.Hoshino)
    .name('default', '小鸟游星野')
    .name('nickname', '星野酱')
    .avatar('default', 'base:avatar(pic):hoshino')
    .activeAvatar('default')
    .build(),
];
