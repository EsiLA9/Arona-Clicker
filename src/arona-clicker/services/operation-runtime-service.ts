import type {
  EventResult,
  EventRun,
  OperationActorDef,
  OperationActorInitialization,
  OperationBoundedValueDef,
  OperationEventDef,
  OperationLifecycleEvent,
  OperationMembershipChange,
  OperationInterventionCommand,
  OperationLocationResultKind,
  OperationResultKind,
  OperationRunVersionCommand,
  OperationRouteCommand,
  OperationRunStartInput,
  OperationRunStatus,
  OperationStateDelta,
  OperationStudentProfileSnapshot,
  OperationTacticalRandomState,
  OperationTeamDef,
} from '../contracts/operation';
import type {
  OperationInterventionPreview,
  OperationInterventionDraft,
  OperationPreparationContent,
  OperationPreparationSnapshot,
  OperationPreparedActorPlan,
  PreparedBeat,
} from '../contracts/operation-beat';
import type {
  OperationResolution,
  OperationResolutionBatch,
  OperationResolutionMembershipChange,
  OperationResolutionNumericChange,
  OperationResolutionPlannerSnapshot,
  OperationResolutionTrustedContent,
} from '../contracts/operation-resolution';
import type { OperationView } from '../contracts/operation-view';
import {
  isNonEmptyOperationId as nonEmptyId,
  isOperationRecord as isRecord,
  operationCardCounts as cardCounts,
  readOperationCardZones as readCardZones,
  sameOperationCardCounts as sameCounts,
  validateOperationActorInitializations,
  validateOperationEventDef,
} from './operation-definition-validation';
import { validateOperationActionActorReferences, validateOperationActionContent } from './operation-action-content-validation';
import { prepareOperationBeat } from './operation-plan-preparation';
import { previewOperationIntervention, OperationInterventionPreviewError } from './operation-intervention-preview';
import { planOperationResolution, OperationResolutionPlannerError } from './operation-resolution-planner';
import { projectOperationView } from './operation-view-projector';
import {
  evaluateOperationEventOutcome,
  evaluateOperationLocationOutcome,
  getCurrentLocationDefinition,
  hasOperationHardFailure,
} from './operation-progress-evaluator';
import { evaluateOperationRoutes } from './operation-route-evaluator';
import { OPERATION_TACTICAL_RNG_ALGORITHM } from '../contracts/operation';

interface MutableActorState {
  id: string;
  type: string;
  hp: number;
  resources: Record<string, number>;
  participantKind?: OperationActorInitialization['participantKind'];
  characterId?: string;
  profile?: OperationStudentProfileSnapshot;
  factionId?: string;
  teamId?: string;
}

interface MutableRun {
  runId: string;
  eventId: string;
  status: OperationRunStatus;
  currentLocationId: string;
  eventState: {
    tracks: Record<string, number>;
    knownFactIds: string[];
    heldItemIds: string[];
  };
  actorStates: MutableActorState[];
  teamStates: { id: string; resources: Record<string, number> }[];
  playerRouteState: {
    playerCost: number;
    cards: { drawPile: string[]; hand: string[]; discard: string[]; played: string[] };
  };
  locationProgress: Record<string, { visitCount: number; completed: boolean; beatCount: number; result: 'success' | 'partialSuccess' | 'failure' | null }>;
  routeHistory: EventRun['routeHistory'][number][];
  planVersion: number;
  beatIndex: number;
  preparedBeat: PreparedBeat | null;
  interventionDraft: OperationInterventionDraft | null;
  resolutions: OperationResolution[];
  resolutionSequence: number;
  random: OperationTacticalRandomState;
}

interface RunRules {
  readonly definition: OperationEventDef;
  readonly tracks: ReadonlyMap<string, OperationBoundedValueDef>;
  readonly facts: ReadonlySet<string>;
  readonly items: ReadonlySet<string>;
  readonly actors: ReadonlyMap<string, OperationActorDef>;
  readonly teams: ReadonlyMap<string, OperationTeamDef>;
  readonly deckCounts: ReadonlyMap<string, number>;
  readonly tacticalContent: OperationResolutionTrustedContent | null;
}

interface RunSlot {
  rules: RunRules;
  run: MutableRun;
  result: EventResult | null;
}

type OperationLifecycleListener = (event: OperationLifecycleEvent) => void;

let runSequence = 0;

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function frozenCopy<T>(value: T): T {
  return deepFreeze(deepCopy(value));
}

function defineRules(
  definition: OperationEventDef,
  tacticalContent?: Omit<OperationResolutionTrustedContent, 'eventDefinition'>,
): RunRules {
  const cloned = deepFreeze(deepCopy(definition));
  const frozenTacticalContent = tacticalContent
    ? deepFreeze({ eventDefinition: cloned, ...deepCopy(tacticalContent) })
    : null;
  return {
    definition: cloned,
    tracks: new Map(cloned.tracks.map(track => [track.id, { initial: track.initial, min: track.min, max: track.max }])),
    facts: new Set(cloned.factIds),
    items: new Set(cloned.itemIds),
    actors: new Map(cloned.actors.map(actor => [actor.id, actor])),
    teams: new Map((cloned.teams ?? []).map(team => [team.id, team])),
    deckCounts: cardCounts(cloned.playerRouteState.cards),
    tacticalContent: frozenTacticalContent,
  };
}

function createRun(
  runId: string,
  rules: RunRules,
  actorInitializations?: ReadonlyMap<string, OperationActorInitialization>,
): MutableRun {
  const definition = rules.definition;
  const locations = Object.fromEntries(definition.locations.map(location => [
    location.id,
    { visitCount: location.id === definition.initialLocationId ? 1 : 0, completed: false, beatCount: 0, result: null },
  ]));
  return {
    runId,
    eventId: definition.id,
    status: 'inProgress',
    currentLocationId: definition.initialLocationId,
    eventState: {
      tracks: Object.fromEntries(definition.tracks.map(track => [track.id, track.initial])),
      knownFactIds: [...definition.knownFactIds],
      heldItemIds: [...definition.heldItemIds],
    },
    teamStates: (definition.teams ?? []).map(team => ({
      id: team.id,
      resources: Object.fromEntries(Object.entries(team.resources ?? {}).map(([id, value]) => [id, value.initial])),
    })),
    actorStates: definition.actors.map(actor => {
      const base: MutableActorState = {
        id: actor.id,
        type: actor.type,
        hp: actor.hp.initial,
        resources: Object.fromEntries(Object.entries(actor.resources ?? {}).map(([id, value]) => [id, value.initial])),
        ...(actor.teamId ? { teamId: actor.teamId } : {}),
      };
      const identity = actorInitializations?.get(actor.id);
      if (!identity) return base;
      if (identity.participantKind === 'student') {
        base.participantKind = 'student';
        base.characterId = identity.characterId;
        base.profile = identity.profile;
      } else {
        base.participantKind = identity.participantKind;
        if (identity.factionId) base.factionId = identity.factionId;
      }
      return base;
    }),
    playerRouteState: {
      playerCost: definition.playerRouteState.playerCost,
      cards: {
        drawPile: [...definition.playerRouteState.cards.drawPile],
        hand: [...definition.playerRouteState.cards.hand],
        discard: [...definition.playerRouteState.cards.discard],
        played: [...definition.playerRouteState.cards.played],
      },
    },
    locationProgress: locations,
    routeHistory: [],
    planVersion: 0,
    beatIndex: 0,
    preparedBeat: null,
    interventionDraft: null,
    resolutions: [],
    resolutionSequence: 0,
    random: {
      algorithm: OPERATION_TACTICAL_RNG_ALGORITHM,
      seed: definition.randomSeed ?? 0,
      tacticalCursor: 0,
    },
  };
}

function advancePlanVersion(run: MutableRun): number {
  if (!Number.isSafeInteger(run.planVersion) || run.planVersion >= Number.MAX_SAFE_INTEGER) {
    throw new OperationRuntimeError(['planVersion cannot advance without overflowing a safe integer']);
  }
  return run.planVersion + 1;
}

function preparationSnapshot(run: MutableRun): OperationPreparationSnapshot {
  return {
    eventId: run.eventId,
    planVersion: run.planVersion,
    currentLocationId: run.currentLocationId,
    actors: run.actorStates.map(actor => {
      if (!actor.participantKind) {
        throw new OperationRuntimeError(['tactical Run Actor lacks its admitted participant kind: ' + actor.id]);
      }
      return { actorId: actor.id, participantKind: actor.participantKind, resources: actor.resources };
    }),
    teams: run.teamStates.map(team => ({ id: team.id, resources: team.resources })),
  };
}

function refreshPreparedBeat(run: MutableRun, rules: RunRules): void {
  if (run.status !== 'inProgress' || run.locationProgress[run.currentLocationId]?.completed) {
    run.preparedBeat = null;
    return;
  }
  const content = rules.tacticalContent;
  if (!content) {
    run.preparedBeat = null;
    return;
  }
  const preparationContent: OperationPreparationContent = {
    eventDefinition: content.eventDefinition,
    actors: content.actorInitializations,
    actionDefinitions: content.actionDefinitions,
  };
  try {
    run.preparedBeat = prepareOperationBeat(preparationSnapshot(run), preparationContent);
  } catch (error) {
    throw new OperationRuntimeError([error instanceof Error ? error.message : 'could not prepare the current Beat']);
  }
}

function hasLocationOutcomeRules(definition: NonNullable<ReturnType<typeof getCurrentLocationDefinition>> | undefined): boolean {
  return definition !== undefined && (
    (definition.objectives?.length ?? 0) > 0
    || (definition.partialOutcomes?.length ?? 0) > 0
    || (definition.failureConditions?.length ?? 0) > 0
    || definition.maxBeats !== undefined
  );
}

function evaluateLocationProgress(run: MutableRun, rules: RunRules): boolean {
  const progress = run.locationProgress[run.currentLocationId];
  if (!progress || progress.completed) return false;
  const result = evaluateOperationLocationOutcome(
    getCurrentLocationDefinition(rules.definition, run.currentLocationId),
    run.eventState,
    progress.beatCount,
  );
  if (result === null) return false;
  progress.completed = true;
  progress.result = result;
  return true;
}

function freezeEventResult(run: MutableRun, kind: OperationResultKind): EventResult {
  return frozenCopy({ eventId: run.eventId, runId: run.runId, kind, finalRun: run }) as EventResult;
}

function resolutionPlannerSnapshot(run: MutableRun): OperationResolutionPlannerSnapshot {
  return {
    runId: run.runId,
    eventId: run.eventId,
    planVersion: run.planVersion,
    currentLocationId: run.currentLocationId,
    actors: run.actorStates.map(actor => {
      if (!actor.participantKind) {
        throw new OperationRuntimeError(['tactical Run Actor lacks its admitted participant kind: ' + actor.id]);
      }
      return {
        actorId: actor.id,
        participantKind: actor.participantKind,
        hp: actor.hp,
        resources: actor.resources,
      };
    }),
    teams: run.teamStates.map(team => ({ id: team.id, resources: team.resources })),
    tracks: run.eventState.tracks,
    knownFactIds: run.eventState.knownFactIds,
    heldItemIds: run.eventState.heldItemIds,
    randomState: run.random,
  };
}

function parseVersionCommand(value: unknown): OperationRunVersionCommand {
  if (!isRecord(value)
    || Object.keys(value).some(key => key !== 'runId' && key !== 'planVersion')
    || !nonEmptyId(value.runId)
    || !Number.isSafeInteger(value.planVersion)
    || (value.planVersion as number) < 0) {
    throw new OperationRuntimeError(['command must contain only a valid runId and non-negative planVersion']);
  }
  return { runId: value.runId, planVersion: value.planVersion as number };
}

function assertCommandMatchesRun(command: OperationRunVersionCommand, run: MutableRun): void {
  if (command.runId !== run.runId || command.planVersion !== run.planVersion) {
    throw new OperationRuntimeError(['operation command is stale for this Run or planVersion']);
  }
}

function parseInterventionCommand(value: unknown): OperationInterventionCommand {
  if (!isRecord(value)
    || Object.keys(value).some(key => key !== 'runId' && key !== 'planVersion' && key !== 'draft')
    || !Object.prototype.hasOwnProperty.call(value, 'draft')) {
    throw new OperationRuntimeError(['intervention command must contain only runId, planVersion, and draft']);
  }
  const base = parseVersionCommand({ runId: value.runId, planVersion: value.planVersion });
  return { ...base, draft: value.draft as OperationInterventionCommand['draft'] };
}

function parseRouteCommand(value: unknown): OperationRouteCommand {
  if (!isRecord(value)
    || Object.keys(value).some(key => key !== 'runId' && key !== 'planVersion' && key !== 'routeId')
    || !nonEmptyId(value.routeId)) {
    throw new OperationRuntimeError(['route command must contain only runId, planVersion, and routeId']);
  }
  return { ...parseVersionCommand({ runId: value.runId, planVersion: value.planVersion }), routeId: value.routeId };
}

function toResolution(batch: OperationResolutionBatch, sequence: number): OperationResolution {
  const { nextRandomState: _nextRandomState, ...persisted } = batch;
  return frozenCopy({ ...persisted, resolutionSequence: sequence });
}

function resolutionTargetKey(change: OperationResolutionNumericChange): string {
  return JSON.stringify(change.target);
}

function applyResolutionChanges(
  run: MutableRun,
  changes: readonly OperationResolutionNumericChange[],
  rules: RunRules,
): void {
  if (!Array.isArray(changes)) throw new OperationRuntimeError(['Resolution numericChanges must be an array']);
  const seen = new Set<string>();
  for (const candidate of changes) {
    if (!isRecord(candidate) || !isRecord(candidate.target)
      || !Number.isFinite(candidate.before) || !Number.isFinite(candidate.after)
      || !Number.isFinite(candidate.delta) || !Number.isFinite(candidate.requestedDelta)) {
      throw new OperationRuntimeError(['Resolution contains a malformed numeric change']);
    }
    const change = candidate as unknown as OperationResolutionNumericChange;
    const target = change.target;
    const key = resolutionTargetKey(change);
    if (seen.has(key)) throw new OperationRuntimeError(['Resolution repeats a numeric target: ' + key]);
    seen.add(key);
    let current: number | undefined;
    let bounds: OperationBoundedValueDef | undefined;
    switch (target.kind) {
      case 'actorHp': {
        const actor = rules.actors.get(target.actorId);
        const state = run.actorStates.find(item => item.id === target.actorId);
        current = state?.hp;
        bounds = actor?.hp;
        if (!state || !actor) throw new OperationRuntimeError(['Resolution references an undeclared Actor: ' + target.actorId]);
        break;
      }
      case 'actorResource': {
        const actor = rules.actors.get(target.actorId);
        const state = run.actorStates.find(item => item.id === target.actorId);
        current = state?.resources[target.resourceId];
        bounds = actor?.resources?.[target.resourceId];
        if (!state || !actor || !bounds) throw new OperationRuntimeError(['Resolution references an undeclared Actor resource']);
        break;
      }
      case 'teamResource': {
        const team = rules.teams.get(target.teamId);
        const state = run.teamStates.find(item => item.id === target.teamId);
        current = state?.resources[target.resourceId];
        bounds = team?.resources?.[target.resourceId];
        if (!state || !team || !bounds) throw new OperationRuntimeError(['Resolution references an undeclared Team resource']);
        break;
      }
      case 'track': {
        current = run.eventState.tracks[target.trackId];
        bounds = rules.tracks.get(target.trackId);
        if (current === undefined || !bounds) throw new OperationRuntimeError(['Resolution references an undeclared Event Track']);
        break;
      }
      default:
        throw new OperationRuntimeError(['Resolution contains an unsupported numeric target']);
    }
    if (current === undefined || current !== change.before || !bounds || !isInBounds(change.after, bounds)) {
      throw new OperationRuntimeError(['Resolution numeric change no longer matches its commit-start value or bounds']);
    }
    switch (target.kind) {
      case 'actorHp':
        run.actorStates.find(item => item.id === target.actorId)!.hp = change.after;
        break;
      case 'actorResource':
        run.actorStates.find(item => item.id === target.actorId)!.resources[target.resourceId] = change.after;
        break;
      case 'teamResource':
        run.teamStates.find(item => item.id === target.teamId)!.resources[target.resourceId] = change.after;
        break;
      case 'track':
        run.eventState.tracks[target.trackId] = change.after;
        break;
    }
  }
}

function applyResolutionMembershipChanges(
  run: MutableRun,
  changes: readonly OperationResolutionMembershipChange[],
  rules: RunRules,
): void {
  if (!Array.isArray(changes)) throw new OperationRuntimeError(['Resolution membershipChanges must be an array']);
  const seen = new Set<string>();
  const facts = new Set(run.eventState.knownFactIds);
  const items = new Set(run.eventState.heldItemIds);
  for (const candidate of changes) {
    if (!isRecord(candidate) || !isRecord(candidate.target)
      || !nonEmptyId(candidate.target.id) || typeof candidate.before !== 'boolean' || typeof candidate.after !== 'boolean') {
      throw new OperationRuntimeError(['Resolution contains a malformed membership change']);
    }
    const change = candidate as unknown as OperationResolutionMembershipChange;
    const { kind, id } = change.target;
    const key = kind + ':' + id;
    if (seen.has(key)) throw new OperationRuntimeError(['Resolution repeats a membership target: ' + key]);
    seen.add(key);
    const collection = kind === 'knownFact' ? facts : kind === 'heldItem' ? items : null;
    const declarations = kind === 'knownFact' ? rules.facts : kind === 'heldItem' ? rules.items : null;
    if (!collection || !declarations?.has(id)) {
      throw new OperationRuntimeError(['Resolution references an undeclared membership target: ' + key]);
    }
    if (collection.has(id) !== change.before) {
      throw new OperationRuntimeError(['Resolution membership change no longer matches its commit-start value: ' + key]);
    }
    if (change.after) collection.add(id);
    else collection.delete(id);
  }
  run.eventState.knownFactIds = [...facts];
  run.eventState.heldItemIds = [...items];
}

function validateMembershipChanges(
  changes: unknown,
  declarations: ReadonlySet<string>,
  path: string,
  issues: string[],
): OperationMembershipChange[] {
  if (changes === undefined) return [];
  if (!Array.isArray(changes)) {
    issues.push(path + ' must be an array');
    return [];
  }
  const parsed: OperationMembershipChange[] = [];
  const seen = new Set<string>();
  changes.forEach((change, index) => {
    if (!isRecord(change) || !nonEmptyId(change.id)) {
      issues.push(path + '[' + index + '].id must be a non-empty ID');
      return;
    }
    if (seen.has(change.id)) issues.push(path + ' contains duplicate ID: ' + change.id);
    seen.add(change.id);
    if (!declarations.has(change.id)) issues.push(path + ' contains undeclared ID: ' + change.id);
    if (typeof change.present !== 'boolean') issues.push(path + '[' + index + '].present must be boolean');
    else parsed.push({ id: change.id, present: change.present });
  });
  return parsed;
}

function isInBounds(value: unknown, bounds: OperationBoundedValueDef): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= bounds.min && value <= bounds.max;
}

export class OperationRuntimeError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'OperationRuntimeError';
  }
}

/** Owns one isolated EventRun and emits only local Run / Location lifecycle events. */
export class OperationRuntimeService {
  private slot: RunSlot | null = null;
  private disposed = false;
  private notifying = false;
  private advancingCompletedLocation = false;
  private readonly listeners = new Set<OperationLifecycleListener>();

  subscribe(listener: OperationLifecycleListener): () => void {
    this.assertUsable();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(input: OperationEventDef | OperationRunStartInput): EventRun {
    this.assertCanMutate();
    const hasActorInitializations = isRecord(input) && 'eventDefinition' in input;
    const runStartInput = hasActorInitializations ? input as OperationRunStartInput : undefined;
    const definition = runStartInput?.eventDefinition ?? input as OperationEventDef;
    const diagnostics = validateOperationEventDef(definition);
    if (diagnostics.length > 0) throw new OperationRuntimeError(diagnostics);
    const actorInitializations = runStartInput?.actors;
    let normalizedTacticalContent: Omit<OperationResolutionTrustedContent, 'eventDefinition'> | undefined;
    if (hasActorInitializations) {
      const actorIssues = validateOperationActorInitializations(
        definition,
        actorInitializations,
        runStartInput?.actionDefinitions,
        runStartInput?.studentSkillRules,
      );
      if (actorIssues.length > 0) throw new OperationRuntimeError(actorIssues);
      const profileReferences = actorInitializations!.flatMap(actor => actor.participantKind === 'student' ? [actor.profile] : []);
      const content = validateOperationActionContent(
        definition,
        runStartInput?.actionDefinitions,
        runStartInput?.studentSkillRules,
        profileReferences,
      );
      if (content.issues.length > 0) throw new OperationRuntimeError(content.issues);
      const referenceIssues = validateOperationActionActorReferences(
        definition,
        content.actionDefinitions,
        content.studentSkillRules,
        actorInitializations!,
      );
      if (referenceIssues.length > 0) throw new OperationRuntimeError(referenceIssues);
      normalizedTacticalContent = {
        actorInitializations: actorInitializations!,
        actionDefinitions: content.actionDefinitions,
        studentSkillRules: content.studentSkillRules,
      };
    }
    this.assertUsable();
    if (this.slot?.run.status === 'inProgress') {
      throw new OperationRuntimeError(['an EventRun is already in progress']);
    }

    let rules: RunRules;
    try {
      rules = defineRules(definition, normalizedTacticalContent);
    } catch {
      throw new OperationRuntimeError(['event definition and trusted tactical rules must contain only cloneable data']);
    }
    const runId = 'operation-run-' + (++runSequence);
    const actorInitializationsById = rules.tacticalContent
      ? new Map(rules.tacticalContent.actorInitializations.map(actor => [actor.actorId, actor]))
      : undefined;
    const run = createRun(runId, rules, actorInitializationsById);
    const initialHardFailure = hasOperationHardFailure(rules.definition, run.eventState);
    const initialLocationProgress = run.locationProgress[run.currentLocationId];
    let initialLocationCompleted = false;
    if (initialHardFailure) {
      initialLocationProgress.completed = true;
      initialLocationProgress.result = 'failure';
      run.status = 'failure';
    } else {
      initialLocationCompleted = evaluateLocationProgress(run, rules);
    }
    if (rules.tacticalContent) refreshPreparedBeat(run, rules);
    const result = initialHardFailure ? freezeEventResult(run, 'failure') : null;
    this.slot = { rules, run, result };
    this.publish({ type: 'runStarted', runId, eventId: run.eventId });
    this.publish({ type: 'locationEntered', runId, eventId: run.eventId, locationId: run.currentLocationId });
    if (initialLocationCompleted || initialHardFailure) {
      this.publish({ type: 'locationCompleted', runId, eventId: run.eventId, locationId: run.currentLocationId });
    }
    if (result) this.publish({ type: 'runFinished', runId, eventId: run.eventId, kind: result.kind });
    if (initialLocationCompleted && !result) this.advanceCompletedLocation();
    return this.getSnapshot()!;
  }

  getSnapshot(): EventRun | null {
    return this.slot ? frozenCopy(this.slot.run) : null;
  }

  getView(expectedRunId?: string): OperationView | null {
    this.assertUsable();
    const slot = this.slot;
    if (!slot || (expectedRunId !== undefined && expectedRunId !== slot.run.runId) || !slot.rules.tacticalContent) return null;
    return projectOperationView(slot.run, {
      eventDefinition: slot.rules.tacticalContent.eventDefinition,
      actors: slot.rules.tacticalContent.actorInitializations,
      actionDefinitions: slot.rules.tacticalContent.actionDefinitions,
    });
  }

  getResult(): EventResult | null {
    return this.slot?.result ?? null;
  }

  previewIntervention(input: OperationInterventionCommand): OperationInterventionPreview {
    this.assertUsable();
    const command = parseInterventionCommand(input);
    const slot = this.slot;
    if (!slot) throw new OperationRuntimeError(['there is no EventRun']);
    if (slot.run.status !== 'inProgress') throw new OperationRuntimeError(['the EventRun is already terminal']);
    assertCommandMatchesRun(command, slot.run);
    if (!slot.rules.tacticalContent || !slot.run.preparedBeat) {
      throw new OperationRuntimeError(['this EventRun has no admitted tactical content']);
    }
    const candidateDraft = isRecord(command.draft) ? { ...command.draft } : command.draft;
    try {
      return previewOperationIntervention({
        snapshot: preparationSnapshot(slot.run),
        trustedContent: {
          eventDefinition: slot.rules.tacticalContent.eventDefinition,
          actors: slot.rules.tacticalContent.actorInitializations,
          actionDefinitions: slot.rules.tacticalContent.actionDefinitions,
        },
        preparedBeat: slot.run.preparedBeat,
        currentDraft: slot.run.interventionDraft,
        draft: candidateDraft as OperationInterventionCommand['draft'],
      });
    } catch (error) {
      const details = error instanceof OperationInterventionPreviewError
        ? [error.message]
        : [error instanceof Error ? error.message : 'intervention preview failed'];
      throw new OperationRuntimeError(details);
    }
  }

  reviseIntervention(input: OperationInterventionCommand): EventRun {
    this.assertCanMutate();
    const command = parseInterventionCommand(input);
    const preview = this.previewIntervention(command);
    const slot = this.requireActiveRun();
    const next = deepCopy(slot.run);
    next.planVersion = advancePlanVersion(slot.run);
    next.interventionDraft = deepCopy(preview.draft);
    refreshPreparedBeat(next, slot.rules);
    slot.run = next;
    return this.getSnapshot()!;
  }

  clearIntervention(input: OperationRunVersionCommand): EventRun {
    this.assertCanMutate();
    const command = parseVersionCommand(input);
    const slot = this.requireActiveRun();
    assertCommandMatchesRun(command, slot.run);
    if (slot.run.interventionDraft === null) return this.getSnapshot()!;
    const next = deepCopy(slot.run);
    next.planVersion = advancePlanVersion(slot.run);
    next.interventionDraft = null;
    refreshPreparedBeat(next, slot.rules);
    slot.run = next;
    return this.getSnapshot()!;
  }

  commitBeat(input: OperationRunVersionCommand): OperationResolution {
    this.assertCanMutate();
    const command = parseVersionCommand(input);
    const slot = this.slot;
    if (!slot) throw new OperationRuntimeError(['there is no EventRun']);
    const run = slot.run;
    const latestResolution = run.resolutions[run.resolutions.length - 1];
    if (command.runId === run.runId && latestResolution?.basePlanVersion === command.planVersion) {
      return latestResolution;
    }
    if (run.status !== 'inProgress') throw new OperationRuntimeError(['the EventRun is already terminal']);
    assertCommandMatchesRun(command, run);
    const tacticalContent = slot.rules.tacticalContent;
    if (!tacticalContent || !run.preparedBeat) {
      throw new OperationRuntimeError(['this EventRun has no admitted tactical content']);
    }

    const next = deepCopy(run);
    let batch: OperationResolutionBatch;
    try {
      batch = planOperationResolution({
        snapshot: resolutionPlannerSnapshot(run),
        trustedContent: tacticalContent,
        preparedBeat: run.preparedBeat,
        interventionDraft: run.interventionDraft,
      });
    } catch (error) {
      const diagnostics = error instanceof OperationResolutionPlannerError
        ? [error.message]
        : [error instanceof Error ? error.message : 'tactical Beat planning failed'];
      throw new OperationRuntimeError(diagnostics);
    }
    if (batch.runId !== run.runId || batch.eventId !== run.eventId
      || batch.basePlanVersion !== run.planVersion || batch.locationId !== run.currentLocationId
      || batch.randomCursorBefore !== run.random.tacticalCursor
      || batch.randomCursorAfter !== batch.nextRandomState.tacticalCursor
      || batch.randomCursorAfter < batch.randomCursorBefore
      || batch.nextRandomState.seed !== run.random.seed
      || batch.nextRandomState.algorithm !== run.random.algorithm) {
      throw new OperationRuntimeError(['Resolution batch does not match its commit-start Run snapshot']);
    }

    applyResolutionChanges(next, batch.numericChanges, slot.rules);
    applyResolutionMembershipChanges(next, batch.membershipChanges, slot.rules);
    next.random = deepCopy(batch.nextRandomState);
    next.beatIndex += 1;
    const nextLocationProgress = next.locationProgress[next.currentLocationId];
    if (!nextLocationProgress) throw new OperationRuntimeError(['current Location progress is missing']);
    nextLocationProgress.beatCount += 1;
    if (!Number.isSafeInteger(nextLocationProgress.beatCount)) {
      throw new OperationRuntimeError(['Location beatCount cannot advance safely']);
    }
    if (!Number.isSafeInteger(next.beatIndex)) throw new OperationRuntimeError(['beatIndex cannot advance safely']);
    if (next.resolutionSequence >= Number.MAX_SAFE_INTEGER) {
      throw new OperationRuntimeError(['resolutionSequence cannot advance safely']);
    }
    next.resolutionSequence += 1;
    const resolution = toResolution(batch, next.resolutionSequence);
    next.resolutions = [...next.resolutions, resolution].slice(-32);
    next.planVersion = advancePlanVersion(run);
    next.interventionDraft = null;
    const hardFailure = hasOperationHardFailure(slot.rules.definition, next.eventState);
    let locationCompleted = false;
    if (hardFailure) {
      nextLocationProgress.completed = true;
      nextLocationProgress.result = 'failure';
      next.status = 'failure';
      next.preparedBeat = null;
    } else {
      locationCompleted = evaluateLocationProgress(next, slot.rules);
      refreshPreparedBeat(next, slot.rules);
    }
    const eventResult = hardFailure ? freezeEventResult(next, 'failure') : null;

    slot.run = next;
    if (eventResult) slot.result = eventResult;
    this.publish({
      type: 'beatResolved',
      runId: run.runId,
      eventId: run.eventId,
      locationId: run.currentLocationId,
      basePlanVersion: run.planVersion,
      resolutionSequence: resolution.resolutionSequence,
    });
    if (locationCompleted || hardFailure) {
      this.publish({ type: 'locationCompleted', runId: next.runId, eventId: next.eventId, locationId: next.currentLocationId });
    }
    if (eventResult) {
      this.publish({ type: 'runFinished', runId: eventResult.runId, eventId: eventResult.eventId, kind: eventResult.kind });
    }
    if (locationCompleted && !eventResult) this.advanceCompletedLocation();
    return resolution;
  }

  /** Atomically applies checked local state changes; it emits no per-field events. */
  applyStateDelta(delta: OperationStateDelta): EventRun {
    const slot = this.requireActiveRun();
    if (!isRecord(delta)) throw new OperationRuntimeError(['state delta must be an object']);
    const next = deepCopy(slot.run);
    const issues: string[] = [];

    if (delta.tracks !== undefined) {
      if (!isRecord(delta.tracks)) {
        issues.push('tracks delta must be a record');
      } else {
        for (const [id, value] of Object.entries(delta.tracks)) {
          const bounds = slot.rules.tracks.get(id);
          if (!bounds) issues.push('tracks delta contains undeclared key: ' + id);
          else if (!isInBounds(value, bounds)) issues.push('tracks.' + id + ' is outside its bounds');
          else next.eventState.tracks[id] = value;
        }
      }
    }

    const knownFacts = validateMembershipChanges(delta.knownFacts, slot.rules.facts, 'knownFacts', issues);
    const heldItems = validateMembershipChanges(delta.heldItems, slot.rules.items, 'heldItems', issues);
    if (delta.knownFacts !== undefined) {
      const values = new Set(next.eventState.knownFactIds);
      for (const change of knownFacts) {
        if (change.present) values.add(change.id);
        else values.delete(change.id);
      }
      next.eventState.knownFactIds = [...values];
    }
    if (delta.heldItems !== undefined) {
      const values = new Set(next.eventState.heldItemIds);
      for (const change of heldItems) {
        if (change.present) values.add(change.id);
        else values.delete(change.id);
      }
      next.eventState.heldItemIds = [...values];
    }

    this.applyActorChanges(next, delta.actors, slot.rules.actors, issues);
    this.applyRouteChange(next, delta.playerRouteState, slot.rules.deckCounts, issues);
    if (issues.length > 0) throw new OperationRuntimeError(issues);
    next.planVersion = advancePlanVersion(slot.run);
    next.interventionDraft = null;
    const hardFailure = hasOperationHardFailure(slot.rules.definition, next.eventState);
    let locationCompleted = false;
    if (hardFailure) {
      const progress = next.locationProgress[next.currentLocationId];
      progress.completed = true;
      progress.result = 'failure';
      next.status = 'failure';
      next.preparedBeat = null;
    } else {
      locationCompleted = evaluateLocationProgress(next, slot.rules);
      refreshPreparedBeat(next, slot.rules);
    }
    const eventResult = hardFailure ? freezeEventResult(next, 'failure') : null;
    slot.run = next;
    if (eventResult) slot.result = eventResult;
    if (locationCompleted || hardFailure) {
      this.publish({ type: 'locationCompleted', runId: next.runId, eventId: next.eventId, locationId: next.currentLocationId });
    }
    if (eventResult) {
      this.publish({ type: 'runFinished', runId: eventResult.runId, eventId: eventResult.eventId, kind: eventResult.kind });
    }
    if (locationCompleted && !eventResult) this.advanceCompletedLocation();
    return this.getSnapshot()!;
  }

  /** The sole Location transition write path for manual and automatic routing. */
  transitionRoute(input: OperationRouteCommand): EventRun {
    this.assertCanMutate();
    const command = parseRouteCommand(input);
    this.commitRouteTransition(command);
    if (!this.advancingCompletedLocation) this.advanceCompletedLocation();
    return this.getSnapshot()!;
  }

  completeCurrentLocation(): EventRun {
    this.assertCanMutate();
    const slot = this.requireActiveRun();
    const locationId = slot.run.currentLocationId;
    if (slot.run.locationProgress[locationId].completed) return this.getSnapshot()!;
    const next = deepCopy(slot.run);
    const progress = next.locationProgress[locationId];
    const locationDefinition = getCurrentLocationDefinition(slot.rules.definition, locationId);
    const result = evaluateOperationLocationOutcome(locationDefinition, next.eventState, progress.beatCount);
    if (result === null && hasLocationOutcomeRules(locationDefinition)) {
      throw new OperationRuntimeError(['current Location objectives are not complete']);
    }
    progress.completed = true;
    progress.result = result ?? 'success';
    next.planVersion = advancePlanVersion(slot.run);
    next.interventionDraft = null;
    refreshPreparedBeat(next, slot.rules);
    slot.run = next;
    this.publish({ type: 'locationCompleted', runId: next.runId, eventId: next.eventId, locationId });
    this.advanceCompletedLocation();
    return this.getSnapshot()!;
  }

  finish(): EventResult {
    this.assertCanMutate();
    const slot = this.slot;
    if (slot?.result) return slot.result;
    const active = this.requireActiveRun();
    if (!active.run.locationProgress[active.run.currentLocationId].completed) {
      throw new OperationRuntimeError(['Event outcome can only be evaluated after the current Location is complete']);
    }
    if (evaluateOperationRoutes(active.rules.definition, active.run).options.some(option => option.available)) {
      throw new OperationRuntimeError(['a Route must be selected before the Event outcome can be evaluated']);
    }
    const next = deepCopy(active.run);
    const kind = evaluateOperationEventOutcome(active.rules.definition, next.eventState);
    next.status = kind as OperationRunStatus;
    next.planVersion = advancePlanVersion(active.run);
    next.preparedBeat = null;
    next.interventionDraft = null;
    const result = freezeEventResult(next, kind);
    active.run = next;
    active.result = result;
    this.publish({ type: 'runFinished', runId: result.runId, eventId: result.eventId, kind });
    return result;
  }

  /** Drops the current volatile Run while keeping this service usable after Runtime reset/load. */
  reset(): void {
    this.assertCanMutate();
    this.slot = null;
  }

  /** Releases all Run data and local subscribers. */
  dispose(): void {
    if (this.disposed) return;
    this.assertCanMutate();
    this.slot = null;
    this.listeners.clear();
    this.disposed = true;
  }

  private commitRouteTransition(command: OperationRouteCommand): void {
    const slot = this.requireActiveRun();
    assertCommandMatchesRun(command, slot.run);
    const availability = evaluateOperationRoutes(slot.rules.definition, slot.run);
    const selected = availability.options.find(option => option.route.id === command.routeId);
    if (!selected) throw new OperationRuntimeError(['routeId is not an exit from the current Location: ' + command.routeId]);
    if (!selected.available) {
      throw new OperationRuntimeError(['selected Route is unavailable: ' + selected.lockedReason]);
    }

    const route = selected.route;
    const targetProgress = slot.run.locationProgress[route.targetLocationId];
    const sourceProgress = slot.run.locationProgress[slot.run.currentLocationId];
    if (!targetProgress) throw new OperationRuntimeError(['Route target Location progress is missing']);
    if (!sourceProgress?.completed || !sourceProgress.result) {
      throw new OperationRuntimeError(['completed source Location must have a result before transition']);
    }
    if (targetProgress.visitCount >= Number.MAX_SAFE_INTEGER) {
      throw new OperationRuntimeError(['Location visitCount cannot advance safely']);
    }

    // Build and validate the entire destination Run before publishing the sole owner write.
    const next = deepCopy(slot.run);
    const fromLocationId = next.currentLocationId;
    let consumedHeldItemId: string | undefined;
    if (route.consumeRequiredHeldItem && route.requiredHeldItemId) {
      const itemIndex = next.eventState.heldItemIds.indexOf(route.requiredHeldItemId);
      if (itemIndex < 0) throw new OperationRuntimeError(['required held item disappeared during route planning']);
      next.eventState.heldItemIds.splice(itemIndex, 1);
      consumedHeldItemId = route.requiredHeldItemId;
    }
    next.routeHistory.push({
      fromLocationId,
      fromLocationResult: sourceProgress.result,
      routeId: route.id,
      toLocationId: route.targetLocationId,
      ...(consumedHeldItemId ? { consumedHeldItemId } : {}),
    });
    next.currentLocationId = route.targetLocationId;
    const nextProgress = next.locationProgress[route.targetLocationId];
    nextProgress.visitCount += 1;
    nextProgress.beatCount = 0;
    nextProgress.completed = false;
    nextProgress.result = null;
    next.planVersion = advancePlanVersion(slot.run);
    next.interventionDraft = null;

    const locationCompleted = evaluateLocationProgress(next, slot.rules);
    refreshPreparedBeat(next, slot.rules);
    slot.run = next;
    this.publish({ type: 'locationEntered', runId: next.runId, eventId: next.eventId, locationId: next.currentLocationId });
    if (locationCompleted) {
      this.publish({ type: 'locationCompleted', runId: next.runId, eventId: next.eventId, locationId: next.currentLocationId });
    }
  }

  /** Automatically takes a sole exit and closes terminal Locations; branches wait for player input. */
  private advanceCompletedLocation(): void {
    if (this.advancingCompletedLocation) return;
    this.advancingCompletedLocation = true;
    try {
      while (this.slot?.run.status === 'inProgress') {
        const slot = this.slot;
        if (!slot.run.locationProgress[slot.run.currentLocationId]?.completed) return;
        const available = evaluateOperationRoutes(slot.rules.definition, slot.run).options
          .filter(option => option.available);
        if (available.length === 0) {
          this.finish();
          return;
        }
        if (available.length > 1) return;
        this.transitionRoute({
          runId: slot.run.runId,
          planVersion: slot.run.planVersion,
          routeId: available[0].route.id,
        });
      }
    } finally {
      this.advancingCompletedLocation = false;
    }
  }

  private applyActorChanges(
    next: MutableRun,
    changes: unknown,
    declarations: ReadonlyMap<string, OperationActorDef>,
    issues: string[],
  ): void {
    if (changes === undefined) return;
    if (!Array.isArray(changes)) {
      issues.push('actors delta must be an array');
      return;
    }
    const seen = new Set<string>();
    for (const change of changes) {
      if (!isRecord(change) || !nonEmptyId(change.actorId)) {
        issues.push('actors delta contains an invalid actorId');
        continue;
      }
      if (seen.has(change.actorId)) issues.push('actors delta contains duplicate actorId: ' + change.actorId);
      seen.add(change.actorId);
      const definition = declarations.get(change.actorId);
      const state = next.actorStates.find(actor => actor.id === change.actorId);
      if (!definition || !state) {
        issues.push('actors delta contains undeclared actor: ' + change.actorId);
        continue;
      }
      if (change.hp !== undefined) {
        if (!isInBounds(change.hp, definition.hp)) issues.push('actors.' + change.actorId + '.hp is outside its bounds');
        else state.hp = change.hp;
      }
      if (change.resources !== undefined) {
        if (!isRecord(change.resources)) {
          issues.push('actors.' + change.actorId + '.resources must be a record');
        } else {
          for (const [id, value] of Object.entries(change.resources)) {
            const bounds = definition.resources?.[id];
            if (!bounds) issues.push('actors.' + change.actorId + ' has undeclared resource: ' + id);
            else if (!isInBounds(value, bounds)) issues.push('actors.' + change.actorId + '.resources.' + id + ' is outside its bounds');
            else state.resources[id] = value;
          }
        }
      }
    }
  }

  private applyRouteChange(
    next: MutableRun,
    change: unknown,
    deckCounts: ReadonlyMap<string, number>,
    issues: string[],
  ): void {
    if (change === undefined) return;
    if (!isRecord(change)) {
      issues.push('playerRouteState delta must be an object');
      return;
    }
    if (change.playerCost !== undefined) {
      if (typeof change.playerCost !== 'number' || !Number.isFinite(change.playerCost)
        || change.playerCost < 0) {
        issues.push('playerRouteState.playerCost is outside its bounds');
      } else {
        next.playerRouteState.playerCost = change.playerCost;
      }
    }
    if (change.cards !== undefined) {
      const cardIssues: string[] = [];
      const zones = readCardZones(change.cards, 'playerRouteState.cards', cardIssues);
      issues.push(...cardIssues);
      if (zones && cardIssues.length === 0) {
        if (!sameCounts(deckCounts, cardCounts(zones))) {
          issues.push('playerRouteState.cards must preserve the starting deck');
        } else {
          next.playerRouteState.cards = deepCopy(zones) as MutableRun['playerRouteState']['cards'];
        }
      }
    }
  }

  private requireActiveRun(): RunSlot {
    this.assertCanMutate();
    if (!this.slot) throw new OperationRuntimeError(['there is no EventRun']);
    if (this.slot.run.status !== 'inProgress') throw new OperationRuntimeError(['the EventRun is already terminal']);
    return this.slot;
  }

  private assertUsable(): void {
    if (this.disposed) throw new OperationRuntimeError(['OperationRuntimeService has been disposed']);
  }

  private publish(event: OperationLifecycleEvent): void {
    const immutable = frozenCopy(event);
    this.notifying = true;
    try {
      for (const listener of [...this.listeners]) {
        try {
          listener(immutable);
        } catch {
          // Observers cannot roll back or interrupt a committed runtime transition.
        }
      }
    } finally {
      this.notifying = false;
    }
  }

  private assertCanMutate(): void {
    this.assertUsable();
    if (this.notifying) {
      throw new OperationRuntimeError(['runtime mutations are not allowed during lifecycle notification']);
    }
  }
}
