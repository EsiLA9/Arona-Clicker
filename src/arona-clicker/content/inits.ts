import type { InitDef } from '../../data-services/contracts/world';
import { Resource } from '../types/ids';

import {
  AreaId,
  StoryId,
  and,
  cond,
  or,
  TriggerDef,
} from '../../engine/types';
import { init } from './def-factory/init';

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
    on: { kind: 'spotLevel' },
    condition: and({ target: 'resource', key: 'base:resource:credit', comparator: '>=', value: 100 }),
    effects: [{ op: 'addResource', target: Resource.Credit, value: 10 }],
    once: true,
  },
  {
    id: 'base:trigger:hoshino_rooftop_story',
    on: { kind: 'area', areaId: 'base:area:schale_rooftop' },
    condition: and(cond('hasReadStory', 'base:story:hoshino_rooftop_hint', '==', 1)),
    effects: [{ op: 'triggerStory', target: 'base:activestory:hoshino_rooftop_meet', value: 0 }],
    once: true,
  },
];

export const baseInits: InitDef[] = [
  init('base:init:schale_office')
    .name('夏莱办公室')
    .desc('一切故事的起点。作为 Schale 的老师，从这间办公室开始，与学生们一起书写日常。适合新玩家建立第一座经营阵地。')
    .areas('base:area:schale_main')
    .startStory(SCHALE)
    .triggers(...schaleTriggers)
    .tilt('0.999')
    .build(),
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
