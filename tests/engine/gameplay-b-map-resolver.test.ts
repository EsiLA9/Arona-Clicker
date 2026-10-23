import { describe, expect, test } from 'vitest';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { gameplayBMapDatapack } from '../../src/arona-clicker/content/gameplay-b/gameplay-b-map-datapack';
import { createRegistryMapContentResolver } from '../../src/arona-clicker/services/map/registry-map-content-resolver';
import { Registry } from '../../src/data-services/registry/registry';

function loadGameplayBRegistry(): Registry {
  const registry = new Registry();
  registry.load(defaultDatapack);
  registry.load(gameplayBMapDatapack);
  registry.validateShopRefs();
  return registry;
}

describe('Gameplay B Map content resolver', () => {
  test('resolves the Map referenced by the normal Gameplay B Datapack Spot', () => {
    const mapEntry = gameplayBMapDatapack.spots
      .flatMap(spot => spot.functionalities ?? [])
      .find(functionality => functionality.kind === 'mapEntry');
    expect(mapEntry?.mapId).toBeDefined();

    const mapId = mapEntry!.mapId!;
    const declaredMap = gameplayBMapDatapack.maps?.find(map => map.id === mapId);
    expect(declaredMap).toBeDefined();

    const resolver = createRegistryMapContentResolver(loadGameplayBRegistry());
    expect(resolver.resolve(mapId)).toEqual(declaredMap);
    expect(declaredMap?.nodes.map(node => node.id)).toEqual(['a', 'b', 'c']);
    expect(declaredMap?.edges).toEqual([
      { fromNodeId: 'a', toNodeId: 'b' },
      { fromNodeId: 'b', toNodeId: 'c' },
    ]);
    expect(declaredMap?.nodes[1].encounter?.completion).toEqual({ kind: 'manual', label: '完成调查' });
  });

  test('returns null for an unknown Map ID without falling back to Operation content', () => {
    const resolver = createRegistryMapContentResolver(loadGameplayBRegistry());
    expect(resolver.resolve('test:map:missing')).toBeNull();
  });
});
