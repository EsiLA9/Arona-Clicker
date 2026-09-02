import type { SendState, StoryView } from './results';

export interface StoryQueryPort {
  hasCompletedStory(storyId: string): boolean;
  readyStepCount(owner: string): number;
  getSendState(owner?: string | null): SendState;
  getCurrentStoryView(owner?: string | null): StoryView | null;
}
