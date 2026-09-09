import type { InitDef } from '../../data-services/contracts/world';
import type { ThemeDef } from '../../engine/types/theme';
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

const initTheme = (colors: { primary: string; secondary: string; surface: string; ink: string; shape?: 'rounded-rectangle' | 'rounded-parallelogram' }): ThemeDef => ({
  palette: [colors.primary, colors.secondary],
  tokens: { primary: colors.primary, bg: colors.surface, bgAlt: colors.secondary, text: colors.ink, border: colors.primary, accent: colors.secondary },
  background: [{ id: 'init-atmosphere', kind: 'gradient', value: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.secondary} 100%)`, opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }],
  backgroundVariants: [
    { id: 'new', layers: [{ id: 'init-atmosphere', kind: 'gradient', value: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.secondary} 100%)`, opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }] },
    { id: 'active', layers: [{ id: 'init-atmosphere', kind: 'gradient', value: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.primary} 100%)`, opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }] },
    { id: 'advanced', layers: [{ id: 'init-atmosphere', kind: 'gradient', value: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.primary} 100%)`, opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }] },
    { id: 'completed', layers: [{ id: 'init-atmosphere', kind: 'gradient', value: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`, opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }] },
    { id: 'warning', layers: [{ id: 'init-atmosphere', kind: 'gradient', value: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.surface} 100%)`, opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }] },
  ],
  presentation: {
    hosts: [
      {
        id: 'header.button', shape: colors.shape ?? 'rounded-rectangle',
        decoration: { color: colors.primary, width: 1, inset: 0, opacity: 0.82, style: 'solid' },
        layers: [{ id: 'init-header', kind: 'gradient', value: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`, opacity: 0.94, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'local' }],
        states: { active: { decoration: { color: colors.secondary, width: 2 }, layers: [{ id: 'init-header-active', kind: 'solid', value: colors.secondary, opacity: 0.98, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'local' }] } },
      },
      {
        id: 'centerPanel.tab', shape: colors.shape ?? 'rounded-rectangle',
        decoration: { color: colors.primary, width: 1, inset: 0, opacity: 0.72, style: 'solid' },
        layers: [{ id: 'init-tab', kind: 'solid', value: colors.surface, opacity: 0.86, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'local' }],
        states: { active: { layers: [{ id: 'init-tab-active', kind: 'solid', value: colors.primary, opacity: 0.92, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'local' }] } },
      },
      ...(['leftPanel.tabs', 'centerPanel.tabs', 'rightPanel.tabs'] as const).map(id => ({
        id,
        shape: colors.shape ?? 'rounded-rectangle' as const,
        decoration: { color: colors.primary, width: 1, inset: 0, opacity: 0.62, style: 'solid' as const },
        layers: [{ id: `${id.replace('.', '-')}-background`, kind: 'solid' as const, value: colors.surface, opacity: 0.42, position: 'center', size: 'cover', repeat: 'no-repeat' as const, blendMode: 'normal' as const, attachment: 'local' as const }],
      })),
      {
        id: 'card.action', shape: colors.shape ?? 'rounded-rectangle',
        decoration: { color: colors.secondary, width: 1, inset: 0, opacity: 0.82, style: 'solid' },
        layers: [{ id: 'init-action', kind: 'solid', value: colors.primary, opacity: 0.9, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'local' }],
        states: { disabled: { decoration: { color: colors.primary, opacity: 0.5 }, layers: [{ id: 'init-action-disabled', kind: 'solid', value: colors.surface, opacity: 0.46, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'local' }] } },
      },
    ],
  },
});

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
    .theme(initTheme({ primary: '#3b82f6', secondary: '#93c5fd', surface: '#eff6ff', ink: '#102a56', shape: 'rounded-parallelogram' }))
    .tilt('0.999')
    .build(),
  init('base:init:millennium')
    .name('千禧年学院')
    .desc('科技与逻辑的学府。以高效率生产闻名，可解锁工程师长评、自动化流水线等高精尖 Spot。适合追求极致产能的玩家。')
    .areas(MILLENNIUM_AREA)
    .cost(Resource.Pyroxene, 20)
    .tilt('0.985')
    .theme(initTheme({ primary: '#4f46e5', secondary: '#22d3ee', surface: '#eef2ff', ink: '#172554', shape: 'rounded-parallelogram' }))
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
    .theme(initTheme({ primary: '#d97706', secondary: '#facc15', surface: '#fffbeb', ink: '#422006' }))
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
    .theme(initTheme({ primary: '#be185d', secondary: '#f9a8d4', surface: '#fff1f2', ink: '#4a1028' }))
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
    .theme(initTheme({ primary: '#dc2626', secondary: '#fb923c', surface: '#fff7ed', ink: '#431407', shape: 'rounded-parallelogram' }))
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
