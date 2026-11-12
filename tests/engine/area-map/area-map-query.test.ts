import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { mergeFragments } from '../../../src/data-services/datapack/fragment-parser';
import type { Condition } from '../../../src/engine/types/expression';

let game: GameInstance;
afterEach(() => game?.dispose());
const gate: Condition = { target: 'resource', key: 'demo:resource:key', comparator: '>=', value: 1 };
const rule = (condition: Condition) => ({ mode: 'condition' as const, condition });
function setup(options: { hideArea?: boolean; gateInspect?: boolean } = {}) {
  game = new GameInstance();
  game.init([{ ...mergeFragments([]),
    inits: [{ id: 'demo:init:a', name: 'A', description: '', defaultAreas: ['demo:area:a'] }],
    areas: ['a', 'b'].map(id => ({ id: `demo:area:${id}`, initId: 'demo:init:a', name: id === 'b' ? 'Secret Area' : 'A', description: 'Secret detail', defaultSpots: [], navigationMapId: 'demo:area-map:a', ...(id === 'a' ? { adjacentAreaIds: ['demo:area:b'] } : {}), ...(id === 'b' && options.hideArea ? { reveal: { existence: rule(gate) } } : {}) })),
    areaMaps: [
      { id: 'demo:area-map:a', name: 'A', nodes: [
        { id: 'inspect', name: '说明', position: { x: 0, y: 0 }, ...(options.gateInspect ? { reveal: { name: rule(gate), condition: rule(gate) } } : {}) },
        { id: 'travel', position: { x: 100, y: 0 }, actionCondition: { type: 'AND', conditions: [gate] }, action: { kind: 'attemptAreaTravel', areaId: 'demo:area:b' } },
        { id: 'portal', position: { x: 0, y: 100 }, action: { kind: 'openMap', mapId: 'demo:area-map:b' } },
        { id: 'hidden', name: 'Secret Node', position: { x: 200, y: 200 }, reveal: { existence: rule(gate) } },
      ], edges: [{ fromNodeId: 'inspect', toNodeId: 'hidden' }, { fromNodeId: 'inspect', toNodeId: 'portal' }] },
      { id: 'demo:area-map:b', name: 'B', nodes: [{ id: 'inspect', position: { x: 5, y: 5 }, action: { kind: 'openMap', mapId: 'demo:area-map:a' } }], edges: [] },
    ],
  }]);
  return game;
}

describe('AreaMap query', () => {
  test('single-map detached projection filters hidden nodes/edges and does not mutate or emit', () => {
    const g = setup();
    const before = JSON.stringify({ ...g.save(), timestamp: 0 });
    const a = g.areaMap.getView('demo:area-map:a')!;
    expect(a.nodes.map(n => n.id)).toEqual(['inspect', 'travel', 'portal']);
    expect(a.edges).toEqual([]);
    expect(JSON.stringify(a)).not.toContain('Secret Node');
    expect(g.areaMap.getView('demo:area-map:b')?.nodes).toHaveLength(1);
    (a.nodes[0].position as { x: number }).x = 999;
    expect(g.areaMap.getNodeView(a.id, 'inspect')?.position.x).toBe(0);
    expect(JSON.stringify({ ...g.save(), timestamp: 0 })).toBe(before);
    expect(g.areaMap.getEntryView('demo:area:a')).toMatchObject({ ready: true, mapId: a.id });
    expect(g.areaMap.getEntryView('demo:area:b')).toMatchObject({ ready: true, mapId: a.id });
  });

  test('collection summaries hide unavailable map identities while keeping usable map labels', () => {
    const g = setup();
    const hidden = g.registry.areaMaps.get('demo:area-map:b')!;
    hidden.reveal = { existence: { mode: 'explicit' }, name: { mode: 'explicit' } };
    expect(g.mutations.acquireAreaMap('demo:area-map:a')).toBe(true);
    expect(g.mutations.acquireAreaMap(hidden.id)).toBe(true);
    expect(g.areaMap.getCollectedMapEntries()).toEqual([
      { name: 'A', available: true },
      { name: '未知地图', available: false },
    ]);
    expect(JSON.stringify(g.areaMap.getCollectedMapEntries())).not.toContain(hidden.id);
  });

  test('hidden targets expose no raw name, description, ID or condition; knowledge persists after condition falls', () => {
    const g = setup({ hideArea: true });
    const node = g.areaMap.getNodeView('demo:area-map:a', 'travel')!;
    expect(node).toMatchObject({ ready: false, reason: 'Unavailable', action: null });
    expect(JSON.stringify(node)).not.toMatch(/Secret|demo:area:b|demo:resource:key/);
    g.mutations.changeResource('demo:resource:key', 1);
    expect(g.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'area', entityId: 'demo:area:b', target: 'existence' });
    expect(g.areaMap.getNodeView('demo:area-map:a', 'travel')?.action).toEqual({ kind: 'attemptAreaTravel', areaId: 'demo:area:b' });
    g.mutations.changeResource('demo:resource:key', -1);
    expect(g.areaMap.getNodeView('demo:area-map:a', 'travel')).toMatchObject({ action: { kind: 'attemptAreaTravel' }, ready: false, reason: 'Locked' });
  });

  test('node knowledge gates persist while action conditions remain current', () => {
    const g = setup({ gateInspect: true });
    const source = g.registry.areaMaps.get('demo:area-map:a')!;
    source.nodes[0].actionCondition = { type: 'AND', conditions: [gate] };
    const first = g.areaMap.getNodeView(source.id, 'inspect')!;
    expect(first).toMatchObject({ name: '未知节点', ready: false });
    expect(first.conditions).toBeUndefined();
    g.mutations.changeResource('demo:resource:key', 1);
    expect(g.areaMap.getNodeView(source.id, 'inspect')).toMatchObject({ name: '说明', ready: true });
    g.mutations.changeResource('demo:resource:key', -1);
    expect(g.areaMap.getNodeView(source.id, 'inspect')).toMatchObject({ name: '说明', ready: false });
  });

  test('map open condition gates browsing independently of information', () => {
    const g = setup();
    const source = g.registry.areaMaps.get('demo:area-map:a')!;
    source.openCondition = { type: 'AND', conditions: [gate] };
    expect(g.areaMap.getEntryView('demo:area:a')).toMatchObject({ ready: false, reason: 'Locked' });
    expect(g.areaMap.getView(source.id)).toBeNull();
    source.openCondition = undefined;
    source.nodes[1].action = { kind: 'attemptAreaTravel', areaId: 'demo:area:missing' };
    expect(g.areaMap.getNodeView(source.id, 'travel')).toMatchObject({ ready: false, reason: 'Unavailable', action: null });
  });
});
