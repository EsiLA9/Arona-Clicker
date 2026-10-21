import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { mergeFragments } from '../../src/data-services/datapack/fragment-parser';
import type { RevealTrigger } from '../../src/engine/contracts/reveal';

let game: GameInstance;
afterEach(() => game?.dispose());
const locked: RevealTrigger['condition'] = { target: 'resource', key: 'demo:resource:key', comparator: '>=', value: 1 };
function setup() {
  game = new GameInstance();
  game.init([{ ...mergeFragments([]),
    inits: [{ id: 'demo:init:a', name: 'A', description: '', defaultAreas: ['demo:area:a'] }],
    areas: ['a', 'b'].map(id => ({ id: `demo:area:${id}`, initId: 'demo:init:a', name: id === 'b' ? 'Secret Area' : 'A', description: 'Secret detail', defaultSpots: [], navigationMapId: 'demo:area-map:a', ...(id === 'a' ? { adjacentAreaIds: ['demo:area:b'] } : {}) })),
    areaMaps: [
      { id: 'demo:area-map:a', name: 'A', nodes: [
        { id: 'inspect', name: '说明', position: { x: 0, y: 0 } },
        { id: 'travel', position: { x: 100, y: 0 }, action: { kind: 'attemptAreaTravel', areaId: 'demo:area:b' } },
        { id: 'portal', position: { x: 0, y: 100 }, action: { kind: 'openMap', mapId: 'demo:area-map:b' } },
        { id: 'hidden', name: 'Secret Node', position: { x: 200, y: 200 }, revealTriggers: [{ reveal: 'existence', condition: locked }] },
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
    expect(a.edges).toEqual([]); // inspect / portal 不是实际 Area 通路端点。
    expect(JSON.stringify(a)).not.toContain('Secret Node');
    expect(g.areaMap.getView('demo:area-map:b')?.nodes).toHaveLength(1);
    (a.nodes[0].position as { x: number }).x = 999;
    expect(g.areaMap.getNodeView(a.id, 'inspect')?.position.x).toBe(0);
    expect(JSON.stringify({ ...g.save(), timestamp: 0 })).toBe(before);
    expect(g.areaMap.getEntryView('demo:area:a')).toMatchObject({ ready: true, mapId: a.id });
    expect(g.areaMap.getEntryView('demo:area:b')).toMatchObject({ ready: true, mapId: a.id });
  });
  test('hidden targets expose no raw name, description, ID or condition', () => {
    const g = setup();
    g.registry.areas.get('demo:area:b')!.revealTriggers = [{ reveal: 'existence', condition: locked }];
    const node = g.areaMap.getNodeView('demo:area-map:a', 'travel')!;
    expect(node).toMatchObject({ ready: false, reason: 'Unavailable', action: null });
    expect(JSON.stringify(node)).not.toMatch(/Secret|demo:area:b|demo:resource:key/);
  });
  test('reveal OR, runtime changes and action replacement use fresh content', () => {
    const g = setup();
    const source = g.registry.areaMaps.get('demo:area-map:a')!;
    source.nodes[0].revealTriggers = [{ reveal: 'name', condition: locked }, { reveal: 'unlock', condition: locked }, { reveal: 'condition', condition: locked }];
    const first = g.areaMap.getView(source.id)!;
    expect(first.nodes[0]).toMatchObject({ name: '未知节点', ready: false });
    expect(first.nodes[0].conditions).toBeUndefined();
    source.nodes[0].revealTriggers.push({ reveal: 'name' });
    expect(g.areaMap.getNodeView(source.id, 'inspect')?.name).toBe('说明');
    g.state.resources['demo:resource:key'] = 1;
    const next = g.areaMap.getView(source.id)!;
    expect(next.revision).not.toBe(first.revision);
    expect(next.nodes).toHaveLength(4);
    expect(next.nodes[0].ready).toBe(true);
    source.nodes[0].action = { kind: 'openMap', mapId: 'demo:area-map:b' };
    expect(g.areaMap.getNodeView(source.id, 'inspect')?.action?.kind).toBe('openMap');
  });
  test('map unlock gates every node while a broken reference stays as a disabled public node', () => {
    const g = setup();
    const source = g.registry.areaMaps.get('demo:area-map:a')!;
    source.revealTriggers = [{ reveal: 'unlock', condition: locked }];
    expect(g.areaMap.getEntryView('demo:area:a')).toMatchObject({ ready: false, reason: 'Locked' });
    expect(g.areaMap.getView(source.id)?.nodes.every(n => !n.ready)).toBe(true);
    source.revealTriggers = [];
    source.nodes[1].action = { kind: 'attemptAreaTravel', areaId: 'demo:area:missing' };
    expect(g.areaMap.getNodeView(source.id, 'travel')).toMatchObject({ ready: false, reason: 'Unavailable', action: null });
  });
});
