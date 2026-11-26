import { describe, expect, it } from 'vitest';
import { createStoryEditorState, newStory } from '../../../src/ui/story-editor/model';
import { storyDocumentActions } from '../../../src/ui/story-editor/document-actions';

describe('Story document actions', () => {
  const facts = { entryExists: false, hasEditingMod: true };
  it('keeps read-only preview and new available while blocking document writes', () => {
    const state = createStoryEditorState(); newStory(state);
    state.readOnlyReason = 'read only';
    const actions = storyDocumentActions(state, facts);
    expect(actions.save.disabledReason).toBe('read only');
    expect(actions.preview.disabledReason).toBeUndefined(); expect(actions.new.disabledReason).toBeUndefined();
    state.storageBlocked = true;
    expect(storyDocumentActions(state, facts).save.disabledReason).toContain('存储');
    expect(storyDocumentActions(state, facts).new.disabledReason).toContain('存储');
  });

  it('distinguishes absent drafts, source availability, apply permission and deletable work', () => {
    const state = createStoryEditorState();
    expect(storyDocumentActions(state, facts).preview.disabledReason).toContain('不可试播');
    expect(storyDocumentActions(state, { ...facts, hasEditingMod: false }).new.disabledReason).toContain('编辑态 Mod');
    const draft = newStory(state); state.canApplySource = false; state.sourceOptions = [];
    draft.packSource = { packRecordId: 'missing', modName: 'local', dependencies: [], label: 'missing' };
    let actions = storyDocumentActions(state, facts);
    expect(actions.preview.disabledReason).toContain('未载入'); expect(actions.apply.disabledReason).toContain('无法应用');
    expect(actions.save.disabledReason).toBeUndefined(); expect(actions.pack.visible).toBe(true);
    draft.persisted = false; draft.dirty = false;
    expect(storyDocumentActions(state, facts).delete.disabledReason).toContain('没有需要删除');
    draft.dirty = true; state.sourceOptions.push({ value: 'pack:missing', label: 'loaded', group: 'packs' });
    actions = storyDocumentActions(state, facts);
    expect(actions.preview.disabledReason).toBeUndefined(); expect(actions.delete.disabledReason).toBeUndefined();
  });

  it('uses Entry existence for preview and hides Story-only actions', () => {
    const state = createStoryEditorState(); state.target = { kind: 'entry', id: 'entry' };
    const actions = storyDocumentActions(state, { ...facts, entryExists: true });
    expect(actions.preview.disabledReason).toBeUndefined(); expect(actions.save.disabledReason).toContain('没有可保存');
    expect(actions.restore.visible).toBe(false); expect(actions.rename.visible).toBe(false); expect(actions.delete.visible).toBe(false);
  });
});
