import { afterEach, describe, expect, test } from 'vitest';
import { EditorModel } from '../../tools/datapack-editor/model/editor-model';
import { createDatapackPackage } from '../../tools/datapack-editor/ui/io';
import { defaultDatapack } from '../../src/arona-clicker/content/default-datapack';
import { AronaClickerRuntime } from '../../src/arona-clicker/runtime';
import { Character } from '../../src/arona-clicker/types/ids';
import { parsePackFromZipBuffer } from '../../src/data-services/datapack/pack-parser';

const manifest = {
  modName: 'scene-authoring',
  name: '场景作者样例',
  version: '1.0.0',
  dependencies: ['base'],
};

const action = (id: string, title: string) => ({
  id,
  title,
  allowedParticipantKinds: ['student'],
  requiredCapabilityIds: [],
  reasonIds: [],
  tagIds: [],
  target: { kind: 'none' },
  effects: [{ kind: 'eventTrackDelta', trackId: 'readiness', amount: 1 }],
});

const actor = (id: string, displayName: string) => ({
  id,
  type: 'student',
  displayName,
  hp: { initial: 4, min: 0, max: 4 },
});

function authoringDatapack() {
  const hoshinoProfileId = 'scene-authoring:student-operation-profile:hoshino';
  const serikaProfileId = 'scene-authoring:student-operation-profile:serika';
  const actionIds = [
    'scene-authoring:operation-action:inspect',
    'scene-authoring:operation-action:secure',
    'scene-authoring:operation-action:record',
  ];
  const sceneActionIds = [
    'inspect',
    'secure',
    'record',
  ];
  const locationId = 'scene-authoring:operation-location:worksite';
  const exitLocationId = 'scene-authoring:operation-location:exit';
  const hoshinoActorId = 'scene-authoring:operation-actor:hoshino';
  const serikaActorId = 'scene-authoring:operation-actor:serika';
  return {
    modName: manifest.modName,
    name: manifest.name,
    version: manifest.version,
    operationEvents: [{
      id: 'scene-authoring:operation-event:sample',
      title: '现场协作作者样例',
      description: '两名学生从三个行动方案中选择两项，随后完成复核。',
      initId: 'base:init:schale_office',
      resumeVersion: 1,
      locationIds: [locationId, exitLocationId],
      initialLocationId: locationId,
      maxLocationVisits: 2,
      tracks: [{ id: 'readiness', initial: 0, min: 0, max: 3 }],
      objectives: [{
        id: 'finish-worksite', description: 'The authored worksite plan is complete.', kind: 'primary',
        predicate: { kind: 'track', trackId: 'readiness', operator: 'gte', value: 3 },
      }],
      factIds: [],
      knownFactIds: [],
      itemIds: [],
      heldItemIds: [],
      actors: [actor(hoshinoActorId, '小鸟游星野'), actor(serikaActorId, '黑见芹香')],
      participants: [
        { actorId: hoshinoActorId, kind: 'student', profileId: hoshinoProfileId },
        { actorId: serikaActorId, kind: 'student', profileId: serikaProfileId },
      ],
      playerRouteState: { playerCost: 0 },
    }],
    operationLocations: [{
      id: locationId,
      stage: 'scene',
      enabledActionIds: [],
      combinationRules: [],
      scenes: [{
        id: 'choose-plan',
        title: '选择现场方案',
        description: '从三个行动方案中恰好选择两项。',
        actionMode: 'global',
        sceneActionBatches: 1,
        sceneActions: actionIds.map((actionId, index) => ({
          id: sceneActionIds[index],
          actionId,
          scope: 'global',
          playerCost: 0,
          performerPolicy: 'none',
          selectionPolicy: 'required',
        })),
        sceneActionChoice: { candidateSceneActionIds: sceneActionIds, chooseExactly: 2 },
        completion: { kind: 'track', trackId: 'readiness', operator: 'gte', value: 2 },
      }, {
        id: 'review-work',
        title: '复核现场工作',
        description: '完成最后一项现场复核。',
        actionMode: 'global',
        sceneActionBatches: 1,
        sceneActions: [{
          id: 'final-review',
          actionId: actionIds[2],
          scope: 'global',
          playerCost: 0,
          performerPolicy: 'none',
          selectionPolicy: 'required',
          title: '完成现场复核',
        }],
        completion: { kind: 'track', trackId: 'readiness', operator: 'gte', value: 3 },
      }],
      objectives: [{
        id: 'worksite-ready',
        description: '方案和复核均已完成。',
        kind: 'primary',
        predicate: { kind: 'track', trackId: 'readiness', operator: 'gte', value: 3 },
      }],
      routeEdges: [{
        id: 'leave-worksite',
        targetLocationId: exitLocationId,
        label: '离开现场',
        description: '方案和复核均已完成。',
      }],
    }, {
      id: exitLocationId,
      stage: 'scene',
      enabledActionIds: [],
      combinationRules: [],
      objectives: [{
        id: 'leave-worksite-ready', description: 'The worksite is ready to leave.', kind: 'primary',
        predicate: { kind: 'track', trackId: 'readiness', operator: 'gte', value: 3 },
      }],
      routeEdges: [],
    }],
    operationActions: [
      action(actionIds[0], '检查设备'),
      action(actionIds[1], '加固外围'),
      action(actionIds[2], '记录库存'),
    ],
    studentOperationProfiles: [
      {
        id: hoshinoProfileId,
        characterId: Character.Hoshino,
        candidateActionIds: actionIds,
        actionPriorityIds: actionIds,
        capabilityIds: [],
        reasonIds: [],
      },
      {
        id: serikaProfileId,
        characterId: Character.Serika,
        candidateActionIds: actionIds,
        actionPriorityIds: actionIds,
        capabilityIds: [],
        reasonIds: [],
      },
    ],
    operationStrategyProfiles: [],
    operationCardPools: [],
  };
}

describe('Gameplay B Editor package to Runtime authoring workflow', () => {
  const runtimes: AronaClickerRuntime[] = [];

  afterEach(() => {
    for (const runtime of runtimes.splice(0)) if (runtime.running) runtime.stop();
  });

  test('Editor-edited Scene fields survive PackParser, apply/reload and launch as a generic Event', async () => {
    const editor = new EditorModel();
    editor.loadDatapack(authoringDatapack(), manifest);
    editor.setValue('operationLocations', 0, ['scenes', 1, 'sceneActions', 0, 'title'], '完成作者编辑后的现场复核');

    const archive = await createDatapackPackage(editor.toDatapack(), editor.getPackageMetadata());
    const parsed = await parsePackFromZipBuffer(archive);
    expect(parsed.manifest.dependencies).toEqual(['base']);
    expect(parsed.datapack.operationLocations?.[0]?.scenes?.[1]?.sceneActions?.[0]?.title)
      .toBe('完成作者编辑后的现场复核');

    const runtime = new AronaClickerRuntime();
    runtimes.push(runtime);
    runtime.init([defaultDatapack], { enterDefaultInit: true });
    runtime.registerParsedPack(parsed);
    const recordId = `${manifest.modName}@${manifest.version}`;
    const initial = runtime.getPackConfiguration();
    const configuration = {
      ...initial,
      enabledIds: [...new Set([...initial.enabledIds, recordId])],
      order: initial.order.includes(recordId) ? initial.order : [...initial.order, recordId],
    };

    expect(runtime.validatePackConfiguration(configuration)).toEqual({ ok: true, errors: [], warnings: [] });
    const applied = runtime.applyPackConfiguration(configuration);
    expect(applied.ok, applied.message).toBe(true);
    expect(runtime.registry.operationActions.get('scene-authoring:operation-action:inspect')?.title).toBe('检查设备');
    expect(runtime.registry.operationLocations.get('scene-authoring:operation-location:worksite')?.scenes?.[1]?.sceneActions?.[0]?.title)
      .toBe('完成作者编辑后的现场复核');

    runtime.mutations.acquireCharacter('Hoshino', 'story');
    runtime.mutations.acquireCharacter('Serika', 'story');
    const started = runtime.operationEntry.start('scene-authoring:operation-event:sample', [Character.Hoshino, Character.Serika]);
    const runId = started.runId;
    const run = runtime.operationEntry.getView(runId)!;
    expect(run.currentSceneActionChoice).toEqual({
      candidateSceneActionIds: [
        'inspect',
        'secure',
        'record',
      ],
      chooseExactly: 2,
    });
    expect(run.actorStates.filter(actorState => actorState.participantKind === 'student')).toHaveLength(2);

    const chosen = [
      'inspect',
      'secure',
    ];
    runtime.operationEntry.commitSceneActionBatch({
      runId,
      planVersion: run.planVersion,
      selections: chosen.map(sceneActionId => ({ sceneActionId, targetActorIds: [] })),
      cards: [],
      purchases: [],
    });
    const review = runtime.operationEntry.getView(runId)!;
    expect(review.currentSceneId).toBe('review-work');
    expect(review.currentSceneActions[0]?.title).toBe('完成作者编辑后的现场复核');
    runtime.operationEntry.commitSceneActionBatch({
      runId: review.runId,
      planVersion: review.planVersion,
      selections: [{ sceneActionId: 'final-review', targetActorIds: [] }],
      cards: [],
      purchases: [],
    });
    const finishedLocation = runtime.operationEntry.getView(runId)!;
    expect(finishedLocation).toMatchObject({
      locationProgress: { 'scene-authoring:operation-location:worksite': { completed: true, completedSceneIds: ['choose-plan', 'review-work'] } },
    });
    expect(finishedLocation.currentLocationId).toBe('scene-authoring:operation-location:exit');
    expect(finishedLocation.routeHistory).toEqual([
      expect.objectContaining({ routeId: 'leave-worksite', fromLocationId: 'scene-authoring:operation-location:worksite' }),
    ]);
  });
});
