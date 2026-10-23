import type { ChatTextEffectValue } from './chat-presentation';
import type { ThemeEffectValue } from '../types/expression';

/** Request identity used by an active Entry invitation card. */
export interface StoryPresentationCardRequest {
  readonly entryId: string;
  readonly entryType: 'active';
  readonly owner: string | null;
  readonly intent: 'card';
}

/** A single visible overlay owned by an active StoryNode run. */
export interface StoryPresentationOverlaySnapshot {
  readonly id: string;
  readonly value: ChatTextEffectValue;
  readonly cardRequest?: StoryPresentationCardRequest;
}

/** A run-owned entity presentation override; other lifetimes use their existing policies. */
export interface StoryEntityPresentationSnapshot {
  readonly target: string;
  readonly optionId: string;
  readonly owner: string;
  readonly lifetime: 'story';
}

/** Ephemeral layer only; area/student themes are already stored in player state. */
export type StoryEphemeralThemeSnapshot = Omit<ThemeEffectValue, 'scope' | 'entityKey'> & {
  readonly scope: 'ephemeral';
};

/** Presentation resources for one active StoryNode run, reattached to a fresh runId on restore. */
export interface StoryPresentationSnapshot {
  readonly ephemeralTheme?: StoryEphemeralThemeSnapshot;
  readonly entities: readonly StoryEntityPresentationSnapshot[];
  readonly overlays: readonly StoryPresentationOverlaySnapshot[];
}
