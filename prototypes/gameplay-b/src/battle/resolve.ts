import type {
  BattleActionEffect, BattleCombatantSnapshot, BattleRecipeAction, BattleRecipeEffect, BattleRecipePlan,
  BattleResolution, BattleResolutionDelta, BattleResolutionState, PreparedBattleRound, SupplementalFreeBattleAction,
} from "../model.js";
import type { PreparedBattleSkills } from "./skills.js";

const CAP = 5;
const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

interface Source {
  readonly actionId: string;
  readonly order: number;
  readonly actorId: string;
  readonly targetIds: readonly string[];
  readonly effect?: BattleActionEffect;
  readonly damageAdjustment?: number;
  readonly shieldRemoval?: number;
  readonly fixedDamage?: number;
}

export interface BattleSettlementContext {
  readonly recipePlan: BattleRecipePlan;
  readonly skills: PreparedBattleSkills;
  readonly attackMarkers: readonly string[];
}

export interface ResolvedBattleRound extends BattleResolution {
  readonly recipePlan: BattleRecipePlan;
  readonly skills: PreparedBattleSkills;
  readonly consumedAttackMarkerActorIds: readonly string[];
  readonly pendingAttackMarkers: readonly string[];
}

function recipeActions(round: PreparedBattleRound, free: readonly SupplementalFreeBattleAction[]): BattleRecipeAction[] {
  return [
    ...round.playerActions.map((action, order) => ({ id: `player-action:${order}:${action.actorId}`, actorId: action.actorId, side: "ally" as const, source: "player-card" as const, order, tags: action.tags, targetIds: action.targetIds, effect: action.effect })),
    ...round.enemyIntents.map((intent, order) => ({ id: `enemy-intent:${order}:${intent.actorId}`, actorId: intent.actorId, side: "enemy" as const, source: "enemy-intent" as const, order, tags: intent.tags, targetIds: intent.targetIds, effect: intent.effect })),
    ...free.map((action, index) => ({ id: `free-skill:${index}:${action.actorId}:${action.id}`, actorId: action.actorId, side: "ally" as const, source: "free-skill" as const, order: round.playerActions.length + index, tags: action.tags, targetIds: action.targetIds, effect: action.effect })),
  ];
}

function plainPlan(actions: readonly BattleRecipeAction[]): BattleRecipePlan {
  return { unmatchedActions: [...actions], matches: [], consumedActionIds: [] };
}

function emptySkills(): PreparedBattleSkills {
  return { checks: [], supplementalFreeActions: [], modifiers: [], effects: [] };
}

function recipeName(id: string): string {
  return ({ "enemy-cover-ally-sniper": "敌方掩护 + 我方狙击", "enemy-charge-ally-cover": "敌方冲锋 + 我方掩护", "ally-charge-ally-cover": "我方冲锋 + 不同 Chara 掩护" } as Record<string, string>)[id] ?? id;
}

function skillName(id: string): string {
  return ({ "shiori-companion-cover": "并肩掩护", "yuri-follow-up": "乘势追击", "mei-encouragement": "鼓劲", "tsumugi-calibrated-sight": "校准镜", "chise-first-aid-instinct": "急救直觉", "reina-aftershock": "余波" } as Record<string, string>)[id] ?? id;
}

function actionLabel(action: BattleRecipeAction | undefined, round: PreparedBattleRound, skills: PreparedBattleSkills): string {
  if (!action) return "已准备行动";
  if (action.source === "player-card") return round.playerActions[action.order]?.cardName ?? action.actorId;
  if (action.source === "enemy-intent") return round.enemyIntents[action.order]?.intentName ?? action.actorId;
  const free = skills.supplementalFreeActions.find((entry) => action.id.endsWith(`:${entry.actorId}:${entry.id}`));
  return skillName(free?.id ?? "") || action.actorId;
}

function replacementLabel(effect: BattleRecipeEffect, actors: ReadonlyMap<string, BattleCombatantSnapshot>): string {
  const targets = effect.targetIds.map((id) => actors.get(id)?.name ?? id).join("、") || "无目标";
  if (effect.kind === "remove-round-shield") return `移除${targets} ${effect.amount} 点本轮护盾`;
  if (effect.kind === "gain-round-shield") return `${targets} 获得 ${effect.amount} 点本轮护盾`;
  const adjustment = effect.damageAdjustment > 0 ? `伤害 +${effect.damageAdjustment}` : effect.damageAdjustment < 0 ? `伤害 ${effect.damageAdjustment}` : "正常攻击一次";
  return `${actors.get(effect.actorId)?.name ?? effect.actorId} 对 ${targets} ${adjustment}`;
}

export function resolveBattleRound(state: BattleResolutionState, prepared: PreparedBattleRound, context?: BattleSettlementContext): ResolvedBattleRound {
  const skills = context?.skills ?? emptySkills();
  const actions = recipeActions(prepared, skills.supplementalFreeActions);
  const recipePlan = context?.recipePlan ?? plainPlan(actions);
  const attackMarkers = new Set(context?.attackMarkers ?? []);
  if (state.result !== "ongoing") return freeze({ state, prepared, deltas: [], events: [], recipePlan, skills, consumedAttackMarkerActorIds: [], pendingAttackMarkers: [...attackMarkers] });
  if (state.encounterId !== prepared.encounterId || state.round + 1 !== prepared.round) throw new Error("Prepared round does not follow battle state");

  const current = new Map(state.combatants.map((actor) => [actor.actorId, actor]));
  if (current.size !== prepared.combatants.length || prepared.combatants.some((actor) => current.get(actor.actorId)?.hp !== actor.hp)) throw new Error("Prepared combatants do not match the battle state");
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const consumed = new Set(recipePlan.consumedActionIds);
  const skillCarrierIds = new Set(skills.effects.map((effect) => effect.actionId));
  const skillMarkerIds = new Set(skills.modifiers.flatMap((modifier) => modifier.sourceFreeActionId ? [modifier.sourceFreeActionId] : []));
  const markerActors = new Set(attackMarkers);
  const sources: Source[] = [];
  for (const action of recipePlan.unmatchedActions) {
    const freeId = skills.supplementalFreeActions.find((free) => action.source === "free-skill" && action.id.endsWith(`:${free.actorId}:${free.id}`))?.id;
    if (action.effect?.kind === "attack-buff") {
      if (!freeId || !skillMarkerIds.has(freeId)) action.targetIds.forEach((id) => markerActors.add(id));
    } else if (action.effect && !(action.effect.kind === "attack" && skillCarrierIds.has(action.id))) {
      sources.push({ actionId: action.id, order: action.order, actorId: action.actorId, targetIds: action.targetIds, effect: action.effect });
    }
  }
  for (const modifier of skills.modifiers) if (modifier.sourceFreeActionId) markerActors.add(modifier.actorId);
  for (const match of recipePlan.matches) for (const replacement of match.replacementEffects) {
    if (replacement.kind === "remove-round-shield") {
      for (const id of replacement.targetIds) sources.push({ actionId: match.rightActionId, order: actionById.get(match.rightActionId)?.order ?? 0, actorId: "", targetIds: [id], shieldRemoval: replacement.amount });
    } else if (replacement.kind === "gain-round-shield") {
      for (const id of replacement.targetIds) sources.push({ actionId: match.leftActionId, order: actionById.get(match.leftActionId)?.order ?? 0, actorId: "", targetIds: [id], effect: { kind: "shield", amount: replacement.amount, target: { kind: "all", side: "ally", row: "front" } } });
    } else {
      const sourceAction = [actionById.get(match.leftActionId), actionById.get(match.rightActionId)].find((action) => action?.actorId === replacement.actorId);
      sources.push({ actionId: sourceAction?.id ?? match.leftActionId, order: sourceAction?.order ?? 0, actorId: replacement.actorId, targetIds: replacement.targetIds, effect: { kind: "attack", target: { kind: "lowest", side: "enemy", rows: ["any"] } }, damageAdjustment: replacement.damageAdjustment });
    }
  }
  for (const effect of skills.effects) {
    const action = actionById.get(effect.actionId);
    if (!consumed.has(effect.actionId) && action) sources.push({ actionId: effect.actionId, order: action.order, actorId: effect.actorId, targetIds: effect.targetIds, fixedDamage: effect.amount });
  }
  for (const [order, intent] of prepared.enemyIntents.entries()) {
    const actionId = `enemy-intent:${order}:${intent.actorId}`;
    if (intent.resolution?.kind === "fixed-damage" && !consumed.has(actionId)) {
      sources.push({ actionId, order, actorId: intent.actorId, targetIds: intent.targetIds, fixedDamage: intent.resolution.amount });
    }
  }
  const directBonuses = new Map<string, number>();
  for (const modifier of skills.modifiers) if (!modifier.sourceFreeActionId && !consumed.has(modifier.actionId)) directBonuses.set(modifier.actionId, (directBonuses.get(modifier.actionId) ?? 0) + modifier.amount);
  const damage = new Map<string, number>(), healing = new Map<string, number>(), shields = new Map<string, number>();
  for (const source of sources) {
    if (source.shieldRemoval !== undefined) {
      for (const id of source.targetIds) shields.set(id, Math.max(0, (shields.get(id) ?? 0) - source.shieldRemoval));
    } else if (source.effect?.kind === "shield" || source.effect?.kind === "heal") {
      for (const id of source.targetIds) {
        if (source.effect.kind === "shield") shields.set(id, Math.max(shields.get(id) ?? 0, source.effect.amount));
        else healing.set(id, (healing.get(id) ?? 0) + source.effect.amount);
      }
    }
  }
  const damageSources = sources.filter((source) => source.fixedDamage !== undefined || source.effect?.kind === "attack").sort((a, b) => a.order - b.order);
  const consumedAttackMarkerActorIds: string[] = [];
  const markerSpent = new Set<string>();
  for (const source of damageSources) {
    const attacker = prepared.combatants.find((actor) => actor.actorId === source.actorId);
    if (!attacker || attacker.hp <= 0) continue;
    const mark = attacker.side === "ally" && markerActors.has(attacker.actorId) && !markerSpent.has(attacker.actorId) ? 1 : 0;
    if (mark) { markerSpent.add(attacker.actorId); markerActors.delete(attacker.actorId); consumedAttackMarkerActorIds.push(attacker.actorId); }
    for (const id of source.targetIds) {
      const target = current.get(id);
      if (!target) continue;
      const base = source.fixedDamage ?? Math.max(1, attacker.atk - target.def);
      const amount = Math.max(0, base + (source.damageAdjustment ?? 0) + (directBonuses.get(source.actionId) ?? 0) + mark);
      damage.set(id, (damage.get(id) ?? 0) + amount);
    }
  }

  const partyActions = new Map(prepared.playerActions.map((action) => [action.actorId, action]));
  const afterHp = new Map<string, number>();
  for (const actor of state.combatants) afterHp.set(actor.actorId, clamp(actor.hp + (healing.get(actor.actorId) ?? 0) - Math.max(0, (damage.get(actor.actorId) ?? 0) - (shields.get(actor.actorId) ?? 0)), actor.hpMax));
  const partySCost = state.partySCost.map(({ actorId, value }) => {
    const action = partyActions.get(actorId), starting = prepared.partyStartSCost.find((entry) => entry.actorId === actorId)?.value ?? value;
    const paid = action?.sCostAfterPayment ?? starting, alive = (afterHp.get(actorId) ?? 0) > 0;
    return { actorId, value: alive && action?.kind === "observe" ? Math.min(CAP, paid + 1) : paid };
  });
  const allyAlive = state.combatants.some((actor) => actor.side === "ally" && (afterHp.get(actor.actorId) ?? 0) > 0);
  const enemyAlive = state.combatants.some((actor) => actor.side === "enemy" && (afterHp.get(actor.actorId) ?? 0) > 0);
  const result = allyAlive && enemyAlive ? "ongoing" : allyAlive ? "victory" : enemyAlive ? "defeat" : "draw";
  if (result !== "ongoing") { partySCost.forEach((entry) => { entry.value = 0; }); markerActors.clear(); }
  const combatants: BattleCombatantSnapshot[] = state.combatants.map((actor) => ({ ...actor, hp: afterHp.get(actor.actorId)!, currentBattleSCost: actor.side === "ally" ? partySCost.find((entry) => entry.actorId === actor.actorId)?.value ?? 0 : null }));
  const deltas: BattleResolutionDelta[] = state.combatants.map((actor) => ({
    actorId: actor.actorId, damage: damage.get(actor.actorId) ?? 0, healing: healing.get(actor.actorId) ?? 0, shield: shields.get(actor.actorId) ?? 0,
    hpBefore: actor.hp, hpAfter: afterHp.get(actor.actorId)!, sCostBefore: actor.side === "ally" ? state.partySCost.find((entry) => entry.actorId === actor.actorId)?.value ?? 0 : null,
    sCostAfter: actor.side === "ally" ? partySCost.find((entry) => entry.actorId === actor.actorId)?.value ?? 0 : null,
  }));
  const events: string[] = [];
  for (const match of recipePlan.matches) {
    const left = actionLabel(actionById.get(match.leftActionId), prepared, skills), right = actionLabel(actionById.get(match.rightActionId), prepared, skills);
    events.push(`配方替代（${recipeName(match.recipeId)}）：${left} + ${right}；${match.replacementEffects.map((effect) => replacementLabel(effect, new Map(prepared.combatants.map((actor) => [actor.actorId, actor])))).join("；")}。`);
  }
  for (const intent of prepared.enemyIntents) {
    const name = prepared.combatants.find((actor) => actor.actorId === intent.actorId)?.name ?? intent.actorId;
    const targets = intent.targetIds.map((id) => prepared.combatants.find((actor) => actor.actorId === id)?.name ?? id).join("、") || "无目标";
    if (intent.resolution?.kind === "fixed-damage") events.push(`${name} · ${intent.intentName}：对 ${targets} 各结算固定 ${intent.resolution.amount} 点伤害。`);
    else if (intent.resolution?.kind === "no-op") events.push(`${name} · ${intent.intentName}：本轮无伤害。`);
  }
  for (const effect of skills.effects) if (!consumed.has(effect.actionId)) {
    const targets = effect.targetIds.map((id) => prepared.combatants.find((actor) => actor.actorId === id)?.name ?? id).join("、");
    events.push(`${skillName(effect.skillId)}：${prepared.combatants.find((actor) => actor.actorId === effect.actorId)?.name ?? effect.actorId} 对 ${targets} 造成固定 ${effect.amount} 点伤害。`);
  }
  for (const modifier of skills.modifiers) if (!modifier.sourceFreeActionId) {
    events.push(consumed.has(modifier.actionId) ? "校准镜的原狙击被配方消费，+1 修正取消。" : "校准镜 +1 修正只作用于已准备的原狙击。");
  }
  for (const marker of consumedAttackMarkerActorIds) events.push(`${prepared.combatants.find((actor) => actor.actorId === marker)?.name ?? marker} 的 +1 攻击标记已在本张造成伤害的行动结算后消费。`);
  for (const marker of markerActors) if (!consumedAttackMarkerActorIds.includes(marker)) events.push(`${prepared.combatants.find((actor) => actor.actorId === marker)?.name ?? marker} 保留一个 +1 攻击标记至下一张造成伤害的行动。`);
  events.push(...deltas.filter((delta) => delta.damage || delta.healing || delta.shield || delta.hpBefore !== delta.hpAfter || delta.sCostBefore !== delta.sCostAfter)
    .map((delta) => `${delta.actorId}: HP ${delta.hpBefore}→${delta.hpAfter}, 伤害 ${delta.damage}（护盾 ${delta.shield}），恢复 ${delta.healing}${delta.sCostBefore === null ? "" : `，sCost ${delta.sCostBefore}→${delta.sCostAfter}`}`));
  if (result !== "ongoing") events.push(result === "draw" ? "战斗平局。" : result === "victory" ? "战斗胜利。" : "战斗失败。");
  return freeze({ state: { encounterId: state.encounterId, round: prepared.round, combatants, partySCost, result }, prepared, deltas, events,
    recipePlan, skills, consumedAttackMarkerActorIds, pendingAttackMarkers: [...markerActors] });
}
