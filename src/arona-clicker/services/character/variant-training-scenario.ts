import type {
  VariantTranslationPort,
  VariantTranslationSnapshot,
} from '../../contracts/character/variant-translation';
import type {
  VariantTrainingScenarioBinding,
  VariantTrainingScenarioStageTuple,
} from '../../contracts/character/variant-training-scenario';
import type { MapRunSaveSnapshot } from '../../contracts/map/map-run';
import type { GameplayMapDef } from '../../../data-services/contracts/gameplay-map';
import {
  buildVariantTrainingScenarioMap,
  VARIANT_TRAINING_SCENARIO_MAP_ID,
  VARIANT_TRAINING_SCENARIO_NODE_IDS,
  VARIANT_TRAINING_SCENARIO_SOURCE_ORDER,
  VARIANT_TRAINING_SCENARIO_TEMPLATE_VERSION,
} from '../../content/gameplay-b/variant-training-scenario';
import { variantTrainingRequest } from '../../content/gameplay-b/variant-training-content';
import { canonical, exact, immutable } from './variant-translation-rules';

export interface VariantTrainingScenarioContext {
  readonly activeInit: string;
  readonly translation: VariantTranslationPort;
}

export interface VariantTrainingScenarioPrepared {
  readonly binding: VariantTrainingScenarioBinding;
  readonly definition: GameplayMapDef;
}

export interface VariantTrainingScenarioRestored extends VariantTrainingScenarioPrepared {}

type WireMapRun = Omit<MapRunSaveSnapshot, 'scenario'>;

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function requireActiveInit(value: unknown): asserts value is string {
  requireValue(typeof value === 'string' && value.length > 0 && value === value.trim(), 'Scenario activeInit is invalid');
}

function coreOf(binding: VariantTrainingScenarioBinding): Omit<VariantTrainingScenarioBinding, 'run'> {
  return {
    schemaVersion: binding.schemaVersion,
    templateVersion: binding.templateVersion,
    mapId: binding.mapId,
    activeInit: binding.activeInit,
    stages: binding.stages,
  };
}

function readBinding(value: unknown, requireRun: boolean): VariantTrainingScenarioBinding {
  canonical(value);
  exact(value, ['schemaVersion', 'templateVersion', 'mapId', 'activeInit', 'stages'], ['run']);
  requireValue(value.schemaVersion === 1, 'Unknown Variant training scenario binding schema');
  requireValue(value.templateVersion === VARIANT_TRAINING_SCENARIO_TEMPLATE_VERSION,
    'Unknown Variant training scenario template version');
  requireValue(value.mapId === VARIANT_TRAINING_SCENARIO_MAP_ID, 'Scenario binding references another Map');
  requireActiveInit(value.activeInit);
  requireValue(Array.isArray(value.stages) && value.stages.length === 3, 'Scenario binding must contain three stage snapshots');
  const stageRows = value.stages as unknown[];
  const stages = stageRows.map((stage, index) => {
    exact(stage, ['source', 'translation']);
    const source = VARIANT_TRAINING_SCENARIO_SOURCE_ORDER[index];
    requireValue(stage.source === source, `Scenario stages must be ordered owned → normal → enhanced (index ${index})`);
    requireValue(stage.translation && typeof stage.translation === 'object', `Scenario ${source} translation is missing`);
    return { source, translation: stage.translation as VariantTranslationSnapshot };
  }) as unknown as VariantTrainingScenarioStageTuple;
  if (requireRun || Object.prototype.hasOwnProperty.call(value, 'run')) {
    exact(value.run, ['runId', 'consistency']);
    requireValue(typeof value.run.runId === 'string' && value.run.runId.length > 0
      && value.run.runId === value.run.runId.trim(), 'Scenario runId is invalid');
    requireValue(typeof value.run.consistency === 'string' && value.run.consistency.length > 0,
      'Scenario run consistency evidence is missing');
  }
  return immutable({
    schemaVersion: 1,
    templateVersion: VARIANT_TRAINING_SCENARIO_TEMPLATE_VERSION,
    mapId: VARIANT_TRAINING_SCENARIO_MAP_ID,
    activeInit: value.activeInit,
    stages,
    ...(Object.prototype.hasOwnProperty.call(value, 'run') ? { run: value.run } : {}),
  }) as VariantTrainingScenarioBinding;
}

function wireSnapshot(value: unknown, allowScenario: boolean, fromOwner: boolean): { snapshot: WireMapRun; scenario?: unknown } {
  let wire = value;
  if (fromOwner) {
    const json = JSON.stringify(value);
    requireValue(typeof json === 'string', 'MapRun owner snapshot is not JSON serializable');
    wire = JSON.parse(json);
  }
  canonical(wire);
  exact(wire, ['mapId', 'resumeVersion', 'run'], allowScenario ? ['scenario'] : []);
  const snapshot = {
    mapId: wire.mapId,
    resumeVersion: wire.resumeVersion,
    run: wire.run,
  } as WireMapRun;
  return {
    snapshot: immutable(snapshot),
    ...(Object.prototype.hasOwnProperty.call(wire, 'scenario') ? { scenario: wire.scenario } : {}),
  };
}

function stageIndex(nodeId: string): number {
  const ids: readonly string[] = [VARIANT_TRAINING_SCENARIO_NODE_IDS.owned, VARIANT_TRAINING_SCENARIO_NODE_IDS.normal,
    VARIANT_TRAINING_SCENARIO_NODE_IDS.enhanced];
  return ids.indexOf(nodeId);
}

function validateRunAgainstBinding(snapshot: WireMapRun, binding: VariantTrainingScenarioBinding): void {
  requireValue(snapshot.mapId === VARIANT_TRAINING_SCENARIO_MAP_ID
    && snapshot.resumeVersion === VARIANT_TRAINING_SCENARIO_TEMPLATE_VERSION, 'Saved MapRun Map or resume version does not match the scenario');
  const run = snapshot.run as Record<string, any> | null;
  requireValue(run && run.mapId === snapshot.mapId && run.status === 'inProgress', 'Scenario MapRun is not an active run of its bound Map');
  requireValue(typeof run.runId === 'string' && run.runId.length > 0 && run.runId === run.runId.trim(), 'Scenario MapRun runId is invalid');
  if (binding.run) requireValue(run.runId === binding.run.runId, 'Scenario binding is attached to another MapRun');
  const index = stageIndex(run.currentNodeId);
  requireValue(index >= 0, 'Saved MapRun is not at one of the three scenario battles');
  requireValue(canonical(run.party) === canonical([{ characterId: 'hoshino', variantId: 'Hoshino' }]),
    'Scenario MapRun party does not match the fixed Hoshino slot');
  requireValue(run.activeActivity === null, 'Scenario MapRun cannot contain an unrelated active activity');
  if (run.activeEncounter !== null) {
    requireValue(run.activeEncounter?.nodeId === run.currentNodeId, 'Scenario active Encounter does not match its current battle node');
  }

  const currentStage = binding.stages[index];
  const member = currentStage.translation.members[0];
  const expectedHp = member.build.parameters.maxHp;
  const expectedAgility = member.build.parameters.baseAgility;
  requireValue(Array.isArray(run.partyHp) && run.partyHp.length === 1
    && run.partyHp[0].characterId === 'hoshino'
    && Number.isSafeInteger(run.partyHp[0].currentHp) && run.partyHp[0].currentHp >= 1
    && run.partyHp[0].currentHp <= expectedHp, 'Scenario MapRun HP does not match its current source stage');
  requireValue(canonical(run.partyAgility) === canonical([{ characterId: 'hoshino', agility: expectedAgility }]),
    'Scenario MapRun agility does not match its current source stage');
  requireValue(run.playerCost === 0 && Array.isArray(run.actorResources) && run.actorResources.length === 0
    && Array.isArray(run.teamResources) && run.teamResources.length === 0
    && (!Array.isArray(run.mapRunStatuses) || run.mapRunStatuses.length === 0),
  'Scenario MapRun contains resources or statuses outside its fixed stage setup');

  const stageIds = [VARIANT_TRAINING_SCENARIO_NODE_IDS.owned, VARIANT_TRAINING_SCENARIO_NODE_IDS.normal,
    VARIANT_TRAINING_SCENARIO_NODE_IDS.enhanced];
  const expectedVisited = [VARIANT_TRAINING_SCENARIO_NODE_IDS.entry, ...stageIds.slice(0, index + 1)];
  requireValue(canonical(run.visitedNodeIds) === canonical(expectedVisited), 'Scenario MapRun route has skipped, reordered, or future battle nodes');
  const completed = run.completedEncounterNodeIds;
  const expectedCompleted = [...stageIds.slice(0, index)];
  if (run.activeEncounter === null) {
    expectedCompleted.push(run.currentNodeId);
  }
  requireValue(canonical(completed) === canonical(expectedCompleted), 'Scenario MapRun completion order is invalid');
  requireValue(Array.isArray(run.completedActivityIds) && run.completedActivityIds.length === 0,
    'Scenario MapRun contains unexpected activity progress');
}

/** Fresh entry always consumes three one-shot preview/confirm pairs in the fixed source order. */
export function prepareVariantTrainingScenario(context: VariantTrainingScenarioContext): VariantTrainingScenarioPrepared {
  requireActiveInit(context.activeInit);
  const snapshots: VariantTranslationSnapshot[] = [];
  for (const source of VARIANT_TRAINING_SCENARIO_SOURCE_ORDER) {
    const preview = context.translation.preview(variantTrainingRequest(source));
    if (preview.status !== 'ready') throw new Error(preview.issues[0]?.message ?? `Could not preview ${source} training build`);
    const confirmed = context.translation.confirm(preview.token);
    if (confirmed.status !== 'confirmed') throw new Error(confirmed.issues[0]?.message ?? `Could not confirm ${source} training build`);
    requireValue(confirmed.snapshot.activeInit === context.activeInit, 'Scenario translation belongs to another active Init');
    snapshots.push(confirmed.snapshot);
  }
  const stages = [
    { source: 'owned', translation: snapshots[0] },
    { source: 'normal', translation: snapshots[1] },
    { source: 'enhanced', translation: snapshots[2] },
  ] as const as VariantTrainingScenarioStageTuple;
  const binding = immutable({
    schemaVersion: 1 as const,
    templateVersion: VARIANT_TRAINING_SCENARIO_TEMPLATE_VERSION as 1,
    mapId: VARIANT_TRAINING_SCENARIO_MAP_ID,
    activeInit: context.activeInit,
    stages,
  });
  const definition = buildVariantTrainingScenarioMap(binding.stages, binding.activeInit);
  return immutable({ binding, definition });
}

/** Attach the frozen scenario to the exact JSON MapRun wire snapshot being saved. */
export function createVariantTrainingScenarioSaveSnapshot(
  bindingInput: VariantTrainingScenarioBinding,
  mapRunInput: MapRunSaveSnapshot,
): MapRunSaveSnapshot {
  const binding = readBinding(bindingInput, false);
  const core = coreOf(binding);
  const { snapshot, scenario } = wireSnapshot(mapRunInput, true, true);
  requireValue(scenario === undefined, 'MapRun already contains a scenario binding');
  validateRunAgainstBinding(snapshot, binding);
  const runId = (snapshot.run as { runId: string }).runId;
  const consistency = canonical({ binding: core, mapRun: snapshot });
  const savedBinding = immutable({ ...core, run: { runId, consistency } }) as VariantTrainingScenarioBinding;
  return immutable({ ...snapshot, scenario: savedBinding }) as MapRunSaveSnapshot;
}

/** Strictly restore exact source revisions before a caller rebuilds the main MapRun owner. */
export function restoreVariantTrainingScenario(
  bindingInput: unknown,
  mapRunInput: unknown,
  translation: VariantTranslationPort,
  activeInit: string,
): VariantTrainingScenarioRestored {
  requireActiveInit(activeInit);
  const binding = readBinding(bindingInput, true);
  requireValue(binding.activeInit === activeInit, 'Scenario belongs to another active Init');
  const { snapshot, scenario } = wireSnapshot(mapRunInput, true, false);
  if (scenario !== undefined) requireValue(canonical(scenario) === canonical(binding), 'MapRun scenario field differs from the requested binding');
  validateRunAgainstBinding(snapshot, binding);
  const core = coreOf(binding);
  const expectedConsistency = canonical({ binding: core, mapRun: snapshot });
  requireValue(binding.run?.consistency === expectedConsistency, 'Scenario binding and MapRun snapshot are inconsistent');

  const restoredSnapshots: VariantTranslationSnapshot[] = [];
  binding.stages.forEach((stage, index) => {
    requireValue(stage.source === VARIANT_TRAINING_SCENARIO_SOURCE_ORDER[index], 'Scenario source order is invalid');
    const restored = translation.restore(stage.translation);
    if (restored.status !== 'restored') throw new Error(restored.issues[0]?.message ?? `Cannot restore ${stage.source} translation`);
    requireValue(restored.snapshot.activeInit === activeInit, `Scenario ${stage.source} translation belongs to another active Init`);
    requireValue(canonical(restored.snapshot) === canonical(stage.translation), `Scenario ${stage.source} translation changed during restore`);
    restoredSnapshots.push(restored.snapshot);
  });
  const stages = [
    { source: 'owned', translation: restoredSnapshots[0] },
    { source: 'normal', translation: restoredSnapshots[1] },
    { source: 'enhanced', translation: restoredSnapshots[2] },
  ] as const as VariantTrainingScenarioStageTuple;
  const restoredBinding = immutable({ ...core, stages }) as VariantTrainingScenarioBinding;
  const definition = buildVariantTrainingScenarioMap(stages, activeInit);
  return immutable({ binding: restoredBinding, definition });
}
