import { passiveStory, story } from '../def-factory/index';
import type { PassiveStoryEntry } from '../../../data-services/contracts/story-entry';
import type { StoryDef } from '../../../data-services/contracts/story';

export const baseAffectionStepStories: StoryDef[] = [
  story('base:story:affinity_hoshino_1', '好感台阶 · 星野：午后的便当').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '……队长，便当还合口味吗？', speaker: '星野' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '呵呵，那就好。下次……也一起吃吧。', speaker: '星野' } },
  { id: 'p2-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'addAffectionExp', variantId: 'Hoshino', amount: 50 }] } },
]).build(),
  story('base:story:affinity_hoshino_2', '好感台阶 · 星野：黄昏的堤防').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' }, 'p3': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '——阿比多斯 · 堤防 · 黄昏——' }, presentation: { align: 'center' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '黄昏的海，总会让人想起点什么……', speaker: '星野' } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '能这样并肩看海，就已经很满足了哦，队长。', speaker: '星野' } },
  { id: 'p3-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'addAffectionExp', variantId: 'Hoshino', amount: 50 }] } },
]).build(),
  story('base:story:affinity_hoshino_bond_tail', '羁绊尾巴 · 星野：堤防之后').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' }, 'p3': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '——阿比多斯 · 堤防 · 归途——' }, presentation: { align: 'center' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '……剧情就到这里。剩下的，我们边走边说吧，队长。', speaker: '星野' } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'narration', text: '——羁绊剧情 · 午后的堤防 完——' }, presentation: { align: 'center' } },
]).build(),
];

export const baseAffectionSteps: PassiveStoryEntry[] = [
  passiveStory('base:passivestory:affinity_hoshino_1', 'base:story:affinity_hoshino_1').owner('Hoshino').repeatable(false).affectionRequired(1).build(),
  passiveStory('base:passivestory:affinity_hoshino_2', 'base:story:affinity_hoshino_2').owner('Hoshino').repeatable(false).affectionRequired(3).build(),
  passiveStory('base:passivestory:affinity_hoshino_bond_tail', 'base:story:affinity_hoshino_bond_tail').owner('Hoshino').repeatable(false).pushAfterStory('base:story:bond_hoshino_1').build(),
];
