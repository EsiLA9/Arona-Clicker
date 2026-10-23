import type { StoryNodeDocument } from '../../src/data-services/contracts/story-node';
import type { StoryAction, StoryEntryCard } from '../../src/data-services/contracts/story-node-actions';

// 声明样例，不是已注册的 Datapack，也不模拟播放/效果执行。
const card: StoryEntryCard = {
  request: { entryId: 'base:activestory:invitation', entryType: 'active', owner: null, intent: 'card' },
  title: '仓库探访', buttonText: '进入',
};

export const STORY_NODE_AUTHORING_EXAMPLES = {
  s01Sequential: {
    id: 'test:story:sequential', name: '先敲门再进门',
    stages: { knock: { advance: 'input' }, enter: { advance: 'input' } },
    nodes: [
      { id: 'knock', type: 'click', stageId: 'knock', interaction: { kind: 'button', text: '敲门' } },
      { id: 'enter', type: 'click', stageId: 'enter', interaction: { kind: 'button', text: '进门' } },
    ],
  },
  s01Choice: {
    id: 'test:story:choice', name: '敲门或离开', stages: { decide: { advance: 'input' } },
    nodes: [{ id: 'decide', type: 'click', stageId: 'decide', interaction: { kind: 'choice', options: [
      { id: 'knock', text: '敲门' }, { id: 'leave', text: '离开' },
    ] } }],
  },
  s02ConfirmationAndSharedActions: {
    id: 'test:story:routes', name: '确认后选择路线',
    stages: { briefing: { advance: 'input' }, decide: { advance: 'input' } },
    nodes: [
      { id: 'question', type: 'talklet', stageId: 'briefing', content: { kind: 'talk', speaker: '阿罗娜', text: '先调查哪条路？' } },
      { id: 'confirm', type: 'click', stageId: 'briefing', interaction: { kind: 'button', text: '看完了' } },
      { id: 'route', type: 'click', stageId: 'decide', interaction: { kind: 'choice',
        sharedActions: [{ kind: 'state', effects: [{ op: 'addResource', resourceId: 'base:resource:time', amount: -1 }] }],
        options: [
          { id: 'mountain', text: '山路', condition: { type: 'AND', conditions: [
            { target: 'flag', key: 'has_tool', comparator: '==', value: 1 },
          ] }, result: { actions: [{ kind: 'state', effects: [{ op: 'setFlag', flagId: 'route', value: 'mountain' }] }], transfer: { mode: 'goto', storyId: 'test:story:mountain' } } },
          { id: 'river', text: '河路', result: { transfer: { mode: 'goto', storyId: 'test:story:river' } } },
        ],
      } },
    ],
  },
  s03WorkThenConfirm: {
    id: 'test:story:work', name: '多击后确认',
    stages: { work: { advance: 'input' }, confirm: { advance: 'input' } },
    nodes: [
      { id: 'work', type: 'click', stageId: 'work', interaction: { kind: 'button', text: '检查设备', press: { base: 3, rand: 2 } } },
      { id: 'confirm', type: 'click', stageId: 'confirm', interaction: { kind: 'button', text: '确认完成', reply: { kind: 'talk', text: '检查好了。' } } },
      { id: 'reward', type: 'operation', action: { kind: 'state', effects: [{ op: 'addResource', resourceId: 'base:resource:credit', amount: 1 }] } },
    ],
  },
  s04InsertThenContinue: {
    id: 'test:story:insert', name: '插播后回共同后继',
    stages: { ask: { advance: 'input' }, next: { advance: 'auto' } },
    nodes: [
      { id: 'ask', type: 'talklet', stageId: 'ask', content: { kind: 'talk', text: '需要听一段说明吗？' } },
      { id: 'decide', type: 'click', stageId: 'ask', interaction: { kind: 'choice', options: [
        { id: 'yes', text: '需要', result: { transfer: { mode: 'insert', storyId: 'test:story:explanation' } } },
        { id: 'no', text: '不需要' },
      ] } },
      { id: 'hint', type: 'operation', action: { kind: 'state', effects: [{ op: 'setFlag', flagId: 'next', value: true }] } },
      { id: 'next', type: 'talklet', stageId: 'next', content: { kind: 'narration', text: '进入下一阶段。' } },
    ],
  },
  s05Overlay: {
    id: 'test:story:overlay', name: '定位提示与正文分开', stages: { notice: { advance: 'input' } },
    nodes: [
      { id: 'show', type: 'operation', action: { kind: 'overlay', command: { command: 'show', id: 'tip', x: 0.85, y: 0.18,
        content: { kind: 'text', text: '右下角提示', template: 'note', style: { font: 'mono', background: false } },
      } } },
      { id: 'line', type: 'talklet', stageId: 'notice', content: { kind: 'talk', text: '看右下角。' } },
      { id: 'seen', type: 'click', stageId: 'notice', interaction: { kind: 'button', text: '看到了' } },
      { id: 'clear', type: 'operation', action: { kind: 'overlay', command: { command: 'clearId', id: 'tip' } } },
    ],
  },
  s06EntryRequests: {
    id: 'test:story:requests', name: '系统请求与两种卡片宿主', stages: { invitation: { advance: 'input' } },
    nodes: [
      { id: 'system', type: 'operation', action: { kind: 'entryRequest', request: {
        entryId: 'base:passivestory:conversation', entryType: 'passive', owner: 'base:variant:arona', intent: 'system',
      } } },
      { id: 'floating', type: 'operation', action: { kind: 'overlay', command: { command: 'show', id: 'invite', content: { kind: 'entryCard', card } } } },
      { id: 'card', type: 'click', stageId: 'invitation', interaction: { kind: 'entryCard', card } },
    ],
  },
  s07Travel: {
    id: 'test:story:travel', name: '旅行并提示', stages: { depart: { advance: 'input' }, arrived: { advance: 'auto' } },
    nodes: [
      { id: 'line', type: 'talklet', stageId: 'depart', content: { kind: 'talk', text: '我们去办公室。' } },
      { id: 'depart', type: 'click', stageId: 'depart', interaction: { kind: 'button', text: '出发' } },
      { id: 'travel', type: 'operation', action: { kind: 'travel', areaId: 'base:area:office', notice: true } },
      { id: 'arrived', type: 'talklet', stageId: 'arrived', content: { kind: 'talk', text: '到了。' } },
    ],
  },
  multiLineStage: {
    id: 'test:story:multiple_lines', name: '两条正文共用一次输入', stages: { dialogue: { advance: 'input' } },
    nodes: [
      { id: 'first', type: 'talklet', stageId: 'dialogue', content: { kind: 'talk', text: '第一件事。' } },
      { id: 'second', type: 'talklet', stageId: 'dialogue', content: { kind: 'talk', text: '第二件事。' }, presentation: { side: 'left', avatarMode: 'show' }, pacing: { typing: 0, thinking: 1 } },
      { id: 'continue', type: 'click', stageId: 'dialogue', interaction: { kind: 'button', text: '继续' } },
    ],
  },
  standaloneTransfer: {
    id: 'test:story:transfer', name: '无显示的换段', stages: {},
    nodes: [{ id: 'jump', type: 'transfer', transfer: { mode: 'goto', storyId: 'test:story:next' } }],
  },
} as const satisfies Record<string, StoryNodeDocument>;

// 参数覆盖声明：字段能写出，不代表已经能执行，也不把旧 Effect 原样透传。
export const STORY_ACTION_PARAMETER_EXAMPLES = [
  { kind: 'state', effects: [
    { op: 'setResource', resourceId: 'credit', amount: { type: 'const', value: 10 } },
    { op: 'addResource', resourceId: 'credit', amount: 2 },
    { op: 'setSpotLevel', spotId: 'base:spot:desk', amount: 1 },
    { op: 'addSpotLevel', spotId: 'base:spot:desk', amount: 1 },
    { op: 'setManager', spotId: 'base:spot:desk', managerId: 'base:variant:arona' },
    { op: 'addEnhancement', enhancementId: 'base:enhancement:tools' },
    { op: 'addItem', itemId: 'base:item:key', amount: 1 },
    { op: 'unlockInit', initId: 'base:init:next' },
    { op: 'setFlag', flagId: 'route', value: { type: 'const', value: 1 } },
    { op: 'setExtra', path: 'story.route', value: { t: 'dict', v: { visited: { t: 'bool', v: true } } } },
    { op: 'addExtra', path: 'story.count', amount: 1 },
    { op: 'removeExtra', path: 'story.temporary' },
    { op: 'grantCharacter', variantId: 'base:variant:arona' },
    { op: 'addAffectionExp', variantId: 'base:variant:arona', amount: 2 },
  ] },
  { kind: 'presentation', command: { command: 'theme', value: {
    colorGroupId: 'base:colorgroup:sky', palette: ['#ffffff'], tokens: { primary: '#ffffff' },
    nodes: { primary: '#ffffff' }, background: [{ id: 'scene', kind: 'gradient', value: 'linear-gradient(#fff, #000)' }],
    scope: 'student', entityKey: 'variant:base:variant:arona',
  } } },
  { kind: 'presentation', command: { command: 'setEntityPresentation', target: 'area:base:area:office', optionId: 'night', owner: 'scene', lifetime: 'story' } },
  { kind: 'presentation', command: { command: 'clearEntityPresentation', target: 'area:base:area:office', owner: 'scene' } },
  { kind: 'presentation', command: { command: 'openingTitle' } },
  { kind: 'overlay', command: { command: 'show', id: 'message', content: { kind: 'message', content: { kind: 'talk', text: '定位气泡', image: 'image.png' }, presentation: { avatarMode: 'hide' } } } },
  { kind: 'overlay', command: { command: 'clearAllTexts' } },
  { kind: 'overlay', command: { command: 'clearFlow' } },
  { kind: 'entryRequest', request: { entryId: 'base:activestory:main', entryType: 'active', owner: null, intent: 'ordinary' } },
] as const satisfies readonly StoryAction[];
