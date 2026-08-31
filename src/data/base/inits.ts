import type { InitDef } from '../../engine/types';

import {
  AreaId,
  StoryId,
  and,
  cond,
  init,
  or,
  Resource,
  TriggerDef,
} from '../../engine/types';

// ============================================================
// 世界线数据 — 发现 / 揭示 / 购买递进
// ============================================================
//
// 递进模型（6 层）：
//   invisible   → 完全不可见
//   presence    → 「???」黑盒占位
//   partial     → 名称可见，其余 ???
//   known       → 名称 + 解锁条件可见
//   utility     → 名称 + 条件 + 描述全部可见
//   purchaseable → 可购买（资源足够 + 条件满足）
//   owned       → 已解锁，可进入
//
// 定价逻辑（货币：青辉石 = 跨世界线保留的 Global 资源，唯一来源为被动闲聊奖励）：
//   千禧年    20 青辉石（第一门付费世界线，价格温和）
//   阿比多斯  40 青辉石（累计产出 800 后解锁条件揭示）
//   崔妮蒂    80 青辉石（累计产出 2000 后解锁条件揭示）
//   盖赫纳    150 青辉石（终极世界线）
//
// 发现路径：
//   进入夏莱 → 完成闲聊积累青辉石 → 累计 300 credit → 千禧年可购买
//   累计 800 credit → 阿比多斯存在感显现 → 继续积累后可购买
//   解锁 2 条世界线 OR 累计 2000 credit → 崔妮蒂存在感显现
//   解锁 3 条世界线 OR 累计 4000 credit → 盖赫纳存在感显现
//
// 世界倾斜数值（worldTilt）：神圣之塔对地极坐标概念，表述世界变动率。
//   1 = 蔚蓝档案官方世界，0 = Vol.Final 指示的前世界；尾数不足 15 位自动补 0。
//   选择页按该数值降序单列排列（高在上低在下）。
// ============================================================

const SCHALE: StoryId = 'base:activestory:schale_welcome';

const MILLENNIUM_AREA: AreaId = 'base:area:millennium_lab';
const ABYDOS_AREA: AreaId = 'base:area:abydos_campus';
const TRINITY_AREA: AreaId = 'base:area:trinity_cathedral';
const GEHENNA_AREA: AreaId = 'base:area:gehenna_council';

const schaleTriggers: TriggerDef[] = [
  {
    id: 'base:trigger:schale_entered',
    on: { kind: 'init', initId: 'base:init:schale_office' },
    effects: [{ op: 'setFlag', target: 'schale_entered', value: '1' }],
    once: true,
  },
  {
    id: 'base:trigger:schale_first_upgrade',
    // 首个 Spot 首次升级时触发一次性奖励
    on: { kind: 'spotLevel' },
    condition: and(
      { target: 'resource', key: 'base:resource:credit', comparator: '>=', value: 100 },
    ),
    effects: [{ op: 'addResource', target: Resource.Credit, value: 10 }],
    once: true,
  },
  {
    // 天台剧情：玩家已通过星野聊天空间播完天台邀约（hoshino_rooftop_hint 已读）后，
    // 首次进入夏莱天台时自动触发天台相遇演出（区域事件驱动剧情）。
    // condition 用 hasReadStory 守住"邀约已发布"门槛：未读邀约前进入天台不会外露该剧情。
    // once 保证只触发一次，避免每次进入都重复播放。
    id: 'base:trigger:hoshino_rooftop_story',
    on: { kind: 'area', areaId: 'base:area:schale_rooftop' },
    condition: and(cond('hasReadStory', 'base:story:hoshino_rooftop_hint', '==', 1)),
    effects: [
      // 触发天台相遇剧情（独立于聊天空间邀约，避免重复触发同一故事）
      { op: 'triggerStory', target: 'base:activestory:hoshino_rooftop_meet', value: 0 },
    ],
    once: true,
  },
];

export const baseInits: InitDef[] = [
  // ---------------------------------------------------------
  // L1：夏莱办公室 — 免费初始世界线
  // - 始终可见，始终可进入，无购买费用
  // ---------------------------------------------------------
  init('base:init:schale_office')
    .name('夏莱办公室')
    .desc('一切故事的起点。作为 Schale 的老师，从这间办公室开始，与学生们一起书写日常。适合新玩家建立第一座经营阵地。')
    .areas('base:area:schale_main')
    .startStory(SCHALE)
    .triggers(...schaleTriggers)
    .tilt('0.999')
    .build(),

  // ---------------------------------------------------------
  // L2：千禧年学院 — 首个付费世界线
  // - 始终可见，名称已知
  // - reveal.condition / utility 需要积累 300 credit 后才揭示
  // - 揭示后显示 20 青辉石购买，属于温和定价
  // ---------------------------------------------------------
  init('base:init:millennium')
    .name('千禧年学院')
    .desc('科技与逻辑的学府。以高效率生产闻名，可解锁工程师长评、自动化流水线等高精尖 Spot。适合追求极致产能的玩家。')
    .areas(MILLENNIUM_AREA)
    .cost(Resource.Pyroxene, 20)
    .tilt('0.985')
    .revealCredit('name', 50)
    .revealCredit('condition', 300)
    .revealCredit('utility', 300)
    .build(),

  // ---------------------------------------------------------
  // L3：阿比多斯学院 — 需要积累后才发现
  // - existence：累计 800 credit 后才能在列表中看到
  // - 之后逐步揭示名称、条件、描述
  // - 可购买时需要 40 青辉石
  // ---------------------------------------------------------
  init('base:init:abydos')
    .name('阿比多斯学院')
    .desc('沙漠中的学园，以高产出 Spot 著称但维护成本不菲。可解锁对策委员会专属设施，产出金币与稀有神名文字。适合已有经营经验的玩家。')
    .areas(ABYDOS_AREA)
    .cost(Resource.Pyroxene, 40)
    .tilt('0.96')
    .revealCredit('existence', 800)
    .revealCredit('name', 800)
    .revealCredit('condition', 1200)
    .revealCredit('utility', 1200)
    .build(),

  // ---------------------------------------------------------
  // L4：崔妮蒂学院 — 需要解锁 2+ 世界线后才可见
  // - existence 门槛（可见条件）：至少解锁 2 条世界线，或累计产出大量 credit
  // - name 阈值低于 existence（出现后稍早揭示名称）
  // - 可购买需要 80 青辉石
  // ---------------------------------------------------------
  init('base:init:trinity')
    .name('崔妮蒂学院')
    .desc('悠久传统的贵族学园，政治与社交的交汇点。可解锁修女会、正义实现委员会等势力 Spot，提供强化 buff 而非直接产出。适合寻求全局增幅的玩家。')
    .areas(TRINITY_AREA)
    .cost(Resource.Pyroxene, 80)
    .tilt('0.9725')
    .reveal('existence', or(
      and(cond('stat', '$GlobalUnlockedInits', '>=', 2)),
      and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 2000)),
    ))
    .revealCredit('name', 1000)
    .revealCredit('condition', 1500)
    .revealCredit('utility', 1500)
    .build(),

  // ---------------------------------------------------------
  // L5：盖赫纳学园 — 最终世界线，青辉石唯一来源世界线
  // - existence 门槛（可见条件）：至少解锁 3 条世界线，或累计产出大量 credit
  // - 另有产出 credit 的渐进 existence 揭示（先出现、后揭示详情）
  // - 购买需要 150 青辉石（Global 货币）
  // ---------------------------------------------------------
  init('base:init:gehenna')
    .name('盖赫纳学园')
    .desc('自由奔放的混沌学园，以高风险高回报的 Spot 著称。可解锁美食研究会、风纪委员会等设施，产出青辉石与大量信用点，但伴随随机事件。适合追求刺激的资深玩家。')
    .areas(GEHENNA_AREA)
    .cost(Resource.Pyroxene, 150)
    .tilt('0.9413')
    .tiltAlias('观测受限（伪装值）')
    .reveal('existence', or(
      and(cond('stat', '$GlobalUnlockedInits', '>=', 3)),
      and(cond('stat', '$GlobalProducedAmount base:resource:credit', '>=', 4000)),
    ))
    .revealCredit('existence', 2000)
    .revealCredit('name', 2500)
    .revealCredit('condition', 3000)
    .revealCredit('utility', 3000)
    .build(),
];
