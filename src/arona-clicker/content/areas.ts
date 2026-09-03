import { area } from './def-factory/area';
import type { AreaDef } from '../../data-services/contracts/world';

export const baseAreas: AreaDef[] = [
  area('base:area:schale_main', 'base:init:schale_office').name('夏莱主厅').desc('夏莱的主办公区域，略显凌乱但充满生活气息。').spots('base:spot:credit_printer', 'base:spot:comms_terminal', 'base:spot:data_wiper').adjacent('base:area:schale_library', 'base:area:schale_rooftop').theme('base:colorgroup:schale-solid').background(
    { id: 'scene', kind: 'image', value: 'base:background(pic):hoshino', opacity: 0.38, position: '72% 50%', size: 'auto 92%', blendMode: 'normal' },
    { id: 'triangles-back', kind: 'image', value: 'base:overlay(pic):triangles', opacity: 0.68, position: '8% 8%', size: '42rem', blendMode: 'screen' },
    { id: 'triangles-front', kind: 'image', value: 'base:overlay(pic):triangles', opacity: 0.42, position: '86% 78%', size: '32rem', blendMode: 'multiply' },
  ).presentation({
    components: [
      { id: 'center-hoshino-portrait', parent: 'centerPanel', asset: 'base:background(pic):hoshino', anchor: 'bottom-right', offset: { x: 4, y: 1, unit: 'percent' }, size: { height: 88, unit: 'percent' }, fit: 'contain' },
      { id: 'center-triangle-decoration', parent: 'centerPanel', asset: 'base:overlay(pic):triangles', anchor: 'top-left', offset: { x: 3, y: 3, unit: 'percent' }, size: { width: 38, unit: 'percent' }, fit: 'contain' },
    ],
  }).build(),
  area('base:area:schale_library', 'base:init:schale_office').name('夏莱资料室').desc('堆满委托卷宗与旧档案的资料室。联邦的运作痕迹都沉淀在这里。').spots('base:spot:archive').adjacent('base:area:schale_main', 'base:area:schale_hangar').build(),
  area('base:area:schale_hangar', 'base:init:schale_office').name('夏莱机库').desc('停放着夏莱专用车的机库。出勤的起点，也常被当作临时午休地。').spots().adjacent('base:area:schale_library').revealCredit('name', 80).build(),
  area('base:area:schale_rooftop', 'base:init:schale_office').name('夏莱天台').desc('天台的风很清爽，能俯瞰整片夏莱街景。星野的邀约与晚霞都收在这里。').spots().adjacent('base:area:schale_main').theme('base:colorgroup:amber').build(),
  area('base:area:abydos_campus', 'base:init:abydos').name('阿比多斯旧校舍').desc('破旧却充满人情的校舍。对策委员会的据点，黄沙与日常并存。').spots('base:spot:abydos_rehab').adjacent('base:area:abydos_pool').theme('base:colorgroup:abydos-sand').build(),
  area('base:area:abydos_pool', 'base:init:abydos').name('废弃泳池').desc('早已干涸的露天泳池。如今堆满器材，偶尔被学生们当作训练场。').spots('base:spot:pool_train').adjacent('base:area:abydos_campus').theme('base:colorgroup:abydos-sand', { playerBubble: '#3ec6e0' }).build(),
  area('base:area:millennium_lab', 'base:init:millennium').name('千禧年研究楼').desc('布满终端与缆线的研究楼。数据流昼夜不息，游戏开发部就藏在这里。').spots('base:spot:millennium_lab').adjacent('base:area:millennium_canteen').theme('base:colorgroup:indigo').build(),
  area('base:area:millennium_canteen', 'base:init:millennium').name('千禧年自助食堂').desc('自动化程度惊人的食堂。营养饮料与零食按需供给，学生们的能量补给站。').spots().adjacent('base:area:millennium_lab', 'base:area:millennium_server').build(),
  area('base:area:millennium_server', 'base:init:millennium').name('千禧年服务器机房').desc('全天候运转的服务器群。散发冷气与电流声，数据流无限循环。').spots('base:spot:millennium_ai_cluster').adjacent('base:area:millennium_canteen').revealResource('name', Resource.Credit, 40).build(),
  area('base:area:trinity_cathedral', 'base:init:trinity').name('崔妮蒂大圣堂').desc('庄严的大圣堂，彩绘玻璃透过柔和的光。补课部学生们常在此聚集。').spots('base:spot:trinity_donation', 'base:spot:trinity_repair').adjacent('base:area:trinity_tea_room').theme('base:colorgroup:amber').build(),
  area('base:area:trinity_tea_room', 'base:init:trinity').name('茶话会室').desc('香气四溢的茶话会专用室。淑女们的午后聚会，优雅而充满算计。').spots('base:spot:trinity_tea_prep').adjacent('base:area:trinity_cathedral').build(),
  area('base:area:gehenna_council', 'base:init:gehenna').name('万魔殿本部').desc('万魔殿的行政中枢。虽然看上去混乱不堪，但一切都在某种秩序下运转。').spots('base:spot:gehenna_hall').adjacent('base:area:gehenna_district').theme('base:colorgroup:crimson').build(),
  area('base:area:gehenna_district', 'base:init:gehenna').name('盖赫纳商业街').desc('喧嚣热闹的商业街。小吃摊、杂货铺、以及便利屋68的秘密据点都藏在这里。').spots('base:spot:gehenna_bureau').adjacent('base:area:gehenna_council').build(),
];
import { Resource } from '../types/ids';
