import { story } from '../def-factory/index';
import type { StoryDef } from '../../../data-services/contracts/story';

export const baseHoshinoStories: StoryDef[] = [
  story('base:story:hoshino_tea_time', '星野的茶点时间').startInCharaspace('Hoshino').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'input' }, 'p2-response': { advance: 'auto' }, 'p1-response': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师，茶要趁热喝哦。食堂今天的点心也特别好吃。', speaker: '小鸟游星野' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '那我不客气了。', result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] }] } } },
  { id: 'p1-button-response', type: 'talklet', stageId: 'p1-response', content: { kind: 'talk', text: '那我不客气了。', speaker: '老师' }, presentation: { side: 'right' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '嘿嘿，能和老师一起喝茶，感觉一天都会很顺利呢。', speaker: '小鸟游星野' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '我也是。', result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] }] } } },
  { id: 'p2-button-response', type: 'talklet', stageId: 'p2-response', content: { kind: 'talk', text: '我也是。', speaker: '老师' }, presentation: { side: 'right' } },
]).build(),
  story('base:story:hoshino_rooftop_hint', '星野的天台邀约').startInCharaspace('Hoshino').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'input' }, 'p2-response': { advance: 'auto' }, 'p1-response': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师……天台的风景，现在一定很好看吧。', speaker: '小鸟游星野' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '想去看看。', result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] }] } } },
  { id: 'p1-button-response', type: 'talklet', stageId: 'p1-response', content: { kind: 'talk', text: '想去看看。', speaker: '老师' }, presentation: { side: 'right' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '那、那我去天台等您。您也来吗？……不来我也不怪您哦。', speaker: '小鸟游星野' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '这就来。', result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] }] } } },
  { id: 'p2-button-response', type: 'talklet', stageId: 'p2-response', content: { kind: 'talk', text: '这就来。', speaker: '老师' }, presentation: { side: 'right' } },
  { id: 'rooftop-continue', type: 'click', stageId: 'p2', interaction: { kind: 'areaContinue', areaId: 'base:area:schale_rooftop' } },
  { id: 'rooftop-scene', type: 'transfer', transfer: { mode: 'insert', storyId: 'base:story:hoshino_rooftop_meet' } },
]).build(),
  story('base:story:hoshino_rooftop_meet', '天台的相遇').startInCharaspace('Hoshino').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'input' }, 'p3': { advance: 'input' }, 'p3-response': { advance: 'auto' }, 'p2-response': { advance: 'auto' }, 'p1-response': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师，您真的来了……！晚霞把天空染成橘色，像我们第一次见面那天一样。', speaker: '小鸟游星野' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '我答应过你呀。', result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 10 }] }] } } },
  { id: 'p1-button-response', type: 'talklet', stageId: 'p1-response', content: { kind: 'talk', text: '我答应过你呀。', speaker: '老师' }, presentation: { side: 'right' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '……能和老师并肩看这片晚霞，就是我最想做的事。', speaker: '小鸟游星野' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '以后也要一起来。', result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 10 }] }, { kind: 'travel', areaId: 'base:area:schale_main', notice: true }] } } },
  { id: 'p2-button-response', type: 'talklet', stageId: 'p2-response', content: { kind: 'talk', text: '以后也要一起来。', speaker: '老师' }, presentation: { side: 'right' } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '天台风大，我们去图书馆吧。那里有你说的那本旧童话……我还想听老师讲一遍。', speaker: '小鸟游星野' } },
  { id: 'p3-button', type: 'click', stageId: 'p3', interaction: { kind: 'button', text: '好，边走边讲。', result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 10 }] }] } } },
  { id: 'p3-button-response', type: 'talklet', stageId: 'p3-response', content: { kind: 'talk', text: '好，边走边讲。', speaker: '老师' }, presentation: { side: 'right' } },
]).build(),
  story('base:story:hoshino_selfie', '星野的自拍').startInCharaspace('Hoshino').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'input' }, 'p2-response': { advance: 'auto' }, 'p1-response': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师老师！给你看我刚拍的自拍！', speaker: '小鸟游星野', image: 'base:sticker(pic):hoshino_selfie' }, presentation: { avatar: 'base:avatar(pic):hoshino' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '哦？我看看。', result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] }] } } },
  { id: 'p1-button-response', type: 'talklet', stageId: 'p1-response', content: { kind: 'talk', text: '哦？我看看。', speaker: '老师' }, presentation: { side: 'right' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '嘿嘿，是不是超可爱？下次也帮老师拍一张！', speaker: '小鸟游星野' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '好呀，那就说定了。', result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] }] } } },
  { id: 'p2-button-response', type: 'talklet', stageId: 'p2-response', content: { kind: 'talk', text: '好呀，那就说定了。', speaker: '老师' }, presentation: { side: 'right' } },
]).build(),
  story('base:story:hoshino_bond_invite', '羁绊邀请').startInCharaspace('Hoshino').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'input' }, p3: { advance: 'input' }, 'p2-response': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '——星野似乎有话想说……——' }, presentation: { align: 'center' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '老师，有件事想跟你说……', speaker: '星野' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '嗯？什么事？' } },
  { id: 'p2-button-response', type: 'talklet', stageId: 'p2-response', content: { kind: 'talk', text: '嗯？什么事？', speaker: '老师' }, presentation: { side: 'right' } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '星野酝酿了一下情绪……' } },
  { id: 'p3-entry', type: 'click', stageId: 'p3', interaction: { kind: 'kizunaCard' } },
  { id: 'evening-return', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '今天很开心，老师。下次再一起去吧。', speaker: '星野' } },
]).build(),
];
import { Resource } from '../../types/ids';
