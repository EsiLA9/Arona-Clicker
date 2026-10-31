import type { StoryOutputContent, StoryOutputEntry } from '../../../engine/contracts/story-playback-state';

export type { StoryOutputContent, StoryOutputEntry };

/** One pure projection; reading it never creates timers or advances the Player. */
export interface StoryPresentationView {
  readonly owner: string | null;
  readonly runId?: string;
  readonly epoch: number;
  readonly revision: number;
  readonly entries: readonly StoryOutputEntry[];
  readonly phase: 'idle' | 'typing' | 'thinking' | 'operation' | 'banner' | 'continue' | 'input' | 'finishing' | 'failed';
  readonly token?: string;
  readonly typing?: StoryOutputContent;
  readonly banner?: { readonly title: string; readonly remainingMs: number };
  readonly error?: string;
}
