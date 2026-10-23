import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatStream } from '../../src/ui/presentation/chat-stream';
import type { PanelState } from '../../src/ui/components/shared/app-shell';
import type { StoryView } from '../../src/arona-clicker/contracts/runtime/results';
import type { GameReadModel } from '../../src/arona-clicker/contracts';

function panel(): PanelState { return { chatEntries: [], chatTexts: [], studentChats: {}, studentChatTexts: {},
  conversationVariantId: null, selectedVariantId: null, storyNavPath: [], leftTab: 'area', centerTab: 'chat', rightTab: 'spot' }; }
function view(id = 'line', kind: 'talk' | 'narration' = 'talk'): StoryView {
  return { storyId: 'entry:test', storyDefId: 'story:test', type: 'active', pageIndex: 0, totalPages: 3,
    phase: 'delivery', nodeId: id, token: `token-${id}`, runId: 'run-test', historyId: 'history-test', availableChoiceIndexes: [],
    page: { text: id, kind, typing: 0, thinking: 0 } };
}
function game(current: StoryView | null): Pick<GameReadModel, 'getView' | 'getStoryView'> {
  return { getView: () => ({ currentStory: current }), getStoryView: () => current } as unknown as Pick<GameReadModel, 'getView' | 'getStoryView'>;
}
describe('new node delivery acknowledges the actual delivered wait', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it.each(['talk', 'narration'] as const)('acknowledges %s after delivery and does not infer a button', kind => {
    const chat = new ChatStream(), state = panel();
    chat.onAutoAdvance = vi.fn();
    chat.syncCurrentStory(state, game(view('line', kind)));
    expect(state.chatEntries.map(entry => entry.text)).toEqual(['line']);
    vi.advanceTimersByTime(1);
    expect(chat.onAutoAdvance).toHaveBeenCalledWith('#global', 'token-line');
    chat.syncCurrentStory(state, game(view('line', kind)));
    expect(state.chatEntries).toHaveLength(1);
  });
  it('waits for typing delivery, then acknowledges its captured token', () => {
    const chat = new ChatStream(), state = panel();
    const line = view(); line.page = { text: 'hello', typing: 0.1, thinking: 0 };
    chat.onAutoAdvance = vi.fn();
    chat.syncCurrentStory(state, game(line));
    expect(state.chatEntries[0].kind).toBe('typing');
    vi.advanceTimersByTime(99);
    expect(chat.onAutoAdvance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(state.chatEntries[0]).toMatchObject({ kind: 'talk', text: 'hello' });
    expect(chat.onAutoAdvance).toHaveBeenCalledWith('#global', 'token-line');
  });
  it('input does not append a body or leave a pending body timer able to submit it', () => {
    const chat = new ChatStream(), state = panel();
    chat.onAutoAdvance = vi.fn();
    chat.syncCurrentStory(state, game(view()));
    chat.syncCurrentStory(state, game({ ...view('choice'), phase: 'input', page: { kind: 'click', text: '', choices: [{ id: 'yes', text: 'Yes' }] } }));
    vi.runAllTimers();
    expect(chat.onAutoAdvance).not.toHaveBeenCalled();
    expect(state.chatEntries).toHaveLength(1);
  });
  it('restored delivered history acknowledges using a fresh token without duplicate text', () => {
    const chat = new ChatStream(), state = panel();
    chat.syncCurrentStory(state, game(view()));
    chat.reset();
    const restored = { ...view(), token: 'fresh-token', runId: 'fresh-run' };
    chat.onAutoAdvance = vi.fn();
    chat.restoreHistoryState(state, game(restored));
    chat.syncCurrentStory(state, game(restored));
    vi.advanceTimersByTime(1);
    expect(state.chatEntries).toHaveLength(1);
    expect(chat.onAutoAdvance).toHaveBeenCalledWith('#global', 'fresh-token');
  });
});
