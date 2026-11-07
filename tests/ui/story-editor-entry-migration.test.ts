import { describe, expect, it } from 'vitest';
import { migrateLegacyStoryEntries } from '../../src/data-services/authoring/story-entry-migration';
import { parseFragment } from '../../src/data-services/datapack/fragment-parser';
import { createStoryEditorState } from '../../src/ui/story-editor/model';
import { STORY_EDITOR_ENTRY_BACKUP_KEY, STORY_EDITOR_STORAGE_KEY, StoryDraftPersistence } from '../../src/ui/story-editor/persistence';

const entry = () => ({ id: 'base:passivestory:affinity_hoshino_1', storyId: 'base:story:hoshino_1', type: 'passive', owner: 'base:character:hoshino', weight: 1, repeatable: false, affectionRequired: 2, cooldownFrames: 80,
  triggerCondition: { type: 'AND', conditions: [] }, availableInits: ['base:init:main'], replayable: true, block: { type: 'AND', conditions: [] } });
function envelope(rows: unknown[] = [entry()]) {
  return { version: 1, currentId: 'draft', drafts: [{ draftId: 'draft', sourceId: 'base:story:hoshino_1', savedAt: 123,
    document: { id: 'base:story:hoshino_1', name: '星野', stages: {}, nodes: [] },
    authoring: { stories: [], activeStories: [], passiveStories: rows, passivePools: [] },
    structuredRows: { '["$authoring","passiveStories"]': ['row1'] },
    structuredInputs: { '["$authoring","passiveStories","@row1","cooldownFrames"]': { text: '-', error: '请输入数字' } } }] };
}
function storageFor(raw: string, failKey?: string) {
  const values = new Map([[STORY_EDITOR_STORAGE_KEY, raw]]);
  return { values, get: (key: string) => values.get(key) ?? null, remove: (key: string) => { values.delete(key); },
    set: (key: string, value: string) => { if (key === failKey) throw new Error('quota'); values.set(key, value); } };
}

describe('legacy StoryEntry author content migration', () => {
  it('recovers the reported local affinity draft with exact backup and pending input retained', () => {
    const raw = JSON.stringify(envelope()), storage = storageFor(raw), state = createStoryEditorState();
    const persistence = new StoryDraftPersistence(storage); persistence.load(state);
    expect(state.storageBlocked, state.error ?? '').toBe(false);
    expect(storage.get(STORY_EDITOR_ENTRY_BACKUP_KEY)).toBe(raw);
    const draft = state.drafts[0];
    expect(draft.authoring?.passiveStories[0]).toEqual({ ...entry(), type: undefined, weight: undefined, repeatable: undefined, affectionRequired: undefined, cooldownFrames: undefined,
      activation: { kind: 'affection', when: { kind: 'level', level: 2 }, cooldownFrames: 80 } });
    expect(draft.structuredInputs?.['["$authoring","passiveStories","@row1","activation","cooldownFrames"]']).toEqual({ text: '-', error: '请输入数字' });
    expect(draft.savedAt).toBe(123);
    for (const key of ['type', 'weight', 'repeatable', 'affectionRequired', 'cooldownFrames']) expect(draft.authoring?.passiveStories[0]).not.toHaveProperty(key);
    expect(persistence.save(state, true)).toBe(true);
    const restored = createStoryEditorState(); persistence.load(restored);
    expect(restored.storageBlocked).toBe(false);
    expect(restored.drafts[0].authoring).toEqual(draft.authoring);
    expect(storage.get(STORY_EDITOR_ENTRY_BACKUP_KEY)).toBe(raw);
  });

  it('converts active, random, after-story and typed catalog without rewriting IDs or unrelated data', () => {
    const after = { ...entry(), pushAfterStory: 'base:story:before' } as Record<string, unknown>; delete after.affectionRequired;
    const random: Record<string, unknown> = { ...after, id: 'base:passivestory:random', repeatable: true, weight: 7 }; delete random.pushAfterStory;
    const data = { activeStories: [{ id: 'base:activestory:test', type: 'active', storyId: 'base:story:test', extra: { t: 'dict', v: {
      note: { t: 'str', v: '保留' }, storyCatalog: { t: 'dict', v: { category: { t: 'str', v: '主线' }, part: { t: 'str', v: '第一部' }, order: { t: 'int', v: 3 } } } } } }], passiveStories: [after, random] };
    expect(migrateLegacyStoryEntries(data)).toBe(true);
    expect(data.activeStories[0]).toMatchObject({ id: 'base:activestory:test', activation: { kind: 'active' }, catalog: { category: '主线', part: '第一部', order: 3 }, extra: { v: { note: { v: '保留' } } } });
    expect(data.passiveStories[0]).toMatchObject({ activation: { kind: 'affection', when: { kind: 'after-story', storyId: 'base:story:before' } } });
    expect(data.passiveStories[1]).toMatchObject({ activation: { kind: 'random', weight: 7, repeatable: true, cooldownFrames: 80 } });
    const snapshot = JSON.stringify(data);
    expect(migrateLegacyStoryEntries(data)).toBe(false);
    expect(JSON.stringify(data)).toBe(snapshot);
  });

  it.each([STORY_EDITOR_ENTRY_BACKUP_KEY, STORY_EDITOR_STORAGE_KEY])('does not replace drafts when writing %s fails', failKey => {
    const raw = JSON.stringify(envelope()), storage = storageFor(raw, failKey), state = createStoryEditorState();
    new StoryDraftPersistence(storage).load(state);
    expect(state.storageBlocked).toBe(true); expect(state.drafts).toEqual([]);
    expect(storage.get(STORY_EDITOR_STORAGE_KEY)).toBe(raw);
  });

  it.each([
    { ...entry(), activation: { kind: 'random', weight: 1, repeatable: false } },
    { ...entry(), pushAfterStory: 'base:story:before' },
    { ...entry(), type: 'active' },
    { ...entry(), weight: 'bad' },
  ])('retains the entire envelope when one entry is ambiguous or invalid', invalid => {
    const raw = JSON.stringify(envelope([entry(), invalid])), storage = storageFor(raw), state = createStoryEditorState();
    new StoryDraftPersistence(storage).load(state);
    expect(state.storageBlocked).toBe(true); expect(state.drafts).toEqual([]);
    expect(storage.get(STORY_EDITOR_STORAGE_KEY)).toBe(raw);
    expect(storage.get(STORY_EDITOR_ENTRY_BACKUP_KEY)).toBeNull();
  });

  it('uses the same conversion for imported pack fragments and reports source paths on failure', () => {
    expect(parseFragment('old/content.json', JSON.stringify({ passiveStories: [entry()] })).lists.passiveStories?.[0]).toMatchObject({ activation: { kind: 'affection', when: { level: 2 } } });
    expect(() => parseFragment('broken/content.json', JSON.stringify({ passiveStories: [{ ...entry(), pushAfterStory: 'conflict' }] }))).toThrow('[broken/content.json] Entry 迁移失败');
  });

  it('does not change new drafts or create unnecessary backups', () => {
    const value = envelope(); migrateLegacyStoryEntries(value.drafts[0].authoring);
    value.drafts[0].structuredInputs = {} as never;
    const raw = JSON.stringify(value), storage = storageFor(raw), state = createStoryEditorState();
    new StoryDraftPersistence(storage).load(state);
    expect(state.storageBlocked).toBe(false);
    expect(storage.get(STORY_EDITOR_ENTRY_BACKUP_KEY)).toBeNull();
    expect(storage.get(STORY_EDITOR_STORAGE_KEY)).toBe(raw);
  });

  it('retains old drafts when pending inputs cannot be matched to a row', () => {
    const value = envelope(); value.drafts[0].structuredRows = {} as never;
    const raw = JSON.stringify(value), storage = storageFor(raw), state = createStoryEditorState();
    new StoryDraftPersistence(storage).load(state);
    expect(state.storageBlocked).toBe(true);
    expect(state.error).toContain('行身份');
    expect(storage.get(STORY_EDITOR_STORAGE_KEY)).toBe(raw);
  });
});
