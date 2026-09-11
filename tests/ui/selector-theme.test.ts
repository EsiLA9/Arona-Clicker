// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { createUIContext } from '../../src/ui/context';
import {
  mergeSelectorBackgrounds,
  projectSelectorTheme,
  selectorFallbackPrimary,
} from '../../src/ui/selector-theme';
import { renderSelectorPage } from '../../src/ui/components/selector-page';

const OFFICE = 'base:init:schale_office';
const MILLENNIUM = 'base:init:millennium';
const FOUNDATION = 'base:enhancement:foundation';
const LOGISTICS = 'base:enhancement:unified_logistics';
const PYROXENE = 'base:resource:pyroxene';
const CREDIT = 'base:resource:credit';

describe('选择页动态主题投影', () => {
  const games: GameInstance[] = [];

  afterEach(() => {
    for (const game of games) game.stop();
    games.length = 0;
  });

  function freshGame(): GameInstance {
    const game = new GameInstance();
    game.init([baseDatapack]);
    games.push(game);
    return game;
  }

  it('Init 声明主题与背景状态变体进入选择页投影', () => {
    const game = freshGame();
    game.mutations.changeResource(PYROXENE, 100);
    game.inits.unlockInit(MILLENNIUM);
    game.inits.startNewGame(MILLENNIUM);
    game.tick();
    game.inits.restartInit();

    const projection = projectSelectorTheme(createUIContext(game), 'init', MILLENNIUM);

    expect(projection.context.activeInitId).toBe(MILLENNIUM);
    expect(projection.context.currentAreaId).toBe('base:area:millennium_lab');
    expect(projection.context.variantId).toBe('advanced');
    // 返回场景会把当前 Area 的 indigo 主题叠加到 Init 主题之上；背景变体仍来自 Init。
    expect(projection.tree['--theme-node-primary']).toBe('#6366f1');
    expect(projection.background.layers.some(layer => layer.id === 'init-atmosphere')).toBe(true);
    expect(projection.background.layers.find(layer => layer.id === 'init-atmosphere')?.value).toContain('#4f46e5');
  });

  it('无声明主题的 GlobalEnh 条目使用稳定且彼此可区分的回退主色', () => {
    const game = freshGame();
    const context = createUIContext(game);
    const first = projectSelectorTheme(context, 'global-enh', FOUNDATION);
    const second = projectSelectorTheme(context, 'global-enh', LOGISTICS);

    expect(selectorFallbackPrimary('global-enh', FOUNDATION)).toBe(selectorFallbackPrimary('global-enh', FOUNDATION));
    expect(first.tree['--theme-node-primary']).not.toBe(second.tree['--theme-node-primary']);
    expect(['locked', 'available', 'active']).toContain(first.context.variantId);
    expect(first.background.layers.length).toBeGreaterThan(0);
  });

  it('同 id 背景层由后一个投影替换，匿名层保持追加', () => {
    const merged = mergeSelectorBackgrounds(
      { layers: [{ id: 'atmosphere', kind: 'solid', value: '#111', opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }, { kind: 'solid', value: '#base', opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }] },
      { layers: [{ id: 'atmosphere', kind: 'solid', value: '#222', opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }, { kind: 'solid', value: '#overlay', opacity: 1, position: 'center', size: 'cover', repeat: 'no-repeat', blendMode: 'normal', attachment: 'fixed' }] },
    );

    expect(merged.layers.map(layer => layer.value)).toEqual(['#222', '#base', '#overlay']);
  });

  it('整页渲染包含当前/下一背景槽，并以聚焦 Init 作为初始主题', () => {
    const game = freshGame();
    game.inits.startNewGame(OFFICE);
    game.mutations.changeResource(CREDIT, 5000);
    game.inits.unlockInit(MILLENNIUM);
    const html = renderSelectorPage(createUIContext(game), 'new', MILLENNIUM, null, false, 'init');

    expect(html).toContain('selector-scene-background-stack');
    expect(html).toContain('data-selector-scene-slot="current"');
    expect(html).toContain('data-selector-scene-slot="next"');
    expect(html).toContain(`data-selector-theme-key="init:${MILLENNIUM}`);
    expect(html).toContain('--theme-node-primary');

    const parsed = document.createElement('div');
    parsed.innerHTML = html;
    expect(parsed.querySelector('.selector-super-background > .selector-scene-background-stack')).not.toBeNull();
    expect(parsed.querySelector('.selector-viewport > .selector-scene-background-stack')).toBeNull();
    expect(parsed.querySelector('.selector-super-background')?.getAttribute('data-selector-super-background')).toBe('true');
    expect(parsed.querySelector('.selector-disc > .selector-scene-background-stack')).toBeNull();
  });

  it('选择页顶栏操作复用 header.button，并消费聚焦主题的按钮背景', () => {
    const game = freshGame();
    game.mutations.changeResource(PYROXENE, 100);
    game.inits.unlockInit(MILLENNIUM);
    const html = renderSelectorPage(createUIContext(game), 'new', MILLENNIUM, null, true, 'init');

    const parsed = document.createElement('div');
    parsed.innerHTML = html;
    const topbar = parsed.querySelector<HTMLElement>('.selector-topbar');
    expect(topbar?.dataset.selectorHeaderThemeKey).toContain(`init:${MILLENNIUM}`);

    const buttons = [
      topbar?.querySelector<HTMLButtonElement>('[data-flip-selection-face]'),
      topbar?.querySelector<HTMLButtonElement>('#theme-palette-btn'),
      topbar?.querySelector<HTMLButtonElement>('[data-service="game"]'),
      topbar?.querySelector<HTMLButtonElement>('[data-topbar-action="inventory"]'),
      topbar?.querySelector<HTMLButtonElement>('[data-service="settings"]'),
      topbar?.querySelector<HTMLButtonElement>('[data-back-to-game]'),
    ];
    expect(buttons.every(button => button?.dataset.themeHostId === 'header.button')).toBe(true);
    expect(buttons.every(button => Boolean(button?.querySelector(':scope > .presentation-host-background')))).toBe(true);
    expect(topbar?.querySelector<HTMLButtonElement>('[data-flip-selection-face] > .presentation-host-background')?.innerHTML).toContain('#4f46e5');
  });
});
