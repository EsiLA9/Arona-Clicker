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

export interface OperationResolutionIntervention {
  readonly actorId: string;
  readonly before: OperationPreparedActorPlan;
  readonly after: OperationPreparedActorPlan;
  readonly reasonId?: string;
}

/** Pure successful Commit candidate; only U8 may publish state or retain its next RNG cursor. */
export interface OperationResolutionBatch {
  readonly runId: string;
  readonly eventId: string;
  readonly basePlanVersion: number;
  readonly locationId: string;
  readonly actorPlans: readonly OperationPreparedActorPlan[];
  readonly intervention: OperationResolutionIntervention | null;
  readonly payments: readonly OperationResolutionPayment[];
  readonly combinations: OperationCombinationPreview;
  readonly studentSkillChecks: readonly OperationStudentSkillCheckResult[];
  readonly randomCursorBefore: number;
  readonly randomCursorAfter: number;
  readonly numericChanges: readonly OperationResolutionNumericChange[];
  readonly membershipChanges: readonly OperationResolutionMembershipChange[];
  readonly nextRandomState: OperationTacticalRandomState;
}

/** Compact per-Run record; the next seed/cursor is owned by EventRun, not copied into history. */
export type OperationResolution = Omit<OperationResolutionBatch, 'nextRandomState'> & {
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
  readonly actors: readonly OperationResolutionActorSnapshot[];
  readonly teams: readonly OperationResolutionTeamSnapshot[];
  readonly tracks: Readonly<Record<string, number>>;
  readonly knownFactIds: readonly string[];
  readonly heldItemIds: readonly string[];
  readonly randomState: OperationTacticalRandomState;
}

export interface OperationResolutionActorSnapshot {
  readonly actorId: string;
  readonly participantKind: OperationActorKind;
  readonly hp: number;
  readonly resources: Readonly<Record<string, number>>;
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
}

/** Only stored owner state and frozen definitions enter the pure planner. */
export interface OperationResolutionPlannerInput {
  readonly snapshot: OperationResolutionPlannerSnapshot;
  readonly trustedContent: OperationResolutionTrustedContent;
  /** The owner's stored canonical base plan; the planner recomputes and compares it. */
  readonly preparedBeat: import('./operation-beat').PreparedBeat;
  readonly interventionDraft: import('./operation-beat').OperationInterventionDraft | null;
}

export type OperationResolutionPlannerErrorCode =
  | 'operation:resolution:invalid-snapshot'
  | 'operation:resolution:invalid-content'
  | 'operation:resolution:stale-plan'
  | 'operation:resolution:unaffordable'
  | 'operation:resolution:invalid-effect'
  | 'operation:resolution:rng-failure';
