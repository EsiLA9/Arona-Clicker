import { expect, test } from 'vitest';
import { AREA_CONTENT_POLICY } from '../../src/data-services/authoring/content-policies';
import { buildAuthoringDef } from '../../src/data-services/authoring/content-policy';
import { collectDefinitionReferences } from '../../src/data-services/registry/runtime-content-reference-rules';
import { Registry } from '../../src/data-services/registry/registry';
import { mergeFragments } from '../../src/data-services/datapack/fragment-parser';
import type { AreaDef } from '../../src/data-services/contracts/world';

test('Area authoring retains navigationMapId and local mutations reject missing maps', () => {
  const registry = new Registry();
  registry.load({ ...mergeFragments([]), inits: [{ id: 'demo:init:a', name: 'A', description: '', defaultAreas: [] }],
    areaMaps: [{ id: 'demo:area-map:a', name: 'A', nodes: [], edges: [] }] });
  const input = { idName: 'a', initId: 'demo:init:a', name: 'A', description: '', defaultSpots: [], navigationMapId: 'demo:area-map:a' };
  const def = buildAuthoringDef(AREA_CONTENT_POLICY, 'demo', input) as AreaDef;
  expect(def.navigationMapId).toBe(input.navigationMapId);
  registry.applyAreaMutation({ operation: 'create', ownerModName: 'demo', area: def });
  expect(() => registry.applyAreaMutation({ operation: 'replace', ownerModName: 'demo', area: { ...def, navigationMapId: 'demo:area-map:missing' } })).toThrow(/navigationMapId/);
  expect(registry.areas.get(def.id)?.navigationMapId).toBe(input.navigationMapId);
});

test('reference browser declares navigation targets without promoting local node IDs', () => {
  const area = collectDefinitionReferences({ definitionKind: 'areas', fullId: 'demo:area:a' }, { navigationMapId: 'demo:area-map:a' }, []);
  expect(area).toContainEqual(expect.objectContaining({ path: '$.navigationMapId', targetKinds: ['areaMaps'] }));
  const map = collectDefinitionReferences({ definitionKind: 'areaMaps', fullId: 'demo:area-map:a' }, { nodes: [
    { id: 'local', action: { kind: 'openMap', mapId: 'demo:area-map:b' } },
    { id: 'another', action: { kind: 'attemptAreaTravel', areaId: 'demo:area:b' } },
  ], edges: [{ fromNodeId: 'local', toNodeId: 'another' }] }, []);
  expect(map).toContainEqual(expect.objectContaining({ path: '$.nodes[0].action.mapId', targetKinds: ['areaMaps'] }));
  expect(map).toContainEqual(expect.objectContaining({ path: '$.nodes[1].action.areaId', targetKinds: ['areas'] }));
  expect(map.some(ref => ref.value === 'local' || ref.value === 'another')).toBe(false);
});
