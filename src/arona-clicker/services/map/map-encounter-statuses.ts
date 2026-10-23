import type { GameplayEncounterDef, GameplayMapActionDef, GameplayMapDef, GameplayMapStatusDef } from '../../../data-services/contracts/gameplay-map';
import { resolveGameplayMapCandidateSources } from '../../../data-services/validation/gameplay-map-candidate-pools';
import type {
  MapEffectActorIdentity,
  MapEffectHpState,
  MapEffectProgramSourceIdentity,
  MapEffectStatusTickTraceEntry,
  MapEncounterStatusInstance,
  MapRunStatusInstance,
  MapEncounterStatusTickTraceEntry,
  MapRunStatusTickTraceEntry,
} from '../../contracts/map/map-effects';
import type { MapRunCandidateSourceSnapshot } from '../../contracts/map/map-run';

const MAX_STATUS_INSTANCES = 256;
const MAX_DURATION_ROUNDS = 99;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export interface MapEncounterStatusValidationOptions {
  readonly map: GameplayMapDef;
  readonly encounter: GameplayEncounterDef;
  readonly currentRound: number;
  readonly candidateSourceSnapshot?: MapRunCandidateSourceSnapshot;
}

export interface MapRunStatusValidationOptions {
  readonly map: GameplayMapDef;
  readonly partyCharacterIds: readonly string[];
  readonly currentCommitVersion: number;
}

export interface MapEncounterStatusRoundEndOptions {
  readonly round: number;
  readonly definitions: readonly GameplayMapStatusDef[];
  readonly statuses: readonly MapEncounterStatusInstance[];
  readonly hp: Readonly<Record<string, MapEffectHpState>>;
  readonly partyOrder: readonly string[];
  readonly enemyOrder: readonly string[];
}

export interface MapEncounterStatusRoundEndPlan {
  readonly hp: Readonly<Record<string, MapEffectHpState>>;
  readonly statuses: readonly MapEncounterStatusInstance[];
  readonly trace: readonly MapEncounterStatusTickTraceEntry[];
}

export interface MapRunStatusRoundEndPlan {
  readonly hp: Readonly<Record<string, MapEffectHpState>>;
  readonly statuses: readonly MapRunStatusInstance[];
  readonly trace: readonly MapRunStatusTickTraceEntry[];
}

export interface MapStatusRoundEndPlan {
  readonly hp: Readonly<Record<string, MapEffectHpState>>;
  readonly encounterStatuses: readonly MapEncounterStatusInstance[];
  readonly mapRunStatuses: readonly MapRunStatusInstance[];
  readonly trace: readonly MapEffectStatusTickTraceEntry[];
}

export interface MapEncounterStatusPreTickState {
  readonly hp: Readonly<Record<string, MapEffectHpState>>;
  readonly statuses: readonly MapEncounterStatusInstance[];
}

export interface MapStatusRoundEndOptions extends MapEncounterStatusRoundEndOptions {
  readonly commitVersion: number;
  readonly mapRunStatuses?: readonly MapRunStatusInstance[];
}

export interface MapEncounterStatusTraceValidationOptions {
  readonly statusReceiptVersion: unknown;
  readonly statusTrace: unknown;
  readonly round: number;
  readonly definitions: readonly GameplayMapStatusDef[];
  /** Receipt's final Status list after the round-end decision. */
  readonly plannedStatuses: readonly MapEncounterStatusInstance[];
  /** Trusted successor HP state from the receipt/active Encounter boundary. */
  readonly receiptHp: Readonly<Record<string, MapEffectHpState>>;
  readonly partyOrder: readonly string[];
  readonly enemyOrder: readonly string[];
  /** True when a terminal ordinary-source plan intentionally skips round-end ticks. */
  readonly tickSkipped: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  return actual.length === expected.length && actual.every((field, index) => field === expected[index]);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function stableSourceKey(source: MapEffectProgramSourceIdentity): string {
  switch (source.kind) {
    case 'partyCharacter':
    case 'enemy': return JSON.stringify([source.kind, source.id]);
    case 'ability': return JSON.stringify([source.kind, source.actionId]);
    case 'item': return JSON.stringify([source.kind, source.actionId, source.itemId]);
  }
}

function statusIdentityKey(status: MapEncounterStatusInstance): string {
  return JSON.stringify([
    status.holder.kind,
    status.holder.id,
    status.statusId,
    stableSourceKey(status.source),
    status.actionId,
  ]);
}

/** Stable ordering for Status rows sharing a holder: Status ID, source key, then Action ID. */
export function compareMapEncounterStatusStableOrder(
  left: MapEncounterStatusInstance,
  right: MapEncounterStatusInstance,
): number {
  return (left.statusId < right.statusId ? -1 : left.statusId > right.statusId ? 1 : 0)
    || (stableSourceKey(left.source) < stableSourceKey(right.source) ? -1
      : stableSourceKey(left.source) > stableSourceKey(right.source) ? 1
        : left.actionId < right.actionId ? -1 : left.actionId > right.actionId ? 1 : 0);
}

/** Deep-copy and freeze Status instances so nested identities cannot alias a mutable source object. */
export function copyMapEncounterStatusInstances(
  statuses: readonly MapEncounterStatusInstance[],
): readonly MapEncounterStatusInstance[] {
  return Object.freeze(statuses.map(status => Object.freeze({
    ...status,
    holder: Object.freeze({ ...status.holder }),
    source: Object.freeze({ ...status.source }),
  })));
}

export function copyMapRunStatusInstances(statuses: readonly MapRunStatusInstance[]): readonly MapRunStatusInstance[] {
  return Object.freeze(statuses.map(status => Object.freeze({
    ...status,
    holder: Object.freeze({ ...status.holder }),
    source: Object.freeze({ ...status.source }),
  })));
}

function encounterAtStatusOrigin(
  map: GameplayMapDef,
  nodeId: string,
  activityId: string | undefined,
): GameplayEncounterDef | null {
  const node = map.nodes.find(candidate => candidate.id === nodeId);
  if (!node) return null;
  if (activityId === undefined) return node.activities === undefined ? node.encounter ?? null : null;
  return node.activities?.find(activity => activity.id === activityId)?.encounter ?? null;
}

function mapRunStatusSourceIsAuthorized(
  map: GameplayMapDef,
  sourceCharacterId: string,
  actionId: string,
  statusId: string,
  originNodeId: string,
  originActivityId: string | undefined,
): boolean {
  const action = map.actions?.find(candidate => candidate.id === actionId);
  const encounter = encounterAtStatusOrigin(map, originNodeId, originActivityId);
  if (!action || !encounter || !action.eligibleCharacterIds.some(id => String(id) === sourceCharacterId)
    || !programAppliesStatus(action, statusId)) return false;
  const directParticipant = encounter.participants?.find(participant => String(participant.characterId) === sourceCharacterId);
  if (!directParticipant?.actions?.some(candidate => candidate.actionId === actionId)) return false;
  const visit = (instructions: readonly unknown[] | undefined): boolean => (instructions ?? []).some(raw => {
    if (!isRecord(raw)) return false;
    if (raw.op === 'statusApply' && raw.statusId === statusId) {
      return raw.target === 'source' || (raw.target === 'primary' && action.target.kind === 'partyCharacter');
    }
    if (raw.op === 'when') {
      return visit(Array.isArray(raw.then) ? raw.then : undefined)
        || visit(Array.isArray(raw.else) ? raw.else : undefined);
    }
    if (raw.op === 'forTargets') return visit(Array.isArray(raw.body) ? raw.body : undefined);
    return false;
  });
  return visit(action.effectProgram?.resolve);
}

/** Validate the unique MapRun-root Status ledger against static definitions and original source Encounter. */
export function validateMapRunStatusInstances(
  value: unknown,
  options: MapRunStatusValidationOptions,
): readonly MapRunStatusInstance[] | null {
  if (!Array.isArray(value) || value.length > MAX_STATUS_INSTANCES
    || options.map.executionContractId !== 'AG-1'
    || !Number.isSafeInteger(options.currentCommitVersion) || options.currentCommitVersion < 0) return null;
  const definitions = new Map((options.map.statuses ?? []).map(status => [status.id, status]));
  const partyIds = new Set(options.partyCharacterIds);
  const seen = new Set<string>();
  const result: MapRunStatusInstance[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) return null;
    const required = ['holder', 'statusId', 'source', 'actionId', 'appliedRound', 'lastTriggeredRound', 'stacks',
      'remainingRounds', 'originNodeId', 'appliedCommitVersion', 'lastTriggeredCommitVersion'];
    const keys = Object.keys(raw);
    if (keys.some(key => ![...required, 'originActivityId'].includes(key))
      || required.some(key => !Object.prototype.hasOwnProperty.call(raw, key))
      || (Object.prototype.hasOwnProperty.call(raw, 'originActivityId') && !isNonEmptyId(raw.originActivityId))) return null;
    if (!isRecord(raw.holder) || !hasExactFields(raw.holder, ['kind', 'id'])
      || raw.holder.kind !== 'partyCharacter' || !isNonEmptyId(raw.holder.id)
      || !partyIds.has(raw.holder.id)) return null;
    if (typeof raw.statusId !== 'string' || typeof raw.actionId !== 'string' || !raw.actionId
      || typeof raw.originNodeId !== 'string' || !raw.originNodeId) return null;
    const source = validateSourceIdentity(raw.source);
    if (!source || source.kind !== 'partyCharacter' || !partyIds.has(source.id)) return null;
    const definition = definitions.get(raw.statusId);
    const validBehavior = definition?.kind === 'damageReduction'
      ? Number.isSafeInteger(definition.damageReductionPerStack) && definition.damageReductionPerStack > 0
        && definition.category === 'beneficial'
      : definition?.kind === 'damageProtection'
        ? definition.category === 'beneficial'
        : (definition?.kind === 'burn' || definition?.kind === 'regen')
          && Number.isSafeInteger(definition.hpPerStack) && definition.hpPerStack > 0;
    if (!definition || definition.lifetime !== 'mapRun' || !validBehavior
      || !Number.isSafeInteger(definition.maxStacks) || definition.maxStacks < 1 || definition.maxStacks > 99
      || !Number.isSafeInteger(raw.appliedRound) || (raw.appliedRound as number) < 1
      || !(raw.lastTriggeredRound === null || (Number.isSafeInteger(raw.lastTriggeredRound)
        && (raw.lastTriggeredRound as number) >= 1))
      || !Number.isSafeInteger(raw.appliedCommitVersion) || (raw.appliedCommitVersion as number) < 0
      || (raw.appliedCommitVersion as number) > options.currentCommitVersion
      || !(raw.lastTriggeredCommitVersion === null || (Number.isSafeInteger(raw.lastTriggeredCommitVersion)
        && (raw.lastTriggeredCommitVersion as number) > (raw.appliedCommitVersion as number)
        && (raw.lastTriggeredCommitVersion as number) <= options.currentCommitVersion))
      || !Number.isSafeInteger(raw.stacks) || (raw.stacks as number) < 1 || (raw.stacks as number) > definition.maxStacks
      || !Number.isSafeInteger(raw.remainingRounds) || (raw.remainingRounds as number) < 1 || (raw.remainingRounds as number) > MAX_DURATION_ROUNDS
      || !mapRunStatusSourceIsAuthorized(options.map, source.id, raw.actionId, raw.statusId, raw.originNodeId,
        typeof raw.originActivityId === 'string' ? raw.originActivityId : undefined)) return null;
    const status: MapRunStatusInstance = {
      holder: { kind: 'partyCharacter', id: raw.holder.id },
      statusId: raw.statusId,
      source,
      actionId: raw.actionId,
      appliedRound: raw.appliedRound as number,
      lastTriggeredRound: raw.lastTriggeredRound as number | null,
      stacks: raw.stacks as number,
      remainingRounds: raw.remainingRounds as number,
      originNodeId: raw.originNodeId,
      ...(typeof raw.originActivityId === 'string' ? { originActivityId: raw.originActivityId } : {}),
      appliedCommitVersion: raw.appliedCommitVersion as number,
      lastTriggeredCommitVersion: raw.lastTriggeredCommitVersion as number | null,
    };
    const key = statusIdentityKey(status);
    if (seen.has(key)) return null;
    seen.add(key);
    result.push(status);
  }
  return copyMapRunStatusInstances(result);
}

function programAppliesStatus(action: GameplayMapActionDef, statusId: string): boolean {
  const visit = (instructions: readonly unknown[] | undefined): boolean => (instructions ?? []).some(raw => {
    if (!isRecord(raw)) return false;
    if (raw.op === 'statusApply') return raw.statusId === statusId;
    if (raw.op === 'when') {
      return visit(Array.isArray(raw.then) ? raw.then : undefined)
        || visit(Array.isArray(raw.else) ? raw.else : undefined);
    }
    if (raw.op === 'forTargets') return visit(Array.isArray(raw.body) ? raw.body : undefined);
    return false;
  });
  return visit(action.effectProgram?.resolve);
}

function validateSourceIdentity(value: unknown): MapEffectProgramSourceIdentity | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null;
  if (value.kind === 'partyCharacter' || value.kind === 'enemy') {
    return hasExactFields(value, ['kind', 'id']) && typeof value.id === 'string' && value.id.length > 0
      ? { kind: value.kind, id: value.id }
      : null;
  }
  if (value.kind === 'ability') {
    return hasExactFields(value, ['kind', 'actionId']) && typeof value.actionId === 'string' && value.actionId.length > 0
      ? { kind: 'ability', actionId: value.actionId }
      : null;
  }
  if (value.kind === 'item') {
    return hasExactFields(value, ['kind', 'actionId', 'itemId'])
      && typeof value.actionId === 'string' && value.actionId.length > 0
      && typeof value.itemId === 'string' && value.itemId.length > 0
      ? { kind: 'item', actionId: value.actionId, itemId: value.itemId }
      : null;
  }
  return null;
}

function sourceCanUseAction(
  map: GameplayMapDef,
  encounter: GameplayEncounterDef,
  source: MapEffectProgramSourceIdentity,
  actionId: string,
  candidateSourceSnapshot?: MapRunCandidateSourceSnapshot,
): boolean {
  const action = map.actions?.find(candidate => candidate.id === actionId);
  if (!action) return false;
  try {
    if (source.kind === 'partyCharacter') {
      const participant = encounter.participants?.find(candidate => String(candidate.characterId) === source.id);
      return Boolean(participant
        && action.eligibleCharacterIds.some(characterId => String(characterId) === source.id)
        && resolveGameplayMapCandidateSources(map, participant.actions, participant.candidatePoolIds,
          { mode: 'runtime', mapRunFacts: candidateSourceSnapshot?.mapRunFacts })
          .some(candidate => candidate.actionId === actionId));
    }
    if (source.kind === 'enemy') {
      const enemy = encounter.enemies?.find(candidate => candidate.id === source.id);
      return Boolean(enemy
        && resolveGameplayMapCandidateSources(map, enemy.actions, enemy.candidatePoolIds,
          { mode: 'runtime', mapRunFacts: candidateSourceSnapshot?.mapRunFacts })
          .some(candidate => candidate.actionId === actionId));
    }
    if (source.kind === 'ability') {
      return source.actionId === actionId && (encounter.abilityActionIds ?? []).includes(actionId);
    }
    return source.actionId === actionId
      && (encounter.itemActions ?? []).some(itemAction => itemAction.actionId === actionId && itemAction.itemId === source.itemId);
  } catch {
    return false;
  }
}

/** Validate an active Save/Receipt Status list and return an isolated frozen copy, or null. */
export function validateMapEncounterStatusInstances(
  value: unknown,
  options: MapEncounterStatusValidationOptions,
): readonly MapEncounterStatusInstance[] | null {
  if (!Array.isArray(value) || value.length > MAX_STATUS_INSTANCES
    || !Number.isSafeInteger(options.currentRound) || options.currentRound < 1) return null;

  const definitions = new Map((options.map.statuses ?? []).map(status => [status.id, status]));
  const partyIds = new Set(options.map.partyCharacterIds.map(String));
  const enemyIds = new Set((options.encounter.enemies ?? []).map(enemy => enemy.id));
  const seen = new Set<string>();
  const result: MapEncounterStatusInstance[] = [];

  for (const rawStatus of value) {
    if (!isRecord(rawStatus) || !hasExactFields(rawStatus, [
      'holder', 'statusId', 'source', 'actionId', 'appliedRound', 'lastTriggeredRound', 'stacks', 'remainingRounds',
    ])) return null;
    if (!isRecord(rawStatus.holder) || !hasExactFields(rawStatus.holder, ['kind', 'id'])
      || (rawStatus.holder.kind !== 'partyCharacter' && rawStatus.holder.kind !== 'enemy')
      || typeof rawStatus.holder.id !== 'string' || rawStatus.holder.id.length === 0) return null;

    const holder: MapEffectActorIdentity = { kind: rawStatus.holder.kind, id: rawStatus.holder.id };
    if (!(holder.kind === 'partyCharacter' ? partyIds : enemyIds).has(holder.id)) return null;
    if (typeof rawStatus.statusId !== 'string' || typeof rawStatus.actionId !== 'string' || rawStatus.actionId.length === 0) return null;
    const definition = definitions.get(rawStatus.statusId);
    if (!definition) return null;
    if (definition.lifetime === 'mapRun') return null;
    const validBehavior = definition.kind === 'damageReduction'
      ? Number.isSafeInteger(definition.damageReductionPerStack) && definition.damageReductionPerStack > 0
        && definition.category === 'beneficial'
      : definition.kind === 'damageProtection'
        ? definition.category === 'beneficial'
      : (definition.kind === 'burn' || definition.kind === 'regen')
        && Number.isSafeInteger(definition.hpPerStack) && definition.hpPerStack > 0;
    if (!validBehavior || !Number.isSafeInteger(definition.maxStacks) || definition.maxStacks < 1 || definition.maxStacks > 99) return null;

    const source = validateSourceIdentity(rawStatus.source);
    if (!source) return null;
    if ((source.kind === 'partyCharacter' && !partyIds.has(source.id))
      || (source.kind === 'enemy' && !enemyIds.has(source.id))) return null;
    if ((source.kind === 'ability' || source.kind === 'item') && source.actionId !== rawStatus.actionId) return null;

    if (!Number.isSafeInteger(rawStatus.appliedRound) || (rawStatus.appliedRound as number) < 1
      || (rawStatus.appliedRound as number) >= options.currentRound) return null;
    const lastTriggeredRound = rawStatus.lastTriggeredRound;
    if (lastTriggeredRound !== null
      && (!Number.isSafeInteger(lastTriggeredRound)
        || (lastTriggeredRound as number) <= (rawStatus.appliedRound as number)
        || (lastTriggeredRound as number) >= options.currentRound)) return null;
    if (!Number.isSafeInteger(rawStatus.stacks) || (rawStatus.stacks as number) < 1
      || (rawStatus.stacks as number) > definition.maxStacks) return null;
    if (!Number.isSafeInteger(rawStatus.remainingRounds) || (rawStatus.remainingRounds as number) < 1
      || (rawStatus.remainingRounds as number) > MAX_DURATION_ROUNDS) return null;

    const action = options.map.actions?.find(candidate => candidate.id === rawStatus.actionId);
    if (!action || !programAppliesStatus(action, rawStatus.statusId)
      || !sourceCanUseAction(options.map, options.encounter, source, rawStatus.actionId, options.candidateSourceSnapshot)) return null;

    const status: MapEncounterStatusInstance = {
      holder,
      statusId: rawStatus.statusId,
      source,
      actionId: rawStatus.actionId,
      appliedRound: rawStatus.appliedRound as number,
      lastTriggeredRound: lastTriggeredRound as number | null,
      stacks: rawStatus.stacks as number,
      remainingRounds: rawStatus.remainingRounds as number,
    };
    const key = statusIdentityKey(status);
    if (seen.has(key)) return null;
    seen.add(key);
    result.push(status);
  }

  return copyMapEncounterStatusInstances(result);
}

function validateStatusInstanceForTick(
  status: MapEncounterStatusInstance,
  definitions: ReadonlyMap<string, GameplayMapStatusDef>,
  round: number,
  holderOrder: ReadonlyMap<string, number>,
): GameplayMapStatusDef {
  const definition = definitions.get(status.statusId);
  if (!definition) throw new Error(`Status tick references unknown Status "${status.statusId}"`);
  if (!Number.isSafeInteger(status.appliedRound) || status.appliedRound < 1 || status.appliedRound > round
    || !Number.isSafeInteger(status.stacks) || status.stacks < 1 || status.stacks > definition.maxStacks
    || !Number.isSafeInteger(status.remainingRounds) || status.remainingRounds < 1 || status.remainingRounds > MAX_DURATION_ROUNDS
    || (status.lastTriggeredRound !== null
      && (!Number.isSafeInteger(status.lastTriggeredRound)
        || status.lastTriggeredRound <= status.appliedRound || status.lastTriggeredRound > round))) {
    throw new Error(`Status tick received an invalid Status instance "${status.statusId}"`);
  }
  if (!holderOrder.has(JSON.stringify([status.holder.kind, status.holder.id]))) {
    throw new Error(`Status tick holder is not in the active Encounter roster: ${status.holder.kind}:${status.holder.id}`);
  }
  return definition;
}

/** Pure successful-round-end tick for active Encounter-local Status instances. */
export function applyMapEncounterStatusRoundEnd(options: MapEncounterStatusRoundEndOptions): MapEncounterStatusRoundEndPlan {
  if (!Number.isSafeInteger(options.round) || options.round < 1) throw new Error('Status tick requires a positive round');
  if (options.statuses.length > MAX_STATUS_INSTANCES) throw new Error('Encounter Status instance limit of 256 exceeded');

  const definitions = new Map(options.definitions.map(status => [status.id, status]));
  if (definitions.size !== options.definitions.length) throw new Error('Status tick received duplicate Status definitions');
  const holderOrder = new Map<string, number>();
  options.partyOrder.forEach((id, index) => holderOrder.set(JSON.stringify(['partyCharacter', id]), index));
  const enemyOffset = options.partyOrder.length;
  options.enemyOrder.forEach((id, index) => holderOrder.set(JSON.stringify(['enemy', id]), enemyOffset + index));

  const seen = new Set<string>();
  const ordered = options.statuses.map((status, originalIndex) => {
    const definition = validateStatusInstanceForTick(status, definitions, options.round, holderOrder);
    const key = statusIdentityKey(status);
    if (seen.has(key)) throw new Error(`Status tick received duplicate Status identity "${status.statusId}"`);
    seen.add(key);
    return { status, definition, originalIndex, holderOrder: holderOrder.get(JSON.stringify([status.holder.kind, status.holder.id]))! };
  }).sort((left, right) => left.holderOrder - right.holderOrder
    || compareMapEncounterStatusStableOrder(left.status, right.status)
    || left.originalIndex - right.originalIndex);

  const hp = Object.fromEntries(Object.entries(options.hp).map(([key, state]) => [key, { ...state }])) as Record<string, MapEffectHpState>;
  const statuses: MapEncounterStatusInstance[] = options.statuses.map(status => ({
    ...status,
    holder: { ...status.holder },
    source: { ...status.source },
  }));
  const statusTrace: MapEncounterStatusTickTraceEntry[] = [];

  for (const { status, definition } of ordered) {
    if (status.appliedRound === options.round || status.lastTriggeredRound === options.round) continue;
    const hpKey = `${status.holder.kind}:${status.holder.id}`;
    const current = hp[hpKey];
    if (!current || !Number.isSafeInteger(current.current) || !Number.isSafeInteger(current.cap)
      || current.current < 0 || current.cap <= 0 || current.current > current.cap) {
      throw new Error(`Status tick has no valid HP/cap for ${status.holder.kind} "${status.holder.id}"`);
    }
    const mathematicalAmount = definition.kind === 'damageReduction' || definition.kind === 'damageProtection'
      ? 0n
      : BigInt(definition.hpPerStack) * BigInt(status.stacks);
    if (mathematicalAmount > MAX_SAFE_BIGINT) throw new Error(`Status "${status.statusId}" HP amount exceeds the safe integer range`);
    const amount = mathematicalAmount;
    const before = current.current;
    let after = before;
    if (before > 0) {
      if (definition.kind === 'burn') {
        const proposed = BigInt(before) - amount;
        after = Number(proposed <= 0n ? 0n : proposed);
      } else if (definition.kind === 'regen') {
        const proposed = BigInt(before) + amount;
        after = Number(proposed >= BigInt(current.cap) ? BigInt(current.cap) : proposed);
      }
    }
    hp[hpKey] = { ...current, current: after };
    const remainingRoundsAfter = status.remainingRounds - 1;
    const removed = remainingRoundsAfter === 0;
    const updated: MapEncounterStatusInstance = {
      ...status,
      holder: { ...status.holder },
      source: { ...status.source },
      lastTriggeredRound: options.round,
      remainingRounds: remainingRoundsAfter,
    };
    const statusIndex = statuses.findIndex(candidate => statusIdentityKey(candidate) === statusIdentityKey(status));
    if (statusIndex < 0) throw new Error(`Status tick could not locate "${status.statusId}" for update`);
    if (removed) statuses.splice(statusIndex, 1);
    else statuses[statusIndex] = updated;

    statusTrace.push({
      kind: 'roundEnd',
      round: options.round,
      holder: { ...status.holder },
      statusId: status.statusId,
      source: { ...status.source },
      actionId: status.actionId,
      statusKind: definition.kind,
      statusIndexBefore: statusIndex,
      statusBefore: {
        ...status,
        holder: { ...status.holder },
        source: { ...status.source },
      },
      statusAfter: removed ? null : {
        ...updated,
        holder: { ...updated.holder },
        source: { ...updated.source },
      },
      stacks: status.stacks,
      appliedRound: status.appliedRound,
      lastTriggeredRoundBefore: status.lastTriggeredRound,
      lastTriggeredRoundAfter: options.round,
      remainingRoundsBefore: status.remainingRounds,
      remainingRoundsAfter: remainingRoundsAfter,
      hpBefore: before,
      hpAfter: after,
      hpDelta: after - before,
      removed,
    });
  }

  return {
    hp: Object.freeze(hp),
    statuses: copyMapEncounterStatusInstances(statuses),
    trace: Object.freeze(statusTrace.map(entry => Object.freeze({
      ...entry,
      holder: Object.freeze({ ...entry.holder }),
      source: Object.freeze({ ...entry.source }),
      statusBefore: Object.freeze({ ...entry.statusBefore, holder: Object.freeze({ ...entry.statusBefore.holder }), source: Object.freeze({ ...entry.statusBefore.source }) }),
      statusAfter: entry.statusAfter === null ? null : Object.freeze({ ...entry.statusAfter, holder: Object.freeze({ ...entry.statusAfter.holder }), source: Object.freeze({ ...entry.statusAfter.source }) }),
    }))),
  };
}

/** Tick local and MapRun Statuses together in one deterministic order and split their owners afterward. */
export function applyMapStatusRoundEnd(options: MapStatusRoundEndOptions): MapStatusRoundEndPlan {
  if (!Number.isSafeInteger(options.commitVersion) || options.commitVersion < 0
    || !Number.isSafeInteger(options.round) || options.round < 1) throw new Error('Status tick requires valid clocks');
  const local = options.statuses.map(status => ({ ...status, holder: { ...status.holder }, source: { ...status.source } }));
  const persistent = (options.mapRunStatuses ?? []).map(status => ({ ...status, holder: { ...status.holder }, source: { ...status.source } }));
  if (local.length + persistent.length > MAX_STATUS_INSTANCES) throw new Error('MapRun Status instance limit of 256 exceeded');
  const definitions = new Map(options.definitions.map(status => [status.id, status]));
  if (definitions.size !== options.definitions.length) throw new Error('Status tick received duplicate Status definitions');
  const holderOrder = new Map<string, number>();
  options.partyOrder.forEach((id, index) => holderOrder.set(JSON.stringify(['partyCharacter', id]), index));
  const enemyOffset = options.partyOrder.length;
  options.enemyOrder.forEach((id, index) => holderOrder.set(JSON.stringify(['enemy', id]), enemyOffset + index));
  const seen = new Set<string>();
  const ordered = [
    ...local.map((status, originalIndex) => ({ status, owner: 'encounter' as const, originalIndex })),
    ...persistent.map((status, originalIndex) => ({ status, owner: 'mapRun' as const, originalIndex })),
  ].map(row => {
    const definition = definitions.get(row.status.statusId);
    if (!definition || (definition.lifetime === 'mapRun') !== (row.owner === 'mapRun')) {
      throw new Error('Status ' + row.status.statusId + ' is stored in the wrong lifetime ledger');
    }
    const identityKey = statusIdentityKey(row.status);
    if (seen.has(identityKey)) throw new Error('Duplicate Status identity ' + row.status.statusId);
    seen.add(identityKey);
    const holderIndex = holderOrder.get(JSON.stringify([row.status.holder.kind, row.status.holder.id]));
    if (holderIndex === undefined) throw new Error('Status holder is not in the active roster');
    if (row.owner === 'mapRun') {
      const runStatus = row.status as MapRunStatusInstance;
      if (!Number.isSafeInteger(runStatus.appliedCommitVersion) || runStatus.appliedCommitVersion < 0
        || runStatus.appliedCommitVersion > options.commitVersion
        || !(runStatus.lastTriggeredCommitVersion === null
          || (Number.isSafeInteger(runStatus.lastTriggeredCommitVersion)
            && runStatus.lastTriggeredCommitVersion < options.commitVersion))) {
        throw new Error('MapRun Status ' + row.status.statusId + ' has an invalid commit clock');
      }
    } else if (!Number.isSafeInteger(row.status.appliedRound) || row.status.appliedRound < 1
      || row.status.appliedRound > options.round) {
      throw new Error('Encounter Status ' + row.status.statusId + ' has an invalid round clock');
    }
    if (!Number.isSafeInteger(row.status.stacks) || row.status.stacks < 1 || row.status.stacks > definition.maxStacks
      || !Number.isSafeInteger(row.status.remainingRounds) || row.status.remainingRounds < 1
      || row.status.remainingRounds > MAX_DURATION_ROUNDS) {
      throw new Error('Status ' + row.status.statusId + ' has invalid stacks or duration');
    }
    return { ...row, definition, holderIndex };
  }).sort((left, right) => left.holderIndex - right.holderIndex
    || compareMapEncounterStatusStableOrder(left.status, right.status)
    || left.originalIndex - right.originalIndex);
  const hp = Object.fromEntries(Object.entries(options.hp).map(([key, value]) => [key, { ...value }])) as Record<string, MapEffectHpState>;
  const trace: MapEffectStatusTickTraceEntry[] = [];
  for (const row of ordered) {
    const status = row.status;
    const shouldSkip = row.owner === 'mapRun'
      ? (status as MapRunStatusInstance).appliedCommitVersion >= options.commitVersion
        || (status as MapRunStatusInstance).lastTriggeredCommitVersion === options.commitVersion
      : status.appliedRound === options.round || status.lastTriggeredRound === options.round;
    if (shouldSkip) continue;
    const hpKey = status.holder.kind + ':' + status.holder.id;
    const current = hp[hpKey];
    if (!current || !Number.isSafeInteger(current.current) || !Number.isSafeInteger(current.cap)
      || current.current < 0 || current.cap <= 0 || current.current > current.cap) {
      throw new Error('Status tick has no valid HP/cap for ' + hpKey);
    }
    const amount = row.definition.kind === 'burn' || row.definition.kind === 'regen'
      ? BigInt(row.definition.hpPerStack) * BigInt(status.stacks) : 0n;
    if (amount > MAX_SAFE_BIGINT) throw new Error('Status ' + status.statusId + ' amount exceeds the safe integer range');
    const before = current.current;
    let after = before;
    if (before > 0 && row.definition.kind === 'burn') after = Number(BigInt(before) - amount <= 0n ? 0n : BigInt(before) - amount);
    else if (before > 0 && row.definition.kind === 'regen') after = Number(BigInt(before) + amount >= BigInt(current.cap) ? BigInt(current.cap) : BigInt(before) + amount);
    hp[hpKey] = { ...current, current: after };
    const remainingRoundsAfter = status.remainingRounds - 1;
    const removed = remainingRoundsAfter === 0;
    if (row.owner === 'mapRun') {
      const beforeStatus = status as MapRunStatusInstance;
      const afterStatus: MapRunStatusInstance = { ...beforeStatus, remainingRounds: remainingRoundsAfter,
        lastTriggeredCommitVersion: options.commitVersion };
      const index = persistent.findIndex(candidate => statusIdentityKey(candidate) === statusIdentityKey(status));
      if (index < 0) throw new Error('MapRun Status ' + status.statusId + ' could not be updated');
      if (removed) persistent.splice(index, 1); else persistent[index] = afterStatus;
      const entry: MapRunStatusTickTraceEntry = {
        kind: 'mapRunRoundEnd', round: options.round, commitVersion: options.commitVersion,
        holder: { ...status.holder }, statusId: status.statusId, source: { ...status.source }, actionId: status.actionId,
        statusKind: row.definition.kind, statusIndexBefore: index, statusBefore: beforeStatus,
        statusAfter: removed ? null : afterStatus, stacks: status.stacks,
        appliedCommitVersion: beforeStatus.appliedCommitVersion,
        lastTriggeredCommitVersionBefore: beforeStatus.lastTriggeredCommitVersion,
        lastTriggeredCommitVersionAfter: options.commitVersion, remainingRoundsBefore: status.remainingRounds,
        remainingRoundsAfter, hpBefore: before, hpAfter: after, hpDelta: after - before, removed,
      };
      trace.push(entry);
    } else {
      const afterStatus: MapEncounterStatusInstance = { ...status, remainingRounds: remainingRoundsAfter, lastTriggeredRound: options.round };
      const index = local.findIndex(candidate => statusIdentityKey(candidate) === statusIdentityKey(status));
      if (index < 0) throw new Error('Encounter Status ' + status.statusId + ' could not be updated');
      if (removed) local.splice(index, 1); else local[index] = afterStatus;
      const entry: MapEncounterStatusTickTraceEntry = {
        kind: 'roundEnd', round: options.round, holder: { ...status.holder }, statusId: status.statusId,
        source: { ...status.source }, actionId: status.actionId, statusKind: row.definition.kind,
        statusIndexBefore: index, statusBefore: { ...status }, statusAfter: removed ? null : { ...afterStatus },
        stacks: status.stacks, appliedRound: status.appliedRound, lastTriggeredRoundBefore: status.lastTriggeredRound,
        lastTriggeredRoundAfter: options.round, remainingRoundsBefore: status.remainingRounds,
        remainingRoundsAfter, hpBefore: before, hpAfter: after, hpDelta: after - before, removed,
      };
      trace.push(entry);
    }
  }
  return {
    hp: Object.freeze(hp),
    encounterStatuses: copyMapEncounterStatusInstances(local),
    mapRunStatuses: copyMapRunStatusInstances(persistent),
    trace: Object.freeze(trace),
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

const STATUS_TICK_TRACE_FIELDS = [
  'kind', 'round', 'holder', 'statusId', 'source', 'actionId', 'statusKind', 'statusIndexBefore',
  'statusBefore', 'statusAfter', 'stacks', 'appliedRound', 'lastTriggeredRoundBefore',
  'lastTriggeredRoundAfter', 'remainingRoundsBefore', 'remainingRoundsAfter',
  'hpBefore', 'hpAfter', 'hpDelta', 'removed',
] as const;

function isStatusInstance(value: unknown): value is MapEncounterStatusInstance {
  if (!isRecord(value) || !hasExactFields(value, [
    'holder', 'statusId', 'source', 'actionId', 'appliedRound', 'lastTriggeredRound', 'stacks', 'remainingRounds',
  ])) return false;
  const source = validateSourceIdentity(value.source);
  return isRecord(value.holder)
    && hasExactFields(value.holder, ['kind', 'id'])
    && (value.holder.kind === 'partyCharacter' || value.holder.kind === 'enemy')
    && typeof value.holder.id === 'string' && value.holder.id.length > 0
    && typeof value.statusId === 'string' && value.statusId.length > 0
    && source !== null
    && typeof value.actionId === 'string' && value.actionId.length > 0
    && Number.isSafeInteger(value.appliedRound) && (value.appliedRound as number) >= 1
    && (value.lastTriggeredRound === null || (Number.isSafeInteger(value.lastTriggeredRound) && (value.lastTriggeredRound as number) >= 1))
    && Number.isSafeInteger(value.stacks) && (value.stacks as number) >= 1
    && Number.isSafeInteger(value.remainingRounds) && (value.remainingRounds as number) >= 1;
}

function parseStatusTickTrace(value: unknown, round: number): MapEffectStatusTickTraceEntry | null {
  if (!isRecord(value) || !hasExactFields(value, STATUS_TICK_TRACE_FIELDS)) return null;
  if (value.kind !== 'roundEnd' || value.round !== round
    || !isRecord(value.holder) || !hasExactFields(value.holder, ['kind', 'id'])
    || (value.holder.kind !== 'partyCharacter' && value.holder.kind !== 'enemy')
    || typeof value.holder.id !== 'string' || value.holder.id.length === 0) return null;
  const source = validateSourceIdentity(value.source);
  if (!source || typeof value.statusId !== 'string' || typeof value.actionId !== 'string' || value.actionId.length === 0
    || (value.statusKind !== 'burn' && value.statusKind !== 'regen'
      && value.statusKind !== 'damageReduction' && value.statusKind !== 'damageProtection')
    || !Number.isSafeInteger(value.statusIndexBefore) || (value.statusIndexBefore as number) < 0
    || !isStatusInstance(value.statusBefore)
    || !(value.statusAfter === null || isStatusInstance(value.statusAfter))
    || !Number.isSafeInteger(value.stacks) || (value.stacks as number) < 1
    || !Number.isSafeInteger(value.appliedRound) || (value.appliedRound as number) < 1
    || !(value.lastTriggeredRoundBefore === null || Number.isSafeInteger(value.lastTriggeredRoundBefore))
    || value.lastTriggeredRoundAfter !== round
    || !Number.isSafeInteger(value.remainingRoundsBefore) || (value.remainingRoundsBefore as number) < 1
    || !Number.isSafeInteger(value.remainingRoundsAfter) || (value.remainingRoundsAfter as number) < 0
    || !Number.isSafeInteger(value.hpBefore) || (value.hpBefore as number) < 0
    || !Number.isSafeInteger(value.hpAfter) || (value.hpAfter as number) < 0
    || !Number.isSafeInteger(value.hpDelta) || typeof value.removed !== 'boolean') return null;
  const holder: MapEffectActorIdentity = { kind: value.holder.kind, id: value.holder.id };
  const before = value.statusBefore;
  if (stableJson(before.holder) !== stableJson(holder)
    || before.statusId !== value.statusId || stableJson(before.source) !== stableJson(source)
    || before.actionId !== value.actionId || before.appliedRound !== value.appliedRound
    || before.stacks !== value.stacks || before.lastTriggeredRound !== value.lastTriggeredRoundBefore
    || before.remainingRounds !== value.remainingRoundsBefore
    || (value.hpAfter as number) - (value.hpBefore as number) !== value.hpDelta
    || value.remainingRoundsAfter !== (value.remainingRoundsBefore as number) - 1
    || value.removed !== (value.remainingRoundsAfter === 0)
    || value.removed !== (value.statusAfter === null)) return null;
  if (value.statusAfter !== null) {
    const after = value.statusAfter;
    if (stableJson(after.holder) !== stableJson(holder) || after.statusId !== value.statusId
      || stableJson(after.source) !== stableJson(source) || after.actionId !== value.actionId
      || after.appliedRound !== value.appliedRound || after.stacks !== value.stacks
      || after.lastTriggeredRound !== round || after.remainingRounds !== value.remainingRoundsAfter) return null;
  }
  return value as unknown as MapEffectStatusTickTraceEntry;
}

/** Reverse the tick entries from a Receipt's successor Status/HP values to the exact pre-tick plan. */
export function reverseMapEncounterStatusTrace(
  receiptStatuses: readonly MapEncounterStatusInstance[],
  receiptHp: Readonly<Record<string, MapEffectHpState>>,
  rawStatusTrace: unknown,
  round: number,
): MapEncounterStatusPreTickState | null {
  if (!Array.isArray(rawStatusTrace) || rawStatusTrace.length > MAX_STATUS_INSTANCES) return null;
  const trace = rawStatusTrace.map(entry => parseStatusTickTrace(entry, round));
  if (trace.some(entry => entry === null)) return null;
  const statuses = receiptStatuses.map(status => ({
    ...status,
    holder: { ...status.holder },
    source: { ...status.source },
  }));
  const hp = Object.fromEntries(Object.entries(receiptHp).map(([key, state]) => [key, { ...state }])) as Record<string, MapEffectHpState>;

  for (let index = trace.length - 1; index >= 0; index -= 1) {
    const entry = trace[index]!;
    const key = statusIdentityKey(entry.statusBefore);
    const matchingIndexes = statuses.flatMap((status, statusIndex) => statusIdentityKey(status) === key ? [statusIndex] : []);
    if (entry.statusAfter === null) {
      if (matchingIndexes.length !== 0) return null;
    } else {
      if (matchingIndexes.length !== 1 || stableJson(statuses[matchingIndexes[0]!]) !== stableJson(entry.statusAfter)) return null;
      statuses.splice(matchingIndexes[0]!, 1);
    }
    if (entry.statusIndexBefore > statuses.length) return null;
    statuses.splice(entry.statusIndexBefore, 0, {
      ...entry.statusBefore,
      holder: { ...entry.statusBefore.holder },
      source: { ...entry.statusBefore.source },
    });

    const hpKey = `${entry.holder.kind}:${entry.holder.id}`;
    const current = hp[hpKey];
    if (!current || current.current !== entry.hpAfter || current.current < 0 || current.current > current.cap) return null;
    hp[hpKey] = { ...current, current: entry.hpBefore };
  }

  return {
    statuses: copyMapEncounterStatusInstances(statuses),
    hp: Object.freeze(hp),
  };
}

/** Recompute the round-end Status plan and reject non-canonical or tampered Receipt evidence. */
export function validateMapEncounterStatusTrace(
  options: MapEncounterStatusTraceValidationOptions,
): MapEncounterStatusRoundEndPlan | null {
  if (![1, 2, 3, 4, 5, 6].includes(options.statusReceiptVersion as number) || !Array.isArray(options.statusTrace)
    || typeof options.tickSkipped !== 'boolean') return null;
  try {
    if (options.tickSkipped) {
      if (options.statusTrace.length !== 0 || options.plannedStatuses.length !== 0) return null;
      return {
        hp: Object.freeze(Object.fromEntries(Object.entries(options.receiptHp).map(([key, state]) => [key, { ...state }]))),
        statuses: copyMapEncounterStatusInstances(options.plannedStatuses),
        trace: Object.freeze([] as MapEncounterStatusTickTraceEntry[]),
      };
    }
    const reversed = reverseMapEncounterStatusTrace(options.plannedStatuses, options.receiptHp, options.statusTrace, options.round);
    if (!reversed) return null;
    const expected = applyMapEncounterStatusRoundEnd({
      round: options.round,
      definitions: options.definitions,
      statuses: reversed.statuses,
      hp: reversed.hp,
      partyOrder: options.partyOrder,
      enemyOrder: options.enemyOrder,
    });
    if (stableJson(options.statusTrace) !== stableJson(expected.trace)
      || stableJson(options.plannedStatuses) !== stableJson(expected.statuses)
      || stableJson(options.receiptHp) !== stableJson(expected.hp)) return null;
    return expected;
  } catch {
    return null;
  }
}
