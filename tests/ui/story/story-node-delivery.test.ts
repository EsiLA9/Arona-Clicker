import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatStream } from '../../../src/ui/presentation/chat-stream';
import { output, playbackPanel, playbackReader, presentation } from './story-playback-fixtures';

describe('Runtime Story output projection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('projects two displays from one Runtime record without scheduling delivery or changing Runtime state', () => {
    const chat = new ChatStream(), state = playbackPanel();
    const current = presentation({ entries: [output(1)] });
    const snapshot = structuredClone(current);
    const reader = playbackReader(() => current);
    chat.syncCurrentStory(state, reader);
    const id = state.chatEntries[0]!.id;
    chat.syncCurrentStory({ ...state }, reader);
    vi.advanceTimersByTime(100_000);
    expect(state.chatEntries).toHaveLength(1);
    expect(state.chatEntries[0]).toMatchObject({ id, storyOutputId: 'history:1' });
    expect(typeof id).toBe('number');
    expect(vi.getTimerCount()).toBe(0);
    expect(current).toEqual(snapshot);
  });

  it('projects background and global records to their source owner when another student is selected', () => {
    const chat = new ChatStream(), state = playbackPanel();
    state.conversationVariantId = 'watching';
    const reader = playbackReader(owner => presentation({ owner, entries: [output(1, owner ?? 'global')] }));
    chat.syncCurrentStory({ ...state, conversationVariantId: null }, reader);
    chat.syncCurrentStory({ ...state, conversationVariantId: 'background' }, reader);
    expect(state.chatEntries.map(entry => entry.text)).toEqual(['global']);
    expect(state.studentChats.background!.map(entry => entry.text)).toEqual(['background']);
    expect(state.studentChats.watching).toBeUndefined();
    expect(state.conversationVariantId).toBe('watching');
  });

  it('uses the Runtime epoch and retained records after clear and pruning, without counting effect history', () => {
    const chat = new ChatStream(), state = playbackPanel();
    let current = presentation({ entries: [output(1), output(2)] });
    const reader = playbackReader(() => current);
    chat.syncCurrentStory(state, reader);
    chat.push(state, { kind: 'system', text: 'local' });
    current = presentation({ entries: [output(2), output(3)] });
    chat.syncCurrentStory(state, reader);
    expect(state.chatEntries.filter(entry => entry.storyOutputId).map(entry => entry.text)).toEqual(['line-2', 'line-3']);
    current = presentation({ epoch: 1, entries: [output(4)] });
    chat.syncCurrentStory(state, reader);
    chat.syncCurrentStory(state, reader);
    expect(state.chatEntries.map(entry => entry.text)).toEqual(['line-4']);
  });

  it('restores authoritative output with fresh input identity without appending it twice', () => {
    const chat = new ChatStream(), state = playbackPanel();
    let current = presentation({ entries: [output(1)] });
    const reader = playbackReader(() => current);
    chat.syncCurrentStory(state, reader);
    const id = state.chatEntries[0]!.id;
    current = presentation({ entries: [output(1)], runId: 'restored-run', token: 'fresh-intent' });
    chat.restoreHistoryState(state, reader);
    chat.syncCurrentStory(state, reader);
    expect(state.chatEntries).toHaveLength(1);
    expect(state.chatEntries[0]!.id).toBe(id);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps Runtime output order and numeric identities stable at the display limit', () => {
    const chat = new ChatStream(), state = playbackPanel();
    const current = presentation({ entries: Array.from({ length: 200 }, (_, index) => output(index + 1)) });
    const reader = playbackReader(() => current);
    chat.syncCurrentStory(state, reader);
    chat.push(state, { kind: 'system', text: 'local notice' });
    chat.syncCurrentStory(state, reader);
    const ids = state.chatEntries.map(entry => entry.id);
    chat.syncCurrentStory(state, reader);
    expect(state.chatEntries.map(entry => entry.id)).toEqual(ids);
    expect(state.chatEntries.filter(entry => entry.storyOutputId).map(entry => entry.text)).toEqual(current.entries.slice(1).map(entry => entry.text));
  });
});
