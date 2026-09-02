import {
  AffectorInstance,
} from '../../engine/types';
import type { StatsSnapshot } from '../../engine/contracts/stats';
import type { VisibilitySnapshot } from '../../engine/contracts/reveal';
import type { PlayerState } from '../types/state';
import type { GameView, StoryView } from '../contracts';

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
