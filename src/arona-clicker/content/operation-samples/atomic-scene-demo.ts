import type {
  OperationActorDef,
  OperationActionDef,
  OperationEventContentDef,
  OperationLocationDef,
  StudentOperationProfileDef,
} from '../../../data-services/contracts/operation';
import { Character } from '../../types/ids';
import { CAROUSEL_SAFETY_IDS } from './carousel-safety-ids';
import { carouselSceneActionSliceContent } from './carousel-scene-action-slice';

export const ATOMIC_SCENE_DEMO_IDS = Object.freeze({
  event: 'gameplay-b:operation-event:atomic-scene-demo',
  location: 'gameplay-b:operation-location:atomic-scene-demo',
  exitLocation: 'gameplay-b:operation-location:atomic-scene-demo-exit',
  scene: 'investigate-equipment',
  alarmScene: 'handle-alarm',
  sceneAction: 'inspect-equipment',
  alarmSceneAction: 'disable-alarm',
  alarmGroupSceneAction: 'suppress-front-row',
  alarmMoveSceneAction: 'move-enemy-back',
  route: 'leave-equipment-site',
  action: 'gameplay-b:operation-action:atomic-scene-inspect',
  alarmAction: 'gameplay-b:operation-action:atomic-scene-disable-alarm',
  alarmGroupAction: 'gameplay-b:operation-action:atomic-scene-suppress-front-row',
  alarmMoveAction: 'gameplay-b:operation-action:atomic-scene-move-enemy-back',
  enemyFrontA: 'gameplay-b:operation-actor:atomic-scene-front-a',
  enemyFrontB: 'gameplay-b:operation-actor:atomic-scene-front-b',
  enemyBack: 'gameplay-b:operation-actor:atomic-scene-back',
  actorlessAction: 'gameplay-b:operation-action:atomic-scene-remote-stop',
  actorlessCard: 'remote-stop',
  hoshinoProfile: 'gameplay-b:student-operation-profile:atomic-scene-hoshino',
  serikaProfile: 'gameplay-b:student-operation-profile:atomic-scene-serika',
  environmentTeam: 'gameplay-b:operation-team:atomic-scene-ride',
  repairClueFact: 'repair-clue-found',
  alarmDisabledFact: 'alarm-disabled',
});

const base = carouselSceneActionSliceContent;
const selectedActorIds = new Set<string>([
  CAROUSEL_SAFETY_IDS.actors.hoshino,
  CAROUSEL_SAFETY_IDS.actors.serika,
  CAROUSEL_SAFETY_IDS.actors.ride,
]);
const actors = base.eventDefinition.actors.filter(actor => selectedActorIds.has(actor.id));
const sceneLocationId = ATOMIC_SCENE_DEMO_IDS.location;
const environmentTeamId = ATOMIC_SCENE_DEMO_IDS.environmentTeam;
const track = base.eventDefinition.tracks.find(row => row.id === CAROUSEL_SAFETY_IDS.track);
if (!track) throw new Error('Atomic Scene demo requires the carousel danger track');
const rideActor = actors.find(actor => actor.id === CAROUSEL_SAFETY_IDS.actors.ride);
if (!rideActor) throw new Error('Atomic Scene demo requires the carousel environment Actor');

const alarmEnemies: readonly OperationActorDef[] = [
  { ...rideActor, id: ATOMIC_SCENE_DEMO_IDS.enemyFrontA, type: 'opponent', displayName: '敌人甲', teamId: environmentTeamId,
    positionId: 'front', hp: { initial: 3, min: 0, max: 3 } },
  { ...rideActor, id: ATOMIC_SCENE_DEMO_IDS.enemyFrontB, type: 'opponent', displayName: '敌人乙', teamId: environmentTeamId,
    positionId: 'front', hp: { initial: 3, min: 0, max: 3 } },
  { ...rideActor, id: ATOMIC_SCENE_DEMO_IDS.enemyBack, type: 'opponent', displayName: '敌人丙', teamId: environmentTeamId,
    positionId: 'back', hp: { initial: 3, min: 0, max: 3 } },
];

export const atomicSceneDemoAction: OperationActionDef = {
  id: ATOMIC_SCENE_DEMO_IDS.action,
  title: '检查故障设备',
  description: '检查控制线路，找到修理警报装置的线索。',
  allowedParticipantKinds: ['student'],
  requiredCapabilityIds: ['gameplay-b:operation-capability:frontline-protection'],
  reasonIds: [],
  tagIds: [],
  target: { kind: 'actor', relation: 'otherTeam', allowedActorIds: [CAROUSEL_SAFETY_IDS.actors.ride] },
  effects: [{ kind: 'eventFact', factId: ATOMIC_SCENE_DEMO_IDS.repairClueFact, op: 'reveal' }],
};

export const atomicSceneDemoAlarmAction: OperationActionDef = {
  id: ATOMIC_SCENE_DEMO_IDS.alarmAction,
  title: '解除警报',
  description: '从当前前排敌人中明确选择一名，切断警报装置并解除现场危险。',
  allowedParticipantKinds: ['student'],
  requiredCapabilityIds: ['gameplay-b:operation-capability:frontline-protection'],
  reasonIds: [],
  tagIds: [],
  target: {
    kind: 'actor', relation: 'otherTeam', allowedActorTypes: ['opponent'], allowedPositionIds: ['front', 'back'], selectionMode: 'select',
  },
  effects: [
    { kind: 'actorHpDelta', recipient: 'target', amount: -1 },
    { kind: 'eventTrackDelta', trackId: track.id, amount: -3 },
    { kind: 'eventFact', factId: ATOMIC_SCENE_DEMO_IDS.alarmDisabledFact, op: 'reveal' },
  ],
};

export const atomicSceneDemoAlarmGroupAction: OperationActionDef = {
  id: ATOMIC_SCENE_DEMO_IDS.alarmGroupAction,
  title: '压制敌方前排',
  description: '自动作用于当前仍存活、位于前排且属于敌方的所有目标。',
  allowedParticipantKinds: ['student'],
  requiredCapabilityIds: ['gameplay-b:operation-capability:frontline-protection'],
  reasonIds: [],
  tagIds: [],
  target: {
    kind: 'actor', relation: 'otherTeam', allowedActorTypes: ['opponent'], allowedPositionIds: ['front'], selectionMode: 'all-eligible',
  },
  effects: [{ kind: 'actorHpDelta', recipient: 'target', amount: -1 }],
};

export const atomicSceneDemoAlarmMoveAction: OperationActionDef = {
  id: ATOMIC_SCENE_DEMO_IDS.alarmMoveAction,
  title: '把一名敌人逼退',
  description: '明确选择一名前排敌人，将其移动到后排。',
  allowedParticipantKinds: ['student'],
  requiredCapabilityIds: ['gameplay-b:operation-capability:frontline-protection'],
  reasonIds: [],
  tagIds: [],
  target: {
    kind: 'actor', relation: 'otherTeam', allowedActorTypes: ['opponent'], allowedPositionIds: ['front'], selectionMode: 'select',
  },
  effects: [{ kind: 'actorPosition', recipient: 'target', positionId: 'back' }],
};

export const atomicSceneDemoActorlessAction: OperationActionDef = {
  id: ATOMIC_SCENE_DEMO_IDS.actorlessAction,
  title: '遥控停机',
  description: '使用现场遥控器降低旋转木马危险度。',
  allowedParticipantKinds: ['student'],
  requiredCapabilityIds: [],
  reasonIds: [],
  tagIds: [],
  target: { kind: 'none' },
  effects: [{ kind: 'eventTrackDelta', trackId: track.id, amount: -4 }],
};

export const atomicSceneDemoHoshinoProfile: StudentOperationProfileDef = {
  id: ATOMIC_SCENE_DEMO_IDS.hoshinoProfile,
  characterId: Character.Hoshino,
  candidateActionIds: [ATOMIC_SCENE_DEMO_IDS.action, ATOMIC_SCENE_DEMO_IDS.alarmAction],
  actionPriorityIds: [ATOMIC_SCENE_DEMO_IDS.action, ATOMIC_SCENE_DEMO_IDS.alarmAction],
  capabilityIds: ['gameplay-b:operation-capability:frontline-protection'],
  reasonIds: [],
};

export const atomicSceneDemoSerikaProfile: StudentOperationProfileDef = {
  id: ATOMIC_SCENE_DEMO_IDS.serikaProfile,
  characterId: Character.Serika,
  candidateActionIds: [ATOMIC_SCENE_DEMO_IDS.action, ATOMIC_SCENE_DEMO_IDS.alarmAction],
  actionPriorityIds: [ATOMIC_SCENE_DEMO_IDS.action, ATOMIC_SCENE_DEMO_IDS.alarmAction],
  capabilityIds: ['gameplay-b:operation-capability:frontline-protection'],
  reasonIds: [],
};

const sceneActors = [
  ...actors.map(actor => actor.id === CAROUSEL_SAFETY_IDS.actors.ride
    ? { ...actor, teamId: ATOMIC_SCENE_DEMO_IDS.environmentTeam }
    : actor),
  ...alarmEnemies,
];

export const atomicSceneDemoLocation: OperationLocationDef = {
  id: sceneLocationId,
  stage: 'scene',
  enabledActionIds: [],
  combinationRules: [],
  scenes: [{
    id: ATOMIC_SCENE_DEMO_IDS.scene,
    title: '调查故障设备',
    description: '找到警报设备的维修线索后，本场景完成；之后仍留在此地点处理警报。',
    actionMode: 'individual',
    sceneActionBatches: 3,
    sceneActions: [{
      id: ATOMIC_SCENE_DEMO_IDS.sceneAction,
      actionId: ATOMIC_SCENE_DEMO_IDS.action,
      scope: 'individual',
      playerCost: 0,
      performerPolicy: 'selected-student',
      selectionPolicy: 'fixed',
      title: '检查故障设备',
    }],
    completion: { kind: 'knownFact', factId: ATOMIC_SCENE_DEMO_IDS.repairClueFact, present: true },
  }, {
    id: ATOMIC_SCENE_DEMO_IDS.alarmScene,
    title: '处理现场警报',
    description: '先压制当前前排，再明确选择一名敌人改变站位；第二次群体行动会重新计算并只作用于剩余合格目标。最后明确选择一名敌人解除警报。',
    actionMode: 'global',
    sceneActionBatches: 4,
    sceneActions: [{
      id: ATOMIC_SCENE_DEMO_IDS.alarmGroupSceneAction,
      actionId: ATOMIC_SCENE_DEMO_IDS.alarmGroupAction,
      scope: 'global',
      playerCost: 0,
      performerPolicy: 'selected-student',
      selectionPolicy: 'required',
      title: '压制敌方前排',
    }, {
      id: ATOMIC_SCENE_DEMO_IDS.alarmSceneAction,
      actionId: ATOMIC_SCENE_DEMO_IDS.alarmAction,
      scope: 'global',
      playerCost: 0,
      performerPolicy: 'selected-student',
      selectionPolicy: 'required',
      title: '选择一名敌人解除警报',
    }, {
      id: ATOMIC_SCENE_DEMO_IDS.alarmMoveSceneAction,
      actionId: ATOMIC_SCENE_DEMO_IDS.alarmMoveAction,
      scope: 'global',
      playerCost: 0,
      performerPolicy: 'selected-student',
      selectionPolicy: 'required',
      title: '把一名敌人逼退',
    }],
    completion: { kind: 'knownFact', factId: ATOMIC_SCENE_DEMO_IDS.alarmDisabledFact, present: true },
  }],
  objectives: [{
    id: 'alarm-cleared',
    description: '现场警报已解除。',
    kind: 'primary',
    predicate: { kind: 'knownFact', factId: ATOMIC_SCENE_DEMO_IDS.alarmDisabledFact, present: true },
  }],
  routeEdges: [{
    id: ATOMIC_SCENE_DEMO_IDS.route,
    targetLocationId: ATOMIC_SCENE_DEMO_IDS.exitLocation,
    label: '离开设备现场',
    description: '调查完成，警报解除；可以离开现场。',
  }],
};

export const atomicSceneDemoExitLocation: OperationLocationDef = {
  id: ATOMIC_SCENE_DEMO_IDS.exitLocation,
  stage: 'scene',
  enabledActionIds: [],
  combinationRules: [],
  routeEdges: [],
};

export const atomicSceneDemoEvent: OperationEventContentDef = {
  id: ATOMIC_SCENE_DEMO_IDS.event,
  title: '原子场景演示',
  description: '两名学生先调查旋转木马设备，再压制敌方前排、改变敌人站位并明确选择一人处理警报。',
  initId: 'base:init:schale_office',
  resumeVersion: 3,
  locationIds: [sceneLocationId, ATOMIC_SCENE_DEMO_IDS.exitLocation],
  initialLocationId: sceneLocationId,
  maxLocationVisits: 2,
  tracks: [{ ...track, initial: 3 }],
  factIds: [ATOMIC_SCENE_DEMO_IDS.repairClueFact, ATOMIC_SCENE_DEMO_IDS.alarmDisabledFact],
  knownFactIds: [],
  itemIds: [],
  heldItemIds: [],
  playerSceneDeck: {
    cards: [{
      id: ATOMIC_SCENE_DEMO_IDS.actorlessCard,
      actionId: ATOMIC_SCENE_DEMO_IDS.actorlessAction,
      playerCost: 0,
      timing: 'scene',
      copies: 1,
      performerPolicy: 'none',
      selectionPolicy: 'required',
      title: '遥控停机',
    }],
    initialDraw: 1,
    locationEntryDraw: 0,
    maxHandSize: 1,
  },
  teams: [...(base.eventDefinition.teams ?? []), { id: environmentTeamId, resources: {} }],
  actors: sceneActors,
  participants: [
    ...base.participants.filter(participant => selectedActorIds.has(participant.actorId))
      .map(participant => participant.kind === 'environment'
      ? { ...participant, candidateActionIds: [] }
        : participant.actorId === CAROUSEL_SAFETY_IDS.actors.hoshino
          ? { ...participant, profileId: ATOMIC_SCENE_DEMO_IDS.hoshinoProfile }
          : participant.actorId === CAROUSEL_SAFETY_IDS.actors.serika
            ? { ...participant, profileId: ATOMIC_SCENE_DEMO_IDS.serikaProfile }
            : participant),
    ...alarmEnemies.map(actor => ({ actorId: actor.id, kind: 'opponent' as const, candidateActionIds: [] })),
  ],
  studentSkillRules: base.studentSkillRules,
  playerRouteState: { playerCost: 0 },
};
