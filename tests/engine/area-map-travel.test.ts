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
  test('locked visibility uses the same live condition for preview and commit', () => {
    const g = setup();
    g.registry.areas.get('demo:area:b')!.revealTriggers = [{ reveal: 'existence', condition: { target: 'resource', key: 'demo:resource:key', comparator: '>=', value: 1 } }];
    expect(g.getAreaTravelStatus('demo:area:b')).toMatchObject({ success: false, error: 'Locked' });
    expect(g.travelToArea('demo:area:b')).toMatchObject({ success: false, error: 'Locked' });
    g.state.resources['demo:resource:key'] = 1;
    expect(g.getAreaTravelStatus('demo:area:b').success).toBe(true);
  });
});
