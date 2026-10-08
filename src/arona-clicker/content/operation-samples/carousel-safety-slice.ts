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
  locations: [{ id: IDS.location, enabledActionIds: Object.values(IDS.actions), combinationRules: [{
      id: 'gameplay-b:operation-combination:carousel-brake-signal',
      priority: 10,
      inputTagIds: ['gameplay-b:operation-tag:brake', 'gameplay-b:operation-tag:signal'],
      targetMatch: 'same-target',
      effects: [
        { kind: 'actorHpDelta', recipient: 'target', amount: 1 },
        { kind: 'eventTrackDelta', trackId: IDS.track, amount: -2 },
      ],
    }], routeEdges: [] } ], maxLocationVisits: 20,
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
      displayName: '星野',
      hp: { initial: 4, min: 0, max: 4 },
      resources: { stamina: { initial: 1, min: 0, max: 1 } },
      teamId: STUDENT_TEAM,
      targetPriorityActorIds: TARGET_RIDE,
    },
    {
      id: IDS.actors.serika,
      type: 'student',
      displayName: '芹香',
      hp: { initial: 3, min: 0, max: 3 },
      resources: { focus: { initial: 0, min: 0, max: 2 } },
      teamId: STUDENT_TEAM,
      targetPriorityActorIds: TARGET_RIDE,
    },
    {
      id: IDS.actors.shiroko,
      type: 'student',
      displayName: '白子',
      hp: { initial: 4, min: 0, max: 4 },
      teamId: STUDENT_TEAM,
      targetPriorityActorIds: TARGET_RIDE,
    },
    {
      id: IDS.actors.saboteur,
      type: 'opponent',
      displayName: '破坏者',
      hp: { initial: 3, min: 0, max: 3 },
      targetPriorityActorIds: TARGET_RIDE,
    },
    {
      id: IDS.actors.agitator,
      type: 'opponent',
      displayName: '闹事者',
      hp: { initial: 3, min: 0, max: 3 },
    },
    {
      id: IDS.actors.ride,
      type: 'environment',
      displayName: '旋转木马',
      hp: { initial: 2, min: 0, max: 4 },
    },
  ],
  playerRouteState: {
    playerCost: 0,
  },
  randomSeed: 17,
};

const studentProfiles: readonly StudentOperationProfileDef[] = [
  {
    id: 'gameplay-b:student-operation-profile:hoshino-carousel-safety',
    characterId: Character.Hoshino,
    candidateActionIds: [IDS.actions.brace, IDS.actions.emergencyStop],
    actionPriorityIds: [IDS.actions.brace, IDS.actions.emergencyStop],
    capabilityIds: ['gameplay-b:operation-capability:frontline-protection'],
    reasonIds: ['gameplay-b:operation-reason:hoshino-veteran'],
  },
  {
    id: 'gameplay-b:student-operation-profile:serika-carousel-safety',
    characterId: Character.Serika,
    candidateActionIds: [IDS.actions.signal, IDS.actions.crowdGuide],
    actionPriorityIds: [IDS.actions.signal, IDS.actions.crowdGuide],
    capabilityIds: ['gameplay-b:operation-capability:crowd-coordination'],
    reasonIds: ['gameplay-b:operation-reason:serika-crowd-awareness'],
    randomSkillRuleId: 'serika-stay-focused',
  },
  {
    id: 'gameplay-b:student-operation-profile:shiroko-carousel-safety',
    characterId: Character.Shiroko,
    candidateActionIds: [IDS.actions.shield],
    actionPriorityIds: [IDS.actions.shield],
    capabilityIds: ['gameplay-b:operation-capability:precision'],
    reasonIds: ['gameplay-b:operation-reason:shiroko-precision'],
  },
];

const actionDefinitions: readonly OperationActionDef[] = [
  {
    id: IDS.actions.brace,
    title: '压住制动杆',
    description: '稳住设备；与芹香的节奏信号可形成合流。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['gameplay-b:operation-reason:brace-the-brake'],
    tagIds: ['gameplay-b:operation-tag:brake'],
    target: { kind: 'actor', relation: 'any', allowedActorIds: TARGET_RIDE },
    effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }],
  },
  {
    id: IDS.actions.emergencyStop,
    title: '紧急停机',
    description: '消耗星野 1 点体力，危险度 -4；会放弃制动合流。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: ['gameplay-b:operation-capability:frontline-protection'],
    reasonIds: ['gameplay-b:operation-reason:emergency-stop'],
    tagIds: [],
    cost: { scope: 'actor', resourceId: 'stamina', amount: 1 },
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: -4 }],
  },
  {
    id: IDS.actions.signal,
    title: '节奏信号',
    description: '降低危险度，并可与制动动作形成合流。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['gameplay-b:operation-reason:signal-rhythm'],
    tagIds: ['gameplay-b:operation-tag:signal'],
    target: { kind: 'actor', relation: 'any', allowedActorIds: TARGET_RIDE },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: -1 }],
  },
  {
    id: IDS.actions.crowdGuide,
    title: '疏导游客',
    description: '消耗小组 1 点协调资源，危险度 -3；无法参与制动合流。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: ['gameplay-b:operation-capability:crowd-coordination'],
    reasonIds: ['gameplay-b:operation-reason:guide-the-crowd'],
    tagIds: ['gameplay-b:operation-tag:crowd-guide'],
    cost: { scope: 'team', resourceId: 'coordination', amount: 1 },
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: -3 }],
  },
  {
    id: IDS.actions.shield,
    title: '护住设备外框',
    description: '保护关键目标。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: ['gameplay-b:operation-capability:precision'],
    reasonIds: ['gameplay-b:operation-reason:shield-the-frame'],
    tagIds: [],
    target: { kind: 'actor', relation: 'any', allowedActorIds: TARGET_RIDE },
    effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: 1 }],
  },
  {
    id: IDS.actions.sabotage,
    title: '破坏安全闩',
    description: '破坏旋转木马安全闩，扣除 1 点设备耐久。',
    allowedParticipantKinds: ['opponent'],
    requiredCapabilityIds: [],
    reasonIds: ['gameplay-b:operation-reason:sabotage-the-latch'],
    tagIds: [],
    target: { kind: 'actor', relation: 'any', allowedActorIds: TARGET_RIDE },
    effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }],
  },
  {
    id: IDS.actions.alarm,
    title: '制造混乱',
    description: '推高现场危险度。',
    allowedParticipantKinds: ['opponent'],
    requiredCapabilityIds: [],
    reasonIds: ['gameplay-b:operation-reason:raise-an-alarm'],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: 2 }],
  },
  {
    id: IDS.actions.surge,
    title: '机械惯性',
    description: '旋转仍会推高危险度。',
    allowedParticipantKinds: ['environment'],
    requiredCapabilityIds: [],
    reasonIds: ['gameplay-b:operation-reason:mechanical-surge'],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: 1 }],
  },
];

const studentSkillRules: readonly OperationStudentSkillRuleDef[] = [{
  id: 'serika-stay-focused',
  triggerActionIds: [IDS.actions.signal],
  chanceBps: 5000,
  effects: [{ kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'focus', amount: 1 }],
}];

export const carouselSafetySliceContent = deepFreeze<OperationResolvedContent>({
  eventDefinition,
  participants: [
    { actorId: IDS.actors.hoshino, kind: 'student', profileId: 'gameplay-b:student-operation-profile:hoshino-carousel-safety' },
    { actorId: IDS.actors.serika, kind: 'student', profileId: 'gameplay-b:student-operation-profile:serika-carousel-safety' },
    { actorId: IDS.actors.shiroko, kind: 'student', profileId: 'gameplay-b:student-operation-profile:shiroko-carousel-safety' },
    {
      actorId: IDS.actors.saboteur,
      kind: 'opponent',
      factionId: 'gameplay-b:operation-faction:ride-saboteurs',
      candidateActionIds: [IDS.actions.sabotage],
    },
    {
      actorId: IDS.actors.agitator,
      kind: 'opponent',
      factionId: 'gameplay-b:operation-faction:ride-saboteurs',
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
