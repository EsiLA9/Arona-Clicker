// @vitest-environment happy-dom
import { setImmediate } from 'node:timers/promises';
import { createStoryForTest } from './story-editor-test-helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../../src/data/test-datapack';
import { characterStoryDirectoryId } from '../../../src/data-services/contracts/story-directory';
import { UIController } from '../../../src/ui/controller/controller';
import { appendNode, composer, currentDraft, currentNode } from '../../../src/ui/story-editor/model';
import { editProperty } from '../../../src/ui/story-editor/property-model';
import { STORY_EDITOR_STORAGE_KEY } from '../../../src/ui/story-editor/persistence';
import { createUIContext } from '../../../src/ui/runtime/context';
import { storySenders } from '../../../src/ui/story-editor/view';
import { UI_HOST_REGISTRY } from '../../../src/ui/runtime/ui-host-registry';
import { renderChatEntry } from '../../../src/ui/components/story/story';
import { LocalStorageAdapter } from '../../../src/data-services/persistence/storage-adapter';
import '../../../src/ui/runtime/service-definitions';

describe('Story Editor workspace prototype', () => {
  let game: GameInstance;
  let ctrl: UIController;
  let root: HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const node = root.querySelector<T>(selector);
    expect(node, selector).not.toBeNull();
    return node!;
  };
  const click = (action: string): void => {
    if(action==='new') createStoryForTest(game,ctrl); else find<HTMLButtonElement>(`[data-editor-action="${action}"]`).click(); ctrl.flushUIUpdates();
    if (action === 'new') {
      const draft = currentDraft(ctrl.storyEditor.state);
      if (draft && !draft.document.startContext) {
        draft.document = { ...draft.document, startContext: { type: 'area', areaId: game.registry.areas.keys().next().value ?? '' } };
        draft.dirty = true; ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();
      }
    }
  };
  const input = (selector: string, value: string): void => {
    const field = find<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    ctrl.flushUIUpdates();
  };
  const open = (): void => { ctrl.render(); find<HTMLButtonElement>('#story-editor-launch').click(); ctrl.flushUIUpdates(); };
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
    ctrl.modal.close();
    ctrl.destroy();
    game.dispose();
    localStorage.clear();
    // Happy DOM's query WeakRefs can keep detached trees alive until the next turn.
    await setImmediate();
  });

  it('switches both columns together and shares Story/Entry history without losing Story work', () => {
    open(); click('new'); click('click');
    const state = ctrl.storyEditor.state;
    const first = currentDraft(state)!;
    const node = currentNode(state)!;
    editProperty(first,node.id,['performance'],{layout:{mode:'positioned',x:.5,y:.5,align:'center'}});
    ctrl.storyEditor.requestRefresh();ctrl.flushUIUpdates();
    find<HTMLButtonElement>(`[data-story-performance-toggle="${node.id}"]`).click();ctrl.flushUIUpdates();
    expect(root.querySelector(`[data-story-overlay-node="${node.id}"]`)).not.toBeNull();
    input('[data-editor-composer-text]', '待发送正文');
    const frame = find('[data-workspace-frame="story-editor"]');
    const center = find('.story-editor-center .workspace-column__body');
    const right = find('.story-editor-right .workspace-column__body');
    const stories = find('[data-editor-key="sidebar-stories"]');
    center.scrollTop = 128; right.scrollTop = 64;
    const render = vi.spyOn(ctrl, 'render');
    find<HTMLButtonElement>('[data-column-action="story-editor-sidebar:entries"]').click(); ctrl.flushUIUpdates();
    expect(stories.hidden).toBe(false);
    expect(stories.querySelector('[data-editor-story]')).toBeNull();
    expect(currentDraft(state)).toBe(first);
    expect(find('[data-editor-composer-text]')).toBeTruthy();
    const entry = [...game.registry.activeStories.values()][0];
    find<HTMLButtonElement>(`[data-editor-entry="${entry.id}"]`).click(); ctrl.flushUIUpdates();
    expect(state.target).toEqual({ kind: 'entry', id: entry.id });
    expect(currentDraft(state)).toBeUndefined();
    expect(root.querySelector('[data-story-overlay-canvas]')).toBeNull();
    expect(root.querySelector('[data-editor-composer-text]')).toBeNull();
    expect(root.querySelector('[data-editor-field="name"]')).toBeNull();
    expect(find('.story-editor-center [data-editor-entry-page]').dataset.editorEntryPage).toBe(entry.id);
    expect(find('.story-editor-right [data-editor-entry-page]').dataset.editorEntryPage).toBe(entry.id);
    expect(find(`[data-editor-entry="${entry.id}"]`).getAttribute('aria-pressed')).toBe('true');
    center.scrollTop = 31; right.scrollTop = 17;
    find<HTMLButtonElement>('[data-column-action="story-editor-sidebar:stories"]').click(); ctrl.flushUIUpdates();
    expect(state.target).toEqual({ kind: 'entry', id: entry.id });
    const second = [...game.registry.stories.values()][0];
    find<HTMLButtonElement>(`[data-editor-story="source:${second.id}"]`).click(); ctrl.flushUIUpdates();
    expect(currentDraft(state)?.document.id).toBe(second.id);
    click('history-back');
    expect(state.target).toEqual({ kind: 'entry', id: entry.id });
    expect(center.scrollTop).toBe(31); expect(right.scrollTop).toBe(17);
    click('history-back');
    expect(currentDraft(state)).toBe(first);
    expect(currentNode(state)?.id).toBe(node.id);
    expect(center.scrollTop).toBe(128); expect(right.scrollTop).toBe(64);
    expect(root.querySelector(`[data-story-overlay-node="${node.id}"]`)).not.toBeNull();
    expect(find<HTMLTextAreaElement>('[data-editor-composer-text]').value).toBe('待发送正文');
    click('history-forward');
    expect(state.target).toEqual({ kind: 'entry', id: entry.id });
    find<HTMLButtonElement>(`[data-editor-story="${first.draftId}"]`).click(); ctrl.flushUIUpdates();
    expect(currentNode(state)?.id).toBe(node.id);
    expect(composer(state).text).toBe('待发送正文');
    expect(find('[data-workspace-frame="story-editor"]')).toBe(frame);
    expect(find('.story-editor-center .workspace-column__body')).toBe(center);
    expect(find('.story-editor-right .workspace-column__body')).toBe(right);
    expect(find('[data-editor-key="sidebar-stories"]')).toBe(stories);
    expect(render).not.toHaveBeenCalled();
  });

  it('keeps the advanced search and folds when an existing result activates its document and ribbon', () => {
    open();
    const entry = [...game.registry.activeStories.values()][0];
    const story = [...game.registry.stories.values()].find(item => item.id !== entry.storyId)!;
    const press = (selector: string) => { find<HTMLButtonElement>(selector).click(); ctrl.flushUIUpdates(); };
    const tab = (intent: string, id?: string) => `[data-editor-workspace-action="${intent}"]${id ? `[data-editor-instance="${id}"]` : ''}`;
    const activeId = () => find(`${tab('activate')}[aria-pressed="true"]`).dataset.editorInstance!;
    const result = `[data-editor-entry="${entry.id}"]`;
    const query = '[data-sidebar-search]';
    const header = find('[data-editor-workspace-header]');

    press(tab('mode'));
    press(tab('open'));
    input(query, story.id);
    press(`[data-editor-story="source:${story.id}"]`);
    const storyInstance = activeId();
    input(query, entry.id);
    press(result);
    const entryInstance = activeId();
    expect(entryInstance).not.toBe(storyInstance);
    input(query, '无匹配项');
    press(tab('activate', storyInstance));
    expect(find<HTMLInputElement>(query).value).toBe('无匹配项');
    expect(root.querySelector(result)).toBeNull();
    expect(header.querySelector('[data-editor-action="save-to-runtime"]')).not.toBeNull();

    input(query, entry.id);
    const row = find<HTMLButtonElement>(result);
    const list = find('[data-scroll-key="stories"]');
    const folder = row.closest('ul')!.previousElementSibling!.querySelector<HTMLButtonElement>('[data-sidebar-folder]')!;
    const view = find<HTMLSelectElement>('[data-editor-workspace-view-select]');
    view.value = 'focus';
    view.dispatchEvent(new Event('change', { bubbles: true }));
    ctrl.flushUIUpdates();
    press(tab('activate', entryInstance));
    expect(find('[data-editor-workspace]').dataset.editorWorkspaceView).toBe('three');
    press(tab('open'));
    press(tab('activate', storyInstance));
    expect(find('[data-editor-workspace]').dataset.editorWorkspaceView).toBe('browse');
    expect(find(result)).toBe(row);

    list.scrollTop = 52;
    press(result);
    expect(activeId()).toBe(entryInstance);
    expect(find<HTMLInputElement>(query).value).toBe(entry.id);
    expect(find(result)).toBe(row);
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(list.scrollTop).toBe(52);
    expect(root.querySelector('.story-editor-center [data-editor-entry-page]')).not.toBeNull();
    expect(root.querySelector('.story-editor-right [data-editor-entry-page]')).not.toBeNull();
    expect(header.querySelector('[data-authoring-action="apply"]')).not.toBeNull();
    expect(header.querySelector('[data-editor-action="save-to-runtime"]')).toBeNull();
    folder.click();
    ctrl.flushUIUpdates();
    press(tab('close', entryInstance));
    expect(activeId()).toBe(storyInstance);
    expect(find('[data-sidebar-folder]').getAttribute('aria-expanded')).toBe('true');
    expect(find<HTMLInputElement>(query).value).toBe(entry.id);
    expect(root.querySelector(`[data-sidebar-story-id="${story.id}"]`)).not.toBeNull();
    press(tab('locate'));
    expect(find(`[data-sidebar-story-id="${story.id}"]`).closest('ul')?.hidden).toBe(false);
  });

  it('saves once per instance transition and leaves active/list unchanged when saving fails', () => {
    open(); click('new');
    find<HTMLButtonElement>('[data-editor-workspace-action="mode"]').click(); ctrl.flushUIUpdates();
    const editor = ctrl.storyEditor;
    const workspace = editor.state.workspace!;
    const first = workspace.active;
    const drafts = editor.state.drafts;
    const save = vi.spyOn(editor, 'save');
    const press = (action: string, id?: number) => {
      find<HTMLButtonElement>(`[data-editor-workspace-action="${action}"]${id ? `[data-editor-instance="${id}"]` : ''}`).click();
      ctrl.flushUIUpdates();
    };
    press('duplicate');
    expect(save).toHaveBeenCalledTimes(1);
    expect(workspace.instances).toHaveLength(2);
    expect(editor.state.drafts).toBe(drafts);
    const second = workspace.active;
    save.mockClear(); press('activate', first.id);
    expect(save).toHaveBeenCalledTimes(1); expect(workspace.active).toBe(first);
    save.mockClear(); press('activate', first.id);
    expect(save).not.toHaveBeenCalled();
    save.mockReturnValue(false);
    press('activate', second.id); press('duplicate'); press('close', first.id);
    expect(workspace.active).toBe(first); expect(workspace.instances).toEqual([first, second]);
    save.mockClear(); press('close', second.id);
    expect(save).not.toHaveBeenCalled(); expect(workspace.instances).toEqual([first]);
    save.mockReset().mockReturnValue(true); press('close', first.id);
    expect(save).toHaveBeenCalledTimes(1);
    expect(workspace.active).not.toBe(first); expect(workspace.instances).toEqual([workspace.active]);
    expect(editor.state.target).toBeNull(); expect(editor.state.visits).toEqual([]);
  });

  it('rolls back an unregistered candidate when its target disappears after the save gate', () => {
    open(); click('new');
    find<HTMLButtonElement>('[data-editor-workspace-action="mode"]').click(); ctrl.flushUIUpdates();
    const editor = ctrl.storyEditor;
    const workspace = editor.state.workspace!;
    const first = workspace.active;
    const target = editor.state.target;
    const save = editor.save.bind(editor);
    // Invalidate only the post-switch lookup to model a source changing during save.
    const hasTarget = vi.spyOn(editor as unknown as { hasTarget: () => boolean }, 'hasTarget')
      .mockReturnValueOnce(true).mockReturnValueOnce(false);
    const saving = vi.spyOn(editor, 'save').mockImplementation((manual, refresh) => save(manual, refresh));
    find<HTMLButtonElement>('[data-editor-workspace-action="duplicate"]').click(); ctrl.flushUIUpdates();
    expect(saving).toHaveBeenCalledTimes(1); expect(hasTarget).toHaveBeenCalled();
    expect(workspace.active).toBe(first); expect(workspace.instances).toEqual([first]);
    expect(editor.state.target).toEqual(target);
  });

  it('preserves the mounted editor and parked browse instances across advanced and classic layouts', () => {
    open(); click('new'); click('click');
    const state = ctrl.storyEditor.state;
    const draft = currentDraft(state)!;
    const node = currentNode(state)!;
    const frame = find('[data-workspace-frame="story-editor"]');
    const center = find('.story-editor-center .workspace-column__body');
    const right = find('.story-editor-right .workspace-column__body');
    const action = (name: string) => {
      find<HTMLButtonElement>(`[data-editor-workspace-action="${name}"]`).click();
      ctrl.flushUIUpdates();
    };
    const view = (value: string) => {
      const select = find<HTMLSelectElement>('[data-editor-workspace-view-select]');
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      ctrl.flushUIUpdates();
    };
    const activeId = () => find('[data-editor-workspace-action="activate"][aria-pressed="true"]').dataset.editorInstance;
    const activate = (id: string) => {
      find<HTMLButtonElement>(`[data-editor-workspace-action="activate"][data-editor-instance="${id}"]`).click();
      ctrl.flushUIUpdates();
    };
    input('[data-editor-composer-text]', '两处共用的正文输入');
    center.scrollTop = 123;
    right.scrollTop = 46;
    action('mode');
    expect(find('[data-editor-workspace]').dataset.editorWorkspaceMode).toBe('advanced');
    expect([...find<HTMLSelectElement>('[data-editor-workspace-view-select]').options].map(option => option.value)).toEqual(['three', 'browse', 'focus']);
    expect([...root.querySelectorAll<HTMLElement>('[data-editor-workspace-edge]')].map(handle => handle.dataset.editorWorkspaceEdge)).toEqual(['left', 'right']);
    expect(frame.style.gridTemplateColumns).toContain('var(--editor-track-left, 300px)');
    expect(frame.style.gridTemplateColumns).toContain('var(--editor-track-right, var(--workspace-right-width))');
    expect(find('[data-workspace-frame="story-editor"]')).toBe(frame);
    expect(find('.story-editor-center .workspace-column__body')).toBe(center);
    const first = activeId()!;
    view('focus');
    expect(find('[data-editor-workspace]').dataset.editorWorkspaceView).toBe('focus');
    expect(find('[data-editor-workspace-rail]').hidden).toBe(true);
    right.scrollTop = 0; // A hidden body can report zero in a browser.
    action('open');
    expect(find('[data-editor-workspace]').dataset.editorWorkspaceView).toBe('browse');
    expect(find('[data-editor-workspace-rail]').hidden).toBe(false);
    expect(document.activeElement).toBe(find('[data-sidebar-search]'));
    view('three');
    expect(right.scrollTop).toBe(46);
    action('duplicate');
    const second = activeId()!;
    expect(second).not.toBe(first);
    expect(currentDraft(state)).toBe(draft);
    expect(currentNode(state)).toBeUndefined();
    expect(center.scrollTop).toBe(0);
    input('[data-editor-composer-text]', '从第二个实例修改');
    center.scrollTop = 34;
    view('browse');
    activate(first);
    expect(currentNode(state)?.id).toBe(node.id);
    expect(center.scrollTop).toBe(123);
    expect(composer(state).text).toBe('从第二个实例修改');
    activate(second);
    expect(center.scrollTop).toBe(34);
    expect(find('[data-editor-workspace]').dataset.editorWorkspaceView).toBe('browse');

    find<HTMLButtonElement>('[data-column-action="story-editor-sidebar:entries"]').click();
    ctrl.flushUIUpdates();
    const entry = [...game.registry.activeStories.values()][0];
    find<HTMLButtonElement>(`[data-editor-entry="${entry.id}"]`).click();
    ctrl.flushUIUpdates();
    const third = activeId()!;
    expect(third).not.toBe(second);
    expect(state.target).toEqual({ kind: 'entry', id: entry.id });
    find<HTMLButtonElement>('[data-column-action="story-editor-entry-tab:rewards"]').click();
    ctrl.flushUIUpdates();
    action('mode');
    expect(root.querySelector('[data-editor-workspace-action="activate"]')).toBeNull();
    expect(state.entryEditorTab).toBe('rewards');
    find<HTMLButtonElement>('[data-column-action="story-editor-sidebar:stories"]').click();
    ctrl.flushUIUpdates();
    const source = [...game.registry.stories.values()][0];
    find<HTMLButtonElement>(`[data-editor-story="source:${source.id}"]`).click();
    ctrl.flushUIUpdates();
    action('mode');
    expect(activeId()).toBe(third);
    expect(state.target).toEqual({ kind: 'story', id: source.id });
    expect(root.querySelectorAll('[data-editor-workspace-action="activate"]')).toHaveLength(3);
    click('history-back');
    expect(state.target).toEqual({ kind: 'entry', id: entry.id });
    expect(state.entryEditorTab).toBe('rewards');
    activate(first);
    expect(currentNode(state)?.id).toBe(node.id);
    expect(center.scrollTop).toBe(123);
    find<HTMLButtonElement>(`[data-editor-workspace-action="close"][data-editor-instance="${first}"]`).click();
    ctrl.flushUIUpdates();
    expect(activeId()).toBe(second);
    expect(currentDraft(state)).toBe(draft);
    expect(composer(state).text).toBe('从第二个实例修改');
  });

  it('keeps node insertion in the composer and shows commands for the current ribbon scene', () => {
    open(); click('new');
    input('[data-editor-composer-text]', '工具区测试正文');
    click('send');
    const state = ctrl.storyEditor.state;
    const draft = currentDraft(state)!;
    const firstNode = draft.document.nodes[0].id;
    find<HTMLButtonElement>('[data-editor-workspace-action="mode"]').click();
    ctrl.flushUIUpdates();
    const ribbon = find('[data-editor-workspace-header]');
    const groups = () => [...ribbon.querySelectorAll('[role="group"]')].map(group => group.getAttribute('aria-label'));
    expect(groups()).toEqual(['文档', '试播', '管理', '工作区']);
    expect(ribbon.querySelector('strong, [data-editor-workspace-documents], [data-editor-workspace-page]')).toBeNull();
    expect(find('[data-editor-workspace-rail] button').classList.contains('mini-action')).toBe(false);
    const selectors = ['click', 'operation', 'transfer', 'moveToArea', 'moveToCharaspace'].map(action => `[data-editor-action="${action}"]`);
    for (const selector of selectors) {
      expect(ribbon.querySelector(selector)).toBeNull();
      expect(find('.story-editor-composer [aria-label="添加节点"]').querySelector(selector)).not.toBeNull();
    }
    const storyTab = find('[data-editor-workspace-action="activate"][aria-pressed="true"]');
    const original = storyTab.dataset.editorInstance;
    expect(storyTab.textContent).toBe(draft.document.name);
    expect(storyTab.getAttribute('aria-label')).toContain('Story ·');
    expect(storyTab.querySelector('[aria-hidden="true"].editor-document-icon path')).not.toBeNull();
    find<HTMLButtonElement>('[data-editor-key="quick-preview"]').click();
    ctrl.flushUIUpdates();
    expect(state.preview, state.error ?? '试播应已开启').toBeTruthy();
    expect(groups()).toEqual(['试播', '工作区']);
    expect(ribbon.querySelector('[data-editor-workspace-view-select]')).toBeNull();
    expect(root.querySelector('.story-editor-composer')).toBeNull();
    expect(root.querySelectorAll('[data-authoring-action="restart-preview"]')).toHaveLength(1);
    const close = ribbon.querySelector<HTMLButtonElement>('[data-authoring-action="close-preview"]')!;
    close.click();
    ctrl.flushUIUpdates();
    expect(state.preview).toBeUndefined();
    expect(document.activeElement).toBe(find('[data-editor-key="quick-preview"]'));
    expect(find('[data-editor-workspace-action="activate"][aria-pressed="true"]').dataset.editorInstance).toBe(original);
    find<HTMLButtonElement>(`[data-story-insertion-before="${firstNode}"]`).click();
    ctrl.flushUIUpdates();
    click('click');
    expect(draft.document.nodes.map(node => node.type)).toEqual(['click', 'talklet']);

    find<HTMLButtonElement>('.story-editor-left [data-directory-folder-id]').click();
    ctrl.flushUIUpdates();
    expect(groups()).toEqual(['目录管理', '工作区']);
    expect(ribbon.querySelector('[data-editor-action="directory-back"]')).not.toBeNull();
    click('directory-back');
    expect(groups()).toEqual(['文档', '试播', '管理', '工作区']);

    find<HTMLButtonElement>('[data-column-action="story-editor-sidebar:entries"]').click();
    ctrl.flushUIUpdates();
    const entry = [...game.registry.activeStories.values()][0];
    find<HTMLButtonElement>(`[data-editor-entry="${entry.id}"]`).click();
    ctrl.flushUIUpdates();
    const entryTab = find('[data-editor-workspace-action="activate"][aria-pressed="true"]');
    expect(entryTab.textContent).not.toContain('Entry ·');
    expect(entryTab.getAttribute('aria-label')).toContain('Entry ·');
    expect(entryTab.querySelector('[aria-hidden="true"].editor-document-icon path')).not.toBeNull();
    expect(ribbon.querySelector('[data-authoring-action="apply"]')).not.toBeNull();
    expect(ribbon.querySelector('[data-editor-action="save-to-runtime"], [data-authoring-preview-entry]')).toBeNull();
    expect(root.querySelector('.story-editor-composer')).toBeNull();
  });

  it('drags the ribbon between expanded and compact without replacing commands or the frame', () => {
    open();
    const toggle = () => {
      find<HTMLButtonElement>('[data-editor-workspace-action="mode"]').click();
      ctrl.flushUIUpdates();
    };
    toggle();
    const header = find('[data-editor-workspace-header]');
    const frame = find('[data-workspace-frame="story-editor"]');
    const command = find('[data-editor-workspace-action="open"]');
    const grip = find('[data-editor-workspace-ribbon-grip]');
    expect(grip.parentElement).toBe(header);
    expect(header.nextElementSibling).toBe(find('[data-editor-workspace-documents]'));
    const pointer = (type: string, y: number) => grip.dispatchEvent(new PointerEvent(type,
      { bubbles: true, button: 0, pointerId: 1, clientY: y }));
    expect(header.dataset.editorWorkspaceRibbon).toBe('expanded');
    pointer('pointerdown', 90);
    pointer('pointermove', 50);
    expect(header.dataset.editorWorkspaceRibbon).toBe('compact');
    pointer('pointercancel', 50);
    expect(header.dataset.editorWorkspaceRibbon).toBe('expanded');
    pointer('pointerdown', 90);
    pointer('pointermove', 50);
    pointer('pointerup', 50);
    expect(grip.getAttribute('aria-valuetext')).toBe('紧凑');
    expect(find('[data-editor-workspace-action="open"]')).toBe(command);
    expect(find('[data-workspace-frame="story-editor"]')).toBe(frame);
    toggle();
    toggle();
    expect(header.dataset.editorWorkspaceRibbon).toBe('compact');
    expect(JSON.parse(localStorage.getItem('acprogram.editor-workspace.v1.story')!).ribbon).toBe('compact');
    const restoredGrip = find('[data-editor-workspace-ribbon-grip]');
    restoredGrip.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    expect(header.dataset.editorWorkspaceRibbon).toBe('expanded');
  });

  it('resizes both advanced edges in place and restores defaults on double-click', () => {
    open();
    find<HTMLButtonElement>('[data-editor-workspace-action="mode"]').click();
    ctrl.flushUIUpdates();
    const shell = find('[data-editor-workspace]');
    const stage = find('.editor-workspace__stage');
    vi.spyOn(stage, 'clientWidth', 'get').mockReturnValue(1240);
    const frame = find('[data-workspace-frame="story-editor"]');
    for (const [edge, delta, initial] of [['left', 60, 300], ['right', -55, 320]] as const) {
      const panel = find(`.story-editor-${edge}`);
      vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, initial, 500));
      const handle = find(`[data-editor-workspace-edge="${edge}"]`);
      const pointer = (type: string, x: number) => handle.dispatchEvent(new PointerEvent(type,
        { bubbles: true, button: 0, pointerId: 1, clientX: x }));
      pointer('pointerdown', 500);
      pointer('pointermove', 500 + delta);
      pointer('pointerup', 500 + delta);
      expect(shell.style.getPropertyValue(`--editor-${edge}-width`)).toBe(`${initial + Math.abs(delta)}px`);
      expect(find('[data-workspace-frame="story-editor"]')).toBe(frame);
      handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(shell.style.getPropertyValue(`--editor-${edge}-width`)).toBe(`${initial}px`);
    }
  });

  it('lists Active and Passive Entries with draft precedence, independent search and unpublished targets', () => {
    open(); click('new');
    const state = ctrl.storyEditor.state;
    const draft = currentDraft(state)!;
    const active = [...game.registry.activeStories.values()][0];
    const passive = [...game.registry.passiveStories.values()][0];
    draft.authoring!.activeStories.push({ ...active, openingTitle: '草稿入口标题' }, { ...active, id: 'local:activestory:unpublished', storyId: draft.document.id, openingTitle: '未发布入口' });
    draft.dirty = true;
    input('[data-editor-search]', '独立的 Story 搜索');
    find<HTMLButtonElement>('[data-column-action="story-editor-sidebar:entries"]').click(); ctrl.flushUIUpdates();
    expect(find(`[data-editor-entry="${active.id}"]`).textContent).toContain('草稿入口标题');
    expect(root.querySelectorAll(`[data-editor-entry="${active.id}"]`)).toHaveLength(1);
    expect(find(`[data-editor-entry="${passive.id}"]`).title).toContain('随机抽取');
    input('[data-editor-entry-search]', '未发布入口');
    expect(root.querySelectorAll('[data-editor-entry]')).toHaveLength(1);
    find<HTMLButtonElement>('[data-editor-entry="local:activestory:unpublished"]').click(); ctrl.flushUIUpdates();
    expect(state.target).toEqual({ kind: 'entry', id: 'local:activestory:unpublished' });
    expect(game.registry.activeStories.has('local:activestory:unpublished')).toBe(false);
    expect(state.search).toBe('独立的 Story 搜索');
    input('[data-editor-entry-search]', passive.id);
    expect(root.querySelectorAll('[data-editor-entry]')).toHaveLength(1);
    expect(find(`[data-editor-entry="${passive.id}"]`)).toBeTruthy();
  });

  it('collapses filters by default and restores directory folds after searching, without replacing the center', () => {
    open(); click('new');
    const draft = currentDraft(ctrl.storyEditor.state)!;
    input('[data-editor-field="name"]', '验收目录折叠');
    const center = find('.story-editor-center .workspace-column__body');
    center.scrollTop = 73;
    const filters = find('[data-editor-key="sidebar-filters"]');
    const toggle = find<HTMLButtonElement>('[data-sidebar-action="filters"]');
    expect(filters.hidden).toBe(true);
    const row = find(`[data-editor-story="${draft.draftId}"]`);
    const folder = row.closest('ul')!.previousElementSibling!.querySelector<HTMLButtonElement>('[data-sidebar-folder]')!;
    expect(folder.getAttribute('aria-expanded')).toBe('true');
    folder.click(); ctrl.flushUIUpdates();
    expect(folder.getAttribute('aria-expanded')).toBe('false');
    expect(row.closest('ul')!.hidden).toBe(true);
    toggle.click(); ctrl.flushUIUpdates();
    expect(filters.hidden).toBe(false);
    const search = find<HTMLInputElement>('[data-sidebar-search]');
    expect(document.activeElement).toBe(search);
    input('[data-sidebar-search]', draft.document.id);
    expect(folder.getAttribute('aria-expanded')).toBe('true');
    expect(find(`[data-editor-story="${draft.draftId}"]`)).toBe(row);
    toggle.click(); ctrl.flushUIUpdates();
    expect(filters.hidden).toBe(true);
    expect(find('[data-editor-key="sidebar-summary"]').textContent).toContain(draft.document.id);
    find<HTMLButtonElement>('[data-sidebar-action="clear"]').click(); ctrl.flushUIUpdates();
    expect(folder.getAttribute('aria-expanded')).toBe('false');
    expect(find('.story-editor-center .workspace-column__body')).toBe(center);
    expect(center.scrollTop).toBe(73);
  });

  it('places Entries after their opening Story in the same folder and leaves unmatched Entries at the end', () => {
    open(); click('new');
    const firstDraft = currentDraft(ctrl.storyEditor.state)!;
    click('new');
    const secondDraft = currentDraft(ctrl.storyEditor.state)!;
    const initId = game.state.activeInit;
    const hierarchyString = '排序验收';
    for (const draft of [firstDraft, secondDraft]) {
      Object.assign(draft.document, { initId, hierarchyString });
    }
    const [first, second] = [firstDraft, secondDraft].sort((a, b) => a.document.id.localeCompare(b.document.id));
    const active = [...game.registry.activeStories.values()][0];
    secondDraft.authoring!.activeStories.push(...[
      { id: 'local:activestory:unmatched', storyId: 'local:story:missing', order: 0 },
      { id: 'local:activestory:second', storyId: second.document.id, order: 1 },
      { id: 'local:activestory:first-b', storyId: first.document.id, order: 2 },
      { id: 'local:activestory:first-a', storyId: first.document.id, order: 3 },
    ].map(({ id, storyId, order }) => ({ ...active, id, storyId, availableInits: [initId], directoryPlacements: [{ initId, hierarchyString, order }] })));
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();

    const rows = find(`[data-editor-story="${first.draftId}"]`).closest('ul')!;
    const rowOrder = () => [...rows.querySelectorAll<HTMLElement>(':scope > li > button')].map(row => row.dataset.editorStory ?? row.dataset.editorEntry);
    expect(rowOrder()).toEqual([
      first.draftId, 'local:activestory:first-b', 'local:activestory:first-a',
      second.draftId, 'local:activestory:second', 'local:activestory:unmatched',
    ]);
    find<HTMLButtonElement>('[data-column-action="story-editor-sidebar:entries"]').click();
    expect(rowOrder()).toEqual(['local:activestory:unmatched', 'local:activestory:second', 'local:activestory:first-b', 'local:activestory:first-a']);
  });

  it('keeps empty character folders and opens their management from the title row', () => {
    open(); click('new');
    const initId = game.state.activeInit;
    const initManager = find<HTMLButtonElement>(`[data-directory-init-id="${initId}"][data-directory-folder-id=""]`);
    const groupManager = find<HTMLButtonElement>(`[data-directory-init-id="${initId}"][data-directory-folder-id="@characters"]`);
    const heading = groupManager.parentElement!;
    const group = heading.querySelector<HTMLButtonElement>('[data-sidebar-folder]')!;
    const children = heading.nextElementSibling as HTMLUListElement;
    expect(children.hidden).toBe(true);
    group.click();
    expect(children.hidden).toBe(false);
    const character = [...game.registry.characters.values()].find(role => {
      const id = characterStoryDirectoryId(initId, role.id);
      return children.querySelector(`[data-directory-folder-id="${id}"]`)?.parentElement?.nextElementSibling === null;
    })!;
    expect(character).toBeDefined();
    const roleId = characterStoryDirectoryId(initId, character.id);
    const manage = find<HTMLButtonElement>(`[data-directory-folder-id="${roleId}"]`);
    const center = find('.story-editor-center .workspace-column__body');
    expect(groupManager.parentElement).toBe(heading);
    expect(heading.lastElementChild).toBe(groupManager);
    expect(heading.nextElementSibling).toBe(children);
    expect(manage.parentElement?.querySelector<HTMLButtonElement>('[data-sidebar-folder]')?.disabled).toBe(true);
    center.scrollTop = 84;
    manage.click(); ctrl.flushUIUpdates();
    expect(ctrl.modal.isOpen()).toBe(false);
    expect(find('.story-editor-center .workspace-heading').textContent).toContain(character.displayName);
    expect(find('.story-editor-center [aria-label="目录内容"]').textContent).toContain('此目录暂无内容');
    expect(find('.story-editor-right [aria-label="目录资料"]').textContent).toContain('所属 Mod');
    expect(manage.getAttribute('aria-pressed')).toBe('true');
    group.click();
    groupManager.click(); ctrl.flushUIUpdates();
    expect(children.hidden).toBe(true);
    expect(find('.story-editor-center .workspace-heading').textContent).toContain('角色故事');
    initManager.click(); ctrl.flushUIUpdates();
    find<HTMLButtonElement>('.story-editor-center [data-directory-folder-id="@characters"]').click(); ctrl.flushUIUpdates();
    expect(groupManager.getAttribute('aria-pressed')).toBe('true');
    click('directory-back');
    expect(root.querySelector('[aria-label="目录内容"]')).toBeNull();
    expect(find('.story-editor-center .workspace-column__body')).toBe(center);
    expect(center.scrollTop).toBe(84);
  });

  it('blocks Story/Entry navigation on draft save failure and skips removed Entry history', () => {
    open(); click('new');
    const state = ctrl.storyEditor.state;
    const draft = currentDraft(state)!;
    const entry = [...game.registry.activeStories.values()][0];
    find<HTMLButtonElement>('[data-column-action="story-editor-sidebar:entries"]').click(); ctrl.flushUIUpdates();
    const save = vi.spyOn(ctrl.storyEditor.persistence, 'save').mockReturnValue(false);
    const index = state.visitIndex;
    find<HTMLButtonElement>(`[data-editor-entry="${entry.id}"]`).click(); ctrl.flushUIUpdates();
    expect(currentDraft(state)).toBe(draft);
    expect(state.visitIndex).toBe(index);
    save.mockRestore();
    find<HTMLButtonElement>(`[data-editor-entry="${entry.id}"]`).click(); ctrl.flushUIUpdates();
    click('new');
    const second = currentDraft(state)!;
    second.authoring!.removed = { activeStories: [entry.id] };
    click('history-back');
    expect(currentDraft(state)).toBe(draft);
  });

  it.each(['entryCard', 'continuation', 'kizunaCard'] as const)('opens an Entry only from the %s side target without starting gameplay', kind => {
    open(); click('new'); click('click');
    const state = ctrl.storyEditor.state;
    const draft = currentDraft(state)!;
    const node = currentNode(state)!;
    const entry = [...game.registry.activeStories.values()][0];
    draft.document.nodes = [{ id: node.id, type: 'click', stageId: 'input', interaction: kind === 'kizunaCard'
      ? { kind: 'kizunaCard' }
      : { kind: 'entryCard', card: { request: { entryId: entry.id, entryType: 'active', owner: null, intent: 'card' }, ...(kind === 'continuation' ? { continuation: {} } : {}) } } }];
    if (kind === 'kizunaCard') draft.authoring!.activeStories.push({ ...entry, id: 'local:activestory:parent', storyId: draft.document.id, kizuna: { entryId: entry.id } });
    draft.dirty = true;
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();
    const gameplay = game.storyService.getCurrentStoryId();
    const registered = structuredClone(game.registry.activeStories.get(entry.id));
    click('info');
    const flow = find('.story-editor-flow');
    const visitIndex = state.visitIndex;
    const preview = find<HTMLElement>('.story-editor-flow .kizuna-card');
    expect(preview.tagName).toBe('DIV');
    expect(preview.hasAttribute('data-editor-entry-target')).toBe(false);
    preview.click(); ctrl.flushUIUpdates();
    expect(currentDraft(state)).toBe(draft);
    expect(currentNode(state)?.id).toBe(node.id);
    expect(state.visitIndex).toBe(visitIndex);
    expect(find('.story-editor-flow')).toBe(flow);
    const card = find<HTMLButtonElement>('.story-editor-node-content.has-target-card > button[data-editor-entry-target]');
    expect(card.disabled).toBe(false);
    expect(card.dataset.editorEntryTarget).toBe(entry.id);
    expect(card.dataset.storyTargetKind).toBe('entry');
    expect(card.querySelector('code')?.textContent).toBe(entry.id);
    expect(card.style.getPropertyValue('--story-card-default-start')).toMatch(/^hsl\(/);
    expect(card.style.getPropertyValue('--story-card-default-end')).toMatch(/^hsl\(/);
    card.click(); ctrl.flushUIUpdates();
    expect(state.target).toEqual({ kind: 'entry', id: entry.id });
    expect(find('.story-editor-center [data-authoring-field]')).toBeTruthy();
    expect(game.storyService.getCurrentStoryId()).toBe(gameplay);
    expect(game.registry.activeStories.get(entry.id)).toEqual(registered);
    click('history-back');
    expect(currentDraft(state)).toBe(draft);
    expect(currentNode(state)?.id).toBe(node.id);
    expect(find<HTMLButtonElement>('.story-editor-flow button[data-editor-entry-target]').style.cssText).toBe(card.style.cssText);
  });

  it('disables missing Entry targets and keeps areaContinue as a selectable node', () => {
    open(); click('new'); click('click');
    const state = ctrl.storyEditor.state;
    const draft = currentDraft(state)!;
    const node = currentNode(state)!;
    draft.document.nodes = [{ id: node.id, type: 'click', stageId: 'input', interaction: { kind: 'entryCard', card: { request: { entryId: 'missing:activestory:target', entryType: 'active', owner: null, intent: 'card' } } } }];
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();
    const target = find<HTMLButtonElement>('.story-editor-flow button[data-editor-entry-target]');
    expect(target.disabled).toBe(true);
    expect(target.textContent).toContain('missing:activestory:target');
    target.click(); ctrl.flushUIUpdates();
    expect(currentDraft(state)).toBe(draft);
    click('info'); find<HTMLElement>('[data-editor-node]').click(); ctrl.flushUIUpdates();
    expect(currentNode(state)?.id).toBe(node.id);
    draft.document.nodes = [{ id: node.id, type: 'click', stageId: 'input', interaction: { kind: 'areaContinue', areaId: baseDatapack.areas[0].id } }];
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();
    expect(root.querySelector('.story-editor-flow [data-editor-entry-target]')).toBeNull();
  });

  it('edits the initial scene through its non-node placeholder and keeps movement cards selectable', () => {
    open(); click('new'); click('moveToArea');
    const state = ctrl.storyEditor.state;
    const draft = currentDraft(state)!;
    const node = currentNode(state)!;
    const start = find<HTMLButtonElement>('[data-editor-start-context]');
    const nodeElement = find(`[data-editor-node="${node.id}"]`);
    const body = find('.story-editor-center .workspace-column__body');
    const gameplayArea = game.state.currentAreaId;
    expect(start.closest('[data-editor-node]')).toBeNull();
    start.click(); ctrl.flushUIUpdates();
    expect(currentNode(state)).toBeUndefined();
    expect(find('[data-editor-field="story-context-type"]')).toBeTruthy();
    input('[data-editor-field="story-context-type"]', 'chara');
    find<HTMLSelectElement>('[data-editor-field="story-context-type"]').dispatchEvent(new Event('change', { bubbles: true })); ctrl.flushUIUpdates();
    const variant = [...game.registry.characterVariants.values()][0];
    find<HTMLSelectElement>('[data-editor-field="story-context-character"]').value = variant.id;
    find('[data-editor-field="story-context-character"]').dispatchEvent(new Event('change', { bubbles: true })); ctrl.flushUIUpdates();
    expect(find('[data-editor-start-context]')).toBe(start);
    expect(start.textContent).toContain(variant.displayName);
    find<HTMLElement>(`[data-editor-node="${node.id}"] .area-hero`).click(); ctrl.flushUIUpdates();
    expect(currentNode(state)?.id).toBe(node.id);
    expect(find(`[data-editor-node="${node.id}"]`)).toBe(nodeElement);
    expect(find('.story-editor-center .workspace-column__body')).toBe(body);
    expect(draft.document.nodes).toHaveLength(1);
    expect(game.state.currentAreaId).toBe(gameplayArea);
  });

  it.each(['insert', 'goto'] as const)('selects the %s body and navigates only from its side target, preserving history and scroll', mode => {
    open(); click('new'); click('transfer');
    const state = ctrl.storyEditor.state;
    const first = currentDraft(state)!;
    const node = currentNode(state)!;
    click('new');
    const second = currentDraft(state)!;
    first.document.nodes = [{ ...node, type: 'transfer', transfer: { mode, storyId: second.document.id } }];
    const choose = (id: string): void => { find<HTMLButtonElement>(`[data-editor-story="${id}"]`).click(); ctrl.flushUIUpdates(); };
    choose(first.draftId);
    click('info');
    const nodeElement = find(`[data-editor-node="${node.id}"]`);
    const body = find('.story-editor-flow .story-editor-transfer > .story-editor-action-node');
    const index = state.visitIndex;
    body.click(); ctrl.flushUIUpdates();
    expect(currentDraft(state)).toBe(first);
    expect(currentNode(state)?.id).toBe(node.id);
    expect(state.visitIndex).toBe(index);
    expect(find(`[data-editor-node="${node.id}"]`)).toBe(nodeElement);
    const properties = find('.story-editor-right .story-editor-property-content');
    const targetPreview = properties.querySelector<HTMLButtonElement>('[data-editor-story-target]');
    expect(targetPreview?.dataset.editorStoryTarget).toBe(second.document.id);
    expect(properties.querySelector('.story-editor-property-group, .story-editor-transfer-action')).toBeNull();
    expect(body.querySelector('[data-editor-story-target]')).toBeNull();
    find<HTMLButtonElement>(`[data-story-insertion-before="${node.id}"]`).click(); ctrl.flushUIUpdates();
    input('[data-editor-composer-text]', '待发送');
    const center = find('.story-editor-center .workspace-column__body');
    const right = find('.story-editor-right .workspace-column__body');
    center.scrollTop = 145; right.scrollTop = 73;
    const header = find('.story-editor-center .panel-tabs-region');
    const fullRender = vi.spyOn(ctrl, 'render');
    const target = find<HTMLButtonElement>(`.story-editor-flow [data-editor-story-target="${second.document.id}"]`);
    expect(target.textContent).toContain(second.document.name);
    expect(target.classList.contains('story-editor-target-card')).toBe(true);
    expect(target.parentElement!.textContent).toContain(mode);
    (mode === 'insert' ? targetPreview! : target).click(); ctrl.flushUIUpdates();
    expect(currentDraft(state)).toBe(second);
    expect(center.scrollTop).toBe(0);
    click('history-back');
    expect(currentDraft(state)).toBe(first);
    expect(state.selectedNodeId).toBe(node.id);
    expect(state.insertionBeforeNodeId).toBe(node.id);
    expect(center.scrollTop).toBe(145); expect(right.scrollTop).toBe(73);
    expect(find<HTMLInputElement>('[data-editor-composer-text]').value).toBe('待发送');
    expect(find('.story-editor-center .workspace-column__body')).toBe(center);
    expect(find('.story-editor-center .panel-tabs-region')).toBe(header);
    click('history-forward'); expect(currentDraft(state)).toBe(second);
    click('history-back'); click('new');
    expect(find<HTMLButtonElement>('[data-editor-action="history-forward"]').disabled).toBe(true);
    expect(fullRender).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)!).visits).toBeUndefined();
    if (mode === 'insert') {
      for (let i = 0; i < 52; i++) choose(i % 2 ? first.draftId : second.draftId);
      expect(state.visits.length).toBe(50);
    }
  });

  it('shows Button and Transfer targets without executing Click or Entry inputs', () => {
    open(); click('new'); click('click');
    const runningStory = game.storyService.getCurrentStoryId();
    const state = ctrl.storyEditor.state;
    const draft = currentDraft(state)!;
    const id = draft.document.nodes[0].id;
    draft.document.nodes = [
      { id, type: 'transfer', transfer: { mode: 'goto', storyId: 'missing:story:target' } },
      { id: 'self-transfer', type: 'transfer', transfer: { mode: 'insert', storyId: draft.document.id } },
    ];
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();
    const missing = find<HTMLButtonElement>('.story-editor-flow [data-editor-story-target="missing:story:target"]');
    expect(missing.disabled).toBe(true);
    expect(missing.textContent).toContain('目标不存在');
    expect(missing.parentElement!.textContent).toContain('goto');
    const index = state.visitIndex;
    find<HTMLButtonElement>(`.story-editor-flow [data-editor-story-target="${draft.document.id}"]`).click(); ctrl.flushUIUpdates();
    expect(state.visitIndex).toBe(index);
    expect(currentDraft(state)).toBe(draft);
    expect(game.storyService.getCurrentStoryId()).toBe(runningStory);
    expect(root.querySelector('.story-editor-right [data-editor-story-target]')).not.toBeNull();
    const target = [...game.registry.stories.values()][0];
    draft.document.nodes = [{ id, type: 'transfer', transfer: { mode: 'goto', storyId: target.id } }];
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();
    find<HTMLButtonElement>(`.story-editor-flow [data-editor-story-target="${target.id}"]`).click(); ctrl.flushUIUpdates();
    expect(currentDraft(state)!.document.id).toBe(target.id);
    expect(game.storyService.getCurrentStoryId()).toBe(runningStory);
  });

  it('keeps the current story and history when saving before navigation fails', () => {
    open(); click('new'); const first = currentDraft(ctrl.storyEditor.state)!;
    click('new'); const second = currentDraft(ctrl.storyEditor.state)!;
    const index = ctrl.storyEditor.state.visitIndex;
    vi.spyOn(ctrl.storyEditor.persistence, 'save').mockReturnValue(false);
    find<HTMLButtonElement>(`[data-editor-story="${first.draftId}"]`).click(); ctrl.flushUIUpdates();
    expect(currentDraft(ctrl.storyEditor.state)).toBe(second);
    expect(ctrl.storyEditor.state.visitIndex).toBe(index);
    click('history-back');
    expect(currentDraft(ctrl.storyEditor.state)).toBe(second);
    expect(ctrl.storyEditor.state.visitIndex).toBe(index);
  });

  it('confirms Entry flag information, keeps child names separate and navigates to their source nodes', () => {
    open(); click('new'); const state = ctrl.storyEditor.state;
    const parent = currentDraft(state)!;
    parent.document.nodes = [{id:'invite',type:'click',stageId:'input',interaction:{kind:'entryCard',card:{request:{entryId:'local:activestory:flags',entryType:'active',owner:null,intent:'card'},continuation:{returnFlags:['returned']}}}}];
    click('new'); const child = currentDraft(state)!;
    child.document.nodes = [{id:'secret',type:'operation',action:{kind:'localFlag',op:'set',name:'child-private',value:true}}];
    child.authoring!.activeStories.push({id:'local:activestory:flags',storyId:child.document.id,availableInits:[],triggerCondition:{type:'AND',conditions:[]}, activation: { kind: 'active' as const } });
    child.dirty = true;
    find<HTMLButtonElement>(`[data-editor-story="${parent.draftId}"]`).click(); ctrl.flushUIUpdates();
    find<HTMLElement>('[data-editor-node="invite"]').click(); ctrl.flushUIUpdates();
    expect(root.querySelector('.story-editor-flag-catalog')).toBeNull();
    click('info');
    find<HTMLButtonElement>('[data-column-action="story-editor-inspector-tab:flags"]').click(); ctrl.flushUIUpdates();
    const body = find('.story-editor-right .workspace-column__body'); body.scrollTop = 114;
    const nameField = find<HTMLInputElement>('[data-editor-field="name"]');
    const ask = () => { find<HTMLButtonElement>('[data-story-flag-import]').click(); };
    const answer = (choice: 'yes' | 'no') => { document.querySelector<HTMLButtonElement>(`[data-modal-action="flag-import-${choice}"]`)!.click(); ctrl.flushUIUpdates(); };
    ask(); expect(ctrl.modal.isOpen()).toBe(true);
    answer('no');
    expect(Object.values(parent.flagImports!)).toEqual([false]);
    expect(find('.story-editor-flag-catalog').textContent).not.toContain('child-private');
    ask(); answer('yes');
    expect(Object.values(parent.flagImports!)).toEqual([true]);
    expect(find('.story-editor-flag-catalog').textContent).toContain('child-private');
    const privateFlag = find<HTMLDetailsElement>('.story-editor-flag-item[data-story-flag-name="child-private"]');
    expect(privateFlag.querySelector('summary')?.title).toContain('其他 Entry 内部');
    expect(find<HTMLInputElement>('[data-editor-field="name"]')).toBe(nameField);
    expect(find('.story-editor-right .workspace-column__body')).toBe(body);
    expect(body.scrollTop).toBe(114);
    find<HTMLElement>('[data-editor-node="invite"]').click(); ctrl.flushUIUpdates();
    const names = [...root.querySelectorAll<HTMLOptionElement>('#story-editor-local-flags option')].map(option=>option.value);
    expect(names).toContain('returned'); expect(names).not.toContain('child-private');
    click('info');
    const saved = JSON.parse(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)!);
    expect(saved.drafts.find((draft: {draftId:string})=>draft.draftId===parent.draftId).flagImports).toEqual(parent.flagImports);
    expect(saved.drafts.find((draft: {draftId:string})=>draft.draftId===parent.draftId).document.flagImports).toBeUndefined();
    find<HTMLDetailsElement>('.story-editor-flag-item[data-story-flag-name="child-private"]').querySelector('summary')!.click();
    find<HTMLButtonElement>(`[data-story-flag-node="secret"] [data-editor-story-target="${child.document.id}"]`).click(); ctrl.flushUIUpdates();
    expect(currentDraft(state)).toBe(child); expect(state.selectedNodeId).toBe('secret');
    click('history-back'); expect(currentDraft(state)).toBe(parent);
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates(); expect(ctrl.modal.isOpen()).toBe(false);
  });

  it('returns from node properties to Story properties through the right titlebar', () => {
    open();
    click('new');
    expect(root.querySelector('.story-editor-right [data-column-back]')).toBeNull();
    click('click');
    expect(currentNode(ctrl.storyEditor.state)).toBeTruthy();
    const draft = currentDraft(ctrl.storyEditor.state)!;
    const documentBefore = structuredClone(draft.document);
    input('[data-editor-composer-text]', '未发送正文');
    const body = find('.story-editor-center .workspace-column__body');
    const composerField = find('[data-editor-composer-text]');
    const back = find<HTMLButtonElement>('.story-editor-right .ui-cluster--right-tabs-region [data-column-back]');
    back.click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.isOpen()).toBe(true);
    expect(ctrl.storyEditor.state.selectedNodeId).toBeNull();
    expect(find('[data-editor-field="name"]')).toBeTruthy();
    expect(root.querySelector('.story-editor-right [data-column-back]')).toBeNull();
    expect(currentDraft(ctrl.storyEditor.state)).toBe(draft);
    expect(draft.document).toEqual(documentBefore);
    expect(find('.story-editor-center .workspace-column__body')).toBe(body);
    expect(find('[data-editor-composer-text]')).toBe(composerField);
    expect(composer(ctrl.storyEditor.state).text).toBe('未发送正文');
  });

  it('edits one gate and local flag actions, keeps focused controls, and never publishes unfinished values', () => {
    open();
    click('new');
    click('operation');
    const behaviorType = [...root.querySelectorAll<HTMLSelectElement>('[data-story-branch-field="kind"]')]
      .find(control => control.dataset.storyBranchPath === JSON.stringify(['action']))!;
    behaviorType.value = 'localFlag';
    behaviorType.dispatchEvent(new Event('change', { bubbles: true })); ctrl.flushUIUpdates();
    input('[data-editor-field="requires-flag"]', 'StoryName-started');
    input('[data-editor-field="local-flag-op"]', 'set');
    input('[data-editor-field="local-flag-name"]', '自由名称');
    find('[data-editor-field="local-flag-name"]').dispatchEvent(new Event('change', { bubbles: true })); ctrl.flushUIUpdates();
    input('[data-editor-field="local-flag-type"]', 'number');
    const field = find<HTMLInputElement>('[data-editor-field="local-flag-value"]');
    field.focus();
    const body = find('.story-editor-center .workspace-column__body');
    const node = find('[data-editor-node]');
    input('[data-editor-field="local-flag-value"]', '-');
    expect(document.activeElement).toBe(field);
    expect(find('[data-editor-field="local-flag-value"]')).toBe(field);
    expect(find('.story-editor-center .workspace-column__body')).toBe(body);
    expect(find('[data-editor-node]')).toBe(node);
    click('save');
    expect(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)).toContain('localFlagInputs');
    const id = currentDraft(ctrl.storyEditor.state)!.document.id;
    click('save-to-runtime');
    expect(game.registry.stories.has(id)).toBe(false);
    expect(ctrl.storyEditor.state.error).toContain('value');
    input('[data-editor-field="local-flag-value"]', '0');
    click('save-to-runtime');
    expect(game.registry.stories.get(id)?.nodes[0]).toMatchObject({ requiresFlag: 'StoryName-started', action: { kind: 'localFlag', op: 'set', name: '自由名称', value: 0 } });
    expect(game.registry.stories.get(id)).not.toHaveProperty('localFlagInputs');
    input('[data-editor-field="local-flag-op"]', 'remove');
    expect(root.querySelector('[data-editor-field="local-flag-value"]')).toBeNull();
    click('save-to-runtime');
    expect(game.registry.stories.get(id)?.nodes[0]).not.toHaveProperty('action.value');
    input('[data-editor-field="local-flag-op"]', 'set');
    expect(find<HTMLInputElement>('[data-editor-field="local-flag-value"]').value).toBe('0');
  });

  it('opens from the lobby with no Init, creates a three-column route, and returns to the lobby', () => {
    ctrl.commands.reset();
    open();
    expect(game.state.activeInit).toBe('');
    expect(ctrl.workspaceLocation().route).toEqual({ kind: 'story-editor' });
    const frame = find('[data-workspace-frame="story-editor"]');
    expect(frame.querySelectorAll(':scope > [data-column-instance]')).toHaveLength(3);
    expect(frame.querySelectorAll('.workspace-column__header')).toHaveLength(3);
    expect(frame.querySelectorAll('.workspace-column__footer')).toHaveLength(1);
    const before = ctrl.getRefreshStats().fullRenders;
    find<HTMLButtonElement>('#story-editor-launch').click();
    expect(ctrl.getRefreshStats().fullRenders).toBe(before);
    click('new');
    expect(currentDraft(ctrl.storyEditor.state)?.document.nodes).toEqual([]);
    expect(find('.story-editor-center .workspace-column__body').dataset.scroll).toBe('auto');
    expect(find('.story-editor-right .workspace-column__body').dataset.scroll).toBe('auto');
    expect(find('[data-scroll-key="stories"]')).toBeTruthy();
    expect(UI_HOST_REGISTRY.validate()).toEqual([]);
    find<HTMLButtonElement>('.story-editor-left [data-column-back]').click();
    expect(root.querySelector('.selector-shell')).not.toBeNull();
    expect(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)).not.toBeNull();
  });

  it('switches left views from the title and preserves directory filters and list scroll', () => {
    open();
    click('new');
    const title = find('.story-editor-left .workspace-title');
    const cycle = find<HTMLButtonElement>('[data-sidebar-mode-cycle]');
    const dropdown = find<HTMLButtonElement>('[popovertarget="story-editor-sidebar-modes"]');
    const menu = find('#story-editor-sidebar-modes');
    const directoryMode = menu.querySelector<HTMLButtonElement>('[data-column-action="story-editor-sidebar:directory"]')!;
    const senderMode = menu.querySelector<HTMLButtonElement>('[data-column-action="story-editor-sidebar:senders"]')!;
    const storyList = find('[data-scroll-key="stories"]');
    const senderList = find('[data-scroll-key="senders"]');
    const composer = find('[data-editor-composer-text]');
    expect(title.contains(cycle)).toBe(true);
    expect(title.contains(dropdown)).toBe(true);
    expect(cycle.textContent).toBe('故事目录');
    expect(directoryMode.getAttribute('aria-pressed')).toBe('true');
    find<HTMLButtonElement>('[data-column-action="story-editor-sidebar:entries"]').click();
    input('[data-editor-entry-search]', '入口搜索');
    storyList.scrollTop = 45;
    cycle.click();
    expect(cycle.textContent).toBe('发出方');
    expect(senderMode.getAttribute('aria-pressed')).toBe('true');
    const hoshinoSender = storySenders(createUIContext(game)).find(sender => sender.label === '小鸟游星野')!;
    const hoshino = find<HTMLButtonElement>(`[data-editor-sender="${hoshinoSender.id}"]`);
    const avatar = hoshino.querySelector('.story-editor-sender-avatar')!;
    expect(avatar.querySelector('img')?.getAttribute('src')).toMatch(/Hoshino\.png/i);
    expect(avatar.querySelector(':scope > span[hidden]')?.textContent).toBe('小');
    expect(hoshino.querySelector('small')).toBeNull();
    senderList.scrollTop = 65;
    storyList.scrollTop = 0;
    directoryMode.click();
    expect(document.activeElement).toBe(dropdown);
    expect(cycle.textContent).toBe('故事目录');
    expect(storyList.scrollTop).toBe(45);
    expect(ctrl.storyEditor.state.sidebarMode).toBe('entries');
    expect(find<HTMLInputElement>('[data-editor-entry-search]').value).toBe('入口搜索');
    senderList.scrollTop = 0;
    senderMode.click();
    expect(senderList.scrollTop).toBe(65);
    expect(find('[data-editor-composer-text]')).toBe(composer);
  });

  it('updates the composer avatar immediately when the sender changes', () => {
    open(); click('new');
    const oldButton = find<HTMLButtonElement>('.story-editor-composer-speaker');
    expect(oldButton.textContent).toContain('旁');

    click('choose-sender');
    const hoshino = storySenders(createUIContext(game)).find(sender => sender.label === '小鸟游星野')!;
    find<HTMLButtonElement>(`[data-editor-sender="${hoshino.id}"]`).click(); ctrl.flushUIUpdates();
    const selectedButton = find<HTMLButtonElement>('.story-editor-composer-speaker');
    expect(selectedButton).not.toBe(oldButton);
    expect(selectedButton.getAttribute('aria-label')).toContain('小鸟游星野');
    expect(selectedButton.querySelector('.story-editor-sender-avatar img')?.getAttribute('src')).toMatch(/Hoshino\.png/i);

    click('choose-sender');
    find<HTMLButtonElement>('[data-editor-sender="teacher"]').click(); ctrl.flushUIUpdates();
    const teacherButton = find<HTMLButtonElement>('.story-editor-composer-speaker');
    expect(teacherButton).not.toBe(selectedButton);
    expect(teacherButton.getAttribute('aria-label')).toContain('老师');
    expect(teacherButton.querySelector('.story-editor-sender-avatar img')).toBeNull();
    expect(teacherButton.querySelector('.story-editor-sender-avatar')?.textContent).toBe('老');
  });

  it('switches node types from the top of the property column without changing node identity', () => {
    open(); click('new'); click('operation');
    const nodeId = currentNode(ctrl.storyEditor.state)!.id;
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-column-action^="story-editor-node-type:"]')];
    expect(tabs.map(tab => tab.textContent?.trim())).toEqual(['Talklet', 'Click', 'Operation', 'Transfer', '移动到 Area', '移动到 Chara']);
    expect(tabs.find(tab => tab.dataset.columnAction?.endsWith(':operation'))?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('[data-story-node-type]')).toBeNull();

    find<HTMLButtonElement>('[data-column-action="story-editor-node-type:talklet"]').click(); ctrl.flushUIUpdates();
    expect(currentNode(ctrl.storyEditor.state)?.type).toBe('talklet');
    expect(currentNode(ctrl.storyEditor.state)?.id).toBe(nodeId);
    find<HTMLButtonElement>('[data-column-action="story-editor-node-type:operation"]').click(); ctrl.flushUIUpdates();
    expect(currentNode(ctrl.storyEditor.state)?.type).toBe('operation');
    expect(currentNode(ctrl.storyEditor.state)?.id).toBe(nodeId);
  });

  it('creates all three voices and Click, edits, reorders, saves, and restores with a fresh controller', () => {
    open();
    click('new');
    const character = storySenders(createUIContext(game)).find(sender => sender.id.startsWith('character:'))!;
    expect(character).toBeTruthy();
    expect(find('.story-editor-composer-talklet').classList.contains('chat-talk')).toBe(true);
    expect(find('[data-editor-action="send"]').classList.contains('send-button')).toBe(true);
    for (const [sender, text] of [[character.id, '角色发言'], ['narrator', '旁白\n第二行'], ['teacher', '老师回复']]) {
      click('choose-sender');
      find<HTMLButtonElement>(`[data-editor-sender="${sender}"]`).click(); ctrl.flushUIUpdates();
      input('[data-editor-composer-text]', text);
      click('send');
    }
    click('click');
    input('[data-editor-field="text"]', '继续调查');
    click('up');
    const state = ctrl.storyEditor.state;
    expect(currentDraft(state)?.document.nodes.map(node => node.type)).toEqual(['talklet', 'talklet', 'click', 'talklet']);
    const first = find('[data-editor-node]');
    first.click(); ctrl.flushUIUpdates();
    input('[data-editor-field="text"]', '修改过的角色发言');
    click('save');
    const document = structuredClone(currentDraft(state)!.document);
    expect(find('[data-editor-status]').textContent).toBe('已保存');
    expect(root.querySelectorAll('[data-story-token], [data-send], [data-story-choice]')).toHaveLength(0);
    ctrl.destroy();
    ctrl = new UIController(game, root);
    ctrl.storyEditor.open();
    expect(currentDraft(ctrl.storyEditor.state)?.document).toEqual(document);
    expect(root.querySelectorAll('[data-editor-node]')).toHaveLength(4);
    expect(root.textContent).toContain('修改过的角色发言');
  });

  it('preserves live input identity, caret, sibling nodes and scroll through selection, text edits, and ticks', () => {
    open(); click('new');
    input('[data-editor-composer-text]', '第一条'); click('send');
    input('[data-editor-composer-text]', '第二条'); click('send');
    const frame = find('[data-workspace-frame="story-editor"]');
    const left = find('.story-editor-left');
    const flow = find('.story-editor-center .workspace-column__body');
    const compose = find<HTMLTextAreaElement>('[data-editor-composer-text]');
    const second = [...root.querySelectorAll('[data-editor-node]')][1];
    flow.scrollTop = 97;
    const before = ctrl.getRefreshStats().fullRenders;
    find('[data-editor-node]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    ctrl.flushUIUpdates();
    expect(currentNode(ctrl.storyEditor.state)?.id).toBe(find('[data-editor-node]').dataset.editorNode);
    const detail = find<HTMLTextAreaElement>('[data-editor-field="text"]');
    detail.focus(); detail.value = 'abXYcd'; detail.setSelectionRange(4, 4);
    detail.dispatchEvent(new Event('input', { bubbles: true }));
    ctrl.flushUIUpdates(); ctrl.refreshLight(); ctrl.flushUIUpdates();
    expect(document.activeElement).toBe(detail);
    expect(detail.selectionStart).toBe(4);
    expect(find('[data-editor-field="text"]')).toBe(detail);
    expect(find('[data-editor-composer-text]')).toBe(compose);
    expect(find('.story-editor-left')).toBe(left);
    expect(find('[data-workspace-frame="story-editor"]')).toBe(frame);
    expect([...root.querySelectorAll('[data-editor-node]')][1]).toBe(second);
    expect(flow.scrollTop).toBe(97);
    expect(ctrl.getRefreshStats().fullRenders).toBe(before);
    ctrl.refreshPanels(['center']);
    expect(find('[data-editor-composer-text]')).toBe(compose);
  });

  it('browses registered definitions without unlocking them, isolates edits, and keeps composer buffers on switches', () => {
    open();
    const rows = [...root.querySelectorAll<HTMLButtonElement>('[data-editor-story]')];
    expect(rows.length).toBe(game.registry.stories.size);
    const firstId = rows[0].dataset.editorStory!;
    const original = JSON.stringify(game.registry.stories.get(firstId.slice(7)));
    rows[0].click(); ctrl.flushUIUpdates();
    expect(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)).toBeNull();
    input('[data-editor-composer-text]', '尚未发送');
    click('rename'); input('[data-editor-field="name"]', '本地更名');
    const player = JSON.stringify(game.state);
    const history = JSON.stringify(ctrl.panelState.chatEntries);
    const secondId = rows[1].dataset.editorStory!;
    find<HTMLButtonElement>(`[data-editor-story="${secondId}"]`).click(); ctrl.flushUIUpdates();
    find<HTMLButtonElement>(`[data-editor-story="${firstId}"]`).click(); ctrl.flushUIUpdates();
    expect(find<HTMLTextAreaElement>('[data-editor-composer-text]').value).toBe('尚未发送');
    expect(currentDraft(ctrl.storyEditor.state)?.document.name).toBe('本地更名');
    expect(JSON.stringify(game.registry.stories.get(firstId.slice(7)))).toBe(original);
    expect(JSON.stringify(game.state)).toBe(player);
    expect(JSON.stringify(ctrl.panelState.chatEntries)).toBe(history);
    expect(root.querySelectorAll(`[data-editor-story="${firstId}"]`)).toHaveLength(1);
    input('[data-editor-search]', '没有这个故事');
    expect(root.querySelectorAll('[data-editor-story]')).toHaveLength(0);
    expect(currentDraft(ctrl.storyEditor.state)?.document.name).toBe('本地更名');
  });

  it('saves empty and incomplete drafts on switching and keeps each draft identity', () => {
    open(); click('new');
    const emptyId = currentDraft(ctrl.storyEditor.state)!.draftId;
    click('new'); click('operation'); click('transfer');
    const incompleteId = currentDraft(ctrl.storyEditor.state)!.draftId;
    click('save');
    const raw = JSON.parse(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)!);
    expect(raw.drafts.find((draft: { draftId: string }) => draft.draftId === emptyId).document.nodes).toEqual([]);
    expect(raw.drafts.find((draft: { draftId: string }) => draft.draftId === incompleteId).document.nodes.map((node: { type: string }) => node.type)).toEqual(['operation', 'transfer']);
    click('up');
    expect(currentNode(ctrl.storyEditor.state)?.type).toBe('transfer');
    expect(find<HTMLButtonElement>('[data-editor-action="up"]').disabled).toBe(true);
    click('delete-node');
    expect(currentNode(ctrl.storyEditor.state)).toBeUndefined();
    expect(find('[data-editor-field="name"]')).toBeTruthy();
  });

  it('blocks switching, new documents and topbar exit on write failure, keeping live content', () => {
    open(); click('new');
    input('[data-editor-composer-text]', '需要保留'); click('send');
    const id = ctrl.storyEditor.state.target;
    const storage = vi.spyOn(LocalStorageAdapter.prototype, 'set').mockImplementation(() => { throw new Error('quota exceeded'); });
    click('save');
    expect(root.textContent).toContain('quota exceeded');
    expect(currentDraft(ctrl.storyEditor.state)?.dirty).toBe(true);
    click('new'); expect(ctrl.storyEditor.state.target).toBe(id);
    const row = find<HTMLButtonElement>('[data-editor-story]');
    row.click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.target).toBe(id);
    const frame = find('[data-workspace-frame="story-editor"]');
    const renders = ctrl.getRefreshStats().fullRenders;
    find<HTMLButtonElement>('[data-service="settings"]').click(); ctrl.flushUIUpdates();
    expect(find('[data-workspace-frame="story-editor"]')).toBe(frame);
    expect(ctrl.getRefreshStats().fullRenders).toBe(renders);
    storage.mockRestore(); click('save');
    find<HTMLButtonElement>('[data-service="settings"]').click();
    expect(root.querySelector('[data-workspace-frame="settings"]')).not.toBeNull();
  });

  it('deletes only the local draft through confirmation and reopens the unchanged source', () => {
    open();
    const row = find<HTMLButtonElement>('[data-editor-story]');
    const sourceId = row.dataset.editorStory!.slice(7);
    row.click(); ctrl.flushUIUpdates(); click('rename'); input('[data-editor-field="name"]', '删除用草稿'); click('save');
    click('delete-draft');
    expect(currentDraft(ctrl.storyEditor.state)?.document.name).toBe('删除用草稿');
    document.querySelector<HTMLButtonElement>('[data-modal-action="delete-story-draft"]')!.click(); ctrl.flushUIUpdates();
    expect(currentDraft(ctrl.storyEditor.state)?.document.name).toBe(game.registry.stories.get(sourceId)!.name);
    expect(currentDraft(ctrl.storyEditor.state)?.persisted).toBe(false);
    expect(JSON.parse(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)!).drafts).toEqual([]);
  });

  it('renders and preserves every author node beyond the runtime flow limit, and escapes text', () => {
    open(); click('new');
    const state = ctrl.storyEditor.state;
    const senders = storySenders(createUIContext(game));
    for (let index = 0; index < 205; index++) {
      composer(state).text = `${index} <script>alert(1)</script>`;
      appendNode(state, 'text', senders);
    }
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();
    expect(root.querySelectorAll('[data-editor-node]')).toHaveLength(205);
    expect(find('.story-editor-flow').querySelector('script')).toBeNull();
    expect(find('.story-editor-flow').textContent).toContain('<script>alert(1)</script>');
    click('save');
    expect(currentDraft(state)?.document.nodes).toHaveLength(205);
  });

  it('restores the preceding service and uses local recovery if an editor region disappears', () => {
    ctrl.navigateToService('settings'); ctrl.render(); open();
    click('new');
    const shell = find('.console-shell');
    find('[data-workspace-frame="story-editor"]').remove();
    ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates();
    expect(find('.console-shell')).toBe(shell);
    expect(root.querySelectorAll('[data-workspace-frame="story-editor"]')).toHaveLength(1);
    find<HTMLButtonElement>('.story-editor-left [data-column-back]').click();
    expect(root.querySelector('[data-workspace-frame="settings"]')).not.toBeNull();
  });

  it('does not synchronize or send gameplay story pages when opening or using authoring', () => {
    ctrl.started = true;
    ctrl.render();
    const player = JSON.stringify(game.state);
    const history = JSON.stringify(ctrl.panelState.chatEntries);
    const sync = vi.spyOn(ctrl.chat, 'syncCurrentStory');
    const send = vi.spyOn(ctrl.commands, 'clickSend');
    find<HTMLButtonElement>('#story-editor-launch').click();
    click('new'); click('choose-sender');
    find<HTMLButtonElement>('[data-editor-sender="teacher"]').click(); ctrl.flushUIUpdates();
    input('[data-editor-composer-text]', '作者的台词'); click('send'); click('click');
    ctrl.refreshChatPanel(); ctrl.flushUIUpdates();
    expect(sync).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(JSON.stringify(game.state)).toBe(player);
    expect(JSON.stringify(ctrl.panelState.chatEntries)).toBe(history);
  });

  it('preserves corrupt storage and lets an unmodified session return without overwriting it', () => {
    localStorage.setItem(STORY_EDITOR_STORAGE_KEY, '{broken');
    open();
    expect(root.textContent).toContain('原数据已保留');
    find<HTMLButtonElement>('.story-editor-left [data-column-back]').click();
    expect(root.querySelector('.selector-shell')).not.toBeNull();
    expect(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)).toBe('{broken');
    ctrl.storyEditor.open();
    expect(find<HTMLButtonElement>('[data-editor-action="new"]').disabled).toBe(true);
  });

  it('keeps a draft on failed deletion and successfully deletes it after retry', () => {
    open(); click('new'); click('save');
    const draft = currentDraft(ctrl.storyEditor.state);
    const fail = vi.spyOn(LocalStorageAdapter.prototype, 'set').mockImplementation(() => { throw new Error('cannot delete'); });
    click('delete-draft');
    document.querySelector<HTMLButtonElement>('[data-modal-action="delete-story-draft"]')!.click(); ctrl.flushUIUpdates();
    expect(currentDraft(ctrl.storyEditor.state)).toBe(draft);
    expect(root.textContent).toContain('cannot delete');
    fail.mockRestore();
    click('delete-draft');
    document.querySelector<HTMLButtonElement>('[data-modal-action="delete-story-draft"]')!.click(); ctrl.flushUIUpdates();
    expect(currentDraft(ctrl.storyEditor.state)).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)!).drafts).toEqual([]);
  });

  it('keeps author drafts through an Init reset and isolates stored content from game saves', () => {
    open(); click('new'); input('[data-editor-composer-text]', '跨世界线草稿'); click('send'); click('save');
    const draftId = currentDraft(ctrl.storyEditor.state)!.draftId;
    const raw = localStorage.getItem(STORY_EDITOR_STORAGE_KEY);
    ctrl.resetSessionPanel();
    ctrl.storyEditor.open();
    expect(currentDraft(ctrl.storyEditor.state)?.draftId).toBe(draftId);
    expect(root.textContent).toContain('跨世界线草稿');
    expect(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)).toBe(raw);
    expect(JSON.stringify(ctrl.withHistories(ctrl.commands.save()))).not.toContain('跨世界线草稿');
  });

  it('restores a suspended workspace and preserves its original return navigation', () => {
    ctrl.started = true;
    ctrl.openContactsWorkspace(); ctrl.render();
    const workspace = ctrl.panelState.workspace;
    const navigation = ctrl.panelState.workspaceNavigation;
    find<HTMLButtonElement>('#story-editor-launch').click();
    click('new');
    find<HTMLButtonElement>('.story-editor-left [data-column-back]').click();
    expect(ctrl.panelState.workspace).toBe(workspace);
    expect(ctrl.panelState.workspaceNavigation).toBe(navigation);
    expect(root.querySelector('[data-workspace-frame="contacts"]')).not.toBeNull();
  });

  it('preserves natural Talklet height and the live chat alignment inside the selectable editor wrapper', () => {
    const style = document.createElement('style');
    style.textContent = ['chat.css', 'story-editor.css'].map(file => readFileSync(resolve(process.cwd(), 'src/ui/css', file), 'utf8')).join('\n');
    document.head.append(style);
    const live = document.createElement('div');
    live.className = 'chat-stream';
    const text = '第一行\n第二行：' + '长正文'.repeat(80);
    live.innerHTML = renderChatEntry(createUIContext(game), { kind: 'talk', speaker: '老师', side: 'right', text });
    document.body.append(live);
    try {
      open(); click('new');
      click('choose-sender');
      find<HTMLButtonElement>('[data-editor-sender="teacher"]').click(); ctrl.flushUIUpdates();
      input('[data-editor-composer-text]', text); click('send');
      const wrapper = find('[data-editor-node]');
      const wrapperStyle = getComputedStyle(wrapper);
      expect(wrapperStyle.display).toBe('flex');
      expect(wrapperStyle.flexDirection).toBe('column');
      expect(wrapperStyle.flexShrink).toBe('0');
      expect(wrapperStyle.height).toBe('auto');
      expect(getComputedStyle(find('.story-editor-flow')).flexShrink).toBe('0');
      const message = find('.story-editor-node .chat-talk');
      const expected = live.querySelector<HTMLElement>('.chat-talk')!;
      for (const property of ['alignSelf', 'alignItems', 'flexDirection', 'maxWidth', 'height', 'maxHeight'] as const) {
        expect(getComputedStyle(message)[property], property).toBe(getComputedStyle(expected)[property]);
      }
      expect(getComputedStyle(find('.story-editor-node .chat-bubble')).whiteSpace).not.toBe('pre-wrap');
      expect(getComputedStyle(find('.story-editor-node .chat-bubble p')).whiteSpace).toBe('pre-wrap');
      expect(find('.story-editor-node .chat-bubble p').textContent).toBe(text);
      // Selecting/editing retains the same intrinsic-size wrapper and message.
      wrapper.click(); ctrl.flushUIUpdates();
      input('[data-editor-field="text"]', '短句');
      expect(find('[data-editor-node]')).toBe(wrapper);
      expect(find('.story-editor-node .chat-talk')).toBe(message);
      expect(find('.story-editor-node .chat-bubble p').textContent).toBe('短句');
      expect(getComputedStyle(wrapper).height).toBe('auto');
    } finally { style.remove(); live.remove(); }
  });

  it('uses shared body scrolling and a fixed footer with independent list scrolling', () => {
    const style = document.createElement('style');
    style.textContent = ['layout.css', 'story-editor.css'].map(file => readFileSync(resolve(process.cwd(), 'src/ui/css', file), 'utf8')).join('\n');
    document.head.append(style);
    try {
      open(); click('new');
      const body = find('.story-editor-center .workspace-column__body');
      const footer = find('.story-editor-center .workspace-column__footer');
      expect(getComputedStyle(body).overflow).toBe('auto');
      expect(getComputedStyle(footer).flexShrink).toBe('0');
      expect(getComputedStyle(find('.story-editor-list')).overflowY).toBe('auto');
      expect(getComputedStyle(find('.story-editor-list')).getPropertyValue('scrollbar-width')).toBe('none');
      expect(getComputedStyle(find('[data-editor-directory-thumb]')).visibility).toBe('hidden');
      expect(body.contains(footer)).toBe(false);
      const stream = find('.story-editor-flow');
      expect(getComputedStyle(stream).overflowY).not.toBe('auto');
    } finally { style.remove(); }
  });

  it('tracks overflow and drags the sidebar thumb through the native list', () => {
    open();
    const list = find('[data-scroll-key="stories"]');
    const thumb = find('[data-editor-key="scroll:stories"] [data-editor-directory-thumb]');
    let contents = 400;
    Object.defineProperties(list, {
      clientHeight: { get: () => 100 },
      scrollHeight: { get: () => contents },
    });
    Object.defineProperty(thumb, 'setPointerCapture', { value: vi.fn() });
    const update = () => list.dispatchEvent(new Event('scroll'));
    const pointer = (name: string, y: number) => thumb.dispatchEvent(new PointerEvent(name, { pointerId: 1, clientY: y }));
    update();
    expect(thumb.hasAttribute('data-overflow')).toBe(true);
    expect(thumb.style.height).toBe('25px');
    expect(thumb.style.transform).toBe('translateY(0px)');
    list.scrollTop = 150;
    update();
    expect(thumb.style.transform).toBe('translateY(37.5px)');
    pointer('pointerdown', 5);
    pointer('pointermove', 30);
    expect(list.scrollTop).toBe(250);
    pointer('pointerup', 30);
    pointer('pointermove', 5);
    expect(list.scrollTop).toBe(250);
    contents = 100;
    update();
    expect(thumb.hasAttribute('data-overflow')).toBe(false);
  });

  it('explicitly saves a new StoryDef into Registry and keeps one source/draft list row', () => {
    open(); click('new'); input('[data-editor-composer-text]', '可执行的正文'); click('send');
    const draft = currentDraft(ctrl.storyEditor.state)!;
    expect(game.registry.stories.has(draft.document.id)).toBe(false);
    click('save');
    expect(game.registry.stories.has(draft.document.id)).toBe(false);
    const compose = find('[data-editor-composer-text]');
    click('save-to-runtime');
    expect(game.registry.stories.get(draft.document.id)).toEqual(draft.document);
    expect(draft.sourceId).toBe(draft.document.id);
    expect(root.querySelectorAll(`[data-editor-story="${draft.draftId}"]`)).toHaveLength(1);
    expect(find('[data-editor-composer-text]')).toBe(compose);
    expect(root.textContent).toContain('已保存到运行内容');
    const saved = JSON.parse(localStorage.getItem(STORY_EDITOR_STORAGE_KEY)!);
    expect(saved.drafts.find((item: { draftId: string }) => item.draftId === draft.draftId).sourceId).toBe(draft.document.id);
  });

  it('replaces an existing StoryDef only on the explicit Runtime button', () => {
    open(); find<HTMLButtonElement>('[data-editor-story]').click(); ctrl.flushUIUpdates();
    const draft = currentDraft(ctrl.storyEditor.state)!;
    const original = game.registry.stories.get(draft.document.id)!;
    click('rename'); input('[data-editor-field="name"]', '真正写入的名称'); click('save');
    expect(game.registry.stories.get(original.id)).toBe(original);
    click('save-to-runtime');
    expect(game.registry.stories.get(original.id)?.name).toBe('真正写入的名称');
    expect(original.name).not.toBe('真正写入的名称');
  });

  it('keeps a second Choice through draft save, explicit Registry publish, and content reload', () => {
    open();
    const id = 'base:story:schale_welcome';
    find<HTMLButtonElement>(`[data-editor-story="source:${id}"]`).click(); ctrl.flushUIUpdates();
    const draft = currentDraft(ctrl.storyEditor.state)!;
    const position = draft.document.nodes.findIndex(node => node.id === 'p6-choice') + 1;
    draft.document = { ...draft.document, stages: { ...draft.document.stages, extra: { advance: 'input' } } };
    draft.document.nodes.splice(position, 0, { id: 'second-choice', type: 'click', stageId: 'extra', interaction: {
      kind: 'choice', options: [
        { id: 'foo', text: 'foo', marks: ['mygo'] },
      ],
    } });
    draft.dirty = true;
    const authored = structuredClone(draft.document);
    click('save');
    expect(draft.dirty).toBe(false);
    expect(game.registry.stories.get(id)?.nodes.some(node => node.id === 'second-choice')).toBe(false);
    click('save-to-runtime');
    expect(game.registry.stories.get(id)).toEqual(authored);

    ctrl.destroy();
    game.init([baseDatapack]);
    ctrl = new UIController(game, root);
    open();
    expect(currentDraft(ctrl.storyEditor.state)?.document).toEqual(authored);
    expect(game.registry.stories.get(id)?.nodes.some(node => node.id === 'second-choice')).toBe(false);
    click('save-to-runtime');
    expect(game.registry.stories.get(id)).toEqual(authored);
  });

  it('omits an empty Operation placeholder while rejecting other invalid Runtime content', () => {
    open(); click('new'); click('operation');
    const draft = currentDraft(ctrl.storyEditor.state)!;
    click('save'); click('save-to-runtime');
    expect(root.textContent).toContain('已保存到运行内容，仅当前运行有效');
    expect(game.registry.stories.get(draft.document.id)?.nodes).toEqual([]);
    const savedEmpty = game.registry.stories.get(draft.document.id)!;
    expect(draft.persisted).toBe(true);
    click('delete-node'); click('click'); click('save-to-runtime');
    expect(root.textContent).toContain('nodes[0].interaction.text：必须是非空字符串');
    expect(game.registry.stories.get(draft.document.id)).toBe(savedEmpty);
    input('[data-editor-field="text"]', '继续'); click('save-to-runtime');
    expect(game.registry.stories.get(draft.document.id)).toEqual(draft.document);
  });

  it('reports Runtime success separately if the subsequent local draft write fails', () => {
    open(); click('new'); input('[data-editor-composer-text]', '运行内容'); click('send');
    const draft = currentDraft(ctrl.storyEditor.state)!;
    vi.spyOn(LocalStorageAdapter.prototype, 'set').mockImplementation(() => { throw new Error('quota'); });
    click('save-to-runtime');
    expect(game.registry.stories.get(draft.document.id)).toEqual(draft.document);
    expect(root.textContent).toContain('运行内容已更新，本地草稿保存失败');
    expect(root.textContent).toContain('quota');
    expect(draft.dirty).toBe(true);
  });
});
