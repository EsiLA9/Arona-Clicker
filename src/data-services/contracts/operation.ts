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
  /** Operation-local current actor facts used by card pool selectors. */
  readonly positionId?: string;
  /** Operation-local weapon fact used by card pool selectors. */
  readonly weaponId?: string;
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
  readonly title?: string;
  readonly description?: string;
  /** required cards are optional player choices; fixed cards auto-join every Scene batch. */
  readonly selectionPolicy?: 'required' | 'fixed';
  /** selected-student requires a student; none is actorless; optional-student allows either an actorless use or a qualified student. */
  readonly performerPolicy?: 'selected-student' | 'none' | 'optional-student';
}

export interface OperationPlayerSceneDeckDef {
  readonly cards: readonly OperationPlayerSceneCardDef[];
  readonly initialDraw: number;
  readonly locationEntryDraw: number;
  readonly maxHandSize: number;
}

export type OperationActionTargetRelation = 'self' | 'sameTeam' | 'otherTeam' | 'any';
/** Whether an Actor target is chosen by the player or resolved as the current legal group. */
export type OperationActionTargetSelectionMode = 'select' | 'all-eligible';
export type OperationActionTargetDef =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'actor';
      readonly relation: OperationActionTargetRelation;
      /** Omitted means select. all-eligible is supported by Scene batches, not combat Beats. */
      readonly selectionMode?: OperationActionTargetSelectionMode;
      /** When present, only these exact Event Actor IDs can be selected. */
      readonly allowedActorIds?: readonly string[];
      /** When present, the target's declared Event Actor type must match one of these strings. */
      readonly allowedActorTypes?: readonly string[];
      /** When present, the target's current Run position must match one of these IDs. */
      readonly allowedPositionIds?: readonly string[];
    };

export interface OperationActionCostDef {
  readonly scope: 'actor' | 'team';
  readonly resourceId: string;
  readonly amount: number;
}

export type OperationActionEffectDef =
  | { readonly kind: 'actorHpDelta'; readonly recipient: 'actor' | 'target'; readonly amount: number }
  | { readonly kind: 'actorResourceDelta'; readonly recipient: 'actor' | 'target'; readonly resourceId: string; readonly amount: number }
  | { readonly kind: 'actorPosition'; readonly recipient: 'actor' | 'target'; readonly positionId: string }
  | { readonly kind: 'teamResourceDelta'; readonly recipient: 'actorTeam' | 'targetTeam'; readonly resourceId: string; readonly amount: number }
  | { readonly kind: 'eventTrackDelta'; readonly trackId: string; readonly amount: number }
  | { readonly kind: 'eventFact'; readonly factId: string; readonly op: 'reveal' | 'forget' }
  | { readonly kind: 'heldItem'; readonly itemId: string; readonly op: 'grant' | 'remove' };

/** Top-level reusable Action. Targets, requirements and effects have one authoritative home. */
export interface OperationActionDef {
  readonly id: string;
  /** Author-facing canonical name used when no Scene wrapper overrides it. */
  readonly title: string;
  readonly description?: string;
  readonly allowedParticipantKinds: readonly OperationActorKind[];
  readonly requiredCapabilityIds: readonly string[];
  readonly reasonIds: readonly string[];
  readonly tagIds: readonly string[];
  /** Open Operation-local preference tags; deliberately separate from Combination tagIds. */
  readonly strategyTagIds?: readonly string[];
  /** Additional finite legality filter for Character Hand candidates. */
  readonly cardCondition?: OperationCardConditionDef;
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
  /** The route is available when the player holds at least one of these Event items. */
  readonly anyOfHeldItemIds?: readonly string[];
  readonly consumeRequiredHeldItem?: boolean;
}

export type OperationSceneActionMode = 'individual' | 'global';

/** Thin Location-local wrapper; actionId is a full ID and behavior stays on OperationActionDef. */
export interface OperationSceneActionDef {
  readonly id: string;
  readonly actionId: string;
  readonly scope: OperationSceneActionMode;
  readonly playerCost: number;
  readonly title?: string;
  readonly description?: string;
  /** selected-student requires a student; none is actorless; optional-student allows either an actorless use or a qualified student. */
  readonly performerPolicy?: 'selected-student' | 'none' | 'optional-student';
  /** Fixed actions are auto-included and cannot be deselected. */
  readonly selectionPolicy?: 'required' | 'fixed';
}

/** One SceneAction choice set within a SceneAction batch. Current V1 choice sets use global offers. */
export interface OperationSceneActionChoiceDef {
  /** Candidate SceneAction IDs; each candidate can be selected once. */
  readonly candidateSceneActionIds: readonly string[];
  /** The batch must include exactly this many candidates. */
  readonly chooseExactly: number;
}

/** A one-time Run-local purchase using the shared PlayerCost balance and an existing Action's Effects. */
export interface OperationScenePurchaseOfferDef {
  /** Local to the owning Location or Scene. */
  readonly id: string;
  /** Existing actorless Operation Action that grants this offer's result. */
  readonly actionId: string;
  readonly playerCost: number;
  /** Event fact revealed on purchase; the Run keeps it as the one-purchase guard. */
  readonly purchaseFactId: string;
  readonly title?: string;
  readonly description?: string;
}

/** One Location-local stage in an ordered Operation Scene sequence. */
export interface OperationSceneDef {
  /** Stable only within the parent Location; full identity is Event/Location/Scene. */
  readonly id: string;
  /** Inline player-facing copy; no separate presentation Registry is required. */
  readonly title: string;
  readonly description?: string;
  /** Optional tactical Action subset; omitted scenes inherit the Location's enabled actions. */
  readonly enabledActionIds?: readonly string[];
  /** Scene-scoped noncombat offer sources. */
  readonly actionMode?: OperationSceneActionMode;
  readonly sceneActions?: readonly OperationSceneActionDef[];
  readonly sceneActionBatches?: number;
  /** Optional exact M-of-N choice among required Global SceneAction offers in this Scene. */
  readonly sceneActionChoice?: OperationSceneActionChoiceDef;
  /** Optional temporary one-time offers settled in the same SceneAction batch. */
  readonly purchaseOffers?: readonly OperationScenePurchaseOfferDef[];
  /** A single boolean condition; Runtime records completion only after a successful commit. */
  readonly completion?: OperationPredicateDef;
}

/** Top-level Location. All action and route targets reference full stable IDs. */
export interface OperationLocationDef {
  readonly id: string;
  /** Declares the active gameplay stage; Runtime projects this without UI inference. */
  readonly stage: 'combat' | 'scene';
  /** Optional finite interaction context for CardPool and Action selectors. */
  readonly interactionSceneId?: string;
  readonly activityId?: string;
  readonly cardPoolIds?: readonly string[];
  readonly enabledActionIds: readonly string[];
  readonly combinationRules: readonly OperationCombinationRuleDef[];
  /** Ordered Scene definitions. Omitted content projects one implicit Location-local Scene. */
  readonly scenes?: readonly OperationSceneDef[];
  readonly actionMode?: OperationSceneActionMode;
  readonly sceneActions?: readonly OperationSceneActionDef[];
  readonly sceneActionBatches?: number;
  /** Choice contract for the Location's implicit Scene. */
  readonly sceneActionChoice?: OperationSceneActionChoiceDef;
  /** Purchase offers for the Location's implicit Scene. */
  readonly purchaseOffers?: readonly OperationScenePurchaseOfferDef[];
  readonly costGain?: number;
  readonly maxCarryCost?: number;
  readonly objectives?: readonly OperationObjectiveDef[];
  readonly partialOutcomes?: readonly OperationOutcomeConditionDef[];
  readonly failureConditions?: readonly OperationOutcomeConditionDef[];
  readonly maxBeats?: number;
  /** Optional per-Location visit ceiling, checked before a route enters this Location. */
  readonly maxVisits?: number;
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
  /** Optional role preference; omitted legacy profiles use neutral bias. */
  readonly strategyProfileId?: string;
  /** Character-specific pools, merged with Event and Location pools. */
  readonly cardPoolIds?: readonly string[];
  readonly randomSkillRuleId?: string;
}

/**
 * Finite Operation facts queried by pool activation and candidate legality.
 * Each supplied list is OR; different fields are AND. Omitted lists are unrestricted.
 */
export interface OperationCardConditionDef {
  readonly sceneIds?: readonly string[];
  readonly activityIds?: readonly string[];
  readonly positionIds?: readonly string[];
  readonly weaponIds?: readonly string[];
  readonly requiredFactIds?: readonly string[];
  readonly forbiddenFactIds?: readonly string[];
}

/** Open tag-to-weight preferences owned by one Character Operation Profile. */
export interface OperationStrategyProfileDef {
  readonly id: string;
  readonly biases: readonly { readonly tagId: string; readonly biasBps: number }[];
}

/** A reusable source of weighted Operation Actions, activated by a finite selector. */
export interface OperationCardPoolDef {
  readonly id: string;
  readonly selector?: OperationCardConditionDef;
  readonly entries: readonly { readonly actionId: string; readonly weight: number }[];
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
  /** Short player-facing name for a generic Operation entry and its workspace heading. */
  readonly title?: string;
  /** Concise event introduction for a generic Operation entry and its workspace opening. */
  readonly description?: string;
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
  /** Pools available to every student in this Event. */
  readonly cardPoolIds?: readonly string[];
  /** Per-student hand size; defaults to 3 and is validated in [1, 10]. */
  readonly characterHandSize?: number;
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
