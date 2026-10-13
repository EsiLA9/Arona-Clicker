import type {
  OperationActionDef,
  OperationActorDef,
  OperationEventContentDef,
  OperationLocationDef,
  StudentOperationProfileDef,
} from '../../../data-services/contracts/operation';
import { Character } from '../../types/ids';
import { atomicSceneDemoEvent } from './atomic-scene-demo';
import { CAROUSEL_SAFETY_IDS } from './carousel-safety-ids';

export const REST_SCENE_DEMO_IDS = Object.freeze({
  event: 'gameplay-b:operation-event:rest-scene-demo',
  location: 'gameplay-b:operation-location:rest-scene-demo',
  scene: 'rest-cycle',
  team: 'gameplay-b:operation-team:rest-party',
  track: 'gameplay-b:operation-track:rest-readiness',
  actions: Object.freeze({
    care: 'gameplay-b:operation-action:rest-care-companion',
    organize: 'gameplay-b:operation-action:rest-organize-kit',
    tea: 'gameplay-b:operation-action:rest-make-tea',
    meal: 'gameplay-b:operation-action:rest-share-meal',
    snacks: 'gameplay-b:operation-action:rest-pack-snacks',
    mark: 'gameplay-b:operation-action:rest-mark-checklist',
  }),
  sceneAction: 'record-rest-checklist',
  cards: Object.freeze({ meal: 'shared-meal', snacks: 'packed-snacks' }),
  profiles: Object.freeze({
    hoshino: 'gameplay-b:student-operation-profile:rest-hoshino',
    serika: 'gameplay-b:student-operation-profile:rest-serika',
  }),
} as const);

const ids = REST_SCENE_DEMO_IDS;
const hoshinoId = CAROUSEL_SAFETY_IDS.actors.hoshino;
const serikaId = CAROUSEL_SAFETY_IDS.actors.serika;

function makeRestActor(actorId: string, displayName: string, partnerId: string, hp: number): OperationActorDef {
  const source = atomicSceneDemoEvent.actors.find(actor => actor.id === actorId);
  if (!source) throw new Error('Rest Scene demo requires its fixed Carousel Character source actor: ' + actorId);
  return {
    ...source,
    type: 'student',
    displayName,
    hp: { initial: hp, min: 0, max: hp + 1 },
    resources: { focus: { initial: 0, min: 0, max: 2 } },
    teamId: ids.team,
    targetPriorityActorIds: [partnerId, actorId],
  };
}

export const restSceneDemoActors: readonly OperationActorDef[] = [
  makeRestActor(hoshinoId, '小鸟游星野', serikaId, 3),
  makeRestActor(serikaId, '黑见芹香', hoshinoId, 2),
];

export const restSceneDemoActions: readonly OperationActionDef[] = [
  {
    id: ids.actions.care,
    title: '照顾同伴',
    description: '为选定队员整理专注状态，也让整队更从容。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'actor', relation: 'sameTeam', allowedActorIds: [hoshinoId, serikaId] },
    effects: [
      { kind: 'actorResourceDelta', recipient: 'target', resourceId: 'focus', amount: 1 },
      { kind: 'eventTrackDelta', trackId: ids.track, amount: 1 },
    ],
  },
  {
    id: ids.actions.organize,
    title: '整理装备',
    description: '收好装备并提升队伍整备度。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [
      { kind: 'actorResourceDelta', recipient: 'actor', resourceId: 'focus', amount: 1 },
      { kind: 'eventTrackDelta', trackId: ids.track, amount: 1 },
    ],
  },
  {
    id: ids.actions.tea,
    title: '给同伴倒热茶',
    description: '给选定队员倒杯热茶，也提升队伍整备度。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'actor', relation: 'sameTeam', allowedActorIds: [hoshinoId, serikaId] },
    effects: [
      { kind: 'actorResourceDelta', recipient: 'target', resourceId: 'focus', amount: 1 },
      { kind: 'eventTrackDelta', trackId: ids.track, amount: 1 },
    ],
  },
  {
    id: ids.actions.meal,
    title: '共同用餐',
    description: '一起吃点东西，提升队伍整备度。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: ids.track, amount: 1 }],
  },
  {
    id: ids.actions.snacks,
    title: '分装点心',
    description: '准备下一段路上的点心，提升队伍整备度。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: ids.track, amount: 1 }],
  },
  {
    id: ids.actions.mark,
    title: '整理休整清单',
    description: '把已经完成的休整项目记录下来。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: [],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: ids.track, amount: 1 }],
  },
];

export const restSceneDemoStudentProfiles: readonly StudentOperationProfileDef[] = [
  {
    id: ids.profiles.hoshino,
    characterId: Character.Hoshino,
    candidateActionIds: [ids.actions.care, ids.actions.tea, ids.actions.organize],
    actionPriorityIds: [ids.actions.care, ids.actions.tea, ids.actions.organize],
    capabilityIds: [],
    reasonIds: [],
  },
  {
    id: ids.profiles.serika,
    characterId: Character.Serika,
    candidateActionIds: [ids.actions.organize, ids.actions.care, ids.actions.tea],
    actionPriorityIds: [ids.actions.organize, ids.actions.care, ids.actions.tea],
    capabilityIds: [],
    reasonIds: [],
  },
];

export const restSceneDemoLocation: OperationLocationDef = {
  id: ids.location,
  stage: 'scene',
  enabledActionIds: [ids.actions.care, ids.actions.organize],
  combinationRules: [],
  scenes: [{
    id: ids.scene,
    title: '并肩休整',
    description: '每批由两名学生按各自行动优先级休整；玩家可以同时打出一张场景手牌。',
    enabledActionIds: [ids.actions.care, ids.actions.organize],
    autoCharacterActions: true,
    actionMode: 'global',
    sceneActions: [{
      id: ids.sceneAction,
      actionId: ids.actions.mark,
      scope: 'global',
      playerCost: 0,
      performerPolicy: 'none',
      selectionPolicy: 'fixed',
      title: '固定整理休整清单',
    }],
    completion: { kind: 'track', trackId: ids.track, operator: 'gte', value: 4 },
  }],
  objectives: [{
    id: 'rest-readiness-reached',
    description: '队伍整备度达到 4。',
    kind: 'primary',
    predicate: { kind: 'track', trackId: ids.track, operator: 'gte', value: 4 },
  }],
  routeEdges: [],
};

export const restSceneDemoEvent: OperationEventContentDef = {
  id: ids.event,
  title: 'Gameplay B 休整演示',
  description: '两名学生会按自己的手牌、行动优先级和合法目标自主休整；你可以不干预直接提交，也可以打出玩家手牌或修改一名学生的目标。',
  initId: 'base:init:schale_office',
  resumeVersion: 1,
  locationIds: [ids.location],
  initialLocationId: ids.location,
  maxLocationVisits: 1,
  tracks: [{ id: ids.track, initial: 0, min: 0, max: 4 }],
  factIds: [],
  knownFactIds: [],
  itemIds: [],
  heldItemIds: [],
  objectives: [{
    id: 'rest-event-complete',
    description: '两名队员共同完成休整。',
    kind: 'primary',
    predicate: { kind: 'track', trackId: ids.track, operator: 'gte', value: 4 },
  }],
  actors: restSceneDemoActors,
  teams: [{ id: ids.team, resources: {} }],
  participants: [
    { actorId: hoshinoId, kind: 'student', profileId: ids.profiles.hoshino },
    { actorId: serikaId, kind: 'student', profileId: ids.profiles.serika },
  ],
  characterHandSize: 2,
  playerRouteState: { playerCost: 2 },
  playerSceneDeck: {
    cards: [
      { id: ids.cards.meal, actionId: ids.actions.meal, playerCost: 1, timing: 'scene', copies: 1, title: '共进晚餐', performerPolicy: 'none', selectionPolicy: 'required' },
      { id: ids.cards.snacks, actionId: ids.actions.snacks, playerCost: 1, timing: 'scene', copies: 1, title: '准备路上点心', performerPolicy: 'none', selectionPolicy: 'required' },
    ],
    initialDraw: 2,
    locationEntryDraw: 2,
    maxHandSize: 2,
  },
  randomSeed: 29,
};
