import type { OperationActionDef } from '../../contracts/operation-action';
import type { OperationContentResolver, OperationResolvedContent } from '../../contracts/operation-content-resolver';
import type { OperationEventDef } from '../../contracts/operation';
import { Character } from '../../types/ids';
import { CAROUSEL_SAFETY_IDS } from './carousel-safety-ids';
import { carouselSafetySliceContent } from './carousel-safety-slice';

export const CAROUSEL_SCENE_ACTION_IDS = Object.freeze({
  event: 'demo:operation-event:carousel-scene-action-slice',
  actors: CAROUSEL_SAFETY_IDS.actors,
  locations: Object.freeze({
    platform: 'demo:operation-location:carousel-scene-platform',
    concourse: 'demo:operation-location:carousel-scene-concourse',
    exit: 'demo:operation-location:carousel-scene-exit',
  }),
  actions: Object.freeze({
    investigate: 'demo:operation-action:scene-investigate-control',
    guideCrowd: 'demo:operation-action:scene-guide-queue',
    treatTeam: 'demo:operation-action:scene-team-first-aid',
  }),
  sceneActions: Object.freeze({
    inspect: 'inspect-carousel-control',
    guide: 'guide-queue',
    firstAid: 'whole-team-first-aid',
  }),
  routes: Object.freeze({
    publicPath: 'scene-public-path',
    staffGate: 'scene-staff-gate',
    returnLoop: 'scene-return-loop',
    parkExit: 'scene-park-exit',
  }),
  item: 'demo:operation-item:scene-staff-pass',
  fact: 'demo:operation-fact:scene-carousel-secured',
  track: 'demo:operation-track:scene-queue-order',
});

const IDS = CAROUSEL_SCENE_ACTION_IDS;
const objective = {
  id: 'scene-carousel-secured',
  description: 'The carousel control has been checked and the staff pass collected.',
  kind: 'primary' as const,
  predicate: { kind: 'knownFact' as const, factId: IDS.fact, present: true },
};

const eventDefinition: OperationEventDef = {
  ...carouselSafetySliceContent.eventDefinition,
  id: IDS.event,
  locations: [
    {
      id: IDS.locations.platform,
      enabledActionIds: [],
      combinationRules: [],
      actionMode: 'individual',
      sceneActionBatches: 1,
      sceneActions: [
        { id: IDS.sceneActions.inspect, actionId: IDS.actions.investigate, scope: 'individual', playerCost: 1 },
        { id: IDS.sceneActions.guide, actionId: IDS.actions.guideCrowd, scope: 'individual', playerCost: 1 },
      ],
      costGain: 2,
      maxCarryCost: 3,
      objectives: [objective],
      routeEdges: [
        {
          id: IDS.routes.staffGate,
          targetLocationId: IDS.locations.concourse,
          label: 'Crew access gate',
          description: 'Use the staff pass for the restricted route.',
          requiredHeldItemId: IDS.item,
          consumeRequiredHeldItem: true,
        },
        {
          id: IDS.routes.publicPath,
          targetLocationId: IDS.locations.concourse,
          label: 'Public concourse',
          description: 'Take the public route and keep any staff pass.',
        },
      ],
    },
    {
      id: IDS.locations.concourse,
      enabledActionIds: [],
      combinationRules: [],
      actionMode: 'global',
      sceneActionBatches: 1,
      sceneActions: [
        { id: IDS.sceneActions.firstAid, actionId: IDS.actions.treatTeam, scope: 'global', playerCost: 2 },
      ],
      costGain: 1,
      maxCarryCost: 2,
      routeEdges: [
        {
          id: IDS.routes.returnLoop,
          targetLocationId: IDS.locations.platform,
          label: 'Return to the ride',
          description: 'Revisit the carousel area; the route visit limit prevents an endless loop.',
        },
        {
          id: IDS.routes.parkExit,
          targetLocationId: IDS.locations.exit,
          label: 'Leave the park',
          description: 'End the operation after the concourse check.',
        },
      ],
    },
    {
      id: IDS.locations.exit,
      enabledActionIds: [],
      combinationRules: [],
      objectives: [objective],
      routeEdges: [],
    },
  ],
  initialLocationId: IDS.locations.platform,
  maxLocationVisits: 6,
  tracks: [
    ...carouselSafetySliceContent.eventDefinition.tracks,
    { id: IDS.track, initial: 2, min: 0, max: 4 },
  ],
  factIds: [IDS.fact],
  knownFactIds: [],
  itemIds: [IDS.item],
  heldItemIds: [],
  objectives: [objective],
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
    }],
    initialDraw: 1,
    locationEntryDraw: 1,
    maxHandSize: 3,
  },
};

const actionDefinitions: readonly OperationActionDef[] = [
  {
    id: IDS.actions.investigate,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['demo:operation-reason:inspect-control-panel'],
    tagIds: [],
    target: { kind: 'none' },
    effects: [
      { kind: 'eventFact', factId: IDS.fact, op: 'reveal' },
      { kind: 'heldItem', itemId: IDS.item, op: 'grant' },
    ],
  },
  {
    id: IDS.actions.guideCrowd,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['demo:operation-reason:guide-queue'],
    tagIds: [],
    target: { kind: 'none' },
    effects: [{ kind: 'eventTrackDelta', trackId: IDS.track, amount: -1 }],
  },
  {
    id: IDS.actions.treatTeam,
    allowedParticipantKinds: ['student'],
    requiredCapabilityIds: [],
    reasonIds: ['demo:operation-reason:first-aid-team'],
    tagIds: [],
    target: { kind: 'actor', relation: 'sameTeam' },
    effects: [
      { kind: 'actorHpDelta', recipient: 'target', amount: 1 },
      { kind: 'eventTrackDelta', trackId: IDS.track, amount: -1 },
    ],
  },
];

const sceneActionIds = Object.values(IDS.actions);
const content: OperationResolvedContent = {
  ...carouselSafetySliceContent,
  eventDefinition,
  studentProfiles: carouselSafetySliceContent.studentProfiles.map(profile => {
    const isCarouselStudent = profile.characterId === Character.Hoshino
      || profile.characterId === Character.Serika
      || profile.characterId === Character.Shiroko;
    return isCarouselStudent
      ? {
        ...profile,
        candidateActionIds: [...profile.candidateActionIds, ...sceneActionIds],
        actionPriorityIds: [...profile.actionPriorityIds, ...sceneActionIds],
      }
      : profile;
  }),
  actionDefinitions: [...carouselSafetySliceContent.actionDefinitions, ...actionDefinitions],
};

export const carouselSceneActionSliceContent: OperationResolvedContent = Object.freeze(content);

export const carouselSceneActionSliceResolver: OperationContentResolver = Object.freeze({
  resolve(eventId: string) {
    return eventId === IDS.event ? carouselSceneActionSliceContent : null;
  },
});
