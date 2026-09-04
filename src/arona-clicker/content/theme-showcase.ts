import { Character } from '../types/ids';
import { area, enhancement, init, passiveStory, spot } from './def-factory';
import type { AreaDef, InitDef, SpotDef } from '../../data-services/contracts/world';
import type { EnhancementDef } from '../../data-services/contracts/enhancement';
import type { PassiveStoryEntry } from '../../data-services/contracts/story-entry';
import { tagPath } from '../../engine/core/tag';

export const THEME_SHOWCASE_INIT = 'base:init:theme_showcase' as const;
export const THEME_SHOWCASE_AREA = 'base:area:theme_showcase' as const;
export const THEME_SHOWCASE_SPOTS = ['base:spot:theme_showcase_a', 'base:spot:theme_showcase_b'] as const;
export const THEME_SHOWCASE_ENHANCEMENTS = ['base:enhancement:theme_showcase_a', 'base:enhancement:theme_showcase_b'] as const;
export const THEME_SHOWCASE_VARIANTS = ['Arona', 'Hoshino'] as const;

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
    .name('气泡与状态样本')
    .desc('展示聊天气泡、状态色与对比度派生效果。')
    .cost(0).yield(1).capacity(1).managerBonus(0)
    .tags(tagPath('theme', 'showcase'), tagPath('display'))
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
