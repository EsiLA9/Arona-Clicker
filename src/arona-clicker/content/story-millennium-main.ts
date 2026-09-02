import { story, line, narrate } from './def-factory';
import type { StoryDef } from '../../data-services/contracts/story';

export const baseMillenniumMainStories: StoryDef[] = [
  story('base:story:millennium_welcome', '数据与新生').scene(
    narrate('—— 千禧年学院 · 研究楼 ——'),
    line('优香', '老师，欢迎来到千禧年学院。我是财务担当早濑优香，这边是研究楼的数据分析站。', '效率很高，不愧是千禧年。'),
    narrate('* 优香翻开预算表，投影屏上跳出一串数据。*', 'left'),
    line('乃爱', '根据优香前辈的预算表，实验室的信用点产出效率还有 12% 的优化空间。', '那就先从优化开始吧。')
      .choice('让优香负责财务优化', { op: 'setFlag', target: 'millennium_choice', value: 'yuuka' })
      .choice('去游戏开发部看看', { op: 'setFlag', target: 'millennium_choice', value: 'game' }),
    line('桃依', '老师老师！我们的游戏马上就要完成了！啊，不过在这之前得先把信用点赚够……')
      .effects(
        { op: 'addResource', target: Resource.Credit, value: 12 },
        { op: 'addItem', target: 'base:item:data_chip', value: 2 },
      ),
  ).build(),
  story('base:story:millennium_game_crisis_intro', '游戏开发部的危机 · 开场').scene(
    narrate('—— 千禧年学院 · 游戏开发部 ——'),
    line('桃依', '老师！游戏引擎又出 bug 了！发行日期就在明天！', '冷静一下，桃依。'),
    line('美依', '姐姐说她自己能搞定，但已经连续调试 12 个小时了……').jump('base:story:millennium_game_crisis_whisper', 'insert'),
    line('老师', '好，我来想办法。')
      .choiceJump('亲自上手调试', 'base:story:millennium_game_crisis_debug', 'goto', { op: 'setFlag', target: 'game_crisis_route', value: 'debug' })
      .choiceJump('买冰淇淋犒劳大家', 'base:story:millennium_game_crisis_bribe', 'goto', { op: 'setFlag', target: 'game_crisis_route', value: 'bribe' }),
  ).build(),
  story('base:story:millennium_game_crisis_whisper', '美依的悄悄话').scene(
    line('美依', '（小声）其实姐姐昨天偷偷哭了一场……她压力很大的。', undefined, { noAvatar: true }),
    line('桃依', '（小声）别说出去啊老师！这是我们开发部的秘密！', undefined, { noAvatar: true }),
  ).build(),
  story('base:story:millennium_game_crisis_debug', '游戏开发部的危机 · 调试').scene(
    line('老师', '我看看这个报错……原来是内存泄漏。', '我来修。'),
    line('美依', '老师太厉害了！修好了！').jump('base:story:millennium_game_crisis_end'),
  ).build(),
  story('base:story:millennium_game_crisis_bribe', '游戏开发部的危机 · 补给').scene(
    line('老师', '先吃点东西休息一下吧。', '我请客。'),
    line('桃依', '哇，是冰淇淋！吃完就有干劲了！').jump('base:story:millennium_game_crisis_end'),
  ).build(),
  story('base:story:millennium_game_crisis_end', '游戏开发部的危机 · 收尾').scene(
    line('桃依', '游戏完成！明天一定能顺利发行！').effects({ op: 'addResource', target: Resource.Credit, value: 20 }),
    line('美依', '感谢老师！没有你的话我们都不知道该怎么办了。', '这是老师应该做的。'),
  ).build(),
];
import { Resource } from '../types/ids';
