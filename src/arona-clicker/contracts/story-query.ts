import type { AreaStoryDeliveryView, SendState, StoryView } from './results';

export interface StoryQueryPort {
  getAreaStoryDeliveries(areaId: string): readonly AreaStoryDeliveryView[];
  hasCompletedStory(storyId: string): boolean;
  readyStepCount(owner: string): number;
  getSendState(owner?: string | null): SendState;
  getCurrentStoryView(owner?: string | null): StoryView | null;
  isBlockingInteraction(owner?: string | null): boolean;
  isBlockingMovement(owner?: string | null): boolean;
}
