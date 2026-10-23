import { activeStory, story } from '../def-factory/index';
import type { ActiveStoryEntry } from '../../../data-services/contracts/story-entry';
import type { StoryDef } from '../../../data-services/contracts/story';

export const baseBondStoryEntries: ActiveStoryEntry[] = [
  activeStory('base:activestory:bond_hoshino_1', 'base:story:bond_hoshino_1').owner('Hoshino').replayable().openingTitle('星野 · 午后的堤防').build(),
  activeStory('base:activestory:bond_hoshino_evening', 'base:story:bond_hoshino_evening').owner('Hoshino').replayable().openingTitle('星野 · 傍晚的河堤').build(),
];

export const baseBondStories: StoryDef[] = [
  story('base:story:bond_hoshino_1', '羁绊剧情 · 星野：午后的堤防').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' }, 'p3': { advance: 'input' }, 'p4': { advance: 'input' }, 'p5': { advance: 'auto' } }).nodes([
  { id: 'p1-opening-0', type: 'operation', action: { kind: 'presentation', command: { command: 'openingTitle', title: '星野 · 午后的堤防' } } },
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '——阿比多斯 · 堤防 · 午后——' }, presentation: { align: 'center' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '唔……老师也来吹风吗……海风很舒服哦……', speaker: '星野' } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '（在她旁边坐下）', speaker: '老师' } },
  { id: 'p3-button', type: 'click', stageId: 'p3', interaction: { kind: 'button', text: '（默默坐下）', reply: { kind: 'talk', text: '（默默坐下）' } } },
  { id: 'p4-body', type: 'talklet', stageId: 'p4', content: { kind: 'talk', text: '说起来……队长还记得第一次见面的时候吗？', speaker: '星野' } },
  { id: 'p4-choice', type: 'click', stageId: 'p4', interaction: { kind: 'choice', options: [{ id: 'option1', text: '当然记得，就在对策委员会室。', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'bond_hoshino_choice', value: 'committee' }] }] } }, { id: 'option2', text: '抱歉……有点记不清了。', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'bond_hoshino_choice', value: 'forget' }] }] } }] } },
  { id: 'p5-body', type: 'talklet', stageId: 'p5', content: { kind: 'talk', text: '呵呵……没关系哦。反正以后的日子还长着呢，队长。', speaker: '星野' } },
  { id: 'p5-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'setFlag', flagId: 'bond_hoshino_done', value: '1' }] } },
]).build(),
  story('base:story:bond_hoshino_evening', '羁绊剧情 · 星野：傍晚的河堤').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'input' }, 'p3': { advance: 'input' }, 'p4': { advance: 'auto' } }).nodes([
  { id: 'p1-opening-0', type: 'operation', action: { kind: 'presentation', command: { command: 'openingTitle', title: '星野 · 傍晚的河堤' } } },
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '——阿比多斯 · 河堤 · 黄昏——' }, presentation: { align: 'center' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '……老师，其实我一直想找机会单独跟您聊聊。', speaker: '星野' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '我也有话想跟你说。', reply: { kind: 'talk', text: '我也有话想跟你说。' } } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '最近总觉得一个人发呆的时候，会想起很多以前的事。', speaker: '星野' } },
  { id: 'p3-choice', type: 'click', stageId: 'p3', interaction: { kind: 'choice', options: [{ id: 'option1', text: '回忆过去也很重要呢。', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'bond_evening_choice', value: 'memory' }] }] } }, { id: 'option2', text: '那就多创造新的回忆吧。', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'bond_evening_choice', value: 'new' }] }] } }] } },
  { id: 'p4-body', type: 'talklet', stageId: 'p4', content: { kind: 'talk', text: '嗯……说得对。不管是过去的还是未来的，只要和老师一起，就都是好时光。', speaker: '星野' } },
  { id: 'p4-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'setFlag', flagId: 'bond_evening_done', value: '1' }] } },
]).build(),
];
