import type {
  ActivityLocationDefinition,
  ActivityOutcomeDefinition,
  CharacterDefinition,
  CharacterState,
  EventRecord,
  ExitLocationDefinition,
  ReadonlyView,
  RunConfig,
  RuntimePhase,
  BattlePreparationInput,
  BattleResolution,
  BattleResolutionState,
  BattleRecipePlan,
  PreparedBattleRound,
  PreparedPlayerAction,
  GameplayBRouteView as GameplayBRouteViewModel,
  RouteEventRecord,
  RouteInitialPartyMember,
  RoutePartyView,
  RouteSceneChoiceView,
  RouteTerminalResult,
  RoutePlayerCardDefinition,
  RoutePlayerDeckDefinition,
  RoutePlayerDeckView,
} from "./model.js";
import { SeededRandom } from "./random.js";
import { prepareBattleRoundWithSkills } from "./battle/prepare.js";
import { matchPreparedBattleRound } from "./battle/match.js";
import { buildEditedPlayerAction, getPlayerTargetGroup, listPlayerCardChoices, validatePlayerTargetSelection,
  type PlayerActionFallback, type PlayerCardChoice, type PlayerTargetGroup } from "./battle/player-card-edit.js";
import { resolveBattleRound, type ResolvedBattleRound } from "./battle/resolve.js";
import type { PreparedBattleSkills } from "./battle/skills.js";
import { resolveActivity, type LocationActivityDefinition } from "./locations/activity.js";

interface MutableCharacterState {
  id: string;
  name: string;
  row: "front" | "back";
  hp: number;
  hpMax: number;
  atk: number;
  def: number;
  activityTags: string[];
  inParty: boolean;
}

interface MutableEventRecord {
  sequence: number;
  click: number;
  locationId: string;
  type: EventRecord["type"];
  sourceId?: string;
  dice?: { sides: number; value: number };
  outcome?: EventRecord["outcome"];
  activityRemaining?: number;
  text: string;
}

interface RuntimeConfig {
  seed: number | string;
  characters: CharacterDefinition[];
  activityLocation: ActivityLocationDefinition;
  exitLocation: ExitLocationDefinition;
}

interface MutableRunState {
  phase: RuntimePhase;
  activityRemaining: number | null;
  clickCount: number;
  terminal: boolean;
  characters: MutableCharacterState[];
  events: MutableEventRecord[];
}

function cloneConfig(config: RunConfig): RuntimeConfig {
  return {
    seed: config.seed,
    characters: config.characters.map((character) => ({
      ...character,
      activityTags: [...character.activityTags],
    })),
    activityLocation: {
      ...config.activityLocation,
      activityRule: {
        dieSides: config.activityLocation.activityRule.dieSides,
        outcomes: Object.fromEntries(
          Object.entries(config.activityLocation.activityRule.outcomes).map(
            ([roll, outcome]) => [Number(roll), { ...outcome }],
          ),
        ),
      },
    },
    exitLocation: { ...config.exitLocation },
  };
}

function validateConfig(config: RuntimeConfig): void {
  if (config.characters.length !== 4) {
    throw new RangeError("The initial party must contain exactly four characters.");
  }
  if (config.activityLocation.activityCount !== 2) {
    throw new RangeError("The prototype activity location must have activity count 2.");
  }
  if (
    !Number.isInteger(config.activityLocation.activityRule.dieSides) ||
    config.activityLocation.activityRule.dieSides < 1
  ) {
    throw new RangeError("The activity die must have at least one side.");
  }
  if (config.activityLocation.id === config.exitLocation.id) {
    throw new RangeError("Activity and exit locations must have different IDs.");
  }

  const ids = new Set<string>();
  for (const character of config.characters) {
    if (ids.has(character.id)) {
      throw new RangeError(`Duplicate character ID: ${character.id}`);
    }
    ids.add(character.id);
    if (
      !Number.isInteger(character.hpMax) ||
      character.hpMax < 1 ||
      !Number.isInteger(character.initialHp) ||
      character.initialHp < 0 ||
      character.initialHp > character.hpMax
    ) {
      throw new RangeError(`Invalid HP values for character ${character.id}.`);
    }
  }

  const sides = config.activityLocation.activityRule.dieSides;
  const outcomes = config.activityLocation.activityRule.outcomes;
  for (let roll = 1; roll <= sides; roll += 1) {
    if (!outcomes[roll]) {
      throw new RangeError(`Missing activity outcome for die value ${roll}.`);
    }
  }
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      freezeDeep(child);
    }
    Object.freeze(value);
  }
  return value;
}

function copyOutcome(outcome: ActivityOutcomeDefinition): ActivityOutcomeDefinition {
  return { kind: outcome.kind, text: outcome.text };
}

export class GameplayBRuntime {
  private readonly config: RuntimeConfig;
  private readonly random: SeededRandom;
  private readonly state: MutableRunState;

  constructor(input: RunConfig) {
    this.config = cloneConfig(input);
    validateConfig(this.config);
    this.random = new SeededRandom(this.config.seed);
    this.state = {
      phase: "activity",
      activityRemaining: this.config.activityLocation.activityCount,
      clickCount: 0,
      terminal: false,
      characters: this.config.characters.map((character) => ({
        id: character.id,
        name: character.name,
        row: character.row,
        hp: character.initialHp,
        hpMax: character.hpMax,
        atk: character.atk,
        def: character.def,
        activityTags: [...character.activityTags],
        inParty: true,
      })),
      events: [],
    };
    this.appendEvent({
      locationId: this.config.activityLocation.id,
      type: "location-entered",
      text: `进入场所：${this.config.activityLocation.name}`,
    });
  }

  getView(): ReadonlyView {
    const isActivity = this.state.phase === "activity";
    const location = isActivity
      ? this.config.activityLocation
      : this.config.exitLocation;
    const characters: CharacterState[] = this.state.characters.map((character) => ({
      id: character.id,
      name: character.name,
      row: character.row,
      hp: character.hp,
      hpMax: character.hpMax,
      atk: character.atk,
      def: character.def,
      activityTags: [...character.activityTags],
      inParty: character.inParty,
    }));
    const events: EventRecord[] = this.state.events.map((event) => ({
      ...event,
      dice: event.dice ? { ...event.dice } : undefined,
    }));

    return freezeDeep({
      seed: this.config.seed,
      rngCursor: this.random.cursor,
      clickCount: this.state.clickCount,
      phase: this.state.phase,
      currentLocation: {
        id: location.id,
        name: location.name,
        kind: isActivity ? "activity" : "exit",
      },
      activityRemaining: this.state.activityRemaining,
      characters,
      events,
      terminal: this.state.terminal,
    });
  }

  click(): ReadonlyView {
    if (this.state.terminal) {
      return this.getView();
    }

    this.state.clickCount += 1;
    if (this.state.phase === "activity") {
      this.resolveActivityClick();
    } else {
      this.completeDemo();
    }
    return this.getView();
  }

  private resolveActivityClick(): void {
    const location = this.config.activityLocation;
    const rule = location.activityRule;

    for (const character of this.state.characters) {
      if (!character.inParty || character.hp <= 0) {
        continue;
      }

      const diceValue = this.random.nextInt(1, rule.dieSides);
      const outcome = copyOutcome(rule.outcomes[diceValue]);
      this.appendEvent({
        locationId: location.id,
        type: "activity-result",
        sourceId: character.id,
        dice: { sides: rule.dieSides, value: diceValue },
        outcome: outcome.kind,
        text: `${character.name}：${outcome.text}`,
      });
    }

    this.state.activityRemaining = (this.state.activityRemaining ?? 0) - 1;
    this.appendEvent({
      locationId: location.id,
      type: "activity-progress",
      activityRemaining: this.state.activityRemaining,
      text: `本次活动完成，剩余活动度 ${this.state.activityRemaining}。`,
    });

    if (this.state.activityRemaining === 0) {
      this.state.phase = "exit";
      this.state.activityRemaining = null;
      this.appendEvent({
        locationId: this.config.exitLocation.id,
        type: "location-entered",
        text: `自动进入出口：${this.config.exitLocation.name}。出口尚未执行。`,
      });
    }
  }

  private completeDemo(): void {
    this.state.phase = "complete";
    this.state.terminal = true;
    this.appendEvent({
      locationId: this.config.exitLocation.id,
      type: "demo-completed",
      text: "Demo 已结束。",
    });
  }

  private appendEvent(
    event: Omit<MutableEventRecord, "sequence" | "click">,
  ): void {
    this.state.events.push({
      sequence: this.state.events.length + 1,
      click: this.state.clickCount,
      ...event,
    });
  }
}

export interface BattleRuntimeView {
  readonly seed: number | string;
  readonly rngCursor: number;
  readonly state: BattleResolutionState;
  readonly pendingRound: PreparedBattleRound | null;
  readonly pendingSkills: PreparedBattleSkills | null;
  readonly pendingRecipePlan: BattleRecipePlan | null;
  readonly playerCardChoices: readonly PlayerCardChoice[];
  readonly targetEditOptions: readonly PlayerTargetEditOption[];
  readonly lastResolution: ResolvedBattleRound | null;
  readonly attackMarkers: readonly string[];
  readonly clickCount: number;
  readonly events: readonly string[];
  readonly terminal: boolean;
}

export interface PlayerTargetEditOption extends PlayerTargetGroup {
  readonly cardRef: string;
  readonly actorId: string;
  readonly kind: "ordinary" | "free-skill";
  readonly skillId: string | null;
  readonly targetIds: readonly string[];
  readonly editable: boolean;
  readonly disabledReason: string | null;
}

export interface PlayerEditOutcome {
  readonly ok: boolean;
  readonly reason?: string;
  readonly fallbacks?: readonly PlayerActionFallback[];
}

export interface GameplayBRouteView extends GameplayBRouteViewModel {
  readonly currentBattle: BattleRuntimeView | null;
}

export class GameplayBBattleRuntime {
  private readonly input: BattlePreparationInput;
  private readonly seed: number | string;
  private readonly random: SeededRandom;
  private state: BattleResolutionState;
  private pendingRound: PreparedBattleRound | null = null;
  private pendingSkills: PreparedBattleSkills | null = null;
  private pendingRecipePlan: BattleRecipePlan | null = null;
  private lastResolution: ResolvedBattleRound | null = null;
  private attackMarkers: string[] = [];
  private clickCount = 0;
  private events: string[] = [];

  constructor(input: BattlePreparationInput, seed: number | string = "park-inspection-demo") {
    this.input = { ...structuredClone(input), round: 1, previousRoundDamagedEnemyIds: [] };
    this.seed = seed;
    this.random = new SeededRandom(seed);
    this.prepare(this.input);
    this.state = {
      encounterId: input.encounterId, round: 0,
      combatants: this.pendingRound!.combatants,
      partySCost: this.pendingRound!.partyStartSCost,
      result: "ongoing",
    };
  }

  getView(): BattleRuntimeView {
    return freezeDeep({ seed: this.seed, rngCursor: this.random.cursor, state: structuredClone(this.state),
      pendingRound: this.pendingRound && structuredClone(this.pendingRound), pendingSkills: this.pendingSkills && structuredClone(this.pendingSkills),
      pendingRecipePlan: this.pendingRecipePlan && structuredClone(this.pendingRecipePlan), lastResolution: this.lastResolution && structuredClone(this.lastResolution),
      playerCardChoices: this.getPlayerCardChoices(), targetEditOptions: this.getTargetEditOptions(),
      attackMarkers: [...this.attackMarkers], clickCount: this.clickCount, events: [...this.events], terminal: this.state.result !== "ongoing" });
  }

  editPlayerAction(actorId: string, cardId: string | null, targetIds: readonly string[]): PlayerEditOutcome {
    if (!this.pendingRound || !this.pendingSkills || !this.pendingRecipePlan || this.state.result !== "ongoing") {
      return { ok: false, reason: "当前没有可编辑的待结算回合" };
    }
    const built = buildEditedPlayerAction(this.pendingRound, this.input.party.map((member) => member.definition), actorId, cardId, targetIds);
    if (!built.ok) return built;
    const affectedActors = new Set([actorId, ...(built.fallbacks ?? []).map((fallback) => fallback.actorId)]);
    for (const affectedActorId of affectedActors) {
      const proposed = built.playerActions.find((action) => action.actorId === affectedActorId);
      if (!proposed) continue;
      const skillReason = this.actionSkillRestriction(affectedActorId, proposed);
      if (skillReason) return { ok: false, reason: skillReason };
    }
    this.pendingRound = freezeDeep({ ...this.pendingRound, playerActions: built.playerActions });
    this.rebuildPendingRecipePlan();
    return built.fallbacks?.length ? { ok: true, fallbacks: built.fallbacks } : { ok: true };
  }

  editFreeSkillTargets(actorId: string, skillId: string, targetIds: readonly string[]): PlayerEditOutcome {
    if (!this.pendingRound || !this.pendingSkills || !this.pendingRecipePlan || this.state.result !== "ongoing") {
      return { ok: false, reason: "当前没有可编辑的待结算回合" };
    }
    const actionIndex = this.pendingSkills.supplementalFreeActions.findIndex((action) => action.actorId === actorId && action.id === skillId);
    if (actionIndex < 0) return { ok: false, reason: "该免费技能没有独立目标行动" };
    if (this.pendingSkills.effects.some((effect) => effect.skillId === skillId && effect.sourceActorId === actorId) ||
      this.pendingSkills.modifiers.some((modifier) => modifier.skillId === skillId && modifier.sourceActorId === actorId)) {
      return { ok: false, reason: "该技能已绑定其他行动或结算效果，不能单独改目标" };
    }
    const freeAction = this.pendingSkills.supplementalFreeActions[actionIndex]!;
    const preparedAction: PreparedPlayerAction = {
      actorId, kind: "card", cardId: skillId, cardName: skillId, tags: freeAction.tags, effect: freeAction.effect,
      targetIds: freeAction.targetIds, costPaid: 0, sCostBeforePayment: 0, sCostAfterPayment: 0, reserveBypassed: false,
    };
    const error = validatePlayerTargetSelection(this.pendingRound, preparedAction, targetIds);
    if (error) return { ok: false, reason: error };
    const group = getPlayerTargetGroup(this.pendingRound, preparedAction);
    if (!group) return { ok: false, reason: "当前没有合法目标组" };
    const skills = {
      ...this.pendingSkills,
      supplementalFreeActions: this.pendingSkills.supplementalFreeActions.map((action, index) => index === actionIndex
        ? { ...action, targetIds: group.candidateIds.filter((id) => targetIds.includes(id)) }
        : action),
    };
    this.pendingSkills = freezeDeep(skills);
    this.rebuildPendingRecipePlan();
    return { ok: true };
  }

  click(): BattleRuntimeView {
    if (!this.pendingRound || !this.pendingSkills || !this.pendingRecipePlan || this.state.result !== "ongoing") return this.getView();
    this.clickCount += 1;
    const resolution = resolveBattleRound(this.state, this.pendingRound, {
      recipePlan: this.pendingRecipePlan, skills: this.pendingSkills, attackMarkers: this.attackMarkers,
    });
    this.lastResolution = resolution;
    this.state = resolution.state;
    this.attackMarkers = [...resolution.pendingAttackMarkers];
    this.events.push(...resolution.events);
    this.pendingRound = null;
    this.pendingSkills = null;
    this.pendingRecipePlan = null;
    if (this.state.result === "ongoing") {
      const enemyIds = new Set(resolution.prepared.combatants.filter((actor) => actor.side === "enemy").map((actor) => actor.actorId));
      const previousRoundDamagedEnemyIds = resolution.deltas
        .filter((delta) => enemyIds.has(delta.actorId) && delta.hpAfter < delta.hpBefore)
        .map((delta) => delta.actorId);
      const party = this.input.party.map((member) => ({ ...member,
        hp: this.state.combatants.find((actor) => actor.actorId === member.definition.id)?.hp ?? member.hp,
        currentBattleSCost: this.state.partySCost.find((entry) => entry.actorId === member.definition.id)?.value ?? member.currentBattleSCost,
      }));
      const enemies = this.input.enemies.map((member) => ({ ...member,
        hp: this.state.combatants.find((actor) => actor.actorId === member.definition.id)?.hp ?? member.hp,
      }));
      this.prepare({ ...this.input, round: this.state.round + 1, party, enemies, previousRoundDamagedEnemyIds });
    }
    return this.getView();
  }

  private prepare(input: BattlePreparationInput): void {
    const prepared = prepareBattleRoundWithSkills(input, { nextInt: () => this.random.nextInt(1, 4) });
    this.pendingRound = prepared.round;
    this.pendingSkills = prepared.skills;
    this.pendingRecipePlan = freezeDeep(matchPreparedBattleRound(prepared.round, prepared.skills.supplementalFreeActions));
  }

  private rebuildPendingRecipePlan(): void {
    if (!this.pendingRound || !this.pendingSkills) return;
    this.pendingRecipePlan = freezeDeep(matchPreparedBattleRound(this.pendingRound, this.pendingSkills.supplementalFreeActions));
  }

  private playerActionRef(actorId: string): string {
    const index = this.pendingRound?.playerActions.findIndex((action) => action.actorId === actorId) ?? -1;
    return index < 0 ? "" : `player-action:${index}:${actorId}`;
  }

  private actionSkillRestriction(actorId: string, proposed: PreparedPlayerAction): string | null {
    if (!this.pendingRound || !this.pendingSkills) return "当前没有可编辑的待结算回合";
    const original = this.pendingRound.playerActions.find((action) => action.actorId === actorId);
    if (!original) return "本轮没有该 Chara 的行动";
    const boundEffect = this.pendingSkills.effects.some((effect) => {
      const index = this.pendingSkills!.supplementalFreeActions.findIndex((action) =>
        action.actorId === effect.sourceActorId && action.id === effect.skillId);
      return index >= 0 && effect.sourceActorId === actorId;
    });
    if (boundEffect && (proposed.cardId !== original.cardId || proposed.effect?.kind !== original.effect?.kind ||
      proposed.targetIds.length !== original.targetIds.length || proposed.targetIds.some((id, index) => id !== original.targetIds[index]))) {
      return "本轮免费技能已绑定原行动与目标，不能改选或改目标";
    }
    const actionId = this.playerActionRef(actorId);
    for (const modifier of this.pendingSkills.modifiers) {
      if (modifier.actionId !== actionId) continue;
      if (proposed.kind !== "card" || proposed.effect?.kind !== "attack") return "本轮技能修正要求保留攻击行动";
      if (modifier.skillId === "calibrated-sight" && !proposed.tags.includes("sniper")) return "校准镜要求保留狙击行动";
    }
    return null;
  }

  private getPlayerCardChoices(): readonly PlayerCardChoice[] {
    if (!this.pendingRound || this.state.result !== "ongoing") return [];
    const definitions = this.input.party.map((member) => member.definition);
    return this.input.party.flatMap((member) => listPlayerCardChoices(this.pendingRound!, definitions, member.definition.id)
      .map((choice) => {
        if (!choice.available) return choice;
        const built = buildEditedPlayerAction(this.pendingRound!, definitions, choice.actorId, choice.cardId, choice.targetIds);
        if (!built.ok) return { ...choice, available: false, disabledReason: built.reason };
        const affectedActors = new Set([choice.actorId, ...(built.fallbacks ?? []).map((fallback) => fallback.actorId)]);
        const skillReason = [...affectedActors].map((actorId) => {
          const proposed = built.playerActions.find((action) => action.actorId === actorId);
          return proposed ? this.actionSkillRestriction(actorId, proposed) : null;
        }).find((reason): reason is string => reason !== null);
        return skillReason ? { ...choice, available: false, disabledReason: skillReason } : choice;
      }));
  }

  private getTargetEditOptions(): readonly PlayerTargetEditOption[] {
    if (!this.pendingRound || !this.pendingSkills || this.state.result !== "ongoing") return [];
    const options: PlayerTargetEditOption[] = [];
    this.pendingRound.playerActions.forEach((action, index) => {
      if (action.kind !== "card" || !action.effect) return;
      const group = getPlayerTargetGroup(this.pendingRound!, action);
      const skillReason = this.pendingSkills!.effects.some((effect) => effect.sourceActorId === action.actorId)
        ? "本轮免费技能已绑定原行动与目标，不能改选或改目标"
        : this.actionSkillRestriction(action.actorId, action);
      const reason = skillReason ?? (!group ? "当前没有合法目标组" : !group.canChange ? "该目标组没有可替换成员" : null);
      options.push({
        ...(group ?? { candidateIds: [], fixedIds: [], defaultIds: [], requiredCount: 0, canChange: false }),
        cardRef: `player-action:${index}:${action.actorId}`, actorId: action.actorId, kind: "ordinary", skillId: null,
        targetIds: action.targetIds, editable: reason === null, disabledReason: reason,
      });
    });
    for (const check of this.pendingSkills.checks) {
      if (!check.triggered) continue;
      const freeAction = this.pendingSkills.supplementalFreeActions.find((action) => action.actorId === check.actorId && action.id === check.skillId);
      const skillEffect = this.pendingSkills.effects.some((effect) => effect.skillId === check.skillId && effect.sourceActorId === check.actorId);
      const modifier = this.pendingSkills.modifiers.some((entry) => entry.skillId === check.skillId && entry.sourceActorId === check.actorId);
      if (!freeAction) {
        options.push({ candidateIds: [], fixedIds: [], defaultIds: [], requiredCount: 0, canChange: false,
          cardRef: `special-skill:${check.actorId}:${check.skillId}`, actorId: check.actorId, kind: "free-skill", skillId: check.skillId,
          targetIds: [], editable: false, disabledReason: "该技能没有独立角色目标" });
        continue;
      }
      const action: PreparedPlayerAction = {
        actorId: check.actorId, kind: "card", cardId: check.skillId, cardName: check.skillId, tags: freeAction.tags,
        effect: freeAction.effect, targetIds: freeAction.targetIds, costPaid: 0, sCostBeforePayment: 0, sCostAfterPayment: 0, reserveBypassed: false,
      };
      const group = getPlayerTargetGroup(this.pendingRound, action);
      const reason = skillEffect || modifier ? "该技能已绑定其他行动或结算效果，不能单独改目标"
        : !group ? "当前没有合法目标组" : !group.canChange ? "该目标组没有可替换成员" : null;
      options.push({ ...(group ?? { candidateIds: [], fixedIds: [], defaultIds: [], requiredCount: 0, canChange: false }),
        cardRef: `special-skill:${check.actorId}:${check.skillId}`, actorId: check.actorId, kind: "free-skill", skillId: check.skillId,
        targetIds: freeAction.targetIds, editable: reason === null, disabledReason: reason });
    }
    return options;
  }
}

export interface GameplayBRouteJoinContent {
  readonly id: string;
  readonly roster: CharacterDefinition;
  readonly battle: import("./model.js").BattleCharacterDefinition;
}

export type RouteItemCondition =
  | { readonly kind: "has-item"; readonly itemId: string }
  | { readonly kind: "all" | "any"; readonly conditions: readonly RouteItemCondition[] }
  | { readonly kind: "not"; readonly condition: RouteItemCondition };

export interface GameplayBRouteExit {
  readonly id: string;
  readonly label: string;
  readonly targetNodeId: string;
  readonly condition?: RouteItemCondition;
  readonly consumeItems?: readonly string[];
}

interface GameplayBRouteNodeGraphFields {
  readonly area?: string;
  readonly exits?: readonly GameplayBRouteExit[];
  readonly maxVisits?: number;
  readonly noAvailableExitText?: string;
  readonly costGain?: number;
  readonly maxCarryCost?: number;
}

export interface GameplayBRouteSceneBehavior {
  readonly id: string;
  readonly label: string;
  readonly cost: number;
  readonly activity: LocationActivityDefinition;
  readonly targetMode?: "party" | "one" | "many";
  readonly successItems?: readonly string[];
}

export interface GameplayBRouteSceneChoices {
  readonly mode: "individual" | "global";
  readonly behaviors: readonly GameplayBRouteSceneBehavior[];
}

export type GameplayBRouteNode =
  | (GameplayBRouteNodeGraphFields & { readonly id: string; readonly name: string; readonly kind: "battle"; readonly battle: Pick<BattlePreparationInput, "encounterId" | "enemies"> })
  | {
      readonly exits?: readonly GameplayBRouteExit[];
      readonly maxVisits?: number;
      readonly noAvailableExitText?: string;
      readonly area?: string;
      readonly costGain?: number;
      readonly maxCarryCost?: number;
      readonly id: string;
      readonly name: string;
      readonly kind: "activity";
      readonly activityCount: number;
      readonly activity: LocationActivityDefinition;
      readonly sceneChoices?: GameplayBRouteSceneChoices;
      readonly onEnter?: readonly { readonly kind: "join-character"; readonly character: GameplayBRouteJoinContent }[];
      readonly nextBattleModifier?: {
        readonly initialSCostBonus?: number;
        readonly rechargeBonus?: { readonly amount: number; readonly fromRound: number };
      };
    }
  | (GameplayBRouteNodeGraphFields & { readonly id: string; readonly name: string; readonly kind: "exit"; readonly completionText: string; readonly activityCount?: number });

export interface GameplayBRouteRuntimeInput {
  readonly seed: number | string;
  readonly nodes: readonly GameplayBRouteNode[];
  readonly initialParty: readonly RouteInitialPartyMember[];
  readonly startNodeId?: string;
  readonly initialItems?: readonly string[];
  readonly initialPlayerCost?: number;
  readonly playerDeck?: RoutePlayerDeckDefinition;
}

export type RouteCommandOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: string };

interface MutableRouteCharacter {
  roster: CharacterDefinition;
  battle: import("./model.js").BattleCharacterDefinition;
  hp: number;
}

interface MutableRouteEvent {
  sequence: number;
  click: number;
  nodeId: string;
  locationId: string;
  type: RouteEventRecord["type"];
  actorId?: string;
  dice?: { sides: number; value: number };
  outcome?: RouteEventRecord["outcome"];
  success?: boolean;
  text: string;
}

interface MutableRouteModifier {
  initialSCostBonus?: number;
  rechargeBonus?: { amount: number; fromRound: number };
}

interface MutableSceneBehaviorSelection {
  behaviorId: string;
  targetIds: string[];
}

interface MutablePlayerCardSelection {
  cardId: string;
  targetIds: string[];
}

function cloneRouteCharacter(input: RouteInitialPartyMember): MutableRouteCharacter {
  const roster = structuredClone(input.roster);
  const battle = structuredClone(input.battle);
  const hp = input.hp ?? roster.initialHp;
  if (!roster.id || roster.id !== battle.id || roster.hpMax !== battle.hpMax || !Number.isInteger(hp) || hp < 0 || hp > roster.hpMax) {
    throw new RangeError(`Invalid route character ${roster.id}.`);
  }
  return { roster, battle, hp };
}

function validItemCondition(condition: RouteItemCondition): boolean {
  if (condition.kind === "has-item") return condition.itemId.trim().length > 0;
  if (condition.kind === "not") return validItemCondition(condition.condition);
  return condition.conditions.length > 0 && condition.conditions.every(validItemCondition);
}

function matchesItemCondition(condition: RouteItemCondition, heldItems: ReadonlySet<string>): boolean {
  if (condition.kind === "has-item") return heldItems.has(condition.itemId);
  if (condition.kind === "not") return !matchesItemCondition(condition.condition, heldItems);
  if (condition.kind === "all") return condition.conditions.every((entry) => matchesItemCondition(entry, heldItems));
  if (condition.kind === "any") return condition.conditions.some((entry) => matchesItemCondition(entry, heldItems));
  return false;
}

function validateRouteInput(input: GameplayBRouteRuntimeInput): void {
  if (!input.nodes.length) throw new RangeError("A route must contain at least one node.");
  if (input.initialPlayerCost !== undefined && (!Number.isInteger(input.initialPlayerCost) || input.initialPlayerCost < 0)) {
    throw new RangeError("Initial player Cost must be a non-negative integer.");
  }
  if (input.playerDeck) {
    const deck = input.playerDeck;
    if (input.startNodeId === undefined) throw new RangeError("A player card deck requires explicit graph mode.");
    if (!deck.cards.length || !Number.isInteger(deck.handLimit) || deck.handLimit < 1 ||
      !Number.isInteger(deck.openingHandSize) || deck.openingHandSize < 0 || deck.openingHandSize > deck.handLimit ||
      deck.openingHandSize > deck.cards.length || !Number.isInteger(deck.drawPerNodeEntry) || deck.drawPerNodeEntry < 0) {
      throw new RangeError("Invalid finite player card deck draw settings.");
    }
    const cardIds = new Set<string>();
    for (const card of deck.cards) {
      if (!card.id.trim() || cardIds.has(card.id) || !card.name.trim()) throw new RangeError(`Invalid or duplicate player card ID: ${card.id}.`);
      cardIds.add(card.id);
      if (!Number.isInteger(card.cost) || card.cost < 0) throw new RangeError(`Invalid Cost for player card ${card.id}.`);
      if (card.effect.kind === "heal" || card.effect.kind === "check-bonus") {
        if (!Number.isInteger(card.effect.amount) || card.effect.amount < 1 || !["party", "one", "many"].includes(card.effect.targetMode)) {
          throw new RangeError(`Invalid heal effect for player card ${card.id}.`);
        }
      } else if (!card.effect.itemId.trim()) {
        throw new RangeError(`Invalid item effect for player card ${card.id}.`);
      }
    }
  }
  const nodeIds = new Set<string>();
  for (const node of input.nodes) {
    if (!node.id || !node.name || nodeIds.has(node.id)) throw new RangeError(`Invalid or duplicate route node ID: ${node.id}`);
    nodeIds.add(node.id);
    if (node.kind === "activity" && (!Number.isInteger(node.activityCount) || node.activityCount < 1)) {
      throw new RangeError(`Invalid activity count for route node ${node.id}.`);
    }
  }
  if (input.initialItems?.some((itemId) => !itemId.trim())) throw new RangeError("Initial item IDs must not be empty.");
  if (input.startNodeId !== undefined) {
    if (!nodeIds.has(input.startNodeId)) throw new RangeError(`Unknown route start node: ${input.startNodeId}.`);
    const edgeIds = new Set<string>();
    for (const node of input.nodes) {
      if (!Number.isInteger(node.maxVisits) || (node.maxVisits ?? 0) < 1) {
        throw new RangeError(`Graph node ${node.id} must have a positive maxVisits.`);
      }
      if (!Number.isInteger(node.costGain) || (node.costGain ?? -1) < 0 || !Number.isInteger(node.maxCarryCost) || (node.maxCarryCost ?? -1) < 0) {
        throw new RangeError(`Graph node ${node.id} must define non-negative integer costGain and maxCarryCost.`);
      }
      if (node.kind === "exit" && node.exits?.length) throw new RangeError(`Terminal route node ${node.id} cannot have exits.`);
      if (node.kind !== "exit" && (!node.exits?.length || !node.noAvailableExitText?.trim())) {
        throw new RangeError(`Non-terminal graph node ${node.id} must define exits and a no-exit result.`);
      }
      if (node.kind !== "exit" && !node.exits?.some((exit) => exit.condition === undefined)) {
        throw new RangeError(`Graph node ${node.id} must define an unconditional fallback exit.`);
      }
      if (node.kind === "activity" && node.sceneChoices) {
        if (!node.sceneChoices.behaviors.length) throw new RangeError(`Graph activity ${node.id} must define at least one scene behavior.`);
        const behaviorIds = new Set<string>();
        for (const behavior of node.sceneChoices.behaviors) {
          if (!behavior.id.trim() || behaviorIds.has(behavior.id) || !behavior.label.trim()) {
            throw new RangeError(`Invalid or duplicate scene behavior ID on ${node.id}: ${behavior.id}.`);
          }
          behaviorIds.add(behavior.id);
          if (!Number.isInteger(behavior.cost) || behavior.cost < 0) throw new RangeError(`Invalid Cost for scene behavior ${behavior.id}.`);
          if (!behavior.activity.locationId.trim()) throw new RangeError(`Scene behavior ${behavior.id} must define a location ID.`);
          if (behavior.targetMode && !["party", "one", "many"].includes(behavior.targetMode)) {
            throw new RangeError(`Invalid target mode for scene behavior ${behavior.id}.`);
          }
          if (new Set(behavior.successItems ?? []).size !== (behavior.successItems ?? []).length || behavior.successItems?.some((itemId) => !itemId.trim())) {
            throw new RangeError(`Invalid or duplicate success item on scene behavior ${behavior.id}.`);
          }
        }
      }
      for (const exit of node.exits ?? []) {
        if (!exit.id.trim() || edgeIds.has(exit.id)) throw new RangeError(`Invalid or duplicate route exit ID: ${exit.id}.`);
        edgeIds.add(exit.id);
        if (!exit.label.trim() || !nodeIds.has(exit.targetNodeId)) throw new RangeError(`Invalid route exit target or label: ${exit.id}.`);
        if (exit.condition && !validItemCondition(exit.condition)) throw new RangeError(`Invalid item condition on route exit ${exit.id}.`);
        if (new Set(exit.consumeItems ?? []).size !== (exit.consumeItems ?? []).length || exit.consumeItems?.some((itemId) => !itemId.trim())) {
          throw new RangeError(`Invalid or duplicate consumed item on route exit ${exit.id}.`);
        }
      }
    }
  } else if (input.nodes.some((node) => node.exits !== undefined || node.maxVisits !== undefined || node.costGain !== undefined ||
    node.maxCarryCost !== undefined || (node.kind === "activity" && node.sceneChoices !== undefined))) {
    throw new RangeError("Explicit graph nodes require a startNodeId.");
  }
  if (!input.initialParty.length) throw new RangeError("A route must start with at least one character.");
  const characterIds = new Set<string>();
  for (const character of input.initialParty) {
    const copy = cloneRouteCharacter(character);
    if (characterIds.has(copy.roster.id)) throw new RangeError(`Duplicate route character ID: ${copy.roster.id}`);
    characterIds.add(copy.roster.id);
  }
}

const ROUTE_BASE_SCOST = 2;

export class GameplayBRouteRuntime {
  private readonly input: GameplayBRouteRuntimeInput;
  private readonly random: SeededRandom;
  private readonly party: MutableRouteCharacter[];
  private readonly appliedEntryActions = new Set<string>();
  private readonly enteredNodeIds = new Set<string>();
  private readonly nodeVisitCounts = new Map<string, number>();
  private readonly heldItems: Set<string>;
  private playerCost: number;
  private readonly individualSceneSelections = new Map<string, MutableSceneBehaviorSelection>();
  private globalSceneSelection: MutableSceneBehaviorSelection | null = null;
  private readonly playerDeck: RoutePlayerDeckDefinition | null;
  private readonly playerCardsById = new Map<string, RoutePlayerCardDefinition>();
  private readonly drawPile: string[] = [];
  private readonly playerCardHand: string[] = [];
  private readonly usedPlayerCards: string[] = [];
  private readonly pendingPlayerCards = new Map<string, MutablePlayerCardSelection>();
  private cardRunStarted = false;
  private awaitingExitChoice = false;
  private availableExits: GameplayBRouteExit[] = [];
  private readonly registeredModifierNodeIds = new Set<string>();
  private readonly pendingModifiers: MutableRouteModifier[] = [];
  private readonly events: MutableRouteEvent[] = [];
  private nodeIndex = 0;
  private activityRemaining: number | null = null;
  private currentBattle: GameplayBBattleRuntime | null = null;
  private battleSequence = 0;
  private clickCount = 0;
  private result: RouteTerminalResult = "ongoing";
  private terminal = false;

  constructor(input: GameplayBRouteRuntimeInput) {
    validateRouteInput(input);
    this.input = structuredClone(input);
    this.random = new SeededRandom(input.seed);
    this.party = input.initialParty.map(cloneRouteCharacter);
    this.heldItems = new Set(input.initialItems ?? []);
    this.playerCost = input.initialPlayerCost ?? 0;
    this.playerDeck = input.playerDeck ? structuredClone(input.playerDeck) : null;
    if (this.playerDeck) {
      for (const card of this.playerDeck.cards) {
        this.playerCardsById.set(card.id, card);
        this.drawPile.push(card.id);
      }
      for (let index = this.drawPile.length - 1; index > 0; index -= 1) {
        const swapIndex = this.random.nextInt(0, index);
        [this.drawPile[index], this.drawPile[swapIndex]] = [this.drawPile[swapIndex]!, this.drawPile[index]!];
      }
    }
    this.nodeIndex = this.input.nodes.findIndex((node) => node.id === (this.input.startNodeId ?? this.input.nodes[0]!.id));
    if (this.party.every((character) => character.hp === 0)) {
      this.finish("defeat", this.input.startNodeId ?? this.input.nodes[0]!.id, "全队倒地，路线立即结束。");
      return;
    }
    this.enterNode(this.input.startNodeId ?? this.input.nodes[0]!.id);
  }

  getView(): GameplayBRouteView {
    const node = this.input.nodes[this.nodeIndex]!;
    const currentBattle = this.currentBattle?.getView() ?? null;
    const visibleSCost = currentBattle?.pendingRound?.partyStartSCost ?? currentBattle?.state.partySCost;
    const party: RoutePartyView[] = this.party.map((character) => ({
      id: character.roster.id,
      name: character.roster.name,
      row: character.roster.row,
      hp: character.hp,
      hpMax: character.roster.hpMax,
      atk: character.roster.atk,
      def: character.roster.def,
      activityTags: [...character.roster.activityTags],
      currentBattleSCost: visibleSCost?.find((entry) => entry.actorId === character.roster.id)?.value ?? null,
    }));
    return freezeDeep({
      seed: this.input.seed,
      rngCursor: this.random.cursor,
      clickCount: this.clickCount,
      nodeIndex: this.nodeIndex,
      nodeCount: this.input.nodes.length,
      currentNode: { id: node.id, name: node.name, kind: node.kind, ...(node.area ? { area: node.area } : {}) },
      playerCost: this.playerCost,
      sceneChoice: !this.awaitingExitChoice && !this.terminal && node.kind === "activity" && node.sceneChoices
        ? this.getSceneChoiceView(node.sceneChoices) : null,
      playerDeck: this.getPlayerDeckView(),
      awaitingExitChoice: this.awaitingExitChoice,
      availableExits: this.availableExits.map(({ id, label, targetNodeId }) => ({ id, label, targetNodeId })),
      heldItems: [...this.heldItems].sort(),
      nodeVisitCounts: Object.fromEntries(this.nodeVisitCounts),
      activityRemaining: node.kind === "activity" ? this.activityRemaining : null,
      party,
      currentBattle,
      events: structuredClone(this.events),
      result: this.result,
      terminal: this.terminal,
    });
  }

  private getSceneChoiceView(sceneChoices: GameplayBRouteSceneChoices): RouteSceneChoiceView {
    const requiredActorIds = sceneChoices.mode === "individual"
      ? this.party.filter((character) => character.hp > 0).map((character) => character.roster.id)
      : [];
    const selections = sceneChoices.mode === "individual"
      ? requiredActorIds.flatMap((actorId) => {
        const selection = this.individualSceneSelections.get(actorId);
        return selection ? [{ actorId, behaviorId: selection.behaviorId, targetIds: [...selection.targetIds] }] : [];
      })
      : this.globalSceneSelection ? [{ behaviorId: this.globalSceneSelection.behaviorId, targetIds: [...this.globalSceneSelection.targetIds] }] : [];
    const selectedPlayerCards = this.playerCardHand.flatMap((cardId) => {
      const selection = this.pendingPlayerCards.get(cardId);
      return selection ? [{ cardId, targetIds: [...selection.targetIds] }] : [];
    });
    const behaviorCost = selections.reduce((total, selection) => {
      const behavior = sceneChoices.behaviors.find((candidate) => candidate.id === selection.behaviorId);
      return total + (behavior?.cost ?? 0);
    }, 0);
    const cardCost = selectedPlayerCards.reduce((total, selection) => total + (this.playerCardsById.get(selection.cardId)?.cost ?? 0), 0);
    const totalCost = behaviorCost + cardCost;
    const ready = sceneChoices.mode === "individual"
      ? requiredActorIds.every((actorId) => this.individualSceneSelections.has(actorId))
      : this.globalSceneSelection !== null;
    const blockedReason = !ready ? "请先为本批次选择所有行动。"
      : totalCost > this.playerCost ? `玩家 Cost 不足：需要 ${totalCost}，当前 ${this.playerCost}。` : null;
    return {
      mode: sceneChoices.mode,
      behaviors: sceneChoices.behaviors.map((behavior) => ({ id: behavior.id, label: behavior.label, cost: behavior.cost,
        targetMode: behavior.targetMode ?? "party" })),
      requiredActorIds,
      selections,
      selectedPlayerCards,
      totalCost,
      ready,
      canConfirm: ready && totalCost <= this.playerCost,
      blockedReason,
    };
  }

  private getPlayerDeckView(): RoutePlayerDeckView | null {
    if (!this.playerDeck) return null;
    return {
      hand: this.playerCardHand.map((cardId) => structuredClone(this.playerCardsById.get(cardId)!)),
      drawPileCount: this.drawPile.length,
      usedCardIds: [...this.usedPlayerCards],
      pendingCards: this.playerCardHand.flatMap((cardId) => {
        const selection = this.pendingPlayerCards.get(cardId);
        return selection ? [{ cardId, targetIds: [...selection.targetIds] }] : [];
      }),
      handLimit: this.playerDeck.handLimit,
    };
  }

  editPlayerAction(actorId: string, cardId: string | null, targetIds: readonly string[]): PlayerEditOutcome {
    if (this.terminal || !this.currentBattle) return { ok: false, reason: "当前场所没有可编辑的战斗行动" };
    return this.currentBattle.editPlayerAction(actorId, cardId, targetIds);
  }

  editFreeSkillTargets(actorId: string, skillId: string, targetIds: readonly string[]): PlayerEditOutcome {
    if (this.terminal || !this.currentBattle) return { ok: false, reason: "当前场所没有可编辑的战斗行动" };
    return this.currentBattle.editFreeSkillTargets(actorId, skillId, targetIds);
  }

  selectIndividualBehavior(actorId: string, behaviorId: string): RouteCommandOutcome {
    const node = this.input.nodes[this.nodeIndex];
    if (this.terminal || this.awaitingExitChoice || node?.kind !== "activity" || node.sceneChoices?.mode !== "individual") {
      return { ok: false, reason: "当前场景没有逐角色行为选择" };
    }
    const character = this.party.find((member) => member.roster.id === actorId);
    if (!character || character.hp <= 0) return { ok: false, reason: "只有仍可行动的在队角色可以选择行为" };
    if (!node.sceneChoices.behaviors.some((behavior) => behavior.id === behaviorId)) return { ok: false, reason: "所选场景行为不可用" };
    this.individualSceneSelections.set(actorId, { behaviorId, targetIds: [] });
    return { ok: true };
  }

  selectGlobalBehavior(behaviorId: string, targetIds: readonly string[] = []): RouteCommandOutcome {
    const node = this.input.nodes[this.nodeIndex];
    if (this.terminal || this.awaitingExitChoice || node?.kind !== "activity" || node.sceneChoices?.mode !== "global") {
      return { ok: false, reason: "当前场景没有全局行为选择" };
    }
    const behavior = node.sceneChoices.behaviors.find((candidate) => candidate.id === behaviorId);
    if (!behavior) return { ok: false, reason: "所选场景行为不可用" };
    const mode = behavior.targetMode ?? "party";
    const uniqueTargets = new Set(targetIds);
    if (uniqueTargets.size !== targetIds.length || targetIds.some((id) => !this.party.some((member) => member.roster.id === id))) {
      return { ok: false, reason: "目标重复或不在当前队伍中" };
    }
    if ((mode === "party" && targetIds.length !== 0) || (mode === "one" && targetIds.length !== 1) ||
      (mode === "many" && targetIds.length === 0)) {
      return { ok: false, reason: "目标数量与该行为的目标规则不符" };
    }
    this.globalSceneSelection = { behaviorId, targetIds: [...targetIds] };
    return { ok: true };
  }

  selectPlayerCard(cardId: string, targetIds: readonly string[] = []): RouteCommandOutcome {
    const node = this.input.nodes[this.nodeIndex];
    if (this.terminal || this.awaitingExitChoice || !this.playerDeck || node?.kind !== "activity" || !node.sceneChoices) {
      return { ok: false, reason: "当前场景不能打出路线卡" };
    }
    if (!this.playerCardHand.includes(cardId)) return { ok: false, reason: "该卡不在当前手牌中" };
    const card = this.playerCardsById.get(cardId)!;
    const uniqueTargets = new Set(targetIds);
    if (uniqueTargets.size !== targetIds.length || targetIds.some((id) => !this.party.some((member) => member.roster.id === id))) {
      return { ok: false, reason: "目标重复或不在当前队伍中" };
    }
    if (card.effect.kind === "gain-item") {
      if (targetIds.length) return { ok: false, reason: "获得物品卡不接受角色目标" };
    } else {
      const mode = card.effect.targetMode;
      if ((mode === "party" && targetIds.length !== 0) || (mode === "one" && targetIds.length !== 1) ||
        (mode === "many" && targetIds.length === 0)) {
        return { ok: false, reason: "目标数量与卡牌效果的目标规则不符" };
      }
    }
    this.pendingPlayerCards.set(cardId, { cardId, targetIds: [...targetIds] });
    return { ok: true };
  }

  unselectPlayerCard(cardId: string): RouteCommandOutcome {
    if (!this.pendingPlayerCards.has(cardId)) return { ok: false, reason: "该卡没有选入当前批次" };
    this.pendingPlayerCards.delete(cardId);
    return { ok: true };
  }

  click(): GameplayBRouteView {
    if (this.terminal || this.awaitingExitChoice) return this.getView();
    const node = this.input.nodes[this.nodeIndex]!;
    if (node.kind === "activity" && node.sceneChoices) {
      if (!this.getSceneChoiceView(node.sceneChoices).canConfirm) return this.getView();
      this.clickCount += 1;
      this.resolveSceneChoiceClick(node);
      return this.getView();
    }
    this.clickCount += 1;
    if (node.kind === "activity") this.resolveActivityClick(node);
    else if (node.kind === "battle") this.resolveBattleClick(node);
    else this.completeRoute(node);
    return this.getView();
  }

  chooseExit(exitId: string): RouteCommandOutcome {
    if (this.terminal || !this.awaitingExitChoice) return { ok: false, reason: "当前场景还没有可选择的出口" };
    const exit = this.availableExits.find((candidate) => candidate.id === exitId);
    if (!exit) return { ok: false, reason: "所选出口当前不可用" };
    const itemsToConsume = exit.consumeItems ?? [];
    if (itemsToConsume.some((itemId) => !this.heldItems.has(itemId))) return { ok: false, reason: "离开所需物品不足" };
    const target = this.input.nodes.find((candidate) => candidate.id === exit.targetNodeId);
    if (!target || (this.nodeVisitCounts.get(target.id) ?? 0) >= (target.maxVisits ?? 0)) {
      return { ok: false, reason: "目标场景已达到访问上限" };
    }
    this.clickCount += 1;
    this.awaitingExitChoice = false;
    this.availableExits = [];
    const sourceNodeId = this.input.nodes[this.nodeIndex]!.id;
    const sourceNode = this.input.nodes[this.nodeIndex]!;
    this.appendEvent({ nodeId: sourceNodeId, locationId: sourceNodeId,
      type: "exit-chosen", text: `选择出口“${exit.label}”，前往${target.name}。` });
    for (const itemId of itemsToConsume) {
      this.heldItems.delete(itemId);
      this.appendEvent({ nodeId: sourceNodeId, locationId: sourceNodeId,
        type: "exit-item-consumed", text: `离开场景时消耗持有物：${itemId}。` });
    }
    if (sourceNode.maxCarryCost !== undefined && this.playerCost > sourceNode.maxCarryCost) {
      const previousCost = this.playerCost;
      this.playerCost = sourceNode.maxCarryCost;
      this.appendEvent({ nodeId: sourceNodeId, locationId: sourceNodeId, type: "player-cost-capped",
        text: `离开场景携带上限 ${sourceNode.maxCarryCost}，Cost 从 ${previousCost} 收敛至 ${this.playerCost}。` });
    }
    this.enterNode(target.id);
    return { ok: true };
  }

  private enterNode(nodeId: string): void {
    const index = this.input.nodes.findIndex((candidate) => candidate.id === nodeId);
    if (index < 0) throw new RangeError(`Unknown route node: ${nodeId}.`);
    this.nodeIndex = index;
    this.currentBattle = null;
    this.awaitingExitChoice = false;
    this.availableExits = [];
    this.individualSceneSelections.clear();
    this.globalSceneSelection = null;
    this.pendingPlayerCards.clear();
    const node = this.input.nodes[index]!;
    const visitCount = (this.nodeVisitCounts.get(node.id) ?? 0) + 1;
    if (this.input.startNodeId && visitCount > (node.maxVisits ?? 0)) throw new RangeError(`Route node ${node.id} exceeded maxVisits.`);
    this.nodeVisitCounts.set(node.id, visitCount);
    this.appendEvent({ nodeId: node.id, locationId: node.id, type: "node-entered", text: `进入节点：${node.name}${visitCount > 1 ? `（第 ${visitCount} 次）` : ""}。` });
    const firstEntry = !this.enteredNodeIds.has(node.id);
    this.enteredNodeIds.add(node.id);
    if (this.input.startNodeId && (node.costGain ?? 0) > 0) {
      this.playerCost += node.costGain!;
      this.appendEvent({ nodeId: node.id, locationId: node.id, type: "player-cost-gained",
        text: `进入场景增加 ${node.costGain} 点玩家 Cost，当前 ${this.playerCost}。` });
    }
    if (this.playerDeck) {
      const drawCount = this.cardRunStarted ? this.playerDeck.drawPerNodeEntry : this.playerDeck.openingHandSize;
      this.cardRunStarted = true;
      this.drawPlayerCards(node.id, drawCount);
    }
    if (node.kind === "activity") {
      this.activityRemaining = node.activityCount;
      for (const action of node.onEnter ?? []) {
        if (action.kind !== "join-character") continue;
        const character = action.character;
        const actionKey = JSON.stringify([node.id, character.id]);
        if (!firstEntry || this.appliedEntryActions.has(actionKey)) continue;
        this.appliedEntryActions.add(actionKey);
        if (this.party.some((member) => member.roster.id === character.id)) continue;
        const joined = cloneRouteCharacter({ roster: character.roster, battle: character.battle });
        this.party.push(joined);
        this.appendEvent({ nodeId: node.id, locationId: node.id, type: "character-joined", actorId: character.id,
          text: `${character.roster.name}加入队伍。` });
      }
      if (node.nextBattleModifier && !this.registeredModifierNodeIds.has(node.id)) {
        this.registeredModifierNodeIds.add(node.id);
        this.pendingModifiers.push(structuredClone(node.nextBattleModifier));
      }
    } else if (node.kind === "battle") {
      this.prepareBattle(node);
    } else {
      this.activityRemaining = null;
    }
  }

  private drawPlayerCards(nodeId: string, count: number): void {
    if (!this.playerDeck) return;
    let drawn = 0;
    while (drawn < count && this.drawPile.length > 0 && this.playerCardHand.length < this.playerDeck.handLimit) {
      const cardId = this.drawPile.shift()!;
      this.playerCardHand.push(cardId);
      const card = this.playerCardsById.get(cardId)!;
      this.appendEvent({ nodeId, locationId: nodeId, type: "player-card-drawn",
        text: `抽到场景卡“${card.name}”，手牌 ${this.playerCardHand.length}/${this.playerDeck.handLimit}。` });
      drawn += 1;
    }
  }

  private completeCurrentNode(node: GameplayBRouteNode): void {
    if (!this.input.startNodeId) {
      const nextNode = this.input.nodes[this.nodeIndex + 1];
      if (nextNode) this.enterNode(nextNode.id);
      else this.finish("complete", node.id, "路线完成。");
      return;
    }
    const available = (node.exits ?? []).filter((exit) => {
      if (exit.condition && !matchesItemCondition(exit.condition, this.heldItems)) return false;
      if ((exit.consumeItems ?? []).some((itemId) => !this.heldItems.has(itemId))) return false;
      const target = this.input.nodes.find((candidate) => candidate.id === exit.targetNodeId);
      return !!target && (this.nodeVisitCounts.get(target.id) ?? 0) < (target.maxVisits ?? 0);
    });
    if (!available.length) {
      this.finish("stranded", node.id, node.noAvailableExitText ?? "没有可继续前进的出口，行动结束。");
      return;
    }
    this.awaitingExitChoice = true;
    this.availableExits = available.map((exit) => structuredClone(exit));
    this.appendEvent({ nodeId: node.id, locationId: node.id, type: "exit-options",
      text: `场景完成，可选出口：${available.map((exit) => exit.label).join("、")}。` });
  }

  private prepareBattle(node: Extract<GameplayBRouteNode, { kind: "battle" }>): void {
    const initialSCostBonus = this.pendingModifiers.reduce((sum, modifier) => sum + (modifier.initialSCostBonus ?? 0), 0);
    const rechargeByRound = new Map<number, number>();
    for (const modifier of this.pendingModifiers) if (modifier.rechargeBonus) {
      const round = modifier.rechargeBonus.fromRound;
      rechargeByRound.set(round, (rechargeByRound.get(round) ?? 0) + modifier.rechargeBonus.amount);
    }
    if (rechargeByRound.size > 1) throw new RangeError("A battle cannot combine recharge bonuses with different start rounds.");
    const firstRecharge = [...rechargeByRound].at(0);
    const battleInput: BattlePreparationInput = {
      encounterId: node.battle.encounterId,
      round: 1,
      party: this.party.map((character) => ({ definition: structuredClone(character.battle), hp: character.hp, currentBattleSCost: ROUTE_BASE_SCOST })),
      enemies: structuredClone(node.battle.enemies),
      ...(initialSCostBonus > 0 ? { initialSCostBonus } : {}),
      ...(firstRecharge ? { rechargeBonus: { amount: firstRecharge[1], fromRound: firstRecharge[0] } } : {}),
    };
    this.pendingModifiers.length = 0;
    this.battleSequence += 1;
    const seed = `route-battle:${String(this.input.seed)}:${node.id}:${this.battleSequence}`;
    this.currentBattle = new GameplayBBattleRuntime(battleInput, seed);
  }

  private resolveSceneChoiceClick(node: Extract<GameplayBRouteNode, { kind: "activity" }>): void {
    const scene = node.sceneChoices;
    if (!scene) throw new Error(`Activity node ${node.id} has no scene choices.`);
    const selections: Array<MutableSceneBehaviorSelection & { actorId?: string }> = scene.mode === "individual"
      ? this.party.flatMap((character) => {
        const selection = this.individualSceneSelections.get(character.roster.id);
        return selection ? [{ actorId: character.roster.id, ...structuredClone(selection) }] : [];
      })
      : this.globalSceneSelection ? [structuredClone(this.globalSceneSelection)] : [];
    const behaviorCost = selections.reduce((total, selection) => total +
      (scene.behaviors.find((behavior) => behavior.id === selection.behaviorId)?.cost ?? 0), 0);
    const selectedCards = this.playerCardHand.flatMap((cardId) => {
      const selection = this.pendingPlayerCards.get(cardId);
      return selection ? [{ card: this.playerCardsById.get(cardId)!, targetIds: [...selection.targetIds] }] : [];
    });
    const totalCost = behaviorCost + selectedCards.reduce((total, selection) => total + selection.card.cost, 0);
    this.playerCost -= totalCost;
    if (totalCost > 0) this.appendEvent({ nodeId: node.id, locationId: node.id, type: "player-cost-paid",
      text: `本批场景行为与主动卡共支付 ${totalCost} 点玩家 Cost，剩余 ${this.playerCost}。` });

    const checkBonuses = new Map<string, number>();
    for (const selection of selectedCards) if (selection.card.effect.kind === "check-bonus") {
      const targets = selection.card.effect.targetMode === "party" ? this.party.map((character) => character.roster.id) : selection.targetIds;
      for (const actorId of targets) checkBonuses.set(actorId, (checkBonuses.get(actorId) ?? 0) + selection.card.effect.amount);
    }
    for (const selection of selectedCards) this.resolvePlayerCard(node, selection.card, selection.targetIds);
    this.pendingPlayerCards.clear();

    for (const selection of selections) {
      const behavior = scene.behaviors.find((candidate) => candidate.id === selection.behaviorId)!;
      const targetIds = selection.actorId ? [selection.actorId]
        : selection.targetIds.length ? selection.targetIds : this.party.map((character) => character.roster.id);
      const targetIdSet = new Set(targetIds);
      const actorName = selection.actorId ? this.party.find((character) => character.roster.id === selection.actorId)?.roster.name : undefined;
      this.appendEvent({ nodeId: node.id, locationId: behavior.activity.locationId, type: "scene-behavior",
        ...(selection.actorId ? { actorId: selection.actorId } : {}),
        text: `${actorName ? `${actorName}选择` : "全局选择"}“${behavior.label}”（${behavior.cost} Cost）。` });

      const snapshots = this.party.map((character) => ({
        id: character.roster.id,
        name: character.roster.name,
        inParty: targetIdSet.has(character.roster.id),
        hp: character.hp,
        hpMax: character.roster.hpMax,
        atk: character.roster.atk,
        def: character.roster.def,
        activityTags: [...character.roster.activityTags],
      }));
      const check = behavior.activity.individualCheck;
      const targetSnapshots = snapshots.filter((character) => character.inParty);
      const eligible = targetSnapshots.filter((character) => character.hp > 0 ||
        behavior.activity.fixedEffects.reduce((hp, effect) => Math.min(character.hpMax, hp + effect.amount), character.hp) > 0);
      const rawDiceByActor = new Map<string, number>();
      const bonusByActor = new Map<string, number>();
      const rolls = check ? eligible.map((character) => {
        const rawValue = this.random.nextInt(1, check.dieSides);
        const bonus = checkBonuses.get(character.id) ?? 0;
        rawDiceByActor.set(character.id, rawValue);
        bonusByActor.set(character.id, bonus);
        return { actorId: character.id, value: Math.min(check.dieSides, rawValue + bonus) };
      }) : [];
      const resolution = resolveActivity({ party: snapshots, activity: behavior.activity, rolls });

      for (const delta of resolution.hpDeltas) {
        const character = this.party.find((member) => member.roster.id === delta.actorId);
        if (character) character.hp = delta.hpAfter;
      }
      for (const event of resolution.events) {
        if (event.type === "fixed-effect") {
          this.appendEvent({ nodeId: node.id, locationId: event.locationId, type: "activity-fixed-effect", text: event.text });
        } else {
          this.appendEvent({ nodeId: node.id, locationId: event.locationId, type: "activity-result", actorId: event.result.actorId,
            dice: { sides: event.result.dice.sides, value: rawDiceByActor.get(event.result.actorId) ?? event.result.dice.value,
              ...(bonusByActor.get(event.result.actorId) ? { bonus: bonusByActor.get(event.result.actorId), modifiedValue: event.result.dice.value } : {}) },
            outcome: event.result.outcome, success: event.result.success,
            text: `${this.party.find((member) => member.roster.id === event.result.actorId)?.roster.name ?? event.result.actorId}：${event.result.text}` });
        }
      }

      if (behavior.successItems?.length) {
        const successfulActorIds = behavior.activity.individualCheck
          ? resolution.individualResults.filter((result) => result.success).map((result) => result.actorId)
          : targetIds;
        for (const actorId of successfulActorIds) for (const itemId of behavior.successItems) {
          if (this.heldItems.has(itemId)) continue;
          this.heldItems.add(itemId);
          this.appendEvent({ nodeId: node.id, locationId: behavior.activity.locationId, type: "item-gained", actorId,
            text: `${this.party.find((member) => member.roster.id === actorId)?.roster.name ?? actorId}获得持有物：${itemId}。` });
        }
      }
    }

    this.individualSceneSelections.clear();
    this.globalSceneSelection = null;
    this.activityRemaining = (this.activityRemaining ?? node.activityCount) - 1;
    this.appendEvent({ nodeId: node.id, locationId: node.id, type: "activity-progress",
      text: `本次场景行动完成，剩余行动批次 ${this.activityRemaining}。` });
    if (this.party.every((character) => character.hp === 0)) {
      this.finish("defeat", node.id, "全队倒地，路线立即结束。");
      return;
    }
    if (this.activityRemaining === 0) this.completeCurrentNode(node);
  }

  private resolvePlayerCard(node: Extract<GameplayBRouteNode, { kind: "activity" }>, card: RoutePlayerCardDefinition, targetIds: readonly string[]): void {
    this.playerCardHand.splice(this.playerCardHand.indexOf(card.id), 1);
    this.usedPlayerCards.push(card.id);
    this.appendEvent({ nodeId: node.id, locationId: node.id, type: "player-card-played",
      text: `打出场景卡“${card.name}”，支付 ${card.cost} 点 Cost。` });
    if (card.effect.kind === "gain-item") {
      if (this.heldItems.has(card.effect.itemId)) {
        this.appendEvent({ nodeId: node.id, locationId: node.id, type: "player-card-effect",
          text: `卡牌效果未改变物品：已持有 ${card.effect.itemId}。` });
      } else {
        this.heldItems.add(card.effect.itemId);
        this.appendEvent({ nodeId: node.id, locationId: node.id, type: "item-gained",
          text: `卡牌“${card.name}”获得持有物：${card.effect.itemId}。` });
      }
      return;
    }
    const targets = card.effect.targetMode === "party" ? this.party.map((character) => character.roster.id) : targetIds;
    if (card.effect.kind === "check-bonus") {
      for (const actorId of targets) this.appendEvent({ nodeId: node.id, locationId: node.id, type: "player-card-effect", actorId,
        text: `卡牌“${card.name}”使 ${this.party.find((character) => character.roster.id === actorId)?.roster.name ?? actorId} 本批个人检定 +${card.effect.amount}。` });
      return;
    }
    for (const actorId of targets) {
      const character = this.party.find((member) => member.roster.id === actorId)!;
      const hpBefore = character.hp;
      character.hp = Math.min(character.roster.hpMax, character.hp + card.effect.amount);
      this.appendEvent({ nodeId: node.id, locationId: node.id, type: "player-card-effect", actorId,
        text: `卡牌“${card.name}”使 ${character.roster.name} 恢复 ${character.hp - hpBefore} HP（${hpBefore}→${character.hp}）。` });
    }
  }

  private resolveActivityClick(node: Extract<GameplayBRouteNode, { kind: "activity" }>): void {
    const snapshots = this.party.map((character) => ({
      id: character.roster.id,
      name: character.roster.name,
      inParty: true,
      hp: character.hp,
      hpMax: character.roster.hpMax,
      atk: character.roster.atk,
      def: character.roster.def,
      activityTags: [...character.roster.activityTags],
    }));
    const eligibleIds = new Set<string>();
    for (const character of snapshots) {
      let hp = character.hp;
      for (const fixedEffect of node.activity.fixedEffects) hp = Math.min(character.hpMax, hp + fixedEffect.amount);
      if (hp > 0) eligibleIds.add(character.id);
    }
    const check = node.activity.individualCheck;
    const rolls = check ? snapshots.filter((character) => eligibleIds.has(character.id)).map((character) => ({
      actorId: character.id,
      value: this.random.nextInt(1, check.dieSides),
    })) : [];
    const resolution = resolveActivity({ party: snapshots, activity: node.activity, rolls });
    for (const delta of resolution.hpDeltas) {
      const character = this.party.find((member) => member.roster.id === delta.actorId);
      if (character) character.hp = delta.hpAfter;
    }
    for (const event of resolution.events) {
      if (event.type === "fixed-effect") {
        this.appendEvent({ nodeId: node.id, locationId: event.locationId, type: "activity-fixed-effect", text: event.text });
      } else {
        this.appendEvent({ nodeId: node.id, locationId: event.locationId, type: "activity-result", actorId: event.result.actorId,
          dice: event.result.dice, outcome: event.result.outcome, success: event.result.success,
          text: `${this.party.find((member) => member.roster.id === event.result.actorId)?.roster.name ?? event.result.actorId}：${event.result.text}` });
      }
    }
    this.activityRemaining = (this.activityRemaining ?? node.activityCount) - 1;
    this.appendEvent({ nodeId: node.id, locationId: node.activity.locationId, type: "activity-progress",
      text: `本次活动完成，剩余活动度 ${this.activityRemaining}。` });
    if (resolution.partyDefeated) {
      this.finish("defeat", node.id, "全队倒地，路线立即结束。");
      return;
    }
    if (this.activityRemaining === 0) this.completeCurrentNode(node);
  }

  private resolveBattleClick(node: Extract<GameplayBRouteNode, { kind: "battle" }>): void {
    if (!this.currentBattle) throw new Error(`Battle node ${node.id} has not been prepared.`);
    const before = this.currentBattle.getView();
    const view = this.currentBattle.click();
    for (const character of this.party) {
      const actor = view.state.combatants.find((combatant) => combatant.actorId === character.roster.id);
      if (actor) character.hp = actor.hp;
    }
    for (const eventText of view.events.slice(before.events.length)) {
      this.appendEvent({ nodeId: node.id, locationId: node.battle.encounterId, type: "battle-event", text: eventText });
    }
    if (!view.terminal) return;
    const battleResult = view.state.result;
    this.appendEvent({ nodeId: node.id, locationId: node.battle.encounterId, type: "battle-ended", text: `战斗结束：${battleResult}。` });
    if (battleResult === "victory") {
      this.currentBattle = null;
      this.completeCurrentNode(node);
    } else if (battleResult === "defeat" || battleResult === "draw") {
      this.finish(battleResult, node.id, `路线以${battleResult === "defeat" ? "失败" : "平局"}结束。`);
    }
  }

  private completeRoute(node: Extract<GameplayBRouteNode, { kind: "exit" }>): void {
    this.finish("complete", node.id, node.completionText);
  }

  private finish(result: Exclude<RouteTerminalResult, "ongoing">, nodeId: string, text: string): void {
    this.result = result;
    this.terminal = true;
    this.awaitingExitChoice = false;
    this.availableExits = [];
    this.activityRemaining = null;
    this.appendEvent({ nodeId, locationId: nodeId, type: "route-terminal", text });
  }

  private appendEvent(event: Omit<MutableRouteEvent, "sequence" | "click">): void {
    this.events.push({ sequence: this.events.length + 1, click: this.clickCount, ...event });
  }
}
