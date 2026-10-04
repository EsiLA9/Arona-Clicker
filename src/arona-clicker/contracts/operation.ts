export type OperationResultKind = 'success' | 'partialSuccess' | 'failure';
export type OperationRunStatus = 'inProgress' | OperationResultKind;
export type OperationCardZone = 'drawPile' | 'hand' | 'discard' | 'played';

export const OPERATION_WAIT_ACTION_ID = 'operation:action:wait' as const;
export const OPERATION_NO_ELIGIBLE_ACTION_REASON_ID = 'operation:profile:no-eligible-action' as const;

export type OperationActorKind = 'student' | 'opponent' | 'environment';

export interface OperationActionRequirementDef {
  readonly actionId: string;
  readonly requiredCapabilityIds: readonly string[];
  readonly reasonIds: readonly string[];
}

export interface OperationBoundedValueDef {
  readonly initial: number;
  readonly min: number;
  readonly max: number;
}

export interface OperationTrackDef extends OperationBoundedValueDef {
  readonly id: string;
}

export interface OperationActorDef {
  readonly id: string;
  readonly type: string;
  readonly hp: OperationBoundedValueDef;
  readonly resources?: Readonly<Record<string, OperationBoundedValueDef>>;
}

export interface OperationCardZones {
  readonly drawPile: readonly string[];
  readonly hand: readonly string[];
  readonly discard: readonly string[];
  readonly played: readonly string[];
}

export interface OperationPlayerRouteStateDef {
  readonly playerCost: number;
  readonly cards: OperationCardZones;
}

/** U1 的最小事件输入契约；行为和 Datapack 合同由后续 Task 扩展。 */
export interface OperationEventDef {
  readonly id: string;
  readonly locationIds: readonly string[];
  readonly initialLocationId: string;
  readonly tracks: readonly OperationTrackDef[];
  readonly factIds: readonly string[];
  readonly knownFactIds: readonly string[];
  readonly itemIds: readonly string[];
  readonly heldItemIds: readonly string[];
  readonly actors: readonly OperationActorDef[];
  /** Event-scoped actions and their capability eligibility gates. */
  readonly actionRequirements?: readonly OperationActionRequirementDef[];
  readonly playerRouteState: OperationPlayerRouteStateDef;
  readonly randomSeed?: number;
}

export interface OperationActionCandidateSnapshot {
  readonly actionId: string;
  readonly eligible: boolean;
  readonly requiredCapabilityIds: readonly string[];
  readonly missingCapabilityIds: readonly string[];
  readonly reasonIds: readonly string[];
}

export interface OperationWaitFallbackSnapshot {
  readonly actionId: typeof OPERATION_WAIT_ACTION_ID;
  readonly reasonIds: readonly [typeof OPERATION_NO_ELIGIBLE_ACTION_REASON_ID];
}

/** Detached student Profile input plus event-scoped action eligibility for one EventRun. */
export interface OperationStudentProfileSnapshot {
  readonly id: string;
  readonly characterId: string;
  readonly candidateActionIds: readonly string[];
  readonly actionPriorityIds: readonly string[];
  readonly capabilityIds: readonly string[];
  readonly reasonIds: readonly string[];
  readonly actionCandidates: readonly OperationActionCandidateSnapshot[];
  readonly eligibleActionIds: readonly string[];
  readonly fallback?: OperationWaitFallbackSnapshot;
  readonly randomSkillRuleId?: string;
}

export type OperationActorInitialization =
  | {
      readonly actorId: string;
      readonly participantKind: 'student';
      readonly characterId: string;
      readonly profile: OperationStudentProfileSnapshot;
    }
  | {
      readonly actorId: string;
      readonly participantKind: 'opponent' | 'environment';
      readonly factionId?: string;
    };

/** Complete admission-to-runtime hand-off; consumed atomically by the EventRun owner. */
export interface OperationRunStartInput {
  readonly eventDefinition: OperationEventDef;
  readonly actors: readonly OperationActorInitialization[];
}

export interface OperationEventState {
  readonly tracks: Readonly<Record<string, number>>;
  readonly knownFactIds: readonly string[];
  readonly heldItemIds: readonly string[];
}

export interface OperationActorState {
  readonly id: string;
  readonly type: string;
  readonly hp: number;
  readonly resources: Readonly<Record<string, number>>;
  /** Present for GameInstance runs; omitted only by low-level structural Runtime fixtures. */
  readonly participantKind?: OperationActorKind;
  readonly characterId?: string;
  readonly profile?: OperationStudentProfileSnapshot;
  readonly factionId?: string;
}

export interface OperationPlayerRouteState {
  readonly playerCost: number;
  readonly cards: OperationCardZones;
}

export interface OperationLocationProgress {
  readonly visitCount: number;
  readonly completed: boolean;
}

/** Read-only detached view; the service retains the only mutable Run. */
export interface EventRun {
  readonly runId: string;
  readonly eventId: string;
  readonly status: OperationRunStatus;
  readonly currentLocationId: string;
  readonly eventState: OperationEventState;
  readonly actorStates: readonly OperationActorState[];
  readonly playerRouteState: OperationPlayerRouteState;
  readonly locationProgress: Readonly<Record<string, OperationLocationProgress>>;
  readonly random: {
    readonly seed: number;
    readonly cursor: number;
  };
}

export interface EventResult {
  readonly eventId: string;
  readonly runId: string;
  readonly kind: OperationResultKind;
  readonly finalRun: EventRun;
}

export type OperationLifecycleEvent =
  | { readonly type: 'runStarted'; readonly runId: string; readonly eventId: string }
  | { readonly type: 'locationEntered'; readonly runId: string; readonly eventId: string; readonly locationId: string }
  | { readonly type: 'locationCompleted'; readonly runId: string; readonly eventId: string; readonly locationId: string }
  | { readonly type: 'runFinished'; readonly runId: string; readonly eventId: string; readonly kind: OperationResultKind };

export interface OperationMembershipChange {
  readonly id: string;
  readonly present: boolean;
}

export interface OperationActorChange {
  readonly actorId: string;
  readonly hp?: number;
  readonly resources?: Readonly<Record<string, number>>;
}

/** A single atomic local-state write. Location lifecycle has dedicated methods/events. */
export interface OperationStateDelta {
  readonly tracks?: Readonly<Record<string, number>>;
  readonly knownFacts?: readonly OperationMembershipChange[];
  readonly heldItems?: readonly OperationMembershipChange[];
  readonly actors?: readonly OperationActorChange[];
  readonly playerRouteState?: {
    readonly playerCost?: number;
    /** A zone replacement must preserve the starting deck's exact card multiset. */
    readonly cards?: OperationCardZones;
  };
}
