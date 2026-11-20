import type { StoryAuthoringPatch, StoryAuthoringResult } from '../../../data-services/authoring/story-authoring';
import type { StoryPresentationView } from './story-presentation';
import type { StoryView, SendState } from './results';
import type { BackgroundLayerDef } from '../../../engine/types/theme';
import type { StoryPresentationSnapshot } from '../../../engine/contracts/story-presentation-snapshot';
import type { Condition } from '../../../engine/types/expression';
export type { StoryAuthoringPatch, StoryAuthoringResult };
export type { StoryIdentityChange } from '../../../data-services/authoring/story-identity';
/** Isolated candidate playback; closing releases all timers and never commits player progress. */
export interface StoryAuthoringPreview {
  getView(): StoryPresentationView | null;
  getStory(): StoryView | null;
  getProjection(): StoryAuthoringPreviewProjection | null;
  getSendState(): SendState;
  getDecisions(): StoryPreviewDecisions;
  decide(id: string, choices: Readonly<Record<string, StoryPreviewDecision>>): StoryAuthoringResult;
  advance(optionId?: string, expectedToken?: string): StoryAuthoringResult;
  close(): void;
}
export type StoryPreviewDecision = 'actual' | 'pass' | 'fail';
export type StoryPreviewRequirement =
  | { readonly kind: 'group'; readonly operator: 'AND' | 'OR'; readonly met: boolean | null; readonly children: readonly StoryPreviewRequirement[] }
  | { readonly kind: 'condition'; readonly condition: Condition; readonly met: boolean | null; readonly areaId?: string | null }
  | { readonly kind: 'requirement'; readonly text: string; readonly met: boolean };
export interface StoryPreviewCheckItem {
  readonly id: string;
  readonly label: string;
  readonly requirement: StoryPreviewRequirement & { readonly met: boolean };
}
export interface StoryPreviewCheck {
  readonly id: string;
  readonly kind: 'entry' | 'choice' | 'transfer';
  readonly entryId: string;
  readonly storyId: string;
  readonly nodeId?: string;
  readonly items: readonly StoryPreviewCheckItem[];
}
export interface StoryPreviewDecisions {
  readonly entryId: string;
  readonly entryTitle: string;
  readonly directStory?: true;
  readonly pending?: StoryPreviewCheck;
  readonly history: readonly (StoryPreviewCheck & { readonly adopted: Readonly<Record<string, boolean>> })[];
  readonly route: readonly {
    readonly kind: 'start' | 'child' | 'goto' | 'insert' | 'return';
    readonly entryId: string;
    readonly storyId: string;
    readonly title: string;
  }[];
  readonly message?: string;
}
/** Small detached view for a visual host; never exposes the preview GameInstance. */
export interface StoryAuthoringPreviewProjection {
  readonly revision: number;
  readonly scene: { readonly type: 'area'; readonly id: string } | { readonly type: 'chara'; readonly id: string };
  readonly theme: { readonly tokens: Readonly<Record<string, string>>; readonly palette: readonly string[]; readonly background: readonly BackgroundLayerDef[] };
  readonly presentation: StoryPresentationSnapshot;
}
export type StoryAuthoringPreviewResult = { ok: true; preview: StoryAuthoringPreview } | { ok: false; message: string };
/** Existing Entry ID, or a Story to play through a temporary isolated entry. */
export type StoryAuthoringPreviewTarget = string | { readonly storyId: string };
