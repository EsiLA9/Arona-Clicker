// ============================================================
// components/story-gate.test.ts — 确认浮层 / 开幕横幅渲染函数
// 纯字符串断言：标题解析（openingTitle 优先）、owner 行、data 钩子、HTML 转义。
// ============================================================
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { GameInstance } from '../../../src/engine/game-instance';
import { baseDatapack } from '../../../src/data/index';
import { createUIContext } from '../../../src/ui/context';
import { renderStoryGate, renderOpeningBanner, storyDisplayTitle, BANNER_ANIMATION_MS } from '../../../src/ui/components/story-gate';

describe('renderStoryGate / renderOpeningBanner', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
  });

  afterEach(() => {
    game.stop();
  });

  test('浮层：羁绊入口显示「羁绊剧情」+ 角色名 + openingTitle 标题 + 确认/取消钩子', () => {
    const ctx = createUIContext(game);
    const html = renderStoryGate(ctx, { storyId: 'base:activestory:bond_hoshino_1', owner: 'Hoshino', mode: 'card' });
    expect(html).toContain('data-story-gate');
    expect(html).toContain('羁绊剧情');
    expect(html).toContain('星野');
    expect(html).toContain('星野 · 午后的堤防');
    expect(html).toContain('data-story-gate-confirm');
    expect(html).toContain('>进入</button>');
    expect((html.match(/data-story-gate-cancel/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  test('浮层：无 owner 入口回退「剧情」+ StoryDef.name；replay 文案为「重新观看」', () => {
    const ctx = createUIContext(game);
    const html = renderStoryGate(ctx, { storyId: 'base:story:schale_flow_show', owner: null, mode: 'active' });
    expect(html).toContain('剧情');
    expect(html).not.toContain('羁绊剧情');
    expect(html).toContain('流剧场预演');
    const replay = renderStoryGate(ctx, { storyId: 'base:story:schale_flow_show', owner: null, mode: 'replay' });
    expect(replay).toContain('重新观看');
  });

  test('浮层：已拥有角色显示头像 + 好感心形角标（等级数字）', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    const ctx = createUIContext(game);
    const html = renderStoryGate(ctx, { storyId: 'base:activestory:bond_hoshino_1', owner: 'Hoshino', mode: 'card' });
    expect(html).toContain('story-gate-avatar');
    expect(html).toContain('story-gate-heart');
    expect(html).toMatch(/story-gate-heart[\s\S]*?<b>1<\/b>/);
    expect(html).toContain('story-gate-band');
    expect(html).toContain('星野 · 午后的堤防');
  });

  test('storyDisplayTitle：entry.openingTitle 优先，回退 StoryDef.name / storyId', () => {
    const ctx = createUIContext(game);
    expect(storyDisplayTitle(ctx, 'base:activestory:bond_hoshino_1')).toBe('星野 · 午后的堤防');
    expect(storyDisplayTitle(ctx, 'base:activestory:schale_flow_show')).toBe('流剧场预演');
    expect(storyDisplayTitle(ctx, 'test:missing')).toBe('test:missing');
  });

  test('浮层：已完结剧情确认文案为「重新开始」（卡片 = 正常重开）；重读入口仍为「重新观看」', () => {
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    game.story.startCardStory('base:activestory:bond_hoshino_1', 'Hoshino');
    for (let guard = 0; guard < 30; guard++) {
      const r = game.story.advanceStory(undefined, 'Hoshino');
      if (!r.success) {
        if ((r as { error?: string }).error === 'ChoiceRequired') {
          game.story.advanceStory(0, 'Hoshino');
          continue;
        }
        break;
      }
      if ('finished' in r && r.finished) break;
    }
    expect(game.story.hasCompletedStory('base:story:bond_hoshino_1')).toBe(true);
    const ctx = createUIContext(game);
    const html = renderStoryGate(ctx, { storyId: 'base:activestory:bond_hoshino_1', owner: 'Hoshino', mode: 'card' });
    expect(html).toContain('重新开始');
    expect(html).not.toContain('重新观看');
    expect(html).not.toContain('>进入</button>');
  });

  test('横幅：标题文本转义，data-story-banner 钩子存在', () => {
    const ctx = createUIContext(game);
    const html = renderOpeningBanner(ctx, { title: '<b>开幕</b>', startedAt: Date.now() });
    expect(html).toContain('data-story-banner');
    expect(html).toContain('&lt;b&gt;开幕&lt;/b&gt;');
    expect(html).not.toContain('<b>开幕');
  });

  test('横幅：重渲染断点续播——按 startedAt 写入负 animation-delay', () => {
    const ctx = createUIContext(game);
    const now = Date.now();
    expect(renderOpeningBanner(ctx, { title: 'X', startedAt: now })).not.toContain('animation-delay');
    // startedAt 早 900ms（±1ms 时钟抖动用正则容纳）
    expect(renderOpeningBanner(ctx, { title: 'X', startedAt: now - 900 })).toMatch(/animation-delay: -90\dms/);
    // 超出动画总时长：钳制到终值（forwards 已定格终帧，等待计时器移除；跟随常量避免改时长漂移）
    expect(renderOpeningBanner(ctx, { title: 'X', startedAt: now - 99999 })).toContain(`animation-delay: -${BANNER_ANIMATION_MS}ms`);
  });
});
