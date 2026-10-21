import { describe, expect, test } from 'vitest';
import { Registry } from '../../src/data-services/registry/registry';
import { mergeFragments } from '../../src/data-services/datapack/fragment-parser';
import type { AreaMapDef, Datapack } from '../../src/data-services';

const map = (id = 'demo:area-map:a'): AreaMapDef => ({
  id, name: '导航', nodes: [{ id: 'n', position: { x: 0, y: 0 } }], edges: [],
});
const pack = (partial: Partial<Datapack>): Datapack => ({ ...mergeFragments([]), ...partial });

describe('AreaMap Registry', () => {
  test('uses existing reveal discriminator and allows unconditional reveal', () => {
    const registry = new Registry();
    registry.load(pack({ areaMaps: [{ ...map(), revealTriggers: [{ reveal: 'name' }] }] }));
    expect(() => registry.validateAreaMapRefs()).not.toThrow();
    expect(() => registry.load(pack({ areaMaps: [{ ...map(), revealTriggers: [{ target: 'name' } as never] }] }))).toThrow(/RevealTrigger/);
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
