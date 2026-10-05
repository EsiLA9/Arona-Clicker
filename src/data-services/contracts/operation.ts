/**
 * Declaration-only Gameplay B content shared by Datapack, Registry and the product Runtime.
 * This module must not import AronaClicker services or Runtime state.
 */

export type OperationActorKind = 'student' | 'opponent' | 'environment';
export type OperationResultKind = 'success' | 'partialSuccess' | 'failure';
export type OperationLocationResultKind = OperationResultKind;

/** V1 permits only a small, validated AC resource award per non-failure outcome. */
export interface OperationRewardDef {
  readonly kind: 'resource';
  readonly resourceId: string;
  readonly amount: number;
}

export interface OperationEventRewardsDef {
  readonly success?: OperationRewardDef;
  readonly partialSuccess?: OperationRewardDef;
}

export type OperationPredicateOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
export type OperationPredicateLeafDef =
  | { readonly kind: 'track'; readonly trackId: string; readonly operator: OperationPredicateOperator; readonly value: number }
  | { readonly kind: 'knownFact'; readonly factId: string; readonly present: boolean };
export type OperationPredicateDef = OperationPredicateLeafDef
  | { readonly kind: 'all' | 'any'; readonly terms: readonly OperationPredicateLeafDef[] };

/** Local to its owning Event or Location; it is not a Registry entity. */
export interface OperationObjectiveDef {
  readonly id: string;
  readonly description: string;
  readonly kind: 'primary' | 'secondary';
  readonly predicate: OperationPredicateDef;
}

/** Local to its owning Event or Location; it is not a Registry entity. */
export interface OperationOutcomeConditionDef {
  readonly id: string;
  readonly description: string;
  readonly predicate: OperationPredicateDef;
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
  /** Detached card copy for opponent/environment actors; student copy comes from the admitted Variant. */
  readonly displayName?: string;
  readonly avatarRef?: string;
  readonly description?: string;
  readonly hp: OperationBoundedValueDef;
  readonly resources?: Readonly<Record<string, OperationBoundedValueDef>>;
  readonly teamId?: string;
  readonly targetPriorityActorIds?: readonly string[];
}

export interface OperationTeamDef {
  readonly id: string;
  readonly resources?: Readonly<Record<string, OperationBoundedValueDef>>;
}

export interface OperationPlayerRouteStateDef {
  readonly playerCost: number;
}

export interface OperationPlayerSceneCardDef {
  /** Local card-definition ID, unique within the Event deck. */
  readonly id: string;
  readonly actionId: string;
  readonly playerCost: number;
  readonly timing: 'scene';
  readonly copies: number;
}

export interface OperationPlayerSceneDeckDef {
  readonly cards: readonly OperationPlayerSceneCardDef[];
  readonly initialDraw: number;
  readonly locationEntryDraw: number;
  readonly maxHandSize: number;
}

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

/** Top-level reusable Action. Targets, requirements and effects have one authoritative home. */
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

/** Event-local rule; the two Action tags occupy ordered slots A and B. */
export interface OperationCombinationRuleDef {
  readonly id: string;
  readonly priority: number;
  readonly inputTagIds: readonly [string, string];
  readonly targetMatch: OperationCombinationTargetMatch;
  readonly effects: readonly OperationActionEffectDef[];
}

/** Event-local route edge. Its ID is local; targetLocationId is a full Operation Location ID. */
export interface OperationRouteEdgeDef {
  readonly id: string;
  readonly targetLocationId: string;
  readonly label: string;
  readonly description: string;
  readonly requiredHeldItemId?: string;
  readonly consumeRequiredHeldItem?: boolean;
}

export type OperationSceneActionMode = 'individual' | 'global';

/** Thin Location-local wrapper; actionId is a full ID and behavior stays on OperationActionDef. */
export interface OperationSceneActionDef {
  readonly id: string;
  readonly actionId: string;
  readonly scope: OperationSceneActionMode;
  readonly playerCost: number;
}

/** Top-level Location. All action and route targets reference full stable IDs. */
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

/** Embedded roster assignment. Character identity and Variant ownership remain player state. */
export type OperationParticipantSpec =
  | { readonly actorId: string; readonly kind: 'student'; readonly profileId?: string }
  | {
      readonly actorId: string;
      readonly kind: 'opponent' | 'environment';
      readonly factionId?: string;
      readonly candidateActionIds: readonly string[];
    };

/** Top-level Character-specific Operation profile. Character ID keeps AC's existing identity form. */
export interface StudentOperationProfileDef {
  readonly id: string;
  readonly characterId: string;
  readonly candidateActionIds: readonly string[];
  readonly actionPriorityIds: readonly string[];
  readonly capabilityIds: readonly string[];
  readonly reasonIds: readonly string[];
  readonly randomSkillRuleId?: string;
}

/** Embedded finite Commit-time skill rule; no callback or player PlayerCost. */
export interface OperationStudentSkillRuleDef {
  readonly id: string;
  readonly triggerActionIds: readonly string[];
  readonly chanceBps: number;
  readonly effects: readonly OperationActionEffectDef[];
}

/** One declared Operation Event. Locations, Actions and Profiles are resolved from the Registry. */
export interface OperationEventContentDef {
  readonly id: string;
  /** Owning AC worldline; v1 exposes the event from this Init. */
  readonly initId: string;
  /** Explicit author-maintained compatibility version for Save/Resume. */
  readonly resumeVersion: number;
  readonly locationIds: readonly string[];
  readonly initialLocationId: string;
  readonly maxLocationVisits: number;
  readonly tracks: readonly OperationTrackDef[];
  readonly factIds: readonly string[];
  readonly knownFactIds: readonly string[];
  readonly itemIds: readonly string[];
  readonly heldItemIds: readonly string[];
  readonly objectives?: readonly OperationObjectiveDef[];
  readonly partialOutcomes?: readonly OperationOutcomeConditionDef[];
  readonly hardFailureConditions?: readonly OperationOutcomeConditionDef[];
  /** Only success and partial-success resource grants are supported in V1. */
  readonly rewards?: OperationEventRewardsDef;
  readonly actors: readonly OperationActorDef[];
  readonly teams?: readonly OperationTeamDef[];
  readonly participants: readonly OperationParticipantSpec[];
  readonly studentSkillRules?: readonly OperationStudentSkillRuleDef[];
  readonly playerRouteState: OperationPlayerRouteStateDef;
  readonly playerSceneDeck?: OperationPlayerSceneDeckDef;
  readonly randomSeed?: number;
}
