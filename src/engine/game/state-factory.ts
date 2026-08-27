// ============================================================
// engine/game/state-factory.ts — 默认运行时状态构建
// 从 game-instance.ts 拆出：createDefaultState 纯函数
// ============================================================

import { PlayerState } from '../types';
import { extra } from '../extra/index';

export function createDefaultState(): PlayerState {
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
