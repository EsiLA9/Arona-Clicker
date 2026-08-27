// ============================================================
// ui/components/chat-text.test.ts — 演出专用文本覆盖层渲染
// 覆盖：kind 视觉模板 / 嵌入标准 Talklet 复用渲染（talk/narration/kizuna）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../../src/engine/game-instance';
import { baseDatapack } from '../../../src/data/index';
import { createUIContext } from '../../../src/ui/context';
import { renderChatTexts, type ChatTextEntry } from '../../../src/ui/components/story';

describe('renderChatTexts（showChatText 覆盖层渲染）', () => {
  let ctx: ReturnType<typeof createUIContext>;

  beforeEach(() => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.stop();
    ctx = createUIContext(game);
  });

  const entry = (overrides: Partial<ChatTextEntry> = {}): ChatTextEntry[] => [
    {
      id: 'perf:test',
      text: '测试文本',
      x: 0.5,
      y: 0.5,
      align: 'left',
      timestamp: 0,
      ...overrides,
    },
  ];

  test('空列表返回空串', () => {
    expect(renderChatTexts(ctx, [])).toBe('');
  });

  test('default：简洁气泡 + 定位样式', () => {
    const html = renderChatTexts(ctx, entry());
    expect(html).toContain('chat-text-overlay');
    expect(html).toContain('chat-text-overlay-inner');
    expect(html).toContain('left: 50%');
    expect(html).toContain('bottom: 50%');
    expect(html).toContain('data-chat-text="perf:test"');
    expect(html).toContain('测试文本');
  });

  test('title / badge / note 模板各自生效', () => {
    expect(renderChatTexts(ctx, entry({ kind: 'title', text: '大标题' }))).toContain('chat-text-title');
    expect(renderChatTexts(ctx, entry({ kind: 'badge', text: '标签' }))).toContain('chat-text-badge');
    expect(renderChatTexts(ctx, entry({ kind: 'note', text: '弱化提示' }))).toContain('chat-text-note');
  });

  test('嵌入 talk Talklet：复用对话气泡渲染（speaker/avatar）', () => {
    const html = renderChatTexts(ctx, entry({
      talklet: { speaker: '星野', text: '老师，来聊聊吧？', avatar: 'ava.png' },
    }));
    expect(html).toContain('chat-talk');
    expect(html).toContain('星野');
    expect(html).toContain('老师，来聊聊吧？');
  });

  test('嵌入 narration Talklet：复用旁白渲染', () => {
    const html = renderChatTexts(ctx, entry({
      talklet: { kind: 'narration', text: '—— 场间旁白 ——', align: 'center' },
    }));
    expect(html).toContain('chat-narration');
    expect(html).toContain('—— 场间旁白 ——');
  });

  test('嵌入 kizuna Talklet：渲染羁绊卡片且带 data-kizuna（点击沿用 startCardStory 绑定）', () => {
    const html = renderChatTexts(ctx, entry({
      talklet: { speaker: '星野', text: '来聊聊', kizuna: { storyId: 'bond:hoshino_1', title: '羁绊剧情', buttonText: '进入' } },
      targetStoryId: 'bond:hoshino_1',
    }));
    expect(html).toContain('kizuna-card');
    expect(html).toContain('data-kizuna="bond:hoshino_1"');
    expect(html).toContain('羁绊剧情');
    expect(html).toContain('进入');
  });

  test('kind=kizuna（无 talklet）：由 targetStoryId/title/buttonText 渲染羁绊卡片', () => {
    const html = renderChatTexts(ctx, entry({
      kind: 'kizuna',
      text: '羁绊入口',
      targetStoryId: 'bond:serika_1',
      title: '芹香的委托',
      buttonText: '查看',
    }));
    expect(html).toContain('kizuna-card');
    expect(html).toContain('data-kizuna="bond:serika_1"');
    expect(html).toContain('芹香的委托');
  });

  test('style.font：字型以内联 font-family 挂在展示元素上', () => {
    const html = renderChatTexts(ctx, entry({ style: { font: 'serif' } }));
    expect(html).toContain('font-family');
    expect(html).toContain('Georgia');
  });

  test('style.color / backgroundColor：强制文字色与背景色以内联属性注入', () => {
    const html = renderChatTexts(ctx, entry({ style: { color: '#ff6b6b', backgroundColor: '#2d2d2d' } }));
    expect(html).toContain('color:#ff6b6b');
    expect(html).toContain('background:#2d2d2d');
    // 内联样式挂在展示元素（chat-text-overlay-inner）上而非外层 wrapper
    expect(html).toMatch(/chat-text-overlay-inner[^>]*style="[^"]*color:#ff6b6b/);
  });

  test('style.fontSize：字型大小以内联 font-size 注入', () => {
    const html = renderChatTexts(ctx, entry({ style: { fontSize: '24px' } }));
    expect(html).toContain('font-size:24px');
  });

  test('style.font / color / backgroundColor / fontSize 全量内联', () => {
    const html = renderChatTexts(ctx, entry({ style: { font: 'serif', fontSize: '20px', color: '#ffd700', backgroundColor: '#3a2a00' } }));
    expect(html).toContain('font-family');
    expect(html).toContain('font-size:20px');
    expect(html).toContain('color:#ffd700');
    expect(html).toContain('background:#3a2a00');
  });

  test('style.background=false：透明背景去边框去阴影', () => {
    const html = renderChatTexts(ctx, entry({ style: { background: false } }));
    expect(html).toContain('background:transparent');
    expect(html).toContain('border-color:transparent');
    expect(html).toContain('box-shadow:none');
  });

  test('无 style 时展示元素不携带内联样式', () => {
    const html = renderChatTexts(ctx, entry());
    expect(html).not.toContain('color:#');
  });

  test('嵌入 talklet 时样式内联挂在气泡上', () => {
    const html = renderChatTexts(ctx, entry({
      talklet: { speaker: '星野', text: '气泡文本' },
      style: { color: '#ffd700', backgroundColor: '#3a2a00' },
    }));
    expect(html).toContain('chat-bubble');
    expect(html).toContain('color:#ffd700');
    expect(html).toContain('background:#3a2a00');
  });
});
