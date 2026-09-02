import { story, line, narrate } from './def-factory';
import type { StoryDef } from '../../data-services/contracts/story';

export const baseStoryChains: StoryDef[] = [
  story('base:story:serika_side_1', '芹香的烦恼 (上)').scene(
    line('芹香', '老师……其实我最近在便利店遇到了一点麻烦。有个顾客总是说我的找零不对。', '怎么回事？'),
    line('芹香', '我也不确定是不是自己的问题……但店长已经开始注意到了。', '我会帮你查清楚的。'),
    narrate('* 你翻开收银记录，一条条核对当晚的找零流水。*', 'left'),
    line('老师', '（调查中……）').click(4, 2).effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
  ).build(),
  story('base:story:serika_side_2', '芹香的烦恼 (下)').scene(
    line('老师', '芹香，我查过了——那个顾客在好几家便利店都投诉过找零问题，是惯犯了。', '真的吗？'),
    line('芹香', '原来不是我的错……太好了。谢谢老师专门去调查！', '不用谢，这是老师应该做的。').effects(
      { op: 'addResource', target: Resource.Credit, value: 8 },
      { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
    ),
  ).build(),
  story('base:story:run_chain_1', '深夜巡逻 (一)').scene(
    narrate('—— 深夜 · 夏莱走廊 ——'),
    line('阿罗娜', '老师，这么晚了还不休息吗？走廊里的灯已经调暗了。', '我想再巡视一圈。'),
    line('阿罗娜', '那我和你一起去。两人走比一个人安全。', '走吧，阿罗娜。').effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
  ).build(),
  story('base:story:run_chain_2', '深夜巡逻 (二)').scene(
    line('阿罗娜', '档案室的门开着。我记得下班前明明锁好了的……', '进去看看。'),
    line('阿罗娜', '啊，只是窗户没关好，风吹开了门。吓我一跳呢。', '虚惊一场。关好窗户吧。').effects({ op: 'addResource', target: Resource.Credit, value: 6 }),
  ).build(),
  story('base:story:run_chain_3', '深夜巡逻 (三)').scene(
    line('阿罗娜', '天快亮了。老师，巡逻结束了，一切都正常。', '辛苦了，阿罗娜。'),
    line('阿罗娜', '老师才辛苦了。明天也请多多指教。', '晚安（早安），阿罗娜。').effects(
      { op: 'addResource', target: Resource.Credit, value: 10 },
      { op: 'addItem', target: 'base:item:energy_drink', value: 2 },
    ),
  ).build(),
];
import { Resource } from '../types/ids';
