import { describe, expect, test } from 'vitest';
import { Registry } from '../../../src/data-services/registry/registry';
import { mergeFragments } from '../../../src/data-services/datapack/fragment-parser';
import type { AreaMapDef, Datapack } from '../../../src/data-services';

const map = (id = 'demo:area-map:a'): AreaMapDef => ({
  id, name: '导航', nodes: [{ id: 'n', position: { x: 0, y: 0 } }], edges: [],
});
const pack = (partial: Partial<Datapack>): Datapack => ({ ...mergeFragments([]), ...partial });

describe('AreaMap Registry', () => {
  test('owned map batch commits cycles atomically and restores the prior registry on rollback', () => {
    const registry = new Registry();
    const first = map();
    const second = map('demo:area-map:b');
    first.nodes[0].action = { kind: 'openMap', mapId: second.id };
    second.nodes[0].action = { kind: 'openMap', mapId: first.id };
    const receipt = registry.applyAreaMapMutations([
      { operation: 'create', ownerModName: 'demo', areaMap: first },
      { operation: 'create', ownerModName: 'demo', areaMap: second },
    ]);
    expect(registry.areaMaps.size).toBe(2);
    expect(() => registry.applyAreaMapMutation({ operation: 'replace', ownerModName: 'other', areaMap: first })).toThrow(/属于 Mod/);
    receipt.rollback();
    expect(registry.areaMaps.size).toBe(0);
  });

  test('accepts only declared information rules and current action gates', () => {
    const registry = new Registry();
    registry.load(pack({ areaMaps: [{ ...map(), reveal: { name: { mode: 'explicit' } }, openCondition: { type: 'AND', conditions: [{ target: 'resource', key: 'permit', comparator: '>=', value: 1 }] } }] }));
    expect(() => registry.validateAreaMapRefs()).not.toThrow();
    const invalidCondition = { ...map(), reveal: { name: { mode: 'condition', condition: { target: 'unknown', key: 'x', comparator: '???', value: 1 } } } } as unknown as AreaMapDef;
    const invalidTarget = { ...map(), reveal: { travel: { mode: 'explicit' } } } as unknown as AreaMapDef;
    const invalidTravelMode = { ...map(), nodes: [{ ...map().nodes[0], action: { kind: 'attemptAreaTravel', areaId: 'demo:area:a', travelMode: 'teleport' } }] } as unknown as AreaMapDef;
    expect(() => registry.load(pack({ areaMaps: [invalidCondition] }))).toThrow(/condition/);
    expect(() => registry.load(pack({ areaMaps: [invalidTarget] }))).toThrow(/信息面/);
    expect(() => registry.load(pack({ areaMaps: [invalidTravelMode] }))).toThrow(/travelMode/);
  });
  test('forward, cross and self map references finalize after all packs and clear independently', () => {
    const registry = new Registry();
    const a = map();
    a.nodes[0].action = { kind: 'openMap', mapId: 'demo:area-map:b' };
    registry.load(pack({ areaMaps: [a] }));
    expect(() => registry.validateAreaMapRefs()).toThrow(/mapId/);
    const b = map('demo:area-map:b');
    b.nodes.push({ id: 'self', position: { x: 1, y: 1 }, action: { kind: 'openMap', mapId: b.id } });
    b.nodes[0].action = { kind: 'openMap', mapId: a.id };
    registry.load(pack({ areaMaps: [b] }));
    expect(() => registry.validateAreaMapRefs()).not.toThrow();
    expect(registry.areaMaps.size).toBe(2);
    expect(registry.maps.size).toBe(0);
    registry.clear();
    expect(registry.areaMaps.size).toBe(0);
  });

  test.each([
    (m: AreaMapDef) => { m.id = 'demo:map:a'; },
    (m: AreaMapDef) => { m.nodes[0].position.x = Infinity; },
    (m: AreaMapDef) => { m.nodes.push({ ...m.nodes[0] }); },
    (m: AreaMapDef) => { m.edges.push({ fromNodeId: 'n', toNodeId: 'missing' }); },
    (m: AreaMapDef) => { m.nodes[0].action = { kind: 'script', value: 'alert(1)' } as never; },
    (m: AreaMapDef) => { m.nodes[0].action = { kind: 'openMap' } as never; },
    (m: AreaMapDef) => { m.nodes[0].appearance = { kind: 'other' } as never; },
    (m: AreaMapDef) => { m.nodes[0] = null as never; },
  ])('rejects malformed content before merging (%#)', mutate => {
    const registry = new Registry();
    const invalid = map(); mutate(invalid);
    expect(() => registry.load(pack({ areaMaps: [invalid] }))).toThrow(/areaMaps/);
    expect(registry.areaMaps.size).toBe(0);
  });

  test('allows empty maps, rejects duplicates and validates target Area/Pic/entry references', () => {
    const registry = new Registry();
    expect(() => registry.load(pack({ areaMaps: [map(), map()] }))).toThrow();
    registry.load(pack({ areaMaps: [{ ...map(), nodes: [] }] }));
    expect(() => registry.validateAreaMapRefs()).not.toThrow();
    const m = map();
    m.nodes[0].action = { kind: 'attemptAreaTravel', areaId: 'demo:area:b' };
    registry.load(pack({ areaMaps: [m] }));
    expect(() => registry.validateAreaMapRefs()).toThrow(/areaId/);
    registry.load(pack({ inits: [{ id: 'demo:init:a', name: '', description: '', defaultAreas: [] }],
      areas: [{ id: 'demo:area:b', initId: 'demo:init:a', name: '', description: '', defaultSpots: [], navigationMapId: m.id }] }));
    expect(() => registry.validateAreaMapRefs()).not.toThrow();
    m.nodes[0].appearance = { iconPicId: 'demo:icon(pic):missing' };
    expect(() => registry.validateAreaMapRefs()).toThrow(/iconPicId/);
    registry.load(pack({ areaMaps: [{ ...map(), nodes: [] }] }));
    registry.load(pack({ areas: [{ id: 'demo:area:b', initId: 'demo:init:a', name: '', description: '', defaultSpots: [], navigationMapId: 'demo:area-map:missing' }] }));
    expect(() => registry.validateAreaMapRefs()).toThrow(/navigationMapId/);
  });
  test('icon references use the existing kind(pic) convention rather than an entity type', () => {
    const registry = new Registry(), m = map();
    m.nodes[0].appearance = { iconPicId: 'demo:icon(pic):node' };
    registry.load(pack({ areaMaps: [m], pics: [{ id: 'demo:icon(pic):node', src: 'data:image/png;base64,AA==' }] }));
    expect(() => registry.validateAreaMapRefs()).not.toThrow();
    const malformed = map(); malformed.nodes[0].appearance = { iconPicId: 'demo:pic:node' };
    expect(() => registry.load(pack({ areaMaps: [malformed] }))).toThrow(/iconPicId/);
  });
});
