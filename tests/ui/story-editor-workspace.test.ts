// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { appendNode, composer, currentDraft, currentNode } from '../../src/ui/story-editor/model';
import { STORY_EDITOR_STORAGE_KEY } from '../../src/ui/story-editor/persistence';
import { createUIContext } from '../../src/ui/runtime/context';
import { storySenders } from '../../src/ui/story-editor/view';
import { UI_HOST_REGISTRY } from '../../src/ui/runtime/ui-host-registry';
import { renderChatEntry } from '../../src/ui/components/story/story';
import { LocalStorageAdapter } from '../../src/data-services/persistence/storage-adapter';
import '../../src/ui/runtime/service-definitions';

describe('Story Editor workspace prototype', () => {
  let game: GameInstance;
  let ctrl: UIController;
  let root: HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const node = root.querySelector<T>(selector);
    expect(node, selector).not.toBeNull();
    return node!;
  };
  const click = (action: string): void => { find<HTMLButtonElement>(`[data-editor-action="${action}"]`).click(); ctrl.flushUIUpdates(); };
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
  afterEach(() => {
    vi.restoreAllMocks();
    ctrl.modal.close();
    ctrl.destroy();
    game.stop();
    localStorage.clear();
  });

  it('edits one gate and local flag actions, keeps focused controls, and never publishes unfinished values', () => {
    open();
    click('new');
    click('operation');
    input('[data-editor-field="requires-flag"]', 'StoryName-started');
    input('[data-editor-field="local-flag-op"]', 'set');
    input('[data-editor-field="local-flag-name"]', '自由名称');
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

  it('creates all three voices and Click, edits, reorders, saves, and restores with a fresh controller', () => {
    open();
    click('new');
    const role = find<HTMLSelectElement>('[data-editor-composer-sender]');
    const character = [...role.options].find(option => option.value.startsWith('character:'))!;
    expect(character).toBeTruthy();
    for (const [sender, text] of [[character.value, '角色发言'], ['narrator', '旁白\n第二行'], ['teacher', '老师回复']]) {
      input('[data-editor-composer-sender]', sender);
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
    const id = ctrl.storyEditor.state.currentId;
    const storage = vi.spyOn(LocalStorageAdapter.prototype, 'set').mockImplementation(() => { throw new Error('quota exceeded'); });
    click('save');
    expect(root.textContent).toContain('quota exceeded');
    expect(currentDraft(ctrl.storyEditor.state)?.dirty).toBe(true);
    click('new'); expect(ctrl.storyEditor.state.currentId).toBe(id);
    const row = find<HTMLButtonElement>('[data-editor-story]');
    row.click(); ctrl.flushUIUpdates();
    expect(ctrl.storyEditor.state.currentId).toBe(id);
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
    click('new'); input('[data-editor-composer-sender]', 'teacher');
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
      input('[data-editor-composer-sender]', 'teacher');
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
      expect(body.contains(footer)).toBe(false);
      const stream = find('.story-editor-flow');
      expect(getComputedStyle(stream).overflowY).not.toBe('auto');
    } finally { style.remove(); }
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

  it('keeps incomplete drafts saveable while rejecting invalid Runtime content', () => {
    open(); click('new'); click('operation');
    const draft = currentDraft(ctrl.storyEditor.state)!;
    click('save'); click('save-to-runtime');
    expect(root.textContent).toContain('nodes[0].action：StoryAction 必须是对象');
    expect(game.registry.stories.has(draft.document.id)).toBe(false);
    expect(draft.persisted).toBe(true);
    click('delete-node'); click('click'); click('save-to-runtime');
    expect(root.textContent).toContain('nodes[0].interaction.text：必须是非空字符串');
    expect(game.registry.stories.has(draft.document.id)).toBe(false);
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
