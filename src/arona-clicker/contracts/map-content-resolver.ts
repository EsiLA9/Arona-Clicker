import type { GameplayMapDef } from '../../data-services/contracts/gameplay-map';

/** Resolves Runtime map content from definitions already admitted by the Registry. */
export interface MapContentResolver {
  /** Returns the registered Map definition, or null when the ID is unknown. */
  resolve(mapId: string): GameplayMapDef | null;
}
