import { story } from '../def-factory/index';
import type { StoryDef } from '../../../data-services/contracts/story';

export const baseRegionalChatStories: StoryDef[] = [
  story('base:story:abydos_daily_committee', '对策委员会的日常').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '今天的巡逻报告都整理好了。野乃美前辈说沙漠方向的设备状态良好。', speaker: '彩奈' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '做得好，彩奈。', reply: { kind: 'talk', text: '做得好，彩奈。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 4 }] }] } } },
]).build(),
  story('base:story:abydos_siesta', '星野的午睡').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '呼……沙发真是人类最伟大的发明之一啊。老师要不要也躺一会？', speaker: '星野' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '不行，工作还没做完。', reply: { kind: 'talk', text: '不行，工作还没做完。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 6 }] }, { kind: 'presentation', command: { command: 'theme', value: { colorGroupId: 'base:colorgroup:hoshino-swim' } } }] } } },
]).build(),
  story('base:story:abydos_serika_shift', '芹香的兼职').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '打工结束了！老师，今天便利店有过期便当，我顺便带了一些回来……省一点是一点嘛。', speaker: '芹香' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '辛苦了，芹香。', reply: { kind: 'talk', text: '辛苦了，芹香。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 3 }] }] } } },
]).build(),
  story('base:story:abydos_money', '还债日记').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '这个月的还债计划比上个月多完成了 3%。老师，阿比多斯的债务正在一点点减少呢。', speaker: '野乃美' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '一步一步来。', reply: { kind: 'talk', text: '一步一步来。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 7 }] }] } } },
]).build(),
  story('base:story:millennium_calculation', '优香的财务报告').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '本期的信用点收入比上期增加了 8.5%。虽然数据很好看，但请不要因此放松管理。', speaker: '优香' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '放心，优香。', reply: { kind: 'talk', text: '放心，优香。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] }] } } },
]).build(),
  story('base:story:millennium_game_dev', '游戏开发部的坚持').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '姐姐，游戏引擎又崩溃了。不过别担心，数据都自动备份了。', speaker: '美依' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '需要帮忙调试吗？', reply: { kind: 'talk', text: '需要帮忙调试吗？' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 6 }] }] } } },
]).build(),
  story('base:story:millennium_hack', '小雪的恶作剧').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '嘿嘿，我发现了一个系统漏洞……不过老师放心，我只是用那个算力挖了一些信用点！', speaker: '小雪' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '记得报告给乃爱。', reply: { kind: 'talk', text: '记得报告给乃爱。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 8 }] }] } } },
]).build(),
  story('base:story:millennium_server', '服务器的秘密').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '服务器机房的利用率已经达到了 94%。按照这个趋势，我们需要在下个月申请扩容预算。', speaker: '乃爱' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '让优香批一下。', reply: { kind: 'talk', text: '让优香批一下。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 7 }] }] } } },
]).build(),
];
import { Resource } from '../../types/ids';
