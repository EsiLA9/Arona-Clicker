import { story } from '../def-factory/index';
import type { StoryDef } from '../../../data-services/contracts/story';

export const baseAbydosMainStories: StoryDef[] = [
  story('base:story:abydos_welcome', '沙漠中的学园').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'input' }, 'p3': { advance: 'auto' }, 'p4': { advance: 'input' }, 'p5': { advance: 'input' }, 'p6': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '—— 阿比多斯学院 · 对策委员会室 ——' }, presentation: { align: 'center' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '……你来了。阿比多斯对策委员会，欢迎你的加入。', speaker: '白子' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '请多关照，白子。', reply: { kind: 'talk', text: '请多关照，白子。' } } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'narration', text: '* 门边探出半个脑袋，星野正打着哈欠。*' }, presentation: { align: 'right' } },
  { id: 'p4-body', type: 'talklet', stageId: 'p4', content: { kind: 'talk', text: '呼啊～又多了一个人呢。不过大叔我今天想偷懒……让野乃美带你转转吧。', speaker: '星野' } },
  { id: 'p4-button', type: 'click', stageId: 'p4', interaction: { kind: 'button', text: '星野前辈，请认真一点！', reply: { kind: 'talk', text: '星野前辈，请认真一点！' } } },
  { id: 'p5-body', type: 'talklet', stageId: 'p5', content: { kind: 'talk', text: '老师，这边是校舍和泳池。虽然设施有点旧了，但大家都很努力在维护。', speaker: '野乃美' } },
  { id: 'p5-choice', type: 'click', stageId: 'p5', interaction: { kind: 'choice', options: [{ id: 'option1', text: '先去对策委员会室看看', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'abydos_choice', value: 'committee' }] }] } }, { id: 'option2', text: '去泳池那边巡逻', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'abydos_choice', value: 'pool' }] }] } }] } },
  { id: 'p6-body', type: 'talklet', stageId: 'p6', content: { kind: 'talk', text: '老师，请多帮忙了！我们一定会把学园恢复成以前的样子！', speaker: '芹香' } },
  { id: 'p6-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 15 }, { op: 'addItem', itemId: 'base:item:tactical_kit', amount: 1 }] } },
]).build(),
];
import { Resource } from '../../types/ids';
