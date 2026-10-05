import type { EventRun, OperationActorKind } from './operation';
import type { OperationCombinationPreview } from './operation-action';
import type { OperationActionCostDef } from './operation-action';
import type { OperationInterventionDraft, OperationPreparedActorPlan, PreparedBeat } from './operation-beat';
import type { OperationResolution } from './operation-resolution';
import type { OperationRouteTransitionRecord } from './operation';
import type { OperationLocationEntryCostRecord } from './operation';
import type { OperationSceneActionBatchDraft } from './operation-scene-action';
import type { Character } from '../types/ids';

/** UI-safe candidate row: stable IDs and reasons, without exposing the Action definition. */
export interface OperationViewActionOption {
  readonly actionId: string;
  readonly eligible: boolean;
  readonly enabledAtLocation: boolean;
  readonly requiredCapabilityIds: readonly string[];
  readonly missingCapabilityIds: readonly string[];
  readonly reasonIds: readonly string[];
  readonly cost: OperationActionCostDef | null;
  readonly selectable: boolean;
  readonly defaultTargetActorId: string | null;
  /** Explicit targets accepted by the same pure preview used by the write command. */
  readonly legalTargetActorIds: readonly string[];
  readonly blockedReasonIds: readonly string[];
}

/** Resolution subset for presentation; tactical RNG cursors and roll measurements stay private. */
export interface OperationViewStudentSkillCheck {
  readonly actorId: string;
  readonly skillRuleId: string;
  readonly actionId: string;
  readonly succeeded: boolean;
}

export type OperationViewResolution = Omit<OperationResolution, 'randomCursorBefore' | 'randomCursorAfter' | 'studentSkillChecks'> & {
  readonly studentSkillChecks: readonly OperationViewStudentSkillCheck[];
};

export interface OperationViewObjectiveProgress {
  readonly id: string;
  readonly description: string;
  readonly kind: 'primary' | 'secondary';
  readonly achieved: boolean;
}

export interface OperationViewOutcomeCondition {
  readonly id: string;
  readonly description: string;
  readonly met: boolean;
}

export interface OperationViewSceneAction {
  readonly id: string;
  readonly actionId: string;
  readonly scope: 'individual' | 'global';
  readonly playerCost: number;
  readonly eligibleActorIds: readonly string[];
  readonly legalTargetActorIdsByActorId: Readonly<Record<string, readonly string[]>>;
}

export interface OperationViewSceneCard {
  readonly cardInstanceId: string;
  readonly cardDefId: string;
  readonly actionId: string;
  readonly playerCost: number;
  readonly timing: 'scene';
  /** Qualified active Student performers for the card Action in this Run. */
  readonly eligibleActorIds: readonly string[];
  /** Relation-correct Actor targets for each eligible performer; empty when the Action is targetless. */
  readonly legalTargetActorIdsByActorId: Readonly<Record<string, readonly string[]>>;
}

export interface OperationViewPlayerCards {
  readonly drawPileCount: number;
  readonly hand: readonly OperationViewSceneCard[];
  readonly discardCount: number;
  readonly maxHandSize: number;
}

export interface OperationViewRouteOption {
  readonly routeId: string;
  readonly targetLocationId: string;
  readonly label: string;
  readonly description: string;
  readonly available: boolean;
  readonly lockedReason: string | null;
  readonly requiredHeldItemId: string | null;
  readonly consumesHeldItem: boolean;
}

export interface OperationViewActor {
  readonly id: string;
  readonly type: string;
  readonly displayName: string;
  readonly avatarRef: string | null;
  readonly participantKind?: OperationActorKind;
  readonly characterId?: string;
  readonly factionId?: string;
  readonly teamId?: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly resources: Readonly<Record<string, number>>;
  readonly profile?: {
    readonly id: string;
    readonly capabilityIds: readonly string[];
    readonly reasonIds: readonly string[];
    readonly randomSkillRuleId?: string;
    readonly actionOptions: readonly OperationViewActionOption[];
  };
  readonly currentPlan: OperationPreparedActorPlan | null;
}

/** Detached entry summary for a fixed-roster Operation launch card. */
export interface OperationAdmissionSummary {
  readonly eventId: string;
  readonly participants: readonly { readonly characterId: string; readonly displayName: string }[];
  readonly available: boolean;
  readonly missingCharacterIds: readonly string[];
  readonly unavailableReason: string | null;
}

/** Detached operation-specific UI projection; deliberately not a GameView and not an EventRun. */
export interface OperationView {
  readonly runId: string;
  readonly eventId: string;
  readonly status: EventRun['status'];
  readonly rewardClaimed: boolean;
  readonly currentLocationId: string;
  readonly planVersion: number;
  readonly beatIndex: number;
  readonly tracks: Readonly<Record<string, number>>;
  readonly knownFactIds: readonly string[];
  readonly heldItemIds: readonly string[];
  readonly objectives: readonly OperationViewObjectiveProgress[];
  readonly currentLocationObjectives: readonly OperationViewObjectiveProgress[];
  readonly partialOutcomes: readonly OperationViewOutcomeCondition[];
  readonly hardFailureConditions: readonly OperationViewOutcomeCondition[];
  readonly actorStates: readonly OperationViewActor[];
  readonly teamStates: EventRun['teamStates'];
  readonly locationProgress: EventRun['locationProgress'];
  readonly routeHistory: readonly OperationRouteTransitionRecord[];
  readonly locationEntryCostHistory: readonly OperationLocationEntryCostRecord[];
  readonly currentRoutes: readonly OperationViewRouteOption[];
  readonly totalLocationVisits: number;
  readonly maxLocationVisits: number;
  readonly playerCost: number;
  readonly playerCards: OperationViewPlayerCards;
  readonly maxCarryCost: number | null;
  readonly currentActionMode: 'individual' | 'global' | null;
  readonly currentSceneActions: readonly OperationViewSceneAction[];
  readonly pendingSceneActionBatch: OperationSceneActionBatchDraft | null;
  readonly sceneActionBatchesUsed: number;
  readonly sceneActionBatchesRemaining: number;
  readonly basePreparedBeat: PreparedBeat | null;
  /** Includes the current intervention draft when one is active. */
  readonly effectivePreparedBeat: PreparedBeat | null;
  readonly interventionDraft: OperationInterventionDraft | null;
  readonly combinationPreview: OperationCombinationPreview | null;
  readonly canCommit: boolean;
  readonly commitBlockedReasonIds: readonly string[];
  readonly resolutions: readonly OperationViewResolution[];
  readonly resolutionSequence: number;
}

/** Narrow UI query port; exposes detached projections without Runtime mutation commands. */
export interface OperationViewQuery {
  getView(expectedRunId?: string): OperationView | null;
  getAdmissionSummary(eventId: string, characterIds: readonly Character[]): OperationAdmissionSummary;
}
