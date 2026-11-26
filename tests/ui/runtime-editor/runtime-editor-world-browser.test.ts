// @vitest-environment happy-dom
import { setImmediate } from 'node:timers/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { uiTheme } from '../../../src/ui/controller/controller-theme';
import { UIController } from '../../../src/ui/controller/controller';
import { buildDefaultWorldTree, worldTreePath } from '../../../src/ui/runtime-editor/world-browser';
import '../../../src/ui/runtime/service-definitions';

let game: GameInstance;
let ctrl: UIController;
let root: HTMLElement;
const click = (selector: string): void => {
  const button = root.querySelector<HTMLButtonElement>(selector);
  expect(button, selector).not.toBeNull();
  button!.click();
  ctrl.flushUIUpdates();
};
const rail = (type: string): string => '[data-editor-work-type="' + type + '"]';

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  root = document.querySelector('#app')!;
  game = new GameInstance();
  game.init([baseDatapack]);
  ctrl = new UIController(game, root);
});
afterEach(async () => {
  vi.restoreAllMocks();
  ctrl.destroy();
  game.dispose();
  localStorage.clear();
  await setImmediate();
});

it('projects default and non-default children and retains definitions with missing parents', () => {
  const init = [...game.registry.inits.values()][0];
  const area = [...game.registry.areas.values()][0];
  const spot = [...game.registry.spots.values()][0];
  const areas = new Map([
    ['a', { ...area, id: 'a', name: '同名', initId: init.id, defaultSpots: ['one'] }],
    ['b', { ...area, id: 'b', name: '同名', initId: init.id, defaultSpots: [] }],
  ]);
  const spots = new Map([
    ['one', { ...spot, id: 'one', areaId: 'a' }],
    ['two', { ...spot, id: 'two', areaId: 'a' }],
    ['orphan', { ...spot, id: 'orphan', areaId: 'missing' }],
  ]);
  const tree = buildDefaultWorldTree({ inits: new Map([[init.id, { ...init, defaultAreas: ['a'] }]]), areas, spots });
  const path = (id: string) => worldTreePath(tree, { kind: 'spot', id });
  expect(tree[0].children.map(node => [node.label, node.ref?.id, node.isDefault]))
    .toEqual([['同名', 'a', true], ['同名', 'b', false]]);
  expect(path('one').map(node => node.ref?.kind)).toEqual(['init', 'area', 'spot']);
  expect(path('one')[2].isDefault).toBe(true);
  expect(path('two')[2].isDefault).toBe(false);
  expect(path('orphan')[0].key).toBe('missing-parent');
  const alias = { ...path('one')[2], key: 'alias' };
  expect(worldTreePath([...tree, alias], { kind: 'spot', id: 'one' }, 'alias')).toEqual([alias]);
});

it('opens from the lobby, follows links in one instance, switches via the rail and returns to the lobby', () => {
  ctrl.render();
  click('.save-actions.service-nav-actions #world-editor-launch');
  const session = ctrl.panelState.worldBrowser!;
  const tree = root.querySelector('[data-world-tree]');
  const area = root.querySelector<HTMLButtonElement>('[data-world-detail] [data-world-select="area"]');
  expect(area).not.toBeNull();
  click('[data-world-detail] [data-world-select="area"]');
  click('[data-world-detail] [data-world-select="spot"]');
  expect(root.querySelector('[data-world-tree]')).toBe(tree);
  expect(session.selected?.kind).toBe('spot');
  const spot = session.selected;
  click('[data-world-detail] [data-world-select="area"]');
  expect(session.selected).toEqual({ kind: 'area', id: area!.dataset.worldId });
  click('[data-world-detail] [data-world-select="spot"]');
  expect(session.selected).toEqual(spot);
  click('#world-editor-launch');
  expect(ctrl.panelState.worldBrowser).toBe(session);
  click('[data-editor-workspace-action="mode"]');
  expect(root.querySelectorAll('[data-editor-workspace-action="activate"]')).toHaveLength(1);
  const body = root.querySelector('[data-world-tree]')!.closest<HTMLElement>('[data-scroll-key]')!;
  body.scrollTop = 73;
  click(rail('story'));
  expect(ctrl.storyEditor.isOpen()).toBe(true);
  click(rail('world'));
  expect(ctrl.panelState.worldBrowser).toBe(session);
  expect(session.selected).toEqual(spot);
  expect(root.querySelector('[data-world-tree]')!.closest<HTMLElement>('[data-scroll-key]')!.scrollTop).toBe(73);
  click('[data-editor-workspace-action="close"]');
  expect(ctrl.panelState.worldBrowser).toBeUndefined();
  expect(root.querySelector('.selector-shell')).not.toBeNull();
});

it('does not allocate a world instance if the Story save gate fails', () => {
  ctrl.render();
  click('#story-editor-launch');
  click('[data-editor-workspace-action="mode"]');
  const gate = vi.spyOn(ctrl.storyEditor, 'beforeLeave').mockReturnValue(false);
  click(rail('world'));
  expect(ctrl.storyEditor.isOpen()).toBe(true);
  expect(ctrl.panelState.worldBrowser).toBeUndefined();
  gate.mockRestore();
  click(rail('world'));
  expect(ctrl.panelState.worldBrowser?.id).toBe(1);
});

it('retains the original settings return route and the active Story document across rail switches', () => {
  ctrl.navigateToService('settings');
  ctrl.render();
  click('#story-editor-launch');
  const story = [...game.registry.stories.keys()][0];
  const target = [...root.querySelectorAll<HTMLButtonElement>('[data-editor-story]')]
    .find(button => button.dataset.editorStory === story) ?? root.querySelector<HTMLButtonElement>('[data-editor-story]');
  expect(target).not.toBeNull();
  target!.click();
  ctrl.flushUIUpdates();
  const selected = ctrl.storyEditor.state.target;
  expect(selected?.kind).toBe('story');
  click('[data-editor-workspace-action="mode"]');
  click(rail('world'));
  const world = ctrl.panelState.worldBrowser;
  click(rail('story'));
  expect(ctrl.storyEditor.state.target).toEqual(selected);
  click(rail('world'));
  expect(ctrl.panelState.worldBrowser).toBe(world);
  click('[data-editor-workspace-action="close"]');
  expect(ctrl.panelState.workspaceNavigation?.current).toEqual({ kind: 'service', page: 'settings' });
});

it('can close from classic mode and creates a new instance only after explicit close', () => {
  ctrl.render();
  click('#world-editor-launch');
  const first = ctrl.panelState.worldBrowser?.id;
  click('[aria-label="关闭世界编辑器"]');
  expect(root.querySelector('.selector-shell')).not.toBeNull();
  click('#world-editor-launch');
  expect(ctrl.panelState.worldBrowser?.id).not.toBe(first);
});

it('supports three columns and folds the existing world tree in place', () => {
  ctrl.render();
  click('#world-editor-launch');
  click('[data-editor-workspace-action="mode"]');
  const session = ctrl.panelState.worldBrowser!;
  const select = () => root.querySelector<HTMLSelectElement>('[data-editor-workspace-view-select]')!;
  expect([...select().options].map(option => option.value)).toEqual(['three', 'browse', 'focus']);
  expect([...root.querySelectorAll<HTMLElement>('[data-editor-workspace-edge]')].map(handle => handle.dataset.editorWorkspaceEdge)).toEqual(['left', 'right']);
  const frame = root.querySelector<HTMLElement>('[data-workspace-frame="world-editor"]')!;
  expect(frame.style.gridTemplateColumns).toBe('var(--editor-track-left, 300px) var(--editor-track-center, var(--workspace-center-width)) var(--editor-track-right, var(--workspace-right-width))');
  const right = frame.querySelector('.workspace-column--right');
  expect(right?.textContent).toContain('便捷信息');
  const tree = frame.querySelector('[data-world-tree]')!;
  const body = tree.closest<HTMLElement>('[data-scroll-key]')!;
  body.scrollTop = 72;
  for (const value of ['focus', 'three', 'browse']) {
    select().value = value;
    select().dispatchEvent(new Event('change', { bubbles: true }));
    expect(root.querySelector('[data-editor-workspace]')?.getAttribute('data-editor-workspace-view')).toBe(value);
    expect(root.querySelector('[data-world-tree]')).toBe(tree);
  }
  expect(body.scrollTop).toBe(72);
  click(rail('story'));
  session.view = 'three';
  click(rail('world'));
  expect(session.view).toBe('three');
  expect(select().value).toBe('three');
  click('[data-editor-workspace-action="locate-world"]');
  expect(select().value).toBe('three');
});

it('shares a theme across editors while storing ribbon preferences by work type', () => {
  ctrl.render();
  click('#story-editor-launch');
  click('[data-editor-workspace-action="mode"]');
  const story = ctrl.activeEditorTheme()!;
  story.applyEditorTheme({ kind: 'scene', label: 'Story', theme: { tokens: { primary: '#192abc' } } });
  const ribbon = () => root.querySelector<HTMLElement>('[data-editor-workspace-header]')!;
  const grip = root.querySelector('[data-editor-workspace-ribbon-grip]')!;
  grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  expect(ribbon().dataset.editorWorkspaceRibbon).toBe('compact');
  click(rail('world'));
  const world = ctrl.activeEditorTheme()!;
  expect(world).toBe(story);
  expect(ribbon().dataset.editorWorkspaceRibbon).toBe('expanded');
  const worldInitial = world.resolve();
  click('[data-world-detail] [data-world-select="area"]');
  click('[data-world-detail] [data-world-select="spot"]');
  ctrl.refreshTheme();
  expect(world.resolve()).toBe(worldInitial);
  click(rail('story'));
  expect(ctrl.activeEditorTheme()?.resolve().tokens.primary).toBe('#192abc');
  expect(ribbon().dataset.editorWorkspaceRibbon).toBe('compact');
  click(rail('world'));
  expect(ctrl.activeEditorTheme()?.resolve()).toBe(worldInitial);
  expect(ribbon().dataset.editorWorkspaceRibbon).toBe('expanded');
});

it('resamples the current game theme only after leaving the shared editor session', () => {
  ctrl.started = true;
  const original = game.colorSystem.runtimeTheme();
  let primary = '#334455';
  vi.spyOn(game.colorSystem, 'runtimeTheme').mockImplementation(() => ({ ...original, tokens: { ...original.tokens, primary } }));
  ctrl.render();
  click('#world-editor-launch');
  const sessionTheme = ctrl.activeEditorTheme();
  expect(sessionTheme?.resolve().tokens.primary).toBe(primary);
  click('[data-editor-workspace-action="mode"]');
  expect(sessionTheme?.applyEditorTheme({ kind: 'scene', label: '编辑器', theme: { tokens: { primary: '#996633' } } })).toBe(true);
  primary = '#556677';
  click(rail('story'));
  expect(ctrl.activeEditorTheme()).toBe(sessionTheme);
  expect(uiTheme(ctrl).tokens.primary).toBe('#996633');
  click('[data-editor-workspace-action="back"]');
  expect(ctrl.activeEditorTheme()).toBeUndefined();
  expect(uiTheme(ctrl).tokens.primary).toBe(primary);
  click('#world-editor-launch');
  expect(ctrl.activeEditorTheme()).not.toBe(sessionTheme);
  expect(uiTheme(ctrl).tokens.primary).toBe(primary);
});

it('restores the inherited service theme after closing the editor', () => {
  ctrl.render();
  ctrl.navigateToService('settings');
  const base = game.colorSystem.runtimeTheme();
  ctrl.serviceThemeOverride = { ...base, tokens: { ...base.tokens, primary: '#302070' } };
  ctrl.render();
  click('#world-editor-launch');
  expect(uiTheme(ctrl).tokens.primary).toBe('#302070');
  click('[data-world-editor-leave]');
  expect(ctrl.activeEditorTheme()).toBeUndefined();
  expect(ctrl.workspaceLocation().route).toEqual({ kind: 'service', page: 'settings' });
  expect(uiTheme(ctrl).tokens.primary).toBe('#302070');
});
