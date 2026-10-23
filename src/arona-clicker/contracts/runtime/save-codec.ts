import type { VisibilitySnapshot } from '../../../engine/contracts/reveal';
import type { PersistedStats } from '../../../engine/contracts/stats';
import type { StoryCursorCollection } from '../../../engine/contracts/story-cursor';
import type { PlayerState } from '../../types/state';
import type { SaveData } from './save-data';
import type { TagOverrideResidue } from '../../state/tag-residue';
import type { OperationRunSaveSnapshot } from '../operation/operation-save';
import type { MapRunSaveSnapshot } from '../map/map-run';

/** AronaClicker Runtime 组装存档 DTO 所需的产品上下文。 */
export interface SaveBuildContext {
  state: Readonly<PlayerState>;
  visibility: () => Readonly<VisibilitySnapshot>;
  storyCursors: () => StoryCursorCollection;
  persistedStats: () => PersistedStats;
  activeModNames?: ReadonlySet<string>;
  retainedTagResidue?: TagOverrideResidue;
  operationRun?: () => OperationRunSaveSnapshot | null;
  mapRun?: () => MapRunSaveSnapshot | null;
}

export type SaveCodec = (ctx: SaveBuildContext) => SaveData;
