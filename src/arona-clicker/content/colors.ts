import { colorGroup } from './def-factory';
import { Character } from '../types/ids';
import type { ColorGroupDef } from '../../data-services/contracts/color';

export const baseColorGroups: ColorGroupDef[] = [
  colorGroup('base:colorgroup:schale-solid').name('夏莱蓝').desc('什亭之匣的标准配色。获得阿罗娜后解锁。').type('solid').primary('#3b82f6').unlockProtoStat(Character.Arona).build(),
  colorGroup('base:colorgroup:abydos-sand').name('阿比多斯黄沙').desc('被沙漠侵蚀的学园配色。拥有星野（任一差分）后解锁。').type('solid').primary('#eab308').unlockProtoStat(Character.Hoshino).build(),
  colorGroup('base:colorgroup:momotalk-pink').name('Momotalk 粉').desc('聊天软件的主题色。完成欢迎剧情（flag）后解锁。').type('solid').primary('#ec4899').unlockFlag('momotalk_pink_unlocked').build(),
  colorGroup('base:colorgroup:hoshino-swim').name('星野·泳装').desc('夏日泳池的清凉蓝调。拥有星野（任一差分）后解锁。').type('solid').primary('#3ec6e0').unlockProtoStat(Character.Hoshino).build(),
  colorGroup('base:colorgroup:rose').name('玫瑰').desc('获得白子后解锁。').type('solid').primary('#ff5d8f').unlockProtoStat(Character.Shiroko).build(),
  colorGroup('base:colorgroup:emerald').name('翡翠').desc('获得芹香后解锁。').type('solid').primary('#10b981').unlockProtoStat(Character.Serika).build(),
  colorGroup('base:colorgroup:violet').name('紫罗兰').desc('获得优香后解锁。').type('solid').primary('#8b5cf6').unlockProtoStat(Character.Yuuka).build(),
  colorGroup('base:colorgroup:amber').name('琥珀').desc('获得未花后解锁。').type('solid').primary('#f59e0b').unlockProtoStat(Character.Mika).build(),
  colorGroup('base:colorgroup:crimson').name('绯红').desc('获得伊织后解锁。').type('solid').primary('#e11d48').unlockProtoStat(Character.Iori).build(),
  colorGroup('base:colorgroup:teal').name('青碧').desc('获得都子后解锁。').type('solid').primary('#14b8a6').unlockProtoStat(Character.Miyako).build(),
  colorGroup('base:colorgroup:indigo').name('靛蓝').desc('获得纱织后解锁。').type('solid').primary('#6366f1').unlockProtoStat(Character.Saori).build(),
  colorGroup('base:colorgroup:sky').name('晴空').desc('获得阿罗娜后解锁（浅蓝变体）。').type('solid').primary('#38bdf8').unlockProtoStat(Character.Arona).build(),
  colorGroup('base:colorgroup:lime').name('青柠').desc('完成欢迎剧情（flag）后解锁。').type('solid').primary('#a3e635').unlockFlag('momotalk_pink_unlocked').build(),
  colorGroup('base:colorgroup:ink').name('墨蓝').desc('拥有星野（任一差分）后解锁（深底变体）。').type('solid').primary('#1e3a5f').theme({ panel: '#101828' }).unlockProtoStat(Character.Hoshino).build(),
  colorGroup('base:colorgroup:coral').name('珊瑚').desc('完成欢迎剧情（flag）后解锁（全量自定义覆盖示例）。').type('solid').primary('#ff7a59').theme({ primary: '#ff7a59', bg: '#fff3ee', bgAlt: '#ffe6dc', text: '#3a1f17', textDim: '#8a6a5c', border: '#ffd0c0', accent: '#ff9e80', panel: '#fff7f2' }).unlockFlag('momotalk_pink_unlocked').build(),
  colorGroup('base:colorgroup:hoshino-gradient').name('星野·渐变').desc('泳装蓝调的柔滑渐变。').type('gradient').primary('#3ec6e0').slot('secondary', '#38bdf8').theme({ playerBubble: '#0e3a4d' }).build(),
  colorGroup('base:colorgroup:abydos-duotone').name('阿比多斯·双色').desc('黄沙主色 + 墨蓝阴影的阶调层次。').type('duotone').primary('#eab308').slot('shadow', '#1e3a5f').build(),
  colorGroup('base:colorgroup:prism-pie').name('棱镜·饼图').desc('四色分区构成的抽象头像。').type('pie').primary('#ff5d8f').slot('secondary', '#10b981').slot('accent', '#8b5cf6').slot('highlight', '#f59e0b').build(),
  colorGroup('base:colorgroup:radial-dawn').name('黎明·径向').desc('珊瑚中心向绯红边缘的径向渐变。').type('radial').primary('#ff7a59').slot('edge', '#ff5d8f').build(),
  colorGroup('base:colorgroup:shiroko-duotone').name('白子·双色').desc('白子的玫瑰主色叠墨蓝阴影。').type('duotone').primary('#ff5d8f').slot('shadow', '#1e3a5f').unlockProtoStat(Character.Shiroko).build(),
  colorGroup('base:colorgroup:serika-gradient').name('芹香·渐变').desc('芹香的翡翠色滑向青柠色。').type('gradient').primary('#10b981').slot('secondary', '#a3e635').unlockProtoStat(Character.Serika).build(),
  colorGroup('base:colorgroup:yuuka-radial').name('优香·径向').desc('优香的紫罗兰色中心向晴空色散射。').type('radial').primary('#8b5cf6').slot('edge', '#38bdf8').unlockProtoStat(Character.Yuuka).build(),
  colorGroup('base:colorgroup:mika-pie').name('未花·饼图').desc('未花的多彩扇形分区。').type('pie').primary('#f59e0b').slot('secondary', '#ff5d8f').slot('accent', '#8b5cf6').slot('highlight', '#10b981').unlockProtoStat(Character.Mika).build(),
  colorGroup('base:colorgroup:iori-gradient').name('伊织·渐变').desc('伊织的绯红向墨蓝渐沉。').type('gradient').primary('#e11d48').slot('secondary', '#1e3a5f').unlockProtoStat(Character.Iori).build(),
  colorGroup('base:colorgroup:miyako-duotone').name('都子·双色').desc('都子的青碧主色叠墨蓝阴影。').type('duotone').primary('#14b8a6').slot('shadow', '#1e3a5f').unlockProtoStat(Character.Miyako).build(),
  colorGroup('base:colorgroup:saori-radial').name('纱织·径向').desc('纱织的靛蓝中心向晴空色散射。').type('radial').primary('#6366f1').slot('edge', '#38bdf8').unlockProtoStat(Character.Saori).build(),
];
