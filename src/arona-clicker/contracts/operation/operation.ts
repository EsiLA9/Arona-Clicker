import type { OperationActionDef } from '../operation/operation-action';
import type { OperationStudentSkillRuleDef } from '../operation/operation-skill';
import type { OperationInterventionDraft, PreparedBeat } from '../operation/operation-beat';
import type { OperationResolution } from '../operation/operation-resolution';
import type { OperationSceneActionBatchDraft } from '../operation/operation-scene-action';
import type {
  OperationEventContentDef,
  OperationEventRewardsDef,
  OperationActorKind,
  OperationLocationDef,
  OperationLocationResultKind,
  OperationPlayerRouteStateDef,
  OperationResultKind,
  OperationRewardDef,
} from '../../../data-services/contracts/operation';
import type { OperationCardPoolDef, OperationStrategyProfileDef } from '../../../data-services/contracts/operation';

export type {
  OperationActorDef,
  OperationActorKind,
  OperationBoundedValueDef,
  OperationEventContentDef,
  OperationEventRewardsDef,
  OperationObjectiveDef,
  OperationOutcomeConditionDef,
  OperationPlayerRouteStateDef,
  OperationPlayerSceneCardDef,
  OperationPlayerSceneDeckDef,
  OperationPredicateDef,
  OperationPredicateLeafDef,
  OperationPredicateOperator,
  OperationSceneDef,
  OperationSceneActionChoiceDef,
  OperationScenePurchaseOfferDef,
  OperationRewardDef,
  OperationResultKind,
  OperationLocationResultKind,
  OperationTeamDef,
  OperationTrackDef,
} from '../../../data-services/contracts/operation';

export type OperationRunStatus = 'inProgress' | OperationResultKind;
export type OperationCardZone = 'drawPile' | 'hand' | 'discard';

export const OPERATION_WAIT_ACTION_ID = 'operation:action:wait' as const;
export const OPERATION_NO_ELIGIBLE_ACTION_REASON_ID = 'operation:profile:no-eligible-action' as const;

export interface OperationTeamState {
  readonly id: string;
  readonly resources: Readonly<Record<string, number>>;
}

export interface OperationCardZones {
  readonly drawPile: readonly string[];
  readonly hand: readonly string[];
  readonly discard: readonly string[];
}

export interface OperationPlayerSceneCardInstanceDef {
  readonly cardInstanceId: string;
  readonly cardDefId: string;
  readonly actionId: string;
  readonly playerCost: number;
  readonly timing: 'scene';
  readonly selectionPolicy?: 'required' | 'fixed';
  readonly performerPolicy?: 'selected-student' | 'none' | 'optional-student';
  readonly title?: string;
  readonly description?: string;
}

export interface OperationPlayerRouteState extends OperationPlayerRouteStateDef {
  readonly cards: OperationCardZones;
}

/** Runtime Event DTO: Registry Event locations have been resolved from their stable IDs. */
export type OperationEventDef = Omit<
  OperationEventContentDef,
  'initId' | 'resumeVersion' | 'locationIds' | 'participants' | 'studentSkillRules'
> & {
  readonly locations: readonly OperationLocationDef[];
  /** Present for Registry-authored events that are scoped to one AC Init. */
  readonly initId?: string;
  /** Present for Registry-authored definitions; omitted by low-level in-memory fixtures. */
  readonly resumeVersion?: number;
};

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
  readonly strategyProfileId?: string;
  readonly strategyBiases?: readonly { readonly tagId: string; readonly biasBps: number }[];
  readonly cardPoolIds?: readonly string[];
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
      readonly displayName?: string;
      readonly avatarRef?: string | null;
      readonly profile: OperationStudentProfileSnapshot;
    }
  | {
      readonly actorId: string;
      readonly participantKind: 'opponent' | 'environment';
      readonly displayName?: string;
      readonly avatarRef?: string | null;
      readonly factionId?: string;
      /** Detached, ordered candidate source for later pure Intent preparation. */
      readonly candidateActionIds: readonly string[];
    };

/** Complete admission-to-runtime hand-off; consumed atomically by the EventRun owner. */
export interface OperationRunStartInput {
  readonly eventDefinition: OperationEventDef;
  readonly actors: readonly OperationActorInitialization[];
  /** Resolver-authored catalog passed through admission; the private owner retains it frozen per Run in U8. */
  readonly actionDefinitions: readonly OperationActionDef[];
  /** Resolver-authored rules, referenced only by admitted student Profiles. */
  readonly studentSkillRules: readonly OperationStudentSkillRuleDef[];
  /** Reference-closed author definitions; absent only in low-level legacy fixtures. */
  readonly operationCardPools?: readonly OperationCardPoolDef[];
  readonly operationStrategyProfiles?: readonly OperationStrategyProfileDef[];
}

export interface OperationCardCandidateDiagnostic {
  readonly actionId: string;
  readonly sourcePoolIds: readonly string[];
  readonly legacyFallback: boolean;
  readonly eligible: boolean;
  readonly reasonIds: readonly string[];
  readonly baseWeight: number;
  readonly strategyFactorBps: number | null;
  readonly finalWeight: number;
}

export interface OperationCharacterHandSnapshot {
  readonly actorId: string;
  readonly actionIds: readonly string[];
  readonly matchedPoolIds: readonly string[];
  readonly candidates: readonly OperationCardCandidateDiagnostic[];
}

export const OPERATION_TACTICAL_RNG_ALGORITHM = 'splitmix64-counter-v1' as const;

/** Pure tactical stream state; U8 owns committing the returned cursor to EventRun. */
export interface OperationTacticalRandomState {
  readonly algorithm: typeof OPERATION_TACTICAL_RNG_ALGORITHM;
  readonly seed: number;
  readonly tacticalCursor: number;
}

export interface OperationStudentSkillCheckResult {
  readonly actorId: string;
  readonly skillRuleId: string;
  readonly actionId: string;
  readonly chanceBps: number;
  readonly rollBps: number;
  readonly succeeded: boolean;
  readonly rawWordsConsumed: number;
}

/** Temporary pure roll result. It is not a Run mutation or a persisted Resolution. */
export interface OperationStudentSkillRollBatch {
  readonly checks: readonly OperationStudentSkillCheckResult[];
  readonly nextRandomState: OperationTacticalRandomState;
}

/** Expected owner revision for one narrow Beat command. */
export interface OperationRunVersionCommand {
  readonly runId: string;
  readonly planVersion: number;
}

/** The only public command that may move an EventRun between Locations. */
export interface OperationRouteCommand extends OperationRunVersionCommand {
  readonly routeId: string;
}

export interface OperationInterventionCommand extends OperationRunVersionCommand {
  readonly draft: OperationInterventionDraft;
}

export interface OperationEventState {
  readonly tracks: Readonly<Record<string, number>>;
  readonly knownFactIds: readonly string[];
  readonly heldItemIds: readonly string[];
}

export interface OperationActorState {
  readonly id: string;
  readonly type: string;
  readonly displayName?: string;
  readonly avatarRef?: string | null;
  readonly hp: number;
  readonly positionId?: string;
  readonly maxHp?: number;
  readonly resources: Readonly<Record<string, number>>;
  /** Present for GameInstance runs; omitted only by low-level structural Runtime fixtures. */
  readonly participantKind?: OperationActorKind;
  readonly characterId?: string;
  readonly profile?: OperationStudentProfileSnapshot;
  readonly factionId?: string;
  readonly teamId?: string;
}

export interface OperationPlayerRouteState {
  readonly playerCost: number;
  readonly cards: OperationCardZones;
}

export interface OperationLocationProgress {
  readonly visitCount: number;
  readonly completed: boolean;
  readonly beatCount: number;
  readonly sceneActionBatchesUsed?: number;
  /** Explicit Scene IDs completed once in this Run; kept across Location re-entry. */
  readonly completedSceneIds?: readonly string[];
  /** Explicit SceneAction batch counts, indexed by Location-local Scene ID. */
  readonly sceneActionBatchesUsedByScene?: Readonly<Record<string, number>>;
  readonly result: OperationLocationResultKind | null;
}

export interface OperationLocationEntryCostRecord {
  /** Run-wide order shared with Route records and Resolution commits. */
  readonly timelineSequence: number;
  readonly visitSequence: number;
  readonly locationId: string;
  readonly visitCount: number;
  readonly costGain: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
}

export interface OperationRouteTransitionRecord {
  /** Run-wide order shared with Location entry records and Resolution commits. */
  readonly timelineSequence: number;
  readonly fromLocationId: string;
  readonly fromLocationResult: OperationLocationResultKind;
  readonly routeId: string;
  readonly toLocationId: string;
  readonly consumedHeldItemId?: string;
  readonly playerCostBeforeExit?: number;
  readonly playerCostAfterCarryLimit?: number;
}

/** Read-only detached view; the service retains the only mutable Run. */
export interface EventRun {
  readonly runId: string;
  readonly eventId: string;
  readonly status: OperationRunStatus;
  /** True once the terminal AC reward has been committed through StateMutationService. */
  readonly rewardClaimed: boolean;
  readonly currentLocationId: string;
  readonly eventState: OperationEventState;
  readonly actorStates: readonly OperationActorState[];
  /** Student Action Hands; separate from the physical playerSceneDeck zones. */
  readonly characterHands?: Readonly<Record<string, OperationCharacterHandSnapshot>>;
  readonly teamStates: readonly OperationTeamState[];
  readonly playerRouteState: OperationPlayerRouteState;
  readonly locationProgress: Readonly<Record<string, OperationLocationProgress>>;
  readonly routeHistory: readonly OperationRouteTransitionRecord[];
  readonly locationEntryCostHistory?: readonly OperationLocationEntryCostRecord[];
  /** Optional explicitly staged SceneAction/Card batch; pure previews are never retained. */
  readonly pendingSceneActionBatch?: OperationSceneActionBatchDraft | null;
  readonly planVersion: number;
  readonly beatIndex: number;
  readonly preparedBeat: PreparedBeat | null;
  readonly interventionDraft: OperationInterventionDraft | null;
  readonly resolutions: readonly OperationResolution[];
  /** Monotone Run-wide sequence for interleaving retained operation records. */
  readonly timelineSequence: number;
  /** Monotone across history trimming; equal to the newest Resolution sequence or zero. */
  readonly resolutionSequence: number;
  readonly random: OperationTacticalRandomState;
}

export interface EventResult {
  readonly eventId: string;
  readonly runId: string;
  readonly kind: OperationResultKind;
  readonly finalRun: EventRun;
}

export interface OperationRewardClaimResult {
  readonly status: 'claimed' | 'alreadyClaimed' | 'notTerminal';
  readonly reward: OperationRewardDef | null;
}

export type OperationLifecycleEvent =
  | { readonly type: 'runStarted'; readonly runId: string; readonly eventId: string }
  | { readonly type: 'locationEntered'; readonly runId: string; readonly eventId: string; readonly locationId: string }
  | { readonly type: 'locationCompleted'; readonly runId: string; readonly eventId: string; readonly locationId: string }
  | {
      readonly type: 'beatResolved';
      readonly runId: string;
      readonly eventId: string;
      readonly locationId: string;
      readonly basePlanVersion: number;
      readonly resolutionSequence: number;
    }
  | {
      readonly type: 'sceneActionBatchResolved';
      readonly runId: string;
      readonly eventId: string;
      readonly locationId: string;
      readonly basePlanVersion: number;
      readonly resolutionSequence: number;
    }
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
