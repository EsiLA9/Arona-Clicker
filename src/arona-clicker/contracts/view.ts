import type { AffectorInstance, EnhancementId, InitId, AreaId, ItemId, SpotId } from '../../engine/types';
import type { Character } from '../types/ids';
import type { StoryView } from './results';
import type { VisibilitySnapshot } from '../../engine/contracts/reveal';
import type { StatsSnapshot } from '../../engine/contracts/stats';

export interface GameView {
  activeInit: InitId;
  currentAreaId: AreaId | null;
  visitedAreas: AreaId[];
  totalFrames: number;
  resources: Record<string, number>;
  spotLevels: Record<SpotId, number>;
  spotManagers: Record<SpotId, Character>;
  unlockedEnhancements: EnhancementId[];
  inventory: Record<ItemId, number>;
  unlockedInits: InitId[];
  storyLog: import('../types/story-state').CompletedStory[];
  flags: Record<string, string>;
  visibility: VisibilitySnapshot;
  currentStory: StoryView | null;
  activeAffectors: AffectorInstance[];
  stats: StatsSnapshot;
}
