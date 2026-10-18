// ============================================================
// ui/components/chat-text.test.ts — 演出专用文本覆盖层渲染
// 覆盖：kind 视觉模板 / 嵌入标准 Talklet 复用渲染（talk/narration/kizuna）
// ============================================================
import { describe, test, expect, beforeEach } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { createUIContext } from '../../../src/ui/context';
import { renderChatEntry, renderChatHistory, renderChatTexts, type ChatEntry, type ChatTextEntry } from '../../../src/ui/components/story';
import { renderFlowEntry, renderFlowEntries } from '../../../src/ui/flow/flow-render';
import type { FlowEntry } from '../../../src/ui/flow/flow-entry';

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
      talklet: { speaker: '星野', text: '来聊聊', kizuna: { storyId: 'test:story:bond_hoshino_1', title: '羁绊剧情', buttonText: '进入' } },
      targetStoryId: 'test:story:bond_hoshino_1',
    }));
    expect(html).toContain('kizuna-card');
    expect(html).toContain('data-kizuna="test:story:bond_hoshino_1"');
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

describe('共用条目渲染入口', () => {
  let ctx: ReturnType<typeof createUIContext>;

  beforeEach(() => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.stop();
    ctx = createUIContext(game);
  });

  const talk = (id: number, text: string, overrides: Partial<ChatEntry> = {}): ChatEntry => ({
    id, kind: 'talk', speaker: '星野', text, timestamp: 0, ...overrides,
  });

  test('普通 Chat 历史在条目根元素写入实例键，不新增包裹节点', () => {
    const html = renderChatHistory([
      talk(3, '一'),
      { id: 4, kind: 'narration', text: '旁白', timestamp: 0 },
      { id: 5, kind: 'system', text: '系统', timestamp: 0 },
      { id: 6, kind: 'reward', text: '奖励', timestamp: 0 },
    ], ctx);
    expect(html).toContain('data-flow-entry-key="chat:3"');
    expect(html).toContain('data-flow-entry-key="chat:4"');
    expect(html).toContain('data-flow-entry-key="chat:5"');
    expect(html).toContain('data-flow-entry-key="chat:6"');
    expect(html.match(/chat-talk chat-talk-npc/g)).toHaveLength(1);
  });

  test('条目被移除后连发分组按剩余顺序重算', () => {
    const first = talk(1, '一', { avatar: 'av' });
    const second = talk(2, '二', { avatar: 'av' });
    expect(renderChatHistory([first, second], ctx).match(/chat-name/g)).toHaveLength(1);
    expect(renderChatHistory([second], ctx).match(/chat-name/g)).toHaveLength(1);
    expect(renderChatHistory([second], ctx)).not.toContain('chat-avatar-ghost');
  });

  test('FlowEntry 与普通 Chat 走同一分派与气泡契约', () => {
    const flow: FlowEntry = {
      streamKey: 'run:1',
      instanceKey: 'map:current-node:node-1',
      kind: 'talk',
      speaker: '星野',
      text: '当前地点',
      side: 'left',
    };
    const fromFlow = renderFlowEntry(ctx, flow);
    const fromChat = renderChatEntry(ctx, { kind: 'talk', speaker: '星野', text: '当前地点', side: 'left' }, { instanceKey: flow.instanceKey });
    expect(fromFlow).toBe(fromChat);
    expect(fromFlow).toContain('data-flow-entry-key="map:current-node:node-1"');
    expect(fromFlow).toContain('chat-bubble-npc');
    expect(fromFlow).toContain('data-theme-host-id="bubble"');
    expect(renderFlowEntries(ctx, [flow, { ...flow, instanceKey: 'map:current-node:node-2' }]))
      .toContain('data-flow-entry-key="map:current-node:node-2"');
  });

  test('受控多行正文：标题等级、附加行与白名单语义标记', () => {
    const flow: FlowEntry = {
      streamKey: 'run:1',
      instanceKey: 'map:node:node-1:-',
      kind: 'talk',
      speaker: '测试地图 · 当前地点',
      text: '地点 A',
      heading: 1,
      lines: ['A 的说明'],
      marks: { 'data-map-current-node': 'node-1', style: 'color:red', onclick: 'alert(1)' },
      headingMarks: { 'data-map-focus-heading': true, tabindex: '-1' },
    };
    const html = renderFlowEntry(ctx, flow);
    expect(html).toContain('<div class="presentation-host-content">');
    expect(html).toContain('<h1 data-map-focus-heading tabindex="-1">地点 A</h1>');
    expect(html).toContain('<p>A 的说明</p>');
    expect(html).toContain('data-map-current-node="node-1"');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('onclick');
  });

  test('无标题的结算条目保留逐行正文与 role 标记', () => {
    const html = renderFlowEntry(ctx, {
      streamKey: 'run:1',
      instanceKey: 'map:commit:R1',
      kind: 'talk',
      speaker: '最近提交结果 · 地点 A · 第 2 轮结果',
      text: '',
      lines: ['白子：攻击 → 敌方 robot', '敌方 robot → 白子 · HP -2'],
      marks: { 'data-map-recent-commit': 'R1', role: 'status' },
    });
    expect(html).toContain('role="status"');
    expect(html).toContain('<p>白子：攻击 → 敌方 robot</p>');
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('<h2');
  });

  test('普通 Chat 条目仍输出单段 presentation-host-content', () => {
    const html = renderChatHistory([talk(1, '一')], ctx);
    expect(html).toContain('<p class="presentation-host-content">一</p>');
  });

  test('流内操作只输出转义文本与白名单标记', () => {
    const html = renderFlowEntry(ctx, {
      streamKey: 'run:1', instanceKey: 'map:move-choices:a', kind: 'talk', text: '相邻地点',
      actions: [{ label: '<目的地>', detail: '<要求>', disabled: true,
        marks: { 'data-map-move-to': 'b"<>', onclick: 'alert(1)' } }],
    });
    expect(html).toContain('class="flow-actions"');
    expect(html).toContain('&lt;目的地&gt;');
    expect(html).toContain('&lt;要求&gt;');
    expect(html).toContain('data-map-move-to="b&quot;&lt;&gt;" disabled');
    expect(html).not.toContain('onclick');
  });
});
