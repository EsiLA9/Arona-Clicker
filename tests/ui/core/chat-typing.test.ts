import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatStream } from '../../../src/ui/presentation/chat-stream';
import { output, playbackPanel, playbackReader, presentation } from '../story/story-playback-fixtures';

describe('Runtime Story rhythm projection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders typing as a transient snapshot and waits for Runtime to commit the body', () => {
    const chat = new ChatStream(), state = playbackPanel();
    let current = presentation({ phase: 'typing', typing: { kind: 'talk', text: 'hello', speaker: 'A' } });
    const reader = playbackReader(() => current);
    chat.syncCurrentStory(state, reader);
    const id = state.chatEntries[0]!.id;
    vi.advanceTimersByTime(100_000);
    chat.syncCurrentStory(state, reader);
    expect(state.chatEntries).toMatchObject([{ kind: 'typing', text: '', id }]);
    expect(chat.activeGate(state)).toBe('typing');
    expect(vi.getTimerCount()).toBe(0);
    current = presentation({ phase: 'thinking', entries: [output(1, 'hello')], token: 'thinking-intent' });
    chat.syncCurrentStory(state, reader);
    expect(state.chatEntries.map(entry => entry.kind)).toEqual(['talk']);
    expect(state.chatEntries[0]!.text).toBe('hello');
    expect(chat.activeGate(state)).toBe('thinking');
    current = presentation({ entries: [output(1, 'hello')] });
    chat.syncCurrentStory(state, reader);
    expect(chat.activeGate(state)).toBeNull();
  });

  it('reflects input and blocked Operation/banner phases without installing UI timers', () => {
    const chat = new ChatStream(), state = playbackPanel();
    let current = presentation({ phase: 'operation' });
    const reader = playbackReader(() => current);
    chat.syncCurrentStory(state, reader);
    expect(chat.activeGate(state)).toBe('pause');
    current = presentation({ phase: 'banner', banner: { title: 'Title', remainingMs: 2000 } });
    chat.syncCurrentStory(state, reader);
    expect(chat.bannerBlocking(state)).toBe(true);
    expect(chat.activeBanner(state)?.title).toBe('Title');
    expect(vi.getTimerCount()).toBe(0);
    current = presentation({ phase: 'input' });
    chat.syncCurrentStory(state, reader);
    expect(chat.activeGate(state)).toBeNull();
    expect(chat.activeBanner(state)).toBeNull();
    expect(state.chatEntries).toEqual([]);
  });

  it('reset removes transient projection state without submitting or delivering a body', () => {
    const chat = new ChatStream(), state = playbackPanel();
    const reader = playbackReader(() => presentation({ phase: 'typing', typing: { kind: 'talk', text: 'not delivered' } }));
    chat.syncCurrentStory(state, reader);
    chat.reset();
    expect(chat.activeGate(state)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    chat.syncCurrentStory(state, playbackReader(() => presentation({ phase: 'idle' })));
    expect(state.chatEntries).toEqual([]);
  });
});
