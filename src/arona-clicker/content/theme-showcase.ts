import { Character } from '../types/ids';
import { area, enhancement, init, passiveStory, spot } from './def-factory';
import type { AreaDef, InitDef, SpotDef } from '../../data-services/contracts/world';
import type { EnhancementDef } from '../../data-services/contracts/enhancement';
import type { PassiveStoryEntry } from '../../data-services/contracts/story-entry';
import type { ThemeDef } from '../../engine/types/theme';
import { tagPath } from '../../engine/core/tag';

export const THEME_SHOWCASE_INIT = 'base:init:theme_showcase' as const;
export const THEME_SHOWCASE_AREA = 'base:area:theme_showcase' as const;
export const THEME_SHOWCASE_SPOTS = ['base:spot:theme_showcase_a', 'base:spot:theme_showcase_b'] as const;
export const THEME_SHOWCASE_ENHANCEMENTS = ['base:enhancement:theme_showcase_a', 'base:enhancement:theme_showcase_b'] as const;
export const THEME_SHOWCASE_VARIANTS = ['Arona', 'Hoshino'] as const;

const THEME_SHOWCASE_THEME: ThemeDef = {
  palette: ['#2563eb', '#06b6d4', '#8b5cf6'],
  tokens: {
    primary: '#2563eb',
    bg: '#dbeafe',
    bgAlt: '#ede9fe',
    panel: '#ffffff',
    text: '#172554',
    border: '#93c5fd',
    accent: '#8b5cf6',
  },
  background: [
    {
      id: 'theme-showcase-atmosphere',
      kind: 'gradient',
      value: 'linear-gradient(135deg, #dbeafe 0%, #cffafe 44%, #ede9fe 100%)',
      opacity: 1,
      position: 'center',
      size: 'cover',
      repeat: 'no-repeat',
      blendMode: 'normal',
      attachment: 'fixed',
    },
    {
      id: 'theme-showcase-glow',
      kind: 'gradient',
      value: 'radial-gradient(circle at 78% 18%, #ffffff 0%, transparent 46%)',
      opacity: 0.72,
      position: 'center',
      size: 'cover',
      repeat: 'no-repeat',
      blendMode: 'normal',
      attachment: 'fixed',
    },
  ],
  presentation: {
    hosts: [
      {
        id: 'header.button',
        shape: 'rounded-parallelogram',
        decoration: { color: '#8b5cf6', width: 1, inset: 0, opacity: 0.84, style: 'solid' },
        layers: [{ id: 'theme-showcase-header', kind: 'gradient', value: 'linear-gradient(135deg, #2563eb, #8b5cf6)', opacity: 0.96, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'local' }],
        states: {
          active: {
            decoration: { color: '#06b6d4', width: 2 },
            layers: [{ id: 'theme-showcase-header-active', kind: 'solid', value: '#06b6d4', opacity: 0.98, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'local' }],
          },
        },
      },
    ],
  },
};

export const themeShowcaseAreas: AreaDef[] = [
  area(THEME_SHOWCASE_AREA, THEME_SHOWCASE_INIT)
    .name('主题实验室')
    .desc('用于观察主题色、UI 语义节点与组件继承关系的临时展示区域。')
    .spots(...THEME_SHOWCASE_SPOTS)
    .background({
      id: 'theme-showcase-triangles',
      kind: 'image',
      value: 'base:overlay(pic):ba_triangles_svg',
      opacity: 1,
      position: 'center',
      size: 'cover',
      repeat: 'no-repeat',
      blendMode: 'normal',
      attachment: 'fixed',
    })
    .build(),
];

export const themeShowcaseSpots: SpotDef[] = [
  spot(THEME_SHOWCASE_SPOTS[0], THEME_SHOWCASE_AREA)
    .name('主题色面板样本')
    .desc('展示 Panel、边框、激活态与主题节点的组合效果。')
    .cost(0).yield(1).capacity(1).managerBonus(0)
    .tags(tagPath('theme', 'showcase'), tagPath('display'))
    .build(),
  spot(THEME_SHOWCASE_SPOTS[1], THEME_SHOWCASE_AREA)
    .name('气泡、状态与商店样本')
    .desc('展示聊天气泡、状态色、对比度派生效果，以及可直接验收的 Spot 商店入口。')
    .cost(0).yield(1).capacity(1).managerBonus(0)
    .tags(tagPath('theme', 'showcase'), tagPath('display'))
    .shop('base:funclet:theme_showcase_shop', 'base:shop:abydos-cafe')
    .build(),
];

export const themeShowcaseEnhancements: EnhancementDef[] = [
  enhancement(THEME_SHOWCASE_ENHANCEMENTS[0])
    .name('主题节点样本 A').desc('展示主题节点覆盖入口的占位强化。')
    .tags(['theme', 'showcase']).attachInit(THEME_SHOWCASE_INIT).build(),
  enhancement(THEME_SHOWCASE_ENHANCEMENTS[1])
    .name('主题节点样本 B').desc('展示作用域继承入口的占位强化。')
    .tags(['theme', 'showcase']).attachInit(THEME_SHOWCASE_INIT).build(),
];

export const themeShowcaseInits: InitDef[] = [
  init(THEME_SHOWCASE_INIT)
    .name('主题系统展示 Init')
    .desc('临时主题实验空间：进入后自动开放主题编辑器，并准备一组可复用的 Spot、Enhancement、角色与被动剧情展示内容。')
    .areas(THEME_SHOWCASE_AREA)
    .theme(THEME_SHOWCASE_THEME)
    .onEnterFirst(
      { op: 'addEnhancement', target: '', value: THEME_SHOWCASE_ENHANCEMENTS[0] },
      { op: 'addEnhancement', target: '', value: THEME_SHOWCASE_ENHANCEMENTS[1] },
      { op: 'addEnhancement', target: '', value: 'base:enhancement:user-theme-editor' },
      { op: 'grantCharacter', target: THEME_SHOWCASE_VARIANTS[0], value: 1 },
      { op: 'grantCharacter', target: THEME_SHOWCASE_VARIANTS[1], value: 1 },
    )
    .build(),
];

/** 复用现有 StoryDef，仅新增一个属于展示 Init 的投放入口。 */
export const themeShowcasePassiveStories: PassiveStoryEntry[] = [
  passiveStory('base:passivestory:theme_showcase', 'base:story:schale_tea')
    .inits(THEME_SHOWCASE_INIT)
    .weight(1)
    .tags(tagPath('theme', 'showcase'))
    .build(),
];
