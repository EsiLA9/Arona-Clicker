// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import type { StoryView } from '../../src/arona-clicker/contracts/runtime/results';
import type { PanelState } from '../../src/ui/components/shared/app-shell';
import { UIController } from '../../src/ui/controller/controller';
import { bindEvents } from '../../src/ui/controller/controller-events';
import { ChatStream } from '../../src/ui/presentation/chat-stream';

const OFFICE = 'base:init:schale_office';

describe('Story completion and travel notices follow their source owner', () => {
  let game: GameInstance;
  let controller: UIController;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
    controller = new UIController(game, document.querySelector('#app')!);
    controller.started = true;
    bindEvents(controller);
  });

  afterEach(() => {
    controller.destroy();
    game.stop();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('routes travel notices to owner, global, or the legacy active stream as specified', () => {
    controller.panelState.conversationVariantId = 'Hoshino';
    const areaId = game.getView().currentAreaId!;

    game.eventBus.emit({ type: 'storyAreaTraveled', areaId, owner: 'background', runId: 'run-a' });
    game.eventBus.emit({ type: 'storyAreaTraveled', areaId, owner: null, runId: 'run-b' });
    game.eventBus.emit({ type: 'storyAreaTraveled', areaId });
    controller.render();

    const notice = `移动到了 ${game.registry.areas.get(areaId)?.name ?? areaId}`;
    expect(controller.panelState.studentChats.background?.map(entry => entry.text)).toContain(notice);
    expect(controller.panelState.chatEntries.map(entry => entry.text)).toContain(notice);
    expect(controller.panelState.studentChats.Hoshino?.map(entry => entry.text)).toContain(notice);
    expect(controller.panelState.conversationVariantId).toBe('Hoshino');
  });

  it('does not let another owner’s active story hold a reward, and delivers into the event owner stream', () => {
    vi.useFakeTimers();
    game.mutations.acquireCharacter('Hoshino', 'gacha');
    expect(game.story.startCardStory('base:activestory:bond_hoshino_1', 'Hoshino').success).toBe(true);
    controller.panelState.conversationVariantId = 'Hoshino';

    game.eventBus.emit({
      type: 'storyRewarded', storyId: 'test:story', source: 'first', effects: [], flags: [],
      owner: 'background', runId: 'background-run',
    });
    controller.render();
    expect(controller.pendingRewardChats).toHaveLength(1);
    expect(controller.panelState.studentChats.background?.some(entry => entry.text.includes('首次完成')) ?? false).toBe(false);

    vi.advanceTimersByTime(UIController.REWARD_REVEAL_DELAY_MS);

    expect(game.getStoryView('Hoshino')).not.toBeNull();
    expect(controller.panelState.studentChats.background?.some(entry => entry.kind === 'reward' && entry.text.includes('首次完成'))).toBe(true);
    expect(controller.panelState.studentChats.Hoshino?.some(entry => entry.text.includes('首次完成')) ?? false).toBe(false);
    expect(controller.panelState.conversationVariantId).toBe('Hoshino');
    expect(controller.pendingRewardChats).toHaveLength(0);
  });

  it('flushes a queued global reward before saving without rerouting it to the open conversation', () => {
    vi.useFakeTimers();
    controller.panelState.conversationVariantId = 'Hoshino';
    game.eventBus.emit({
      type: 'storyRewarded', storyId: 'test:story', source: 'repeat', effects: [], flags: [],
      owner: null, runId: 'global-run',
    });
    controller.render();

    const saved = controller.withHistories({} as never);

    expect(controller.pendingRewardChats).toHaveLength(0);
    expect(controller.panelState.chatEntries.some(entry => entry.kind === 'reward' && entry.text.includes('再次完成'))).toBe(true);
    expect(controller.panelState.studentChats.Hoshino?.some(entry => entry.text.includes('再次完成')) ?? false).toBe(false);
    expect((saved.chatHistories?.global as { text: string }[]).some(entry => entry.text.includes('再次完成'))).toBe(true);
  });
});

describe('ChatStream restored run cleanup', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('endRun cancels a gate rebuilt from restored history for that run', () => {
    vi.useFakeTimers();
    const story: StoryView = {
      storyId: 'test:entry', type: 'active', storyDefId: 'test:def', pageIndex: 0, totalPages: 1,
      page: { kind: 'talk', speaker: 'A', text: 'Restored line', thinking: 1 },
      availableChoiceIndexes: [], nodeId: 'node-a', token: 'token-a', phase: 'delivery',
      runId: 'run-a', historyId: 'history-a', waitSequence: 1, nextIsInput: true,
    };
    const fingerprint = JSON.stringify([
      story.historyId ?? story.runId, story.storyId, story.storyDefId,
      story.nodeId ?? story.pageIndex, story.waitSequence,
    ]);
    const panel: PanelState = {
      service: 'game', leftTab: 'area', centerTab: 'chat', rightTab: 'spot',
      chatEntries: [{ id: 1, kind: 'talk', text: 'Restored line', storyPageKey: fingerprint, timestamp: 1 }],
      chatTexts: [], selectedVariantId: null, conversationVariantId: null,
      studentChats: {}, studentChatTexts: {}, storyNavPath: [],
    };
    const gameReadModel = {
      getView: () => ({ currentStory: story }),
      getStoryView: () => null,
    } as unknown as Parameters<ChatStream['restoreHistoryState']>[1];
    const chat = new ChatStream();
    chat.onChange = vi.fn();

    chat.restoreHistoryState(panel, gameReadModel);
    expect(vi.getTimerCount()).toBe(1);

    chat.endRun(panel, null, 'run-a');
    vi.advanceTimersByTime(2_000);

    expect(vi.getTimerCount()).toBe(0);
    expect(chat.onChange).not.toHaveBeenCalled();
  });
});
