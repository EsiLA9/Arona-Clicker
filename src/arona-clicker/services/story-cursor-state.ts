import type { StoryCursorSnapshot } from '../../engine/contracts/story-cursor';

/** 剧情运行时游标；播放瞬态只存在领域层，不进入基础引擎契约。 */
export interface StoryCursor extends StoryCursorSnapshot {}

export class StoryCursorState {
  currentStoryEntryId: string | null = null;
  currentStoryDefId: string | null = null;
  currentStoryPageIndex = 0;
  currentStoryChoiceIndex = -1;
  talkletClickWork: { total: number; done: number } | null = null;
  insertStack: { storyId: string; pageIndex: number }[] = [];
  visitedStoryIds: string[] = [];
  jumpDepth = 0;
  isReplay = false;
  choiceTextConfirmed = false;

  get empty(): boolean {
    return this.currentStoryEntryId === null;
  }

  clear(): void {
    this.currentStoryEntryId = null;
    this.currentStoryDefId = null;
    this.currentStoryPageIndex = 0;
    this.currentStoryChoiceIndex = -1;
    this.talkletClickWork = null;
    this.choiceTextConfirmed = false;
    this.insertStack = [];
    this.visitedStoryIds = [];
    this.jumpDepth = 0;
    this.isReplay = false;
  }

  save(): StoryCursor {
    return {
      currentStoryId: this.currentStoryEntryId,
      currentStoryDefId: this.currentStoryDefId,
      currentStoryPageIndex: this.currentStoryPageIndex,
      currentStoryChoiceIndex: this.currentStoryChoiceIndex,
      talkletClickWork: this.talkletClickWork ? { ...this.talkletClickWork } : null,
      insertStack: this.insertStack.map(s => ({ ...s })),
      visitedStoryIds: [...this.visitedStoryIds],
      isReplay: this.isReplay,
    };
  }

  restore(cursor: StoryCursor): void {
    this.currentStoryEntryId = cursor.currentStoryId;
    this.currentStoryDefId = cursor.currentStoryDefId ?? null;
    this.currentStoryPageIndex = cursor.currentStoryPageIndex;
    this.currentStoryChoiceIndex = cursor.currentStoryChoiceIndex;
    this.talkletClickWork = cursor.talkletClickWork ? { ...cursor.talkletClickWork } : null;
    this.choiceTextConfirmed = false;
    this.insertStack = cursor.insertStack ? cursor.insertStack.map(s => ({ ...s })) : [];
    this.visitedStoryIds = cursor.visitedStoryIds ? [...cursor.visitedStoryIds] : [];
    this.jumpDepth = 0;
    this.isReplay = cursor.isReplay ?? false;
  }
}
