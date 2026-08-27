// ============================================================
// data/base/chara-profiles.ts — 默认 Chara 头像-人名对声明
// 每个原型一张表：name 表 + avatar 表 + 当前使用 id。
// 头像一律为 PicId（指向 pics 表），不持有裸 URL。
// ============================================================

import { charaProfile, Character } from '../../engine/types';
import type { CharaProfileDef } from '../../engine/types';

export const baseCharaProfiles: CharaProfileDef[] = [
  charaProfile(Character.Hoshino)
    .name('default', '小鸟游星野')
    .name('nickname', '星野酱')
    .avatar('default', 'base:avatar(pic):hoshino')
    .activeAvatar('default')
    .build(),
];