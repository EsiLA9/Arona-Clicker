import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ChatStream, DEFAULT_RHYTHM_SECONDS } from '../../src/ui/presentation/chat-stream';
import type { PanelState } from '../../src/ui/components/shared/app-shell';
import type { StoryView } from '../../src/arona-clicker/contracts/runtime/results';
import type { GameReadModel } from '../../src/arona-clicker/contracts';
import type { Talklet } from '../../src/data-services/contracts/story';

const panel = (): PanelState => ({ chatEntries: [], chatTexts: [], studentChats: {}, studentChatTexts: {},
  conversationVariantId: null, selectedVariantId: null, storyNavPath: [], leftTab: 'area', centerTab: 'chat', rightTab: 'spot' });
const view = (page: Talklet, index = 0, nextIsInput = true): StoryView => ({ storyId: 'entry:test', storyDefId: 'story:test',
  type: 'active', pageIndex: index, totalPages: 3, page, availableChoiceIndexes: [], phase: 'delivery',
  nodeId: `node-${index}`, token: `ticket-${index}`, runId: 'run-test', historyId: 'history-test', waitSequence: index + 1, nextIsInput });
const game = (current: StoryView | null) => ({ getView: () => ({ currentStory: current }), getStoryView: () => current }) as unknown as Pick<GameReadModel, 'getView' | 'getStoryView'>;

describe('new Story delivery rhythm', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  test('default left talk types, is delivered, then thinks before acknowledging the input boundary', () => {
    const chat = new ChatStream(), state = panel();
    chat.onAutoAdvance = vi.fn();
    chat.syncCurrentStory(state, game(view({ text: '你好', speaker: '星野' })));
    expect(state.chatEntries[0].kind).toBe('typing');
    vi.advanceTimersByTime(DEFAULT_RHYTHM_SECONDS * 1000);
    expect(state.chatEntries[0]).toMatchObject({ kind: 'talk', text: '你好' });
    expect(chat.activeGate(state)).toBe('thinking');
    expect(chat.onAutoAdvance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DEFAULT_RHYTHM_SECONDS * 1000 + 1);
    expect(chat.activeGate(state)).toBeNull();
    expect(chat.onAutoAdvance).toHaveBeenCalledWith('#global', 'ticket-0');
    chat.reset();
  });
  test('auto body delivery uses a short pause rather than guessing an input from text fields', () => {
    const chat = new ChatStream(), state = panel();
    chat.onAutoAdvance = vi.fn();
    chat.syncCurrentStory(state, game(view({ text: '连发', typing: 0 }, 0, false)));
    expect(chat.activeGate(state)).toBe('pause');
    vi.advanceTimersByTime(401);
    expect(chat.onAutoAdvance).toHaveBeenCalledOnce();
  });
  test.each([{ kind: 'narration' as const, text: '独白' }, { text: '老师发言', side: 'right' as const }])('right talk and narration do not type', page => {
    const chat = new ChatStream(), state = panel();
    chat.syncCurrentStory(state, game(view(page)));
    expect(state.chatEntries[0].text).toBe(page.text);
    expect(state.chatEntries[0].kind).not.toBe('typing');
    chat.reset();
  });
  test('explicit typing and thinking are independent and long delays are clamped', () => {
    const chat = new ChatStream(), state = panel();
    chat.onAutoAdvance = vi.fn();
    chat.syncCurrentStory(state, game(view({ text: '文字', typing: 0, thinking: 20 })));
    expect(state.chatEntries[0].kind).toBe('talk');
    vi.advanceTimersByTime(9999);
    expect(chat.onAutoAdvance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(chat.onAutoAdvance).toHaveBeenCalledOnce();
  });
  test('acceleration affects only the displayed owner and never submits a not-yet-delivered body', () => {
    const chat = new ChatStream(), state = panel(); state.conversationVariantId = 'Hoshino';
    chat.onAutoAdvance = vi.fn();
    chat.syncCurrentStory(state, game(view({ text: '星野的话', thinking: 0 })));
    state.conversationVariantId = 'Serika';
    chat.accelerateActiveGate(state);
    expect(state.studentChats.Hoshino[0].kind).toBe('typing');
    state.conversationVariantId = 'Hoshino'; chat.accelerateActiveGate(state);
    expect(state.studentChats.Hoshino[0].text).toBe('星野的话');
    vi.advanceTimersByTime(1);
    expect(chat.onAutoAdvance).toHaveBeenCalledWith('Hoshino', 'ticket-0');
  });
  test('reset cancels all typing, pause and delayed acknowledgment timers', () => {
    const chat = new ChatStream(), state = panel(); chat.onAutoAdvance = vi.fn();
    chat.syncCurrentStory(state, game(view({ text: '未送达' })));
    chat.reset(); vi.runAllTimers();
    expect(state.chatEntries).toEqual([]);
    expect(chat.onAutoAdvance).not.toHaveBeenCalled();
  });
  test('same node revisited in a new wait is delivered again, repeated views are not', () => {
    const chat = new ChatStream(), state = panel();
    const first = view({ text: '循环', typing: 0, thinking: 0 });
    chat.syncCurrentStory(state, game(first)); chat.syncCurrentStory(state, game(first));
    expect(state.chatEntries).toHaveLength(1);
    chat.syncCurrentStory(state, game({ ...first, token: 'again', waitSequence: 2 }));
    expect(state.chatEntries.map(entry => entry.text)).toEqual(['循环', '循环']);
    chat.reset();
  });
  test('clearFlow is owner-local and cancels only the target stream rhythm', () => {
    const chat = new ChatStream(), state = panel(); chat.onAutoAdvance = vi.fn();
    state.conversationVariantId = 'Hoshino'; chat.syncCurrentStory(state, game(view({ text: '星野' })));
    state.conversationVariantId = 'Serika'; chat.syncCurrentStory(state, game(view({ text: '芹香' })));
    chat.clearAll(state, 'Hoshino');
    vi.advanceTimersByTime(1801);
    expect(state.studentChats.Hoshino).toEqual([]);
    expect(state.studentChats.Serika[0].text).toBe('芹香');
    expect(chat.onAutoAdvance).toHaveBeenCalledWith('Serika', 'ticket-0');
    expect(chat.onAutoAdvance).not.toHaveBeenCalledWith('Hoshino', 'ticket-0');
    chat.reset();
  });
});
