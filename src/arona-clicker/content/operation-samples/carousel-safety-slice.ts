import type { OperationActionDef } from '../../contracts/operation-action';
import type { OperationContentResolver, OperationResolvedContent } from '../../contracts/operation-content-resolver';
import type { OperationEventDef } from '../../contracts/operation';
import type { OperationStudentSkillRuleDef } from '../../contracts/operation-skill';
import type { StudentOperationProfileDef } from '../../contracts/student-operation-profile';
import { Character } from '../../types/ids';
import { CAROUSEL_SAFETY_IDS } from './carousel-safety-ids';

export { CAROUSEL_SAFETY_IDS } from './carousel-safety-ids';

const IDS = CAROUSEL_SAFETY_IDS;
const STUDENT_TEAM = IDS.team;
const TARGET_RIDE = Object.freeze([IDS.actors.ride]);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

const eventDefinition: OperationEventDef = {
  id: IDS.event,
  locationIds: [IDS.location],
  initialLocationId: IDS.location,
  tracks: [{ id: IDS.track, initial: 3, min: 0, max: 6 }],
  factIds: [],
  knownFactIds: [],
  itemIds: [],
  heldItemIds: [],
  teams: [{
    id: STUDENT_TEAM,
    resources: { coordination: { initial: 1, min: 0, max: 1 } },
  }],
  actors: [
    {
      id: IDS.actors.hoshino,
      type: 'student',
      hp: { initial: 4, min: 0, max: 4 },
      resources: { stamina: { initial: 1, min: 0, max: 1 } },
      teamId: STUDENT_TEAM,
      targetPriorityActorIds: TARGET_RIDE,
    },
    {
      id: IDS.actors.serika,
      type: 'student',
      hp: { initial: 3, min: 0, max: 3 },
      resources: { focus: { initial: 0, min: 0, max: 2 } },
      teamId: STUDENT_TEAM,
      targetPriorityActorIds: TARGET_RIDE,
    },
    {
      id: IDS.actors.shiroko,
      type: 'student',
      hp: { initial: 4, min: 0, max: 4 },
      teamId: STUDENT_TEAM,
      targetPriorityActorIds: TARGET_RIDE,
    },
    {
      id: IDS.actors.saboteur,
      type: 'opponent',
      hp: { initial: 3, min: 0, max: 3 },
      targetPriorityActorIds: TARGET_RIDE,
    },
    {
      id: IDS.actors.agitator,
      type: 'opponent',
      hp: { initial: 3, min: 0, max: 3 },
    },
    {
      id: IDS.actors.ride,
      type: 'environment',
      hp: { initial: 2, min: 0, max: 4 },
    },
  ],
  locationTactics: [{
    locationId: IDS.location,
    enabledActionIds: Object.values(IDS.actions),
    combinationRules: [{
      id: 'demo:operation-combination:carousel-brake-signal',
      priority: 10,
      inputTagIds: ['demo:operation-tag:brake', 'demo:operation-tag:signal'],
      targetMatch: 'same-target',
      effects: [
        { kind: 'actorHpDelta', recipient: 'target', amount: 1 },
        { kind: 'eventTrackDelta', trackId: IDS.track, amount: -2 },
      ],
    }],
  }],
  playerRouteState: {
    playerCost: 0,
    cards: { drawPile: [], hand: [], discard: [], played: [] },
  },
  randomSeed: 17,
};

const studentProfiles: readonly StudentOperationProfileDef[] = [
  {
    id: 'demo:operation-profile:hoshino-carousel-safety',
    characterId: Character.Hoshino,
    candidateActionIds: [IDS.actions.brace, IDS.actions.emergencyStop],
    actionPriorityIds: [IDS.actions.brace, IDS.actions.emergencyStop],
    capabilityIds: ['demo:operation-capability:frontline-protection'],
    reasonIds: ['demo:operation-reason:hoshino-veteran'],
  },
  {
    id: 'demo:operation-profile:serika-carousel-safety',
    characterId: Character.Serika,
    candidateActionIds: [IDS.actions.signal, IDS.actions.crowdGuide],
    actionPriorityIds: [IDS.actions.signal, IDS.actions.crowdGuide],
    capabilityIds: ['demo:operation-capability:crowd-coordination'],
    reasonIds: ['demo:operation-reason:serika-crowd-awareness'],
    randomSkillRuleId: 'demo:operation-skill:serika-stay-focused',
  },
  {
    id: 'demo:operation-profile:shiroko-carousel-safety',
    characterId: Character.Shiroko,
    candidateActionIds: [IDS.actions.shield],
    actionPriorityIds: [IDS.actions.shield],
    capabilityIds: ['demo:operation-capability:precision'],
    reasonIds: ['demo:operation-reason:shiroko-precision'],
  },
];

const actionDefinitions: readonly OperationActionDef[] = [
  {
    id: IDS.actions.brace,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['demo:operation-reason:brace-the-brake'],
    tagIds: ['demo:operation-tag:brake'],
    target: { kind: 'actor', relation: 'any' },
    effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }],
  },
  {
    id: IDS.actions.emergencyStop,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: ['demo:operation-capability:frontline-protection'],
    reasonIds: ['demo:operation-reason:emergency-stop'],
    tagIds: [],
    cost: { scope: 'actor', resourceId: 'stamina', amount: 1 },
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: -4 }],
  },
  {
    id: IDS.actions.signal,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['demo:operation-reason:signal-rhythm'],
    tagIds: ['demo:operation-tag:signal'],
    target: { kind: 'actor', relation: 'any' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: -1 }],
  },
  {
    id: IDS.actions.crowdGuide,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: ['demo:operation-capability:crowd-coordination'],
    reasonIds: ['demo:operation-reason:guide-the-crowd'],
    tagIds: ['demo:operation-tag:crowd-guide'],
    cost: { scope: 'team', resourceId: 'coordination', amount: 1 },
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: -3 }],
  },
  {
    id: IDS.actions.shield,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: ['demo:operation-capability:precision'],
    reasonIds: ['demo:operation-reason:shield-the-frame'],
    tagIds: [],
    target: { kind: 'actor', relation: 'any' },
    effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }],
  },
  {
    id: IDS.actions.sabotage,
    allowedParticipantKinds: ['opponent'],
    requiredCapabilityIds: [],
    reasonIds: ['demo:operation-reason:sabotage-the-latch'],
    tagIds: [],
    target: { kind: 'actor', relation: 'any' },
    effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }],
  },
  {
    id: IDS.actions.alarm,
    allowedParticipantKinds: ['opponent'],
    requiredCapabilityIds: [],
    reasonIds: ['demo:operation-reason:raise-an-alarm'],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: 2 }],
  },
  {
    id: IDS.actions.surge,
    allowedParticipantKinds: ['environment'],
    requiredCapabilityIds: [],
    reasonIds: ['demo:operation-reason:mechanical-surge'],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: 1 }],
  },
];

const studentSkillRules: readonly OperationStudentSkillRuleDef[] = [{
  id: 'demo:operation-skill:serika-stay-focused',
  triggerActionIds: [IDS.actions.signal],
  chanceBps: 5000,
  effects: [{ kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'focus', amount: 1 }],
}];

export const carouselSafetySliceContent = deepFreeze<OperationResolvedContent>({
  eventDefinition,
  participants: [
    { actorId: IDS.actors.hoshino, kind: 'student' },
    { actorId: IDS.actors.serika, kind: 'student' },
    { actorId: IDS.actors.shiroko, kind: 'student' },
    {
      actorId: IDS.actors.saboteur,
      kind: 'opponent',
      factionId: 'demo:operation-faction:ride-saboteurs',
      candidateActionIds: [IDS.actions.sabotage],
    },
    {
      actorId: IDS.actors.agitator,
      kind: 'opponent',
      factionId: 'demo:operation-faction:ride-saboteurs',
      candidateActionIds: [IDS.actions.alarm],
    },
    {
      actorId: IDS.actors.ride,
      kind: 'environment',
      candidateActionIds: [IDS.actions.surge],
    },
  ],
  studentProfiles,
  actionDefinitions,
  studentSkillRules,
});

export const carouselSafetySliceResolver: OperationContentResolver = Object.freeze({
  resolve(eventId: string) {
    return eventId === IDS.event ? carouselSafetySliceContent : null;
  },
});
