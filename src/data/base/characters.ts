// ============================================================
// data/base/characters.ts — 角色数据定义
//
// 精简测试数据：每个学部至少 1 名，覆盖全部稀有度；
// 阿比多斯保留卡池（swimsuit-up）与聊天流引用所需的成员。
// ============================================================

import { Character, CharacterData, CharacterRarity, CharacterSchool } from '../../engine/types';

export const allCharacters: CharacterData[] = [
  // === Schale (夏莱) ===
  {
    id: Character.Arona,
    name: '阿罗娜',
    displayName: '阿罗娜',
    school: CharacterSchool.Schale,
    rarity: CharacterRarity.SuperRare,
    description: '什亭之匣的系统管理员AI，有些冒失但很关心老师。',
    spotTagBonus: { 'office': 1.5, 'system': 1.3 },
    passiveDescription: '「办公室」和「系统」类 Spot 产出倍率 +50%/+30%',
  },

  // === Abydos (阿比多斯) ===
  {
    id: Character.Shiroko,
    name: '白子',
    displayName: '砂狼白子',
    school: CharacterSchool.Abydos,
    rarity: CharacterRarity.SuperRare,
    description: '总是戴着面具的静默运动少女，痴迷于抢劫银行。',
    spotTagBonus: { 'field': 1.4, 'combat': 1.2 },
    passiveDescription: '「野外」和「战斗」类 Spot 产出倍率 +40%/+20%',
  },
  {
    id: Character.Hoshino,
    name: '星野',
    displayName: '小鸟游星野',
    school: CharacterSchool.Abydos,
    rarity: CharacterRarity.Rare,
    description: '慵懒散漫的三年级前辈，但实力深不可测。',
    spotTagBonus: { 'defense': 1.5, 'rest': 1.2 },
    passiveDescription: '「防御」类 Spot 产出 +50%，「休息」类 +20%',
  },
  {
    id: Character.Serika,
    name: '芹香',
    displayName: '黑见芹香',
    school: CharacterSchool.Abydos,
    rarity: CharacterRarity.Common,
    description: '勤勉努力的后辈，在便利店打工以偿还债务。',
    spotTagBonus: { 'shop': 1.3, 'parttime': 1.2 },
    passiveDescription: '「商店」类 Spot 产出 +30%，「打工」类 +20%',
  },

  // === Millennium (千禧年) ===
  {
    id: Character.Yuuka,
    name: '优香',
    displayName: '早濑优香',
    school: CharacterSchool.Millennium,
    rarity: CharacterRarity.Rare,
    description: '千禧年学生会的财务，精于计算，讨厌浪费。',
    spotTagBonus: { 'credit': 1.5, 'math': 1.3 },
    passiveDescription: '「信用点」类 Spot 产出 +50%，「数学」类 +30%',
  },

  // === Trinity (崔妮蒂) ===
  {
    id: Character.Mika,
    name: '未花',
    displayName: '聖園未花',
    school: CharacterSchool.Trinity,
    rarity: CharacterRarity.SuperRare,
    description: '崔妮蒂茶会领袖，天真烂漫但行事偏激的公主。',
    spotTagBonus: { 'force': 1.5, 'royal': 1.3 },
    passiveDescription: '「武力」类 Spot 产出 +50%，「王室」类 +30%',
  },

  // === Gehenna (盖赫纳) ===
  {
    id: Character.Iori,
    name: '伊织',
    displayName: '銀剣伊织',
    school: CharacterSchool.Gehenna,
    rarity: CharacterRarity.Rare,
    description: '万魔殿的冷静辅佐官，枪术名手，行事风格果断。',
    spotTagBonus: { 'combat': 1.4, 'discipline': 1.2 },
    passiveDescription: '「战斗」类 Spot 产出 +40%，「纪律」类 +20%',
  },

  // === SRT ===
  {
    id: Character.Miyako,
    name: '都子',
    displayName: '空井都子',
    school: CharacterSchool.SRT,
    rarity: CharacterRarity.Common,
    description: 'RABBIT小队的队长，冷静沉着的战术指挥。',
    spotTagBonus: { 'tactical': 1.4, 'field': 1.2 },
    passiveDescription: '「战术」类 Spot 产出 +40%，「野外」类 +20%',
  },

  // === Arius (阿里乌斯) ===
  {
    id: Character.Saori,
    name: '纱织',
    displayName: '錠前纱织',
    school: CharacterSchool.Arius,
    rarity: CharacterRarity.SuperRare,
    description: '阿里乌斯小队队长，忠诚而强大的战斗专家。',
    spotTagBonus: { 'combat': 1.5, 'leader': 1.3 },
    passiveDescription: '「战斗」类 Spot 产出 +50%，「领导」类 +30%',
  },
];
