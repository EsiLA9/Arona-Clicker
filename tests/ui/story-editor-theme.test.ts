// @vitest-environment happy-dom
import { createStoryForTest } from './story-editor-test-helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { currentDraft, currentNode } from '../../src/ui/story-editor/model';
import { uiTheme } from '../../src/ui/controller/controller-theme';
import { STORY_EDITOR_STORAGE_KEY } from '../../src/ui/story-editor/persistence';
import { StoryEditorTheme } from '../../src/ui/story-editor/theme';
import { INK_ON_LIGHT, readableOnColor } from '../../src/engine/core/color';
import '../../src/ui/runtime/service-definitions';

describe('Story editor session theme', () => {
  let game: GameInstance;
  let ctrl: UIController;
  let root: HTMLElement;
  const groupId = 'test:colorgroup:editor-locked';
  const find = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const element = root.querySelector<T>(selector); expect(Boolean(element), selector).toBe(true); return element!;
  };
  const click = (action: string): void => { if(action==='new') createStoryForTest(game,ctrl); else find<HTMLButtonElement>(`[data-editor-action="${action}"]`).click(); ctrl.flushUIUpdates(); };
  const open = (): void => {
    ctrl.render(); find<HTMLButtonElement>('#story-editor-launch').click(); ctrl.flushUIUpdates(); click('new');
  };
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>';
    const pack = structuredClone(baseDatapack);
    pack.colorGroups = [...(pack.colorGroups ?? []), { id: groupId, name: '未解锁测试色组', compositionType: 'solid', slots: [{ role: 'primary', color: '#234567' }] }];
    pack.areas[0].theme = { tokens: { primary: '#256789' }, background: [{ kind: 'solid', value: '#102030' }],
      presentation: { hosts: [{ id: 'header.button', states: { active: { layers: [{ kind: 'solid', value: '#334455' }] } } }] } };
    pack.characterVariants![0].theme = { tokens: { primary: '#b72f81' } };
    game = new GameInstance(); game.init([pack]);
    root = document.querySelector('#app')!; ctrl = new UIController(game, root);
  });
  afterEach(() => { ctrl.modal.close(); ctrl.destroy(); game.stop(); vi.restoreAllMocks(); localStorage.clear(); document.documentElement.removeAttribute('style'); });

  it.each(['init', 'global-enh'] as const)('inherits the focused %s star-map theme, including background variants, without changing gameplay', kind => {
    const entity = kind === 'init' ? game.registry.inits.get('base:init:millennium')! : game.registry.enhancements.get('base:enhancement:foundation')!;
    entity.theme = { tokens: { primary: '#abc123', bg: '#f0f3f8', bgAlt: '#e0e6ef' },
      nodes: { panel: '#fafafa' }, systemColorLayerIgnored: true,
      background: [{ id: 'editor-star', kind: 'solid', value: '#fedcba' }],
      backgroundVariants: ['new', 'active', 'advanced', 'available', 'locked'].map(id => ({ id, layers: [{ id: 'editor-star', kind: 'solid' as const, value: '#fefefe' }] })),
      presentation: { hosts: [{ id: 'header.button', layers: [{ kind: 'solid', value: '#abcdef' }] }] } };
    ctrl.render();
    ctrl.selectorPage.select({ kind, entityId: entity.id }, { animate: false });
    const runtime = structuredClone(game.colorSystem.runtimeTheme());
    expect(find('.selector-shell').style.getPropertyValue('--ac-primary')).toBe('#abc123');
    find<HTMLButtonElement>('#story-editor-launch').click(); ctrl.flushUIUpdates();
    expect(uiTheme(ctrl).tokens.primary).toBe('#abc123');
    expect(uiTheme(ctrl).background.find(layer => layer.id === 'editor-star')?.value).toBe('#fefefe');
    expect(uiTheme(ctrl).nodeOverrides.panel).toBe('#fafafa');
    expect(uiTheme(ctrl).systemColorLayerIgnored).toBe(true);
    expect(uiTheme(ctrl).presentation.hosts?.some(host => host.id === 'header.button')).toBe(true);
    expect(game.colorSystem.runtimeTheme()).toEqual(runtime);
    find<HTMLButtonElement>('.story-editor-left [data-column-back]').click(); ctrl.flushUIUpdates();
    entity.theme.tokens!.primary = '#cba321'; ctrl.render();
    ctrl.selectorPage.select({ kind, entityId: entity.id }, { animate: false });
    find<HTMLButtonElement>('#story-editor-launch').click(); ctrl.flushUIUpdates();
    expect(uiTheme(ctrl).tokens.primary).toBe('#cba321');
  });

  it('uses a light default background when no opening theme is supplied', () => {
    const theme = new StoryEditorTheme(game).resolve();
    expect(readableOnColor(theme.tokens.bg)).toBe(INK_ON_LIGHT);
    expect(readableOnColor(theme.tokens.bgAlt)).toBe(INK_ON_LIGHT);
  });

  it('selects locked groups from the topbar without changing game state or rebuilding the workspace', () => {
    open();
    expect(game.colorSystem.isGroupOwned(game.state, groupId)).toBe(false);
    const initial = structuredClone(game.colorSystem.runtimeTheme());
    const activeTheme = structuredClone(game.state.activeTheme);
    const frame = find('[data-workspace-frame="story-editor"]');
    const input = find<HTMLTextAreaElement>('[data-editor-composer-text]');
    input.value = '未发送'; input.dispatchEvent(new Event('input', { bubbles: true })); ctrl.flushUIUpdates(); input.focus();
    const body = find('.story-editor-center .workspace-column__body'); body.scrollTop = 84;
    const full = vi.spyOn(ctrl, 'render');
    const activate = vi.spyOn(ctrl.commands, 'activateTheme');
    const button = find<HTMLButtonElement>('#theme-palette-btn'); button.click();
    const swatch = find<HTMLButtonElement>(`[data-activate-group="${groupId}"]`); swatch.click(); ctrl.flushUIUpdates();
    expect(document.documentElement.style.getPropertyValue('--ac-primary')).toBe('#234567');
    expect(swatch.getAttribute('aria-pressed')).toBe('true');
    expect(button.classList.contains('is-active')).toBe(true);
    expect(find('[data-theme-float]').classList.contains('open')).toBe(true);
    expect(find('[data-workspace-frame="story-editor"]') === frame).toBe(true);
    expect(find('[data-editor-composer-text]') === input).toBe(true);
    expect(input.value).toBe('未发送'); expect(document.activeElement === input).toBe(true);
    expect(body.scrollTop).toBe(84); expect(full).not.toHaveBeenCalled(); expect(activate).not.toHaveBeenCalled();
    expect(game.colorSystem.runtimeTheme()).toEqual(initial); expect(game.state.activeTheme).toEqual(activeTheme);
    find<HTMLButtonElement>('.story-editor-left [data-column-back]').click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.isOpen()).toBe(false); expect(game.colorSystem.runtimeTheme()).toEqual(initial);
    find<HTMLButtonElement>('#story-editor-launch').click(); ctrl.flushUIUpdates();
    expect(uiTheme(ctrl).tokens.primary).toBe('#234567');
  });

  it.each(['area', 'chara', 'start'] as const)('applies the %s scene theme on double click while single click only selects properties', kind => {
    open(); click(kind === 'chara' ? 'moveToCharaspace' : 'moveToArea');
    const state = ctrl.storyEditor.state; const draft = currentDraft(state)!; const node = currentNode(state)!;
    const area = [...game.registry.areas.values()][0]; const variant = [...game.registry.characterVariants.values()][0];
    draft.document.startContext = { type: 'area', areaId: area.id };
    draft.document.nodes = [kind === 'chara' ? { id: node.id, type: 'moveToCharaspace', characterId: variant.id } : { id: node.id, type: 'moveToArea', areaId: area.id }];
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();
    const before = structuredClone(draft.document); const gameplayTheme = structuredClone(game.colorSystem.runtimeTheme());
    const gameplayArea = game.state.currentAreaId; const story = game.storyService.getCurrentStoryId();
    const card = find<HTMLElement>(kind === 'start' ? '[data-editor-start-context]' : '[data-editor-node] .story-editor-scene-card');
    const full = vi.spyOn(ctrl, 'render');
    card.click(); ctrl.flushUIUpdates(); expect(state.uiTheme?.selection).toBe('initial');
    card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); ctrl.flushUIUpdates();
    expect(uiTheme(ctrl).tokens.primary).toBe(kind === 'chara' ? '#b72f81' : '#256789');
    expect(currentNode(state)?.id).toBe(kind === 'start' ? undefined : node.id);
    expect(draft.document).toEqual(before); expect(game.colorSystem.runtimeTheme()).toEqual(gameplayTheme);
    expect(game.state.currentAreaId).toBe(gameplayArea); expect(game.storyService.getCurrentStoryId()).toBe(story);
    if (kind !== 'chara') {
      expect(uiTheme(ctrl).background.some(layer => layer.value === '#102030')).toBe(true);
      find<HTMLButtonElement>('#theme-palette-btn').click();
      expect(find('#theme-palette-btn > .presentation-host-background').innerHTML).toContain('#334455');
    }
    expect(full).not.toHaveBeenCalled();
  });

  it('edits a local custom theme without capability, supports cancel, and never stores it in game or Story data', () => {
    open();
    expect(game.userThemeService.capability().active).toBe(false);
    const frame = find('[data-workspace-frame="story-editor"]'); const gameplay = structuredClone(game.colorSystem.runtimeTheme());
    const openingTheme = structuredClone(uiTheme(ctrl));
    const userTheme = structuredClone(game.state.userTheme); const customThemes = structuredClone(game.state.customThemes);
    const edit = (): HTMLInputElement => {
      find<HTMLButtonElement>('[data-open-user-theme]').click();
      const field = document.querySelector<HTMLInputElement>('.app-modal [data-user-theme-token="primary"]')!;
      expect(field.disabled).toBe(false); field.value = '#1a2b3c'; field.dispatchEvent(new Event('input', { bubbles: true }));
      return field;
    };
    edit(); expect(uiTheme(ctrl).tokens.primary).toBe('#1a2b3c');
    ctrl.modal.close(); expect(uiTheme(ctrl)).toEqual(openingTheme);
    edit(); document.querySelector<HTMLButtonElement>('.app-modal [data-user-theme-save]')!.click();
    expect(document.querySelector('.app-modal')?.childElementCount).toBe(0); expect(uiTheme(ctrl).tokens.primary).toBe('#1a2b3c');
    expect(find<HTMLButtonElement>('[data-activate-custom-theme]').disabled).toBe(false);
    expect(find('[data-workspace-frame="story-editor"]') === frame).toBe(true);
    click('save');
    expect(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)).not.toContain('uiTheme');
    expect(game.state.userTheme).toEqual(userTheme); expect(game.state.customThemes).toEqual(customThemes);
    expect(game.colorSystem.runtimeTheme()).toEqual(gameplay);
    expect(ctrl.storyEditor.state.uiTheme!.apply({ version: 1, tokens: { primary: '<invalid>' } }).length).toBeGreaterThan(0);
    expect(uiTheme(ctrl).tokens.primary).toBe('#1a2b3c');
    const field = edit();
    ctrl.navigateToService('settings'); ctrl.render();
    field.value = '#876543'; field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(game.colorSystem.runtimeTheme()).toEqual(gameplay);
    ctrl.modal.close();
  });
});
