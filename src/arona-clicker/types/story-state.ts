import type { StoryId } from '../../engine/types/ids';

export type CompletedStory =
  | { type: 'passive'; storyId: StoryId }
  | { type: 'active'; storyId: StoryId; choiceIndex: number };

export interface StoryReadLog {
  readTalkletIndexes: number[];
  chosenChoiceIndexes: Record<number, number[]>;
}
