import type { BattleActionEffect, BattleCombatantSnapshot, BattleRecipeEffect, BattleRecipePlan, BattleSide, CharacterState, EventRecord, PreparedBattleRound, ReadonlyView, RouteEventRecord, RoutePartyView, RoutePlayerCardDefinition } from "./model.js";
import type { BattleRuntimeView as BattleView, GameplayBRouteNode, GameplayBRouteSceneBehavior, GameplayBRouteView, PlayerEditOutcome, PlayerTargetEditOption, RouteCommandOutcome } from "./runtime.js";
import type { PlayerCardChoice } from "./battle/player-card-edit.js";
import type { PreparedBattleSkills } from "./battle/skills.js";
import { parkRouteNodes } from "./content/park-route.js";
import { parkTextEntries, type ParkTextEntry, type ParkTextTrigger } from "./content/texts.js";

interface CharacterCardNodes {
  readonly element: HTMLElement;
  readonly row: HTMLElement;
  readonly role: HTMLElement;
  readonly hp: HTMLElement;
  readonly hpBar: HTMLElement;
  readonly hpTrack: HTMLElement;
  readonly atk: Text;
  readonly def: Text;
}

interface PageNodes {
  readonly locationKind: HTMLElement;
  readonly locationName: HTMLElement;
  readonly locationDescription: HTMLElement;
  readonly activityHeading: HTMLElement;
  readonly activityStatus: HTMLElement;
  readonly activityMeter: HTMLElement;
  readonly activitySegments: readonly HTMLElement[];
  readonly clickHelper: HTMLElement;
  readonly eventList: HTMLOListElement;
  readonly eventScroll: HTMLElement;
  readonly advanceButton: HTMLButtonElement;
  readonly partySummary: HTMLElement;
  readonly enemyStatus: HTMLElement;
  readonly characterCards: ReadonlyMap<string, CharacterCardNodes>;
}

const roles: Readonly<Record<string, string>> = {
  shiori: "掩护队长",
  yuri: "突击手",
  mei: "战术支援",
  tsumugi: "狙击手",
  chise: "急救支援",
  reina: "破阵手",
};

const stamps: Readonly<Record<string, string>> = {
  shiori: "栞",
  yuri: "由",
  mei: "芽",
  tsumugi: "纺",
};

const skillNames: Readonly<Record<string, string>> = {
  "shiori-companion-cover": "并肩掩护",
  "yuri-follow-up": "乘势追击",
  "mei-encouragement": "鼓劲",
  "tsumugi-calibrated-sight": "校准镜",
  "chise-first-aid-instinct": "急救直觉",
  "reina-aftershock": "余波",
};

const skillSummaries: Readonly<Record<string, string>> = {
  "shiori-companion-cover": "为被冲锋目标提供护盾",
  "yuri-follow-up": "跟进已准备的冲锋目标",
  "mei-encouragement": "强化队友本轮攻击",
  "tsumugi-calibrated-sight": "本次狙击伤害 +1",
  "chise-first-aid-instinct": "恢复受伤队友",
  "reina-aftershock": "爆破后追加效果",
};

export type PreparedCardKind = "player-action" | "enemy-intent" | "special-skill";
export type PreparedCardRelationKind = "effect-target" | "modifies-action" | "recipe-partner" | "exploration-target";

export interface PreparedBattleCardModel {
  readonly id: string;
  readonly actorId: string;
  readonly side: BattleSide;
  readonly kind: PreparedCardKind;
  readonly title: string;
  readonly description: string;
  readonly costLabel: string;
  readonly order: number;
}

export interface PreparedBattleCardRelation {
  readonly from: string;
  readonly to: string;
  readonly kind: PreparedCardRelationKind;
}

export interface PreparedBattleCardBatch {
  readonly id: string;
  readonly cards: readonly PreparedBattleCardModel[];
  readonly relations: readonly PreparedBattleCardRelation[];
}

export interface PreparedCardPosition {
  readonly rightInset: number;
  readonly topInset: number;
  readonly reservedWidth: number;
  readonly reservedHeight: number;
}

export function playerCardCanStartTargetDrag(option: Pick<PlayerTargetEditOption, "editable"> | undefined): boolean {
  return option?.editable === true;
}

export function pointerMovedPastCardDragThreshold(startX: number, startY: number, clientX: number, clientY: number, threshold = 6): boolean {
  return Math.hypot(clientX - startX, clientY - startY) >= threshold;
}

export function preparedCardPosition(cardCount: number, index: number): PreparedCardPosition {
  if (!Number.isInteger(cardCount) || cardCount < 1 || !Number.isInteger(index) || index < 0 || index >= cardCount) {
    throw new RangeError("Prepared card position requires a valid card count and index.");
  }
  const cardWidth = 112;
  const cardHeight = 62;
  const horizontalStep = 8;
  const verticalStep = cardHeight + 12;
  return {
    rightInset: 4 + (cardCount - index - 1) * horizontalStep,
    topInset: 4 + index * verticalStep,
    reservedWidth: cardWidth + (cardCount - 1) * horizontalStep + 8,
    reservedHeight: 4 + (cardCount - 1) * verticalStep + cardHeight + 8,
  };
}

export type RouteActivityCardKind = "exploration-intent" | "exploration-result" | "location-effect";

export interface RouteActivityCardModel {
  readonly id: string;
  readonly placement: "character" | "field";
  readonly actorId?: string;
  readonly kind: RouteActivityCardKind;
  readonly title: string;
  readonly description: string;
  readonly detail: string;
  readonly order: number;
}

export interface RouteActivityCardBatch {
  readonly id: string;
  readonly cards: readonly RouteActivityCardModel[];
  readonly relations: readonly PreparedBattleCardRelation[];
}

export interface RelationRect { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
export interface RelationPoint { readonly x: number; readonly y: number }
export interface RelationCurvePoints {
  readonly start: RelationPoint;
  readonly controlOne: RelationPoint;
  readonly controlTwo: RelationPoint;
  readonly end: RelationPoint;
}

const characterCardRef = (actorId: string): string => `character:${actorId}`;
const playerActionRef = (index: number, actorId: string): string => `player-action:${index}:${actorId}`;
const enemyIntentRef = (index: number, actorId: string): string => `enemy-intent:${index}:${actorId}`;
const freeSkillActionRef = (index: number, actorId: string, skillId: string): string => `free-skill:${index}:${actorId}:${skillId}`;
const specialSkillRef = (actorId: string, skillId: string): string => `special-skill:${actorId}:${skillId}`;
const locationCardRef = (locationId: string): string => `location:${locationId}`;

export function relationEdgePoint(rect: RelationRect, toward: RelationPoint): RelationPoint {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = toward.x - centerX;
  const dy = toward.y - centerY;
  if (dx === 0 && dy === 0) return { x: centerX, y: centerY };
  const horizontalScale = dx === 0 ? Number.POSITIVE_INFINITY : rect.width / 2 / Math.abs(dx);
  const verticalScale = dy === 0 ? Number.POSITIVE_INFINITY : rect.height / 2 / Math.abs(dy);
  const scale = Math.min(horizontalScale, verticalScale);
  return { x: centerX + dx * scale, y: centerY + dy * scale };
}

export function overlappingFanCardCurve(source: RelationRect, target: RelationRect): RelationCurvePoints | null {
  const overlapX = Math.min(source.left + source.width, target.left + target.width) - Math.max(source.left, target.left);
  const overlapY = Math.min(source.top + source.height, target.top + target.height) - Math.max(source.top, target.top);
  if (overlapX <= 0 || overlapY <= 0) return null;
  const sourceCenterX = source.left + source.width / 2;
  const targetCenterX = target.left + target.width / 2;
  const sourceCenterY = source.top + source.height / 2;
  const targetCenterY = target.top + target.height / 2;
  if (Math.abs(targetCenterX - sourceCenterX) < Math.abs(targetCenterY - sourceCenterY)) return null;
  const targetIsLeft = targetCenterX < sourceCenterX;
  const start = { x: targetIsLeft ? source.left + source.width : source.left, y: sourceCenterY };
  const end = { x: targetIsLeft ? target.left : target.left + target.width, y: targetCenterY };
  const routeY = Math.min(source.top, target.top) - 18;
  return {
    start,
    controlOne: { x: start.x + (targetIsLeft ? 28 : -28), y: routeY },
    controlTwo: { x: end.x + (targetIsLeft ? -28 : 28), y: routeY },
    end,
  };
}

const activityOutcomeNames: Readonly<Record<NonNullable<RouteEventRecord["outcome"]>, string>> = {
  clue: "发现线索",
  none: "没有发现",
  effect: "效果结算",
};

function activityResultDescription(event: RouteEventRecord): string {
  const separator = event.text.indexOf("：");
  return separator < 0 ? event.text : event.text.slice(separator + 1);
}

function activityResultDetail(event: RouteEventRecord): string {
  const result = event.outcome ? activityOutcomeNames[event.outcome] : "已完成";
  return event.dice ? `d${event.dice.sides} · ${event.dice.value}${event.dice.bonus ? ` + ${event.dice.bonus} → ${event.dice.modifiedValue}` : ""} · ${result}` : result;
}

export function projectRouteActivityCards(input: {
  readonly currentNode: GameplayBRouteView["currentNode"];
  readonly clickCount: number;
  readonly events: readonly RouteEventRecord[];
  readonly party: readonly RoutePartyView[];
  readonly activityNode?: Extract<GameplayBRouteNode, { kind: "activity" }>;
}): RouteActivityCardBatch | null {
  if (input.currentNode.kind !== "activity") return null;
  const currentClickActivityEvents = input.events.filter((event) => event.click === input.clickCount &&
    (event.type === "activity-fixed-effect" || event.type === "activity-result" || event.type === "activity-progress"));
  const resultEvents = currentClickActivityEvents.filter((event) => event.type === "activity-result" && event.actorId);
  const fixedEffectEvents = currentClickActivityEvents.filter((event) => event.type === "activity-fixed-effect");
  const cards: RouteActivityCardModel[] = [];
  const relations: PreparedBattleCardRelation[] = [];

  if (currentClickActivityEvents.length > 0) {
    const sourceNodeId = currentClickActivityEvents.at(-1)!.nodeId;
    for (const event of fixedEffectEvents) {
      const laterJoins = new Set(input.events.filter((candidate) => candidate.click === event.click && candidate.sequence > event.sequence &&
        candidate.type === "character-joined" && candidate.actorId).map((candidate) => candidate.actorId!));
      const targetIds = input.party.filter((actor) => !laterJoins.has(actor.id)).map((actor) => actor.id);
      const id = `location-effect:${event.nodeId}:${event.click}:${event.sequence}`;
      cards.push({ id, placement: "field", kind: "location-effect", title: event.nodeId === input.currentNode.id ? "场所效果" : "上一处效果", description: event.text,
        detail: "已结算 · 全队", order: event.sequence });
      for (const actorId of targetIds) relations.push({ from: id, to: characterCardRef(actorId), kind: "effect-target" });
    }
    for (const event of resultEvents) {
      const id = `exploration-result:${event.nodeId}:${event.click}:${event.sequence}`;
      cards.push({ id, placement: "character", actorId: event.actorId, kind: "exploration-result", title: event.nodeId === input.currentNode.id ? "场地探索" : "上一处探索",
        description: activityResultDescription(event), detail: activityResultDetail(event), order: event.sequence });
      if (event.nodeId === input.currentNode.id) {
        relations.push({ from: id, to: locationCardRef(event.locationId), kind: "exploration-target" });
      }
      if (event.outcome === "effect") {
        const effectId = `location-result-effect:${event.nodeId}:${event.click}:${event.sequence}`;
        cards.push({ id: effectId, placement: "field", kind: "location-effect", title: event.nodeId === input.currentNode.id ? "场所效果" : "上一处效果",
          description: activityResultDescription(event), detail: "已结算 · 单人", order: event.sequence });
        relations.push({ from: effectId, to: characterCardRef(event.actorId!), kind: "effect-target" });
      }
    }
    if (cards.length > 0) return { id: `route:${sourceNodeId}:${input.clickCount}:resolved`, cards, relations };
    if (sourceNodeId === input.currentNode.id) return null;
  }

  const node = input.activityNode;
  if (!node || node.id !== input.currentNode.id) return null;
  const locationRef = locationCardRef(node.activity.locationId);
  if (node.activity.individualCheck) {
    const check = node.activity.individualCheck;
    const dieLabel = `d${check.dieSides} · 待探索`;
    const actionDescription = check.kind === "attribute"
      ? `Click 后进行 ${check.attribute.toUpperCase()} 检定`
      : "Click 后进行个人检定";
    input.party.forEach((actor, index) => {
      const hpAfterFixedEffects = node.activity.fixedEffects.reduce((hp, effect) => Math.min(actor.hpMax, hp + effect.amount), actor.hp);
      if (hpAfterFixedEffects <= 0) return;
      const id = `exploration-intent:${node.id}:${input.clickCount}:${actor.id}`;
      cards.push({ id, placement: "character", actorId: actor.id, kind: "exploration-intent", title: "场地探索",
        description: actionDescription, detail: dieLabel, order: index });
      relations.push({ from: id, to: locationRef, kind: "exploration-target" });
    });
  }
  node.activity.fixedEffects.forEach((effect, index) => {
    const id = `location-effect-preview:${node.id}:${input.clickCount}:${index}`;
    cards.push({ id, placement: "field", kind: "location-effect", title: "场所效果", description: effect.text,
      detail: "待本次 Click · 全队", order: index });
    for (const actor of input.party) relations.push({ from: id, to: characterCardRef(actor.id), kind: "effect-target" });
  });
  if (cards.length === 0) return null;
  return { id: `route:${node.id}:${input.clickCount}:prepared`, cards, relations };
}

function effectSummary(effect: BattleActionEffect | null): string {
  if (!effect) return "本轮无额外效果";
  switch (effect.kind) {
    case "attack": return "攻击已锁定目标";
    case "shield": return `提供 ${effect.amount} 点护盾`;
    case "heal": return `恢复 ${effect.amount} 点 HP`;
    case "attack-buff": return `攻击修正 +${effect.amount}`;
  }
}

function battleActionCost(action: PreparedBattleRound["playerActions"][number]): string {
  if (action.kind === "observe") return "sCost 0";
  return action.costPaid > 0 ? `sCost −${action.costPaid}` : "sCost 0";
}

function relationKey(relation: PreparedBattleCardRelation): string {
  return `${relation.from}\u0000${relation.to}\u0000${relation.kind}`;
}

export function projectPreparedBattleCards(
  round: PreparedBattleRound,
  skills: PreparedBattleSkills,
  plan: BattleRecipePlan,
): PreparedBattleCardBatch {
  const cards: PreparedBattleCardModel[] = [];
  const pendingRelations: PreparedBattleCardRelation[] = [];
  const cardIds = new Set<string>();
  const actionCardRefs = new Map<string, string>();
  const skillCardRefs = new Map<string, string>();
  const skillOrderByActor = new Map<string, number>();

  round.playerActions.forEach((action, index) => {
    const id = playerActionRef(index, action.actorId);
    actionCardRefs.set(id, id);
    cardIds.add(id);
    cards.push({ id, actorId: action.actorId, side: "ally", kind: "player-action", order: 0,
      title: action.kind === "observe" ? "观察 / 待机" : action.cardName ?? "普通行动",
      description: action.kind === "observe" ? "本次 Click 后最多回复 1 点 sCost" : effectSummary(action.effect),
      costLabel: battleActionCost(action) });
    for (const targetId of action.targetIds) pendingRelations.push({ from: id, to: characterCardRef(targetId), kind: "effect-target" });
  });

  round.enemyIntents.forEach((intent, index) => {
    const id = enemyIntentRef(index, intent.actorId);
    actionCardRefs.set(id, id);
    cardIds.add(id);
    const description = intent.resolution?.kind === "no-op" ? "本轮装填 · 无伤害"
      : intent.resolution?.kind === "fixed-damage" ? "对锁定目标造成固定伤害"
        : effectSummary(intent.effect);
    cards.push({ id, actorId: intent.actorId, side: "enemy", kind: "enemy-intent", order: index,
      title: intent.intentName, description, costLabel: "sCost —" });
    for (const targetId of intent.targetIds) pendingRelations.push({ from: id, to: characterCardRef(targetId), kind: "effect-target" });
  });

  for (const check of skills.checks) {
    if (!check.triggered) continue;
    const id = specialSkillRef(check.actorId, check.skillId);
    skillCardRefs.set(`${check.actorId}:${check.skillId}`, id);
    cardIds.add(id);
    const order = (skillOrderByActor.get(check.actorId) ?? 0) + 1;
    skillOrderByActor.set(check.actorId, order);
    cards.push({ id, actorId: check.actorId, side: "ally", kind: "special-skill", order,
      title: skillNames[check.skillId] ?? check.skillId,
      description: check.status === "triggered-no-target" ? "技能已触发，但没有合法目标" : skillSummaries[check.skillId] ?? "免费技能效果",
      costLabel: "免费 · sCost 0" });
  }

  skills.supplementalFreeActions.forEach((action, index) => {
    const sourceId = skillCardRefs.get(`${action.actorId}:${action.id}`);
    if (!sourceId) return;
    actionCardRefs.set(freeSkillActionRef(index, action.actorId, action.id), sourceId);
    for (const targetId of action.targetIds) pendingRelations.push({ from: sourceId, to: characterCardRef(targetId), kind: "effect-target" });
  });

  for (const modifier of skills.modifiers) {
    const sourceId = skillCardRefs.get(`${modifier.sourceActorId}:${modifier.skillId}`);
    const targetActionId = actionCardRefs.get(modifier.actionId);
    if (!sourceId) continue;
    if (targetActionId && targetActionId !== sourceId) pendingRelations.push({ from: sourceId, to: targetActionId, kind: "modifies-action" });
    else pendingRelations.push({ from: sourceId, to: characterCardRef(modifier.actorId), kind: "effect-target" });
  }

  for (const effect of skills.effects) {
    const sourceId = skillCardRefs.get(`${effect.sourceActorId}:${effect.skillId}`);
    if (!sourceId) continue;
    const targetActionId = actionCardRefs.get(effect.actionId);
    if (targetActionId && targetActionId !== sourceId) pendingRelations.push({ from: sourceId, to: targetActionId, kind: "modifies-action" });
    for (const targetId of effect.targetIds) pendingRelations.push({ from: sourceId, to: characterCardRef(targetId), kind: "effect-target" });
  }

  for (const match of plan.matches) {
    const left = actionCardRefs.get(match.leftActionId);
    const right = actionCardRefs.get(match.rightActionId);
    if (!left || !right || left === right) continue;
    pendingRelations.push({ from: left, to: right, kind: "recipe-partner" }, { from: right, to: left, kind: "recipe-partner" });
  }

  const validRefs = new Set([...cardIds, ...round.combatants.map((actor) => characterCardRef(actor.actorId))]);
  const seenRelations = new Set<string>();
  const relations = pendingRelations.filter((relation) => {
    if (!validRefs.has(relation.from) || !validRefs.has(relation.to) || relation.from === relation.to) return false;
    const key = relationKey(relation);
    if (seenRelations.has(key)) return false;
    seenRelations.add(key);
    return true;
  });

  return { id: `${round.encounterId}:${round.round}`, cards, relations };
}

function makeElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  content?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (content !== undefined) {
    element.textContent = content;
  }
  return element;
}

interface PlayerCostMeterRowNodes {
  readonly root: HTMLElement;
  readonly label: HTMLElement;
  readonly value: HTMLElement;
  readonly preview: HTMLElement;
  readonly slots: HTMLElement;
  readonly overflow: HTMLElement;
}

function createPlayerCostMeterRow(): PlayerCostMeterRowNodes {
  const root = makeElement("div", "player-cost-meter-row");
  root.setAttribute("role", "group");
  const heading = makeElement("div", "player-cost-meter-heading");
  const labelElement = makeElement("span", "player-cost-meter-label", "Cost");
  const value = makeElement("span", "player-cost-meter-value", "0");
  const preview = makeElement("span", "player-cost-meter-preview");
  heading.append(labelElement, value, preview);
  const slots = makeElement("div", "player-cost-meter-slots");
  slots.setAttribute("aria-hidden", "true");
  const overflow = makeElement("span", "player-cost-meter-overflow");
  root.append(heading, slots, overflow);
  return { root, label: labelElement, value, preview, slots, overflow };
}

function updatePlayerCostMeterRow(row: PlayerCostMeterRowNodes, projection: PlayerCostDockProjection, previewText: string): void {
  const slotCount = Math.max(1, Math.min(24, projection.heldCost));
  while (row.slots.childElementCount < slotCount) row.slots.append(makeElement("span", "player-cost-meter-slot"));
  while (row.slots.childElementCount > slotCount) row.slots.lastElementChild?.remove();
  [...row.slots.children].forEach((slot, index) => {
    const held = index < Math.min(projection.heldCost, 24);
    slot.classList.toggle("is-filled", held);
    slot.classList.toggle("is-consuming", held && index >= projection.heldCost - projection.consumingCost);
  });
  row.value.textContent = String(projection.heldCost);
  row.preview.textContent = previewText;
  row.overflow.textContent = projection.heldCost > 24 ? `+${projection.heldCost - 24}` : "";
  row.root.dataset.state = projection.state;
  row.root.setAttribute("aria-label", `持有 ${projection.heldCost} Cost，${previewText}`);
}

function createCharacterCard(character: CharacterState): CharacterCardNodes {
  const card = makeElement("article", "character-card");
  card.dataset.characterId = character.id;
  const identity = makeElement("div", "character-identity");
  const stamp = makeElement("span", "character-stamp", stamps[character.id] ?? character.name.slice(0, 1));
  stamp.setAttribute("aria-hidden", "true");
  const identityText = makeElement("div", "identity-text");
  const name = makeElement("h3", "character-name", character.name);
  const role = makeElement("p", "character-role", roles[character.id] ?? "巡查队员");
  const row = makeElement("span", `row-mark row-${character.row}`, character.row === "front" ? "前排" : "后排");
  identityText.append(name, role);
  identity.append(stamp, identityText, row);

  const health = makeElement("div", "health-readout");
  const healthLabel = makeElement("span", "field-label", "HP");
  const hp = makeElement("strong", "health-value");
  health.append(healthLabel, hp);
  const hpTrack = makeElement("div", "health-track");
  hpTrack.setAttribute("role", "progressbar");
  hpTrack.setAttribute("aria-label", `${character.name} HP`);
  hpTrack.setAttribute("aria-valuemin", "0");
  hpTrack.setAttribute("aria-valuemax", String(character.hpMax));
  const hpBar = makeElement("span", "health-fill");
  hpTrack.append(hpBar);

  const stats = makeElement("div", "character-stats");
  const atkField = makeElement("span", "stat-field");
  atkField.append(makeElement("span", "field-label", "ATK"), document.createTextNode(String(character.atk)));
  const defField = makeElement("span", "stat-field");
  defField.append(makeElement("span", "field-label", "DEF"), document.createTextNode(String(character.def)));
  stats.append(atkField, defField);

  card.append(identity, health, hpTrack, stats);
  const nodes = { element: card, row, role, hp, hpBar, hpTrack, atk: atkField.lastChild as Text, def: defField.lastChild as Text };
  updateCharacterCard(nodes, character);
  return nodes;
}

function updateCharacterCard(nodes: CharacterCardNodes, character: CharacterState): void {
  nodes.row.textContent = character.row === "front" ? "前排" : "后排";
  const role = roles[character.id] ?? "巡查队员";
  nodes.role.textContent = character.hp > 0 ? role : `倒地 · ${role}`;
  nodes.element.classList.toggle("is-down", character.hp <= 0);
  nodes.hp.textContent = `${character.hp} / ${character.hpMax}`;
  nodes.hpTrack.setAttribute("aria-valuenow", String(character.hp));
  nodes.hpTrack.setAttribute("aria-valuetext", character.hp > 0 ? `${character.hp} / ${character.hpMax} HP` : `倒地，0 / ${character.hpMax} HP`);
  nodes.hpBar.style.width = `${character.hpMax > 0 ? (character.hp / character.hpMax) * 100 : 0}%`;
  nodes.atk.data = String(character.atk);
  nodes.def.data = String(character.def);
}

function eventKind(event: EventRecord): string {
  switch (event.type) {
    case "location-entered":
      return event.text.startsWith("自动进入") ? "自动前进" : "场所记录";
    case "activity-result":
      return "逐人结果";
    case "activity-progress":
      return "活动进度";
    case "demo-completed":
      return "演示收尾";
  }
}

function createEventItem(event: EventRecord): HTMLLIElement {
  const item = makeElement("li", `event-item event-${event.type}`);
  const header = makeElement("div", "event-header");
  const number = makeElement("span", "event-number", `记录 ${String(event.sequence).padStart(2, "0")}`);
  const kind = makeElement("span", "event-kind", eventKind(event));
  header.append(number, kind);
  const message = makeElement("p", "event-message", event.text);
  item.append(header, message);
  if (event.dice) {
    item.append(makeElement("small", "event-detail", `第 ${event.click} 次 Click · 1d${event.dice.sides} = ${event.dice.value}`));
  }
  return item;
}

function eventScrollIsNearEnd(element: HTMLElement): boolean {
  return element.scrollHeight - element.clientHeight - element.scrollTop < 36;
}

function appendNewEvents(nodes: PageNodes, view: ReadonlyView, renderedThrough: number): number {
  const shouldFollow = eventScrollIsNearEnd(nodes.eventScroll);
  const previousScrollTop = nodes.eventScroll.scrollTop;
  let latest = renderedThrough;
  for (const event of view.events) {
    if (event.sequence <= renderedThrough) {
      continue;
    }
    nodes.eventList.append(createEventItem(event));
    latest = Math.max(latest, event.sequence);
  }
  nodes.eventScroll.scrollTop = shouldFollow ? nodes.eventScroll.scrollHeight : previousScrollTop;
  return latest;
}

function createCharacterGroup(title: string, row: CharacterState["row"]): { section: HTMLElement; list: HTMLElement } {
  const section = makeElement("section", `roster-group roster-${row}`);
  const heading = makeElement("h2", "group-heading", title);
  const list = makeElement("div", "roster-list");
  section.append(heading, list);
  return { section, list };
}

export function mountGameView(root: HTMLElement, initialView: ReadonlyView): {
  readonly advanceButton: HTMLButtonElement;
  update(view: ReadonlyView): void;
} {
  const shell = makeElement("main", "desk-layout");
  const party = makeElement("aside", "side-panel party-panel");
  party.setAttribute("aria-labelledby", "party-heading");
  const partyHeader = makeElement("header", "side-heading");
  partyHeader.append(makeElement("p", "eyebrow", "巡查编组 / 当前在场"));
  const partyTitle = makeElement("h2", "side-title", "我方值勤队");
  partyTitle.id = "party-heading";
  const partySummary = makeElement("p", "side-summary");
  partyHeader.append(partyTitle, partySummary);
  const frontGroup = createCharacterGroup("前排值勤", "front");
  const backGroup = createCharacterGroup("后排支援", "back");
  const characterCards = new Map<string, CharacterCardNodes>();
  for (const character of initialView.characters) {
    const card = createCharacterCard(character);
    characterCards.set(character.id, card);
    (character.row === "front" ? frontGroup.list : backGroup.list).append(card.element);
  }
  party.append(partyHeader, frontGroup.section, backGroup.section);

  const center = makeElement("section", "center-desk");
  center.setAttribute("aria-labelledby", "desk-title");
  const deskHeader = makeElement("header", "desk-header");
  const titleGroup = makeElement("div", "title-group");
  titleGroup.append(makeElement("p", "eyebrow", "独立预研 / 玩法 B"));
  const deskTitle = makeElement("h1", "desk-title", "游乐园巡查记录台");
  deskTitle.id = "desk-title";
  titleGroup.append(deskTitle, makeElement("p", "desk-subtitle", "每次 Click，登记一整次集体行为。"));
  deskHeader.append(titleGroup, makeElement("span", "sample-seal", "样本\n01"));

  const locationCard = makeElement("section", "location-card");
  locationCard.setAttribute("aria-labelledby", "location-name");
  const locationMeta = makeElement("div", "location-meta");
  const locationKind = makeElement("span", "location-kind");
  locationMeta.append(makeElement("span", "field-label", "当前场所"), locationKind);
  const locationName = makeElement("h2", "location-name");
  locationName.id = "location-name";
  const locationDescription = makeElement("p", "location-description");
  locationCard.append(locationMeta, locationName, locationDescription);

  const activityCard = makeElement("section", "activity-card");
  const activityCopy = makeElement("div", "activity-copy");
  activityCopy.append(makeElement("span", "ticket-label", "全队统一行动"));
  const activityHeading = makeElement("h2", "activity-heading");
  const activityStatus = makeElement("p", "activity-status");
  activityCopy.append(activityHeading, activityStatus);
  const activityMeter = makeElement("div", "activity-meter");
  activityMeter.setAttribute("role", "progressbar");
  activityMeter.setAttribute("aria-label", "林荫连廊活动进度");
  activityMeter.setAttribute("aria-valuemin", "0");
  activityMeter.setAttribute("aria-valuemax", "2");
  const activitySegments = [1, 2].map((index) => {
    const segment = makeElement("span", "activity-segment");
    segment.setAttribute("aria-hidden", "true");
    segment.dataset.step = String(index);
    activityMeter.append(segment);
    return segment;
  });
  activityCard.append(activityCopy, activityMeter);

  const transcript = makeElement("section", "transcript");
  transcript.setAttribute("aria-labelledby", "transcript-title");
  const transcriptHeader = makeElement("header", "transcript-header");
  const transcriptHeading = makeElement("h2", "transcript-title", "巡查记录");
  transcriptHeading.id = "transcript-title";
  transcriptHeader.append(transcriptHeading, makeElement("span", "transcript-note", "按发生顺序追加"));
  const eventScroll = makeElement("div", "event-scroll");
  const eventList = makeElement("ol", "event-list");
  eventList.setAttribute("aria-label", "场所活动事件记录");
  eventScroll.append(eventList);
  transcript.append(transcriptHeader, eventScroll);

  const actionDock = makeElement("footer", "action-dock");
  const clickHelper = makeElement("p", "click-helper");
  clickHelper.setAttribute("aria-live", "polite");
  const advanceButton = makeElement("button", "advance-button", "Click · 完成一次巡查") as HTMLButtonElement;
  advanceButton.type = "button";
  actionDock.append(clickHelper, advanceButton);
  center.append(deskHeader, locationCard, activityCard, transcript, actionDock);

  const enemyPanel = makeElement("aside", "side-panel enemy-panel");
  enemyPanel.setAttribute("aria-labelledby", "enemy-heading");
  const enemyHeader = makeElement("header", "side-heading");
  enemyHeader.append(makeElement("p", "eyebrow", "巡查范围 / 当前记录"));
  const enemyTitle = makeElement("h2", "side-title", "现场态势");
  enemyTitle.id = "enemy-heading";
  const enemyStatus = makeElement("p", "side-summary");
  enemyHeader.append(enemyTitle, enemyStatus);
  const sceneCard = makeElement("section", "scene-card");
  sceneCard.append(makeElement("span", "scene-index", "STATUS / 00"));
  sceneCard.append(makeElement("h3", "scene-card-title", "巡查中"));
  sceneCard.append(makeElement("p", "scene-card-copy", "当前场所为非战斗集体活动。此原型没有配置敌方单位。"));
  const emptyMark = makeElement("div", "empty-mark", "无敌方");
  emptyMark.setAttribute("aria-hidden", "true");
  sceneCard.append(emptyMark);
  enemyPanel.append(enemyHeader, sceneCard);

  shell.append(party, center, enemyPanel);
  root.replaceChildren(shell);
  const nodes: PageNodes = {
    locationKind,
    locationName,
    locationDescription,
    activityHeading,
    activityStatus,
    activityMeter,
    activitySegments,
    clickHelper,
    eventList,
    eventScroll,
    advanceButton,
    partySummary,
    enemyStatus,
    characterCards,
  };

  let renderedThrough = appendNewEvents(nodes, initialView, 0);
  const update = (view: ReadonlyView): void => {
    nodes.locationName.textContent = view.currentLocation.name;
    nodes.locationKind.textContent = view.currentLocation.kind === "activity" ? "集体活动" : view.terminal ? "演示结束" : "出口";
    nodes.locationDescription.textContent = view.phase === "activity"
      ? "地面留着新鲜车轮印，像是从游乐设施方向匆忙离开。四名队员会在每次 Click 后各自完成一次巡查。"
      : view.terminal
        ? "演示记录已收束。刷新页面会以相同 seed 重新开始。"
        : "队伍已自动进入游乐场出口；本次 Click 只结束技术演示，不执行出口活动。";
    nodes.partySummary.textContent = `${view.characters.length} 人 · 前排 ${view.characters.filter((character) => character.row === "front").length} / 后排 ${view.characters.filter((character) => character.row === "back").length}`;
    nodes.enemyStatus.textContent = "当前无敌方单位";

    const completedActivities = view.phase === "activity" ? 2 - (view.activityRemaining ?? 0) : 2;
    nodes.activityMeter.setAttribute("aria-valuenow", String(completedActivities));
    nodes.activityMeter.setAttribute("aria-valuetext", view.phase === "activity" ? `已完成 ${completedActivities} 次，剩余 ${view.activityRemaining} 次` : "两次活动已完成");
    nodes.activitySegments.forEach((segment, index) => {
      segment.classList.toggle("is-complete", index < completedActivities);
    });

    if (view.phase === "activity") {
      nodes.activityHeading.textContent = "全员沿廊巡查";
      nodes.activityStatus.textContent = `剩余活动度 ${view.activityRemaining} / 2 · 四人各行动一次`;
      nodes.clickHelper.textContent = "一次 Click 结算四人的巡查结果；到达出口时不会执行出口活动。";
      nodes.advanceButton.textContent = "Click · 完成一次巡查";
    } else if (view.terminal) {
      nodes.activityHeading.textContent = "演示已结束";
      nodes.activityStatus.textContent = "三次 Click 已完成 · 刷新可从相同起点重开";
      nodes.clickHelper.textContent = "记录已经收束；再次点击不会推进或追加事件。";
      nodes.advanceButton.textContent = "演示已结束";
    } else {
      nodes.activityHeading.textContent = "抵达游乐场出口";
      nodes.activityStatus.textContent = "两次全队活动已完成 · 出口活动未执行";
      nodes.clickHelper.textContent = "再 Click 一次收束此技术样本，不结算出口活动。";
      nodes.advanceButton.textContent = "Click · 收束演示";
    }
    nodes.advanceButton.setAttribute("aria-disabled", String(view.terminal));

    for (const character of view.characters) {
      const card = nodes.characterCards.get(character.id);
      if (card) {
        updateCharacterCard(card, character);
      }
    }
    renderedThrough = appendNewEvents(nodes, view, renderedThrough);
  };

  update(initialView);
  return { advanceButton, update };
}

function battleCharacter(actor: BattleCombatantSnapshot): CharacterState {
  return { id: actor.actorId, name: actor.name, row: actor.row, hp: actor.hp, hpMax: actor.hpMax, atk: actor.atk, def: actor.def, activityTags: [], inParty: true };
}

interface BattleCharacterCardNodes {
  readonly card: CharacterCardNodes;
  readonly sCost: Text;
}

function createBattleCharacterCard(actor: BattleCombatantSnapshot): BattleCharacterCardNodes {
  const card = createCharacterCard(battleCharacter(actor));
  const sCost = document.createTextNode(actor.currentBattleSCost === null ? "—" : String(actor.currentBattleSCost));
  const field = makeElement("span", "stat-field");
  field.append(makeElement("span", "field-label", "sCost"), sCost);
  card.element.querySelector(".character-stats")?.append(field);
  return { card, sCost };
}

function appendBattleLine(list: HTMLOListElement, text: string, kind: string): void {
  const item = makeElement("li", "event-item event-battle");
  const header = makeElement("div", "event-header");
  header.append(makeElement("span", "event-number", "记录 " + String(list.childElementCount + 1).padStart(2, "0")), makeElement("span", "event-kind", kind));
  item.append(header, makeElement("p", "event-message", text));
  list.append(item);
}

function battleTargets(round: PreparedBattleRound, ids: readonly string[]): string {
  return ids.length ? ids.map((id) => round.combatants.find((actor) => actor.actorId === id)?.name ?? id).join("、") : "无合法目标";
}

function appendPreparedRound(
  list: HTMLOListElement,
  round: PreparedBattleRound,
  skills: PreparedBattleSkills,
  plan: BattleRecipePlan,
  intentText?: (intent: PreparedBattleRound["enemyIntents"][number]) => string | undefined,
): void {
  const actorName = (id: string): string => round.combatants.find((actor) => actor.actorId === id)?.name ?? id;
  const labels = new Map<string, string>();
  round.playerActions.forEach((action, index) => labels.set(`player-action:${index}:${action.actorId}`, action.cardName ?? "观察 / 待机"));
  round.enemyIntents.forEach((intent, index) => labels.set(`enemy-intent:${index}:${intent.actorId}`, intent.intentName));
  skills.supplementalFreeActions.forEach((action, index) => labels.set(`free-skill:${index}:${action.actorId}:${action.id}`, skillNames[action.id] ?? action.id));
  const replacementText = (effect: BattleRecipeEffect): string => {
    const targets = effect.targetIds.map(actorName).join("、") || "无合法目标";
    if (effect.kind === "remove-round-shield") return `移除 ${targets} ${effect.amount} 点本轮护盾`;
    if (effect.kind === "gain-round-shield") return `${targets} 获得 ${effect.amount} 点本轮护盾`;
    return `${actorName(effect.actorId)} → ${targets}（${effect.damageAdjustment === 0 ? "正常攻击一次" : `伤害修正 ${effect.damageAdjustment > 0 ? "+" : ""}${effect.damageAdjustment}`}）`;
  };
  appendBattleLine(list, "第 " + round.round + " 轮已冻结：以下行动与目标将在本次 Click 结算。", "回合准备");
  for (const intent of round.enemyIntents) {
    const name = round.combatants.find((actor) => actor.actorId === intent.actorId)?.name ?? intent.actorId;
    appendBattleLine(list, intentText?.(intent) ?? "敌方预告：" + name + " · " + intent.intentName + " → " + battleTargets(round, intent.targetIds) + "。", "敌方预告");
  }
  for (const action of round.playerActions) {
    const name = round.combatants.find((actor) => actor.actorId === action.actorId)?.name ?? action.actorId;
    const move = action.kind === "observe" ? "观察 / 待机" : action.cardName + " → " + battleTargets(round, action.targetIds);
    const cost = action.kind === "observe" ? "sCost " + action.sCostBeforePayment : "sCost " + action.sCostBeforePayment + "−" + action.costPaid + "=" + action.sCostAfterPayment;
    appendBattleLine(list, "我方准备：" + name + " · " + move + "（" + cost + "）。", "我方行动");
  }
  for (const check of skills.checks) {
    const label = skillNames[check.skillId] ?? check.skillId;
    const status = check.status === "ineligible" ? "倒地，未检定" : check.status === "condition-not-met" ? "条件不满足" : check.status === "not-triggered" ? `d4=${check.dieRoll}，未触发` : check.status === "triggered-no-target" ? `d4=${check.dieRoll}，已触发但无合法目标` : `d4=${check.dieRoll}，已触发待结算`;
    const action = skills.supplementalFreeActions.find((entry) => entry.actorId === check.actorId && entry.id === check.skillId);
    const modifier = skills.modifiers.find((entry) => entry.skillId === check.skillId);
    const target = action?.targetIds.length ? ` → ${action.targetIds.map(actorName).join("、")}` : modifier ? ` → ${actorName(modifier.actorId)} 的已准备行动` : "";
    appendBattleLine(list, `${actorName(check.actorId)} · ${label}：${status}${target}。`, "技能检定");
  }
  for (const match of plan.matches) {
    const output = match.replacementEffects.map(replacementText).join("；");
    appendBattleLine(list, `配方待替代：${labels.get(match.leftActionId) ?? match.leftActionId} + ${labels.get(match.rightActionId) ?? match.rightActionId} → ${output}。`, "配方预览");
  }
}

export function mountBattleGameView(root: HTMLElement, initialView: BattleView): {
  readonly advanceButton: HTMLButtonElement;
  update(view: BattleView): void;
} {
  const shell = makeElement("main", "desk-layout");
  const party = makeElement("aside", "side-panel party-panel"); party.setAttribute("aria-labelledby", "party-heading");
  const partyHeader = makeElement("header", "side-heading");
  partyHeader.append(makeElement("p", "eyebrow", "首战编组 / 4 名 Chara"));
  const partyTitle = makeElement("h2", "side-title", "我方值勤队"); partyTitle.id = "party-heading";
  const partySummary = makeElement("p", "side-summary"); partyHeader.append(partyTitle, partySummary);
  const frontGroup = createCharacterGroup("前排值勤", "front"), backGroup = createCharacterGroup("后排支援", "back");
  const partyCards = new Map<string, BattleCharacterCardNodes>();
  for (const actor of initialView.state.combatants.filter((entry) => entry.side === "ally")) {
    const nodes = createBattleCharacterCard(actor); partyCards.set(actor.actorId, nodes);
    (actor.row === "front" ? frontGroup.list : backGroup.list).append(nodes.card.element);
  }
  party.append(partyHeader, frontGroup.section, backGroup.section);

  const center = makeElement("section", "center-desk"); center.setAttribute("aria-labelledby", "desk-title");
  const deskHeader = makeElement("header", "desk-header"), titleGroup = makeElement("div", "title-group");
  titleGroup.append(makeElement("p", "eyebrow", "独立预研 / 玩法 B"));
  const deskTitle = makeElement("h1", "desk-title", "首战 · 碰碰车区"); deskTitle.id = "desk-title";
  titleGroup.append(deskTitle, makeElement("p", "desk-subtitle", "每次 Click，结算一整轮已冻结的双方行动。"));
  deskHeader.append(titleGroup, makeElement("span", "sample-seal", "首战\n01"));
  const locationCard = makeElement("section", "location-card");
  const locationMeta = makeElement("div", "location-meta"); locationMeta.append(makeElement("span", "field-label", "当前场所"), makeElement("span", "location-kind", "战斗"));
  const locationName = makeElement("h2", "location-name", "失控碰碰车区");
  const locationDescription = makeElement("p", "location-description", "四名初始队员对阵冲撞者与水枪射手。预告、目标、行动与数值变化均按准备记录逐项展示。");
  locationCard.append(locationMeta, locationName, locationDescription);
  const activityCard = makeElement("section", "activity-card"), activityCopy = makeElement("div", "activity-copy");
  activityCopy.append(makeElement("span", "ticket-label", "回合结算"));
  const activityHeading = makeElement("h2", "activity-heading"), activityStatus = makeElement("p", "activity-status");
  activityCopy.append(activityHeading, activityStatus); activityCard.append(activityCopy);
  const transcript = makeElement("section", "transcript"); transcript.setAttribute("aria-labelledby", "transcript-title");
  const transcriptHeader = makeElement("header", "transcript-header"), transcriptHeading = makeElement("h2", "transcript-title", "战斗记录");
  transcriptHeading.id = "transcript-title";
  transcriptHeader.append(transcriptHeading, makeElement("span", "transcript-note", "预备 → 结算 → 下一轮"));
  const eventScroll = makeElement("div", "event-scroll"), eventList = makeElement("ol", "event-list");
  eventList.setAttribute("aria-label", "战斗行动与结算记录"); eventScroll.append(eventList); transcript.append(transcriptHeader, eventScroll);
  const actionDock = makeElement("footer", "action-dock"), clickHelper = makeElement("p", "click-helper");
  const advanceButton = makeElement("button", "advance-button", "") as HTMLButtonElement; advanceButton.type = "button";
  actionDock.append(clickHelper, advanceButton); center.append(deskHeader, locationCard, activityCard, transcript, actionDock);

  const enemyPanel = makeElement("aside", "side-panel enemy-panel"); enemyPanel.setAttribute("aria-labelledby", "enemy-heading");
  const enemyHeader = makeElement("header", "side-heading"); enemyHeader.append(makeElement("p", "eyebrow", "当前遭遇 / 敌方"));
  const enemyTitle = makeElement("h2", "side-title", "对方队伍"); enemyTitle.id = "enemy-heading";
  const enemySummary = makeElement("p", "side-summary"); enemyHeader.append(enemyTitle, enemySummary);
  const enemyFront = createCharacterGroup("前排", "front"), enemyBack = createCharacterGroup("后排", "back");
  const enemyCards = new Map<string, BattleCharacterCardNodes>();
  for (const actor of initialView.state.combatants.filter((entry) => entry.side === "enemy")) {
    const nodes = createBattleCharacterCard(actor); enemyCards.set(actor.actorId, nodes);
    (actor.row === "front" ? enemyFront.list : enemyBack.list).append(nodes.card.element);
  }
  enemyPanel.append(enemyHeader, enemyFront.section, enemyBack.section);
  shell.append(party, center, enemyPanel); root.replaceChildren(shell);

  let renderedPreparedRound = 0, renderedResolutionRound = 0;
  const nearEnd = (): boolean => eventScroll.scrollHeight - eventScroll.clientHeight - eventScroll.scrollTop < 36;
  const appendPrepared = (round: PreparedBattleRound, skills: PreparedBattleSkills, plan: BattleRecipePlan): void => {
    const follow = nearEnd(), top = eventScroll.scrollTop;
    appendPreparedRound(eventList, round, skills, plan);
    renderedPreparedRound = round.round;
    eventScroll.scrollTop = follow ? eventScroll.scrollHeight : top;
  };
  const appendResolution = (view: BattleView): void => {
    const resolution = view.lastResolution;
    if (!resolution || resolution.prepared.round <= renderedResolutionRound) return;
    const follow = nearEnd(), top = eventScroll.scrollTop;
    appendBattleLine(eventList, "第 " + resolution.prepared.round + " 轮结算：", "Click 结算");
    for (const line of resolution.events) appendBattleLine(eventList, line, view.terminal && line.startsWith("战斗") ? "战斗终局" : "数值变化");
    renderedResolutionRound = resolution.prepared.round;
    eventScroll.scrollTop = follow ? eventScroll.scrollHeight : top;
  };
  const update = (view: BattleView): void => {
    const round = view.pendingRound?.round ?? view.lastResolution?.prepared.round ?? view.state.round;
    const allies = view.state.combatants.filter((actor) => actor.side === "ally");
    partySummary.textContent = "4 人 · 前排 " + allies.filter((actor) => actor.row === "front").length + " / 后排 " + allies.filter((actor) => actor.row === "back").length;
    enemySummary.textContent = view.state.combatants.filter((actor) => actor.side === "enemy" && actor.hp > 0).length + " 名存活";
    activityHeading.textContent = view.terminal ? (view.state.result === "victory" ? "首战胜利" : view.state.result === "defeat" ? "首战失败" : "战斗平局") : "第 " + round + " 轮准备完成";
    activityStatus.textContent = view.terminal ? "战斗已经结束 · sCost 已清除" : "双方行动与目标已锁定 · Click 后统一结算第 " + round + " 轮";
    clickHelper.textContent = view.terminal ? "终局已收束；重复输入不会新增事件或重复结算。" : "唯一输入：结算当前冻结回合；下一轮只在结算后准备。";
    advanceButton.textContent = view.terminal ? activityHeading.textContent : "Click · 结算第 " + round + " 轮";
    advanceButton.setAttribute("aria-disabled", String(view.terminal));
    for (const actor of view.state.combatants) {
      const card = (actor.side === "ally" ? partyCards : enemyCards).get(actor.actorId);
      if (card) {
        updateCharacterCard(card.card, battleCharacter(actor));
        card.sCost.data = actor.currentBattleSCost === null ? "—" : String(actor.currentBattleSCost);
      }
    }
    appendResolution(view);
    if (view.pendingRound && view.pendingSkills && view.pendingRecipePlan && view.pendingRound.round > renderedPreparedRound) appendPrepared(view.pendingRound, view.pendingSkills, view.pendingRecipePlan);
  };
  if (initialView.pendingRound && initialView.pendingSkills && initialView.pendingRecipePlan) appendPrepared(initialView.pendingRound, initialView.pendingSkills, initialView.pendingRecipePlan);
  update(initialView);
  return { advanceButton, update };
}

function routePartyCharacter(actor: RoutePartyView): CharacterState {
  return {
    id: actor.id,
    name: actor.name,
    row: actor.row,
    hp: actor.hp,
    hpMax: actor.hpMax,
    atk: actor.atk,
    def: actor.def,
    activityTags: actor.activityTags,
    inParty: true,
  };
}

function createRoutePartyCard(actor: RoutePartyView): BattleCharacterCardNodes {
  const card = createCharacterCard(routePartyCharacter(actor));
  const sCost = document.createTextNode(actor.currentBattleSCost === null ? "—" : String(actor.currentBattleSCost));
  const field = makeElement("span", "stat-field");
  field.append(makeElement("span", "field-label", "sCost"), sCost);
  card.element.querySelector(".character-stats")?.append(field);
  return { card, sCost };
}

function routeEventLabel(event: RouteEventRecord): string {
  const labels: Readonly<Record<RouteEventRecord["type"], string>> = {
    "node-entered": "场所",
    "character-joined": "队伍",
    "activity-fixed-effect": "补给",
    "activity-result": "活动结果",
    "activity-progress": "活动进度",
    "battle-event": "战斗",
    "battle-ended": "战斗终局",
    "exit-options": "可选出口",
    "exit-chosen": "路线选择",
    "exit-item-consumed": "物品消耗",
    "player-cost-gained": "Cost 获得",
    "player-cost-paid": "Cost 支付",
    "player-cost-capped": "Cost 携带上限",
    "scene-behavior": "场景行为",
    "player-card-drawn": "抽到卡牌",
    "player-card-played": "使用卡牌",
    "player-card-effect": "卡牌效果",
    "item-gained": "获得物品",
    "route-terminal": "路线结果",
  };
  return labels[event.type];
}

function appendRouteEvent(list: HTMLOListElement, event: RouteEventRecord, context: readonly string[] = [], displayText = event.text): void {
  const item = makeElement("li", "event-item event-route");
  item.dataset.sequence = String(event.sequence);
  item.dataset.click = String(event.click);
  const header = makeElement("div", "event-header");
  header.append(
    makeElement("span", "event-number", `记录 ${String(event.sequence).padStart(2, "0")}`),
    makeElement("span", "event-kind", routeEventLabel(event)),
  );
  item.append(header, makeElement("p", "event-message", displayText));
  if (event.dice) {
    const result = event.dice.bonus
      ? `${event.dice.value} + ${event.dice.bonus} → ${event.dice.modifiedValue}`
      : String(event.dice.value);
    item.append(makeElement("small", "event-detail", `第 ${event.click} 次 Click · 1d${event.dice.sides} = ${result}`));
  }
  for (const text of context) item.append(makeElement("p", "event-context", text));
  list.append(item);
}

function findParkText(nodeId: string, trigger: ParkTextTrigger, referenceId?: string, activityIndex?: number): ParkTextEntry | undefined {
  return parkTextEntries.find((entry) => entry.nodeId === nodeId && entry.trigger === trigger &&
    entry.referenceId === referenceId && entry.activityIndex === activityIndex);
}

function resolveParkText(entry: ParkTextEntry | undefined, targetIds: readonly string[] = [], actors: readonly BattleCombatantSnapshot[] = []): string | undefined {
  if (!entry) return undefined;
  const targets = targetIds.map((id) => actors.find((actor) => actor.actorId === id)?.name ?? id).join("、") || "无合法目标";
  return entry.text.replaceAll("{target}", targets).replaceAll("{targets}", targets);
}

function battleResultFromEvent(event: RouteEventRecord): "victory" | "defeat" | "draw" | undefined {
  if (event.text.includes("victory")) return "victory";
  if (event.text.includes("defeat")) return "defeat";
  if (event.text.includes("draw")) return "draw";
  return undefined;
}

const routeDescriptions: Readonly<Record<string, string>> = {
  "node-1": "检查通讯与备用护具，确认游乐园巡查目标。",
  "node-2": "搜寻车轮印与代币线索；发现情况只记入事件日志。",
  "node-3": "在服务亭短暂休息，个人恢复按各自检定结果记录。",
  "node-4": "检查电玩馆现场，线索不创建路线旗标或分支。",
  "node-5": "普通战斗：冲撞者在前排，水枪射手从后排狙击。",
  "node-6": "千世在入场时加入；固定恢复与装备补给在本节点 Click 执行。",
  "node-7": "DEF 检定决定是否安全通过镜面迷宫；全队倒地会立即结束路线。",
  "node-8": "ATK 检定只记录通道信息，路线仍保持固定。",
  "node-9": "强敌战斗：临时领头、冲撞者与烟花手。",
  "node-10": "玲奈在入场时加入；整备效果作用于下一场 Boss 战。",
  "node-11": "Boss 战：关注混合范围意图与当前冻结目标。",
  "node-12": "出口交接只需一次 Click；完成后路线进入终态。",
};

export type PlayerEditCommand =
  | { readonly kind: "ordinary"; readonly actorId: string; readonly cardId: string | null; readonly targetIds: readonly string[] }
  | { readonly kind: "free-skill"; readonly actorId: string; readonly skillId: string; readonly targetIds: readonly string[] };

export type RouteInteractionCommand =
  | PlayerEditCommand
  | { readonly kind: "individual-behavior"; readonly actorId: string; readonly behaviorId: string }
  | { readonly kind: "global-behavior"; readonly behaviorId: string; readonly targetIds: readonly string[] }
  | { readonly kind: "player-card"; readonly cardId: string; readonly targetIds: readonly string[] }
  | { readonly kind: "unselect-player-card"; readonly cardId: string }
  | { readonly kind: "choose-exit"; readonly exitId: string };

export interface RouteMapArea {
  readonly id: string;
  readonly label: string;
  readonly nodeIds: readonly string[];
}

export interface GameplayBRouteViewContent {
  readonly nodes?: readonly GameplayBRouteNode[];
  readonly areas?: readonly RouteMapArea[];
  readonly descriptions?: Readonly<Record<string, string>>;
  readonly itemNames?: Readonly<Record<string, string>>;
  readonly title?: string;
  readonly subtitle?: string;
}

const routeMapPositions: Readonly<Record<string, { readonly x: number; readonly y: number }>> = {
  "node-1": { x: 105, y: 50 }, "node-2": { x: 285, y: 50 }, "node-3": { x: 500, y: 50 }, "node-4": { x: 830, y: 50 },
  "node-5": { x: 95, y: 255 }, "node-6": { x: 425, y: 155 }, "node-7": { x: 650, y: 155 }, "node-8": { x: 890, y: 155 },
  "node-9": { x: 280, y: 405 }, "node-10": { x: 95, y: 405 }, "node-11": { x: 700, y: 405 }, "node-12": { x: 485, y: 405 },
  "node-13": { x: 890, y: 305 },
};

export function projectRouteMapSummary(view: GameplayBRouteView, nodes: readonly GameplayBRouteNode[]): string {
  const names = new Map(nodes.map((node) => [node.id, node.name]));
  const path = view.events.filter((event) => event.type === "node-entered")
    .map((event) => names.get(event.nodeId) ?? event.nodeId);
  const route = path.length ? path.join(" → ") : names.get(view.currentNode.id) ?? view.currentNode.name;
  const visits = view.nodeVisitCounts[view.currentNode.id] ?? 0;
  const status = view.terminal ? "巡查已结束"
    : view.awaitingExitChoice ? `等待选择开放出口（${view.availableExits.length} 条）`
      : view.sceneChoice ? "等待完成本批场景选择"
        : view.currentNode.kind === "battle" ? "战斗处理中"
          : view.activityRemaining !== null ? `等待场景推进（剩余 ${view.activityRemaining} 次）` : "等待场景推进";
  return `当前位置：${view.currentNode.name} ×${visits} · 已走路线：${route} · ${status}`;
}

export type PlayerCostDockBlocker = "ready" | "needs-choice" | "needs-target" | "awaiting-exit" | "terminal";

export interface PlayerCostDockProjection {
  readonly heldCost: number;
  readonly consumingCost: number;
  readonly afterClickCost: number | null;
  readonly afterClickLabel: string;
  readonly state: "ready" | "needs-choice" | "needs-target" | "insufficient" | "awaiting-exit" | "terminal";
}

export function projectPlayerCostDock(
  heldCost: number,
  selectedCost: number,
  blocker: PlayerCostDockBlocker = "ready",
): PlayerCostDockProjection {
  if (blocker === "terminal") return { heldCost, consumingCost: 0, afterClickCost: null, afterClickLabel: "已结束", state: "terminal" };
  if (blocker === "awaiting-exit") return { heldCost, consumingCost: 0, afterClickCost: null, afterClickLabel: "先选出口", state: "awaiting-exit" };
  if (selectedCost > heldCost) {
    return { heldCost, consumingCost: 0, afterClickCost: null, afterClickLabel: `不足 ${selectedCost - heldCost}`, state: "insufficient" };
  }
  if (blocker === "needs-target") return { heldCost, consumingCost: selectedCost, afterClickCost: null, afterClickLabel: "待确认", state: "needs-target" };
  if (blocker === "needs-choice") return { heldCost, consumingCost: selectedCost, afterClickCost: null, afterClickLabel: "待选择", state: "needs-choice" };
  return { heldCost, consumingCost: selectedCost, afterClickCost: heldCost - selectedCost,
    afterClickLabel: String(heldCost - selectedCost), state: "ready" };
}

export function projectTraversedRouteEdgeKeys(nodes: readonly GameplayBRouteNode[], enteredNodeIds: readonly string[]): ReadonlySet<string> {
  const edgeCounts = new Map<string, number>();
  for (const node of nodes) for (const exit of node.exits ?? []) {
    const key = `${node.id}→${exit.targetNodeId}`;
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }
  return new Set(enteredNodeIds.slice(1).flatMap((id, index) => {
    const key = `${enteredNodeIds[index]}→${id}`;
    return edgeCounts.get(key) === 1 ? [key] : [];
  }));
}

export function describeRouteExit(
  exit: GameplayBRouteView["availableExits"][number],
  nodes: readonly GameplayBRouteNode[],
  itemNames: Readonly<Record<string, string>> = {},
): string {
  const target = nodes.find((node) => node.id === exit.targetNodeId)?.name ?? exit.targetNodeId;
  const definition = nodes.flatMap((node) => node.exits ?? []).find((candidate) => candidate.id === exit.id);
  const consumed = definition?.consumeItems ?? [];
  const cost = consumed.length ? ` · 消耗：${consumed.map((id) => itemNames[id] ?? id).join("、")}` : " · 不消耗持有物";
  return `${exit.label} → ${target}${cost}`;
}

export interface PlayerTargetSelectionResult {
  readonly selectedIds: readonly string[];
  readonly error: string | null;
}

export function initialPlayerTargetsAfterDrop(option: PlayerTargetEditOption, targetId: string): readonly string[] {
  if (!option.candidateIds.includes(targetId)) return [];
  return [...new Set([...option.fixedIds, targetId])];
}

export function togglePlayerTargetSelection(
  candidateIds: readonly string[],
  fixedIds: readonly string[],
  requiredCount: number,
  selectedIds: readonly string[],
  targetId: string,
): PlayerTargetSelectionResult {
  if (!candidateIds.includes(targetId) || fixedIds.includes(targetId)) return { selectedIds, error: null };
  if (selectedIds.includes(targetId)) return { selectedIds: selectedIds.filter((id) => id !== targetId), error: null };
  if (selectedIds.length >= requiredCount) return { selectedIds, error: "目标数量已满；请先取消一个已选目标。" };
  return { selectedIds: [...selectedIds, targetId], error: null };
}

export function playerTargetSelectionIsComplete(
  fixedIds: readonly string[],
  requiredCount: number,
  selectedIds: readonly string[],
): boolean {
  return selectedIds.length === requiredCount && fixedIds.every((id) => selectedIds.includes(id));
}

export function summarizeSceneBehavior(behavior: GameplayBRouteSceneBehavior, itemNames: Readonly<Record<string, string>> = {}): string {
  const parts = behavior.activity.fixedEffects.map((effect) => effect.text);
  const check = behavior.activity.individualCheck;
  if (check?.kind === "attribute") {
    const stat = check.attribute === "atk" ? "ATK" : "DEF";
    parts.push(`d${check.dieSides} + ${stat} 对抗 ${check.difficulty}；成功：${check.success.text}；未达：${check.failure.text}`);
  } else if (check?.kind === "chance") {
    const outcomes = Object.entries(check.outcomes).map(([roll, result]) => `${roll}点：${result.outcome.text}`);
    parts.push(`d${check.dieSides}结果：${outcomes.join("；")}`);
  }
  if (behavior.successItems?.length) parts.push(`成功时获得${behavior.successItems.map((id) => itemNames[id] ?? id).join("、")}`);
  return parts.join(" · ") || "无额外效果";
}

export function projectIndividualBehaviorRow(behavior: GameplayBRouteSceneBehavior | undefined, itemNames: Readonly<Record<string, string>> = {}): { readonly state: string; readonly summary: string } {
  return behavior
    ? { state: "已选", summary: `${behavior.label} · ${behavior.cost} Cost · ${summarizeSceneBehavior(behavior, itemNames)}` }
    : { state: "待选", summary: "先为该角色选择本批行为。" };
}

export function summarizePlayerCard(card: RoutePlayerCardDefinition, itemNames: Readonly<Record<string, string>> = {}): string {
  const effect = card.effect;
  if (effect.kind === "gain-item") return `获得持有物：${itemNames[effect.itemId] ?? effect.itemId}`;
  const target = effect.targetMode === "party" ? "全队" : effect.targetMode === "one" ? "选择一名角色" : "选择多名角色";
  return effect.kind === "heal" ? `${target}恢复 ${effect.amount} HP` : `${target}的检定 +${effect.amount}`;
}

export function playerCardSelectionSummary(card: RoutePlayerCardDefinition, targetIds: readonly string[], characterNames: Readonly<Record<string, string>> = {}): string {
  if (card.effect.kind === "gain-item") return "已选入本批 · 无需角色目标";
  if (card.effect.targetMode === "party") return "已确认目标：全队";
  const targets = targetIds.map((id) => characterNames[id] ?? id);
  return `已确认目标：${targets.join("、") || "无"}`;
}

export function playerCardInstanceLabel(card: RoutePlayerCardDefinition, handIndex: number): string {
  const suffix = card.id.match(/-([a-z])$/i)?.[1]?.toUpperCase();
  return `${card.name} #${suffix ?? String(handIndex + 1)}`;
}

export function playerCardTargetSelectionReady(targetMode: "one" | "many", targets: readonly string[]): boolean {
  return targetMode === "one" ? targets.length === 1 : targets.length > 0;
}

export function projectPlayerCardTargetDraft(cardId: string, drafts: ReadonlyMap<string, readonly string[]>): { readonly selectedIds: readonly string[] } | null {
  const selectedIds = drafts.get(cardId);
  return selectedIds === undefined ? null : { selectedIds: [...selectedIds] };
}

export function mountRouteGameView(
  root: HTMLElement,
  initialView: GameplayBRouteView,
  applyPlayerEdit: (command: RouteInteractionCommand) => { readonly outcome: PlayerEditOutcome | RouteCommandOutcome; readonly view: GameplayBRouteView },
  content: GameplayBRouteViewContent = {},
): {
  readonly advanceButton: HTMLButtonElement;
  update(view: GameplayBRouteView): void;
} {
  const routeNodes = content.nodes ?? parkRouteNodes;
  const areaGroups: readonly RouteMapArea[] = content.areas ?? (() => {
    const groups = new Map<string, string[]>();
    for (const node of routeNodes) {
      const area = node.area ?? "园区路线";
      const ids = groups.get(area) ?? [];
      ids.push(node.id);
      groups.set(area, ids);
    }
    return [...groups].map(([label, nodeIds]) => ({ id: label, label, nodeIds }));
  })();
  const shell = makeElement("main", "desk-layout");
  const partyPanel = makeElement("aside", "side-panel party-panel");
  partyPanel.setAttribute("aria-labelledby", "party-heading");
  const partyHeader = makeElement("header", "side-heading");
  partyHeader.append(makeElement("p", "eyebrow", "路线编组 / 当前在场"));
  const partyTitle = makeElement("h2", "side-title", "我方值勤队");
  partyTitle.id = "party-heading";
  const partySummary = makeElement("p", "side-summary");
  partyHeader.append(partyTitle, partySummary);
  const partyFront = createCharacterGroup("前排值勤", "front");
  const partyBack = createCharacterGroup("后排支援", "back");
  const partyCards = new Map<string, BattleCharacterCardNodes>();
  const partyPreparedLayer = makeElement("div", "prepared-card-layer");
  partyPanel.append(partyHeader, partyFront.section, partyBack.section, partyPreparedLayer);

  const center = makeElement("section", "center-desk");
  center.setAttribute("aria-labelledby", "desk-title");
  const deskHeader = makeElement("header", "desk-header");
  const titleGroup = makeElement("div", "title-group");
  titleGroup.append(makeElement("p", "eyebrow", "独立预研 / 玩法 B"));
  const deskTitle = makeElement("h1", "desk-title", content.title ?? "游园会巡查");
  deskTitle.id = "desk-title";
  titleGroup.append(deskTitle, makeElement("p", "desk-subtitle", content.subtitle ?? "每次 Click 只处理当前场景行动或冻结战斗回合。"));
  const routeSeal = makeElement("span", "sample-seal", "到访\n01");
  deskHeader.append(titleGroup, routeSeal);

  const locationCard = makeElement("section", "location-card");
  const locationMeta = makeElement("div", "location-meta");
  locationMeta.append(makeElement("span", "field-label", "当前节点"));
  const locationKind = makeElement("span", "location-kind");
  locationMeta.append(locationKind);
  const locationName = makeElement("h2", "location-name");
  const locationDescription = makeElement("p", "location-description");
  const routeMap = makeElement("nav", "route-map-panel");
  routeMap.setAttribute("aria-label", "游乐园区域路线图");
  const routeMapHeader = makeElement("div", "route-map-header");
  const routeMapTitle = makeElement("h3", "route-map-title", "巡查线路摘要");
  const mapToggle = makeElement("button", "route-map-toggle", "展开完整路线图") as HTMLButtonElement;
  mapToggle.type = "button";
  mapToggle.setAttribute("aria-expanded", "false");
  mapToggle.setAttribute("aria-controls", "route-map-areas");
  routeMapHeader.append(routeMapTitle, mapToggle);
  const routeResourceSummary = makeElement("p", "route-resource-summary");
  routeMapHeader.append(routeResourceSummary);
  const mapAreas = makeElement("div", "route-map-areas");
  mapAreas.id = "route-map-areas";
  mapAreas.setAttribute("aria-label", "完整结构路线图；箭头显示配置连接，只有开放出点按钮可以选择");
  const mapSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mapSvg.classList.add("route-map-edges");
  mapSvg.setAttribute("viewBox", "0 0 1000 460");
  mapSvg.setAttribute("preserveAspectRatio", "none");
  mapSvg.setAttribute("aria-hidden", "true");
  const mapDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  arrow.id = "route-map-arrow";
  arrow.setAttribute("viewBox", "0 0 8 8");
  arrow.setAttribute("refX", "7");
  arrow.setAttribute("refY", "4");
  arrow.setAttribute("markerWidth", "5");
  arrow.setAttribute("markerHeight", "5");
  arrow.setAttribute("orient", "auto-start-reverse");
  const routeArrowHead = document.createElementNS("http://www.w3.org/2000/svg", "path");
  routeArrowHead.setAttribute("d", "M 0 0 L 8 4 L 0 8 z");
  routeArrowHead.classList.add("route-map-arrow");
  arrow.append(routeArrowHead);
  mapDefs.append(arrow);
  mapSvg.append(mapDefs);
  const mapEdgeElements = new Map<string, SVGPathElement>();
  const edges = routeNodes.flatMap((node) => (node.exits ?? []).map((exit) => ({ sourceId: node.id, exit })));
  edges.forEach(({ sourceId, exit }, index) => {
    const source = routeMapPositions[sourceId];
    const target = routeMapPositions[exit.targetNodeId];
    if (!source || !target) return;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const clip = Math.min(1, dx ? 95 / Math.abs(dx) : 1, dy ? 32 / Math.abs(dy) : 1);
    const startX = source.x + dx * clip;
    const startY = source.y + dy * clip;
    const endX = target.x - dx * clip;
    const endY = target.y - dy * clip;
    const bend = (index % 2 ? 1 : -1) * (14 + index % 3 * 5);
    const edge = document.createElementNS("http://www.w3.org/2000/svg", "path");
    edge.classList.add("route-map-edge");
    edge.dataset.sourceId = sourceId;
    edge.dataset.targetId = exit.targetNodeId;
    edge.dataset.exitId = exit.id;
    edge.setAttribute("d", `M ${startX} ${startY} Q ${(startX + endX) / 2} ${(startY + endY) / 2 + bend} ${endX} ${endY}`);
    edge.setAttribute("marker-end", "url(#route-map-arrow)");
    mapSvg.append(edge);
    mapEdgeElements.set(exit.id, edge);
  });
  mapAreas.append(mapSvg);
  const mapNodeElements = new Map<string, { root: HTMLSpanElement; visits: HTMLSpanElement }>();
  for (const area of areaGroups) {
    for (const nodeId of area.nodeIds) {
      const node = routeNodes.find((candidate) => candidate.id === nodeId);
      if (!node) continue;
      const marker = makeElement("span", "route-map-node");
      marker.tabIndex = -1;
      marker.dataset.nodeId = node.id;
      marker.dataset.area = node.area ?? area.label;
      marker.setAttribute("aria-label", `${node.name}，${node.area ?? area.label}`);
      const position = routeMapPositions[node.id];
      if (position) {
        marker.style.left = `${position.x / 10}%`;
        marker.style.top = `${position.y / 4.6}%`;
      }
      const label = makeElement("span", "route-map-node-name", node.name);
      const visits = makeElement("span", "route-map-node-visits");
      marker.append(label, visits);
      mapAreas.append(marker);
      mapNodeElements.set(node.id, { root: marker, visits });
    }
  }
  mapToggle.addEventListener("click", () => {
    const expanded = !mapAreas.classList.contains("is-expanded");
    mapAreas.classList.toggle("is-expanded", expanded);
    mapToggle.setAttribute("aria-expanded", String(expanded));
    mapToggle.textContent = expanded ? "收起完整路线图" : "展开完整路线图";
  });
  const exitRegion = makeElement("section", "route-map-exits");
  exitRegion.hidden = true;
  exitRegion.setAttribute("aria-labelledby", "route-exits-title");
  const exitTitle = makeElement("h4", "route-map-area-title", "当前开放出点 · 仅以下按钮可选");
  exitTitle.id = "route-exits-title";
  exitRegion.append(exitTitle);
  const exitList = makeElement("div", "route-exit-list");
  exitRegion.append(exitList);
  routeMap.append(routeMapHeader, mapAreas, exitRegion);
  locationCard.append(locationMeta, locationName, locationDescription, routeMap);

  const activityCard = makeElement("section", "activity-card");
  const activityCopy = makeElement("div", "activity-copy");
  activityCopy.append(makeElement("span", "ticket-label", "当前行为"));
  const activityHeading = makeElement("h2", "activity-heading");
  const activityStatus = makeElement("p", "activity-status");
  activityCopy.append(activityHeading, activityStatus);
  const previewContent = makeElement("div", "route-preview");
  previewContent.style.maxHeight = "8rem";
  previewContent.style.overflowY = "auto";
  previewContent.style.overscrollBehavior = "contain";
  previewContent.tabIndex = 0;
  previewContent.setAttribute("aria-label", "当前行为预览，可滚动查看完整战斗行动");
  const sceneChoicePanel = makeElement("section", "scene-choice-panel");
  sceneChoicePanel.hidden = true;
  sceneChoicePanel.setAttribute("aria-label", "场景行为和主动卡选择");
  const sceneChoiceHeader = makeElement("div", "scene-choice-header");
  const sceneChoiceTitle = makeElement("h3", "scene-choice-title");
  const sceneChoiceStatus = makeElement("p", "scene-choice-status");
  sceneChoiceHeader.append(sceneChoiceTitle, sceneChoiceStatus);
  const sceneChoiceControls = makeElement("div", "scene-choice-controls");
  const sceneCardHeading = makeElement("h4", "scene-card-heading", "可选玩家卡");
  const sceneCardControls = makeElement("div", "scene-card-controls");
  sceneChoicePanel.append(sceneChoiceHeader, sceneChoiceControls, sceneCardHeading, sceneCardControls);
  activityCard.append(activityCopy, previewContent, sceneChoicePanel);

  const transcript = makeElement("section", "transcript");
  transcript.setAttribute("aria-labelledby", "transcript-title");
  const transcriptHeader = makeElement("header", "transcript-header");
  const transcriptHeading = makeElement("h2", "transcript-title", "路线事件日志");
  transcriptHeading.id = "transcript-title";
  transcriptHeader.append(transcriptHeading, makeElement("span", "transcript-note", "按 Runtime 顺序追加"));
  const eventScroll = makeElement("div", "event-scroll");
  eventScroll.tabIndex = 0;
  eventScroll.setAttribute("aria-label", "路线事件日志，可滚动阅读历史记录");
  const eventList = makeElement("ol", "event-list");
  eventList.setAttribute("aria-label", "路线活动与战斗事件");
  eventScroll.append(eventList);
  transcript.append(transcriptHeader, eventScroll);

  const actionDock = makeElement("footer", "action-dock");
  const playerCostMeter = makeElement("section", "player-cost-meter");
  playerCostMeter.setAttribute("aria-label", "玩家 Cost 余额");
  const playerCostRow = createPlayerCostMeterRow();
  playerCostMeter.append(playerCostRow.root);
  const clickHelper = makeElement("p", "click-helper");
  const advanceButton = makeElement("button", "advance-button", "") as HTMLButtonElement;
  advanceButton.type = "button";
  actionDock.append(playerCostMeter, clickHelper, advanceButton);
  const editPanel = makeElement("section", "player-edit-panel");
  editPanel.hidden = true;
  editPanel.setAttribute("aria-label", "本轮行动卡编辑");
  const editPanelHeader = makeElement("div", "player-edit-header");
  const editPanelTitle = makeElement("h2", "player-edit-title");
  const editPanelStatus = makeElement("p", "player-edit-status");
  editPanelHeader.append(editPanelTitle, editPanelStatus);
  const editOptionList = makeElement("div", "player-edit-options");
  const editPanelControls = makeElement("div", "player-edit-controls");
  const editConfirm = makeElement("button", "player-edit-confirm", "确认目标") as HTMLButtonElement;
  const editCancel = makeElement("button", "player-edit-cancel", "取消") as HTMLButtonElement;
  editConfirm.type = "button";
  editCancel.type = "button";
  editPanelControls.append(editConfirm, editCancel);
  editPanel.append(editPanelHeader, editOptionList, editPanelControls);
  center.append(deskHeader, locationCard, activityCard, transcript, editPanel, actionDock);

  const enemyPanel = makeElement("aside", "side-panel enemy-panel");
  enemyPanel.setAttribute("aria-labelledby", "enemy-heading");
  const enemyHeader = makeElement("header", "side-heading");
  enemyHeader.append(makeElement("p", "eyebrow", "当前遭遇 / 敌方"));
  const enemyTitle = makeElement("h2", "side-title", "对方队伍");
  enemyTitle.id = "enemy-heading";
  const enemySummary = makeElement("p", "side-summary");
  enemyHeader.append(enemyTitle, enemySummary);
  const enemyFront = createCharacterGroup("前排", "front");
  const enemyBack = createCharacterGroup("后排", "back");
  const emptyEnemies = makeElement("p", "empty-mark", "当前无敌方单位");
  const fieldEffectZone = makeElement("div", "field-effect-zone");
  fieldEffectZone.hidden = true;
  const enemyPreparedLayer = makeElement("div", "prepared-card-layer");
  const enemyCards = new Map<string, BattleCharacterCardNodes>();
  let enemyEncounterId: string | null = null;
  enemyPanel.append(enemyHeader, enemyFront.section, enemyBack.section, emptyEnemies, fieldEffectZone, enemyPreparedLayer);

  const relationSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  relationSvg.classList.add("battle-relation-layer");
  relationSvg.setAttribute("aria-hidden", "true");
  const relationDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const arrowHead = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  arrowHead.id = "gameplay-b-card-arrowhead";
  arrowHead.setAttribute("viewBox", "0 0 10 10");
  arrowHead.setAttribute("refX", "8.5");
  arrowHead.setAttribute("refY", "5");
  arrowHead.setAttribute("markerWidth", "6");
  arrowHead.setAttribute("markerHeight", "6");
  arrowHead.setAttribute("orient", "auto-start-reverse");
  const arrowShape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowShape.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  arrowHead.append(arrowShape);
  relationDefs.append(arrowHead);
  const relationPaths = document.createElementNS("http://www.w3.org/2000/svg", "g");
  relationPaths.classList.add("battle-relation-paths");
  relationSvg.append(relationDefs, relationPaths);

  const dragGhost = makeElement("article", "player-card-drag-ghost");
  dragGhost.hidden = true;
  dragGhost.setAttribute("aria-hidden", "true");
  dragGhost.tabIndex = -1;
  shell.append(partyPanel, center, enemyPanel, relationSvg, dragGhost);
  root.replaceChildren(shell);

  const syncParty = (party: readonly RoutePartyView[]): void => {
    const visibleIds = new Set(party.map((actor) => actor.id));
    for (const actor of party) {
      let card = partyCards.get(actor.id);
      if (!card) {
        card = createRoutePartyCard(actor);
        partyCards.set(actor.id, card);
        (actor.row === "front" ? partyFront.list : partyBack.list).append(card.card.element);
      }
      updateCharacterCard(card.card, routePartyCharacter(actor));
      card.sCost.data = actor.currentBattleSCost === null ? "—" : String(actor.currentBattleSCost);
    }
    for (const [id, card] of partyCards) {
      if (visibleIds.has(id)) continue;
      card.card.element.remove();
      partyCards.delete(id);
    }
    partySummary.textContent = `${party.length} 人 · 前排 ${party.filter((actor) => actor.row === "front").length} / 后排 ${party.filter((actor) => actor.row === "back").length}`;
  };

  const syncEnemies = (battle: BattleView | null): void => {
    if (!battle) {
      enemyEncounterId = null;
      enemyCards.clear();
      enemyFront.list.replaceChildren();
      enemyBack.list.replaceChildren();
      enemyFront.section.hidden = true;
      enemyBack.section.hidden = true;
      const hasFieldCards = fieldEffectZone.classList.contains("has-cards");
      emptyEnemies.hidden = hasFieldCards;
      fieldEffectZone.hidden = !hasFieldCards;
      enemySummary.textContent = "当前无敌方单位";
      return;
    }
    fieldEffectZone.hidden = true;
    if (battle.state.encounterId !== enemyEncounterId) {
      enemyEncounterId = battle.state.encounterId;
      enemyCards.clear();
      enemyFront.list.replaceChildren();
      enemyBack.list.replaceChildren();
    }
    const enemies = battle.state.combatants.filter((actor) => actor.side === "enemy");
    const visibleIds = new Set(enemies.map((actor) => actor.actorId));
    for (const actor of enemies) {
      let card = enemyCards.get(actor.actorId);
      if (!card) {
        card = createBattleCharacterCard(actor);
        enemyCards.set(actor.actorId, card);
        (actor.row === "front" ? enemyFront.list : enemyBack.list).append(card.card.element);
      }
      updateCharacterCard(card.card, battleCharacter(actor));
      card.sCost.data = actor.currentBattleSCost === null ? "—" : String(actor.currentBattleSCost);
    }
    for (const [id, card] of enemyCards) {
      if (visibleIds.has(id)) continue;
      card.card.element.remove();
      enemyCards.delete(id);
    }
    const aliveCount = enemies.filter((actor) => actor.hp > 0).length;
    enemySummary.textContent = `敌方 ${enemies.length} 人 · ${aliveCount} 人可战斗`;
    enemyFront.section.hidden = enemies.every((actor) => actor.row !== "front");
    enemyBack.section.hidden = enemies.every((actor) => actor.row !== "back");
    emptyEnemies.hidden = enemies.length > 0;
  };

  const preparedCardElements = new Map<string, HTMLElement>();
  const preparedCardAnchors = new Map<string, { readonly owner: HTMLElement; readonly layer: HTMLElement; readonly rightInset: number; readonly topInset: number }>();
  let preparedRelations: readonly PreparedBattleCardRelation[] = [];
  let activePreparedBatchId: string | null = null;
  let latestView = initialView;
  let synchronizeView: (view: GameplayBRouteView) => void = (view) => { latestView = view; };
  const cardTargetDrafts = new Map<string, string[]>();
  const targetControlsByCard = new Map<string, { readonly select: HTMLSelectElement; readonly confirm: HTMLButtonElement; readonly cancel: HTMLButtonElement }>();
  const syncPlayerCostDock = (view: GameplayBRouteView, draftCost = 0): void => {
    const choice = view.sceneChoice;
    const blocker: PlayerCostDockBlocker = view.terminal ? "terminal"
      : view.awaitingExitChoice ? "awaiting-exit"
        : choice && !choice.ready ? "needs-choice"
          : choice && cardTargetDrafts.size > 0 ? "needs-target" : "ready";
    const projection = projectPlayerCostDock(view.playerCost, (choice?.totalCost ?? 0) + draftCost, blocker);
    const previewText = projection.state === "ready"
      ? projection.consumingCost > 0 ? `−${projection.consumingCost} → ${projection.afterClickCost}` : `Click 后 ${projection.afterClickCost}`
      : projection.consumingCost > 0 ? `预选 −${projection.consumingCost} · ${projection.afterClickLabel}` : projection.afterClickLabel;
    updatePlayerCostMeterRow(playerCostRow, projection, previewText);
    playerCostMeter.dataset.state = projection.state;
    playerCostMeter.setAttribute("aria-label", `玩家 Cost：持有 ${projection.heldCost}，${previewText}`);
  };
  const removeTargetControls = (cardId: string): void => {
    const controls = targetControlsByCard.get(cardId);
    if (!controls) return;
    controls.select.remove();
    controls.confirm.remove();
    controls.cancel.remove();
    targetControlsByCard.delete(cardId);
  };
  const clearTargetControls = (): void => { for (const cardId of targetControlsByCard.keys()) removeTargetControls(cardId); };
  const runRouteCommand = (command: RouteInteractionCommand): boolean => {
    const response = applyPlayerEdit(command);
    if (!response.outcome.ok) {
      sceneChoiceStatus.textContent = response.outcome.reason ?? "当前选择无法应用。";
      return false;
    }
    synchronizeView(response.view);
    if (command.kind === "choose-exit") {
      center.scrollTop = 0;
      mapNodeElements.get(response.view.currentNode.id)?.root.focus({ preventScroll: true });
    }
    return true;
  };
  const syncMapAndResources = (view: GameplayBRouteView): void => {
    const enteredNodeIds = view.events.filter((event) => event.type === "node-entered").map((event) => event.nodeId);
    const traversedEdges = projectTraversedRouteEdgeKeys(routeNodes, enteredNodeIds);
    const availableExitIds = new Set(view.availableExits.map((exit) => exit.id));
    for (const [id, marker] of mapNodeElements) {
      const visits = view.nodeVisitCounts[id] ?? 0;
      marker.root.classList.toggle("is-current", id === view.currentNode.id);
      marker.root.classList.toggle("is-visited", visits > 0);
      marker.root.setAttribute("aria-current", id === view.currentNode.id ? "location" : "false");
      marker.root.setAttribute("aria-label", `${routeNodes.find((node) => node.id === id)?.name ?? id}，${routeNodes.find((node) => node.id === id)?.area ?? "园区路线"}，到访 ${visits} 次${id === view.currentNode.id ? "，当前位置" : ""}`);
      marker.visits.textContent = visits ? `×${visits}` : "";
    }
    for (const [exitId, edge] of mapEdgeElements) {
      edge.classList.toggle("is-traversed", traversedEdges.has(`${edge.dataset.sourceId}→${edge.dataset.targetId}`));
      edge.classList.toggle("is-available", availableExitIds.has(exitId));
    }
    const items = view.heldItems.map((id) => content.itemNames?.[id] ?? id);
    const deck = view.playerDeck;
    routeResourceSummary.textContent = `持有物 ${items.length ? items.join("、") : "无"}${deck ? ` · 手牌 ${deck.hand.length}/${deck.handLimit} · 牌堆 ${deck.drawPileCount} · 已用 ${deck.usedCardIds.length}` : ""}`;
    routeMapTitle.textContent = projectRouteMapSummary(view, routeNodes);
    exitRegion.hidden = !view.awaitingExitChoice;
    const exitKey = JSON.stringify(view.availableExits);
    if (exitList.dataset.signature !== exitKey) {
      exitList.dataset.signature = exitKey;
      exitList.replaceChildren();
      for (const exit of view.availableExits) {
        const button = makeElement("button", "route-exit-button", describeRouteExit(exit, routeNodes, content.itemNames)) as HTMLButtonElement;
        button.type = "button";
        button.addEventListener("click", () => runRouteCommand({ kind: "choose-exit", exitId: exit.id }));
        exitList.append(button);
      }
    }
  };
  const syncSceneChoices = (view: GameplayBRouteView): void => {
    const choice = view.sceneChoice;
    sceneChoicePanel.hidden = !choice;
    previewContent.hidden = !!choice;
    if (!choice) { cardTargetDrafts.clear(); clearTargetControls(); syncPlayerCostDock(view); return; }
    sceneChoicePanel.classList.toggle("is-global", choice.mode === "global");
    sceneChoiceTitle.textContent = choice.mode === "individual" ? "本批必选行为 · 逐角色选择" : "本批必选行为 · 全队共享选择";
    sceneCardHeading.textContent = `可选玩家卡 · ${view.playerDeck?.hand.length ?? 0} 张可用`;
    const draftCost = (view.playerDeck?.hand ?? []).filter((card) => cardTargetDrafts.has(card.id)).reduce((total, card) => total + card.cost, 0);
    const displayedCost = choice.totalCost + draftCost;
    syncPlayerCostDock(view, draftCost);
    sceneChoiceStatus.textContent = `本批费用 ${displayedCost} Cost${choice.ready ? "" : " · 仍需完成必选行为"}`;
    const selectionMap = new Map(choice.selections.map((selection) => [selection.actorId ?? "global", selection.behaviorId]));
    const signature = JSON.stringify([view.currentNode.id, choice.mode, choice.behaviors, choice.requiredActorIds, view.playerDeck?.hand.map((card) => card.id)]);
    if (sceneChoiceControls.dataset.signature !== signature) {
      if (sceneChoiceControls.dataset.signature) { cardTargetDrafts.clear(); clearTargetControls(); }
      sceneChoiceControls.dataset.signature = signature;
      sceneChoiceControls.replaceChildren();
      if (choice.mode === "individual") {
        for (const actorId of choice.requiredActorIds) {
          const row = makeElement("div", "scene-actor-choice");
          row.dataset.actorId = actorId;
          const actor = view.party.find((candidate) => candidate.id === actorId);
          const name = makeElement("span", "scene-actor-name", actor?.name ?? actorId);
          const state = makeElement("span", "scene-actor-state");
          const options = makeElement("div", "scene-actor-behavior-options");
          for (const behavior of choice.behaviors) {
            const button = makeElement("button", "scene-actor-behavior-button", `${behavior.label} · ${behavior.cost} Cost`) as HTMLButtonElement;
            button.type = "button";
            button.dataset.actorId = actorId;
            button.dataset.behaviorId = behavior.id;
            button.setAttribute("aria-pressed", "false");
            button.addEventListener("click", () => runRouteCommand({ kind: "individual-behavior", actorId, behaviorId: behavior.id }));
            options.append(button);
          }
          const summary = makeElement("p", "scene-action-summary");
          summary.dataset.actorId = actorId;
          row.append(name, state, options, summary);
          sceneChoiceControls.append(row);
        }
      } else {
        for (const behavior of choice.behaviors) {
          const row = makeElement("div", "scene-behavior-choice");
          const button = makeElement("button", "scene-behavior-button", `${behavior.label} · ${behavior.cost} Cost`) as HTMLButtonElement;
          button.type = "button"; button.dataset.behaviorId = behavior.id;
          button.addEventListener("click", () => runRouteCommand({ kind: "global-behavior", behaviorId: behavior.id, targetIds: behavior.targetMode === "party" ? [] : latestView.party.filter((actor) => actor.hp > 0).slice(0, behavior.targetMode === "one" ? 1 : undefined).map((actor) => actor.id) }));
          const summary = makeElement("p", "scene-action-summary", "");
          summary.dataset.behaviorId = behavior.id;
          row.append(button, summary);
          sceneChoiceControls.append(row);
        }
      }
      sceneCardControls.replaceChildren();
      for (const [handIndex, card] of (view.playerDeck?.hand ?? []).entries()) {
        const targetMode = card.effect.kind === "gain-item" ? "party" : card.effect.targetMode;
        const needsTargets = targetMode !== "party";
        const row = makeElement("div", "scene-card-row");
        row.dataset.cardId = card.id;
        const button = makeElement("button", "scene-card-button") as HTMLButtonElement;
        button.type = "button";
        button.addEventListener("click", () => {
          const pending = latestView.playerDeck?.pendingCards.some((selection) => selection.cardId === card.id) ?? false;
          if (pending) { runRouteCommand({ kind: "unselect-player-card", cardId: card.id }); return; }
          if (cardTargetDrafts.has(card.id)) { cardTargetDrafts.delete(card.id); syncSceneChoices(latestView); button.focus({ preventScroll: true }); return; }
          if (needsTargets) { cardTargetDrafts.set(card.id, []); syncSceneChoices(latestView); return; }
          runRouteCommand({ kind: "player-card", cardId: card.id, targetIds: [] });
        });
        row.append(button);
        row.append(makeElement("span", "scene-card-effect", summarizePlayerCard(card, content.itemNames)));
        const state = makeElement("span", "scene-card-state");
        state.dataset.cardId = card.id;
        row.append(state);
        sceneCardControls.append(row);
      }
    }
    sceneChoiceControls.querySelectorAll<HTMLButtonElement>(".scene-actor-behavior-button").forEach((button) => {
      const selected = selectionMap.get(button.dataset.actorId ?? "") === button.dataset.behaviorId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    sceneChoiceControls.querySelectorAll<HTMLButtonElement>(".scene-behavior-button[data-behavior-id]").forEach((button) => button.classList.toggle("is-selected", selectionMap.get("global") === button.dataset.behaviorId));
    const currentNodeDefinition = routeNodes.find((node) => node.id === view.currentNode.id);
    const behaviorDefinitions = currentNodeDefinition?.kind === "activity" ? currentNodeDefinition.sceneChoices?.behaviors ?? [] : [];
    if (choice.mode === "individual") sceneChoiceControls.querySelectorAll<HTMLElement>(".scene-actor-choice").forEach((row) => {
      const actorId = row.dataset.actorId ?? "";
      const behavior = behaviorDefinitions.find((candidate) => candidate.id === selectionMap.get(actorId));
      const projection = projectIndividualBehaviorRow(behavior, content.itemNames);
      const state = row.querySelector<HTMLElement>(".scene-actor-state");
      const summary = row.querySelector<HTMLElement>(".scene-action-summary");
      if (state) state.textContent = projection.state;
      if (summary) summary.textContent = projection.summary;
    });
    if (choice.mode === "global") sceneChoiceControls.querySelectorAll<HTMLElement>(".scene-behavior-choice").forEach((row) => {
      const button = row.querySelector<HTMLButtonElement>("button[data-behavior-id]");
      const behavior = choice.behaviors.find((candidate) => candidate.id === button?.dataset.behaviorId);
      const summary = row.querySelector<HTMLElement>(".scene-action-summary");
      if (button && behavior) button.classList.toggle("is-selected", selectionMap.get("global") === behavior.id);
      if (summary && behavior) {
        const fullBehavior = behaviorDefinitions.find((candidate) => candidate.id === behavior.id);
        summary.textContent = fullBehavior ? summarizeSceneBehavior(fullBehavior, content.itemNames) : "";
      }
    });
    sceneCardControls.querySelectorAll<HTMLElement>(".scene-card-row").forEach((row, index) => {
      const card = view.playerDeck?.hand[index];
      if (!card) return;
      const targetMode = card.effect.kind === "gain-item" ? "party" : card.effect.targetMode;
      const pending = view.playerDeck?.pendingCards.find((selection) => selection.cardId === card.id);
      const targetDraft = projectPlayerCardTargetDraft(card.id, cardTargetDrafts);
      const drafting = targetDraft !== null;
      const selected = !!pending || drafting;
      const button = row.querySelector<HTMLButtonElement>(".scene-card-button");
      if (button) {
        button.textContent = `${selected ? "✓ " : "+ "}${playerCardInstanceLabel(card, index)} · ${card.cost} Cost`;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
      const targets = pending?.targetIds ?? targetDraft?.selectedIds ?? [];
      const names = targets.map((id) => view.party.find((actor) => actor.id === id)?.name ?? id);
      const state = row.querySelector<HTMLElement>(".scene-card-state");
      if (state) state.textContent = pending ? playerCardSelectionSummary(card, pending.targetIds,
        Object.fromEntries(view.party.map((actor) => [actor.id, actor.name])))
        : drafting ? (names.length ? `待确认目标：${names.join("、")}` : "请选择目标后确认。") : "";
      if (drafting && targetMode !== "party") {
        let controls = targetControlsByCard.get(card.id);
        if (!controls) {
          const select = makeElement("select", "scene-card-target-select") as HTMLSelectElement;
          select.dataset.cardId = card.id;
          select.multiple = targetMode === "many";
          select.setAttribute("aria-label", `${playerCardInstanceLabel(card, index)}的目标候选`);
          if (targetMode === "one") select.append(new Option("明确选择目标…", ""));
          for (const actor of view.party) select.append(new Option(actor.name, actor.id));
          select.addEventListener("change", () => {
            const selectedIds = select.multiple ? [...select.selectedOptions].map((option) => option.value) : [select.value].filter(Boolean);
            cardTargetDrafts.set(card.id, selectedIds);
            syncSceneChoices(latestView);
          });
          const confirm = makeElement("button", "scene-card-confirm", "确认目标并选入本批") as HTMLButtonElement;
          confirm.type = "button";
          confirm.addEventListener("click", () => {
            const selectedIds = projectPlayerCardTargetDraft(card.id, cardTargetDrafts)?.selectedIds ?? [];
            if (!playerCardTargetSelectionReady(targetMode, selectedIds)) return;
            if (!runRouteCommand({ kind: "player-card", cardId: card.id, targetIds: selectedIds })) return;
            cardTargetDrafts.delete(card.id);
            syncSceneChoices(latestView);
            button?.focus({ preventScroll: true });
          });
          const cancel = makeElement("button", "scene-card-cancel", "取消目标") as HTMLButtonElement;
          cancel.type = "button";
          cancel.addEventListener("click", () => {
            cardTargetDrafts.delete(card.id);
            syncSceneChoices(latestView);
            button?.focus({ preventScroll: true });
          });
          row.append(select, confirm, cancel);
          controls = { select, confirm, cancel };
          targetControlsByCard.set(card.id, controls);
        }
        for (const option of [...controls.select.options]) option.selected = targets.includes(option.value);
        controls.confirm.disabled = !playerCardTargetSelectionReady(targetMode, targets);
      } else removeTargetControls(card.id);
    });
    updateAdvanceAvailability();
  };
  let clickHelperBaseText = "";
  type TargetSelectionState = {
    readonly kind: "targets";
    readonly sourceRef: string;
    readonly actorId: string;
    readonly editKind: "ordinary" | "free-skill";
    readonly cardId: string | null;
    readonly skillId: string | null;
    readonly candidateIds: readonly string[];
    readonly fixedIds: readonly string[];
    readonly requiredCount: number;
    readonly selectedIds: readonly string[];
    readonly error: string | null;
  };
  type EditState = { readonly kind: "idle" } | { readonly kind: "chooser"; readonly sourceRef: string; readonly actorId: string } | TargetSelectionState;
  let editState: EditState = { kind: "idle" };
  let pointerIntent: { readonly pointerId: number; readonly sourceRef: string; readonly actorId: string; readonly option: PlayerTargetEditOption | null;
    readonly source: HTMLElement; readonly startX: number; readonly startY: number; active: boolean; hoverTargetId: string | null } | null = null;
  let suppressCardClickRef: string | null = null;
  const clearSuppressedCardClick = (): void => {
    suppressCardClickRef = null;
    shell.removeEventListener("click", consumeSuppressedCardClick, true);
  };
  const consumeSuppressedCardClick = (event: MouseEvent): void => {
    if (event.detail === 0 || suppressCardClickRef === null) return;
    clearSuppressedCardClick();
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const suppressNextPointerClick = (sourceRef: string): void => {
    clearSuppressedCardClick();
    suppressCardClickRef = sourceRef;
    shell.addEventListener("click", consumeSuppressedCardClick, true);
  };
  const editedTargets = new Set<HTMLElement>();
  let dragHoverTargetElement: HTMLElement | null = null;
  let pointerSourceRef: string | null = null;
  let focusSourceRef: string | null = null;
  let activeSourceRef: string | null = null;
  let activeSourceElement: HTMLElement | null = null;
  let activeSourceOwnerElement: HTMLElement | null = null;
  let highlightedElements: HTMLElement[] = [];
  let relationFrame: number | null = null;

  const updateAdvanceAvailability = (): void => {
    const editing = editState.kind !== "idle" || pointerIntent?.active === true;
    const blocked = latestView.terminal || editing || cardTargetDrafts.size > 0 || latestView.awaitingExitChoice || (!!latestView.sceneChoice && !latestView.sceneChoice.canConfirm);
    advanceButton.disabled = blocked;
    advanceButton.setAttribute("aria-disabled", String(blocked));
  };

  const clearEditHighlights = (): void => {
    for (const element of editedTargets) element.classList.remove("is-edit-target");
    editedTargets.clear();
    dragHoverTargetElement?.classList.remove("is-edit-target-hover");
    dragHoverTargetElement = null;
  };

  const clearDragHoverTarget = (): void => {
    dragHoverTargetElement?.classList.remove("is-edit-target-hover");
    dragHoverTargetElement = null;
  };

  const closeEditState = (focusRef?: string): void => {
    if (pointerIntent?.active) suppressNextPointerClick(pointerIntent.sourceRef);
    pointerIntent?.source.classList.remove("is-editing-source");
    relationSvg.classList.remove("is-target-dragging");
    editState = { kind: "idle" };
    editPanel.hidden = true;
    editOptionList.replaceChildren();
    editPanelStatus.textContent = "";
    clearEditHighlights();
    dragGhost.hidden = true;
    dragGhost.replaceChildren();
    pointerIntent = null;
    clickHelper.textContent = clickHelperBaseText;
    updateAdvanceAvailability();
    if (focusRef) preparedCardElements.get(focusRef)?.focus({ preventScroll: true });
  };

  const clearActiveRelation = (): void => {
    activeSourceElement?.classList.remove("is-hover-source");
    activeSourceOwnerElement?.classList.remove("is-hover-owner");
    for (const element of highlightedElements) element.classList.remove("is-link-target");
    highlightedElements = [];
    activeSourceElement = null;
    activeSourceOwnerElement = null;
    relationPaths.replaceChildren();
  };

  const cancelRelationFrame = (): void => {
    if (relationFrame === null) return;
    cancelAnimationFrame(relationFrame);
    relationFrame = null;
  };

  const resolveCardElement = (ref: string): HTMLElement | undefined => {
    const actionCard = preparedCardElements.get(ref);
    if (actionCard) return actionCard;
    if (ref.startsWith("location:") && locationCard.dataset.locationRef === ref.slice("location:".length)) return locationCard;
    if (!ref.startsWith("character:")) return undefined;
    const actorId = ref.slice("character:".length);
    return partyCards.get(actorId)?.card.element ?? enemyCards.get(actorId)?.card.element;
  };

  const updatePreparedCardPositions = (): void => {
    for (const [cardRef, element] of preparedCardElements) {
      const anchor = preparedCardAnchors.get(cardRef);
      if (!anchor || !element.isConnected || !anchor.owner.isConnected || !anchor.layer.isConnected) continue;
      const anchorRect = anchor.owner.getBoundingClientRect();
      const layerRect = anchor.layer.getBoundingClientRect();
      element.style.left = `${anchorRect.right - layerRect.left - anchor.rightInset - element.offsetWidth}px`;
      element.style.top = `${anchorRect.top - layerRect.top + anchor.topInset}px`;
      element.style.right = "auto";
    }
  };

  const drawRelations = (): void => {
    relationFrame = null;
    updatePreparedCardPositions();
    const drag = pointerIntent;
    if (drag?.active && drag.option) {
      relationPaths.replaceChildren();
      const target = drag.hoverTargetId ? partyCards.get(drag.hoverTargetId)?.card.element ?? enemyCards.get(drag.hoverTargetId)?.card.element : undefined;
      if (target && drag.source.isConnected && target.isConnected) drawDragRelation(drag.source, target);
      return;
    }
    if (!activeSourceRef || !activeSourceElement?.isConnected) {
      relationPaths.replaceChildren();
      return;
    }
    const svgRect = relationSvg.getBoundingClientRect();
    const width = relationSvg.clientWidth;
    const height = relationSvg.clientHeight;
    if (width <= 0 || height <= 0) return;
    relationSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    relationPaths.replaceChildren();
    for (const relation of preparedRelations) {
      if (relation.from !== activeSourceRef) continue;
      const target = resolveCardElement(relation.to);
      if (!target?.isConnected || target === activeSourceElement) continue;
      const sourceRect = activeSourceElement.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const sourceCenter = { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 };
      const targetCenter = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
      const sourceOwner = preparedCardAnchors.get(activeSourceRef)?.owner.closest(".character-card") ?? activeSourceElement.closest(".character-card");
      const targetOwner = preparedCardAnchors.get(relation.to)?.owner.closest(".character-card") ?? target.closest(".character-card");
      const sameOwner = sourceOwner !== null && sourceOwner === targetOwner;
      const overlapCurve = sameOwner && activeSourceElement.classList.contains("prepared-action-card") && target.classList.contains("prepared-action-card")
        ? overlappingFanCardCurve(sourceRect, targetRect)
        : null;
      const start = overlapCurve?.start ?? relationEdgePoint(sourceRect, targetCenter);
      const end = overlapCurve?.end ?? relationEdgePoint(targetRect, sourceCenter);
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      const bend = Math.max(14, Math.min(56, distance * (sameOwner ? 0.24 : 0.1)));
      const bendSign = relation.kind === "modifies-action" ? 1 : -1;
      const perpendicularX = -deltaY / distance * bend * bendSign;
      const perpendicularY = deltaX / distance * bend * bendSign;
      const startX = start.x - svgRect.left;
      const startY = start.y - svgRect.top;
      const endX = end.x - svgRect.left;
      const endY = end.y - svgRect.top;
      const controlOneX = overlapCurve ? overlapCurve.controlOne.x - svgRect.left : startX + deltaX * 0.34 + perpendicularX;
      const controlOneY = overlapCurve ? overlapCurve.controlOne.y - svgRect.top : startY + deltaY * 0.34 + perpendicularY;
      const controlTwoX = overlapCurve ? overlapCurve.controlTwo.x - svgRect.left : endX - deltaX * 0.34 + perpendicularX;
      const controlTwoY = overlapCurve ? overlapCurve.controlTwo.y - svgRect.top : endY - deltaY * 0.34 + perpendicularY;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.classList.add("battle-relation-path", `is-${relation.kind}`);
      path.dataset.relationKind = relation.kind;
      path.setAttribute("d", `M ${startX} ${startY} C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${endX} ${endY}`);
      path.setAttribute("marker-end", "url(#gameplay-b-card-arrowhead)");
      relationPaths.append(path);
    }
  };

  const scheduleRelationDraw = (): void => {
    if ((!activeSourceRef && preparedCardElements.size === 0) || relationFrame !== null) return;
    relationFrame = requestAnimationFrame(drawRelations);
  };

  const drawDragRelation = (source: HTMLElement, target: HTMLElement): void => {
    const svgRect = relationSvg.getBoundingClientRect();
    const width = relationSvg.clientWidth;
    const height = relationSvg.clientHeight;
    if (width <= 0 || height <= 0) return;
    relationSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const sourceCenter = { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 };
    const targetCenter = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
    const start = relationEdgePoint(sourceRect, targetCenter);
    const end = relationEdgePoint(targetRect, sourceCenter);
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.max(1, Math.hypot(deltaX, deltaY));
    const bend = Math.max(16, Math.min(52, distance * 0.12));
    const perpendicularX = -deltaY / distance * bend;
    const perpendicularY = deltaX / distance * bend;
    const startX = start.x - svgRect.left;
    const startY = start.y - svgRect.top;
    const endX = end.x - svgRect.left;
    const endY = end.y - svgRect.top;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("battle-relation-path", "is-drag-target");
    path.setAttribute("d", `M ${startX} ${startY} C ${startX + deltaX * 0.34 + perpendicularX} ${startY + deltaY * 0.34 + perpendicularY}, ${endX - deltaX * 0.34 + perpendicularX} ${endY - deltaY * 0.34 + perpendicularY}, ${endX} ${endY}`);
    path.setAttribute("marker-end", "url(#gameplay-b-card-arrowhead)");
    relationPaths.replaceChildren(path);
  };

  const refreshActiveRelation = (): void => {
    const nextRef = pointerSourceRef ?? focusSourceRef;
    if (nextRef === activeSourceRef) {
      scheduleRelationDraw();
      return;
    }
    clearActiveRelation();
    activeSourceRef = nextRef;
    if (!nextRef) return;
    const source = preparedCardElements.get(nextRef);
    if (!source?.isConnected) {
      activeSourceRef = null;
      return;
    }
    activeSourceElement = source;
    source.classList.add("is-hover-source");
    activeSourceOwnerElement = preparedCardAnchors.get(nextRef)?.owner ?? source.closest(".character-card, .field-effect-zone");
    activeSourceOwnerElement?.classList.add("is-hover-owner");
    for (const relation of preparedRelations) {
      if (relation.from !== nextRef) continue;
      const target = resolveCardElement(relation.to);
      if (!target || target === source || highlightedElements.includes(target)) continue;
      target.classList.add("is-link-target");
      highlightedElements.push(target);
    }
    scheduleRelationDraw();
  };

  const cardFromTarget = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>(".prepared-action-card") : null;
  const containsTarget = (element: HTMLElement, target: EventTarget | null): boolean => target instanceof Node && element.contains(target);
  shell.addEventListener("pointerover", (event) => {
    const card = cardFromTarget(event.target);
    if (!card || containsTarget(card, event.relatedTarget)) return;
    pointerSourceRef = card.dataset.cardRef ?? null;
    refreshActiveRelation();
  });
  shell.addEventListener("pointerout", (event) => {
    const card = cardFromTarget(event.target);
    if (!card || containsTarget(card, event.relatedTarget)) return;
    if (pointerSourceRef === card.dataset.cardRef) pointerSourceRef = null;
    refreshActiveRelation();
  });
  shell.addEventListener("focusin", (event) => {
    const card = cardFromTarget(event.target);
    if (!card) return;
    focusSourceRef = card.dataset.cardRef ?? null;
    refreshActiveRelation();
  });
  shell.addEventListener("focusout", (event) => {
    const card = cardFromTarget(event.target);
    if (!card || containsTarget(card, event.relatedTarget)) return;
    if (focusSourceRef === card.dataset.cardRef) focusSourceRef = null;
    refreshActiveRelation();
  });

  const targetOptionFor = (cardRef: string): PlayerTargetEditOption | undefined =>
    latestView.currentBattle?.targetEditOptions.find((option) => option.cardRef === cardRef);
  const ordinaryActionForRef = (cardRef: string): PreparedBattleRound["playerActions"][number] | undefined =>
    latestView.currentBattle?.pendingRound?.playerActions.find((action, index) => `player-action:${index}:${action.actorId}` === cardRef);
  const cardEditInstruction = (model: PreparedBattleCardModel): string => {
    const option = targetOptionFor(model.id);
    if (model.kind === "player-action") {
      if (option?.editable) return "拖拽可更改目标；点击或按 Enter 重选普通卡。";
      return option?.disabledReason ? `目标固定：${option.disabledReason}。点击或按 Enter 重选普通卡。` : "点击或按 Enter 重选普通卡。";
    }
    if (option?.editable) return "拖拽可更改免费技能目标。";
    if (option?.disabledReason) return `目标锁定：${option.disabledReason}。`;
    return "悬停或聚焦查看行动关系。";
  };
  const actorName = (actorId: string): string => latestView.currentBattle?.pendingRound?.combatants
    .find((actor) => actor.actorId === actorId)?.name ?? actorId;
  const highlightEditTargets = (ids: readonly string[]): void => {
    clearEditHighlights();
    for (const id of ids) {
      const target = partyCards.get(id)?.card.element ?? enemyCards.get(id)?.card.element;
      if (!target) continue;
      target.classList.add("is-edit-target");
      editedTargets.add(target);
    }
  };
  const renderEditPanel = (): void => {
    const activeEditOption = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.editOptionId : undefined;
    editOptionList.replaceChildren();
    editPanel.hidden = editState.kind === "idle";
    if (editState.kind === "idle") {
      updateAdvanceAvailability();
      return;
    }
    const currentEditState = editState;
    if (currentEditState.kind === "chooser") {
      editPanelTitle.textContent = `${actorName(currentEditState.actorId)} · 重选普通行动`;
      editPanelStatus.textContent = "本轮所有卡牌均显示；灰显卡会注明目前不能使用的原因。";
      editConfirm.hidden = true;
      const choices = latestView.currentBattle?.playerCardChoices.filter((choice) => choice.actorId === currentEditState.actorId) ?? [];
      for (const choice of choices) {
        const button = makeElement("button", "player-card-choice") as HTMLButtonElement;
        button.type = "button";
        button.disabled = !choice.available;
        button.dataset.editOptionId = `card:${choice.cardId ?? "observe"}`;
        button.setAttribute("aria-label", `${choice.name}，sCost ${choice.cost}，${choice.available ? "可选" : choice.disabledReason ?? "不可选"}`);
        button.append(makeElement("strong", "player-card-choice-title", choice.name),
          makeElement("span", "player-card-choice-description", choice.effect ? effectSummary(choice.effect) : "不攻击；观察后恢复资源"),
          makeElement("span", "player-card-choice-cost", `sCost ${choice.cost}`));
        if (choice.disabledReason) button.append(makeElement("small", "player-card-choice-reason", choice.disabledReason));
        button.addEventListener("click", () => {
          if (button.disabled) return;
          if (choice.cardId === null || !choice.targetGroupCanChange) {
            submitPlayerEdit({ kind: "ordinary", actorId: choice.actorId, cardId: choice.cardId, targetIds: choice.targetIds }, currentEditState.sourceRef);
            return;
          }
          editState = {
            kind: "targets", sourceRef: currentEditState.sourceRef, actorId: choice.actorId,
            editKind: "ordinary", cardId: choice.cardId, skillId: null, candidateIds: choice.candidateTargetIds,
            fixedIds: choice.fixedTargetIds, requiredCount: choice.requiredTargetCount, selectedIds: choice.targetIds, error: null,
          };
          renderEditPanel();
          highlightEditTargets(choice.candidateTargetIds);
          editPanel.querySelector<HTMLElement>("[data-edit-option-id]")?.focus({ preventScroll: true });
        });
        editOptionList.append(button);
      }
      editCancel.textContent = "返回行动卡";
    } else {
      const state = currentEditState;
      editPanelTitle.textContent = `${actorName(state.actorId)} · 选择作用对象`;
      const selectedCount = state.selectedIds.length;
      const selectedNames = state.selectedIds.map(actorName).join("、") || "尚未选择";
      editPanelStatus.textContent = state.error ?? `已选 ${selectedCount} / 需要 ${state.requiredCount}：${selectedNames}`;
      editConfirm.hidden = false;
      editConfirm.textContent = state.editKind === "free-skill" ? "确认技能目标" : "确认行动目标";
      for (const id of state.candidateIds) {
        const fixed = state.fixedIds.includes(id);
        const selected = state.selectedIds.includes(id);
        const button = makeElement("button", `player-target-choice${selected ? " is-selected" : ""}${fixed ? " is-fixed" : ""}`) as HTMLButtonElement;
        button.type = "button";
        button.dataset.editOptionId = `target:${id}`;
        button.textContent = `${selected ? "✓ " : ""}${actorName(id)}${fixed ? " · 固定" : ""}`;
        button.disabled = fixed;
        button.setAttribute("aria-pressed", String(selected));
        button.addEventListener("click", () => {
          const current = editState;
          if (current.kind !== "targets") return;
          const selection = togglePlayerTargetSelection(current.candidateIds, current.fixedIds, current.requiredCount, current.selectedIds, id);
          editState = { ...current, selectedIds: selection.selectedIds, error: selection.error };
          renderEditPanel();
          highlightEditTargets(current.candidateIds);
          editOptionList.querySelector<HTMLElement>(`[data-edit-option-id="target:${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
        });
        editOptionList.append(button);
      }
      const valid = playerTargetSelectionIsComplete(state.fixedIds, state.requiredCount, state.selectedIds);
      editConfirm.disabled = !valid;
      editCancel.textContent = "取消";
    }
    if (activeEditOption) editOptionList.querySelector<HTMLElement>(`[data-edit-option-id="${CSS.escape(activeEditOption)}"]`)?.focus({ preventScroll: true });
    if (editState.kind === "chooser") editOptionList.querySelector<HTMLElement>(".player-card-choice:not(:disabled)")?.focus({ preventScroll: true });
    updateAdvanceAvailability();
  };

  const submitPlayerEdit = (command: PlayerEditCommand, sourceRef: string): void => {
    const response = applyPlayerEdit(command);
    if (!response.outcome.ok) {
      const reason = response.outcome.reason ?? "无法应用这次编辑。";
      editPanelStatus.textContent = reason;
      if (editState.kind === "idle") showDragNotice(`未更改目标：${reason}`);
      return;
    }
    const fallbackMessage = ("fallbacks" in response.outcome ? response.outcome.fallbacks : undefined)?.map((fallback) =>
      `${fallback.actorName}的「${fallback.cardName}」${fallback.reason}，已回落为观察 / 待机并退还本轮 sCost`).join("；");
    closeEditState();
    synchronizeView(response.view);
    preparedCardElements.get(sourceRef)?.focus({ preventScroll: true });
    if (fallbackMessage) showDragNotice(fallbackMessage);
  };

  const beginTargetSelection = (option: PlayerTargetEditOption, selectedIds: readonly string[], sourceRef: string): void => {
    if (!option.editable) return;
    editState = {
      kind: "targets", sourceRef, actorId: option.actorId, editKind: option.kind,
      cardId: option.kind === "ordinary" ? latestView.currentBattle?.pendingRound?.playerActions
        .find((action) => action.actorId === option.actorId)?.cardId ?? null : null,
      skillId: option.skillId, candidateIds: option.candidateIds, fixedIds: option.fixedIds,
      requiredCount: option.requiredCount, selectedIds: [...selectedIds], error: null,
    };
    renderEditPanel();
    highlightEditTargets(option.candidateIds);
    editPanel.querySelector<HTMLElement>("[data-edit-option-id]")?.focus({ preventScroll: true });
  };

  editCancel.addEventListener("click", () => {
    const sourceRef = editState.kind === "idle" ? undefined : editState.sourceRef;
    closeEditState(sourceRef);
  });
  editConfirm.addEventListener("click", () => {
    const state = editState;
    if (state.kind !== "targets" || !playerTargetSelectionIsComplete(state.fixedIds, state.requiredCount, state.selectedIds)) return;
    const { sourceRef, actorId, editKind, cardId, skillId, selectedIds } = state;
    const command: PlayerEditCommand = editKind === "ordinary"
      ? { kind: "ordinary", actorId, cardId, targetIds: selectedIds }
      : { kind: "free-skill", actorId, skillId: skillId ?? "", targetIds: selectedIds };
    submitPlayerEdit(command, sourceRef);
  });

  const openChooser = (cardRef: string, actorId: string): void => {
    editState = { kind: "chooser", sourceRef: cardRef, actorId };
    renderEditPanel();
    highlightEditTargets([]);
    editPanel.querySelector<HTMLElement>(".player-card-choice:not(:disabled)")?.focus({ preventScroll: true });
  };

  const showDragNotice = (message: string | null = null): void => {
    clickHelper.textContent = message ?? clickHelperBaseText;
  };

  const targetIdAtPoint = (clientX: number, clientY: number, candidateIds: readonly string[]): string | undefined => {
    const hit = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(".character-card");
    if (hit?.dataset.characterId && candidateIds.includes(hit.dataset.characterId)) return hit.dataset.characterId;
    return candidateIds.find((id) => {
      const element = partyCards.get(id)?.card.element ?? enemyCards.get(id)?.card.element;
      const rect = element?.getBoundingClientRect();
      return rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    });
  };

  const beginDrag = (event: PointerEvent): void => {
    const intent = pointerIntent;
    if (!intent || intent.pointerId !== event.pointerId || intent.active) return;
    if (!pointerMovedPastCardDragThreshold(intent.startX, intent.startY, event.clientX, event.clientY)) return;
    intent.active = true;
    suppressNextPointerClick(intent.sourceRef);
    if (!intent.option) {
      updateAdvanceAvailability();
      return;
    }
    relationSvg.classList.add("is-target-dragging");
    intent.source.classList.add("is-editing-source");
    dragGhost.replaceChildren(...Array.from(intent.source.childNodes, (node) => node.cloneNode(true)));
    dragGhost.classList.add("is-visible");
    dragGhost.style.width = `${intent.source.getBoundingClientRect().width}px`;
    dragGhost.hidden = false;
    highlightEditTargets(intent.option.candidateIds);
    showDragNotice(`${actorName(intent.actorId)}：把卡片放到高亮目标上；松开提交，按 Escape 取消。`);
    updateAdvanceAvailability();
    scheduleRelationDraw();
  };

  const moveDragGhost = (event: PointerEvent): void => {
    if (!pointerIntent?.active || !pointerIntent.option || pointerIntent.pointerId !== event.pointerId) return;
    dragGhost.style.left = `${event.clientX + 14}px`;
    dragGhost.style.top = `${event.clientY + 14}px`;
  };

  const updateDragHoverTarget = (event: PointerEvent): void => {
    const intent = pointerIntent;
    if (!intent?.active || !intent.option || intent.pointerId !== event.pointerId) return;
    const targetId = targetIdAtPoint(event.clientX, event.clientY, intent.option.candidateIds) ?? null;
    if (targetId === intent.hoverTargetId) return;
    clearDragHoverTarget();
    intent.hoverTargetId = targetId;
    const target = targetId ? partyCards.get(targetId)?.card.element ?? enemyCards.get(targetId)?.card.element : undefined;
    if (target) {
      target.classList.add("is-edit-target-hover");
      dragHoverTargetElement = target;
    }
    scheduleRelationDraw();
  };

  const suppressSourceClick = (sourceRef: string): void => {
    suppressNextPointerClick(sourceRef);
  };

  const endDrag = (event: PointerEvent): void => {
    const intent = pointerIntent;
    if (!intent || intent.pointerId !== event.pointerId) return;
    pointerIntent = null;
    relationSvg.classList.remove("is-target-dragging");
    intent.source.classList.remove("is-editing-source");
    dragGhost.classList.remove("is-visible");
    dragGhost.hidden = true;
    clearEditHighlights();
    if (!intent.active) {
      showDragNotice();
      updateAdvanceAvailability();
      scheduleRelationDraw();
      return;
    }
    suppressSourceClick(intent.sourceRef);
    if (!intent.option) {
      showDragNotice();
      updateAdvanceAvailability();
      scheduleRelationDraw();
      return;
    }
    const targetId = targetIdAtPoint(event.clientX, event.clientY, intent.option.candidateIds);
    if (!targetId) {
      showDragNotice("未更改目标：请把卡片放到高亮的合法目标上。");
      updateAdvanceAvailability();
      scheduleRelationDraw();
      return;
    }
    showDragNotice();
    if (intent.option.requiredCount === 1 && intent.option.fixedIds.length === 0) {
      const command: PlayerEditCommand = intent.option.kind === "ordinary"
        ? { kind: "ordinary", actorId: intent.actorId,
          cardId: latestView.currentBattle?.pendingRound?.playerActions.find((action) => action.actorId === intent.actorId)?.cardId ?? null,
          targetIds: [targetId] }
        : { kind: "free-skill", actorId: intent.actorId, skillId: intent.option.skillId ?? "", targetIds: [targetId] };
      submitPlayerEdit(command, intent.sourceRef);
      return;
    }
    const selectedIds = initialPlayerTargetsAfterDrop(intent.option, targetId);
    beginTargetSelection(intent.option, selectedIds, intent.sourceRef);
  };

  shell.addEventListener("pointerdown", (event) => {
    clearSuppressedCardClick();
    if (event.button !== 0 || editState.kind !== "idle") return;
    const card = cardFromTarget(event.target);
    const cardRef = card?.dataset.cardRef;
    if (!card || !cardRef) return;
    const action = ordinaryActionForRef(cardRef);
    const targetOption = targetOptionFor(cardRef);
    const option: PlayerTargetEditOption | null = targetOption?.editable === true ? targetOption : null;
    if (!option && !action) return;
    showDragNotice();
    pointerIntent = { pointerId: event.pointerId, sourceRef: cardRef, actorId: option?.actorId ?? action!.actorId,
      option, source: card, startX: event.clientX, startY: event.clientY,
      active: false, hoverTargetId: null };
    try { card.setPointerCapture(event.pointerId); } catch { /* pointer capture can fail after a batch replacement */ }
  });
  shell.addEventListener("pointermove", (event) => {
    beginDrag(event);
    if (pointerIntent?.active && event.cancelable) event.preventDefault();
    moveDragGhost(event);
    updateDragHoverTarget(event);
  });
  shell.addEventListener("pointerup", (event) => {
    if (pointerIntent) {
      endDrag(event);
    }
  });
  shell.addEventListener("dragstart", (event) => {
    if (cardFromTarget(event.target)?.classList.contains("is-target-draggable")) event.preventDefault();
  });
  const cancelPointerEdit = (event: PointerEvent): void => {
    if (!pointerIntent || pointerIntent.pointerId !== event.pointerId) return;
    const sourceRef = pointerIntent.sourceRef;
    closeEditState(sourceRef);
    if (event.type === "pointercancel") clearSuppressedCardClick();
    scheduleRelationDraw();
  };
  shell.addEventListener("pointercancel", cancelPointerEdit);
  shell.addEventListener("lostpointercapture", cancelPointerEdit, true);
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !pointerIntent) return;
    event.preventDefault();
    event.stopPropagation();
    const sourceRef = pointerIntent.sourceRef;
    closeEditState(sourceRef);
    scheduleRelationDraw();
  }, true);
  window.addEventListener("blur", () => {
    if (!pointerIntent) return;
    const sourceRef = pointerIntent.sourceRef;
    closeEditState(sourceRef);
    clearSuppressedCardClick();
  });

  shell.addEventListener("click", (event) => {
    const card = cardFromTarget(event.target);
    if (!card) return;
    const cardRef = card.dataset.cardRef;
    if (!cardRef) return;
    if (suppressCardClickRef === cardRef && event.detail > 0) {
      suppressCardClickRef = null;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const option = targetOptionFor(cardRef);
    const action = ordinaryActionForRef(cardRef);
    if (action && editState.kind === "idle") openChooser(cardRef, action.actorId);
  });
  shell.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (editState.kind !== "idle" || pointerIntent)) {
      event.preventDefault();
      const sourceRef = editState.kind !== "idle" ? editState.sourceRef : pointerIntent?.sourceRef;
      closeEditState(sourceRef);
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = cardFromTarget(event.target);
    const cardRef = card?.dataset.cardRef;
    const option = cardRef ? targetOptionFor(cardRef) : undefined;
    const action = cardRef ? ordinaryActionForRef(cardRef) : undefined;
    if (!card || (!option && !action) || editState.kind !== "idle") return;
    event.preventDefault();
    if (action) openChooser(cardRef!, action.actorId);
    else if (option?.editable) beginTargetSelection(option, option.targetIds, cardRef!);
  });
  shell.addEventListener("scroll", scheduleRelationDraw, true);
  window.addEventListener("resize", scheduleRelationDraw);
  const geometryObserver = new ResizeObserver(scheduleRelationDraw);
  geometryObserver.observe(shell);
  geometryObserver.observe(partyPanel);
  geometryObserver.observe(enemyPanel);
  geometryObserver.observe(partyPreparedLayer);
  geometryObserver.observe(enemyPreparedLayer);
  geometryObserver.observe(locationCard);
  geometryObserver.observe(fieldEffectZone);

  const clearPreparedBatch = (): void => {
    const wasEditing = editState.kind !== "idle" || pointerIntent !== null;
    closeEditState();
    if (wasEditing) advanceButton.focus({ preventScroll: true });
    pointerSourceRef = null;
    focusSourceRef = null;
    cancelRelationFrame();
    clearActiveRelation();
    activeSourceRef = null;
    preparedRelations = [];
    for (const element of preparedCardElements.values()) element.remove();
    preparedCardElements.clear();
    preparedCardAnchors.clear();
    for (const card of [...partyCards.values(), ...enemyCards.values()]) {
      card.card.element.classList.remove("has-prepared-cards", "is-hover-owner", "is-link-target");
      card.card.element.style.removeProperty("--prepared-card-space");
      card.card.element.style.removeProperty("min-height");
    }
    fieldEffectZone.classList.remove("is-hover-owner");
    fieldEffectZone.classList.remove("has-cards");
    fieldEffectZone.hidden = true;
    fieldEffectZone.style.removeProperty("min-height");
    emptyEnemies.hidden = enemyCards.size > 0;
    locationCard.classList.remove("is-link-target");
    activePreparedBatchId = null;
  };

  const cardAngle = (key: string): number => {
    let hash = 2166136261;
    for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    const centered = ((hash >>> 0) / 0xffffffff) * 2 - 1;
    return Number((Math.sign(centered) * Math.pow(Math.abs(centered), 1.65) * 2.2).toFixed(2));
  };

  const makeRouteActivityCardElement = (model: RouteActivityCardModel, batchId: string, getAngle: (key: string) => number): HTMLElement => {
    const element = makeElement("article", `prepared-action-card is-${model.kind}`);
    element.dataset.cardRef = model.id;
    element.dataset.batchId = batchId;
    element.tabIndex = 0;
    element.append(
      makeElement("strong", "prepared-action-title", model.title),
      makeElement("span", "prepared-action-description", model.description),
      makeElement("span", "prepared-action-detail", model.detail),
    );
    element.style.setProperty("--card-angle", `${getAngle(`${batchId}:${model.id}`)}deg`);
    return element;
  };

  const showPreparedBatch = (round: PreparedBattleRound, skills: PreparedBattleSkills, plan: BattleRecipePlan): void => {
    const batch = projectPreparedBattleCards(round, skills, plan);
    if (batch.id === activePreparedBatchId) {
      preparedRelations = batch.relations;
      for (const model of batch.cards) {
        const element = preparedCardElements.get(model.id);
        if (!element) continue;
        element.querySelector<HTMLElement>(".prepared-action-title")!.textContent = model.title;
        element.querySelector<HTMLElement>(".prepared-action-description")!.textContent = model.description;
        element.querySelector<HTMLElement>(".prepared-action-cost")!.textContent = model.costLabel;
        const actor = round.combatants.find((entry) => entry.actorId === model.actorId);
        const instruction = cardEditInstruction(model);
        element.setAttribute("aria-label", `${actor?.name ?? model.actorId}：${model.title}。${model.description}。${model.costLabel}。${instruction}`);
        element.title = instruction;
        const targetOption = targetOptionFor(model.id);
        element.classList.toggle("is-target-draggable", playerCardCanStartTargetDrag(targetOption));
        element.setAttribute("role", model.kind === "player-action" || targetOption?.editable ? "button" : "article");
      }
      updatePreparedCardPositions();
      scheduleRelationDraw();
      renderEditPanel();
      return;
    }
    clearPreparedBatch();
    activePreparedBatchId = batch.id;
    preparedRelations = batch.relations;
    const cardsByActor = new Map<string, PreparedBattleCardModel[]>();
    for (const card of batch.cards) {
      const owned = cardsByActor.get(card.actorId) ?? [];
      owned.push(card);
      cardsByActor.set(card.actorId, owned);
    }
    for (const [actorId, cards] of cardsByActor) {
      const owner = cards[0]?.side === "ally" ? partyCards.get(actorId) : enemyCards.get(actorId);
      if (!owner) continue;
      const ordered = [...cards].sort((left, right) => left.order - right.order);
      const ownerHeight = owner.card.element.getBoundingClientRect().height;
      const layout = preparedCardPosition(ordered.length, ordered.length - 1);
      owner.card.element.classList.add("has-prepared-cards");
      owner.card.element.style.setProperty("--prepared-card-space", `${layout.reservedWidth}px`);
      owner.card.element.style.minHeight = `${Math.max(ownerHeight, layout.reservedHeight)}px`;
      ordered.forEach((model, index) => {
        const position = preparedCardPosition(ordered.length, index);
        const element = makeElement("article", `prepared-action-card is-${model.kind}`);
        element.dataset.cardRef = model.id;
        element.dataset.batchId = batch.id;
        element.tabIndex = 0;
        const actor = round.combatants.find((entry) => entry.actorId === model.actorId);
        const instruction = cardEditInstruction(model);
        element.setAttribute("aria-label", `${actor?.name ?? model.actorId}：${model.title}。${model.description}。${model.costLabel}。${instruction}`);
        element.title = instruction;
        const targetOption = targetOptionFor(model.id);
        element.classList.toggle("is-target-draggable", playerCardCanStartTargetDrag(targetOption));
        element.setAttribute("role", model.kind === "player-action" || targetOption?.editable ? "button" : "article");
        element.append(
          makeElement("strong", "prepared-action-title", model.title),
          makeElement("span", "prepared-action-description", model.description),
          makeElement("span", "prepared-action-cost", model.costLabel),
        );
        element.style.setProperty("--card-angle", `${cardAngle(`${batch.id}:${model.id}`)}deg`);
        element.style.zIndex = String(index + 1);
        const layer = model.side === "ally" ? partyPreparedLayer : enemyPreparedLayer;
        layer.append(element);
        preparedCardElements.set(model.id, element);
        preparedCardAnchors.set(model.id, { owner: owner.card.element, layer, rightInset: position.rightInset, topInset: position.topInset });
      });
    }
    updatePreparedCardPositions();
    scheduleRelationDraw();
  };

  const showRouteActivityBatch = (batch: RouteActivityCardBatch, party: readonly RoutePartyView[]): void => {
    if (batch.id === activePreparedBatchId) return;
    clearPreparedBatch();
    activePreparedBatchId = batch.id;
    preparedRelations = batch.relations;
    const cardsByActor = new Map<string, RouteActivityCardModel[]>();
    const fieldCards: RouteActivityCardModel[] = [];
    for (const card of batch.cards) {
      if (card.placement === "field") {
        fieldCards.push(card);
        continue;
      }
      if (!card.actorId) continue;
      const owned = cardsByActor.get(card.actorId) ?? [];
      owned.push(card);
      cardsByActor.set(card.actorId, owned);
    }
    for (const [actorId, cards] of cardsByActor) {
      const owner = partyCards.get(actorId);
      if (!owner) continue;
      const ordered = [...cards].sort((left, right) => left.order - right.order);
      const fanStep = 19;
      owner.card.element.classList.add("has-prepared-cards");
      owner.card.element.style.setProperty("--prepared-card-space", `${112 + Math.max(0, ordered.length - 1) * fanStep + 8}px`);
      ordered.forEach((model, index) => {
        const element = makeRouteActivityCardElement(model, batch.id, cardAngle);
        const actorName = party.find((actor) => actor.id === actorId)?.name ?? actorId;
        element.setAttribute("aria-label", `${actorName}：${model.title}。${model.description} ${model.detail}。`);
        const rightInset = 4 + (ordered.length - index - 1) * fanStep;
        element.style.zIndex = String(index + 1);
        partyPreparedLayer.append(element);
        preparedCardElements.set(model.id, element);
        preparedCardAnchors.set(model.id, { owner: owner.card.element, layer: partyPreparedLayer, rightInset, topInset: 4 });
      });
    }
    const orderedFieldCards = fieldCards.sort((left, right) => left.order - right.order);
    fieldEffectZone.classList.toggle("has-cards", orderedFieldCards.length > 0);
    fieldEffectZone.hidden = orderedFieldCards.length === 0;
    fieldEffectZone.style.minHeight = orderedFieldCards.length > 0 ? `${orderedFieldCards.length * 76}px` : "";
    orderedFieldCards.forEach((model, index) => {
      const element = makeRouteActivityCardElement(model, batch.id, cardAngle);
      element.classList.add("route-effect-card");
      element.setAttribute("aria-label", `${model.title}：${model.description} ${model.detail}。`);
      enemyPreparedLayer.append(element);
      preparedCardElements.set(model.id, element);
      preparedCardAnchors.set(model.id, { owner: fieldEffectZone, layer: enemyPreparedLayer, rightInset: Math.max(0, (fieldEffectZone.clientWidth - 184) / 2), topInset: 4 + index * 76 });
    });
    emptyEnemies.hidden = orderedFieldCards.length > 0;
    updatePreparedCardPositions();
    scheduleRelationDraw();
  };

  let renderedThrough = 0;
  const activityClicksByNode = new Map<string, number>();
  let preparedClickSnapshot: { click: number; context: string[]; actorNames: Map<string, string>; attached: boolean } | null = null;
  advanceButton.addEventListener("click", () => {
    const round = latestView.currentBattle?.pendingRound;
    if (!round) {
      preparedClickSnapshot = null;
      return;
    }
    const click = latestView.clickCount + 1;
    const context = [...previewContent.querySelectorAll<HTMLElement>(".event-item")].map((item) => {
      const kind = item.querySelector(".event-kind")?.textContent?.trim();
      const message = item.querySelector(".event-message")?.textContent?.trim();
      return kind && message ? `${kind} · ${message}` : undefined;
    }).filter((line): line is string => Boolean(line));
    preparedClickSnapshot = {
      click,
      context: [`Click ${click} · 第 ${round.round} 轮冻结预览（以下内容已结算）：`, ...context],
      actorNames: new Map(round.combatants.map((actor) => [actor.actorId, actor.name])),
      attached: false,
    };
  });
  let preserveTranscriptPosition = false;
  eventScroll.addEventListener("scroll", () => {
    preserveTranscriptPosition = !eventScrollIsNearEnd(eventScroll);
  });
  let previewSignature = "";
  const renderPreview = (view: GameplayBRouteView): void => {
    const signature = JSON.stringify([view.currentNode.id, view.currentBattle?.pendingRound, view.currentBattle?.pendingSkills, view.currentBattle?.pendingRecipePlan]);
    if (signature === previewSignature) return;
    previewSignature = signature;
    const previousScrollTop = previewContent.scrollTop;
    previewContent.replaceChildren();
    const battle = view.currentBattle;
    if (battle?.pendingRound && battle.pendingSkills && battle.pendingRecipePlan) {
      const previewList = makeElement("ol", "event-list");
      previewList.setAttribute("aria-label", "当前战斗回合预览");
      appendPreparedRound(previewList, battle.pendingRound, battle.pendingSkills, battle.pendingRecipePlan, (intent) => {
        const entry = findParkText(view.currentNode.id, "battle-intent", intent.intentId);
        return resolveParkText(entry, intent.targetIds, battle.pendingRound!.combatants);
      });
      previewContent.append(previewList);
    } else {
      const text = battle?.terminal
        ? "本场战斗已结束；路线 Runtime 正在显示终态或已进入下一节点。"
        : view.currentNode.kind === "activity"
          ? "本次 Click 会让当前队伍统一进行一次活动；个人检定与 HP 变化只在结算后记录。"
          : view.currentNode.kind === "exit"
            ? "完成出口交接后，巡查 Demo 立即结束。"
            : "当前没有待结算的战斗回合。";
      previewContent.append(makeElement("p", "activity-status", text));
    }
    previewContent.scrollTop = previousScrollTop;
  };

  const update = (view: GameplayBRouteView): void => {
    latestView = view;
    const node = view.currentNode;
    const battle = view.currentBattle;
    const pendingRound = battle?.pendingRound ?? null;
    const pendingSkills = battle?.pendingSkills as PreparedBattleSkills | null;
    const pendingRecipePlan = battle?.pendingRecipePlan ?? null;
    const prepared = pendingRound && pendingSkills && pendingRecipePlan
      ? { round: pendingRound, skills: pendingSkills, plan: pendingRecipePlan }
      : null;
    const round = battle?.pendingRound?.round ?? battle?.state.round ?? 0;
    const nodeContent = routeNodes.find((candidate) => candidate.id === view.currentNode.id);
    const activityCount = nodeContent?.kind === "activity" ? nodeContent.activityCount : nodeContent?.kind === "exit" ? nodeContent.activityCount ?? 1 : 0;
    const routeActivityBatch = !prepared && !view.sceneChoice && node.kind === "activity" && nodeContent?.kind === "activity"
      ? projectRouteActivityCards({ currentNode: node, clickCount: view.clickCount, events: view.events,
        party: view.party, activityNode: nodeContent })
      : null;
    const desiredBatchId = prepared ? `${prepared.round.encounterId}:${prepared.round.round}` : routeActivityBatch?.id ?? null;
    if (desiredBatchId !== activePreparedBatchId) clearPreparedBatch();
    routeSeal.textContent = `到访\n${Object.values(view.nodeVisitCounts).reduce((sum, count) => sum + count, 0)}`;
    locationKind.textContent = node.kind === "battle" ? "战斗" : node.kind === "activity" ? (view.sceneChoice?.mode === "individual" ? "逐角色选择" : view.sceneChoice?.mode === "global" ? "全局选择" : "场景") : "出口";
    locationName.textContent = node.name;
    locationDescription.textContent = content.descriptions?.[node.id] ?? routeDescriptions[node.id] ?? "当前节点由路线 Runtime 自动进入。";
    locationCard.dataset.locationRef = nodeContent?.kind === "activity" ? nodeContent.activity.locationId : "";
    syncParty(view.party);
    syncMapAndResources(view);
    syncEnemies(battle);
    syncSceneChoices(view);
    if (prepared) showPreparedBatch(prepared.round, prepared.skills, prepared.plan);
    else if (routeActivityBatch) showRouteActivityBatch(routeActivityBatch, view.party);
    renderPreview(view);

    if (view.terminal) {
      activityHeading.textContent = view.result === "complete" ? "巡查完成" : view.result === "draw" ? "行动平局" : "行动结束";
      activityStatus.textContent = `路线终态：${view.result} · ${view.party.length} 名队员`;
      clickHelper.textContent = "记录已收束；重复输入不会推进路线或追加日志。";
      advanceButton.textContent = activityHeading.textContent;
    } else if (node.kind === "battle") {
      activityHeading.textContent = `第 ${round} 轮准备完成`;
      activityStatus.textContent = `敌方存活 ${battle?.state.combatants.filter((actor) => actor.side === "enemy" && actor.hp > 0).length ?? 0} 人 · 当前行动已冻结`;
      clickHelper.textContent = "一次 Click 只结算当前冻结回合；若胜利，新节点只自动进入并准备，不会在这次输入中继续结算。";
      advanceButton.textContent = `Click · 结算第 ${round} 轮`;
    } else if (node.kind === "activity") {
      const remaining = view.activityRemaining ?? 0;
      activityHeading.textContent = node.name;
      activityStatus.textContent = view.sceneChoice ? "待确认行动 · 费用与余额见底部" : `剩余活动度 ${remaining}/${activityCount} · ${view.party.length} 人在队`;
      clickHelper.textContent = view.awaitingExitChoice ? "场景已完成，请在地图上选择一个开放出口。" : view.sceneChoice ? (view.sceneChoice.blockedReason ?? "确认后统一支付费用并结算本批；完成场景后再选择出口。") : "一次 Click 只结算当前节点的一次活动。";
      advanceButton.textContent = view.awaitingExitChoice ? "等待选择出点" : view.sceneChoice ? "Click · 确认本批" : `Click · ${node.name}（剩余 ${remaining}）`;
    } else {
      activityHeading.textContent = "出口交接待完成";
      activityStatus.textContent = "一次 Click 完成固定交接并结束路线。";
      clickHelper.textContent = "此 Click 只处理出口交接，不会重复执行前一节点的行为。";
      advanceButton.textContent = "Click · 完成交接";
    }
    clickHelperBaseText = clickHelper.textContent ?? "";
    if (pointerIntent?.active && pointerIntent.option) {
      showDragNotice(`${actorName(pointerIntent.actorId)}：把卡片放到高亮目标上；松开提交，按 Escape 取消。`);
    }
    updateAdvanceAvailability();

    const follow = !preserveTranscriptPosition || eventScrollIsNearEnd(eventScroll);
    for (const event of view.events) {
      if (event.sequence <= renderedThrough) continue;
      const node = routeNodes.find((candidate) => candidate.id === event.nodeId);
      const context: string[] = [];
      const addContext = (entry: ParkTextEntry | undefined, targetIds: readonly string[] = [], actors: readonly BattleCombatantSnapshot[] = []): void => {
        const text = resolveParkText(entry, targetIds, actors);
        if (text) context.push(text);
      };
      if (event.type === "route-terminal" && event.nodeId === "node-12" && view.result === "complete") {
        addContext(findParkText(event.nodeId, "activity-click", undefined, 1));
        addContext(findParkText(event.nodeId, "route-completed"));
      } else if (event.type === "node-entered") {
        addContext(findParkText(event.nodeId, "node-entered"));
        if (node?.kind === "battle") addContext(findParkText(event.nodeId, "battle-intro"));
      } else if (event.type === "character-joined") {
        addContext(findParkText(event.nodeId, "character-joined", event.actorId));
      } else if (event.type === "activity-progress") {
        const activityIndex = (activityClicksByNode.get(event.nodeId) ?? 0) + 1;
        activityClicksByNode.set(event.nodeId, activityIndex);
        addContext(findParkText(event.nodeId, "activity-click", undefined, activityIndex));
        if (node?.kind === "activity" && activityIndex === node.activityCount) {
          addContext(findParkText(event.nodeId, "activity-completed"));
        }
      } else if (event.type === "battle-ended") {
        const result = battleResultFromEvent(event);
        if (result) addContext(findParkText(event.nodeId, "battle-ended", result));
      } else if (event.type === "route-terminal" && node?.kind === "activity") {
        const activityIndex = (activityClicksByNode.get(event.nodeId) ?? 0) + 1;
        activityClicksByNode.set(event.nodeId, activityIndex);
        addContext(findParkText(event.nodeId, "activity-click", undefined, activityIndex));
      }
      let displayText = event.text;
      const prepared = preparedClickSnapshot?.click === event.click ? preparedClickSnapshot : null;
      if (prepared && (event.type === "battle-event" || event.type === "battle-ended") && !prepared.attached) {
        context.unshift(...prepared.context);
        prepared.attached = true;
      }
      if (prepared && event.type === "battle-event") {
        for (const [actorId, name] of prepared.actorNames) displayText = displayText.replaceAll(`${actorId}:`, `${name}:`);
      }
      appendRouteEvent(eventList, event, context, displayText);
      renderedThrough = event.sequence;
    }
    if (preparedClickSnapshot && view.clickCount >= preparedClickSnapshot.click) preparedClickSnapshot = null;
    if (follow) {
      eventScroll.scrollTop = eventScroll.scrollHeight;
      preserveTranscriptPosition = false;
    }
    renderEditPanel();
  };

  synchronizeView = update;
  update(initialView);
  return { advanceButton, update };
}
