/** AronaClicker 产品资源标识与跨世界线资源规则。 */
export enum Resource {
  Credit = 'base:resource:credit',
  Pyroxene = 'base:resource:pyroxene',
}

export const GLOBAL_RESOURCE_IDS: ReadonlySet<string> = new Set<string>([Resource.Pyroxene]);

export function isGlobalResource(resourceId: string): boolean {
  return GLOBAL_RESOURCE_IDS.has(resourceId);
}

export const Character = {
  None: 'none',
  Arona: 'arona', Shiroko: 'shiroko', Hoshino: 'hoshino', Nonomi: 'nonomi', Serika: 'serika', Ayane: 'ayane',
  Yuuka: 'yuuka', Noa: 'noa', Midori: 'midori', Momoi: 'momoi', Koyuki: 'koyuki',
  Hifumi: 'hifumi', Nagisa: 'nagisa', Mika: 'mika', Koharu: 'koharu',
  Ako: 'ako', Iori: 'iori', Mutsuki: 'mutsuki', Aru: 'aru',
  Miyu: 'miyu', Miyako: 'miyako', Saki: 'saki', Moe: 'moe',
  Saori: 'saori', Atsuko: 'atsuko', Chise: 'chise', Izuna: 'izuna',
  Shun: 'shun', Rumi: 'rumi', Cherino: 'cherino', Tomoe: 'tomoe', Kanna: 'kanna', Kirino: 'kirino',
} as const;
export type Character = string;

export const CharacterRarity = {
  Common: 'common', Rare: 'rare', SuperRare: 'super_rare',
} as const;
export type CharacterRarity = string;

export const CharacterSchool = {
  Schale: '夏莱', Abydos: '阿比多斯', Millennium: '千禧年', Trinity: '崔妮蒂', Gehenna: '盖赫纳',
  SRT: 'SRT', Arius: '阿里乌斯', Hyakkiyako: '百鬼夜行', Shanhaijing: '山海经', RedWinter: '红冬', Valkyrie: '瓦尔基里',
} as const;
export type CharacterSchool = string;
