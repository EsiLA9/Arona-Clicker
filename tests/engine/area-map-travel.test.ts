import { afterEach, describe, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { mergeFragments } from '../../src/data-services/datapack/fragment-parser';

let game: GameInstance;
afterEach(() => game?.dispose());
function setup() {
  game = new GameInstance();
  game.init([{ ...mergeFragments([]),
    inits: [{ id: 'demo:init:a', name: 'A', description: '', defaultAreas: ['demo:area:a'] }, { id: 'demo:init:b', name: 'B', description: '', defaultAreas: [] }],
    areas: ['a', 'b', 'c', 'd'].map(id => ({ id: `demo:area:${id}`, initId: id === 'd' ? 'demo:init:b' : 'demo:init:a', name: id, description: '', defaultSpots: [],
      ...(id === 'a' ? { adjacentAreaIds: ['demo:area:b'] } : {}),
      ...(id === 'b' ? { enterEffects: [{ effects: [{ op: 'addResource' as const, target: 'demo:resource:visits', value: 1 }] }] } : {}),
    })),
  }]);
  return game;
}

describe('Area travel admission', () => {
  test('collected mapDirect adds a route without expanding through the destination and rechecks the entry gate', () => {
    game = new GameInstance();
    const mapId = 'demo:area-map:guide';
    const targetId = 'demo:area:c';
    const farId = 'demo:area:far';
    const permit = 'demo:resource:permit';
    game.init([{ ...mergeFragments([]),
      inits: [{ id: 'demo:init:a', name: 'A', description: '', defaultAreas: ['demo:area:a'] }],
      areas: [
        { id: 'demo:area:a', initId: 'demo:init:a', name: 'A', description: '', defaultSpots: [], adjacentAreaIds: ['demo:area:b'] },
        { id: 'demo:area:b', initId: 'demo:init:a', name: 'B', description: '', defaultSpots: [], adjacentAreaIds: ['demo:area:a'] },
        { id: targetId, initId: 'demo:init:a', name: 'C', description: '', defaultSpots: [], adjacentAreaIds: [farId], enterCondition: { type: 'AND', conditions: [{ target: 'resource', key: permit, comparator: '>=', value: 1 }] } },
        { id: farId, initId: 'demo:init:a', name: 'Far', description: '', defaultSpots: [], adjacentAreaIds: [targetId] },
      ],
      areaMaps: [{ id: mapId, name: 'Guide', openCondition: { type: 'AND', conditions: [{ target: 'resource', key: permit, comparator: '>=', value: 2 }] },
        nodes: [{ id: 'c', position: { x: 0, y: 0 }, action: { kind: 'attemptAreaTravel', areaId: targetId, travelMode: 'mapDirect' } }], edges: [] }],
    }]);
    expect(game.getAreaTravelStatus(targetId)).toMatchObject({ success: false, error: 'Locked' });
    expect(game.mutations.acquireAreaMap(mapId)).toBe(true);
    expect(game.areaMap.getView(mapId)).toBeNull();
    expect(game.getAreaTravelStatus(targetId)).toMatchObject({ success: false, error: 'Locked' });
    expect(game.reachableAreaIds()).not.toContain(farId);
    game.mutations.changeResource(permit, 1);
    expect(game.getAreaTravelStatus(targetId)).toMatchObject({ success: true, method: 'mapDirect' });
    expect(game.reachableAreaIds()).toContain(targetId);
    expect(game.reachableAreaIds()).not.toContain(farId);
    expect(game.travelToArea(targetId)).toMatchObject({ success: true, method: 'mapDirect' });
    expect(game.state.currentAreaId).toBe(targetId);
  });

  test('preview does not write, emit or log; commit retains complete entry effects', () => {
    const g = setup();
    const events: string[] = [];
    g.eventBus.on('areaEntered', () => events.push('entered'));
    const before = JSON.stringify({ ...g.save(), timestamp: 0 });
    const logs = g.getDevLogs().length;
    expect(g.getAreaTravelStatus('demo:area:b').success).toBe(true);
    expect(JSON.stringify({ ...g.save(), timestamp: 0 })).toBe(before);
    expect(g.getDevLogs()).toHaveLength(logs);
    expect(events).toEqual([]);
    expect(g.travelToArea('demo:area:b').success).toBe(true);
    expect(events).toEqual(['entered']);
    expect(g.state.currentAreaId).toBe('demo:area:b');
    expect(g.state.visitedAreas).toContain('demo:area:b');
    expect(g.state.resources['demo:resource:visits']).toBe(1);
  });

  test.each([['missing', 'NotFound'], ['d', 'NotInThisInit'], ['a', 'AlreadyThere'], ['c', 'NotAdjacent']] as const)(
    'preview and commit reject %s consistently without effects', (id, error) => {
      const g = setup();
      const before = JSON.stringify({ ...g.save(), timestamp: 0 });
      expect(g.getAreaTravelStatus(`demo:area:${id}`)).toMatchObject({ success: false, error });
      expect(g.travelToArea(`demo:area:${id}`)).toMatchObject({ success: false, error });
      expect(JSON.stringify({ ...g.save(), timestamp: 0 })).toBe(before);
    },
  );
  test('current entry condition uses the same live condition for preview and commit', () => {
    const g = setup();
    g.registry.areas.get('demo:area:b')!.enterCondition = { type: 'AND', conditions: [{ target: 'resource', key: 'demo:resource:key', comparator: '>=', value: 1 }] };
    expect(g.getAreaTravelStatus('demo:area:b')).toMatchObject({ success: false, error: 'Locked' });
    expect(g.travelToArea('demo:area:b')).toMatchObject({ success: false, error: 'Locked' });
    g.state.resources['demo:resource:key'] = 1;
    expect(g.getAreaTravelStatus('demo:area:b').success).toBe(true);
  });
});
