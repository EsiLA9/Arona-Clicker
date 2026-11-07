import { createStoryForTest } from './story-editor-test-helpers';
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import { UIController } from '../../src/ui/controller/controller';
import { createUIContext } from '../../src/ui/runtime/context';
import { renderChatEntry, renderChatTexts } from '../../src/ui/components/story/story';
import { chatEntryToFlowContent, flowEntryFromTalklet } from '../../src/ui/flow/flow-entry';
import { currentDraft, createStoryEditorState, senderForNode, type StoryDraft, type StoryDraftNode } from '../../src/ui/story-editor/model';
import { storySenders } from '../../src/ui/story-editor/view';
import { StoryDraftPersistence } from '../../src/ui/story-editor/persistence';
import { projectStoryDefinition } from '../../src/data-services/authoring/story-definition-projection';
import '../../src/ui/runtime/service-definitions';

describe('Story speaker identity and temporary display name', () => {
  let game: GameInstance, root: HTMLElement, ctrl: UIController | undefined;
  const avatarId = 'test:avatar(pic):override';
  const find = <T extends HTMLElement = HTMLElement>(selector: string): T => {
    const el = root.querySelector<T>(selector); expect(el, selector).not.toBeNull(); return el!;
  };
  const markup = (entry: Parameters<typeof renderChatEntry>[1]) => {
    const el = document.createElement('div'); el.innerHTML = renderChatEntry(createUIContext(game), entry); return el;
  };
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>'; root = document.querySelector('#app')!;
    const pack = structuredClone(baseDatapack); pack.pics = [...(pack.pics ?? []), { id: avatarId, src: 'https://example.com/story-avatar.png' }];
    game = new GameInstance(); game.init([pack]);
  });
  afterEach(() => { ctrl?.destroy(); ctrl = undefined; game.stop(); vi.restoreAllMocks(); localStorage.clear(); });
  const character = () => [...game.registry.characters.values()][0];
  const refresh = () => { ctrl!.storyEditor.requestRefresh(); ctrl!.flushUIUpdates(); };
  function editor(nodes: StoryDraftNode[]): StoryDraft {
    ctrl = new UIController(game, root); ctrl.render(); ctrl.storyEditor.open();
    createStoryForTest(game,ctrl); ctrl.flushUIUpdates();
    const draft = currentDraft(ctrl.storyEditor.state)!;
    draft.document = { ...draft.document, startContext: { type: 'area', areaId: [...game.registry.areas.keys()][0] }, nodes };
    refresh(); return draft;
  }
  const name = () => find('[data-editor-node="line"] .chat-name');
  const begin = () => { name().dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); ctrl!.flushUIUpdates(); };
  const type = (text: string) => { const el = name(); el.textContent = text; el.dispatchEvent(new InputEvent('input', { bubbles: true })); ctrl!.flushUIUpdates(); };

  it('uses character defaults and keeps that avatar for aliases, including another existing character name', () => {
    const char = character(), other = [...game.registry.characters.values()][1];
    const original = markup({ kind: 'talk', text: '正文', characterId: char.id });
    expect(original.querySelector('.chat-name')?.textContent).toBe(char.displayName);
    for (const displayName of ['临时代号', other.displayName, '']) {
      const updated = markup({ kind: 'talk', text: '正文', characterId: char.id, displayName });
      expect(updated.querySelector('.chat-name')?.textContent).toBe(displayName || char.displayName);
      expect(updated.querySelector('.chat-avatar')?.outerHTML).toBe(original.querySelector('.chat-avatar')?.outerHTML);
    }
    const override = markup({ kind: 'talk', text: '正文', characterId: char.id, displayName: '临时名', avatar: avatarId });
    expect(override.querySelector('.chat-avatar img')?.getAttribute('src')).toBe('https://example.com/story-avatar.png');
    expect(override.querySelector('.chat-avatar svg')).toBeNull();
    const restored = markup({ kind: 'talk', text: '正文', characterId: char.id, displayName: '临时名', avatar: 'missing:avatar(pic):ref' });
    expect(restored.querySelector('.chat-avatar')?.outerHTML).toBe(original.querySelector('.chat-avatar')?.outerHTML);
    expect(markup({ kind: 'talk', text: '正文', characterId: char.id, avatar: avatarId, noAvatar: true }).querySelector('.chat-avatar')).toBeNull();
  });

  it('preserves legacy speakers, unknown senders and the teacher avatar when applying a display-name override', () => {
    for (const original of [{ speaker: character().displayName }, { speaker: '神秘来客' }, { speaker: '老师', side: 'right' as const }]) {
      const baseline = markup({ kind: 'talk', text: '旧正文', ...original });
      const renamed = markup({ kind: 'talk', text: '旧正文', ...original, displayName: [...game.registry.characters.values()][1].displayName });
      expect(renamed.querySelector('.chat-avatar')?.outerHTML).toBe(baseline.querySelector('.chat-avatar')?.outerHTML);
    }
  });

  it('hides initials behind picture avatars and restores them only when the image fails', () => {
    const style = document.createElement('style');
    style.textContent = readFileSync('src/ui/css/chat.css', 'utf8'); document.head.append(style);
    const variant = game.registry.characterVariants.get('Hoshino')!;
    variant.colorGroupId = undefined;
    try {
      for (const source of [{ speaker: '神秘来客', avatar: avatarId }, { speaker: variant.id }]) {
        for (const kind of ['talk', 'typing'] as const) {
          const entry = markup({ kind, text: '正文', ...source }); root.replaceChildren(entry);
          const image = entry.querySelector<HTMLImageElement>('.chat-avatar img')!;
          const fallback = entry.querySelector<HTMLElement>('.chat-avatar-fallback')!;
          expect(image).not.toBeNull();
          expect(getComputedStyle(fallback).display).toBe('none');
          image.dispatchEvent(new Event('load'));
          expect(getComputedStyle(fallback).display).toBe('none');
          // happy-dom 不编译 HTML 内联事件；执行渲染器实际输出的失败处理。
          new Function(image.getAttribute('onerror')!).call(image);
          expect(entry.querySelector('.chat-avatar img')).toBeNull();
          expect(getComputedStyle(fallback).display).toBe('flex');
          expect(fallback.textContent).not.toBe('');
        }
      }
    } finally { style.remove(); }
  });

  it('edits the existing sender name, synchronizes the inspector, and cancels without changing identity or the avatar', () => {
    const char = character();
    const draft = editor([{ id: 'line', type: 'talklet', stageId: 'one', content: { kind: 'talk', text: '正文', characterId: char.id } }]);
    const label = name(), avatar = find('[data-editor-node="line"] .chat-avatar'), avatarHTML = avatar.outerHTML;
    const body = find('.story-editor-center .workspace-column__body'); body.scrollTop = 77;
    const full = vi.spyOn(ctrl!, 'render'); begin();
    expect(name() === label).toBe(true); expect(name().textContent).toBe(char.displayName);
    expect(name().getAttribute('aria-label')).toBe('原位编辑发出方显示名');
    type('临时显示名');
    const node = draft.document.nodes[0]; expect(node).toMatchObject({ content: { characterId: char.id, displayName: '临时显示名' } });
    expect(senderForNode(node as Extract<StoryDraftNode, { type: 'talklet' }>, storySenders(createUIContext(game)))).toBe(`character:${char.id}`);
    const picker = find<HTMLSelectElement>('[data-editor-field="sender"]');
    // happy-dom misreports select.value even for a freshly parsed equivalent template.
    expect([...picker.options].find(option => option.hasAttribute('selected'))?.value).toBe(`character:${char.id}`);
    expect(find<HTMLInputElement>('[data-story-property-path=\'["content","displayName"]\']').value).toBe('临时显示名');
    expect(find('[data-editor-node="line"] .chat-avatar') === avatar).toBe(true); expect(avatar.outerHTML).toBe(avatarHTML);
    expect(document.activeElement === label).toBe(true); expect(body.scrollTop).toBe(77); expect(full).not.toHaveBeenCalled();
    label.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ctrl!.flushUIUpdates();
    expect(draft.document.nodes[0]).toMatchObject({ content: { characterId: char.id } });
    expect(draft.document.nodes[0]).not.toHaveProperty('content.displayName'); expect(name().textContent).toBe(char.displayName);
  });

  it('updates aliases from either editor, clears to the default name, and preserves an explicit avatar across save/load', () => {
    const char = character(), draft = editor([{ id: 'line', type: 'talklet', stageId: 'one', content: { kind: 'talk', text: '正文', speaker: char.displayName }, presentation: { avatar: avatarId } }]);
    begin(); type('第一次改名');
    name().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); ctrl!.flushUIUpdates();
    const field = find<HTMLInputElement>('[data-story-property-path=\'["content","displayName"]\']');
    field.value = '属性栏改名'; field.dispatchEvent(new Event('input', { bubbles: true })); ctrl!.flushUIUpdates();
    expect(name().textContent).toBe('属性栏改名'); expect(draft.document.nodes[0]).toMatchObject({ content: { speaker: char.displayName } });
    expect(find<HTMLImageElement>('[data-editor-node="line"] .chat-avatar img').src).toBe('https://example.com/story-avatar.png');
    ctrl!.storyEditor.save(); const restored = createStoryEditorState(); new StoryDraftPersistence().load(restored);
    expect(restored.storageBlocked).toBe(false); expect(restored.drafts[0].document.nodes[0]).toMatchObject({ content: { displayName: '属性栏改名' }, presentation: { avatar: avatarId } });
    begin(); type(''); ctrl!.storyEditor.save(); refresh(); expect(name().textContent).toBe(char.displayName);
    expect(draft.document.nodes[0]).not.toHaveProperty('content.displayName');
    begin();
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => '单行\n显示名' } });
    const range = document.createRange(); range.selectNodeContents(name());
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    name().dispatchEvent(paste); ctrl!.flushUIUpdates();
    expect(name().textContent).toBe('单行 显示名');
  });

  it('keeps identity and alias in typing, history adapters and overlay rendering', () => {
    const data = { characterId: character().id, displayName: '临时名称', speaker: '旧名称', text: '正文', avatar: avatarId };
    const flow = flowEntryFromTalklet({ talklet: { kind: 'talk', ...data }, streamKey: 'chat:test', instanceKey: 'test' });
    const history = chatEntryToFlowContent({ id: 1, kind: 'talk', timestamp: 0, ...data });
    expect(flow).toMatchObject(data); expect(history).toMatchObject(data);
    const typing = markup({ kind: 'typing', ...data }); expect(typing.querySelector('.chat-name')?.textContent).toBe('临时名称');
    const overlay = document.createElement('div'); overlay.innerHTML = renderChatTexts(createUIContext(game), [{ id: 'text', x: 0, y: 0, align: 'left', timestamp: 0, talklet: { kind: 'talk', ...data } }]);
    expect(overlay.querySelector('.chat-name')?.textContent).toBe('临时名称');
    expect(overlay.querySelector('.chat-avatar img')?.getAttribute('src')).toBe('https://example.com/story-avatar.png');
  });

  it('validates the character reference and the talk-only override, without interpreting the display name as a reference', () => {
    const story = { id: 'test:story:speaker', name: 'speaker', startContext: { type: 'area' as const, areaId: [...game.registry.areas.keys()][0] }, stages: { one: { advance: 'auto' as const } }, nodes: [
      { id: 'line', type: 'talklet', stageId: 'one', content: { kind: 'talk', text: '正文', characterId: character().id, displayName: '任意名称' } },
    ] };
    expect(projectStoryDefinition(story, { characters: game.registry.characters }).ok).toBe(true);
    expect(projectStoryDefinition({ ...story, nodes: [{ ...story.nodes[0], content: { ...story.nodes[0].content, characterId: 'missing:character' } }] }, { characters: game.registry.characters }).ok).toBe(false);
    expect(projectStoryDefinition({ ...story, nodes: [{ ...story.nodes[0], content: { kind: 'narration', text: '正文', displayName: '名字' } }] }).ok).toBe(false);
  });
});
