// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/context';
import { renderHeader } from '../../src/ui/components/header';
import { UIController } from '../../src/ui/controller';

describe('主题浮窗层级优先级', () => {
  it('每个层级项显示主题名、作用区域与无障碍描述', () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    const root = document.createElement('div');
    root.innerHTML = renderHeader(createUIContext(game), { studentVariantId: 'Hoshino' });

    const rows = [...root.querySelectorAll<HTMLElement>('.layer-order-row')];
    expect(rows).toHaveLength(4);
    expect(rows.map(row => row.querySelector('.layer-order-theme-name')?.textContent)).toEqual([
      '未设置',
      '夏莱蓝',
      '局部主题',
      '系统默认',
    ]);
    expect(rows[0].querySelector('.layer-order-region')?.textContent).toBe('学生层 · 当前学生剧情 · 小鸟游星野');
    expect(rows[1].querySelector('.layer-order-region')?.textContent).toMatch(/^场景层 · 当前区域 · /);
    expect(rows[2].querySelector('.layer-order-region')?.textContent).toMatch(/^世界线层 · 当前世界线 · /);
    expect(rows[3].querySelector('.layer-order-region')?.textContent).toBe('玩家层 · 全局界面');
    for (const row of rows) {
      expect(row.getAttribute('aria-label')).toContain('作用区域：');
    }
  });

  it('点击上移/下移按钮改变层级优先级，不依赖拖拽', async () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    const controller = new UIController(game, document.querySelector('#app')!);
    controller.mount();
    controller.startNewGame('base:init:schale_office');

    const scopes = () => [...document.querySelectorAll<HTMLElement>('[data-theme-layer-order-scope]')].map(row => row.dataset.themeLayerOrderScope!);
    expect(scopes()).toEqual(['student', 'area', 'init', 'player']);

    document.querySelector<HTMLButtonElement>('[data-theme-layer-order-scope="student"] [data-theme-layer-order-move="down"]')!.click();

    expect(game.state.themeLayerOrder).toEqual(['player', 'init', 'student', 'area']);

    await new Promise(resolve => setTimeout(resolve, 30));
    expect(scopes()).toEqual(['area', 'student', 'init', 'player']);

    game.stop();
  });

  it('指针拖拽重排层级优先级，且不再依赖 HTML5 DnD', async () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    const controller = new UIController(game, document.querySelector('#app')!);
    controller.mount();
    controller.startNewGame('base:init:schale_office');

    const container = document.querySelector<HTMLElement>('[data-theme-layer-order-rows]')!;
    const rows = [...container.querySelectorAll<HTMLElement>('[data-theme-layer-order-scope]')];
    expect(rows.map(row => row.dataset.themeLayerOrderScope)).toEqual(['student', 'area', 'init', 'player']);
    // 拖拽不再走浏览器原生 DnD：源元素不可再声明 draggable，否则原生拖拽会与指针拖拽打架
    expect(rows.every(row => !row.hasAttribute('draggable'))).toBe(true);

    // happy-dom 不做布局：手动提供每行的垂直区间（每行 20px）
    rows.forEach((row, index) => {
      row.getBoundingClientRect = () => ({
        top: index * 20,
        bottom: index * 20 + 20,
        height: 20,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: index * 20,
        toJSON: () => ({}),
      }) as DOMRect;
    });

    const fire = (type: string, target: Element, clientY: number): void => {
      const event = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
      event.pointerId = 1;
      event.clientX = 10;
      event.clientY = clientY;
      event.button = 0;
      event.pointerType = 'mouse';
      target.dispatchEvent(event);
    };

    // 拖起第 1 行（student）落到第 4 行（player）下半区 → student 降为最低优先级
    fire('pointerdown', rows[0], 10);
    fire('pointermove', container, 75);
    fire('pointerup', container, 75);

    expect(game.state.themeLayerOrder).toEqual(['student', 'player', 'init', 'area']);

    await new Promise(resolve => setTimeout(resolve, 30));
    expect([...document.querySelectorAll<HTMLElement>('[data-theme-layer-order-scope]')]
      .map(row => row.dataset.themeLayerOrderScope)).toEqual(['area', 'init', 'player', 'student']);

    game.stop();
  });

  it('指针未移动时释放不改变层级优先级', async () => {
    const game = new GameInstance();
    game.init([baseDatapack]);
    document.body.innerHTML = '<div id="app"></div>';
    const controller = new UIController(game, document.querySelector('#app')!);
    controller.mount();
    controller.startNewGame('base:init:schale_office');

    const container = document.querySelector<HTMLElement>('[data-theme-layer-order-rows]')!;
    const rows = [...container.querySelectorAll<HTMLElement>('[data-theme-layer-order-scope]')];
    rows.forEach((row, index) => {
      row.getBoundingClientRect = () => ({
        top: index * 20,
        bottom: index * 20 + 20,
        height: 20,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: index * 20,
        toJSON: () => ({}),
      }) as DOMRect;
    });

    const fire = (type: string, target: Element, clientY: number): void => {
      const event = new Event(type, { bubbles: true, cancelable: true }) as Event & Record<string, unknown>;
      event.pointerId = 1;
      event.clientX = 10;
      event.clientY = clientY;
      event.button = 0;
      event.pointerType = 'mouse';
      target.dispatchEvent(event);
    };

    fire('pointerdown', rows[0], 10);
    fire('pointerup', container, 12);

    expect(game.state.themeLayerOrder).toBeUndefined();

    game.stop();
  });
});
