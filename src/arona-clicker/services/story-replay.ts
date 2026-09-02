// ============================================================
// arona-clicker/services/story-replay.ts — 重阅读入口与分歧点准入守卫
// 从 story-service.ts 拆出：replayStory / guardPrereqsMet
// ============================================================

import type { BranchGuard } from '../../data-services/contracts/story-entry';
import type { StoryStartResult } from '../contracts/results';
import type { StoryRuntime } from './story-context';
import { beginStory } from './story-flow';

/** 分歧点准入守卫：前置阅读是否全部满足。talkletIndex = -1 表示要求整条 Story 全部已读。 */
export function guardPrereqsMet(rt: StoryRuntime, guard: BranchGuard): boolean {
  return guard.prerequisites.every(({ storyId, talkletIndex }) => {
    const log = rt.getState().storyReadLogs?.[storyId];
    if (!log) return false;
    if (talkletIndex === -1) {
      const story = rt.registry.stories.get(storyId);
      if (!story) return false;
      return story.talklets.every((_, i) => log.readTalkletIndexes.includes(i));
    }
    return log.readTalkletIndexes.includes(talkletIndex);
  });
}

/**
 * 重阅读入口：从 StoryEntry 重新阅读关联的 Story 链。
 * 与 startStory 的区别：
 *   - 仅检查 entry.replayable 与无进行中剧情，不受 triggerCondition / availableInits / AlreadyCompleted 限制；
 *   - 进入重阅读模式：推进到受 branchGuards 保护的分歧跳转时，
 *     若玩家 storyReadLogs 中缺乏指定前置阅读记录，则拒绝（BranchGuardDenied）。
 */
export function replayStory(rt: StoryRuntime, storyId: string, owner?: string | null): StoryStartResult {
  const entry = rt.entryById(storyId);
  if (!entry) return { success: false, storyId, error: 'NotFound' };
  if (!entry.replayable) return { success: false, storyId, error: 'NotReplayable' };
  const cur = rt.cursorFor(owner);
  if (!cur.empty) return { success: false, storyId, error: 'AlreadyActive' };
  const story = rt.storyOf(entry);
  if (!story || story.talklets.length === 0) return { success: false, storyId, error: 'NotFound' };

  beginStory(rt, cur, entry, story, true);
  return { success: true, story: rt.getView(owner)! };
}
