// ============================================================
// data/base/spots.ts — Spot 定义
// ============================================================

import { SpotDef, Expr, Resource, and } from '../../engine/types';
import { tagPath } from '../../engine/core/tag';

export const baseSpots: SpotDef[] = [
  {
    id: 'base:spot:credit_printer',
    areaId: 'base:area:schale_main',
    name: '信用点制造机',
    description: '一台老旧但可靠的信用点制造设备，每个 Tick 都会产出信用点。',
    baseCost: Expr.const(0),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(5), // 每个统一 Tick 产出
    baseYieldResource: Resource.Credit,
    baseCapacity: 500,  // 容量上限
    managerBonusYield: Expr.const(3),
    tags: [tagPath('credit'), tagPath('office')],
    // 功能：升级提供线性额外产出（每级 +2 信用点，类比持续生效的 Affector）
    functionalities: [
      {
        id: 'base:func:credit_printer_linear',
        kind: 'linearYield',
        resource: Resource.Credit,
        amountPerLevel: 2,
      },
      // 招募：夏莱办公室内即可测试抽卡。无 gachaPools 声明 → 开放全局通用卡池。
      { id: 'base:func:credit_printer_gacha', kind: 'gacha' },
    ],
    // 通用升级：每级基础产出 +2（线性）；升级花费 floor(50 × 2^(N-1))（指数）
    yieldPerLevel: 2,
    upgradeCostBase: 50,
    upgradeCostGrowth: 2,
  },
  // ============================================================
  // 测试用 Spot：软重启测试入口
  // ============================================================
  {
    id: 'base:spot:comms_terminal',
    areaId: 'base:area:schale_main',
    name: '通讯终端',
    description: '连接联邦网络的终端设备。可以安全结束当前世界线的经营活动，回到世界线选择。',
    baseCost: Expr.const(0),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(3),
    baseYieldResource: Resource.Credit,
    baseCapacity: 200,
    managerBonusYield: Expr.const(1),
    tags: [tagPath('office'), tagPath('tech')],
    functionalities: [
      { id: 'base:func:comms_restart', kind: 'restartInit' },
    ],
    yieldPerLevel: 1,
    upgradeCostBase: 30,
    upgradeCostGrowth: 2,
  },
  // ============================================================
  // 测试用 Spot：硬重置测试入口
  // ============================================================
  {
    id: 'base:spot:data_wiper',
    areaId: 'base:area:schale_main',
    name: '数据清除装置',
    description: '一台带有⚡警示标志的重置设备。可以彻底抹除当前世界线的运营记录，下次进入时为崭新状态。注意：这会删除快照，但会保留所有统计数据。',
    baseCost: Expr.const(0),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(2),
    baseYieldResource: Resource.Credit,
    baseCapacity: 100,
    managerBonusYield: Expr.const(1),
    tags: [tagPath('tech'), tagPath('defense')],
    functionalities: [
      { id: 'base:func:data_wiper_hard_reset', kind: 'hardResetInit' },
    ],
    yieldPerLevel: 1,
    upgradeCostBase: 25,
    upgradeCostGrowth: 2,
  },
  {
    id: 'base:spot:field_work',
    areaId: 'base:area:schale_main',
    name: '野外调查站',
    description: '阿比多斯风格的小型户外作业点，适合野外探索型学生。',
    baseCost: Expr.const(20),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(8), // 每个统一 Tick 产出
    baseYieldResource: Resource.Credit,
    baseCapacity: 300,
    managerBonusYield: Expr.const(4),
    tags: [tagPath('field'), tagPath('combat')],
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 10 }) },
      { reveal: 'utility', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 40 }) },
    ],

    // 功能（带条件）：全局累计产出超过 100 信用点后，每级额外 +1（演示条件需求）
    functionalities: [
      {
        id: 'base:func:field_work_conditioned',
        kind: 'linearYield',
        resource: Resource.Credit,
        amountPerLevel: 1,
        condition: and({
          target: 'stat',
          key: '$GlobalProducedAmount base:resource:credit',
          comparator: '>',
          value: 100,
        }),
      },
    ],
    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:field_work', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:field_work', value: '3' }],
      },
    ],
    upgradeCostBase: 80,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  {
    id: 'base:spot:tactical_desk',
    areaId: 'base:area:schale_main',
    name: '战术指挥台',
    description: '配备通讯设备和地图的指挥站，适合战术型学生。',
    baseCost: Expr.const(30),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(10), // 每个统一 Tick 产出
    baseYieldResource: Resource.Credit,
    baseCapacity: 200,
    managerBonusYield: Expr.const(5),
    tags: [tagPath('tactical'), tagPath('intel'), tagPath('office')],
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 20 }) },
      { reveal: 'utility', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 60 }) },
    ],

    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:tactical_desk', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:tactical_desk', value: '3' }],
      },
    ],
    upgradeCostBase: 120,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  {
    id: 'base:spot:abydos_rehab',
    areaId: 'base:area:abydos_campus',
    name: '对策委员会室',
    description: '堆满资料与装备的对策室。委员会的日常从这里开始。',
    baseCost: Expr.const(0),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(4),
    baseYieldResource: Resource.Credit,
    baseCapacity: 400,
    managerBonusYield: Expr.const(2),
    tags: [tagPath('office'), tagPath('defense')],
    functionalities: [
      { id: 'base:func:abydos_restart', kind: 'restartInit' },
    ],
    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:abydos_rehab', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:abydos_rehab', value: '3' }],
      },
    ],
    upgradeCostBase: 45,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  {
    id: 'base:spot:abydos_cafe',
    areaId: 'base:area:abydos_campus',
    name: '阿比多斯咖啡角',
    description: '临时搭起的咖啡角。午后的阳光里，少女们的谈笑声此起彼伏。',
    baseCost: Expr.const(15),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(6),
    baseYieldResource: Resource.Credit,
    baseCapacity: 300,
    managerBonusYield: Expr.const(3),
    tags: [tagPath('shop'), tagPath('rest')],
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 8 }) },
      { reveal: 'utility', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 30 }) },
    ],

    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:abydos_cafe', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:abydos_cafe', value: '3' }],
      },
    ],
    upgradeCostBase: 70,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  {
    id: 'base:spot:millennium_lab',
    areaId: 'base:area:millennium_lab',
    name: '千禧年数据分析站',
    description: '全天候运转的数据分析站。信用点从海量数据流中沉淀出来。',
    baseCost: Expr.const(0),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(7),
    baseYieldResource: Resource.Credit,
    baseCapacity: 350,
    managerBonusYield: Expr.const(4),
    tags: [tagPath('tech'), tagPath('intel')],
    functionalities: [
      { id: 'base:func:millennium_restart', kind: 'restartInit' },
    ],
    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:millennium_lab', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:millennium_lab', value: '3' }],
      },
    ],
    upgradeCostBase: 60,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  {
    id: 'base:spot:millennium_game',
    areaId: 'base:area:millennium_lab',
    name: '游戏开发部终端',
    description: '散发奶茶味与代码香的开发终端。正在开发一部惊天巨作。',
    baseCost: Expr.const(20),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(9),
    baseYieldResource: Resource.Credit,
    baseCapacity: 250,
    managerBonusYield: Expr.const(5),
    tags: [tagPath('game'), tagPath('tech')],
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 12 }) },
      { reveal: 'utility', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 40 }) },
    ],

    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:millennium_game', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:millennium_game', value: '3' }],
      },
    ],
    upgradeCostBase: 90,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  {
    id: 'base:spot:archive',
    areaId: 'base:area:schale_library',
    name: '卷宗整理台',
    description: '分类整理联邦委托卷宗的工作台。每份归档都是一笔稳定的信用点收入。',
    baseCost: Expr.const(25),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(6),
    baseYieldResource: Resource.Credit,
    baseCapacity: 280,
    managerBonusYield: Expr.const(3),
    tags: [tagPath('archive'), tagPath('office')],
    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:archive', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:archive', value: '3' }],
      },
    ],
    upgradeCostBase: 100,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  {
    id: 'base:spot:hangar_supply',
    areaId: 'base:area:schale_hangar',
    name: '机库补给车',
    description: '为出勤车辆补充物资的小型补给车。运转起来，信用点也随之流动。',
    baseCost: Expr.const(35),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(9),
    baseYieldResource: Resource.Credit,
    baseCapacity: 220,
    managerBonusYield: Expr.const(5),
    tags: [tagPath('logistics'), tagPath('vehicle')],
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 30 }) },
      { reveal: 'utility', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 80 }) },
    ],

    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:hangar_supply', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:hangar_supply', value: '3' }],
      },
    ],
    upgradeCostBase: 140,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  {
    id: 'base:spot:pool_train',
    areaId: 'base:area:abydos_pool',
    name: '泳池训练棚',
    description: '在干涸的池底架起的简易训练棚。挥洒汗水，也沉淀信用点。',
    baseCost: Expr.const(18),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(5),
    baseYieldResource: Resource.Credit,
    baseCapacity: 260,
    managerBonusYield: Expr.const(3),
    tags: [tagPath('training'), tagPath('defense')],
    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:pool_train', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:pool_train', value: '3' }],
      },
    ],
    upgradeCostBase: 85,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  {
    id: 'base:spot:canteen_vendor',
    areaId: 'base:area:millennium_canteen',
    name: '食堂自动售货机',
    description: '千禧年食堂的自动化售货机。投币、出货、信用点到账，一气呵成。',
    baseCost: Expr.const(28),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(8),
    baseYieldResource: Resource.Credit,
    baseCapacity: 240,
    managerBonusYield: Expr.const(4),
    tags: [tagPath('shop'), tagPath('tech')],
    // 功能：招募（热门角色的专属卡池，独立于全局通用卡池）
    functionalities: [
      { id: 'base:func:canteen_gacha', kind: 'gacha' },
    ],
    gachaPools: ['base:pool:canteen_exclusive'],
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 20 }) },
      { reveal: 'utility', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 60 }) },
    ],

    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:canteen_vendor', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:canteen_vendor', value: '3' }],
      },
    ],
    upgradeCostBase: 110,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  // ============================================================
  // 千禧年 — 服务器机房
  // ============================================================
  {
    id: 'base:spot:millennium_ai_cluster',
    areaId: 'base:area:millennium_server',
    name: 'AI 训练集群',
    description: '搭载专用 GPU 的分布式训练集群。海量数据从这里流经，信用点与算力等比产出。',
    baseCost: Expr.const(50),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(12),
    baseYieldResource: Resource.Credit,
    baseCapacity: 400,
    managerBonusYield: Expr.const(6),
    tags: [tagPath('tech'), tagPath('link'), tagPath('math')],
    functionalities: [
      { id: 'base:func:ai_restart', kind: 'restartInit' },
    ],
    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:millennium_ai_cluster', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:millennium_ai_cluster', value: '3' }],
      },
    ],
    upgradeCostBase: 200,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  // ============================================================
  // 崔妮蒂 — 大圣堂
  // ============================================================
  {
    id: 'base:spot:trinity_donation',
    areaId: 'base:area:trinity_cathedral',
    name: '圣所捐赠箱',
    description: '信徒们虔诚的捐赠汇集于此。每一笔捐赠都化为重建学园的基石。',
    baseCost: Expr.const(0),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(6),
    baseYieldResource: Resource.Credit,
    baseCapacity: 500,
    managerBonusYield: Expr.const(3),
    tags: [tagPath('faith'), tagPath('courtesy'), tagPath('credit')],
    functionalities: [
      { id: 'base:func:trinity_restart', kind: 'restartInit' },
    ],
    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:trinity_donation', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:trinity_donation', value: '3' }],
      },
    ],
    upgradeCostBase: 55,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  {
    id: 'base:spot:trinity_repair',
    areaId: 'base:area:trinity_cathedral',
    name: '古文书修复台',
    description: '满是古籍与羊皮纸的修复工坊。每修复一页，信用点便伴随历史苏醒。',
    baseCost: Expr.const(30),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(9),
    baseYieldResource: Resource.Credit,
    baseCapacity: 300,
    managerBonusYield: Expr.const(5),
    tags: [tagPath('archive'), tagPath('book')],
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 15 }) },
      { reveal: 'utility', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 50 }) },
    ],

    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:trinity_repair', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:trinity_repair', value: '3' }],
      },
    ],
    upgradeCostBase: 130,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  // ============================================================
  // 崔妮蒂 — 茶话会室
  // ============================================================
  {
    id: 'base:spot:trinity_tea_prep',
    areaId: 'base:area:trinity_tea_room',
    name: '茶会准备台',
    description: '精致的茶具与点心摆满桌面。淑女们在优雅的茶香中讨论着学园的未来。',
    baseCost: Expr.const(25),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(10),
    baseYieldResource: Resource.Credit,
    baseCapacity: 280,
    managerBonusYield: Expr.const(5),
    tags: [tagPath('tea'), tagPath('rest'), tagPath('politics')],
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 18 }) },
      { reveal: 'utility', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 55 }) },
    ],

    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:trinity_tea_prep', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:trinity_tea_prep', value: '3' }],
      },
    ],
    upgradeCostBase: 110,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  // ============================================================
  // 盖赫纳 — 万魔殿本部
  // ============================================================
  {
    id: 'base:spot:gehenna_hall',
    areaId: 'base:area:gehenna_council',
    name: '万魔殿会议厅',
    description: '桌椅歪斜、文件散落的会议厅。看似杂乱无章，却总能高效地完成行政工作。',
    baseCost: Expr.const(0),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(7),
    baseYieldResource: Resource.Credit,
    baseCapacity: 350,
    managerBonusYield: Expr.const(4),
    tags: [tagPath('admin'), tagPath('discipline'), tagPath('office')],
    functionalities: [
      { id: 'base:func:gehenna_restart', kind: 'restartInit' },
    ],
    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:gehenna_hall', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:gehenna_hall', value: '3' }],
      },
    ],
    upgradeCostBase: 65,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
  // ============================================================
  // 盖赫纳 — 商业街
  // ============================================================
  {
    id: 'base:spot:gehenna_bureau',
    areaId: 'base:area:gehenna_district',
    name: '便利屋68据点',
    description: '挂着"业务中"牌子的小事务所。社长亚瑠的"法外"业务为学园带来意想不到的收益。',
    baseCost: Expr.const(35),
    baseCostResource: Resource.Credit,
    baseYield: Expr.const(11),
    baseYieldResource: Resource.Credit,
    baseCapacity: 260,
    managerBonusYield: Expr.const(6),
    tags: [tagPath('business'), tagPath('outlaw'), tagPath('shop')],
    revealTriggers: [
      { reveal: 'name', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 25 }) },
      { reveal: 'utility', condition: and({ target: 'resource', key: Resource.Credit, comparator: '>=', value: 70 }) },
    ],

    levelUpgrades: [
      {
        level: 2,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:gehenna_bureau', value: '2' }],
      },
      {
        level: 3,
        effects: [{ op: 'setSpotLevel', target: 'base:spot:gehenna_bureau', value: '3' }],
      },
    ],
    upgradeCostBase: 150,
    upgradeCostGrowth: 1.8,
    yieldPerLevel: 1,
  },
];
