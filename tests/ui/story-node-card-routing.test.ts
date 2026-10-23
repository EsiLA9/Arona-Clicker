// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { bindStoryActions } from '../../src/ui/controller/controller-actions-story';
import type { UIController } from '../../src/ui/controller/controller';
import type { StoryView } from '../../src/arona-clicker/contracts/runtime/results';
function fixture() {
  document.body.innerHTML = '<div id="root"><div data-story-card-token="ticket"></div><button data-story-gate-confirm>确认</button></div>';
  let view: StoryView = { storyId: 'entry:source', storyDefId: 'story:source', type: 'active', pageIndex: 1, totalPages: 2,
    phase: 'input', nodeId: 'card', runId: 'source-run', token: 'ticket', availableChoiceIndexes: [],
    page: { kind: 'click', text: '', kizuna: { storyId: 'entry:next' } } };
  const commands = { clickSend: vi.fn(() => ({ type: 'choice' as const })), startCardStory: vi.fn() };
  const controller = { root: document.querySelector('#root'), panelState: { conversationVariantId: 'guest', storyGate: null },
    chat: { bannerBlocking: () => false, activeGate: () => null }, commands,
    game: { getView: () => ({ currentStory: view }), getStoryView: () => view },
    refreshChatPanel: vi.fn(), deliverPendingRewardsBeforeStory: vi.fn(),
  } as unknown as UIController;
  bindStoryActions(controller);
  return { controller, commands, replaceRun: () => { view = { ...view, runId: 'new-run', token: 'new-ticket' }; },
    clickCard: () => document.querySelector<HTMLElement>('[data-story-card-token]')!.click(),
    confirm: () => document.querySelector<HTMLButtonElement>('[data-story-gate-confirm]')!.click() };
}
describe('new node card confirmation stays attached to its source', () => {
  it('confirms by submitting the captured wait instead of bypassing the source Player', () => {
    const f = fixture();
    f.clickCard();
    expect(f.controller.panelState.storyGate).toMatchObject({ sourceOwner: 'guest', sourceRunId: 'source-run', sourceToken: 'ticket' });
    expect(f.commands.clickSend).not.toHaveBeenCalled();
    f.confirm();
    expect(f.commands.clickSend).toHaveBeenCalledWith('guest', 'ticket');
    expect(f.commands.startCardStory).not.toHaveBeenCalled();
  });
  it('rejects a confirmation left open after its source run was replaced', () => {
    const f = fixture();
    f.clickCard(); f.replaceRun(); f.confirm();
    expect(f.commands.clickSend).not.toHaveBeenCalled();
    expect(f.commands.startCardStory).not.toHaveBeenCalled();
  });
});
