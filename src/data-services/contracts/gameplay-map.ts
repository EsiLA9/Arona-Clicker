import type { Character } from '../../engine/types/ids';

/** Static Gameplay B map content. Node, edge, and action IDs are local to this map. */
export interface GameplayMapDef {
  /** Stable three-part Datapack identity using the `map` entity type. */
  readonly id: string;
  /** Player-facing map name. */
  readonly name: string;
  /**
   * Author-maintained compatibility version for MapRun resume. Raise this when
   * changing any action, encounter participant, tendency, target, cost, effect,
   * initial HP, or initial resource rule that can affect an active run.
   */
  readonly resumeVersion: number;
  /** Local ID of the node where a new MapRun begins. */
  readonly startNodeId: string;
  /** Local IDs of nodes that end the MapRun when reached. */
  readonly exitNodeIds: readonly string[];
  /** Fixed Character IDs admitted to every Encounter in a new MapRun. */
  readonly partyCharacterIds: readonly Character[];
  /** Explicit MapRun-local starting HP and cap for every fixed party member. */
  readonly initialPartyHp: readonly GameplayMapInitialPartyHpDef[];
  /** Explicit PlayerCost balance assigned when a new MapRun starts. */
  readonly initialPlayerCost: number;
  /** Map-local reusable actions; omitted when every encounter is Wait-only. */
  readonly actions?: readonly GameplayMapActionDef[];
  /** Per-character MapRun resource balances; all undeclared values start at 0. */
  readonly initialActorResources?: readonly GameplayMapInitialActorResourceDef[];
  /** Shared MapRun resource balances; all undeclared values start at 0. */
  readonly initialTeamResources?: readonly GameplayMapInitialTeamResourceDef[];
  /** Nodes embedded in this map. */
  readonly nodes: readonly GameplayMapNodeDef[];
  /** Directed adjacency between local node IDs. */
  readonly edges: readonly GameplayMapEdgeDef[];
}

/** One reusable action authored once and referenced by its Map-local ID. */
export interface GameplayMapActionDef {
  /** Stable only within the owning map. */
  readonly id: string;
  /** Player-facing action name. */
  readonly name: string;
  /** Optional player-facing action explanation. */
  readonly description?: string;
  /** Fixed Map party members allowed to perform this Character action; use [] for actorless sources. */
  readonly eligibleCharacterIds: readonly Character[];
  /** The only target rule used by this action. */
  readonly target: GameplayMapActionTargetDef;
  /** Optional resource balances consumed before applying effects. */
  readonly costs?: readonly GameplayMapActionResourceCostDef[];
  /** Optional actor/team resource changes applied by a successful action. */
  readonly effects?: readonly GameplayMapActionResourceEffectDef[];
  /** Optional bounded HP changes applied to the selected Enemy or party target. */
  readonly hpEffects?: readonly GameplayMapActionHpEffectDef[];
}

/** Targets available to Character actions and actorless Ability / Item actions. */
export type GameplayMapActionTargetDef =
  | { readonly kind: 'none' }
  | { readonly kind: 'self' }
  | { readonly kind: 'partyCharacter' }
  | { readonly kind: 'enemy' };

/** Resource costs are positive amounts charged from the acting character or team. */
export interface GameplayMapActionResourceCostDef {
  /** `actor` charges the performing character; `team` charges the shared MapRun pool. */
  readonly scope: 'actor' | 'team';
  /** MapRun-local resource key; an undeclared starting balance is 0. */
  readonly resourceId: string;
  /** Positive safe integer amount to consume. */
  readonly amount: number;
}

/** A signed change to an acting-character or shared-team MapRun resource. */
export interface GameplayMapActionResourceEffectDef {
  /** `actor` changes one character balance; `team` changes the shared MapRun pool. */
  readonly scope: 'actor' | 'team';
  /** MapRun-local resource key; an undeclared starting balance is 0. */
  readonly resourceId: string;
  /** Non-zero safe integer delta; positive adds and negative removes balance. */
  readonly amount: number;
  /**
   * For actor-scoped effects, defaults to the performer; `target` applies the
   * change to the encounter's resolved target and therefore requires a target rule.
   * Team-scoped effects do not accept a recipient.
   */
  readonly recipient?: 'actor' | 'target';
}

/** A signed HP change applied to the action's selected Enemy or party target. */
export interface GameplayMapActionHpEffectDef {
  /** Non-zero safe integer; damage is negative and healing is positive. */
  readonly amount: number;
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

/** The only Edge condition shape used by basic map gameplay. */
export interface GameplayMapEdgeConditionDef {
  /** Requires a shared MapRun Team resource balance to reach `amount`. */
  readonly kind: 'teamResourceAtLeast';
  /** MapRun-local Team resource key; reading it never consumes balance. */
  readonly resourceId: string;
  /** Positive safe integer threshold. */
  readonly amount: number;
}

/** Encounter presentation, battle roster, source options, and Character participants. */
export interface GameplayEncounterDef {
  /** Player-facing encounter name. */
  readonly title: string;
  /** Optional player-facing encounter description. */
  readonly description?: string;
  /** When present, exposes one legal manual completion action. */
  readonly completion?: GameplayEncounterCompletionDef;
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
}

/** One Map-local action available to a participant for weighted drawing. */
export interface GameplayEncounterActionCandidateDef {
  /** ID of an action defined in the owning Map. */
  readonly actionId: string;
  /** Positive safe integer Tendency weight for this participant. */
  readonly tendencyWeight: number;
}

/** A manually submitted encounter completion action; no script or effect semantics. */
export interface GameplayEncounterCompletionDef {
  readonly kind: 'manual';
  /** Player-facing label for the completion action. */
  readonly label: string;
}

/** One Enemy with Encounter-local identity, bounded HP, and fixed damage. */
export interface GameplayEncounterEnemyDef {
  /** Stable ID unique within this Encounter. */
  readonly id: string;
  /** Starting HP, in the inclusive range 1..maxHp. */
  readonly initialHp: number;
  /** Positive safe integer cap for this Enemy's Encounter-local HP. */
  readonly maxHp: number;
  /** Positive safe integer damage dealt once per surviving Enemy turn. */
  readonly damage: number;
}

/** Encounter-local Item source mapping; each Item ID appears at most once per Encounter. */
export interface GameplayEncounterItemActionDef {
  /** Existing ItemDef identity; Registry requires a Consumable. */
  readonly itemId: string;
  /** Map-local Action supplying this Item's battle target and effects. */
  readonly actionId: string;
}
