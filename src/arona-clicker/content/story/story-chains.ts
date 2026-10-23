import { story } from '../def-factory/index';
import type { StoryDef } from '../../../data-services/contracts/story';

export const baseStoryChains: StoryDef[] = [
  story('base:story:serika_side_1', '芹香的烦恼 (上)').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'input' }, 'p3': { advance: 'auto' }, 'p4': { advance: 'input' }, 'p4-confirm': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师……其实我最近在便利店遇到了一点麻烦。有个顾客总是说我的找零不对。', speaker: '芹香' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '怎么回事？', reply: { kind: 'talk', text: '怎么回事？' } } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '我也不确定是不是自己的问题……但店长已经开始注意到了。', speaker: '芹香' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '我会帮你查清楚的。', reply: { kind: 'talk', text: '我会帮你查清楚的。' } } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'narration', text: '* 你翻开收银记录，一条条核对当晚的找零流水。*' }, presentation: { align: 'left' } },
  { id: 'p4-work', type: 'click', stageId: 'p4', interaction: { kind: 'button', text: '（调查中……）', press: { base: 4, rand: 2 } } },
  { id: 'p4-confirm-click', type: 'click', stageId: 'p4-confirm', interaction: { kind: 'button', text: '（调查中……）', result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] }] } } },
]).build(),
  story('base:story:serika_side_2', '芹香的烦恼 (下)').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '芹香，我查过了——那个顾客在好几家便利店都投诉过找零问题，是惯犯了。', speaker: '老师' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '真的吗？', reply: { kind: 'talk', text: '真的吗？' } } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '原来不是我的错……太好了。谢谢老师专门去调查！', speaker: '芹香' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '不用谢，这是老师应该做的。', reply: { kind: 'talk', text: '不用谢，这是老师应该做的。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 8 }, { op: 'addItem', itemId: 'base:item:tactical_kit', amount: 1 }] }] } } },
]).build(),
  story('base:story:run_chain_1', '深夜巡逻 (一)').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'input' }, 'p3': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '—— 深夜 · 夏莱走廊 ——' }, presentation: { align: 'center' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '老师，这么晚了还不休息吗？走廊里的灯已经调暗了。', speaker: '阿罗娜' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '我想再巡视一圈。', reply: { kind: 'talk', text: '我想再巡视一圈。' } } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '那我和你一起去。两人走比一个人安全。', speaker: '阿罗娜' } },
  { id: 'p3-button', type: 'click', stageId: 'p3', interaction: { kind: 'button', text: '走吧，阿罗娜。', reply: { kind: 'talk', text: '走吧，阿罗娜。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] }] } } },
]).build(),
  story('base:story:run_chain_2', '深夜巡逻 (二)').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '档案室的门开着。我记得下班前明明锁好了的……', speaker: '阿罗娜' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '进去看看。', reply: { kind: 'talk', text: '进去看看。' } } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '啊，只是窗户没关好，风吹开了门。吓我一跳呢。', speaker: '阿罗娜' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '虚惊一场。关好窗户吧。', reply: { kind: 'talk', text: '虚惊一场。关好窗户吧。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 6 }] }] } } },
]).build(),
  story('base:story:run_chain_3', '深夜巡逻 (三)').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '天快亮了。老师，巡逻结束了，一切都正常。', speaker: '阿罗娜' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '辛苦了，阿罗娜。', reply: { kind: 'talk', text: '辛苦了，阿罗娜。' } } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '老师才辛苦了。明天也请多多指教。', speaker: '阿罗娜' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '晚安（早安），阿罗娜。', reply: { kind: 'talk', text: '晚安（早安），阿罗娜。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 10 }, { op: 'addItem', itemId: 'base:item:energy_drink', amount: 2 }] }] } } },
]).build(),
];
import { Resource } from '../../types/ids';
