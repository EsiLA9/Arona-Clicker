import { colorEquipment } from './def-factory';
import { Character } from '../types/ids';
import type { ColorEquipmentDef } from '../../data-services/contracts/color';

export const baseColorEquipments: ColorEquipmentDef[] = [
  colorEquipment('base:colorequipment:schale-badge').name('夏莱徽章').desc('什亭之匣的标准徽章，信用点获取 +1。').colorGroup('base:colorgroup:schale-solid').effects({ op: 'addResource', target: Resource.Credit, value: 1 }).category('common').unlockFlag('momotalk_pink_unlocked').build(),
  colorEquipment('base:colorequipment:hoshino-swim-gear').name('星野泳装装备').desc('夏日泳池的清凉套装，信用点获取 +2。').colorGroup('base:colorgroup:hoshino-gradient').effects({ op: 'addResource', target: Resource.Credit, value: 2 }).category('rare').unlockProtoStat(Character.Hoshino).build(),
  colorEquipment('base:colorequipment:abydos-legacy').name('阿比多斯传承').desc('阿比多斯学园的古老传承，信用点获取 +3。').colorGroup('base:colorgroup:abydos-duotone').effects({ op: 'addResource', target: Resource.Credit, value: 3 }).category('epic').unlockProtoStat(Character.Hoshino, 2).build(),
  colorEquipment('base:colorequipment:prism-set').name('棱镜套装').desc('多彩棱镜的抽象集合，信用点获取 +1。').colorGroup('base:colorgroup:prism-pie').effects({ op: 'addResource', target: Resource.Credit, value: 1 }).category('rare').unlockProtoStat(Character.Mika).build(),
  colorEquipment('base:colorequipment:dawn-aura').name('黎明之气').desc('破晓时分的暖色光晕，信用点获取 +2。').colorGroup('base:colorgroup:radial-dawn').effects({ op: 'addResource', target: Resource.Credit, value: 2 }).category('common').unlockProtoStat(Character.Shiroko).build(),
];
import { Resource } from '../types/ids';
