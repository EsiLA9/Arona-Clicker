import type { OperationEventDef } from './operation';
import type { OperationParticipantSpec } from './operation-participant';
import type { StudentOperationProfileDef } from './student-operation-profile';
import type { OperationActionDef } from './operation-action';
import type { OperationStudentSkillRuleDef } from './operation-skill';
import type { OperationCardPoolDef, OperationStrategyProfileDef } from '../../data-services/contracts/operation';

/** Trusted, event-scoped content returned only by the resolver configured at GameInstance construction. */
export interface OperationResolvedContent {
  readonly eventDefinition: OperationEventDef;
  /** Must describe every OperationActorDef exactly once, in desired student slot order. */
  readonly participants: readonly OperationParticipantSpec[];
  readonly studentProfiles: readonly StudentOperationProfileDef[];
  readonly actionDefinitions: readonly OperationActionDef[];
  readonly studentSkillRules: readonly OperationStudentSkillRuleDef[];
  /** Event-scoped, reference-closed author definitions; omitted only by legacy in-memory fixtures. */
  readonly operationCardPools?: readonly OperationCardPoolDef[];
  readonly operationStrategyProfiles?: readonly OperationStrategyProfileDef[];
}

export interface OperationContentResolver {
  resolve(eventId: string): OperationResolvedContent | null;
}

/** Safe default until product content supplies actual Operation definitions. */
export const emptyOperationContentResolver: OperationContentResolver = Object.freeze({
  resolve: (_eventId: string) => null,
});
