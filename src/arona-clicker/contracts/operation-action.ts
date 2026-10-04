import type { OperationActorKind } from './operation';

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
  | { readonly kind: 'eventTrackDelta'; readonly trackId: string; readonly amount: number };

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

/** Temporary tactical rules for an existing Event location ID; routes remain a later Task. */
export interface OperationLocationTacticsDef {
  readonly locationId: string;
  readonly enabledActionIds: readonly string[];
  readonly combinationRules: readonly OperationCombinationRuleDef[];
}
