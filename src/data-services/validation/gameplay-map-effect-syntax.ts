import { GAMEPLAY_MAP_EFFECT_LIMITS } from '../contracts/gameplay-map-effects';

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
  };
}

type Obj = Record<string, unknown>;
type State = { issues: GameplayMapEffectSyntaxIssue[]; staticNodes: number; prepareLeaves: number; locals: number; stopped: boolean };
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
const unit = (v: unknown, path: string, s: State) => { if (v !== 'source' && v !== 'primary') issue(s, path, 'shape', "Expected 'source' or 'primary'"); };
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

function checkCondition(v: unknown, path: string, depth: number, s: State): void {
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
      for (let i = 0; i < children.length && !s.stopped; i++) checkCondition(children[i], `${path}.conditions[${i}]`, depth + 1, s);
      return;
    }
    case 'not':
      keys(o, ['kind', 'condition'], path, s);
      checkCondition(o.condition, `${path}.condition`, depth + 1, s); return;
    case 'hpAtLeast': case 'hpAtMost':
      keys(o, ['kind', 'target', 'value'], path, s); unit(o.target, `${path}.target`, s); integer(o.value, `${path}.value`, s);
      if (isSafe(o.value) && o.value < 0) issue(s, `${path}.value`, 'range', 'HP threshold must be non-negative'); return;
    case 'hpRatioAtLeast': case 'hpRatioAtMost':
      keys(o, ['kind', 'target', 'numerator', 'denominator'], path, s); unit(o.target, `${path}.target`, s);
      integer(o.numerator, `${path}.numerator`, s); integer(o.denominator, `${path}.denominator`, s, true);
      if (isSafe(o.numerator) && isSafe(o.denominator) && (o.numerator < 0 || o.numerator > o.denominator)) issue(s, `${path}.numerator`, 'range', 'HP ratio must be between zero and one'); return;
    case 'counter':
      keys(o, ['kind', 'counterId', 'comparison', 'value'], path, s); name(o.counterId, `${path}.counterId`, s);
      if (typeof o.comparison !== 'string' || !['eq', 'lt', 'lte', 'gt', 'gte'].includes(o.comparison)) issue(s, `${path}.comparison`, 'shape', 'Unknown counter comparison');
      integer(o.value, `${path}.value`, s); return;
    case 'flag':
      keys(o, ['kind', 'flagId', 'value'], path, s); name(o.flagId, `${path}.flagId`, s);
      if (typeof o.value !== 'boolean') issue(s, `${path}.value`, 'type', 'Expected a boolean'); return;
    default:
      issue(s, `${path}.kind`, 'unknown-op', 'Unknown condition kind');
  }
}

function checkStatements(value: unknown, path: string, depth: number, s: State): void {
  const list = array(value, path, s); if (!list) return;
  for (let i = 0; i < list.length && !s.stopped; i++) {
    const p = `${path}[${i}]`;
    if (!bump(s, p)) return;
    // Refuse over-depth nodes before inspecting their nested payload.
    if (depth > GAMEPLAY_MAP_EFFECT_LIMITS.resolveDepth) { issue(s, p, 'limit', 'Resolve depth limit exceeded', GAMEPLAY_MAP_EFFECT_LIMITS.resolveDepth); return; }
    const o = record(list[i], p, s); if (!o) continue;
    switch (o.op) {
      case 'hpChange':
        keys(o, ['op', 'target', 'delta'], p, s); unit(o.target, `${p}.target`, s); integer(o.delta, `${p}.delta`, s, false, true); break;
      case 'resourceChange':
        keys(o, ['op', 'account', 'resourceId', 'delta'], p, s);
        if (typeof o.account !== 'string' || !['sourceActor', 'primaryActor', 'sourceTeam'].includes(o.account)) issue(s, `${p}.account`, 'shape', 'Unknown resource account');
        if (!isResourceId(o.resourceId)) issue(s, `${p}.resourceId`, 'shape', 'Expected a resource key');
        integer(o.delta, `${p}.delta`, s, false, true); break;
      case 'counterAdd':
        keys(o, ['op', 'counterId', 'delta'], p, s); name(o.counterId, `${p}.counterId`, s); integer(o.delta, `${p}.delta`, s, false, true); break;
      case 'flagSet':
        keys(o, ['op', 'flagId', 'value'], p, s); name(o.flagId, `${p}.flagId`, s);
        if (typeof o.value !== 'boolean') issue(s, `${p}.value`, 'type', 'Expected a boolean'); break;
      case 'when':
        keys(o, ['op', 'condition', 'then', 'else'], p, s);
        checkCondition(o.condition, `${p}.condition`, 1, s);
        checkStatements(o.then, `${p}.then`, depth + 1, s);
        if (o.else !== undefined) checkStatements(o.else, `${p}.else`, depth + 1, s);
        break;
      default:
        issue(s, `${p}.op`, 'unknown-op', 'Unknown effect operation');
    }
  }
}

const result = (s: State): GameplayMapEffectSyntaxResult => ({
  ok: s.issues.length === 0,
  issues: s.issues,
  counts: { staticNodes: s.staticNodes, prepareLeaves: s.prepareLeaves, locals: s.locals },
});
const state = (): State => ({ issues: [], staticNodes: 0, prepareLeaves: 0, locals: 0, stopped: false });

/** Validate an untrusted Action.effectProgram without resolving Registry references. */
export function validateGameplayMapEffectProgram(value: unknown, path = 'effectProgram'): GameplayMapEffectSyntaxResult {
  const s = state();
  try {
    const o = record(value, path, s); if (!o) return result(s);
    keys(o, ['prepare', 'resolve'], path, s);
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
  } catch {
    issue(s, path, 'type', 'Could not safely read program object');
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
