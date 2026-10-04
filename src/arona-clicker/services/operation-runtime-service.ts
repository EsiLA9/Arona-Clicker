import type {
  EventResult,
  EventRun,
  OperationActorDef,
  OperationBoundedValueDef,
  OperationEventDef,
  OperationLifecycleEvent,
  OperationMembershipChange,
  OperationResultKind,
  OperationRunStatus,
  OperationStateDelta,
} from '../contracts/operation';
import {
  isNonEmptyOperationId as nonEmptyId,
  isOperationRecord as isRecord,
  operationCardCounts as cardCounts,
  readOperationCardZones as readCardZones,
  sameOperationCardCounts as sameCounts,
  validateOperationEventDef,
} from './operation-definition-validation';

interface MutableActorState {
  id: string;
  type: string;
  hp: number;
  resources: Record<string, number>;
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
  playerRouteState: {
    playerCost: number;
    cards: { drawPile: string[]; hand: string[]; discard: string[]; played: string[] };
  };
  locationProgress: Record<string, { visitCount: number; completed: boolean }>;
  random: { seed: number; cursor: number };
}

interface RunRules {
  readonly definition: OperationEventDef;
  readonly locations: ReadonlySet<string>;
  readonly tracks: ReadonlyMap<string, OperationBoundedValueDef>;
  readonly facts: ReadonlySet<string>;
  readonly items: ReadonlySet<string>;
  readonly actors: ReadonlyMap<string, OperationActorDef>;
  readonly deckCounts: ReadonlyMap<string, number>;
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

function defineRules(definition: OperationEventDef): RunRules {
  const cloned = deepFreeze(deepCopy(definition));
  return {
    definition: cloned,
    locations: new Set(cloned.locationIds),
    tracks: new Map(cloned.tracks.map(track => [track.id, { initial: track.initial, min: track.min, max: track.max }])),
    facts: new Set(cloned.factIds),
    items: new Set(cloned.itemIds),
    actors: new Map(cloned.actors.map(actor => [actor.id, actor])),
    deckCounts: cardCounts(cloned.playerRouteState.cards),
  };
}

function createRun(runId: string, rules: RunRules): MutableRun {
  const definition = rules.definition;
  const locations = Object.fromEntries(definition.locationIds.map(id => [
    id,
    { visitCount: id === definition.initialLocationId ? 1 : 0, completed: false },
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
    actorStates: definition.actors.map(actor => ({
      id: actor.id,
      type: actor.type,
      hp: actor.hp.initial,
      resources: Object.fromEntries(Object.entries(actor.resources ?? {}).map(([id, value]) => [id, value.initial])),
    })),
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
    random: { seed: definition.randomSeed ?? 0, cursor: 0 },
  };
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
  private readonly listeners = new Set<OperationLifecycleListener>();

  subscribe(listener: OperationLifecycleListener): () => void {
    this.assertUsable();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(definition: OperationEventDef): EventRun {
    this.assertCanMutate();
    const diagnostics = validateOperationEventDef(definition);
    if (diagnostics.length > 0) throw new OperationRuntimeError(diagnostics);
    this.assertUsable();
    if (this.slot?.run.status === 'inProgress') {
      throw new OperationRuntimeError(['an EventRun is already in progress']);
    }

    let rules: RunRules;
    try {
      rules = defineRules(definition);
    } catch {
      throw new OperationRuntimeError(['event definition must contain only cloneable data']);
    }
    const runId = 'operation-run-' + (++runSequence);
    const run = createRun(runId, rules);
    this.slot = { rules, run, result: null };
    this.publish({ type: 'runStarted', runId, eventId: run.eventId });
    this.publish({ type: 'locationEntered', runId, eventId: run.eventId, locationId: run.currentLocationId });
    return this.getSnapshot()!;
  }

  getSnapshot(): EventRun | null {
    return this.slot ? frozenCopy(this.slot.run) : null;
  }

  getResult(): EventResult | null {
    return this.slot?.result ?? null;
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
    slot.run = next;
    return this.getSnapshot()!;
  }

  enterLocation(locationId: string): EventRun {
    this.assertCanMutate();
    const slot = this.requireActiveRun();
    if (!slot.rules.locations.has(locationId)) {
      throw new OperationRuntimeError(['locationId references an undeclared location: ' + locationId]);
    }
    const next = deepCopy(slot.run);
    next.currentLocationId = locationId;
    next.locationProgress[locationId].visitCount += 1;
    slot.run = next;
    this.publish({ type: 'locationEntered', runId: next.runId, eventId: next.eventId, locationId });
    return this.getSnapshot()!;
  }

  completeCurrentLocation(): EventRun {
    this.assertCanMutate();
    const slot = this.requireActiveRun();
    const locationId = slot.run.currentLocationId;
    if (slot.run.locationProgress[locationId].completed) return this.getSnapshot()!;
    const next = deepCopy(slot.run);
    next.locationProgress[locationId].completed = true;
    slot.run = next;
    this.publish({ type: 'locationCompleted', runId: next.runId, eventId: next.eventId, locationId });
    return this.getSnapshot()!;
  }

  finish(kind: OperationResultKind): EventResult {
    this.assertCanMutate();
    const slot = this.slot;
    if (slot?.result) return slot.result;
    const active = this.requireActiveRun();
    if (!['success', 'partialSuccess', 'failure'].includes(kind)) {
      throw new OperationRuntimeError(['result kind is invalid']);
    }
    active.run.status = kind as OperationRunStatus;
    const result = frozenCopy({
      eventId: active.run.eventId,
      runId: active.run.runId,
      kind,
      finalRun: active.run,
    }) as EventResult;
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
