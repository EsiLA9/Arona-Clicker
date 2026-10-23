import type { MapRunCardRef } from './map-cards';
import type { MapDeclaredEffectSummary } from './map-relations';
import type {
  MapEffectLocalsState,
  MapEncounterStatusInstance,
  MapRunStatusInstance,
  MapEffectStatusTickTraceEntry,
  MapEffectProgramSourceIdentity,
  MapEffectTraceEntry,
  MapEffectStatusRemoveTraceEntry,
  MapEffectStatusConsumeTraceEntry,
  MapEffectStatusExpiryTriggerTraceEntry,
  MapEffectStatusDamageTriggerTraceEntry,
  MapEffectStatusCategoryRemoveTraceEntry,
  MapEffectVisitKind,
  MapEffectRandomState,
  MapEffectShieldLedger,
  MapEffectShieldTraceEntry,
  MapEffectTriggerTraceEntry,
} from './map-effects';

/** One fixed MapRun party member admitted against PlayerState before Run creation. */
export interface MapRunPartyMember {
  readonly characterId: string;
  readonly variantId: string;
}

/** Versioned deterministic stream used only for Gameplay B Encounter Hands. */
export const GAMEPLAY_B_HAND_RNG_ALGORITHM = 'gameplay-b-hand-splitmix64-v1' as const;

export interface MapRunHandRandomState {
  readonly algorithm: typeof GAMEPLAY_B_HAND_RNG_ALGORITHM;
  readonly seed: number;
  /** Number of raw 64-bit words consumed from this Encounter stream. */
  readonly cursor: number;
}

/** One fixed-party member's current Encounter-local Hand in draw order. */
export interface MapRunEncounterHand {
  readonly characterId: string;
  readonly actionIds: readonly string[];
}

/** One Encounter-local Enemy's read-only Hand in roster order. */
export interface MapRunEnemyHand {
  readonly enemyId: string;
  readonly actionIds: readonly string[];
}

/**
 * One player-chosen Encounter action override for the current round.
 * At most one entry exists per Character; an Action equal to the Character's
 * natural Hand-first Action never produces an entry.
 */
export interface MapRunActionOverride {
  readonly kind: 'swap' | 'playerCommand';
  readonly characterId: string;
  readonly actionId: string;
}

/** An explicit player target choice, including the current default or a sole legal target. */
export type MapRunEncounterTargetSelection =
  | { readonly characterId: string; readonly targetCharacterId: string; readonly targetEnemyId?: never; readonly targetCard?: never; readonly additionalTargetCharacterId?: string; readonly additionalTargetEnemyId?: string }
  | { readonly characterId: string; readonly targetEnemyId: string; readonly targetCharacterId?: never; readonly targetCard?: never; readonly additionalTargetCharacterId?: string; readonly additionalTargetEnemyId?: string }
  | { readonly characterId: string; readonly targetCard: MapRunCardRef; readonly targetCharacterId?: never; readonly targetEnemyId?: never; readonly additionalTargetCharacterId?: never; readonly additionalTargetEnemyId?: never };

/** Explicit target selected by an actorless Encounter source. */
export type MapRunEncounterSourceTarget =
  | { readonly kind: 'partyCharacter'; readonly characterId: string }
  | { readonly kind: 'enemy'; readonly enemyId: string };

/** Encounter-local Ability draft; target can remain pending until Commit validation. */
export interface MapRunEncounterAbilityDraft {
  readonly actionId: string;
  readonly target: MapRunEncounterSourceTarget | null;
  readonly additionalTarget: MapRunEncounterSourceTarget | null;
}

/** Encounter-local Item draft; actionId is copied from the current Encounter mapping. */
export interface MapRunEncounterItemDraft {
  readonly itemId: string;
  readonly actionId: string;
  readonly target: MapRunEncounterSourceTarget | null;
  readonly additionalTarget: MapRunEncounterSourceTarget | null;
}

/** Read-only target and source candidate shown for an Encounter-local Player source. */
export interface MapRunEncounterSourceOption {
  readonly actionId: string;
  readonly name: string;
  readonly description: string | null;
  readonly targetKind: 'partyCharacter' | 'enemy';
  readonly legalTargetCharacterIds: readonly string[];
  readonly legalTargetEnemyIds: readonly string[];
  readonly additionalTargetKind?: 'partyCharacter' | 'enemy';
  readonly legalAdditionalTargetCharacterIds?: readonly string[];
  readonly legalAdditionalTargetEnemyIds?: readonly string[];
  readonly additionalTargetSelectionRequired?: boolean;
  /** E1 declarations resolved for the candidate's selected primary, when known. */
  readonly declaredEffects?: readonly MapDeclaredEffectSummary[];
}

export interface MapRunEncounterAbilityOption extends MapRunEncounterSourceOption {
  readonly canPayPlayerCost: boolean;
  readonly selected: boolean;
}

export interface MapRunEncounterItemOption extends MapRunEncounterSourceOption {
  readonly itemId: string;
  readonly itemName: string;
  readonly itemDescription: string | null;
  readonly inventoryCount: number;
  readonly useConditionSatisfied: boolean;
  readonly canUse: boolean;
  readonly selected: boolean;
}

/** Detached, current-state candidate view; it never edits the Encounter draft. */
export interface MapRunEncounterSourcePreview {
  readonly nodeId: string;
  readonly round: number;
  readonly draftVersion: number;
  readonly selectedAbilityActionId: string | null;
  readonly selectedAbilityTarget: MapRunEncounterSourceTarget | null;
  readonly selectedAbilityAdditionalTarget: MapRunEncounterSourceTarget | null;
  readonly selectedItemId: string | null;
  readonly selectedItemTarget: MapRunEncounterSourceTarget | null;
  readonly selectedItemAdditionalTarget: MapRunEncounterSourceTarget | null;
  readonly abilityOptions: readonly MapRunEncounterAbilityOption[];
  readonly itemOptions: readonly MapRunEncounterItemOption[];
}

/** Current HP owned by MapRunService for one fixed party member. */
export interface MapRunPartyHp {
  readonly characterId: string;
  readonly currentHp: number;
}

/** Current HP owned by MapRunService for one Enemy in the active Encounter. */
export interface MapRunEnemyHp {
  readonly enemyId: string;
  readonly currentHp: number;
}

/** One Encounter-local resource balance owned by an Enemy Actor. */
export interface MapRunEnemyActorResourceBalance {
  readonly enemyId: string;
  readonly resourceId: string;
  readonly value: number;
}

/** One bounded HP change recorded as the actual applied delta. */
export type MapRunEncounterHpChange =
  | { readonly scope: 'party'; readonly characterId: string; readonly delta: number }
  | { readonly scope: 'enemy'; readonly enemyId: string; readonly delta: number };

/** Identifies a draft within one specific Encounter round and revision. */
export interface MapRunEncounterDraftToken {
  readonly nodeId: string;
  /** Present only for a Node activity; legacy single-Encounter Nodes omit it. */
  readonly activityId?: string;
  readonly round: number;
  readonly draftVersion: number;
}

/** One atomic shop purchase already applied inside the active Shop activity. */
export interface MapRunShopPurchaseReceipt {
  readonly requestId: string;
  readonly offerId: string;
  readonly nodeId: string;
  readonly activityId: string;
  readonly resultingDraftVersion: number;
  readonly costs: readonly { readonly resourceId: string; readonly amount: number }[];
  readonly effects: readonly { readonly resourceId: string; readonly amount: number }[];
  /** Applied HP restoration; null when the offer declares no heal. */
  readonly heal: { readonly characterId: string; readonly amount: number; readonly restored: number } | null;
}

/** The single Node activity currently occupying the MapRun, if any. */
export interface MapRunActiveActivity {
  readonly nodeId: string;
  readonly activityId: string;
  /** Zero-based index inside the owning Node's fixed activity list. */
  readonly index: number;
  /** Derived activity kind for presentation; `encounter` means manual completion. */
  readonly kind: 'battle' | 'rest' | 'encounter' | 'shop';
  /** Shop-local optimistic concurrency version; 0 for non-shop activities. */
  readonly shopDraftVersion: number;
  /** Latest successful Shop purchase in this activity; null outside a Shop or before any purchase. */
  readonly lastPurchase: MapRunShopPurchaseReceipt | null;
}

/** Identifies one Shop draft revision for purchase / leave commands. */
export interface MapRunShopDraftToken {
  readonly nodeId: string;
  readonly activityId: string;
  readonly draftVersion: number;
}

/** One resource charge or effect applied by a successful round Commit. */
export interface MapRunEncounterSettlementResourceChange {
  readonly kind: 'cost' | 'effect';
  readonly scope: 'actor' | 'team';
  /** Present only for an Actor-scoped change. */
  readonly characterId?: string;
  /** Present only for an Enemy Actor-scoped change. */
  readonly enemyId?: string;
  /** Present only for Enemy Team-scoped changes; omitted means the MapRun party Team. */
  readonly teamSide?: 'enemy';
  readonly resourceId: string;
  /** Costs are recorded as negative deltas; effects preserve their signed delta. */
  readonly delta: number;
}

/** One fixed-party member's result in a committed round; null Action means Wait. */
export interface MapRunEncounterActionSettlement {
  readonly characterId: string;
  readonly actionId: string | null;
  readonly targetCharacterId: string | null;
  /** Selected domain card at execution, independently of unit effect recipients. */
  readonly targetCard?: MapRunCardRef;
  /** Actual Actor sCost charge: original amount, applied reduction, and net payment. */
  readonly scostCost?: { readonly original: number; readonly discount: number; readonly paid: number };
  /** Present only when an Enemy was selected; scoped by the receipt's nodeId. */
  readonly targetEnemyId?: string;
  /** Selected secondary unit identity on AG-1, including Actions without secondary writers. */
  readonly additionalTarget?: MapRunEncounterSourceTarget | null;
  /** A prepared Character Action can be skipped when its automatic target has no remaining legal object. */
  readonly skipReason?: 'noLegalTarget';
  readonly overrideKind: MapRunActionOverride['kind'] | null;
  readonly playerCostSpent: 0 | 1;
  readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
  /** Actual HP deltas; omitted when no HP effect was declared. */
  readonly hpChanges?: readonly MapRunEncounterHpChange[];
}

/** One Enemy's automatic action result in Encounter roster order. */
export interface MapRunEncounterEnemyActionSettlement {
  readonly enemyId: string;
  readonly actionId: string | null;
  readonly targetCharacterId?: string;
  readonly targetEnemyId?: string;
  readonly targetCard?: MapRunCardRef;
  readonly scostCost?: { readonly original: number; readonly discount: number; readonly paid: number };
  readonly skipReason?: 'defeated' | 'noLegalTarget' | 'unaffordable' | 'roundEnded';
  readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
  readonly hpChanges?: readonly MapRunEncounterHpChange[];
}

/** Immutable idempotency receipt for the latest successful Commit in an Encounter. */
export interface MapRunEncounterCommitReceipt {
  readonly requestId: string;
  /** MapRun-wide version accepted by this Commit. */
  readonly commandVersion: number;
  readonly resultingCommitVersion: number;
  readonly nodeId: string;
  /** Present only when the receipt belongs to a Node activity scene. */
  readonly activityId?: string;
  readonly round: number;
  readonly draftVersion: number;
  readonly settlements: readonly MapRunEncounterActionSettlement[];
  /** Enemy natural Actions in roster order; omitted when the Encounter has no Enemies. */
  readonly enemyActions?: readonly MapRunEncounterEnemyActionSettlement[];
  /** Ability uses retain their source and one PlayerCost independently of Character settlements. */
  readonly ability?: MapRunEncounterSourceSettlement;
  /** Item uses retain the mapped Item and inventory debit independently of Character settlements. */
  readonly item?: MapRunEncounterItemSettlement;
  /** Effect Program semantics and access log, independent of the scheduler contract. */
  readonly programReceiptVersion?: 1 | 2;
  /** CardRef modifier source/target binding and per-hit evidence (Program Receipt v2 only). */
  readonly cardEffectModifierReceipts?: readonly MapRunCardEffectModifierReceipt[];
  /** Scheduler contract used for this receipt; independent of Effect Program tracing. */
  readonly executionContractId?: 'E1-COMPAT-1' | 'AG-1';
  /** Present on AG-1 receipts, even when no Action uses an Effect Program. */
  readonly schedulerFormatVersion?: 5 | 6 | 7;
  /** Independent Shield evidence, present only on Maps that author shieldAdd. */
  readonly shieldReceiptVersion?: 1;
  readonly shieldStart?: MapEffectShieldLedger;
  readonly plannedShields?: MapEffectShieldLedger;
  readonly shieldTrace?: readonly MapEffectShieldTraceEntry[];
  /** Independent Trigger evidence, present only when this Commit activated a bounded handler. */
  readonly triggerReceiptVersion?: 1 | 2 | 3 | 4;
  readonly triggerTrace?: readonly MapEffectTriggerTraceEntry[];
  /** Present on Trigger Receipt v2/v3; v2 requires expiries while v3 may carry an empty array. */
  readonly statusExpiryTriggerTrace?: readonly MapEffectStatusExpiryTriggerTraceEntry[];
  readonly statusDamageTriggerTrace?: readonly MapEffectStatusDamageTriggerTraceEntry[];
  /** Detached inputs before any cost, source, status tick, Hand draw, or RNG advance in this Commit. */
  readonly schedulerStartSnapshot?: MapRunEncounterSchedulerStartSnapshot;
  /** Outcome and exact scheduler checkpoint at which the Encounter became terminal. */
  readonly schedulerTerminal?: MapRunEncounterSchedulerTerminal;
  /** Full, successful AG-1 source sequence; old settlement groups remain projections. */
  readonly executionSequence?: readonly MapRunEncounterExecutionSequenceEntry[];
  /** Recomputed MapRun-root Fact values after this Commit. */
  readonly plannedMapRunFacts?: MapRunFactState;
  /** Effect RNG state after the AG-1 source queue; start state is in the scheduler snapshot. */
  readonly plannedEffectRandomState?: MapEffectRandomState;
  readonly effectScope?: MapRunEncounterProgramScope;
  readonly programVisitCount?: number;
  readonly programVisits?: readonly MapRunEncounterProgramVisit[];
  readonly plannedLocals?: MapEffectLocalsState;
  /** Program trace from the authoritative full-round planner, when available. */
  readonly effectTrace?: readonly MapEffectTraceEntry[];
  /** Independent versioned evidence for Encounter-local Status application and round-end ticks. */
  readonly statusReceiptVersion?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly plannedStatuses?: readonly MapEncounterStatusInstance[];
  readonly statusTrace?: readonly MapEffectStatusTickTraceEntry[];
  /** Root-owned persistent Status state and round-end transitions; present on v7 receipts. */
  readonly plannedMapRunStatuses?: readonly MapRunStatusInstance[];
  /** Present on version 2 receipts and replayed from the AG-1 scheduler start. */
  readonly statusRemoveTrace?: readonly MapEffectStatusRemoveTraceEntry[];
  /** Present on version 3 receipts and replayed from the AG-1 scheduler start. */
  readonly statusConsumeTrace?: readonly MapEffectStatusConsumeTraceEntry[];
  /** Present on version 4+ receipts and replayed from the AG-1 scheduler start. */
  readonly statusCategoryRemoveTrace?: readonly MapEffectStatusCategoryRemoveTraceEntry[];
}

/** Root scope inherited by every source, visit, and trace in one pure round plan. */
export interface MapRunEncounterProgramScope {
  readonly runId: string;
  readonly mapId: string;
  readonly nodeId: string;
  readonly activityId: string | null;
  readonly round: number;
}

/** One actual D08 visit; its array index is the shared round-local budget position. */
export interface MapRunEncounterProgramVisit {
  readonly sourceKey: string;
  readonly source: MapEffectProgramSourceIdentity;
  readonly actionId: string;
  readonly path: string;
  readonly kind: MapEffectVisitKind;
  readonly mode: 'program';
}

/** Actual target and bounded HP changes for one actorless source. */
export interface MapRunEncounterSourceSettlement {
  readonly actionId: string;
  readonly target: MapRunEncounterSourceTarget;
  /** Selected secondary unit identity on AG-1, including Actions without secondary writers. */
  readonly additionalTarget?: MapRunEncounterSourceTarget | null;
  readonly playerCostSpent: 1;
  readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
  readonly hpChanges: readonly MapRunEncounterHpChange[];
}

/** Actual mapped action, target, and one-item inventory consumption. */
export interface MapRunEncounterItemSettlement {
  readonly itemId: string;
  readonly actionId: string;
  readonly target: MapRunEncounterSourceTarget;
  /** Selected secondary unit identity on AG-1, including Actions without secondary writers. */
  readonly additionalTarget?: MapRunEncounterSourceTarget | null;
  readonly consumedCount: 1;
  readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
  readonly hpChanges: readonly MapRunEncounterHpChange[];
}

/** One selected AG-1 source in actual execution order, including its committed outcome. */
export interface MapRunEncounterExecutionSequenceEntry {
  readonly executionIndex: number;
  readonly sourceKey: string;
  readonly sourceKind: 'partyAction' | 'enemyAction' | 'ability' | 'item';
  readonly owner: { readonly kind: 'partyCharacter' | 'enemy'; readonly id: string } | null;
  readonly actionId: string;
  readonly cardRef: MapRunCardRef | null;
  readonly baseAgility: number;
  readonly actorAgility: number;
  readonly finalAgility: number;
  readonly sideRank: 0 | 1;
  readonly sourceRank: 0 | 1 | 2;
  readonly ownerDeclarationIndex: number;
  readonly logicalIndex: number;
  readonly target: MapRunEncounterExecutionTarget;
  /** Queue-locked secondary identity, independent of whether the Action writes to it. */
  readonly additionalTarget: MapRunEncounterSourceTarget | null;
  readonly skipReason: 'defeated' | 'noLegalTarget' | 'unaffordable' | 'roundEnded' | null;
  readonly playerCostSpent: 0 | 1;
  readonly itemConsumed: boolean;
  readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
  readonly hpChanges: readonly MapRunEncounterHpChange[];
}

export interface MapRunCardEffectModifierReceipt {
  readonly sourceKey: string;
  readonly sourceActionId: string;
  readonly sourceOwnerId: string;
  readonly sourceCardRef: MapRunCardRef;
  readonly sourceExecutionIndex: number;
  readonly targetCardRef: MapRunCardRef;
  readonly targetOwnerId: string;
  readonly targetActionId: string;
  readonly targetExecutionIndex: number;
  readonly path: 'resolve[0].amount';
  readonly delta: number;
  readonly outcome: 'sourceSkipped' | 'notApplied' | 'applied';
  readonly reason?: 'defeated' | 'noLegalTarget' | 'unaffordable' | 'roundEnded';
  readonly hits: readonly {
    readonly op: 'damage' | 'heal';
    readonly identity: { readonly kind: 'partyCharacter' | 'enemy'; readonly id: string };
    readonly requestedAmount: number;
    readonly modifierDelta: number;
    readonly modifiedRequestedAmount: number;
    readonly before: number;
    readonly after: number;
    readonly hpDelta: number;
    readonly batch?: { readonly targetIndex: number; readonly hitIndex: number; readonly targetCount: number; readonly repeatCount: number };
  }[];
}

/** Exact bounded MapRun state needed to recreate an AG-1 planner input without prior receipt history. */
export interface MapRunEncounterSchedulerStartSnapshot {
  readonly runId: string;
  readonly mapId: string;
  readonly party: readonly MapRunPartyMember[];
  readonly partyAgility: readonly { readonly characterId: string; readonly agility: number }[];
  readonly partyHp: readonly MapRunPartyHp[];
  readonly playerCost: number;
  readonly actorResources: readonly MapRunActorResourceBalance[];
  readonly teamResources: readonly MapRunTeamResourceBalance[];
  /** MapRun-root Facts at Commit start; omitted when the Map declares none. */
  readonly mapRunFacts?: MapRunFactState;
  /** MapRun-root persistent Statuses at Commit start; present only for U30 Maps. */
  readonly mapRunStatuses?: readonly MapRunStatusInstance[];
  readonly encounter: {
    readonly nodeId: string;
    readonly activityId?: string;
    readonly round: number;
    readonly hands: readonly MapRunEncounterHand[];
    readonly enemyHands: readonly MapRunEnemyHand[];
    readonly enemyActorResources: readonly MapRunEnemyActorResourceBalance[];
    readonly enemyTeamResources: readonly MapRunTeamResourceBalance[];
    readonly overrides: readonly MapRunActionOverride[];
    readonly targetSelections: readonly MapRunEncounterTargetSelection[];
    readonly abilityDraft: MapRunEncounterAbilityDraft | null;
    readonly itemDraft: MapRunEncounterItemDraft | null;
    readonly enemies: readonly MapRunEnemyHp[];
    readonly enemyAgility: readonly { readonly enemyId: string; readonly agility: number }[];
    readonly draftVersion: number;
    readonly drawCursorStart: number;
    readonly randomState: MapRunHandRandomState;
    readonly effectRandomState: MapEffectRandomState;
    readonly locals: MapEffectLocalsState;
    readonly statuses: readonly MapEncounterStatusInstance[];
    /** Present only for scheduler v6 Shield Maps. */
    readonly shields?: MapEffectShieldLedger;
    /** Frozen candidate gate input for this Encounter; omitted when the Map has no gated Pool. */
    readonly candidateSourceSnapshot?: MapRunCandidateSourceSnapshot;
  };
}

/** Terminal evidence for the exact point in an AG-1 Commit at which no later source may execute. */
export type MapRunEncounterSchedulerTerminal =
  | { readonly outcome: 'none'; readonly checkpoint: null }
  | { readonly outcome: 'failure' | 'victory'; readonly checkpoint: 'commitStart' | 'afterStatusRoundEnd' | 'afterNonBattleCompletion' }
  | { readonly outcome: 'failure' | 'victory'; readonly checkpoint: 'afterSource'; readonly executionIndex: number };

export type MapRunEncounterExecutionTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'partyCharacter'; readonly characterId: string }
  | { readonly kind: 'enemy'; readonly enemyId: string }
  | { readonly kind: 'card'; readonly cardRef: MapRunCardRef | null };

/** Full-round Commit request tied to both the MapRun and U3 Encounter draft versions. */
export interface MapRunEncounterCommitCommand {
  readonly runId: string;
  readonly requestId: string;
  readonly expectedCommitVersion: number;
  readonly draft: MapRunEncounterDraftToken;
}

/** Read-only result of validating the current full-round Commit against starting balances. */
export interface MapRunEncounterCommitPreview {
  readonly nodeId: string;
  /** Present only for a Node activity scene. */
  readonly activityId?: string;
  readonly round: number;
  readonly draftVersion: number;
  readonly canCommit: boolean;
  readonly playerCostRequired: number | null;
  readonly diagnostics: readonly string[];
  readonly settlements: readonly MapRunEncounterActionSettlement[] | null;
  /** Enemy actions from the same pure full-round settlement plan. */
  readonly enemyActions: readonly MapRunEncounterEnemyActionSettlement[] | null;
  /** Program metadata and result, present only when this plan reached Program effects. */
  readonly programReceiptVersion?: 1 | 2;
  readonly executionContractId?: 'E1-COMPAT-1' | 'AG-1';
  readonly schedulerFormatVersion?: 5 | 6 | 7;
  readonly shieldReceiptVersion?: 1;
  readonly shieldStart?: MapEffectShieldLedger;
  readonly plannedShields?: MapEffectShieldLedger;
  readonly shieldTrace?: readonly MapEffectShieldTraceEntry[];
  readonly triggerReceiptVersion?: 1 | 2 | 3 | 4;
  readonly triggerTrace?: readonly MapEffectTriggerTraceEntry[];
  readonly statusExpiryTriggerTrace?: readonly MapEffectStatusExpiryTriggerTraceEntry[];
  readonly statusDamageTriggerTrace?: readonly MapEffectStatusDamageTriggerTraceEntry[];
  readonly schedulerTerminal?: MapRunEncounterSchedulerTerminal;
  readonly executionSequence?: readonly MapRunEncounterExecutionSequenceEntry[];
  readonly plannedMapRunFacts?: MapRunFactState;
  readonly plannedEffectRandomState?: MapEffectRandomState;
  readonly effectScope?: MapRunEncounterProgramScope;
  readonly programVisitCount?: number;
  readonly programVisits?: readonly MapRunEncounterProgramVisit[];
  readonly plannedLocals?: MapEffectLocalsState;
  /** Program trace from the authoritative full-round planner, when available. */
  readonly effectTrace?: readonly MapEffectTraceEntry[];
  /** Independent versioned evidence for Encounter-local Status application and round-end ticks. */
  readonly statusReceiptVersion?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  readonly plannedStatuses?: readonly MapEncounterStatusInstance[];
  readonly statusTrace?: readonly MapEffectStatusTickTraceEntry[];
  readonly plannedMapRunStatuses?: readonly MapRunStatusInstance[];
  readonly statusRemoveTrace?: readonly MapEffectStatusRemoveTraceEntry[];
  readonly statusConsumeTrace?: readonly MapEffectStatusConsumeTraceEntry[];
  readonly statusCategoryRemoveTrace?: readonly MapEffectStatusCategoryRemoveTraceEntry[];
}

/** Complete Encounter-local state owned by MapRunService. */
export interface MapRunEncounterSnapshot {
  /** The sole authoritative active Encounter Node ID. */
  readonly nodeId: string;
  /** Encounter-local bounded Counter and Flag values owned for this Encounter. */
  readonly locals?: MapEffectLocalsState;
  /** Active Map-local unit Statuses, scoped to this Encounter. Missing means empty for legacy checkpoints. */
  readonly statuses?: readonly MapEncounterStatusInstance[];
  /** Encounter-local aggregate Shield pools; present on Maps that author shieldAdd. */
  readonly shields?: MapEffectShieldLedger;
  /** Present only when the Node declares ordered `activities`. */
  readonly activityId?: string;
  /** Current Encounter round; the initial entry draw is round 1. */
  readonly round: number;
  /** Hands in the same fixed order as the MapRun party. */
  readonly hands: readonly MapRunEncounterHand[];
  /** Enemy Hands in the same fixed order as the Encounter Enemy roster. */
  readonly enemyHands: readonly MapRunEnemyHand[];
  /** Encounter-local balances owned by each Enemy Actor. */
  readonly enemyActorResources: readonly MapRunEnemyActorResourceBalance[];
  /** Encounter-local shared balances available to the Enemy team. */
  readonly enemyTeamResources: readonly MapRunTeamResourceBalance[];
  /** Hand[0] is the natural Prepared Action; Wait is represented by an empty Hand. */
  /**
   * Action overrides in fixed-party order, at most one per Character.
   * A Character whose override resolves to its natural Action keeps no entry.
   */
  readonly overrides: readonly MapRunActionOverride[];
  /** Explicit player choices for targets that do not have one unique default. */
  readonly targetSelections: readonly MapRunEncounterTargetSelection[];
  /** Optional for legacy checkpoints; new snapshots materialize null when unset. */
  readonly abilityDraft?: MapRunEncounterAbilityDraft | null;
  /** Optional for legacy checkpoints; new snapshots materialize null when unset. */
  readonly itemDraft?: MapRunEncounterItemDraft | null;
  /** Encounter-local Enemy IDs and current HP in definition order. */
  readonly enemies: readonly MapRunEnemyHp[];
  /** Frozen AG-1 Enemy agility supplements in Encounter definition order. */
  readonly enemyAgility?: readonly { readonly enemyId: string; readonly agility: number }[];
  /** Optimistic-concurrency token for action and target drafts in this round. */
  readonly draftVersion: number;
  /** Raw-word cursor before the latest Hand draw, for checkpoint verification. */
  readonly drawCursorStart: number;
  /** Encounter-local deterministic random state after the latest Hand draw. */
  readonly randomState: MapRunHandRandomState;
  /** Encounter-local Effect RNG, independent from the Hand stream. Present on AG-1 Encounter snapshots. */
  readonly effectRandomState?: MapEffectRandomState;
  /** Frozen MapRun Facts used to resolve gated candidate Pools for this Encounter. */
  readonly candidateSourceSnapshot?: MapRunCandidateSourceSnapshot;
  /** Latest successful Encounter-local settlement, retained for retry deduplication. */
  readonly lastCommit: MapRunEncounterCommitReceipt | null;
}

/** One MapRun-local resource balance for a fixed party member. */
export interface MapRunActorResourceBalance {
  readonly characterId: string;
  readonly resourceId: string;
  readonly value: number;
}

/** One shared MapRun-local resource balance. */
export interface MapRunTeamResourceBalance {
  readonly resourceId: string;
  readonly value: number;
}

/** Current MapRun-local values for the bounded facts declared by its Map. */
export interface MapRunFactState {
  readonly counters: readonly { readonly id: string; readonly value: number }[];
  readonly flags: readonly { readonly id: string; readonly value: boolean }[];
}

/** Versioned candidate authorization input, owned by an Encounter and never mutated by Effects. */
export interface MapRunCandidateSourceSnapshot {
  readonly formatVersion: 1;
  readonly mapRunFacts: MapRunFactState;
}

/** Minimal MapRun state owned by MapRunService. */
export interface MapRun {
  /** Stable identity for commands targeting this run. */
  readonly runId: string;
  /** Static Map definition identity resolved at run start. */
  readonly mapId: string;
  /** Fixed party identities admitted when this MapRun started. */
  readonly party: readonly MapRunPartyMember[];
  /** Frozen AG-1 party agility supplements in fixed Map party order. */
  readonly partyAgility?: readonly { readonly characterId: string; readonly agility: number }[];
  /** MapRun-local current HP in fixed party order; persists across Encounters. */
  readonly partyHp: readonly MapRunPartyHp[];
  /** Latest successful Encounter receipt survives Encounter cleanup and movement. */
  readonly lastEncounterCommit: MapRunEncounterCommitReceipt | null;
  /** Current MapRun-local PlayerCost balance. */
  readonly playerCost: number;
  /** Monotonic successful Commit version for this MapRun, including across Encounters. */
  readonly commitVersion: number;
  /** Explicit and default-zero Actor resource balances local to this MapRun. */
  readonly actorResources: readonly MapRunActorResourceBalance[];
  /** Explicit and default-zero Team resource balances local to this MapRun. */
  readonly teamResources: readonly MapRunTeamResourceBalance[];
  /** Present only when the Map declares MapRun-local Facts. */
  readonly mapRunFacts?: MapRunFactState;
  /** Present only when the Map declares MapRun-lifetime Statuses. */
  readonly mapRunStatuses?: readonly MapRunStatusInstance[];
  /** Exit arrival ends a run once no Encounter is blocking completion. */
  readonly status: 'inProgress' | 'success' | 'failure';
  /** The single authoritative current position in the Map. */
  readonly currentNodeId: string;
  /** Local Node IDs visited by this run, in visit order without duplicates. */
  readonly visitedNodeIds: readonly string[];
  /** Local Node IDs whose Encounter or full activity sequence was completed. */
  readonly completedEncounterNodeIds: readonly string[];
  /**
   * Completed Node activity identities as `${nodeId}/${activityId}`. Only Nodes
   * that declare ordered `activities` contribute entries.
   */
  readonly completedActivityIds: readonly string[];
  /**
   * The single Node activity currently in progress. Present for ordered
   * activity Nodes including Shops; null for legacy single-Encounter Nodes.
   */
  readonly activeActivity: MapRunActiveActivity | null;
  /** Full Encounter-local state; null outside an active Encounter. */
  readonly activeEncounter: MapRunEncounterSnapshot | null;
  /**
   * Read-only compatibility view derived from activeEncounter.nodeId. Snapshot
   * objects expose it as a non-enumerable getter so it is never separately saved.
   */
  readonly activeEncounterNodeId: string | null;
}

/** Minimal display result retained after a successful MapRun has been cleared. */
export interface MapRunSuccessResult {
  readonly runId: string;
  readonly mapId: string;
  readonly outcome: 'success';
  readonly exitNodeId: string;
  readonly mapName: string;
  readonly exitNodeTitle: string;
}

/** Runtime-only failure summary. It is never included in a Save snapshot. */
export interface MapRunFailureResult {
  readonly runId: string;
  readonly mapId: string;
  readonly outcome: 'failure';
  readonly failedNodeId: string;
  readonly reason: 'partyDefeated';
}

/** Owner-private checkpoint for resuming one active MapRun against current content. */
export interface MapRunSaveSnapshot {
  readonly mapId: string;
  readonly resumeVersion: number;
  readonly run: MapRun;
}

export type MapRunRestoreFailureReason =
  | 'invalid-snapshot'
  | 'unknown-map'
  | 'content-version-mismatch'
  | 'invalid-content'
  | 'invalid-run'
  | 'owner-not-empty';

/** Transient restore result; rejection is surfaced through the existing DevLog. */
export type MapRunRestoreResult =
  | { readonly status: 'none' }
  | { readonly status: 'restored'; readonly mapId: string; readonly runId: string }
  | { readonly status: 'failed'; readonly mapId: string; readonly runId: string; readonly reason: 'partyDefeated' }
  | {
    readonly status: 'rejected';
    readonly mapId: string | null;
    readonly reason: MapRunRestoreFailureReason;
    readonly diagnostics: readonly string[];
  };
