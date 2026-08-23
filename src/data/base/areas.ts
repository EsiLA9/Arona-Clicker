// ============================================================
// data/base/areas.ts — Area 定义
// ============================================================

import { AreaDef, and, Resource } from '../../engine/types';

export const baseAreas: AreaDef[] = [
  {
    id: 'base:area:schale_main',
    initId: 'base:init:schale_office',
    name: '夏莱主厅',
    description: '夏莱的主办公区域，略显凌乱但充满生活气息。',
    defaultSpots: ['base:spot:credit_printer', 'base:spot:comms_terminal', 'base:spot:data_wiper'],
    adjacentAreaIds: ['base:area:schale_library', 'base:area:schale_rooftop'],
    // 场景特色主题：进入夏莱主厅 → 界面切换为夏莱蓝
    theme: { colorId: 'base:color:schale-blue' },
  },
  {
    id: 'base:area:schale_library',
    initId: 'base:init:schale_office',
    name: '夏莱资料室',
    description: '堆满委托卷宗与旧档案的资料室。联邦的运作痕迹都沉淀在这里。',
    // 进入该 Area 时赠送
    defaultSpots: ['base:spot:archive'],
    adjacentAreaIds: ['base:area:schale_main', 'base:area:schale_hangar'],
  },
  {
    id: 'base:area:schale_hangar',
    initId: 'base:init:schale_office',
    name: '夏莱机库',
    description: '停放着夏莱专用车的机库。出勤的起点，也常被当作临时午休地。',
    defaultSpots: [],
    adjacentAreaIds: ['base:area:schale_library'],
    // 信息揭示示例：累计产出 80 信用点后才知晓该区域名称
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'stat', key: '$GlobalProducedAmount base:resource:credit', comparator: '>=', value: 80 }) },
    ],
  },
  {
    id: 'base:area:schale_rooftop',
    initId: 'base:init:schale_office',
    name: '夏莱天台',
    description: '天台的风很清爽，能俯瞰整片夏莱街景。星野的邀约与晚霞都收在这里。',
    defaultSpots: [],
    adjacentAreaIds: ['base:area:schale_main'],
    // 场景特色主题：天台的黄昏暖橙
    theme: { colorId: 'base:color:amber' },
  },
  {
    id: 'base:area:abydos_campus',
    initId: 'base:init:abydos',
    name: '阿比多斯旧校舍',
    description: '破旧却充满人情的校舍。对策委员会的据点，黄沙与日常并存。',
    defaultSpots: ['base:spot:abydos_rehab'],
    adjacentAreaIds: ['base:area:abydos_pool'],
    // 场景特色主题：阿比多斯黄沙
    theme: { colorId: 'base:color:abydos-sand' },
  },
  {
    id: 'base:area:abydos_pool',
    initId: 'base:init:abydos',
    name: '废弃泳池',
    description: '早已干涸的露天泳池。如今堆满器材，偶尔被学生们当作训练场。',
    // 进入该 Area 时赠送
    defaultSpots: ['base:spot:pool_train'],
    adjacentAreaIds: ['base:area:abydos_campus'],
    // 场景特色主题 + 局部覆盖：黄沙打底，但聊天气泡单独换成泳池蓝（多 Color 解耦示例）
    theme: { colorId: 'base:color:abydos-sand', tokens: { playerBubble: '#3ec6e0' } },
  },
  {
    id: 'base:area:millennium_lab',
    initId: 'base:init:millennium',
    name: '千禧年研究楼',
    description: '布满终端与缆线的研究楼。数据流昼夜不息，游戏开发部就藏在这里。',
    defaultSpots: ['base:spot:millennium_lab'],
    adjacentAreaIds: ['base:area:millennium_canteen'],
    // 场景特色主题：千禧年科技靛蓝
    theme: { colorId: 'base:color:indigo' },
  },
  {
    id: 'base:area:millennium_canteen',
    initId: 'base:init:millennium',
    name: '千禧年自助食堂',
    description: '自动化程度惊人的食堂。营养饮料与零食按需供给，学生们的能量补给站。',
    defaultSpots: [],
    adjacentAreaIds: ['base:area:millennium_lab', 'base:area:millennium_server'],
  },
  {
    id: 'base:area:millennium_server',
    initId: 'base:init:millennium',
    name: '千禧年服务器机房',
    description: '全天候运转的服务器群。散发冷气与电流声，数据流无限循环。',
    defaultSpots: ['base:spot:millennium_ai_cluster'],
    adjacentAreaIds: ['base:area:millennium_canteen'],
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 40 }) },
    ],
  },
  {
    id: 'base:area:trinity_cathedral',
    initId: 'base:init:trinity',
    name: '崔妮蒂大圣堂',
    description: '庄严的大圣堂，彩绘玻璃透过柔和的光。补课部学生们常在此聚集。',
    defaultSpots: ['base:spot:trinity_donation', 'base:spot:trinity_repair'],
    adjacentAreaIds: ['base:area:trinity_tea_room'],
    // 场景特色主题：圣堂暖琥珀光
    theme: { colorId: 'base:color:amber' },
  },
  {
    id: 'base:area:trinity_tea_room',
    initId: 'base:init:trinity',
    name: '茶话会室',
    description: '香气四溢的茶话会专用室。淑女们的午后聚会，优雅而充满算计。',
    defaultSpots: ['base:spot:trinity_tea_prep'],
    adjacentAreaIds: ['base:area:trinity_cathedral'],
  },
  {
    id: 'base:area:gehenna_council',
    initId: 'base:init:gehenna',
    name: '万魔殿本部',
    description: '万魔殿的行政中枢。虽然看上去混乱不堪，但一切都在某种秩序下运转。',
    defaultSpots: ['base:spot:gehenna_hall'],
    adjacentAreaIds: ['base:area:gehenna_district'],
    // 场景特色主题：万魔殿绯红
    theme: { colorId: 'base:color:crimson' },
  },
  {
    id: 'base:area:gehenna_district',
    initId: 'base:init:gehenna',
    name: '盖赫纳商业街',
    description: '喧嚣热闹的商业街。小吃摊、杂货铺、以及便利屋68的秘密据点都藏在这里。',
    defaultSpots: ['base:spot:gehenna_bureau'],
    adjacentAreaIds: ['base:area:gehenna_council'],
  },
];
