import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatStream } from '../../src/ui/presentation/chat-stream';
import type { PanelState } from '../../src/ui/components/shared/app-shell';
const panel = (): PanelState => ({ chatEntries: [], chatTexts: [], studentChats: {}, studentChatTexts: {},
  conversationVariantId: 'watching', selectedVariantId: null, storyNavPath: [], leftTab: 'area', centerTab: 'chat', rightTab: 'spot' });
describe('new story UI owner routing', () => {
  afterEach(() => vi.useRealTimers());
  it('routes background/global overlays and explicit clears without changing the viewed conversation', () => {
    const chat = new ChatStream(), state = panel();
    const overlay = { id: 'hint', text: 'background', x: 0, y: 1, align: 'left' as const, timestamp: 1, runId: 'old' };
    chat.pushChatText(state, overlay, 'background');
    chat.pushChatText(state, { ...overlay, text: 'global' }, null);
    chat.pushChatText(state, { ...overlay, text: 'viewed' });
    chat.clearChatText(state, 'hint', 'background');
    expect(state.studentChatTexts.background).toEqual([]);
    expect(state.chatTexts[0].text).toBe('global');
    expect(state.studentChatTexts.watching[0].text).toBe('viewed');
    expect(state.conversationVariantId).toBe('watching');
  });
  it('ending an old run preserves a newer run overlay/banner and keeps body history', () => {
    vi.useFakeTimers();
    const chat = new ChatStream(), state = panel();
    chat.pushToOwner(state, 'background', { kind: 'talk', text: 'history' });
    for (const runId of ['old', 'new']) chat.pushChatText(state,
      { id: runId, text: runId, x: 0, y: 1, align: 'left', timestamp: 1, runId }, 'background');
    chat.showBanner('background', 'New title', 'new');
    chat.endRun(state, 'background', 'old');
    expect(state.studentChatTexts.background.map(entry => entry.runId)).toEqual(['new']);
    expect(state.studentChats.background[0].text).toBe('history');
    state.conversationVariantId = 'background';
    expect(chat.activeBanner(state)?.title).toBe('New title');
    chat.endRun(state, 'background', 'new');
    expect(chat.activeBanner(state)).toBeNull();
    chat.reset();
  });
});
