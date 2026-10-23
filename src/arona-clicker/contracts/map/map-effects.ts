import type {
  NormalizedGameplayMapActionEffects,
  NormalizedGameplayMapEffectInstruction,
} from '../../../data-services/normalization/gameplay-map-effect-program';
import type {
  GameplayMapEffectBalanceAccount,
  GameplayMapEffectWriteAccount,
} from '../../../data-services/contracts/gameplay-map-effects';
import type { GameplayMapRunFactsDef, GameplayMapStatusDef } from '../../../data-services/contracts/gameplay-map';
import type { TagRef } from '../../../engine/core/tag';
import type {
  GameplayMapEffectTargetSetDef,
} from '../../../data-services/contracts/gameplay-map-effects';

export type MapEffectActorIdentity = {
  readonly kind: 'partyCharacter' | 'enemy';
  readonly id: string;
};

export interface MapEffectRandomState {
  readonly algorithm: 'counter-addressed-murmur3-fmix32-v1';
  readonly seed: number;
  /** Index of the next raw uint32 word. */
  readonly cursor: number;
}

export interface MapEffectRandomTrace {
  readonly algorithm: 'counter-addressed-murmur3-fmix32-v1';
  readonly seed: number;
  readonly cursorBefore: number;
  readonly cursorAfter: number;
}

/** Concrete source kind for effect traces; Ability and Item cannot share a source key. */
export type MapEffectProgramSourceIdentity = { readonly kind: 'partyCharacter'; readonly id: string }
  | { readonly kind: 'enemy'; readonly id: string }
  | { readonly kind: 'ability'; readonly actionId: string }
  | { readonly kind: 'item'; readonly actionId: string; readonly itemId: string };

export type MapEffectTeamIdentity = { readonly kind: 'team'; readonly side: 'party' | 'enemy' };
export type MapEffectAccountIdentity = MapEffectActorIdentity | MapEffectTeamIdentity;
export type MapEffectTraceIdentity = MapEffectAccountIdentity | { readonly kind: 'encounterLocal' };

/** One Encounter-local unit Status, attributed to both its program source and source Action. */
export interface MapEncounterStatusInstance {
  readonly holder: MapEffectActorIdentity;
  readonly statusId: string;
  readonly source: MapEffectProgramSourceIdentity;
  readonly actionId: string;
  readonly appliedRound: number;
  readonly lastTriggeredRound: number | null;
  readonly stacks: number;
  readonly remainingRounds: number;
}

/** MapRun-owned Status provenance and clock, kept separate from Encounter-local age. */
export interface MapRunStatusInstance extends MapEncounterStatusInstance {
  readonly originNodeId: string;
  readonly originActivityId?: string;
  /** Commit version at which this Status was applied or refreshed. */
  readonly appliedCommitVersion: number;
  /** Last successful Encounter roundEnd commit which advanced this Status. */
  readonly lastTriggeredCommitVersion: number | null;
}

/** Effect-program trace for applying or refreshing one Status instance. */
export interface MapEffectStatusApplyTraceEntry extends MapEffectTraceBase {
  readonly op: 'statusApply';
  readonly source: MapEffectProgramSourceIdentity;
  readonly identity: MapEffectActorIdentity;
  readonly statusId: string;
  readonly requestedStacks: number;
  readonly beforeStacks: number;
  readonly afterStacks: number;
  readonly beforeRemainingRounds: number | null;
  readonly afterRemainingRounds: number;
  readonly beforeAppliedRound: number | null;
  readonly beforeLastTriggeredRound: number | null;
  readonly appliedRound: number;
  readonly lastTriggeredRound: number | null;
}

/** Evidence for clearing every matching Status instance from one resolved holder. */
export interface MapEffectStatusRemoveTraceEntry extends MapEffectTraceBase {
  readonly op: 'statusRemove';
  readonly identity: MapEffectActorIdentity;
  readonly statusId: string;
  readonly removed: readonly {
    /** Position in the detached active list immediately before this statement ran. */
    readonly statusIndexBefore: number;
    readonly status: MapEncounterStatusInstance;
  }[];
}

/** Evidence for clearing every active Status in one Map-local category from one resolved holder. */
export interface MapEffectStatusCategoryRemoveTraceEntry extends MapEffectTraceBase {
  readonly op: 'statusRemoveCategory';
  readonly identity: MapEffectActorIdentity;
  readonly category: 'harmful' | 'beneficial';
  readonly removed: readonly {
    /** Position in the detached active list immediately before this statement ran. */
    readonly statusIndexBefore: number;
    readonly status: MapEncounterStatusInstance;
  }[];
}

/** Evidence for consuming up to a requested number of stacks from one holder's Status instances. */
export interface MapEffectStatusConsumeTraceEntry extends MapEffectTraceBase {
  readonly op: 'statusConsume';
  readonly identity: MapEffectActorIdentity;
  readonly statusId: string;
  readonly requestedStacks: number;
  readonly consumedStacks: number;
  readonly unmetStacks: number;
  readonly changes: readonly {
    /** Position in the detached active list immediately before this statement ran. */
    readonly statusIndexBefore: number;
    readonly statusBefore: MapEncounterStatusInstance;
    readonly consumedStacks: number;
    readonly statusAfter: MapEncounterStatusInstance | null;
  }[];
}

/** Evidence for restoring a fixed HP amount to a downed Party Character. */
export interface MapEffectReviveTraceEntry extends MapEffectTraceBase {
  readonly op: 'revive';
  readonly identity: MapEffectActorIdentity;
  readonly requestedHp: number;
  readonly restoredHp: number;
  readonly beforeHp: number;
  readonly afterHp: number;
  readonly outcome: 'revived' | 'alreadyAlive';
}

/** Receipt evidence for one deterministic round-end Status transition. */
export interface MapEncounterStatusTickTraceEntry {
  readonly kind: 'roundEnd';
  readonly round: number;
  readonly holder: MapEffectActorIdentity;
  readonly statusId: string;
  readonly source: MapEffectProgramSourceIdentity;
  readonly actionId: string;
  readonly statusKind: GameplayMapStatusDef['kind'];
  /** Position before this transition, used to reverse and replay the exact active list. */
  readonly statusIndexBefore: number;
  readonly statusBefore: MapEncounterStatusInstance;
  readonly statusAfter: MapEncounterStatusInstance | null;
  readonly stacks: number;
  readonly appliedRound: number;
  readonly lastTriggeredRoundBefore: number | null;
  readonly lastTriggeredRoundAfter: number;
  readonly remainingRoundsBefore: number;
  readonly remainingRoundsAfter: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
  readonly hpDelta: number;
  readonly removed: boolean;
}

/** Receipt evidence for a MapRun-lifetime Status transition at an Encounter round end. */
export interface MapRunStatusTickTraceEntry {
  readonly kind: 'mapRunRoundEnd';
  readonly round: number;
  readonly commitVersion: number;
  readonly holder: MapEffectActorIdentity;
  readonly statusId: string;
  readonly source: MapEffectProgramSourceIdentity;
  readonly actionId: string;
  readonly statusKind: GameplayMapStatusDef['kind'];
  /** Position before the transition in the MapRun Status ledger. */
  readonly statusIndexBefore: number;
  readonly statusBefore: MapRunStatusInstance;
  readonly statusAfter: MapRunStatusInstance | null;
  readonly stacks: number;
  readonly appliedCommitVersion: number;
  readonly lastTriggeredCommitVersionBefore: number | null;
  readonly lastTriggeredCommitVersionAfter: number;
  readonly remainingRoundsBefore: number;
  readonly remainingRoundsAfter: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
  readonly hpDelta: number;
  readonly removed: boolean;
}

export type MapEffectStatusTickTraceEntry = MapEncounterStatusTickTraceEntry | MapRunStatusTickTraceEntry;

/** Per-hit evidence for fixed incoming damage reductions contributed by active Status instances. */
export interface MapEffectDamageReductionTrace {
  /** Total amount removed from the damage request before Shield absorption. */
  readonly total: number;
  /** Contributing instances in the active Status array order; each row records its actual contribution. */
  readonly sources: readonly {
    readonly statusId: string;
    readonly source: MapEffectProgramSourceIdentity;
    readonly actionId: string;
    readonly stacks: number;
    readonly damageReductionPerStack: number;
    readonly reducedAmount: number;
  }[];
}

/** Per-hit evidence for a one-stack damageProtection Status intercept. */
export interface MapEffectDamageProtectionTrace {
  readonly statusIndexBefore: number;
  readonly requestedAmount: number;
  readonly blockedAmount: number;
  readonly statusBefore: MapEncounterStatusInstance;
  readonly statusAfter: MapEncounterStatusInstance | null;
}

/** Common evidence for one bounded AG-1 result Trigger activation. */
interface MapEffectTriggerTraceBase {
  /** One-based position across the current Commit's FIFO Trigger activations. */
  readonly queueIndex: number;
  readonly triggerId: string;
  readonly sourceKey: string;
  readonly actionId: string;
  /** Trigger resourceChange statement path. */
  readonly path: string;
  /** Zero-based AG-1 source execution index which produced the Heal event. */
  readonly parentExecutionIndex: number;
  /** Effect statement path which produced this result event. */
  readonly eventPath: string;
  readonly requestedAmount: number;
  readonly actualAppliedAmount: number;
  readonly resourceId: string;
  readonly delta: number;
}

/** U23/U24 legacy event evidence; the event target also receives the resource. */
export type MapEffectTriggerTraceEntry = MapEffectTriggerTraceBase & (
  | {
    readonly event: 'healApplied' | 'damageApplied';
    readonly target: MapEffectActorIdentity;
  }
  | {
    readonly event: 'enemyDefeated';
    readonly target: { readonly kind: 'enemy'; readonly id: string };
    /** Distinct from the Enemy target: this Party Actor receives the reward. */
    readonly rewardRecipient: { readonly kind: 'partyCharacter'; readonly id: string };
  }
);

/** Independent round-end reaction to one naturally expired Status instance. */
export interface MapEffectStatusExpiryTriggerTraceEntry {
  /** One-based position shared with Action Trigger activations in the current Commit. */
  readonly queueIndex: number;
  readonly event: 'statusExpired';
  /** Zero-based position in this Commit's deterministic Status round-end trace. */
  readonly statusTraceIndex: number;
  readonly round: number;
  /** Exact instance before its final tick/removal; this is application provenance, not a parent Action. */
  readonly status: MapEncounterStatusInstance | MapRunStatusInstance;
  readonly holder: MapEffectActorIdentity;
  readonly resourceId: string;
  readonly delta: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
}

/** One holder reward caused by a direct Hit that actually removed HP. */
export interface MapEffectStatusDamageTriggerTraceEntry {
  readonly queueIndex: number;
  readonly event: 'statusDamageTaken';
  readonly sourceKey: string;
  readonly actionId: string;
  readonly path: string;
  readonly parentExecutionIndex: number;
  readonly hitPath: string;
  readonly requestedAmount: number;
  readonly actualAppliedAmount: number;
  readonly status: MapEncounterStatusInstance | MapRunStatusInstance;
  readonly holder: MapEffectActorIdentity;
  readonly resourceId: string;
  readonly delta: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
}

/** MapRun Receipt-facing alias for the versioned round-end Status trace row. */
export type MapEncounterStatusTraceEntry = MapEncounterStatusTickTraceEntry;

/** Versioned, independently replayable Status round-end evidence on a Commit Receipt. */
export interface MapEffectStatusReceiptTrace {
  readonly statusReceiptVersion: 1;
  readonly statusTrace: readonly MapEffectStatusTickTraceEntry[];
}

export interface MapEffectHpState {
  readonly current: number;
  readonly cap: number;
}

/** Encounter-local aggregate Shield balances keyed by canonical Actor identity. */
export type MapEffectShieldLedger = Readonly<Record<string, number>>;

/** Independent evidence for Shield grants and per-hit damage absorption. */
export type MapEffectShieldTraceEntry = MapEffectTraceBase & (
  | {
    readonly op: 'shieldAdd';
    readonly identity: MapEffectActorIdentity;
    readonly requestedAmount: number;
    readonly shieldBefore: number;
    readonly added: number;
    readonly shieldAfter: number;
    readonly outcome: 'applied' | 'notApplied/defeated';
  }
  | {
    readonly op: 'damage';
    readonly identity: MapEffectActorIdentity;
    readonly requestedAmount: number;
    readonly shieldBefore: number;
    readonly absorbed: number;
    readonly shieldAfter: number;
    readonly remainingDamage: number;
    readonly hpBefore: number;
    readonly hpAfter: number;
  }
);

export interface MapEffectCounterState {
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

/** Detached values and declaration bounds supplied by the authoritative planner. */
export interface MapEffectLocalsState {
  readonly counters: Readonly<Record<string, MapEffectCounterState>>;
  readonly flags: Readonly<Record<string, boolean>>;
}

/** Current bounded MapRun Facts paired with the declaration that supplies Counter bounds. */
export interface MapEffectMapRunFactsState {
  readonly counters: readonly { readonly id: string; readonly value: number }[];
  readonly flags: readonly { readonly id: string; readonly value: boolean }[];
}

export interface MapEffectMapRunFactsInput {
  readonly declarations: GameplayMapRunFactsDef;
  readonly state: MapEffectMapRunFactsState;
}

/** Source-start resource balances. Actor keys use `${kind}:${id}`. */
export interface MapEffectResourceBalanceSnapshot {
  readonly actors: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly teams: Readonly<Record<'party' | 'enemy', Readonly<Record<string, number>>>>;
}

/** One real Party Action selected before a round begins; visual card copies are not separate sources. */
export interface MapEffectPreparedPartyTagSource {
  readonly characterId: string;
  readonly actionId: string;
  readonly origin: 'hand' | 'playerCommand';
  readonly tags: readonly TagRef[];
}

export type MapEffectVisitKind = 'statement' | 'condition' | 'prepare';

/** The outer round planner owns the only dynamic budget counter. */
export interface MapEffectVisit {
  readonly sourceKey: string;
  readonly actionId: string;
  readonly path: string;
  readonly kind: MapEffectVisitKind;
}

export interface MapEffectSourceInput {
  readonly sourceKey: string;
  readonly actionId: string;
  readonly source: MapEffectActorIdentity | null;
  readonly primary: MapEffectActorIdentity | null;
  /** Explicitly selected, queue-locked secondary unit identity. */
  readonly additionalTarget?: MapEffectActorIdentity | null;
  readonly sourceTeam: MapEffectTeamIdentity;
  /** Frozen once from the effective Party Prepared Actions before any source is planned. */
  readonly preparedPartyTagSources: readonly MapEffectPreparedPartyTagSource[];
  /** Concrete program source; present even for actorless Ability and Item sources. */
  readonly sourceIdentity?: MapEffectProgramSourceIdentity;
  /** Static Status rules from the owning Gameplay Map. */
  readonly statusDefinitions?: readonly GameplayMapStatusDef[];
  /** Detached Encounter-local Status instances before this source is planned. */
  readonly statuses?: readonly MapEncounterStatusInstance[];
  /** Optional detached Encounter Shield pools; omitted for pre-Shield plans. */
  readonly shields?: MapEffectShieldLedger;
  readonly hp: Readonly<Record<string, MapEffectHpState>>;
  readonly locals: MapEffectLocalsState;
  /** Detached MapRun-root Facts and their author declarations; absent when the Map has none. */
  readonly mapRunFacts?: MapEffectMapRunFactsInput;
  /** Frozen source-start balances; the Planner records intent but never changes this snapshot. */
  readonly resourceBalances?: MapEffectResourceBalanceSnapshot;
  /** Detached Effect Random state; independent from Hand RNG and not installed by this Planner. */
  readonly effectRandomState?: MapEffectRandomState;
  readonly round?: number;
  /** Fixed domain order used for deterministic TargetSet expansion. */
  readonly targetOrder?: { readonly party: readonly string[]; readonly enemy: readonly string[] };
}

export interface MapEffectTraceBase {
  readonly sourceKey: string;
  readonly actionId: string;
  readonly path: string;
  readonly op: string;
  /** Present on the authoritative MapRun trace; absent on raw pure plans. */
  readonly source?: MapEffectProgramSourceIdentity;
  readonly mode?: 'program';
  readonly identity?: MapEffectTraceIdentity;
}

export type MapEffectTraceEntry =
  | MapEffectReviveTraceEntry
  | MapEffectStatusApplyTraceEntry
  | MapEffectStatusRemoveTraceEntry
  | MapEffectStatusCategoryRemoveTraceEntry
  | MapEffectStatusConsumeTraceEntry
  | (MapEffectTraceBase & {
    readonly op: 'damage' | 'heal';
    readonly before: number;
    readonly after: number;
    /** Requested positive amount, before HP clamping. */
    readonly amount: number;
    readonly requestedAmount?: number;
    readonly modifierDelta?: number;
    readonly modifiedRequestedAmount?: number;
    readonly modifierSourceKey?: string;
    readonly modifierActionId?: string;
    /** Present only when active damageReduction Statuses reduce this damage hit. */
    readonly damageReduction?: MapEffectDamageReductionTrace;
    /** Present only when one damageProtection stack fully intercepts this positive hit. */
    readonly damageProtection?: MapEffectDamageProtectionTrace;
    /** Actual signed HP delta after clamping; zero is retained as evidence. */
    readonly delta: number;
    /** Present only for E2 target-set / expression / repeat execution. */
    readonly batch?: { readonly targetIndex: number; readonly hitIndex: number; readonly targetCount: number; readonly repeatCount: number };
  })
  | (MapEffectTraceBase & {
    readonly op: 'targetSet';
    readonly selection: 'primary' | 'set';
    readonly selector: GameplayMapEffectTargetSetDef | null;
    readonly identities: readonly MapEffectActorIdentity[];
    readonly repeatCount: number;
    readonly random?: MapEffectRandomTrace;
  })
  | (MapEffectTraceBase & {
    readonly op: 'forTargets';
    readonly selector: GameplayMapEffectTargetSetDef;
    /** Complete fixed candidate list resolved once when the loop is reached. */
    readonly identities: readonly MapEffectActorIdentity[];
    readonly random?: MapEffectRandomTrace;
  })
  | (MapEffectTraceBase & {
    readonly op: 'forTarget';
    readonly selectorPath: string;
    readonly iterationIndex: number;
    readonly targetCount: number;
    readonly identity: MapEffectActorIdentity;
  })
  | (MapEffectTraceBase & {
    readonly op: 'hpChange';
    readonly before: number;
    readonly after: number;
    readonly delta: number;
  })
  | (MapEffectTraceBase & {
    readonly op: 'counterAdd';
    readonly identity: { readonly kind: 'encounterLocal' };
    readonly counterId: string;
    readonly before: number;
    readonly after: number;
    readonly delta: number;
  })
  | (MapEffectTraceBase & {
    readonly op: 'flagSet';
    readonly identity: { readonly kind: 'encounterLocal' };
    readonly flagId: string;
    readonly before: boolean;
    readonly after: boolean;
  })
  | (MapEffectTraceBase & {
    readonly op: 'mapRunCounterAdd';
    readonly counterId: string;
    readonly before: number;
    readonly after: number;
    /** Actual change after saturation; requestedDelta retains the author operation. */
    readonly delta: number;
    readonly requestedDelta: number;
  })
  | (MapEffectTraceBase & {
    readonly op: 'mapRunFlagSet';
    readonly flagId: string;
    readonly before: boolean;
    readonly after: boolean;
  })
  | (MapEffectTraceBase & {
    readonly op: 'resourceChange';
    readonly resourceId: string;
    readonly delta: number;
  })
  | (MapEffectTraceBase & {
    /** An actual resource effect applied after C3 cost preflight. */
    readonly op: 'resourceSettlement';
    readonly identity: MapEffectAccountIdentity;
    readonly account: GameplayMapEffectWriteAccount;
    readonly resourceId: string;
    readonly intentDelta: number;
    readonly before: number;
    readonly after: number;
    readonly delta: number;
  })
  | (MapEffectTraceBase & {
    readonly op: 'discountSCost';
    readonly mode: 'program';
    readonly targetCard: import('./map-cards').MapRunCardRef;
    readonly receiver: MapEffectActorIdentity | null;
    readonly amount: number;
  })
  | (MapEffectTraceBase & { readonly op: 'cardEffectModifier'; readonly delta: number })
  | (MapEffectTraceBase & {
    readonly op: 'when';
    readonly result: boolean;
    readonly reads: readonly MapEffectGuardRead[];
  });

export type MapEffectGuardRead =
  | { readonly path: string; readonly op: 'hpAtLeast' | 'hpAtMost'; readonly identity: MapEffectActorIdentity; readonly current: number; readonly value: number; readonly result: boolean }
  | { readonly path: string; readonly op: 'hpRatioAtLeast' | 'hpRatioAtMost'; readonly identity: MapEffectActorIdentity; readonly current: number; readonly cap: number; readonly numerator: number; readonly denominator: number; readonly result: boolean }
  | { readonly path: string; readonly op: 'counter'; readonly identity: { readonly kind: 'encounterLocal' }; readonly counterId: string; readonly current: number; readonly comparison: string; readonly value: number; readonly result: boolean }
  | { readonly path: string; readonly op: 'flag'; readonly identity: { readonly kind: 'encounterLocal' }; readonly flagId: string; readonly current: boolean; readonly value: boolean; readonly result: boolean }
  | { readonly path: string; readonly op: 'mapRunCounter'; readonly counterId: string; readonly current: number; readonly comparison: string; readonly value: number; readonly result: boolean }
  | { readonly path: string; readonly op: 'mapRunFlag'; readonly flagId: string; readonly current: boolean; readonly value: boolean; readonly result: boolean }
  | { readonly path: string; readonly op: 'resourceAtLeast'; readonly account: GameplayMapEffectBalanceAccount; readonly identity: MapEffectAccountIdentity; readonly current: number; readonly value: number; readonly result: boolean }
  | { readonly path: string; readonly op: 'preparedTagCount'; readonly side: 'party'; readonly tag: TagRef; readonly count: number; readonly comparison: string; readonly value: number; readonly result: boolean }
  | { readonly path: string; readonly op: 'all' | 'any' | 'not'; readonly result: boolean };

/** Resource entries describe intent only; the outer settlement fills actual balances/deltas. */
export interface MapEffectResourceLedgerEntry {
  readonly sourceKey: string;
  readonly actionId: string;
  readonly path: string;
  readonly account: GameplayMapEffectWriteAccount;
  readonly identity: MapEffectAccountIdentity;
  readonly resourceId: string;
  /** Effective detached-ledger delta; target-side writes to an already downed unit are zero. */
  readonly delta: number;
  /** Authored resourceChange delta retained separately from the effective delta. */
  readonly intentDelta: number;
}

export interface MapEffectSourcePlan {
  readonly hp: Readonly<Record<string, MapEffectHpState>>;
  readonly locals: MapEffectLocalsState;
  /** Present only when the input Map declared MapRun Facts. */
  readonly plannedMapRunFacts?: MapEffectMapRunFactsState;
  /** Detached next Effect Random state, when one was supplied; Owner decides whether to install it. */
  readonly effectRandomState?: MapEffectRandomState;
  readonly resourceLedger: readonly MapEffectResourceLedgerEntry[];
  /** Modifier declarations emitted by this source; Owner binds these to CardRefs and execution order. */
  readonly cardEffectModifierIntents: readonly MapEffectCardEffectModifierIntent[];
  readonly trace: readonly MapEffectTraceEntry[];
  /** FIFO reactions caused by this source's actual Heal deltas. */
  readonly triggerTrace: readonly MapEffectTriggerTraceEntry[];
  readonly statusDamageTriggerTrace: readonly MapEffectStatusDamageTriggerTraceEntry[];
  /** Encounter-local Status instances after this source's ordered applications. */
  readonly plannedStatuses: readonly MapEncounterStatusInstance[];
  /** Present only when a Shield ledger was supplied; detached ledger after this source. */
  readonly plannedShields?: MapEffectShieldLedger;
  /** Present with a supplied Shield ledger, including when there were no Shield events. */
  readonly shieldTrace?: readonly MapEffectShieldTraceEntry[];
  /** Status-only projection of statusApply entries, independent from round-end statusTrace. */
  readonly statusApplyTrace: readonly MapEffectStatusApplyTraceEntry[];
  /** Status-only projection of every statusRemove statement, including empty no-op visits. */
  readonly statusRemoveTrace: readonly MapEffectStatusRemoveTraceEntry[];
  /** Status-only projection of every statusRemoveCategory statement, including empty no-op visits. */
  readonly statusCategoryRemoveTrace: readonly MapEffectStatusCategoryRemoveTraceEntry[];
  /** Status-only projection of every statusConsume statement, including partial and empty no-op visits. */
  readonly statusConsumeTrace: readonly MapEffectStatusConsumeTraceEntry[];
  readonly prepareDiscounts: NormalizedGameplayMapActionEffects['prepare'];
  readonly expansionCount: number;
}

export interface MapEffectCardEffectModifierIntent {
  readonly sourceKey: string;
  readonly actionId: string;
  readonly path: 'resolve[0].amount';
  readonly delta: number;
}

export interface MapEffectPendingCardEffectModifier {
  readonly sourceKey: string;
  readonly actionId: string;
  readonly delta: number;
}

export interface MapEffectPlannerOptions {
  readonly input: MapEffectSourceInput;
  readonly effects: NormalizedGameplayMapActionEffects;
  /** Provide a phase-sliced legacy list when preserving an existing source phase. */
  readonly instructions?: readonly NormalizedGameplayMapEffectInstruction[];
  /** Throws when the outer planner's shared visit budget cannot admit this access. */
  readonly visit?: (visit: MapEffectVisit) => void;
  /** One Owner-validated pending modifier consumed only by the target's unique amount statement. */
  readonly pendingCardEffectModifier?: MapEffectPendingCardEffectModifier;
  /** Zero-based AG-1 source index used by the separate Trigger receipt evidence. */
  readonly parentExecutionIndex?: number;
  /** One-based commit-wide queue index for this source's first Trigger activation. */
  readonly triggerQueueStart?: number;
  /** Commit-wide remaining Trigger activation budget, capped by the U23 contract at 32. */
  readonly triggerActivationBudget?: number;
}
