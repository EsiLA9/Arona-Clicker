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
    locations: [{ id: 'test:location:office', enabledActionIds: [], combinationRules: [], routeEdges: [] }, { id: 'test:location:archive', enabledActionIds: [], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
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
    },
    randomSeed: 17,
  };
}

function eventDefWithSceneDeck(): OperationEventDef {
  return {
    ...eventDef(),
    playerSceneDeck: {
      cards: [
        { id: 'test:card:inspect', actionId: 'test:action:inspect', playerCost: 0, timing: 'scene', copies: 1 },
        { id: 'test:card:assist', actionId: 'test:action:inspect', playerCost: 0, timing: 'scene', copies: 1 },
      ],
      initialDraw: 2,
      locationEntryDraw: 0,
      maxHandSize: 2,
    },
  };
}

function eventDefWithArchiveRoute(): OperationEventDef {
  const definition = eventDef();
  return {
    ...definition,
    locations: definition.locations.map(location => location.id === 'test:location:office'
      ? { ...location, routeEdges: [{
        id: 'test:route:office-archive',
        targetLocationId: 'test:location:archive',
        label: 'Open the archive',
        description: 'Continue into the archive.',
      }] }
      : location),
  };
}

function tacticalRunStartInput(effects: readonly OperationActionEffectDef[] = [
  { kind: 'eventTrackDelta', trackId: 'danger', amount: -1 },
]): OperationRunStartInput {
  const actionId = 'test:action:inspect';
  const eventDefinition: OperationEventDef = {
    ...eventDef(),
    locations: [{ id: 'test:location:office', enabledActionIds: [actionId], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
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
    const uncappedRun = service.start(uncapped);
    expect(uncappedRun.playerRouteState.playerCost).toBe(1000);
    expect(uncappedRun.playerRouteState.cards).toEqual({ drawPile: [], hand: [], discard: [] });
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
      locations: [{ id: 'test:location:office', enabledActionIds: ['test:action:assist', 'test:action:repair'], combinationRules: [{
          id: 'test:combination:assist-repair',
          priority: 1,
          inputTagIds: ['assist', 'repair'],
          targetMatch: 'same-target',
          effects: [{ kind: 'eventTrackDelta', trackId: 'danger', amount: -1 }],
        }], routeEdges: [] } ], maxLocationVisits: 20,
    };
    expect(validateOperationEventDef(valid)).toEqual([]);

    const invalid = {
      ...valid,
      locations: [
        ...valid.locations!,
        {
          id: 'test:location:office',
          enabledActionIds: ['test:action:assist', 'test:action:assist'],
          combinationRules: [{
            id: 'test:combination:invalid',
            priority: 1.5,
            inputTagIds: ['assist', 'assist'],
            targetMatch: 'any-target',
            effects: [{ kind: 'eventTrackDelta', trackId: 'test:track:missing', amount: Number.NaN }],
          }],
          routeEdges: [],
        },
        {
          id: 'test:location:missing',
          enabledActionIds: [],
          combinationRules: [],
          routeEdges: [],
        },
      ],
    } as OperationEventDef;
    const diagnostics = validateOperationEventDef(invalid).join('\n');
    expect(diagnostics).toMatch(/duplicate ID/);
    expect(diagnostics).toMatch(/duplicate ID/);
    expect(diagnostics).toMatch(/safe integer/);
    expect(diagnostics).toMatch(/two distinct ordered tag IDs/);
    expect(diagnostics).toMatch(/targetMatch/);
    expect(diagnostics).toMatch(/finite number/);
    expect(diagnostics).toMatch(/undeclared track/);
  });

  test('validates Route targets and the single held-item gate contract', () => {
    const definition = eventDef();
    const valid: OperationEventDef = {
      ...definition,
      locations: definition.locations.map(location => location.id === 'test:location:office'
        ? {
          ...location,
          routeEdges: [{
            id: 'test:route:staff-only',
            targetLocationId: 'test:location:archive',
            label: 'Staff access',
            description: 'Use the archive key.',
            requiredHeldItemId: 'archive_key',
            consumeRequiredHeldItem: true,
          }],
        }
        : location),
    };
    expect(validateOperationEventDef(valid)).toEqual([]);

    const invalid: OperationEventDef = {
      ...valid,
      locations: valid.locations.map(location => location.id === 'test:location:office'
        ? {
          ...location,
          routeEdges: [{
            id: 'test:route:broken',
            targetLocationId: 'test:location:missing',
            label: 'Broken route',
            description: 'References undeclared content.',
            requiredHeldItemId: 'test:item:missing',
            consumeRequiredHeldItem: true,
          }],
        }
        : location),
    };
    const diagnostics = validateOperationEventDef(invalid).join('\n');
    expect(diagnostics).toMatch(/targetLocationId references an undeclared Location/);
    expect(diagnostics).toMatch(/requiredHeldItemId references an undeclared item/);
  });

  test('validates bounded objective predicates and their declared Event references', () => {
    const definition: OperationEventDef = {
      ...eventDef(),
      objectives: [{
        id: 'test:objective:door-and-danger',
        description: 'Open the archive before danger rises',
        kind: 'primary',
        predicate: {
          kind: 'all',
          terms: [
            { kind: 'knownFact', factId: 'door_open', present: true },
            { kind: 'track', trackId: 'danger', operator: 'lt', value: 4 },
          ],
        },
      }],
      partialOutcomes: [{
        id: 'test:outcome:door-open',
        description: 'Open the archive without resolving the danger',
        predicate: { kind: 'knownFact', factId: 'door_open', present: true },
      }],
      hardFailureConditions: [{
        id: 'test:failure:danger',
        description: 'Danger reached the limit',
        predicate: { kind: 'track', trackId: 'danger', operator: 'gte', value: 5 },
      }],
    };
    expect(validateOperationEventDef(definition)).toEqual([]);

    const invalid = {
      ...definition,
      objectives: [{
        ...definition.objectives![0],
        predicate: { kind: 'any', terms: [{ kind: 'track', trackId: 'missing', operator: 'gt', value: 1 }] },
      }],
    } as OperationEventDef;
    expect(validateOperationEventDef(invalid).join('\n')).toMatch(/references an undeclared track/);
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
        { kind: 'eventFact', factId: 'door_open', op: 'reveal' },
        { kind: 'heldItem', itemId: 'archive_key', op: 'grant' },
      ],
    };
    expect(validateOperationActionDef(valid)).toEqual([]);

    const invalid = {
      ...valid,
      effects: [
        { kind: 'actorResourceDelta', recipient: 'unknown', resourceId: '', amount: Number.POSITIVE_INFINITY, script: 'nope' },
        { kind: 'heldItem', itemId: 'archive_key', op: 'consume' },
      ],
      script: 'this must not be executable content',
      allowedParticipantKinds: ['student', 'student', 'ghost'],
      cost: { scope: 'team', resourceId: '', amount: 0 },
      target: { kind: 'actor', relation: 'opposite' },
    };
    const diagnostics = validateOperationActionDef(invalid).join('\n');
    expect(diagnostics).toMatch(/duplicate ID/);
    expect(diagnostics).toMatch(/unsupported participant kind/);
    expect(diagnostics).toMatch(/cost.resourceId/);
    expect(diagnostics).toMatch(/cost.amount/);
    expect(diagnostics).toMatch(/target.relation/);
    expect(diagnostics).toMatch(/effects\[0\].amount/);
    expect(diagnostics).toMatch(/effects\[0\].recipient/);
    expect(diagnostics).toMatch(/effects\[1\].op must be grant or remove/);
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
      },
    });
    expect(first.getSnapshot()).toMatchObject({
      eventState: { tracks: { danger: 4 }, knownFactIds: ['door_open'], heldItemIds: ['archive_key'] },
      actorStates: [{ hp: 1, resources: { focus: 0 } }],
      playerRouteState: { playerCost: 4 },
      locationProgress: { 'test:location:archive': { visitCount: 0, completed: false } },
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

  test('keeps the finite three-zone card partition intact and validates non-negative finite PlayerCost', () => {
    const service = new OperationRuntimeService();
    const initial = service.start(eventDefWithSceneDeck());
    const cards = [...initial.playerRouteState.cards.hand];
    service.applyStateDelta({
      playerRouteState: {
        playerCost: 50,
        cards: { drawPile: [], hand: [], discard: cards },
      },
    });
    expect(service.getSnapshot()?.playerRouteState).toEqual({
      playerCost: 50,
      cards: { drawPile: [], hand: [], discard: cards },
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

    service.start(eventDefWithArchiveRoute());
    service.applyStateDelta({ tracks: { danger: 2 }, knownFacts: [{ id: 'door_open', present: true }] });
    service.completeCurrentLocation();
    expect(service.getSnapshot()?.currentLocationId).toBe('test:location:archive');
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
    service.start({
      ...eventDef(),
      partialOutcomes: [{
        id: 'test:outcome:found-door',
        description: 'The archive door was opened',
        predicate: { kind: 'knownFact', factId: 'door_open', present: true },
      }],
    });
    service.applyStateDelta({ knownFacts: [{ id: 'door_open', present: true }] });
    service.completeCurrentLocation();

    const result = service.finish();
    expect(result).toMatchObject({
      eventId: 'test:operation:office',
      kind: 'partialSuccess',
      finalRun: { status: 'partialSuccess' },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.finalRun.eventState.tracks)).toBe(true);
    expect(service.finish()).toBe(result);
    expect(listener.mock.calls.filter(([event]) => event.type === 'runFinished')).toHaveLength(1);
    expect(() => service.applyStateDelta({ tracks: { danger: 2 } })).toThrow(/terminal/);
    const terminalRun = service.getSnapshot()!;
    expect(() => service.transitionRoute({ runId: terminalRun.runId, planVersion: terminalRun.planVersion, routeId: 'test:route:office-archive' })).toThrow(/terminal/);
  });

  test('routes through one versioned entry, consumes held items, loops, and respects the visit cap', () => {
    const definition = eventDef();
    const routed: OperationEventDef = {
      ...definition,
      maxLocationVisits: 4,
      locations: [
        {
          ...definition.locations[0],
          routeEdges: [
            {
              id: 'test:route:office-archive',
              targetLocationId: 'test:location:archive',
              label: 'Staff entrance',
              description: 'Use the archive key to enter.',
              requiredHeldItemId: 'archive_key',
              consumeRequiredHeldItem: true,
            },
            {
              id: 'test:route:office-exit',
              targetLocationId: 'test:location:exit',
              label: 'Public exit',
              description: 'Leave through the public path.',
            },
          ],
        },
        {
          ...definition.locations[1],
          routeEdges: [{
            id: 'test:route:archive-loop',
            targetLocationId: 'test:location:office',
            label: 'Return to the office',
            description: 'Loop back to the central location.',
          }],
        },
        {
          id: 'test:location:exit', enabledActionIds: [], combinationRules: [],
          routeEdges: [{
            id: 'test:route:exit-loop',
            targetLocationId: 'test:location:office',
            label: 'Walk back',
            description: 'Return to the start.',
          }],
        },
      ],
    };
    const service = new OperationRuntimeService();
    const tacticalStart = tacticalRunStartInput();
    const started = service.start({ ...tacticalStart, eventDefinition: routed });
    expect(() => service.transitionRoute({ runId: started.runId, planVersion: 0, routeId: 'test:route:office-exit' }))
      .toThrow(/unavailable/);
    expect(service.getSnapshot()).toEqual(started);

    service.applyStateDelta({ heldItems: [{ id: 'archive_key', present: true }] });
    const ready = service.completeCurrentLocation();
    expect(ready.currentLocationId).toBe('test:location:office');
    expect(service.getView()?.currentRoutes.map(route => route.available)).toEqual([true, true]);
    expect(() => service.transitionRoute({
      runId: ready.runId,
      planVersion: ready.planVersion - 1,
      routeId: 'test:route:office-archive',
    })).toThrow(/stale/);
    expect(service.getSnapshot()).toEqual(ready);
    const inArchive = service.transitionRoute({
      runId: ready.runId,
      planVersion: ready.planVersion,
      routeId: 'test:route:office-archive',
    });
    expect(inArchive).toMatchObject({
      currentLocationId: 'test:location:archive',
      eventState: { heldItemIds: [] },
      routeHistory: [{ fromLocationId: 'test:location:office', fromLocationResult: 'success', routeId: 'test:route:office-archive', toLocationId: 'test:location:archive', consumedHeldItemId: 'archive_key' }],
    });

    const backAtOffice = service.completeCurrentLocation();
    expect(backAtOffice).toMatchObject({
      currentLocationId: 'test:location:office',
      routeHistory: [
        { routeId: 'test:route:office-archive' },
        { routeId: 'test:route:archive-loop' },
      ],
    });
    const atExit = service.completeCurrentLocation();
    expect(atExit).toMatchObject({ currentLocationId: 'test:location:exit', routeHistory: [{}, {}, {}] });
    expect(service.getView()).toMatchObject({ totalLocationVisits: 4, maxLocationVisits: 4 });
    const resultRun = service.completeCurrentLocation();
    expect(resultRun.status).toBe('failure');
    expect(service.getView()?.currentRoutes).toEqual([
      expect.objectContaining({ routeId: 'test:route:exit-loop', available: false, lockedReason: 'operation:route:max-visits-reached' }),
    ]);
  });

  test('contains listener errors and continues notifying after committed transitions', () => {
    const service = new OperationRuntimeService();
    const received: string[] = [];
    service.subscribe(() => {
      throw new Error('observer failed');
    });
    service.subscribe(event => received.push(event.type));

    expect(service.start({
      ...eventDef(),
      objectives: [{
        id: 'test:objective:initial-danger',
        description: 'Keep danger below the track limit',
        kind: 'primary',
        predicate: { kind: 'track', trackId: 'danger', operator: 'lte', value: 5 },
      }],
    }).status).toBe('inProgress');
    service.completeCurrentLocation();
    expect(service.finish().kind).toBe('success');
    expect(received).toEqual(['runStarted', 'locationEntered', 'locationCompleted', 'runFinished']);
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
    owner.completeCurrentLocation();
    owner.finish();
    const terminal = owner.getSnapshot();
    expect(entry.commitBeat({ runId: started.runId, planVersion: 0 })).toEqual(resolution);
    expect(owner.getSnapshot()).toEqual(terminal);
    expect(notifications).toHaveLength(1);
    expect(() => entry.commitBeat({ runId: 'other-run', planVersion: 0 })).toThrow(/terminal/);
  });

  test('commits fact and held-item Action effects once and marks the Location objective from that result', () => {
    const owner = new OperationRuntimeService();
    const entry = operationEntryFor(owner);
    const startInput = tacticalRunStartInput([
      { kind: 'eventFact', factId: 'door_open', op: 'reveal' },
      { kind: 'heldItem', itemId: 'archive_key', op: 'grant' },
      { kind: 'heldItem', itemId: 'archive_key', op: 'grant' },
    ]);
    const tactics = startInput.eventDefinition.locations![0];
    const eventDefinition: OperationEventDef = {
      ...startInput.eventDefinition,
      locations: [{
        ...tactics,
        objectives: [{
          id: 'test:objective:open-archive',
          description: 'Open the archive door',
          kind: 'primary',
          predicate: { kind: 'knownFact', factId: 'door_open', present: true },
        }],
      } ], maxLocationVisits: 20,
    };
    const started = owner.start({ ...startInput, eventDefinition });

    const resolution = entry.commitBeat({ runId: started.runId, planVersion: started.planVersion });
    expect(resolution.membershipChanges).toEqual([
      { target: { kind: 'knownFact', id: 'door_open' }, before: false, after: true },
      { target: { kind: 'heldItem', id: 'archive_key' }, before: false, after: true },
    ]);
    expect(owner.getSnapshot()).toMatchObject({
      eventState: { knownFactIds: ['door_open'], heldItemIds: ['archive_key'] },
      locationProgress: {
        'test:location:office': { visitCount: 1, beatCount: 1, completed: true, result: 'success' },
      },
      preparedBeat: null,
    });
    expect(owner.getView()).toMatchObject({
      heldItemIds: ['archive_key'],
      currentLocationObjectives: [{ id: 'test:objective:open-archive', achieved: true }],
    });
  });

  test('computes Event outcomes from declared predicates and hard failure interrupts the Run', () => {
    const success = new OperationRuntimeService();
    success.start({
      ...eventDef(),
      objectives: [{
        id: 'test:objective:danger-contained',
        description: 'Keep danger under control',
        kind: 'primary',
        predicate: { kind: 'track', trackId: 'danger', operator: 'lte', value: 1 },
      }],
    });
    success.completeCurrentLocation();
    expect(success.finish().kind).toBe('success');

    const failed = new OperationRuntimeService();
    failed.start({
      ...eventDef(),
      objectives: [{
        id: 'test:objective:door-open',
        description: 'Open the door',
        kind: 'primary',
        predicate: { kind: 'track', trackId: 'danger', operator: 'lt', value: 1 },
      }],
      partialOutcomes: [{
        id: 'test:outcome:clue-found',
        description: 'Recover the clue',
        predicate: { kind: 'knownFact', factId: 'door_open', present: true },
      }],
    });
    failed.completeCurrentLocation();
    expect(failed.finish().kind).toBe('failure');

    const partial = new OperationRuntimeService();
    partial.start({
      ...eventDef(),
      objectives: [{
        id: 'test:objective:door-open',
        description: 'Open the door',
        kind: 'primary',
        predicate: { kind: 'track', trackId: 'danger', operator: 'lt', value: 1 },
      }],
      partialOutcomes: [{
        id: 'test:outcome:clue-found',
        description: 'Recover the clue',
        predicate: { kind: 'knownFact', factId: 'door_open', present: true },
      }],
    });
    partial.applyStateDelta({ knownFacts: [{ id: 'door_open', present: true }] });
    partial.completeCurrentLocation();
    expect(partial.finish().kind).toBe('partialSuccess');

    const hardFailure = new OperationRuntimeService();
    const startInput = tacticalRunStartInput([{ kind: 'eventTrackDelta', trackId: 'danger', amount: 4 }]);
    const eventDefinition: OperationEventDef = {
      ...startInput.eventDefinition,
      hardFailureConditions: [{
        id: 'test:failure:danger-overflow',
        description: 'Danger reaches the limit',
        predicate: { kind: 'track', trackId: 'danger', operator: 'gte', value: 5 },
      }],
    };
    const started = hardFailure.start({ ...startInput, eventDefinition });
    const entry = operationEntryFor(hardFailure);
    entry.commitBeat({ runId: started.runId, planVersion: started.planVersion });
    expect(hardFailure.getSnapshot()).toMatchObject({ status: 'failure', eventState: { tracks: { danger: 5 } } });
    expect(hardFailure.getResult()?.kind).toBe('failure');
    expect(() => hardFailure.applyStateDelta({ tracks: { danger: 4 } })).toThrow(/terminal/);
  });

  test('Location Beat cap records a local failure without ending the Event', () => {
    const owner = new OperationRuntimeService();
    const entry = operationEntryFor(owner);
    const startInput = tacticalRunStartInput();
    const tactics = startInput.eventDefinition.locations[0];
    const started = owner.start({
      ...startInput,
      eventDefinition: {
        ...startInput.eventDefinition,
        locations: [
          {
            ...tactics,
            maxBeats: 1,
            routeEdges: [{
              id: 'test:route:office-archive',
              targetLocationId: 'test:location:archive',
              label: 'Continue',
              description: 'Move to the archive.',
            }],
          },
          eventDef().locations[1],
        ],
      },
    });

    entry.commitBeat({ runId: started.runId, planVersion: started.planVersion });
    expect(owner.getSnapshot()).toMatchObject({
      status: 'inProgress',
      currentLocationId: 'test:location:archive',
      locationProgress: {
        'test:location:office': { visitCount: 1, beatCount: 1, completed: true, result: 'failure' },
      },
      preparedBeat: { planVersion: 2, locationId: 'test:location:archive' },
    });
    expect(owner.getResult()).toBeNull();
  });

  test('keeps every Run field and suppresses beatResolved notification when pure planning fails', () => {
    const owner = new OperationRuntimeService();
    const entry = operationEntryFor(owner);
    const listener = vi.fn();
    owner.subscribe(event => { if (event.type === 'beatResolved') listener(event); });
    const start = tacticalRunStartInput([
      { kind: 'eventTrackDelta', trackId: 'danger', amount: Number.MAX_VALUE },
      { kind: 'eventTrackDelta', trackId: 'danger', amount: Number.MAX_VALUE },
      { kind: 'heldItem', itemId: 'archive_key', op: 'grant' },
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

    const completed = service.completeCurrentLocation();
    expect(completed).toMatchObject({ status: 'failure', planVersion: 3 });
    const finished = service.finish();
    expect(finished.finalRun).toMatchObject({ planVersion: 3, preparedBeat: null, interventionDraft: null });
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
      expect(() => service.transitionRoute({ runId: 'blocked', planVersion: 0, routeId: 'blocked' })).toThrow(OperationRuntimeError);
      expect(() => service.completeCurrentLocation()).toThrow(OperationRuntimeError);
      expect(() => service.finish()).toThrow(OperationRuntimeError);
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
