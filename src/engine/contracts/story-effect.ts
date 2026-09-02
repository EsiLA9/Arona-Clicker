/** 效果反应器请求启动剧情所需的最小能力。 */
export interface StoryEffectPort {
  startStory(
    storyId: string,
    expectedType?: 'active' | 'passive',
    owner?: string | null,
    options?: { force?: boolean },
  ): void;
}
