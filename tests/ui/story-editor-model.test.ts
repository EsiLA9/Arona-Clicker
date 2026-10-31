import { describe, expect, it } from 'vitest';
import type { StoryDef } from '../../src/data-services/contracts/story';
import type { StorageAdapter } from '../../src/data-services/persistence/storage-adapter';
import { appendNode, composer, createStoryEditorState, currentDraft, deleteNode, editNode, editNodeFlag, moveNode, newStory, renameStory, selectStory, storyDefinitionFromDraft, storyList, type StorySender } from '../../src/ui/story-editor/model';
import { StoryDraftPersistence, STORY_EDITOR_STORAGE_KEY } from '../../src/ui/story-editor/persistence';

const senders: StorySender[] = [{ id: 'narrator', label: '旁白' }, { id: 'teacher', label: '老师', speaker: '老师' }, { id: 'character:hoshino', label: '星野', speaker: '星野' }];
const source: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'test:story:source', name: '原始 Story', nodes: [
  { id: 'text', type: 'talklet', stageId: 'one', content: { kind: 'talk', speaker: '未注册角色', text: '原文', image: 'test:pic:photo' }, presentation: { side: 'left', avatarMode: 'show', align: 'left' }, pacing: { typing: 2 } },
  { id: 'choice', type: 'click', stageId: 'one', interaction: { kind: 'choice', options: [{ id: 'yes', text: '同意' }] } },
  { id: 'op', type: 'operation', action: { kind: 'travel', areaId: 'test:area:home' } },
  { id: 'transfer', type: 'transfer', transfer: { mode: 'insert', storyId: 'test:story:next' } },
], stages: { one: { advance: 'input' } }, extra: { t: 'dict', v: { note: { t: 'str', v: '作者附加信息' } } } };
const sources = new Map([[source.id, source]]);
class MemoryStorage implements StorageAdapter {
  values = new Map<string, string>();
  fail = false;
  get(key: string): string | null { return this.values.get(key) ?? null; }
  set(key: string, value: string): void { if (this.fail) throw new Error('quota'); this.values.set(key, value); }
  remove(key: string): void { this.values.delete(key); }
}

describe('Story Editor authoring model and persistence', () => {
  it('retains a source composite local value through remove, draft reload, and switching back to set', () => {
    const state = createStoryEditorState();
    const draft = newStory(state);
    const node = appendNode(state, 'operation', senders)!;
    const value = { route: ['a', false, null] };
    draft.document.nodes = [{ ...node, type: 'operation', action: { kind: 'localFlag', op: 'set', name: 'composite', value } }];
    editNodeFlag(state, 'local-flag-op', 'remove');
    const storage = new MemoryStorage();
    expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    const restored = createStoryEditorState();
    new StoryDraftPersistence(storage).load(restored);
    restored.selectedNodeId = node.id;
    editNodeFlag(restored, 'local-flag-op', 'set');
    const current = currentDraft(restored)!;
    expect(storyDefinitionFromDraft(current.document, current.localFlagInputs)).toMatchObject({ ok: true, story: { nodes: [{ action: { value } }] } });
  });

  it('persists unfinished local numbers but blocks Runtime projection until the active value is valid', () => {
    const state = createStoryEditorState();
    const draft = newStory(state);
    const node = appendNode(state, 'operation', senders)!;
    editNodeFlag(state, 'local-flag-op', 'set');
    editNodeFlag(state, 'local-flag-name', '自由名称');
    editNodeFlag(state, 'local-flag-type', 'number');
    editNodeFlag(state, 'local-flag-value', '-');
    expect(storyDefinitionFromDraft(draft.document, draft.localFlagInputs).ok).toBe(false);
    const storage = new MemoryStorage();
    expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    const restored = createStoryEditorState();
    new StoryDraftPersistence(storage).load(restored);
    expect(currentDraft(restored)?.localFlagInputs?.[node.id]).toEqual({ type: 'number', text: '-' });
    restored.selectedNodeId = node.id;
    editNodeFlag(restored, 'local-flag-value', '0');
    const current = currentDraft(restored)!;
    const result = storyDefinitionFromDraft(current.document, current.localFlagInputs);
    expect(result).toMatchObject({ ok: true, story: { nodes: [{ action: { name: '自由名称', value: 0 } }] } });
    if (result.ok) expect(result.story).not.toHaveProperty('localFlagInputs');
    deleteNode(restored);
    expect(current.localFlagInputs?.[node.id]).toBeUndefined();
  });

  it('keeps one gate on every node type and removes set values from remove actions', () => {
    const state = createStoryEditorState();
    const draft = newStory(state);
    for (const kind of ['text', 'click', 'operation', 'transfer'] as const) {
      composer(state).text = 'body';
      const node = appendNode(state, kind, senders)!;
      expect(editNodeFlag(state, 'requires-flag', 'StoryName-ready')).toBe(true);
      expect(draft.document.nodes.find(item => item.id === node.id)?.requiresFlag).toBe('StoryName-ready');
      editNodeFlag(state, 'requires-flag', '');
      expect(draft.document.nodes.find(item => item.id === node.id)).not.toHaveProperty('requiresFlag');
    }
    state.selectedNodeId = draft.document.nodes.find(node => node.type === 'operation')!.id;
    editNodeFlag(state, 'local-flag-op', 'set');
    editNodeFlag(state, 'local-flag-name', 'key');
    editNodeFlag(state, 'local-flag-value', 'kept');
    editNodeFlag(state, 'local-flag-op', 'remove');
    const operation = () => draft.document.nodes.find(node => node.type === 'operation');
    expect(operation()).toMatchObject({ action: { kind: 'localFlag', op: 'remove', name: 'key' } });
    expect(operation()).not.toHaveProperty('action.value');
    editNodeFlag(state, 'local-flag-op', 'set');
    expect(operation()).toMatchObject({ action: { value: 'kept' } });
  });

  it('keeps an empty story and incomplete nodes without fabricating Click or executable payloads', () => {
    const state = createStoryEditorState();
    const draft = newStory(state);
    expect(draft.document).toMatchObject({ nodes: [], stages: {} });
    appendNode(state, 'operation', senders);
    appendNode(state, 'transfer', senders);
    appendNode(state, 'click', senders);
    expect(draft.document.nodes.map(node => node.type)).toEqual(['operation', 'transfer', 'click']);
    expect(draft.document.nodes[0]).not.toHaveProperty('action');
    expect(draft.document.nodes[1]).not.toHaveProperty('transfer');
    expect(draft.document.nodes[2]).toMatchObject({ interaction: { kind: 'button', text: '' } });
    const storage = new MemoryStorage();
    expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    const restored = createStoryEditorState();
    new StoryDraftPersistence(storage).load(restored);
    expect(currentDraft(restored)?.document).toEqual(draft.document);
  });

  it('appends exactly one node for each sender and keeps teacher text independent of Click', () => {
    const state = createStoryEditorState();
    const draft = newStory(state);
    for (const sender of senders) {
      composer(state).sender = sender.id;
      composer(state).text = '第一行\n第二行 <script>';
      appendNode(state, 'text', senders);
      expect(composer(state).text).toBe('');
      expect(composer(state).sender).toBe(sender.id);
    }
    expect(draft.document.nodes).toHaveLength(3);
    expect(draft.document.nodes).toMatchObject([
      { type: 'talklet', content: { kind: 'narration' } },
      { type: 'talklet', content: { kind: 'talk', speaker: '老师' }, presentation: { side: 'right' } },
      { type: 'talklet', content: { kind: 'talk', speaker: '星野' }, presentation: { side: 'left' } },
    ]);
    expect(Object.values(draft.document.stages).every(stage => stage.advance === 'auto')).toBe(true);
    composer(state).text = ' \n ';
    expect(appendNode(state, 'text', senders)).toBeUndefined();
    expect(draft.document.nodes).toHaveLength(3);
  });

  it('edits a deep copy and preserves unsupported author fields and explicit stages', () => {
    const before = JSON.stringify(source);
    const state = createStoryEditorState();
    selectStory(state, `source:${source.id}`, sources);
    state.selectedNodeId = 'text';
    expect(editNode(state, 'text', '修改后', senders)).toBe(true);
    expect(editNode(state, 'sender', 'narrator', senders)).toBe(true);
    expect(currentDraft(state)?.document.nodes[0]).toMatchObject({ content: { kind: 'narration' } });
    expect(currentDraft(state)?.document.nodes[0]).not.toHaveProperty('pacing');
    expect(editNode(state, 'sender', 'teacher', senders)).toBe(true);
    expect(currentDraft(state)?.document.nodes[0]).toMatchObject({ content: { kind: 'talk' }, presentation: { side: 'right' } });
    expect(currentDraft(state)?.document.nodes[0]).not.toHaveProperty('pacing');
    expect(editNode(state, 'sender', 'character:hoshino', senders)).toBe(true);
    expect(currentDraft(state)?.document.nodes[0]).toMatchObject({ content: { text: '修改后', image: 'test:pic:photo' }, presentation: { avatarMode: 'show', align: 'left' }, pacing: { typing: 2 } });
    expect(currentDraft(state)?.document.stages).toEqual(source.stages);
    state.selectedNodeId = 'choice';
    expect(editNode(state, 'text', '不能覆盖 choice', senders)).toBe(false);
    expect(JSON.stringify(source)).toBe(before);
    expect(currentDraft(state)?.document.nodes.slice(1)).toEqual(source.nodes.slice(1));
    const storage = new MemoryStorage();
    new StoryDraftPersistence(storage).save(state);
    const restored = createStoryEditorState();
    new StoryDraftPersistence(storage).load(restored);
    expect(currentDraft(restored)?.document).toEqual(currentDraft(state)?.document);
    expect(currentDraft(restored)?.document.extra).toEqual(source.extra);
  });

  it('moves stable nodes without rewriting existing stage declarations and deletes only unused stages', () => {
    const state = createStoryEditorState();
    selectStory(state, `source:${source.id}`, sources);
    state.selectedNodeId = 'choice';
    expect(moveNode(state, -1)).toBe(true);
    expect(state.selectedNodeId).toBe('choice');
    expect(currentDraft(state)?.document.nodes.map(node => node.id)).toEqual(['choice', 'text', 'op', 'transfer']);
    expect(moveNode(state, -1)).toBe(false);
    deleteNode(state);
    expect(currentDraft(state)?.document.stages).toEqual(source.stages);
    expect(state.selectedNodeId).toBeNull();
    state.selectedNodeId = 'text';
    deleteNode(state);
    expect(currentDraft(state)?.document.stages).toEqual({});
  });

  it('keeps registered sources and drafts in one searchable list, including missing sources', () => {
    const state = createStoryEditorState();
    selectStory(state, `source:${source.id}`, sources);
    renameStory(state, '本地改名');
    expect(storyList(state, sources)).toHaveLength(1);
    expect(storyList(state, sources)[0].name).toBe('本地改名');
    expect(storyList(state, new Map())).toHaveLength(1);
    state.search = source.id;
    expect(storyList(state, sources)).toHaveLength(1);
    state.search = '找不到';
    expect(storyList(state, sources)).toEqual([]);
    expect(state.currentId).toBe(`source:${source.id}`);
  });

  it('does not save a source merely because it was viewed', () => {
    const storage = new MemoryStorage();
    const state = createStoryEditorState();
    selectStory(state, `source:${source.id}`, sources);
    expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    expect(storage.values.size).toBe(0);
  });

  it('restores 205 nodes in exact order with identities and incomplete stage relationships intact', () => {
    const state = createStoryEditorState();
    const draft = newStory(state);
    for (let index = 0; index < 205; index++) {
      composer(state).text = `正文 ${index}`;
      appendNode(state, 'text', senders);
    }
    state.selectedNodeId = draft.document.nodes[204].id;
    moveNode(state, -1);
    const storage = new MemoryStorage();
    new StoryDraftPersistence(storage).save(state);
    const restored = createStoryEditorState();
    new StoryDraftPersistence(storage).load(restored);
    expect(currentDraft(restored)?.document).toEqual(draft.document);
    expect(currentDraft(restored)?.document.nodes).toHaveLength(205);
  });

  it('keeps dirty content after a failed write and retries successfully', () => {
    const state = createStoryEditorState();
    const draft = newStory(state);
    const storage = new MemoryStorage();
    const persistence = new StoryDraftPersistence(storage);
    storage.fail = true;
    expect(persistence.save(state)).toBe(false);
    expect(draft.dirty).toBe(true);
    expect(draft.persisted).toBe(false);
    expect(state.error).toContain('quota');
    storage.fail = false;
    expect(persistence.save(state)).toBe(true);
    expect(draft.dirty).toBe(false);
    expect(state.error).toBeNull();
  });

  it.each(['{broken', '{"version":99,"drafts":[]}', '{"version":1,"drafts":[{}]}'])('preserves unsupported storage instead of replacing it: %s', raw => {
    const storage = new MemoryStorage();
    storage.values.set(STORY_EDITOR_STORAGE_KEY, raw);
    const state = createStoryEditorState();
    const persistence = new StoryDraftPersistence(storage);
    persistence.load(state);
    expect(state.storageBlocked).toBe(true);
    newStory(state);
    expect(persistence.save(state)).toBe(false);
    expect(storage.get(STORY_EDITOR_STORAGE_KEY)).toBe(raw);
  });
});
