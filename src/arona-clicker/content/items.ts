import { item } from './def-factory';
import type { ItemDef } from '../../data-services/contracts/item';

export const baseItems: ItemDef[] = [
  item('base:item:energy_drink')
    .name('战术能量饮料').desc('恢复少量信用点，适合测试背包使用流程。')
    .maxStack(5).rarity('common').type('consumable')
    .useEffects({ op: 'addResource', target: Resource.Credit, value: 25 })
    .build(),
  item('base:item:premium_drink')
    .name('高级能量饮料').desc('千禧年特制的营养补剂，能恢复大量精力。')
    .maxStack(3).rarity('rare').type('consumable')
    .useEffects({ op: 'addResource', target: Resource.Credit, value: 100 })
    .build(),
  item('base:item:tactical_kit')
    .name('战术急救包').desc('SRT制式战术急救套件，紧急时刻恢复可观信用点。')
    .maxStack(3).rarity('rare').type('consumable')
    .useEffects({ op: 'addResource', target: Resource.Credit, value: 60 })
    .build(),
  item('base:item:momo_friends_cookie')
    .name('喵喵饼干').desc('补课部特制手工饼干，形状是全基沃托斯最可爱的喵喵。恢复少量信用点。')
    .maxStack(10).rarity('common').type('consumable')
    .useEffects({ op: 'addResource', target: Resource.Credit, value: 15 })
    .build(),
  item('base:item:field_note').name('野外调查记录').desc('记录一次调查结果的普通素材。')
    .maxStack(99).rarity('common').type('material').build(),
  item('base:item:mystery_fragment').name('神秘碎片').desc('蕴含神秘力量的水晶碎片。在崔妮蒂大圣堂附近偶有发现。')
    .maxStack(20).rarity('rare').type('material').build(),
  item('base:item:broken_core').name('损毁的核心零件').desc('从废弃机械中回收的核心部件，对千禧年工程师来说也许还有用。')
    .maxStack(50).rarity('rare').type('material').build(),
  item('base:item:data_chip').name('千禧年数据芯片').desc('存储着海量研究数据的高密度芯片，千禧年学院的特产。')
    .maxStack(30).rarity('rare').type('material').build(),
  item('base:item:battle_report').name('战斗数据报告').desc('记录了战术编队作战表现的数据报告，SRT和瓦尔基里都在收集。')
    .maxStack(50).rarity('common').type('material').build(),
  item('base:item:peroro_doll').name('佩洛洛玩偶').desc('一二三最爱的佩洛洛限定版玩偶。在基沃托斯有着神秘的收藏价值。')
    .maxStack(5).rarity('rare').type('material').build(),
  item('base:item:schale_pass').name('夏莱通行证').desc('联邦搜查部「夏莱」的官方通行证。持有者可在各学院间自由通行。')
    .maxStack(1).rarity('epic').type('key').build(),
  item('base:item:federal_order').name('联邦委托书').desc('来自联邦学生会的正式委托文件，完成委托可获得丰富回报。')
    .maxStack(5).rarity('rare').type('key').build(),
];
import { Resource } from '../types/ids';
