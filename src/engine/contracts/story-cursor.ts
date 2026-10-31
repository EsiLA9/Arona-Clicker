import type { StoryNodeSnapshot } from './story-node-snapshot';
import type { StoryPresentationSnapshot } from './story-presentation-snapshot';
import type { StoryOutputSnapshot, StoryPlaybackQueueSnapshot, StoryDeferredStart } from './story-playback-state';

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
  readonly output: StoryOutputSnapshot;
  readonly queue?: StoryPlaybackQueueSnapshot;
  readonly documents?: Readonly<Record<string, string>>;
  readonly finishing?: {
    readonly source: NonNullable<StoryNodeSnapshot['run']>['source'];
    readonly terminalStoryId: string;
    readonly settled: boolean;
    readonly error?: string;
    readonly receipts?: readonly import('./effect-receipt').EffectReceipt[];
    readonly completionRecorded?: boolean;
  };
}

/** A global session plus independent chat-owner sessions for one Init. */
export interface StoryCursorCollection {
  readonly format: 'story-playback-v2';
  readonly global: StoryCursorSnapshot;
  readonly chats: Readonly<Record<string, StoryCursorSnapshot>>;
  readonly pendingStarts: readonly StoryDeferredStart[];
}
