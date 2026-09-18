// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { PopoverManager } from '../../src/ui/popovers';

describe('PopoverManager 刷新范围', () => {
  afterEach(() => {
    document.body.innerHTML = '';
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
});
