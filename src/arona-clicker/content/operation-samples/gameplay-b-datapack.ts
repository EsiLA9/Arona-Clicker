import type { Datapack } from '../../../data-services/contracts/datapack';
import type {
  OperationEventContentDef,
  OperationLocationDef,
} from '../../../data-services/contracts/operation';
import { CAROUSEL_SCENE_ACTION_IDS as IDS, carouselSceneActionSliceContent } from './carousel-scene-action-slice';

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
  resumeVersion: 1,
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
export const gameplayBCarouselDatapack: Datapack = {
  modName: 'demo',
  name: 'Gameplay B Carousel Demo',
  version: '1.0.0',
  inits: [],
  areas: [],
  spots: [],
  enhancements: [],
  activeStories: [],
  passiveStories: [],
  stories: [],
  items: [],
  funcletDefs: [],
  characters: [],
  operationEvents: [event],
  operationLocations: [...locations],
  operationActions: [...carouselSceneActionSliceContent.actionDefinitions],
  studentOperationProfiles: [...studentProfiles],
};
