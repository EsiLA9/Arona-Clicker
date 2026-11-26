import { describe, expect, it } from 'vitest';
import { createStoryBrowseViewState, createStoryEditorState } from '../../../src/ui/story-editor/model';
import { captureStoryInstanceState, createEmptyStoryBrowseInstance, createStoryWorkspaceSession, findStoryBrowseInstance, restoreStoryInstanceState } from '../../../src/ui/story-editor/workspace-session';

describe('Story browse state boundaries', () => {
  it('restores a complete projection, clears optional values and preserves shared editor state', () => {
    const state = createStoryEditorState();
    state.sourceSelection = 'pack:old'; state.targetPackId = 'old'; state.notice = 'old';
    state.sidebarMode = 'entries'; state.composers.story = { sender: 'teacher', text: 'shared' };
    const drafts = state.drafts;
    restoreStoryInstanceState(state, createStoryBrowseViewState());
    expect(state.sourceSelection).toBeUndefined(); expect(state.targetPackId).toBeUndefined();
    expect(state.notice).toBeNull(); expect(state.sidebarMode).toBe('entries');
    expect(state.drafts).toBe(drafts); expect(state.composers.story.text).toBe('shared');
    expect(captureStoryInstanceState(state)).not.toHaveProperty('drafts');
  });

  it('copies navigation values without sharing mutable targets or history', () => {
    const state = createStoryEditorState();
    state.target = { kind: 'story', id: 'a' };
    state.visits = [{ target: { ...state.target }, selectedNodeId: null, insertionBeforeNodeId: null, centerScroll: 4, rightScroll: 8 }];
    const saved = captureStoryInstanceState(state);
    state.target.id = 'b'; state.visits[0].target.id = 'b'; state.visits.push({ ...state.visits[0] });
    expect(saved.target?.id).toBe('a'); expect(saved.visits).toHaveLength(1);
    expect(saved.visits[0].target.id).toBe('a');
    restoreStoryInstanceState(state, saved); state.visits[0].target.id = 'c';
    expect(saved.visits[0].target.id).toBe('a');
  });

  it('starts empty instances from defaults with independent memories and source ownership', () => {
    const workspace = createStoryWorkspaceSession(); const state = createStoryEditorState();
    state.sourceSelection = 'pack:a'; state.targetPackId = 'a'; state.visitIndex = 2; state.nodeDesignerTab = 'performance';
    workspace.active.inspectorVisible = false;
    const first = createEmptyStoryBrowseInstance(workspace, state, 'pack:a');
    const second = createEmptyStoryBrowseInstance(workspace, state, 'pack:b');
    expect(workspace.active.snapshot).toEqual(createStoryBrowseViewState());
    expect(first.snapshot.targetPackId).toBe('a'); expect(second.snapshot.targetPackId).toBe('b');
    expect(createEmptyStoryBrowseInstance(workspace, state, '').snapshot.targetPackId).toBeUndefined();
    expect(first.snapshot.visits).toEqual([]); expect(first.snapshot.visitIndex).toBe(-1);
    expect(first.snapshot.nodeDesignerTab).toBe('basic'); expect(first.inspectorVisible).toBe(false);
    expect(first.inspectorScroll).not.toBe(second.inspectorScroll); expect(first.sourceVisits).not.toBe(second.sourceVisits);
    expect(first.scroll).toEqual({ center: 0, right: 0 }); expect(first.id).not.toBe(second.id);
  });

  it('matches document, source and running pack while excluding the active instance', () => {
    const workspace = createStoryWorkspaceSession(); const state = createStoryEditorState();
    const target = { kind: 'story' as const, id: 'a' };
    workspace.active.document = { target, name: 'a' };
    expect(findStoryBrowseInstance(workspace, target, '')).toBeUndefined();
    const next = createEmptyStoryBrowseInstance(workspace, state, 'pack:a');
    next.document = { target, name: 'a', packId: 'a' }; workspace.instances.push(next);
    expect(findStoryBrowseInstance(workspace, target, 'pack:b')).toBeUndefined();
    expect(findStoryBrowseInstance(workspace, { kind: 'entry', id: 'a' }, 'pack:a')).toBeUndefined();
    expect(findStoryBrowseInstance(workspace, target, 'pack:a')).toBe(next);
    next.snapshot.sourceSelection = undefined;
    expect(findStoryBrowseInstance(workspace, target, '', 'b')).toBeUndefined();
    expect(findStoryBrowseInstance(workspace, target, '', 'a')).toBe(next);
  });
});
