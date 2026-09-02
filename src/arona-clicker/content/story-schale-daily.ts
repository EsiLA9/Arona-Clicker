import { story, line } from './def-factory';
import type { StoryDef } from '../../data-services/contracts/story';

export const baseSchaleDailyStories: StoryDef[] = [
  story('base:story:schale_tea', '阿罗娜的茶点').scene(
    line('阿罗娜', '老师，杯子里只剩下一层茶渍了。要不要我准备一些新茶？', '那就麻烦你了。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 3 }),
  ).build(),
  story('base:story:schale_printer', '打印机的抱怨').scene(
    line('阿罗娜', '信用点制造机又卡纸了……不过它其实只是在用这种方式抗议加班。', '让它休息一下吧。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 4 }),
  ).build(),
  story('base:story:schale_archive', '档案室的尘埃').scene(
    line('阿罗娜', '资料室的卷宗堆得比我还高了。老师，也许该归档一下？', '明天再说吧。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 3 }),
  ).build(),
  story('base:story:schale_sunset', '窗边的晚霞').scene(
    line('阿罗娜', '太阳要下山了。夏莱的窗户正好能看见整片晚霞。', '很适合停下来看看。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
  ).build(),
  story('base:story:schale_planner', '日程表攻防').scene(
    line('阿罗娜', '老师，明天的日程已经排好了……虽然您八成会全部推迟。', '说得这么直白真的好吗。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 3 }),
    line('阿罗娜', '那就把最难的报告安排在深夜时段吧——反正您那个时候反而很有精神！', '那就这么定了。')
      .effects(
        { op: 'addResource', target: Resource.Credit, value: 2 },
        { op: 'setFlag', target: 'night_mode', value: '1' },
      ),
  ).build(),
  story('base:story:schale_vending', '贩卖机的秘密').scene(
    line('阿罗娜', '走廊尽头的自动贩卖机，第三排的咖啡罐……其实是装了能量饮料的伪装版。', '谁干的？')
      .effects({ op: 'addResource', target: Resource.Credit, value: 4 }),
  ).build(),
  story('base:story:schale_night', '深夜的夏莱').scene(
    line('阿罗娜', '老师，都这个时间了还不休息吗？……好吧，那我把台灯调暗一点。', '再十分钟就好。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 6 }),
  ).build(),
];
import { Resource } from '../types/ids';
