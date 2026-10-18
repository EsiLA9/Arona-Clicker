// ============================================================
// ui/scroll.test.ts — 聊天流 / 面板滚动状态管理
// 覆盖：贴底跟随 / 历史翻阅保持 / 图片异步加载 / 按宿主锚点恢复 / 多宿主隔离
// ============================================================
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrollManager } from '../../src/ui/scroll';
import { FlowScroll, type FlowScrollHost } from '../../src/ui/flow/flow-scroll';

interface FakeObserver {
  cb: ResizeObserverCallback;
  observed: any[];
  disconnected: boolean;
}

function makeStream(scrollHeight: number, clientHeight: number, scrollTop: number, images: any[] = []) {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};
  return {
    scrollHeight,
    clientHeight,
    scrollTop,
    querySelectorAll: (sel: string) => (sel === 'img' ? images : sel === '[data-flow-entry-key]' ? [] : []),
    addEventListener: (ev: string, fn: (...args: any[]) => void) => {
      (listeners[ev] ??= []).push(fn);
    },
    removeEventListener: (ev: string, fn: (...args: any[]) => void) => {
      listeners[ev] = (listeners[ev] ?? []).filter(f => f !== fn);
    },
    _fireScroll: () => (listeners['scroll'] ?? []).forEach(f => f()),
  } as any;
}

function makeRoot(stream: any) {
  return { querySelector: (sel: string) => (sel === '.chat-stream' ? stream : null) } as any;
}

function makePanelRoot(panels: any[], allPanels = panels) {
  return { querySelectorAll: (sel: string) => (sel === '.panel:not(.workspace-column)' ? panels : allPanels) } as any;
}

/** 带几何信息的宿主替身：条目按 top/bottom 渲染，滚动不自动改变条目坐标。 */
function makeAnchoredHost(entries: { key: string; top: number; bottom: number }[], scrollHeight = 2000, clientHeight = 400) {
  const host = {
    scrollTop: 0,
    scrollHeight,
    clientHeight,
    querySelectorAll: (sel: string) => (sel === '[data-flow-entry-key]' ? entries.map(entry => ({
      getAttribute: (name: string) => (name === 'data-flow-entry-key' ? entry.key : null),
      getBoundingClientRect: () => ({ top: entry.top, bottom: entry.bottom }),
    })) : []),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    getBoundingClientRect: () => ({ top: 0 }),
  };
  return { host: host as unknown as FlowScrollHost, entries };
}

describe('ScrollManager 聊天流滚动状态', () => {
  let observerInstances: FakeObserver[];

  beforeEach(() => {
    observerInstances = [];
    (globalThis as any).ResizeObserver = class {
      cb: ResizeObserverCallback;
      observed: any[] = [];
      disconnected = false;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        observerInstances.push(this as unknown as FakeObserver);
      }
      observe(el: any) {
        this.observed.push(el);
      }
      disconnect() {
        this.disconnected = true;
      }
    };
  });

  afterEach(() => {
    delete (globalThis as any).ResizeObserver;
  });

  test('贴底时新内容到达滚到底，翻历史时保持原位置', () => {
    const sm = new ScrollManager();
    const stream = makeStream(1000, 400, 600);
    const root = makeRoot(stream);
    sm.captureChat(root);
    sm.restoreChat(root, { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 1 });
    expect(stream.scrollTop).toBe(600); // 贴底：滚到 1.0 比例 = 1000 - 400

    // 用户上翻历史后重建：保持比例，不滚底
    stream.scrollTop = 120;
    sm.captureChat(root);
    sm.restoreChat(root, { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 1 });
    expect(stream.scrollTop).toBe(120);
  });

  test('最新条目为图片时：贴底状态图片撑开流高后自动再滚到底', () => {
    const sm = new ScrollManager();
    const img = { complete: false };
    const stream = makeStream(1000, 400, 600, [img]);
    const root = makeRoot(stream);
    sm.captureChat(root);
    sm.restoreChat(root, { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 1 });
    sm.observeChatStream(root);
    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0].observed).toEqual([img]); // 观察的是 <img>，而非容器

    // 图片加载完成：scrollHeight 涨到 1500，容器未变 → 重新贴底
    stream.scrollHeight = 1500;
    observerInstances[0].cb([] as any, {} as any);
    expect(stream.scrollTop).toBe(1500 - 400);
  });

  test('流高小于视口时：图片渲染后撑出视口也能自动贴底', () => {
    const sm = new ScrollManager();
    const img = { complete: false };
    const stream = makeStream(300, 400, 0, [img]); // 图片未加载：流高 < 视口高
    const root = makeRoot(stream);
    sm.captureChat(root); // max <= 0 → chatAtBottom = true
    sm.restoreChat(root, { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 1 });
    sm.observeChatStream(root);
    expect(observerInstances).toHaveLength(1);

    // 图片渲染后流高超过视口：重新贴底到新底部
    stream.scrollHeight = 900;
    observerInstances[0].cb([] as any, {} as any);
    expect(stream.scrollTop).toBe(900 - 400);
  });

  test('图片加载期间用户上翻历史，不被拽回底部', () => {
    const sm = new ScrollManager();
    const img = { complete: false };
    const stream = makeStream(1000, 400, 600, [img]);
    const root = makeRoot(stream);
    sm.captureChat(root);
    sm.restoreChat(root, { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 1 });
    sm.observeChatStream(root);
    expect(observerInstances).toHaveLength(1);

    // 用户上翻到顶部：scroll 事件实时刷新贴底标记
    stream.scrollTop = 0;
    stream._fireScroll();

    // 图片随后加载：不得把用户拽回底部
    stream.scrollHeight = 1500;
    observerInstances[0].cb([] as any, {} as any);
    expect(stream.scrollTop).toBe(0);
  });

  test('图片撑开前未贴底（用户翻历史）时不注册观察器', () => {
    const sm = new ScrollManager();
    const stream = makeStream(1000, 400, 0, [{ complete: false }]);
    const root = makeRoot(stream);
    sm.captureChat(root);
    sm.restoreChat(root, { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 1 });
    sm.observeChatStream(root);
    expect(observerInstances).toHaveLength(0);
  });

  test('无图片的流不注册观察器', () => {
    const sm = new ScrollManager();
    const stream = makeStream(1000, 400, 600);
    const root = makeRoot(stream);
    sm.captureChat(root);
    sm.restoreChat(root, { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 1 });
    sm.observeChatStream(root);
    expect(observerInstances).toHaveLength(0);
  });

  test('重建前 captureChat 会断开旧观察器（避免对已移除容器回调）', () => {
    const sm = new ScrollManager();
    const stream = makeStream(1000, 400, 600, [{ complete: false }]);
    const root = makeRoot(stream);
    sm.captureChat(root);
    sm.restoreChat(root, { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 1 });
    sm.observeChatStream(root);
    expect(observerInstances).toHaveLength(1);

    sm.captureChat(root);
    expect(observerInstances[0].disconnected).toBe(true);
  });

  test('reset 清快照并断开观察器', () => {
    const sm = new ScrollManager();
    const stream = makeStream(1000, 400, 600, [{ complete: false }]);
    const root = makeRoot(stream);
    sm.captureChat(root);
    sm.restoreChat(root, { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 1 });
    sm.observeChatStream(root);
    expect(observerInstances).toHaveLength(1);

    sm.reset();
    expect(observerInstances[0].disconnected).toBe(true);
    // 重置后不再按旧比例恢复（新宿主需要重新 capture）
    const fresh = makeStream(1000, 400, 0);
    sm.restoreChat(makeRoot(fresh), { centerTab: 'chat', conversationVariantId: null, activeStreamLength: 1 });
    expect(fresh.scrollTop).toBe(0);
  });
});

describe('FlowScroll 按宿主锚点恢复', () => {
  test('锚点条目仍在时保持其相对阅读偏移，追加内容不跳动', () => {
    const scroll = new FlowScroll();
    const { host, entries } = makeAnchoredHost([
      { key: 'a', top: -100, bottom: 20 },
      { key: 'b', top: 30, bottom: 150 },
    ]);
    host.scrollTop = 180;
    scroll.capture(host);

    // 末尾追加新条目：已有条目坐标不变，宿主高度变大
    entries.push({ key: 'c', top: 160, bottom: 280 });
    host.scrollHeight = 2200;
    scroll.restore(host, { mode: 'anchor' });

    expect(host.scrollTop).toBe(180);
  });

  test('锚点被回收时退到相邻稳定条目并夹取滚动位置', () => {
    const scroll = new FlowScroll();
    const { host, entries } = makeAnchoredHost([
      { key: 'a', top: -100, bottom: 20 },
      { key: 'b', top: 30, bottom: 150 },
    ]);
    host.scrollTop = 180;
    scroll.capture(host); // 锚点 = a（offset -100）

    // a 被同 ID 回收：b 顶上移，锚点键消失
    entries.splice(0, 1);
    entries[0].top = -100;
    entries[0].bottom = 20;
    scroll.restore(host, { mode: 'anchor' });

    // 退到索引 0 的 b，并对齐原偏移 -100 → scrollTop 不变
    expect(host.scrollTop).toBe(180);
  });

  test('原本贴底时跟随新内容滚到底', () => {
    const scroll = new FlowScroll();
    const { host } = makeAnchoredHost([
      { key: 'a', top: -100, bottom: 20 },
    ], 1000, 400);
    host.scrollTop = 600; // 完全贴底
    scroll.capture(host);
    host.scrollHeight = 1300;
    scroll.restore(host, { mode: 'anchor', follow: true });
    expect(host.scrollTop).toBe(900);
  });

  test('不同流实例各自保存状态，互不串扰', () => {
    const scroll = new FlowScroll();
    const first = makeAnchoredHost([{ key: 'a', top: -100, bottom: 20 }], 1000, 400);
    const second = makeAnchoredHost([{ key: 'x', top: -50, bottom: 50 }], 2000, 400);
    first.host.scrollTop = 120;
    second.host.scrollTop = 900;
    scroll.capture(first.host, 'run:1');
    scroll.capture(second.host, 'run:2');

    first.host.scrollTop = 0;
    second.host.scrollTop = 0;
    scroll.restore(first.host, { mode: 'ratio', streamKey: 'run:1' });
    scroll.restore(second.host, { mode: 'ratio', streamKey: 'run:2' });

    expect(first.host.scrollTop).toBe(120);
    expect(second.host.scrollTop).toBe(900);
  });

  test('宿主节点被替换时仍按同一流实例键恢复（普通 Chat 全量重建）', () => {
    const scroll = new FlowScroll();
    const before = makeAnchoredHost([{ key: 'a', top: -100, bottom: 20 }], 1000, 400);
    before.host.scrollTop = 120;
    scroll.capture(before.host, 'chat');

    // 全量 render 后是新节点：只保留同一流实例键
    const after = makeAnchoredHost([{ key: 'a', top: -100, bottom: 20 }], 1000, 400);
    scroll.restore(after.host, { mode: 'ratio', streamKey: 'chat' });
    expect(after.host.scrollTop).toBe(120);
  });

  test('缺失流状态时恢复不写入滚动位置', () => {
    const scroll = new FlowScroll();
    const { host } = makeAnchoredHost([{ key: 'a', top: 0, bottom: 100 }]);
    host.scrollTop = 42;
    scroll.restore(host, { mode: 'anchor' });
    expect(host.scrollTop).toBe(42);
  });
});

describe('ScrollManager 面板与工作区快照', () => {
  test('工作区外层 Panel 不进入既有内容面板滚动快照', () => {
    const sm = new ScrollManager();
    const firstBody = { scrollTop: 42 };
    const secondBody = { scrollTop: 108 };
    const workspaceBody = { scrollTop: 999 };
    const firstPanel = { querySelector: () => firstBody };
    const secondPanel = { querySelector: () => secondBody };
    const workspaceColumn = { querySelector: () => workspaceBody };
    const root = makePanelRoot([firstPanel, secondPanel], [workspaceColumn, firstPanel, secondPanel]);

    sm.capturePanel(root);
    firstBody.scrollTop = 0;
    secondBody.scrollTop = 0;
    sm.restorePanel(root);

    expect(firstBody.scrollTop).toBe(42);
    expect(secondBody.scrollTop).toBe(108);
    expect(workspaceBody.scrollTop).toBe(999);
  });

  test('工作区列把滚动委托给显式的内部 content-region 时保存和恢复该节点', () => {
    const sm = new ScrollManager();
    const leftContent = { scrollTop: 73 };
    const rightContent = { scrollTop: 129 };
    const makeColumnBody = (slot: string, content: { scrollTop: number }) => ({
      dataset: { scrollOwner: 'delegated' },
      scrollTop: 0,
      querySelector: (selector: string) => selector === '[data-scroll-owner="content-region"]' ? content : null,
      closest: (selector: string) => selector === '[data-workspace-column]' ? { dataset: { workspaceColumn: slot } } : null,
    });
    const bodies = [makeColumnBody('left', leftContent), makeColumnBody('right', rightContent)];
    const root = { querySelectorAll: (selector: string) => selector === '.workspace-column__body' ? bodies : [] } as any;

    sm.captureWorkspace(root);
    leftContent.scrollTop = 0;
    rightContent.scrollTop = 0;
    sm.restoreWorkspace(root);

    expect(leftContent.scrollTop).toBe(73);
    expect(rightContent.scrollTop).toBe(129);
    expect(bodies.map(body => body.scrollTop)).toEqual([0, 0]);
  });
});
