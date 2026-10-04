import type { OperationEventDef } from './operation';
import type { OperationParticipantSpec } from './operation-participant';
import type { StudentOperationProfileDef } from './student-operation-profile';

/** Trusted, event-scoped content returned only by the resolver configured at GameInstance construction. */
export interface OperationResolvedContent {
  readonly eventDefinition: OperationEventDef;
  /** Must describe every OperationActorDef exactly once, in desired student slot order. */
  readonly participants: readonly OperationParticipantSpec[];
  readonly studentProfiles: readonly StudentOperationProfileDef[];
}

export interface OperationContentResolver {
  resolve(eventId: string): OperationResolvedContent | null;
}

/** Safe default until product content supplies actual Operation definitions. */
export const emptyOperationContentResolver: OperationContentResolver = Object.freeze({
  resolve: (_eventId: string) => null,
});
