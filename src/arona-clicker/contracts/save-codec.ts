import type { VisibilitySnapshot } from '../../engine/contracts/reveal';
import type { PersistedStats } from '../../engine/contracts/stats';
import type { StoryCursorSnapshot } from '../../engine/contracts/story-cursor';
import type { PlayerState } from '../types/state';
import type { SaveData } from './save-data';

/** AronaClicker Runtime 组装存档 DTO 所需的产品上下文。 */
export interface SaveBuildContext {
  state: Readonly<PlayerState>;
  visibility: () => Readonly<VisibilitySnapshot>;
  storyCursor: () => StoryCursorSnapshot;
  chatCursors: () => Record<string, StoryCursorSnapshot>;
  persistedStats: () => PersistedStats;
}

export type SaveCodec = (ctx: SaveBuildContext) => SaveData;
