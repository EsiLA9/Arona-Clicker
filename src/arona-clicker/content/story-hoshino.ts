import { story, line, narrate, talklet } from './def-factory';
import type { StoryDef } from '../../data-services/contracts/story';

export const baseHoshinoStories: StoryDef[] = [
  story('base:story:hoshino_tea_time', '星野的茶点时间').scene(
    line('小鸟游星野', '老师，茶要趁热喝哦。食堂今天的点心也特别好吃。', '那我不客气了。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
    line('小鸟游星野', '嘿嘿，能和老师一起喝茶，感觉一天都会很顺利呢。', '我也是。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
  ).build(),
  story('base:story:hoshino_rooftop_hint', '星野的天台邀约').scene(
    line('小鸟游星野', '老师……天台的风景，现在一定很好看吧。', '想去看看。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
    line('小鸟游星野', '那、那我去天台等您。您也来吗？……不来我也不怪您哦。', '这就来。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
  ).build(),
  story('base:story:hoshino_rooftop_meet', '天台的相遇').scene(
    line('小鸟游星野', '老师，您真的来了……！晚霞把天空染成橘色，像我们第一次见面那天一样。', '我答应过你呀。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 10 }),
    line('小鸟游星野', '……能和老师并肩看这片晚霞，就是我最想做的事。', '以后也要一起来。')
      .effects(
        { op: 'addResource', target: Resource.Credit, value: 10 },
        { op: 'travelToArea', target: 'base:area:schale_main', value: 0, notice: true },
      ),
    line('小鸟游星野', '天台风大，我们去图书馆吧。那里有你说的那本旧童话……我还想听老师讲一遍。', '好，边走边讲。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 10 }),
  ).build(),
  story('base:story:hoshino_selfie', '星野的自拍').scene(
    line('小鸟游星野', '老师老师！给你看我刚拍的自拍！', '哦？我看看。', { avatar: 'base:avatar(pic):hoshino', image: 'base:sticker(pic):hoshino_selfie' })
      .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
    line('小鸟游星野', '嘿嘿，是不是超可爱？下次也帮老师拍一张！', '好呀，那就说定了。')
      .effects({ op: 'addResource', target: Resource.Credit, value: 5 }),
  ).build(),
  story('base:story:hoshino_bond_invite', '羁绊邀请').scene(
    narrate('——星野似乎有话想说……——', 'center'),
    line('星野', '老师，有件事想跟你说……', '嗯？什么事？'),
    talklet('星野酝酿了一下情绪……')
      .kizunaCard('base:activestory:bond_hoshino_evening', { title: '傍晚的河堤', buttonText: '进入羁绊剧情' }),
  ).build(),
];
import { Resource } from '../types/ids';
