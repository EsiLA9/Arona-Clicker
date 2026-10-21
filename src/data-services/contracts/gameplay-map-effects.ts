/** Fixed bounds for the E1 authoring language. These are part of the syntax contract. */
export const GAMEPLAY_MAP_EFFECT_LIMITS = {
  staticNodes: 64,
  resolveDepth: 4,
  conditionDepth: 4,
  prepareLeaves: 8,
  locals: 64,
  roundVisits: 4096,
} as const;

export type GameplayMapEffectUnit = 'source' | 'primary';
/** The source's Actor, selected primary Actor, or source-side Team account. */
export type GameplayMapEffectAccount = 'sourceActor' | 'primaryActor' | 'sourceTeam';

export interface GameplayMapEffectProgramDef {
  /** Fixed sCost reductions applied before the round is planned. */
  readonly prepare?: readonly GameplayMapEffectPrepareDef[];
  /** Ordered effects evaluated for this source. */
  readonly resolve?: readonly GameplayMapEffectStatementDef[];
}

export interface GameplayMapEffectPrepareDef {
  /** Add a fixed discount to the currently selected legal CardRef's Actor sCost before resolution. */
  readonly op: 'discountSCost';
  /** Positive safe-integer discount; stacked discounts are clamped at zero cost. */
  readonly amount: number;
}

export type GameplayMapEffectStatementDef =
  /** Apply a signed safe-integer HP change to one resolved unit. */
  | {
    readonly op: 'hpChange';
    /** source or the source's already resolved primary unit. */
    readonly target: GameplayMapEffectUnit;
    /** Non-zero signed safe integer; ordinary changes do not revive zero-HP units. */
    readonly delta: number;
  }
  /** Record a signed balance change for the later resource settlement ledger. */
  | {
    readonly op: 'resourceChange';
    /** One of the source Actor, primary Actor, or source-side Team accounts. */
    readonly account: GameplayMapEffectAccount;
    /** Non-empty Map-local resource key; Registry later binds the declared balance. */
    readonly resourceId: string;
    /** Non-zero signed safe integer. */
    readonly delta: number;
  }
  /** Add a signed safe-integer delta to a declared Counter, saturating at its bounds. */
  | {
    readonly op: 'counterAdd';
    /** Name of a Counter declared in this Encounter. */
    readonly counterId: string;
    /** Non-zero signed safe integer; result is clamped to declared min/max. */
    readonly delta: number;
  }
  /** Set a declared Encounter Flag to a boolean value. */
  | {
    readonly op: 'flagSet';
    /** Name of a Flag declared in this Encounter. */
    readonly flagId: string;
    /** New boolean value. */
    readonly value: boolean;
  }
  /** Evaluate one restricted condition at this sequence position and visit one branch. */
  | {
    readonly op: 'when';
    /** Evaluated against current planned HP/locals at this position. */
    readonly condition: GameplayMapEffectConditionDef;
    /** Required branch when the condition is true. */
    readonly then: readonly GameplayMapEffectStatementDef[];
    /** Optional branch when the condition is false. */
    readonly else?: readonly GameplayMapEffectStatementDef[];
  };

/** Restricted E1 reads: current HP, HP ratio, and Encounter-local Counter/Flag values. */
export type GameplayMapEffectConditionDef =
  /** Every child / at least one child must match. */
  | {
    readonly kind: 'all' | 'any';
    /** Non-empty child conditions; all children are statically checked. */
    readonly conditions: readonly GameplayMapEffectConditionDef[];
  }
  /** Negate one nested condition. */
  | { readonly kind: 'not'; readonly condition: GameplayMapEffectConditionDef }
  /** Compare a unit's current HP with a non-negative safe-integer threshold. */
  | {
    readonly kind: 'hpAtLeast' | 'hpAtMost';
    /** source or the source's already resolved primary unit. */
    readonly target: GameplayMapEffectUnit;
    /** Non-negative safe-integer HP threshold. */
    readonly value: number;
  }
  /** Compare current HP / cap with an exact rational in the inclusive range zero to one. */
  | {
    readonly kind: 'hpRatioAtLeast' | 'hpRatioAtMost';
    /** source or the source's already resolved primary unit. */
    readonly target: GameplayMapEffectUnit;
    /** Non-negative safe integer no greater than denominator. */
    readonly numerator: number;
    /** Positive safe integer. */
    readonly denominator: number;
  }
  /** Compare a declared Counter with a safe-integer value. */
  | {
    readonly kind: 'counter';
    /** Name of a Counter declared in this Encounter. */
    readonly counterId: string;
    /** Inclusive or strict numeric comparison. */
    readonly comparison: 'eq' | 'lt' | 'lte' | 'gt' | 'gte';
    /** Safe-integer value to compare. */
    readonly value: number;
  }
  /** Compare a declared Flag with an exact boolean value. */
  | {
    readonly kind: 'flag';
    /** Name of a Flag declared in this Encounter. */
    readonly flagId: string;
    /** Expected boolean value. */
    readonly value: boolean;
  };

export interface GameplayMapEncounterLocalsDef {
  /** Encounter Counter declarations; combined with flags they are limited to 64. */
  readonly counters?: readonly GameplayMapEncounterCounterDef[];
  /** Encounter Flag declarations; combined with counters they are limited to 64. */
  readonly flags?: readonly GameplayMapEncounterFlagDef[];
}

export interface GameplayMapEncounterCounterDef {
  /** Encounter-local identifier; Counter and Flag names share one namespace. */
  readonly id: string;
  /** Initial safe-integer value, within the inclusive min/max bounds. */
  readonly initial: number;
  /** Inclusive safe-integer lower bound; may be negative. */
  readonly min: number;
  /** Inclusive safe-integer upper bound. */
  readonly max: number;
}

export interface GameplayMapEncounterFlagDef {
  /** Encounter-local identifier; Counter and Flag names share one namespace. */
  readonly id: string;
  /** Initial boolean value. */
  readonly initial: boolean;
}
