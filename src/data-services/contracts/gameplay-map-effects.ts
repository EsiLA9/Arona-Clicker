import type { TagRef } from '../../engine/core/tag';

/** Fixed bounds for the Gameplay B effect authoring language. These are part of the syntax contract. */
export const GAMEPLAY_MAP_EFFECT_LIMITS = {
  staticNodes: 64,
  resolveDepth: 4,
  conditionDepth: 4,
  valueNodes: 128,
  valueDepth: 8,
  targetSetSize: 32,
  effectRepeat: 8,
  sourceExpansion: 1024,
  prepareLeaves: 8,
  locals: 64,
  statusDefinitions: 64,
  statusStacks: 99,
  statusDurationRounds: 99,
  activeStatusInstances: 256,
  roundVisits: 4096,
} as const;

export type GameplayMapEffectUnit = 'source' | 'primary';
/** Closed Map-local Status classification used by statusRemoveCategory. */
export type GameplayMapStatusCategory = 'harmful' | 'beneficial';
export type GameplayMapEffectLoopUnit = GameplayMapEffectUnit | 'loopTarget';
export type GameplayMapEffectValueUnit = GameplayMapEffectUnit | 'target';
/** The source's Actor, selected primary Actor, or source-side Team account. */
export type GameplayMapEffectAccount = 'sourceActor' | 'primaryActor' | 'sourceTeam';
export type GameplayMapEffectBalanceAccount = GameplayMapEffectAccount | 'additionalActor' | 'loopTargetActor';
/** ResourceChange accounts; loopTargetActor is lexically limited to a forTargets body. */
export type GameplayMapEffectWriteAccount = GameplayMapEffectAccount | 'additionalActor' | 'loopTargetActor';

/** Safe-integer-only expression tree; no arbitrary property access or evaluation. */
export type GameplayMapEffectValueDef =
  | { readonly kind: 'literal'; readonly value: number }
  | { readonly kind: 'hp' | 'hpCap' | 'missingHp'; readonly unit: GameplayMapEffectValueUnit }
  | { readonly kind: 'counter'; readonly counterId: string }
  | { readonly kind: 'resourceBalance'; readonly account: GameplayMapEffectBalanceAccount; readonly resourceId: string }
  | { readonly kind: 'mapRunCounter'; readonly counterId: string }
  | { readonly kind: 'round' | 'targetCount' }
  | { readonly kind: 'add' | 'sub' | 'mul' | 'divFloor' | 'min' | 'max'; readonly left: GameplayMapEffectValueDef; readonly right: GameplayMapEffectValueDef }
  | { readonly kind: 'clamp'; readonly value: GameplayMapEffectValueDef; readonly min: GameplayMapEffectValueDef; readonly max: GameplayMapEffectValueDef }
  | { readonly kind: 'abs'; readonly value: GameplayMapEffectValueDef };

export interface GameplayMapEffectTargetSetDef {
  readonly side: 'party' | 'enemy';
  readonly filter?: 'living' | 'all';
  readonly order?: 'definition' | 'hpRatioAscending' | 'hpRatioDescending' | 'random';
  /** Truncate after filtering/sorting. Omission rejects sets larger than 32. */
  readonly limit?: number;
}

export type GameplayMapEffectDamageTargetDef = 'primary' | { readonly set: GameplayMapEffectTargetSetDef };

export interface GameplayMapEffectProgramDef {
  /** Fixed sCost reductions applied before the round is planned. */
  readonly prepare?: readonly GameplayMapEffectPrepareDef[];
  /** Ordered effects evaluated for this source. */
  readonly resolve?: readonly GameplayMapEffectStatementDef[];
/** Ordered Map-local reactions to closed actual-result events in this Program. */
  readonly triggers?: readonly GameplayMapEffectTriggerDef[];
}

/** Bounded post-result reaction. Account and event are correlated by this closed union. */
export type GameplayMapEffectTriggerDef =
  | {
  /** Map-local trigger identifier, unique within this Program. */
    readonly id: string;
    /** Actual HP restoration or actual HP loss on this primary Actor. */
    readonly event: 'healApplied' | 'damageApplied';
  /** Optional positive threshold compared with final actual HP change, after clamping/reduction/Shield. */
    readonly minimumActualAmount?: number;
    /** A positive resource reward for the event's primary Actor. */
    readonly effect: {
      readonly op: 'resourceChange';
      readonly account: 'primaryActor';
      readonly resourceId: string;
      readonly delta: number;
    };
  }
  | {
    readonly id: string;
    /** One direct Party primary hit moves an Enemy from positive HP to zero. */
    readonly event: 'enemyDefeated';
    /** A positive resource reward for the Party Actor that dealt the defeating hit. */
    readonly effect: {
      readonly op: 'resourceChange';
      readonly account: 'sourceActor';
      readonly resourceId: string;
      readonly delta: number;
    };
  };

export interface GameplayMapEffectPrepareDef {
  /** Add a fixed discount to the currently selected legal CardRef's Actor sCost before resolution. */
  readonly op: 'discountSCost';
  /** Positive safe-integer discount; stacked discounts are clamped at zero cost. */
  readonly amount: number;
}

export type GameplayMapEffectStatementDef =
  /** Apply a positive safe-integer amount of damage to the resolved primary or a fixed target set. */
  | {
    readonly op: 'damage';
    readonly target: GameplayMapEffectDamageTargetDef;
    /** Positive safe integer or a restricted Value expression yielding a non-negative safe integer. */
    readonly amount: number | GameplayMapEffectValueDef;
    /** Number of consecutive hits per selected unit; omitted means one. */
    readonly repeat?: number | GameplayMapEffectValueDef;
  }
  /** Apply a positive safe-integer amount of healing to the resolved primary or a fixed target set. */
  | {
    readonly op: 'heal';
    readonly target: GameplayMapEffectDamageTargetDef;
    /** Positive safe integer or a restricted Value expression yielding a non-negative safe integer. */
    readonly amount: number | GameplayMapEffectValueDef;
    /** Number of consecutive hits per selected unit; omitted means one. */
    readonly repeat?: number | GameplayMapEffectValueDef;
  }
  /** Restore a fixed HP amount to a downed Party Character; living targets are a no-op. */
  | {
    readonly op: 'revive';
    /** Revive is limited to one selected Party Character primary target. */
    readonly target: 'primary';
    /** Positive safe integer HP amount, clamped to the target's max HP. */
    readonly amount: number;
  }
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
    /** Source, primary, additional, loopTarget, or source-side Team account. */
    readonly account: GameplayMapEffectWriteAccount;
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
  /** Apply a declared Map-local Status to the source or selected primary unit. */
  | {
    readonly op: 'statusApply';
    /** The acting unit or its already resolved primary unit. */
    readonly target: GameplayMapEffectUnit;
    /** ID of a Status declared by the owning Map. */
    readonly statusId: string;
    /** Positive safe integer number of layers, at most the Status maxStacks. */
    readonly stacks: number;
    /** Positive safe integer duration measured in successful Encounter rounds. */
    readonly durationRounds: number;
  }
  /** Remove all active instances of a declared Map-local Status from the source or selected primary unit. */
  | {
    readonly op: 'statusRemove';
    /** The acting unit or its already resolved primary unit. */
    readonly target: GameplayMapEffectUnit;
    /** ID of a Status declared by the owning Map. */
    readonly statusId: string;
  }
  /** Consume up to a fixed number of layers of one declared Map-local Status. */
  | {
    readonly op: 'statusConsume';
    /** The acting unit or its already resolved primary unit; never a loop target. */
    readonly target: GameplayMapEffectUnit;
    /** ID of a Status declared by the owning Map. */
    readonly statusId: string;
    /** Positive safe-integer number of layers to consume, up to 99. */
    readonly stacks: number;
  }
  /** Remove every active instance whose Map-local Status definition declares the requested category. */
  | {
    readonly op: 'statusRemoveCategory';
    /** The acting unit or its already resolved primary unit; never a loop, Team, CardRef or additional target. */
    readonly target: GameplayMapEffectUnit;
    /** Match only Status definitions explicitly assigned this category. */
    readonly category: GameplayMapStatusCategory;
  }
  /** Add a positive safe-integer amount to the source or resolved primary unit's Encounter-local Shield pool. */
  | {
    readonly op: 'shieldAdd';
    /** The acting unit or its already resolved primary unit; no TargetSet or CardRef targets. */
    readonly target: GameplayMapEffectUnit;
    /** Positive safe integer or a restricted Value expression yielding a positive safe integer. */
    readonly amount: number | GameplayMapEffectValueDef;
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
  }
  /** Execute a finite statement body for each identity in one resolved TargetSet. */
  | {
    readonly op: 'forTargets';
    readonly targetSet: GameplayMapEffectTargetSetDef;
    readonly body: readonly GameplayMapEffectLoopStatementDef[];
  }
  /** Add to a declared MapRun Counter, saturating at its bounds. */
  | { readonly op: 'mapRunCounterAdd'; readonly counterId: string; readonly delta: number }
  /** Set a declared MapRun Flag. */
  | { readonly op: 'mapRunFlagSet'; readonly flagId: string; readonly value: boolean }
  /** Modify one fixed card effect leaf during card resolution. */
  | { readonly op: 'cardEffectModifier'; readonly path: 'resolve[0].amount'; readonly operation: 'add'; readonly delta: number };

/** Restricted finite reads for Effect Program conditions. */
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
  /** Count Party Actions in the frozen beginning-of-round Prepared snapshot that match a TagRef. */
  | {
    readonly kind: 'preparedTagCount';
    /** V1 exposes only the Party's prepared source set. */
    readonly side: 'party';
    /** Complete TagRef; a source counts once if any declared tag matches this TagRef. */
    readonly tag: TagRef;
    /** Inclusive or strict numeric comparison. */
    readonly comparison: 'eq' | 'lt' | 'lte' | 'gt' | 'gte';
    /** Non-negative safe-integer threshold. */
    readonly value: number;
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
  }
  /** Compare a declared MapRun Counter with a safe-integer value. */
  | {
    readonly kind: 'mapRunCounter';
    readonly counterId: string;
    readonly comparison: 'eq' | 'lt' | 'lte' | 'gt' | 'gte';
    readonly value: number;
  }
  /** Compare a declared MapRun Flag with an exact boolean value. */
  | { readonly kind: 'mapRunFlag'; readonly flagId: string; readonly value: boolean }
  /** Compare a declared MapRun resource balance against a fixed threshold. */
  | {
    readonly kind: 'resourceAtLeast';
    readonly account: GameplayMapEffectBalanceAccount;
    readonly resourceId: string;
    readonly value: number;
  };

/** Recursive value forms accepted only inside a forTargets lexical scope. */
export type GameplayMapEffectLoopValueDef =
  | GameplayMapEffectValueDef
  | { readonly kind: 'hp' | 'hpCap' | 'missingHp'; readonly unit: GameplayMapEffectLoopUnit | 'target' }
  | { readonly kind: 'add' | 'sub' | 'mul' | 'divFloor' | 'min' | 'max'; readonly left: GameplayMapEffectLoopValueDef; readonly right: GameplayMapEffectLoopValueDef }
  | { readonly kind: 'clamp'; readonly value: GameplayMapEffectLoopValueDef; readonly min: GameplayMapEffectLoopValueDef; readonly max: GameplayMapEffectLoopValueDef }
  | { readonly kind: 'abs'; readonly value: GameplayMapEffectLoopValueDef };

/** Recursive condition forms accepted only inside a forTargets lexical scope. */
export type GameplayMapEffectLoopConditionDef =
  | GameplayMapEffectConditionDef
  | { readonly kind: 'hpAtLeast' | 'hpAtMost'; readonly target: GameplayMapEffectLoopUnit; readonly value: number }
  | { readonly kind: 'hpRatioAtLeast' | 'hpRatioAtMost'; readonly target: GameplayMapEffectLoopUnit; readonly numerator: number; readonly denominator: number }
  | { readonly kind: 'all' | 'any'; readonly conditions: readonly GameplayMapEffectLoopConditionDef[] }
  | { readonly kind: 'not'; readonly condition: GameplayMapEffectLoopConditionDef };

/** Statements may bind loopTarget only in the body of forTargets. */
export type GameplayMapEffectLoopStatementDef =
  | Exclude<GameplayMapEffectStatementDef, { readonly op: 'shieldAdd' | 'revive' }>
  | { readonly op: 'damage' | 'heal'; readonly target: GameplayMapEffectDamageTargetDef; readonly amount: number | GameplayMapEffectLoopValueDef; readonly repeat?: number | GameplayMapEffectLoopValueDef }
  | { readonly op: 'hpChange'; readonly target: GameplayMapEffectLoopUnit; readonly delta: number }
  | { readonly op: 'shieldAdd'; readonly target: GameplayMapEffectUnit; readonly amount: number | GameplayMapEffectLoopValueDef }
  | { readonly op: 'statusApply'; readonly target: GameplayMapEffectLoopUnit; readonly statusId: string; readonly stacks: number; readonly durationRounds: number }
  | { readonly op: 'when'; readonly condition: GameplayMapEffectLoopConditionDef; readonly then: readonly GameplayMapEffectLoopStatementDef[]; readonly else?: readonly GameplayMapEffectLoopStatementDef[] }
  | { readonly op: 'forTargets'; readonly targetSet: GameplayMapEffectTargetSetDef; readonly body: readonly GameplayMapEffectLoopStatementDef[] };

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
