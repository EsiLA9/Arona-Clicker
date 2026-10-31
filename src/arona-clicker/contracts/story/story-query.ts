import type { AreaStoryDeliveryView, SendState, StoryView } from '../runtime/results';
import type { StoryPresentationView } from '../runtime/story-presentation';

export interface StoryQueryPort {
  getPlaybackView(owner?: string | null): StoryPresentationView;
  getAreaStoryDeliveries(areaId: string): readonly AreaStoryDeliveryView[];
  hasCompletedStory(storyId: string): boolean;
  readyStepCount(owner: string): number;
  getSendState(owner?: string | null): SendState;
  getCurrentStoryView(owner?: string | null): StoryView | null;
  isBlockingInteraction(owner?: string | null): boolean;
  isBlockingMovement(owner?: string | null): boolean;
}
