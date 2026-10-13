import type { OperationActionCostDef, OperationActionDef } from './operation-action';
import type {
  OperationActorKind,
  OperationActorInitialization,
  OperationEventDef,
  OperationStudentSkillCheckResult,
  OperationTacticalRandomState,
} from './operation';
import type { OperationPreparedActorPlan } from './operation-beat';
import type { OperationCombinationPreview } from './operation-action';
import type { OperationStudentSkillRuleDef } from './operation-skill';
import type { OperationSceneActionSelection } from './operation-scene-action';
import type { OperationSceneCardSelection, OperationScenePurchaseSelection } from './operation-scene-action';
import type { OperationCardZones } from './operation';
import type { OperationPlayerSceneCardInstanceDef } from './operation';

export interface OperationResolutionPayment {
  readonly actorId: string;
  readonly actionId: string;
  readonly cost: OperationActionCostDef;
  readonly scopeId: string;
}

export type OperationResolutionValueTarget =
  | { readonly kind: 'actorHp'; readonly actorId: string }
  | { readonly kind: 'actorResource'; readonly actorId: string; readonly resourceId: string }
  | { readonly kind: 'teamResource'; readonly teamId: string; readonly resourceId: string }
  | { readonly kind: 'track'; readonly trackId: string };

export type OperationResolutionEffectSource =
  | { readonly kind: 'payment'; readonly actorId: string; readonly actionId: string; readonly scopeId: string; readonly resourceId: string }
  | { readonly kind: 'action'; readonly actorId: string; readonly actionId: string; readonly effectIndex: number }
  | {
      readonly kind: 'combination';
      readonly ruleId: string;
      readonly actorAId: string;
      readonly actorBId: string;
      readonly effectIndex: number;
    }
  | {
      readonly kind: 'studentSkill';
      readonly actorId: string;
      readonly skillRuleId: string;
      readonly actionId: string;
      readonly effectIndex: number;
    }
  | {
      readonly kind: 'sceneAction';
      readonly actorId?: string;
      readonly sceneActionId: string;
      readonly actionId: string;
      readonly targetActorId: string | null;
      readonly effectIndex: number;
    }
  | {
      readonly kind: 'sceneCard';
      readonly cardInstanceId: string;
      readonly actorId?: string;
      readonly actionId: string;
      readonly targetActorId: string | null;
      readonly effectIndex: number;
    }
  | {
      readonly kind: 'scenePurchase';
      readonly purchaseOfferId: string;
      readonly actionId: string;
      readonly effectIndex: number;
    };

export interface OperationResolutionDeltaContribution {
  /** Signed contribution; Action/Combination/Skill effects use their authored amount. */
  readonly amount: number;
  readonly source: OperationResolutionEffectSource;
}

export interface OperationResolutionNumericChange {
  readonly target: OperationResolutionValueTarget;
  readonly before: number;
  /** Sum of all requested contributions before bounds are applied. */
  readonly requestedDelta: number;
  /** Actual post-clamp difference from before. */
  readonly delta: number;
  readonly after: number;
  readonly contributions: readonly OperationResolutionDeltaContribution[];
}

export interface OperationResolutionMembershipChange {
  readonly target: { readonly kind: 'knownFact' | 'heldItem'; readonly id: string };
  readonly before: boolean;
  readonly after: boolean;
}

export interface OperationResolutionPositionChange {
  readonly actorId: string;
  readonly before: string | null;
  readonly after: string;
  readonly sources: readonly OperationResolutionEffectSource[];
}

export interface OperationResolutionIntervention {
  readonly actorId: string;
  readonly before: OperationPreparedActorPlan;
  readonly after: OperationPreparedActorPlan;
  readonly reasonId?: string;
}

export interface OperationResolutionSceneBatch {
  readonly selections: readonly OperationSceneActionSelection[];
  readonly cards: readonly (OperationSceneCardSelection & { readonly actionId: string; readonly playerCost: number })[];
  readonly purchases?: readonly (OperationScenePurchaseSelection & {
    readonly actionId: string;
    readonly playerCost: number;
    readonly purchaseFactId: string;
  })[];
  readonly skip?: boolean;
  /** Present only when the active Scene explicitly enables Character planning. */
  readonly autoCharacterActions?: true;
  readonly actionCosts: readonly OperationResolutionPayment[];
  readonly playerCostBefore: number;
  readonly playerCostPaid: number;
  readonly playerCostAfter: number;
  readonly sceneActionBatchesUsed: number;
}

/** Pure successful Commit candidate; only U8 may publish state or retain its next RNG cursor. */
export interface OperationResolutionBatch {
  readonly runId: string;
  readonly eventId: string;
  readonly basePlanVersion: number;
  readonly locationId: string;
  /** Location-local Scene identity resolved by the EventRun owner for this commit. */
  readonly sceneId?: string;
  readonly actorPlans: readonly OperationPreparedActorPlan[];
  readonly intervention: OperationResolutionIntervention | null;
  readonly payments: readonly OperationResolutionPayment[];
  readonly combinations: OperationCombinationPreview;
  readonly studentSkillChecks: readonly OperationStudentSkillCheckResult[];
  readonly randomCursorBefore: number;
  readonly randomCursorAfter: number;
  readonly numericChanges: readonly OperationResolutionNumericChange[];
  readonly membershipChanges: readonly OperationResolutionMembershipChange[];
  readonly positionChanges: readonly OperationResolutionPositionChange[];
  /** Present only for a non-combat SceneAction/Card batch; it shares this Resolution container. */
  readonly sceneBatch?: OperationResolutionSceneBatch;
  readonly nextRandomState: OperationTacticalRandomState;
}

/** Compact per-Run record; the next seed/cursor is owned by EventRun, not copied into history. */
export type OperationResolution = Omit<OperationResolutionBatch, 'nextRandomState'> & {
  /** Run-wide order shared with Route transitions and Location entry records. */
  readonly timelineSequence: number;
  readonly resolutionSequence: number;
};

/** Exact value edits U8 applies with one atomic EventRun replacement. */
export type OperationResolutionCommitDelta = OperationResolutionNumericChange;

/** Detached, commit-start values needed to plan one tactical Beat. */
export interface OperationResolutionPlannerSnapshot {
  readonly runId: string;
  readonly eventId: string;
  readonly planVersion: number;
  readonly currentLocationId: string;
  /** Active Location-local Scene resolved by EventRun; omitted only by low-level legacy planner fixtures. */
  readonly currentSceneId?: string;
  /** Enables the shared Character planner for this Scene Batch only. Omitted/false preserves legacy batches. */
  readonly autoCharacterActions?: boolean;
  readonly actors: readonly OperationResolutionActorSnapshot[];
  readonly teams: readonly OperationResolutionTeamSnapshot[];
  readonly tracks: Readonly<Record<string, number>>;
  readonly knownFactIds: readonly string[];
  readonly heldItemIds: readonly string[];
  readonly randomState: OperationTacticalRandomState;
  readonly playerCost?: number;
  readonly sceneActionBatchesUsed?: number;
  readonly playerCardZones?: OperationCardZones;
}

export interface OperationResolutionActorSnapshot {
  readonly actorId: string;
  readonly participantKind: OperationActorKind;
  readonly hp: number;
  readonly resources: Readonly<Record<string, number>>;
  readonly positionId?: string;
}

export interface OperationResolutionTeamSnapshot {
  readonly id: string;
  readonly resources: Readonly<Record<string, number>>;
}

/** Frozen Run-start rules; no caller-provided effects or computed skill/combination data. */
export interface OperationResolutionTrustedContent {
  readonly eventDefinition: OperationEventDef;
  readonly actorInitializations: readonly OperationActorInitialization[];
  readonly actionDefinitions: readonly OperationActionDef[];
  readonly studentSkillRules: readonly OperationStudentSkillRuleDef[];
  readonly playerSceneCardInstances?: readonly OperationPlayerSceneCardInstanceDef[];
}

/** Only stored owner state and frozen definitions enter the pure planner. */
export interface OperationResolutionPlannerInput {
  readonly snapshot: OperationResolutionPlannerSnapshot;
  readonly trustedContent: OperationResolutionTrustedContent;
  /** The owner's stored canonical base plan; the planner recomputes and compares it. */
  readonly preparedBeat: import('./operation-beat').PreparedBeat;
  readonly interventionDraft: import('./operation-beat').OperationInterventionDraft | null;
  /** When present, the same planner validates and aggregates a complete non-combat batch. */
  readonly sceneBatch?: {
    readonly selections: readonly OperationSceneActionSelection[];
    readonly cards?: readonly OperationSceneCardSelection[];
    readonly purchases?: readonly OperationScenePurchaseSelection[];
    readonly skip?: boolean;
  };
}

export type OperationResolutionPlannerErrorCode =
  | 'operation:resolution:invalid-snapshot'
  | 'operation:resolution:invalid-content'
  | 'operation:resolution:stale-plan'
  | 'operation:resolution:unaffordable'
  | 'operation:resolution:invalid-effect'
  | 'operation:resolution:rng-failure';
