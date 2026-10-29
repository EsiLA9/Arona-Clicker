import { describe, expect, it } from 'vitest';
import type { StoryDef } from '../../src/data-services/contracts/story';
import { createStoryEditorState, currentDraft, selectStory, storyDefinitionFromDraft } from '../../src/ui/story-editor/model';
import { StoryDraftPersistence } from '../../src/ui/story-editor/persistence';
import { addRow, editProperty, editStage, missingEnabledOptionalIssues, moveRow, optionalEnabled, readProperty, removeRow, rowIdAt, selectDiscriminant, selectNodeType, selectThemeScope, setNodeStage, toggleOptional } from '../../src/ui/story-editor/property-model';
import type { StorageAdapter } from '../../src/data-services/persistence/storage-adapter';

const story: StoryDef = {
  id: 'test:story:properties', name: '属性缓存',
  nodes: [
    { id: 'talk', type: 'talklet', stageId: 's1', content: { kind: 'talk', speaker: '老师', text: 'Hi', image: 'test:image:portrait' }, presentation: { side: 'left' }, pacing: { typing: 2 } },
    { id: 'click', type: 'click', stageId: 's1', interaction: { kind: 'choice', options: [{ id: 'first', text: 'A' }, { id: 'second', text: 'B' }] } },
    { id: 'op', type: 'operation', action: { kind: 'state', effects: [{ op: 'addItem', itemId: 'test:item:a', amount: 1 }, { op: 'addItem', itemId: 'test:item:b', amount: 2 }] } },
  ], stages: { s1: { advance: 'input' } },
};
const sources = new Map([[story.id, story]]);
class MemoryStorage implements StorageAdapter {
  value: string | null = null;
  get(): string | null { return this.value; }
  set(_key: string, value: string): void { this.value = value; }
  remove(): void { this.value = null; }
}

describe('Story Editor property draft model', () => {
  it('keeps branch and talk-only pacing values isolated while switching and restoring', () => {
    const state = createStoryEditorState(); selectStory(state, `source:${story.id}`, sources);
    const draft = currentDraft(state)!;
    selectDiscriminant(draft, 'talk', ['content'], 'kind', 'narration');
    expect(readProperty(draft, 'talk', ['content'])).toEqual({ kind: 'narration' });
    expect(readProperty(draft, 'talk', ['pacing'])).toBeUndefined();
    const narration = storyDefinitionFromDraft(draft);
    expect(narration).toMatchObject({ ok: false, issues: [{ path: 'nodes[0].content.text' }] });
    selectDiscriminant(draft, 'talk', ['content'], 'kind', 'talk');
    expect(readProperty(draft, 'talk', ['content'])).toEqual({ kind: 'talk', speaker: '老师', text: 'Hi', image: 'test:image:portrait' });
    expect(readProperty(draft, 'talk', ['pacing'])).toEqual({ typing: 2 });
  });

  it('caches node types without changing identity and restores the prior type payload', () => {
    const state = createStoryEditorState(); selectStory(state, `source:${story.id}`, sources);
    const draft = currentDraft(state)!;
    expect(selectNodeType(draft, 'talk', 'operation')).toBe(true);
    expect(readProperty(draft, 'talk', [])).toEqual({ id: 'talk', type: 'operation' });
    expect(storyDefinitionFromDraft(draft).ok).toBe(false);
    expect(selectNodeType(draft, 'talk', 'talklet')).toBe(true);
    expect(readProperty(draft, 'talk', ['content', 'text'])).toBe('Hi');
  });

  it('keeps common requiresFlag edits and removals across node type cache restores', () => {
    const state = createStoryEditorState(); selectStory(state, `source:${story.id}`, sources);
    const draft = currentDraft(state)!;
    editProperty(draft, 'talk', ['requiresFlag'], 'ready');
    selectNodeType(draft, 'talk', 'operation');
    editProperty(draft, 'talk', ['requiresFlag'], 'changed');
    selectNodeType(draft, 'talk', 'talklet');
    expect(readProperty(draft, 'talk', ['requiresFlag'])).toBe('changed');
    toggleOptional(draft, 'talk', ['requiresFlag'], false);
    selectNodeType(draft, 'talk', 'operation');
    selectNodeType(draft, 'talk', 'talklet');
    expect(readProperty(draft, 'talk', ['requiresFlag'])).toBeUndefined();
  });

  it('uses stable row identities through reordering and scopes them to each draft', () => {
    const state = createStoryEditorState(); selectStory(state, `source:${story.id}`, sources);
    const draft = currentDraft(state)!;
    expect(draft.dirty).toBe(false);
    const a = rowIdAt(draft, 'op', ['action', 'effects'], 0)!;
    const b = rowIdAt(draft, 'op', ['action', 'effects'], 1)!;
    expect(draft.dirty).toBe(false);
    expect(moveRow(draft, 'op', ['action', 'effects'], a, 1)).toBe(true);
    expect(readProperty(draft, 'op', ['action', 'effects', 1, 'itemId'])).toBe('test:item:a');
    expect(rowIdAt(draft, 'op', ['action', 'effects'], 1)).toBe(a);
    expect(rowIdAt(draft, 'op', ['action', 'effects'], 0)).toBe(b);
    expect(addRow(draft, 'op', ['action', 'effects'])).toBeTruthy();
    expect(readProperty(draft, 'op', ['action', 'effects'])).toHaveLength(3);
    const removed = rowIdAt(draft, 'op', ['action', 'effects'], 1)!;
    toggleOptional(draft, 'op', ['action', 'effects', 1, 'amount'], false);
    expect(removeRow(draft, 'op', ['action', 'effects'], removed)).toBe(true);
    expect(Object.keys(draft.editorState!.optionals).some(key => key.includes(`"@${removed}"`))).toBe(false);
    expect(Object.keys(draft.editorState!.rawInputs).some(key => key.includes(`"@${removed}"`))).toBe(false);
  });

  it('keeps optional branch guards attached to stable action rows after reordering', () => {
    const state = createStoryEditorState(); selectStory(state, `source:${story.id}`, sources);
    const draft = currentDraft(state)!;
    const path = ['action', 'effects'] as const;
    const rowId = addRow(draft, 'op', path)!;
    selectDiscriminant(draft, 'op', [...path, 2], 'op', 'addItem');
    toggleOptional(draft, 'op', [...path, 2, 'amount'], true);
    expect(missingEnabledOptionalIssues(draft)[0].path).toBe('nodes[2].action.effects[2].amount');
    expect(moveRow(draft, 'op', path, rowId, 0)).toBe(true);
    expect(missingEnabledOptionalIssues(draft)[0].path).toBe('nodes[2].action.effects[0].amount');
    selectDiscriminant(draft, 'op', [...path, 0], 'op', 'unlockInit');
    expect(missingEnabledOptionalIssues(draft)).toEqual([]);
  });

  it('does not dirty or persist an unmodified source when a row is rendered', () => {
    const state = createStoryEditorState(); selectStory(state, `source:${story.id}`, sources);
    const draft = currentDraft(state)!;
    expect(rowIdAt(draft, 'op', ['action', 'effects'], 0)).toBeTruthy();
    expect(draft.dirty).toBe(false);
    const storage = new MemoryStorage();
    expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    expect(storage.value).toBeNull();
  });

  it('persists an enabled but unfinished optional value and blocks projection until completed', () => {
    const state = createStoryEditorState(); selectStory(state, `source:${story.id}`, sources);
    const draft = currentDraft(state)!;
    selectDiscriminant(draft, 'click', ['interaction'], 'kind', 'button');
    editProperty(draft, 'click', ['interaction', 'text'], '继续');
    expect(toggleOptional(draft, 'click', ['interaction', 'press'], true)).toBe(true);
    expect(optionalEnabled(draft, 'click', ['interaction', 'press'])).toBe(true);
    expect(storyDefinitionFromDraft(draft)).toMatchObject({ ok: false, issues: [{ path: expect.stringContaining('press'), message: expect.stringContaining('可选项') }] });
    editProperty(draft, 'click', ['interaction', 'press', 'base'], '-');
    expect(storyDefinitionFromDraft(draft).ok).toBe(false);
    const storage = new MemoryStorage();
    expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    const restored = createStoryEditorState(); new StoryDraftPersistence(storage).load(restored);
    const copy = currentDraft(restored)!;
    expect(readProperty(copy, 'click', ['interaction', 'press', 'base'])).toBe('-');
    editProperty(copy, 'click', ['interaction', 'press', 'base'], '1');
    const compiled = storyDefinitionFromDraft(copy);
    expect(compiled.ok).toBe(true);
    if (compiled.ok) expect(compiled.story.nodes[1]).toMatchObject({ interaction: { press: { base: 1 } } });
  });

  it('does not let raw values from an inactive option row appear in a different interaction branch', () => {
    const state = createStoryEditorState(); selectStory(state, `source:${story.id}`, sources);
    const draft = currentDraft(state)!;
    editProperty(draft, 'click', ['interaction', 'options', 0, 'text'], '原始输入');
    selectDiscriminant(draft, 'click', ['interaction'], 'kind', 'button');
    expect(readProperty(draft, 'click', ['interaction', 'options', 0, 'text'])).toBeUndefined();
    selectDiscriminant(draft, 'click', ['interaction'], 'kind', 'choice');
    expect(readProperty(draft, 'click', ['interaction', 'options', 0, 'text'])).toBe('原始输入');
  });

  it('changes theme scope without losing common theme values and caches entity keys by scope', () => {
    const state = createStoryEditorState(); selectStory(state, `source:${story.id}`, sources);
    const draft = currentDraft(state)!;
    selectDiscriminant(draft, 'op', ['action'], 'kind', 'presentation');
    selectDiscriminant(draft, 'op', ['action', 'command'], 'command', 'theme');
    editProperty(draft, 'op', ['action', 'command', 'value'], { scope: 'area', entityKey: 'area:old', colorGroupId: 'test:colors:blue', palette: { primary: '#123456' } });
    expect(selectThemeScope(draft, 'op', ['action', 'command', 'value'], 'ephemeral')).toBe(true);
    expect(readProperty(draft, 'op', ['action', 'command', 'value'])).toEqual({ scope: 'ephemeral', colorGroupId: 'test:colors:blue', palette: { primary: '#123456' } });
    expect(selectThemeScope(draft, 'op', ['action', 'command', 'value'], 'area')).toBe(true);
    expect(readProperty(draft, 'op', ['action', 'command', 'value', 'entityKey'])).toBe('area:old');
    expect(readProperty(draft, 'op', ['action', 'command', 'value', 'palette'])).toEqual({ primary: '#123456' });
    expect(selectThemeScope(draft, 'op', ['action', 'command', 'value'], 'student')).toBe(true);
    expect(readProperty(draft, 'op', ['action', 'command', 'value', 'entityKey'])).toBeUndefined();
  });

  it('keeps imported unreferenced stages as source diagnostics instead of silently projecting them away', () => {
    const invalid: StoryDef = { ...story, stages: { ...story.stages, unused: { advance: 'auto' } } };
    const state = createStoryEditorState(); selectStory(state, `source:${invalid.id}`, new Map([[invalid.id, invalid]]));
    expect(storyDefinitionFromDraft(currentDraft(state)!)).toMatchObject({ ok: false, issues: [{ path: 'stages.unused' }] });
  });

  it('caches declarations made unused by an explicit stage reassignment', () => {
    const state = createStoryEditorState(); selectStory(state, `source:${story.id}`, sources);
    const draft = currentDraft(state)!;
    expect(editStage(draft, 'talk', 's2', 'input')).toBe(true);
    expect(setNodeStage(draft, 'click', 's2')).toBe(true);
    const compiled = storyDefinitionFromDraft(draft);
    expect(compiled.ok).toBe(true);
    if (compiled.ok) expect(compiled.story.stages).toEqual({ s2: { advance: 'input' } });
    expect(draft.editorState?.inactiveStageIds).toContain('s1');
  });
});
