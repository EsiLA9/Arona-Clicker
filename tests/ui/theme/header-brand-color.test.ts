// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { UIController } from '../../../src/ui/controller/controller';
import { toRgba, INK_ON_DARK, INK_ON_LIGHT } from '../../../src/engine/core/color';
import '../../../src/ui/runtime/service-definitions';

describe('header brand background text color', () => {
  let ctrl: UIController | undefined;
  let game: GameInstance | undefined;
  let style: HTMLStyleElement | undefined;
  afterEach(() => { ctrl?.destroy(); game?.stop(); style?.remove(); document.documentElement.removeAttribute('style'); localStorage.clear(); });

  it('follows the final composite background in place, with light text for missing or unknown content', () => {
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>';
    style = document.createElement('style'); style.textContent = readFileSync('src/ui/css/layout.css', 'utf8'); document.head.append(style);
    game = new GameInstance(); game.init([baseDatapack]);
    const root = document.querySelector<HTMLElement>('#app')!;
    ctrl = new UIController(game, root); ctrl.render(); ctrl.storyEditor.open(); ctrl.flushUIUpdates();
    const brand = root.querySelector<HTMLElement>('.brand-lockup')!;
    const title = brand.querySelector('h1')!;
    for (const [background, semantic, expected] of [
      ['#101828', '#ffffff', INK_ON_DARK],
      ['#f8faff', '#101828', INK_ON_LIGHT],
      ['var(--missing-background)', '#ffffff', INK_ON_DARK],
      [undefined, '#ffffff', INK_ON_DARK],
    ] as const) {
      ctrl.storyEditor.state.uiTheme!.selectDefinition({ tokens: { bg: semantic, bgAlt: semantic },
        nodes: { bg: semantic }, systemColorLayerIgnored: true,
        background: background ? [{ kind: 'solid', value: background }] : [] }, '测试主题');
      ctrl.refreshTheme();
      expect(document.documentElement.style.getPropertyValue('--ink-on-canvas')).toBe(expected);
      expect(toRgba(getComputedStyle(brand).color)).toEqual(toRgba(expected));
      expect(toRgba(getComputedStyle(title).color)).toEqual(toRgba(expected));
      expect(root.querySelector('.brand-lockup') === brand).toBe(true);
    }
  });
});
