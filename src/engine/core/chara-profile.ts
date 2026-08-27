// ============================================================
// engine/core/chara-profile.ts — Chara 头像-人名对解析（纯函数）
//
// 解析管线（低 → 高优先级）：
//   兜底(CharacterData.displayName / 无头像)
//     → chara 表 activeName/activeAvatar（declared）
//     → PlayerState.charaCustom（player）
//     → 调用点 overrides（override）
// 头像一律是 PicId，最终经 getPicUrl 解析成可显示 URL。
// ============================================================

import type { Registry } from '../registry/registry';
import type { Character } from '../types/ids';
import type { PicId } from '../types/pics';
import type { CharaCustomOverride, CharaProfile, CharaProfileDef } from '../types/chara-profile';

export interface CharaProfileOverrides {
  /** 本次调用的临时显示名（最高优先级） */
  name?: string;
  /** 本次调用的临时头像 PicId（最高优先级） */
  avatar?: PicId;
}

export function resolveCharaProfile(
  registry: Registry,
  charaCustom: Partial<Record<Character, CharaCustomOverride>> | undefined,
  getPicUrl: (pic: PicId) => string | undefined,
  character: Character | null,
  overrides?: CharaProfileOverrides,
): CharaProfile {
  const profile = character !== null ? registry.charaProfiles.get(character) : undefined;
  const custom = character !== null ? charaCustom?.[character] : undefined;

  const name = resolveName(registry, profile, custom, character, overrides?.name);
  const avatar = resolveAvatar(registry, profile, custom, character, overrides?.avatar, getPicUrl);

  return {
    character,
    name: name.text,
    ...(name.id !== undefined ? { nameId: name.id } : {}),
    ...(avatar.id !== undefined ? { avatarId: avatar.id } : {}),
    nameFrom: name.from,
    avatarFrom: avatar.from,
    ...(avatar.url !== undefined ? { avatar: avatar.url } : {}),
  };
}

interface NameResolved { text: string; id?: string; from: CharaProfile['nameFrom'] }
interface AvatarResolved { url?: string; id?: string; from: CharaProfile['avatarFrom'] }

function resolveName(
  registry: Registry,
  profile: CharaProfileDef | undefined,
  custom: CharaCustomOverride | undefined,
  character: Character | null,
  overrideName?: string,
): NameResolved {
  if (overrideName !== undefined) return { text: overrideName, from: 'override' };
  if (custom?.name !== undefined) return { text: custom.name, from: 'player' };
  if (custom?.nameId !== undefined && profile) {
    const entry = profile.names.find(n => n.id === custom.nameId);
    if (entry) return { text: entry.text, id: entry.id, from: 'player' };
  }
  if (profile) {
    const activeId = profile.activeName ?? profile.names[0]?.id;
    const entry = profile.names.find(n => n.id === activeId) ?? profile.names[0];
    if (entry) return { text: entry.text, id: entry.id, from: 'declared' };
  }
  if (character !== null) {
    const protoName = registry.characters.get(character)?.displayName;
    if (protoName) return { text: protoName, from: 'proto' };
    return { text: character, from: 'proto' };
  }
  return { text: '', from: 'none' };
}

function resolveAvatar(
  registry: Registry,
  profile: CharaProfileDef | undefined,
  custom: CharaCustomOverride | undefined,
  character: Character | null,
  overrideAvatar: PicId | undefined,
  getPicUrl: (pic: PicId) => string | undefined,
): AvatarResolved {
  let pic: PicId | undefined;
  let id: string | undefined;
  let from: CharaProfile['avatarFrom'] = 'none';

  if (overrideAvatar !== undefined) {
    pic = overrideAvatar;
    from = 'override';
  } else if (custom?.avatar !== undefined) {
    pic = custom.avatar;
    from = 'player';
  } else if (custom?.avatarId !== undefined && profile) {
    const entry = profile.avatars.find(a => a.id === custom.avatarId);
    if (entry) {
      pic = entry.pic;
      id = entry.id;
      from = 'player';
    }
  }
  if (pic === undefined && profile) {
    const activeId = profile.activeAvatar ?? profile.avatars[0]?.id;
    const entry = profile.avatars.find(a => a.id === activeId) ?? profile.avatars[0];
    if (entry) {
      pic = entry.pic;
      id = entry.id;
      from = 'declared';
    }
  }
  if (pic === undefined) return { from: 'none' };
  const url = getPicUrl(pic);
  return { ...(url !== undefined ? { url } : {}), ...(id !== undefined ? { id } : {}), from };
}