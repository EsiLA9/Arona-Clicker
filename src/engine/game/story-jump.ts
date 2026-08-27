// ============================================================
// engine/game/story-jump.ts — 剧情跳转链（goto / insert）与完结收尾
// 从 story-service.ts 拆出：performJump / resolveStoryEnd / MAX_JUMP_DEPTH
// ============================================================

import type { StoryDef } from '../types/entities';
import type { CompletedStory } from '../types/state';
import type { StoryAdvanceResult } from '../types/results';
import type { StoryRuntime } from './story-context';
import type { StoryCursorState } from './story-cursor-state';
import { applyCompletionReward, maybeBlockConversation, recordPassiveCooldown } from './story-rewards';

/** goto / insert 跳转链最大深度：防御内容作者误写循环跳转 / 超深嵌套。 */
export const MAX_JUMP_DEPTH = 32;

/** 执行 Story 跳转（goto / insert）。 */
export function performJump(rt: StoryRuntime, cur: StoryCursorState, target: string, mode: 'goto' | 'insert', fromStory: StoryDef, owner?: string | null): StoryAdvanceResult {
  // 深度限制：防御内容作者误写循环跳转 / 超深嵌套。
  if (cur.jumpDepth >= MAX_JUMP_DEPTH) {
    cur.clear();
    return { success: false, error: 'JumpLimitExceeded' };
  }
  const targetStory = rt.registry.stories.get(target);
  if (!targetStory || targetStory.talklets.length === 0) {
    cur.clear();
    return { success: false, error: 'NotFound' };
  }
  if (mode === 'insert') {
    // 记录返回点：当前 Story 的下一页。若为末页（超界），返回时按 Story 已结束处理。
    cur.insertStack.push({ storyId: fromStory.id, pageIndex: cur.currentStoryPageIndex + 1 });
  }
  cur.currentStoryDefId = target;
  cur.currentStoryPageIndex = 0;
  cur.currentStoryChoiceIndex = -1;
  cur.talkletClickWork = null;
  cur.choiceTextConfirmed = false;
  cur.jumpDepth += 1;
  if (!cur.visitedStoryIds.includes(target)) cur.visitedStoryIds.push(target);
  // 阅读日志：目标 Story 首页已显示
  rt.mutations.recordStoryRead(target, 0);
  return { success: true, finished: false, story: rt.getView(owner)! };
}

/**
 * 本 Story 播完后的收尾：insert 栈非空则返回原地；栈空则 Entry 链完结。
 * 返回点超界（末页 insert 返回）时按"该 Story 已播完"继续弹栈。
 */
export function resolveStoryEnd(rt: StoryRuntime, cur: StoryCursorState, endedStory: StoryDef, owner?: string | null): StoryAdvanceResult {
  // 循环处理：末页 insert 返回可能层层触发"Story 结束"。
  for (;;) {
    if (cur.insertStack.length > 0) {
      const ret = cur.insertStack.pop()!;
      const retStory = rt.registry.stories.get(ret.storyId);
      if (!retStory) {
        cur.clear();
        return { success: false, error: 'NotFound' };
      }
      if (ret.pageIndex < retStory.talklets.length) {
        cur.currentStoryDefId = ret.storyId;
        cur.currentStoryPageIndex = ret.pageIndex;
        cur.currentStoryChoiceIndex = -1;
        cur.talkletClickWork = null;
        cur.choiceTextConfirmed = false;
        rt.mutations.recordStoryRead(ret.storyId, ret.pageIndex);
        return { success: true, finished: false, story: rt.getView(owner)! };
      }
      // 返回点超界：该 Story 也视为已播完，继续弹栈或完结。
      continue;
    }

    // 链完结：发放完结奖励 + 记录完成。
    const entry = cur.currentStoryEntryId ? rt.entryById(cur.currentStoryEntryId) : undefined;
    const defId = cur.currentStoryDefId ?? (entry ? entry.storyId : null);
    const story = defId ? rt.registry.stories.get(defId) : undefined;
    if (!entry || !story) {
      cur.clear();
      return { success: false, error: 'NotFound' };
    }
    // 重阅读模式：仅完成演出（供 UI 收尾），不发放奖励、不重复写入 storyLog。
    const completed: CompletedStory = entry.type === 'active'
      ? { type: 'active', storyId: story.id, choiceIndex: cur.currentStoryChoiceIndex }
      : { type: 'passive', storyId: story.id };
    if (!cur.isReplay) {
      applyCompletionReward(rt, entry, story);
      rt.mutations.completeStory(completed);
      // 被动闲聊完结：写冷却帧 + 设置对话空间阻断态（关卡式剧情）
      if (entry.type === 'passive') {
        recordPassiveCooldown(rt, entry);
        maybeBlockConversation(rt, entry);
      }
      // 奖励结算通知（UI 渲染用；effects 已在 applyCompletionReward 中生效）
      const settled = rt.lastRewarded.value;
      rt.lastRewarded.value = null;
      if (settled) {
        rt.eventBus.emit({
          type: 'storyRewarded',
          storyId: story.id,
          source: settled.source,
          effects: settled.effects,
          flags: [...rt.flagsSetThisStory],
        });
      }
      rt.flagsSetThisStory.clear();
    }
    cur.clear();
    return { success: true, finished: true, storyId: story.id, completed };
  }
}
