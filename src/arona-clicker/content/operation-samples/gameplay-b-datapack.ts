import type { Datapack } from '../../../data-services/contracts/datapack';
import { spot } from '../def-factory/spot';
import { tagPath } from '../../../engine/core/tag';
import type {
  OperationEventContentDef,
  OperationLocationDef,
} from '../../../data-services/contracts/operation';
import { CAROUSEL_SCENE_ACTION_IDS as IDS, carouselSceneActionSliceContent } from './carousel-scene-action-slice';
import {
  atomicSceneDemoAction,
  atomicSceneDemoAlarmAction,
  atomicSceneDemoAlarmGroupAction,
  atomicSceneDemoAlarmMoveAction,
  atomicSceneDemoActorlessAction,
  atomicSceneDemoEvent,
  atomicSceneDemoHoshinoProfile,
  atomicSceneDemoLocation,
  atomicSceneDemoExitLocation,
  atomicSceneDemoSerikaProfile,
} from './atomic-scene-demo';
import {
  sceneOfferPurchaseDemoActions,
  sceneOfferPurchaseDemoEvent,
  sceneOfferPurchaseDemoExitLocation,
  sceneOfferPurchaseDemoHoshinoProfile,
  sceneOfferPurchaseDemoLocation,
} from './scene-offer-purchase-demo';
import {
  restSceneDemoActions,
  restSceneDemoEvent,
  restSceneDemoLocation,
  restSceneDemoStudentProfiles,
} from './rest-scene-demo';

function localId(id: string): string {
  return id.slice(id.lastIndexOf(':') + 1);
}

function localizeLocation(location: OperationLocationDef): OperationLocationDef {
  return {
    ...location,
    combinationRules: location.combinationRules.map(rule => ({ ...rule, id: localId(rule.id) })),
    objectives: location.objectives?.map(objective => ({ ...objective, id: localId(objective.id) })),
    partialOutcomes: location.partialOutcomes?.map(outcome => ({ ...outcome, id: localId(outcome.id) })),
    failureConditions: location.failureConditions?.map(outcome => ({ ...outcome, id: localId(outcome.id) })),
    sceneActions: location.sceneActions?.map(action => ({ ...action, id: localId(action.id) })),
    routeEdges: location.routeEdges.map(edge => ({ ...edge, id: localId(edge.id) })),
  };
}

const locations: readonly OperationLocationDef[] = carouselSceneActionSliceContent.eventDefinition.locations.map(localizeLocation);
const eventFields = (({ locations: _locations, ...event }) => event)(carouselSceneActionSliceContent.eventDefinition);

const studentProfiles = carouselSceneActionSliceContent.studentProfiles;
const participants = carouselSceneActionSliceContent.participants.map(participant => {
  if (participant.kind !== 'student' || participant.profileId) return participant;
  throw new Error('The fixed-roster carousel Datapack requires explicit StudentOperationProfile references');
});

const event: OperationEventContentDef = {
  ...eventFields,
  id: IDS.event,
  initId: 'base:init:schale_office',
  resumeVersion: 3,
  locationIds: locations.map(location => location.id),
  initialLocationId: IDS.locations.platform,
  objectives: eventFields.objectives?.map(objective => ({ ...objective, id: localId(objective.id) })),
  partialOutcomes: eventFields.partialOutcomes?.map(outcome => ({ ...outcome, id: localId(outcome.id) })),
  hardFailureConditions: eventFields.hardFailureConditions?.map(outcome => ({ ...outcome, id: localId(outcome.id) })),
  participants,
  studentSkillRules: carouselSceneActionSliceContent.studentSkillRules.map(rule => ({ ...rule, id: localId(rule.id) })),
  playerSceneDeck: eventFields.playerSceneDeck ? {
    ...eventFields.playerSceneDeck,
    cards: eventFields.playerSceneDeck.cards.map(card => ({ ...card, id: localId(card.id) })),
  } : undefined,
};

/**
 * Standalone, formally typed Operation content pack for the carousel vertical slice.
 * It depends on base Character and Init definitions and is loaded after the base pack.
 */
export const GAMEPLAY_B_OPERATION_SPOT_ID = 'gameplay-b:spot:operation_terminal';

export const gameplayBCarouselDatapack: Datapack = {
  modName: 'gameplay-b',
  name: 'Gameplay B Carousel Demo',
  version: '1.0.0',
  inits: [],
  areas: [],
  spots: [spot(GAMEPLAY_B_OPERATION_SPOT_ID, 'base:area:schale_main')
    .name('行动终端').desc('选择一项行动关卡，组织学生出动；进行中的关卡可以从对应功能继续。')
    .cost(0).maxLevel(1).tags(tagPath('tactical'), tagPath('office'))
    .operationEntry('carousel', event.id)
    .operationEntry('atomic-scene', atomicSceneDemoEvent.id)
    .operationEntry('scene-offer-purchase', sceneOfferPurchaseDemoEvent.id)
    .operationEntry('rest-scene', restSceneDemoEvent.id)
    .build()],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [],
  funcletDefs: [],
  characters: [],
  operationEvents: [event, atomicSceneDemoEvent, sceneOfferPurchaseDemoEvent, restSceneDemoEvent],
  operationLocations: [...locations, atomicSceneDemoLocation, atomicSceneDemoExitLocation, sceneOfferPurchaseDemoLocation, sceneOfferPurchaseDemoExitLocation, restSceneDemoLocation],
  operationActions: [
    ...carouselSceneActionSliceContent.actionDefinitions,
    atomicSceneDemoAction,
    atomicSceneDemoAlarmAction,
    atomicSceneDemoAlarmGroupAction,
    atomicSceneDemoAlarmMoveAction,
    atomicSceneDemoActorlessAction,
    ...sceneOfferPurchaseDemoActions,
    ...restSceneDemoActions,
  ],
  studentOperationProfiles: [...studentProfiles, atomicSceneDemoHoshinoProfile, atomicSceneDemoSerikaProfile, sceneOfferPurchaseDemoHoshinoProfile, ...restSceneDemoStudentProfiles],
};
