import { story, line, narrate } from './def-factory';
import type { StoryDef } from '../../data-services/contracts/story';

export const baseAbydosMainStories: StoryDef[] = [
  story('base:story:abydos_welcome', '沙漠中的学园').scene(
    narrate('—— 阿比多斯学院 · 对策委员会室 ——'),
    line('白子', '……你来了。阿比多斯对策委员会，欢迎你的加入。', '请多关照，白子。'),
    narrate('* 门边探出半个脑袋，星野正打着哈欠。*', 'right'),
    line('星野', '呼啊～又多了一个人呢。不过大叔我今天想偷懒……让野乃美带你转转吧。', '星野前辈，请认真一点！'),
    line('野乃美', '老师，这边是校舍和泳池。虽然设施有点旧了，但大家都很努力在维护。', '先从校舍开始视察吧。')
      .choice('先去对策委员会室看看', { op: 'setFlag', target: 'abydos_choice', value: 'committee' })
      .choice('去泳池那边巡逻', { op: 'setFlag', target: 'abydos_choice', value: 'pool' }),
    line('芹香', '老师，请多帮忙了！我们一定会把学园恢复成以前的样子！')
      .effects(
        { op: 'addResource', target: Resource.Credit, value: 15 },
        { op: 'addItem', target: 'base:item:tactical_kit', value: 1 },
      ),
  ).build(),
];
import { Resource } from '../types/ids';
