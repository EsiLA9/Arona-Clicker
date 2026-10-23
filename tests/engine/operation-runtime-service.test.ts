import { describe, expect, test, vi } from 'vitest';
import type { OperationEventDef, OperationRunStartInput, OperationStateDelta } from '../../src/arona-clicker/contracts/operation/operation';
import type { OperationActionDef, OperationActionEffectDef } from '../../src/arona-clicker/contracts/operation/operation-action';
import type { OperationStudentSkillRuleDef } from '../../src/arona-clicker/contracts/operation/operation-skill';
import type { OperationContentResolver } from '../../src/arona-clicker/contracts/operation/operation-content-resolver';
import { validateOperationEventDef } from '../../src/arona-clicker/services/operation/operation-definition-validation';
import { validateOperationActionDef } from '../../src/arona-clicker/services/operation/operation-tactical-definition-validation';
import { OperationRuntimeError, OperationRuntimeService } from '../../src/arona-clicker/services/operation/operation-runtime-service';
import { createOperationEntry } from '../../src/arona-clicker/services/operation/operation-entry-service';

function eventDef(): OperationEventDef {
  return {
    id: 'test:operation:office',
    locations: [{ id: 'test:location:office', stage: 'combat', enabledActionIds: [], combinationRules: [], routeEdges: [] }, { id: 'test:location:archive', stage: 'combat', enabledActionIds: [], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
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
    locations: [{ id: 'test:location:office', stage: 'combat', enabledActionIds: [actionId], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
  };
  const action: OperationActionDef = {
    id: actionId,
    title: actionId,
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

function tacticalRunStartInputWithAlternateAction(): OperationRunStartInput {
  const base = tacticalRunStartInput();
  const actionId = base.actionDefinitions[0].id;
  const alternateActionId = 'test:action:alternate-inspect';
  const studentActor = base.actors[0];
  if (studentActor.participantKind !== 'student') throw new Error('expected Student Actor fixture');
  const alternateAction: OperationActionDef = {
    ...base.actionDefinitions[0],
    id: alternateActionId,
    effects: [{ kind: 'eventTrackDelta', trackId: 'danger', amount: 1 }],
  };
  const alternateCandidate = {
    actionId: alternateActionId,
    eligible: true,
    requiredCapabilityIds: [],
    missingCapabilityIds: [],
    reasonIds: ['test:reason:inspect'],
  };
  return {
    ...base,
    eventDefinition: {
      ...base.eventDefinition,
      resumeVersion: 1,
      locations: base.eventDefinition.locations.map(location => location.id === 'test:location:office'
        ? { ...location, enabledActionIds: [...location.enabledActionIds, alternateActionId] }
        : location),
    },
    actors: [{
      ...studentActor,
      profile: {
        ...studentActor.profile,
        candidateActionIds: [actionId, alternateActionId],
        actionPriorityIds: [actionId, alternateActionId],
        actionCandidates: [...studentActor.profile.actionCandidates, alternateCandidate],
        eligibleActionIds: [actionId, alternateActionId],
      },
    }],
    actionDefinitions: [...base.actionDefinitions, alternateAction],
  };
}

function unboundedCombatRunStartInput(): OperationRunStartInput {
  const base = tacticalRunStartInput();
  const studentActorId = 'test:actor:student';
  const opponentActorId = 'test:actor:opponent';
  const studentActionId = 'test:action:student-strike';
  const opponentActionId = 'test:action:opponent-intent';
  const studentActor = base.actors[0];
  if (studentActor.participantKind !== 'student') throw new Error('expected Student Actor fixture');
  const studentAction: OperationActionDef = {
    id: studentActionId,
    title: 'Student strike',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'actor', relation: 'any', allowedActorIds: [opponentActorId] },
    effects: [
      { kind: 'actorHpDelta', recipient: 'target', amount: -1 },
      { kind: 'eventFact', factId: 'door_open', op: 'reveal' },
    ],
  };
  const opponentAction: OperationActionDef = {
    id: opponentActionId,
    title: 'Opponent intent',
    allowedParticipantKinds: ['opponent'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [],
  };
  return {
    ...base,
    eventDefinition: {
      ...base.eventDefinition,
      resumeVersion: 1,
      objectives: [{
        id: 'test:objective:complete',
        description: 'Complete the mission after the opponent is defeated.',
        kind: 'primary',
        predicate: { kind: 'knownFact', factId: 'door_open', present: true },
      }],
      actors: [
        ...base.eventDefinition.actors,
        { id: opponentActorId, type: 'opponent', hp: { initial: 3, min: 0, max: 3 } },
      ],
      locations: [{
        ...base.eventDefinition.locations[0],
        enabledActionIds: [studentActionId, opponentActionId],
        objectives: [{
          id: 'test:objective:secondary',
          description: 'This optional objective does not gate Location completion.',
          kind: 'secondary',
          predicate: { kind: 'track', trackId: 'danger', operator: 'eq', value: 1 },
        }],
        routeEdges: [],
      }],
    },
    actors: [
      {
        ...studentActor,
        profile: {
          ...studentActor.profile,
          candidateActionIds: [studentActionId],
          actionPriorityIds: [studentActionId],
          actionCandidates: [{
            actionId: studentActionId,
            eligible: true,
            requiredCapabilityIds: [],
            missingCapabilityIds: [],
            reasonIds: [],
          }],
          eligibleActionIds: [studentActionId],
        },
      },
      { actorId: opponentActorId, participantKind: 'opponent', candidateActionIds: [opponentActionId] },
    ],
    actionDefinitions: [studentAction, opponentAction],
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

  test('allows a missing SceneAction batch limit while retaining explicit positive-limit validation', () => {
    const definition = eventDef();
    const location = definition.locations[0];
    const unboundedLocation: OperationEventDef['locations'][number] = {
      ...location,
      stage: 'scene',
      actionMode: 'individual',
      sceneActions: [{ id: 'inspect', actionId: 'test:action:inspect', scope: 'individual', playerCost: 0 }],
      objectives: [{
        id: 'scene-exit', description: 'The scene has a declared Location exit.', kind: 'primary',
        predicate: { kind: 'track', trackId: 'danger', operator: 'gte', value: 0 },
      }],
    };
    const unbounded: OperationEventDef = {
      ...definition,
      locations: [unboundedLocation, ...definition.locations.slice(1)],
    };
    expect(validateOperationEventDef(unbounded)).toEqual([]);

    for (const sceneActionBatches of [0, -1, Number.POSITIVE_INFINITY]) {
      const invalid: OperationEventDef = {
        ...unbounded,
        locations: [{ ...unboundedLocation, sceneActionBatches }, ...definition.locations.slice(1)],
      };
      expect(validateOperationEventDef(invalid).join('\n')).toMatch(/sceneActionBatches must be a positive safe integer/);
    }
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
      locations: [{ id: 'test:location:office', stage: 'combat', enabledActionIds: ['test:action:assist', 'test:action:repair'], combinationRules: [{
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
          stage: 'combat',
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
          stage: 'combat',
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
      title: 'Assist',
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

  test('continues an uncapped combat across explicit Beats and completes when its last enabled opponent falls', () => {
    const owner = new OperationRuntimeService();
    const entry = operationEntryFor(owner);
    let run = owner.start(unboundedCombatRunStartInput());

    for (let beat = 1; beat <= 2; beat += 1) {
      entry.commitBeat({ runId: run.runId, planVersion: run.planVersion });
      run = owner.getSnapshot()!;
      expect(run.beatIndex).toBe(beat);
      expect(run.actorStates.find(actor => actor.id === 'test:actor:opponent')?.hp).toBe(3 - beat);
      expect(run.locationProgress['test:location:office']).toMatchObject({ completed: false, result: null });
      expect(run.preparedBeat).not.toBeNull();
    }

    entry.commitBeat({ runId: run.runId, planVersion: run.planVersion });
    run = owner.getSnapshot()!;
    expect(run.beatIndex).toBe(3);
    expect(run.actorStates.find(actor => actor.id === 'test:actor:opponent')?.hp).toBe(0);
    expect(run.locationProgress['test:location:office']).toMatchObject({ completed: true, result: 'success', beatCount: 3 });
    expect(run).toMatchObject({ status: 'success', preparedBeat: null });
    expect(owner.getResult()?.kind).toBe('success');
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
    expect(service.getSnapshot()?.currentLocationId).toBe('test:location:office');
    const completedOffice = service.getSnapshot()!;
    service.transitionRoute({ runId: completedOffice.runId, planVersion: completedOffice.planVersion, routeId: 'test:route:office-archive' });
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
          id: 'test:location:exit', stage: 'scene', enabledActionIds: [], combinationRules: [],
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

    const archiveCompleted = service.completeCurrentLocation();
    expect(archiveCompleted.currentLocationId).toBe('test:location:archive');
    const backAtOffice = service.transitionRoute({
      runId: archiveCompleted.runId,
      planVersion: archiveCompleted.planVersion,
      routeId: 'test:route:archive-loop',
    });
    expect(backAtOffice).toMatchObject({
      currentLocationId: 'test:location:office',
      routeHistory: [
        { routeId: 'test:route:office-archive' },
        { routeId: 'test:route:archive-loop' },
      ],
    });
    expect(backAtOffice.routeHistory.map(record => record.timelineSequence)).toEqual([
      ...backAtOffice.routeHistory.map(record => record.timelineSequence),
    ].sort((left, right) => left - right));
    expect(new Set([
      ...backAtOffice.routeHistory.map(record => record.timelineSequence),
      ...(backAtOffice.locationEntryCostHistory ?? []).map(record => record.timelineSequence),
      ...backAtOffice.resolutions.map(record => record.timelineSequence),
    ]).size).toBe(backAtOffice.routeHistory.length
      + (backAtOffice.locationEntryCostHistory ?? []).length
      + backAtOffice.resolutions.length);
    const officeCompleted = service.completeCurrentLocation();
    const atExit = service.transitionRoute({
      runId: officeCompleted.runId,
      planVersion: officeCompleted.planVersion,
      routeId: 'test:route:office-exit',
    });
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

  test('fails a Combat Run when every Character is down and no Beat can continue', () => {
    const service = new OperationRuntimeService();
    const started = service.start(tacticalRunStartInput());
    expect(started.status).toBe('inProgress');
    service.applyStateDelta({ actors: [{ actorId: 'test:actor:student', hp: 0 }] });
    const defeated = service.getSnapshot()!;

    const resolution = service.commitBeat({ runId: defeated.runId, planVersion: defeated.planVersion });

    expect(resolution.actorPlans).toContainEqual(expect.objectContaining({
      actorId: 'test:actor:student',
      kind: 'wait',
    }));
    expect(service.getSnapshot()).toMatchObject({
      status: 'failure',
      preparedBeat: null,
      locationProgress: { 'test:location:office': { completed: true, result: 'failure' } },
    });
    expect(service.finish().kind).toBe('failure');
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

  test('rejects a direct tactical Beat commit in a Scene Location without changing the Run', () => {
    const owner = new OperationRuntimeService();
    const entry = operationEntryFor(owner);
    const observed: string[] = [];
    owner.subscribe(event => observed.push(event.type));
    const tactical = tacticalRunStartInput();
    const started = owner.start({
      ...tactical,
      eventDefinition: {
        ...tactical.eventDefinition,
        locations: tactical.eventDefinition.locations.map(location => ({ ...location, stage: 'scene' })),
      },
    });
    observed.length = 0;
    expect(started.preparedBeat).not.toBeNull();
    const before = owner.getSnapshot();

    expect(() => entry.commitBeat({ runId: started.runId, planVersion: started.planVersion }))
      .toThrow(/only be committed in a combat Location/);
    expect(owner.getSnapshot()).toEqual(before);
    expect(observed).toEqual([]);
  });

  test('completes ordered Location-local Scenes from committed post-state and resumes the next Scene in place', () => {
    const base = tacticalRunStartInput();
    const student = base.actors[0];
    if (student.participantKind !== 'student') throw new Error('expected Student Actor fixture');
    const firstActionId = base.actionDefinitions[0].id;
    const secondActionId = 'test:action:reveal-door';
    const secondAction: OperationActionDef = {
      ...base.actionDefinitions[0],
      id: secondActionId,
      effects: [{ kind: 'eventFact', factId: 'door_open', op: 'reveal' }],
    };
    const secondCandidate = {
      actionId: secondActionId,
      eligible: true,
      requiredCapabilityIds: [],
      missingCapabilityIds: [],
      reasonIds: ['test:reason:inspect'],
    };
    const office = base.eventDefinition.locations.find(location => location.id === 'test:location:office')!;
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      resumeVersion: 1,
      locations: base.eventDefinition.locations.map(location => location.id === office.id ? {
        ...location,
        enabledActionIds: [firstActionId, secondActionId],
        scenes: [
          {
            id: 'first',
            title: 'Stabilize',
            enabledActionIds: [firstActionId],
            completion: { kind: 'track', trackId: 'danger', operator: 'lte', value: 0 },
          },
          {
            id: 'second',
            title: 'Open the archive',
            enabledActionIds: [secondActionId],
            completion: { kind: 'knownFact', factId: 'door_open', present: true },
          },
        ],
      } : location),
    };
    const input: OperationRunStartInput = {
      ...base,
      eventDefinition,
      actors: [{
        ...student,
        profile: {
          ...student.profile,
          candidateActionIds: [...student.profile.candidateActionIds, secondActionId],
          actionPriorityIds: [...student.profile.actionPriorityIds, secondActionId],
          actionCandidates: [...student.profile.actionCandidates, secondCandidate],
          eligibleActionIds: [...student.profile.eligibleActionIds, secondActionId],
        },
      }],
      actionDefinitions: [...base.actionDefinitions, secondAction],
    };
    const owner = new OperationRuntimeService();
    const started = owner.start(input);
    const initialView = owner.getView()!;
    expect(initialView).toMatchObject({
      currentLocationId: 'test:location:office',
      currentSceneId: 'first',
      currentScene: { sceneId: 'first', title: 'Stabilize', status: 'active' },
      scenes: [
        { sceneId: 'first', status: 'active', index: 1, count: 2 },
        { sceneId: 'second', status: 'ready', index: 2, count: 2 },
      ],
    });
    expect(initialView.actionOffers).toContainEqual(expect.objectContaining({
      source: 'student-action', sceneId: 'first', actionId: firstActionId,
    }));

    const firstResolution = owner.commitBeat({ runId: started.runId, planVersion: started.planVersion });
    expect(firstResolution.sceneId).toBe('first');
    expect(owner.getSnapshot()).toMatchObject({
      status: 'inProgress',
      currentLocationId: 'test:location:office',
      routeHistory: [],
      locationProgress: {
        'test:location:office': { completed: false, completedSceneIds: ['first'] },
      },
    });
    const checkpoint = owner.createSaveSnapshot()!;
    const resumed = new OperationRuntimeService();
    const restored = resumed.restoreSaveSnapshot(checkpoint, input);
    expect(restored).toMatchObject({
      currentLocationId: 'test:location:office',
      locationProgress: { 'test:location:office': { completedSceneIds: ['first'] } },
    });
    expect(resumed.getView()).toMatchObject({
      currentSceneId: 'second',
      currentScene: { sceneId: 'second', status: 'active' },
      scenes: [
        { sceneId: 'first', status: 'completed' },
        { sceneId: 'second', status: 'active' },
      ],
    });

    const secondPlan = resumed.getSnapshot()!;
    expect(secondPlan.preparedBeat?.actorPlans[0]).toMatchObject({ kind: 'studentAction', actionId: secondActionId });
    const secondResolution = resumed.commitBeat({ runId: secondPlan.runId, planVersion: secondPlan.planVersion });
    expect(secondResolution.sceneId).toBe('second');
    expect(resumed.getSnapshot()).toMatchObject({
      currentLocationId: 'test:location:office',
      status: 'inProgress',
      routeHistory: [],
      locationProgress: {
        'test:location:office': { completed: false, completedSceneIds: ['first', 'second'] },
      },
    });
    expect(resumed.getView()).toMatchObject({
      currentSceneId: null,
      currentScene: null,
      scenes: [
        { sceneId: 'first', status: 'completed' },
        { sceneId: 'second', status: 'completed' },
      ],
    });
  });

  test('projects current student Action, Location SceneAction, and PlayerSceneCard as read-only Offers', () => {
    const base = tacticalRunStartInput();
    const actionId = base.actionDefinitions[0].id;
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      playerSceneDeck: {
        cards: [{ id: 'test:card:offer', actionId, playerCost: 0, timing: 'scene', copies: 1 }],
        initialDraw: 1,
        locationEntryDraw: 0,
        maxHandSize: 1,
      },
      locations: base.eventDefinition.locations.map(location => ({
        ...location,
        scenes: [{
          id: 'offer-scene',
          title: 'Offer test',
          actionMode: 'individual',
          sceneActionBatches: 1,
          sceneActions: [{ id: 'offer-action', actionId, scope: 'individual', playerCost: 0 }],
          completion: { kind: 'track', trackId: 'danger', operator: 'lte', value: 0 },
        }],
      })),
    };
    const owner = new OperationRuntimeService();
    owner.start({ ...base, eventDefinition });

    const view = owner.getView()!;
    expect(view.actionOffers.map(offer => offer.source)).toEqual([
      'student-action', 'scene-action', 'player-scene-card',
    ]);
    expect(view.actionOffers.every(offer => !('effects' in offer))).toBe(true);
    expect(view.actionOffers.every(offer => offer.sceneId === 'offer-scene')).toBe(true);
  });

  test('preserves completed Scene IDs when the same Location is revisited in one Run', () => {
    const base = tacticalRunStartInput();
    const officeId = 'test:location:office';
    const archiveId = 'test:location:archive';
    const actionId = base.actionDefinitions[0].id;
    const office = base.eventDefinition.locations.find(location => location.id === officeId)!;
    const archive: OperationEventDef['locations'][number] = {
      id: archiveId,
      stage: 'combat',
      enabledActionIds: [],
      combinationRules: [],
      routeEdges: [{ id: 'archive-office', targetLocationId: officeId, label: 'Return office', description: 'Go back.' }],
    };
    const eventDefinition: OperationEventDef = {
      ...base.eventDefinition,
      locations: [{
        ...office,
        scenes: [{
          id: 'stabilize',
          title: 'Stabilize',
          enabledActionIds: [actionId],
          completion: { kind: 'track', trackId: 'danger', operator: 'lte', value: 0 },
        }],
        routeEdges: [{ id: 'office-archive', targetLocationId: archiveId, label: 'Enter archive', description: 'Go to archive.' }],
      }, archive],
    };
    const owner = new OperationRuntimeService();
    owner.start({ ...base, eventDefinition });

    owner.commitBeat({ runId: owner.getSnapshot()!.runId, planVersion: owner.getSnapshot()!.planVersion });
    expect(owner.getSnapshot()).toMatchObject({
      currentLocationId: officeId,
      locationProgress: { [officeId]: { completed: false, completedSceneIds: ['stabilize'] } },
    });
    owner.completeCurrentLocation();
    let completedLocation = owner.getSnapshot()!;
    owner.transitionRoute({ runId: completedLocation.runId, planVersion: completedLocation.planVersion, routeId: 'office-archive' });
    expect(owner.getSnapshot()?.currentLocationId).toBe(archiveId);
    owner.completeCurrentLocation();
    completedLocation = owner.getSnapshot()!;
    owner.transitionRoute({ runId: completedLocation.runId, planVersion: completedLocation.planVersion, routeId: 'archive-office' });

    expect(owner.getSnapshot()).toMatchObject({
      currentLocationId: officeId,
      locationProgress: { [officeId]: { visitCount: 2, completed: false, completedSceneIds: ['stabilize'] } },
    });
    expect(owner.getView()).toMatchObject({
      currentSceneId: null,
      scenes: [{ sceneId: 'stabilize', status: 'completed' }],
    });
  });

  test('commits position effects and re-resolves the next Character Hand from the new position', () => {
    const base = tacticalRunStartInput([{ kind: 'actorPosition', recipient: 'actor', positionId: 'front' }]);
    const actorId = 'test:actor:student';
    const moveActionId = base.actionDefinitions[0].id;
    const frontActionId = 'test:action:front-guard';
    const frontAction: OperationActionDef = {
      ...base.actionDefinitions[0],
      id: frontActionId,
      effects: [],
    };
    const input: OperationRunStartInput = {
      ...base,
      eventDefinition: {
        ...base.eventDefinition,
        actors: [{ ...base.eventDefinition.actors[0], positionId: 'back' }],
        cardPoolIds: ['test:pool:back', 'test:pool:front'],
        locations: base.eventDefinition.locations.map(location => location.id === 'test:location:office'
          ? { ...location, enabledActionIds: [moveActionId, frontActionId] }
          : location),
      },
      actionDefinitions: [...base.actionDefinitions, frontAction],
      operationCardPools: [
        { id: 'test:pool:back', selector: { positionIds: ['back'] }, entries: [{ actionId: moveActionId, weight: 1 }] },
        { id: 'test:pool:front', selector: { positionIds: ['front'] }, entries: [{ actionId: frontActionId, weight: 1 }] },
      ],
    };
    const owner = new OperationRuntimeService();
    const entry = operationEntryFor(owner);
    const started = owner.start(input);
    expect(started.actorStates[0].positionId).toBe('back');
    expect(started.characterHands?.[actorId]?.actionIds).toEqual([moveActionId]);
    expect(started.preparedBeat?.actorPlans[0]).toMatchObject({ actionId: moveActionId });
    expect(() => owner.previewIntervention({
      runId: started.runId,
      planVersion: started.planVersion,
      draft: { actorId, actionId: frontActionId },
    })).toThrow(/not in the Actor current Character Hand/);
    expect(owner.getSnapshot()).toEqual(started);

    const resolution = entry.commitBeat({ runId: started.runId, planVersion: started.planVersion });
    const committed = owner.getSnapshot()!;
    expect(resolution.positionChanges).toMatchObject([{ actorId, before: 'back', after: 'front' }]);
    expect(committed.actorStates[0].positionId).toBe('front');
    expect(committed.characterHands?.[actorId]?.actionIds).toEqual([frontActionId]);
    expect(committed.preparedBeat?.actorPlans[0]).toMatchObject({ actionId: frontActionId });
    expect(committed.playerRouteState.cards).toEqual(started.playerRouteState.cards);
  });

  test('preview and rejected intervention leave Character Hand and both random cursors unchanged', () => {
    const owner = new OperationRuntimeService();
    const started = owner.start(tacticalRunStartInput());
    const before = owner.getSnapshot();
    expect(() => owner.previewIntervention({
      runId: started.runId,
      planVersion: started.planVersion,
      draft: { actorId: 'test:actor:student', actionId: 'test:action:missing' },
    })).toThrow(OperationRuntimeError);
    expect(() => owner.reviseIntervention({
      runId: started.runId,
      planVersion: started.planVersion,
      draft: { actorId: 'test:actor:student', actionId: 'test:action:missing' },
    })).toThrow(OperationRuntimeError);
    expect(() => owner.commitBeat({ runId: started.runId, planVersion: started.planVersion + 1 })).toThrow(OperationRuntimeError);
    expect(owner.getSnapshot()).toEqual(before);
    expect(before?.random).toEqual(started.random);
    expect(before?.characterHands).toEqual(started.characterHands);
  });

  test('does not store a default plan as an Intervention and clears an override selected back to base', () => {
    const owner = new OperationRuntimeService();
    const started = owner.start(tacticalRunStartInputWithAlternateAction());
    const basePlan = started.preparedBeat!.actorPlans[0];
    const actorId = 'test:actor:student';

    const unchanged = owner.reviseIntervention({
      runId: started.runId,
      planVersion: started.planVersion,
      draft: { actorId, actionId: basePlan.actionId },
    });
    expect(unchanged).toEqual(started);
    expect(unchanged.interventionDraft).toBeNull();

    const override = owner.reviseIntervention({
      runId: started.runId,
      planVersion: unchanged.planVersion,
      draft: { actorId, actionId: 'test:action:alternate-inspect' },
    });
    expect(override.interventionDraft).toMatchObject({ actorId, actionId: 'test:action:alternate-inspect' });
    const reset = owner.reviseIntervention({
      runId: started.runId,
      planVersion: override.planVersion,
      draft: { actorId, actionId: basePlan.actionId },
    });
    expect(reset.interventionDraft).toBeNull();
    expect(reset.planVersion).toBe(override.planVersion + 1);
    expect(reset.preparedBeat?.actorPlans[0]).toMatchObject({ actionId: basePlan.actionId, targetActorId: basePlan.targetActorId });
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
      currentLocationId: 'test:location:office',
      locationProgress: {
        'test:location:office': { visitCount: 1, beatCount: 1, completed: true, result: 'failure' },
      },
      preparedBeat: null,
    });
    const completedOffice = owner.getSnapshot()!;
    const inArchive = owner.transitionRoute({
      runId: completedOffice.runId,
      planVersion: completedOffice.planVersion,
      routeId: 'test:route:office-archive',
    });
    expect(inArchive).toMatchObject({
      currentLocationId: 'test:location:archive',
      preparedBeat: { planVersion: 2, locationId: 'test:location:archive' },
    });
    expect(owner.getResult()).toBeNull();
  });

  test('rejects a Location without an explicit gameplay stage', () => {
    const definition = eventDef();
    const invalid = {
      ...definition,
      locations: definition.locations.map(({ stage: _stage, ...location }) => location),
    } as unknown as OperationEventDef;
    expect(validateOperationEventDef(invalid)).toContain('locations[0].stage must be combat or scene');
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
    expect(latestRun.resolutions[0].timelineSequence).toBe(2);
    expect(latestRun.resolutions.at(-1)?.timelineSequence).toBe(latestRun.timelineSequence);
    expect('nextRandomState' in latestRun.resolutions.at(-1)!).toBe(false);
    expect(() => entry.commitBeat({ runId: latestRun.runId, planVersion: 0 })).toThrow(/stale/);
  });

  test('restores a bounded checkpoint with the exact pending plan and next deterministic Commit', () => {
    const input = tacticalRunStartInputWithAlternateAction();
    const uninterrupted = new OperationRuntimeService();
    const first = uninterrupted.start(input);
    const revised = uninterrupted.reviseIntervention({
      runId: first.runId,
      planVersion: first.planVersion,
      draft: { actorId: 'test:actor:student', actionId: 'test:action:alternate-inspect' },
    });
    const checkpoint = uninterrupted.createSaveSnapshot();

    expect(checkpoint).not.toBeNull();
    const resumed = new OperationRuntimeService();
    expect(resumed.restoreSaveSnapshot(checkpoint, input)).toEqual(revised);
    expect(resumed.createSaveSnapshot()).toEqual(checkpoint);

    const expectedResolution = uninterrupted.commitBeat({ runId: revised.runId, planVersion: revised.planVersion });
    const actualResolution = resumed.commitBeat({ runId: revised.runId, planVersion: revised.planVersion });
    expect(actualResolution).toEqual(expectedResolution);
    expect(resumed.getSnapshot()).toEqual(uninterrupted.getSnapshot());
  });

  test('rejects incompatible or malformed checkpoints without installing a partial Run', () => {
    const baseInput = tacticalRunStartInput();
    const input: OperationRunStartInput = { ...baseInput, eventDefinition: { ...baseInput.eventDefinition, resumeVersion: 1 } };
    const source = new OperationRuntimeService();
    source.start(input);
    const checkpoint = source.createSaveSnapshot()!;

    const incompatible = new OperationRuntimeService();
    expect(() => incompatible.restoreSaveSnapshot(checkpoint, {
      ...input,
      eventDefinition: { ...input.eventDefinition, resumeVersion: 2 },
    })).toThrow(/resumeVersion mismatch/);
    expect(incompatible.getSnapshot()).toBeNull();

    const malformed = new OperationRuntimeService();
    expect(() => malformed.restoreSaveSnapshot({
      ...checkpoint,
      run: { ...checkpoint.run, playerRouteState: { ...checkpoint.run.playerRouteState, playerCost: -1 } },
    }, input)).toThrow(/PlayerCost is invalid/);
    expect(malformed.getSnapshot()).toBeNull();

    const mismatchedHand = new OperationRuntimeService();
    const savedHands = checkpoint.run.characterHands!;
    const actorId = 'test:actor:student';
    expect(() => mismatchedHand.restoreSaveSnapshot({
      ...checkpoint,
      run: {
        ...checkpoint.run,
        characterHands: {
          ...savedHands,
          [actorId]: { ...savedHands[actorId], actionIds: [] },
        },
      },
    } as never, input)).toThrow(/Character Hand/);
    expect(mismatchedHand.getSnapshot()).toBeNull();

    const unsafeRunId = new OperationRuntimeService();
    expect(() => unsafeRunId.restoreSaveSnapshot({
      ...checkpoint,
      run: { ...checkpoint.run, runId: 'operation-run-9007199254740992' },
    }, input)).toThrow(/runId is malformed/);
    expect(unsafeRunId.getSnapshot()).toBeNull();
  });

  test('requires complete Route and entry-Cost histories for visited Locations', () => {
    const base = tacticalRunStartInput();
    const definition = eventDef();
    const office = definition.locations[0]!;
    const input: OperationRunStartInput = {
      ...base,
      eventDefinition: {
        ...definition,
        resumeVersion: 1,
        maxLocationVisits: 4,
        locations: [
          {
            ...office,
            costGain: 1,
            routeEdges: [{
              id: 'test:route:office-archive',
              targetLocationId: 'test:location:archive',
              label: 'Open the archive',
              description: 'Continue into the archive.',
            }],
          },
          {
            ...definition.locations[1]!,
            costGain: 1,
          },
        ],
      },
    };
    const source = new OperationRuntimeService();
    source.start(input);
    const completedOffice = source.completeCurrentLocation();
    const enteredArchive = source.transitionRoute({
      runId: completedOffice.runId,
      planVersion: completedOffice.planVersion,
      routeId: 'test:route:office-archive',
    });
    expect(enteredArchive.currentLocationId).toBe('test:location:archive');
    const checkpoint = source.createSaveSnapshot()!;
    expect(enteredArchive.locationProgress).toMatchObject({
      'test:location:office': { visitCount: 1 },
      'test:location:archive': { visitCount: 1 },
    });
    expect(checkpoint.run.routeHistory).toHaveLength(1);
    expect(checkpoint.run.locationEntryCostHistory).toHaveLength(2);
    expect(checkpoint.run.timelineSequence).toBe(
      checkpoint.run.resolutionSequence + checkpoint.run.routeHistory.length + checkpoint.run.locationEntryCostHistory!.length,
    );

    const validResume = new OperationRuntimeService();
    expect(validResume.restoreSaveSnapshot(checkpoint, input)).toEqual(enteredArchive);

    const missingRoute = new OperationRuntimeService();
    expect(() => missingRoute.restoreSaveSnapshot({
      ...checkpoint,
      run: { ...checkpoint.run, routeHistory: [] },
    }, input)).toThrow(/route history does not match total Location visits/);
    expect(missingRoute.getSnapshot()).toBeNull();

    const entries = checkpoint.run.locationEntryCostHistory!;
    const missingOldEntry = { ...entries[1]!, visitSequence: 1 };
    const missingEntry = new OperationRuntimeService();
    expect(() => missingEntry.restoreSaveSnapshot({
      ...checkpoint,
      run: { ...checkpoint.run, locationEntryCostHistory: [missingOldEntry] },
    }, input)).toThrow(/Location entry Cost history does not match total Location visits/);
    expect(missingEntry.getSnapshot()).toBeNull();
  });

  test('requires the complete newest Resolution window and rejects sequence holes', () => {
    const base = tacticalRunStartInput();
    const input: OperationRunStartInput = {
      ...base,
      eventDefinition: { ...base.eventDefinition, resumeVersion: 1 },
    };
    const source = new OperationRuntimeService();
    let run = source.start(input);
    for (let index = 0; index < 33; index += 1) {
      source.commitBeat({ runId: run.runId, planVersion: run.planVersion });
      run = source.getSnapshot()!;
    }
    const checkpoint = source.createSaveSnapshot()!;
    expect(checkpoint.run.resolutionSequence).toBe(33);
    expect(checkpoint.run.resolutions).toHaveLength(32);
    expect(checkpoint.run.resolutions.map(resolution => resolution.resolutionSequence)).toEqual(
      Array.from({ length: 32 }, (_, index) => index + 2),
    );

    const validResume = new OperationRuntimeService();
    expect(validResume.restoreSaveSnapshot(checkpoint, input)).toEqual(run);

    const missingResolution = new OperationRuntimeService();
    expect(() => missingResolution.restoreSaveSnapshot({
      ...checkpoint,
      run: { ...checkpoint.run, resolutions: checkpoint.run.resolutions.slice(1) },
    }, input)).toThrow(/Resolution history is incomplete/);
    expect(missingResolution.getSnapshot()).toBeNull();

    const resolutionsWithHole = checkpoint.run.resolutions.map((resolution, index) => index === 0
      ? { ...resolution, resolutionSequence: 1 }
      : resolution);
    const missingSequence = new OperationRuntimeService();
    expect(() => missingSequence.restoreSaveSnapshot({
      ...checkpoint,
      run: { ...checkpoint.run, resolutions: resolutionsWithHole },
    }, input)).toThrow(/Resolution history sequence is invalid/);
    expect(missingSequence.getSnapshot()).toBeNull();
  });

  test('restores a non-zero tactical RNG cursor without rerolling the next Student skill', () => {
    const base = tacticalRunStartInput();
    const actionId = base.actionDefinitions[0].id;
    const skillId = 'test:skill:guaranteed-focus';
    const student = base.actors[0];
    if (student.participantKind !== 'student') throw new Error('expected Student Actor fixture');
    const input: OperationRunStartInput = {
      ...base,
      eventDefinition: { ...base.eventDefinition, resumeVersion: 1 },
      actors: [{
        ...student,
        profile: { ...student.profile, randomSkillRuleId: skillId },
      }],
      studentSkillRules: [{
        id: skillId,
        triggerActionIds: [actionId],
        chanceBps: 10000,
        effects: [{ kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'focus', amount: 1 }],
      } satisfies OperationStudentSkillRuleDef],
    };
    const uninterrupted = new OperationRuntimeService();
    let run = uninterrupted.start(input);
    uninterrupted.commitBeat({ runId: run.runId, planVersion: run.planVersion });
    run = uninterrupted.getSnapshot()!;
    expect(run.random.tacticalCursor).toBeGreaterThan(0);
    expect(run.resolutionSequence).toBe(1);

    const checkpoint = uninterrupted.createSaveSnapshot()!;
    const resumed = new OperationRuntimeService();
    expect(resumed.restoreSaveSnapshot(checkpoint, input)).toEqual(run);
    const expected = uninterrupted.commitBeat({ runId: run.runId, planVersion: run.planVersion });
    const actual = resumed.commitBeat({ runId: run.runId, planVersion: run.planVersion });
    expect(actual).toEqual(expected);
    expect(resumed.getSnapshot()).toEqual(uninterrupted.getSnapshot());
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
