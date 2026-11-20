import { passiveStory, story } from '../def-factory/index';
import type { PassiveStoryEntry } from '../../../data-services/contracts/story-entry';
import type { StoryDef } from '../../../data-services/contracts/story';

export const baseAffectionStepStories: StoryDef[] = [
  story('base:story:affinity_hoshino_1', '好感台阶 · 星野：午后的便当').init('base:init:abydos').startInCharaspace('Hoshino').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '……队长，便当还合口味吗？', speaker: '星野' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '呵呵，那就好。下次……也一起吃吧。', speaker: '星野' } },
  { id: 'p2-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'addAffectionExp', variantId: 'Hoshino', amount: 50 }] } },
]).build(),
  story('base:story:affinity_hoshino_2', '好感台阶 · 星野：黄昏的堤防').init('base:init:abydos').startInCharaspace('Hoshino').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' }, 'p3': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '——阿比多斯 · 堤防 · 黄昏——' }, presentation: { align: 'center' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '黄昏的海，总会让人想起点什么……', speaker: '星野' } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '能这样并肩看海，就已经很满足了哦，队长。', speaker: '星野' } },
  { id: 'p3-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'addAffectionExp', variantId: 'Hoshino', amount: 50 }] } },
]).build(),
  story('base:story:affinity_hoshino_bond_tail', '好感邀约 · 星野：午后的堤防').init('base:init:abydos').startInCharaspace('Hoshino').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' }, 'p3': { advance: 'auto' } }).nodes([
  { id: 'bond-invitation', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '队长，午后一起去堤防坐坐吧。', speaker: '星野' } },
  { id: 'bond-card', type: 'click', stageId: 'p1', interaction: { kind: 'entryCard', card: { request: { entryId: 'base:activestory:bond_hoshino_1', entryType: 'active', owner: null, intent: 'card' }, continuation: { returnFlags: ['hoshino-remembers', 'hoshino-new-memories'] } } } },
  { id: 'remembered', type: 'talklet', stageId: 'p2', requiresFlag: 'hoshino-remembers', content: { kind: 'talk', text: '原来队长一直记得第一次见面呀。看到这条消息，我又有点开心了。', speaker: '星野' } },
  { id: 'new-memories', type: 'talklet', stageId: 'p2', requiresFlag: 'hoshino-new-memories', content: { kind: 'talk', text: '那就从今天开始，再多留下一些新回忆吧，队长。', speaker: '星野' } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '下次的约定，我会再发消息告诉你的。今天就好好休息吧。', speaker: '星野' } },
]).build(),
];

export const baseAffectionSteps: PassiveStoryEntry[] = [
  passiveStory('base:passivestory:affinity_hoshino_1', 'base:story:affinity_hoshino_1').owner('Hoshino').inits('base:init:abydos').repeatable(false).affectionRequired(1).build(),
  passiveStory('base:passivestory:affinity_hoshino_2', 'base:story:affinity_hoshino_2').owner('Hoshino').inits('base:init:abydos').repeatable(false).affectionRequired(3).build(),
  passiveStory('base:passivestory:affinity_hoshino_bond_tail', 'base:story:affinity_hoshino_bond_tail').owner('Hoshino').inits('base:init:abydos').repeatable(false).affectionRequired(3).replayable().build(),
];
