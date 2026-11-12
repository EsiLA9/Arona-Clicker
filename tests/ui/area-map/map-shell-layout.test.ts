// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { createUIContext } from '../../../src/ui/runtime/context';
import { renderWorkspace } from '../../../src/ui/workspace/workspace-renderer';
import type { PanelState } from '../../../src/ui/components/shared/app-shell';

afterEach(() => {
  document.querySelector('[data-map-shell-test-style]')?.remove();
  document.body.innerHTML = '';
});

it('MapEntry 使用共享页面间距、分离标题/正文/固定动作并保留两处滚动区', () => {
  const style = document.createElement('style');
  style.dataset.mapShellTestStyle = '';
  style.textContent = readFileSync('src/ui/css/layout.css', 'utf8')
    + '\n' + readFileSync('src/ui/css/map-entry-workspace.css', 'utf8');
  document.head.append(style);
  const game = new GameInstance();
  game.init([baseDatapack]);
  try {
    const state: PanelState = {
      service: 'game', leftTab: 'area', centerTab: 'chat', rightTab: 'spot',
      chatEntries: [], chatTexts: [], selectedVariantId: null, conversationVariantId: null,
      studentChats: {}, studentChatTexts: {}, storyNavPath: [],
    };
    document.body.innerHTML = renderWorkspace(createUIContext(game), { kind: 'map-entry', mapId: 'unavailable-map' }, state);
    const shell = document.querySelector('.map-entry-workspace')!;
    expect(getComputedStyle(shell).flexGrow).toBe('1');
    expect(getComputedStyle(shell).minHeight).toBe('0');
    expect(['', '0px']).toContain(getComputedStyle(shell).marginTop);
    expect(getComputedStyle(document.querySelector('.workspace-page-content')!).paddingTop).toBe('16px');
    const frame = shell.querySelector('.workspace-frame')!;
    expect(['', '0px']).toContain(getComputedStyle(frame).marginTop);
    for (const name of ['center', 'right']) {
      const column = shell.querySelector(`.map-entry-workspace__${name}`)!;
      expect(column.querySelector('.workspace-column__header .panel-tabs-region')).not.toBeNull();
      const body = column.querySelector('.workspace-column__body')!;
      expect(body.querySelector('.workspace-column__header')).toBeNull();
      expect(getComputedStyle(body).minHeight).toBe('0');
    }
    expect(getComputedStyle(shell.querySelector('.map-entry-workspace__overview-scroll')!).overflow).toBe('auto');
    expect(getComputedStyle(shell.querySelector('.map-entry-workspace__party-scroll')!).overflow).toBe('auto');
    expect(getComputedStyle(shell.querySelector('.map-entry-workspace__actions')!).flexShrink).toBe('0');
    expect(shell.querySelector('[data-map-region-key="primary-action"]')?.closest('.workspace-column__footer')).not.toBeNull();
    expect(shell.querySelector('[data-map-region-key="resources"][data-scroll-owner="content-region"][data-scroll-key="resources"]')).not.toBeNull();
  } finally {
    game.stop();
  }
});

it('MapRun 外壳保留普通工作区的顶栏分隔、间距，并仅占用剩余高度', () => {
  const style = document.createElement('style');
  style.dataset.mapShellTestStyle = '';
  style.textContent = readFileSync('src/ui/css/layout.css', 'utf8')
    + '\n' + readFileSync('src/ui/css/map-workspace.css', 'utf8');
  document.head.append(style);
  const game = new GameInstance();
  game.init([baseDatapack]);
  try {
    const ctx = createUIContext(game);
    const state: PanelState = {
      service: 'game', leftTab: 'area', centerTab: 'chat', rightTab: 'spot',
      chatEntries: [], chatTexts: [], selectedVariantId: null, conversationVariantId: null,
      studentChats: {}, studentChatTexts: {}, storyNavPath: [],
    };
    document.body.innerHTML = renderWorkspace(ctx, { kind: 'game' }, state);
    const ordinaryGap = getComputedStyle(document.querySelector('.workspace-page-content')!).paddingTop;
    const ordinaryBorder = getComputedStyle(document.querySelector('.topbar')!).borderBottom;
    document.body.innerHTML = renderWorkspace(ctx, { kind: 'map', runId: 'unavailable-run' }, state);
    const region = getComputedStyle(document.querySelector('.map-workspace__region')!);
    const topbar = getComputedStyle(document.querySelector('.topbar')!);
    expect(ordinaryGap).toBe('16px');
    expect(ordinaryGap).toBe('16px');
    expect(['', '0px']).toContain(region.marginTop);
    expect(topbar.borderBottom).toBe(ordinaryBorder);
    expect(topbar.borderBottomWidth).toBe('1px');
    expect(topbar.flexShrink).toBe('0');
    expect(region.flexGrow).toBe('1');
    expect(region.flexBasis).toBe('0px');
    expect(region.height).toBe('auto');
    expect(['', '0px']).toContain(getComputedStyle(document.querySelector('.workspace-frame--map')!).marginTop);
  } finally {
    game.stop();
  }
});
