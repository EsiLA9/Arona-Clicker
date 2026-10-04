import type { OperationActionCostDef, OperationActionDef } from './operation-action';
import type {
  OperationActorInitialization,
  OperationActorKind,
  OperationEventDef,
  OperationTeamState,
} from './operation';

export const OPERATION_WAIT_REASON_NO_CANDIDATE_ACTION = 'operation:plan:no-candidate-action' as const;
export const OPERATION_WAIT_REASON_NO_ENABLED_ACTION = 'operation:plan:no-enabled-action' as const;
export const OPERATION_WAIT_REASON_NO_LEGAL_TARGET = 'operation:plan:no-legal-target' as const;
export const OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE = 'operation:plan:insufficient-resource' as const;

/** Minimal dynamic input; preparation deliberately receives no RNG, PlayerCost, or mutable Run owner. */
export interface OperationPreparationSnapshot {
  readonly eventId: string;
  readonly planVersion: number;
  readonly currentLocationId: string;
  /** Indexed by actorId; Event actor declaration order remains the execution order. */
  readonly actors: readonly OperationPreparationActorSnapshot[];
  readonly teams: readonly OperationTeamState[];
}

export interface OperationPreparationActorSnapshot {
  readonly actorId: string;
  readonly participantKind: OperationActorKind;
  readonly resources: Readonly<Record<string, number>>;
}

/** Run-start data retained as immutable owner rules by U8 and projected here for pure preparation. */
export interface OperationPreparationContent {
  readonly eventDefinition: OperationEventDef;
  readonly actors: readonly OperationActorInitialization[];
  readonly actionDefinitions: readonly OperationActionDef[];
}

export interface OperationPreparedActorPlan {
  readonly actorId: string;
  readonly participantKind: OperationActorKind;
  readonly kind: 'studentAction' | 'intent' | 'wait';
  readonly source: 'student-profile' | 'participant';
  readonly actionId: string;
  readonly targetActorId: string | null;
  readonly cost: OperationActionCostDef | null;
  readonly reasonIds: readonly string[];
}

/** The immutable plan for one deterministic Beat and its owner-supplied version. */
export interface PreparedBeat {
  readonly planVersion: number;
  readonly locationId: string;
  readonly actorPlans: readonly OperationPreparedActorPlan[];
}

export type OperationTargetSelection =
  | { readonly kind: 'none'; readonly targetActorId: null }
  | { readonly kind: 'actor'; readonly targetActorId: string }
  | {
      readonly kind: 'unavailable';
      readonly targetActorId: null;
      readonly reasonId: typeof OPERATION_WAIT_REASON_NO_LEGAL_TARGET;
    };
