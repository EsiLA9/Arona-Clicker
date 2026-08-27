// ============================================================
// engine/game/view-builder.ts — UI 只读视图组装
// 从 game-instance.ts 拆出：getView 视图构建
// ============================================================

import {
  AffectorInstance,
  GameView,
  PlayerState,
  StatsSnapshot,
  StoryView,
  VisibilitySnapshot,
} from '../types';

export interface ViewBuildContext {
  state: Readonly<PlayerState>;
  visibility: Readonly<VisibilitySnapshot>;
  currentStory: StoryView | null;
  activeAffectors: AffectorInstance[];
  stats: StatsSnapshot;
}

export function buildGameView(ctx: ViewBuildContext): GameView {
  const { state, visibility, currentStory, activeAffectors, stats } = ctx;
  return {
    activeInit: state.activeInit,
    currentAreaId: state.currentAreaId ?? null,
    visitedAreas: state.visitedAreas ? [...state.visitedAreas] : [],
    totalFrames: state.totalFrames,
    resources: {
      // 视图合并：全局资源（跨世界线）+ 当前世界线局部资源
      ...(state.globalResources ?? {}),
      ...state.resources,
    },
    spotLevels: { ...state.spotLevels },
    spotManagers: { ...state.spotManagers },
    unlockedEnhancements: [...state.unlockedEnhancements],
    inventory: { ...state.inventory },
    unlockedInits: [...state.unlockedInits],
    storyLog: state.storyLog.map(story => ({ ...story })),
    flags: { ...state.flags },
    visibility: {
      inits: { ...visibility.inits },
      areas: { ...visibility.areas },
      spots: { ...visibility.spots },
      enhancements: { ...visibility.enhancements },
      items: { ...visibility.items },
      stories: { ...visibility.stories },
    },
    currentStory,
    activeAffectors: activeAffectors.map(instance => ({
      ...instance,
      activeEntryIds: [...instance.activeEntryIds],
    })),
    stats,
  };
}
