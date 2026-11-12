import { describe, expect, it } from 'vitest';
import type { StoryDef } from '../../../src/data-services/contracts/story';
import type { StorageAdapter } from '../../../src/data-services/persistence/storage-adapter';
import { appendNode, bindStoryNodeToChoiceOption, canBindStoryNodeToChoiceOption, canBindStoryNodeToFlagReader, choiceOptionFlagBindings, composer, createStoryEditorState, currentDraft, deleteNode, editNode, editNodeFlag, isGeneratedStoryNodeId, moveNode, newStory, renameStory, renameStoryLocalFlag, selectStory, storyDefinitionFromDraft, storyList, unbindStoryNodeFromChoiceOption, type StorySender } from '../../../src/ui/story-editor/model';
import { selectDiscriminant, toggleOptional } from '../../../src/ui/story-editor/property-model';
import { StoryDraftPersistence, STORY_EDITOR_STORAGE_KEY } from '../../../src/ui/story-editor/persistence';

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
  it('assigns readable per-type numbers and keeps IDs stable through edits, reordering and reload', () => {
    const state = createStoryEditorState(), draft = newStory(state);
    draft.document.startContext = {type:'area',areaId:'base:area:schale_main'};
    composer(state).text = '第一句'; const talk = appendNode(state,'text',senders)!;
    const click = appendNode(state,'click',senders)!;
    composer(state).text = '第二句'; const second = appendNode(state,'text',senders)!;
    expect([talk.id,click.id,second.id]).toEqual(['talk-001','click-001','talk-002']);
    expect(appendNode(state,'operation',senders)?.id).toBe('operation-001');
    expect(appendNode(state,'transfer',senders)?.id).toBe('transfer-001');
    expect(appendNode(state,'moveToArea',senders)?.id).toBe('move-area-001');
    expect(appendNode(state,'moveToCharaspace',senders)?.id).toBe('move-chara-001');
    state.selectedNodeId = second.id; editNode(state,'text','修改正文',senders); moveNode(state,-1);
    expect(draft.document.nodes.find(node => node.id === second.id)).toMatchObject({content:{text:'修改正文'}});
    const storage = new MemoryStorage(); expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    const restored = createStoryEditorState(); new StoryDraftPersistence(storage).load(restored);
    composer(restored).text = '第三句'; expect(appendNode(restored,'text',senders)?.id).toBe('talk-003');
  });

  it('skips occupied IDs and cached inputs, fills free numbers and continues beyond three digits', () => {
    const state = createStoryEditorState(), draft = newStory(state);
    draft.document.nodes = [{id:'operation-001',type:'operation'},{id:'operation-003',type:'operation'}];
    expect(appendNode(state,'operation',senders)?.id).toBe('operation-002');
    draft.localFlagInputs = {'operation-004':{type:'number',text:'unfinished'}};
    expect(appendNode(state,'operation',senders)?.id).toBe('operation-005');
    draft.document.nodes = Array.from({length:999},(_,index) => ({id:`transfer-${String(index+1).padStart(3,'0')}`,type:'transfer' as const}));
    expect(appendNode(state,'transfer',senders)?.id).toBe('transfer-1000');
    for (const id of ['talk-001','click-002','operation-003','transfer-1000','move-area-001','move-chara-001',`node_${'a'.repeat(32)}`]) expect(isGeneratedStoryNodeId(id),id).toBe(true);
    for (const id of ['talk-welcome','talk-001-copy-1','custom-001']) expect(isGeneratedStoryNodeId(id),id).toBe(false);
  });

  it('retains a source composite local value through remove, draft reload, and switching back to set', () => {
    const state = createStoryEditorState();
    const draft = newStory(state);
    const node = appendNode(state, 'operation', senders)!;
    draft.document.startContext = { type: 'area', areaId: 'base:area:schale_main' };
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
    draft.document.startContext = { type: 'area', areaId: 'base:area:schale_main' };
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

  it('adds independent Choice mark pairs idempotently and preserves marks when a reader is unbound', () => {
    const state = createStoryEditorState(), draft = newStory(state);
    draft.document = { ...draft.document, stages: { one: { advance: 'input' } }, nodes: [
      { id: 'choice', type: 'click', stageId: 'one', interaction: { kind: 'choice', options: [{ id: 'yes', text: 'Yes' }] } },
      { id: 'first', type: 'operation', action: { kind: 'travel', areaId: 'test:area:home' } },
      { id: 'second', type: 'operation', action: { kind: 'travel', areaId: 'test:area:home' } },
    ] };
    const first = canBindStoryNodeToChoiceOption(draft, 'choice', 0, 'yes', 'first');
    expect(first).toMatchObject({ ok: true, created: true });
    if (!first.ok) return;
    expect(bindStoryNodeToChoiceOption(state, 'choice', 0, 'yes', 'first')).toEqual(first);
    const afterFirst = JSON.stringify(draft.document);
    expect(bindStoryNodeToChoiceOption(state, 'choice', 0, 'yes', 'first')).toMatchObject({ ok: true, created: false, flagName: first.flagName });
    expect(JSON.stringify(draft.document)).toBe(afterFirst);
    const second = bindStoryNodeToChoiceOption(state, 'choice', 0, 'yes', 'second');
    expect(second).toMatchObject({ ok: true, created: true });
    if (!second.ok) return;
    expect((draft.document.nodes[0] as Extract<(typeof draft.document.nodes)[number], { type: 'click' }>).interaction).toMatchObject({
      options: [{ marks: [first.flagName, second.flagName] }],
    });
    expect(choiceOptionFlagBindings(draft, 'choice', 0, 'yes')).toEqual([
      { flagName: first.flagName, nodeIds: ['first'] }, { flagName: second.flagName, nodeIds: ['second'] },
    ]);
    expect(unbindStoryNodeFromChoiceOption(draft, 'choice', 0, 'yes', first.flagName, 'first')).toBe(true);
    expect(draft.document.nodes.find(node => node.id === 'first')).not.toHaveProperty('requiresFlag');
    expect((draft.document.nodes[0] as Extract<(typeof draft.document.nodes)[number], { type: 'click' }>).interaction).toMatchObject({
      options: [{ marks: [first.flagName, second.flagName] }],
    });
  });

  it('rejects stale unbinds and removes the shared node condition across same-Choice options', () => {
    const state = createStoryEditorState(), draft = newStory(state);
    draft.document = { ...draft.document, stages: { one: { advance: 'input' } }, nodes: [
      { id: 'choice', type: 'click', stageId: 'one', interaction: { kind: 'choice', options: [
        { id: 'first', text: 'First', marks: ['shared'] }, { id: 'second', text: 'Second', marks: ['shared'] },
      ] } },
      { id: 'target', type: 'operation', requiresFlag: 'shared', action: { kind: 'travel', areaId: 'test:area:home' } },
    ] };
    draft.dirty = false;
    const before = JSON.stringify(draft.document);
    expect(unbindStoryNodeFromChoiceOption(draft, 'choice', 0, 'removed-option', 'shared', 'target')).toBe(false);
    expect(unbindStoryNodeFromChoiceOption(draft, 'choice', 0, 'first', 'stale-mark', 'target')).toBe(false);
    expect(JSON.stringify(draft.document)).toBe(before);
    expect(draft.dirty).toBe(false);
    expect(unbindStoryNodeFromChoiceOption(draft, 'choice', 0, 'first', 'shared', 'target')).toBe(true);
    expect(draft.document.nodes.find(node => node.id === 'target')).not.toHaveProperty('requiresFlag');
    expect(choiceOptionFlagBindings(draft, 'choice', 0, 'first')).toEqual([]);
    expect(choiceOptionFlagBindings(draft, 'choice', 1, 'second')).toEqual([]);
    expect((draft.document.nodes[0] as Extract<(typeof draft.document.nodes)[number], { type: 'click' }>).interaction).toMatchObject({
      options: [{ marks: ['shared'] }, { marks: ['shared'] }],
    });
  });

  it('scopes Choice marks to live or cached Choice options, not similarly named Extra fields', () => {
    const state = createStoryEditorState(), draft = newStory(state);
    const dormantMark = 'test-story-cache-yes-1';
    const overlayMark = 'test-story-cache-yes-2';
    draft.document = { ...draft.document, id: 'test:story:cache', extra: { t: 'dict', v: { marks: { t: 'str', v: dormantMark } } },
      stages: { one: { advance: 'input' } }, nodes: [
        { id: 'cached', type: 'click', stageId: 'one', interaction: { kind: 'choice', options: [{ id: 'yes', text: 'Old', marks: [dormantMark] }] } },
        { id: 'choice', type: 'click', stageId: 'one', interaction: { kind: 'choice', options: [{ id: 'yes', text: 'New' }] } },
        { id: 'reader', type: 'operation', action: { kind: 'localFlag', op: 'set', name: 'outer', value: { kind: 'localFlag', op: 'set', name: 'inner', requiresFlag: 'nested' } } },
        { id: 'overlay', type: 'operation', action: { kind: 'overlay', command: { command: 'show', id: 'entry-card', content: { kind: 'entryCard', card: {
          request: { entryType: 'active', entryId: 'test:activestory:child', intent: 'card', owner: null }, continuation: { returnFlags: [overlayMark] },
        } } } } },
      ] };
    expect(selectDiscriminant(draft, 'cached', ['interaction'], 'kind', 'button')).toBe(true);
    expect(canBindStoryNodeToChoiceOption(draft, 'choice', 0, 'yes', 'reader')).toMatchObject({ ok: true, flagName: 'test-story-cache-yes-3', created: true });
    expect(canBindStoryNodeToFlagReader(draft, 'route', 'reader')).toMatchObject({ ok: false });
    expect(canBindStoryNodeToFlagReader(draft, 'inner', 'reader')).toMatchObject({ ok: false });
    expect(renameStoryLocalFlag(draft, 'inner', 'renamed-inner').ok).toBe(false);
    expect(draft.document.nodes.find(node=>node.id==='reader')).toMatchObject({action:{value:{kind:'localFlag',name:'inner',requiresFlag:'nested'}}});
    expect(canBindStoryNodeToFlagReader(draft, overlayMark, 'reader')).toMatchObject({ok:true});
    expect(renameStoryLocalFlag(draft, overlayMark, 'renamed-overlay')).toMatchObject({ok:true,changed:true});
    expect(draft.document.nodes.find(node=>node.id==='overlay')).toMatchObject({action:{command:{content:{card:{continuation:{returnFlags:['renamed-overlay']}}}}}});
    const renamed = renameStoryLocalFlag(draft, dormantMark, 'renamed-route');
    expect(renamed).toEqual({ ok: true, changed: true });
    expect(draft.document.extra).toMatchObject({ t: 'dict', v: { marks: { t: 'str', v: dormantMark } } });
    expect(selectDiscriminant(draft, 'cached', ['interaction'], 'kind', 'choice')).toBe(true);
    expect(draft.document.nodes.find(node => node.id === 'cached')).toMatchObject({ interaction: { options: [{ marks: ['renamed-route'] }] } });
  });

  it('tracks disabled Operation actions in their exact optional cache for allocation and rename', () => {
    const state = createStoryEditorState(), draft = newStory(state);
    const cachedName = 'test-story-button-cache-route-1';
    draft.document = { ...draft.document, id: 'test:story:button-cache', stages: { one: { advance: 'input' } }, nodes: [
      { id: 'button', type: 'click', stageId: 'one', interaction: { kind: 'button', text: 'go' } },
  { id: "button-effect-1", type: 'operation', action: { kind: 'localFlag', op: 'set', name: cachedName, value: true } },
      { id: 'choice', type: 'click', stageId: 'one', interaction: { kind: 'choice', options: [{ id: 'route', text: 'route' }] } },
      { id: 'target', type: 'operation', action: { kind: 'travel', areaId: 'test:area:home' } },
    ] };
    expect(toggleOptional(draft, 'button-effect-1', ['action'], false)).toBe(true);
    expect(canBindStoryNodeToFlagReader(draft, cachedName, 'target')).toMatchObject({ok:true});
    expect(canBindStoryNodeToChoiceOption(draft, 'choice', 0, 'route', 'target')).toMatchObject({ok:true,flagName:'test-story-button-cache-route-2'});
    expect(renameStoryLocalFlag(draft, cachedName, 'cached-renamed')).toMatchObject({ok:true,changed:true});
    toggleOptional(draft, 'button-effect-1', ['action'], true);
    expect(draft.document.nodes.find(node=>node.id==='button-effect-1')).toMatchObject({action:{kind:'localFlag',name:'cached-renamed'}});
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
      { type: 'talklet', content: { kind: 'talk', speaker: '老师' }, appearance: { presentation: { side: 'right' } } },
      { type: 'talklet', content: { kind: 'talk', characterId: 'hoshino' }, appearance: { presentation: { side: 'left' } } },
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
    expect(currentDraft(state)?.document.nodes[0]).toMatchObject({ content: { kind: 'talk' }, appearance: { presentation: { side: 'right' } } });
    expect(currentDraft(state)?.document.nodes[0]).not.toHaveProperty('pacing');
    expect(editNode(state, 'sender', 'character:hoshino', senders)).toBe(true);
    expect(currentDraft(state)?.document.nodes[0]).toMatchObject({
      content: { text: '修改后', image: 'test:pic:photo' },
      appearance: { presentation: { avatarMode: 'show', align: 'left' } },
      performance: { pacing: { typing: 2 } },
    });
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
    const draftId=currentDraft(state)!.draftId;
    state.performanceEditing={[draftId]:['choice','text']};
    deleteNode(state);
    expect(state.performanceEditing[draftId]).toEqual(['text']);
    expect(currentDraft(state)?.document.stages).toEqual(source.stages);
    expect(state.selectedNodeId).toBeNull();
    state.selectedNodeId = 'text';
    deleteNode(state);
    expect(currentDraft(state)?.document.stages).toEqual({});
    expect(state.performanceEditing[draftId]).toEqual([]);
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
    expect(state.target).toEqual({ kind: 'story', id: source.id });
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
