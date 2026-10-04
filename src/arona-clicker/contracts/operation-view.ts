import type { EventRun, OperationActorKind } from './operation';
import type { OperationCombinationPreview } from './operation-action';
import type { OperationActionCostDef } from './operation-action';
import type { OperationInterventionDraft, OperationPreparedActorPlan, PreparedBeat } from './operation-beat';
import type { OperationResolution } from './operation-resolution';

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

export interface OperationViewActor {
  readonly id: string;
  readonly type: string;
  readonly participantKind?: OperationActorKind;
  readonly characterId?: string;
  readonly factionId?: string;
  readonly teamId?: string;
  readonly hp: number;
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

/** Detached operation-specific UI projection; deliberately not a GameView and not an EventRun. */
export interface OperationView {
  readonly runId: string;
  readonly eventId: string;
  readonly status: EventRun['status'];
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
}
