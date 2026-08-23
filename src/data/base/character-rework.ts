// ============================================================
// data/base/character-rework.ts — Character 重构基础数据
//
// 差分 / 培养曲线 / 色彩 / 卡池 / 聊天流 / 三层归属声明。
// 设计文档：docs-818/12-character-rework.md；测试规格：12-character-rework-tests.md。
// ============================================================

import {
  ActiveStoryEntry,
  and,
  Character,
  CharacterPersistConfig,
  CharacterRarity,
  CharacterSchool,
  CharacterVariantDef,
  ChatMessageDef,
  ColorDef,
  CultivateCurveDef,
  GachaMode,
  GachaPoolDef,
  Resource,
  StoryDef,
  ThemeToken,
} from '../../engine/types';
import { extra } from '../../engine/extra';
import { allCharacters } from './characters';

/** 全局默认培养曲线：上限 30 级、线性经验、5 星突破每星 +5 级上限。 */
export const baseCultivateCurves: CultivateCurveDef[] = [
  {
    id: 'base:curve:standard',
    maxLevel: 30,
    expTable: Array.from({ length: 34 }, (_, i) => 100 * (i + 1)),
    starMax: 5,
    starCost: [1, 3, 10, 30, 60],
    levelCapPerStar: 5,
  },
];

/**
 * 默认差分：每个原型一个 isDefault 差分（id = 原型 id 首字母大写），
 * spotTagBonus 沿用原型旧表（字段冻结预留，不参与计算）。
 */
function defaultVariants(): CharacterVariantDef[] {
  return allCharacters
    .filter(c => c.id !== Character.None)
    .map(c => {
      const id = `${c.id.charAt(0).toUpperCase()}${c.id.slice(1)}`;
      // 千年学生：打开对话空间时界面切换为对应特色的对话主题
      const theme = id === 'Yuuka' || id === 'Noa'
        ? { colorId: 'base:color:violet', tokens: { primary: '#8b5cf6' } as Partial<Record<ThemeToken, string>> }
        : undefined;
      return {
        id,
        proto: c.id,
        name: c.name,
        displayName: c.displayName,
        school: c.school,
        rarity: c.rarity,
        description: c.description,
        isDefault: true,
        curve: 'base:curve:standard',
        colorSlots: 2,
        theme,
      };
    });
}

/** 特殊差分示例：与默认差分独立培养/碎片，验证差分隔离。 */
const specialVariants: CharacterVariantDef[] = [
  {
    id: 'HoshinoSwimsuit',
    proto: Character.Hoshino,
    name: '泳装星野',
    displayName: '小鸟游星野（泳装）',
    school: CharacterSchool.Abydos,
    rarity: CharacterRarity.SuperRare,
    description: '换上泳装的星野学长。夏日限定，慵懒依旧。',
    curve: 'base:curve:standard',
    colorSlots: 2,
  },
];

export const baseCharacterVariants: CharacterVariantDef[] = [...defaultVariants(), ...specialVariants];

/** 色彩：主题皮肤 + 轻数值效果，解锁条件引用经历/统计。 */
export const baseColors: ColorDef[] = [
  {
    id: 'base:color:schale-blue',
    name: '夏莱蓝',
    description: '什亭之匣的标准配色。获得阿罗娜后解锁。',
    theme: { primary: '#3b82f6' },
    unlock: { target: 'protoStat', key: String(Character.Arona), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:abydos-sand',
    name: '阿比多斯黄沙',
    description: '被沙漠侵蚀的学园配色。拥有星野（任一差分）后解锁。',
    theme: { primary: '#eab308' },
    unlock: { target: 'protoStat', key: String(Character.Hoshino), comparator: '>=', value: 1 },
    effects: [{ op: 'addResource', target: Resource.Credit, value: 0 }],
  },
  {
    id: 'base:color:momotalk-pink',
    name: 'Momotalk 粉',
    description: '聊天软件的主题色。完成欢迎剧情（flag）后解锁。',
    theme: { primary: '#ec4899' },
    unlock: { target: 'flag', key: 'momotalk_pink_unlocked', comparator: '>=', value: 1 },
  },
  // 多色相示例：获得对应学生原型即解锁，验证不同 primary 下 HSL 自动派生能力
  {
    id: 'base:color:hoshino-swim',
    name: '星野·泳装',
    description: '夏日泳池的清凉蓝调。拥有星野（任一差分）后解锁。',
    theme: { primary: '#3ec6e0' },
    unlock: { target: 'protoStat', key: String(Character.Hoshino), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:rose',
    name: '玫瑰',
    description: '获得白子后解锁。',
    theme: { primary: '#ff5d8f' },
    unlock: { target: 'protoStat', key: String(Character.Shiroko), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:emerald',
    name: '翡翠',
    description: '获得芹香后解锁。',
    theme: { primary: '#10b981' },
    unlock: { target: 'protoStat', key: String(Character.Serika), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:violet',
    name: '紫罗兰',
    description: '获得优香后解锁。',
    theme: { primary: '#8b5cf6' },
    unlock: { target: 'protoStat', key: String(Character.Yuuka), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:amber',
    name: '琥珀',
    description: '获得未花后解锁。',
    theme: { primary: '#f59e0b' },
    unlock: { target: 'protoStat', key: String(Character.Mika), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:crimson',
    name: '绯红',
    description: '获得伊织后解锁。',
    theme: { primary: '#e11d48' },
    unlock: { target: 'protoStat', key: String(Character.Iori), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:teal',
    name: '青碧',
    description: '获得都子后解锁。',
    theme: { primary: '#14b8a6' },
    unlock: { target: 'protoStat', key: String(Character.Miyako), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:indigo',
    name: '靛蓝',
    description: '获得纱织后解锁。',
    theme: { primary: '#6366f1' },
    unlock: { target: 'protoStat', key: String(Character.Saori), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:sky',
    name: '晴空',
    description: '获得阿罗娜后解锁（浅蓝变体）。',
    theme: { primary: '#38bdf8' },
    unlock: { target: 'protoStat', key: String(Character.Arona), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:lime',
    name: '青柠',
    description: '完成欢迎剧情（flag）后解锁。',
    theme: { primary: '#a3e635' },
    unlock: { target: 'flag', key: 'momotalk_pink_unlocked', comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:ink',
    name: '墨蓝',
    description: '拥有星野（任一差分）后解锁（深底变体）。',
    theme: { primary: '#1e3a5f' },
    unlock: { target: 'protoStat', key: String(Character.Hoshino), comparator: '>=', value: 1 },
    effects: [],
  },
  {
    id: 'base:color:coral',
    name: '珊瑚',
    description: '完成欢迎剧情（flag）后解锁（全量自定义覆盖示例）。',
    theme: { primary: '#ff7a59', bg: '#fff3ee', bgAlt: '#ffe6dc', text: '#3a1f17', textDim: '#8a6a5c', border: '#ffd0c0', accent: '#ff9e80' },
    unlock: { target: 'flag', key: 'momotalk_pink_unlocked', comparator: '>=', value: 1 },
    effects: [],
  },
];

/** 卡池：常驻池（全体默认差分）+ 泳装 UP 池。 */
export const baseGachaPools: GachaPoolDef[] = [
  {
    id: 'base:pool:regular',
    name: '常规招募',
    description: '常驻开放的招募池。',
    mode: GachaMode.BaClassic,
    currency: Resource.Pyroxene,
    costPerPull: 120,
    rates: [
      { rarity: CharacterRarity.Common, weight: 79 },
      { rarity: CharacterRarity.Rare, weight: 18 },
      { rarity: CharacterRarity.SuperRare, weight: 3 },
    ],
    dupRewards: { shards: 5, bonusResources: { [Resource.Credit]: 200 } },
    members: baseCharacterVariants.filter(v => v.isDefault && v.id !== 'HoshinoSwimsuit').map(v => v.id),
  },
  {
    id: 'base:pool:swimsuit-up',
    name: '夏日限定 Pick Up',
    description: '泳装星野概率提升！重复获得返还其专属碎片。',
    mode: GachaMode.BaClassic,
    currency: Resource.Pyroxene,
    costPerPull: 120,
    rates: [
      { rarity: CharacterRarity.Common, weight: 77 },
      { rarity: CharacterRarity.Rare, weight: 18 },
      { rarity: CharacterRarity.SuperRare, weight: 5 },
    ],
    featured: ['HoshinoSwimsuit'],
    pity: { guaranteedAt: 50 },
    dupRewards: { shards: 10, bonusResources: { [Resource.Credit]: 500 } },
    members: ['HoshinoSwimsuit', 'Shiroko', 'Hoshino', 'Serika'],
  },
];

/** 聊天流内容：少量开场消息示范。 */
export const baseChatMessages: ChatMessageDef[] = [
  { id: 'base:chat:arona-1', owner: 'Arona', order: 1, content: '老师，欢迎回到什亭之匣！系统一切正常哦。' },
  { id: 'base:chat:arona-2', owner: 'Arona', order: 2, content: '有什么计划的话，随时叫我！' },
  { id: 'base:chat:hoshino-1', owner: 'Hoshino', order: 1, content: '唔……老师吗……好困……' },
  {
    id: 'base:chat:hoshino-2',
    owner: 'Hoshino',
    order: 2,
    content: '下次一起去海边吧……嗯，说定了哦，队长。',
    unlock: { target: 'protoStat', key: String(Character.Hoshino), comparator: '>=', value: 2 },
  },
  { id: 'base:chat:shiroko-1', owner: 'Shiroko', order: 1, content: '老师，今天的行动方针呢？' },
];

/** 三层归属声明：收集类资产跨世界线保留，已读随世界线。 */
export const baseCharacterPersistConfig: CharacterPersistConfig = {
  roster: 'global',
  gacha: 'global',
  equips: 'global',
  chatRead: 'init',
};

// ============================================================
// 羁绊剧情（对话空间玩法）
//
// ActiveStoryEntry.extra.owner 声明归属差分：通讯录对话空间据此
// 展示"进入羁绊剧情"按钮，由玩家手动点击进入（不自动展开）。
// 演出机制与一般 Story 完全一致（底部点击 / 选项 / 效果）。
// ============================================================

export const baseBondStoryEntries: ActiveStoryEntry[] = [
  {
    id: 'base:bond:hoshino_1',
    storyId: 'base:bond:hoshino_1',
    type: 'active',
    triggerCondition: and(),
    availableInits: [],
    replayable: true,
    extra: extra.dict({ owner: extra.str('Hoshino') }),
  },
];

export const baseBondStories: StoryDef[] = [
  {
    id: 'base:bond:hoshino_1',
    name: '羁绊剧情 · 星野：午后的堤防',
    talklets: [
      { kind: 'narration', align: 'center', text: '——阿比多斯 · 堤防 · 午后——' },
      { speaker: '星野', text: '唔……老师也来吹风吗……海风很舒服哦……' },
      { speaker: '老师', text: '（在她旁边坐下）', sendText: '（默默坐下）' },
      {
        speaker: '星野',
        text: '说起来……队长还记得第一次见面的时候吗？',
        choices: [
          {
            text: '当然记得，就在对策委员会室。',
            effects: [{ op: 'setFlag', target: 'bond_hoshino_choice', value: 'committee' }],
          },
          {
            text: '抱歉……有点记不清了。',
            effects: [{ op: 'setFlag', target: 'bond_hoshino_choice', value: 'forget' }],
          },
        ],
      },
      {
        speaker: '星野',
        text: '呵呵……没关系哦。反正以后的日子还长着呢，队长。',
        effects: [{ op: 'setFlag', target: 'bond_hoshino_done', value: '1' }],
      },
    ],
  },
];
