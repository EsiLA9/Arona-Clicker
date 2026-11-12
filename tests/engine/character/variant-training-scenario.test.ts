import { describe, expect, test } from 'vitest';
import type { MapRunSaveSnapshot } from '../../../src/arona-clicker/contracts/map/map-run';
import { VariantTranslationService } from '../../../src/arona-clicker/services/character/variant-translation-service';
import { MapRunService } from '../../../src/arona-clicker/services/map/map-run-service';
import {
  VARIANT_TRAINING_SCENARIO_MAP_ID,
  VARIANT_TRAINING_SCENARIO_TEMPLATE_VERSION,
} from '../../../src/arona-clicker/content/gameplay-b/variant-training-scenario';
import {
  createVariantTrainingScenarioSaveSnapshot,
  prepareVariantTrainingScenario,
  restoreVariantTrainingScenario,
} from '../../../src/arona-clicker/services/character/variant-training-scenario';
import { variantTrainingContent } from '../../../src/arona-clicker/content/gameplay-b/variant-training-content';
import { createDefaultState } from '../../../src/arona-clicker/state/state-factory';
import type { PlayerState } from '../../../src/arona-clicker/types/state';
import { canonical } from '../../../src/arona-clicker/services/character/variant-translation-rules';

const ACTIVE_INIT = 'test:init:scenario';
const PARTY = [{ characterId: 'hoshino', variantId: 'Hoshino' }];

function makeHarness(owned = true) {
  const state = createDefaultState();
  state.activeInit = ACTIVE_INIT;
  state.roster = owned ? {
    Hoshino: {
      variantId: 'Hoshino', acquiredVia: 'gacha', acquiredCount: 1,
      level: 1, exp: 0, stars: 0, affectionLevel: 1, affectionExp: 0,
      colorEquipment: null,
    },
  } as PlayerState['roster'] : {} as PlayerState['roster'];
  const translation = new VariantTranslationService({
    content: variantTrainingContent,
    getState: () => state,
    getVariant: id => id === 'Hoshino' ? { id, proto: 'hoshino' } : undefined,
  });
  return { state, translation };
}

function prepare(harness = makeHarness()) {
  return prepareVariantTrainingScenario({ activeInit: ACTIVE_INIT, translation: harness.translation });
}

function startAndSave(binding: any, definition: any): MapRunSaveSnapshot {
  const owner = new MapRunService(
    { resolve: id => id === definition.id ? definition : null },
    id => id === 'Hoshino' ? 'hoshino' : undefined,
  );
  const start = owner.start(definition.id, PARTY);
  const run = owner.move(start.runId, 'battle-owned');
  expect(run.activeEncounter?.nodeId).toBe('battle-owned');
  return createVariantTrainingScenarioSaveSnapshot(binding, owner.createSaveSnapshot()!);
}

describe('trusted Variant training scenario', () => {
  test('previews and confirms all sources in fixed order, then builds three independent battles', () => {
    const { translation } = makeHarness();
    const calls: string[] = [];
    const port = {
      preview(request: Parameters<typeof translation.preview>[0]) {
        calls.push(`preview:${request.members[0].source.kind === 'owned' ? 'owned'
          : request.members[0].source.slice.id.endsWith('normal') ? 'normal' : 'enhanced'}`);
        return translation.preview(request);
      },
      confirm(token: string) { calls.push('confirm'); return translation.confirm(token); },
      restore(value: unknown) { return translation.restore(value); },
    };
    const { binding, definition } = prepareVariantTrainingScenario({ activeInit: ACTIVE_INIT, translation: port });
    expect(calls).toEqual(['preview:owned', 'confirm', 'preview:normal', 'confirm', 'preview:enhanced', 'confirm']);
    expect(VARIANT_TRAINING_SCENARIO_MAP_ID).toBe('gameplay-b:map:variant-training-scenario');
    expect(VARIANT_TRAINING_SCENARIO_TEMPLATE_VERSION).toBe(1);
    expect(definition).toMatchObject({
      id: VARIANT_TRAINING_SCENARIO_MAP_ID, resumeVersion: VARIANT_TRAINING_SCENARIO_TEMPLATE_VERSION,
      startNodeId: 'entry', exitNodeIds: ['exit'], partyCharacterIds: ['hoshino'], executionContractId: 'AG-1',
    });
    expect(binding.stages.map(stage => stage.source)).toEqual(['owned', 'normal', 'enhanced']);
    expect(definition.nodes.map(node => node.id)).toEqual([
      'entry', 'battle-owned', 'battle-normal', 'battle-enhanced', 'exit',
    ]);

    const battleNodes = definition.nodes.filter(node => node.id.startsWith('battle-'));
    expect(battleNodes.map(node => node.partySetup?.initialPartyHp[0])).toEqual([
      { characterId: 'hoshino', initialHp: 10, maxHp: 10 },
      { characterId: 'hoshino', initialHp: 10, maxHp: 10 },
      { characterId: 'hoshino', initialHp: 16, maxHp: 16 },
    ]);
    expect(battleNodes.map(node => node.partySetup?.partyAgility[0].agility)).toEqual([2, 2, 6]);
    expect(battleNodes[0].encounter?.enemies).toEqual(battleNodes[1].encounter?.enemies);
    expect(battleNodes[1].encounter?.enemies).toEqual(battleNodes[2].encounter?.enemies);
    const quick = definition.actions?.find(action => action.id === 'training-quick-strike');
    const heavy = definition.actions?.find(action => action.id === 'training-heavy-strike');
    expect(quick?.agility).not.toEqual(heavy?.agility);
    expect(quick?.effectProgram?.resolve).not.toEqual(heavy?.effectProgram?.resolve);
    expect(battleNodes.every(node => node.encounter?.participants?.[0].actions.map(action => action.actionId)
      .includes('training-heavy-strike'))).toBe(true);

    const owner = new MapRunService({ resolve: id => id === definition.id ? definition : null }, () => 'hoshino');
    const start = owner.start(definition.id, PARTY);
    const battle = owner.move(start.runId, 'battle-owned');
    expect(battle.activeEncounter?.hands[0].actionIds).toEqual(expect.arrayContaining([
      'training-quick-strike', 'training-heavy-strike',
    ]));
  });

  test('refuses to start fresh when the owned Hoshino source cannot be confirmed', () => {
    const harness = makeHarness(false);
    expect(() => prepare(harness)).toThrow(/owned|持有|translation/i);
  });

  test('restores the same fixed three builds and rejects order, source, version, Init, and run splices', () => {
    const harness = makeHarness();
    const { translation } = harness;
    const prepared = prepare(harness);
    const save = startAndSave(prepared.binding, prepared.definition) as any;
    const restored = restoreVariantTrainingScenario(save.scenario, save, translation, ACTIVE_INIT);
    expect(restored.definition).toEqual(prepared.definition);
    expect(restored.binding.stages.map((stage: any) => stage.source)).toEqual(['owned', 'normal', 'enhanced']);
    expect(restored.binding).not.toHaveProperty('run');

    const changedProgress = JSON.parse(JSON.stringify(save));
    delete changedProgress.scenario;
    changedProgress.run.partyHp[0].currentHp -= 1;
    const resaved = createVariantTrainingScenarioSaveSnapshot(restored.binding, changedProgress);
    expect(resaved.scenario?.run?.consistency).not.toBe(save.scenario.run.consistency);
    expect(restoreVariantTrainingScenario(resaved.scenario, resaved, translation, ACTIVE_INIT).binding.stages)
      .toEqual(restored.binding.stages);

    const tamper = (mutate: (copy: any) => void) => {
      const copy = JSON.parse(JSON.stringify(save));
      mutate(copy.scenario);
      // Recompute the consistency field so semantic validation must reject the changed contract itself.
      const core = { ...copy.scenario };
      delete core.run;
      const mapRun = { ...copy };
      delete mapRun.scenario;
      copy.scenario.run.consistency = canonical({ binding: core, mapRun });
      return copy;
    };
    const reordered = tamper(copy => { [copy.stages[0], copy.stages[1]] = [copy.stages[1], copy.stages[0]]; });
    expect(() => restoreVariantTrainingScenario(reordered.scenario, reordered, translation, ACTIVE_INIT)).toThrow();
    const wrongSource = tamper(copy => { copy.stages[0].source = 'normal'; });
    expect(() => restoreVariantTrainingScenario(wrongSource.scenario, wrongSource, translation, ACTIVE_INIT)).toThrow();
    const crossSource = tamper(copy => { copy.stages[1].translation = copy.stages[2].translation; });
    expect(() => restoreVariantTrainingScenario(crossSource.scenario, crossSource, translation, ACTIVE_INIT)).toThrow();
    const futureTemplate = tamper(copy => { copy.templateVersion = 2; });
    expect(() => restoreVariantTrainingScenario(futureTemplate.scenario, futureTemplate, translation, ACTIVE_INIT)).toThrow();
    expect(() => restoreVariantTrainingScenario(save.scenario, save, translation, 'test:init:other')).toThrow();
    const otherRun = JSON.parse(JSON.stringify(save));
    otherRun.run.runId = 'map-run-other';
    expect(() => restoreVariantTrainingScenario(otherRun.scenario, otherRun, translation, ACTIVE_INIT)).toThrow();
  });

  test('restores, commits, saves again, and restarts with the same frozen three builds', () => {
    const harness = makeHarness();
    const prepared = prepare(harness);
    const resolver = { resolve: (id: string) => id === prepared.definition.id ? prepared.definition : null };
    const firstOwner = new MapRunService(resolver, () => 'hoshino');
    const started = firstOwner.start(prepared.definition.id, PARTY);
    firstOwner.move(started.runId, 'battle-owned');
    const firstSave = createVariantTrainingScenarioSaveSnapshot(prepared.binding, firstOwner.createSaveSnapshot()!);

    const firstRestored = restoreVariantTrainingScenario(firstSave.scenario, firstSave, harness.translation, ACTIVE_INIT);
    const loadedOwner = new MapRunService({ resolve: id => id === firstRestored.definition.id ? firstRestored.definition : null }, () => 'hoshino');
    expect(loadedOwner.restoreSaveSnapshot(firstSave).status).toBe('restored');
    const loaded = loadedOwner.getSnapshot()!;
    const committed = loadedOwner.commitEncounterRound({
      runId: loaded.runId,
      requestId: 'scenario-load-commit-1',
      expectedCommitVersion: loaded.commitVersion,
      draft: {
        nodeId: loaded.activeEncounter!.nodeId,
        round: loaded.activeEncounter!.round,
        draftVersion: loaded.activeEncounter!.draftVersion,
      },
    });
    expect(committed.commitVersion).toBe(1);
    expect(committed.activeEncounter?.round).toBe(2);

    const secondSave = createVariantTrainingScenarioSaveSnapshot(firstRestored.binding, loadedOwner.createSaveSnapshot()!);
    expect(secondSave.scenario?.run?.consistency).not.toBe(firstSave.scenario?.run?.consistency);
    const secondRestored = restoreVariantTrainingScenario(secondSave.scenario, secondSave, harness.translation, ACTIVE_INIT);
    const secondOwner = new MapRunService({ resolve: id => id === secondRestored.definition.id ? secondRestored.definition : null }, () => 'hoshino');
    expect(secondOwner.restoreSaveSnapshot(secondSave).status).toBe('restored');
    expect(secondOwner.getSnapshot()?.activeEncounter).toEqual(committed.activeEncounter);

    const restarted = secondOwner.restart(secondOwner.getSnapshot()!.runId);
    const atFirstBattle = secondOwner.move(restarted.runId, 'battle-owned');
    expect(atFirstBattle.partyHp).toEqual([{ characterId: 'hoshino', currentHp: 10 }]);
    const restartedSave = createVariantTrainingScenarioSaveSnapshot(secondRestored.binding, secondOwner.createSaveSnapshot()!);
    const restartedScenario = restoreVariantTrainingScenario(
      restartedSave.scenario, restartedSave, harness.translation, ACTIVE_INIT,
    );
    expect(restartedScenario.binding.stages).toEqual(prepared.binding.stages);
    const restartedOwner = new MapRunService(
      { resolve: id => id === restartedScenario.definition.id ? restartedScenario.definition : null },
      () => 'hoshino',
    );
    expect(restartedOwner.restoreSaveSnapshot(restartedSave).status).toBe('restored');
  });

  test('rejects unknown JSON fields and non-JSON accessor input before producing a definition', () => {
    const { translation } = makeHarness();
    const prepared = prepare({ ...makeHarness(), translation });
    const save = startAndSave(prepared.binding, prepared.definition) as any;
    const unknown = JSON.parse(JSON.stringify(save));
    unknown.scenario.injected = true;
    expect(() => restoreVariantTrainingScenario(unknown.scenario, unknown, translation, ACTIVE_INIT)).toThrow();
    const accessor = JSON.parse(JSON.stringify(save));
    Object.defineProperty(accessor.scenario, 'activeInit', { enumerable: true, get: () => ACTIVE_INIT });
    expect(() => restoreVariantTrainingScenario(accessor.scenario, accessor, translation, ACTIVE_INIT)).toThrow();
  });
});
