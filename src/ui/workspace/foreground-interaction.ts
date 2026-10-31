import type { GameReadModel } from '../../arona-clicker/contracts';
import type { PanelState } from '../components/shared/app-shell';

export type ForegroundIntent = 'openAreaOverview' | 'openAreaMap' | 'attemptAreaTravel';
export type ForegroundStatus = { allowed: true } | { allowed: false; reason: 'StoryBlocked' | 'ChoicePending' | 'ConfirmationPending' | 'Busy' };

export function isReplayPresentationActive(state: Partial<Pick<PanelState, 'storyReplay'>>): boolean {
  return Boolean(state.storyReplay && !state.storyReplay.completed);
}

/** UI-owned transient admission, shared by overview and navigation. Never pauses Tick. */
export function getForegroundInteractionStatus(
  game: Pick<GameReadModel, 'story'>,
  state: Pick<PanelState, 'conversationVariantId' | 'storyGate'> & Partial<Pick<PanelState, 'storyReplay'>>,
  intent: ForegroundIntent,
  busy: { confirmation?: boolean; submitting?: boolean; transitioning?: boolean } = {},
): ForegroundStatus {
  if (busy.submitting || busy.transitioning) return { allowed: false, reason: 'Busy' };
  if (state.storyGate || busy.confirmation) return { allowed: false, reason: 'ConfirmationPending' };
  if (isReplayPresentationActive(state)) return { allowed: false, reason: 'StoryBlocked' };
  const owners = state.conversationVariantId ? [null, state.conversationVariantId] : [null];
  for (const owner of owners) {
    if (game.story.isBlockingInteraction(owner) || intent === 'attemptAreaTravel' && game.story.isBlockingMovement(owner)) {
      return { allowed: false, reason: 'StoryBlocked' };
    }
    const story = game.story.getCurrentStoryView(owner);
    if (story?.page.choices?.length) return { allowed: false, reason: 'ChoicePending' };
  }
  return { allowed: true };
}
