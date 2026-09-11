// ============================================================
// ui/scroll.test.ts — 聊天流滚动状态管理（ScrollManager）
// 覆盖：贴底跟随 / 历史翻阅保持 / 图片异步加载撑开流高后自动贴底
// ============================================================
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrollManager } from '../../src/ui/scroll';

type ObserverRec = { cb: ResizeObserverCallback; observed: any[] };

function makeStream(scrollHeight: number, clientHeight: number, scrollTop: number, images: any[] = []) {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};
  return {
    scrollHeight,
    clientHeight,
    scrollTop,
    querySelectorAll: (sel: string) => (sel === 'img' ? images : []),
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

describe('ScrollManager 聊天流滚动状态', () => {
  let observerInstances: ObserverRec[];

  beforeEach(() => {
    observerInstances = [];
    (globalThis as any).ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        observerInstances.push({ cb, observed: [] });
      }
      observe(el: any) {
        observerInstances[observerInstances.length - 1].observed.push(el);
      }
      disconnect() {}
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
    const disconnect = vi.fn();
    sm['resizeObserver'] = { disconnect, observe: vi.fn() } as any;

    const stream = makeStream(1000, 400, 600);
    sm.captureChat(makeRoot(stream));
    expect(disconnect).toHaveBeenCalled();
  });

  test('reset 清快照并断开观察器', () => {
    const sm = new ScrollManager();
    const disconnect = vi.fn();
    sm['resizeObserver'] = { disconnect, observe: vi.fn() } as any;
    sm.reset();
    expect(disconnect).toHaveBeenCalled();
  });

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
});
