import type { AreaId, StoryId } from '../../engine/types/ids';

export type CompletedStory =
  | { type: 'passive'; storyId: StoryId }
  | { type: 'active'; storyId: StoryId; choiceIndex: number };

/** Current-Init receipt for an ActiveStoryEntry delivered to an Area. */
export interface AreaStoryDelivery {
  entryId: StoryId;
  areaId: AreaId;
  /** Stable activation identity, such as a FollowUp id or availability-discovery id. */
  sourceId: string;
  status: 'pending' | 'completed';
}

export interface StoryReadLog {
  readTalkletIndexes: number[];
  chosenChoiceIndexes: Record<number, number[]>;
}
