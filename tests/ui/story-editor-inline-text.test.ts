// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { currentDraft, type StoryDraft, type StoryEditorState } from '../../src/ui/story-editor/model';
import { moveRowBy, readProperty, readStoryNodeBody, rowIdAt, type PropertyPath } from '../../src/ui/story-editor/property-model';
import { StoryDraftPersistence } from '../../src/ui/story-editor/persistence';
import '../../src/ui/runtime/service-definitions';

describe('Story editor inline text', () => {
  let game: GameInstance, ctrl: UIController, root: HTMLElement, draft: StoryDraft;
  const find = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const element = root.querySelector<T>(selector); expect(element, selector).not.toBeNull(); return element!;
  };
  const refresh = () => { ctrl.storyEditor.requestRefresh(); ctrl.flushUIUpdates(); };
  const text = (id: string, selector: string) => find(`[data-editor-node="${id}"] ${selector}`);
  const begin = (element: HTMLElement) => { element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); ctrl.flushUIUpdates(); };
  const type = (element: HTMLElement, value: string, composing = false) => {
    element.textContent = value; element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: composing })); ctrl.flushUIUpdates();
  };
  const escape = (element: HTMLElement) => { element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ctrl.flushUIUpdates(); };
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>'; root = document.querySelector('#app')!;
    game = new GameInstance(); game.init([structuredClone(baseDatapack)]); ctrl = new UIController(game, root);
    ctrl.render(); ctrl.storyEditor.open(); find<HTMLButtonElement>('[data-editor-action="new"]').click(); ctrl.flushUIUpdates();
    draft = currentDraft(ctrl.storyEditor.state)!;
    draft.document = { ...draft.document, startContext: { type: 'area', areaId: [...game.registry.areas.keys()][0] }, nodes: [
      { id: 'talk', type: 'talklet', stageId: 'one', content: { kind: 'talk', speaker: '老师', text: '原对话' } },
      { id: 'narration', type: 'talklet', stageId: 'one', content: { kind: 'narration', text: '原旁白' } },
      { id: 'choice', type: 'click', stageId: 'one', interaction: { kind: 'choice', options: [{ id: 'a', text: '第一项' }, { id: 'b', text: '第二项' }] } },
      { id: 'button', type: 'click', stageId: 'one', interaction: { kind: 'button', text: '继续' } },
      { id: 'entry', type: 'click', stageId: 'one', interaction: { kind: 'entryCard', card: { title: '标题', request: { entryType: 'active', entryId: 'missing:entry', intent: 'card', owner: null } } } },
      { id: 'area', type: 'click', stageId: 'one', interaction: { kind: 'areaContinue', areaId: [...game.registry.areas.keys()][0] } },
      { id: 'legacy', type: 'click', stageId: 'one', interaction: { kind: 'kizunaCard' } },
    ] }; refresh();
  });
  afterEach(() => { ctrl.modal.close(); ctrl.destroy(); game.stop(); vi.restoreAllMocks(); localStorage.clear(); });

  it('edits the existing bubble and synchronizes the inspector without replacing text, focus, selection, siblings or scroll', () => {
    const element = text('talk', '.chat-bubble p'), sibling = text('narration', '.chat-narration-text');
    const body = find('.story-editor-center .workspace-column__body'); body.scrollTop = 97;
    element.click(); ctrl.flushUIUpdates(); expect(element.hasAttribute('contenteditable')).toBe(false);
    begin(element); expect(element.getAttribute('contenteditable')).toBe('plaintext-only');
    expect(ctrl.storyEditor.state.selectedNodeId).toBe('talk'); expect(document.activeElement === element).toBe(true);
    const full = vi.spyOn(ctrl, 'render');
    element.textContent = '第一行\n第二行';
    const child = element.firstChild!;
    const range = document.createRange(); range.setStart(child, 2); range.collapse(true);
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    element.dispatchEvent(new InputEvent('input', { bubbles: true })); ctrl.flushUIUpdates();
    expect(readProperty(draft, 'talk', ['content', 'text'])).toBe('第一行\n第二行');
    expect(find<HTMLTextAreaElement>('[data-story-body-node="talk"]').value).toBe('第一行\n第二行');
    expect(text('talk', '.chat-bubble p') === element).toBe(true); expect(element.firstChild === child).toBe(true);
    expect(selection.anchorNode === child).toBe(true); expect(selection.anchorOffset).toBe(2);
    expect(document.activeElement === element).toBe(true); expect(body.scrollTop).toBe(97);
    expect(text('narration', '.chat-narration-text') === sibling).toBe(true); expect(full).not.toHaveBeenCalled();
    const drag = new Event('dragstart', { bubbles: true, cancelable: true }); element.dispatchEvent(drag); expect(drag.defaultPrevented).toBe(true);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); ctrl.flushUIUpdates();
    expect(element.hasAttribute('contenteditable')).toBe(false); expect(readStoryNodeBody(draft, 'talk')).toBe('第一行\n第二行');
  });

  it('edits each Choice independently and keeps the same option editor when rows move', () => {
    const option = text('choice', '.choice-option-row:nth-child(2) .choice-option-text'); begin(option); type(option, '只修改第二项');
    expect(readProperty(draft, 'choice', ['interaction', 'options', 0, 'text'])).toBe('第一项');
    expect(readProperty(draft, 'choice', ['interaction', 'options', 1, 'text'])).toBe('只修改第二项');
    moveRowBy(draft, 'choice', ['interaction', 'options'], rowIdAt(draft, 'choice', ['interaction', 'options'], 1)!, -1); refresh();
    expect(text('choice', '.choice-option-row:nth-child(1) .choice-option-text') === option).toBe(true);
    type(option, '移动后修改');
    expect(readProperty(draft, 'choice', ['interaction', 'options', 0])).toMatchObject({ id: 'b', text: '移动后修改' });
    escape(option);
    expect(readProperty(draft, 'choice', ['interaction', 'options', 0])).toMatchObject({ id: 'b', text: '第二项' });
    expect(readProperty(draft, 'choice', ['interaction', 'options', 1, 'text'])).toBe('第一项');
  });

  it('supports narration, button labels, card title and footer, area continuation and legacy cards', () => {
    const cases: [string, string, PropertyPath][] = [
      ['narration', '.chat-narration-text', ['content', 'text']],
      ['button', '.send-text', ['interaction', 'text']],
      ['entry', '.yuzu-kizuna-header .text', ['interaction', 'card', 'title']],
      ['entry', '.yuzu-kizuna-footer .text', ['interaction', 'card', 'buttonText']],
      ['area', '.yuzu-kizuna-footer .text', ['interaction', 'buttonText']],
      ['legacy', '.yuzu-kizuna-footer .text', ['interaction', 'buttonText']],
    ];
    for (const [id, selector, path] of cases) {
      const original = readProperty(draft, id, path), element = text(id, selector); begin(element);
      expect(element.textContent).toBe(original ?? ''); type(element, '新文案');
      expect(readProperty(draft, id, path)).toBe('新文案'); escape(element);
      expect(readProperty(draft, id, path)).toBe(original);
    }
    expect(game.storyService.getCurrentStoryId()).not.toBe(draft.document.id);
  });

  it('preserves IME composition through refresh and pastes only plain text', () => {
    const element = text('talk', '.chat-bubble p'); begin(element);
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    type(element, '输入中', true); const child = element.firstChild;
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true })); refresh();
    expect(element.firstChild === child).toBe(true); expect(element.hasAttribute('contenteditable')).toBe(true);
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); ctrl.flushUIUpdates();
    expect(find<HTMLTextAreaElement>('[data-story-body-node="talk"]').value).toBe('输入中');
    const range = document.createRange(); range.selectNodeContents(element);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: (format: string) => format === 'text/plain' ? '<b>纯文本</b>\n下一行' : '<img src=x onerror=alert(1)>' } });
    element.dispatchEvent(paste); ctrl.flushUIUpdates();
    expect(paste.defaultPrevented).toBe(true); expect(element.querySelector('b, img')).toBeNull();
    expect(readProperty(draft, 'talk', ['content', 'text'])).toBe('<b>纯文本</b>\n下一行');
    escape(element); expect(readStoryNodeBody(draft, 'talk')).toBe('原对话');
  });

  it('commits on save and leaving, persists the body, and ignores events from a deleted or readonly field', () => {
    const element = text('talk', '.chat-bubble p'); begin(element); type(element, '保存的正文');
    expect(ctrl.storyEditor.save()).toBe(true); ctrl.flushUIUpdates();
    expect(element.hasAttribute('contenteditable')).toBe(false);
    const restored: StoryEditorState = { ...ctrl.storyEditor.state, drafts: [] };
    new StoryDraftPersistence().load(restored); expect(restored.storageBlocked).toBe(false);
    expect(restored.drafts.find(item => item.draftId === draft.draftId)?.document.nodes[0]).toMatchObject({ content: { text: '保存的正文' } });
    begin(element); type(element, '离开前正文'); expect(ctrl.storyEditor.beforeLeave()).toBe(true); ctrl.flushUIUpdates();
    expect(element.hasAttribute('contenteditable')).toBe(false);
    begin(element); draft.document.nodes = draft.document.nodes.filter(node => node.id !== 'talk'); refresh();
    type(element, '迟到的输入'); expect(draft.document.nodes.some(node => node.id === 'talk')).toBe(false);
    ctrl.storyEditor.state.storageBlocked = true; refresh();
    const readonly = text('narration', '.chat-narration-text'); begin(readonly);
    expect(readonly.hasAttribute('contenteditable')).toBe(false);
  });

  it('stores one final newline from native Enter and preserves intentional pasted trailing newlines', () => {
    const element = text('talk', '.chat-bubble p'); begin(element);
    element.replaceChildren(document.createTextNode('第一行'), document.createTextNode('\n'), document.createTextNode('\n'));
    const placeholder = element.lastChild!, range = document.createRange(); range.setStart(placeholder, 0); range.collapse(true);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertParagraph' })); ctrl.flushUIUpdates();
    expect(readStoryNodeBody(draft, 'talk')).toBe('第一行\n');
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '粘贴\n\n' } });
    element.dispatchEvent(paste); ctrl.flushUIUpdates();
    expect(readStoryNodeBody(draft, 'talk')).toBe('第一行\n粘贴\n\n');
    ctrl.storyEditor.save(); expect(readStoryNodeBody(draft, 'talk')).toBe('第一行\n粘贴\n\n');
  });

  it('leaves untouched drafts clean on Escape and lets an outside click finish composition before closing', () => {
    const element = text('narration', '.chat-narration-text'); draft.dirty = false;
    begin(element); escape(element); expect(draft.dirty).toBe(false);
    begin(element); element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); type(element, '未完成', true);
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); ctrl.flushUIUpdates();
    expect(element.hasAttribute('contenteditable')).toBe(true);
    element.textContent = '最终中文'; element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); ctrl.flushUIUpdates();
    expect(readStoryNodeBody(draft, 'narration')).toBe('最终中文'); expect(element.hasAttribute('contenteditable')).toBe(false);
    begin(element);
    draft.document.nodes = draft.document.nodes.map(node => node.id === 'narration' && node.type === 'talklet'
      ? { ...node, content: { ...node.content, kind: 'talk' as const } } : node); refresh();
    type(element, '旧分支事件');
    expect(readProperty(draft, 'narration', ['content', 'text'])).toBe('最终中文');
  });
});
