import type { Character } from '../../engine/types/ids';
import type { TagRef } from '../../engine/core/tag';
import type { GameplayMapEffectProgramDef, GameplayMapEncounterLocalsDef, GameplayMapEffectConditionDef } from './gameplay-map-effects';

/** Static Gameplay B map content. Node, edge, and action IDs are local to this map. */
export interface GameplayMapDef {
  /** Stable three-part Datapack identity using the `map` entity type. */
  readonly id: string;
  /** Player-facing map name. */
  readonly name: string;
  /** Optional plain-text information shown before starting or resuming this map. */
  readonly entryInfo?: {
    /** Short map introduction; this field is presentation-only. */
    readonly description?: string;
    /** Short author-written hints; these do not affect map rules. */
    readonly tips?: readonly string[];
  };
  /**
   * Author-maintained compatibility version for MapRun resume. Raise this when
   * changing any action, encounter participant, tendency, target, cost, effect,
   * MapRun Fact, candidate Pool or Edge gate, initial HP, or initial resource
   * rule that can affect an active run.
   */
  readonly resumeVersion: number;
  /** Selects the MapRun source scheduling / payment contract; omitted Maps retain E1 compatibility. */
  readonly executionContractId?: GameplayMapExecutionContractId;
  /** Local ID of the node where a new MapRun begins. */
  readonly startNodeId: string;
  /** Local IDs of nodes that end the MapRun when reached. */
  readonly exitNodeIds: readonly string[];
  /** Fixed Character IDs admitted to every Encounter in a new MapRun. */
  readonly partyCharacterIds: readonly Character[];
  /** Explicit MapRun-local starting HP and cap for every fixed party member. */
  readonly initialPartyHp: readonly GameplayMapInitialPartyHpDef[];
  /** Optional frozen AG-1 Character agility supplements; omitted party members contribute zero. */
  readonly partyAgility?: readonly GameplayMapPartyAgilityDef[];
  /** Explicit PlayerCost balance assigned when a new MapRun starts. */
  readonly initialPlayerCost: number;
  /**
   * Optional MapRun-local facts initialized for each new run and retained
   * across Encounters and Nodes. They may gate static candidate Pools and
   * Edges, but do not affect Encounter locals or external AC / Story state.
   */
  readonly mapRunFacts?: GameplayMapRunFactsDef;
  /** Map-local reusable actions; omitted when every encounter is Wait-only. */
  readonly actions?: readonly GameplayMapActionDef[];
  /** Ordered Map-local candidate pools shared by Character and Enemy candidate sources. */
  readonly candidatePools?: readonly GameplayMapCandidatePoolDef[];
  /** Map-local finite Status definitions that Actions may apply inside an Encounter. */
  readonly statuses?: readonly GameplayMapStatusDef[];
  /** Per-character MapRun resource balances; all undeclared values start at 0. */
  readonly initialActorResources?: readonly GameplayMapInitialActorResourceDef[];
  /** Shared MapRun resource balances; all undeclared values start at 0. */
  readonly initialTeamResources?: readonly GameplayMapInitialTeamResourceDef[];
  /** Nodes embedded in this map. */
  readonly nodes: readonly GameplayMapNodeDef[];
  /** Directed adjacency between local node IDs. */
  readonly edges: readonly GameplayMapEdgeDef[];
}

/** Closed set of bounded Counters and boolean Flags owned by one MapRun. */
export interface GameplayMapRunFactsDef {
  /** MapRun-local safe-integer Counters; IDs share a namespace with `flags`. */
  readonly counters?: readonly GameplayMapRunCounterDef[];
  /** MapRun-local boolean Flags; IDs share a namespace with `counters`. */
  readonly flags?: readonly GameplayMapRunFlagDef[];
}

/** One MapRun-local Counter initialized when a new run starts. */
export interface GameplayMapRunCounterDef {
  /** Stable non-empty identifier within this Map's MapRun Fact namespace. */
  readonly id: string;
  /** Initial safe-integer value, inclusive within `min` and `max`. */
  readonly initial: number;
  /** Inclusive safe-integer lower bound. */
  readonly min: number;
  /** Inclusive safe-integer upper bound. */
  readonly max: number;
}

/** One MapRun-local boolean Flag initialized when a new run starts. */
export interface GameplayMapRunFlagDef {
  /** Stable non-empty identifier within this Map's MapRun Fact namespace. */
  readonly id: string;
  /** Initial value; must be a boolean. */
  readonly initial: boolean;
}

/** MapRun source scheduling contract. Omitted values preserve legacy E1 behavior. */
export type GameplayMapExecutionContractId = 'E1-COMPAT-1' | 'AG-1';

/** One fixed-party AG-1 agility supplement frozen into a new MapRun. */
export interface GameplayMapPartyAgilityDef {
  /** Fixed Map party member receiving this supplement. */
  readonly characterId: Character;
  /** Non-negative safe integer added to each of the Character's Action base values before the Action cap. */
  readonly agility: number;
}

/** One Map-local unit Status definition; it has no script or external resource path. */
export type GameplayMapStatusDef =
  | {
    /** Stable local identifier referenced by `statusApply`. */
    readonly id: string;
    /** Defaults to Encounter; MapRun Statuses persist between Encounter activities for one Run. */
    readonly lifetime?: 'encounter' | 'mapRun';
    /** Player-facing Status name. */
    readonly name: string;
    /** Optional player-facing explanation. */
    readonly description?: string;
    /** Optional Map-local cleanse category; omitted Statuses are not matched by category removal. */
    readonly category?: 'harmful' | 'beneficial';
    /** Optional one-time positive resource reward to the holder on natural round-end expiry. */
    readonly onExpire?: { readonly resourceId: string; readonly delta: number };
    /** Positive resource granted to the holder after each direct Hit removes HP. */
    readonly onDamageTaken?: { readonly resourceId: string; readonly delta: number };
    /** Burn deals HP damage per layer at round-end. */
    readonly kind: 'burn';
    /** Positive HP applied per layer at the round-end tick. */
    readonly hpPerStack: number;
    /** Maximum active layers for one holder and source identity. */
    readonly maxStacks: number;
  }
  | {
    readonly id: string;
    /** Defaults to Encounter; MapRun Statuses persist between Encounter activities for one Run. */
    readonly lifetime?: 'encounter' | 'mapRun';
    readonly name: string;
    readonly description?: string;
    readonly category?: 'harmful' | 'beneficial';
    /** Optional one-time positive resource reward to the holder on natural round-end expiry. */
    readonly onExpire?: { readonly resourceId: string; readonly delta: number };
    readonly onDamageTaken?: { readonly resourceId: string; readonly delta: number };
    /** Regen restores HP per layer at round-end. */
    readonly kind: 'regen';
    readonly hpPerStack: number;
    readonly maxStacks: number;
  }
  | {
    readonly id: string;
    /** Defaults to Encounter; MapRun Statuses persist between Encounter activities for one Run. */
    readonly lifetime?: 'encounter' | 'mapRun';
    readonly name: string;
    readonly description?: string;
    /** Optional one-time positive resource reward to the holder on natural round-end expiry. */
    readonly onExpire?: { readonly resourceId: string; readonly delta: number };
    readonly onDamageTaken?: { readonly resourceId: string; readonly delta: number };
    /** Damage-reduction Statuses are explicitly beneficial. */
    readonly category: 'beneficial';
    /** Reduce each incoming damage request per active layer. */
    readonly kind: 'damageReduction';
    /** Positive safe integer damage reduction per active layer. */
    readonly damageReductionPerStack: number;
    readonly maxStacks: number;
  }
  | {
    readonly id: string;
    /** Defaults to Encounter; MapRun Statuses persist between Encounter activities for one Run. */
    readonly lifetime?: 'encounter' | 'mapRun';
    readonly name: string;
    readonly description?: string;
    /** Optional one-time positive resource reward to the holder on natural round-end expiry. */
    readonly onExpire?: { readonly resourceId: string; readonly delta: number };
    readonly onDamageTaken?: { readonly resourceId: string; readonly delta: number };
    /** Damage protection is a beneficial, finite one-time hit charge. */
    readonly category: 'beneficial';
    /** Consume one layer to fully block one positive AG-1 damage hit. */
    readonly kind: 'damageProtection';
    /** Maximum active protection charges for one holder and source identity. */
    readonly maxStacks: number;
  };

/** One reusable action authored once and referenced by its Map-local ID. */
export interface GameplayMapActionDef {
  /** Stable only within the owning map. */
  readonly id: string;
  /** Player-facing action name. */
  readonly name: string;
  /** Optional player-facing action explanation. */
  readonly description?: string;
  /** Optional AG-1 base and cap for this Action's execution agility; both values are required together. */
  readonly agility?: GameplayMapActionAgilityDef;
  /** Static classification tags; each value must be a complete cross-Datapack TagRef. */
  readonly tags?: readonly TagRef[];
  /** Fixed Map party members allowed to perform this Character action; use [] when no Character may use it. */
  readonly eligibleCharacterIds: readonly Character[];
  /** The only target rule used by this action. */
  readonly target: GameplayMapActionTargetDef;
  /** Optional AG-1 secondary unit target domain; authoring contract only. */
  readonly additionalTarget?: 'partyCharacter' | 'enemy';
  /**
   * Optional explicit combat use for finite Encounter tendency adjustments.
   * Role conditions are evaluated from the candidate actor's side; omitted
   * Actions use only the candidate's base tendencyWeight.
   */
  readonly tendencyRole?: 'recovery' | 'defense' | 'attack';
  /** Optional resource balances consumed before applying effects. */
  readonly costs?: readonly GameplayMapActionResourceCostDef[];
  /** Optional finite E1-E4 program. Registry validates its syntax and source context before use. */
  readonly effectProgram?: GameplayMapEffectProgramDef;
}

/** Action-specific AG-1 execution speed bounds. */
export interface GameplayMapActionAgilityDef {
  /** Non-negative safe integer base speed. */
  readonly base: number;
  /** Non-negative safe integer maximum speed; must be at least `base`. */
  readonly max: number;
}

/** One finite, ordered set of candidate sources owned by a Gameplay B Map. */
export interface GameplayMapCandidatePoolDef {
  /** Stable only within the owning Map. */
  readonly id: string;
  /** Ordered weighted Action, Tag, or nested-pool entries. */
  readonly entries: readonly GameplayMapCandidatePoolEntryDef[];
  /** Optional single MapRun Fact condition controlling whether this Pool contributes candidates. */
  readonly gate?: GameplayMapCandidatePoolGateDef;
}

/** One closed, atomic MapRun Fact condition for a static candidate Pool. */
export type GameplayMapCandidatePoolGateDef =
  | {
    /** Compare one declared MapRun Counter with a fixed safe integer. */
    readonly kind: 'counter';
    readonly counterId: string;
    readonly comparison: 'eq' | 'lt' | 'lte' | 'gt' | 'gte';
    readonly value: number;
  }
  | {
    /** Compare one declared MapRun Flag with a fixed boolean. */
    readonly kind: 'flag';
    readonly flagId: string;
    readonly value: boolean;
  };

/** Weighted candidate source; nested Pool weights multiply their expanded contributions. */
export type GameplayMapCandidatePoolEntryDef =
  | { readonly kind: 'action'; readonly actionId: string; readonly weight: number }
  | { readonly kind: 'tag'; readonly tag: TagRef; readonly weight: number }
  | { readonly kind: 'pool'; readonly poolId: string; readonly weight: number };

/** Targets available to autonomous Character / Enemy Actions and actorless Ability / Item actions. */
export type GameplayMapActionTargetDef =
  | { readonly kind: 'none' }
  | { readonly kind: 'self' }
  | {
    readonly kind: 'partyCharacter';
    /** Include downed Party members in the primary target set; AG-1 Revive is the intended use. */
    readonly includeDefeated?: boolean;
    /** Optional legal-target preference; absent means the first Map party member. */
    readonly preference?: 'stableOrder' | 'lowestHpRatio' | 'highestMissingHpRatio';
  }
  | {
    readonly kind: 'enemy';
    /** Optional legal-target preference; absent means the first Encounter Enemy. */
    readonly preference?: 'stableOrder' | 'lowestHpRatio' | 'highestMissingHpRatio';
  }
  | {
    readonly kind: 'card';
    /** Relative to the source: self means its owner's cards; ally includes self. */
    readonly side: 'self' | 'ally' | 'opponent' | 'any';
    /** Cards support stable logical catalog order only. */
    readonly preference?: 'stableOrder';
  };

/** Resource costs are positive amounts charged from the acting combatant or its side's team. */
export interface GameplayMapActionResourceCostDef {
  /** `actor` charges the performer; `team` charges its side's pool (MapRun-local for Character, Encounter-local for Enemy). */
  readonly scope: 'actor' | 'team';
  /** Resource key; an undeclared starting balance is 0. */
  readonly resourceId: string;
  /** Positive safe integer amount to consume. */
  readonly amount: number;
}

/** Encounter-local initial balance for an Enemy Actor or the Enemy Team. */
export interface GameplayEncounterInitialEnemyResourceDef {
  /** Encounter-local resource key. */
  readonly resourceId: string;
  /** Initial non-negative safe integer balance. */
  readonly value: number;
}

/** Explicit starting HP and cap for one member of the fixed Map party. */
export interface GameplayMapInitialPartyHpDef {
  /** Fixed Map party member whose local HP starts at `initialHp`. */
  readonly characterId: Character;
  /** Starting HP, in the inclusive range 1..maxHp. */
  readonly initialHp: number;
  /** Positive safe integer cap for this member's MapRun-local HP. */
  readonly maxHp: number;
}

/** Explicit starting balance for one fixed party character's MapRun resource. */
export interface GameplayMapInitialActorResourceDef {
  /** Fixed Map party character whose resource starts at `value`. */
  readonly characterId: Character;
  /** MapRun-local resource key. */
  readonly resourceId: string;
  /** Initial non-negative safe integer balance. */
  readonly value: number;
}

/** Explicit starting balance for a shared MapRun team resource. */
export interface GameplayMapInitialTeamResourceDef {
  /** MapRun-local resource key. */
  readonly resourceId: string;
  /** Initial non-negative safe integer balance. */
  readonly value: number;
}

/** A map-local position with optional encounter content. */
export interface GameplayMapNodeDef {
  /** Stable only within the owning map. */
  readonly id: string;
  /** Player-facing node name. */
  readonly title: string;
  /** Optional player-facing node description. */
  readonly description?: string;
  /**
   * Optional single encounter attached to this node. Mutually exclusive with
   * `activities`; a single-encounter Node never needs an activity list.
   */
  readonly encounter?: GameplayEncounterDef;
  /**
   * Optional fixed-order activities. The node runs only one activity at a time
   * and advances automatically; players never choose the order.
   */
  readonly activities?: readonly GameplayMapActivityDef[];
}

/**
 * One fixed-order Node activity. Exactly one of `encounter` / `shop` is present;
 * a Rest is an encounter without an Enemy roster that declares finite `rounds`.
 */
export interface GameplayMapActivityDef {
  /** Stable only within the owning Node. */
  readonly id: string;
  /** Optional player-facing activity label; falls back to the encounter / shop title. */
  readonly title?: string;
  /** Encounter content for battle, rest, or manually completed activities. */
  readonly encounter?: GameplayEncounterDef;
  /** Shop content; mutually exclusive with `encounter`. */
  readonly shop?: GameplayShopDef;
}

/** Minimal shop content: a fixed, non-refreshing offer list. */
export interface GameplayShopDef {
  /** Optional player-facing shop title. */
  readonly title?: string;
  /** Optional player-facing shop description. */
  readonly description?: string;
  /** Offers the player may purchase in any order before leaving. */
  readonly offers: readonly GameplayShopOfferDef[];
}

/** One atomic shop exchange paid from shared MapRun team resources. */
export interface GameplayShopOfferDef {
  /** Stable only within the owning shop. */
  readonly id: string;
  /** Player-facing offer name. */
  readonly name: string;
  /** Optional player-facing offer description. */
  readonly description?: string;
  /** Shared Team resources charged atomically before any effect applies. */
  readonly costs?: readonly GameplayShopOfferCostDef[];
  /** Shared Team resources granted by the same atomic exchange. */
  readonly effects?: readonly GameplayShopOfferEffectDef[];
  /** Optional bounded HP restoration applied to one fixed party member. */
  readonly heal?: GameplayShopOfferHealDef;
}

/** One shared Team resource amount charged by a shop offer. */
export interface GameplayShopOfferCostDef {
  /** MapRun-local Team resource key. */
  readonly resourceId: string;
  /** Positive safe integer amount to consume. */
  readonly amount: number;
}

/** One signed shared Team resource delta granted by a shop offer. */
export interface GameplayShopOfferEffectDef {
  /** MapRun-local Team resource key. */
  readonly resourceId: string;
  /** Non-zero safe integer delta; negative removes balance. */
  readonly amount: number;
}

/** One bounded HP restoration granted by a shop offer. */
export interface GameplayShopOfferHealDef {
  /** Fixed Map party member whose MapRun-local HP is restored. */
  readonly characterId: Character;
  /** Positive safe integer HP amount; the applied delta is clamped to `maxHp`. */
  readonly amount: number;
}

/** A directed map-local connection. */
export interface GameplayMapEdgeDef {
  /** Local ID of the edge's source node. */
  readonly fromNodeId: string;
  /** Local ID of the edge's destination node. */
  readonly toNodeId: string;
  /**
   * Optional read-only, non-consuming gate. The Runtime rejects movement when
   * the condition is unsatisfied; the UI only mirrors that decision.
   */
  readonly condition?: GameplayMapEdgeConditionDef;
}

/** One read-only Team resource or single MapRun Fact condition on a directed Edge. */
export type GameplayMapEdgeConditionDef =
  | {
    /** Requires a shared MapRun Team resource balance to reach `amount`. */
    readonly kind: 'teamResourceAtLeast';
    /** MapRun-local Team resource key; reading it never consumes balance. */
    readonly resourceId: string;
    /** Positive safe integer threshold. */
    readonly amount: number;
  }
  | {
    /** Compares one declared MapRun Counter with a fixed safe integer. */
    readonly kind: 'counter';
    readonly counterId: string;
    readonly comparison: 'eq' | 'lt' | 'lte' | 'gt' | 'gte';
    readonly value: number;
  }
  | {
    /** Compares one declared MapRun Flag with a fixed boolean. */
    readonly kind: 'flag';
    readonly flagId: string;
    readonly value: boolean;
  };

/** Encounter presentation, battle roster, autonomous action pools, and player sources. */
export interface GameplayEncounterDef {
  /** Player-facing encounter name. */
  readonly title: string;
  /** Optional player-facing encounter description. */
  readonly description?: string;
  /** When present, exposes one legal manual completion action. */
  readonly completion?: GameplayEncounterCompletionDef;
  /** Encounter-local bounded Counter and Flag declarations used by E1 programs. */
  readonly locals?: GameplayMapEncounterLocalsDef;
  /**
   * Finite committed-round count for a non-battle Encounter (Rest). The
   * Encounter ends after this many rounds; ignored for Battle Encounters.
   */
  readonly rounds?: number;
  /**
   * Encounter-local battle roster. A non-empty roster makes this a Battle and
   * disables manual completion; omit the field for a non-battle Encounter.
   */
  readonly enemies?: readonly GameplayEncounterEnemyDef[];
  /** Encounter-local shared resource balances for Enemy actions; starts at 0 when omitted. */
  readonly initialEnemyTeamResources?: readonly GameplayEncounterInitialEnemyResourceDef[];
  /** Map-local Actions exposed as actorless Player Abilities. */
  readonly abilityActionIds?: readonly string[];
  /** Encounter-local mapping from one Consumable Item to a Map-local Action. */
  readonly itemActions?: readonly GameplayEncounterItemActionDef[];
  /**
   * Characters that can draw actions here. Omitted participants and empty action
   * lists are legal and produce Wait; no fallback candidate is inserted.
   */
  readonly participants?: readonly GameplayEncounterParticipantDef[];
}

/** A fixed-party participant and their weighted Map-local action candidates. */
export interface GameplayEncounterParticipantDef {
  /** Character must belong to the owning Map's fixed party. */
  readonly characterId: Character;
  /**
   * Candidate actions and positive integer Tendency weights. An empty list is
   * legal and leaves this participant with Wait for the encounter.
   */
  readonly actions: readonly GameplayEncounterActionCandidateDef[];
  /** Additional ordered Map-local candidate pools merged after direct Actions. */
  readonly candidatePoolIds?: readonly string[];
}

/** One Map-local action available to a Character or Enemy for weighted drawing. */
export interface GameplayEncounterActionCandidateDef {
  /** ID of an action defined in the owning Map. */
  readonly actionId: string;
  /** Positive safe integer Tendency weight for this combatant. */
  readonly tendencyWeight: number;
}

/** E1 non-battle completion rules; condition is evaluated after the full legal round. */
export type GameplayEncounterCompletionDef =
  | {
    readonly kind: 'manual';
    /** Player-facing label for the completion action. */
    readonly label: string;
  }
  | {
    readonly kind: 'condition';
    /** Player-facing label for this completion rule. */
    readonly label: string;
    /** Restricted HP/Counter/Flag condition checked after all legal sources finish. */
    readonly condition: GameplayMapEffectConditionDef;
  };

/** One autonomous Enemy with Encounter-local identity, bounded HP, and an Action pool. */
export interface GameplayEncounterEnemyDef {
  /** Stable ID unique within this Encounter. */
  readonly id: string;
  /** Starting HP, in the inclusive range 1..maxHp. */
  readonly initialHp: number;
  /** Positive safe integer cap for this Enemy's Encounter-local HP. */
  readonly maxHp: number;
  /** Optional non-negative safe integer AG-1 agility supplement; omitted means zero. */
  readonly agility?: number;
  /** Weighted autonomous Action candidates; omitted or empty means this Enemy waits. */
  readonly actions?: readonly GameplayEncounterActionCandidateDef[];
  /** Additional ordered Map-local candidate pools merged after direct Actions. */
  readonly candidatePoolIds?: readonly string[];
  /** Encounter-local Actor balances for this Enemy; undeclared resources start at 0. */
  readonly initialResources?: readonly GameplayEncounterInitialEnemyResourceDef[];
}

/** Encounter-local Item source mapping; each Item ID appears at most once per Encounter. */
export interface GameplayEncounterItemActionDef {
  /** Existing ItemDef identity; Registry requires a Consumable. */
  readonly itemId: string;
  /** Map-local Action supplying this Item's battle target and effects. */
  readonly actionId: string;
}
