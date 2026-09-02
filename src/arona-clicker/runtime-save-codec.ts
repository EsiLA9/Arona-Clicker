import type { SaveData } from './contracts/save-data';
import type { SaveBuildContext } from './contracts/save-codec';

/** 组装 AronaClicker Runtime 快照；不负责恢复引擎子系统。 */
export function buildSaveData(ctx: SaveBuildContext): SaveData {
  const storyCursor = ctx.storyCursor();
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    playerState: JSON.parse(JSON.stringify(ctx.state)),
    visibility: JSON.parse(JSON.stringify(ctx.visibility())),
    pendingStoryId: storyCursor.currentStoryId,
    pendingStoryPageIndex: storyCursor.currentStoryPageIndex,
    pendingStoryChoiceIndex: storyCursor.currentStoryChoiceIndex,
    pendingTalkletClicks: storyCursor.talkletClickWork,
    pendingStoryDefId: storyCursor.currentStoryDefId,
    pendingInsertStack: storyCursor.insertStack,
    pendingVisitedStoryIds: storyCursor.visitedStoryIds,
    pendingIsReplay: storyCursor.isReplay,
    chatCursors: ctx.chatCursors(),
    stats: ctx.persistedStats(),
  };
}
