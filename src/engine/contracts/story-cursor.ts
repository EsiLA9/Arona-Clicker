/** 剧情游标的持久化快照；不包含运行时瞬态。 */
export interface StoryCursorSnapshot {
  currentStoryId: string | null;
  currentStoryDefId?: string | null;
  currentStoryPageIndex: number;
  currentStoryChoiceIndex: number;
  talkletClickWork: { total: number; done: number } | null;
  insertStack?: { storyId: string; pageIndex: number }[];
  visitedStoryIds?: string[];
  isReplay?: boolean;
}
