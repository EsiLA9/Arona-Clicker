import { GAMEPLAY_MAP_EFFECT_LIMITS } from '../contracts/gameplay-map-effects';
import { isTagRef } from '../../engine/core/tag';

export interface GameplayMapEffectSyntaxIssue {
  readonly path: string;
  readonly code: 'type' | 'unknown-field' | 'unknown-op' | 'range' | 'limit' | 'duplicate' | 'shape';
  readonly message: string;
  readonly limit?: number;
}

export interface GameplayMapEffectSyntaxResult {
  readonly ok: boolean;
  readonly issues: readonly GameplayMapEffectSyntaxIssue[];
  readonly counts: {
    readonly staticNodes: number;
    readonly prepareLeaves: number;
    readonly locals: number;
    readonly valueNodes: number;
  };
  /** Whether this syntax uses a P2 construct restricted to explicit AG-1 Maps. */
  readonly requiresAg1: boolean;
}

type Obj = Record<string, unknown>;
type State = { issues: GameplayMapEffectSyntaxIssue[]; staticNodes: number; prepareLeaves: number; locals: number; valueNodes: number; stopped: boolean; requiresAg1: boolean };
const isObj = (v: unknown): v is Obj => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  try { const prototype = Object.getPrototypeOf(v); return prototype === Object.prototype || prototype === null; }
  catch { return false; }
};
const isSafe = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const isName = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v);
const isResourceId = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const keys = (o: Obj, allowed: readonly string[], path: string, s: State) => {
  for (const key of Object.keys(o)) if (!allowed.includes(key)) issue(s, `${path}.${key}`, 'unknown-field', `Unknown field '${key}'`);
};
const issue = (s: State, path: string, code: GameplayMapEffectSyntaxIssue['code'], message: string, limit?: number) => {
  s.issues.push({ path, code, message, ...(limit === undefined ? {} : { limit }) });
};
const record = (v: unknown, path: string, s: State): Obj | undefined => {
  if (isObj(v)) return v;
  issue(s, path, 'type', 'Expected an object');
  return undefined;
};
const integer = (v: unknown, path: string, s: State, positive = false, nonZero = false) => {
  if (!isSafe(v) || (positive && v <= 0) || (nonZero && v === 0)) issue(s, path, 'range', positive ? 'Expected a positive safe integer' : nonZero ? 'Expected a non-zero safe integer' : 'Expected a safe integer');
};
const name = (v: unknown, path: string, s: State) => { if (!isName(v)) issue(s, path, 'shape', 'Expected a local name (letter followed by up to 63 letters, digits, _ or -)'); };
const unit = (v: unknown, path: string, s: State, loopDepth = 0) => {
  if (v === 'loopTarget') s.requiresAg1 = true;
  if (v !== 'source' && v !== 'primary' && !(v === 'loopTarget' && loopDepth > 0)) {
    issue(s, path, 'shape', loopDepth > 0 ? "Expected 'source', 'primary', or 'loopTarget'" : "Expected 'source' or 'primary'");
  }
};
const account = (v: unknown, path: string, s: State, loopDepth = 0) => {
  if (v === 'additionalActor' || v === 'loopTargetActor') s.requiresAg1 = true;
  if (typeof v !== 'string' || !['sourceActor', 'primaryActor', 'sourceTeam', 'additionalActor', ...(loopDepth > 0 ? ['loopTargetActor'] : [])].includes(v)) {
    issue(s, path, 'shape', 'Unknown resource account or loopTargetActor used outside forTargets');
  }
};
const balanceAccount = (v: unknown, path: string, s: State, loopDepth = 0) => {
  if (v === 'additionalActor' || v === 'loopTargetActor') s.requiresAg1 = true;
  if (typeof v !== 'string' || !['sourceActor', 'primaryActor', 'additionalActor', 'sourceTeam', ...(loopDepth > 0 ? ['loopTargetActor'] : [])].includes(v)) {
    issue(s, path, 'shape', 'Unknown resource account or loopTargetActor used outside forTargets');
  }
};
const bump = (s: State, path: string) => {
  s.staticNodes += 1;
  if (s.staticNodes > GAMEPLAY_MAP_EFFECT_LIMITS.staticNodes) {
    issue(s, path, 'limit', 'Static program node limit exceeded', GAMEPLAY_MAP_EFFECT_LIMITS.staticNodes);
    s.stopped = true;
    return false;
  }
  return true;
};
const array = (v: unknown, path: string, s: State): unknown[] | undefined => {
  if (Array.isArray(v)) return v;
  issue(s, path, 'type', 'Expected an array');
  return undefined;
};

function checkValue(value: unknown, path: string, depth: number, s: State, loopDepth = 0): void {
  s.valueNodes += 1;
  if (s.valueNodes > GAMEPLAY_MAP_EFFECT_LIMITS.valueNodes) {
    issue(s, path, 'limit', 'Value node limit exceeded', GAMEPLAY_MAP_EFFECT_LIMITS.valueNodes);
    return;
  }
  if (depth > GAMEPLAY_MAP_EFFECT_LIMITS.valueDepth) {
    issue(s, path, 'limit', 'Value depth limit exceeded', GAMEPLAY_MAP_EFFECT_LIMITS.valueDepth);
    return;
  }
  const o = record(value, path, s); if (!o) return;
  switch (o.kind) {
    case 'literal':
      keys(o, ['kind', 'value'], path, s); integer(o.value, `${path}.value`, s); return;
    case 'hp': case 'hpCap': case 'missingHp':
      keys(o, ['kind', 'unit'], path, s);
      if (o.unit === 'loopTarget') s.requiresAg1 = true;
      if (o.unit !== 'source' && o.unit !== 'primary' && o.unit !== 'target' && !(o.unit === 'loopTarget' && loopDepth > 0)) {
        issue(s, `${path}.unit`, 'shape', loopDepth > 0 ? "Expected 'source', 'primary', 'target', or 'loopTarget'" : "Expected 'source', 'primary', or 'target'");
      }
      return;
    case 'counter':
      keys(o, ['kind', 'counterId'], path, s); name(o.counterId, `${path}.counterId`, s); return;
    case 'mapRunCounter':
      s.requiresAg1 = true;
      keys(o, ['kind', 'counterId'], path, s); name(o.counterId, `${path}.counterId`, s); return;
    case 'resourceBalance':
      s.requiresAg1 = true;
      keys(o, ['kind', 'account', 'resourceId'], path, s); balanceAccount(o.account, `${path}.account`, s, loopDepth);
      if (!isResourceId(o.resourceId)) issue(s, `${path}.resourceId`, 'shape', 'Expected a resource key'); return;
    case 'round': case 'targetCount':
      keys(o, ['kind'], path, s); return;
    case 'add': case 'sub': case 'mul': case 'divFloor': case 'min': case 'max':
      keys(o, ['kind', 'left', 'right'], path, s);
      checkValue(o.left, `${path}.left`, depth + 1, s, loopDepth);
      checkValue(o.right, `${path}.right`, depth + 1, s, loopDepth); return;
    case 'clamp':
      keys(o, ['kind', 'value', 'min', 'max'], path, s);
      checkValue(o.value, `${path}.value`, depth + 1, s, loopDepth);
      checkValue(o.min, `${path}.min`, depth + 1, s, loopDepth);
      checkValue(o.max, `${path}.max`, depth + 1, s, loopDepth); return;
    case 'abs':
      keys(o, ['kind', 'value'], path, s); checkValue(o.value, `${path}.value`, depth + 1, s, loopDepth); return;
    default:
      issue(s, `${path}.kind`, 'unknown-op', 'Unknown Value operation');
  }
}

function checkTargetSet(value: unknown, path: string, s: State): void {
  const set = record(value, path, s); if (!set) return;
  keys(set, ['side', 'filter', 'order', 'limit'], path, s);
  if (set.side !== 'party' && set.side !== 'enemy') issue(s, `${path}.side`, 'shape', "Expected 'party' or 'enemy'");
  if (set.filter !== undefined && set.filter !== 'living' && set.filter !== 'all') issue(s, `${path}.filter`, 'shape', "Expected 'living' or 'all'");
  if (set.order !== undefined && !['definition', 'hpRatioAscending', 'hpRatioDescending', 'random'].includes(String(set.order))) {
    issue(s, `${path}.order`, 'shape', 'Unknown target-set order');
  }
  if (set.order === 'random') s.requiresAg1 = true;
  if (set.limit !== undefined) {
    integer(set.limit, `${path}.limit`, s, true);
    if (isSafe(set.limit) && set.limit > GAMEPLAY_MAP_EFFECT_LIMITS.targetSetSize) {
      issue(s, `${path}.limit`, 'limit', 'Target-set limit exceeds the maximum', GAMEPLAY_MAP_EFFECT_LIMITS.targetSetSize);
    }
  }
  if (set.order === 'random' && set.limit === undefined) {
    issue(s, `${path}.limit`, 'shape', 'Random TargetSet requires a limit from 1 to 32');
  }
}

function checkDamageTarget(value: unknown, path: string, s: State): void {
  if (value === 'primary') return;
  const target = record(value, path, s); if (!target) return;
  keys(target, ['set'], path, s);
  checkTargetSet(target.set, `${path}.set`, s);
}

function checkCondition(v: unknown, path: string, depth: number, s: State, loopDepth = 0): void {
  if (s.stopped || !bump(s, path)) return;
  // Check the depth before reading or descending into child values.
  if (depth > GAMEPLAY_MAP_EFFECT_LIMITS.conditionDepth) {
    issue(s, path, 'limit', 'Condition depth limit exceeded', GAMEPLAY_MAP_EFFECT_LIMITS.conditionDepth);
    return;
  }
  const o = record(v, path, s); if (!o) return;
  switch (o.kind) {
    case 'all': case 'any': {
      keys(o, ['kind', 'conditions'], path, s);
      const children = array(o.conditions, `${path}.conditions`, s); if (!children) return;
      if (children.length === 0) issue(s, `${path}.conditions`, 'shape', 'Expected at least one condition');
      for (let i = 0; i < children.length && !s.stopped; i++) checkCondition(children[i], `${path}.conditions[${i}]`, depth + 1, s, loopDepth);
      return;
    }
    case 'not':
      keys(o, ['kind', 'condition'], path, s);
      checkCondition(o.condition, `${path}.condition`, depth + 1, s, loopDepth); return;
    case 'hpAtLeast': case 'hpAtMost':
      keys(o, ['kind', 'target', 'value'], path, s); unit(o.target, `${path}.target`, s, loopDepth); integer(o.value, `${path}.value`, s);
      if (isSafe(o.value) && o.value < 0) issue(s, `${path}.value`, 'range', 'HP threshold must be non-negative'); return;
    case 'hpRatioAtLeast': case 'hpRatioAtMost':
      keys(o, ['kind', 'target', 'numerator', 'denominator'], path, s); unit(o.target, `${path}.target`, s, loopDepth);
      integer(o.numerator, `${path}.numerator`, s); integer(o.denominator, `${path}.denominator`, s, true);
      if (isSafe(o.numerator) && isSafe(o.denominator) && (o.numerator < 0 || o.numerator > o.denominator)) issue(s, `${path}.numerator`, 'range', 'HP ratio must be between zero and one'); return;
    case 'preparedTagCount':
      keys(o, ['kind', 'side', 'tag', 'comparison', 'value'], path, s);
      if (o.side !== 'party') issue(s, `${path}.side`, 'shape', 'Prepared tag counts currently support only party');
      if (typeof o.tag !== 'string' || !isTagRef(o.tag)) issue(s, `${path}.tag`, 'shape', 'Expected a complete TagRef');
      if (typeof o.comparison !== 'string' || !['eq', 'lt', 'lte', 'gt', 'gte'].includes(o.comparison)) issue(s, `${path}.comparison`, 'shape', 'Unknown prepared Tag count comparison');
      integer(o.value, `${path}.value`, s);
      if (isSafe(o.value) && o.value < 0) issue(s, `${path}.value`, 'range', 'Prepared Tag count threshold must be non-negative');
      return;
    case 'counter':
      keys(o, ['kind', 'counterId', 'comparison', 'value'], path, s); name(o.counterId, `${path}.counterId`, s);
      if (typeof o.comparison !== 'string' || !['eq', 'lt', 'lte', 'gt', 'gte'].includes(o.comparison)) issue(s, `${path}.comparison`, 'shape', 'Unknown counter comparison');
      integer(o.value, `${path}.value`, s); return;
    case 'flag':
      keys(o, ['kind', 'flagId', 'value'], path, s); name(o.flagId, `${path}.flagId`, s);
      if (typeof o.value !== 'boolean') issue(s, `${path}.value`, 'type', 'Expected a boolean'); return;
    case 'mapRunCounter':
      s.requiresAg1 = true;
      keys(o, ['kind', 'counterId', 'comparison', 'value'], path, s); name(o.counterId, `${path}.counterId`, s);
      if (typeof o.comparison !== 'string' || !['eq', 'lt', 'lte', 'gt', 'gte'].includes(o.comparison)) issue(s, `${path}.comparison`, 'shape', 'Unknown MapRun Counter comparison');
      integer(o.value, `${path}.value`, s); return;
    case 'mapRunFlag':
      s.requiresAg1 = true;
      keys(o, ['kind', 'flagId', 'value'], path, s); name(o.flagId, `${path}.flagId`, s);
      if (typeof o.value !== 'boolean') issue(s, `${path}.value`, 'type', 'Expected a boolean'); return;
    case 'resourceAtLeast':
      s.requiresAg1 = true;
      keys(o, ['kind', 'account', 'resourceId', 'value'], path, s); balanceAccount(o.account, `${path}.account`, s, loopDepth);
      if (!isResourceId(o.resourceId)) issue(s, `${path}.resourceId`, 'shape', 'Expected a resource key');
      integer(o.value, `${path}.value`, s);
      if (isSafe(o.value) && o.value < 0) issue(s, `${path}.value`, 'range', 'Resource threshold must be non-negative'); return;
    default:
      issue(s, `${path}.kind`, 'unknown-op', 'Unknown condition kind');
  }
}

function checkStatements(value: unknown, path: string, depth: number, s: State, loopDepth = 0): void {
  const list = array(value, path, s); if (!list) return;
  for (let i = 0; i < list.length && !s.stopped; i++) {
    const p = `${path}[${i}]`;
    if (!bump(s, p)) return;
    // Refuse over-depth nodes before inspecting their nested payload.
    if (depth > GAMEPLAY_MAP_EFFECT_LIMITS.resolveDepth) { issue(s, p, 'limit', 'Resolve depth limit exceeded', GAMEPLAY_MAP_EFFECT_LIMITS.resolveDepth); return; }
    const o = record(list[i], p, s); if (!o) continue;
    switch (o.op) {
      case 'damage': case 'heal':
        keys(o, ['op', 'target', 'amount', 'repeat'], p, s);
        checkDamageTarget(o.target, `${p}.target`, s);
        if (isSafe(o.amount)) integer(o.amount, `${p}.amount`, s, true);
        else checkValue(o.amount, `${p}.amount`, 1, s, loopDepth);
        if (o.repeat !== undefined) {
          if (isSafe(o.repeat)) {
            integer(o.repeat, `${p}.repeat`, s);
            if (o.repeat < 0 || o.repeat > GAMEPLAY_MAP_EFFECT_LIMITS.effectRepeat) issue(s, `${p}.repeat`, 'limit', 'Repeat must be between zero and the maximum', GAMEPLAY_MAP_EFFECT_LIMITS.effectRepeat);
          } else checkValue(o.repeat, `${p}.repeat`, 1, s, loopDepth);
        }
        break;
      case 'revive':
        s.requiresAg1 = true;
        keys(o, ['op', 'target', 'amount'], p, s);
        if (loopDepth > 0) issue(s, p, 'shape', 'revive is not available inside forTargets');
        if (o.target !== 'primary') issue(s, `${p}.target`, 'shape', "Expected 'primary'");
        integer(o.amount, `${p}.amount`, s, true);
        break;
      case 'hpChange':
        keys(o, ['op', 'target', 'delta'], p, s); unit(o.target, `${p}.target`, s, loopDepth); integer(o.delta, `${p}.delta`, s, false, true); break;
      case 'resourceChange':
        keys(o, ['op', 'account', 'resourceId', 'delta'], p, s);
        account(o.account, `${p}.account`, s, loopDepth);
        if (!isResourceId(o.resourceId)) issue(s, `${p}.resourceId`, 'shape', 'Expected a resource key');
        integer(o.delta, `${p}.delta`, s, false, true); break;
      case 'counterAdd':
        keys(o, ['op', 'counterId', 'delta'], p, s); name(o.counterId, `${p}.counterId`, s); integer(o.delta, `${p}.delta`, s, false, true); break;
      case 'flagSet':
        keys(o, ['op', 'flagId', 'value'], p, s); name(o.flagId, `${p}.flagId`, s);
        if (typeof o.value !== 'boolean') issue(s, `${p}.value`, 'type', 'Expected a boolean'); break;
      case 'mapRunCounterAdd':
        s.requiresAg1 = true;
        keys(o, ['op', 'counterId', 'delta'], p, s); name(o.counterId, `${p}.counterId`, s); integer(o.delta, `${p}.delta`, s, false, true); break;
      case 'mapRunFlagSet':
        s.requiresAg1 = true;
        keys(o, ['op', 'flagId', 'value'], p, s); name(o.flagId, `${p}.flagId`, s);
        if (typeof o.value !== 'boolean') issue(s, `${p}.value`, 'type', 'Expected a boolean'); break;
      case 'cardEffectModifier':
        s.requiresAg1 = true;
        keys(o, ['op', 'path', 'operation', 'delta'], p, s);
        if (o.path !== 'resolve[0].amount') issue(s, `${p}.path`, 'shape', "Expected 'resolve[0].amount'");
        if (o.operation !== 'add') issue(s, `${p}.operation`, 'shape', "Expected 'add'");
        integer(o.delta, `${p}.delta`, s, false, true);
        break;
      case 'statusApply':
        keys(o, ['op', 'target', 'statusId', 'stacks', 'durationRounds'], p, s);
        unit(o.target, `${p}.target`, s, loopDepth); name(o.statusId, `${p}.statusId`, s);
        integer(o.stacks, `${p}.stacks`, s, true); integer(o.durationRounds, `${p}.durationRounds`, s, true);
        if (isSafe(o.stacks) && o.stacks > GAMEPLAY_MAP_EFFECT_LIMITS.statusStacks) issue(s, `${p}.stacks`, 'limit', 'Status stacks exceed the maximum', GAMEPLAY_MAP_EFFECT_LIMITS.statusStacks);
        if (isSafe(o.durationRounds) && o.durationRounds > GAMEPLAY_MAP_EFFECT_LIMITS.statusDurationRounds) issue(s, `${p}.durationRounds`, 'limit', 'Status duration exceeds the maximum', GAMEPLAY_MAP_EFFECT_LIMITS.statusDurationRounds);
        break;
      case 'statusRemove':
        keys(o, ['op', 'target', 'statusId'], p, s);
        if (o.target !== 'source' && o.target !== 'primary') {
          issue(s, `${p}.target`, 'shape', "Expected 'source' or 'primary'");
        }
        name(o.statusId, `${p}.statusId`, s);
        break;
      case 'statusConsume':
        s.requiresAg1 = true;
        keys(o, ['op', 'target', 'statusId', 'stacks'], p, s);
        if (o.target !== 'source' && o.target !== 'primary') {
          issue(s, `${p}.target`, 'shape', "Expected 'source' or 'primary'");
        }
        name(o.statusId, `${p}.statusId`, s);
        integer(o.stacks, `${p}.stacks`, s, true);
        if (isSafe(o.stacks) && o.stacks > GAMEPLAY_MAP_EFFECT_LIMITS.statusStacks) issue(s, `${p}.stacks`, 'limit', 'Status stacks exceed the maximum', GAMEPLAY_MAP_EFFECT_LIMITS.statusStacks);
        break;
      case 'statusRemoveCategory':
        s.requiresAg1 = true;
        keys(o, ['op', 'target', 'category'], p, s);
        if (o.target !== 'source' && o.target !== 'primary') issue(s, `${p}.target`, 'shape', "Expected 'source' or 'primary'");
        if (o.category !== 'harmful' && o.category !== 'beneficial') issue(s, `${p}.category`, 'shape', 'Expected harmful or beneficial');
        break;
      case 'shieldAdd':
        s.requiresAg1 = true;
        keys(o, ['op', 'target', 'amount'], p, s);
        if (o.target !== 'source' && o.target !== 'primary') {
          issue(s, `${p}.target`, 'shape', "Expected 'source' or 'primary'");
        }
        if (isSafe(o.amount)) integer(o.amount, `${p}.amount`, s, true);
        else {
          checkValue(o.amount, `${p}.amount`, 1, s, loopDepth);
          if (isObj(o.amount) && o.amount.kind === 'literal' && isSafe(o.amount.value) && o.amount.value <= 0) {
            issue(s, `${p}.amount.value`, 'range', 'Expected a positive safe integer');
          }
        }
        break;
      case 'when':
        keys(o, ['op', 'condition', 'then', 'else'], p, s);
        checkCondition(o.condition, `${p}.condition`, 1, s, loopDepth);
        checkStatements(o.then, `${p}.then`, depth + 1, s, loopDepth);
        if (o.else !== undefined) checkStatements(o.else, `${p}.else`, depth + 1, s, loopDepth);
        break;
      case 'forTargets':
        s.requiresAg1 = true;
        keys(o, ['op', 'targetSet', 'body'], p, s);
        checkTargetSet(o.targetSet, `${p}.targetSet`, s);
        checkStatements(o.body, `${p}.body`, depth + 1, s, loopDepth + 1);
        break;
      default:
        issue(s, `${p}.op`, 'unknown-op', 'Unknown effect operation');
    }
  }
}

const result = (s: State): GameplayMapEffectSyntaxResult => ({
  ok: s.issues.length === 0,
  issues: s.issues,
  counts: { staticNodes: s.staticNodes, prepareLeaves: s.prepareLeaves, locals: s.locals, valueNodes: s.valueNodes },
  requiresAg1: s.requiresAg1,
});
const state = (): State => ({ issues: [], staticNodes: 0, prepareLeaves: 0, locals: 0, valueNodes: 0, stopped: false, requiresAg1: false });

/** Validate an untrusted Action.effectProgram without resolving Registry references. */
export function validateGameplayMapEffectProgram(value: unknown, path = 'effectProgram'): GameplayMapEffectSyntaxResult {
  const s = state();
  try {
    const o = record(value, path, s); if (!o) return result(s);
    keys(o, ['prepare', 'resolve', 'triggers'], path, s);
    if (o.prepare !== undefined) {
      const leaves = array(o.prepare, `${path}.prepare`, s);
      if (leaves) {
        if (leaves.length > GAMEPLAY_MAP_EFFECT_LIMITS.prepareLeaves) issue(s, `${path}.prepare`, 'limit', 'Prepare leaf limit exceeded', GAMEPLAY_MAP_EFFECT_LIMITS.prepareLeaves);
        for (let i = 0; i < leaves.length && i < GAMEPLAY_MAP_EFFECT_LIMITS.prepareLeaves; i++) {
          const p = `${path}.prepare[${i}]`; if (!bump(s, p)) break;
          s.prepareLeaves += 1;
          const leaf = record(leaves[i], p, s); if (!leaf) continue;
          keys(leaf, ['op', 'amount'], p, s);
          if (leaf.op !== 'discountSCost') issue(s, `${p}.op`, 'unknown-op', 'Unknown prepare operation');
          integer(leaf.amount, `${p}.amount`, s, true);
        }
      }
    }
    if (o.resolve !== undefined) checkStatements(o.resolve, `${path}.resolve`, 1, s);
    if (o.triggers !== undefined) {
      const triggers = array(o.triggers, `${path}.triggers`, s);
      if (triggers) {
        const ids = new Set<string>();
        for (let index = 0; index < triggers.length && !s.stopped; index += 1) {
          const triggerPath = `${path}.triggers[${index}]`;
          if (!bump(s, triggerPath)) break;
          s.requiresAg1 = true;
          const trigger = record(triggers[index], triggerPath, s);
          if (!trigger) continue;
          keys(trigger, ['id', 'event', 'minimumActualAmount', 'effect'], triggerPath, s);
          name(trigger.id, `${triggerPath}.id`, s);
          if (isName(trigger.id)) {
            if (ids.has(trigger.id)) issue(s, `${triggerPath}.id`, 'duplicate', `Duplicate Trigger id "${trigger.id}"`);
            ids.add(trigger.id);
          }
          if (trigger.event !== 'healApplied' && trigger.event !== 'damageApplied' && trigger.event !== 'enemyDefeated') {
            issue(s, `${triggerPath}.event`, 'shape', "Expected 'healApplied', 'damageApplied', or 'enemyDefeated'");
          }
          if (trigger.minimumActualAmount !== undefined) {
            if (trigger.event === 'enemyDefeated') {
              issue(s, `${triggerPath}.minimumActualAmount`, 'shape', 'enemyDefeated does not accept a damage threshold');
            } else {
              integer(trigger.minimumActualAmount, `${triggerPath}.minimumActualAmount`, s, true);
            }
          }
          const effect = record(trigger.effect, `${triggerPath}.effect`, s);
          if (!effect) continue;
          keys(effect, ['op', 'account', 'resourceId', 'delta'], `${triggerPath}.effect`, s);
          if (effect.op !== 'resourceChange') issue(s, `${triggerPath}.effect.op`, 'unknown-op', "Expected 'resourceChange'");
          const expectedAccount = trigger.event === 'enemyDefeated' ? 'sourceActor' : 'primaryActor';
          if (effect.account !== expectedAccount) {
            issue(s, `${triggerPath}.effect.account`, 'shape', `Expected '${expectedAccount}' for this Trigger event`);
          }
          if (!isResourceId(effect.resourceId)) issue(s, `${triggerPath}.effect.resourceId`, 'shape', 'Expected a resource key');
          integer(effect.delta, `${triggerPath}.effect.delta`, s, true);
        }
      }
    }
  } catch {
    issue(s, path, 'type', 'Could not safely read program object');
  }
  return result(s);
}

/** Validate closed Map-local Status definitions before Registry binds statusApply references. */
export function validateGameplayMapStatusSyntax(value: unknown, path = 'statuses'): GameplayMapEffectSyntaxResult {
  const s = state();
  try {
    const list = array(value, path, s);
    if (list) {
      if (list.length > GAMEPLAY_MAP_EFFECT_LIMITS.statusDefinitions) {
        issue(s, path, 'limit', 'Map Status definition limit exceeded', GAMEPLAY_MAP_EFFECT_LIMITS.statusDefinitions);
      }
      const ids = new Set<string>();
      for (let index = 0; index < list.length && index < GAMEPLAY_MAP_EFFECT_LIMITS.statusDefinitions; index += 1) {
        const itemPath = `${path}[${index}]`;
        const status = record(list[index], itemPath, s);
        if (!status) continue;
        const kind = status.kind;
        keys(status, kind === 'damageReduction'
          ? ['id', 'name', 'description', 'category', 'kind', 'damageReductionPerStack', 'maxStacks', 'onExpire', 'onDamageTaken', 'lifetime']
          : kind === 'damageProtection'
            ? ['id', 'name', 'description', 'category', 'kind', 'maxStacks', 'onExpire', 'onDamageTaken', 'lifetime']
            : ['id', 'name', 'description', 'category', 'kind', 'hpPerStack', 'maxStacks', 'onExpire', 'onDamageTaken', 'lifetime'], itemPath, s);
        name(status.id, `${itemPath}.id`, s);
        if (isName(status.id)) {
          if (ids.has(status.id)) issue(s, `${itemPath}.id`, 'duplicate', `Duplicate Status id "${status.id}"`);
          ids.add(status.id);
        }
        if (typeof status.name !== 'string' || status.name.trim().length === 0) issue(s, `${itemPath}.name`, 'shape', 'Expected a non-empty display name');
        if (status.description !== undefined && typeof status.description !== 'string') issue(s, `${itemPath}.description`, 'type', 'Expected a string');
        if (status.lifetime !== undefined && status.lifetime !== 'encounter' && status.lifetime !== 'mapRun') {
          issue(s, `${itemPath}.lifetime`, 'shape', "Expected 'encounter' or 'mapRun'");
        }
        if (status.onExpire !== undefined) {
          const expiry = record(status.onExpire, `${itemPath}.onExpire`, s);
          if (expiry) {
            keys(expiry, ['resourceId', 'delta'], `${itemPath}.onExpire`, s);
            if (!isResourceId(expiry.resourceId)) issue(s, `${itemPath}.onExpire.resourceId`, 'shape', 'Expected a resource key');
            integer(expiry.delta, `${itemPath}.onExpire.delta`, s, true);
          }
        }
        if (status.onDamageTaken !== undefined) {
          const reward = record(status.onDamageTaken, `${itemPath}.onDamageTaken`, s);
          if (reward) {
            keys(reward, ['resourceId', 'delta'], `${itemPath}.onDamageTaken`, s);
            if (!isResourceId(reward.resourceId)) issue(s, `${itemPath}.onDamageTaken.resourceId`, 'shape', 'Expected a resource key');
            integer(reward.delta, `${itemPath}.onDamageTaken.delta`, s, true);
          }
        }
        if (status.category !== undefined && status.category !== 'harmful' && status.category !== 'beneficial') {
          issue(s, `${itemPath}.category`, 'shape', 'Expected harmful or beneficial');
        }
        if (kind === 'burn' || kind === 'regen') {
          integer(status.hpPerStack, `${itemPath}.hpPerStack`, s, true);
        } else if (kind === 'damageReduction') {
          if (status.category !== 'beneficial') issue(s, `${itemPath}.category`, 'shape', 'damageReduction Status category must be beneficial');
          integer(status.damageReductionPerStack, `${itemPath}.damageReductionPerStack`, s, true);
        } else if (kind === 'damageProtection') {
          if (status.category !== 'beneficial') issue(s, `${itemPath}.category`, 'shape', 'damageProtection Status category must be beneficial');
        } else {
          issue(s, `${itemPath}.kind`, 'shape', 'Expected burn, regen, damageReduction, or damageProtection');
        }
        integer(status.maxStacks, `${itemPath}.maxStacks`, s, true);
        if (isSafe(status.maxStacks) && status.maxStacks > GAMEPLAY_MAP_EFFECT_LIMITS.statusStacks) {
          issue(s, `${itemPath}.maxStacks`, 'limit', 'Status maxStacks exceeds the maximum', GAMEPLAY_MAP_EFFECT_LIMITS.statusStacks);
        }
      }
    }
  } catch {
    issue(s, path, 'type', 'Could not safely read Status definitions');
  }
  return result(s);
}

/** Validate Encounter locals and condition completion syntax; Registry binds names and context. */
export function validateGameplayEncounterEffectSyntax(value: unknown, path = 'encounter'): GameplayMapEffectSyntaxResult {
  const s = state();
  try {
    const encounter = record(value, path, s); if (!encounter) return result(s);
    if (encounter.locals !== undefined) {
      const locals = record(encounter.locals, `${path}.locals`, s);
      if (locals) {
        keys(locals, ['counters', 'flags'], `${path}.locals`, s);
        const names = new Set<string>();
        for (const [key, counter] of [['counters', true], ['flags', false]] as const) {
          const entries = locals[key]; if (entries === undefined) continue;
          const list = array(entries, `${path}.locals.${key}`, s); if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            s.locals += 1; const p = `${path}.locals.${key}[${i}]`;
            if (s.locals > GAMEPLAY_MAP_EFFECT_LIMITS.locals) { issue(s, p, 'limit', 'Encounter locals limit exceeded', GAMEPLAY_MAP_EFFECT_LIMITS.locals); break; }
            const entry = record(list[i], p, s); if (!entry) continue;
            keys(entry, counter ? ['id', 'initial', 'min', 'max'] : ['id', 'initial'], p, s);
            name(entry.id, `${p}.id`, s);
            if (isName(entry.id)) { if (names.has(entry.id)) issue(s, `${p}.id`, 'duplicate', 'Counter and Flag names share one Encounter namespace'); names.add(entry.id); }
            if (counter) {
              integer(entry.initial, `${p}.initial`, s); integer(entry.min, `${p}.min`, s); integer(entry.max, `${p}.max`, s);
              if (isSafe(entry.initial) && isSafe(entry.min) && isSafe(entry.max) && !(entry.min <= entry.initial && entry.initial <= entry.max)) issue(s, p, 'range', 'Counter requires min <= initial <= max');
            } else if (typeof entry.initial !== 'boolean') issue(s, `${p}.initial`, 'type', 'Expected a boolean');
          }
        }
      }
    }
    if (encounter.completion !== undefined) {
      const p = `${path}.completion`; const completion = record(encounter.completion, p, s);
      if (completion) {
        if (completion.kind === 'condition') {
          keys(completion, ['kind', 'label', 'condition'], p, s);
          if (typeof completion.label !== 'string') issue(s, `${p}.label`, 'type', 'Expected a label');
          checkCondition(completion.condition, `${p}.condition`, 1, s);
        }
        else if (completion.kind === 'manual') { keys(completion, ['kind', 'label'], p, s); if (typeof completion.label !== 'string') issue(s, `${p}.label`, 'type', 'Expected a label'); }
        else issue(s, `${p}.kind`, 'unknown-op', 'Unknown completion kind');
      }
    }
  } catch {
    issue(s, path, 'type', 'Could not safely read Encounter effect object');
  }
  return result(s);
}
