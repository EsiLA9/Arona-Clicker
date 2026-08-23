/**
 * 单一剧情游标状态（纯数据）。
 *
 * StoryService 持有一个「全局游标」+ 若干「聊天沙盒游标」（按角色/Init 分区），
 * 二者并行互不打断：外部 active 主线 / 一般闲聊走全局游标，
 * 每个学生的对话空间走各自独立的聊天游标。所有剧情操作都落在某个游标实例上。
 *
 * 全部字段与 StoryCursor 存档结构一一对应，便于 save/restore 透传。
 */

/** 剧情游标（存档用，GameInstance.save/load 读写）。 */
export interface StoryCursor {
  /** 当前 Entry.id（对外故事 id，跳转链中不变）。 */
  currentStoryId: string | null;
  /** 当前实际播放的 Story.id（跳转链中可变）。旧档无此字段 = 回退 Entry.storyId。 */
  currentStoryDefId?: string | null;
  currentStoryPageIndex: number;
  currentStoryChoiceIndex: number;
  talkletClickWork: { total: number; done: number } | null;
  /** insert 跳转返回点栈（旧档无 = 空）。 */
  insertStack?: { storyId: string; pageIndex: number }[];
  /** 本 Entry 链已访问过的 Story.id（去重，旧档无 = 空）。 */
  visitedStoryIds?: string[];
  /** 是否处于重阅读模式（旧档无 = false）。 */
  isReplay?: boolean;
}

export class StoryCursorState {
  /** 当前 Entry.id（对外故事 id；跳转链中保持不变）。 */
  currentStoryEntryId: string | null = null;
  /** 当前实际播放的 Story.id（跳转链中可变；startStory 时 = entry.storyId）。 */
  currentStoryDefId: string | null = null;
  currentStoryPageIndex = 0;
  currentStoryChoiceIndex = -1;
  /** 当前 Talklet 的点击工作进度（null = 当前页无点击需求）。 */
  talkletClickWork: { total: number; done: number } | null = null;
  /** insert 跳转返回点栈：记录 (Story.id, 返回页索引)。 */
  insertStack: { storyId: string; pageIndex: number }[] = [];
  /** 本 Entry 链已访问过的 Story.id（去重；含初始 Story 与全部跳转目标）。 */
  visitedStoryIds: string[] = [];
  /** 累计跳转深度（goto + insert），上限 MAX_JUMP_DEPTH。 */
  jumpDepth = 0;
  /** 重阅读模式标志：true 时受 branchGuards 分歧点准入守卫约束。 */
  isReplay = false;
  /** 选项页文本确认状态：进入 choice 页为 false，点击确认后 true，离开重置。 */
  choiceTextConfirmed = false;

  constructor() {}

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

  /** 导出游标快照（存档用）。 */
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

  /** 恢复游标（读档用；兼容旧档缺失的新字段）。 */
  restore(cursor: StoryCursor): void {
    this.currentStoryEntryId = cursor.currentStoryId;
    this.currentStoryDefId = cursor.currentStoryDefId ?? null;
    this.currentStoryPageIndex = cursor.currentStoryPageIndex;
    this.currentStoryChoiceIndex = cursor.currentStoryChoiceIndex;
    this.talkletClickWork = cursor.talkletClickWork ? { ...cursor.talkletClickWork } : null;
    // 选项文本确认状态不持久化：读档后玩家重新点击确认即可看到选项
    this.choiceTextConfirmed = false;
    this.insertStack = cursor.insertStack ? cursor.insertStack.map(s => ({ ...s })) : [];
    this.visitedStoryIds = cursor.visitedStoryIds ? [...cursor.visitedStoryIds] : [];
    this.jumpDepth = 0;
    this.isReplay = cursor.isReplay ?? false;
  }
}
