import type { StoryNodeDocument } from './story-node';

/**
 * Temporary UI projection DTO. It carries display data only; story authors use StoryDef nodes.
 * Runtime input, options, actions, jumps, work counts, and card requests live in the playback view.
 */
export interface Talklet {
  readonly text: string;
  readonly speaker?: string;
  readonly choices?: readonly StoryChoice[];
  /** Display projection for a new entryCard interaction; never an authoring/runtime request. */
  readonly kizuna?: { readonly storyId: string; readonly title?: string; readonly buttonText?: string; readonly align?: 'left' | 'right' };
  readonly kind?: 'talk' | 'narration' | 'click';
  readonly align?: 'center' | 'left' | 'right';
  readonly avatar?: string;
  readonly side?: 'left' | 'right';
  readonly noAvatar?: boolean;
  readonly showAvatar?: boolean;
  readonly image?: string;
  readonly typing?: number;
  readonly thinking?: number;
}

/** Read-only labels for a projected choice group; no condition or executable branch data. */
export interface StoryChoice {
  readonly id: string;
  readonly text: string;
}

/** The production StoryDef has one authoring format: StoryNodeDocument. */
export interface StoryDef extends StoryNodeDocument {}
