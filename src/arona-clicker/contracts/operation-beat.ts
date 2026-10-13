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
export const OPERATION_WAIT_REASON_GROUP_TARGET_SCENE_ONLY = 'operation:plan:group-target-scene-only' as const;
export const OPERATION_WAIT_REASON_INSUFFICIENT_RESOURCE = 'operation:plan:insufficient-resource' as const;

/** Minimal dynamic input; preparation deliberately receives no RNG, PlayerCost, or mutable Run owner. */
export interface OperationPreparationSnapshot {
  readonly eventId: string;
  readonly planVersion: number;
  readonly currentLocationId: string;
  /** Indexed by actorId; Event actor declaration order remains the execution order. */
  readonly actors: readonly OperationPreparationActorSnapshot[];
  readonly teams: readonly OperationTeamState[];
  /** Optional subset for Scene batches; omitted preserves full Event actor preparation (Combat). */
  readonly actorIds?: readonly string[];
  /** Present on standard Runs; when present it is the hard per-student Action choice boundary. */
  readonly studentActionIdsByActorId?: Readonly<Record<string, readonly string[]>>;
}

export interface OperationPreparationActorSnapshot {
  readonly actorId: string;
  readonly participantKind: OperationActorKind;
  /** Live HP is supplied by Runtime; optional only for low-level legacy pure-planner fixtures. */
  readonly hp?: number;
  readonly positionId?: string;
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

/**
 * Limited player intent; costs, effects, and replacement plans always come from trusted content.
 * This is a complete Draft over the base PreparedBeat: omitted actionId keeps its selected Action,
 * while omitted targetActorId leaves deterministic U4 targeting in place.
 */
export interface OperationInterventionDraft {
  readonly actorId: string;
  readonly actionId?: string;
  readonly targetActorId?: string;
  /** Optional authored explanation, selected from the action/Profile reason catalog. */
  readonly reasonId?: string;
}

export interface OperationInterventionPreviewInput {
  readonly snapshot: OperationPreparationSnapshot;
  readonly trustedContent: OperationPreparationContent;
  readonly preparedBeat: PreparedBeat;
  /** Existing slot ownership; replacing it for another student requires clearing it first. */
  readonly currentDraft: OperationInterventionDraft | null;
  /** Complete proposed Draft, not a patch merged with currentDraft. */
  readonly draft: OperationInterventionDraft;
}

export interface OperationInterventionPreview {
  /** Version of the base PreparedBeat from which this detached preview was produced. */
  readonly planVersion: number;
  readonly draft: OperationInterventionDraft;
  readonly preparedBeat: PreparedBeat;
}

export type OperationInterventionPreviewErrorCode =
  | 'operation:intervention:invalid-draft'
  | 'operation:intervention:stale-plan'
  | 'operation:intervention:student-slot-occupied'
  | 'operation:intervention:invalid-actor'
  | 'operation:intervention:invalid-action'
  | 'operation:intervention:action-not-in-hand'
  | 'operation:intervention:action-not-enabled'
  | 'operation:intervention:action-not-affordable'
  | 'operation:intervention:no-legal-target'
  | 'operation:intervention:group-target-scene-only'
  | 'operation:intervention:invalid-target'
  | 'operation:intervention:invalid-reason'
  | 'operation:intervention:plan-conflict';

export type OperationTargetSelection =
  | { readonly kind: 'none'; readonly targetActorId: null }
  | { readonly kind: 'actor'; readonly targetActorId: string }
  | {
      readonly kind: 'unavailable';
      readonly targetActorId: null;
      readonly reasonId: typeof OPERATION_WAIT_REASON_NO_LEGAL_TARGET | typeof OPERATION_WAIT_REASON_GROUP_TARGET_SCENE_ONLY;
    };
