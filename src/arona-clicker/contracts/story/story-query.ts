import type { AreaStoryDeliveryView, SendState, StoryView } from '../runtime/results';
import type { StoryPresentationView } from '../runtime/story-presentation';

export interface StoryQueryPort {
  getPendingStoryReturn(): { owner: string | null; title: string } | null;
  getActiveStoryChannel(): { replayId: string; entryId: string; owner: string | null; runId?: string; context: import('../../../data-services/contracts/story-node').StoryStartContext } | null;
  getPlaybackView(owner?: string | null): StoryPresentationView;
  getReplayPlaybackView(replayId: string): StoryPresentationView | null;
  getReplayStoryView(replayId: string): StoryView | null;
  getReplaySendState(replayId: string): SendState;
  getAreaStoryDeliveries(areaId: string): readonly AreaStoryDeliveryView[];
  hasCompletedStory(storyId: string): boolean;
  readyStepCount(owner: string): number;
  getSendState(owner?: string | null): SendState;
  getCurrentStoryView(owner?: string | null): StoryView | null;
  isBlockingInteraction(owner?: string | null): boolean;
  isBlockingMovement(owner?: string | null): boolean;
}
