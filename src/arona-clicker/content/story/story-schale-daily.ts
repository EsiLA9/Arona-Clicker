import { story } from '../def-factory/index';
import type { StoryDef } from '../../../data-services/contracts/story';

export const baseSchaleDailyStories: StoryDef[] = [
  story('base:story:schale_tea', '阿罗娜的茶点').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师，杯子里只剩下一层茶渍了。要不要我准备一些新茶？', speaker: '阿罗娜' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '那就麻烦你了。', reply: { kind: 'talk', text: '那就麻烦你了。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 3 }] }] } } },
]).build(),
  story('base:story:schale_printer', '打印机的抱怨').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '信用点制造机又卡纸了……不过它其实只是在用这种方式抗议加班。', speaker: '阿罗娜' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '让它休息一下吧。', reply: { kind: 'talk', text: '让它休息一下吧。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 4 }] }] } } },
]).build(),
  story('base:story:schale_archive', '档案室的尘埃').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '资料室的卷宗堆得比我还高了。老师，也许该归档一下？', speaker: '阿罗娜' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '明天再说吧。', reply: { kind: 'talk', text: '明天再说吧。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 3 }] }] } } },
]).build(),
  story('base:story:schale_sunset', '窗边的晚霞').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '太阳要下山了。夏莱的窗户正好能看见整片晚霞。', speaker: '阿罗娜' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '很适合停下来看看。', reply: { kind: 'talk', text: '很适合停下来看看。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 5 }] }] } } },
]).build(),
  story('base:story:schale_planner', '日程表攻防').stages({ 'p1': { advance: 'input' }, 'p2': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师，明天的日程已经排好了……虽然您八成会全部推迟。', speaker: '阿罗娜' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '说得这么直白真的好吗。', reply: { kind: 'talk', text: '说得这么直白真的好吗。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 3 }] }] } } },
  { id: 'p2-body', type: 'talklet', stageId: 'p2', content: { kind: 'talk', text: '那就把最难的报告安排在深夜时段吧——反正您那个时候反而很有精神！', speaker: '阿罗娜' } },
  { id: 'p2-button', type: 'click', stageId: 'p2', interaction: { kind: 'button', text: '那就这么定了。', reply: { kind: 'talk', text: '那就这么定了。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 2 }, { op: 'setFlag', flagId: 'night_mode', value: '1' }] }] } } },
]).build(),
  story('base:story:schale_vending', '贩卖机的秘密').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '走廊尽头的自动贩卖机，第三排的咖啡罐……其实是装了能量饮料的伪装版。', speaker: '阿罗娜' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '谁干的？', reply: { kind: 'talk', text: '谁干的？' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 4 }] }] } } },
]).build(),
  story('base:story:schale_night', '深夜的夏莱').stages({ 'p1': { advance: 'input' } }).nodes([
  { id: 'p1-body', type: 'talklet', stageId: 'p1', content: { kind: 'talk', text: '老师，都这个时间了还不休息吗？……好吧，那我把台灯调暗一点。', speaker: '阿罗娜' } },
  { id: 'p1-button', type: 'click', stageId: 'p1', interaction: { kind: 'button', text: '再十分钟就好。', reply: { kind: 'talk', text: '再十分钟就好。' }, result: { actions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: Resource.Credit, amount: 6 }] }] } } },
]).build(),
];
import { Resource } from '../../types/ids';
