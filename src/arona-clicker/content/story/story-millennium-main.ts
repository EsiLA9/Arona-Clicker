import { story } from '../def-factory/index';
import type { StoryDef } from '../../../data-services/contracts/story';

export const baseMillenniumMainStories: StoryDef[] = [
  story('base:story:millennium_welcome', '数据与新生').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'input' }, 'p3': { advance: 'auto' }, 'p4': { advance: 'input' }, 'p5': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '—— 千禧年学院 · 研究楼 ——' }, presentation: { align: 'center' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '老师，欢迎来到千禧年学院。我是财务担当早濑优香，这边是研究楼的数据分析站。', speaker: '优香' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '效率很高，不愧是千禧年。', reply: { kind: 'talk', text: '效率很高，不愧是千禧年。' } } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'narration', text: '* 优香翻开预算表，投影屏上跳出一串数据。*' }, presentation: { align: 'left' } },
  { id: 'p4-body', type: 'talklet', stageId: 'p4', content: { kind: 'talk', text: '根据优香前辈的预算表，实验室的信用点产出效率还有 12% 的优化空间。', speaker: '乃爱' } },
  { id: 'p4-choice', type: 'click', stageId: 'p4', interaction: { kind: 'choice', options: [{ id: 'option1', text: '让优香负责财务优化', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'millennium_choice', value: 'yuuka' }] }] } }, { id: 'option2', text: '去游戏开发部看看', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'millennium_choice', value: 'game' }] }] } }] } },
  { id: 'p5-body', type: 'talklet', stageId: 'p5', content: { kind: 'talk', text: '老师老师！我们的游戏马上就要完成了！啊，不过在这之前得先把信用点赚够……', speaker: '桃依' } },
  { id: 'p5-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 12 }, { op: 'addItem', itemId: 'base:item:data_chip', amount: 2 }] } },
]).build(),
  story('base:story:millennium_game_crisis_intro', '游戏开发部的危机 · 开场').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'input' }, 'p3': { advance: 'auto' }, 'p4': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'narration', text: '—— 千禧年学院 · 游戏开发部 ——' }, presentation: { align: 'center' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '老师！游戏引擎又出 bug 了！发行日期就在明天！', speaker: '桃依' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '冷静一下，桃依。', reply: { kind: 'talk', text: '冷静一下，桃依。' } } },
  { id: 'p3-body', type: 'talklet', stageId: 'p3', content: { kind: 'talk', text: '姐姐说她自己能搞定，但已经连续调试 12 个小时了……', speaker: '美依' } },
  { id: 'p3-transfer', type: 'transfer', transfer: { mode: 'insert', storyId: 'base:story:millennium_game_crisis_whisper' } },
  { id: 'p4-body', type: 'talklet', stageId: 'p4', content: { kind: 'talk', text: '好，我来想办法。', speaker: '老师' } },
  { id: 'p4-choice', type: 'click', stageId: 'p4', interaction: { kind: 'choice', options: [{ id: 'option1', text: '亲自上手调试', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'game_crisis_route', value: 'debug' }] }], transfer: { mode: 'goto', storyId: 'base:story:millennium_game_crisis_debug' } } }, { id: 'option2', text: '买冰淇淋犒劳大家', result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'game_crisis_route', value: 'bribe' }] }], transfer: { mode: 'goto', storyId: 'base:story:millennium_game_crisis_bribe' } } }] } },
]).build(),
  story('base:story:millennium_game_crisis_whisper', '美依的悄悄话').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '（小声）其实姐姐昨天偷偷哭了一场……她压力很大的。', speaker: '美依' }, presentation: { avatarMode: 'hide' } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '（小声）别说出去啊老师！这是我们开发部的秘密！', speaker: '桃依' }, presentation: { avatarMode: 'hide' } },
]).build(),
  story('base:story:millennium_game_crisis_debug', '游戏开发部的危机 · 调试').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '我看看这个报错……原来是内存泄漏。', speaker: '老师' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '我来修。', reply: { kind: 'talk', text: '我来修。' } } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '老师太厉害了！修好了！', speaker: '美依' } },
  { id: 'p2-transfer', type: 'transfer', transfer: { mode: 'goto', storyId: 'base:story:millennium_game_crisis_end' } },
]).build(),
  story('base:story:millennium_game_crisis_bribe', '游戏开发部的危机 · 补给').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'auto' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '先吃点东西休息一下吧。', speaker: '老师' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '我请客。', reply: { kind: 'talk', text: '我请客。' } } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '哇，是冰淇淋！吃完就有干劲了！', speaker: '桃依' } },
  { id: 'p2-transfer', type: 'transfer', transfer: { mode: 'goto', storyId: 'base:story:millennium_game_crisis_end' } },
]).build(),
  story('base:story:millennium_game_crisis_end', '游戏开发部的危机 · 收尾').stages({ 'p1': { advance: 'auto' }, 'p2': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '游戏完成！明天一定能顺利发行！', speaker: '桃依' } },
  { id: 'p1-op1', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 20 }] } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '感谢老师！没有你的话我们都不知道该怎么办了。', speaker: '美依' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '这是老师应该做的。', reply: { kind: 'talk', text: '这是老师应该做的。' } } },
]).build(),
];
import { Resource } from '../../types/ids';
