export type ActivityOutcomeKind = "clue" | "none";

export interface CharacterDefinition {
  readonly id: string;
  readonly name: string;
  readonly row: "front" | "back";
  readonly hpMax: number;
  readonly initialHp: number;
  readonly atk: number;
  readonly def: number;
  readonly activityTags: readonly string[];
}

export interface ActivityOutcomeDefinition {
  readonly kind: ActivityOutcomeKind;
  readonly text: string;
}

export interface ActivityRuleDefinition {
  readonly dieSides: number;
  readonly outcomes: Readonly<Record<number, ActivityOutcomeDefinition>>;
}

export interface ActivityLocationDefinition {
  readonly id: string;
  readonly name: string;
  readonly activityCount: number;
  readonly activityRule: ActivityRuleDefinition;
}

export interface ExitLocationDefinition {
  readonly id: string;
  readonly name: string;
}

export interface RunConfig {
  readonly seed: number | string;
  readonly characters: readonly CharacterDefinition[];
  readonly activityLocation: ActivityLocationDefinition;
  readonly exitLocation: ExitLocationDefinition;
}

export type RuntimePhase = "activity" | "exit" | "complete";

export interface CharacterState {
  readonly id: string;
  readonly name: string;
  readonly row: "front" | "back";
  readonly hp: number;
  readonly hpMax: number;
  readonly atk: number;
  readonly def: number;
  readonly activityTags: readonly string[];
  readonly inParty: boolean;
}

export type EventType =
  | "location-entered"
  | "activity-result"
  | "activity-progress"
  | "demo-completed";

export interface EventRecord {
  readonly sequence: number;
  readonly click: number;
  readonly locationId: string;
  readonly type: EventType;
  readonly sourceId?: string;
  readonly dice?: {
    readonly sides: number;
    readonly value: number;
  };
  readonly outcome?: ActivityOutcomeKind;
  readonly activityRemaining?: number;
  readonly text: string;
}

export interface ReadonlyView {
  readonly seed: number | string;
  readonly rngCursor: number;
  readonly clickCount: number;
  readonly phase: RuntimePhase;
  readonly currentLocation: {
    readonly id: string;
    readonly name: string;
    readonly kind: "activity" | "exit";
  };
  readonly activityRemaining: number | null;
  readonly characters: readonly CharacterState[];
  readonly events: readonly EventRecord[];
  readonly terminal: boolean;
}

export type BattleSide = "ally" | "enemy";
export type BattleRow = CharacterDefinition["row"];
export type ReserveException = "heal-wounded-ally" | "cover-enemy-charge";
export type BattleTargetRule =
  | { readonly kind: "lowest"; readonly side: BattleSide; readonly rows: readonly (BattleRow | "any")[]; readonly requirement?: "injured-half" | "prepared-attack" }
  | { readonly kind: "all"; readonly side: BattleSide; readonly row: BattleRow }
  | { readonly kind: "front-and-lowest-rear"; readonly side: BattleSide }
  | { readonly kind: "intent-target"; readonly intentTag: string };
export type BattleActionEffect =
  | { readonly kind: "attack"; readonly target: BattleTargetRule }
  | { readonly kind: "shield" | "heal" | "attack-buff"; readonly target: BattleTargetRule; readonly amount: number };
export type BattleEnemyIntentEffect = BattleActionEffect
  | { readonly kind: "fixed-damage"; readonly amount: number; readonly target: BattleTargetRule }
  | { readonly kind: "no-op" };
export type PreparedEnemyIntentResolution = { readonly kind: "fixed-damage"; readonly amount: number } | { readonly kind: "no-op" };
export type BattleCondition =
  | { readonly kind: "always" | "injured-ally-half" | "prepared-ally-attack" }
  | { readonly kind: "enemy-intent"; readonly tag: string }
  | { readonly kind: "enemy-front-count"; readonly minimum: number }
  | { readonly kind: "enemy-row-alive"; readonly row: BattleRow };
export interface OrdinaryBattleCardDefinition { readonly id: string; readonly name: string; readonly cost: number; readonly tags: readonly string[]; readonly effect: BattleActionEffect }
export interface AIPriorityEntry {
  readonly cardId: string; readonly condition: BattleCondition; readonly holdCost: number;
  readonly minimumCurrentSCost?: number; readonly reserveException?: ReserveException;
}
export interface BattleCharacterDefinition {
  readonly id: string; readonly name: string; readonly row: BattleRow; readonly hpMax: number;
  readonly atk: number; readonly def: number; readonly cards: readonly OrdinaryBattleCardDefinition[];
  readonly aiPriority: readonly AIPriorityEntry[];
}
export interface BattlePartyMember { readonly definition: BattleCharacterDefinition; readonly hp: number; readonly currentBattleSCost: number }
export interface EnemyIntentDefinition { readonly id: string; readonly name: string; readonly tags: readonly string[]; readonly effect: BattleEnemyIntentEffect }
export interface BattleEnemyDefinition {
  readonly id: string; readonly name: string; readonly row: BattleRow; readonly hpMax: number;
  readonly atk: number; readonly def: number; readonly intentPattern: readonly EnemyIntentDefinition[];
  readonly previousRoundDamageReaction?: EnemyIntentDefinition;
}
export interface BattleEnemyMember { readonly definition: BattleEnemyDefinition; readonly hp: number }
export interface BattlePreparationInput {
  readonly encounterId: string; readonly round: number;
  readonly party: readonly BattlePartyMember[]; readonly enemies: readonly BattleEnemyMember[];
  readonly initialSCostBonus?: number;
  readonly rechargeBonus?: { readonly amount: number; readonly fromRound: number };
  readonly previousRoundDamagedEnemyIds?: readonly string[];
}
export interface BattleCombatantSnapshot {
  readonly actorId: string; readonly side: BattleSide; readonly name: string; readonly row: BattleRow;
  readonly hp: number; readonly hpMax: number; readonly atk: number; readonly def: number;
  readonly currentBattleSCost: number | null;
}
export interface PreparedPartySCost { readonly actorId: string; readonly value: number }
export interface PreparedPlayerAction {
  readonly actorId: string; readonly kind: "card" | "observe"; readonly cardId: string | null;
  readonly cardName: string | null; readonly tags: readonly string[]; readonly effect: BattleActionEffect | null;
  readonly targetIds: readonly string[]; readonly costPaid: number; readonly sCostBeforePayment: number;
  readonly sCostAfterPayment: number; readonly reserveBypassed: boolean;
}
export interface PreparedEnemyIntent {
  readonly actorId: string; readonly intentId: string; readonly intentName: string;
  readonly tags: readonly string[]; readonly effect: BattleActionEffect | null; readonly targetIds: readonly string[];
  readonly resolution?: PreparedEnemyIntentResolution;
}
export interface PreparedBattleRound {
  readonly encounterId: string; readonly round: number; readonly combatants: readonly BattleCombatantSnapshot[];
  readonly partyStartSCost: readonly PreparedPartySCost[]; readonly enemyIntents: readonly PreparedEnemyIntent[];
  readonly playerActions: readonly PreparedPlayerAction[];
}

export interface SupplementalFreeBattleAction {
  readonly id: string;
  readonly actorId: string;
  readonly tags: readonly string[];
  readonly effect: BattleActionEffect;
  readonly targetIds: readonly string[];
}
export type BattleRecipeActionSource = "player-card" | "enemy-intent" | "free-skill";
export interface BattleRecipeAction {
  readonly id: string;
  readonly actorId: string;
  readonly side: BattleSide;
  readonly source: BattleRecipeActionSource;
  readonly order: number;
  readonly tags: readonly string[];
  readonly targetIds: readonly string[];
  readonly effect: BattleActionEffect | null;
}
export type BattleRecipeEffect =
  | { readonly kind: "remove-round-shield"; readonly targetIds: readonly string[]; readonly amount: number }
  | { readonly kind: "attack"; readonly actorId: string; readonly targetIds: readonly string[]; readonly damageAdjustment: number }
  | { readonly kind: "gain-round-shield"; readonly targetIds: readonly string[]; readonly amount: number };
export interface BattleRecipeMatch {
  readonly recipeId: string;
  readonly priority: number;
  readonly leftActionId: string;
  readonly leftActorId: string;
  readonly rightActionId: string;
  readonly rightActorId: string;
  readonly replacementEffects: readonly BattleRecipeEffect[];
}
export interface BattleRecipePlan {
  readonly unmatchedActions: readonly BattleRecipeAction[];
  readonly matches: readonly BattleRecipeMatch[];
  readonly consumedActionIds: readonly string[];
}

export type BattleResult = "ongoing" | "victory" | "defeat" | "draw";
export interface BattleResolutionState {
  readonly encounterId: string;
  readonly round: number;
  readonly combatants: readonly BattleCombatantSnapshot[];
  readonly partySCost: readonly PreparedPartySCost[];
  readonly result: BattleResult;
}
export interface BattleResolutionDelta {
  readonly actorId: string;
  readonly damage: number;
  readonly healing: number;
  readonly shield: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
  readonly sCostBefore: number | null;
  readonly sCostAfter: number | null;
}
export interface BattleResolution {
  readonly state: BattleResolutionState;
  readonly deltas: readonly BattleResolutionDelta[];
  readonly events: readonly string[];
  readonly prepared: PreparedBattleRound;
}

export interface RouteBattleProjection {
  readonly seed: number | string;
  readonly rngCursor: number;
  readonly state: BattleResolutionState;
  readonly pendingRound: PreparedBattleRound | null;
  readonly pendingSkills: unknown;
  readonly pendingRecipePlan: BattleRecipePlan | null;
  readonly lastResolution: unknown;
  readonly attackMarkers: readonly string[];
  readonly clickCount: number;
  readonly events: readonly string[];
  readonly terminal: boolean;
}

export type RouteTerminalResult = "ongoing" | "defeat" | "draw" | "complete" | "stranded";
export type RouteNodeKind = "battle" | "activity" | "exit";

export interface RoutePartyView {
  readonly id: string;
  readonly name: string;
  readonly row: BattleRow;
  readonly hp: number;
  readonly hpMax: number;
  readonly atk: number;
  readonly def: number;
  readonly activityTags: readonly string[];
  readonly currentBattleSCost: number | null;
}

export interface RouteInitialPartyMember {
  readonly roster: CharacterDefinition;
  readonly battle: BattleCharacterDefinition;
  readonly hp?: number;
}

export interface RouteEventRecord {
  readonly sequence: number;
  readonly click: number;
  readonly nodeId: string;
  readonly locationId: string;
  readonly type: "node-entered" | "character-joined" | "activity-fixed-effect" | "activity-result" | "activity-progress" | "battle-event" | "battle-ended" | "exit-options" | "exit-chosen" | "exit-item-consumed" | "player-cost-gained" | "player-cost-paid" | "player-cost-capped" | "scene-behavior" | "player-card-drawn" | "player-card-played" | "player-card-effect" | "item-gained" | "route-terminal";
  readonly actorId?: string;
  readonly dice?: { readonly sides: number; readonly value: number; readonly bonus?: number; readonly modifiedValue?: number };
  readonly outcome?: "clue" | "none" | "effect";
  readonly success?: boolean;
  readonly text: string;
}

export interface RouteSceneChoiceView {
  readonly mode: "individual" | "global";
  readonly behaviors: readonly { readonly id: string; readonly label: string; readonly cost: number; readonly targetMode: "party" | "one" | "many" }[];
  readonly requiredActorIds: readonly string[];
  readonly selections: readonly { readonly actorId?: string; readonly behaviorId: string; readonly targetIds: readonly string[] }[];
  readonly selectedPlayerCards: readonly { readonly cardId: string; readonly targetIds: readonly string[] }[];
  readonly totalCost: number;
  readonly ready: boolean;
  readonly canConfirm: boolean;
  readonly blockedReason: string | null;
}

export type RoutePlayerCardEffect =
  | { readonly kind: "heal"; readonly amount: number; readonly targetMode: "party" | "one" | "many" }
  | { readonly kind: "check-bonus"; readonly amount: number; readonly targetMode: "party" | "one" | "many" }
  | { readonly kind: "gain-item"; readonly itemId: string };

export interface RoutePlayerCardDefinition {
  readonly id: string;
  readonly name: string;
  readonly cost: number;
  readonly effect: RoutePlayerCardEffect;
}

export interface RoutePlayerDeckDefinition {
  readonly cards: readonly RoutePlayerCardDefinition[];
  readonly openingHandSize: number;
  readonly handLimit: number;
  readonly drawPerNodeEntry: number;
}

export interface RoutePlayerDeckView {
  readonly hand: readonly RoutePlayerCardDefinition[];
  readonly drawPileCount: number;
  readonly usedCardIds: readonly string[];
  readonly pendingCards: readonly { readonly cardId: string; readonly targetIds: readonly string[] }[];
  readonly handLimit: number;
}

export interface GameplayBRouteView {
  readonly seed: number | string;
  readonly rngCursor: number;
  readonly clickCount: number;
  readonly nodeIndex: number;
  readonly nodeCount: number;
  readonly currentNode: { readonly id: string; readonly name: string; readonly kind: RouteNodeKind; readonly area?: string };
  readonly playerCost: number;
  readonly sceneChoice: RouteSceneChoiceView | null;
  readonly playerDeck: RoutePlayerDeckView | null;
  readonly awaitingExitChoice: boolean;
  readonly availableExits: readonly { readonly id: string; readonly label: string; readonly targetNodeId: string }[];
  readonly heldItems: readonly string[];
  readonly nodeVisitCounts: Readonly<Record<string, number>>;
  readonly activityRemaining: number | null;
  readonly party: readonly RoutePartyView[];
  readonly currentBattle: RouteBattleProjection | null;
  readonly events: readonly RouteEventRecord[];
  readonly result: RouteTerminalResult;
  readonly terminal: boolean;
}
