import type { OperationActionDef } from '../../contracts/operation-action';
import type { OperationContentResolver, OperationResolvedContent } from '../../contracts/operation-content-resolver';
import type { OperationEventDef } from '../../contracts/operation';
import { CAROUSEL_SAFETY_IDS } from './carousel-safety-ids';
import { carouselSafetySliceContent } from './carousel-safety-slice';

export const CAROUSEL_SCENE_ACTION_IDS = Object.freeze({
  event: 'gameplay-b:operation-event:carousel-scene-action-slice',
  actors: CAROUSEL_SAFETY_IDS.actors,
  locations: Object.freeze({
    platform: 'gameplay-b:operation-location:carousel-scene-platform',
    concourse: 'gameplay-b:operation-location:carousel-scene-concourse',
    exit: 'gameplay-b:operation-location:carousel-scene-exit',
  }),
  actions: Object.freeze({
    investigate: 'gameplay-b:operation-action:scene-investigate-control',
    guideCrowd: 'gameplay-b:operation-action:scene-guide-queue',
    treatTeam: 'gameplay-b:operation-action:scene-team-first-aid',
  }),
  sceneActions: Object.freeze({
    inspect: 'inspect-carousel-control',
    guide: 'guide-queue',
    firstAid: 'whole-team-first-aid',
  }),
  routes: Object.freeze({
    platformToConcourse: 'ride-to-concourse',
    publicPath: 'scene-public-path',
    staffGate: 'scene-staff-gate',
  }),
  item: 'gameplay-b:operation-item:scene-staff-pass',
  fact: 'gameplay-b:operation-fact:scene-carousel-secured',
  track: 'gameplay-b:operation-track:scene-queue-order',
});

const IDS = CAROUSEL_SCENE_ACTION_IDS;
const objective = {
  id: 'scene-carousel-secured',
  description: '收好员工证，并把旋转木马危险度降至安全范围。',
  kind: 'primary' as const,
  predicate: {
    kind: 'all' as const,
    terms: [
      { kind: 'knownFact' as const, factId: IDS.fact, present: true },
      { kind: 'track' as const, trackId: CAROUSEL_SAFETY_IDS.track, operator: 'lte' as const, value: 3 },
    ],
  },
};

const eventDefinition: OperationEventDef = {
  ...carouselSafetySliceContent.eventDefinition,
  id: IDS.event,
  locations: [
    {
      id: IDS.locations.platform,
      enabledActionIds: [
        CAROUSEL_SAFETY_IDS.actions.brace,
        CAROUSEL_SAFETY_IDS.actions.emergencyStop,
        CAROUSEL_SAFETY_IDS.actions.signal,
        CAROUSEL_SAFETY_IDS.actions.crowdGuide,
        CAROUSEL_SAFETY_IDS.actions.shield,
        CAROUSEL_SAFETY_IDS.actions.sabotage,
        CAROUSEL_SAFETY_IDS.actions.alarm,
        CAROUSEL_SAFETY_IDS.actions.surge,
      ],
      combinationRules: carouselSafetySliceContent.eventDefinition.locations[0].combinationRules,
      maxBeats: 1,
      costGain: 2,
      maxCarryCost: 3,
      routeEdges: [{
        id: IDS.routes.platformToConcourse,
        targetLocationId: IDS.locations.concourse,
        label: '前往游乐园通道',
        description: '战斗结束后前往入口通道继续处理游客与设备。',
      }],
    },
    {
      id: IDS.locations.concourse,
      enabledActionIds: [],
      combinationRules: [],
      actionMode: 'individual',
      sceneActionBatches: 1,
      sceneActions: [
        { id: IDS.sceneActions.inspect, actionId: IDS.actions.investigate, scope: 'individual', playerCost: 1,
          performerPolicy: 'selected-student', selectionPolicy: 'required', title: '检查控制台' },
        { id: IDS.sceneActions.guide, actionId: IDS.actions.guideCrowd, scope: 'individual', playerCost: 1,
          performerPolicy: 'selected-student', selectionPolicy: 'required', title: '引导游客' },
      ],
      costGain: 2,
      maxCarryCost: 2,
      routeEdges: [
        {
          id: IDS.routes.staffGate,
          targetLocationId: IDS.locations.exit,
          label: '员工通道',
          description: '出示员工证通过维修通道；转场时会收回证件。',
          requiredHeldItemId: IDS.item,
          consumeRequiredHeldItem: true,
        },
        {
          id: IDS.routes.publicPath,
          targetLocationId: IDS.locations.exit,
          label: '游客通道',
          description: '直接从公共通道前往出口。',
        },
      ],
    },
    {
      id: IDS.locations.exit,
      enabledActionIds: [],
      combinationRules: [],
      actionMode: 'global',
      sceneActionBatches: 1,
      sceneActions: [
        { id: IDS.sceneActions.firstAid, actionId: IDS.actions.treatTeam, scope: 'global', playerCost: 2,
          performerPolicy: 'optional-student', selectionPolicy: 'required', title: '全队急救' },
      ],
      costGain: 1,
      maxCarryCost: 2,
      routeEdges: [],
    },
  ],
  initialLocationId: IDS.locations.platform,
  tracks: [
    ...carouselSafetySliceContent.eventDefinition.tracks,
    { id: IDS.track, initial: 2, min: 0, max: 4 },
  ],
  factIds: [IDS.fact],
  knownFactIds: [],
  itemIds: [IDS.item],
  heldItemIds: [],
  objectives: [objective],
  partialOutcomes: [{
    id: 'carousel-partial-stable',
    description: '现场暂时稳定，但员工通道目标或危险度目标尚未全部达成。',
    predicate: { kind: 'track', trackId: CAROUSEL_SAFETY_IDS.track, operator: 'lte', value: 5 },
  }],
  rewards: {
    success: { kind: 'resource', resourceId: 'base:resource:credit', amount: 200 },
    partialSuccess: { kind: 'resource', resourceId: 'base:resource:credit', amount: 80 },
  },
  playerRouteState: {
    playerCost: 3,
  },
  playerSceneDeck: {
    cards: [{
      id: 'team-first-aid',
      actionId: IDS.actions.treatTeam,
      playerCost: 1,
      timing: 'scene',
      copies: 2,
      performerPolicy: 'optional-student',
      selectionPolicy: 'required',
      title: '团队急救包',
    }],
    initialDraw: 1,
    locationEntryDraw: 1,
    maxHandSize: 3,
  },
};

const actionDefinitions: readonly OperationActionDef[] = [
  {
    id: IDS.actions.investigate,
    title: '检查控制台',
    description: '发现员工证并记录设备已检查。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['gameplay-b:operation-reason:inspect-control-panel'],
    tagIds: [],
    target: { kind: 'none' },
    effects: [
      { kind: 'eventFact', factId: IDS.fact, op: 'reveal' },
      { kind: 'heldItem', itemId: IDS.item, op: 'grant' },
    ],
  },
  {
    id: IDS.actions.guideCrowd,
    title: '引导游客',
    description: '改善通道秩序。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['gameplay-b:operation-reason:guide-queue'],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: -1 }],
  },
  {
    id: IDS.actions.treatTeam,
    title: '全队急救',
    description: '为每名选定队员恢复 1 点 HP，并降低现场危险度。',
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['gameplay-b:operation-reason:first-aid-team'],
    tagIds: [],
    target: { kind: 'actor', relation: 'sameTeam', allowedActorIds: [CAROUSEL_SAFETY_IDS.actors.hoshino, CAROUSEL_SAFETY_IDS.actors.serika, CAROUSEL_SAFETY_IDS.actors.shiroko] },
    effects: [
      { kind: 'actorHpDelta', recipient: 'target', amount: 1 },
      { kind: 'eventTrackDelta', trackId: IDS.track, amount: -1 },
    ],
  },
];

const content: OperationResolvedContent = {
  ...carouselSafetySliceContent,
  eventDefinition,
  actionDefinitions: [...carouselSafetySliceContent.actionDefinitions, ...actionDefinitions],
};

export const carouselSceneActionSliceContent: OperationResolvedContent = Object.freeze(content);

export const carouselSceneActionSliceResolver: OperationContentResolver = Object.freeze({
  resolve(eventId: string) {
    return eventId === IDS.event ? carouselSceneActionSliceContent : null;
  },
});
