import { activeStory, line, narrate, story } from './def-factory';
import type { ActiveStoryEntry } from '../../data-services/contracts/story-entry';
import type { StoryDef } from '../../data-services/contracts/story';

export const baseBondStoryEntries: ActiveStoryEntry[] = [
  activeStory('base:activestory:bond_hoshino_1', 'base:story:bond_hoshino_1').owner('Hoshino').replayable().openingTitle('星野 · 午后的堤防').build(),
  activeStory('base:activestory:bond_hoshino_evening', 'base:story:bond_hoshino_evening').owner('Hoshino').replayable().openingTitle('星野 · 傍晚的河堤').build(),
];

export const baseBondStories: StoryDef[] = [
  story('base:story:bond_hoshino_1', '羁绊剧情 · 星野：午后的堤防')
    .scene(
      narrate('——阿比多斯 · 堤防 · 午后——', 'center').effects({ op: 'showOpeningTitle', target: '', value: '星野 · 午后的堤防' }),
      line('星野', '唔……老师也来吹风吗……海风很舒服哦……'),
      line('老师', '（在她旁边坐下）', '（默默坐下）'),
      line('星野', '说起来……队长还记得第一次见面的时候吗？').choice('当然记得，就在对策委员会室。', { op: 'setFlag', target: 'bond_hoshino_choice', value: 'committee' }).choice('抱歉……有点记不清了。', { op: 'setFlag', target: 'bond_hoshino_choice', value: 'forget' }),
      line('星野', '呵呵……没关系哦。反正以后的日子还长着呢，队长。').effects({ op: 'setFlag', target: 'bond_hoshino_done', value: '1' }),
    ).build(),
  story('base:story:bond_hoshino_evening', '羁绊剧情 · 星野：傍晚的河堤')
    .scene(
      narrate('——阿比多斯 · 河堤 · 黄昏——', 'center').effects({ op: 'showOpeningTitle', target: '', value: '星野 · 傍晚的河堤' }),
      line('星野', '……老师，其实我一直想找机会单独跟您聊聊。', '我也有话想跟你说。'),
      line('星野', '最近总觉得一个人发呆的时候，会想起很多以前的事。').choice('回忆过去也很重要呢。', { op: 'setFlag', target: 'bond_evening_choice', value: 'memory' }).choice('那就多创造新的回忆吧。', { op: 'setFlag', target: 'bond_evening_choice', value: 'new' }),
      line('星野', '嗯……说得对。不管是过去的还是未来的，只要和老师一起，就都是好时光。').effects({ op: 'setFlag', target: 'bond_evening_done', value: '1' }),
    ).build(),
];
