import { expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { loadAreaMapDemoPack } from '../../src/ui/development/area-map-demo-pack';
import { mergeFragments } from '../../src/data-services/datapack/fragment-parser';
test('failed complete-set map admission preserves live Registry, position and runtime generation', async () => {
  const game = new GameInstance();
  try {
    game.init([(await loadAreaMapDemoPack()).datapack]);
    const state = JSON.stringify(game.state);
    const generation = game.inits.getRuntimeGeneration();
    const map = game.registry.areaMaps.get('area-map-demo:area-map:a');
    expect(() => game.init([{ ...mergeFragments([]), areaMaps: [{ id: 'bad:area-map:a', name: 'Bad', nodes: [{ id: 'bad', position: { x: 0, y: 0 }, action: { kind: 'openMap', mapId: 'bad:area-map:missing' } }], edges: [] }] }])).toThrow(/mapId/);
    expect(JSON.stringify(game.state)).toBe(state);
    expect(game.inits.getRuntimeGeneration()).toBe(generation);
    expect(game.registry.areaMaps.get('area-map-demo:area-map:a')).toBe(map);
    expect(game.registry.areaMaps.size).toBe(5);
  } finally { game.dispose(); }
});
