import type { GameplayMapDef, GameplayMapActionDef, GameplayEncounterDef } from '../../../data-services/contracts/gameplay-map';
import { normalizeMapActionEffects, type NormalizedGameplayMapEffectCondition, type NormalizedGameplayMapEffectInstruction } from '../../../data-services/normalization/gameplay-map-effect-program';
import type { MapEffectGuardRead, MapEffectPreparedPartyTagSource, MapEffectProgramSourceIdentity, MapEncounterStatusInstance } from '../../contracts/map/map-effects';
import { mapCardActorKey } from './map-card-effects';
import { planMapEffectSource } from './map-effect-planner';
import { resolveGameplayMapCandidateSources } from '../../../data-services/validation/gameplay-map-candidate-pools';
import { reverseMapEncounterStatusTrace, validateMapEncounterStatusTrace } from './map-encounter-statuses';
import { matchesTag, parseTagRef } from '../../../engine/core/tag';
import type { TagPath, TagRef } from '../../../engine/core/tag';

type Row = Record<string, any>;
type CurrentEncounter = {
  readonly nodeId: string;
  readonly activityId?: string;
  readonly round: number;
  readonly locals?: unknown;
  readonly statuses?: readonly MapEncounterStatusInstance[];
  readonly partyHp?: readonly { readonly characterId: string; readonly currentHp: number }[];
  readonly enemies?: readonly { readonly enemyId: string; readonly currentHp: number }[];
};
export interface MapEffectReceiptBalances {
  readonly partyActor?: readonly { readonly characterId: string; readonly resourceId: string; readonly value: number }[];
  readonly partyTeam?: readonly { readonly resourceId: string; readonly value: number }[];
  readonly enemyActor?: readonly { readonly enemyId: string; readonly resourceId: string; readonly value: number }[];
  readonly enemyTeam?: readonly { readonly resourceId: string; readonly value: number }[];
}
export interface MapEffectReceiptContext {
  /** Trusted parent Run identity supplied by the caller/checkpoint. */
  readonly runId: string;
  readonly map: GameplayMapDef;
  readonly encounter: GameplayEncounterDef;
  readonly currentEncounter?: CurrentEncounter | null;
  /** Trusted balances from the still-active checkpoint; used only for end-state comparison. */
  readonly currentBalances?: MapEffectReceiptBalances | null;
}
export interface MapEffectReceiptValidation {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

const record = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);
const safeInt = (value: unknown): value is number => Number.isSafeInteger(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, comparable(value[key])]));
  return value;
}
const same = (left: unknown, right: unknown) => {
  try { return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right)); }
  catch { return false; }
};
const exact = (value: Row, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key))
  && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const knownFields = (value: Row, required: readonly string[], optional: readonly string[] = []) =>
  required.every(key => Object.prototype.hasOwnProperty.call(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const identityKey = (identity: Row): string => `${identity.kind}:${identity.id}`;
const sourceKeyFor = (source: MapEffectProgramSourceIdentity): string => source.kind === 'partyCharacter' || source.kind === 'enemy'
  ? mapCardActorKey(source.kind, source.id)
  : source.kind === 'ability' ? JSON.stringify(['ability', source.actionId])
    : JSON.stringify(['item', source.itemId, source.actionId]);
function tagRefPath(value: TagRef): TagPath | null {
  const parsed = parseTagRef(value);
  return parsed ? [`${parsed.modName}:${parsed.path[0]}`, ...parsed.path.slice(1)] : null;
}
function tagRefMatches(declared: TagRef, query: TagRef): boolean {
  const declaredPath = tagRefPath(declared);
  const queryPath = tagRefPath(query);
  return !!declaredPath && !!queryPath && matchesTag(declaredPath, queryPath);
}
function preparedPartyTagSourcesFromReceipt(receipt: Row, context: MapEffectReceiptContext): MapEffectPreparedPartyTagSource[] {
  const actionById = new Map((context.map.actions ?? []).map(action => [action.id, action]));
  const seenCharacters = new Set<string>();
  const result: MapEffectPreparedPartyTagSource[] = [];
  for (const row of Array.isArray(receipt.settlements) ? receipt.settlements : []) {
    if (!record(row) || !id(row.characterId) || !id(row.actionId) || seenCharacters.has(row.characterId)) continue;
    seenCharacters.add(row.characterId);
    const action = actionById.get(row.actionId);
    if (!action) continue;
    result.push({
      characterId: row.characterId,
      actionId: action.id,
      origin: row.overrideKind === 'playerCommand' ? 'playerCommand' : 'hand',
      tags: action.tags ?? [],
    });
  }
  return result;
}
type PreparedTagCountLookup = (side: 'party', tag: TagRef) => number;
function receiptPreparedTagCountLookup(receipt: Row, context: MapEffectReceiptContext): PreparedTagCountLookup {
  const sources = preparedPartyTagSourcesFromReceipt(receipt, context);
  return (side, tag) => side === 'party'
    ? sources.filter(source => source.tags.some(declared => tagRefMatches(declared, tag))).length
    : 0;
}
function parseCardInfo(rawId: string): { zone: string; kind: string; id: string; actionId: string } | null {
  try {
    const raw: unknown = JSON.parse(rawId);
    if (!Array.isArray(raw) || raw.length !== 4 || JSON.stringify(raw) !== rawId) return null;
    const [zone, kind, actorId, actionId] = raw;
    if ((zone !== 'hand' && zone !== 'playerCommand') || (kind !== 'partyCharacter' && kind !== 'enemy') || !id(actorId) || !id(actionId)) return null;
    return { zone, kind, id: actorId, actionId };
  } catch { return null; }
}

function validIdentity(value: unknown): value is Row {
  if (!record(value)) return false;
  if (value.kind === 'partyCharacter' || value.kind === 'enemy') return exact(value, ['kind', 'id']) && id(value.id);
  if (value.kind === 'team') return exact(value, ['kind', 'side']) && (value.side === 'party' || value.side === 'enemy');
  return value.kind === 'encounterLocal' && exact(value, ['kind']);
}

function cardReceiver(receipt: Row, card: { zone: string; kind: string; id: string; actionId: string }): Row | null {
  const active = [
    ...(Array.isArray(receipt.settlements) ? receipt.settlements : []),
    ...(Array.isArray(receipt.enemyActions) ? receipt.enemyActions : []),
  ].filter(record);
  const receiver = active.find(row => {
    const kind = id(row.characterId) ? 'partyCharacter' : id(row.enemyId) ? 'enemy' : null;
    const ownerId = id(row.characterId) ? row.characterId : row.enemyId;
    const zone = row.overrideKind === 'playerCommand' ? 'playerCommand' : 'hand';
    return kind === card.kind && ownerId === card.id && row.actionId === card.actionId
      && zone === card.zone && row.skipReason !== 'noLegalTarget';
  });
  return receiver ? { kind: card.kind, id: card.id } : null;
}

function roleMatchesOwner(action: GameplayMapActionDef, ownerKind: 'partyCharacter' | 'enemy'): boolean {
  const role = action.tendencyRole;
  if (role === undefined || role === 'defense') return true;
  if (role === 'recovery') return ownerKind === 'partyCharacter'
    ? action.target.kind === 'self' || action.target.kind === 'partyCharacter'
    : action.target.kind === 'self' || action.target.kind === 'enemy';
  if (role === 'attack') return ownerKind === 'partyCharacter'
    ? action.target.kind === 'enemy' : action.target.kind === 'partyCharacter';
  return false;
}

function candidateActionIdsForOwner(context: MapEffectReceiptContext, ownerKind: 'partyCharacter' | 'enemy', ownerId: string): Set<string> {
  const participant = ownerKind === 'partyCharacter'
    ? context.encounter.participants?.find(row => row.characterId === ownerId) : undefined;
  const enemy = ownerKind === 'enemy'
    ? context.encounter.enemies?.find(row => row.id === ownerId) : undefined;
  try {
    const candidates = resolveGameplayMapCandidateSources(context.map,
      participant?.actions ?? enemy?.actions,
      participant?.candidatePoolIds ?? enemy?.candidatePoolIds);
    return new Set(candidates.filter(candidate => {
      const action = context.map.actions?.find(row => row.id === candidate.actionId);
      return !!action
        && (ownerKind === 'enemy' || action.eligibleCharacterIds.includes(ownerId as never))
        && roleMatchesOwner(action, ownerKind);
    }).map(candidate => candidate.actionId));
  } catch {
    return new Set();
  }
}

function cardIsCandidate(card: { zone: string; kind: string; id: string; actionId: string }, context: MapEffectReceiptContext): boolean {
  if (card.kind === 'partyCharacter') {
    const action = context.map.actions?.find(row => row.id === card.actionId);
    return candidateActionIdsForOwner(context, 'partyCharacter', card.id).has(card.actionId)
      && !!action?.eligibleCharacterIds.includes(card.id as never);
  }
  if (card.zone !== 'hand') return false;
  return candidateActionIdsForOwner(context, 'enemy', card.id).has(card.actionId);
}

function cardIsAllowedForSource(card: { zone: string; kind: string; id: string; actionId: string },
  source: MapEffectProgramSourceIdentity, action: GameplayMapActionDef, context: MapEffectReceiptContext): boolean {
  if (action.target.kind !== 'card' || !cardIsCandidate(card, context)) return false;
  const targetAction = context.map.actions?.find(candidate => candidate.id === card.actionId);
  const targetHasSCost = (targetAction?.costs ?? []).some(cost => cost.scope === 'actor' && cost.resourceId === 'sCost' && cost.amount > 0);
  if (!targetHasSCost) return false;
  const sourceKind = source.kind === 'enemy' ? 'enemy' : source.kind === 'partyCharacter' ? 'partyCharacter' : null;
  const sourceId = source.kind === 'enemy' || source.kind === 'partyCharacter' ? source.id : null;
  const allied = sourceKind === card.kind;
  if (action.target.side === 'self' && (sourceKind !== card.kind || sourceId !== card.id)) return false;
  if (action.target.side === 'ally' && !allied) return false;
  if (action.target.side === 'opponent' && allied) return false;
  return true;
}

function targetIsLegal(source: MapEffectProgramSourceIdentity, action: GameplayMapActionDef, row: Row,
  context: MapEffectReceiptContext): boolean {
  const hasPartyTarget = id(row.targetCharacterId);
  const hasEnemyTarget = id(row.targetEnemyId);
  const hasCardTarget = record(row.targetCard);
  if (row.skipReason !== undefined) {
    if (source.kind === 'partyCharacter') return row.skipReason === 'noLegalTarget'
      && ['partyCharacter', 'enemy', 'card'].includes(action.target.kind)
      && !hasPartyTarget && !hasEnemyTarget && !hasCardTarget;
    if (source.kind === 'enemy') return ['defeated', 'noLegalTarget', 'unaffordable', 'roundEnded'].includes(row.skipReason)
      && (row.skipReason !== 'noLegalTarget' || ['partyCharacter', 'enemy', 'card'].includes(action.target.kind))
      && !hasPartyTarget && !hasEnemyTarget && !hasCardTarget;
    return false;
  }
  if (source.kind === 'ability' || source.kind === 'item') {
    const target = targetFromSettlement(row);
    if (!target || hasCardTarget) return false;
    if (action.target.kind === 'partyCharacter') return target.kind === 'partyCharacter'
      && context.map.partyCharacterIds.includes(target.id as never);
    if (action.target.kind === 'enemy') return target.kind === 'enemy'
      && (context.encounter.enemies ?? []).some(enemy => enemy.id === target.id);
    return false;
  }
  if (action.target.kind === 'none') return !hasPartyTarget && !hasEnemyTarget && !hasCardTarget;
  if (action.target.kind === 'self') return source.kind === 'partyCharacter'
    ? hasPartyTarget && row.targetCharacterId === source.id && !hasEnemyTarget && !hasCardTarget
    : hasEnemyTarget && row.targetEnemyId === source.id && !hasPartyTarget && !hasCardTarget;
  if (action.target.kind === 'partyCharacter') return hasPartyTarget && !hasEnemyTarget && !hasCardTarget
    && context.map.partyCharacterIds.includes(row.targetCharacterId as never);
  if (action.target.kind === 'enemy') return hasEnemyTarget && !hasPartyTarget && !hasCardTarget
    && (context.encounter.enemies ?? []).some(enemy => enemy.id === row.targetEnemyId);
  const card = hasCardTarget && id(row.targetCard.id) ? parseCardInfo(row.targetCard.id) : null;
  return !!card && !hasPartyTarget && !hasEnemyTarget && cardIsAllowedForSource(card, source, action, context);
}

type SourceInfo = { source: MapEffectProgramSourceIdentity; action: GameplayMapActionDef; target: Row | null; targetCard: Row | null; settlement: Row; skipped: boolean };
type Rule = { op: string; path: string; instruction?: NormalizedGameplayMapEffectInstruction; prepareAmount?: number; condition?: NormalizedGameplayMapEffectCondition };

function normalizeProgramAction(action: GameplayMapActionDef) {
  if (!action.effectProgram) return null;
  return normalizeMapActionEffects({
    id: action.id,
    name: action.name,
    ...(action.description === undefined ? {} : { description: action.description }),
    eligibleCharacterIds: action.eligibleCharacterIds,
    target: action.target,
    ...(action.tendencyRole === undefined ? {} : { tendencyRole: action.tendencyRole }),
    ...(action.costs === undefined ? {} : { costs: action.costs }),
    effectProgram: action.effectProgram,
  });
}

function rulesFor(action: GameplayMapActionDef): Map<string, Rule> {
  const normalized = normalizeProgramAction(action);
  if (!normalized) return new Map();
  const result = new Map<string, Rule>();
  for (const prepare of normalized.prepare) {
    result.set(prepare.originPath, { op: 'discountSCost', path: prepare.originPath, prepareAmount: prepare.amount });
  }
  const visit = (instructions: readonly NormalizedGameplayMapEffectInstruction[]) => {
    for (const instruction of instructions) {
      result.set(instruction.originPath, {
        op: instruction.op, path: instruction.originPath, instruction,
        ...(instruction.op === 'when' ? { condition: instruction.condition } : {}),
      });
      if (instruction.op === 'when') {
        const condition = (value: NormalizedGameplayMapEffectCondition) => {
          result.set(value.originPath, { op: value.kind, path: value.originPath, condition: value });
          if (value.kind === 'not') condition(value.condition);
          else if (value.kind === 'all' || value.kind === 'any') value.conditions.forEach(condition);
        };
        condition(instruction.condition);
        visit(instruction.then); visit(instruction.else ?? []);
      }
    }
  };
  visit(normalized.resolve);
  return result;
}

function isE2Instruction(instruction: NormalizedGameplayMapEffectInstruction | undefined): boolean {
  if (!instruction || (instruction.op !== 'damage' && instruction.op !== 'heal')) return false;
  return typeof instruction.target === 'object' || typeof instruction.amount !== 'number' || instruction.repeat !== undefined;
}

function e2InstructionRefs(infos: Map<string, SourceInfo>): Set<string> {
  const refs = new Set<string>();
  for (const [sourceKey, info] of infos) for (const [path, rule] of rulesFor(info.action)) {
    if (isE2Instruction(rule.instruction)) refs.add(`${sourceKey}|${info.action.id}|${path}`);
  }
  return refs;
}

function reverseStatusApplyTrace(
  receiptStatuses: readonly MapEncounterStatusInstance[],
  trace: readonly Row[],
  context: MapEffectReceiptContext,
  errors: string[],
): readonly MapEncounterStatusInstance[] {
  const statuses = receiptStatuses.map(status => ({ ...status, holder: { ...status.holder }, source: { ...status.source } }));
  const rows = trace.filter(entry => entry.op === 'statusApply');
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    if (!record(row.source) || !record(row.identity) || !id(row.statusId) || !id(row.actionId)
      || !safeInt(row.requestedStacks) || row.requestedStacks < 1
      || !safeInt(row.beforeStacks) || row.beforeStacks < 0
      || !safeInt(row.afterStacks) || row.afterStacks < 1
      || !(row.beforeRemainingRounds === null || (safeInt(row.beforeRemainingRounds) && row.beforeRemainingRounds > 0))
      || !safeInt(row.afterRemainingRounds) || row.afterRemainingRounds < 1
      || !(row.beforeAppliedRound === null || safeInt(row.beforeAppliedRound))
      || !(row.beforeLastTriggeredRound === null || safeInt(row.beforeLastTriggeredRound))
      || !safeInt(row.appliedRound) || !(row.lastTriggeredRound === null || safeInt(row.lastTriggeredRound))) {
      errors.push('Status apply trace has an invalid shape'); return [];
    }
    const source = row.source as unknown as MapEffectProgramSourceIdentity;
    const holder = row.identity as unknown as { kind: 'partyCharacter' | 'enemy'; id: string };
    const key = `${holder.kind}:${holder.id}|${row.statusId}|${sourceKeyFor(source)}|${row.actionId}`;
    const matching = (status: MapEncounterStatusInstance) => `${status.holder.kind}:${status.holder.id}|${status.statusId}|${sourceKeyFor(status.source)}|${status.actionId}` === key;
    const matchIndexes = statuses.flatMap((status, statusIndex) => matching(status) ? [statusIndex] : []);
    if (matchIndexes.length !== 1) { errors.push(`Status apply reverse chain has no unique successor at ${String(row.path)}`); return []; }
    const statusIndex = matchIndexes[0]!;
    const after = statuses[statusIndex]!;
    if (after.stacks !== row.afterStacks || after.remainingRounds !== row.afterRemainingRounds
      || after.appliedRound !== row.appliedRound || after.lastTriggeredRound !== row.lastTriggeredRound
      || row.beforeStacks > after.stacks || row.appliedRound !== Number(row.beforeAppliedRound ?? row.appliedRound)
      || (row.beforeStacks > 0 && !safeInt(row.beforeAppliedRound))
      || (row.beforeStacks === 0) !== (row.beforeRemainingRounds === null)) {
      errors.push(`Status apply reverse chain disagrees at ${String(row.path)}`); return [];
    }
    if (row.beforeStacks === 0) statuses.splice(statusIndex, 1);
    else statuses[statusIndex] = {
      holder: { ...holder }, statusId: row.statusId, source: { ...source }, actionId: row.actionId,
      appliedRound: row.beforeAppliedRound as number,
      lastTriggeredRound: row.beforeLastTriggeredRound as number | null,
      stacks: row.beforeStacks,
      remainingRounds: row.beforeRemainingRounds as number,
    };
  }
  if (statuses.length > 256) errors.push('Status apply reverse chain exceeds the active instance limit');
  return statuses;
}

function validateStatusApplyEvidence(
  receipt: Row,
  trace: readonly Row[],
  visits: readonly Row[],
  infos: Map<string, SourceInfo>,
  context: MapEffectReceiptContext,
  errors: string[],
): void {
  const applyRows = trace.filter(entry => entry.op === 'statusApply');
  const expectedRefs = new Set<string>();
  for (const visit of visits) {
    if (visit.kind !== 'statement') continue;
    const info = infos.get(String(visit.sourceKey));
    const instruction = info ? rulesFor(info.action).get(String(visit.path))?.instruction : undefined;
    if (instruction?.op === 'statusApply') expectedRefs.add(`${visit.sourceKey}|${visit.actionId}|${visit.path}`);
  }
  const seen = new Set<string>();
  const latestByIdentity = new Map<string, Row>();
  for (const row of applyRows) {
    const info = infos.get(String(row.sourceKey));
    const instruction = info ? rulesFor(info.action).get(String(row.path))?.instruction : undefined;
    const status = context.map.statuses?.find(candidate => candidate.id === row.statusId);
    const target = info && instruction?.op === 'statusApply'
      ? (instruction.target === 'source'
        ? (info.source.kind === 'partyCharacter' || info.source.kind === 'enemy' ? { kind: info.source.kind, id: info.source.id } : null)
        : info.target && ['partyCharacter', 'enemy'].includes(String(info.target.kind))
          ? { kind: info.target.kind, id: String(info.target.id) } : null)
      : null;
    const ref = `${row.sourceKey}|${row.actionId}|${row.path}`;
    const fieldsMatch = info && instruction?.op === 'statusApply' && status
      && row.actionId === info.action.id && same(row.source, info.source)
      && instruction.statusId === row.statusId && instruction.stacks === row.requestedStacks
      && instruction.durationRounds === row.afterRemainingRounds && same(target, row.identity)
      && row.afterStacks === Math.min(status.maxStacks, Number(row.beforeStacks) + Number(row.requestedStacks))
      && (Number(row.beforeStacks) === 0 ? row.appliedRound === receipt.round
        && row.beforeRemainingRounds === null && row.beforeAppliedRound === null && row.beforeLastTriggeredRound === null
        : safeInt(row.beforeAppliedRound) && row.beforeAppliedRound < Number(receipt.round)
          && safeInt(row.beforeRemainingRounds) && Number(row.beforeRemainingRounds) > 0
          && (row.beforeLastTriggeredRound === null || (safeInt(row.beforeLastTriggeredRound) && row.beforeLastTriggeredRound < Number(receipt.round)))
          && row.beforeAppliedRound === row.appliedRound)
      && row.lastTriggeredRound === row.beforeLastTriggeredRound;
    if (!fieldsMatch) errors.push(`Status apply trace at ${String(row.path)} is not admitted by its declared Action`);
    if (!expectedRefs.has(ref) || seen.has(ref)) errors.push(`Status apply trace at ${String(row.path)} does not match one unique program visit`);
    seen.add(ref);
    if (record(row.source) && record(row.identity) && id(row.statusId) && id(row.actionId)) {
      const statusKey = `${identityKey(row.identity)}|${row.statusId}|${sourceKeyFor(row.source as unknown as MapEffectProgramSourceIdentity)}|${row.actionId}`;
      const previous = latestByIdentity.get(statusKey);
      if (previous && (row.beforeStacks !== previous.afterStacks
        || row.beforeRemainingRounds !== previous.afterRemainingRounds
        || row.beforeAppliedRound !== previous.appliedRound
        || row.beforeLastTriggeredRound !== previous.lastTriggeredRound)) {
        errors.push(`Status apply trace chain is discontinuous at ${String(row.path)}`);
      }
      latestByIdentity.set(statusKey, row);
    }
  }
  if (Array.isArray(receipt.plannedStatuses)) {
    for (const row of applyRows) if (row.beforeStacks === 0 && row.appliedRound === receipt.round) {
      const found = receipt.plannedStatuses.some(raw => record(raw)
        && record(raw.holder) && same(raw.holder, row.identity)
        && raw.statusId === row.statusId && raw.actionId === row.actionId && same(raw.source, row.source)
        && raw.appliedRound === row.appliedRound && raw.lastTriggeredRound === row.lastTriggeredRound
        && raw.stacks === row.afterStacks && raw.remainingRounds === row.afterRemainingRounds);
      if (!found) errors.push(`New same-round Status at ${String(row.path)} is absent from plannedStatuses`);
    }
  }
  if (seen.size !== expectedRefs.size || [...expectedRefs].some(ref => !seen.has(ref))) {
    errors.push('Status apply trace does not match all executed Status apply visits');
  }
}

function validateE2BatchStructures(trace: Row[], infos: Map<string, SourceInfo>, errors: string[]): void {
  for (const [sourceKey, info] of infos) for (const rule of rulesFor(info.action).values()) {
    const instruction = rule.instruction;
    if (!instruction || (instruction.op !== 'damage' && instruction.op !== 'heal') || !isE2Instruction(instruction)) continue;
    const rows = trace.filter(entry => entry.sourceKey === sourceKey && entry.actionId === info.action.id && entry.path === rule.path);
    const markers = rows.filter(entry => entry.op === 'targetSet');
    if (markers.length !== 1) { errors.push(`E2 instruction ${rule.path} must have one TargetSet expansion record`); continue; }
    const marker = markers[0]!;
    const selector = typeof instruction.target === 'object' ? instruction.target.set : null;
    const selection = selector ? 'set' : 'primary';
    if (marker.selection !== selection || !same(marker.selector, selector) || !Array.isArray(marker.identities)
      || !safeInt(marker.repeatCount) || marker.repeatCount < 0 || marker.repeatCount > 8) {
      errors.push(`E2 TargetSet record at ${rule.path} disagrees with its instruction`); continue;
    }
    const identities = marker.identities as Row[];
    const seen = new Set<string>();
    for (const identity of identities) {
      if (!validIdentity(identity) || !['partyCharacter', 'enemy'].includes(String(identity.kind))) {
        errors.push(`E2 TargetSet at ${rule.path} contains an invalid identity`); continue;
      }
      const key = identityKey(identity);
      if (seen.has(key)) errors.push(`E2 TargetSet at ${rule.path} contains a duplicate identity`);
      seen.add(key);
      if (selector) {
        const expectedKind = selector.side === 'party' ? 'partyCharacter' : 'enemy';
        if (identity.kind !== expectedKind) errors.push(`E2 TargetSet at ${rule.path} contains the wrong side`);
      } else if (!info.target || !same(identity, info.target)) errors.push(`E2 primary expansion at ${rule.path} changed its selected target`);
    }
    if (identities.length > 32 || (selector?.limit !== undefined && identities.length > selector.limit)) {
      errors.push(`E2 TargetSet at ${rule.path} exceeds its declared result limit`);
    }
    const hits = rows.filter(entry => entry.op === instruction.op);
    const expectedHitCount = identities.length * marker.repeatCount;
    if (hits.length !== expectedHitCount) errors.push(`E2 hit count at ${rule.path} disagrees with its TargetSet / repeat`);
    for (let index = 0; index < hits.length; index += 1) {
      const event = hits[index]!;
      const batch = record(event.batch) ? event.batch : null;
      const targetIndex = Math.floor(index / Math.max(marker.repeatCount, 1));
      const hitIndex = index % Math.max(marker.repeatCount, 1);
      if (!batch || batch.targetIndex !== targetIndex || batch.hitIndex !== hitIndex
        || batch.targetCount !== identities.length || batch.repeatCount !== marker.repeatCount
        || !same(event.identity, identities[targetIndex])) errors.push(`E2 hit ordering at ${rule.path} is invalid`);
    }
  }
}

function sourceInfos(receipt: Row, context: MapEffectReceiptContext, errors: string[]): Map<string, SourceInfo> {
  const infos = new Map<string, SourceInfo>();
  const actions = new Map((context.map.actions ?? []).map(action => [action.id, action]));
  const add = (source: MapEffectProgramSourceIdentity, actionId: unknown, target: Row | null, targetCard: Row | null) => {
    if (!id(actionId)) return;
    const action = actions.get(actionId);
    if (!action) { errors.push(`unknown Action ${actionId}`); return; }
    const key = sourceKeyFor(source);
    if (infos.has(key)) { errors.push(`duplicate source ${key}`); return; }
    const settlement = receiptRowFor(receipt, source);
    const skipped = settlement.skipReason !== undefined;
    if (!sourceIsLegal(source, action, settlement, context, errors)) return;
    infos.set(key, { source, action, target, targetCard, settlement, skipped });
  };
  const settlements = Array.isArray(receipt.settlements) ? receipt.settlements : [];
  for (const value of settlements) if (record(value) && value.actionId !== null) {
    if (id(value.characterId)) add({ kind: 'partyCharacter', id: value.characterId }, value.actionId,
      targetFromSettlement(value), record(value.targetCard) ? value.targetCard : null);
  }
  if (Array.isArray(receipt.enemyActions)) for (const value of receipt.enemyActions) if (record(value) && value.actionId !== null && id(value.enemyId)) {
    add({ kind: 'enemy', id: value.enemyId }, value.actionId, targetFromSettlement(value), record(value.targetCard) ? value.targetCard : null);
  }
  if (record(receipt.ability)) add({ kind: 'ability', actionId: String(receipt.ability.actionId ?? '') }, receipt.ability.actionId,
    targetFromSettlement(receipt.ability), null);
  if (record(receipt.item)) add({ kind: 'item', itemId: String(receipt.item.itemId ?? ''), actionId: String(receipt.item.actionId ?? '') },
    receipt.item.actionId, targetFromSettlement(receipt.item), null);
  for (const [key, info] of infos) {
    if (info.source.kind === 'partyCharacter' && !context.map.partyCharacterIds.includes(info.source.id as never)) {
      errors.push(`source ${key} is outside the Encounter roster`);
    } else if (info.source.kind === 'enemy') {
      const enemyId = info.source.id;
      if (!(context.encounter.enemies ?? []).some(enemy => enemy.id === enemyId)) errors.push(`source ${key} is outside the Encounter roster`);
    }
  }
  return infos;
}

function effectReplaySources(receipt: Row, infos: Map<string, SourceInfo>): SourceInfo[] {
  const result: SourceInfo[] = [];
  const addRow = (row: unknown) => {
    if (!record(row)) return;
    const source = settlementSource(row);
    const info = source ? infos.get(sourceKeyFor(source)) : undefined;
    if (info) result.push(info);
  };
  for (const row of Array.isArray(receipt.settlements) ? receipt.settlements : []) addRow(row);
  addRow(receipt.ability);
  addRow(receipt.item);
  for (const row of Array.isArray(receipt.enemyActions) ? receipt.enemyActions : []) addRow(row);
  return result;
}

function receiptLocalState(value: unknown, encounter: GameplayEncounterDef): { counters: Record<string, { value: number; min: number; max: number }>; flags: Record<string, boolean> } | null {
  if (!record(value) || !record(value.counters) || !record(value.flags)) return null;
  const counters: Record<string, { value: number; min: number; max: number }> = {};
  const flags: Record<string, boolean> = {};
  for (const definition of encounter.locals?.counters ?? []) {
    const row = value.counters[definition.id];
    if (!record(row) || !safeInt(row.value) || row.min !== definition.min || row.max !== definition.max
      || row.value < definition.min || row.value > definition.max) return null;
    counters[definition.id] = { value: row.value, min: definition.min, max: definition.max };
  }
  for (const definition of encounter.locals?.flags ?? []) {
    if (typeof value.flags[definition.id] !== 'boolean') return null;
    flags[definition.id] = value.flags[definition.id];
  }
  return { counters, flags };
}

/** Replay all source plans when a receipt contains E2 syntax, including the stable TargetSet and Value results. */
function validateE2PlanReplay(receipt: Row, trace: Row[], infos: Map<string, SourceInfo>, context: MapEffectReceiptContext, errors: string[]): void {
  const hasE2 = [...infos.values()].some(info => [...rulesFor(info.action).values()].some(rule => isE2Instruction(rule.instruction)));
  const hasStatusApply = [...infos.values()].some(info => [...rulesFor(info.action).values()].some(rule => rule.instruction?.op === 'statusApply'));
  if (!hasE2 && !hasStatusApply) return;

  const finalHp: Record<string, number> = {};
  let statusPostProgramHp: Readonly<Record<string, { current: number; cap: number }>> | null = null;
  let statusPostProgramStatuses: readonly MapEncounterStatusInstance[] | null = null;
  const snapshot = context.currentEncounter;
  // A closed Encounter has no trustworthy live Enemy HP checkpoint; its latest receipt is validated
  // structurally and against declared caps/projections below, but cannot be fully re-evaluated.
  if (!snapshot) return;
  for (const row of snapshot.partyHp ?? []) if (id(row.characterId) && safeInt(row.currentHp)) finalHp[`partyCharacter:${row.characterId}`] = row.currentHp;
  for (const row of snapshot.enemies ?? []) if (id(row.enemyId) && safeInt(row.currentHp)) finalHp[`enemy:${row.enemyId}`] = row.currentHp;

  let plannedStatuses: readonly MapEncounterStatusInstance[] = [];
  if (hasStatusApply) {
    if (receipt.statusReceiptVersion !== 1 || !Array.isArray(receipt.plannedStatuses) || !Array.isArray(receipt.statusTrace)) {
      errors.push('Status program receipt is missing its versioned Status fields'); return;
    }
    const receiptHp = Object.fromEntries(Object.entries(finalHp).map(([key, current]) => {
      const separator = key.indexOf(':');
      const kind = key.slice(0, separator); const actorId = key.slice(separator + 1);
      const cap = kind === 'partyCharacter' ? context.map.initialPartyHp.find(row => row.characterId === actorId)?.maxHp
        : context.encounter.enemies?.find(enemy => enemy.id === actorId)?.maxHp;
      return [key, { current, cap: safeInt(cap) ? cap : 1 }];
    }));
    const validatedTick = validateMapEncounterStatusTrace({
      statusReceiptVersion: receipt.statusReceiptVersion,
      statusTrace: receipt.statusTrace,
      round: Number(receipt.round),
      definitions: context.map.statuses ?? [],
      plannedStatuses: receipt.plannedStatuses as MapEncounterStatusInstance[],
      receiptHp,
      partyOrder: [...context.map.partyCharacterIds].map(String),
      enemyOrder: (context.encounter.enemies ?? []).map(enemy => enemy.id),
      tickSkipped: false,
    });
    const reversedTick = reverseMapEncounterStatusTrace(
      receipt.plannedStatuses as MapEncounterStatusInstance[], receiptHp, receipt.statusTrace, Number(receipt.round));
    if (!validatedTick || !reversedTick) { errors.push('Status round-end trace does not replay against the active Encounter checkpoint'); return; }
    plannedStatuses = reverseStatusApplyTrace(reversedTick.statuses, trace, context, errors);
    if (plannedStatuses.length > 256) { errors.push('Status program replay exceeds the active instance limit'); return; }
    statusPostProgramHp = reversedTick.hp;
    statusPostProgramStatuses = reversedTick.statuses;
    for (const [key, state] of Object.entries(reversedTick.hp)) finalHp[key] = state.current;
  }

  const currentHp = { ...finalHp };
  if (snapshot) {
    for (let index = trace.length - 1; index >= 0; index -= 1) {
      const event = trace[index]!;
      if (!['hpChange', 'damage', 'heal'].includes(String(event.op))) continue;
      if (!record(event.identity) || !['partyCharacter', 'enemy'].includes(String(event.identity.kind))
        || !id(event.identity.id) || !safeInt(event.before) || !safeInt(event.after)) {
        errors.push('E2 receipt cannot reconstruct an HP event'); return;
      }
      const key = identityKey(event.identity);
      if (!Object.prototype.hasOwnProperty.call(currentHp, key) || currentHp[key] !== event.after) {
        errors.push(`E2 receipt HP reverse chain disagrees at ${event.path}`); return;
      }
      currentHp[key] = event.before;
    }
  }

  let locals: { counters: Record<string, { value: number; min: number; max: number }>; flags: Record<string, boolean> } | null;
  if (snapshot?.locals !== undefined) locals = receiptLocalState(snapshot.locals, context.encounter);
  else if (!snapshot && receipt.round === 1) {
    const initial = initialLocals(context.encounter, 1);
    locals = {
      counters: Object.fromEntries([...initial.counters.entries()].flatMap(([key, state]) => state.value === undefined ? [] : [[key, { value: state.value, min: state.min, max: state.max }]])),
      flags: Object.fromEntries([...initial.flags.entries()].flatMap(([key, value]) => value === undefined ? [] : [[key, value]])),
    };
  } else if (receipt.plannedLocals !== undefined) locals = receiptLocalState(receipt.plannedLocals, context.encounter);
  else locals = null;
  if (!locals) { errors.push('E2 receipt replay cannot read the active checkpoint Counter/Flag state'); return; }
  if (snapshot) {
    for (let index = trace.length - 1; index >= 0; index -= 1) {
      const event = trace[index]!;
      if (event.op === 'counterAdd') {
        const current = locals.counters[String(event.counterId)];
        if (!current || !safeInt(event.before) || !safeInt(event.after) || current.value !== event.after) {
          errors.push(`E2 receipt Counter reverse chain disagrees at ${event.path}`); return;
        }
        locals.counters[String(event.counterId)] = { ...current, value: event.before };
      } else if (event.op === 'flagSet') {
        const current = locals.flags[String(event.flagId)];
        if (typeof current !== 'boolean' || typeof event.before !== 'boolean' || typeof event.after !== 'boolean' || current !== event.after) {
          errors.push(`E2 receipt Flag reverse chain disagrees at ${event.path}`); return;
        }
        locals.flags[String(event.flagId)] = event.before;
      }
    }
  }

  const hp = Object.fromEntries(Object.entries(currentHp).map(([key, value]) => {
    const separator = key.indexOf(':');
    const kind = key.slice(0, separator);
    const idValue = key.slice(separator + 1);
    const cap = kind === 'partyCharacter' ? context.map.initialPartyHp.find(row => row.characterId === idValue)?.maxHp
      : context.encounter.enemies?.find(row => row.id === idValue)?.maxHp;
    if (!safeInt(cap) || cap <= 0 || value < 0 || value > cap) errors.push(`E2 receipt replay has invalid starting HP for ${key}`);
    return [key, { current: value, cap: safeInt(cap) ? cap : 1 }];
  }));
  const rosterOrder = { party: [...context.map.partyCharacterIds], enemy: (context.encounter.enemies ?? []).map(enemy => enemy.id) };
  const mutableLocals = () => ({
    counters: Object.fromEntries(Object.entries(locals!.counters).map(([key, value]) => [key, { ...value }])),
    flags: { ...locals!.flags },
  });
  for (const info of effectReplaySources(receipt, infos)) {
    if (info.skipped || !info.action.effectProgram) continue;
    const source = info.source;
    const sourceActor = source.kind === 'partyCharacter' || source.kind === 'enemy' ? { kind: source.kind, id: source.id } : null;
    const primary = info.target && ['partyCharacter', 'enemy'].includes(String(info.target.kind))
      ? { kind: info.target.kind, id: String(info.target.id) } : null;
    const sourceKey = sourceKeyFor(source);
    const effects = normalizeProgramAction(info.action);
    if (!effects) continue;
    let plan: ReturnType<typeof planMapEffectSource>;
    try {
      plan = planMapEffectSource({
        input: {
          sourceKey, actionId: info.action.id, source: sourceActor as { kind: 'partyCharacter' | 'enemy'; id: string } | null,
          primary: primary as { kind: 'partyCharacter' | 'enemy'; id: string } | null,
          sourceTeam: { kind: 'team', side: source.kind === 'enemy' ? 'enemy' : 'party' },
          preparedPartyTagSources: preparedPartyTagSourcesFromReceipt(receipt, context),
          hp, locals: mutableLocals(), round: receipt.round, targetOrder: rosterOrder,
          ...(hasStatusApply ? {
            sourceIdentity: source,
            statusDefinitions: context.map.statuses ?? [],
            statuses: plannedStatuses,
          } : {}),
        },
        effects,
        visit: () => undefined,
      });
    } catch (error) {
      errors.push(`E2 receipt replay failed for ${info.action.id}: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    const expected = plan.trace.filter(entry => entry.op !== 'resourceChange');
    const actual = trace.filter(entry => entry.sourceKey === sourceKey && entry.actionId === info.action.id
      && entry.op !== 'discountSCost' && entry.op !== 'resourceSettlement' && entry.op !== 'resourceChange')
      .map(entry => {
        const { mode: _mode, ...withoutMode } = entry;
        if (entry.op === 'statusApply') return withoutMode;
        const { source: _source, ...withoutSource } = withoutMode;
        return withoutSource;
      });
    if (!same(actual, expected)) errors.push(`E2 receipt trace for ${info.action.id} does not match a replayed source plan`);
    if (hasStatusApply) plannedStatuses = plan.plannedStatuses;
    Object.assign(hp, plan.hp);
    locals = {
      counters: Object.fromEntries(Object.entries(plan.locals.counters).map(([key, value]) => [key, { ...value }])),
      flags: { ...plan.locals.flags },
    };
  }
  if (snapshot) {
    if (statusPostProgramHp) {
      if (!same(plannedStatuses, statusPostProgramStatuses)) {
        errors.push('Status receipt replay final Status list disagrees with the round-end pre-state');
      }
      for (const [key, state] of Object.entries(hp)) if (statusPostProgramHp[key]?.current !== state.current) {
        errors.push(`E2 receipt replay pre-tick HP differs for ${key}`);
      }
    } else {
      const finalActual = Object.fromEntries((snapshot.partyHp ?? []).map(row => [`partyCharacter:${row.characterId}`, row.currentHp]));
      for (const row of snapshot.enemies ?? []) finalActual[`enemy:${row.enemyId}`] = row.currentHp;
      for (const [key, state] of Object.entries(hp)) if (finalActual[key] !== state.current) errors.push(`E2 receipt replay final HP differs for ${key}`);
    }
  }
  const finalDeclared = receiptLocalState(receipt.plannedLocals, context.encounter);
  if (finalDeclared && !same(locals, finalDeclared)) errors.push('E2 receipt replay final Counter/Flag state disagrees with plannedLocals');
}

function sourceIsLegal(source: MapEffectProgramSourceIdentity, action: GameplayMapActionDef, settlement: Row,
  context: MapEffectReceiptContext, errors: string[]): boolean {
  let legal = false;
  if (source.kind === 'partyCharacter') {
    legal = action.eligibleCharacterIds.includes(source.id as never)
      && candidateActionIdsForOwner(context, 'partyCharacter', source.id).has(action.id)
      && ((settlement.playerCostSpent === 1) === (settlement.overrideKind === 'playerCommand'))
      && (settlement.overrideKind !== 'swap' || settlement.playerCostSpent === 0);
  } else if (source.kind === 'enemy') {
    legal = candidateActionIdsForOwner(context, 'enemy', source.id).has(action.id);
  } else if (source.kind === 'ability') {
    legal = (context.encounter.abilityActionIds ?? []).includes(action.id)
      && action.eligibleCharacterIds.length === 0
      && (action.target.kind === 'partyCharacter' || action.target.kind === 'enemy')
      && (action.costs?.length ?? 0) === 0 && (action.effectProgram?.prepare?.length ?? 0) === 0;
  } else {
    legal = (context.encounter.itemActions ?? []).some(row => row.itemId === source.itemId && row.actionId === action.id)
      && action.eligibleCharacterIds.length === 0
      && (action.target.kind === 'partyCharacter' || action.target.kind === 'enemy')
      && (action.costs?.length ?? 0) === 0 && (action.effectProgram?.prepare?.length ?? 0) === 0;
  }
  if (legal && !targetIsLegal(source, action, settlement, context)) legal = false;
  if (!legal) errors.push(`source ${sourceKeyFor(source)} is not admitted by the current Encounter`);
  return legal;
}

function targetFromSettlement(value: Row): Row | null {
  if (id(value.targetCharacterId)) return { kind: 'partyCharacter', id: value.targetCharacterId };
  if (id(value.targetEnemyId)) return { kind: 'enemy', id: value.targetEnemyId };
  if (record(value.target)) {
    if (value.target.kind === 'partyCharacter' && id(value.target.characterId)) return { kind: 'partyCharacter', id: value.target.characterId };
    if (value.target.kind === 'enemy' && id(value.target.enemyId)) return { kind: 'enemy', id: value.target.enemyId };
  }
  return null;
}

function expectedSourceIdentity(value: unknown, info: SourceInfo): boolean {
  return record(value) && same(value, info.source);
}

function evaluateLeaf(read: Row): boolean | null {
  if (read.op === 'hpAtLeast' || read.op === 'hpAtMost') {
    if (!safeInt(read.current) || !safeInt(read.value)) return null;
    return read.op === 'hpAtLeast' ? read.current >= read.value : read.current <= read.value;
  }
  if (read.op === 'hpRatioAtLeast' || read.op === 'hpRatioAtMost') {
    if (![read.current, read.cap, read.numerator, read.denominator].every(safeInt) || (read.cap as number) <= 0 || (read.denominator as number) <= 0) return null;
    const left = BigInt(read.current as number) * BigInt(read.denominator as number);
    const right = BigInt(read.cap as number) * BigInt(read.numerator as number);
    return read.op === 'hpRatioAtLeast' ? left >= right : left <= right;
  }
  if (read.op === 'counter') {
    if (!safeInt(read.current) || !safeInt(read.value)) return null;
    if (read.comparison === 'eq') return read.current === read.value;
    if (read.comparison === 'lt') return read.current < read.value;
    if (read.comparison === 'lte') return read.current <= read.value;
    if (read.comparison === 'gt') return read.current > read.value;
    if (read.comparison === 'gte') return read.current >= read.value;
    return null;
  }
  if (read.op === 'preparedTagCount') {
    if (!safeInt(read.count) || read.count < 0 || !safeInt(read.value)) return null;
    if (read.comparison === 'eq') return read.count === read.value;
    if (read.comparison === 'lt') return read.count < read.value;
    if (read.comparison === 'lte') return read.count <= read.value;
    if (read.comparison === 'gt') return read.count > read.value;
    if (read.comparison === 'gte') return read.count >= read.value;
    return null;
  }
  if (read.op === 'flag') return typeof read.current === 'boolean' && typeof read.value === 'boolean' ? read.current === read.value : null;
  return null;
}

function validateGuard(condition: NormalizedGameplayMapEffectCondition, reads: readonly unknown[], position: { value: number }, errors: string[], paths: string[], preparedTagCount: PreparedTagCountLookup): boolean | null {
  paths.push(condition.originPath);
  const next = (): Row | null => {
    const raw = reads[position.value++];
    if (!record(raw)) { errors.push('guard reads are missing or malformed'); return null; }
    return raw;
  };
  if (condition.kind === 'all' || condition.kind === 'any') {
    const childResults: boolean[] = [];
    for (const child of condition.conditions) {
      if (condition.kind === 'all' && childResults.includes(false) || condition.kind === 'any' && childResults.includes(true)) break;
      const result = validateGuard(child, reads, position, errors, paths, preparedTagCount);
      if (result === null) return null;
      childResults.push(result);
    }
    const actual = condition.kind === 'all' ? childResults.every(Boolean) : childResults.some(Boolean);
    const node = next();
    if (!node || node.path !== condition.originPath || node.op !== condition.kind || node.result !== actual) errors.push(`guard ${condition.originPath} has an invalid ${condition.kind} summary`);
    return actual;
  }
  if (condition.kind === 'not') {
    const nested = validateGuard(condition.condition, reads, position, errors, paths, preparedTagCount);
    if (nested === null) return null;
    const actual = !nested;
    const node = next();
    if (!node || node.path !== condition.originPath || node.op !== 'not' || node.result !== actual) errors.push(`guard ${condition.originPath} has an invalid not summary`);
    return actual;
  }
  const leaf = next();
  if (!leaf) return null;
  const expectedPreparedCount = condition.kind === 'preparedTagCount'
    ? preparedTagCount(condition.side, condition.tag) : undefined;
  const actual = condition.kind === 'preparedTagCount'
    ? comparePreparedTagCount(expectedPreparedCount!, condition.comparison, condition.value)
    : evaluateLeaf(leaf);
  if (leaf.path !== condition.originPath || leaf.op !== condition.kind || actual === null || leaf.result !== actual) {
    errors.push(`guard ${condition.originPath} has an invalid read or result`);
    return null;
  }
  if ('target' in condition && (!validIdentity(leaf.identity)
    || (leaf.identity.kind !== 'partyCharacter' && leaf.identity.kind !== 'enemy'))) errors.push(`guard ${condition.originPath} has an invalid Actor`);
  if ((condition.kind === 'counter' || condition.kind === 'flag')
    && (!validIdentity(leaf.identity) || leaf.identity.kind !== 'encounterLocal')) errors.push(`guard ${condition.originPath} has an invalid local identity`);
  if (condition.kind === 'counter' && (leaf.counterId !== condition.counterId || leaf.comparison !== condition.comparison || leaf.value !== condition.value)) errors.push(`guard ${condition.originPath} disagrees with its Counter declaration`);
  if (condition.kind === 'flag' && (leaf.flagId !== condition.flagId || leaf.value !== condition.value)) errors.push(`guard ${condition.originPath} disagrees with its Flag declaration`);
  if (condition.kind === 'preparedTagCount' && (leaf.side !== condition.side || leaf.tag !== condition.tag
    || leaf.count !== expectedPreparedCount || leaf.comparison !== condition.comparison || leaf.value !== condition.value)) {
    errors.push(`guard ${condition.originPath} disagrees with the frozen Prepared Tag snapshot`);
  }
  if (condition.kind === 'hpAtLeast' || condition.kind === 'hpAtMost') if (leaf.value !== condition.value) errors.push(`guard ${condition.originPath} threshold mismatch`);
  if (condition.kind === 'hpRatioAtLeast' || condition.kind === 'hpRatioAtMost') if (leaf.numerator !== condition.numerator || leaf.denominator !== condition.denominator) errors.push(`guard ${condition.originPath} ratio mismatch`);
  return actual;
}

function comparePreparedTagCount(count: number, comparison: string, value: number): boolean | null {
  if (!safeInt(count) || count < 0 || !safeInt(value) || value < 0) return null;
  if (comparison === 'eq') return count === value;
  if (comparison === 'lt') return count < value;
  if (comparison === 'lte') return count <= value;
  if (comparison === 'gt') return count > value;
  if (comparison === 'gte') return count >= value;
  return null;
}

function compareKnownRead(read: Row, values: Map<string, number | boolean>, errors: string[]) {
  const key = record(read.identity) && (read.identity.kind === 'partyCharacter' || read.identity.kind === 'enemy')
    ? `${read.identity.kind}:${read.identity.id}`
    : read.op === 'counter' ? `counter:${String(read.counterId)}` : read.op === 'flag' ? `flag:${String(read.flagId)}` : null;
  if (!key || !values.has(key)) return;
  const value = values.get(key)!;
  const observed = read.op === 'flag' || read.op === 'counter' ? read.current : read.current;
  if (observed !== value) errors.push(`guard read ${key} breaks the traced value chain`);
}

function canonicalVisits(infos: Map<string, SourceInfo>, sourceOrder: readonly string[], trace: Row[], receipt: Row, context: MapEffectReceiptContext, errors: string[]): Row[] {
  const preparedTagCount = receiptPreparedTagCountLookup(receipt, context);
  const partyPrepare: Row[] = [];
  const partyResolve: Row[] = [];
  const actorlessResolve: Row[] = [];
  const enemyFlow: Row[] = [];
  const walkStatements = (list: readonly NormalizedGameplayMapEffectInstruction[], info: SourceInfo, sourceKey: string,
    readsByPath: Map<string, Row>, resolve: Row[]): void => {
    for (const statement of list) {
      resolve.push({ sourceKey, actionId: info.action.id, path: statement.originPath, kind: 'statement' });
      if (statement.op !== 'when') continue;
      const event = readsByPath.get(statement.originPath);
      const reads = event && Array.isArray(event.reads) ? event.reads : [];
      const conditions: string[] = [];
      const position = { value: 0 };
      const result = validateGuard(statement.condition, reads, position, errors, conditions, preparedTagCount);
      if (position.value !== reads.length) errors.push(`guard ${statement.originPath} contains unreachable reads`);
      if (!event || result === null || event.result !== result) errors.push(`cannot rebuild selected branch at ${statement.originPath}`);
      for (const path of conditions) resolve.push({ sourceKey, actionId: info.action.id, path, kind: 'condition' });
      if (result === true) walkStatements(statement.then, info, sourceKey, readsByPath, resolve);
      else if (result === false) walkStatements(statement.else ?? [], info, sourceKey, readsByPath, resolve);
    }
  };
  const readsBySourcePath = new Map<string, Row>();
  for (const event of trace) if (event.op === 'when') readsBySourcePath.set(`${event.sourceKey}|${event.actionId}|${event.path}`, event);
  for (const sourceKey of sourceOrder) {
    const info = infos.get(sourceKey);
    if (!info || info.skipped || !info.action.effectProgram) continue;
    const normalized = normalizeProgramAction(info.action);
    if (!normalized) continue;
    const isParty = info.source.kind === 'partyCharacter';
    const isEnemy = info.source.kind === 'enemy';
    const localResolve = isParty ? partyResolve : isEnemy ? enemyFlow : actorlessResolve;
    const localPrepare = isEnemy ? enemyFlow : partyPrepare;
    for (const leaf of normalized.prepare) localPrepare.push({
      sourceKey, actionId: info.action.id, path: leaf.originPath, kind: 'prepare',
    });
    if (normalized.prepare.length > 0 && !info.targetCard) errors.push(`program prepare source ${info.action.id} has no selected CardRef`);
    const guards = new Map<string, Row>();
    for (const [key, event] of readsBySourcePath) if (key.startsWith(`${sourceKey}|${info.action.id}|`)) guards.set(event.path, event);
    walkStatements(normalized.resolve, info, sourceKey, guards, localResolve);
  }
  return [...partyPrepare, ...partyResolve, ...actorlessResolve, ...enemyFlow].map(visit => ({ ...visit, mode: 'program', source: infos.get(String(visit.sourceKey))?.source,
    actionId: infos.get(String(visit.sourceKey))?.action.id }));
}

function initialLocals(encounter: GameplayEncounterDef, round: number): { counters: Map<string, { value?: number; min: number; max: number }>; flags: Map<string, boolean | undefined> } {
  return {
    counters: new Map((encounter.locals?.counters ?? []).map(counter => [counter.id, {
      ...(round === 1 ? { value: counter.initial } : {}), min: counter.min, max: counter.max,
    }])),
    flags: new Map((encounter.locals?.flags ?? []).map(flag => [flag.id, round === 1 ? flag.initial : undefined])),
  };
}

function validateStateTrace(trace: Row[], visits: Row[], infos: Map<string, SourceInfo>, receipt: Row, context: MapEffectReceiptContext,
  e2Refs: ReadonlySet<string>, errors: string[]) {
  const preparedTagCount = receiptPreparedTagCountLookup(receipt, context);
  const rules = new Map<string, Rule>();
  for (const info of infos.values()) for (const [path, rule] of rulesFor(info.action)) rules.set(`${info.action.id}|${path}`, rule);
  const visitsByRef = new Map<string, Row>();
  for (const visit of visits) visitsByRef.set(`${visit.sourceKey}|${visit.actionId}|${visit.path}`, visit);
  const stateEntries = trace.filter(entry => entry.op !== 'resourceSettlement' && entry.op !== 'discountSCost'
    && !e2Refs.has(`${String(entry.sourceKey)}|${String(entry.actionId)}|${String(entry.path)}`));
  const discountEntries = trace.filter(entry => entry.op === 'discountSCost');
  const prepareVisits = visits.filter(visit => visit.kind === 'prepare');
  if (discountEntries.length !== prepareVisits.length) errors.push('discountSCost trace count disagrees with prepare visits');
  for (const visit of prepareVisits) {
    const info = infos.get(String(visit.sourceKey));
    const rule = rules.get(`${String(visit.actionId)}|${String(visit.path)}`);
    const event = discountEntries.find(entry => entry.sourceKey === visit.sourceKey && entry.actionId === visit.actionId && entry.path === visit.path);
    if (!info || !rule || !event || event.amount !== rule.prepareAmount || !expectedSourceIdentity(event.source, info)
      || !record(event.targetCard) || !id(event.targetCard.id) || !record(event.targetCard.scope)
      || !same(event.targetCard.scope, receipt.effectScope)) errors.push(`prepare trace ${visit.path} is missing or disagrees with its declared discount`);
    if (info && record(event?.targetCard) && info.targetCard && !same(event.targetCard, info.targetCard)) errors.push(`prepare trace ${visit.path} changed its selected CardRef`);
    if (record(event?.targetCard)) {
      const card = parseCardInfo(String(event.targetCard.id));
      if (!card || !info || !cardIsAllowedForSource(card, info.source, info.action, context)) errors.push(`prepare trace ${visit.path} targets an unknown CardRef candidate`);
      const receiver = card ? cardReceiver(receipt, card) : null;
      if (!same(event.receiver, receiver)) errors.push(`prepare trace ${visit.path} has an invalid receiver`);
    }
  }
  let cursor = 0;
  const local = initialLocals(context.encounter, receipt.round);
  const known = new Map<string, number | boolean>();
  if (receipt.round === 1) {
    for (const [key, state] of local.counters) if (state.value !== undefined) known.set(`counter:${key}`, state.value);
    for (const [key, value] of local.flags) if (value !== undefined) known.set(`flag:${key}`, value);
  }
  const expectedConditionVisits: string[] = [];
  for (const visit of visits) {
    if (!exact(visit, ['sourceKey', 'source', 'actionId', 'path', 'kind', 'mode'])) errors.push('program visit has unknown or missing fields');
    if (visit.kind === 'prepare') continue;
    if (e2Refs.has(`${String(visit.sourceKey)}|${String(visit.actionId)}|${String(visit.path)}`)) continue;
    const info = infos.get(String(visit.sourceKey));
    const rule = rules.get(`${String(visit.actionId)}|${String(visit.path)}`);
    if (!info || !rule || !rule.instruction) continue;
    const op = rule.op;
    if (op === 'resourceChange') continue;
    if (op === 'when') {
      const entry = stateEntries[cursor++];
      if (!entry || entry.op !== 'when' || entry.sourceKey !== visit.sourceKey || entry.actionId !== visit.actionId || entry.path !== visit.path
        || !expectedSourceIdentity(entry.source, info)) { errors.push(`trace is missing the when at ${visit.path}`); continue; }
      const reads = Array.isArray(entry.reads) ? entry.reads : [];
      const position = { value: 0 };
      const conditionPaths: string[] = [];
      const evaluated = rule.condition ? validateGuard(rule.condition, reads, position, errors, conditionPaths, preparedTagCount) : null;
      expectedConditionVisits.push(...conditionPaths.map(path => `${visit.sourceKey}|${visit.actionId}|${path}`));
      if (position.value !== reads.length) errors.push(`guard ${visit.path} contains unreachable reads`);
      if (evaluated === null || entry.result !== evaluated) errors.push(`guard ${visit.path} selected the wrong branch`);
      for (const raw of reads) if (record(raw)) {
        compareKnownRead(raw, known, errors);
        const conditionRule = rules.get(`${String(visit.actionId)}|${String(raw.path)}`)?.condition;
        if (conditionRule && conditionRule.kind !== 'all' && conditionRule.kind !== 'any' && conditionRule.kind !== 'not') {
          if ('target' in conditionRule) {
            const expected = (conditionRule.target === 'source' ? info.source : info.target) as Row | null;
            if (!expected || !same(raw.identity, expected)) errors.push(`guard read ${raw.path} has the wrong selected Actor`);
            const cap = expected?.kind === 'partyCharacter' ? context.map.initialPartyHp.find(row => row.characterId === expected.id)?.maxHp
              : expected?.kind === 'enemy' ? context.encounter.enemies?.find(enemy => enemy.id === expected.id)?.maxHp : undefined;
            if ((raw.op === 'hpAtLeast' || raw.op === 'hpAtMost')
              && (!safeInt(raw.current) || raw.current < 0 || !safeInt(cap) || raw.current > cap)) errors.push(`guard read ${raw.path} has an invalid HP value`);
            if ((raw.op === 'hpRatioAtLeast' || raw.op === 'hpRatioAtMost')
              && (!safeInt(raw.current) || raw.current < 0 || !safeInt(cap) || raw.current > cap || raw.cap !== cap)) errors.push(`guard read ${raw.path} has an invalid HP ratio base`);
          } else if (conditionRule.kind === 'counter') {
            const declaration = context.encounter.locals?.counters?.find(counter => counter.id === conditionRule.counterId);
            if (!declaration || raw.identity?.kind !== 'encounterLocal' || raw.counterId !== conditionRule.counterId
              || !safeInt(raw.current) || raw.current < declaration.min || raw.current > declaration.max) errors.push(`guard read ${raw.path} has an invalid Counter`);
          } else if (conditionRule.kind === 'flag') {
            if (!(context.encounter.locals?.flags ?? []).some(flag => flag.id === conditionRule.flagId)
              || raw.identity?.kind !== 'encounterLocal' || raw.flagId !== conditionRule.flagId || typeof raw.current !== 'boolean') errors.push(`guard read ${raw.path} has an invalid Flag`);
          }
        }
      }
      continue;
    }
    const entry = stateEntries[cursor++];
    if (!entry || entry.op !== op || entry.sourceKey !== visit.sourceKey || entry.actionId !== visit.actionId || entry.path !== visit.path
      || !expectedSourceIdentity(entry.source, info)) { errors.push(`trace is missing ${op} at ${visit.path}`); continue; }
    const instruction = rule.instruction as unknown as Row;
    if (op === 'hpChange') {
      const target = (instruction.target === 'source' ? info.source : info.target) as Row | null;
      if (!target || !record(entry.identity) || entry.identity.kind !== target.kind || entry.identity.id !== target.id) errors.push(`hpChange ${visit.path} has an invalid target`);
      if (![entry.before, entry.after, entry.delta].every(safeInt) || !safeInt(instruction.delta)) { errors.push(`hpChange ${visit.path} has unsafe values`); continue; }
      const cap = target?.kind === 'partyCharacter' ? context.map.initialPartyHp.find(row => row.characterId === target.id)?.maxHp
        : target?.kind === 'enemy' ? context.encounter.enemies?.find(row => row.id === target.id)?.maxHp : undefined;
      if (!safeInt(cap) || entry.before < 0 || entry.before > cap || entry.after < 0 || entry.after > cap) errors.push(`hpChange ${visit.path} exceeds its declared cap`);
      const calc = entry.before === 0 ? 0 : Number(BigInt(entry.before) + BigInt(instruction.delta) <= 0n ? 0n
        : BigInt(entry.before) + BigInt(instruction.delta) >= BigInt(cap ?? 0) ? BigInt(cap ?? 0) : BigInt(entry.before) + BigInt(instruction.delta));
      if (entry.after !== calc || entry.delta !== entry.after - entry.before) errors.push(`hpChange ${visit.path} has an invalid actual delta`);
      void target;
    } else if (op === 'damage' || op === 'heal') {
      const target = info.target as Row | null;
      const amount = instruction.amount;
      if (!target || (target.kind !== 'partyCharacter' && target.kind !== 'enemy')
        || !validIdentity(entry.identity) || entry.identity.kind !== target.kind || entry.identity.id !== target.id) {
        errors.push(`${op} ${visit.path} has an invalid primary identity`);
      }
      if (!safeInt(amount) || amount <= 0 || entry.amount !== amount
        || ![entry.before, entry.after, entry.delta].every(safeInt)) {
        errors.push(`${op} ${visit.path} has an invalid amount or unsafe values`);
        continue;
      }
      const cap = target?.kind === 'partyCharacter'
        ? context.map.initialPartyHp.find(row => row.characterId === target.id)?.maxHp
        : target?.kind === 'enemy' ? context.encounter.enemies?.find(enemy => enemy.id === target.id)?.maxHp : undefined;
      if (!safeInt(cap) || cap <= 0 || entry.before < 0 || entry.before > cap || entry.after < 0 || entry.after > cap) {
        errors.push(`${op} ${visit.path} exceeds its declared HP range`);
        continue;
      }
      let expected = 0;
      if (entry.before > 0) {
        const requested = BigInt(amount);
        const current = BigInt(entry.before);
        const maximum = BigInt(cap);
        const proposed = op === 'damage' ? current - requested : current + requested;
        expected = op === 'damage'
          ? Number(proposed <= 0n ? 0n : proposed)
          : Number(proposed >= maximum ? maximum : proposed);
      }
      if (entry.after !== expected || entry.delta !== entry.after - entry.before) {
        errors.push(`${op} ${visit.path} has an invalid clamped actual delta`);
      }
    } else if (op === 'counterAdd') {
      const declaration = context.encounter.locals?.counters?.find(counter => counter.id === instruction.counterId);
      if (!declaration || entry.counterId !== instruction.counterId || entry.identity?.kind !== 'encounterLocal'
        || ![entry.before, entry.after, entry.delta].every(safeInt)) { errors.push(`counterAdd ${visit.path} has an invalid declaration or values`); continue; }
      const mathematical = BigInt(entry.before) + BigInt(instruction.delta);
      if (mathematical > BigInt(Number.MAX_SAFE_INTEGER) || mathematical < BigInt(Number.MIN_SAFE_INTEGER)) errors.push(`counterAdd ${visit.path} overflows a safe integer`);
      const result = Math.max(declaration.min, Math.min(declaration.max, Number(mathematical)));
      if (entry.before < declaration.min || entry.before > declaration.max || entry.after !== result || entry.delta !== result - entry.before) errors.push(`counterAdd ${visit.path} has an invalid saturated delta`);
      const key = `counter:${instruction.counterId}`;
      if (known.has(key) && known.get(key) !== entry.before) errors.push(`counterAdd ${visit.path} breaks the Counter chain`);
      known.set(key, entry.after);
      local.counters.get(instruction.counterId)!.value = entry.after;
    } else if (op === 'flagSet') {
      if (!local.flags.has(instruction.flagId) || entry.flagId !== instruction.flagId || entry.identity?.kind !== 'encounterLocal'
        || typeof entry.before !== 'boolean' || entry.after !== instruction.value) { errors.push(`flagSet ${visit.path} has an invalid declaration or value`); continue; }
      const key = `flag:${instruction.flagId}`;
      if (known.has(key) && known.get(key) !== entry.before) errors.push(`flagSet ${visit.path} breaks the Flag chain`);
      known.set(key, entry.after);
      local.flags.set(instruction.flagId, entry.after);
    }
  }
  const actualConditionVisits = visits.filter(visit => visit.kind === 'condition')
    .map(visit => `${visit.sourceKey}|${visit.actionId}|${visit.path}`);
  if (!same(actualConditionVisits, expectedConditionVisits)) errors.push('condition visits disagree with the reached guard nodes or short-circuit path');
  if (cursor !== stateEntries.length) errors.push('effectTrace contains an event with no ordered program visit');
  return { known, local };
}

function settlementRows(receipt: Row): Row[] {
  const result: Row[] = [];
  if (Array.isArray(receipt.settlements)) for (const row of receipt.settlements) if (record(row)) result.push(row);
  if (record(receipt.ability)) result.push(receipt.ability);
  if (record(receipt.item)) result.push(receipt.item);
  if (Array.isArray(receipt.enemyActions)) for (const row of receipt.enemyActions) if (record(row)) result.push(row);
  return result;
}

function validateSettlementShapes(receipt: Row, errors: string[]) {
  const checkRows = (rows: unknown, kind: 'party' | 'enemy' | 'ability' | 'item') => {
    if (!Array.isArray(rows)) return;
    const fields = kind === 'party'
      ? ['characterId', 'actionId', 'targetCharacterId', 'targetEnemyId', 'targetCard', 'scostCost', 'skipReason', 'overrideKind', 'playerCostSpent', 'resourceChanges', 'hpChanges']
      : kind === 'enemy'
        ? ['enemyId', 'actionId', 'targetCharacterId', 'targetEnemyId', 'targetCard', 'scostCost', 'skipReason', 'resourceChanges', 'hpChanges']
        : kind === 'ability'
          ? ['actionId', 'target', 'playerCostSpent', 'resourceChanges', 'hpChanges']
          : ['itemId', 'actionId', 'target', 'consumedCount', 'resourceChanges', 'hpChanges'];
    const required = kind === 'party' ? ['characterId', 'actionId', 'targetCharacterId', 'overrideKind', 'playerCostSpent', 'resourceChanges']
      : kind === 'enemy' ? ['enemyId', 'actionId', 'resourceChanges']
        : kind === 'ability' ? ['actionId', 'target', 'playerCostSpent', 'resourceChanges']
          : ['itemId', 'actionId', 'target', 'consumedCount', 'resourceChanges'];
    for (const raw of rows) {
      if (!record(raw) || !knownFields(raw, required, fields.filter(field => !required.includes(field)))) {
        errors.push(`${kind} settlement has unknown or missing fields`); continue;
      }
      const expectedOwner = kind === 'party' ? raw.characterId : kind === 'enemy' ? raw.enemyId : undefined;
      if ((kind === 'party' || kind === 'enemy') && !id(expectedOwner)) errors.push(`${kind} settlement has an invalid owner identity`);
      if (raw.actionId !== null && !id(raw.actionId)) errors.push(`${kind} settlement has an invalid Action identity`);
      if (kind === 'party' && (!['playerCommand', 'swap', null].includes(raw.overrideKind) || ![0, 1].includes(raw.playerCostSpent))) {
        errors.push('Party settlement has an invalid override or PlayerCost value');
      }
      if (kind === 'ability' && raw.playerCostSpent !== 1) errors.push('Ability settlement must retain its PlayerCost');
      if (kind === 'item' && (!id(raw.itemId) || raw.consumedCount !== 1)) errors.push('Item settlement has an invalid Item identity or debit');
      if ((kind === 'ability' || kind === 'item') && (!record(raw.target)
        || (raw.target.kind === 'partyCharacter'
          ? !exact(raw.target, ['kind', 'characterId']) || !id(raw.target.characterId)
          : raw.target.kind === 'enemy' ? !exact(raw.target, ['kind', 'enemyId']) || !id(raw.target.enemyId) : true))) {
        errors.push(`${kind} settlement has an invalid target identity`);
      }
      if (raw.skipReason !== undefined && !['noLegalTarget', 'defeated', 'unaffordable', 'roundEnded'].includes(String(raw.skipReason))) {
        errors.push(`${kind} settlement has an unknown skip reason`);
      }
      if (Object.prototype.hasOwnProperty.call(raw, 'targetCard')) {
        if (!record(raw.targetCard) || !knownFields(raw.targetCard, ['kind', 'id', 'scope']) || raw.targetCard.kind !== 'card' || !id(raw.targetCard.id)
          || !record(raw.targetCard.scope) || !exact(raw.targetCard.scope, ['runId', 'mapId', 'nodeId', 'activityId', 'round'])) {
          errors.push(`${kind} targetCard has an invalid nested shape`);
        }
      }
      if (Object.prototype.hasOwnProperty.call(raw, 'scostCost')
        && (!record(raw.scostCost) || !exact(raw.scostCost, ['original', 'discount', 'paid'])
          || ![raw.scostCost.original, raw.scostCost.discount, raw.scostCost.paid].every(safeInt))) {
        errors.push(`${kind} sCost projection has an invalid shape`);
      }
      const changes = raw.resourceChanges;
      if (!Array.isArray(changes)) { errors.push(`${kind} resourceChanges must be an array`); continue; }
      for (const change of changes) {
        if (!record(change) || !knownFields(change, ['kind', 'scope', 'resourceId', 'delta'], ['characterId', 'enemyId', 'teamSide'])
          || !['cost', 'effect'].includes(String(change.kind)) || !['actor', 'team'].includes(String(change.scope))
          || !id(change.resourceId) || !safeInt(change.delta)) {
          errors.push(`${kind} resource change has unknown or missing fields`); continue;
        }
        const actorFields = Number(id(change.characterId)) + Number(id(change.enemyId));
        if ((change.scope === 'actor' && actorFields !== 1)
          || (change.scope === 'team' && (actorFields !== 0 || (change.teamSide !== undefined && change.teamSide !== 'enemy')))) {
          errors.push(`${kind} resource change has an invalid account identity`);
        }
      }
      if (Object.prototype.hasOwnProperty.call(raw, 'hpChanges')) {
        if (!Array.isArray(raw.hpChanges)) { errors.push(`${kind} hpChanges must be an array`); continue; }
        for (const change of raw.hpChanges) if (!record(change)
          || !knownFields(change, ['scope', 'delta'], ['characterId', 'enemyId'])
          || !['party', 'enemy'].includes(String(change.scope)) || !safeInt(change.delta)
          || (change.scope === 'party' ? !id(change.characterId) || change.enemyId !== undefined
            : !id(change.enemyId) || change.characterId !== undefined)) errors.push(`${kind} HP change has unknown or invalid fields`);
      }
    }
  };
  checkRows(receipt.settlements, 'party');
  checkRows(receipt.enemyActions, 'enemy');
  if (Object.prototype.hasOwnProperty.call(receipt, 'ability')) checkRows([receipt.ability], 'ability');
  if (Object.prototype.hasOwnProperty.call(receipt, 'item')) checkRows([receipt.item], 'item');
}
function settlementSource(row: Row): MapEffectProgramSourceIdentity | null {
  if (!id(row.actionId)) return null;
  if (id(row.itemId)) return { kind: 'item', itemId: row.itemId, actionId: row.actionId };
  if (id(row.characterId)) return { kind: 'partyCharacter', id: row.characterId };
  if (id(row.enemyId)) return { kind: 'enemy', id: row.enemyId };
  return row.playerCostSpent === 1 ? { kind: 'ability', actionId: row.actionId } : null;
}

function changeIdentity(change: Row): Row | null {
  if (change.scope === 'actor') return id(change.characterId) ? { kind: 'partyCharacter', id: change.characterId }
    : id(change.enemyId) ? { kind: 'enemy', id: change.enemyId } : null;
  return change.scope === 'team' ? { kind: 'team', side: change.teamSide === 'enemy' ? 'enemy' : 'party' } : null;
}

function balanceFromContext(context: MapEffectReceiptContext, identity: Row, resourceId: string): number | undefined {
  const balances = context.currentBalances;
  if (!balances) return undefined;
  const row = identity.kind === 'partyCharacter' ? balances.partyActor?.find(value => value.characterId === identity.id && value.resourceId === resourceId)
    : identity.kind === 'enemy' ? balances.enemyActor?.find(value => value.enemyId === identity.id && value.resourceId === resourceId)
      : identity.kind === 'team' && identity.side === 'enemy' ? balances.enemyTeam?.find(value => value.resourceId === resourceId)
        : balances.partyTeam?.find(value => value.resourceId === resourceId);
  return row && safeInt(row.value) && row.value >= 0 ? row.value : undefined;
}

function hasLiveSuccessor(receipt: Row, context: MapEffectReceiptContext): boolean {
  const current = context.currentEncounter;
  return !!current && current.nodeId === receipt.nodeId
    && (current.activityId ?? null) === (receipt.activityId ?? null)
    && current.round === Number(receipt.round) + 1;
}

function validateResourceProjection(receipt: Row, trace: Row[], infos: Map<string, SourceInfo>, context: MapEffectReceiptContext, errors: string[]) {
  const events = trace.filter(entry => entry.op === 'resourceSettlement');
  const sources = [
    ...(Array.isArray(receipt.settlements) ? receipt.settlements.filter(record) : []),
    ...(record(receipt.ability) ? [receipt.ability] : []),
    ...(record(receipt.item) ? [receipt.item] : []),
    ...(Array.isArray(receipt.enemyActions) ? receipt.enemyActions.filter(record) : []),
  ];
  const partyRows = sources.filter(row => !id(row.enemyId));
  const enemyRows = sources.filter(row => id(row.enemyId));
  const orderedChanges: { row: Row; source: MapEffectProgramSourceIdentity | null; action: GameplayMapActionDef | null; change: Row; event?: Row }[] = [];
  let eventPosition = 0;
  const verifyRow = (row: Row) => {
    const source = settlementSource(row);
    const info = source ? infos.get(sourceKeyFor(source)) : undefined;
    const action = info?.action ?? null;
    const changes = Array.isArray(row.resourceChanges) ? row.resourceChanges.filter(record) : [];
    if (row.skipReason || !action) {
      if (changes.length) errors.push('skipped or Wait source has resource settlements');
      return;
    }
    const sourceKind = source?.kind;
    const actor = sourceKind === 'partyCharacter' || sourceKind === 'enemy' ? source : null;
    const declaredCosts = new Map<string, number>();
    const declaredScost = (action.costs ?? []).filter(cost => cost.scope === 'actor' && cost.resourceId === 'sCost')
      .reduce((sum, cost) => sum + cost.amount, 0);
    let discount = safeInt(row.scostCost?.paid) ? row.scostCost.paid : declaredScost;
    for (const cost of action.costs ?? []) {
      const actualCost = cost.scope === 'actor' && cost.resourceId === 'sCost' ? Math.min(cost.amount, discount) : cost.amount;
      if (cost.scope === 'actor' && cost.resourceId === 'sCost') discount -= actualCost;
      const identity = cost.scope === 'team'
        ? { kind: 'team', side: sourceKind === 'enemy' ? 'enemy' : 'party' }
        : actor ? actor : null;
      if (!identity) { errors.push(`Action ${action.id} has a cost with no source Actor`); continue; }
      const key = `${JSON.stringify(identity)}|${cost.resourceId}`;
      declaredCosts.set(key, (declaredCosts.get(key) ?? 0) - actualCost);
    }
    const actualCosts = new Map<string, number>();
    for (const change of changes.filter(change => change.kind === 'cost')) {
      const identity = changeIdentity(change);
      if (!identity || !safeInt(change.delta) || change.delta > 0) errors.push(`Action ${action.id} has an invalid cost identity or delta`);
      if (identity) {
        const key = `${JSON.stringify(identity)}|${change.resourceId}`;
        actualCosts.set(key, (actualCosts.get(key) ?? 0) + change.delta);
      }
    }
    if (!same([...actualCosts].filter(([, delta]) => delta !== 0).sort(), [...declaredCosts].filter(([, delta]) => delta !== 0).sort())) {
      errors.push(`Action ${action.id} cost projection disagrees with its declaration and sCost discount`);
    }
    const effectChanges = changes.filter(change => change.kind === 'effect');
    const program = action.effectProgram !== undefined;
    const programEvents = program ? events.filter(event => event.sourceKey === sourceKeyFor(source!) && event.actionId === action.id) : [];
    const eventForChange = new Map<Row, Row>();
    if (programEvents.length !== effectChanges.length) errors.push(`resourceSettlement events for ${action.id} disagree with its actual effect projection`);
    for (let index = 0; index < effectChanges.length; index += 1) {
      const change = effectChanges[index];
      const event = programEvents[index];
      const instruction = event && rulesFor(action).get(String(event.path))?.instruction;
      if (!change || !instruction || instruction.op !== 'resourceChange') {
        errors.push(`resource effect for ${action.id} has no declared instruction`); continue;
      }
      const wanted = instruction.account === 'sourceTeam' ? { kind: 'team', side: sourceKind === 'enemy' ? 'enemy' : 'party' }
        : instruction.account === 'sourceActor' ? actor
          : targetFromSettlement(row);
      const actualIdentity = changeIdentity(change);
      if (instruction.resourceId !== change.resourceId || instruction.delta !== change.delta || !wanted || !same(actualIdentity, wanted)) {
        errors.push(`resource effect for ${action.id} disagrees with its declared account or value`);
      }
      if (eventPosition >= events.length || !event || events[eventPosition] !== event
        || event.sourceKey !== sourceKeyFor(source!) || event.actionId !== action.id || event.resourceId !== change.resourceId
        || event.intentDelta !== change.delta || event.account !== instruction.account || !same(event.identity, wanted)
        || !expectedSourceIdentity(event.source, info!)) errors.push(`resource event for ${action.id} is missing or out of E1 source order`);
      if (!event || !safeInt(event.before) || !safeInt(event.after) || !safeInt(event.delta)
        || event.after < 0 || event.delta !== event.after - event.before || event.delta !== change.delta) {
        errors.push(`resource event for ${action.id} has invalid balances or actual delta`);
      }
      const visit = Array.isArray(receipt.programVisits) ? receipt.programVisits.find((candidate: unknown) => record(candidate)
        && candidate.sourceKey === sourceKeyFor(source!) && candidate.actionId === action.id && candidate.path === event?.path && candidate.kind === 'statement') : null;
      if (!visit) errors.push(`resource event for ${action.id} has no visited resolve statement`);
      eventForChange.set(change, event);
      eventPosition += 1;
    }
    for (const change of changes) orderedChanges.push({ row, source, action, change,
      ...(eventForChange.has(change) ? { event: eventForChange.get(change)! } : {}) });
  };
  for (const row of partyRows) verifyRow(row);
  for (const row of enemyRows) verifyRow(row);
  if (events.length !== eventPosition) errors.push('resourceSettlement contains duplicate or unprojected events');

  // Party/Ability/Item costs are aggregated before any C3 effect; Enemy sources settle cost then effect in declaration order.
  const ordered: typeof orderedChanges = [];
  for (const row of partyRows) ordered.push(...orderedChanges.filter(item => item.row === row && item.change.kind === 'cost'));
  for (const row of partyRows) ordered.push(...orderedChanges.filter(item => item.row === row && item.change.kind === 'effect'));
  for (const row of enemyRows) ordered.push(...orderedChanges.filter(item => item.row === row));
  const accounts = new Map<string, { identity: Row; resourceId: string; changes: typeof ordered }>();
  for (const item of ordered) {
    const identity = changeIdentity(item.change);
    if (!identity) continue;
    const key = `${JSON.stringify(identity)}|${item.change.resourceId}`;
    const account = accounts.get(key) ?? { identity, resourceId: item.change.resourceId, changes: [] as typeof ordered };
    account.changes.push(item); accounts.set(key, account);
  }
  for (const account of accounts.values()) {
    const liveSuccessor = hasLiveSuccessor(receipt, context);
    const finalBalance = liveSuccessor ? balanceFromContext(context, account.identity, account.resourceId) : undefined;
    if (liveSuccessor && finalBalance === undefined) {
      errors.push(`trusted live balance for ${account.resourceId} is missing from the current Encounter snapshot`);
    }
    const total = account.changes.reduce((sum, item) => sum + item.change.delta, 0);
    const firstProgram = account.changes.find(item => item.event);
    let cursor = finalBalance === undefined
      ? firstProgram && safeInt(firstProgram.event?.before)
        ? firstProgram.event!.before - account.changes.slice(0, account.changes.indexOf(firstProgram)).reduce((sum, item) => sum + item.change.delta, 0)
        : undefined
      : finalBalance - total;
    if (cursor !== undefined && (!safeInt(cursor) || cursor < 0)) errors.push(`resource account ${account.resourceId} has an invalid reconstructed starting balance`);
    for (const item of account.changes) {
      if (cursor === undefined) continue;
      const next = cursor + item.change.delta;
      if (!safeInt(next) || next < 0) errors.push(`resource account ${account.resourceId} crosses an invalid intermediate balance`);
      if (item.event && (item.event.before !== cursor || item.event.after !== next)) {
        errors.push(`resource account ${account.resourceId} breaks its cross-source before/after chain`);
      }
      cursor = next;
    }
    if (finalBalance !== undefined && cursor !== finalBalance) errors.push(`resource account ${account.resourceId} disagrees with the trusted live balance`);
  }
}

function receiptRowFor(receipt: Row, source: MapEffectProgramSourceIdentity): Row {
  if (source.kind === 'partyCharacter') return (Array.isArray(receipt.settlements) ? receipt.settlements : []).find((row: unknown) => record(row) && row.characterId === source.id) as Row ?? {};
  if (source.kind === 'enemy') return (Array.isArray(receipt.enemyActions) ? receipt.enemyActions : []).find((row: unknown) => record(row) && row.enemyId === source.id) as Row ?? {};
  return record(receipt[source.kind]) ? receipt[source.kind] as Row : {};
}

function encounterMatchesScope(map: GameplayMapDef, nodeId: unknown, activityId: unknown, encounter: GameplayEncounterDef): boolean {
  if (!id(nodeId)) return false;
  const node = map.nodes.find(row => row.id === nodeId);
  if (!node) return false;
  if (activityId === null || activityId === undefined) return node.encounter === encounter;
  return node.activities?.some(activity => activity.id === activityId && activity.encounter === encounter) ?? false;
}

type HpRange = { readonly min: number; readonly max: number };
type HpRangeMap = Map<string, HpRange[]>;
function hpActorKey(identity: Row) { return `${identity.kind}:${identity.id}`; }
function hpCap(identity: Row, context: MapEffectReceiptContext): number | undefined {
  return identity.kind === 'partyCharacter' ? context.map.initialPartyHp.find(row => row.characterId === identity.id)?.maxHp
    : identity.kind === 'enemy' ? context.encounter.enemies?.find(row => row.id === identity.id)?.maxHp : undefined;
}
function hpInstructionIdentity(instruction: Row, info: SourceInfo): Row | null {
  if (instruction.target === 'source') return info.source.kind === 'partyCharacter' || info.source.kind === 'enemy'
    ? { kind: info.source.kind, id: info.source.id } : null;
  if (record(instruction.target)) return null;
  return info.target;
}
function hpProjectionMatches(change: Row, identity: Row, delta: number) {
  return identity.kind === 'partyCharacter' ? change.scope === 'party' && change.characterId === identity.id && change.delta === delta
    : identity.kind === 'enemy' && change.scope === 'enemy' && change.enemyId === identity.id && change.delta === delta;
}
function clampHp(before: number, delta: number, cap: number) {
  if (before === 0) return 0;
  return Math.max(0, Math.min(cap, before + delta));
}
function validateHpProjection(receipt: Row, trace: Row[], infos: Map<string, SourceInfo>, context: MapEffectReceiptContext,
  errors: string[]): HpRangeMap {
  const ranges: HpRangeMap = new Map();
  if (receipt.round === 1) {
    for (const enemy of context.encounter.enemies ?? []) ranges.set(`enemy:${enemy.id}`, [{ min: enemy.initialHp, max: enemy.initialHp }]);
  }
  const rows = settlementRows(receipt);
  const hpOps = ['hpChange', 'damage', 'heal'];
  const getInstructions = (info: SourceInfo) => info.action.effectProgram
    ? normalizeProgramAction(info.action)!.resolve.filter(instruction => hpOps.includes(instruction.op))
    : [];
  const rowFor = (key: string) => rows.find(row => { const source = settlementSource(row); return source && sourceKeyFor(source) === key; });
  const processSource = (info: SourceInfo, key: string) => {
    const row = rowFor(key) ?? info.settlement;
    const actual = Array.isArray(row.hpChanges) ? row.hpChanges.filter(record) : [];
    if (info.skipped) { if (actual.length) errors.push(`skipped Action ${info.action.id} has HP changes`); return; }
    const instructions = getInstructions(info);
    const programEvents = info.action.effectProgram
      ? trace.filter(entry => hpOps.includes(String(entry.op)) && entry.sourceKey === key && entry.actionId === info.action.id) : [];
    if (actual.length !== programEvents.length) errors.push(`HP trace for ${info.action.id} disagrees with its settlement projection`);
    const applyHp = (instruction: Row | undefined, event: Row | undefined, change: Row | undefined) => {
      const identity = event && record(event.identity) ? event.identity : null;
      const cap = identity ? hpCap(identity, context) : undefined;
      if (!identity || !safeInt(cap) || !change || !safeInt(change.delta)) { errors.push(`HP projection for ${info.action.id} has no valid target or delta`); return; }
      const e2 = !!instruction && (record(instruction.target) || typeof instruction.amount !== 'number' || instruction.repeat !== undefined);
      const expectedIdentity = e2 ? identity : instruction ? hpInstructionIdentity(instruction, info) : null;
      if (!expectedIdentity || !same(identity, expectedIdentity) || !hpProjectionMatches(change, identity, change.delta)) errors.push(`HP projection for ${info.action.id} changed its declared target`);
      if (e2 && instruction && record(instruction.target) && record(instruction.target.set)) {
        const expectedKind = instruction.target.set.side === 'party' ? 'partyCharacter' : 'enemy';
        if (identity.kind !== expectedKind) errors.push(`E2 HP event for ${info.action.id} changed TargetSet side`);
      }
      const keyActor = hpActorKey(identity);
      if (!event || !safeInt(event.before) || !safeInt(event.after) || !safeInt(event.delta)) {
        errors.push(`program HP event for ${info.action.id} has unsafe values`); return;
      }
      const current = ranges.get(keyActor);
      if (!current) ranges.set(keyActor, [{ min: event.before, max: event.before }]);
      else if (!current.some(range => event.before >= range.min && event.before <= range.max)) errors.push(`program HP event for ${info.action.id} breaks the mixed-source chain`);
      let after: number;
      if (instruction?.op === 'damage' || instruction?.op === 'heal') {
        const amount = e2 ? event.amount : instruction.amount;
        if (event.op !== instruction.op || !safeInt(amount) || amount < 0 || (!e2 && amount <= 0)
          || (!e2 && event.amount !== instruction.amount)) {
          errors.push(`program ${String(instruction.op)} event for ${info.action.id} disagrees with its declared amount`); return;
        }
        let expected = 0;
        if (event.before > 0) {
          const currentHp = BigInt(event.before);
          const requested = BigInt(amount);
          const maximum = BigInt(cap);
          const proposed = instruction.op === 'damage' ? currentHp - requested : currentHp + requested;
          expected = instruction.op === 'damage'
            ? Number(proposed <= 0n ? 0n : proposed)
            : Number(proposed >= maximum ? maximum : proposed);
        }
        after = expected;
      } else {
        if (instruction?.op !== 'hpChange' || !safeInt(instruction.delta)) {
          errors.push(`program HP event for ${info.action.id} has no matching instruction`); return;
        }
        after = clampHp(event.before, instruction.delta, cap);
      }
      if (event.after !== after || event.delta !== after - event.before || change.delta !== event.delta) errors.push(`program HP event for ${info.action.id} has an invalid actual delta`);
      ranges.set(keyActor, [{ min: event.after, max: event.after }]);
    };
    if (info.action.effectProgram) {
      let hpIndex = 0;
      for (const event of trace.filter(entry => entry.sourceKey === key && entry.actionId === info.action.id)) {
        if (event.op === 'when' && Array.isArray(event.reads)) {
          for (const read of event.reads) if (record(read)
            && (read.op === 'hpAtLeast' || read.op === 'hpAtMost' || read.op === 'hpRatioAtLeast' || read.op === 'hpRatioAtMost')
            && validIdentity(read.identity) && (read.identity.kind === 'partyCharacter' || read.identity.kind === 'enemy')) {
            const current = ranges.get(hpActorKey(read.identity));
            if (current && safeInt(read.current) && !current.some(range => read.current >= range.min && read.current <= range.max)) {
              errors.push(`guard HP read ${hpActorKey(read.identity)} breaks the mixed-source chain`);
            }
          }
        }
        if (!hpOps.includes(String(event.op))) continue;
        const instruction = rulesFor(info.action).get(event.path)?.instruction as unknown as Row | undefined;
        applyHp(instruction, event, actual[hpIndex]);
        hpIndex += 1;
      }
    }
  };
  const byPhase = (source: MapEffectProgramSourceIdentity) => {
    const info = infos.get(sourceKeyFor(source)); return info ? [info] : [];
  };
  const partySources = (receipt.settlements as unknown[] ?? []).filter(record).flatMap(row => {
    const source = settlementSource(row); return source?.kind === 'partyCharacter' ? byPhase(source) : [];
  });
  const ability = record(receipt.ability) ? settlementSource(receipt.ability) : null;
  const item = record(receipt.item) ? settlementSource(receipt.item) : null;
  const actorlessSources = [ability, item].filter((source): source is MapEffectProgramSourceIdentity => source !== null);
  const enemySources = (receipt.enemyActions as unknown[] ?? []).filter(record).flatMap(row => {
    const source = settlementSource(row); return source?.kind === 'enemy' ? byPhase(source) : [];
  });
  for (const info of [...partySources, ...actorlessSources.map(source => infos.get(sourceKeyFor(source))!).filter(Boolean), ...enemySources]) {
    processSource(info, sourceKeyFor(info.source));
  }
  return ranges;
}

/** Validate one opaque E1 receipt against the current Map/Encounter declarations. */
export function validateMapEffectCommitReceipt(value: unknown, context: MapEffectReceiptContext): MapEffectReceiptValidation {
  const errors: string[] = [];
  if (!record(value)) return { ok: false, errors: ['receipt must be an object'] };
  const receipt = value;
  const headerFields = ['programReceiptVersion', 'executionContractId', 'effectScope', 'programVisitCount', 'programVisits', 'plannedLocals', 'effectTrace'];
  if (headerFields.every(field => !Object.prototype.hasOwnProperty.call(receipt, field))) {
    return { ok: false, errors: ['receipt has no program header'] };
  }
  const rootRequired = ['requestId', 'commandVersion', 'resultingCommitVersion', 'nodeId', 'round', 'draftVersion', 'settlements'];
  const statusReceiptFields = ['statusReceiptVersion', 'plannedStatuses', 'statusTrace'];
  const rootOptional = ['activityId', 'enemyActions', 'ability', 'item', ...headerFields, ...statusReceiptFields];
  if (!knownFields(receipt, rootRequired, rootOptional)) errors.push('receipt has unknown or missing root fields');
  const hasStatusReceipt = statusReceiptFields.some(field => Object.prototype.hasOwnProperty.call(receipt, field));
  if (hasStatusReceipt && (!statusReceiptFields.every(field => Object.prototype.hasOwnProperty.call(receipt, field))
    || receipt.statusReceiptVersion !== 1 || !Array.isArray(receipt.plannedStatuses) || !Array.isArray(receipt.statusTrace))) {
    errors.push('Status receipt fields must be present together with version 1 and arrays');
  }
  if (!id(receipt.requestId) || !safeInt(receipt.commandVersion) || receipt.commandVersion < 0
    || !safeInt(receipt.resultingCommitVersion) || receipt.resultingCommitVersion !== receipt.commandVersion + 1
    || !id(receipt.nodeId) || !safeInt(receipt.round) || receipt.round < 1
    || !safeInt(receipt.draftVersion) || receipt.draftVersion < 0
    || (Object.prototype.hasOwnProperty.call(receipt, 'activityId') && !id(receipt.activityId))) {
    errors.push('receipt has invalid Owner version or scope fields');
  }
  if (!Array.isArray(receipt.settlements)) errors.push('receipt settlements must be an array');
  if (Object.prototype.hasOwnProperty.call(receipt, 'enemyActions') && !Array.isArray(receipt.enemyActions)) {
    errors.push('receipt enemyActions must be an array');
  }
  validateSettlementShapes(receipt, errors);
  if (receipt.programReceiptVersion !== 1 || receipt.executionContractId !== 'E1-COMPAT-1') errors.push('unsupported program receipt version or execution contract');
  if (!record(receipt.effectScope)) errors.push('effectScope must be an object');
  const scope = record(receipt.effectScope) ? receipt.effectScope : {};
  if (!id(context.runId) || scope.runId !== context.runId || scope.mapId !== context.map.id || scope.nodeId !== receipt.nodeId || scope.activityId !== (receipt.activityId ?? null)
    || scope.round !== receipt.round || !safeInt(scope.round) || scope.round < 1) errors.push('effectScope does not match the receipt scope');
  if (!encounterMatchesScope(context.map, receipt.nodeId, receipt.activityId ?? null, context.encounter)) errors.push('receipt Node/Activity does not resolve to the supplied Encounter');
  if (!Array.isArray(receipt.programVisits) || !Array.isArray(receipt.effectTrace)) return { ok: false, errors: [...errors, 'programVisits and effectTrace must be arrays'] };
  const visits = receipt.programVisits.filter(record);
  const trace = receipt.effectTrace.filter(record);
  if (visits.length !== receipt.programVisits.length || trace.length !== receipt.effectTrace.length) errors.push('programVisits/effectTrace contain malformed entries');
  if (visits.length > 4096 || receipt.programVisitCount !== visits.length) errors.push('programVisitCount is not the bounded derived visit count');
  if (!exact(scope, ['runId', 'mapId', 'nodeId', 'activityId', 'round'])) errors.push('effectScope has unknown or missing fields');
  for (const entry of trace) {
    const fields: Record<string, readonly string[]> = {
      damage: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'before', 'after', 'amount', 'delta'],
      heal: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'before', 'after', 'amount', 'delta'],
      targetSet: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'selection', 'selector', 'identities', 'repeatCount'],
      hpChange: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'before', 'after', 'delta'],
      counterAdd: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'counterId', 'before', 'after', 'delta'],
      flagSet: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'flagId', 'before', 'after'],
      resourceSettlement: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'account', 'resourceId', 'intentDelta', 'before', 'after', 'delta'],
      discountSCost: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'targetCard', 'receiver', 'amount'],
      when: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'result', 'reads'],
      statusApply: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'statusId', 'requestedStacks', 'beforeStacks', 'afterStacks', 'beforeRemainingRounds', 'afterRemainingRounds', 'beforeAppliedRound', 'beforeLastTriggeredRound', 'appliedRound', 'lastTriggeredRound'],
    };
    const allowed = fields[String(entry.op)];
    const optional = entry.op === 'damage' || entry.op === 'heal' ? ['batch'] : [];
    if (!allowed || !knownFields(entry, allowed, optional) || entry.mode !== 'program' || !id(entry.sourceKey) || !id(entry.actionId) || !id(entry.path)) errors.push('effectTrace contains an unknown shape');
    if ((entry.op === 'damage' || entry.op === 'heal') && Object.prototype.hasOwnProperty.call(entry, 'batch')) {
      if (!record(entry.batch) || !exact(entry.batch, ['targetIndex', 'hitIndex', 'targetCount', 'repeatCount'])
        || ![entry.batch.targetIndex, entry.batch.hitIndex, entry.batch.targetCount, entry.batch.repeatCount].every(safeInt)
        || entry.batch.targetIndex < 0 || entry.batch.hitIndex < 0 || entry.batch.targetCount < 0 || entry.batch.targetCount > 32
        || entry.batch.repeatCount < 0 || entry.batch.repeatCount > 8) errors.push('effectTrace contains an invalid E2 damage batch');
    }
    if (entry.op === 'targetSet' && (!['primary', 'set'].includes(String(entry.selection))
      || (entry.selector !== null && !record(entry.selector)) || !Array.isArray(entry.identities)
      || !entry.identities.every((identity: unknown) => validIdentity(identity) && ['partyCharacter', 'enemy'].includes(String((identity as Row).kind)))
      || !safeInt(entry.repeatCount) || entry.repeatCount < 0 || entry.repeatCount > 8)) errors.push('effectTrace contains an invalid TargetSet expansion');
    if (['hpChange', 'damage', 'heal', 'counterAdd', 'flagSet', 'resourceSettlement'].includes(String(entry.op)) && !validIdentity(entry.identity)) {
      errors.push('effectTrace contains an invalid identity');
    }
    if (entry.op === 'statusApply' && (!validIdentity(entry.identity) || !['partyCharacter', 'enemy'].includes(String(entry.identity.kind))
      || !record(entry.source) || !id(entry.statusId) || !safeInt(entry.requestedStacks) || entry.requestedStacks < 1
      || !safeInt(entry.beforeStacks) || entry.beforeStacks < 0 || !safeInt(entry.afterStacks) || entry.afterStacks < 1
      || !(entry.beforeRemainingRounds === null || (safeInt(entry.beforeRemainingRounds) && entry.beforeRemainingRounds > 0))
      || !safeInt(entry.afterRemainingRounds) || entry.afterRemainingRounds < 1
      || !(entry.beforeAppliedRound === null || safeInt(entry.beforeAppliedRound))
      || !(entry.beforeLastTriggeredRound === null || safeInt(entry.beforeLastTriggeredRound))
      || !safeInt(entry.appliedRound) || !(entry.lastTriggeredRound === null || safeInt(entry.lastTriggeredRound)))) {
      errors.push('effectTrace contains an invalid Status apply record');
    }
    if (entry.op === 'when' && Array.isArray(entry.reads)) for (const raw of entry.reads) {
      if (!record(raw)) { errors.push('guard contains an unknown shape'); continue; }
      const readFields: Record<string, readonly string[]> = {
        hpAtLeast: ['path', 'op', 'identity', 'current', 'value', 'result'], hpAtMost: ['path', 'op', 'identity', 'current', 'value', 'result'],
        hpRatioAtLeast: ['path', 'op', 'identity', 'current', 'cap', 'numerator', 'denominator', 'result'], hpRatioAtMost: ['path', 'op', 'identity', 'current', 'cap', 'numerator', 'denominator', 'result'],
        counter: ['path', 'op', 'identity', 'counterId', 'current', 'comparison', 'value', 'result'], flag: ['path', 'op', 'identity', 'flagId', 'current', 'value', 'result'],
        preparedTagCount: ['path', 'op', 'side', 'tag', 'count', 'comparison', 'value', 'result'],
        all: ['path', 'op', 'result'], any: ['path', 'op', 'result'], not: ['path', 'op', 'result'],
      };
      if (!readFields[String(raw.op)] || !exact(raw, readFields[String(raw.op)])) errors.push('guard contains unknown or missing fields');
    }
  }
  const infos = sourceInfos(receipt, context, errors);
  const visitRefs = new Set<string>();
  for (const visit of visits) {
    if (!id(visit.sourceKey) || !id(visit.actionId) || !id(visit.path) || visit.mode !== 'program'
      || !['prepare', 'statement', 'condition'].includes(String(visit.kind))) { errors.push('program visit has an unknown shape'); continue; }
    const info = infos.get(visit.sourceKey);
    if (!info || info.action.id !== visit.actionId || !expectedSourceIdentity(visit.source, info)) { errors.push(`program visit ${visit.path} has an invalid source/action`); continue; }
    const rule = rulesFor(info.action).get(visit.path);
    if (!rule || (visit.kind === 'prepare' && rule.op !== 'discountSCost')
      || (visit.kind === 'condition' && !rule.condition) || (visit.kind === 'statement' && !rule.instruction)) errors.push(`program visit ${visit.path} is not a declared operation`);
    const ref = `${visit.sourceKey}|${visit.actionId}|${visit.path}`;
    if (visitRefs.has(ref)) errors.push(`duplicate visit ${ref}`);
    visitRefs.add(ref);
  }
  if (hasStatusReceipt) validateStatusApplyEvidence(receipt, trace, visits, infos, context, errors);
  const sourceOrder = settlementRows(receipt).flatMap(row => {
    const source = settlementSource(row);
    return source ? [sourceKeyFor(source)] : [];
  });
  const partyIds = Array.isArray(receipt.settlements) ? receipt.settlements.filter(record).map(row => row.characterId) : [];
  if (!Array.isArray(receipt.settlements) || receipt.settlements.length !== context.map.partyCharacterIds.length
    || !same(partyIds, context.map.partyCharacterIds)) errors.push('Party settlement order does not match the fixed Map roster');
  const enemyIds = Array.isArray(receipt.enemyActions) ? receipt.enemyActions.filter(record).map(row => row.enemyId) : [];
  const declaredEnemyIds = (context.encounter.enemies ?? []).map(enemy => enemy.id);
  if ((declaredEnemyIds.length > 0 && !Array.isArray(receipt.enemyActions))
    || (Array.isArray(receipt.enemyActions) && receipt.enemyActions.length !== declaredEnemyIds.length)
    || !same(enemyIds, declaredEnemyIds)) errors.push('Enemy action order does not match the Encounter declaration');
  const expectedVisits = canonicalVisits(infos, sourceOrder, trace, receipt, context, errors);
  const visitSignature = (rows: Row[]) => rows.map(row => [row.sourceKey, row.source, row.actionId, row.path, row.kind, row.mode]);
  if (!same(visitSignature(visits), visitSignature(expectedVisits))) errors.push('programVisits do not match the complete declaration walk and E1 source order');
  const e2Refs = e2InstructionRefs(infos);
  validateE2BatchStructures(trace, infos, errors);
  validateE2PlanReplay(receipt, trace, infos, context, errors);
  const state = validateStateTrace(trace, visits, infos, receipt, context, e2Refs, errors);
  validateResourceProjection(receipt, trace, infos, context, errors);
  validatePrepareCostProjection(receipt, trace, context, errors);
  const hpRanges = validateHpProjection(receipt, trace, infos, context, errors);
  if (!record(receipt.plannedLocals) || !exact(receipt.plannedLocals, ['counters', 'flags'])
    || !record(receipt.plannedLocals.counters) || !record(receipt.plannedLocals.flags)) {
    errors.push('plannedLocals must contain only Counter and Flag records');
  } else {
    validatePlannedLocals(receipt.plannedLocals, context.encounter, errors);
    const counters = record(receipt.plannedLocals.counters) ? receipt.plannedLocals.counters : {};
    const flags = record(receipt.plannedLocals.flags) ? receipt.plannedLocals.flags : {};
    for (const [key, value] of state.known) {
      const [kind, localId] = key.split(':');
      if (kind !== 'counter' && kind !== 'flag') continue;
      const finalValue = kind === 'counter' ? record(counters[localId!]) ? counters[localId!]!.value : undefined : flags[localId!];
      if (finalValue !== value) errors.push(`plannedLocals ${key} disagrees with the last program write`);
    }
  }
  validateCurrentSnapshot(receipt, context, hpRanges, errors);
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function validatePlannedLocals(value: Row, encounter: GameplayEncounterDef, errors: string[]) {
  const counters = record(value.counters) ? value.counters : {};
  const flags = record(value.flags) ? value.flags : {};
  const defs = encounter.locals;
  for (const definition of defs?.counters ?? []) {
    const state = counters[definition.id];
    if (!record(state) || !exact(state, ['value', 'min', 'max']) || !safeInt(state.value) || state.value < definition.min || state.value > definition.max
      || state.min !== definition.min || state.max !== definition.max) errors.push(`planned Counter ${definition.id} is invalid`);
  }
  for (const key of Object.keys(counters)) if (!(defs?.counters ?? []).some(definition => definition.id === key)) errors.push(`planned Counter ${key} is undeclared`);
  for (const definition of defs?.flags ?? []) if (typeof flags[definition.id] !== 'boolean') errors.push(`planned Flag ${definition.id} is invalid`);
  for (const key of Object.keys(flags)) if (!(defs?.flags ?? []).some(definition => definition.id === key)) errors.push(`planned Flag ${key} is undeclared`);
}

function validatePrepareCostProjection(receipt: Row, trace: Row[], context: MapEffectReceiptContext, errors: string[]) {
  const rows = settlementRows(receipt);
  const actions = new Map((context.map.actions ?? []).map(action => [action.id, action]));
  for (const row of rows) if (record(row.targetCard)) {
    const card = id(row.targetCard.id) ? parseCardInfo(row.targetCard.id) : null;
    const source = settlementSource(row);
    const action = id(row.actionId) ? actions.get(row.actionId) : undefined;
    if (!card || !source || !action || !cardIsAllowedForSource(card, source, action, context)
      || !same(row.targetCard.scope, receipt.effectScope)) {
      errors.push(`source ${String(row.actionId)} has an invalid scoped CardRef candidate`);
    }
  }
  const discounts = new Map<string, number>();
  const targetKey = (card: { kind: string; id: string; actionId: string }) => `${card.kind}:${card.id}:${card.actionId}`;
  const rowKey = (row: Row) => id(row.characterId) ? `partyCharacter:${row.characterId}:${String(row.actionId)}`
    : id(row.enemyId) ? `enemy:${row.enemyId}:${String(row.actionId)}` : null;
  const sourceOf = (row: Row) => settlementSource(row);
  const prepareFor = (row: Row): { amount: number; sourceKey: string | null; action: GameplayMapActionDef | null } => {
    if (!id(row.actionId)) return { amount: 0, sourceKey: null, action: null };
    const action = actions.get(row.actionId) ?? null;
    if (!action) return { amount: 0, sourceKey: null, action: null };
    const source = sourceOf(row);
    const sourceKey = source ? sourceKeyFor(source) : null;
    const leaves = normalizeProgramAction(action)?.prepare ?? [];
    const expectedProgram = row.skipReason ? 0 : leaves.length;
    const events = trace.filter(entry => entry.op === 'discountSCost' && entry.actionId === action.id
      && (sourceKey === null || entry.sourceKey === sourceKey));
    if (events.length !== expectedProgram || events.some(event => !record(row.targetCard) || !same(event.targetCard, row.targetCard))) {
      errors.push(`program prepare trace for ${action.id} disagrees with its source phase`);
    }
    if (row.skipReason) {
      if (events.length > 0) errors.push(`skipped source ${action.id} has a prepare event`);
      return { amount: 0, sourceKey, action };
    }
    const amount = leaves.reduce((sum, leaf) => sum + leaf.amount, 0);
    if (amount === 0) return { amount, sourceKey, action };
    if (action.target.kind !== 'card' || !record(row.targetCard) || !id(row.targetCard.id)
      || !same(row.targetCard.scope, receipt.effectScope)) {
      errors.push(`Action ${action.id} has prepare declarations without a selected scoped CardRef`);
      return { amount: 0, sourceKey, action };
    }
    const card = parseCardInfo(row.targetCard.id);
    if (!card || !source || !cardIsAllowedForSource(card, source, action, context)) {
      errors.push(`Action ${action.id} selected an unknown CardRef candidate`);
      return { amount: 0, sourceKey, action };
    }
    return { amount, sourceKey, action };
  };
  const addDiscount = (map: Map<string, number>, row: Row) => {
    const prepared = prepareFor(row);
    if (prepared.amount === 0 || !record(row.targetCard)) return;
    const card = parseCardInfo(String(row.targetCard.id));
    if (!card) return;
    const key = targetKey(card);
    map.set(key, (map.get(key) ?? 0) + prepared.amount);
  };
  const partyRows = rows.filter(row => !id(row.enemyId));
  const enemyRows = rows.filter(row => id(row.enemyId));
  const partyDiscounts = new Map<string, number>();
  for (const row of partyRows) addDiscount(partyDiscounts, row);
  const validateCost = (row: Row, available: Map<string, number>) => {
    const key = rowKey(row);
    if (!key) return;
    const targetAction = actions.get(String(row.actionId));
    const original = (targetAction?.costs ?? []).reduce((sum, cost) => cost.scope === 'actor' && cost.resourceId === 'sCost' ? sum + cost.amount : sum, 0);
    if (row.skipReason) {
      if (row.scostCost !== undefined) errors.push(`skipped Action ${String(row.actionId)} has an sCost settlement`);
      return;
    }
    const total = available.get(key) ?? 0;
    const expected = Math.min(total, original);
    if (original === 0) {
      if (row.scostCost !== undefined) errors.push(`sCost settlement for ${String(row.actionId)} is unexpected`);
    } else if (!record(row.scostCost) || row.scostCost.original !== original || row.scostCost.discount !== expected
      || row.scostCost.paid !== original - expected) errors.push(`sCost settlement for ${String(row.actionId)} disagrees with prepare timing`);
  };
  for (const row of partyRows) {
    const key = rowKey(row);
    if (key) validateCost(row, partyDiscounts);
  }
  const enemyDiscounts = new Map(partyDiscounts);
  for (const row of enemyRows) {
    const key = rowKey(row);
    if (key) validateCost(row, enemyDiscounts);
    // An Enemy's prepare runs only after its own cost preflight and can discount
    // later Enemy sources; it cannot affect Party, Ability/Item, itself, or earlier Enemies.
    addDiscount(enemyDiscounts, row);
  }
}

function validateCurrentSnapshot(receipt: Row, context: MapEffectReceiptContext, hpRanges: HpRangeMap, errors: string[]) {
  const current = context.currentEncounter;
  if (!current || current.nodeId !== receipt.nodeId || (current.activityId ?? null) !== (receipt.activityId ?? null)) return;
  if (!safeInt(current.round) || current.round <= Number(receipt.round)) return;
  if (current.round !== Number(receipt.round) + 1) { errors.push('current Encounter is not the immediate successor of this receipt'); return; }
  if (!record(receipt.plannedLocals) || !record(current.locals) || !same(receipt.plannedLocals, current.locals)) {
    errors.push('plannedLocals disagree with the live Encounter snapshot');
  }
  for (const [key, ranges] of hpRanges) {
    const separator = key.indexOf(':');
    const kind = separator < 0 ? '' : key.slice(0, separator);
    const actorId = separator < 0 ? '' : key.slice(separator + 1);
    const currentHp = kind === 'partyCharacter'
      ? current.partyHp?.find(row => row.characterId === actorId)?.currentHp
      : current.enemies?.find(row => row.enemyId === actorId)?.currentHp;
    if (!safeInt(currentHp) || !ranges.some(range => currentHp >= range.min && currentHp <= range.max)) {
      errors.push(`live HP for ${actorId} disagrees with the completed mixed-source chain`);
    }
  }
  const hasResourceChanges = settlementRows(receipt).some(row => Array.isArray(row.resourceChanges) && row.resourceChanges.length > 0);
  if (hasResourceChanges && context.currentBalances == null) {
    errors.push('live resource balances are required to close the current Encounter chain');
  }
}

