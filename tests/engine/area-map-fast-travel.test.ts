import { afterEach, expect, test } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { loadAreaMapDemoPack } from '../../src/ui/development/area-map-demo-pack';
import { mergeFragments } from '../../src/data-services/datapack/fragment-parser';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
const a = (id: string) => 'area-map-demo:area:' + id;
const m = (id: string) => 'area-map-demo:area-map:' + id;
let game: GameInstance;
afterEach(() => game?.dispose());
async function setup() { game = new GameInstance(); game.init([(await loadAreaMapDemoPack()).datapack]); return game; }

test('夏莱天台经已到访主厅透传到资料室和机库，待接剧情与进入效果不自动阻断', () => {
  game = new GameInstance(); game.init([defaultDatapack]); game.story.clearAllCurrentStories();
  const ids = ['schale_library', 'schale_hangar', 'schale_main', 'schale_rooftop'].map(id => `base:area:${id}`);
  for (const id of ids) expect(game.travelToArea(id).success).toBe(true);
  const main = game.registry.areas.get('base:area:schale_main')!;
  main.enterEffects = [{ effects: [{ op: 'addResource', target: 'base:resource:credit', value: 1 }] }];
  expect(game.reachableAreaIds()).toEqual(expect.arrayContaining(['base:area:schale_library', 'base:area:schale_hangar']));
  expect(game.getAreaTravelStatus('base:area:schale_hangar')).toMatchObject({ success: true, method: 'visited' });
  expect(game.areaMap.getView('base:area-map:schale_office')?.nodes.find(node => node.id === 'schale_hangar')?.ready).toBe(true);
  expect(game.travelToArea('base:area:schale_library').success).toBe(true);
});

test('real elevator links unlock unvisited halls; rooms need exploration and closed paths prevent fast return', async () => {
  const g = await setup();
  expect(g.availableAreaIds(a('mall_entrance'))).not.toContain(a('hall2'));
  expect(g.areaMap.getView(m('floor'))).toBeNull();
  expect(g.travelToArea(a('mall_entrance')).success).toBe(true);
  expect(g.availableAreaIds(a('mall_entrance'))).toContain(a('hall2'));
  expect(g.state.visitedAreas).not.toContain(a('hall2'));
  expect(g.travelToArea(a('hall2'))).toMatchObject({ success: true, method: 'transit' });
  expect(g.travelToArea(a('shop')).success).toBe(false);
  expect(g.travelToArea(a('hall1')).success).toBe(true);
  expect(g.travelToArea(a('corridor')).success).toBe(true);
  expect(g.travelToArea(a('shop')).success).toBe(true);
  const corridor = g.registry.areas.get(a('corridor'))!;
  corridor.quickPassage = false;
  expect(g.getAreaTravelStatus(a('hall1')).success).toBe(false);
  corridor.quickPassage = true;
  expect(g.getAreaTravelStatus(a('hall1'))).toMatchObject({ success: true, method: 'visited' });
  corridor.adjacentAreaIds = [];
  expect(g.travelToArea(a('hall1')).success).toBe(false);
});

test('Map lines are a subset of actual directed connections and Map visibility never grants travel', async () => {
  const g = await setup();
  expect(g.areaMap.getView(m('mall'))!.edges).toEqual([]);
  g.travelToArea(a('mall_entrance'));
  expect(g.areaMap.getView(m('mall'))!.edges).toHaveLength(2);
  g.registry.load({ ...mergeFragments([]), areaMaps: [{ id: m('fake'), name: '假想路线', nodes: [
    { id: 'home', position: { x: 0, y: 0 }, action: { kind: 'attemptAreaTravel', areaId: a('a') } },
    { id: 'shop', position: { x: 100, y: 0 }, action: { kind: 'attemptAreaTravel', areaId: a('shop') } },
  ], edges: [{ fromNodeId: 'home', toNodeId: 'shop' }] }] });
  expect(g.areaMap.getView(m('fake'))!.edges).toEqual([]);
  expect(g.getAreaTravelStatus(a('shop')).success).toBe(false);
  g.registry.areas.get(a('corridor'))!.adjacentAreaIds = [a('shop')];
  expect(g.areaMap.getView(m('floor'))!.edges).toContainEqual({ fromNodeId: 'hall1', toNodeId: 'corridor', directed: true });
  g.registry.areaMaps.get(m('mall'))!.revealTriggers = [{ reveal: 'existence', condition: { target: 'resource', key: 'hidden', comparator: '>=', value: 1 } }];
  expect(g.areaMap.getView(m('mall'))).toBeNull();
  expect(g.getAreaTravelStatus(a('hall2')).success).toBe(true);
});

test('removing the real traffic source removes its links, even for visited destinations', async () => {
  const g = await setup();
  g.travelToArea(a('mall_entrance')); g.travelToArea(a('hall2'));
  g.mutations.removeEnhancement('area-map-demo:enhancement:mall_elevator');
  expect(g.availableAreaIds(a('hall2'))).not.toContain(a('mall_entrance'));
  expect(g.getAreaTravelStatus(a('mall_entrance')).success).toBe(false);
  expect(g.areaMap.getView(m('mall'))!.edges).toEqual([]);
});
