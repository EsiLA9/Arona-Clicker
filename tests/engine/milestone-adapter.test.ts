import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Datapack, MilestoneDef } from '../../src/data-services/contracts/datapack';
import { Registry } from '../../src/data-services/registry/registry';
import { createDefaultState } from '../../src/arona-clicker/state/state-factory';
import { GameInstance } from '../../src/arona-clicker/runtime/runtime-game-instance';
import { baseDatapack } from '../../src/data/test-datapack';
import type { PlayerState } from '../../src/arona-clicker/types/state';
import { deriveDesiredMilestoneWatches } from '../../src/arona-clicker/services/world/milestone-domain';
import { MilestoneAdapter } from '../../src/arona-clicker/services/world/milestone-adapter';

const OFFICE = 'base:init:schale_office';
const CREDIT = 'test:resource:credit';
const OTHER_CREDIT = 'test:resource:other-credit';
const ITEM = 'test:item:milestone-sample';
const OTHER_ITEM = 'test:item:other-sample';
const MILESTONE = 'test:milestone:credit_10';

function pack(milestones: MilestoneDef[], milestoneListeners: Datapack['milestoneListeners'] = []): Datapack {
  return {
    name: 'Milestone test', version: '1.0.0', modName: 'test',
    inits: [], areas: [], spots: [], enhancements: [], activeStories: [], passiveStories: [],
    stories: [], items: [], funcletDefs: [], characters: [], milestones, milestoneListeners,
  };
}

const condition = (target: 'resource', key: string, value = 10) => ({
  target, key, comparator: '>=' as const, value,
});

describe('Milestone domain and adapter', () => {
  let game: GameInstance;

  beforeEach(() => {
    game = new GameInstance();
    game.init([baseDatapack]);
    game.inits.startNewGame(OFFICE);
  });

  afterEach(() => game.stop());

  test('admits only reviewed leaves, treats alwaysTrue as static, and rejects groups with unsupported leaves', () => {
    const registry = new Registry();
    registry.load(pack([
      { id: 'test:milestone:static', condition: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } },
      { id: MILESTONE, condition: condition('resource', CREDIT) },
      { id: 'test:milestone:global', condition: condition('resource', 'base:resource:pyroxene') },
      { id: 'test:milestone:group', condition: {
        type: 'AND', conditions: [condition('resource', CREDIT), { target: 'alwaysTrue', key: '', comparator: '==', value: 1 }],
      } },
      { id: 'test:milestone:unsupported', condition: { target: 'stat', key: 'any', comparator: '>=', value: 1 } },
      { id: 'test:milestone:unsafe-or', condition: {
        type: 'OR', conditions: [condition('resource', CREDIT), { target: 'stat', key: 'any', comparator: '>=', value: 1 }],
      } },
    ]));

    const desired = deriveDesiredMilestoneWatches(registry, createDefaultState());

    expect(desired.map(watch => watch.milestoneId)).toEqual([
      'test:milestone:static', MILESTONE, 'test:milestone:group',
    ]);
    expect(desired.find(watch => watch.milestoneId === 'test:milestone:static')?.sources).toEqual([]);
    expect(desired.find(watch => watch.milestoneId === 'test:milestone:group')?.sources).toEqual([
      { kind: 'resource', resourceId: CREDIT },
    ]);
  });

  test('gates associated milestones by current Init and visited Area while preserving unattached milestones', () => {
    const localArea = [...game.registry.areas.values()].find(area => area.initId === OFFICE);
    const foreignArea = [...game.registry.areas.values()].find(area => area.initId !== OFFICE);
    expect(localArea).toBeDefined();
    expect(foreignArea).toBeDefined();
    if (!localArea || !foreignArea) return;

    const localId = 'test:milestone:local_arrival';
    const foreignId = 'test:milestone:foreign_arrival';
    const legacyId = 'test:milestone:legacy';
    game.registry.load(pack(
      [
        { id: localId, condition: condition('resource', CREDIT) },
        { id: foreignId, condition: condition('resource', CREDIT) },
        { id: legacyId, condition: condition('resource', CREDIT) },
      ],
      [
        { id: 'test:milestone-listener:local', milestoneId: localId, areaId: localArea.id, then: [] },
        { id: 'test:milestone-listener:foreign', milestoneId: foreignId, areaId: foreignArea.id, then: [] },
      ],
    ));

    const state = { ...game.state, visitedAreas: [foreignArea.id] };
    let desiredIds = deriveDesiredMilestoneWatches(game.registry, state).map(watch => watch.milestoneId);
    expect(desiredIds).not.toContain(localId);
    expect(desiredIds).not.toContain(foreignId);
    expect(desiredIds).toContain(legacyId);

    state.activeInit = foreignArea.initId;
    desiredIds = deriveDesiredMilestoneWatches(game.registry, state).map(watch => watch.milestoneId);
    expect(desiredIds).not.toContain(localId);
    expect(desiredIds).toContain(foreignId);
    expect(desiredIds).toContain(legacyId);
  });

  test('registers exact wake sources before admission, rechecks current state, completes once, and withdraws', () => {
    game.registry.load(pack([{ id: MILESTONE, condition: condition('resource', CREDIT) }]));
    const adapter = new MilestoneAdapter(
      game.triggerSystem, game.conditionSystem, game.mutations, () => game.state, game.registry, 'milestone-test',
    );
    game.triggerSystem.setRuntimeActionHandler(action => adapter.handleRuntimeAction(action));
    const registrationKey = `milestone-test:${MILESTONE}:0`;

    adapter.reconcileCurrent();
    expect(game.triggerSystem.has(registrationKey)).toBe(true);
    expect(game.state.milestoneProgress?.completed).not.toContain(MILESTONE);

    game.mutations.changeResource('test:resource:other', 10);
    expect(game.state.milestoneProgress?.completed).not.toContain(MILESTONE);
    expect(game.triggerSystem.has(registrationKey)).toBe(true);

    game.mutations.changeResource(CREDIT, 10);
    expect(game.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(game.triggerSystem.has(registrationKey)).toBe(false);

    game.mutations.setResource(CREDIT, 0);
    adapter.reconcileCurrent();
    expect(game.state.milestoneProgress?.completed).toContain(MILESTONE);
    expect(game.triggerSystem.has(registrationKey)).toBe(false);
    adapter.withdrawAll();
  });

  test('admission-only true conditions complete without creating registrations', () => {
    const id = 'test:milestone:static';
    game.registry.load(pack([{ id, condition: { target: 'alwaysTrue', key: '', comparator: '==', value: 1 } }]));
    const adapter = new MilestoneAdapter(
      game.triggerSystem, game.conditionSystem, game.mutations, () => game.state, game.registry, 'milestone-static',
    );
    game.triggerSystem.setRuntimeActionHandler(action => adapter.handleRuntimeAction(action));

    adapter.reconcileCurrent();

    expect(game.state.milestoneProgress?.completed).toContain(id);
    expect(game.triggerSystem.getDefinitions().some(def => def.id?.startsWith('milestone-static:'))).toBe(false);
    adapter.withdrawAll();
  });

  test('does not watch or complete an associated milestone before its Area visit, then catches up on reconcile', () => {
    const area = [...game.registry.areas.values()].find(candidate => candidate.initId === OFFICE);
    expect(area).toBeDefined();
    if (!area) return;

    const id = 'test:milestone:arrival_gate';
    const state = game.state as unknown as PlayerState;
    state.visitedAreas = [];
    game.mutations.setResource(CREDIT, 10);
    game.registry.load(pack(
      [{ id, condition: condition('resource', CREDIT) }],
      [{ id: 'test:milestone-listener:arrival_gate', milestoneId: id, areaId: area.id, then: [] }],
    ));
    const adapter = new MilestoneAdapter(
      game.triggerSystem, game.conditionSystem, game.mutations, () => state, game.registry, 'milestone-arrival',
    );
    game.triggerSystem.setRuntimeActionHandler(action => adapter.handleRuntimeAction(action));
    const registrationKey = `milestone-arrival:${id}:0`;

    adapter.reconcileCurrent();
    expect(game.triggerSystem.has(registrationKey)).toBe(false);
    expect(game.state.milestoneProgress?.completed).not.toContain(id);

    state.visitedAreas = [area.id];
    adapter.reconcileCurrent();
    expect(game.state.milestoneProgress?.completed).toContain(id);
    expect(game.triggerSystem.has(registrationKey)).toBe(false);
    adapter.withdrawAll();
  });

  test('only derives precise watches for the two supported Init stat calls and comparisons', () => {
    const areaId = game.state.currentAreaId!;
    const producedId = 'test:milestone:init-produced';
    const collectedId = 'test:milestone:init-collected';
    const unsupportedIds = [
      'test:milestone:global-stat',
      'test:milestone:run-stat',
      'test:milestone:consumed-stat',
      'test:milestone:used-stat',
      'test:milestone:wrong-init-stat',
      'test:milestone:extra-stat-argument',
      'test:milestone:less-than-stat',
      'test:milestone:equal-stat',
      'test:milestone:legacy-stat',
    ];
    const definitions: MilestoneDef[] = [
      { id: producedId, condition: { target: 'stat', key: `$InitProducedAmount ${OFFICE} ${CREDIT}`, comparator: '>=', value: 10 } },
      { id: collectedId, condition: { target: 'stat', key: `$InitCollectedAmount ${OFFICE} ${ITEM}`, comparator: '>', value: 2 } },
      { id: unsupportedIds[0], condition: { target: 'stat', key: `$GlobalProducedAmount ${CREDIT}`, comparator: '>=', value: 10 } },
      { id: unsupportedIds[1], condition: { target: 'stat', key: `$CurrentRunCollectedAmount ${ITEM}`, comparator: '>=', value: 2 } },
      { id: unsupportedIds[2], condition: { target: 'stat', key: `$InitConsumedAmount ${OFFICE} ${CREDIT}`, comparator: '>=', value: 10 } },
      { id: unsupportedIds[3], condition: { target: 'stat', key: `$InitUsedAmount ${OFFICE} ${ITEM}`, comparator: '>=', value: 2 } },
      { id: unsupportedIds[4], condition: { target: 'stat', key: `$InitProducedAmount test:init:other ${CREDIT}`, comparator: '>=', value: 10 } },
      { id: unsupportedIds[5], condition: { target: 'stat', key: `$InitProducedAmount ${OFFICE} ${CREDIT} extra`, comparator: '>=', value: 10 } },
      { id: unsupportedIds[6], condition: { target: 'stat', key: `$InitProducedAmount ${OFFICE} ${CREDIT}`, comparator: '<', value: 10 } },
      { id: unsupportedIds[7], condition: { target: 'stat', key: `$InitCollectedAmount ${OFFICE} ${ITEM}`, comparator: '==', value: 2 } },
      { id: unsupportedIds[8], condition: { target: 'stat', key: `$InitProducedAmount ${OFFICE} ${CREDIT}`, comparator: '>=', value: 10 } },
    ];
    game.registry.load(pack(definitions, [
      { id: 'test:milestone-listener:init-produced', milestoneId: producedId, areaId, then: [] },
      { id: 'test:milestone-listener:init-collected', milestoneId: collectedId, areaId, then: [] },
      ...unsupportedIds.slice(0, -1).map((id, index) => ({
        id: `test:milestone-listener:unsupported-${index}`,
        milestoneId: id,
        areaId,
        then: [],
      })),
    ]));

    const desired = deriveDesiredMilestoneWatches(game.registry, game.state);
    expect(desired.map(watch => watch.milestoneId)).toEqual([producedId, collectedId]);
    expect(desired.find(watch => watch.milestoneId === producedId)?.sources).toEqual([
      { kind: 'resource', resourceId: CREDIT },
    ]);
    expect(desired.find(watch => watch.milestoneId === collectedId)?.sources).toEqual([
      { kind: 'item', itemId: ITEM },
    ]);
  });

  test('wakes InitProducedAmount on the exact resource and keeps production cumulative after spending', () => {
    const id = 'test:milestone:init-produced-runtime';
    const areaId = game.state.currentAreaId!;
    game.registry.load(pack(
      [{ id, condition: {
        type: 'AND', conditions: [
          { target: 'stat', key: `$InitProducedAmount ${OFFICE} ${CREDIT}`, comparator: '>=', value: 10 },
          { target: 'resource', key: CREDIT, comparator: '>=', value: 10 },
        ],
      } }],
      [{ id: 'test:milestone-listener:init-produced-runtime', milestoneId: id, areaId, then: [] }],
    ));
    const adapter = new MilestoneAdapter(
      game.triggerSystem, game.conditionSystem, game.mutations, () => game.state, game.registry, 'milestone-produced',
    );
    game.triggerSystem.setRuntimeActionHandler(action => adapter.handleRuntimeAction(action));
    const registrationKey = `milestone-produced:${id}:0`;

    adapter.reconcileCurrent();
    expect(game.triggerSystem.getDefinitions().find(def => def.id === registrationKey)?.on).toEqual({
      kind: 'resource', resource: CREDIT,
    });
    game.mutations.changeResource(OTHER_CREDIT, 10);
    expect(game.state.milestoneProgress?.completed).not.toContain(id);
    expect(game.triggerSystem.has(registrationKey)).toBe(true);

    game.mutations.changeResource(CREDIT, 6);
    expect(game.state.milestoneProgress?.completed).not.toContain(id);
    game.mutations.changeResource(CREDIT, -6);
    expect(game.state.milestoneProgress?.completed).not.toContain(id);
    expect(game.triggerSystem.has(registrationKey)).toBe(true);

    game.mutations.changeResource(CREDIT, 4);
    expect(game.state.milestoneProgress?.completed).not.toContain(id);
    expect(game.triggerSystem.has(registrationKey)).toBe(true);
    game.mutations.changeResource(CREDIT, 6);
    expect(game.state.milestoneProgress?.completed).toContain(id);
    expect(game.triggerSystem.has(registrationKey)).toBe(false);
    adapter.withdrawAll();
  });

  test('wakes InitCollectedAmount on the exact item and does not backslide when the item is used', () => {
    const id = 'test:milestone:init-collected-runtime';
    const areaId = game.state.currentAreaId!;
    game.registry.load(pack(
      [{ id, condition: {
        type: 'AND', conditions: [
          { target: 'stat', key: `$InitCollectedAmount ${OFFICE} ${ITEM}`, comparator: '>', value: 2 },
          { target: 'resource', key: CREDIT, comparator: '>=', value: 1 },
        ],
      } }],
      [{ id: 'test:milestone-listener:init-collected-runtime', milestoneId: id, areaId, then: [] }],
    ));
    const adapter = new MilestoneAdapter(
      game.triggerSystem, game.conditionSystem, game.mutations, () => game.state, game.registry, 'milestone-collected',
    );
    game.triggerSystem.setRuntimeActionHandler(action => adapter.handleRuntimeAction(action));
    const registrationKey = `milestone-collected:${id}:0`;

    adapter.reconcileCurrent();
    expect(game.triggerSystem.getDefinitions().find(def => def.id === registrationKey)?.on).toEqual({
      kind: 'item', itemId: ITEM,
    });
    game.mutations.addItem(OTHER_ITEM, 5);
    expect(game.state.milestoneProgress?.completed).not.toContain(id);
    expect(game.triggerSystem.has(registrationKey)).toBe(true);

    game.mutations.addItem(ITEM, 2);
    expect(game.state.milestoneProgress?.completed).not.toContain(id);
    game.mutations.removeItem(ITEM, 2);
    expect(game.state.milestoneProgress?.completed).not.toContain(id);
    expect(game.triggerSystem.has(registrationKey)).toBe(true);

    game.mutations.addItem(ITEM, 1);
    expect(game.state.milestoneProgress?.completed).not.toContain(id);
    expect(game.triggerSystem.has(registrationKey)).toBe(true);
    game.mutations.changeResource(CREDIT, 1);
    expect(game.state.milestoneProgress?.completed).toContain(id);
    expect(game.triggerSystem.has(registrationKey)).toBe(false);
    adapter.withdrawAll();
  });

  test('completes an associated Init stat milestone on admission when the cumulative threshold is already met', () => {
    const id = 'test:milestone:init-produced-admission';
    const areaId = game.state.currentAreaId!;
    game.mutations.changeResource(CREDIT, 10);
    game.registry.load(pack(
      [{ id, condition: { target: 'stat', key: `$InitProducedAmount ${OFFICE} ${CREDIT}`, comparator: '>=', value: 10 } }],
      [{ id: 'test:milestone-listener:init-produced-admission', milestoneId: id, areaId, then: [] }],
    ));
    const adapter = new MilestoneAdapter(
      game.triggerSystem, game.conditionSystem, game.mutations, () => game.state, game.registry, 'milestone-admission',
    );
    game.triggerSystem.setRuntimeActionHandler(action => adapter.handleRuntimeAction(action));

    adapter.reconcileCurrent();

    expect(game.state.milestoneProgress?.completed).toContain(id);
    expect(game.triggerSystem.getDefinitions().some(def => def.id?.startsWith(`milestone-admission:${id}:`))).toBe(false);
    adapter.withdrawAll();
  });

  test('reports the first unsupported Listener leaf once after Area admission', () => {
    const initId = 'test:init:diagnostic';
    const foreignInitId = 'test:init:diagnostic-foreign';
    const areaId = 'test:area:diagnostic-origin';
    const unvisitedAreaId = 'test:area:diagnostic-target';
    const foreignAreaId = 'test:area:diagnostic-foreign';
    const unsupportedId = 'test:milestone:unsupported-admission';
    const unvisitedId = 'test:milestone:unsupported-unvisited';
    const foreignId = 'test:milestone:unsupported-foreign';
    const completedId = 'test:milestone:unsupported-completed';
    const legacyId = 'test:milestone:unsupported-legacy';
    const supportedId = 'test:milestone:supported-admission';
    const unsupportedCondition = {
      type: 'AND' as const,
      conditions: [
        { target: 'stat' as const, key: 'unsupported-primary', comparator: '>=' as const, value: 1 },
        { target: 'stat' as const, key: 'unsupported-secondary', comparator: '<=' as const, value: 2 },
      ],
    };
    const diagnosticPack = {
      ...pack([
        { id: unsupportedId, condition: unsupportedCondition },
        { id: unvisitedId, condition: unsupportedCondition },
        { id: foreignId, condition: unsupportedCondition },
        { id: completedId, condition: condition('resource', CREDIT, 1) },
        { id: legacyId, condition: unsupportedCondition },
        { id: supportedId, condition: condition('resource', CREDIT, 1_000_000) },
      ], [
        { id: 'test:milestone-listener:unsupported-admission', milestoneId: unsupportedId, areaId, then: [] },
        { id: 'test:milestone-listener:unsupported-unvisited', milestoneId: unvisitedId, areaId: unvisitedAreaId, then: [] },
        { id: 'test:milestone-listener:unsupported-foreign', milestoneId: foreignId, areaId: foreignAreaId, then: [] },
        { id: 'test:milestone-listener:unsupported-completed', milestoneId: completedId, areaId, then: [] },
        { id: 'test:milestone-listener:supported-admission', milestoneId: supportedId, areaId, then: [] },
      ]),
      inits: [
        { id: initId, name: 'Diagnostic test', description: '', defaultAreas: [areaId] },
        { id: foreignInitId, name: 'Foreign test', description: '', defaultAreas: [foreignAreaId] },
      ],
      areas: [
        { id: areaId, initId, name: 'Diagnostic origin', description: '', defaultSpots: [], adjacentAreaIds: [unvisitedAreaId] },
        { id: unvisitedAreaId, initId, name: 'Unvisited target', description: '', defaultSpots: [], adjacentAreaIds: [areaId] },
        { id: foreignAreaId, initId: foreignInitId, name: 'Foreign area', description: '', defaultSpots: [] },
      ],
    };
    game.stop();
    game = new GameInstance();
    const diagnostics = (id: string) => game.devLog.getEntries().filter(entry =>
      entry.source === 'milestone' && entry.level === 'error' && entry.message.includes(id));
    game.init([baseDatapack, diagnosticPack], { enterDefaultInit: false });
    expect(game.inits.startNewGame(initId)).toBe(true);
    expect(game.state.visitedAreas).toContain(areaId);
    expect(game.state.visitedAreas).not.toContain(unvisitedAreaId);

    expect(diagnostics(unsupportedId)).toHaveLength(1);
    expect(diagnostics(unvisitedId)).toHaveLength(0);
    expect(diagnostics(foreignId)).toHaveLength(0);
    expect(diagnostics(completedId)).toHaveLength(0);
    expect(diagnostics(legacyId)).toHaveLength(0);

    const firstDiagnostic = diagnostics(unsupportedId);
    expect(firstDiagnostic).toHaveLength(1);
    expect(firstDiagnostic[0].message).toContain('test:milestone-listener:unsupported-admission');
    expect(firstDiagnostic[0].message).toContain(areaId);
    expect(firstDiagnostic[0].details).toContain('target=stat; key=unsupported-primary; comparator=>=');
    expect(diagnostics(supportedId)).toHaveLength(0);

    expect(game.inits.travelToArea(unvisitedAreaId).success).toBe(true);
    expect(diagnostics(unsupportedId)).toHaveLength(1);
    expect(diagnostics(unvisitedId)).toHaveLength(1);
    game.mutations.changeResource(CREDIT, 1);
    expect(game.state.milestoneProgress?.completed).toContain(completedId);
    expect(game.state.milestoneProgress?.completed).not.toContain(unsupportedId);
    expect(diagnostics(supportedId)).toHaveLength(0);

    const updatedCompletedCondition = { target: 'stat' as const, key: 'updated-completed-leaf', comparator: '==' as const, value: 2 };
    game.registry.load(pack(
      [{ id: completedId, condition: updatedCompletedCondition }],
      [{ id: 'test:milestone-listener:unsupported-completed', milestoneId: completedId, areaId: areaId, then: [] }],
    ));
    expect(game.inits.travelToArea(areaId).success).toBe(true);
    expect(game.state.milestoneProgress?.completed).toContain(completedId);
    expect(diagnostics(completedId)).toHaveLength(0);

    expect(diagnostics(unvisitedId)).toHaveLength(1);
    expect(diagnostics(foreignId)).toHaveLength(0);
    expect(diagnostics(legacyId)).toHaveLength(0);
    expect(game.inits.travelToArea(unvisitedAreaId).success).toBe(true);
    expect(diagnostics(unvisitedId)).toHaveLength(1);

    const updatedCondition = { target: 'stat' as const, key: 'updated-invalid-leaf', comparator: '==' as const, value: 2 };
    game.registry.load(pack(
      [{ id: unsupportedId, condition: updatedCondition }],
      [{ id: 'test:milestone-listener:unsupported-admission', milestoneId: unsupportedId, areaId: areaId, then: [] }],
    ));
    expect(game.inits.travelToArea(areaId).success).toBe(true);
    expect(diagnostics(unsupportedId)).toHaveLength(2);
    expect(diagnostics(unsupportedId)[0].details).toContain('key=updated-invalid-leaf; comparator===');
  });
});
