import { expect, test } from 'vitest';
import { loadAreaMapDemoPack } from '../../src/ui/development/area-map-demo-pack';
import { Registry } from '../../src/data-services/registry/registry';
test('real demo folder includes circular navigation and the mall/room exploration example', async () => {
  const parsed = await loadAreaMapDemoPack();
  const registry = new Registry(); registry.load(parsed.datapack); registry.validateAreaMapRefs();
  expect(registry.areaMaps.size).toBe(5);
  expect(registry.areas.size).toBe(8);
  expect(registry.areas.get('area-map-demo:area:a')?.navigationMapId).toBe(registry.areas.get('area-map-demo:area:b')?.navigationMapId);
  expect(registry.maps.size).toBe(0);
});
