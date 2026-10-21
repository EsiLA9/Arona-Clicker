// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { PopoverManager } from '../../src/ui/popovers';

describe('PopoverManager 刷新范围', () => {
  afterEach(() => {
    document.body.replaceWith(document.createElement('body'));
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setup(): { manager: PopoverManager; left: HTMLElement; center: HTMLElement; right: HTMLElement; tooltip: HTMLElement } {
    document.body.innerHTML = `
      <div id="app">
        <section id="left"><span class="hover-wrap" id="left-anchor"></span></section>
        <section id="center"><span class="hover-wrap" id="center-anchor"></span></section>
        <section id="right"><span class="hover-wrap" id="right-anchor"></span></section>
      </div>
      <div id="floating-tooltip" class="floating-tooltip is-open"></div>
    `;
    const root = document.querySelector<HTMLElement>('#app')!;
    const manager = new PopoverManager(root, {} as never);
    const center = document.querySelector<HTMLElement>('#center')!;
    (manager as unknown as { lastWrap: HTMLElement }).lastWrap = document.querySelector<HTMLElement>('#center-anchor')!;
    return {
      manager,
      left: document.querySelector<HTMLElement>('#left')!,
      center,
      right: document.querySelector<HTMLElement>('#right')!,
      tooltip: document.querySelector<HTMLElement>('#floating-tooltip')!,
    };
  }

  it('局部刷新其他 panel 时保留当前 hover', () => {
    const { manager, left, right, tooltip } = setup();

    manager.dismissBeforeRootMutation(left);
    manager.dismissBeforeRootMutation(right);

    expect(tooltip.classList.contains('is-open')).toBe(true);
  });

  it('替换 hover 所在范围时关闭 tooltip', () => {
    const { manager, center, tooltip } = setup();

    manager.dismissBeforeRootMutation(center);

    expect(tooltip.classList.contains('is-open')).toBe(false);
  });

  it('全量刷新范围仍关闭 #app 内 hover', () => {
    const { manager, tooltip } = setup();

    manager.dismissBeforeRootMutation();

    expect(tooltip.classList.contains('is-open')).toBe(false);
  });

  it('DOM 刷新会取消尚未显示的旧锚点 tooltip', () => {
    vi.useFakeTimers();
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    document.body.innerHTML = `
      <div id="app"><span class="hover-wrap" data-tooltip="spot:base:spot:credit_printer"></span></div>
    `;
    const root = document.querySelector<HTMLElement>('#app')!;
    const anchor = root.querySelector<HTMLElement>('.hover-wrap')!;
    const manager = new PopoverManager(document.body, game);
    manager.bind();

    try {
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: null }));
      manager.dismissBeforeRootMutation(root);
      anchor.remove();
      vi.advanceTimersByTime(100);

      expect(document.querySelector('#floating-tooltip')?.classList.contains('is-open')).toBe(false);
    } finally {
      game.stop();
      vi.useRealTimers();
    }
  });

  it('键盘 focus 进入和离开 tooltip 锚点时同步显示与关闭', () => {
    vi.useFakeTimers();
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    document.body.innerHTML = `
      <div id="app"><button class="hover-wrap" data-tooltip="spot:base:spot:credit_printer">查看</button></div>
    `;
    const root = document.querySelector<HTMLElement>('#app')!;
    const anchor = root.querySelector<HTMLElement>('.hover-wrap')!;
    const manager = new PopoverManager(root, game);
    manager.bind();

    try {
      anchor.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      vi.advanceTimersByTime(80);
      expect(document.querySelector('#floating-tooltip')?.classList.contains('is-open')).toBe(true);

      anchor.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
      vi.advanceTimersByTime(60);
      expect(document.querySelector('#floating-tooltip')?.classList.contains('is-open')).toBe(false);
    } finally {
      game.stop();
      vi.useRealTimers();
    }
  });

  function makeRect(left: number, top: number, width: number, height: number): DOMRect {
    return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) } as DOMRect;
  }

  function setViewport(width: number, height: number): () => void {
    const widthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    const heightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    return () => {
      if (widthDescriptor) Object.defineProperty(window, 'innerWidth', widthDescriptor);
      if (heightDescriptor) Object.defineProperty(window, 'innerHeight', heightDescriptor);
    };
  }

  function setupHover(
    rects: Map<HTMLElement, DOMRect>,
    popupSize = { width: 220, height: 140 },
    viewport = { width: 800, height: 600 },
  ): { game: GameInstance; manager: PopoverManager; anchors: HTMLElement[]; tooltip: HTMLElement; restoreViewport: () => void; flushFrames: () => void; queuedFrames: () => number } {
    const restoreViewport = setViewport(viewport.width, viewport.height);
    const game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame('base:init:schale_office');
    document.body.innerHTML = `<div id="app">${Array.from({ length: 2 }, (_, index) => `<div class="hover-wrap" data-tooltip="spot:base:spot:credit_printer" data-index="${index}"><span>target ${index}</span></div>`).join('')}</div>`;
    const anchors = [...document.querySelectorAll<HTMLElement>('.hover-wrap')];
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement): DOMRect {
      if (this.id === 'floating-tooltip') {
        const maxWidth = Number.parseFloat(this.style.maxWidth) || viewport.width;
        const maxHeight = Number.parseFloat(this.style.maxHeight) || viewport.height;
        const left = Number.parseFloat(this.style.left) || 0;
        const top = Number.parseFloat(this.style.top) || 0;
        return makeRect(left, top, Math.min(popupSize.width, maxWidth), Math.min(popupSize.height, maxHeight));
      }
      return rects.get(this) ?? makeRect(0, 0, 0, 0);
    });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const manager = new PopoverManager(document.body, game);
    manager.bind();
    const flushFrames = () => {
      while (frames.length) frames.shift()!(0);
    };
    return { game, manager, anchors, tooltip: document.querySelector<HTMLElement>('#floating-tooltip')!, restoreViewport, flushFrames, queuedFrames: () => frames.length };
  }

  it('同一 Tooltip 目标内经过子元素不会重置显示延迟', () => {
    vi.useFakeTimers();
    const rects = new Map<HTMLElement, DOMRect>();
    const { game, anchors, tooltip, restoreViewport } = setupHover(rects);
    const anchor = anchors[0];
    const child = anchor.querySelector('span')!;

    try {
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 160, clientY: 160 }));
      vi.advanceTimersByTime(60);
      child.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: anchor, clientX: 170, clientY: 170 }));
      vi.advanceTimersByTime(20);
      expect(tooltip.classList.contains('is-open')).toBe(true);
    } finally {
      game.stop();
      restoreViewport();
    }
  });

  it('Spot Tooltip 不再展示 Manager 字段', () => {
    vi.useFakeTimers();
    const rects = new Map<HTMLElement, DOMRect>();
    const { game, anchors, tooltip, restoreViewport } = setupHover(rects);

    try {
      anchors[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 160, clientY: 160 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.innerHTML).not.toContain('<span>Manager</span>');
    } finally {
      game.stop();
      restoreViewport();
    }
  });

  it('显示后快速离开并返回会取消待隐藏计时', () => {
    vi.useFakeTimers();
    const rects = new Map<HTMLElement, DOMRect>();
    const { game, anchors, tooltip, restoreViewport } = setupHover(rects);
    const anchor = anchors[0];

    try {
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 160, clientY: 160 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.classList.contains('is-open')).toBe(true);
      anchor.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
      vi.advanceTimersByTime(30);
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 165, clientY: 165 }));
      vi.advanceTimersByTime(30);
      expect(tooltip.classList.contains('is-open')).toBe(true);
    } finally {
      game.stop();
      restoreViewport();
    }
  });

  it('移向相邻目标后在新延迟内更新详情内容', () => {
    vi.useFakeTimers();
    const rects = new Map<HTMLElement, DOMRect>();
    const { game, anchors, tooltip, restoreViewport } = setupHover(rects);
    const [first, second] = anchors;
    second.dataset.tooltip = 'area:base:area:schale_main';

    try {
      first.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 160, clientY: 160 }));
      vi.advanceTimersByTime(80);
      const firstContent = tooltip.innerHTML;
      first.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: second }));
      second.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: first, clientX: 240, clientY: 160 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.innerHTML).not.toBe(firstContent);
      expect(tooltip.innerHTML).toContain('AREA');
    } finally {
      game.stop();
      restoreViewport();
    }
  });

  it('相邻目标没有有效详情时关闭旧内容', () => {
    vi.useFakeTimers();
    const rects = new Map<HTMLElement, DOMRect>();
    const { game, anchors, tooltip, restoreViewport } = setupHover(rects);
    const [first, second] = anchors;
    second.dataset.tooltip = 'unknown:missing';

    try {
      first.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 160, clientY: 160 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.classList.contains('is-open')).toBe(true);
      first.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: second }));
      second.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: first, clientX: 240, clientY: 160 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.classList.contains('is-open')).toBe(false);
    } finally {
      game.stop();
      restoreViewport();
    }
  });

  it('鼠标移动时 Tooltip 沿目标右侧纵向跟随，并以 RAF 合并位置更新', () => {
    vi.useFakeTimers();
    const rects = new Map<HTMLElement, DOMRect>();
    const { game, anchors, tooltip, restoreViewport, flushFrames, queuedFrames } = setupHover(rects, { width: 220, height: 140 }, { width: 800, height: 600 });
    const anchor = anchors[0];
    rects.set(anchor, makeRect(200, 180, 100, 100));

    try {
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 250, clientY: 210 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.style.left).toBe('300px');
      expect(tooltip.style.top).toBe('140px');
      anchor.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 250, clientY: 270 }));
      anchor.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 250, clientY: 280 }));
      expect(queuedFrames()).toBe(1);
      flushFrames();
      expect(tooltip.style.top).toBe('210px');
    } finally {
      game.stop();
      restoreViewport();
    }
  });

  it('右栏 Spot 优先放在卡片左侧，左侧空间不足时改放右侧', () => {
    vi.useFakeTimers();
    const rects = new Map<HTMLElement, DOMRect>();
    const { game, anchors, tooltip, restoreViewport } = setupHover(rects, { width: 220, height: 140 }, { width: 800, height: 600 });
    const anchor = anchors[0];
    anchor.dataset.uiSpotCard = 'base:spot:credit_printer';
    const panel = document.createElement('aside');
    panel.className = 'right-panel';
    anchor.replaceWith(panel);
    panel.append(anchor);

    try {
      rects.set(anchor, makeRect(300, 180, 100, 100));
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 350, clientY: 220 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.style.left).toBe('80px');

      anchor.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
      vi.advanceTimersByTime(60);
      rects.set(anchor, makeRect(20, 180, 100, 100));
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 70, clientY: 220 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.style.left).toBe('120px');
    } finally {
      game.stop();
      restoreViewport();
    }
  });

  it('靠近右边缘时放到左侧，大型目标空间不足时改放下方', () => {
    vi.useFakeTimers();
    const rects = new Map<HTMLElement, DOMRect>();
    const { game, anchors, tooltip, restoreViewport, flushFrames } = setupHover(rects, { width: 220, height: 140 }, { width: 800, height: 600 });
    const anchor = anchors[0];

    try {
      rects.set(anchor, makeRect(650, 180, 130, 100));
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 700, clientY: 220 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.style.left).toBe('430px');
      expect(Number.parseFloat(tooltip.style.left) + 220).toBeLessThanOrEqual(650);

      anchor.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
      vi.advanceTimersByTime(60);
      rects.set(anchor, makeRect(220, 220, 480, 130));
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 460, clientY: 280 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.style.top).toBe('350px');
      expect(Number.parseFloat(tooltip.style.top)).toBeGreaterThanOrEqual(350);
      anchor.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 520, clientY: 300 }));
      flushFrames();
      expect(tooltip.style.left).toBe('410px');

      anchor.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }));
      vi.advanceTimersByTime(60);
      rects.set(anchor, makeRect(220, 360, 480, 140));
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 460, clientY: 420 }));
      vi.advanceTimersByTime(80);
      expect(tooltip.style.top).toBe('220px');
    } finally {
      game.stop();
      restoreViewport();
    }
  });

  it('滚动和窗口缩放后重新计算位置，并限制过高内容的浮层高度', () => {
    vi.useFakeTimers();
    const rects = new Map<HTMLElement, DOMRect>();
    const { game, anchors, tooltip, restoreViewport, flushFrames } = setupHover(rects, { width: 300, height: 900 }, { width: 800, height: 600 });
    const anchor = anchors[0];
    rects.set(anchor, makeRect(200, 180, 100, 100));

    try {
      anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 250, clientY: 220 }));
      vi.advanceTimersByTime(80);
      expect(Number.parseFloat(tooltip.style.maxHeight)).toBeLessThanOrEqual(580);
      expect(Number.parseFloat(tooltip.style.top)).toBeGreaterThanOrEqual(10);
      Object.defineProperties(tooltip, {
        scrollHeight: { configurable: true, value: 900 },
        clientHeight: { configurable: true, value: 580 },
        scrollTop: { configurable: true, writable: true, value: 0 },
      });
      const wheel = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: Number.parseFloat(tooltip.style.left) + 20,
        clientY: Number.parseFloat(tooltip.style.top) + 20,
        deltaY: 120,
      });
      anchor.dispatchEvent(wheel);
      expect(wheel.defaultPrevented).toBe(true);
      expect(tooltip.scrollTop).toBe(120);

      rects.set(anchor, makeRect(300, 180, 100, 100));
      window.dispatchEvent(new Event('scroll'));
      flushFrames();
      expect(Number.parseFloat(tooltip.style.left)).toBeGreaterThanOrEqual(400);

      rects.set(anchor, makeRect(200, 180, 100, 100));
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
      window.dispatchEvent(new Event('resize'));
      flushFrames();
      expect(tooltip.style.left).toBe('10px');
      expect(Number.parseFloat(tooltip.style.maxWidth)).toBeLessThanOrEqual(190);
    } finally {
      game.stop();
      restoreViewport();
    }
  });
});
