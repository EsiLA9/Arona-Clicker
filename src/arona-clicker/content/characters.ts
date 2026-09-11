import { character } from './def-factory';
import { Character, CharacterRarity, CharacterSchool } from '../types/ids';
import type { CharacterData } from '../types/character';

export const allCharacters: CharacterData[] = [
  character(Character.Arona).name('阿罗娜').displayName('阿罗娜').school(CharacterSchool.Schale).rarity(CharacterRarity.SuperRare).desc('什亭之匣的系统管理员AI，有些冒失但很关心老师。').build(),
  character(Character.Shiroko).name('白子').displayName('砂狼白子').school(CharacterSchool.Abydos).rarity(CharacterRarity.SuperRare).desc('总是戴着面具的静默运动少女，痴迷于抢劫银行。').build(),
  character(Character.Hoshino).name('星野').displayName('小鸟游星野').school(CharacterSchool.Abydos).rarity(CharacterRarity.Rare).desc('慵懒散漫的三年级前辈，但实力深不可测。').build(),
  character(Character.Serika).name('芹香').displayName('黑见芹香').school(CharacterSchool.Abydos).rarity(CharacterRarity.Common).desc('勤勉努力的后辈，在便利店打工以偿还债务。').build(),
  character(Character.Yuuka).name('优香').displayName('早濑优香').school(CharacterSchool.Millennium).rarity(CharacterRarity.Rare).desc('千禧年学生会的财务，精于计算，讨厌浪费。').build(),
  character(Character.Mika).name('未花').displayName('聖園未花').school(CharacterSchool.Trinity).rarity(CharacterRarity.SuperRare).desc('崔妮蒂茶会领袖，天真烂漫但行事偏激的公主。').build(),
  character(Character.Iori).name('伊织').displayName('銀剣伊织').school(CharacterSchool.Gehenna).rarity(CharacterRarity.Rare).desc('万魔殿的冷静辅佐官，枪术名手，行事风格果断。').build(),
  character(Character.Miyako).name('都子').displayName('空井都子').school(CharacterSchool.SRT).rarity(CharacterRarity.Common).desc('RABBIT小队的队长，冷静沉着的战术指挥。').build(),
  character(Character.Saori).name('纱织').displayName('錠前纱织').school(CharacterSchool.Arius).rarity(CharacterRarity.SuperRare).desc('阿里乌斯小队队长，忠诚而强大的战斗专家。').build(),
];
