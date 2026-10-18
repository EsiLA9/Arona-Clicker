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

/** An explicit target choice when an action has more than one legal target. */
export type MapRunEncounterTargetSelection =
  | { readonly characterId: string; readonly targetCharacterId: string; readonly targetEnemyId?: never }
  | { readonly characterId: string; readonly targetEnemyId: string; readonly targetCharacterId?: never };

/** Explicit target selected by an actorless Encounter source. */
export type MapRunEncounterSourceTarget =
  | { readonly kind: 'partyCharacter'; readonly characterId: string }
  | { readonly kind: 'enemy'; readonly enemyId: string };

/** Encounter-local Ability draft; target can remain pending until Commit validation. */
export interface MapRunEncounterAbilityDraft {
  readonly actionId: string;
  readonly target: MapRunEncounterSourceTarget | null;
}

/** Encounter-local Item draft; actionId is copied from the current Encounter mapping. */
export interface MapRunEncounterItemDraft {
  readonly itemId: string;
  readonly actionId: string;
  readonly target: MapRunEncounterSourceTarget | null;
}

/** Read-only target and source candidate shown for an Encounter-local Player source. */
export interface MapRunEncounterSourceOption {
  readonly actionId: string;
  readonly name: string;
  readonly description: string | null;
  readonly targetKind: 'partyCharacter' | 'enemy';
  readonly legalTargetCharacterIds: readonly string[];
  readonly legalTargetEnemyIds: readonly string[];
  readonly hpEffects: readonly { readonly amount: number }[];
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
  readonly selectedItemId: string | null;
  readonly selectedItemTarget: MapRunEncounterSourceTarget | null;
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
  readonly resourceId: string;
  /** Costs are recorded as negative deltas; effects preserve their signed delta. */
  readonly delta: number;
}

/** One fixed-party member's result in a committed round; null Action means Wait. */
export interface MapRunEncounterActionSettlement {
  readonly characterId: string;
  readonly actionId: string | null;
  readonly targetCharacterId: string | null;
  /** Present only when an Enemy was selected; scoped by the receipt's nodeId. */
  readonly targetEnemyId?: string;
  readonly overrideKind: MapRunActionOverride['kind'] | null;
  readonly playerCostSpent: 0 | 1;
  readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
  /** Actual HP deltas; omitted when no HP effect was declared. */
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
  /** Ability uses retain their source and one PlayerCost independently of Character settlements. */
  readonly ability?: MapRunEncounterSourceSettlement;
  /** Item uses retain the mapped Item and inventory debit independently of Character settlements. */
  readonly item?: MapRunEncounterItemSettlement;
  /** Enemy turn actions in roster order; omitted when no Enemy attacked. */
  readonly enemyAttacks?: readonly { readonly enemyId: string; readonly targetCharacterId: string; readonly damage: number; readonly actualDelta: number }[];
}

/** Actual target and bounded HP changes for one actorless source. */
export interface MapRunEncounterSourceSettlement {
  readonly actionId: string;
  readonly target: MapRunEncounterSourceTarget;
  readonly playerCostSpent: 1;
  readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
  readonly hpChanges: readonly MapRunEncounterHpChange[];
}

/** Actual mapped action, target, and one-item inventory consumption. */
export interface MapRunEncounterItemSettlement {
  readonly itemId: string;
  readonly actionId: string;
  readonly target: MapRunEncounterSourceTarget;
  readonly consumedCount: 1;
  readonly resourceChanges: readonly MapRunEncounterSettlementResourceChange[];
  readonly hpChanges: readonly MapRunEncounterHpChange[];
}

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
}

/** Complete Encounter-local state owned by MapRunService. */
export interface MapRunEncounterSnapshot {
  /** The sole authoritative active Encounter Node ID. */
  readonly nodeId: string;
  /** Present only when the Node declares ordered `activities`. */
  readonly activityId?: string;
  /** Current Encounter round; the initial entry draw is round 1. */
  readonly round: number;
  /** Hands in the same fixed order as the MapRun party. */
  readonly hands: readonly MapRunEncounterHand[];
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
  /** Optimistic-concurrency token for action and target drafts in this round. */
  readonly draftVersion: number;
  /** Raw-word cursor before the latest Hand draw, for checkpoint verification. */
  readonly drawCursorStart: number;
  /** Encounter-local deterministic random state after the latest Hand draw. */
  readonly randomState: MapRunHandRandomState;
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

/** Minimal MapRun state owned by MapRunService. */
export interface MapRun {
  /** Stable identity for commands targeting this run. */
  readonly runId: string;
  /** Static Map definition identity resolved at run start. */
  readonly mapId: string;
  /** Fixed party identities admitted when this MapRun started. */
  readonly party: readonly MapRunPartyMember[];
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
