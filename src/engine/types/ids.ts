// ============================================================
// engine/types/ids.ts — ID 类型、枚举与全局资源标识
// ============================================================

// --- 基础 ID 类型 ---

export type InitId = string;
export type AreaId = string;
export type SpotId = string;
export type EnhancementId = string;
export type StoryId = string;
export type ItemId = string;
export type FuncletId = string;

// --- 资源枚举 ---

/** 资源 ID 采用三段式：base:resource:credit */
export enum Resource {
  Credit = 'base:resource:credit',
  Pyroxene = 'base:resource:pyroxene',
}

/**
 * 跨世界线保留的全局资源（Global）：
 * 存放在 PlayerState.globalResources 中，不受 Init 切换 / 快照 / 清除影响。
 * 青辉石：唯一已知来源为被动闲聊（PassiveTalk）的初次/重复完结奖励。
 */
export const GLOBAL_RESOURCE_IDS: ReadonlySet<string> = new Set<string>([Resource.Pyroxene]);

/** 判断某资源是否为跨世界线的全局资源。 */
export function isGlobalResource(resourceId: string): boolean {
  return GLOBAL_RESOURCE_IDS.has(resourceId);
}

// --- 角色枚举 ---

export enum Character {
  None = 'none',
  // === Schale (夏莱) ===
  Arona = 'arona',
  // === Abydos (阿比多斯) ===
  Shiroko = 'shiroko',
  Hoshino = 'hoshino',
  Nonomi = 'nonomi',
  Serika = 'serika',
  Ayane = 'ayane',
  // === Millennium (千禧年) ===
  Yuuka = 'yuuka',
  Noa = 'noa',
  Midori = 'midori',
  Momoi = 'momoi',
  Koyuki = 'koyuki',
  // === Trinity (崔妮蒂) ===
  Hifumi = 'hifumi',
  Nagisa = 'nagisa',
  Mika = 'mika',
  Koharu = 'koharu',
  // === Gehenna (盖赫纳) ===
  Ako = 'ako',
  Iori = 'iori',
  Mutsuki = 'mutsuki',
  Aru = 'aru',
  // === SRT ===
  Miyu = 'miyu',
  Miyako = 'miyako',
  Saki = 'saki',
  Moe = 'moe',
  // === Arius (阿里乌斯) ===
  Saori = 'saori',
  Atsuko = 'atsuko',
  // === Hyakkiyako (百鬼夜行) ===
  Chise = 'chise',
  Izuna = 'izuna',
  // === Shanhaijing (山海经) ===
  Shun = 'shun',
  Rumi = 'rumi',
  // === Red Winter (红冬) ===
  Cherino = 'cherino',
  Tomoe = 'tomoe',
  // === Valkyrie (瓦尔基里) ===
  Kanna = 'kanna',
  Kirino = 'kirino',
}

export enum CharacterRarity {
  Common = 'common',
  Rare = 'rare',
  SuperRare = 'super_rare',
}

export enum CharacterSchool {
  Schale = '夏莱',
  Abydos = '阿比多斯',
  Millennium = '千禧年',
  Trinity = '崔妮蒂',
  Gehenna = '盖赫纳',
  SRT = 'SRT',
  Arius = '阿里乌斯',
  Hyakkiyako = '百鬼夜行',
  Shanhaijing = '山海经',
  RedWinter = '红冬',
  Valkyrie = '瓦尔基里',
}
