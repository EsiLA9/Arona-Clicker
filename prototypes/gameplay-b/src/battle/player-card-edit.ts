import type {
  BattleActionEffect, BattleCharacterDefinition, BattleCombatantSnapshot, BattleSide,
  BattleTargetRule, OrdinaryBattleCardDefinition, PreparedBattleRound, PreparedPlayerAction,
} from "../model.js";

export interface PlayerCardChoice {
  readonly actorId: string;
  readonly cardId: string | null;
  readonly name: string;
  readonly cost: number;
  readonly tags: readonly string[];
  readonly effect: BattleActionEffect | null;
  readonly targetIds: readonly string[];
  readonly candidateTargetIds: readonly string[];
  readonly fixedTargetIds: readonly string[];
  readonly requiredTargetCount: number;
  readonly targetGroupCanChange: boolean;
  readonly available: boolean;
  readonly disabledReason: string | null;
}

export interface PlayerTargetGroup {
  readonly candidateIds: readonly string[];
  readonly fixedIds: readonly string[];
  readonly defaultIds: readonly string[];
  readonly requiredCount: number;
  readonly canChange: boolean;
}

export interface PlayerActionFallback {
  readonly actorId: string;
  readonly actorName: string;
  readonly cardName: string;
  readonly reason: string;
}

export type PlayerCardEditResult =
  | { readonly ok: true; readonly action: PreparedPlayerAction; readonly playerActions: readonly PreparedPlayerAction[]; readonly fallbacks?: readonly PlayerActionFallback[] }
  | { readonly ok: false; readonly reason: string };

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};

const actorEligible = (actor: BattleCombatantSnapshot, rule: Extract<BattleTargetRule, { kind: "lowest" }>, actions: readonly PreparedPlayerAction[]): boolean => {
  if (rule.requirement === "injured-half") return actor.hp < actor.hpMax && actor.hp <= actor.hpMax / 2;
  if (actor.hp <= 0) return false;
  if (rule.requirement === "prepared-attack") return actions.some((action) => action.actorId === actor.actorId && action.effect?.kind === "attack");
  return true;
};

function actorsForSide(round: PreparedBattleRound, side: BattleSide): BattleCombatantSnapshot[] {
  return round.combatants.filter((actor) => actor.side === side);
}

function matchingIntentTargets(round: PreparedBattleRound, tag: string): string[] {
  return [...new Set(round.enemyIntents.filter((intent) => intent.tags.includes(tag)).flatMap((intent) => intent.targetIds))];
}

function defaultTargetIds(
  rule: BattleTargetRule,
  round: PreparedBattleRound,
  actions: readonly PreparedPlayerAction[],
): string[] {
  if (rule.kind === "intent-target") return matchingIntentTargets(round, rule.intentTag);
  const actors = actorsForSide(round, rule.side);
  if (rule.kind === "all") return actors.filter((actor) => actor.row === rule.row && actor.hp > 0).map((actor) => actor.actorId);
  if (rule.kind === "front-and-lowest-rear") {
    const fronts = actors.filter((actor) => actor.row === "front" && actor.hp > 0);
    let lowestRear: BattleCombatantSnapshot | undefined;
    for (const actor of actors) if (actor.row === "back" && actor.hp > 0 && (!lowestRear || actor.hp < lowestRear.hp)) lowestRear = actor;
    return [...fronts.map((actor) => actor.actorId), ...(lowestRear ? [lowestRear.actorId] : [])];
  }
  for (const row of rule.rows) {
    const eligible = actors.filter((actor) => (row === "any" || actor.row === row) && actorEligible(actor, rule, actions));
    let lowest: BattleCombatantSnapshot | undefined;
    for (const actor of eligible) if (!lowest || actor.hp < lowest.hp) lowest = actor;
    if (lowest) return [lowest.actorId];
  }
  return [];
}

function eligibleTargetIds(
  round: PreparedBattleRound,
  rule: Extract<BattleTargetRule, { kind: "lowest" }>,
  actions: readonly PreparedPlayerAction[],
): string[] {
  const actors = actorsForSide(round, rule.side);
  const ids: string[] = [];
  for (const row of rule.rows) {
    for (const actor of actors) {
      if ((row !== "any" && actor.row !== row) || !actorEligible(actor, rule, actions) || ids.includes(actor.actorId)) continue;
      ids.push(actor.actorId);
    }
  }
  return ids;
}

export function getPlayerTargetGroup(
  round: PreparedBattleRound,
  action: PreparedPlayerAction,
  actions: readonly PreparedPlayerAction[] = round.playerActions,
): PlayerTargetGroup | null {
  if (action.kind !== "card" || !action.effect) return null;
  const rule = action.effect.target;
  const defaults = defaultTargetIds(rule, round, actions);
  const currentCount = action.targetIds.length;
  if (!defaults.length || !currentCount) return null;

  if (rule.kind === "all") return {
    candidateIds: defaults, fixedIds: defaults, defaultIds: defaults, requiredCount: defaults.length, canChange: false,
  };

  if (rule.kind === "front-and-lowest-rear") {
    const actors = actorsForSide(round, rule.side);
    const fronts = actors.filter((actor) => actor.row === "front" && actor.hp > 0).map((actor) => actor.actorId);
    const rears = actors.filter((actor) => actor.row === "back" && actor.hp > 0).map((actor) => actor.actorId);
    const candidateIds = [...fronts, ...rears];
    const requiredCount = fronts.length + (rears.length ? 1 : 0);
    return {
      candidateIds,
      fixedIds: fronts,
      defaultIds: defaults,
      requiredCount,
      canChange: rears.length > 1,
    };
  }

  if (rule.kind === "intent-target") {
    const candidateIds = matchingIntentTargets(round, rule.intentTag);
    return {
      candidateIds,
      fixedIds: [],
      defaultIds: defaults,
      requiredCount: currentCount,
      canChange: candidateIds.length > currentCount,
    };
  }

  const candidateIds = eligibleTargetIds(round, rule, actions);
  return {
    candidateIds,
    fixedIds: [],
    defaultIds: defaults,
    requiredCount: 1,
    canChange: candidateIds.length > 1,
  };
}

function validateTargetIds(group: PlayerTargetGroup, targetIds: readonly string[]): string | null {
  if (new Set(targetIds).size !== targetIds.length) return "目标不能重复";
  if (targetIds.length !== group.requiredCount) return `需要选择 ${group.requiredCount} 个目标`;
  if (targetIds.some((id) => !group.candidateIds.includes(id))) return "包含不合法目标";
  if (group.fixedIds.some((id) => !targetIds.includes(id))) return "固定目标不能移除";
  return null;
}

function partyMember(round: PreparedBattleRound, party: readonly BattleCharacterDefinition[], actorId: string) {
  const definition = party.find((member) => member.id === actorId);
  const combatant = round.combatants.find((actor) => actor.actorId === actorId && actor.side === "ally");
  const startingSCost = round.partyStartSCost.find((entry) => entry.actorId === actorId)?.value;
  return definition && combatant && startingSCost !== undefined ? { definition, combatant, startingSCost } : null;
}

function observeAction(actorId: string, startingSCost: number): PreparedPlayerAction {
  return {
    actorId, kind: "observe", cardId: null, cardName: null, tags: [], effect: null, targetIds: [],
    costPaid: 0, sCostBeforePayment: startingSCost, sCostAfterPayment: startingSCost, reserveBypassed: false,
  };
}

export function listPlayerCardChoices(
  round: PreparedBattleRound,
  party: readonly BattleCharacterDefinition[],
  actorId: string,
  actions: readonly PreparedPlayerAction[] = round.playerActions,
): readonly PlayerCardChoice[] {
  const member = partyMember(round, party, actorId);
  const current = actions.find((action) => action.actorId === actorId);
  const disabled = member && member.combatant.hp > 0 && current
    ? null : "角色倒地或本轮没有可编辑行动";
  const observe: PlayerCardChoice = {
    actorId, cardId: null, name: "观察 / 待机", cost: 0, tags: [], effect: null,
    targetIds: [], candidateTargetIds: [], fixedTargetIds: [], requiredTargetCount: 0, targetGroupCanChange: false,
    available: disabled === null, disabledReason: disabled,
  };
  if (!member) return [observe];
  const cards = member.definition.cards.map((card): PlayerCardChoice => {
    let reason = disabled;
    if (!reason && card.cost > member.startingSCost) reason = `需要 ${card.cost} sCost，当前回合起始值为 ${member.startingSCost}`;
    const prototype: PreparedPlayerAction = {
      actorId, kind: "card", cardId: card.id, cardName: card.name, tags: card.tags, effect: card.effect,
      targetIds: [], costPaid: card.cost, sCostBeforePayment: member.startingSCost,
      sCostAfterPayment: member.startingSCost - card.cost, reserveBypassed: false,
    };
    const candidateActions = actions.map((existing) => existing.actorId === actorId ? prototype : existing);
    const targetIds = current?.cardId === card.id ? [...current.targetIds] : defaultTargetIds(card.effect.target, round, candidateActions);
    if (!reason && !targetIds.length) reason = "当前没有符合规则的目标";
    const currentShape = current?.cardId === card.id && current.targetIds.length
      ? current.targetIds.length : targetIds.length;
    const group = getPlayerTargetGroup(round, { ...prototype, targetIds: targetIds.slice(0, currentShape) }, candidateActions);
    if (!reason && !group) reason = "当前没有合法目标组";
    return {
      actorId, cardId: card.id, name: card.name, cost: card.cost, tags: card.tags, effect: card.effect,
      targetIds,
      candidateTargetIds: group?.candidateIds ?? [],
      fixedTargetIds: group?.fixedIds ?? [],
      requiredTargetCount: group?.requiredCount ?? 0,
      targetGroupCanChange: group?.canChange ?? false,
      available: reason === null, disabledReason: reason,
    };
  });
  return [observe, ...cards];
}

export function buildEditedPlayerAction(
  round: PreparedBattleRound,
  party: readonly BattleCharacterDefinition[],
  actorId: string,
  cardId: string | null,
  targetIds: readonly string[],
): PlayerCardEditResult {
  const member = partyMember(round, party, actorId);
  const index = round.playerActions.findIndex((action) => action.actorId === actorId);
  if (!member || member.combatant.hp <= 0 || index < 0) return { ok: false, reason: "角色倒地或本轮没有可编辑行动" };
  const before = member.startingSCost;
  let action: PreparedPlayerAction;
  if (cardId === null) {
    if (targetIds.length) return { ok: false, reason: "观察 / 待机没有目标" };
    action = observeAction(actorId, before);
  } else {
    const card: OrdinaryBattleCardDefinition | undefined = member.definition.cards.find((entry) => entry.id === cardId);
    if (!card) return { ok: false, reason: "该普通卡不属于此 Chara" };
    if (!Number.isInteger(card.cost) || card.cost < 0 || card.cost > before) return { ok: false, reason: "sCost 不足" };
    const prototype: PreparedPlayerAction = {
      actorId, kind: "card", cardId: card.id, cardName: card.name, tags: card.tags, effect: card.effect,
      targetIds: [...targetIds], costPaid: card.cost, sCostBeforePayment: before,
      sCostAfterPayment: before - card.cost, reserveBypassed: false,
    };
    action = prototype;
  }
  let playerActions = round.playerActions.map((existing, currentIndex) => currentIndex === index ? action : existing);
  const fallbacks: PlayerActionFallback[] = [];

  if (action.kind === "card" && action.effect) {
    const group = getPlayerTargetGroup(round, action, playerActions);
    if (!group) {
      const reason = "当前行动已无合法目标组";
      fallbacks.push({ actorId, actorName: member.combatant.name, cardName: action.cardName ?? "普通行动", reason });
      action = observeAction(actorId, before);
      playerActions = playerActions.map((existing, currentIndex) => currentIndex === index ? action : existing);
    } else {
      const targetError = validateTargetIds(group, targetIds);
      if (targetError) return { ok: false, reason: targetError };
      action = { ...action, targetIds: group.candidateIds.filter((id) => targetIds.includes(id)) };
      playerActions = playerActions.map((existing, currentIndex) => currentIndex === index ? action : existing);
    }
  }

  for (let pass = 0; pass <= playerActions.length; pass += 1) {
    let fellBack = false;
    for (let currentIndex = 0; currentIndex < playerActions.length; currentIndex += 1) {
      const candidate = playerActions[currentIndex]!;
      if (candidate.kind !== "card" || !candidate.effect) continue;
      const group = getPlayerTargetGroup(round, candidate, playerActions);
      const reason = group
        ? validateTargetIds(group, candidate.targetIds)
        : "当前没有合法目标组";
      if (!reason) continue;
      const candidateMember = partyMember(round, party, candidate.actorId);
      if (!candidateMember) return { ok: false, reason: `${candidate.cardName ?? "行动卡"} 所属角色不在本轮队伍中` };
      fallbacks.push({
        actorId: candidate.actorId, actorName: candidateMember.combatant.name,
        cardName: candidate.cardName ?? "普通行动", reason,
      });
      playerActions = playerActions.map((existing, indexInList) => indexInList === currentIndex
        ? observeAction(candidate.actorId, candidateMember.startingSCost)
        : existing);
      fellBack = true;
      break;
    }
    if (!fellBack) break;
  }

  action = playerActions[index]!;
  return {
    ok: true,
    action: deepFreeze(structuredClone(action)),
    playerActions: deepFreeze(structuredClone(playerActions)),
    ...(fallbacks.length ? { fallbacks: deepFreeze(structuredClone(fallbacks)) } : {}),
  };
}

export function targetSelectionIsUnique(group: PlayerTargetGroup): boolean {
  if (!group.canChange) return true;
  const variableRequired = group.requiredCount - group.fixedIds.length;
  const variableCandidates = group.candidateIds.filter((id) => !group.fixedIds.includes(id)).length;
  return variableRequired <= 0 || variableCandidates === variableRequired;
}

export function validatePlayerTargetSelection(
  round: PreparedBattleRound,
  action: PreparedPlayerAction,
  targetIds: readonly string[],
  actions: readonly PreparedPlayerAction[] = round.playerActions,
): string | null {
  const group = getPlayerTargetGroup(round, action, actions);
  return group ? validateTargetIds(group, targetIds) : "当前没有合法目标组";
}
