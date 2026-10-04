import { describe, expect, test } from 'vitest';
import {
  OPERATION_NO_ELIGIBLE_ACTION_REASON_ID,
  OPERATION_WAIT_ACTION_ID,
  type OperationEventDef,
} from '../../src/arona-clicker/contracts/operation';
import type { OperationAdmission } from '../../src/arona-clicker/contracts/operation-participant';
import type { OperationActionDef, OperationActionEffectDef } from '../../src/arona-clicker/contracts/operation-action';
import type { OperationStudentSkillRuleDef } from '../../src/arona-clicker/contracts/operation-skill';
import type { StudentOperationProfileDef } from '../../src/arona-clicker/contracts/student-operation-profile';
import { Character } from '../../src/arona-clicker/types/ids';
import { validateOperationActionContent } from '../../src/arona-clicker/services/operation-action-content-validation';
import { validateOperationEventDef } from '../../src/arona-clicker/services/operation-definition-validation';
import { OperationRuntimeError, OperationRuntimeService } from '../../src/arona-clicker/services/operation-runtime-service';
import { resolveOperationRunStart } from '../../src/arona-clicker/services/student-operation-profile-resolver';

const ACTOR_IDS = ['test:actor:a', 'test:actor:b', 'test:actor:c', 'test:actor:blocked', 'test:actor:enemy'] as const;

function eventDef(): OperationEventDef {
  return {
    id: 'test:operation:profile-runtime',
    locations: [{ id: 'test:location:office', enabledActionIds: [], combinationRules: [], routeEdges: [] } ], maxLocationVisits: 20,
    initialLocationId: 'test:location:office',
    tracks: [],
    factIds: [],
    knownFactIds: [],
    itemIds: [],
    heldItemIds: [],
    actors: ACTOR_IDS.map((id, index) => ({
      id,
      type: index === ACTOR_IDS.length - 1 ? 'opponent' : 'student',
      hp: { initial: 4, min: 0, max: 4 },
      resources: { focus: { initial: 2, min: 0, max: 3 } },
    })),
    playerRouteState: {
      playerCost: 2,
    },
    randomSeed: 19,
  };
}

function actionDefinitions(): OperationActionDef[] {
  return [
    { id: 'operation:action:observe', allowedParticipantKinds: ['student'], requiredCapabilityIds: [], reasonIds: ['operation:reason:observe'], tagIds: [], target: { kind: 'none' }, effects: [] },
    { id: 'operation:action:guard', allowedParticipantKinds: ['student'], requiredCapabilityIds: ['capability:frontline'], reasonIds: ['operation:reason:frontline'], tagIds: [], target: { kind: 'none' }, effects: [] },
    { id: 'operation:action:inspect', allowedParticipantKinds: ['student'], requiredCapabilityIds: ['capability:resourceful'], reasonIds: ['operation:reason:resourceful'], tagIds: [], target: { kind: 'none' }, effects: [] },
    { id: 'operation:action:enemy-observe', allowedParticipantKinds: ['opponent'], requiredCapabilityIds: [], reasonIds: [], tagIds: [], target: { kind: 'none' }, effects: [] },
  ];
}

function studentSkillRules(): OperationStudentSkillRuleDef[] {
  return [{
    id: 'test:skill-rule:a',
    triggerActionIds: ['operation:action:guard'],
    chanceBps: 2500,
    effects: [],
  }];
}

function profile(
  id: string,
  characterId: string,
  capabilities: readonly string[],
  priority: readonly string[],
  candidateActionIds: readonly string[] = ['operation:action:observe', 'operation:action:guard', 'operation:action:inspect'],
): StudentOperationProfileDef {
  return {
    id,
    characterId,
    candidateActionIds,
    actionPriorityIds: priority,
    capabilityIds: capabilities,
    reasonIds: ['operation:reason:' + id.split(':').pop()],
    ...(id.endsWith(':a') ? { randomSkillRuleId: 'test:skill-rule:a' } : {}),
  };
}

function admission(): OperationAdmission {
  const profiles = [
    profile('test:profile:a', Character.Hoshino, ['capability:frontline'], ['operation:action:guard']),
    profile('test:profile:b', Character.Serika, ['capability:resourceful'], ['operation:action:inspect']),
    profile('test:profile:c', Character.Yuuka, [], ['operation:action:observe']),
    profile('test:profile:blocked', Character.Nonomi, [], [], ['operation:action:guard']),
  ];
  return {
    eventDefinition: eventDef(),
    // Deliberately scrambled: joins must use actorId/Profile ID, not array positions.
    participants: [
      { actorId: ACTOR_IDS[2], kind: 'student', characterId: Character.Yuuka, variantId: 'test:variant:c', profileId: 'test:profile:c' },
      { actorId: ACTOR_IDS[4], kind: 'opponent', factionId: 'test:faction:enemy', candidateActionIds: ['operation:action:enemy-observe'] },
      { actorId: ACTOR_IDS[0], kind: 'student', characterId: Character.Hoshino, variantId: 'test:variant:a', profileId: 'test:profile:a' },
      { actorId: ACTOR_IDS[3], kind: 'student', characterId: Character.Nonomi, variantId: 'test:variant:blocked', profileId: 'test:profile:blocked' },
      { actorId: ACTOR_IDS[1], kind: 'student', characterId: Character.Serika, variantId: 'test:variant:b', profileId: 'test:profile:b' },
    ],
    studentProfiles: [profiles[2], profiles[3], profiles[1], profiles[0]],
    actionDefinitions: actionDefinitions(),
    studentSkillRules: studentSkillRules(),
  };
}

describe('StudentOperationProfileResolver and EventRun snapshots', () => {
  test('validates unique trusted Action IDs, Action capability/reason lists, and reserved Wait ID', () => {
    const actions = actionDefinitions();
    const duplicateAction = { ...actions[0] };
    const malformedList = { ...actions[0], requiredCapabilityIds: [''] };
    const reservedWaitAction = { ...actions[0], id: OPERATION_WAIT_ACTION_ID };

    expect(validateOperationActionContent(eventDef(), [actions[0], duplicateAction], [], []).issues.join('\n'))
      .toMatch(/duplicate Action ID/);
    expect(validateOperationActionContent(eventDef(), [malformedList], [], []).issues.join('\n'))
      .toMatch(/requiredCapabilityIds\[0\]/);
    expect(validateOperationActionContent(eventDef(), [reservedWaitAction], [], []).issues.join('\n'))
      .toMatch(/reserved Wait fallback ID/);
    expect(validateOperationEventDef({ ...eventDef(), actionRequirements: [] } as unknown as OperationEventDef).join('\n'))
      .toMatch(/actionRequirements is removed/);
  });

  test('closes Combination effect resources relative to slot A and its shared target', () => {
    const source = admission();
    const taggedActions = source.actionDefinitions.map(action => ({
      ...action,
      ...(action.id === 'operation:action:observe' ? { tagIds: ['combination:slot-a'] } : {}),
      ...(action.id === 'operation:action:inspect' ? { tagIds: ['combination:slot-b'] } : {}),
    }));
    const runWith = (
      targetMatch: 'same-target' | 'no-target',
      effects: readonly OperationActionEffectDef[],
      targetKind: 'none' | 'actor' = 'none',
    ) => resolveOperationRunStart({
      ...source,
      eventDefinition: {
        ...source.eventDefinition,
        locations: [{ id: 'test:location:office', enabledActionIds: ['operation:action:observe', 'operation:action:inspect'], combinationRules: [{ id: 'test:combination:rule', priority: 1, inputTagIds: ['combination:slot-a', 'combination:slot-b'], targetMatch, effects }], routeEdges: [] } ], maxLocationVisits: 20,
      },
      actionDefinitions: taggedActions.map(action => targetKind === 'actor'
        ? { ...action, target: { kind: 'actor', relation: 'any' } }
        : action),
    });

    expect(() => runWith('no-target', [{ kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'energy', amount: 1 }]))
      .toThrow(/undeclared actor resource: energy/);
    expect(() => runWith('no-target', [{ kind: 'actorResourceDelta', recipient: 'target', resourceId: 'focus', amount: 1 }]))
      .toThrow(/this result has no Actor target/);
    expect(() => runWith('same-target', [{ kind: 'actorResourceDelta', recipient: 'target', resourceId: 'energy', amount: 1 }], 'actor'))
      .toThrow(/undeclared target actor resource: energy/);
  });

  test('joins by actorId/Profile ID and snapshots distinct ordered capability candidates', () => {
    const runStart = resolveOperationRunStart(admission());
    expect(runStart.actors.find(actor => actor.actorId === ACTOR_IDS[4])).toMatchObject({
      participantKind: 'opponent',
      candidateActionIds: ['operation:action:enemy-observe'],
    });
    expect(Object.isFrozen(runStart)).toBe(true);
    expect(Object.isFrozen(runStart.actionDefinitions)).toBe(true);
    expect(Object.isFrozen(runStart.actionDefinitions[0])).toBe(true);
    expect(Object.isFrozen(runStart.studentSkillRules[0])).toBe(true);
    const service = new OperationRuntimeService();
    const firstLifecycleSnapshot = viSafeLifecycleSnapshot(service, runStart);
    const isolatedRun = new OperationRuntimeService();
    isolatedRun.start(runStart);
    const actors = service.getSnapshot()!.actorStates;
    const byId = new Map(actors.map(actor => [actor.id, actor]));

    expect(firstLifecycleSnapshot).toEqual({
      student: { characterId: Character.Hoshino, profileId: 'test:profile:a', eligibleActionIds: ['operation:action:guard', 'operation:action:observe'] },
      opponent: { participantKind: 'opponent', factionId: 'test:faction:enemy' },
    });
    expect(byId.get(ACTOR_IDS[0])).toMatchObject({
      participantKind: 'student',
      characterId: Character.Hoshino,
      profile: {
        id: 'test:profile:a',
        actionPriorityIds: ['operation:action:guard'],
        eligibleActionIds: ['operation:action:guard', 'operation:action:observe'],
        randomSkillRuleId: 'test:skill-rule:a',
      },
    });
    expect(byId.get(ACTOR_IDS[1])?.profile?.eligibleActionIds).toEqual([
      'operation:action:inspect',
      'operation:action:observe',
    ]);
    expect(byId.get(ACTOR_IDS[2])?.profile?.eligibleActionIds).toEqual(['operation:action:observe']);
    expect(byId.get(ACTOR_IDS[0])?.profile?.actionCandidates.map(candidate => candidate.actionId)).toEqual([
      'operation:action:guard',
      'operation:action:observe',
      'operation:action:inspect',
    ]);
    expect(byId.get(ACTOR_IDS[1])?.profile?.actionCandidates.map(candidate => candidate.actionId)).toEqual([
      'operation:action:inspect',
      'operation:action:observe',
      'operation:action:guard',
    ]);
    expect(byId.get(ACTOR_IDS[0])?.profile?.actionCandidates[0].reasonIds).toEqual([
      'operation:reason:a',
      'operation:reason:frontline',
    ]);
    expect(byId.get(ACTOR_IDS[4])).toMatchObject({
      participantKind: 'opponent',
      factionId: 'test:faction:enemy',
      hp: 4,
      resources: { focus: 2 },
    });
    expect(byId.get(ACTOR_IDS[4])).not.toHaveProperty('profile');
    expect(byId.get(ACTOR_IDS[0])?.profile).not.toHaveProperty('playerCost');

    const withCapability = byId.get(ACTOR_IDS[0])!.profile!;
    const withoutCapability = byId.get(ACTOR_IDS[2])!.profile!;
    expect(withCapability.candidateActionIds).toEqual(withoutCapability.candidateActionIds);
    expect(withoutCapability.actionCandidates).toContainEqual(expect.objectContaining({
      actionId: 'operation:action:guard',
      eligible: false,
      requiredCapabilityIds: ['capability:frontline'],
      missingCapabilityIds: ['capability:frontline'],
    }));
    expect(withCapability.actionCandidates.find(candidate => candidate.actionId === 'operation:action:guard'))
      .toMatchObject({ eligible: true, missingCapabilityIds: [] });

    const admissionWithFrontline = admission();
    const originalProfile = admissionWithFrontline.studentProfiles.find(profile => profile.id === 'test:profile:a')!;
    const admissionWithoutFrontline: OperationAdmission = {
      ...admissionWithFrontline,
      studentProfiles: admissionWithFrontline.studentProfiles.map(profile => profile.id === originalProfile.id
        ? { ...profile, capabilityIds: [], randomSkillRuleId: undefined }
        : profile),
    };
    const stripped = resolveOperationRunStart(admissionWithoutFrontline).actors.find(actor => actor.actorId === ACTOR_IDS[0]);
    expect(stripped).toMatchObject({
      profile: {
        candidateActionIds: originalProfile.candidateActionIds,
        actionCandidates: [
          expect.objectContaining({ actionId: 'operation:action:guard', eligible: false, missingCapabilityIds: ['capability:frontline'] }),
          expect.objectContaining({ actionId: 'operation:action:observe', eligible: true }),
          expect.objectContaining({ actionId: 'operation:action:inspect', eligible: false }),
        ],
      },
    });

    const snapshot = service.getSnapshot()!;
    expect(Object.isFrozen(snapshot.actorStates[0].profile)).toBe(true);
    expect(Object.isFrozen(snapshot.actorStates[0].profile?.actionCandidates[0])).toBe(true);
    expect(snapshot.random).toEqual({ algorithm: 'splitmix64-counter-v1', seed: 19, tacticalCursor: 0 });

    service.applyStateDelta({ actors: [{ actorId: ACTOR_IDS[0], hp: 1, resources: { focus: 0 } }] });
    expect(service.getSnapshot()?.actorStates[0]).toMatchObject({
      hp: 1,
      resources: { focus: 0 },
      characterId: Character.Hoshino,
      profile: { id: 'test:profile:a', eligibleActionIds: ['operation:action:guard', 'operation:action:observe'] },
    });
    expect(isolatedRun.getSnapshot()?.actorStates[0]).toMatchObject({
      hp: 4,
      resources: { focus: 2 },
      characterId: Character.Hoshino,
      profile: { id: 'test:profile:a', eligibleActionIds: ['operation:action:guard', 'operation:action:observe'] },
    });
    expect(admissionWithFrontline.studentProfiles.find(profile => profile.id === 'test:profile:a')?.capabilityIds)
      .toEqual(['capability:frontline']);
  });

  test('re-entering the same Character after finishing a Run starts from the next EventDefinition values', () => {
    const service = new OperationRuntimeService();
    const first = service.start(resolveOperationRunStart(admission()));
    service.applyStateDelta({ actors: [{ actorId: ACTOR_IDS[0], hp: 1, resources: { focus: 0 } }] });
    service.completeCurrentLocation();
    const firstResult = service.finish();

    const secondEvent: OperationEventDef = {
      ...eventDef(),
      id: 'test:operation:profile-runtime:next',
      actors: eventDef().actors.map(actor => actor.id === ACTOR_IDS[0]
        ? {
            ...actor,
            hp: { initial: 3, min: 0, max: 4 },
            resources: { focus: { initial: 1, min: 0, max: 3 } },
          }
        : actor),
    };
    const secondAdmission: OperationAdmission = { ...admission(), eventDefinition: secondEvent };
    const second = service.start(resolveOperationRunStart(secondAdmission));
    const firstActorAtEnd = firstResult.finalRun.actorStates.find(actor => actor.id === ACTOR_IDS[0]);
    const secondActorAtStart = second.actorStates.find(actor => actor.id === ACTOR_IDS[0]);

    expect(second.runId).not.toBe(first.runId);
    expect(firstActorAtEnd).toMatchObject({ hp: 1, resources: { focus: 0 }, characterId: Character.Hoshino });
    expect(secondActorAtStart).toMatchObject({
      hp: 3,
      resources: { focus: 1 },
      participantKind: 'student',
      characterId: Character.Hoshino,
      profile: { id: 'test:profile:a' },
    });
  });

  test('emits a stable Wait fallback when every declared candidate is capability-blocked', () => {
    const source = admission();
    const runStart = resolveOperationRunStart(source);
    const first = runStart.actors.find(actor => actor.actorId === ACTOR_IDS[3]);
    const again = resolveOperationRunStart(admission()).actors.find(actor => actor.actorId === ACTOR_IDS[3]);

    expect(first).toMatchObject({
      participantKind: 'student',
      profile: {
        candidateActionIds: ['operation:action:guard'],
        eligibleActionIds: [],
        fallback: {
          actionId: OPERATION_WAIT_ACTION_ID,
          reasonIds: [OPERATION_NO_ELIGIBLE_ACTION_REASON_ID],
        },
      },
    });
    expect(again).toEqual(first);

    const emptyCandidateAdmission: OperationAdmission = {
      ...source,
      studentProfiles: source.studentProfiles.map(profile => profile.id === 'test:profile:blocked'
        ? { ...profile, candidateActionIds: [], actionPriorityIds: [] }
        : profile),
    };
    const emptyCandidates = resolveOperationRunStart(emptyCandidateAdmission).actors.find(actor => actor.actorId === ACTOR_IDS[3]);
    expect(emptyCandidates).toMatchObject({
      profile: {
        candidateActionIds: [],
        actionCandidates: [],
        eligibleActionIds: [],
        fallback: first?.participantKind === 'student' ? first.profile.fallback : undefined,
      },
    });
    expect(emptyCandidates?.participantKind === 'student' ? emptyCandidates.profile.fallback : undefined).toEqual({
      actionId: OPERATION_WAIT_ACTION_ID,
      reasonIds: [OPERATION_NO_ELIGIBLE_ACTION_REASON_ID],
    });
  });

  test('rejects malformed initialization atomically before replacing or publishing a Run', () => {
    const service = new OperationRuntimeService();
    const lifecycleEvents: string[] = [];
    service.subscribe(event => lifecycleEvents.push(event.type));
    const validRunStart = resolveOperationRunStart(admission());
    const prior = service.start(validRunStart);
    const invalid = {
      ...resolveOperationRunStart(admission()),
      actors: validRunStart.actors.slice(1),
    };
    const student = validRunStart.actors[0];
    if (student.participantKind !== 'student') throw new Error('fixture requires a student Actor');
    const forgedProfile = {
      ...student.profile,
      actionCandidates: student.profile.actionCandidates.map(candidate => candidate.actionId === 'operation:action:guard'
        ? { ...candidate, requiredCapabilityIds: [], missingCapabilityIds: [] }
        : candidate),
    };
    const forgedGate = {
      ...validRunStart,
      actors: validRunStart.actors.map(actor => actor.actorId === student.actorId
        ? { ...student, profile: forgedProfile }
        : actor),
    };
    const forgedOpponent = {
      ...validRunStart,
      actors: validRunStart.actors.map(actor => actor.actorId === ACTOR_IDS[4]
        ? { ...actor, candidateActionIds: ['operation:action:guard'] }
        : actor),
    };
    const missingOpponentCandidates = {
      ...validRunStart,
      actors: validRunStart.actors.map(actor => actor.actorId === ACTOR_IDS[4]
        ? Object.fromEntries(Object.entries(actor).filter(([key]) => key !== 'candidateActionIds')) as unknown as typeof actor
        : actor),
    };

    expect(() => service.start(invalid)).toThrow(OperationRuntimeError);
    expect(() => service.start(forgedGate)).toThrow(/does not match the Action definition/);
    expect(() => service.start(forgedOpponent)).toThrow(/candidate Action does not allow opponent participants/);
    expect(() => service.start(missingOpponentCandidates)).toThrow(/candidateActionIds must be an array of IDs/);
    expect(service.getSnapshot()).toEqual(prior);
    expect(lifecycleEvents).toEqual(['runStarted', 'locationEntered']);
  });
});

function viSafeLifecycleSnapshot(
  service: OperationRuntimeService,
  input: ReturnType<typeof resolveOperationRunStart>,
): unknown {
  let captured: unknown;
  service.subscribe(event => {
    if (event.type !== 'runStarted') return;
    const run = service.getSnapshot();
    captured = {
      student: {
        characterId: run?.actorStates[0].characterId,
        profileId: run?.actorStates[0].profile?.id,
        eligibleActionIds: run?.actorStates[0].profile?.eligibleActionIds,
      },
      opponent: {
        participantKind: run?.actorStates[4].participantKind,
        factionId: run?.actorStates[4].factionId,
      },
    };
  });
  service.start(input);
  return captured;
}
