import type { AronaClickerState } from '../types/state';
import { extra } from '../../engine/extra/index';

export function createDefaultState(): AronaClickerState {
  return {
    resources: {},
    globalResources: {},
    spotLevels: {},
    spotManagers: {},
    unlockedEnhancements: [],
    activeInit: '',
    totalFrames: 0,
    tagEffects: {},
    entityEffects: {},
    storyLog: [],
    inventory: {},
    flags: {},
    triggersCompleted: [],
    unlockedInits: [],
    visitedAreas: [],
    initSnapshots: {},
    extras: extra.dict({}),
    initExtras: extra.dict({}),
  };
}
