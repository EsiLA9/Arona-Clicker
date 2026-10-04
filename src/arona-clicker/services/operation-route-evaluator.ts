import type { EventRun, OperationEventDef } from '../contracts/operation';
import type { OperationRouteEdgeDef } from '../contracts/operation-action';

export interface OperationRouteAvailability {
  readonly route: OperationRouteEdgeDef;
  readonly available: boolean;
  readonly lockedReason: string | null;
}

export type OperationRouteState = Pick<EventRun, 'currentLocationId' | 'eventState' | 'locationProgress'>;

/** Purely evaluates exits for the current Location; it performs no topology walk or caching. */
export function evaluateOperationRoutes(
  event: OperationEventDef,
  run: OperationRouteState,
): { readonly totalLocationVisits: number; readonly options: readonly OperationRouteAvailability[] } {
  const totalLocationVisits = Object.values(run.locationProgress)
    .reduce((total, progress) => total + progress.visitCount, 0);
  const current = run.locationProgress[run.currentLocationId];
  const location = event.locations.find(candidate => candidate.id === run.currentLocationId);
  const options = (location?.routeEdges ?? []).map(route => {
    let lockedReason: string | null = null;
    if (!current?.completed) lockedReason = 'operation:route:location-incomplete';
    else if (totalLocationVisits >= event.maxLocationVisits) lockedReason = 'operation:route:max-visits-reached';
    else if (route.requiredHeldItemId && !run.eventState.heldItemIds.includes(route.requiredHeldItemId)) {
      lockedReason = 'operation:route:required-held-item-missing';
    }
    return { route, available: lockedReason === null, lockedReason };
  });
  return { totalLocationVisits, options };
}
