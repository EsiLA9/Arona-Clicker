import { afterEach, describe, expect, test, vi } from 'vitest';
import { GameInstance } from '../../src/arona-clicker/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import type { SpotDef } from '../../src/data-services/contracts/world';
import { Expr } from '../../src/engine/types';
import { GameNumSystem, type GameNum } from '../../src/engine/expression/game-num';
import { EventBus } from '../../src/engine/core/event-bus';
import { ValueSystem } from '../../src/engine/expression/value-system';

const OFFICE = 'base:init:schale_office';
const OWNER = 'draft-mod';
const SPOT_ID = `${OWNER}:spot:hot_spot`;
const RESOURCE_A = `${OWNER}:resource:hot_a`;
const RESOURCE_B = `${OWNER}:resource:hot_b`;

const childrenOf = (node: GameNum | undefined): GameNum[] =>
  node && (node.kind === 'add' || node.kind === 'sub' || node.kind === 'mul') ? node.children : [];

const makeSpot = (template: SpotDef, areaId: string, resource: string, baseAmount: number, linearAmount: number): SpotDef => ({
  ...template,
  id: SPOT_ID,
  areaId,
  name: 'Hot Spot',
  description: '',
  functionalities: [
    { id: `${SPOT_ID}:base`, kind: 'flow', resource, amount: baseAmount },
    { id: `${SPOT_ID}:linear`, kind: 'linearYield', resource, amountPerLevel: linearAmount, startLevel: 1 },
  ],
  tags: [],
});

describe('GameNum Spot definition hot update', () => {
  let game: GameInstance | undefined;

  afterEach(() => {
    game?.stop();
    game = undefined;
  });

  test('create rebuilds the resource root from the new Spot Affector definitions', () => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);

    const areas = [...game.registry.areas.values()];
    const template = [...game.registry.spots.values()][0];
    const spot = makeSpot(template, areas[0].id, RESOURCE_A, 3, 1);
    const buildAll = vi.spyOn(game.gameNumSystem, 'buildAll');
    game.state.spotLevels[SPOT_ID] = 2;

    game.registry.applySpotMutation({ operation: 'create', ownerModName: OWNER, spot });
    game.eventBus.emit({
      type: 'spotDefinitionChanged',
      spotId: SPOT_ID,
      operation: 'create',
      nextAreaId: spot.areaId,
    });

    expect(game.gameNumSystem.getGainNode(RESOURCE_A)).toBeDefined();
    expect(game.gameNumSystem.spotSubtrees.has(SPOT_ID)).toBe(true);
    expect(game.gameNumSystem.evaluateSpotYield(SPOT_ID, game.state)).toBe(4);
    expect(game.gameNumSystem.evaluateResourceGain(RESOURCE_A, game.state)).toBe(4);
  });

  test('replace detaches old resource and Area chain before attaching the new one', () => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);

    const areas = [...game.registry.areas.values()];
    const template = [...game.registry.spots.values()][0];
    const initial = makeSpot(template, areas[0].id, RESOURCE_A, 3, 1);
    game.registry.applySpotMutation({ operation: 'create', ownerModName: OWNER, spot: initial });
    game.eventBus.emit({
      type: 'spotDefinitionChanged',
      spotId: SPOT_ID,
      operation: 'create',
      nextAreaId: initial.areaId,
    });
    game.state.spotLevels[SPOT_ID] = 2;
    const oldProduct = game.gameNumSystem.spotProductNodes.get(`${SPOT_ID}@${RESOURCE_A}`)!;
    const oldAreaExtra = game.gameNumSystem.areaExtraNodes.get(`${areas[0].id}@${RESOURCE_A}`)!;
    const oldAreaFull = (game.gameNumSystem.parents.get(oldAreaExtra.id) ?? []).find(node => node.id.startsWith('area:'))!;
    const oldAreaProduct = oldAreaFull.kind === 'add'
      ? oldAreaFull.children.find(node => node.id.startsWith('areaProduct:'))!
      : undefined;
    const oldAreaBase = oldAreaProduct?.kind === 'mul'
      ? oldAreaProduct.children.find(node => node.id.startsWith('areaBase:'))!
      : undefined;
    expect(oldAreaBase?.kind).toBe('add');
    expect(childrenOf(oldAreaBase)).toContain(oldProduct);

    const replacement = makeSpot(template, areas[1]?.id ?? areas[0].id, RESOURCE_B, 7, 2);
    game.registry.applySpotMutation({ operation: 'replace', ownerModName: OWNER, spot: replacement });
    game.eventBus.emit({
      type: 'spotDefinitionChanged',
      spotId: SPOT_ID,
      operation: 'replace',
      previousAreaId: initial.areaId,
      nextAreaId: replacement.areaId,
    });

    expect(game.gameNumSystem.allNodes).not.toContain(oldProduct);
    const newProduct = game.gameNumSystem.spotProductNodes.get(`${SPOT_ID}@${RESOURCE_B}`)!;
    const newAreaExtra = game.gameNumSystem.areaExtraNodes.get(`${replacement.areaId}@${RESOURCE_B}`)!;
    const newAreaFull = (game.gameNumSystem.parents.get(newAreaExtra.id) ?? []).find(node => node.id.startsWith('area:'))!;
    const newAreaProduct = newAreaFull.kind === 'add'
      ? newAreaFull.children.find(node => node.id.startsWith('areaProduct:'))!
      : undefined;
    const newAreaBase = newAreaProduct?.kind === 'mul'
      ? newAreaProduct.children.find(node => node.id.startsWith('areaBase:'))!
      : undefined;
    expect(newAreaBase?.kind).toBe('add');
    expect(childrenOf(newAreaBase)).toContain(newProduct);
    expect(game.gameNumSystem.evaluateResourceGain(RESOURCE_A, game.state)).toBe(0);
    expect(game.gameNumSystem.evaluateSpotYield(SPOT_ID, game.state)).toBe(9);
    expect(game.gameNumSystem.evaluateResourceGain(RESOURCE_B, game.state)).toBe(9);
    expect(game.gameNumSystem.spotProductNodes.has(`${SPOT_ID}@${RESOURCE_A}`)).toBe(false);
    expect(game.gameNumSystem.spotProductNodes.has(`${SPOT_ID}@${RESOURCE_B}`)).toBe(true);
    expect(new Set([...game.gameNumSystem.spotProductNodes.keys()].filter(key => key.startsWith(`${SPOT_ID}@`))).size)
      .toBe(game.gameNumSystem.getResources().length);
  });

  test('delete removes the Spot subtree and leaves no contribution in its resource root', () => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);

    const area = [...game.registry.areas.values()][0];
    const template = [...game.registry.spots.values()][0];
    const spot = makeSpot(template, area.id, RESOURCE_A, 5, 0);
    game.registry.applySpotMutation({ operation: 'create', ownerModName: OWNER, spot });
    game.eventBus.emit({
      type: 'spotDefinitionChanged',
      spotId: SPOT_ID,
      operation: 'create',
      nextAreaId: spot.areaId,
    });
    game.state.spotLevels[SPOT_ID] = 1;
    const full = game.gameNumSystem.spotSubtrees.get(SPOT_ID)!;
    expect(game.gameNumSystem.evaluateResourceGain(RESOURCE_A, game.state)).toBe(5);

    const receipt = game.registry.applySpotMutation({ operation: 'delete', ownerModName: OWNER, spotId: SPOT_ID });
    game.eventBus.emit({
      type: 'spotDefinitionChanged',
      spotId: SPOT_ID,
      operation: 'delete',
      previousAreaId: receipt.previousSpot!.areaId,
    });

    expect(game.gameNumSystem.spotSubtrees.has(SPOT_ID)).toBe(false);
    expect([...game.gameNumSystem.spotFullNodes.keys()].some(key => key.startsWith(`${SPOT_ID}@`))).toBe(false);
    expect([...game.gameNumSystem.spotProductNodes.keys()].some(key => key.startsWith(`${SPOT_ID}@`))).toBe(false);
    expect([...game.gameNumSystem.spotExtraNodes.keys()].some(key => key.startsWith(`${SPOT_ID}@`))).toBe(false);
    expect(game.gameNumSystem.allNodes).not.toContain(full);
    expect(game.gameNumSystem.zoneNodes.some(node => node.scope.kind === 'spot' && node.scope.id === SPOT_ID)).toBe(false);
    expect([...game.gameNumSystem.zoneIndex.values()].some(entry =>
      [...entry.flat, ...entry.mul].some(node => node.kind === 'zone' && node.scope.kind === 'spot' && node.scope.id === SPOT_ID))).toBe(false);
    expect(game.gameNumSystem.evaluateResourceGain(RESOURCE_A, game.state)).toBe(0);
  });

  test('create builds the first gain root when the initial system has no resources', () => {
    const areaId = `${OWNER}:area:hot_area`;
    const initId = `${OWNER}:init:hot_init`;
    const registry = {
      spots: new Map<string, SpotDef>(),
      areas: new Map([[areaId, { id: areaId, initId, tags: [] }]]),
      inits: new Map([[initId, { id: initId, tags: [] }]]),
      enhancements: new Map(),
      resourceDisplays: new Map(),
      effectiveSpotTags: () => [],
    };
    const bus = new EventBus();
    const state = { resources: {}, spotLevels: { [SPOT_ID]: 1 }, spotManagers: {}, flags: {} };
    const affector = {
      getActiveInstances: () => registry.spots.has(SPOT_ID) ? [{ instanceId: `hot@${SPOT_ID}`, packId: 'hot-pack', mountEntityId: SPOT_ID, state: 'Active', activeEntryIds: ['flow'] }] : [],
      getPack: () => ({ id: 'hot-pack', entries: [{ id: 'flow', effects: [], flows: [{ resource: RESOURCE_A, value: 6 }] }] }),
      getFlowResources: () => registry.spots.has(SPOT_ID) ? [RESOURCE_A] : [],
    };
    const system = new GameNumSystem({
      valueSystem: new ValueSystem(),
      registry,
      affectorEngine: affector as never,
      eventBus: bus,
    });
    system.buildAll(state);
    expect(system.getResources()).toEqual([]);

    const spot: SpotDef = {
      id: SPOT_ID,
      areaId,
      name: 'First Hot Spot',
      description: '',
      baseCost: Expr.const(1),
      baseCostResource: RESOURCE_A,
      baseCapacity: 1,
      functionalities: [{ id: `${SPOT_ID}:base`, kind: 'flow', resource: RESOURCE_A, amount: 6 }],
      tags: [],
    };
    registry.spots.set(SPOT_ID, spot);
    bus.emit({
      type: 'spotDefinitionChanged',
      spotId: SPOT_ID,
      operation: 'create',
      nextAreaId: areaId,
    });

    expect(system.getResources()).toEqual([RESOURCE_A]);
    expect(system.evaluateSpotYield(SPOT_ID, state)).toBe(6);
    expect(system.evaluateResourceGain(RESOURCE_A, state)).toBe(6);
  });
});
