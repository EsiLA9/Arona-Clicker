import type { Datapack } from '../../src/data-services/contracts/datapack';
// ============================================================
// engine/chat-flow-service.test.ts — 聊天流演出服务（Talklet 专用）
//
// 覆盖机制：
//   1. clearAllChatFlow → 发 chatFlowCleared 事件，状态零写入
//   2. showChatText → 发 chatTextShown（id/text/x/y/align），状态零写入
//   3. clearIdChatFlow → 发 chatTextCleared（id），状态零写入
//   4. 端到端：Talklet.effects 播放推进时转发（story → effect-engine → ChatFlowService）
//   5. ChatFlowService 方法直接调用的事件语义
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import type { GameEvent } from '../../src/engine/types';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { ActiveStoryEntry } from '../../src/data-services/contracts/story-entry';
import { finishWelcome } from './story-test-fixtures';

const chatShowStory: StoryDef = {
  id: 'test:story:chat_show',
  name: '演出文本演示',
  talklets: [
    {
      kind: 'narration',
      text: '—— 舞台拉开 ——',
      effects: [
        { op: 'showChatText', target: 'perf:title', value: { text: '夏莱·前夜祭', x: 0.5, y: 0.85, align: 'center' } },
        { op: 'showChatText', target: 'perf:sub', value: { text: '—— 现在开始 ——', x: 0.2, y: 0.7 } },
      ],
    },
    {
      kind: 'narration',
      text: '—— 中场清理 ——',
      effects: [
        { op: 'clearAllChatFlow', target: '', value: 0 },
        { op: 'clearIdChatFlow', target: 'perf:title', value: 0 },
      ],
    },
  ],
};

const chatShowEntry: ActiveStoryEntry = {
  id: 'test:story:chat_show',
  storyId: 'test:story:chat_show',
  type: 'active',
  availableInits: [],
  triggerCondition: { type: 'AND', conditions: [] },
};

const openingStory: StoryDef = {
  id: 'test:story:opening_title',
  name: '开幕标题演示',
  talklets: [
    { kind: 'narration', text: '—— 开幕 ——', effects: [{ op: 'showOpeningTitle', target: '', value: '星野 · 午后的堤防' }] },
    { kind: 'narration', text: '—— 第二页 ——' },
  ],
};

const openingEntry: ActiveStoryEntry = {
  id: 'test:story:opening_title',
  storyId: 'test:story:opening_title',
  type: 'active',
  availableInits: [],
  triggerCondition: { type: 'AND', conditions: [] },
};

function makeChatPack(): import('../../src/data-services/contracts/datapack').Datapack {
  return {
    name: 'chat-flow-test',
    version: '0.0.0',
    inits: [],
    areas: [],
    spots: [],
    enhancements: [],
    activeStories: [chatShowEntry, openingEntry],
    passiveStories: [],
    stories: [chatShowStory, openingStory],
    items: [],
    funcletDefs: [],
    characters: [],
    
  };
}

describe('聊天流演出服务（clearAllChatFlow / showChatText / clearIdChatFlow）', () => {
  let game: GameInstance;
  const events: GameEvent[] = [];

  beforeEach(() => {
    game = new GameInstance();
    game.eventBus.onAny(e => events.push(e));
    game.init([baseDatapack, makeChatPack()]);
  });

  afterEach(() => {
    game.stop();
    events.length = 0;
  });

  test('clearAllChatFlow → chatFlowCleared 事件，状态零写入', () => {
    game.mutations.setFlag('before', '1');
    const before = JSON.stringify(game.state);
    game.effectEngine.applyEffects([{ op: 'clearAllChatFlow', target: '', value: 0 }]);
    expect(events.some(e => e.type === 'chatFlowCleared')).toBe(true);
    // 非持久服务：PlayerState 不被触碰
    expect(JSON.stringify(game.state)).toBe(before);
  });

  test('showChatText → chatTextShown（id/text/x/y/align 透传），状态零写入', () => {
    const before = JSON.stringify(game.state);
    game.effectEngine.applyEffects([
      { op: 'showChatText', target: 'perf:title', value: { text: '夏莱·前夜祭', x: 0.5, y: 0.85, align: 'center' } },
    ]);
    const shown = events.find(e => e.type === 'chatTextShown') as
      | { type: 'chatTextShown'; id: string; text: string; x?: number; y?: number; align?: string }
      | undefined;
    expect(shown).toBeDefined();
    expect(shown!.id).toBe('perf:title');
    expect(shown!.text).toBe('夏莱·前夜祭');
    expect(shown!.x).toBe(0.5);
    expect(shown!.y).toBe(0.85);
    expect(shown!.align).toBe('center');
    expect(JSON.stringify(game.state)).toBe(before);
  });

  test('clearIdChatFlow → chatTextCleared（id 透传）', () => {
    game.effectEngine.applyEffects([{ op: 'clearIdChatFlow', target: 'perf:title', value: 0 }]);
    const cleared = events.find(e => e.type === 'chatTextCleared') as
      | { type: 'chatTextCleared'; id: string }
      | undefined;
    expect(cleared).toBeDefined();
    expect(cleared!.id).toBe('perf:title');
  });

  test('clearAllChatText → chatTextClearedAll，状态零写入', () => {
    const before = JSON.stringify(game.state);
    game.effectEngine.applyEffects([{ op: 'clearAllChatText', target: '', value: 0 }]);
    expect(events.some(e => e.type === 'chatTextClearedAll')).toBe(true);
    expect(JSON.stringify(game.state)).toBe(before);
  });

  test('showOpeningTitle → openingTitleShown（value 标题透传；空值省略 title），状态零写入', () => {
    const before = JSON.stringify(game.state);
    game.effectEngine.applyEffects([{ op: 'showOpeningTitle', target: '', value: '星野 · 午后的堤防' }]);
    const shown = events.find(e => e.type === 'openingTitleShown') as { type: 'openingTitleShown'; title?: string } | undefined;
    expect(shown).toBeDefined();
    expect(shown!.title).toBe('星野 · 午后的堤防');
    // 空字符串标题：UI 回退解析（entry.openingTitle / StoryDef.name），事件不携带 title
    game.effectEngine.applyEffects([{ op: 'showOpeningTitle', target: '', value: '' }]);
    const fallback = events.filter(e => e.type === 'openingTitleShown').at(-1) as { title?: string };
    expect(fallback.title).toBeUndefined();
    expect(JSON.stringify(game.state)).toBe(before);
  });

  test('ChatFlowService.showOpeningTitle 直接调用即发 openingTitleShown', () => {
    game.chatFlowService.showOpeningTitle('意义不止于此');
    expect(events.some(e => e.type === 'openingTitleShown' && (e as { title?: string }).title === '意义不止于此')).toBe(true);
  });

  test('端到端：Talklet 播放推进时按序转发三种事件', () => {
    // 先播完 Init 自动展开的欢迎剧情，腾出全局游标
    finishWelcome(game);
    game.story.startActiveStory('test:story:chat_show');
    // 第 0 页：showChatText × 2
    expect(game.story.advanceStory().success).toBe(true);
    expect(events.filter(e => e.type === 'chatTextShown')).toHaveLength(2);
    // 第 1 页：clearAllChatFlow + clearIdChatFlow
    expect(game.story.advanceStory().success).toBe(true);
    expect(events.some(e => e.type === 'chatFlowCleared')).toBe(true);
    const cleared = events.find(e => e.type === 'chatTextCleared') as
      | { type: 'chatTextCleared'; id: string }
      | undefined;
    expect(cleared?.id).toBe('perf:title');
  });

  test('首页 showOpeningTitle 随剧情开始立即呼出（无需先推进），推进离开首页不重复', () => {
    finishWelcome(game);
    const before = events.filter(e => e.type === 'openingTitleShown').length;
    game.story.startActiveStory('test:story:opening_title');
    const afterStart = events.filter(e => e.type === 'openingTitleShown').length;
    expect(afterStart).toBe(before + 1);
    const shown = events.filter(e => e.type === 'openingTitleShown').at(-1) as { title?: string };
    expect(shown.title).toBe('星野 · 午后的堤防');
    // 推进离开首页：跳过该 op 防重复
    expect(game.story.advanceStory().success).toBe(true);
    expect(events.filter(e => e.type === 'openingTitleShown').length).toBe(afterStart);
  });

  test('卡片入口对已完结剧情 = goto 重开：成功、分支可探索、不重复发放奖励', () => {
    finishWelcome(game);
    const playBond = (choice: number) => {
      for (let i = 0; i < 30; i++) {
        const r = game.story.advanceStory(undefined, 'Hoshino');
        if (!r.success) {
          if (r.error === 'ChoiceRequired') {
            game.story.advanceStory(choice, 'Hoshino');
            continue;
          }
          break;
        }
        if ('finished' in r && r.finished) break;
      }
    };
    // 一周目：完结羁绊剧情（第一支选项）
    expect(game.story.startCardStory('base:activestory:bond_hoshino_1', 'Hoshino').success).toBe(true);
    playBond(0);
    expect(game.story.hasCompletedStory('base:story:bond_hoshino_1')).toBe(true);
    expect(game.state.flags.bond_hoshino_choice).toBe('committee');
    const logAfterFirst = game.state.storyLog.filter(s => s.storyId === 'base:story:bond_hoshino_1').length;
    expect(logAfterFirst).toBe(1);
    // 二周目：卡片重开（force 跳过 AlreadyCompleted，isReplay=false 分支自由）→ 选另一支
    expect(game.story.startCardStory('base:activestory:bond_hoshino_1', 'Hoshino').success).toBe(true);
    expect(game.getStoryView('Hoshino')?.pageIndex).toBe(0);
    playBond(1);
    expect(game.state.flags.bond_hoshino_choice).toBe('forget');
    // 重复完结正常记录（storyLog 追加；isReplay=false 才会落账）
    expect(game.state.storyLog.filter(s => s.storyId === 'base:story:bond_hoshino_1').length).toBe(2);
    // repeat 奖励未配置：两次完结均不产生 storyRewarded
    expect(events.filter(e => e.type === 'storyRewarded')).toHaveLength(0);
  });

  test('ChatFlowService 方法直接调用即发对应事件', () => {
    game.chatFlowService.showText('perf:x', { text: 'T', x: 0.3, y: 0.6 });
    game.chatFlowService.clearAll();
    game.chatFlowService.clearId('perf:x');
    expect(events.filter(e => e.type === 'chatTextShown')).toHaveLength(1);
    expect(events.filter(e => e.type === 'chatFlowCleared')).toHaveLength(1);
    expect(events.filter(e => e.type === 'chatTextCleared')).toHaveLength(1);
  });

  test('showChatText 可嵌入标准 Talklet（talklet 优先于 text），事件透传完整字段', () => {
    const before = JSON.stringify(game.state);
    game.effectEngine.applyEffects([
      {
        op: 'showChatText',
        target: 'perf:bond',
        value: {
          talklet: { speaker: '星野', text: '老师，来聊聊吧？', side: 'left', avatar: 'ava.png', kizuna: { storyId: 'test:story:bond_hoshino_1', title: '羁绊', buttonText: '进入' } },
          x: 0.5,
          y: 0.4,
          align: 'center',
          targetStoryId: 'test:story:bond_hoshino_1',
        },
      },
    ]);
    const shown = events.find(e => e.type === 'chatTextShown') as
      | { type: 'chatTextShown'; id: string; text?: string; talklet?: unknown; x?: number; y?: number; align?: string; targetStoryId?: string }
      | undefined;
    expect(shown).toBeDefined();
    expect(shown!.talklet).toMatchObject({ speaker: '星野', text: '老师，来聊聊吧？' });
    expect(shown!.x).toBe(0.5);
    expect(shown!.targetStoryId).toBe('test:story:bond_hoshino_1');
    expect(JSON.stringify(game.state)).toBe(before);
  });

  test('showChatText 样式覆写（font/color/background/backgroundColor）经事件透传', () => {
    game.effectEngine.applyEffects([
      {
        op: 'showChatText',
        target: 'perf:styled',
        value: {
          text: '深夜的旁白',
          x: 0.5,
          y: 0.7,
          align: 'center',
          kind: 'default',
          style: { font: 'serif', fontSize: '20px', color: '#ff6b6b', background: false, backgroundColor: '#2d2d2d' },
        },
      },
    ]);
    const shown = events.find(e => e.type === 'chatTextShown') as
      | { type: 'chatTextShown'; style?: { font?: string; fontSize?: string; color?: string; background?: boolean; backgroundColor?: string } }
      | undefined;
    expect(shown?.style).toMatchObject({ font: 'serif', fontSize: '20px', color: '#ff6b6b', background: false, backgroundColor: '#2d2d2d' });
  });

  test('kizuna 演出浮窗可实际导航：startCardStory 清空当前游标（goto 语义）后启动目标剧情', () => {
    finishWelcome(game);
    // 播放流剧场预演（active 主线），制造"进行中"状态
    expect(game.story.startActiveStory('base:activestory:schale_flow_show').success).toBe(true);
    expect(game.getView().currentStory).not.toBeNull();
    // 点击演出浮窗上的羁绊卡片：目标 run_chain_1（同一 Init、未完成）
    const result = game.story.startCardStory('base:activestory:run_chain_1');
    expect(result.success).toBe(true);
    // goto 语义：原剧情被丢弃，直接进入目标剧情
    expect(game.getView().currentStory!.storyId).toBe('base:activestory:run_chain_1');
  });

  test('Story 完结默认触发 storyCompleted（UI 据此自动删除全部演出文本）', () => {
    finishWelcome(game);
    game.story.startActiveStory('base:activestory:schale_flow_show');
    for (let guard = 0; guard < 60; guard++) {
      const r = game.story.advanceStory();
      if (!r.success) break;
      if ('finished' in r && r.finished) break;
    }
    expect(game.getView().currentStory).toBeNull();
    expect(events.some(e => e.type === 'storyCompleted' && e.storyId === 'base:story:schale_flow_show')).toBe(true);
  });

  test('重读（replay）不触发 storyCompleted → 不默认清场', () => {
    finishWelcome(game);
    // 完成一次
    game.story.startActiveStory('base:activestory:schale_flow_show');
    for (let guard = 0; guard < 60; guard++) {
      const r = game.story.advanceStory();
      if (!r.success) break;
      if ('finished' in r && r.finished) break;
    }
    const beforeReplay = events.filter(e => e.type === 'storyCompleted').length;
    // 重读走完整条链
    expect(game.story.replayStory('base:activestory:schale_flow_show').success).toBe(true);
    for (let guard = 0; guard < 60; guard++) {
      const r = game.story.advanceStory();
      if (!r.success) break;
      if ('finished' in r && r.finished) break;
    }
    // 重读不再产生完成事件
    expect(events.filter(e => e.type === 'storyCompleted').length).toBe(beforeReplay);
  });

  test('base 主线「流剧场预演」：showChatText（含嵌入 talklet）/ clearIdChatFlow / clearAllChatFlow 按序触发', () => {
    finishWelcome(game);
    expect(game.story.startActiveStory('base:activestory:schale_flow_show').success).toBe(true);
    // 逐页推进到剧情结束
    for (let guard = 0; guard < 60; guard++) {
      const r = game.story.advanceStory();
      if (!r.success) break;
      if ('finished' in r && r.finished) break;
    }
    expect(game.getView().currentStory).toBeNull();
    // 10 条 showChatText：title / cast / gold / noBg / small / multiline / note / act2 / talklet / kizuna
    const shown = events.filter(e => e.type === 'chatTextShown') as { type: 'chatTextShown'; id: string; talklet?: unknown }[];
    expect(shown).toHaveLength(10);
    expect(shown.filter(e => e.talklet)).toHaveLength(2);
    // 2 次清场 + 1 次按 id 擦除
    expect(events.filter(e => e.type === 'chatFlowCleared')).toHaveLength(2);
    const cleared = events.filter(e => e.type === 'chatTextCleared') as { type: 'chatTextCleared'; id: string }[];
    expect(cleared).toHaveLength(1);
    expect(cleared[0].id).toBe('perf:note');
    // 完成态可重读（replayable）
    expect(game.story.replayStory('base:activestory:schale_flow_show').success).toBe(true);
  });
});
