import { describe, expect, it } from 'vitest';
import { parsePackFromZipBuffer } from '../../../src/data-services/datapack/pack-parser';
import { EditorModel } from '../model/editor-model';
import { getTable } from '../schema/datapack.schema';
import type { TableKey } from '../schema/types';
import { collectRefOptions, resolveRef } from '../ui/navi';
import { createDatapackPackage } from '../ui/io';
import { validateDatapack, type ValidationIssue } from './index';

const manifest = {
  modName: 'scene-authoring',
  name: 'PB24 Scene authoring fixture',
  version: '1.0.0',
  author: 'Test',
  dependencies: ['base'],
};

const OPERATION_TABLES = new Set<TableKey>([
  'operationEvents',
  'operationLocations',
  'operationActions',
  'studentOperationProfiles',
  'operationStrategyProfiles',
  'operationCardPools',
]);

function makePack(): Record<string, unknown> {
  const action = (id: string, title: string, actorKinds: string[]) => ({
    id,
    title,
    allowedParticipantKinds: actorKinds,
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: 'progress', amount: 1 }],
  });
  return {
    modName: manifest.modName,
    name: manifest.name,
    version: manifest.version,
    inits: [{ id: 'base:init:scene-test', name: 'Scene Test', description: '', defaultAreas: [] }],
    areas: [],
    spots: [],
    // The profile's identity reference is resolved by the editor Schema; other Character
    // fields are outside this Operation-authoring fixture's validation scope.
    characters: [{ id: 'arona' }],
    operationEvents: [{
      id: 'sceneauthoring:event:demo',
      title: 'Authoring Demo',
      description: 'Two scenes with exact M/N, purchase and route references.',
      initId: 'base:init:scene-test',
      resumeVersion: 1,
      locationIds: ['sceneauthoring:location:choose', 'sceneauthoring:location:exit'],
      initialLocationId: 'sceneauthoring:location:choose',
      maxLocationVisits: 3,
      tracks: [{ id: 'progress', initial: 0, min: 0, max: 3 }],
      factIds: ['water-purchased'],
      knownFactIds: [],
      itemIds: ['route-key'],
      cardPoolIds: ['sceneauthoring:pool:demo'],
      heldItemIds: [],
      actors: [{ id: 'student-a', type: 'student', hp: { initial: 5, min: 0, max: 5 } }],
      participants: [{ actorId: 'student-a', kind: 'student', profileId: 'sceneauthoring:studentprofile:demo' }],
      playerRouteState: { playerCost: 10 },
    }],
    operationLocations: [
      {
        id: 'sceneauthoring:location:choose',
        stage: 'scene',
        enabledActionIds: ['sceneauthoring:action:inspect'],
        combinationRules: [],
        scenes: [{
          id: 'choose-and-buy',
          title: 'Choose and buy',
          description: 'Pick one of two actions and optionally purchase supplies.',
          enabledActionIds: ['sceneauthoring:action:inspect'],
          actionMode: 'global',
          sceneActionBatches: 1,
          sceneActions: [
            { id: 'inspect-a', actionId: 'sceneauthoring:action:inspect', scope: 'global', playerCost: 1 },
            { id: 'inspect-b', actionId: 'sceneauthoring:action:assist', scope: 'global', playerCost: 1 },
          ],
          sceneActionChoice: { candidateSceneActionIds: ['inspect-a', 'inspect-b'], chooseExactly: 1 },
          purchaseOffers: [{
            id: 'water-offer',
            actionId: 'sceneauthoring:action:buy-water',
            playerCost: 2,
            purchaseFactId: 'water-purchased',
            title: 'Buy water',
          }],
          completion: { kind: 'track', trackId: 'progress', operator: 'gte', value: 1 },
        }],
        routeEdges: [{
          id: 'continue',
          targetLocationId: 'sceneauthoring:location:exit',
          label: 'Continue',
          description: 'Continue to the final scene.',
          requiredHeldItemId: 'route-key',
        }],
      },
      {
        id: 'sceneauthoring:location:exit',
        stage: 'scene',
        enabledActionIds: [],
        combinationRules: [],
        routeEdges: [],
      },
    ],
    operationActions: [
      action('sceneauthoring:action:inspect', 'Inspect', ['student']),
      action('sceneauthoring:action:assist', 'Assist', ['student']),
      action('sceneauthoring:action:buy-water', 'Buy water', []),
    ],
    studentOperationProfiles: [{
      id: 'sceneauthoring:studentprofile:demo',
      characterId: 'arona',
      candidateActionIds: ['sceneauthoring:action:inspect'],
      actionPriorityIds: ['sceneauthoring:action:inspect'],
      capabilityIds: [],
      reasonIds: [],
      strategyProfileId: 'sceneauthoring:strategy:steady',
      cardPoolIds: ['sceneauthoring:pool:demo'],
    }],
    operationStrategyProfiles: [{
      id: 'sceneauthoring:strategy:steady',
      biases: [{ tagId: 'steady', biasBps: 100 }],
    }],
    operationCardPools: [{
      id: 'sceneauthoring:pool:demo',
      entries: [{ actionId: 'sceneauthoring:action:inspect', weight: 1 }],
    }],
  };
}

function operationErrors(data: Record<string, unknown>): ValidationIssue[] {
  return validateDatapack(data).filter((issue) => issue.severity === 'error' && OPERATION_TABLES.has(issue.table));
}

describe('PB25 Operation authoring contract', () => {
  it('all six Operation tables are explicit editor tables with generated contracts', () => {
    expect([...OPERATION_TABLES].every((key) => getTable(key).idField === 'id')).toBe(true);
  });

  it('real PB24 Scene fixture supports nested CRUD while preserving all table data', () => {
    const original = makePack();
    const model = new EditorModel();
    model.loadDatapack(original);
    model.setValue('operationLocations', 0, ['scenes', 0, 'title'], 'Revised scene title');
    model.setValue('operationLocations', 0, ['scenes', 0, 'sceneActionChoice', 'chooseExactly'], 2);

    const copyIndex = model.duplicateRow('operationActions', 0);
    expect(model.rowsOf('operationActions')).toHaveLength(4);
    model.removeRow('operationActions', copyIndex);
    expect(model.rowsOf('operationActions')).toHaveLength(3);

    const expected = structuredClone(original);
    const locations = expected.operationLocations as Array<Record<string, unknown>>;
    const scenes = locations[0].scenes as Array<Record<string, unknown>>;
    scenes[0].title = 'Revised scene title';
    (scenes[0].sceneActionChoice as Record<string, unknown>).chooseExactly = 2;
    expect(model.toDatapack()).toEqual(expected);
    expect(operationErrors(model.toDatapack())).toEqual([]);
  });

  it('routes Operation action references through editor navigation', () => {
    const model = new EditorModel();
    model.loadDatapack(makePack());
    expect(collectRefOptions(model, 'operationActions').map((option) => option.id)).toEqual([
      'sceneauthoring:action:inspect',
      'sceneauthoring:action:assist',
      'sceneauthoring:action:buy-water',
    ]);
    expect(resolveRef(model, 'operationActions', 'sceneauthoring:action:assist')).toEqual({
      table: 'operationActions', rowIndex: 1,
    });
    expect(collectRefOptions(model, 'operationLocations').map((option) => option.id)).toEqual([
      'sceneauthoring:location:choose',
      'sceneauthoring:location:exit',
    ]);
    expect(resolveRef(model, 'operationLocations', 'sceneauthoring:location:exit')).toEqual({
      table: 'operationLocations', rowIndex: 1,
    });
  });

  it('reports missing nested Action, SceneAction, Route and Event Fact IDs at source paths', () => {
    const invalid = structuredClone(makePack());
    const locations = invalid.operationLocations as Array<Record<string, unknown>>;
    const scenes = locations[0].scenes as Array<Record<string, unknown>>;
    const scene = scenes[0];
    const sceneActions = scene.sceneActions as Array<Record<string, unknown>>;
    sceneActions[0].actionId = 'sceneauthoring:action:missing';
    const choice = scene.sceneActionChoice as Record<string, unknown>;
    choice.candidateSceneActionIds = ['inspect-a', 'missing-choice'];
    choice.chooseExactly = 3;
    const offers = scene.purchaseOffers as Array<Record<string, unknown>>;
    offers[0].purchaseFactId = 'missing-fact';
    const routes = locations[0].routeEdges as Array<Record<string, unknown>>;
    routes[0].targetLocationId = 'sceneauthoring:location:missing';

    const issues = operationErrors(invalid);
    const has = (path: string, id: string) => issues.some((issue) =>
      issue.table === 'operationLocations' && issue.rowIndex === 0 && issue.path === path && issue.message.includes(id));
    expect(has('scenes[0].sceneActions[0].actionId', 'sceneauthoring:action:missing')).toBe(true);
    expect(has('operationLocations[0].scenes[0].sceneActionChoice.candidateSceneActionIds[1]', 'missing-choice')).toBe(true);
    expect(has('operationLocations[0].scenes[0].sceneActionChoice.chooseExactly', '候选数量')).toBe(true);
    expect(has('operationLocations[0].scenes[0].purchaseOffers[0].purchaseFactId', 'missing-fact')).toBe(true);
    expect(has('routeEdges[0].targetLocationId', 'sceneauthoring:location:missing')).toBe(true);
    expect(has('operationLocations[0].routeEdges[0].targetLocationId', 'sceneauthoring:location:missing')).toBe(true);
  });

  it('rejects a route to an existing Location outside the Event location set', () => {
    const invalid = structuredClone(makePack());
    const locations = invalid.operationLocations as Array<Record<string, unknown>>;
    locations.push({
      id: 'sceneauthoring:location:foreign',
      stage: 'scene',
      enabledActionIds: [],
      combinationRules: [],
      routeEdges: [],
    });
    const routes = locations[0].routeEdges as Array<Record<string, unknown>>;
    routes[0].targetLocationId = 'sceneauthoring:location:foreign';
    const issues = operationErrors(invalid);
    expect(issues.some((issue) =>
      issue.table === 'operationLocations'
      && issue.path === 'operationLocations[0].routeEdges[0].targetLocationId'
      && issue.message.includes('sceneauthoring:location:foreign'),
    )).toBe(true);
  });

  it('exports, imports, edits and re-exports the actual PB24 Scene payload through PackParser', async () => {
    const firstBytes = await createDatapackPackage(makePack(), manifest);
    const first = await parsePackFromZipBuffer(firstBytes);
    const editor = new EditorModel();
    editor.loadDatapack(first.datapack as unknown as Record<string, unknown>, first.manifest);
    editor.setValue('operationLocations', 0, ['scenes', 0, 'sceneActions', 0, 'title'], 'Edited through Editor');
    const secondBytes = await createDatapackPackage(editor.toDatapack(), editor.getPackageMetadata());
    const second = await parsePackFromZipBuffer(secondBytes);

    const firstLocations = first.datapack.operationLocations as unknown as Array<Record<string, unknown>>;
    const secondLocations = second.datapack.operationLocations as unknown as Array<Record<string, unknown>>;
    expect(second.manifest).toMatchObject(manifest);
    expect(second.datapack.operationEvents).toEqual(first.datapack.operationEvents);
    expect(second.datapack.operationActions).toEqual(first.datapack.operationActions);
    expect(second.datapack.studentOperationProfiles).toEqual(first.datapack.studentOperationProfiles);
    expect(second.datapack.operationStrategyProfiles).toEqual(first.datapack.operationStrategyProfiles);
    expect(second.datapack.operationCardPools).toEqual(first.datapack.operationCardPools);
    const roundTrippedScene = (secondLocations[0].scenes as Array<Record<string, unknown>>)[0];
    expect(roundTrippedScene.id).toBe('choose-and-buy');
    expect(roundTrippedScene.sceneActionChoice).toEqual({ candidateSceneActionIds: ['inspect-a', 'inspect-b'], chooseExactly: 1 });
    expect(roundTrippedScene.purchaseOffers).toEqual([{
      id: 'water-offer', actionId: 'sceneauthoring:action:buy-water', playerCost: 2,
      purchaseFactId: 'water-purchased', title: 'Buy water',
    }]);
    expect((roundTrippedScene.sceneActions as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: 'inspect-a', title: 'Edited through Editor',
    });
    expect(firstLocations[0].scenes).not.toEqual(secondLocations[0].scenes);
  });
});
