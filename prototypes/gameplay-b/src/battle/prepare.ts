import type {
  BattleActionEffect, BattleCharacterDefinition, BattleCombatantSnapshot, BattleCondition,
  BattleEnemyMember, BattlePartyMember, BattlePreparationInput, BattleRow, BattleSide, BattleTargetRule,
  PreparedBattleRound, PreparedEnemyIntent, PreparedPartySCost, PreparedPlayerAction,
} from "../model.js";
import { prepareSkills, type PreparedBattleSkills, type SkillRandom } from "./skills.js";

const CAP = 5;
type Actor = BattleCombatantSnapshot;
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};
const copy = <T>(value: T): T => structuredClone(value);

function validInput(input: BattlePreparationInput): void {
  if (!input.encounterId || !Number.isInteger(input.round) || input.round < 1) throw new Error("Invalid battle round");
  if (input.initialSCostBonus !== undefined && (!Number.isInteger(input.initialSCostBonus) || input.initialSCostBonus < 0)) throw new Error("Invalid initial sCost bonus");
  if (input.rechargeBonus !== undefined && (!Number.isInteger(input.rechargeBonus.amount) || input.rechargeBonus.amount < 1 ||
    !Number.isInteger(input.rechargeBonus.fromRound) || input.rechargeBonus.fromRound < 1)) throw new Error("Invalid recharge bonus");
  if (input.previousRoundDamagedEnemyIds !== undefined) {
    const enemyIds = new Set(input.enemies.map((member) => member.definition.id));
    const reported = new Set<string>();
    for (const id of input.previousRoundDamagedEnemyIds) {
      if (!id || !enemyIds.has(id) || reported.has(id)) throw new Error("Invalid previous-round damaged enemy IDs");
      reported.add(id);
    }
  }
  const ids = new Set<string>();
  for (const [side, members] of [["ally", input.party], ["enemy", input.enemies]] as const) for (const member of members) {
    const d = member.definition;
    if (!d.id || ids.has(d.id) || !Number.isInteger(member.hp) || member.hp < 0 || member.hp > d.hpMax ||
      !Number.isInteger(d.hpMax) || d.hpMax < 1 || !Number.isFinite(d.atk) || !Number.isFinite(d.def)) throw new Error(`Invalid ${side} combatant`);
    ids.add(d.id);
    if (side === "ally" && (!Number.isInteger((member as BattlePartyMember).currentBattleSCost) ||
      (member as BattlePartyMember).currentBattleSCost < 0 || (member as BattlePartyMember).currentBattleSCost > CAP)) throw new Error("Invalid sCost");
    if (side === "enemy") {
      const enemy = member as BattleEnemyMember;
      const intents = [...enemy.definition.intentPattern,
        ...(enemy.definition.previousRoundDamageReaction ? [enemy.definition.previousRoundDamageReaction] : [])];
      for (const intent of intents) {
        if (!intent.id || !intent.name || (intent.effect.kind === "fixed-damage" && (!Number.isInteger(intent.effect.amount) || intent.effect.amount < 1))) {
          throw new Error("Invalid enemy intent");
        }
      }
    }
  }
  for (const m of input.party) for (const p of m.definition.aiPriority) if (!m.definition.cards.some((c) => c.id === p.cardId)) throw new Error(`Unknown card ${p.cardId}`);
}

function targetIds(rule: BattleTargetRule, actors: readonly Actor[], intents: readonly PreparedEnemyIntent[], actions: readonly PreparedPlayerAction[]): string[] {
  if (rule.kind === "intent-target") return [...new Set(intents.filter((i) => i.tags.includes(rule.intentTag)).flatMap((i) => i.targetIds))];
  if (rule.kind === "front-and-lowest-rear") {
    const front = actors.filter((actor) => actor.side === rule.side && actor.row === "front" && actor.hp > 0);
    let lowestRear: Actor | undefined;
    for (const actor of actors) if (actor.side === rule.side && actor.row === "back" && actor.hp > 0 && (!lowestRear || actor.hp < lowestRear.hp)) lowestRear = actor;
    return [...front.map((actor) => actor.actorId), ...(lowestRear ? [lowestRear.actorId] : [])];
  }
  const rows = rule.kind === "all" ? [rule.row] : rule.rows;
  const eligible = (row: BattleRow | "any") => actors.filter((a) => a.side === rule.side &&
    (row === "any" || a.row === row) && (rule.kind === "lowest" && rule.requirement === "injured-half" ? a.hp < a.hpMax && a.hp <= a.hpMax / 2 : a.hp > 0) &&
    (rule.kind === "lowest" && rule.requirement === "prepared-attack" ? actions.some((x) => x.actorId === a.actorId && x.effect?.kind === "attack") : true));
  if (rule.kind === "all") return eligible(rule.row).map((a) => a.actorId);
  for (const row of rows) {
    let lowest: Actor | undefined;
    for (const actor of eligible(row)) if (!lowest || actor.hp < lowest.hp) lowest = actor;
    if (lowest) return [lowest.actorId];
  }
  return [];
}

function conditionOK(c: BattleCondition, actors: readonly Actor[], intents: readonly PreparedEnemyIntent[], actions: readonly PreparedPlayerAction[]): boolean {
  switch (c.kind) {
    case "always": return true;
    case "injured-ally-half": return actors.some((a) => a.side === "ally" && a.hp < a.hpMax && a.hp <= a.hpMax / 2);
    case "prepared-ally-attack": return actions.some((a) => a.effect?.kind === "attack");
    case "enemy-intent": return intents.some((i) => i.tags.includes(c.tag));
    case "enemy-front-count": return actors.filter((a) => a.side === "enemy" && a.row === "front" && a.hp > 0).length >= c.minimum;
    case "enemy-row-alive": return actors.some((a) => a.side === "enemy" && a.row === c.row && a.hp > 0);
  }
}

function reserveOK(id: string, cardId: string, exception: BattleCharacterDefinition["aiPriority"][number]["reserveException"], condition: BattleCondition,
  effect: BattleActionEffect, ids: readonly string[]): boolean {
  if (!ids.length) return false;
  if (exception === "heal-wounded-ally") return ((id === "mei" && cardId === "mei-medical") || (id === "chise" && cardId === "chise-aid")) && condition.kind === "injured-ally-half" && effect.kind === "heal" &&
    effect.target.kind === "lowest" && effect.target.side === "ally" && effect.target.requirement === "injured-half";
  if (exception === "cover-enemy-charge") return id === "reina" && cardId === "reina-cover" && condition.kind === "enemy-intent" && condition.tag === "charge" && effect.kind === "shield" &&
    effect.target.kind === "intent-target" && effect.target.intentTag === "charge";
  return false;
}

export function prepareBattleRound(input: BattlePreparationInput): PreparedBattleRound {
  validInput(input);
  const allySCost = new Map(input.party.map((m) => {
    const initialBonus = input.round === 1 ? input.initialSCostBonus ?? 0 : 0;
    const ordinaryRecharge = input.round > 1 && m.hp > 0 ? 1 : 0;
    const campRecharge = input.round >= (input.rechargeBonus?.fromRound ?? Number.POSITIVE_INFINITY) && m.hp > 0 ? input.rechargeBonus?.amount ?? 0 : 0;
    return [m.definition.id, Math.min(CAP, m.currentBattleSCost + initialBonus + ordinaryRecharge + campRecharge)] as const;
  }));
  const actors: Actor[] = [
    ...input.party.map((m) => ({ actorId: m.definition.id, side: "ally" as const, name: m.definition.name, row: m.definition.row, hp: m.hp, hpMax: m.definition.hpMax, atk: m.definition.atk, def: m.definition.def, currentBattleSCost: allySCost.get(m.definition.id)! })),
    ...input.enemies.map((m) => ({ actorId: m.definition.id, side: "enemy" as const, name: m.definition.name, row: m.definition.row, hp: m.hp, hpMax: m.definition.hpMax, atk: m.definition.atk, def: m.definition.def, currentBattleSCost: null })),
  ];
  const intents: PreparedEnemyIntent[] = [];
  for (const member of input.enemies) {
    if (member.hp <= 0) continue;
    const wasDamaged = input.previousRoundDamagedEnemyIds?.includes(member.definition.id) ?? false;
    const intent = wasDamaged && member.definition.previousRoundDamageReaction
      ? member.definition.previousRoundDamageReaction
      : member.definition.intentPattern.length
        ? member.definition.intentPattern[(input.round - 1) % member.definition.intentPattern.length]!
        : undefined;
    if (!intent) continue;
    if (intent.effect.kind === "no-op") {
      intents.push({ actorId: member.definition.id, intentId: intent.id, intentName: intent.name,
        tags: copy(intent.tags), effect: null, targetIds: [], resolution: { kind: "no-op" } });
    } else if (intent.effect.kind === "fixed-damage") {
      intents.push({ actorId: member.definition.id, intentId: intent.id, intentName: intent.name, tags: copy(intent.tags),
        effect: null, targetIds: targetIds(intent.effect.target, actors, [], []),
        resolution: { kind: "fixed-damage", amount: intent.effect.amount } });
    } else {
      intents.push({ actorId: member.definition.id, intentId: intent.id, intentName: intent.name, tags: copy(intent.tags),
        effect: copy(intent.effect), targetIds: targetIds(intent.effect.target, actors, [], []) });
    }
  }
  const actions: PreparedPlayerAction[] = [];
  for (const member of input.party) {
    const d = member.definition, before = allySCost.get(d.id)!;
    if (member.hp <= 0) continue;
    let selected: PreparedPlayerAction | undefined;
    for (const p of d.aiPriority) {
      const card = d.cards.find((c) => c.id === p.cardId)!;
      if (!conditionOK(p.condition, actors, intents, actions) || (p.minimumCurrentSCost !== undefined && before < p.minimumCurrentSCost) || before < card.cost) continue;
      const targets = targetIds(card.effect.target, actors, intents, actions);
      if (!targets.length) continue;
      const after = before - card.cost;
      const bypass = after < p.holdCost && reserveOK(d.id, card.id, p.reserveException, p.condition, card.effect, targets);
      if (after < p.holdCost && !bypass) continue;
      selected = { actorId: d.id, kind: "card", cardId: card.id, cardName: card.name, tags: copy(card.tags), effect: copy(card.effect), targetIds: targets,
        costPaid: card.cost, sCostBeforePayment: before, sCostAfterPayment: after, reserveBypassed: bypass };
      break;
    }
    actions.push(selected ?? { actorId: d.id, kind: "observe", cardId: null, cardName: null, tags: [], effect: null, targetIds: [], costPaid: 0,
      sCostBeforePayment: before, sCostAfterPayment: before, reserveBypassed: false });
  }
  const partyStartSCost: PreparedPartySCost[] = input.party.map((m) => ({ actorId: m.definition.id, value: allySCost.get(m.definition.id)! }));
  return freeze(copy({ encounterId: input.encounterId, round: input.round, combatants: actors, partyStartSCost, enemyIntents: intents, playerActions: actions }));
}

export interface PreparedBattleRoundWithSkills {
  readonly round: PreparedBattleRound;
  readonly skills: PreparedBattleSkills;
}

export function prepareBattleRoundWithSkills(input: BattlePreparationInput, random: SkillRandom): PreparedBattleRoundWithSkills {
  const round = prepareBattleRound(input);
  const skills = prepareSkills(round, random);
  return Object.freeze({ round, skills });
}
