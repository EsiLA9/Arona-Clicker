import type {
  MapEffectAccountIdentity,
  MapEffectActorIdentity,
  MapEffectGuardRead,
  MapEffectHpState,
  MapEffectPlannerOptions,
  MapEffectResourceLedgerEntry,
  MapEffectSourcePlan,
  MapEffectTraceEntry,
} from '../contracts/map-effects';
import type {
  NormalizedGameplayMapEffectCondition,
  NormalizedGameplayMapEffectInstruction,
} from '../../data-services/normalization/gameplay-map-effect-program';

export class MapEffectPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MapEffectPlanError';
  }
}

const identityKey = (identity: MapEffectActorIdentity) => `${identity.kind}:${identity.id}`;
const cloneLocals = (locals: MapEffectPlannerOptions['input']['locals']) => ({
  counters: Object.fromEntries(Object.entries(locals.counters).map(([id, value]) => [id, { ...value }])),
  flags: { ...locals.flags },
});

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
  const hp = Object.fromEntries(Object.entries(input.hp).map(([key, value]) => [key, { ...value }])) as Record<string, MapEffectHpState>;
  const locals = cloneLocals(input.locals);
  const resourceLedger: MapEffectResourceLedgerEntry[] = [];
  const trace: MapEffectTraceEntry[] = [];
  const instructions = options.instructions ?? effects.resolve;
  if (effects.budget === 'program-4096' && !options.visit) {
    throw new MapEffectPlanError(`Action "${input.actionId}" requires the outer round visit-budget entry`);
  }
  const actorFor = (unit: 'source' | 'primary') => {
    const identity = unit === 'source' ? input.source : input.primary;
    if (!identity) throw new MapEffectPlanError(`Action "${input.actionId}" has no bound ${unit} identity`);
    return identity;
  };
  const accountFor = (account: 'sourceActor' | 'primaryActor' | 'sourceTeam'): MapEffectAccountIdentity => {
    if (account === 'sourceTeam') return input.sourceTeam;
    return actorFor(account === 'sourceActor' ? 'source' : 'primary');
  };
  const recordVisit = (path: string, kind: 'statement' | 'condition') => {
    if (effects.budget === 'program-4096') {
      options.visit!({ sourceKey: input.sourceKey, actionId: input.actionId, path, kind });
    }
  };

  const evaluate = (condition: NormalizedGameplayMapEffectCondition, reads: MapEffectGuardRead[]): boolean => {
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
    } else if (condition.kind === 'counter') {
      const counter = checkedCounter(locals.counters[condition.counterId], condition.counterId, input.actionId);
      result = compareNumber(counter.value, condition.comparison, condition.value);
      reads.push({ path: condition.originPath, op: 'counter', identity: { kind: 'encounterLocal' }, counterId: condition.counterId, current: counter.value, comparison: condition.comparison, value: condition.value, result });
    } else if (condition.kind === 'flag') {
      const current = locals.flags[condition.flagId];
      if (typeof current !== 'boolean') throw new MapEffectPlanError(`Action "${input.actionId}" reads missing Flag "${condition.flagId}"`);
      result = current === condition.value;
      reads.push({ path: condition.originPath, op: 'flag', identity: { kind: 'encounterLocal' }, flagId: condition.flagId, current, value: condition.value, result });
    } else {
      throw new MapEffectPlanError(`Unknown condition kind "${condition.kind}"`);
    }
    if (condition.kind === 'all' || condition.kind === 'any' || condition.kind === 'not') {
      reads.push({ path: condition.originPath, op: condition.kind, result });
    }
    return result;
  };

  const apply = (list: readonly NormalizedGameplayMapEffectInstruction[]): void => {
    for (const instruction of list) {
      recordVisit(instruction.originPath, 'statement');
      if (instruction.op === 'when') {
        const reads: MapEffectGuardRead[] = [];
        const result = evaluate(instruction.condition, reads);
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath, op: 'when', result, reads });
        apply(result ? instruction.then : instruction.else ?? []);
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
      } else if (instruction.op === 'resourceChange') {
        const identity = accountFor(instruction.account);
        resourceLedger.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath, account: instruction.account, identity: { ...identity }, resourceId: instruction.resourceId, delta: instruction.delta });
        trace.push({ sourceKey: input.sourceKey, actionId: input.actionId, path: instruction.originPath, op: 'resourceChange', identity: { ...identity }, resourceId: instruction.resourceId, delta: instruction.delta });
      } else {
        throw new MapEffectPlanError(`Action "${input.actionId}" has unknown effect instruction "${(instruction as { op?: unknown }).op}"`);
      }
    }
  };

  apply(instructions);
  return {
    hp,
    locals,
    resourceLedger,
    trace,
    prepareDiscounts: effects.prepare.map(leaf => ({ ...leaf })),
  };
}
