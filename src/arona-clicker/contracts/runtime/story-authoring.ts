import type { StoryAuthoringPatch, StoryAuthoringResult } from '../../../data-services/authoring/story-authoring';
import type { StoryPresentationView } from './story-presentation';
import type { StoryView, SendState } from './results';
export type { StoryAuthoringPatch, StoryAuthoringResult };
/** Isolated candidate playback; closing releases all timers and never commits player progress. */
export interface StoryAuthoringPreview {
  getView(): StoryPresentationView | null;
  getStory(): StoryView | null;
  getSendState(): SendState;
  advance(optionId?: string): StoryAuthoringResult;
  close(): void;
}
export type StoryAuthoringPreviewResult = { ok: true; preview: StoryAuthoringPreview } | { ok: false; message: string };
