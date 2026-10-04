import { describe, expect, test, vi } from 'vitest';
import type { OperationEventDef, OperationRunStartInput, OperationStateDelta } from '../../src/arona-clicker/contracts/operation';
import type { OperationActionDef, OperationActionEffectDef } from '../../src/arona-clicker/contracts/operation-action';
import type { OperationContentResolver } from '../../src/arona-clicker/contracts/operation-content-resolver';
import { validateOperationEventDef } from '../../src/arona-clicker/services/operation-definition-validation';
import { validateOperationActionDef } from '../../src/arona-clicker/services/operation-tactical-definition-validation';
import { OperationRuntimeError, OperationRuntimeService } from '../../src/arona-clicker/services/operation-runtime-service';
import { createOperationEntry } from '../../src/arona-clicker/services/operation-entry-service';

function eventDef(): OperationEventDef {
  return {
    id: 'test:operation:office',
    locationIds: ['test:location:office', 'test:location:archive'],
    initialLocationId: 'test:location:office',
    tracks: [{ id: 'danger', initial: 1, min: 0, max: 5 }],
    factIds: ['door_open'],
    knownFactIds: [],
    itemIds: ['archive_key'],
    heldItemIds: [],
    actors: [{
      id: 'test:actor:student',
      type: 'student',
      hp: { initial: 4, min: 0, max: 4 },
      resources: { focus: { initial: 2, min: 0, max: 3 } },
    }],
    playerRouteState: {
      playerCost: 2,
      cards: {
        drawPile: ['test:card:inspect'],
        hand: ['test:card:assist'],
        discard: [],
        played: [],
      },
    },
    randomSeed: 17,
  };
}

function tacticalRunStartInput(effects: readonly OperationActionEffectDef[] = [
  { kind: 'eventTrackDelta', trackId: 'danger', amount: -1 },
]): OperationRunStartInput {
  const actionId = 'test:action:inspect';
  const eventDefinition: OperationEventDef = {
    ...eventDef(),
    locationTactics: [{
      locationId: 'test:location:office',
      enabledActionIds: [actionId],
      combinationRules: [],
    }],
  };
  const action: OperationActionDef = {
    id: actionId,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['test:reason:inspect'],
    tagIds: [],
    target: { kind: 'none' },
    effects,
  };
  return {
    eventDefinition,
    actors: [{
      actorId: 'test:actor:student',
      participantKind: 'student',
      characterId: 'test:character:student',
      profile: {
        id: 'test:profile:student',
        characterId: 'test:character:student',
        candidateActionIds: [actionId],
        actionPriorityIds: [actionId],
        capabilityIds: [],
        reasonIds: [],
        actionCandidates: [{
          actionId,
          eligible: true,
          requiredCapabilityIds: [],
          missingCapabilityIds: [],
          reasonIds: ['test:reason:inspect'],
        }],
        eligibleActionIds: [actionId],
      },
    }],
    actionDefinitions: [action],
    studentSkillRules: [],
  };
}

function operationEntryFor(owner: OperationRuntimeService) {
  const resolver: OperationContentResolver = { resolve: () => null };
  return createOperationEntry({ owner, resolver }).facade;
}

describe('validateOperationEventDef', () => {
  test('accepts a complete definition with valid initial references', () => {
    expect(validateOperationEventDef(eventDef())).toEqual([]);
  });

  test('rejects invalid definitions with diagnostics and leaves no partial Run', () => {
    const invalid = {
      ...eventDef(),
      initialLocationId: 'test:location:missing',
      tracks: [{ id: 'danger', initial: 9, min: 0, max: 5 }],
      knownFactIds: ['undeclared_fact'],
      heldItemIds: ['undeclared_item'],
      actors: [{ ...eventDef().actors[0], hp: { initial: 8, min: 0, max: 4 } }],
    } as OperationEventDef;

    const diagnostics = validateOperationEventDef(invalid).join('\n');
    expect(diagnostics).toMatch(/initialLocationId/);
    expect(diagnostics).toMatch(/outside its bounds/);
    expect(diagnostics).toMatch(/undeclared fact/);
    expect(diagnostics).toMatch(/undeclared item/);
  });

  test('accepts any non-negative finite PlayerCost without an event-level cap', () => {
    const definition = eventDef();
    const uncapped: OperationEventDef = {
      ...definition,
      playerRouteState: { ...definition.playerRouteState, playerCost: 1000 },
    };
    expect(validateOperationEventDef(uncapped)).toEqual([]);
    const service = new OperationRuntimeService();
    expect(service.start(uncapped).playerRouteState).toEqual({
      playerCost: 1000,
      cards: { drawPile: ['test:card:inspect'], hand: ['test:card:assist'], discard: [], played: [] },
    });
  });

  test('validates Team definitions, Actor membership, and target preference references', () => {
    const definition: OperationEventDef = {
      ...eventDef(),
      teams: [{
        id: 'test:team:students',
        resources: { coordination: { initial: 2, min: 0, max: 4 } },
      }],
      actors: [{
        ...eventDef().actors[0],
        teamId: 'test:team:students',
        targetPriorityActorIds: ['test:actor:student'],
      }],
    };
    expect(validateOperationEventDef(definition)).toEqual([]);

    const invalid = {
      ...definition,
      teams: [
        ...definition.teams!,
        { id: 'test:team:students', resources: { coordination: { initial: 8, min: 0, max: 4 } } },
      ],
      actors: [{
        ...definition.actors[0],
        teamId: 'test:team:missing',
        targetPriorityActorIds: ['test:actor:missing', 'test:actor:missing'],
      }],
    } as OperationEventDef;
    const diagnostics = validateOperationEventDef(invalid).join('\n');
    expect(diagnostics).toMatch(/duplicate ID/);
    expect(diagnostics).toMatch(/undeclared Team/);
    expect(diagnostics).toMatch(/undeclared Actor ID/);
    expect(diagnostics).toMatch(/duplicate ID/);
  });

  test('validates temporary Location tactical structure and ordered Combination slots', () => {
    const valid: OperationEventDef = {
      ...eventDef(),
      locationTactics: [{
        locationId: 'test:location:office',
        enabledActionIds: ['test:action:assist', 'test:action:repair'],
        combinationRules: [{
          id: 'test:combination:assist-repair',
          priority: 1,
          inputTagIds: ['assist', 'repair'],
          targetMatch: 'same-target',
          effects: [{ kind: 'eventTrackDelta', trackId: 'danger', amount: -1 }],
        }],
      }],
    };
    expect(validateOperationEventDef(valid)).toEqual([]);

    const invalid = {
      ...valid,
      locationTactics: [
        ...valid.locationTactics!,
        {
          locationId: 'test:location:office',
          enabledActionIds: ['test:action:assist', 'test:action:assist'],
          combinationRules: [{
            id: 'test:combination:invalid',
            priority: 1.5,
            inputTagIds: ['assist', 'assist'],
            targetMatch: 'any-target',
            effects: [{ kind: 'eventTrackDelta', trackId: 'test:track:missing', amount: Number.NaN }],
          }],
        },
        {
          locationId: 'test:location:missing',
          enabledActionIds: [],
          combinationRules: [],
        },
      ],
    } as OperationEventDef;
    const diagnostics = validateOperationEventDef(invalid).join('\n');
    expect(diagnostics).toMatch(/duplicate locationId/);
    expect(diagnostics).toMatch(/undeclared Location/);
    expect(diagnostics).toMatch(/duplicate ID/);
    expect(diagnostics).toMatch(/safe integer/);
    expect(diagnostics).toMatch(/two distinct ordered tag IDs/);
    expect(diagnostics).toMatch(/targetMatch/);
    expect(diagnostics).toMatch(/finite number/);
    expect(diagnostics).toMatch(/undeclared track/);
  });

  test('validates the closed OperationAction contract without executing it', () => {
    const valid = {
      id: 'test:action:assist',
      allowedParticipantKinds: ['student'],
      requiredCapabilityIds: ['field_support'],
      reasonIds: ['help_injured'],
      tagIds: ['support'],
      cost: { scope: 'team', resourceId: 'coordination', amount: 1 },
      target: { kind: 'actor', relation: 'sameTeam' },
      effects: [
        { kind: 'actorHpDelta', recipient: 'target', amount: 1 },
        { kind: 'eventTrackDelta', trackId: 'danger', amount: -1 },
      ],
    };
    expect(validateOperationActionDef(valid)).toEqual([]);

    const invalid = {
      ...valid,
      script: 'this must not be executable content',
      allowedParticipantKinds: ['student', 'student', 'ghost'],
      cost: { scope: 'team', resourceId: '', amount: 0 },
      target: { kind: 'actor', relation: 'opposite' },
      effects: [{ kind: 'actorResourceDelta', recipient: 'unknown', resourceId: '', amount: Number.POSITIVE_INFINITY, script: 'nope' }],
    };
    const diagnostics = validateOperationActionDef(invalid).join('\n');
    expect(diagnostics).toMatch(/duplicate ID/);
    expect(diagnostics).toMatch(/unsupported participant kind/);
    expect(diagnostics).toMatch(/cost.resourceId/);
    expect(diagnostics).toMatch(/cost.amount/);
    expect(diagnostics).toMatch(/target.relation/);
    expect(diagnostics).toMatch(/effects\[0\].amount/);
    expect(diagnostics).toMatch(/effects\[0\].recipient/);
    expect(diagnostics).toMatch(/unsupported field: script/);
  });
});

describe('OperationRuntimeService', () => {
  test('rejects invalid definitions without creating a Run', () => {
    const service = new OperationRuntimeService();
    const invalid = { ...eventDef(), initialLocationId: 'test:location:missing' } as OperationEventDef;

    expect(() => service.start(invalid)).toThrow(OperationRuntimeError);
    expect(service.getSnapshot()).toBeNull();
  });

  test('creates independent Run copies from the same definition and returns detached snapshots', () => {
    const definition = eventDef();
    const first = new OperationRuntimeService();
    const second = new OperationRuntimeService();
    const firstRun = first.start(definition);
    const secondRun = second.start(definition);

    expect(firstRun.runId).not.toBe(secondRun.runId);
    (definition.tracks as OperationEventDef['tracks'][number][])[0] = { id: 'danger', initial: 5, min: 0, max: 5 };
    first.applyStateDelta({
      tracks: { danger: 4 },
      knownFacts: [{ id: 'door_open', present: true }],
      heldItems: [{ id: 'archive_key', present: true }],
      actors: [{ actorId: 'test:actor:student', hp: 1, resources: { focus: 0 } }],
      playerRouteState: {
        playerCost: 4,
        cards: { drawPile: [], hand: [], discard: ['test:card:inspect'], played: ['test:card:assist'] },
      },
    });
    first.enterLocation('test:location:archive');

    expect(first.getSnapshot()).toMatchObject({
      eventState: { tracks: { danger: 4 }, knownFactIds: ['door_open'], heldItemIds: ['archive_key'] },
      actorStates: [{ hp: 1, resources: { focus: 0 } }],
      playerRouteState: { playerCost: 4 },
      locationProgress: { 'test:location:archive': { visitCount: 1, completed: false } },
    });
    expect(second.getSnapshot()).toMatchObject({
      eventState: { tracks: { danger: 1 }, knownFactIds: [], heldItemIds: [] },
      actorStates: [{ hp: 4, resources: { focus: 2 } }],
      playerRouteState: { playerCost: 2 },
      locationProgress: { 'test:location:archive': { visitCount: 0, completed: false } },
    });
    const snapshot = first.getSnapshot()!;
    expect(Object.isFrozen(snapshot.eventState.tracks)).toBe(true);
    expect(Object.isFrozen(snapshot.eventState.knownFactIds)).toBe(true);
    expect(() => (snapshot.eventState.knownFactIds as string[]).push('external_write')).toThrow();
  });

  test('initializes bounded Team resources in the detached Run and keeps Team membership explicit', () => {
    const service = new OperationRuntimeService();
    const definition: OperationEventDef = {
      ...eventDef(),
      teams: [{
        id: 'test:team:students',
        resources: { coordination: { initial: 2, min: 0, max: 4 } },
      }],
      actors: [{ ...eventDef().actors[0], teamId: 'test:team:students' }],
    };
    const snapshot = service.start(definition);

    expect(snapshot.teamStates).toEqual([{ id: 'test:team:students', resources: { coordination: 2 } }]);
    expect(snapshot.actorStates[0].teamId).toBe('test:team:students');
    expect(Object.isFrozen(snapshot.teamStates[0].resources)).toBe(true);
    expect(() => (snapshot.teamStates[0].resources as Record<string, number>).coordination = 4).toThrow();
    expect(service.getSnapshot()?.teamStates[0].resources.coordination).toBe(2);
  });

  test('rejects an undeclared Team reference before creating or replacing a Run', () => {
    const invalid: OperationEventDef = {
      ...eventDef(),
      actors: [{ ...eventDef().actors[0], teamId: 'test:team:missing' }],
    };
    const empty = new OperationRuntimeService();
    expect(() => empty.start(invalid)).toThrow(/undeclared Team/);
    expect(empty.getSnapshot()).toBeNull();

    const active = new OperationRuntimeService();
    const before = active.start(eventDef());
    expect(() => active.start(invalid)).toThrow(/undeclared Team/);
    expect(active.getSnapshot()).toEqual(before);
  });

  test('validates a whole state delta before committing any field', () => {
    const service = new OperationRuntimeService();
    service.start(eventDef());
    const before = service.getSnapshot();

    expect(() => service.applyStateDelta({
      tracks: { danger: 4 },
      heldItems: [{ id: 'unknown_item', present: true }],
      actors: [{ actorId: 'test:actor:student', hp: 5 }],
    })).toThrow(OperationRuntimeError);
    expect(service.getSnapshot()).toEqual(before);

    expect(() => service.applyStateDelta({ tracks: { unknown_track: 1 } })).toThrow(/undeclared key/);
    expect(() => service.applyStateDelta({ tracks: { danger: 6 } })).toThrow(/outside its bounds/);
    expect(service.getSnapshot()).toEqual(before);
  });

  test('keeps the finite four-zone card partition intact and validates non-negative finite PlayerCost', () => {
    const service = new OperationRuntimeService();
    service.start(eventDef());
    service.applyStateDelta({
      playerRouteState: {
        playerCost: 50,
        cards: { drawPile: [], hand: [], discard: ['test:card:assist'], played: ['test:card:inspect'] },
      },
    });
    expect(service.getSnapshot()?.playerRouteState).toEqual({
      playerCost: 50,
      cards: { drawPile: [], hand: [], discard: ['test:card:assist'], played: ['test:card:inspect'] },
    });

    const before = service.getSnapshot();
    expect(() => service.applyStateDelta({
      playerRouteState: {
        playerCost: -1,
      },
    })).toThrow(OperationRuntimeError);
    expect(() => service.applyStateDelta({ playerRouteState: { playerCost: Number.POSITIVE_INFINITY } })).toThrow(OperationRuntimeError);
    expect(service.getSnapshot()).toEqual(before);
  });

  test('rejects malformed membership and actor containers and null entries atomically', () => {
    const malformedDeltas: unknown[] = [
      { knownFacts: {} },
      { knownFacts: [null] },
      { heldItems: 'archive_key' },
      { heldItems: [null] },
      { actors: {} },
      { actors: [null] },
    ];

    const service = new OperationRuntimeService();
    service.start(eventDef());
    for (const malformed of malformedDeltas) {
      const before = service.getSnapshot();
      expect(() => service.applyStateDelta(malformed as OperationStateDelta)).toThrow(OperationRuntimeError);
      expect(service.getSnapshot()).toEqual(before);
    }
  });

  test('publishes only Run and Location lifecycle boundaries', () => {
    const service = new OperationRuntimeService();
    const events: string[] = [];
    const unsubscribe = service.subscribe(event => events.push(event.type));

    service.start(eventDef());
    service.applyStateDelta({ tracks: { danger: 2 }, knownFacts: [{ id: 'door_open', present: true }] });
    service.completeCurrentLocation();
    service.enterLocation('test:location:archive');
    unsubscribe();
    service.completeCurrentLocation();

    expect(events).toEqual(['runStarted', 'locationEntered', 'locationCompleted', 'locationEntered']);
    expect(service.getSnapshot()?.locationProgress).toMatchObject({
      'test:location:office': { visitCount: 1, completed: true },
      'test:location:archive': { visitCount: 1, completed: true },
    });
  });

  test('returns an immutable terminal result once and rejects further transitions', () => {
    const service = new OperationRuntimeService();
    const listener = vi.fn();
    service.subscribe(listener);
    service.start(eventDef());

    const result = service.finish('partialSuccess');
    expect(result).toMatchObject({
      eventId: 'test:operation:office',
      kind: 'partialSuccess',
      finalRun: { status: 'partialSuccess' },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.finalRun.eventState.tracks)).toBe(true);
    expect(service.finish('failure')).toBe(result);
    expect(listener.mock.calls.filter(([event]) => event.type === 'runFinished')).toHaveLength(1);
    expect(() => service.applyStateDelta({ tracks: { danger: 2 } })).toThrow(/terminal/);
    expect(() => service.enterLocation('test:location:archive')).toThrow(/terminal/);
  });

  test('contains listener errors and continues notifying after committed transitions', () => {
    const service = new OperationRuntimeService();
    const received: string[] = [];
    service.subscribe(() => {
      throw new Error('observer failed');
    });
    service.subscribe(event => received.push(event.type));

    expect(service.start(eventDef()).status).toBe('inProgress');
    expect(service.finish('success').kind).toBe('success');
    expect(received).toEqual(['runStarted', 'locationEntered', 'runFinished']);
  });

  test('commits one Beat atomically, notifies after the swap, and retries without another write', () => {
    const owner = new OperationRuntimeService();
    const entry = operationEntryFor(owner);
    const notifications: { readonly event: unknown; readonly snapshot: ReturnType<OperationRuntimeService['getSnapshot']> }[] = [];
    let reentryWasRejected = false;
    owner.subscribe(event => {
      if (event.type !== 'beatResolved') return;
      notifications.push({ event, snapshot: owner.getSnapshot() });
      expect(() => owner.applyStateDelta({ tracks: { danger: 2 } })).toThrow(OperationRuntimeError);
      reentryWasRejected = true;
      throw new Error('observer failure cannot undo a committed Beat');
    });
    const startInput = tacticalRunStartInput();
    const started = owner.start(startInput);
    (startInput.actionDefinitions as OperationActionDef[])[0] = {
      ...startInput.actionDefinitions[0],
      effects: [{ kind: 'eventTrackDelta', trackId: 'danger', amount: 3 }],
    };
    expect(Object.isFrozen(startInput.actionDefinitions[0])).toBe(false);
    expect(started).toMatchObject({
      planVersion: 0,
      beatIndex: 0,
      preparedBeat: { planVersion: 0, actorPlans: [{ kind: 'studentAction', actionId: 'test:action:inspect' }] },
      resolutions: [],
    });

    const resolution = entry.commitBeat({ runId: started.runId, planVersion: 0 });
    const committed = owner.getSnapshot()!;
    expect(resolution).toMatchObject({
      basePlanVersion: 0,
      resolutionSequence: 1,
      numericChanges: [{ target: { kind: 'track', trackId: 'danger' }, before: 1, after: 0, delta: -1 }],
    });
    expect(committed).toMatchObject({
      planVersion: 1,
      beatIndex: 1,
      eventState: { tracks: { danger: 0 } },
      resolutions: [resolution],
      resolutionSequence: 1,
      preparedBeat: { planVersion: 1 },
      random: { seed: 17, tacticalCursor: 0 },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].event).toMatchObject({ type: 'beatResolved', basePlanVersion: 0, resolutionSequence: 1 });
    expect(notifications[0].snapshot).toEqual(committed);
    expect(reentryWasRejected).toBe(true);

    const retry = entry.commitBeat({ runId: started.runId, planVersion: 0 });
    expect(retry).toBe(resolution);
    expect(retry).toEqual(resolution);
    expect(owner.getSnapshot()).toEqual(committed);
    expect(notifications).toHaveLength(1);
    expect(() => entry.commitBeat({ runId: started.runId, planVersion: 0, extra: true } as never)).toThrow(OperationRuntimeError);
    owner.finish('success');
    const terminal = owner.getSnapshot();
    expect(entry.commitBeat({ runId: started.runId, planVersion: 0 })).toEqual(resolution);
    expect(owner.getSnapshot()).toEqual(terminal);
    expect(notifications).toHaveLength(1);
    expect(() => entry.commitBeat({ runId: 'other-run', planVersion: 0 })).toThrow(/terminal/);
  });

  test('keeps every Run field and suppresses beatResolved notification when pure planning fails', () => {
    const owner = new OperationRuntimeService();
    const entry = operationEntryFor(owner);
    const listener = vi.fn();
    owner.subscribe(event => { if (event.type === 'beatResolved') listener(event); });
    const start = tacticalRunStartInput([
      { kind: 'eventTrackDelta', trackId: 'danger', amount: Number.MAX_VALUE },
      { kind: 'eventTrackDelta', trackId: 'danger', amount: Number.MAX_VALUE },
    ]);
    const initial = owner.start(start);
    const before = owner.getSnapshot();

    expect(() => entry.commitBeat({ runId: initial.runId, planVersion: initial.planVersion })).toThrow(OperationRuntimeError);
    expect(owner.getSnapshot()).toEqual(before);
    expect(listener).not.toHaveBeenCalled();
  });

  test('retains only the newest 32 Beat resolutions while sequence and beat index keep advancing', () => {
    const owner = new OperationRuntimeService();
    const entry = operationEntryFor(owner);
    const initial = owner.start(tacticalRunStartInput());
    let latestRun = initial;

    for (let index = 0; index < 33; index += 1) {
      entry.commitBeat({ runId: latestRun.runId, planVersion: latestRun.planVersion });
      latestRun = owner.getSnapshot()!;
    }

    expect(latestRun).toMatchObject({ beatIndex: 33, planVersion: 33, resolutionSequence: 33 });
    expect(latestRun.resolutions).toHaveLength(32);
    expect(latestRun.resolutions[0].resolutionSequence).toBe(2);
    expect(latestRun.resolutions.at(-1)?.resolutionSequence).toBe(33);
    expect('nextRandomState' in latestRun.resolutions.at(-1)!).toBe(false);
    expect(() => entry.commitBeat({ runId: latestRun.runId, planVersion: 0 })).toThrow(/stale/);
  });

  test('accepted state and Location writes advance the plan version and rebuild the base plan', () => {
    const service = new OperationRuntimeService();
    const entry = operationEntryFor(service);
    const initial = service.start(tacticalRunStartInput());

    const changed = service.applyStateDelta({ tracks: { danger: 4 } });
    expect(changed).toMatchObject({ planVersion: 1, preparedBeat: { planVersion: 1, locationId: 'test:location:office' } });
    expect(() => entry.commitBeat({ runId: initial.runId, planVersion: 0 })).toThrow(/stale/);

    const entered = service.enterLocation('test:location:archive');
    expect(entered).toMatchObject({ planVersion: 2, preparedBeat: { planVersion: 2, locationId: 'test:location:archive' } });
    const completed = service.completeCurrentLocation();
    expect(completed).toMatchObject({ planVersion: 3, preparedBeat: { planVersion: 3, locationId: 'test:location:archive' } });
    const finished = service.finish('partialSuccess');
    expect(finished.finalRun).toMatchObject({ planVersion: 4, preparedBeat: null, interventionDraft: null });
  });

  test('rejects runtime mutations during lifecycle callbacks without changing the Run', () => {
    const service = new OperationRuntimeService();
    let attempted = false;
    service.subscribe(() => {
      if (attempted) return;
      attempted = true;
      expect(() => service.reset()).toThrow(OperationRuntimeError);
      expect(() => service.dispose()).toThrow(OperationRuntimeError);
      expect(() => service.start(eventDef())).toThrow(OperationRuntimeError);
      expect(() => service.applyStateDelta({ tracks: { danger: 2 } })).toThrow(OperationRuntimeError);
      expect(() => service.enterLocation('test:location:archive')).toThrow(OperationRuntimeError);
      expect(() => service.completeCurrentLocation()).toThrow(OperationRuntimeError);
      expect(() => service.finish('failure')).toThrow(OperationRuntimeError);
    });
    const laterEvents: string[] = [];
    service.subscribe(event => laterEvents.push(event.type));

    const started = service.start(eventDef());
    expect(started.status).toBe('inProgress');
    expect(started.currentLocationId).toBe('test:location:office');
    expect(service.getSnapshot()).toMatchObject({
      runId: started.runId,
      status: 'inProgress',
      currentLocationId: 'test:location:office',
      eventState: { tracks: { danger: 1 } },
      locationProgress: { 'test:location:office': { visitCount: 1, completed: false } },
    });
    expect(laterEvents).toEqual(['runStarted', 'locationEntered']);
  });

  test('reset drops volatile Run data and dispose releases local listeners', () => {
    const service = new OperationRuntimeService();
    const listener = vi.fn();
    service.subscribe(listener);
    service.start(eventDef());
    service.reset();
    expect(service.getSnapshot()).toBeNull();
    service.start(eventDef());
    service.dispose();
    expect(service.getSnapshot()).toBeNull();
    expect(() => service.start(eventDef())).toThrow(/disposed/);
    expect(listener.mock.calls.filter(([event]) => event.type === 'runStarted')).toHaveLength(2);
  });
});
