import type { Effect } from '../types/expression';
import type { StoryRunFlags } from './story-run-flags';

/** Persisted Story output, independent of UI message IDs and mounted displays. */
export interface StoryOutputContent {
  readonly kind: 'talk' | 'narration' | 'reward' | 'travel';
  readonly text: string;
  readonly speaker?: string;
  readonly avatar?: string;
  readonly image?: string;
  readonly side?: 'left' | 'right';
  readonly align?: 'left' | 'center' | 'right';
  readonly noAvatar?: boolean;
  readonly showAvatar?: boolean;
  readonly storyType?: 'active' | 'passive';
  readonly storyPageKey?: string;
  /** Submitted Choice retained as a read-only card, independent of the next input. */
  readonly choice?: {
    readonly options: readonly { readonly id: string; readonly text: string }[];
    readonly selectedOptionId: string;
  };
}

export interface StoryOutputEntry extends StoryOutputContent {
  readonly id: string;
  readonly sequence: number;
  readonly timestamp: number;
  readonly historyId: string;
}

export type StoryPresentationPhase = 'typing' | 'thinking' | 'operation' | 'banner';
export type StoryPlaybackStep =
  | { readonly kind: 'delay'; readonly phase: StoryPresentationPhase; readonly durationMs: number; readonly typing?: StoryOutputContent; readonly title?: string }
  | { readonly kind: 'output'; readonly content: StoryOutputContent }
  | { readonly kind: 'effect'; readonly effect: Effect };

/** Only the current Player barrier's subordinate presentation progress. */
export interface StoryPlaybackQueueSnapshot {
  readonly key: string;
  readonly steps: readonly StoryPlaybackStep[];
  readonly index: number;
  readonly remainingMs: number;
  readonly ready: boolean;
  readonly suppressed: boolean;
  readonly delivered: boolean;
  readonly automatic: boolean;
}

export interface StoryOutputSnapshot {
  readonly epoch: number;
  readonly sequence: number;
  readonly entries: readonly StoryOutputEntry[];
}

export interface StoryDeferredStart {
  readonly requestId: string;
  readonly entryId: string;
  readonly expectedType: 'active' | 'passive';
  readonly owner: string | null;
  readonly replayId?: string;
  readonly options?: { readonly force?: boolean; readonly skipConditions?: boolean; readonly replaceAny?: boolean; readonly initialFlags?: StoryRunFlags };
  readonly causalChainId: string;
  readonly handoffCount: number;
}
