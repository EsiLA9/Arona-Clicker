import type { StoryAuthoringPatch, StoryAuthoringResult } from '../../../data-services/authoring/story-authoring';
import type { StoryPresentationView } from './story-presentation';
import type { StoryView, SendState } from './results';
import type { BackgroundLayerDef } from '../../../engine/types/theme';
import type { StoryPresentationSnapshot } from '../../../engine/contracts/story-presentation-snapshot';
export type { StoryAuthoringPatch, StoryAuthoringResult };
export type { StoryIdentityChange } from '../../../data-services/authoring/story-identity';
/** Isolated candidate playback; closing releases all timers and never commits player progress. */
export interface StoryAuthoringPreview {
  getView(): StoryPresentationView | null;
  getStory(): StoryView | null;
  getProjection(): StoryAuthoringPreviewProjection | null;
  getSendState(): SendState;
  advance(optionId?: string): StoryAuthoringResult;
  close(): void;
}
/** Small detached view for a visual host; never exposes the preview GameInstance. */
export interface StoryAuthoringPreviewProjection {
  readonly revision: number;
  readonly scene: { readonly type: 'area'; readonly id: string } | { readonly type: 'chara'; readonly id: string };
  readonly theme: { readonly tokens: Readonly<Record<string, string>>; readonly palette: readonly string[]; readonly background: readonly BackgroundLayerDef[] };
  readonly presentation: StoryPresentationSnapshot;
}
export type StoryAuthoringPreviewResult = { ok: true; preview: StoryAuthoringPreview } | { ok: false; message: string };
