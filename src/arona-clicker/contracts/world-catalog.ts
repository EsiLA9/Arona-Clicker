import type { AreaDef, InitDef, SpotDef } from '../../data-services/contracts/world';
import type { SpotTagOverrideState } from '../../engine/contracts/state-query';
import type { TagPath } from '../../engine/core/tag';

export interface WorldCatalogQueryPort {
  readonly inits: ReadonlyMap<string, InitDef>;
  readonly areas: ReadonlyMap<string, AreaDef>;
  readonly spots: ReadonlyMap<string, SpotDef>;
  areasOfInit(initId: string): string[];
  spotsOfArea(areaId: string): string[];
  effectiveSpotTags(spotId: string, overrides?: Record<string, SpotTagOverrideState>): TagPath[];
  tagName(path: TagPath): string;
  tagDescription(path: TagPath): string | undefined;
}
