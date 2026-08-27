// ============================================================
// engine/types/chara-profile.ts — Chara 头像-人名对声明表
//
// Chara 侧持有自己的 name 表 + avatar 表 + 当前使用的 id。
// 所有 name/avatar 的裸 URL 唯一来源是 PicDef 表（PicId），
// 本表只存 PicId，不得持有裸 URL。
// ============================================================

import type { Character } from './ids';
import type { PicId } from './pics';

/** name 表条目 */
export interface CharaNameEntry {
  /** 条目 id（如 'default' / 'nickname'） */
  id: string;
  /** 显示名文本 */
  text: string;
}

/** avatar 表条目 */
export interface CharaAvatarEntry {
  /** 条目 id（如 'default' / 'swimsuit' / 'chibi'） */
  id: string;
  /** 图片索引 PicId（不得持有裸 URL） */
  pic: PicId;
}

/**
 * Chara 头像-人名对声明。
 * 每个 Character 原型一条；chara 侧持有自己的名字表、头像表、当前使用。
 */
export interface CharaProfileDef {
  /** 原型 id（chara 侧持有） */
  id: Character;
  /** name 表（至少一条） */
  names: CharaNameEntry[];
  /** avatar 表（可选，无头像则为空） */
  avatars: CharaAvatarEntry[];
  /** 当前使用的 name id；缺省 = names[0].id */
  activeName?: string;
  /** 当前使用的 avatar id；缺省 = avatars[0].id（avatars 为空则无） */
  activeAvatar?: string;
}

/** 玩家侧对 chara 的自定义覆写（随存档持久化）。 */
export interface CharaCustomOverride {
  /** 玩家选了一个 name 表条目（表内选） */
  nameId?: string;
  /** 玩家选了一个 avatar 表条目（表内选） */
  avatarId?: string;
  /** 完全自定义名（不进表，优先级最高） */
  name?: string;
  /** 完全自定义头像 PicId（不进表，优先级最高） */
  avatar?: PicId;
}

/** characterProfile 返回的解析结果。 */
export interface CharaProfile {
  character: Character | null;
  /** 最终展示名。 */
  name: string;
  /** 已解析的头像 URL（可直接给 <img>）；未设则 undefined。 */
  avatar?: string;
  /** 命中的 name 表条目 id（debug/溯源）。 */
  nameId?: string;
  /** 命中的 avatar 表条目 id（debug/溯源）。 */
  avatarId?: string;
  /** name 来源层 */
  nameFrom: 'declared' | 'player' | 'override' | 'proto' | 'none';
  /** avatar 来源层 */
  avatarFrom: 'declared' | 'player' | 'override' | 'none';
}