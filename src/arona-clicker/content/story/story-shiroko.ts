import { activeStory, passiveStory, story } from '../def-factory/index';
import { and, cond } from '../../../engine/types/index';
import type { ActiveStoryEntry, PassiveStoryEntry } from '../../../data-services/contracts/story-entry';
import type { StoryDef } from '../../../data-services/contracts/story';

export const baseShirokoPassiveStories: PassiveStoryEntry[] = [
  passiveStory('base:passivestory:shiroko_drink_invite', 'base:story:shiroko_drink_invite')
    .owner('Shiroko').inits('base:init:schale_office').repeatable(false).affectionRequired(1).replayable().catalog({"category":"side","part":"part_4","order":0})
    .build(),
  passiveStory('base:passivestory:shiroko_rooftop_invite', 'base:story:shiroko_rooftop_invite')
    .owner('Shiroko').inits('base:init:schale_office').repeatable(false).affectionRequired(1).replayable()
    .when(and(cond('hasReadStory', 'base:story:shiroko_drink_invite', '==', 1))).catalog({"category":"side","part":"part_4","order":2})
    .build(),
];

export const baseShirokoActiveStories: ActiveStoryEntry[] = [
  activeStory('base:activestory:shiroko_drink', 'base:story:shiroko_drink')
    .inits('base:init:schale_office').openingTitle('白子 · 出发前的饮料').replayable().catalog({"category":"side","part":"part_4","order":1}).build(),
  activeStory('base:activestory:shiroko_rooftop', 'base:story:shiroko_rooftop')
    .inits('base:init:schale_office').openingTitle('白子 · 天台上的约定').replayable().catalog({"category":"side","part":"part_4","order":3}).build(),
];

export const baseShirokoStories: StoryDef[] = [
  story('base:story:shiroko_drink_invite', '白子 · 出发前的饮料（好感对话）')
    .init('base:init:schale_office').startInCharaspace('Shiroko').stages({ main: { advance: 'input' } }).nodes([
      { id: 'invitation', type: 'talklet', stageId: 'main', content: { kind: 'talk', speaker: '白子', text: '老师，骑行路线已经画好了。出发前，来夏莱主厅一起选饮料吧。' } },
      { id: 'kizuna', type: 'click', stageId: 'main', interaction: { kind: 'entryCard', card: { request: { entryId: 'base:activestory:shiroko_drink', entryType: 'active', owner: null, intent: 'card' }, continuation: { returnFlags: ['shiroko-drink-coffee', 'shiroko-drink-juice'] } } } },
      { id: 'return-coffee', type: 'talklet', stageId: 'main', requiresFlag: 'shiroko-drink-coffee', content: { kind: 'talk', speaker: '白子', text: '老师，刚才选的咖啡，我记住了。下次见面也给你准备热的。' } },
      { id: 'return-juice', type: 'talklet', stageId: 'main', requiresFlag: 'shiroko-drink-juice', content: { kind: 'talk', speaker: '白子', text: '老师，刚才选的果汁，我记住了。下次骑行也带上冰凉的。' } },
      { id: 'end', type: 'talklet', stageId: 'main', content: { kind: 'talk', speaker: '白子', text: '嗯。下一次见面的地方，我也想好了。等会儿再告诉老师。' } },
    ]).build(),
  story('base:story:shiroko_drink', '白子 · 出发前的饮料')
    .init('base:init:schale_office').startInArea('base:area:schale_main').stages({ main: { advance: 'input' } }).nodes([
      { id: 'arrival', type: 'talklet', stageId: 'main', content: { kind: 'narration', text: '夏莱主厅。白子把两瓶饮料并排放在地图旁边。' } },
      { id: 'choice', type: 'click', stageId: 'main', interaction: { kind: 'choice', options: [
        { id: 'coffee', text: '来杯热咖啡。', marks: ['shiroko-drink-coffee'] },
        { id: 'juice', text: '选冰果汁吧。', marks: ['shiroko-drink-juice'] },
      ] } },
      { id: 'coffee', type: 'talklet', stageId: 'main', requiresFlag: 'shiroko-drink-coffee', content: { kind: 'talk', speaker: '白子', text: '嗯，热咖啡。慢慢喝，我陪老师一起看地图。' } },
      { id: 'juice', type: 'talklet', stageId: 'main', requiresFlag: 'shiroko-drink-juice', content: { kind: 'talk', speaker: '白子', text: '嗯，冰果汁。骑行回来喝，也一定很舒服。' } },
      { id: 'goodbye', type: 'talklet', stageId: 'main', content: { kind: 'talk', speaker: '白子', text: '今天先准备到这里。回通讯录找我吧，我还有话想跟老师说。' } },
    ]).build(),
  story('base:story:shiroko_rooftop_invite', '白子 · 天台的约定（好感对话）')
    .init('base:init:schale_office').startInCharaspace('Shiroko').stages({ main: { advance: 'input' } }).nodes([
      { id: 'invitation', type: 'talklet', stageId: 'main', content: { kind: 'talk', speaker: '白子', text: '老师，今天想换个地方。请到夏莱天台来，到了以后，在当地的故事入口找「白子 · 天台上的约定」。我会在那里等你。' } },
      { id: 'kizuna', type: 'click', stageId: 'main', interaction: { kind: 'entryCard', card: { request: { entryId: 'base:activestory:shiroko_rooftop', entryType: 'active', owner: null, intent: 'card' }, continuation: { areaId: 'base:area:schale_rooftop', returnFlags: ['shiroko-rooftop-photo', 'shiroko-rooftop-route'] } } } },
      { id: 'return-photo', type: 'talklet', stageId: 'main', requiresFlag: 'shiroko-rooftop-photo', content: { kind: 'talk', speaker: '白子', text: '老师，天台的合照已经存好了。下次想拍一张骑行结束后的。' } },
      { id: 'return-route', type: 'talklet', stageId: 'main', requiresFlag: 'shiroko-rooftop-route', content: { kind: 'talk', speaker: '白子', text: '老师，一起记下的骑行路线已经收好了。下次就沿着它出发。' } },
      { id: 'end', type: 'talklet', stageId: 'main', content: { kind: 'talk', speaker: '白子', text: '今天的约定完成了。谢谢老师，愿意专程来见我。' } },
    ]).build(),
  story('base:story:shiroko_rooftop', '白子 · 天台上的约定')
    .init('base:init:schale_office').startInArea('base:area:schale_rooftop').stages({ main: { advance: 'input' } }).nodes([
      { id: 'arrival', type: 'talklet', stageId: 'main', content: { kind: 'narration', text: '夏莱天台。白子倚着栏杆，手里拿着相机和一张空白路线图。' } },
      { id: 'choice', type: 'click', stageId: 'main', interaction: { kind: 'choice', options: [
        { id: 'photo', text: '先一起拍张合照。', marks: ['shiroko-rooftop-photo'] },
        { id: 'route', text: '一起记下下一次骑行的路线。', marks: ['shiroko-rooftop-route'] },
      ] } },
      { id: 'photo', type: 'talklet', stageId: 'main', requiresFlag: 'shiroko-rooftop-photo', content: { kind: 'talk', speaker: '白子', text: '老师，再靠近一点。嗯……这张照片，我会好好保存。' } },
      { id: 'route', type: 'talklet', stageId: 'main', requiresFlag: 'shiroko-rooftop-route', content: { kind: 'talk', speaker: '白子', text: '从这里看过去，沿河那条路很适合骑行。老师标的休息点，我也记下了。' } },
      { id: 'goodbye', type: 'talklet', stageId: 'main', content: { kind: 'talk', speaker: '白子', text: '风有点凉，先回去吧。回通讯录找我，我再把今天的事告诉老师。' } },
    ]).build(),
];
