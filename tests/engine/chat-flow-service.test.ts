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
import { GameInstance } from '../../src/engine/game-instance';
import { baseDatapack } from '../../src/data/index';
import type { GameEvent } from '../../src/engine/types';
import type { StoryDef, ActiveStoryEntry } from '../../src/engine/types';
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

function makeChatPack(): import('../../src/engine/types').Datapack {
  return {
    name: 'chat-flow-test',
    version: '0.0.0',
    inits: [],
    areas: [],
    spots: [],
    enhancements: [],
    activeStories: [chatShowEntry],
    passiveStories: [],
    stories: [chatShowStory],
    items: [],
    funcletDefs: [],
    characters: [],
    characterBonuses: [],
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
          talklet: { speaker: '星野', text: '老师，来聊聊吧？', side: 'left', avatar: 'ava.png', kizuna: { storyId: 'bond:hoshino_1', title: '羁绊', buttonText: '进入' } },
          x: 0.5,
          y: 0.4,
          align: 'center',
          targetStoryId: 'bond:hoshino_1',
        },
      },
    ]);
    const shown = events.find(e => e.type === 'chatTextShown') as
      | { type: 'chatTextShown'; id: string; text?: string; talklet?: unknown; x?: number; y?: number; align?: string; targetStoryId?: string }
      | undefined;
    expect(shown).toBeDefined();
    expect(shown!.talklet).toMatchObject({ speaker: '星野', text: '老师，来聊聊吧？' });
    expect(shown!.x).toBe(0.5);
    expect(shown!.targetStoryId).toBe('bond:hoshino_1');
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
    expect(game.story.startActiveStory('base:story:schale_flow_show').success).toBe(true);
    expect(game.getView().currentStory).not.toBeNull();
    // 点击演出浮窗上的羁绊卡片：目标 run_chain_1（同一 Init、未完成）
    const result = game.story.startCardStory('base:story:run_chain_1');
    expect(result.success).toBe(true);
    // goto 语义：原剧情被丢弃，直接进入目标剧情
    expect(game.getView().currentStory!.storyId).toBe('base:story:run_chain_1');
  });

  test('Story 完结默认触发 storyCompleted（UI 据此自动删除全部演出文本）', () => {
    finishWelcome(game);
    game.story.startActiveStory('base:story:schale_flow_show');
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
    game.story.startActiveStory('base:story:schale_flow_show');
    for (let guard = 0; guard < 60; guard++) {
      const r = game.story.advanceStory();
      if (!r.success) break;
      if ('finished' in r && r.finished) break;
    }
    const beforeReplay = events.filter(e => e.type === 'storyCompleted').length;
    // 重读走完整条链
    expect(game.story.replayStory('base:story:schale_flow_show').success).toBe(true);
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
    expect(game.story.startActiveStory('base:story:schale_flow_show').success).toBe(true);
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
    expect(game.story.replayStory('base:story:schale_flow_show').success).toBe(true);
  });
});
