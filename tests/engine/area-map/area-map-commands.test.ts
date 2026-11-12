import { afterEach, expect, test } from 'vitest';
import { GameInstance } from '../../../src/arona-clicker/runtime/runtime-game-instance';
import { loadAreaMapDemoPack } from '../../../src/ui/development/area-map-demo-pack';

const a = (id: string) => `area-map-demo:area:${id}`;
const m = (id: string) => `area-map-demo:area-map:${id}`;
let game: GameInstance;
afterEach(() => game?.dispose());

test('successful map open collects onOpen maps without moving; explicit maps remain uncollected', async () => {
  game = new GameInstance();
  game.init([(await loadAreaMapDemoPack()).datapack]);
  const start = game.state.currentAreaId;
  const city = game.openAreaMapFromArea(a('a'));
  expect(city).toMatchObject({ success: true, mapId: m('a') });
  expect(game.state.currentAreaId).toBe(start);
  expect(game.state.collectedAreaMapIds).toContain(m('a'));

  game.registry.areaMaps.get(m('b'))!.collection = 'explicit';
  const portal = game.openAreaMapFromNode(m('a'), 'portal');
  expect(portal).toMatchObject({ success: true, mapId: m('b'), collected: false });
  expect(game.state.collectedAreaMapIds).not.toContain(m('b'));
  expect(game.state.currentAreaId).toBe(start);
});

test('opening an eligible hidden map observes its existence and collects only after open succeeds', async () => {
  game = new GameInstance();
  game.init([(await loadAreaMapDemoPack()).datapack]);
  game.openAreaMapFromArea(a('a'));
  game.travelToArea(a('mall_entrance'));
  expect(game.openAreaMapFromNode(m('mall'), 'floor')).toMatchObject({ success: true, mapId: m('floor'), collected: true });
  expect(game.state.informationRevealProgress?.revealed).toContainEqual({ entityKind: 'areaMap', entityId: m('floor'), target: 'existence' });
  expect(game.state.collectedAreaMapIds).toContain(m('floor'));
  expect(game.state.currentAreaId).toBe(a('mall_entrance'));
});

test('collected maps can be reopened by book index without moving the player', async () => {
  game = new GameInstance();
  game.init([(await loadAreaMapDemoPack()).datapack]);
  game.openAreaMapFromArea(a('a'));
  expect(game.openAreaMapFromNode(m('a'), 'portal')).toMatchObject({ success: true, collected: false });
  expect(game.state.collectedAreaMapIds).not.toContain(m('b'));
  expect(game.mutations.acquireAreaMap(m('b'))).toBe(true);
  const currentArea = game.state.currentAreaId;
  expect(game.state.collectedAreaMapIds).toContain(m('b'));
  expect(game.openCollectedAreaMap(0)).toMatchObject({ success: true, mapId: m('a') });
  expect(game.state.currentAreaId).toBe(currentArea);
  game.registry.areaMaps.get(m('b'))!.openCondition = { type: 'AND', conditions: [{ target: 'resource', key: 'missing', comparator: '>=', value: 1 }] };
  expect(game.openCollectedAreaMap(1)).toMatchObject({ success: false, error: 'Locked' });
});

test('Init map collection and Save-level node knowledge survive save and restore independently', async () => {
  const pack = (await loadAreaMapDemoPack()).datapack;
  game = new GameInstance();
  game.init([pack]);
  game.openAreaMapFromArea(a('a'));
  expect(game.mutations.acquireAreaMap(m('b'))).toBe(true);
  expect(game.openAreaMapFromNode(m('b'), 'portal')).toMatchObject({ success: true, mapId: m('c'), collected: true });
  game.mutations.changeResource('area-map-demo:resource:permit', 1);
  expect(game.areaMap.getNodeView(m('c'), 'hidden')).toMatchObject({ existenceKnown: true });

  const saved = game.save();
  const restored = new GameInstance();
  restored.init([pack]);
  restored.load(saved);
  expect(restored.state.collectedAreaMapIds).toEqual([m('a'), m('b'), m('c')]);
  expect(restored.state.informationRevealProgress?.revealed).toContainEqual({
    entityKind: 'areaMapNode', mapId: m('c'), nodeId: 'hidden', target: 'existence',
  });
  expect(restored.areaMap.getNodeView(m('c'), 'hidden')).toMatchObject({ existenceKnown: true });
  restored.dispose();
});
