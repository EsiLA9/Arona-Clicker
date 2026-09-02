import { story, line } from './def-factory';
import type { StoryDef } from '../../data-services/contracts/story';

export const baseRegionalChatStories: StoryDef[] = [
  story('base:story:abydos_daily_committee', '对策委员会的日常').scene(
    line('彩奈', '今天的巡逻报告都整理好了。野乃美前辈说沙漠方向的设备状态良好。', '做得好，彩奈。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 4 }),
  ).build(),
  story('base:story:abydos_siesta', '星野的午睡').scene(
    line('星野', '呼……沙发真是人类最伟大的发明之一啊。老师要不要也躺一会？', '不行，工作还没做完。')
      .effects(
        { op: 'addResource', target: Resource.Credit, value: 6 },
        { op: 'setTheme', target: '', value: { colorGroupId: 'base:colorgroup:hoshino-swim' } },
      ),
  ).build(),
  story('base:story:abydos_serika_shift', '芹香的兼职').scene(
    line('芹香', '打工结束了！老师，今天便利店有过期便当，我顺便带了一些回来……省一点是一点嘛。', '辛苦了，芹香。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 3 }),
  ).build(),
  story('base:story:abydos_money', '还债日记').scene(
    line('野乃美', '这个月的还债计划比上个月多完成了 3%。老师，阿比多斯的债务正在一点点减少呢。', '一步一步来。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 7 }),
  ).build(),
  story('base:story:millennium_calculation', '优香的财务报告').scene(
    line('优香', '本期的信用点收入比上期增加了 8.5%。虽然数据很好看，但请不要因此放松管理。', '放心，优香。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
  ).build(),
  story('base:story:millennium_game_dev', '游戏开发部的坚持').scene(
    line('美依', '姐姐，游戏引擎又崩溃了。不过别担心，数据都自动备份了。', '需要帮忙调试吗？')
      .effects({ op: 'addResource', target: Resource.Credit, value: 6 }),
  ).build(),
  story('base:story:millennium_hack', '小雪的恶作剧').scene(
    line('小雪', '嘿嘿，我发现了一个系统漏洞……不过老师放心，我只是用那个算力挖了一些信用点！', '记得报告给乃爱。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 8 }),
  ).build(),
  story('base:story:millennium_server', '服务器的秘密').scene(
    line('乃爱', '服务器机房的利用率已经达到了 94%。按照这个趋势，我们需要在下个月申请扩容预算。', '让优香批一下。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 7 }),
  ).build(),
];
import { Resource } from '../types/ids';
