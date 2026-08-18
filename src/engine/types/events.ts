// ============================================================
// engine/types/events.ts — 运行时事件（GameEvent）
// ============================================================

import type { StatsContext } from './state';
import type { AffectorState } from './entities';
import type { Character } from './ids';
import type { ExtraPath, ExtraValue } from './extra';

export type GameEvent =
  | { type: 'resourceChanged'; resource: string; delta: number; newValue: number }
  | { type: 'spotLevelChanged'; spotId: string; newLevel: number }
  | { type: 'managerChanged'; spotId: string; newManager: Character }
  | { type: 'enhancementAdded'; enhancementId: string }
  | { type: 'enhancementRemoved'; enhancementId: string }
  | { type: 'itemCollected'; itemId: string; count: number; newTotal: number }
  | { type: 'initEntered'; initId: string }
  | { type: 'initUnlocked'; initId: string }
  | { type: 'areaEntered'; areaId: string; fromAreaId: string | null }
  | { type: 'storyTriggered'; storyId: string }
  | { type: 'storyCompleted'; storyId: string }
  | { type: 'tick'; frame: number }
  | { type: 'flagChanged'; flag: string; value: string }
  | { type: 'extraChanged'; path: ExtraPath; value?: ExtraValue }
  | { type: 'conditionGroupMet'; triggerId: string }
  | { type: 'spotProduced'; spotId: string; resource: string; amount: number }
  | { type: 'spotTagChanged'; spotId: string; tag: string; added: boolean }
  | { type: 'affectorMounted'; instanceId: string; packId: string; mountEntityId: string }
  | { type: 'affectorStateChanged'; instanceId: string; oldState: AffectorState; newState: AffectorState }
  | { type: 'affectorUnmounted'; instanceId: string; reason: string }
  & { stats?: StatsContext };

export type EventHandler = (event: GameEvent) => void;
