import type { OperationActionDef } from '../../contracts/operation-action';
import type { OperationContentResolver, OperationResolvedContent } from '../../contracts/operation-content-resolver';
import type { OperationEventDef } from '../../contracts/operation';
import { Character } from '../../types/ids';
import { carouselSafetySliceContent } from './carousel-safety-slice';

export const CAROUSEL_ROUTE_IDS = Object.freeze({
  event: 'gameplay-b:operation-event:carousel-route-slice',
  locations: Object.freeze({
    platform: 'gameplay-b:operation-location:carousel-route-platform',
    concourse: 'gameplay-b:operation-location:carousel-concourse',
    maintenance: 'gameplay-b:operation-location:carousel-maintenance-tunnel',
    ending: 'gameplay-b:operation-location:carousel-operator-exit',
  }),
  item: 'gameplay-b:operation-item:carousel-staff-pass',
  fact: 'gameplay-b:operation-fact:carousel-secured',
  action: 'gameplay-b:operation-action:carousel-secure-and-collect-pass',
  routes: Object.freeze({
    staffGate: 'gameplay-b:operation-route:carousel-staff-gate',
    concourse: 'gameplay-b:operation-route:carousel-concourse',
    emergencyExit: 'gameplay-b:operation-route:carousel-emergency-exit',
    platformLoop: 'gameplay-b:operation-route:carousel-platform-loop',
    maintenanceLoop: 'gameplay-b:operation-route:carousel-maintenance-loop',
    endFromConcourse: 'gameplay-b:operation-route:carousel-concourse-exit',
    endFromMaintenance: 'gameplay-b:operation-route:carousel-maintenance-exit',
  }),
});

const IDS = CAROUSEL_ROUTE_IDS;
const objective = {
  id: 'gameplay-b:operation-objective:carousel-secured',
  description: 'The carousel has been secured.',
  kind: 'primary' as const,
  predicate: { kind: 'knownFact' as const, factId: IDS.fact, present: true },
};
const location = (
  id: string,
  routeEdges: OperationEventDef['locations'][number]['routeEdges'],
) => ({
  id,
  enabledActionIds: [IDS.action],
  combinationRules: [],
  objectives: [objective],
  maxBeats: 2,
  routeEdges,
});

const eventDefinition: OperationEventDef = {
  ...carouselSafetySliceContent.eventDefinition,
  id: IDS.event,
  factIds: [IDS.fact],
  knownFactIds: [],
  itemIds: [IDS.item],
  heldItemIds: [],
  objectives: [objective],
  initialLocationId: IDS.locations.platform,
  maxLocationVisits: 6,
  locations: [
    location(IDS.locations.platform, [
      {
        id: IDS.routes.staffGate,
        targetLocationId: IDS.locations.maintenance,
        label: 'Staff gate',
        description: 'Unlock the maintenance tunnel and spend the staff pass.',
        requiredHeldItemId: IDS.item,
        consumeRequiredHeldItem: true,
      },
      {
        id: IDS.routes.concourse,
        targetLocationId: IDS.locations.concourse,
        label: 'Public concourse',
        description: 'Take the public route; the staff pass remains available.',
      },
      {
        id: IDS.routes.emergencyExit,
        targetLocationId: IDS.locations.ending,
        label: 'Use the emergency exit',
        description: 'End the visit now; leave the wider concourse unchecked.',
      },
    ]),
    location(IDS.locations.concourse, [
      {
        id: IDS.routes.platformLoop,
        targetLocationId: IDS.locations.platform,
        label: 'Return to the platform',
        description: 'Revisit the ride and inspect the consequences of the earlier choice.',
      },
      {
        id: IDS.routes.endFromConcourse,
        targetLocationId: IDS.locations.ending,
        label: 'Leave the park',
        description: 'Conclude the incident from the public concourse.',
      },
    ]),
    location(IDS.locations.maintenance, [
      {
        id: IDS.routes.maintenanceLoop,
        targetLocationId: IDS.locations.platform,
        label: 'Return through the service tunnel',
        description: 'Loop back to the ride after spending the pass.',
      },
      {
        id: IDS.routes.endFromMaintenance,
        targetLocationId: IDS.locations.ending,
        label: 'Leave through the operator exit',
        description: 'Conclude the incident from the restricted route.',
      },
    ]),
    {
      id: IDS.locations.ending,
      enabledActionIds: [],
      combinationRules: [],
      objectives: [objective],
      routeEdges: [],
    },
  ],
};

const collectPassAction: OperationActionDef = {
  id: IDS.action,
  allowedParticipantKinds: ['student'],
  requiredCapabilityIds: [],
  reasonIds: ['gameplay-b:operation-reason:secure-carousel-and-collect-pass'],
  tagIds: [],
  target: { kind: 'none' },
  effects: [
    { kind: 'eventFact', factId: IDS.fact, op: 'reveal' },
    { kind: 'heldItem', itemId: IDS.item, op: 'grant' },
  ],
};

const content: OperationResolvedContent = {
  ...carouselSafetySliceContent,
  eventDefinition,
  studentProfiles: carouselSafetySliceContent.studentProfiles.map(profile => profile.characterId === Character.Hoshino
    ? {
      ...profile,
      candidateActionIds: [IDS.action, ...profile.candidateActionIds],
      actionPriorityIds: [IDS.action, ...profile.actionPriorityIds],
    }
    : profile),
  actionDefinitions: [...carouselSafetySliceContent.actionDefinitions, collectPassAction],
};

export const carouselRouteSliceContent: OperationResolvedContent = Object.freeze(content);

export const carouselRouteSliceResolver: OperationContentResolver = Object.freeze({
  resolve(eventId: string) {
    return eventId === IDS.event ? carouselRouteSliceContent : null;
  },
});
