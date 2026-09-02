import { line, narrate, passiveStory, story } from './def-factory';
import type { PassiveStoryEntry } from '../../data-services/contracts/story-entry';
import type { StoryDef } from '../../data-services/contracts/story';

export const baseAffectionStepStories: StoryDef[] = [
  story('base:story:affinity_hoshino_1', '好感台阶 · 星野：午后的便当')
    .scene(
      line('星野', '……队长，便当还合口味吗？'),
      line('星野', '呵呵，那就好。下次……也一起吃吧。').effects({ op: 'addAffectionExp', target: 'Hoshino', value: 50 }),
    ).build(),
  story('base:story:affinity_hoshino_2', '好感台阶 · 星野：黄昏的堤防')
    .scene(
      narrate('——阿比多斯 · 堤防 · 黄昏——', 'center'),
      line('星野', '黄昏的海，总会让人想起点什么……'),
      line('星野', '能这样并肩看海，就已经很满足了哦，队长。').effects({ op: 'addAffectionExp', target: 'Hoshino', value: 50 }),
    ).build(),
  story('base:story:affinity_hoshino_bond_tail', '羁绊尾巴 · 星野：堤防之后')
    .scene(
      narrate('——阿比多斯 · 堤防 · 归途——', 'center'),
      line('星野', '……剧情就到这里。剩下的，我们边走边说吧，队长。'),
      narrate('——羁绊剧情 · 午后的堤防 完——', 'center'),
    ).build(),
];

export const baseAffectionSteps: PassiveStoryEntry[] = [
  passiveStory('base:passivestory:affinity_hoshino_1', 'base:story:affinity_hoshino_1').owner('Hoshino').repeatable(false).affectionRequired(1).build(),
  passiveStory('base:passivestory:affinity_hoshino_2', 'base:story:affinity_hoshino_2').owner('Hoshino').repeatable(false).affectionRequired(3).build(),
  passiveStory('base:passivestory:affinity_hoshino_bond_tail', 'base:story:affinity_hoshino_bond_tail').owner('Hoshino').repeatable(false).pushAfterStory('base:story:bond_hoshino_1').build(),
];
