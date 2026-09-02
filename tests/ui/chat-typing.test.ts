// ============================================================
// ui/chat-typing.test.ts — 页级打字提示与按钮门控（§4 Talklet.typing / thinking）
// 覆盖：默认 0.9s / 数据覆盖与夹取 / 忽略范围 / 推进补落 / 完结补落 /
//   清流与会话重置取消 / 跨流门控 / 持久化过滤 / 门控链与点击加速 / 门控态按钮渲染
// ============================================================
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatStream, DEFAULT_RHYTHM_SECONDS, ACCELERATE_SECONDS } from '../../src/ui/chat-stream';
import type { PanelState } from '../../src/ui/components/app-shell';
import type { ChatEntry } from '../../src/ui/components/story';
import { renderChatHistory } from '../../src/ui/components/story';
import { renderSendButton } from '../../src/ui/components/center-panel';
import type { UIContext } from '../../src/ui/context';
import type { GameInstance, SaveData } from '../../src/arona-clicker/runtime-game-instance';
import type { StoryView } from '../../src/arona-clicker/contracts/results';
import type { Talklet } from '../../src/data-services/contracts/story';
import { talklet } from '../../src/arona-clicker/content/def-factory';
import { withHistories } from '../../src/ui/controller-core';

function makePanelState(): PanelState {
  return {
    leftTab: 'area',
    centerTab: 'chat',
    rightTab: 'spot',
    chatEntries: [],
    chatTexts: [],
    selectedVariantId: null,
    conversationVariantId: null,
    studentChats: {},
    studentChatTexts: {},
    storyNavPath: [],
  } as PanelState;
}

function makeGame(view: StoryView | null): GameInstance {
  return {
    getStoryView: () => view,
    getView: () => ({ currentStory: view }),
  } as unknown as GameInstance;
}

function talkView(page: Talklet, pageIndex = 0): StoryView {
  return {
    storyId: 'base:demo',
    type: 'passive',
    storyDefId: 'base:demo',
    pageIndex,
    totalPages: 2,
    page,
    availableChoiceIndexes: [],
  };
}

/**
 * 逐毫秒推进假时钟。vitest 假定时器中「tick 内新调度的定时器」不会在同一 tick 触发，
 * 且后续 tick(0) 也无法命中（目标时间需严格大于其 callAt）；逐毫秒推进可按真实
 * 事件循环次序依次触发 900ms 门控、400ms 停顿拍与 0ms 连发。
 * 末尾多推进 50ms：让链式 0ms 连发结算完成，又不会触及下一个 400ms/900ms 节拍。
 */
function run(ms: number): void {
  for (let i = 0; i <= ms + 50; i++) vi.advanceTimersByTime(1);
}

describe('页级打字提示（ChatStream 状态机）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('非右侧 talk 页默认 0.9s：先省略号气泡，到期替换为内容', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    const view = talkView({ text: '老师好', speaker: '星野' });
    const onChange = vi.fn();
    chat.onChange = onChange;

    chat.syncCurrentStory(ps, makeGame(view));
    const stream = ps.studentChats['Hoshino'];
    expect(stream).toHaveLength(1);
    expect(stream[0].kind).toBe('typing');
    expect(stream[0].speaker).toBe('星野');
    expect(stream[0].side ?? 'left').toBe('left');
    expect(onChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(899);
    chat.syncCurrentStory(ps, makeGame(view)); // 指纹未变：不重复落页
    expect(stream.some(e => e.kind === 'talk')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(stream).toHaveLength(1);
    expect(stream[0].kind).toBe('talk');
    expect(stream[0].text).toBe('老师好');
    expect(stream[0].speaker).toBe('星野');
    expect(onChange).toHaveBeenCalledTimes(1); // 到期落内容触发重渲染
  });

  test('typing:0 显式关闭 → 立即落内容', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';

    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'a', speaker: '星野', typing: 0 })));
    expect(ps.studentChats['Hoshino'][0].kind).toBe('talk');
  });

  test('typing:2 按 2 秒计时', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'a', speaker: '星野', typing: 2 })));
    const stream = ps.studentChats['Hoshino'];
    vi.advanceTimersByTime(1999);
    expect(stream[0].kind).toBe('typing');
    vi.advanceTimersByTime(1);
    expect(stream[0].kind).toBe('talk');
  });

  test('typing:20 夹取上限 10 秒', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'a', speaker: '星野', typing: 20 })));
    const stream = ps.studentChats['Hoshino'];
    vi.advanceTimersByTime(9999);
    expect(stream[0].kind).toBe('typing');
    vi.advanceTimersByTime(1);
    expect(stream[0].kind).toBe('talk');
  });

  test('右侧气泡 / narration / kizuna / absorbed 忽略打字；click 页不进流', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';

    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'r', speaker: '老师', side: 'right' })));
    expect(ps.studentChats['Hoshino'][0].kind).toBe('talk');

    chat.reset();
    ps.studentChats['Hoshino'] = [];
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'n', kind: 'narration', typing: 1 })));
    expect(ps.studentChats['Hoshino'][0].kind).toBe('narration');

    chat.reset();
    ps.studentChats['Hoshino'] = [];
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'k', kizuna: { storyId: 'bond:x' } })));
    expect(ps.studentChats['Hoshino'][0].kind).toBe('talk');

    chat.reset();
    ps.studentChats['Hoshino'] = [];
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'c', kind: 'click' })));
    expect(ps.studentChats['Hoshino']).toHaveLength(0);
  });

  test('计时内推进（防御路径）：旧页内容立即原位补落，新页按自身声明处理', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    const view = talkView({ text: '第一页', speaker: '星野' });
    chat.syncCurrentStory(ps, makeGame(view));
    expect(ps.studentChats['Hoshino'][0].kind).toBe('typing');

    view.pageIndex = 1;
    view.page = { text: '第二页', speaker: '星野' };
    chat.syncCurrentStory(ps, makeGame(view));
    const stream = ps.studentChats['Hoshino'];
    expect(stream.map(e => `${e.kind}:${e.text}`)).toEqual(['talk:第一页', 'typing:']);

    vi.advanceTimersByTime(900);
    expect(stream.map(e => `${e.kind}:${e.text}`)).toEqual(['talk:第一页', 'talk:第二页']);
  });

  test('完结清空：仍在打字的上一页内容立即补落，门控解除', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    const view = talkView({ text: '最后一条', speaker: '星野' });
    chat.syncCurrentStory(ps, makeGame(view));
    expect(ps.studentChats['Hoshino'][0].kind).toBe('typing');

    chat.syncCurrentStory(ps, makeGame(null));
    const stream = ps.studentChats['Hoshino'];
    expect(stream).toHaveLength(1);
    expect(stream[0]).toMatchObject({ kind: 'talk', text: '最后一条' });
    expect(chat.activeGate(ps)).toBeNull();
  });

  test('clearAll（chatFlowCleared）：取消计时且不落内容', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'x', speaker: '星野' })));
    chat.clearAll(ps);
    expect(ps.studentChats['Hoshino']).toHaveLength(0);

    vi.advanceTimersByTime(5000);
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'x', speaker: '星野' })));
    expect(ps.studentChats['Hoshino']).toHaveLength(0); // 旧计时器已取消
  });

  test('reset（读档/软重启）：全量取消，无残留', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'x', speaker: '星野' })));
    chat.reset();
    expect(ps.studentChats['Hoshino']).toHaveLength(0);
    vi.advanceTimersByTime(5000);
    expect(ps.studentChats['Hoshino']).toHaveLength(0);
  });

  test('跨流切换：他流门控不受影响，计时到期内容落入原流；返回原流不重复落页', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    const view = talkView({ text: '星野的话', speaker: '星野' });
    chat.syncCurrentStory(ps, makeGame(view));
    expect(ps.studentChats['Hoshino'][0].kind).toBe('typing');

    // 切到无剧情的芹香流：不落星野流内容
    ps.conversationVariantId = 'Serika';
    chat.syncCurrentStory(ps, makeGame(null));
    expect(ps.studentChats['Serika'] ?? []).toHaveLength(0);
    expect(ps.studentChats['Hoshino']).toHaveLength(1);
    expect(ps.studentChats['Hoshino'][0].kind).toBe('typing');

    // 返回星野流：指纹未变，不重复压入
    ps.conversationVariantId = 'Hoshino';
    chat.syncCurrentStory(ps, makeGame(view));
    expect(ps.studentChats['Hoshino']).toHaveLength(1);

    // 计时到期：内容落入星野流
    vi.advanceTimersByTime(900);
    expect(ps.studentChats['Hoshino']).toHaveLength(1);
    expect(ps.studentChats['Hoshino'][0]).toMatchObject({ kind: 'talk', text: '星野的话' });
    expect(ps.studentChats['Serika'] ?? []).toHaveLength(0);
  });
});

describe('按钮门控链（typing → 送达 → thinking → 出文字）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('默认链：typing 0.9s → thinking 0.9s → 解除（sendText 页停下等待回复）', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    const view = talkView({ text: '在吗', speaker: '星野', sendText: '嗯' });
    chat.syncCurrentStory(ps, makeGame(view));

    expect(chat.activeGate(ps)).toBe('typing');
    vi.advanceTimersByTime(900);
    expect(ps.studentChats['Hoshino'][0].kind).toBe('talk'); // 消息已送达
    expect(chat.activeGate(ps)).toBe('thinking');            // 按钮"想回复"中

    vi.advanceTimersByTime(900);
    expect(chat.activeGate(ps)).toBeNull();                  // 文字出现，可正常交互
  });

  test('thinking:0 关闭思考阶段：打字结束即解除', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'a', speaker: '星野', sendText: 'r', thinking: 0 })));
    vi.advanceTimersByTime(900);
    expect(ps.studentChats['Hoshino'][0].kind).toBe('talk');
    expect(chat.activeGate(ps)).toBeNull();
  });

  test('thinking:2 独立声明思考时长（夹取同 typing）', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'a', speaker: '星野', sendText: 'r', thinking: 2 })));
    vi.advanceTimersByTime(900); // 打字结束
    expect(chat.activeGate(ps)).toBe('thinking');
    vi.advanceTimersByTime(1900); // 2s - 100ms
    expect(chat.activeGate(ps)).toBe('thinking');
    vi.advanceTimersByTime(100);
    expect(chat.activeGate(ps)).toBeNull();
  });

  test('typing:0 + thinking 缺省：内容立即落流，按钮仍思考 0.9s', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'a', speaker: '星野', sendText: 'r', typing: 0 })));
    expect(ps.studentChats['Hoshino'][0].kind).toBe('talk');
    expect(chat.activeGate(ps)).toBe('thinking');
    vi.advanceTimersByTime(900);
    expect(chat.activeGate(ps)).toBeNull();
  });

  test('点击加速：每次按 ACCELERATE_SECONDS 递减，阶段归零即送达/解除', () => {
    vi.useFakeTimers(); // 冻结时钟：点击次数随步长常量确定，不受真实耗时影响
    try {
      const chat = new ChatStream();
      const ps = makePanelState();
      ps.conversationVariantId = 'Hoshino';
      const onChange = vi.fn();
      chat.onChange = onChange;
      chat.syncCurrentStory(ps, makeGame(talkView({ text: 'a', speaker: '星野', sendText: 'r' })));

      // 击穿 0.9s 缺省门控所需点击次数（步长 ≥ 时长时一次击穿）
      const clicksToFire = Math.max(1, Math.ceil((DEFAULT_RHYTHM_SECONDS * 1000) / (ACCELERATE_SECONDS * 1000)));
      for (let i = 0; i < clicksToFire - 1; i++) {
        chat.accelerateActiveGate(ps);
        expect(chat.activeGate(ps)).toBe('typing');
      }
      expect(onChange).not.toHaveBeenCalled();

      chat.accelerateActiveGate(ps); // 打字阶段归零 → 送达 + 进入思考
      expect(ps.studentChats['Hoshino'][0].kind).toBe('talk');
      expect(chat.activeGate(ps)).toBe('thinking');
      expect(onChange).toHaveBeenCalledTimes(1);

      for (let i = 0; i < clicksToFire - 1; i++) {
        chat.accelerateActiveGate(ps);
        expect(chat.activeGate(ps)).toBe('thinking');
      }
      chat.accelerateActiveGate(ps); // 思考阶段归零 → 解除
      expect(chat.activeGate(ps)).toBeNull();
      expect(onChange).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('thinking 门控不影响已送达内容；解除后按钮可正常交互（gate = null）', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    chat.syncCurrentStory(ps, makeGame(talkView({ text: 'a', speaker: '星野', sendText: 'r' })));
    vi.advanceTimersByTime(1800);
    expect(ps.studentChats['Hoshino']).toHaveLength(1);
    expect(chat.activeGate(ps)).toBeNull();
  });
});

describe('链式连发（无按钮要求页送达后自动推进）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('连发节奏：省略号-发出-停顿-省略号-发出，直到 sendText 页停下进入思考', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    const pages: Talklet[] = [
      { text: '第一句', speaker: '星野' },
      { text: '第二句', speaker: '星野' },
      { text: '第三句', speaker: '星野', sendText: '好的' },
    ];
    const view = talkView(pages[0], 0);
    const fired: string[] = [];
    chat.onAutoAdvance = (key) => {
      if (view.pageIndex + 1 >= pages.length) return;
      fired.push(key);
      view.pageIndex += 1;
      view.page = pages[view.pageIndex];
      chat.syncCurrentStory(ps, makeGame(view));
    };

    chat.syncCurrentStory(ps, makeGame(view));
    expect(chat.activeGate(ps)).toBe('typing');

    run(900); // 第一句送达 → 停顿拍
    expect(fired).toEqual([]);
    expect(chat.activeGate(ps)).toBe('pause');
    expect(ps.studentChats['Hoshino'].map(e => e.text)).toEqual(['第一句']);

    run(400); // 停顿结束 → 连发推进 → 第二句打字
    expect(fired).toEqual(['Hoshino']);
    expect(chat.activeGate(ps)).toBe('typing');            // 跳过 thinking，直接下一页打字
    expect(ps.studentChats['Hoshino'].map(e => `${e.kind}:${e.text}`)).toEqual(['talk:第一句', 'typing:']);

    run(900); // 第二句送达 → 停顿拍
    expect(fired).toEqual(['Hoshino']);
    expect(chat.activeGate(ps)).toBe('pause');

    run(400); // 停顿结束 → 连发推进 → 第三句打字
    expect(fired).toEqual(['Hoshino', 'Hoshino']);
    expect(chat.activeGate(ps)).toBe('typing');

    run(900); // 第三句送达 → 有回复文案：停下进入思考
    expect(chat.activeGate(ps)).toBe('thinking');
    expect(ps.studentChats['Hoshino'].map(e => e.text)).toEqual(['第一句', '第二句', '第三句']);

    run(900);
    expect(chat.activeGate(ps)).toBeNull();
  });

  test('选择页 / 按动次数页停下等待玩家', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    const pages: Talklet[] = [
      { text: '第一句', speaker: '星野' },
      { text: '选吧', speaker: '星野', choices: [{ text: '选项1', effects: [] }] },
    ];
    const view = talkView(pages[0], 0);
    const fired: string[] = [];
    chat.onAutoAdvance = (key) => {
      if (view.pageIndex + 1 >= pages.length) return;
      fired.push(key);
      view.pageIndex += 1;
      view.page = pages[view.pageIndex];
      chat.syncCurrentStory(ps, makeGame(view));
    };
    chat.syncCurrentStory(ps, makeGame(view));
    run(900); // 第一句送达 → 停顿
    run(400); // 连发推进 → 选择页打字
    expect(fired).toEqual(['Hoshino']);
    run(900); // 选择页送达 → 停下
    expect(fired).toHaveLength(1); // 选项页不再连发
    expect(chat.activeGate(ps)).toBe('thinking');

    // clickWork 页同样停下
    chat.reset();
    ps.studentChats['Hoshino'] = [];
    const workPages: Talklet[] = [
      { text: '第一句', speaker: '星野' },
      { text: '干活', speaker: '星野', clickWork: { base: 3 } },
    ];
    const workView = talkView(workPages[0], 0);
    const workFired: string[] = [];
    chat.onAutoAdvance = (key) => {
      if (workView.pageIndex + 1 >= workPages.length) return;
      workFired.push(key);
      workView.pageIndex += 1;
      workView.page = workPages[workView.pageIndex];
      chat.syncCurrentStory(ps, makeGame(workView));
    };
    chat.syncCurrentStory(ps, makeGame(workView));
    run(900);
    run(400);
    run(900);
    expect(workFired).toEqual(['Hoshino']);
    expect(chat.activeGate(ps)).toBe('thinking');
  });

  test('typing:0 链：停顿拍逐页连发，末页 sendText 停下', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    const pages: Talklet[] = [
      { text: 'a', speaker: '星野', typing: 0 },
      { text: 'b', speaker: '星野', typing: 0 },
      { text: 'c', speaker: '星野', typing: 0, sendText: 'r' },
    ];
    const view = talkView(pages[0], 0);
    const fired: string[] = [];
    chat.onAutoAdvance = (key) => {
      if (view.pageIndex + 1 >= pages.length) return;
      fired.push(key);
      view.pageIndex += 1;
      view.page = pages[view.pageIndex];
      chat.syncCurrentStory(ps, makeGame(view));
    };
    chat.syncCurrentStory(ps, makeGame(view));
    expect(ps.studentChats['Hoshino'].map(e => e.text)).toEqual(['a']);

    run(1000); // 两次停顿拍 + 连发推进
    expect(fired).toEqual(['Hoshino', 'Hoshino']);
    expect(ps.studentChats['Hoshino'].map(e => e.text)).toEqual(['a', 'b', 'c']);
    expect(chat.activeGate(ps)).toBe('thinking');
  });

  test('外部推进使指纹变化 / 剧情清空：待执行的连发取消', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    const fired: string[] = [];
    chat.onAutoAdvance = (key) => fired.push(key);

    const view = talkView({ text: 'a', speaker: '星野', typing: 0 }, 0);
    chat.syncCurrentStory(ps, makeGame(view));
    view.pageIndex = 1;
    view.page = { text: 'b', speaker: '星野', typing: 0, sendText: 'r' };
    chat.syncCurrentStory(ps, makeGame(view)); // 外部推进：指纹变化分支取消连发（新页需回复，不重排）
    run(5);
    expect(fired).toEqual([]);
    expect(chat.activeGate(ps)).toBe('thinking');

    chat.syncCurrentStory(ps, makeGame(null)); // 剧情清空：门控与连发一并解除
    run(5);
    expect(fired).toEqual([]);
    expect(chat.activeGate(ps)).toBeNull();
  });

  test('末页连发到完结：剧情清空，链自然终止', () => {
    const chat = new ChatStream();
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    const pages: Talklet[] = [
      { text: 'a', speaker: '星野' },
      { text: 'b', speaker: '星野' },
    ];
    const view = talkView(pages[0], 0);
    const fired: string[] = [];
    chat.onAutoAdvance = (key) => {
      fired.push(key);
      if (view.pageIndex + 1 >= pages.length) {
        chat.syncCurrentStory(ps, makeGame(null)); // clickSend → 剧情完结
        return;
      }
      view.pageIndex += 1;
      view.page = pages[view.pageIndex];
      chat.syncCurrentStory(ps, makeGame(view));
    };
    chat.syncCurrentStory(ps, makeGame(view));
    run(900);
    run(400);
    expect(fired).toEqual(['Hoshino']);
    run(900);
    run(400);
    expect(fired).toEqual(['Hoshino', 'Hoshino']);
    expect(ps.studentChats['Hoshino'].map(e => e.text)).toEqual(['a', 'b']);
    expect(chat.activeGate(ps)).toBeNull();
  });
});

describe('连发分组渲染（同人同侧仅首条显示头像/名称）', () => {
  const ctx = {
    escapeHtml: (s: string) => s,
    game: {
      pics: { urlOf: () => undefined },
      registry: { characterVariants: { values: () => [] } },
      rosterSystem: { getOwned: () => undefined, getAllVariants: () => [] },
    },
  } as unknown as UIContext;

  const talk = (id: number, text: string, overrides: Partial<ChatEntry> = {}): ChatEntry =>
    ({ id, kind: 'talk', speaker: '星野', text, timestamp: 0, ...overrides });

  test('同人相邻两条：仅首条显示头像/名称，后续以 ghost 占位只出现气泡', () => {
    const html = renderChatHistory([talk(1, '一', { avatar: 'av' }), talk(2, '二', { avatar: 'av' })], ctx);
    expect(html.match(/chat-name/g)).toHaveLength(1);
    expect(html.match(/chat-avatar-ghost/g)).toHaveLength(1);
    expect(html.match(/chat-bubble-continued/g)).toHaveLength(1); // 接续条目隐藏气泡三角
    expect(html).toContain('chat-avatar-fallback'); // 首条头像正常渲染
    expect(html).toContain('二');                    // 后续气泡本体仍在
  });

  test('换人 / 旁白打断 / 玩家回复打断 → 重新完整显示头像与名称', () => {
    const withNarr = renderChatHistory(
      [talk(1, '一'), { id: 9, kind: 'narration', text: '旁白', timestamp: 0 }, talk(2, '二')],
      ctx,
    );
    expect(withNarr.match(/chat-name/g)).toHaveLength(2);

    const withPlayer = renderChatHistory(
      [talk(1, '一'), { id: 9, kind: 'talk', speaker: '老师', text: '回', isPlayer: true, timestamp: 0 }, talk(2, '二')],
      ctx,
    );
    // 玩家回复居中打断：三条各自成组，头像/名称均完整显示
    expect(withPlayer.match(/chat-name/g)).toHaveLength(3);

    const diffSpeaker = renderChatHistory([talk(1, '一'), talk(2, '二', { speaker: '芹香' })], ctx);
    expect(diffSpeaker.match(/chat-name/g)).toHaveLength(2);
  });

  test('typing 条目参与分组：接续时只显示气泡内节奏点', () => {
    const html = renderChatHistory(
      [talk(1, '一'), { id: 2, kind: 'typing', speaker: '星野', text: '', timestamp: 0 }],
      ctx,
    );
    expect(html.match(/chat-name/g)).toHaveLength(1);
    expect(html).toContain('send-dots');
    expect(html).toContain('chat-bubble-continued'); // 接续 typing 同样隐藏三角
  });

  test('showAvatar 强制该条完整显示头像与名称', () => {
    const html = renderChatHistory([talk(1, '一'), talk(2, '二', { showAvatar: true })], ctx);
    expect(html.match(/chat-name/g)).toHaveLength(2);
    expect(html).not.toContain('chat-avatar-ghost');
    expect(html).not.toContain('chat-bubble-continued'); // 强制条目保留三角
  });
});

describe('门控态按钮与打字气泡渲染', () => {
  const ctx = {
    escapeHtml: (s: string) => s,
    game: {
      pics: { urlOf: () => undefined },
      registry: { characterVariants: { values: () => [] } },
      rosterSystem: { getOwned: () => undefined, getAllVariants: () => [] },
    },
  } as unknown as UIContext;

  test('门控态按钮：只渲染节奏点 + 等高占位，不透露回复文案', () => {
    const sendState = { mode: 'advance', storyId: 'test:story:s', pageIndex: 0, text: '回复内容' } as const;
    const gated = renderSendButton(sendState, 'typing');
    expect(gated).toContain('send-dots');
    expect(gated).toContain('send-ghost');
    expect(gated).not.toContain('回复内容');
    expect(renderSendButton(sendState, 'thinking')).not.toContain('回复内容');

    const open = renderSendButton(sendState, null);
    expect(open).toContain('回复内容');
    expect(open).toContain('send-text');
  });

  test('clickWork 态补等高占位（与一般点击态等高）', () => {
    const workState = { mode: 'advance', storyId: 'test:story:s', pageIndex: 0, text: '任务', clickWork: { total: 3, done: 1 } } as const;
    const html = renderSendButton(workState, null);
    expect(html).toContain('send-work-count');
    expect(html).toContain('send-ghost');
  });

  test('打字气泡复用 send-dots 结构', () => {
    const entry: ChatEntry = { id: 1, kind: 'typing', speaker: '星野', text: '', timestamp: 0 };
    const html = renderChatHistory([entry], ctx);
    expect(html).toContain('send-dots');
    expect(html).toContain('chat-bubble-npc');
  });
});

describe('打字条目不入档（withHistories 过滤）', () => {
  test('保存的聊天历史不含 kind=typing 条目', () => {
    const ps = makePanelState();
    ps.conversationVariantId = 'Hoshino';
    ps.studentChats['Hoshino'] = [
      { id: 1, kind: 'typing', speaker: '星野', text: '', timestamp: 1 },
      { id: 2, kind: 'talk', speaker: '星野', text: '在', timestamp: 2 },
    ];
    ps.chatEntries = [
      { id: 3, kind: 'typing', speaker: 'x', text: '', timestamp: 3 },
      { id: 4, kind: 'narration', text: '旁白', timestamp: 4 },
    ];
    const ctrl = { panelState: ps } as never;
    const histories = withHistories(ctrl, {} as SaveData).chatHistories!;
    expect(histories['variant:Hoshino']).toHaveLength(1);
    expect((histories['variant:Hoshino'] as { kind: string }[])[0].kind).toBe('talk');
    expect(histories['global']).toHaveLength(1);
    expect((histories['global'] as { kind: string }[])[0].kind).toBe('narration');
  });
});

describe('talklet.typing / thinking builder', () => {
  test('输出 typing / thinking 字段；缺省不产出', () => {
    const built = talklet('x').typing(1.5).thinking(0.3).showAvatar().build();
    expect(built.typing).toBe(1.5);
    expect(built.thinking).toBe(0.3);
    expect(built.showAvatar).toBe(true);
    const plain = talklet('x').build();
    expect(plain.typing).toBeUndefined();
    expect(plain.thinking).toBeUndefined();
    expect(plain.showAvatar).toBeUndefined();
  });
});
