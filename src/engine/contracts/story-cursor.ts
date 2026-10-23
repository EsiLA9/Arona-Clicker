import type { StoryNodeSnapshot } from './story-node-snapshot';
import type { StoryPresentationSnapshot } from './story-presentation-snapshot';

/** One owner-scoped new-node playback checkpoint and its completion metadata. */
export interface StoryCursorSnapshot {
  readonly playback: StoryNodeSnapshot;
  readonly isReplay: boolean;
  readonly lastChoiceIndex: number;
  /** Story document whose Choice supplied lastChoiceIndex, even after insert transfers. */
  readonly lastChoiceStoryId: string | null;
  readonly flags: readonly string[];
  /** Run-scoped visual state, restored under the new runId; never replays gameplay actions. */
  readonly presentation?: StoryPresentationSnapshot;
}

/** A global session plus independent chat-owner sessions for one Init. */
export interface StoryCursorCollection {
  readonly global: StoryCursorSnapshot;
  readonly chats: Readonly<Record<string, StoryCursorSnapshot>>;
}
