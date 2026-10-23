import type { Registry } from '../../../data-services/registry/registry';
import type { MapContentResolver } from '../../contracts/map/map-content-resolver';

/** Adapts the Registry's validated Map table to the Runtime content resolver port. */
export function createRegistryMapContentResolver(
  registry: Pick<Registry, 'maps'>,
): MapContentResolver {
  return Object.freeze({
    resolve(mapId: string) {
      return registry.maps.get(mapId) ?? null;
    },
  });
}
