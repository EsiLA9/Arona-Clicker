import type { EventRun, OperationActorKind, OperationCharacterHandSnapshot } from './operation';
import type { OperationCombinationPreview } from './operation-action';
import type { OperationActionCostDef, OperationActionTargetSelectionMode } from './operation-action';
import type { OperationInterventionDraft, OperationPreparedActorPlan, PreparedBeat } from './operation-beat';
import type { OperationResolution } from './operation-resolution';
import type { OperationPredicateDef, OperationRouteTransitionRecord } from './operation';
import type { OperationLocationEntryCostRecord } from './operation';
import type { OperationSceneActionBatchDraft } from './operation-scene-action';
import type { Character } from '../../types/ids';

/** UI-safe candidate row: stable IDs and reasons, without exposing the Action definition. */
export interface OperationViewActionOption {
  readonly actionId: string;
  readonly title: string;
  readonly description: string | null;
  readonly eligible: boolean;
  readonly enabledAtLocation: boolean;
  readonly requiredCapabilityIds: readonly string[];
  readonly missingCapabilityIds: readonly string[];
  readonly reasonIds: readonly string[];
  readonly cost: OperationActionCostDef | null;
  readonly selectable: boolean;
  readonly defaultTargetActorId: string | null;
  readonly targetSelectionMode: OperationActionTargetSelectionMode;
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
  readonly title: string;
  readonly description: string | null;
  readonly scope: 'individual' | 'global';
  readonly playerCost: number;
  readonly targetSelectionMode: OperationActionTargetSelectionMode;
  readonly selectionPolicy: 'required' | 'fixed';
  readonly performerPolicy: 'selected-student' | 'none' | 'optional-student';
  readonly eligibleActorIds: readonly string[];
  readonly legalTargetActorIdsByActorId: Readonly<Record<string, readonly string[]>>;
  /** Absolute ID/type-filtered targets available when none/optional-student is activated in place. */
  readonly legalActorlessTargetActorIds: readonly string[];
}

export interface OperationViewSceneActionChoice {
  readonly candidateSceneActionIds: readonly string[];
  readonly chooseExactly: number;
}

export interface OperationViewScenePurchaseOffer {
  readonly id: string;
  readonly actionId: string;
  readonly title: string;
  readonly description: string | null;
  readonly playerCost: number;
  readonly purchased: boolean;
  readonly affordable: boolean;
  readonly unavailableReason: string | null;
  /** Human-readable Action summary; the projection never exposes Event-local effect IDs. */
  readonly rewardPreview: readonly string[];
}

export interface OperationViewSceneCard {
  readonly cardInstanceId: string;
  readonly cardDefId: string;
  readonly actionId: string;
  readonly title: string;
  readonly description: string | null;
  readonly playerCost: number;
  readonly timing: 'scene';
  readonly targetSelectionMode: OperationActionTargetSelectionMode;
  readonly selectionPolicy: 'required' | 'fixed';
  readonly performerPolicy: 'selected-student' | 'none' | 'optional-student';
  /** Qualified active Student performers for the card Action in this Run. */
  readonly eligibleActorIds: readonly string[];
  /** Relation-correct Actor targets for each eligible performer; empty when the Action is targetless. */
  readonly legalTargetActorIdsByActorId: Readonly<Record<string, readonly string[]>>;
  /** Absolute ID/type-filtered targets available when none/optional-student is activated in place. */
  readonly legalActorlessTargetActorIds: readonly string[];
}

export type OperationViewSceneStatus = 'ready' | 'active' | 'completed';

/** Detached Scene copy; status and position are projected from ordered content plus EventRun progress. */
export interface OperationViewScene {
  readonly sceneId: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly status: OperationViewSceneStatus;
  readonly index: number;
  readonly count: number;
  readonly autoCharacterActions?: boolean;
  readonly completion?: OperationPredicateDef | null;
}

/** Read-only candidate Offer. Each source retains its own identity and transaction-specific payload. */
export type OperationViewActionOffer =
  | {
      readonly offerId: string;
      readonly source: 'student-action';
      readonly sceneId: string;
      readonly actorId: string;
      readonly actionId: string;
      readonly option: OperationViewActionOption;
    }
  | {
      readonly offerId: string;
      readonly source: 'scene-action';
      readonly sceneId: string;
      readonly sceneActionId: string;
      readonly actionId: string;
      readonly action: OperationViewSceneAction;
    }
  | {
      readonly offerId: string;
      readonly source: 'player-scene-card';
      readonly sceneId: string;
      readonly cardInstanceId: string;
      readonly actionId: string;
      readonly card: OperationViewSceneCard;
    }
  | {
      readonly offerId: string;
      readonly source: 'purchase';
      readonly sceneId: string;
      readonly purchaseOfferId: string;
      readonly actionId: string;
      readonly purchase: OperationViewScenePurchaseOffer;
    };

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
  readonly anyOfHeldItemIds: readonly string[];
  readonly consumesHeldItem: boolean;
}

export interface OperationViewMapNode {
  readonly locationId: string;
  readonly visitCount: number;
  readonly maxVisits: number | null;
  readonly current: boolean;
  readonly visited: boolean;
  readonly completed: boolean;
}

export interface OperationViewMapEdge {
  readonly routeId: string;
  readonly sourceLocationId: string;
  readonly targetLocationId: string;
  readonly label: string;
  readonly description: string;
  /** Availability is evaluated only for exits from the current Location. */
  readonly available: boolean | null;
  readonly lockedReason: string | null;
  readonly requiredHeldItemId: string | null;
  readonly anyOfHeldItemIds: readonly string[];
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
  readonly positionId?: string;
  readonly maxHp: number;
  readonly resources: Readonly<Record<string, number>>;
  readonly characterHand?: OperationCharacterHandSnapshot;
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

/** Detached read-only summary for an Event that can be launched from the current Init. */
export interface OperationEventLaunchEntry {
  readonly eventId: string;
  readonly title: string | null;
  readonly description: string | null;
  /** Ordered student roster candidate used by the Controller's start command. */
  readonly characterIds: readonly Character[];
  readonly admission: OperationAdmissionSummary;
}

/** Detached operation-specific UI projection; deliberately not a GameView and not an EventRun. */
export interface OperationView {
  readonly runId: string;
  readonly eventId: string;
  readonly eventTitle: string | null;
  readonly eventDescription: string | null;
  readonly status: EventRun['status'];
  readonly rewardClaimed: boolean;
  readonly currentLocationId: string;
  readonly currentStage: 'combat' | 'scene';
  readonly currentSceneId: string | null;
  readonly currentScene: OperationViewScene | null;
  readonly scenes: readonly OperationViewScene[];
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
  readonly actionPresentations: Readonly<Record<string, { readonly title: string; readonly description: string | null }>>;
  readonly sceneActionPresentations: Readonly<Record<string, { readonly title: string; readonly description: string | null }>>;
  readonly purchaseOfferPresentations: Readonly<Record<string, { readonly title: string; readonly description: string | null }>>;
  readonly actionOffers: readonly OperationViewActionOffer[];
  readonly playerSceneCardPresentations: Readonly<Record<string, { readonly title: string; readonly description: string | null }>>;
  readonly teamStates: EventRun['teamStates'];
  readonly locationProgress: EventRun['locationProgress'];
  readonly routeHistory: readonly OperationRouteTransitionRecord[];
  readonly locationEntryCostHistory: readonly OperationLocationEntryCostRecord[];
  readonly currentRoutes: readonly OperationViewRouteOption[];
  readonly map: { readonly nodes: readonly OperationViewMapNode[]; readonly edges: readonly OperationViewMapEdge[] };
  readonly totalLocationVisits: number;
  readonly maxLocationVisits: number;
  readonly playerCost: number;
  readonly playerCards: OperationViewPlayerCards;
  readonly maxCarryCost: number | null;
  readonly currentActionMode: 'individual' | 'global' | null;
  readonly currentSceneActions: readonly OperationViewSceneAction[];
  readonly currentSceneActionChoice: OperationViewSceneActionChoice | null;
  readonly currentScenePurchaseOffers: readonly OperationViewScenePurchaseOffer[];
  readonly pendingSceneActionBatch: OperationSceneActionBatchDraft | null;
  readonly sceneActionBatchesUsed: number;
  /** null means the active Scene has no authored batch ceiling. */
  readonly sceneActionBatchesRemaining: number | null;
  readonly basePreparedBeat: PreparedBeat | null;
  /** Includes the current intervention draft when one is active. */
  readonly effectivePreparedBeat: PreparedBeat | null;
  readonly interventionDraft: OperationInterventionDraft | null;
  readonly combinationPreview: OperationCombinationPreview | null;
  readonly canCommit: boolean;
  readonly commitBlockedReasonIds: readonly string[];
  readonly resolutions: readonly OperationViewResolution[];
  /** Current Run-wide interleaving cursor for timeline records. */
  readonly timelineSequence: number;
  readonly resolutionSequence: number;
}

/** Narrow UI query port; exposes detached projections without Runtime mutation commands. */
export interface OperationViewQuery {
  getView(expectedRunId?: string): OperationView | null;
  getAdmissionSummary(eventId: string, characterIds: readonly Character[]): OperationAdmissionSummary;
  getLaunchEntries(): readonly OperationEventLaunchEntry[];
}
