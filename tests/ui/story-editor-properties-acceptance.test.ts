import { describe, expect, it } from 'vitest';
import type { StoryDef } from '../../src/data-services/contracts/story';
import { createStoryEditorState, currentDraft, selectStory, storyDefinitionFromDraft } from '../../src/ui/story-editor/model';
import { editProperty, moveRow, readProperty, removeRow, rowIdAt, selectBranch, selectDiscriminant, selectNodeType, toggleOptional } from '../../src/ui/story-editor/property-model';
import { StoryDraftPersistence } from '../../src/ui/story-editor/persistence';
import type { StorageAdapter } from '../../src/data-services/persistence/storage-adapter';

function open(story: StoryDef) {
  const state = createStoryEditorState();
  selectStory(state, `source:${story.id}`, new Map([[story.id, story]]));
  return { state, draft: currentDraft(state)! };
}
const operation: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'test:story:properties_acceptance', name: '验收', stages: {}, nodes: [{ id: 'node', type: 'operation', requiresFlag: 'initial', action: { kind: 'state', effects: [{ op: 'addItem', itemId: 'test:item:one', amount: 1 }] } }] };
class MemoryStorage implements StorageAdapter {
  data = new Map<string, string>();
  get(key: string) { return this.data.get(key) ?? null; }
  set(key: string, value: string) { this.data.set(key, value); }
  remove(key: string) { this.data.delete(key); }
}

describe('0336 independent draft acceptance', () => {
  it('keeps common requiresFlag edits across top-level type cache restores, including clearing it', () => {
    const { draft } = open(operation);
    selectNodeType(draft, 'node', 'transfer');
    editProperty(draft, 'node', ['requiresFlag'], 'latest');
    selectNodeType(draft, 'node', 'operation');
    expect(readProperty(draft, 'node', ['requiresFlag'])).toBe('latest');
    selectNodeType(draft, 'node', 'transfer');
    toggleOptional(draft, 'node', ['requiresFlag'], false);
    selectNodeType(draft, 'node', 'operation');
    expect(readProperty(draft, 'node', ['requiresFlag'])).toBeUndefined();
  });

  it('restores each branch raw input without displaying a different branch value at the same path', () => {
    const { state, draft } = open(operation);
    const row = ['action', 'effects', 0] as const;
    editProperty(draft, 'node', [...row, 'amount'], '12');
    selectDiscriminant(draft, 'node', row, 'op', 'addResource');
    expect(readProperty(draft, 'node', [...row, 'amount'])).toBeUndefined();
    editProperty(draft, 'node', [...row, 'resourceId'], 'test:resource:one');
    editProperty(draft, 'node', [...row, 'amount'], '37');
    selectDiscriminant(draft, 'node', row, 'op', 'addItem');
    expect(readProperty(draft, 'node', [...row, 'amount'])).toBe('12');
    const storage = new MemoryStorage();
    expect(new StoryDraftPersistence(storage).save(state)).toBe(true);
    const restored = createStoryEditorState();
    new StoryDraftPersistence(storage).load(restored);
    const next = currentDraft(restored)!;
    expect(storyDefinitionFromDraft(next)).toMatchObject({ ok: true, story: { nodes: [{ action: { effects: [{ op: 'addItem', amount: 12 }] } }] } });
    selectDiscriminant(next, 'node', row, 'op', 'addResource');
    expect(readProperty(next, 'node', [...row, 'amount'])).toBe('37');
  });

  it('garbage-collects deleted-row branch values rather than retaining ghost author input', () => {
    const { draft } = open(operation);
    const rows = ['action', 'effects'] as const;
    const id = rowIdAt(draft, 'node', rows, 0)!;
    editProperty(draft, 'node', [...rows, 0, 'itemId'], 'do-not-resurrect');
    selectDiscriminant(draft, 'node', [...rows, 0], 'op', 'addResource');
    expect(JSON.stringify(draft.editorState)).toContain('do-not-resurrect');
    expect(removeRow(draft, 'node', rows, id)).toBe(true);
    expect(JSON.stringify(draft.editorState)).not.toContain('do-not-resurrect');
  });

  it('tracks enabled-but-empty optional fields through row moves and suspends them with their branch', () => {
    const story: StoryDef = { startContext: { type: 'area', areaId: 'base:area:schale_main' }, id: 'test:story:rows', name: 'Rows', stages: { input: { advance: 'input' } }, nodes: [{ id: 'node', type: 'click', stageId: 'input', interaction: { kind: 'button', text: '继续', result: { actions: [
      { kind: 'travel', areaId: 'test:area:one' }, { kind: 'travel', areaId: 'test:area:two' },
    ] } } }] };
    const { draft } = open(story);
    const rows = ['interaction', 'result', 'actions'] as const;
    const first = rowIdAt(draft, 'node', rows, 0)!;
    toggleOptional(draft, 'node', [...rows, 0, 'notice'], true);
    moveRow(draft, 'node', rows, first, 1);
    const incomplete = storyDefinitionFromDraft(draft);
    expect(incomplete.ok).toBe(false);
    if (!incomplete.ok) expect(incomplete.issues.some(issue => issue.path === 'nodes[0].interaction.result.actions[1].notice')).toBe(true);
    selectBranch(draft, 'node', [...rows, 1], 'localFlag');
    editProperty(draft, 'node', [...rows, 1, 'op'], 'set');
    editProperty(draft, 'node', [...rows, 1, 'name'], 'ready');
    editProperty(draft, 'node', [...rows, 1, 'value'], false);
    expect(storyDefinitionFromDraft(draft).ok).toBe(true);
  });
});
