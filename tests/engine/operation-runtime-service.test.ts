import { describe, expect, test, vi } from 'vitest';
import type { OperationEventDef, OperationStateDelta } from '../../src/arona-clicker/contracts/operation';
import { validateOperationEventDef } from '../../src/arona-clicker/services/operation-definition-validation';
import { OperationRuntimeError, OperationRuntimeService } from '../../src/arona-clicker/services/operation-runtime-service';

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
