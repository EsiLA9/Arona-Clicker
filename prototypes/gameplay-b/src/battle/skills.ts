import type {
  BattleActionEffect, BattleCombatantSnapshot, PreparedBattleRound, PreparedPlayerAction,
  SupplementalFreeBattleAction,
} from "../model.js";
import { characterSkills, type CharacterSkillCondition, type CharacterSkillDefinition } from "../content/characters.js";

export interface SkillRandom {
  nextInt(): number;
}

export type SkillCheckStatus = "ineligible" | "condition-not-met" | "not-triggered" | "triggered" | "triggered-no-target";

export interface SkillCheckResult {
  readonly actorId: string;
  readonly skillId: string;
  readonly status: SkillCheckStatus;
  readonly dieRoll: number | null;
  readonly triggered: boolean;
}

export interface PreparedBattleSkillModifier {
  readonly id: string;
  readonly skillId: string;
  readonly sourceActorId: string;
  readonly sourceFreeActionId?: string;
  readonly actorId: string;
  readonly actionId: string;
  readonly kind: "attack-damage-bonus";
  readonly amount: 1;
}

export interface PreparedBattleSkillEffect {
  readonly id: string;
  readonly skillId: string;
  readonly sourceActorId: string;
  readonly actorId: string;
  readonly actionId: string;
  readonly targetIds: readonly string[];
  readonly kind: "fixed-damage";
  readonly amount: 1;
}

export interface PreparedBattleSkills {
  readonly checks: readonly SkillCheckResult[];
  readonly supplementalFreeActions: readonly SupplementalFreeBattleAction[];
  readonly modifiers: readonly PreparedBattleSkillModifier[];
  readonly effects: readonly PreparedBattleSkillEffect[];
}

interface SkillContext {
  readonly round: PreparedBattleRound;
  readonly actors: ReadonlyMap<string, BattleCombatantSnapshot>;
  readonly ordinaryActions: ReadonlyMap<string, PreparedPlayerAction>;
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

function actionId(round: PreparedBattleRound, action: PreparedPlayerAction): string {
  return `player-action:${round.playerActions.indexOf(action)}:${action.actorId}`;
}

function freeActionId(index: number, action: SupplementalFreeBattleAction): string {
  return `free-skill:${index}:${action.actorId}:${action.id}`;
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function attackAction(action: PreparedPlayerAction | undefined): action is PreparedPlayerAction & { readonly effect: Extract<BattleActionEffect, { kind: "attack" }> } {
  return action?.kind === "card" && action.effect?.kind === "attack" && action.targetIds.length > 0;
}

function candidatesAtOrBelowHalf(actors: readonly BattleCombatantSnapshot[]): BattleCombatantSnapshot[] {
  return actors.filter((actor) => actor.side === "ally" && actor.hp < actor.hpMax && actor.hp <= actor.hpMax / 2);
}

function conditionMatches(condition: CharacterSkillCondition, context: SkillContext): boolean {
  const { round, actors, ordinaryActions } = context;
  switch (condition) {
    case "enemy-charge":
      return round.enemyIntents.some((intent) => intent.tags.includes("charge"));
    case "own-front-charge": {
      const action = ordinaryActions.get("yuri");
      return action?.kind === "card" && action.tags.includes("charge") && action.targetIds.some((id) => {
        const target = actors.get(id);
        return target?.side === "enemy" && target.row === "front" && target.hp > 0;
      });
    }
    case "prepared-ally-attack":
      return round.playerActions.some((action) => attackAction(action));
    case "own-sniper": {
      const action = ordinaryActions.get("tsumugi");
      return attackAction(action) && action.tags.includes("sniper");
    }
    case "injured-ally-half":
      return candidatesAtOrBelowHalf(round.combatants).length > 0;
    case "own-blast-front": {
      const action = ordinaryActions.get("reina");
      return action?.kind === "card" && action.tags.includes("blast") && action.targetIds.some((id) => {
        const target = actors.get(id);
        return target?.side === "enemy" && target.row === "front" && target.hp > 0;
      });
    }
  }
}

function lowestByRosterOrder(candidates: readonly BattleCombatantSnapshot[]): BattleCombatantSnapshot | undefined {
  let lowest: BattleCombatantSnapshot | undefined;
  for (const candidate of candidates) if (!lowest || candidate.hp < lowest.hp) lowest = candidate;
  return lowest;
}

function effect(kind: "attack" | "shield" | "heal" | "attack-buff", amount: number, target: BattleActionEffect["target"]): BattleActionEffect {
  return kind === "attack" ? { kind, target } : { kind, amount, target };
}

function freeAction(actorId: string, id: string, tag: string, actionEffect: BattleActionEffect, targetIds: readonly string[]): SupplementalFreeBattleAction {
  return { id, actorId, tags: [tag], effect: actionEffect, targetIds: [...targetIds] };
}

function activate(
  definition: CharacterSkillDefinition,
  context: SkillContext,
  supplemental: SupplementalFreeBattleAction[],
  modifiers: PreparedBattleSkillModifier[],
  effects: PreparedBattleSkillEffect[],
): boolean {
  const { round, actors, ordinaryActions } = context;
  const actorId = definition.actorId;
  const action = ordinaryActions.get(actorId);
  let addedAction: SupplementalFreeBattleAction | undefined;

  switch (definition.output) {
    case "companion-cover": {
      const targets = unique(round.enemyIntents.filter((intent) => intent.tags.includes("charge")).flatMap((intent) => intent.targetIds));
      if (!targets.length) return false;
      addedAction = freeAction(actorId, definition.id, "cover",
        effect("shield", 2, { kind: "intent-target", intentTag: "charge" }), targets);
      break;
    }
    case "follow-up": {
      if (!attackAction(action)) return false;
      addedAction = freeAction(actorId, definition.id, "pursuit",
        effect("attack", 0, { kind: "lowest", side: "enemy", rows: ["front", "back"] }), action.targetIds);
      const index = supplemental.length;
      effects.push({ id: `${definition.id}:damage`, skillId: definition.id, sourceActorId: actorId, actorId,
        actionId: freeActionId(index, addedAction), targetIds: [...action.targetIds], kind: "fixed-damage", amount: 1 });
      break;
    }
    case "encouragement": {
      const attackActions = round.playerActions.filter((candidate) => attackAction(candidate));
      const attackers = attackActions.map((candidate) => actors.get(candidate.actorId)).filter((candidate): candidate is BattleCombatantSnapshot => !!candidate);
      const recipient = lowestByRosterOrder(attackers);
      const recipientAction = recipient && attackActions.find((candidate) => candidate.actorId === recipient.actorId);
      if (!recipient || !recipientAction) return false;
      addedAction = freeAction(actorId, definition.id, "support",
        effect("attack-buff", 1, { kind: "lowest", side: "ally", rows: ["any"], requirement: "prepared-attack" }), [recipient.actorId]);
      modifiers.push({ id: `${definition.id}:damage`, skillId: definition.id, sourceActorId: actorId,
        sourceFreeActionId: addedAction.id, actorId: recipient.actorId, actionId: actionId(round, recipientAction),
        kind: "attack-damage-bonus", amount: 1 });
      break;
    }
    case "calibrated-sight": {
      if (!attackAction(action) || !action.tags.includes("sniper")) return false;
      modifiers.push({ id: `${definition.id}:damage`, skillId: definition.id, sourceActorId: actorId, actorId,
        actionId: actionId(round, action), kind: "attack-damage-bonus", amount: 1 });
      return true;
    }
    case "first-aid-instinct": {
      const recipient = lowestByRosterOrder(candidatesAtOrBelowHalf(round.combatants));
      if (!recipient) return false;
      addedAction = freeAction(actorId, definition.id, "support",
        effect("heal", 1, { kind: "lowest", side: "ally", rows: ["any"], requirement: "injured-half" }), [recipient.actorId]);
      break;
    }
    case "aftershock": {
      if (!attackAction(action) || !action.tags.includes("blast")) return false;
      const target = lowestByRosterOrder(action.targetIds.map((id) => actors.get(id)).filter((candidate): candidate is BattleCombatantSnapshot =>
        !!candidate && candidate.side === "enemy" && candidate.row === "front" && candidate.hp > 0));
      if (!target) return false;
      addedAction = freeAction(actorId, definition.id, "blast",
        effect("attack", 0, { kind: "lowest", side: "enemy", rows: ["front"] }), [target.actorId]);
      const index = supplemental.length;
      effects.push({ id: `${definition.id}:damage`, skillId: definition.id, sourceActorId: actorId, actorId,
        actionId: freeActionId(index, addedAction), targetIds: [target.actorId], kind: "fixed-damage", amount: 1 });
      break;
    }
  }

  if (!addedAction) return false;
  supplemental.push(addedAction);
  return true;
}

export function prepareSkills(round: PreparedBattleRound, random: SkillRandom): PreparedBattleSkills {
  const actors = new Map(round.combatants.map((actor) => [actor.actorId, actor]));
  const ordinaryActions = new Map(round.playerActions.map((action) => [action.actorId, action]));
  const context: SkillContext = { round, actors, ordinaryActions };
  const checks: SkillCheckResult[] = [];
  const supplementalFreeActions: SupplementalFreeBattleAction[] = [];
  const modifiers: PreparedBattleSkillModifier[] = [];
  const effects: PreparedBattleSkillEffect[] = [];
  const skillsByActor = new Map(characterSkills.map((skill) => [skill.actorId, skill]));

  for (const actor of round.combatants.filter((candidate) => candidate.side === "ally")) {
    const definition = skillsByActor.get(actor.actorId);
    if (!definition) continue;
    if (actor.hp <= 0) {
      checks.push({ actorId: definition.actorId, skillId: definition.id, status: "ineligible", dieRoll: null, triggered: false });
      continue;
    }
    if (!conditionMatches(definition.condition, context)) {
      checks.push({ actorId: definition.actorId, skillId: definition.id, status: "condition-not-met", dieRoll: null, triggered: false });
      continue;
    }
    const dieRoll = random.nextInt();
    if (!Number.isInteger(dieRoll) || dieRoll < 1 || dieRoll > definition.dieSides) throw new RangeError(`Skill die must be an integer from 1 to ${definition.dieSides}`);
    if (dieRoll !== definition.triggerValue) {
      checks.push({ actorId: definition.actorId, skillId: definition.id, status: "not-triggered", dieRoll, triggered: false });
      continue;
    }
    const added = activate(definition, context, supplementalFreeActions, modifiers, effects);
    checks.push({ actorId: definition.actorId, skillId: definition.id,
      status: added ? "triggered" : "triggered-no-target", dieRoll, triggered: true });
  }

  return deepFreeze({ checks, supplementalFreeActions, modifiers, effects });
}
