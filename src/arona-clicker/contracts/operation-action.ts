import type { OperationActorKind, OperationObjectiveDef, OperationOutcomeConditionDef } from './operation';

export type OperationActionTargetRelation = 'self' | 'sameTeam' | 'otherTeam' | 'any';

export type OperationActionTargetDef =
  | { readonly kind: 'none' }
  | { readonly kind: 'actor'; readonly relation: OperationActionTargetRelation };

export interface OperationActionCostDef {
  readonly scope: 'actor' | 'team';
  readonly resourceId: string;
  readonly amount: number;
}

export type OperationActionEffectDef =
  | { readonly kind: 'actorHpDelta'; readonly recipient: 'actor' | 'target'; readonly amount: number }
  | { readonly kind: 'actorResourceDelta'; readonly recipient: 'actor' | 'target'; readonly resourceId: string; readonly amount: number }
  | { readonly kind: 'teamResourceDelta'; readonly recipient: 'actorTeam' | 'targetTeam'; readonly resourceId: string; readonly amount: number }
  | { readonly kind: 'eventTrackDelta'; readonly trackId: string; readonly amount: number }
  | { readonly kind: 'eventFact'; readonly factId: string; readonly op: 'reveal' | 'forget' }
  | { readonly kind: 'heldItem'; readonly itemId: string; readonly op: 'grant' | 'remove' };

/** Trusted action content used by one or more Operation participant profiles. */
export interface OperationActionDef {
  readonly id: string;
  readonly allowedParticipantKinds: readonly OperationActorKind[];
  readonly requiredCapabilityIds: readonly string[];
  readonly reasonIds: readonly string[];
  readonly tagIds: readonly string[];
  readonly cost?: OperationActionCostDef;
  readonly target: OperationActionTargetDef;
  readonly effects: readonly OperationActionEffectDef[];
}

export type OperationCombinationTargetMatch = 'same-target' | 'no-target';

/** The ordered slots A and B match one Action tag per participating Student. */
export interface OperationCombinationRuleDef {
  readonly id: string;
  readonly priority: number;
  readonly inputTagIds: readonly [string, string];
  readonly targetMatch: OperationCombinationTargetMatch;
  /** Applied relative to slot A's Actor and the shared selected target. */
  readonly effects: readonly OperationActionEffectDef[];
}

/** One disjoint pair selected by the current Location's deterministic Combination ordering. */
export interface OperationCombinationMatch {
  readonly ruleId: string;
  readonly priority: number;
  readonly actorAId: string;
  readonly actorBId: string;
  readonly actionAId: string;
  readonly actionBId: string;
  readonly targetActorId: string | null;
}

/** Detached Combination projection tied to the exact base Beat it consumed. */
export interface OperationCombinationPreview {
  readonly planVersion: number;
  readonly locationId: string;
  readonly matches: readonly OperationCombinationMatch[];
}

/** Route graph and local tactical rules authored together for one Event Location. */
export interface OperationRouteEdgeDef {
  readonly id: string;
  readonly targetLocationId: string;
  readonly label: string;
  readonly description: string;
  readonly requiredHeldItemId?: string;
  readonly consumeRequiredHeldItem?: boolean;
}

export type OperationSceneActionMode = 'individual' | 'global';

/** A thin, location-scoped wrapper; all targeting and effects remain on OperationActionDef. */
export interface OperationSceneActionDef {
  readonly id: string;
  readonly actionId: string;
  readonly scope: OperationSceneActionMode;
  readonly playerCost: number;
}

export interface OperationLocationDef {
  readonly id: string;
  readonly enabledActionIds: readonly string[];
  readonly combinationRules: readonly OperationCombinationRuleDef[];
  readonly actionMode?: OperationSceneActionMode;
  readonly sceneActions?: readonly OperationSceneActionDef[];
  readonly sceneActionBatches?: number;
  readonly costGain?: number;
  readonly maxCarryCost?: number;
  readonly objectives?: readonly OperationObjectiveDef[];
  readonly partialOutcomes?: readonly OperationOutcomeConditionDef[];
  readonly failureConditions?: readonly OperationOutcomeConditionDef[];
  readonly maxBeats?: number;
  readonly routeEdges: readonly OperationRouteEdgeDef[];
}
