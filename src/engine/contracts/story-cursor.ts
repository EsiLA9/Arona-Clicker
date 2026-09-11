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

/** 一个 Init 的全部剧情执行游标；只保存可序列化数据，不包含 StoryService 对象。 */
export interface StoryCursorCollection {
  global: StoryCursorSnapshot;
  chats: Record<string, StoryCursorSnapshot>;
}
