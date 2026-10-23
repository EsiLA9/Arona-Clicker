import type {
  MapEffectAccountIdentity,
  MapEffectActorIdentity,
  MapEffectDamageReductionTrace,
  MapEffectDamageProtectionTrace,
  MapEffectGuardRead,
  MapEffectHpState,
  MapEffectMapRunFactsInput,
  MapEffectMapRunFactsState,
  MapEffectPlannerOptions,
  MapEffectRandomState,
  MapEffectResourceLedgerEntry,
  MapEffectShieldTraceEntry,
  MapEffectSourcePlan,
  MapEffectStatusApplyTraceEntry,
  MapEffectStatusConsumeTraceEntry,
  MapEffectStatusCategoryRemoveTraceEntry,
  MapEffectStatusRemoveTraceEntry,
  MapEffectStatusDamageTriggerTraceEntry,
  MapEffectTraceEntry,
  MapEffectTriggerTraceEntry,
  MapEncounterStatusInstance,
} from '../../contracts/map/map-effects';
import type {
  GameplayMapEffectBalanceAccount,
  GameplayMapEffectWriteAccount,
  GameplayMapEffectTargetSetDef,
  GameplayMapEffectValueDef,
  GameplayMapEffectLoopValueDef,
} from '../../../data-services/contracts/gameplay-map-effects';
import type { GameplayMapStatusDef } from '../../../data-services/contracts/gameplay-map';
import { GAMEPLAY_MAP_EFFECT_LIMITS } from '../../../data-services/contracts/gameplay-map-effects';
import type {
  NormalizedGameplayMapEffectCondition,
  NormalizedGameplayMapEffectInstruction,
  NormalizedGameplayMapEffectLoopCondition,
  NormalizedGameplayMapEffectLoopInstruction,
} from '../../../data-services/normalization/gameplay-map-effect-program';
import { compareMapEncounterStatusStableOrder, copyMapEncounterStatusInstances } from './map-encounter-statuses';
import {
  copyMapEffectRandomState,
  MAP_EFFECT_RANDOM_ALGORITHM,
  MapEffectRandomError,
  sampleMapEffectRandomSubset,
} from './gameplay-b-effect-rng';
import { matchesTag, parseTagRef } from '../../../engine/core/tag';
import type { TagRef, TagPath } from '../../../engine/core/tag';

export class MapEffectPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapEffectPlanError';
  }
}

const identityKey = (identity: MapEffectActorIdentity) => `${identity.kind}:${identity.id}`;
function tagRefPath(value: TagRef): TagPath | null {
  const parsed = parseTagRef(value);
  return parsed ? [`${parsed.modName}:${parsed.path[0]}`, ...parsed.path.slice(1)] : null;
}
function matchesTagRef(declared: TagRef, query: TagRef): boolean {
  const declaredPath = tagRefPath(declared);
  const queryPath = tagRefPath(query);
  return !!declaredPath && !!queryPath && matchesTag(declaredPath, queryPath);
}
const statusSourceKey = (source: NonNullable<MapEffectPlannerOptions['input']['sourceIdentity']>, actionId: string): string => {
  switch (source.kind) {
    case 'partyCharacter':
    case 'enemy': return JSON.stringify([source.kind, source.id, actionId]);
    case 'ability': return JSON.stringify([source.kind, source.actionId, actionId]);
    case 'item': return JSON.stringify([source.kind, source.actionId, source.itemId, actionId]);
  }
};
const statusInstanceKey = (status: MapEncounterStatusInstance): string => JSON.stringify([
  status.holder.kind,
  status.holder.id,
  status.statusId,
  statusSourceKey(status.source, status.actionId),
]);
const cloneLocals = (locals: MapEffectPlannerOptions['input']['locals']) => ({
  counters: Object.fromEntries(Object.entries(locals.counters).map(([id, value]) => [id, { ...value }])),
  flags: { ...locals.flags },
});

type MutableMapRunFacts = {
  readonly counterOrder: readonly string[];
  readonly flagOrder: readonly string[];
  readonly counters: Map<string, { value: number; min: number; max: number }>;
  readonly flags: Map<string, boolean>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every(key => keys.includes(key));
}

function validLocalId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function cloneMapRunFacts(input: MapEffectMapRunFactsInput | undefined, actionId: string): MutableMapRunFacts | null {
  if (input === undefined) return null;
  if (!isRecord(input) || !hasExactKeys(input, ['declarations', 'state'])
    || !isRecord(input.declarations)
    || Object.keys(input.declarations).some(key => key !== 'counters' && key !== 'flags')) {
    throw new MapEffectPlanError(`Action "${actionId}" has an invalid MapRun Facts snapshot`);
  }
  const declarations = input.declarations as Record<string, unknown>;
  const state: unknown = input.state;
  const declaredCounters: unknown = declarations.counters ?? [];
  const declaredFlags: unknown = declarations.flags ?? [];
  if (!Array.isArray(declaredCounters) || !Array.isArray(declaredFlags)
    || !isRecord(state) || !hasExactKeys(state, ['counters', 'flags'])
    || !Array.isArray(state.counters) || !Array.isArray(state.flags)) {
    throw new MapEffectPlanError(`Action "${actionId}" has an invalid MapRun Facts declaration or state`);
  }
  if (declaredCounters.length + declaredFlags.length > GAMEPLAY_MAP_EFFECT_LIMITS.locals) {
    throw new MapEffectPlanError(`Action "${actionId}" exceeds the MapRun Facts limit of ${GAMEPLAY_MAP_EFFECT_LIMITS.locals}`);
  }

  const counters = new Map<string, { value: number; min: number; max: number }>();
  const flags = new Map<string, boolean>();
  const ids = new Set<string>();
  for (const [index, raw] of declaredCounters.entries()) {
    if (!isRecord(raw) || !hasExactKeys(raw, ['id', 'initial', 'min', 'max'])
      || !validLocalId(raw.id) || ids.has(raw.id)
      || !Number.isSafeInteger(raw.initial) || !Number.isSafeInteger(raw.min) || !Number.isSafeInteger(raw.max)
      || (raw.min as number) > (raw.max as number)
      || (raw.initial as number) < (raw.min as number) || (raw.initial as number) > (raw.max as number)) {
      throw new MapEffectPlanError(`Action "${actionId}" has an invalid or duplicate MapRun Fact Counter declaration at index ${index}`);
    }
    const value = state.counters[index];
    if (!isRecord(value) || !hasExactKeys(value, ['id', 'value']) || value.id !== raw.id
      || !Number.isSafeInteger(value.value) || (value.value as number) < (raw.min as number)
      || (value.value as number) > (raw.max as number)) {
      throw new MapEffectPlanError(`Action "${actionId}" has a missing or invalid MapRun Counter "${raw.id}" state`);
    }
    ids.add(raw.id);
    counters.set(raw.id, { value: value.value as number, min: raw.min as number, max: raw.max as number });
  }
  if (state.counters.length !== declaredCounters.length) {
    throw new MapEffectPlanError(`Action "${actionId}" has an undeclared or duplicate MapRun Counter state`);
  }
  for (const [index, raw] of declaredFlags.entries()) {
    if (!isRecord(raw) || !hasExactKeys(raw, ['id', 'initial'])
      || !validLocalId(raw.id) || ids.has(raw.id) || typeof raw.initial !== 'boolean') {
      throw new MapEffectPlanError(`Action "${actionId}" has an invalid or duplicate MapRun Fact Flag declaration at index ${index}`);
    }
    const value = state.flags[index];
    if (!isRecord(value) || !hasExactKeys(value, ['id', 'value']) || value.id !== raw.id
      || typeof value.value !== 'boolean') {
      throw new MapEffectPlanError(`Action "${actionId}" has a missing or invalid MapRun Flag "${raw.id}" state`);
    }
    ids.add(raw.id);
    flags.set(raw.id, value.value);
  }
  if (state.flags.length !== declaredFlags.length) {
    throw new MapEffectPlanError(`Action "${actionId}" has an undeclared or duplicate MapRun Flag state`);
  }
  return {
    counterOrder: declaredCounters.map(value => (value as { id: string }).id),
    flagOrder: declaredFlags.map(value => (value as { id: string }).id),
    counters,
    flags,
  };
}

function validateResourceBalanceSnapshot(snapshot: unknown, actionId: string): void {
  if (!isRecord(snapshot) || !hasExactKeys(snapshot, ['actors', 'teams'])
    || !isRecord(snapshot.actors) || !isRecord(snapshot.teams)) {
    throw new MapEffectPlanError(`Action "${actionId}" has an invalid resource balance snapshot`);
  }
  for (const [actorKey, rawBalances] of Object.entries(snapshot.actors)) {
    const separator = actorKey.indexOf(':');
    const kind = actorKey.slice(0, separator);
    const id = actorKey.slice(separator + 1);
    if (separator <= 0 || !id || (kind !== 'partyCharacter' && kind !== 'enemy') || !isRecord(rawBalances)) {
      throw new MapEffectPlanError(`Action "${actionId}" has an invalid Actor resource account "${actorKey}"`);
    }
    for (const [resourceId, value] of Object.entries(rawBalances)) {
      if (!validLocalId(resourceId) || !Number.isSafeInteger(value) || (value as number) < 0) {
        throw new MapEffectPlanError(`Action "${actionId}" has an invalid Actor resource balance for "${actorKey}"`);
      }
    }
  }
  for (const [side, rawBalances] of Object.entries(snapshot.teams)) {
    if ((side !== 'party' && side !== 'enemy') || !isRecord(rawBalances)) {
      throw new MapEffectPlanError(`Action "${actionId}" has an invalid Team resource account "${side}"`);
    }
    for (const [resourceId, value] of Object.entries(rawBalances)) {
      if (!validLocalId(resourceId) || !Number.isSafeInteger(value) || (value as number) < 0) {
        throw new MapEffectPlanError(`Action "${actionId}" has an invalid Team resource balance for "${side}"`);
      }
    }
  }
}

function validHp(hp: MapEffectHpState | undefined, identity: MapEffectActorIdentity, actionId: string): MapEffectHpState {
  if (!hp || !Number.isSafeInteger(hp.current) || !Number.isSafeInteger(hp.cap)
    || hp.current < 0 || hp.cap <= 0 || hp.current > hp.cap) {
    throw new MapEffectPlanError(`Action "${actionId}" has no valid HP/cap for ${identity.kind} "${identity.id}"`);
  }
  return hp;
}

function compareNumber(current: number, comparison: string, value: number): boolean {
  switch (comparison) {
    case 'eq': return current === value;
    case 'lt': return current < value;
    case 'lte': return current <= value;
    case 'gt': return current > value;
    case 'gte': return current >= value;
    default: throw new MapEffectPlanError(`Unknown Counter comparison "${comparison}"`);
  }
}

function checkedCounter(value: MapEffectPlannerOptions['input']['locals']['counters'][string] | undefined, id: string, actionId: string) {
  if (!value || !Number.isSafeInteger(value.value) || !Number.isSafeInteger(value.min)
    || !Number.isSafeInteger(value.max) || value.min > value.max
    || value.value < value.min || value.value > value.max) {
    throw new MapEffectPlanError(`Action "${actionId}" has no valid Counter "${id}" state`);
  }
  return value;
}

export function planMapEffectSource(options: MapEffectPlannerOptions): MapEffectSourcePlan {
  const { input, effects } = options;
  let effectRandomState: MapEffectRandomState | undefined;
  if (input.effectRandomState !== undefined) {
    try {
      effectRandomState = copyMapEffectRandomState(input.effectRandomState);
    } catch (error) {
      throw new MapEffectPlanError(`Action "${input.actionId}" has invalid Effect Random state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const mapRunFacts = cloneMapRunFacts(input.mapRunFacts, input.actionId);
  if (input.resourceBalances !== undefined) validateResourceBalanceSnapshot(input.resourceBalances, input.actionId);
  const preparedCharacters = new Set<string>();
  for (const prepared of input.preparedPartyTagSources) {
    if (!prepared.characterId || !prepared.actionId || !['hand', 'playerCommand'].includes(prepared.origin)
      || preparedCharacters.has(prepared.characterId)
      || (input.targetOrder !== undefined && !input.targetOrder.party.includes(prepared.characterId))) {
      throw new MapEffectPlanError('Prepared Party Tag snapshot contains an invalid or duplicate source');
    }
    preparedCharacters.add(prepared.characterId);
    if (prepared.tags.some(tag => !tagRefPath(tag))) {
      throw new MapEffectPlanError(`Prepared Party Tag snapshot contains an invalid TagRef for Action "${prepared.actionId}"`);
    }
  }
  if ((input.statuses?.length ?? 0) > 256) {
    throw new MapEffectPlanError('Encounter Status instance limit of 256 exceeded');
  }
  const hp = Object.fromEntries(Object.entries(input.hp).map(([key, value]) => [key, { ...value }])) as Record<string, MapEffectHpState>;
  let shields: Record<string, number> | undefined;
  if (input.shields !== undefined) {
    if (!isRecord(input.shields)) throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid Shield ledger`);
    shields = {};
    for (const [key, value] of Object.entries(input.shields)) {
      const separator = key.indexOf(':');
      const kind = key.slice(0, separator);
      const id = key.slice(separator + 1);
      if (separator <= 0 || (kind !== 'partyCharacter' && kind !== 'enemy') || !validLocalId(id)
        || key !== `${kind}:${id}` || !Number.isSafeInteger(value) || (value as number) <= 0) {
        throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid Shield pool for "${key}"`);
      }
      const identity: MapEffectActorIdentity = { kind, id };
      if (!Object.prototype.hasOwnProperty.call(hp, key)) {
        throw new MapEffectPlanError(`Action "${input.actionId}" Shield pool "${key}" does not resolve to an Actor`);
      }
      validHp(hp[key], identity, input.actionId);
      shields[key] = value as number;
    }
  }
  if (input.additionalTarget !== undefined && input.additionalTarget !== null) {
    const identity = input.additionalTarget;
    if (!isRecord(identity) || !hasExactKeys(identity, ['kind', 'id'])
      || (identity.kind !== 'partyCharacter' && identity.kind !== 'enemy') || !validLocalId(identity.id)) {
      throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid additional target identity`);
    }
    validHp(hp[identityKey(identity as MapEffectActorIdentity)], identity as MapEffectActorIdentity, input.actionId);
    if ((input.primary?.kind === identity.kind && input.primary.id === identity.id)
      || (input.source?.kind === 'partyCharacter' && identity.kind === 'partyCharacter' && input.source.id === identity.id)) {
      throw new MapEffectPlanError(`Action "${input.actionId}" additional target must differ from its source and primary`);
    }
  }
  const locals = cloneLocals(input.locals);
  const resourceLedger: MapEffectResourceLedgerEntry[] = [];
  const triggerTrace: MapEffectTriggerTraceEntry[] = [];
  const statusDamageTriggerTrace: MapEffectStatusDamageTriggerTraceEntry[] = [];
  const triggerEvents: (
    | { readonly event: 'healApplied'; readonly hitGroup: number; readonly path: string; readonly target: MapEffectActorIdentity; readonly requestedAmount: number; readonly actualAppliedAmount: number }
    | { readonly event: 'damageApplied'; readonly hitGroup: number; readonly statusDamageEligible: boolean; readonly path: string; readonly target: MapEffectActorIdentity; readonly requestedAmount: number; readonly actualAppliedAmount: number; readonly hitStatuses: readonly MapEncounterStatusInstance[] }
    | { readonly event: 'enemyDefeated'; readonly hitGroup: number; readonly path: string; readonly target: { readonly kind: 'enemy'; readonly id: string }; readonly rewardRecipient: { readonly kind: 'partyCharacter'; readonly id: string }; readonly requestedAmount: number; readonly actualAppliedAmount: number }
  )[] = [];
  let nextTriggerHitGroup = 1;
  const cardEffectModifierIntents: MapEffectSourcePlan['cardEffectModifierIntents'][number][] = [];
  const trace: MapEffectTraceEntry[] = [];
  const shieldTrace: MapEffectShieldTraceEntry[] = [];
  const plannedStatuses: MapEncounterStatusInstance[] = (input.statuses ?? []).map(status => ({
    ...status,
    holder: { ...status.holder },
    source: { ...status.source },
  }));
  const statusApplyTrace: MapEffectStatusApplyTraceEntry[] = [];
  const statusRemoveTrace: MapEffectStatusRemoveTraceEntry[] = [];
  const statusCategoryRemoveTrace: MapEffectStatusCategoryRemoveTraceEntry[] = [];
  const statusConsumeTrace: MapEffectStatusConsumeTraceEntry[] = [];
  let expansionCount = 0;
  let loopTarget: MapEffectActorIdentity | null = null;
  let loopTargetCount = 1;
  const instructions = options.instructions ?? effects.resolve;
  const pendingModifier = options.pendingCardEffectModifier;
  if (pendingModifier !== undefined && (typeof pendingModifier.sourceKey !== 'string' || !pendingModifier.sourceKey
    || typeof pendingModifier.actionId !== 'string' || !pendingModifier.actionId
    || !Number.isSafeInteger(pendingModifier.delta) || pendingModifier.delta === 0)) {
    throw new MapEffectPlanError('Pending card effect modifier has invalid source identity or delta');
  }
  if (pendingModifier !== undefined && (instructions.length !== 1
    || (instructions[0]?.op !== 'damage' && instructions[0]?.op !== 'heal')
    || !instructions[0]?.originPath.endsWith('.effectProgram.resolve[0]'))) {
    throw new MapEffectPlanError('Pending card effect modifier requires exactly one top-level damage or heal statement');
  }
  if (effects.budget === 'program-4096' && !options.visit) {
    throw new MapEffectPlanError(`Action "${input.actionId}" requires the outer round visit-budget entry`);
  }
  const actorFor = (unit: 'source' | 'primary' | 'loopTarget') => {
    if (unit === 'loopTarget') {
      if (!loopTarget) throw new MapEffectPlanError(`Action "${input.actionId}" has no bound loopTarget identity`);
      return loopTarget;
    }
    const identity = unit === 'source' ? input.source : input.primary;
    if (!identity) throw new MapEffectPlanError(`Action "${input.actionId}" has no bound ${unit} identity`);
    return identity;
  };
  const checkedMapRunCounter = (id: string) => {
    const counter = mapRunFacts?.counters.get(id);
    if (!counter) throw new MapEffectPlanError(`Action "${input.actionId}" reads or writes missing MapRun Counter "${id}"`);
    return counter;
  };
  const checkedMapRunFlag = (id: string) => {
    const value = mapRunFacts?.flags.get(id);
    if (typeof value !== 'boolean') throw new MapEffectPlanError(`Action "${input.actionId}" reads or writes missing MapRun Flag "${id}"`);
    return value;
  };
  const identityForBalanceAccount = (account: GameplayMapEffectBalanceAccount): MapEffectAccountIdentity => {
    if (account === 'additionalActor') {
      if (!input.additionalTarget) throw new MapEffectPlanError(`Action "${input.actionId}" has no bound additionalTarget identity`);
      return input.additionalTarget;
    }
    if (account === 'sourceActor') return actorFor('source');
    if (account === 'primaryActor') return actorFor('primary');
    if (account === 'loopTargetActor') return actorFor('loopTarget');
    return input.sourceTeam;
  };
  const readResourceBalance = (account: GameplayMapEffectBalanceAccount, resourceId: string): number => {
    if (!validLocalId(resourceId)) throw new MapEffectPlanError(`Action "${input.actionId}" reads an invalid resource ID`);
    const identity = identityForBalanceAccount(account);
    const balances = input.resourceBalances;
    if (!balances) throw new MapEffectPlanError(`Action "${input.actionId}" has no source-start resource balance snapshot`);
    let rawValue: unknown;
    if (identity.kind === 'team') {
      const teams = balances.teams as unknown as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(teams, identity.side)) {
        throw new MapEffectPlanError(`Action "${input.actionId}" has no materialized ${identity.side} Team resource account`);
      }
      const teamBalances = teams[identity.side];
      if (!isRecord(teamBalances) || !Object.prototype.hasOwnProperty.call(teamBalances, resourceId)) {
        throw new MapEffectPlanError(`Action "${input.actionId}" has no declared ${identity.side} Team resource "${resourceId}"`);
      }
      rawValue = teamBalances[resourceId];
    } else {
      const actors = balances.actors as unknown as Record<string, unknown>;
      const key = identityKey(identity);
      if (!Object.prototype.hasOwnProperty.call(actors, key)) {
        throw new MapEffectPlanError(`Action "${input.actionId}" has no materialized ${identity.kind} "${identity.id}" resource account`);
      }
      const actorBalances = actors[key];
      if (!isRecord(actorBalances) || !Object.prototype.hasOwnProperty.call(actorBalances, resourceId)) {
        throw new MapEffectPlanError(`Action "${input.actionId}" has no declared resource "${resourceId}" for ${identity.kind} "${identity.id}"`);
      }
      rawValue = actorBalances[resourceId];
    }
    if (!Number.isSafeInteger(rawValue) || (rawValue as number) < 0) {
      throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid balance for resource "${resourceId}"`);
    }
    return rawValue as number;
  };
  const plannedMapRunFacts = (): MapEffectMapRunFactsState | undefined => mapRunFacts === null ? undefined : Object.freeze({
    counters: Object.freeze(mapRunFacts.counterOrder.map(id => Object.freeze({ id, value: mapRunFacts.counters.get(id)!.value }))),
    flags: Object.freeze(mapRunFacts.flagOrder.map(id => Object.freeze({ id, value: mapRunFacts.flags.get(id)! }))),
  });
  const evaluateValue = (
    value: GameplayMapEffectValueDef | GameplayMapEffectLoopValueDef,
    recipient: MapEffectActorIdentity | null,
    targetCount: number,
  ): number => {
    const checked = (result: bigint, path: string): number => {
      if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) {
        throw new MapEffectPlanError(`Action "${input.actionId}" Value at ${path} exceeds the safe integer range`);
      }
      return Number(result);
    };
    const readUnit = (unit: 'source' | 'primary' | 'target' | 'loopTarget', field: 'hp' | 'hpCap' | 'missingHp'): number => {
      const identity = unit === 'target' ? recipient : actorFor(unit);
      if (!identity) throw new MapEffectPlanError(`Action "${input.actionId}" has no bound ${unit} identity for Value`);
      const state = validHp(hp[identityKey(identity)], identity, input.actionId);
      return field === 'hp' ? state.current : field === 'hpCap' ? state.cap : state.cap - state.current;
    };
    const visit = (node: GameplayMapEffectValueDef | GameplayMapEffectLoopValueDef, path: string): number => {
      if (node.kind === 'literal') {
        if (!Number.isSafeInteger(node.value)) throw new MapEffectPlanError(`Action "${input.actionId}" has an unsafe Value literal`);
        return node.value;
      }
      if (node.kind === 'hp' || node.kind === 'hpCap' || node.kind === 'missingHp') return readUnit(node.unit, node.kind);
      if (node.kind === 'counter') return checkedCounter(locals.counters[node.counterId], node.counterId, input.actionId).value;
      if (node.kind === 'mapRunCounter') return checkedMapRunCounter(node.counterId).value;
      if (node.kind === 'resourceBalance') return readResourceBalance(node.account, node.resourceId);
      if (node.kind === 'round') {
        if (!Number.isSafeInteger(input.round) || (input.round ?? 0) < 1) throw new MapEffectPlanError(`Action "${input.actionId}" has no valid Round Value`);
        return input.round!;
      }
      if (node.kind === 'targetCount') return targetCount;
      if (node.kind === 'abs') {
        const operand = nodeValue(node.value, `${path}.value`);
        return checked(operand < 0n ? -operand : operand, path);
      }
      if (node.kind === 'clamp') {
        const current = nodeValue(node.value, `${path}.value`);
        const minimum = nodeValue(node.min, `${path}.min`);
        const maximum = nodeValue(node.max, `${path}.max`);
        if (minimum > maximum) throw new MapEffectPlanError(`Action "${input.actionId}" has a Value clamp with min greater than max`);
        return checked(current < minimum ? minimum : current > maximum ? maximum : current, path);
      }
      if (!('left' in node) || !('right' in node)) throw new MapEffectPlanError(`Action "${input.actionId}" has an incomplete Value operation`);
      const left = nodeValue(node.left, `${path}.left`);
      const right = nodeValue(node.right, `${path}.right`);
      switch (node.kind) {
        case 'add': return checked(left + right, path);
        case 'sub': return checked(left - right, path);
        case 'mul': return checked(left * right, path);
        case 'min': return checked(left < right ? left : right, path);
        case 'max': return checked(left > right ? left : right, path);
        case 'divFloor': {
          if (right === 0n) throw new MapEffectPlanError(`Action "${input.actionId}" Value at ${path} divides by zero`);
          let quotient = left / right;
          const remainder = left % right;
          if (remainder !== 0n && ((left < 0n) !== (right < 0n))) quotient -= 1n;
          return checked(quotient, path);
        }
        default: throw new MapEffectPlanError(`Action "${input.actionId}" has unknown Value operation`);
      }
    };
    const nodeValue = (node: GameplayMapEffectValueDef | GameplayMapEffectLoopValueDef, path: string): bigint => BigInt(visit(node, path));
    return visit(value, 'value');
  };
  const resolveSet = (selector: GameplayMapEffectTargetSetDef, path: string): {
    readonly identities: readonly MapEffectActorIdentity[];
    readonly random?: { readonly algorithm: typeof MAP_EFFECT_RANDOM_ALGORITHM; readonly seed: number; readonly cursorBefore: number; readonly cursorAfter: number };
  } => {
    if (selector.order === 'random' && (!Number.isSafeInteger(selector.limit) || selector.limit! < 1
      || selector.limit! > GAMEPLAY_MAP_EFFECT_LIMITS.targetSetSize)) {
      throw new MapEffectPlanError(`Action "${input.actionId}" random TargetSet at ${path} requires limit 1..${GAMEPLAY_MAP_EFFECT_LIMITS.targetSetSize}`);
    }
    const kind = selector.side === 'party' ? 'partyCharacter' : 'enemy';
    const ids = input.targetOrder?.[selector.side] ?? Object.keys(hp)
      .filter(key => key.startsWith(`${kind}:`)).map(key => key.slice(kind.length + 1));
    const seen = new Set<string>();
    const candidates = ids.flatMap(id => {
      const identity: MapEffectActorIdentity = { kind, id };
      const key = identityKey(identity);
      if (seen.has(key)) return [];
      seen.add(key);
      const state = validHp(hp[key], identity, input.actionId);
      if ((selector.filter ?? 'living') === 'living' && state.current === 0) return [];
      return [{ identity, state }];
    });
    if (selector.order === 'hpRatioAscending' || selector.order === 'hpRatioDescending') {
      const direction = selector.order === 'hpRatioAscending' ? 1 : -1;
      candidates.sort((left, right) => {
        const a = BigInt(left.state.current) * BigInt(right.state.cap);
        const b = BigInt(right.state.current) * BigInt(left.state.cap);
        return (a < b ? -1 : a > b ? 1 : 0) * direction;
      });
    }
    if (selector.order !== 'random' && selector.limit === undefined && candidates.length > GAMEPLAY_MAP_EFFECT_LIMITS.targetSetSize) {
      throw new MapEffectPlanError(`Action "${input.actionId}" TargetSet exceeds ${GAMEPLAY_MAP_EFFECT_LIMITS.targetSetSize} members without an explicit limit`);
    }
    if (selector.order === 'random') {
      if (!effectRandomState) {
        throw new MapEffectPlanError(`Action "${input.actionId}" has no Effect Random state for random TargetSet at ${path}`);
      }
      const before = effectRandomState;
      try {
        const sampled = sampleMapEffectRandomSubset(candidates.map(candidate => candidate.identity),
          Math.min(selector.limit!, candidates.length), before);
        effectRandomState = sampled.state;
        return {
          identities: sampled.values,
          random: { algorithm: before.algorithm, seed: before.seed, cursorBefore: before.cursor, cursorAfter: sampled.state.cursor },
        };
      } catch (error) {
        if (error instanceof MapEffectRandomError) {
          throw new MapEffectPlanError(`Action "${input.actionId}" random TargetSet at ${path}: ${error.message}`);
        }
        throw error;
      }
    }
    return { identities: candidates.slice(0, selector.limit ?? GAMEPLAY_MAP_EFFECT_LIMITS.targetSetSize).map(candidate => candidate.identity) };
  };
  const accountFor = (account: GameplayMapEffectWriteAccount): MapEffectAccountIdentity => {
    if (account === 'sourceTeam') return input.sourceTeam;
    if (account === 'additionalActor') {
      if (!input.additionalTarget) throw new MapEffectPlanError(`Action "${input.actionId}" has no bound additionalTarget identity`);
      return input.additionalTarget;
    }
    if (account === 'loopTargetActor') return actorFor('loopTarget');
    return actorFor(account === 'sourceActor' ? 'source' : 'primary');
  };
  const recordVisit = (path: string, kind: 'statement' | 'condition') => {
    if (effects.budget === 'program-4096') {
      options.visit!({ sourceKey: input.sourceKey, actionId: input.actionId, path, kind });
    }
  };

  const evaluate = (condition: NormalizedGameplayMapEffectCondition | NormalizedGameplayMapEffectLoopCondition, reads: MapEffectGuardRead[]): boolean => {
    recordVisit(condition.originPath, 'condition');
    let result: boolean;
    if (condition.kind === 'all') {
      result = true;
      for (const child of condition.conditions) {
        if (!evaluate(child, reads)) { result = false; break; }
      }
    } else if (condition.kind === 'any') {
      result = false;
      for (const child of condition.conditions) {
        if (evaluate(child, reads)) { result = true; break; }
      }
    } else if (condition.kind === 'not') {
      result = !evaluate(condition.condition, reads);
    } else if (condition.kind === 'hpAtLeast' || condition.kind === 'hpAtMost') {
      const identity = actorFor(condition.target);
      const current = validHp(hp[identityKey(identity)], identity, input.actionId).current;
      result = condition.kind === 'hpAtLeast' ? current >= condition.value : current <= condition.value;
      reads.push({ path: condition.originPath, op: condition.kind, identity: { ...identity }, current, value: condition.value, result });
    } else if (condition.kind === 'hpRatioAtLeast' || condition.kind === 'hpRatioAtMost') {
      const identity = actorFor(condition.target);
      const state = validHp(hp[identityKey(identity)], identity, input.actionId);
      const left = BigInt(state.current) * BigInt(condition.denominator);
      const right = BigInt(state.cap) * BigInt(condition.numerator);
      result = condition.kind === 'hpRatioAtLeast' ? left >= right : left <= right;
      reads.push({ path: condition.originPath, op: condition.kind, identity: { ...identity }, current: state.current, cap: state.cap, numerator: condition.numerator, denominator: condition.denominator, result });
    } else if (condition.kind === 'preparedTagCount') {
      const count = input.preparedPartyTagSources.filter(prepared => prepared.tags.some(tag => matchesTagRef(tag, condition.tag))).length;
      result = compareNumber(count, condition.comparison, condition.value);
      reads.push({ path: condition.originPath, op: 'preparedTagCount', side: condition.side, tag: condition.tag,
        count, comparison: condition.comparison, value: condition.value, result });
    } else if (condition.kind === 'counter') {
      const counter = checkedCounter(locals.counters[condition.counterId], condition.counterId, input.actionId);
      result = compareNumber(counter.value, condition.comparison, condition.value);
      reads.push({ path: condition.originPath, op: 'counter', identity: { kind: 'encounterLocal' }, counterId: condition.counterId, current: counter.value, comparison: condition.comparison, value: condition.value, result });
    } else if (condition.kind === 'flag') {
      const current = locals.flags[condition.flagId];
      if (typeof current !== 'boolean') throw new MapEffectPlanError(`Action "${input.actionId}" reads missing Flag "${condition.flagId}"`);
      result = current === condition.value;
      reads.push({ path: condition.originPath, op: 'flag', identity: { kind: 'encounterLocal' }, flagId: condition.flagId, current, value: condition.value, result });
    } else if (condition.kind === 'mapRunCounter') {
      if (!Number.isSafeInteger(condition.value)) throw new MapEffectPlanError(`Action "${input.actionId}" has an unsafe MapRun Counter comparison value`);
      const counter = checkedMapRunCounter(condition.counterId);
      if (!['eq', 'lt', 'lte', 'gt', 'gte'].includes(condition.comparison)) {
        throw new MapEffectPlanError(`Action "${input.actionId}" has an unknown MapRun Counter comparison "${condition.comparison}"`);
      }
      result = compareNumber(counter.value, condition.comparison, condition.value);
      reads.push({ path: condition.originPath, op: 'mapRunCounter',
        counterId: condition.counterId, current: counter.value, comparison: condition.comparison, value: condition.value, result });
    } else if (condition.kind === 'mapRunFlag') {
      if (typeof condition.value !== 'boolean') throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid MapRun Flag comparison value`);
      const current = checkedMapRunFlag(condition.flagId);
      result = current === condition.value;
      reads.push({ path: condition.originPath, op: 'mapRunFlag', flagId: condition.flagId, current, value: condition.value, result });
    } else if (condition.kind === 'resourceAtLeast') {
      if (!Number.isSafeInteger(condition.value) || condition.value < 0) {
        throw new MapEffectPlanError(`Action "${input.actionId}" resourceAtLeast threshold must be a non-negative safe integer`);
      }
      const identity = identityForBalanceAccount(condition.account);
      const current = readResourceBalance(condition.account, condition.resourceId);
      result = current >= condition.value;
      reads.push({ path: condition.originPath, op: 'resourceAtLeast', account: condition.account,
        identity: { ...identity }, current, value: condition.value, result });
    } else {
      throw new MapEffectPlanError(`Unknown condition kind "${condition.kind}"`);
    }
    if (condition.kind === 'all' || condition.kind === 'any' || condition.kind === 'not') {
      reads.push({ path: condition.originPath, op: condition.kind, result });
    }
    return result;
  };

  const apply = (list: readonly (NormalizedGameplayMapEffectInstruction | NormalizedGameplayMapEffectLoopInstruction)[]): void => {
    for (const instruction of list) {
      recordVisit(instruction.originPath, 'statement');
      if (instruction.op === 'when') {
        const reads: MapEffectGuardRead[] = [];
        const result = evaluate(instruction.condition, reads);
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath, op: 'when', result, reads });
        apply(result ? instruction.then : instruction.else ?? []);
      } else if (instruction.op === 'damage' || instruction.op === 'heal') {
        const isSet = typeof instruction.target === 'object';
        const selector = isSet ? instruction.target.set : null;
        const resolvedSet = selector ? resolveSet(selector, instruction.originPath) : null;
        const targets = resolvedSet ? resolvedSet.identities : [actorFor('primary')];
        const repeatValue = instruction.repeat ?? 1;
        const repeatCount = typeof repeatValue === 'number' ? repeatValue : evaluateValue(repeatValue, null, targets.length);
        if (!Number.isSafeInteger(repeatCount) || repeatCount < 0 || repeatCount > GAMEPLAY_MAP_EFFECT_LIMITS.effectRepeat) {
          throw new MapEffectPlanError(`Action "${input.actionId}" ${instruction.op} repeat must be between zero and ${GAMEPLAY_MAP_EFFECT_LIMITS.effectRepeat}`);
        }
        const isE2 = isSet || typeof instruction.amount !== 'number' || instruction.repeat !== undefined;
        if (isE2) trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
          op: 'targetSet', selection: selector ? 'set' : 'primary', selector: selector ? { ...selector } : null,
          identities: targets.map(identity => ({ ...identity })), repeatCount,
          ...(resolvedSet?.random ? { random: { ...resolvedSet.random } } : {}) });
        const hits = targets.length * repeatCount;
        if (!Number.isSafeInteger(hits) || expansionCount + hits > GAMEPLAY_MAP_EFFECT_LIMITS.sourceExpansion) {
          throw new MapEffectPlanError(`Action "${input.actionId}" source expansion exceeds ${GAMEPLAY_MAP_EFFECT_LIMITS.sourceExpansion}`);
        }
        expansionCount += hits;
        for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
          const identity = targets[targetIndex]!;
          for (let hitIndex = 0; hitIndex < repeatCount; hitIndex += 1) {
            const state = validHp(hp[identityKey(identity)], identity, input.actionId);
            const rawAmount = typeof instruction.amount === 'number'
              ? instruction.amount : evaluateValue(instruction.amount, identity, targets.length);
            if (!Number.isSafeInteger(rawAmount) || rawAmount < 0 || (!isE2 && pendingModifier === undefined && rawAmount === 0)) {
              throw new MapEffectPlanError(`Action "${input.actionId}" ${instruction.op} amount must be a non-negative safe integer`);
            }
            let effectiveAmount = rawAmount;
            if (pendingModifier !== undefined) {
              const sum = BigInt(rawAmount) + BigInt(pendingModifier.delta);
              if (sum > BigInt(Number.MAX_SAFE_INTEGER)) {
                throw new MapEffectPlanError(`Action "${input.actionId}" modified ${instruction.op} amount exceeds safe integer range`);
              }
              effectiveAmount = Number(sum < 0n ? 0n : sum);
            }
            const modifierAdjustedAmount = effectiveAmount;
            let damageProtection: MapEffectDamageProtectionTrace | undefined;
            if (instruction.op === 'damage' && state.current > 0 && effectiveAmount > 0) {
              const protections = plannedStatuses.flatMap((status, originalIndex) => {
                if (status.holder.kind !== identity.kind || status.holder.id !== identity.id) return [];
                const definition = input.statusDefinitions?.find(candidate => candidate.id === status.statusId);
                return definition?.kind === 'damageProtection' ? [{ status, definition, originalIndex }] : [];
              }).sort((left, right) => left.status.remainingRounds - right.status.remainingRounds
                || compareMapEncounterStatusStableOrder(left.status, right.status)
                || left.originalIndex - right.originalIndex);
              const protectedStatus = protections[0];
              if (protectedStatus) {
                if (!Number.isSafeInteger(protectedStatus.status.stacks) || protectedStatus.status.stacks < 1
                  || !Number.isSafeInteger(protectedStatus.status.remainingRounds) || protectedStatus.status.remainingRounds < 1
                  || protectedStatus.definition.category !== 'beneficial') {
                  throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid active damageProtection Status "${protectedStatus.status.statusId}"`);
                }
                const statusIndexBefore = plannedStatuses.findIndex(candidate => statusInstanceKey(candidate) === statusInstanceKey(protectedStatus.status));
                if (statusIndexBefore < 0) throw new MapEffectPlanError(`Action "${input.actionId}" cannot locate damageProtection Status "${protectedStatus.status.statusId}"`);
                const statusBefore: MapEncounterStatusInstance = {
                  ...protectedStatus.status,
                  holder: { ...protectedStatus.status.holder },
                  source: { ...protectedStatus.status.source },
                };
                const stacksAfter = statusBefore.stacks - 1;
                const statusAfter: MapEncounterStatusInstance | null = stacksAfter === 0 ? null : {
                  ...statusBefore,
                  stacks: stacksAfter,
                };
                if (statusAfter === null) plannedStatuses.splice(statusIndexBefore, 1);
                else plannedStatuses[statusIndexBefore] = statusAfter;
                damageProtection = {
                  statusIndexBefore,
                  requestedAmount: effectiveAmount,
                  blockedAmount: effectiveAmount,
                  statusBefore,
                  statusAfter,
                };
                effectiveAmount = 0;
              }
            }
            let damageReduction: MapEffectDamageReductionTrace | undefined;
            if (instruction.op === 'damage' && state.current > 0 && effectiveAmount > 0) {
              const contributions: MapEffectDamageReductionTrace['sources'][number][] = [];
              let reductionRemaining = effectiveAmount;
              const activeReductions = plannedStatuses.flatMap(status => {
                if (status.holder.kind !== identity.kind || status.holder.id !== identity.id) return [];
                const definition = input.statusDefinitions?.find(candidate => candidate.id === status.statusId);
                return definition?.kind === 'damageReduction' ? [{ status, definition }] : [];
              });
              for (const { status, definition } of activeReductions) {
                if (!Number.isSafeInteger(definition.damageReductionPerStack) || definition.damageReductionPerStack <= 0
                  || !Number.isSafeInteger(status.stacks) || status.stacks <= 0) {
                  throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid active damageReduction Status "${status.statusId}"`);
                }
                const requestedReduction = BigInt(status.stacks) * BigInt(definition.damageReductionPerStack);
                const actualReduction = Number(requestedReduction < BigInt(reductionRemaining)
                  ? requestedReduction : BigInt(reductionRemaining));
                if (actualReduction > 0) {
                  contributions.push({ statusId: status.statusId, source: { ...status.source }, actionId: status.actionId,
                    stacks: status.stacks, damageReductionPerStack: definition.damageReductionPerStack,
                    reducedAmount: actualReduction });
                  reductionRemaining -= actualReduction;
                }
                if (reductionRemaining === 0) break;
              }
              if (contributions.length > 0) {
                damageReduction = { total: effectiveAmount - reductionRemaining, sources: contributions };
                effectiveAmount = reductionRemaining;
              }
            }
            const before = state.current;
            let after = 0;
            let shieldBefore = 0;
            let absorbed = 0;
            let remainingDamage = effectiveAmount;
            if (instruction.op === 'damage' && shields !== undefined && damageProtection === undefined) {
              shieldBefore = shields[identityKey(identity)] ?? 0;
            }
            if (before > 0) {
              const amount = BigInt(effectiveAmount);
              const current = BigInt(before);
              const cap = BigInt(state.cap);
              if (instruction.op === 'damage') {
                if (shields !== undefined && damageProtection === undefined) {
                  const absorbedBig = amount < BigInt(shieldBefore) ? amount : BigInt(shieldBefore);
                  absorbed = Number(absorbedBig);
                  const shieldAfter = BigInt(shieldBefore) - absorbedBig;
                  remainingDamage = Number(amount - absorbedBig);
                  if (shieldAfter === 0n) delete shields[identityKey(identity)];
                  else shields[identityKey(identity)] = Number(shieldAfter);
                }
                const proposed = current - BigInt(remainingDamage);
                after = Number(proposed <= 0n ? 0n : proposed);
              } else {
                const proposed = current + amount;
                after = Number(proposed >= cap ? cap : proposed);
              }
            }
            hp[identityKey(identity)] = { ...state, current: after };
            if (instruction.op === 'damage' && shields !== undefined && damageProtection === undefined) {
              const shieldAfter = shields[identityKey(identity)] ?? 0;
              shieldTrace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
                op: 'damage', identity: { ...identity }, requestedAmount: effectiveAmount,
                shieldBefore, absorbed, shieldAfter, remainingDamage, hpBefore: before, hpAfter: after });
            }
            trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
              op: instruction.op, identity: { ...identity }, before, after, amount: effectiveAmount, delta: after - before,
              ...(pendingModifier === undefined ? {} : { requestedAmount: rawAmount, modifierDelta: pendingModifier.delta,
                modifiedRequestedAmount: modifierAdjustedAmount, modifierSourceKey: pendingModifier.sourceKey,
                modifierActionId: pendingModifier.actionId }),
              ...(damageReduction === undefined ? {} : { damageReduction }),
              ...(damageProtection === undefined ? {} : { damageProtection }),
              ...(isE2 ? { batch: { targetIndex, hitIndex, targetCount: targets.length, repeatCount } } : {}) });
            let eventHitGroup: number | null = null;
            if (!isSet && instruction.op === 'heal' && after > before) {
              eventHitGroup = nextTriggerHitGroup++;
              triggerEvents.push({ event: 'healApplied', hitGroup: eventHitGroup, path: instruction.originPath, target: { ...identity },
                requestedAmount: effectiveAmount, actualAppliedAmount: after - before });
            } else if (!isSet && instruction.op === 'damage' && after < before) {
              eventHitGroup = nextTriggerHitGroup++;
              const statusDamageEligible = loopTarget === null && input.primary?.kind === identity.kind
                && input.primary.id === identity.id;
              triggerEvents.push({ event: 'damageApplied', hitGroup: eventHitGroup, statusDamageEligible,
                path: instruction.originPath, target: { ...identity },
                requestedAmount: modifierAdjustedAmount, actualAppliedAmount: before - after,
                hitStatuses: statusDamageEligible ? copyMapEncounterStatusInstances(plannedStatuses.filter(status =>
                  status.holder.kind === identity.kind && status.holder.id === identity.id)) : [] });
            }
            if (!isSet && loopTarget === null && instruction.op === 'damage'
              && identity.kind === 'enemy' && before > 0 && after === 0
              && input.source?.kind === 'partyCharacter' && input.primary?.kind === 'enemy') {
              triggerEvents.push({ event: 'enemyDefeated', hitGroup: eventHitGroup ?? nextTriggerHitGroup++, path: instruction.originPath,
                target: { kind: 'enemy', id: identity.id }, rewardRecipient: { kind: 'partyCharacter', id: input.source.id },
                requestedAmount: modifierAdjustedAmount, actualAppliedAmount: before - after });
            }
          }
        }
      } else if (instruction.op === 'revive') {
        if (!Number.isSafeInteger(instruction.amount) || instruction.amount <= 0) {
          throw new MapEffectPlanError(`Action "${input.actionId}" revive amount must be a positive safe integer`);
        }
        const identity = actorFor('primary');
        if (identity.kind !== 'partyCharacter') {
          throw new MapEffectPlanError(`Action "${input.actionId}" revive requires a Party Character primary target`);
        }
        const state = validHp(hp[identityKey(identity)], identity, input.actionId);
        const beforeHp = state.current;
        const restoredHp = beforeHp === 0 ? Math.min(instruction.amount, state.cap) : 0;
        const afterHp = beforeHp === 0 ? restoredHp : beforeHp;
        hp[identityKey(identity)] = { ...state, current: afterHp };
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
          op: 'revive', identity: { ...identity }, requestedHp: instruction.amount, restoredHp,
          beforeHp, afterHp, outcome: beforeHp === 0 ? 'revived' : 'alreadyAlive' });
      } else if (instruction.op === 'forTargets') {
        const resolvedSet = resolveSet(instruction.targetSet, instruction.originPath);
        const identities = resolvedSet.identities;
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
          op: 'forTargets', selector: { ...instruction.targetSet }, identities: identities.map(identity => ({ ...identity })),
          ...(resolvedSet.random ? { random: { ...resolvedSet.random } } : {}) });
        for (let iterationIndex = 0; iterationIndex < identities.length; iterationIndex += 1) {
          const identity = identities[iterationIndex]!;
          trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
            op: 'forTarget', selectorPath: instruction.originPath, iterationIndex, targetCount: identities.length,
            identity: { ...identity } });
          const previousLoopTarget = loopTarget;
          const previousLoopTargetCount = loopTargetCount;
          loopTarget = { ...identity };
          loopTargetCount = identities.length;
          try {
            apply(instruction.body);
          } finally {
            loopTarget = previousLoopTarget;
            loopTargetCount = previousLoopTargetCount;
          }
        }
      } else if (instruction.op === 'shieldAdd') {
        if (shields === undefined) {
          throw new MapEffectPlanError(`Action "${input.actionId}" shieldAdd requires a detached Shield ledger`);
        }
        const identity = actorFor(instruction.target);
        const state = validHp(hp[identityKey(identity)], identity, input.actionId);
        const amount = typeof instruction.amount === 'number'
          ? instruction.amount : evaluateValue(instruction.amount, identity, loopTargetCount);
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          throw new MapEffectPlanError(`Action "${input.actionId}" shieldAdd amount must be a positive safe integer`);
        }
        const key = identityKey(identity);
        const before = shields[key] ?? 0;
        const added = state.current > 0 ? amount : 0;
        let after = before;
        if (state.current > 0) {
          const mathematical = BigInt(before) + BigInt(amount);
          if (mathematical > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new MapEffectPlanError(`Action "${input.actionId}" Shield addition exceeds safe integer range`);
          }
          after = Number(mathematical);
        }
        if (after === 0) delete shields[key];
        else shields[key] = after;
        shieldTrace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
          op: 'shieldAdd', identity: { ...identity }, requestedAmount: amount, shieldBefore: before,
          added, shieldAfter: after, outcome: state.current > 0 ? 'applied' : 'notApplied/defeated' });
      } else if (instruction.op === 'hpChange') {
        const identity = actorFor(instruction.target);
        const before = validHp(hp[identityKey(identity)], identity, input.actionId).current;
        const state = hp[identityKey(identity)]!;
        const proposed = BigInt(before) + BigInt(instruction.delta);
        const after = before === 0 ? 0 : Number(proposed <= 0n ? 0n : proposed >= BigInt(state.cap) ? BigInt(state.cap) : proposed);
        hp[identityKey(identity)] = { ...state, current: after };
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath, op: 'hpChange', identity: { ...identity }, before, after, delta: after - before });
      } else if (instruction.op === 'counterAdd') {
        const counter = checkedCounter(locals.counters[instruction.counterId], instruction.counterId, input.actionId);
        const mathematical = BigInt(counter.value) + BigInt(instruction.delta);
        if (mathematical > BigInt(Number.MAX_SAFE_INTEGER) || mathematical < BigInt(Number.MIN_SAFE_INTEGER)) {
          throw new MapEffectPlanError(`Action "${input.actionId}" Counter "${instruction.counterId}" addition exceeds safe integer range`);
        }
        const before = counter.value;
        const after = Math.max(counter.min, Math.min(counter.max, Number(mathematical)));
        locals.counters[instruction.counterId] = { ...counter, value: after };
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath, op: 'counterAdd', identity: { kind: 'encounterLocal' }, counterId: instruction.counterId, before, after, delta: after - before });
      } else if (instruction.op === 'flagSet') {
        if (typeof locals.flags[instruction.flagId] !== 'boolean') throw new MapEffectPlanError(`Action "${input.actionId}" writes missing Flag "${instruction.flagId}"`);
        const before = locals.flags[instruction.flagId]!;
        locals.flags[instruction.flagId] = instruction.value;
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath, op: 'flagSet', identity: { kind: 'encounterLocal' }, flagId: instruction.flagId, before, after: instruction.value });
      } else if (instruction.op === 'cardEffectModifier') {
        if (instruction.path !== 'resolve[0].amount' || instruction.operation !== 'add'
          || !Number.isSafeInteger(instruction.delta) || instruction.delta === 0) {
          throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid card effect modifier`);
        }
        cardEffectModifierIntents.push({ sourceKey: input.sourceKey, actionId: input.actionId,
          path: instruction.path, delta: instruction.delta });
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
          op: 'cardEffectModifier', delta: instruction.delta });
      } else if (instruction.op === 'statusApply') {
        const sourceIdentity = input.sourceIdentity;
        if (!sourceIdentity) throw new MapEffectPlanError(`Action "${input.actionId}" statusApply requires a concrete source identity`);
        const currentRound = input.round;
        if (typeof currentRound !== 'number' || !Number.isSafeInteger(currentRound) || currentRound < 1) {
          throw new MapEffectPlanError(`Action "${input.actionId}" statusApply requires a positive Encounter round`);
        }
        const definition = input.statusDefinitions?.find(status => status.id === instruction.statusId);
        if (!definition) throw new MapEffectPlanError(`Action "${input.actionId}" references missing Status "${instruction.statusId}"`);
        const validStatusEffect = definition.kind === 'damageReduction'
          ? definition.category === 'beneficial'
            && Number.isSafeInteger(definition.damageReductionPerStack) && definition.damageReductionPerStack > 0
          : definition.kind === 'damageProtection'
            ? definition.category === 'beneficial'
          : (definition.kind === 'burn' || definition.kind === 'regen')
            && Number.isSafeInteger(definition.hpPerStack) && definition.hpPerStack > 0;
        if (!validStatusEffect
          || !Number.isSafeInteger(definition.maxStacks) || definition.maxStacks < 1 || definition.maxStacks > 99) {
          throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid Status definition "${definition.id}"`);
        }
        if (!Number.isSafeInteger(instruction.stacks) || instruction.stacks <= 0 || instruction.stacks > definition.maxStacks) {
          throw new MapEffectPlanError(`Action "${input.actionId}" statusApply stacks must be in 1..${definition.maxStacks}`);
        }
        if (!Number.isSafeInteger(instruction.durationRounds) || instruction.durationRounds < 1 || instruction.durationRounds > 99) {
          throw new MapEffectPlanError(`Action "${input.actionId}" statusApply durationRounds must be between 1 and 99`);
        }
        const identity = actorFor(instruction.target);
        const key = statusInstanceKey({
          holder: identity,
          statusId: instruction.statusId,
          source: sourceIdentity,
          actionId: input.actionId,
          appliedRound: currentRound,
          lastTriggeredRound: null,
          stacks: instruction.stacks,
          remainingRounds: instruction.durationRounds,
        });
        const existingIndex = plannedStatuses.findIndex(status => statusInstanceKey(status) === key);
        const existing = existingIndex < 0 ? undefined : plannedStatuses[existingIndex];
        if (!existing && plannedStatuses.length >= 256) {
          throw new MapEffectPlanError('Encounter Status instance limit of 256 exceeded');
        }
        const mathematicalStacks = BigInt(existing?.stacks ?? 0) + BigInt(instruction.stacks);
        if (mathematicalStacks > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new MapEffectPlanError(`Action "${input.actionId}" Status "${instruction.statusId}" stack addition exceeds safe integer range`);
        }
        const afterStacks = Number(mathematicalStacks > BigInt(definition.maxStacks)
          ? BigInt(definition.maxStacks) : mathematicalStacks);
        const instance: MapEncounterStatusInstance = {
          holder: { ...identity },
          statusId: instruction.statusId,
          source: { ...sourceIdentity },
          actionId: input.actionId,
          appliedRound: existing?.appliedRound ?? currentRound,
          lastTriggeredRound: existing?.lastTriggeredRound ?? null,
          stacks: afterStacks,
          remainingRounds: instruction.durationRounds,
        };
        if (existingIndex < 0) plannedStatuses.push(instance);
        else plannedStatuses[existingIndex] = instance;
        const statusTrace: MapEffectStatusApplyTraceEntry = {
          sourceKey: input.sourceKey,
          actionId: input.actionId,
          path: instruction.originPath,
          op: 'statusApply',
          source: { ...sourceIdentity },
          identity: { ...identity },
          statusId: instruction.statusId,
          requestedStacks: instruction.stacks,
          beforeStacks: existing?.stacks ?? 0,
          afterStacks,
          beforeRemainingRounds: existing?.remainingRounds ?? null,
          afterRemainingRounds: instruction.durationRounds,
          beforeAppliedRound: existing?.appliedRound ?? null,
          beforeLastTriggeredRound: existing?.lastTriggeredRound ?? null,
          appliedRound: instance.appliedRound,
          lastTriggeredRound: instance.lastTriggeredRound,
        };
        statusApplyTrace.push(statusTrace);
        trace.push(statusTrace);
      } else if (instruction.op === 'statusRemove') {
        if (!input.statusDefinitions?.some(status => status.id === instruction.statusId)) {
          throw new MapEffectPlanError(`Action "${input.actionId}" references missing Status "${instruction.statusId}"`);
        }
        const identity = actorFor(instruction.target);
        const matching = plannedStatuses.flatMap((status, statusIndexBefore) =>
          status.holder.kind === identity.kind && status.holder.id === identity.id && status.statusId === instruction.statusId
            ? [{ status, statusIndexBefore }]
            : []);
        matching.sort((left, right) => compareMapEncounterStatusStableOrder(left.status, right.status)
          || left.statusIndexBefore - right.statusIndexBefore);
        const removed: MapEffectStatusRemoveTraceEntry['removed'][number][] = matching.map(({ status, statusIndexBefore }) => ({
          statusIndexBefore,
          status: {
            ...status,
            holder: { ...status.holder },
            source: { ...status.source },
          },
        }));
        const removedIndexes = new Set(matching.map(row => row.statusIndexBefore));
        for (let index = plannedStatuses.length - 1; index >= 0; index -= 1) {
          if (removedIndexes.has(index)) plannedStatuses.splice(index, 1);
        }
        const statusTrace: MapEffectStatusRemoveTraceEntry = {
          sourceKey: input.sourceKey,
          actionId: input.actionId,
          path: instruction.originPath,
          op: 'statusRemove',
          identity: { ...identity },
          statusId: instruction.statusId,
          removed,
        };
        statusRemoveTrace.push(statusTrace);
        trace.push(statusTrace);
      } else if (instruction.op === 'statusRemoveCategory') {
        const identity = actorFor(instruction.target);
        const definitions = input.statusDefinitions ?? [];
        const matching = plannedStatuses.flatMap((status, statusIndexBefore) => {
          if (status.holder.kind !== identity.kind || status.holder.id !== identity.id) return [];
          const definition = definitions.find(candidate => candidate.id === status.statusId);
          return definition?.category === instruction.category ? [{ status, statusIndexBefore }] : [];
        });
        matching.sort((left, right) => compareMapEncounterStatusStableOrder(left.status, right.status)
          || left.statusIndexBefore - right.statusIndexBefore);
        const removed: MapEffectStatusCategoryRemoveTraceEntry['removed'][number][] = matching.map(({ status, statusIndexBefore }) => ({
          statusIndexBefore,
          status: { ...status, holder: { ...status.holder }, source: { ...status.source } },
        }));
        const removedIndexes = new Set(matching.map(row => row.statusIndexBefore));
        for (let index = plannedStatuses.length - 1; index >= 0; index -= 1) {
          if (removedIndexes.has(index)) plannedStatuses.splice(index, 1);
        }
        const statusTrace: MapEffectStatusCategoryRemoveTraceEntry = {
          sourceKey: input.sourceKey,
          actionId: input.actionId,
          path: instruction.originPath,
          op: 'statusRemoveCategory',
          identity: { ...identity },
          category: instruction.category,
          removed,
        };
        statusCategoryRemoveTrace.push(statusTrace);
        trace.push(statusTrace);
      } else if (instruction.op === 'statusConsume') {
        if (!Number.isSafeInteger(instruction.stacks) || instruction.stacks < 1 || instruction.stacks > 99) {
          throw new MapEffectPlanError(`Action "${input.actionId}" statusConsume stacks must be in 1..99`);
        }
        if (!input.statusDefinitions?.some(status => status.id === instruction.statusId)) {
          throw new MapEffectPlanError(`Action "${input.actionId}" references missing Status "${instruction.statusId}"`);
        }
        const identity = actorFor(instruction.target);
        const matching = plannedStatuses.flatMap((status, statusIndexBefore) =>
          status.holder.kind === identity.kind && status.holder.id === identity.id && status.statusId === instruction.statusId
            ? [{ status, statusIndexBefore }]
            : []);
        matching.sort((left, right) => left.status.remainingRounds - right.status.remainingRounds
          || compareMapEncounterStatusStableOrder(left.status, right.status)
          || left.statusIndexBefore - right.statusIndexBefore);
        let remainingStacks = instruction.stacks;
        let consumedStacks = 0;
        const changes: MapEffectStatusConsumeTraceEntry['changes'][number][] = [];
        const removedIndexes: number[] = [];
        for (const { status, statusIndexBefore } of matching) {
          if (remainingStacks === 0) break;
          const consumed = Math.min(status.stacks, remainingStacks);
          if (consumed <= 0) continue;
          const statusBefore: MapEncounterStatusInstance = {
            ...status,
            holder: { ...status.holder },
            source: { ...status.source },
          };
          const stacksAfter = status.stacks - consumed;
          const statusAfter: MapEncounterStatusInstance | null = stacksAfter === 0 ? null : {
            ...statusBefore,
            stacks: stacksAfter,
          };
          changes.push({ statusIndexBefore, statusBefore, consumedStacks: consumed, statusAfter });
          if (statusAfter === null) removedIndexes.push(statusIndexBefore);
          else plannedStatuses[statusIndexBefore] = statusAfter;
          remainingStacks -= consumed;
          consumedStacks += consumed;
        }
        for (const index of removedIndexes.sort((left, right) => right - left)) plannedStatuses.splice(index, 1);
        const statusTrace: MapEffectStatusConsumeTraceEntry = {
          sourceKey: input.sourceKey,
          actionId: input.actionId,
          path: instruction.originPath,
          op: 'statusConsume',
          identity: { ...identity },
          statusId: instruction.statusId,
          requestedStacks: instruction.stacks,
          consumedStacks,
          unmetStacks: instruction.stacks - consumedStacks,
          changes,
        };
        statusConsumeTrace.push(statusTrace);
        trace.push(statusTrace);
      } else if (instruction.op === 'resourceChange') {
        if (!Number.isSafeInteger(instruction.delta) || instruction.delta === 0) {
          throw new MapEffectPlanError(`Action "${input.actionId}" resourceChange delta must be a non-zero safe integer`);
        }
        const identity = accountFor(instruction.account);
        const targetSideActor = instruction.account === 'additionalActor' || instruction.account === 'loopTargetActor';
        const currentHp = targetSideActor && (identity.kind === 'partyCharacter' || identity.kind === 'enemy')
          ? validHp(hp[identityKey(identity)], identity, input.actionId).current : 1;
        const effectiveDelta = targetSideActor && currentHp <= 0 ? 0 : instruction.delta;
        resourceLedger.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
          account: instruction.account, identity: { ...identity }, resourceId: instruction.resourceId,
          delta: effectiveDelta, intentDelta: instruction.delta });
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath, op: 'resourceChange', identity: { ...identity }, resourceId: instruction.resourceId, delta: instruction.delta });
      } else if (instruction.op === 'mapRunCounterAdd') {
        if (!Number.isSafeInteger(instruction.delta) || instruction.delta === 0) {
          throw new MapEffectPlanError(`Action "${input.actionId}" MapRun Counter delta must be a non-zero safe integer`);
        }
        const counter = checkedMapRunCounter(instruction.counterId);
        const mathematical = BigInt(counter.value) + BigInt(instruction.delta);
        if (mathematical > BigInt(Number.MAX_SAFE_INTEGER) || mathematical < BigInt(Number.MIN_SAFE_INTEGER)) {
          throw new MapEffectPlanError(`Action "${input.actionId}" MapRun Counter "${instruction.counterId}" addition exceeds safe integer range`);
        }
        const before = counter.value;
        const after = Math.max(counter.min, Math.min(counter.max, Number(mathematical)));
        mapRunFacts!.counters.set(instruction.counterId, { ...counter, value: after });
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
          op: 'mapRunCounterAdd', counterId: instruction.counterId,
          before, after, delta: after - before, requestedDelta: instruction.delta });
      } else if (instruction.op === 'mapRunFlagSet') {
        if (typeof instruction.value !== 'boolean') {
          throw new MapEffectPlanError(`Action "${input.actionId}" MapRun Flag value must be boolean`);
        }
        const before = checkedMapRunFlag(instruction.flagId);
        mapRunFacts!.flags.set(instruction.flagId, instruction.value);
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath,
          op: 'mapRunFlagSet', flagId: instruction.flagId,
          before, after: instruction.value });
      } else {
        throw new MapEffectPlanError(`Action "${input.actionId}" has unknown effect instruction "${(instruction as { op?: unknown }).op}"`);
      }
    }
  };

  apply(instructions);
  const triggers = effects.triggers ?? [];
  if (triggers.length > 0 || triggerEvents.some(event => event.event === 'damageApplied'
    && event.hitStatuses.some(status => input.statusDefinitions?.find(definition => definition.id === status.statusId)?.onDamageTaken))) {
    const parentExecutionIndex = options.parentExecutionIndex ?? 0;
    const queueStart = options.triggerQueueStart ?? 1;
    const activationBudget = options.triggerActivationBudget ?? 32;
    if (!Number.isSafeInteger(parentExecutionIndex) || parentExecutionIndex < 0
      || !Number.isSafeInteger(queueStart) || queueStart <= 0
      || !Number.isSafeInteger(activationBudget) || activationBudget < 0 || activationBudget > 32) {
      throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid Trigger queue position or budget`);
    }
    const actionActivationCount = triggerEvents.reduce((sum, event) => sum + triggers.filter(trigger =>
      trigger.event === event.event
      && (trigger.minimumActualAmount === undefined || event.actualAppliedAmount >= trigger.minimumActualAmount)).length, 0);
    const statusActivationCount = triggerEvents.reduce((sum, event) => sum + (event.event === 'damageApplied' && event.statusDamageEligible
      ? event.hitStatuses.filter(status => input.statusDefinitions?.find(definition => definition.id === status.statusId)?.onDamageTaken).length : 0), 0);
    const activationCount = actionActivationCount + statusActivationCount;
    if (!Number.isSafeInteger(activationCount) || activationCount > activationBudget) {
      throw new MapEffectPlanError(`Action "${input.actionId}" exceeds the remaining Commit Trigger activation budget of ${activationBudget}`);
    }
    if (!input.primary) throw new MapEffectPlanError(`Action "${input.actionId}" has no primary Actor for its Trigger`);
    let queueIndex = queueStart;
    for (const [eventIndex, event] of triggerEvents.entries()) {
      if (event.target.kind !== input.primary.kind || event.target.id !== input.primary.id
        || (event.event === 'enemyDefeated'
          && (event.target.kind !== 'enemy' || input.source?.kind !== 'partyCharacter'
            || event.rewardRecipient.kind !== 'partyCharacter' || event.rewardRecipient.id !== input.source.id))) {
        throw new MapEffectPlanError(`Action "${input.actionId}" ${event.event} Trigger target or reward recipient is not bound to this source`);
      }
      for (const trigger of triggers) {
        const expectedAccount = event.event === 'enemyDefeated' ? 'sourceActor' : 'primaryActor';
        if (!trigger.id || (trigger.event !== 'healApplied' && trigger.event !== 'damageApplied' && trigger.event !== 'enemyDefeated') || trigger.effect.op !== 'resourceChange'
          || trigger.effect.account !== (trigger.event === 'enemyDefeated' ? 'sourceActor' : 'primaryActor')
          || !validLocalId(trigger.effect.resourceId)
          || !Number.isSafeInteger(trigger.effect.delta) || trigger.effect.delta <= 0
          || (trigger.minimumActualAmount !== undefined
            && (trigger.event === 'enemyDefeated' || !Number.isSafeInteger(trigger.minimumActualAmount) || trigger.minimumActualAmount <= 0))) {
          throw new MapEffectPlanError(`Action "${input.actionId}" has an invalid ${event.event} Trigger`);
        }
        if (trigger.event !== event.event
          || (trigger.minimumActualAmount !== undefined && event.actualAppliedAmount < trigger.minimumActualAmount)) continue;
        const rewardRecipient = event.event === 'enemyDefeated' ? event.rewardRecipient : event.target;
        if (event.event === 'enemyDefeated' && expectedAccount !== 'sourceActor') {
          throw new MapEffectPlanError(`Action "${input.actionId}" enemyDefeated Trigger requires a Party source Actor`);
        }
        const traceBase = {
          queueIndex, triggerId: trigger.id, sourceKey: input.sourceKey, actionId: input.actionId,
          path: trigger.effect.originPath, parentExecutionIndex, eventPath: event.path,
          requestedAmount: event.requestedAmount, actualAppliedAmount: event.actualAppliedAmount,
          resourceId: trigger.effect.resourceId, delta: trigger.effect.delta,
        };
        if (event.event === 'enemyDefeated') {
          triggerTrace.push({ ...traceBase, event: 'enemyDefeated',
            target: { kind: 'enemy', id: event.target.id },
            rewardRecipient: { kind: 'partyCharacter', id: rewardRecipient.id } });
        } else {
          triggerTrace.push({ ...traceBase, event: event.event, target: { ...event.target } });
        }
        resourceLedger.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: trigger.effect.originPath,
          account: trigger.effect.account, identity: { ...rewardRecipient }, resourceId: trigger.effect.resourceId,
          delta: trigger.effect.delta, intentDelta: trigger.effect.delta });
        queueIndex += 1;
      }
      const hasLaterEventInHit = triggerEvents.slice(eventIndex + 1).some(candidate => candidate.hitGroup === event.hitGroup);
      if (!hasLaterEventInHit) {
        const hit = triggerEvents.find(candidate => candidate.hitGroup === event.hitGroup && candidate.event === 'damageApplied');
        if (!hit || hit.event !== 'damageApplied') continue;
        if (!hit.statusDamageEligible) continue;
        const matched = hit.hitStatuses.filter(status => input.statusDefinitions?.find(definition =>
          definition.id === status.statusId)?.onDamageTaken).sort(compareMapEncounterStatusStableOrder);
        for (const status of matched) {
          const reward = input.statusDefinitions?.find(definition => definition.id === status.statusId)?.onDamageTaken;
          if (!reward || !validLocalId(reward.resourceId) || !Number.isSafeInteger(reward.delta) || reward.delta <= 0) {
            throw new MapEffectPlanError(`Status "${status.statusId}" has an invalid onDamageTaken resource effect`);
          }
          statusDamageTriggerTrace.push({ queueIndex, event: 'statusDamageTaken', sourceKey: input.sourceKey,
            actionId: input.actionId, path: `status:${status.statusId}.onDamageTaken`, parentExecutionIndex,
            hitPath: hit.path, requestedAmount: hit.requestedAmount, actualAppliedAmount: hit.actualAppliedAmount,
            status, holder: { ...hit.target }, resourceId: reward.resourceId, delta: reward.delta,
            balanceBefore: 0, balanceAfter: 0 });
          resourceLedger.push({ sourceKey: input.sourceKey, actionId: input.actionId,
            path: `status:${status.statusId}.onDamageTaken`, account: 'primaryActor', identity: { ...hit.target },
            resourceId: reward.resourceId, delta: reward.delta, intentDelta: reward.delta });
          queueIndex += 1;
        }
      }
    }
  }
  const plannedFacts = plannedMapRunFacts();
  return {
    hp,
    locals,
    ...(plannedFacts === undefined ? {} : { plannedMapRunFacts: plannedFacts }),
    ...(effectRandomState === undefined ? {} : { effectRandomState: copyMapEffectRandomState(effectRandomState) }),
    resourceLedger,
    cardEffectModifierIntents: Object.freeze(cardEffectModifierIntents.map(intent => Object.freeze({ ...intent }))),
    trace,
    triggerTrace: Object.freeze(triggerTrace.map(entry => entry.event === 'enemyDefeated'
      ? Object.freeze({ ...entry,
        target: Object.freeze({ kind: 'enemy' as const, id: entry.target.id }),
        rewardRecipient: Object.freeze({ kind: 'partyCharacter' as const, id: entry.rewardRecipient.id }) })
      : Object.freeze({ ...entry, target: Object.freeze({ ...entry.target }) }))),
    statusDamageTriggerTrace: Object.freeze(statusDamageTriggerTrace),
    plannedStatuses: copyMapEncounterStatusInstances(plannedStatuses),
    ...(shields === undefined ? {} : { plannedShields: shields, shieldTrace }),
    statusApplyTrace,
    statusRemoveTrace,
    statusCategoryRemoveTrace,
    statusConsumeTrace,
    prepareDiscounts: effects.prepare.map(leaf => ({ ...leaf })),
    expansionCount,
  };
}
