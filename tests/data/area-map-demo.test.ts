import { expect, test } from 'vitest';
import { loadAreaMapDemoPack } from '../../src/ui/development/area-map-demo-pack';
import { Registry } from '../../src/data-services/registry/registry';
test('real demo folder includes circular navigation, route/direct travel, anonymous targets, and a story-granted map', async () => {
  const parsed = await loadAreaMapDemoPack();
  const registry = new Registry(); registry.load(parsed.datapack); registry.validateAreaMapRefs();
  expect(registry.areaMaps.size).toBe(5);
  expect(registry.areas.size).toBe(10);
  expect(registry.areas.get('area-map-demo:area:a')?.navigationMapId).toBe(registry.areas.get('area-map-demo:area:b')?.navigationMapId);
  expect(registry.areaMaps.get('area-map-demo:area-map:b')?.collection).toBe('explicit');
  expect(registry.stories.get('area-map-demo:story:arrival')?.nodes[0]).toMatchObject({
    type: 'operation', action: { kind: 'state', effects: [{ op: 'acquireAreaMap', mapId: 'area-map-demo:area-map:b' }] },
  });
  expect(registry.areaMaps.get('area-map-demo:area-map:floor')?.nodes.find(node => node.id === 'quiet_lounge')?.action)
    .toEqual({ kind: 'attemptAreaTravel', areaId: 'area-map-demo:area:quiet_lounge', travelMode: 'mapDirect' });
  expect(registry.areas.get('area-map-demo:area:quiet_lounge')?.reveal?.name).toEqual({ mode: 'explicit' });
  expect(registry.areas.get('area-map-demo:area:c')?.enterEffects).toEqual([{
    first: true, effects: [{ op: 'addResource', target: 'area-map-demo:resource:permit', value: 1 }],
  }]);
  expect(registry.areaMaps.get('area-map-demo:area-map:c')?.nodes.find(node => node.id === 'hidden')?.reveal?.existence?.mode).toBe('condition');
  expect(registry.areaMaps.get('area-map-demo:area-map:c')?.nodes.find(node => node.id === 'hidden')?.action)
    .toEqual({ kind: 'attemptAreaTravel', areaId: 'area-map-demo:area:secret_garden' });
  expect(registry.areas.get('area-map-demo:area:secret_garden')?.enterCondition).toBeDefined();
  expect(registry.maps.size).toBe(0);
});
