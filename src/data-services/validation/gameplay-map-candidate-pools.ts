import { matchesTag, parseTagRef } from '../../engine/core/tag';
import type { TagPath } from '../../engine/core/tag';
import type {
  GameplayEncounterActionCandidateDef,
  GameplayMapCandidatePoolDef,
  GameplayMapCandidatePoolEntryDef,
  GameplayMapDef,
} from '../contracts/gameplay-map';

type CandidateMap = Pick<GameplayMapDef, 'actions' | 'candidatePools' | 'executionContractId' | 'mapRunFacts'>;
type CandidatePoolResolutionMode =
  | { readonly mode: 'allPotentialSources' }
  | { readonly mode: 'runtime'; readonly mapRunFacts?: MapRunFactSnapshot };

/** Structural copy of the normalized MapRun fact values consumed by runtime candidate resolution. */
export interface GameplayMapCandidatePoolFactSnapshot {
  readonly counters: readonly { readonly id: string; readonly value: number }[];
  readonly flags: readonly { readonly id: string; readonly value: boolean }[];
}

type MapRunFactSnapshot = GameplayMapCandidatePoolFactSnapshot;
const MAX_WEIGHT = BigInt(Number.MAX_SAFE_INTEGER);
const COUNTER_COMPARISONS = new Set(['eq', 'lt', 'lte', 'gt', 'gte']);

function fail(message: string): never {
  throw new Error('Gameplay Map candidate pools: ' + message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactFields(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((field, index) => field !== wanted[index])) {
    fail(`${label} must contain exactly ${wanted.join(', ')}`);
  }
}

function weightValue(value: unknown, label: string): bigint {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    fail(`${label} must be a positive safe integer`);
  }
  return BigInt(value as number);
}

function toTagPath(tagRef: string): TagPath {
  const parsed = parseTagRef(tagRef);
  if (!parsed) fail(`invalid TagRef "${tagRef}"`);
  return [`${parsed.modName}:${parsed.path[0]}`, ...parsed.path.slice(1)];
}

function indexContent(map: CandidateMap): {
  readonly actions: ReadonlyMap<string, NonNullable<GameplayMapDef['actions']>[number]>;
  readonly pools: ReadonlyMap<string, GameplayMapCandidatePoolDef>;
} {
  const actions = new Map<string, NonNullable<GameplayMapDef['actions']>[number]>();
  for (const action of map.actions ?? []) {
    if (actions.has(action.id)) fail(`duplicate Map Action "${action.id}"`);
    for (const tag of action.tags ?? []) toTagPath(tag);
    actions.set(action.id, action);
  }

  const pools = new Map<string, GameplayMapCandidatePoolDef>();
  for (const pool of map.candidatePools ?? []) {
    if (pools.has(pool.id)) fail(`duplicate candidate Pool "${pool.id}"`);
    if (!Array.isArray(pool.entries)) fail(`Pool "${pool.id}" entries must be an array`);
    pools.set(pool.id, pool);
  }

  return { actions, pools };
}

function factDeclarations(map: CandidateMap): {
  readonly counters: ReadonlyMap<string, NonNullable<GameplayMapDef['mapRunFacts']>['counters'] extends readonly (infer T)[] | undefined ? T : never>;
  readonly flags: ReadonlyMap<string, NonNullable<GameplayMapDef['mapRunFacts']>['flags'] extends readonly (infer T)[] | undefined ? T : never>;
} {
  return {
    counters: new Map((map.mapRunFacts?.counters ?? []).map(row => [row.id, row])),
    flags: new Map((map.mapRunFacts?.flags ?? []).map(row => [row.id, row])),
  };
}

function validatePoolGate(map: CandidateMap, pool: GameplayMapCandidatePoolDef): void {
  const gate: unknown = pool.gate;
  if (gate === undefined) return;
  const path = `Pool "${pool.id}" gate`;
  if (map.executionContractId !== 'AG-1') {
    fail(`${path} requires executionContractId AG-1`);
  }
  if (!isRecord(gate)) fail(`${path} must be a counter or flag object`);
  const declarations = factDeclarations(map);
  if (gate.kind === 'counter') {
    exactFields(gate, ['kind', 'counterId', 'comparison', 'value'], path);
    if (typeof gate.counterId !== 'string' || gate.counterId.length === 0) fail(`${path}.counterId must be a non-empty ID`);
    if (!COUNTER_COMPARISONS.has(String(gate.comparison))) fail(`${path}.comparison must be eq, lt, lte, gt, or gte`);
    if (!Number.isSafeInteger(gate.value)) fail(`${path}.value must be a safe integer`);
    if (!declarations.counters.has(gate.counterId)) fail(`${path}.counterId references undeclared MapRun Counter "${gate.counterId}"`);
    return;
  }
  if (gate.kind === 'flag') {
    exactFields(gate, ['kind', 'flagId', 'value'], path);
    if (typeof gate.flagId !== 'string' || gate.flagId.length === 0) fail(`${path}.flagId must be a non-empty ID`);
    if (typeof gate.value !== 'boolean') fail(`${path}.value must be a boolean`);
    if (!declarations.flags.has(gate.flagId)) fail(`${path}.flagId references undeclared MapRun Flag "${gate.flagId}"`);
    return;
  }
  fail(`${path}.kind must be counter or flag`);
}

function validateRuntimeFactSnapshot(map: CandidateMap, snapshot: unknown): MapRunFactSnapshot {
  if (!isRecord(snapshot)) fail('runtime MapRun Facts snapshot is required for gated candidate Pools');
  exactFields(snapshot, ['counters', 'flags'], 'runtime MapRun Facts snapshot');
  const counterDefinitions = map.mapRunFacts?.counters ?? [];
  const flagDefinitions = map.mapRunFacts?.flags ?? [];
  if (!Array.isArray(snapshot.counters) || !Array.isArray(snapshot.flags)) {
    fail('runtime MapRun Facts snapshot counters and flags must be arrays');
  }
  if (snapshot.counters.length !== counterDefinitions.length || snapshot.flags.length !== flagDefinitions.length) {
    fail('runtime MapRun Facts snapshot must contain every declared Counter and Flag');
  }

  const counters: { id: string; value: number }[] = [];
  for (const [index, definition] of counterDefinitions.entries()) {
    const row: unknown = snapshot.counters[index];
    if (!isRecord(row)) fail(`runtime MapRun Facts counters[${index}] must be an object`);
    exactFields(row, ['id', 'value'], `runtime MapRun Facts counters[${index}]`);
    if (row.id !== definition.id || !Number.isSafeInteger(row.value)
      || (row.value as number) < definition.min || (row.value as number) > definition.max) {
      fail(`runtime MapRun Facts counters[${index}] does not match its declared ID and bounds`);
    }
    counters.push({ id: definition.id, value: row.value as number });
  }

  const flags: { id: string; value: boolean }[] = [];
  for (const [index, definition] of flagDefinitions.entries()) {
    const row: unknown = snapshot.flags[index];
    if (!isRecord(row)) fail(`runtime MapRun Facts flags[${index}] must be an object`);
    exactFields(row, ['id', 'value'], `runtime MapRun Facts flags[${index}]`);
    if (row.id !== definition.id || typeof row.value !== 'boolean') {
      fail(`runtime MapRun Facts flags[${index}] does not match its declared ID and type`);
    }
    flags.push({ id: definition.id, value: row.value });
  }
  return { counters, flags };
}

function gateAllows(pool: GameplayMapCandidatePoolDef, snapshot: MapRunFactSnapshot | undefined): boolean {
  const gate = pool.gate;
  if (gate === undefined) return true;
  if (!snapshot) fail(`runtime MapRun Facts snapshot is required to evaluate Pool "${pool.id}" gate`);
  if (gate.kind === 'counter') {
    const row = snapshot.counters.find(candidate => candidate.id === gate.counterId);
    if (!row) fail(`runtime Counter "${gate.counterId}" is missing for Pool "${pool.id}" gate`);
    switch (gate.comparison) {
      case 'eq': return row.value === gate.value;
      case 'lt': return row.value < gate.value;
      case 'lte': return row.value <= gate.value;
      case 'gt': return row.value > gate.value;
      case 'gte': return row.value >= gate.value;
      default: return fail(`Pool "${pool.id}" has an invalid Counter comparison`);
    }
  }
  const row = snapshot.flags.find(candidate => candidate.id === gate.flagId);
  if (!row) fail(`runtime Flag "${gate.flagId}" is missing for Pool "${pool.id}" gate`);
  return row.value === gate.value;
}

function validatePoolGraph(
  pools: ReadonlyMap<string, GameplayMapCandidatePoolDef>,
  actions: ReadonlyMap<string, NonNullable<GameplayMapDef['actions']>[number]>,
): void {
  const state = new Map<string, 'visiting' | 'done'>();

  const visit = (poolId: string): void => {
    const pool = pools.get(poolId);
    if (!pool) fail(`unknown Pool reference "${poolId}"`);
    const currentState = state.get(poolId);
    if (currentState === 'visiting') fail(`candidate Pool reference cycle at "${poolId}"`);
    if (currentState === 'done') return;
    state.set(poolId, 'visiting');

    for (const [index, entry] of pool.entries.entries()) {
      if (!entry || typeof entry !== 'object') fail(`Pool "${poolId}" entries[${index}] must be an object`);
      weightValue(entry.weight, `Pool "${poolId}" entries[${index}].weight`);
      if (entry.kind === 'action') {
        if (!actions.has(entry.actionId)) {
          fail(`Pool "${poolId}" references unknown Action "${entry.actionId}"`);
        }
      } else if (entry.kind === 'tag') {
        toTagPath(entry.tag);
      } else if (entry.kind === 'pool') {
        visit(entry.poolId);
      } else {
        fail(`Pool "${poolId}" entries[${index}] has an unknown kind`);
      }
    }

    state.set(poolId, 'done');
  };

  for (const poolId of pools.keys()) visit(poolId);
}

function expandSources(
  map: CandidateMap,
  directCandidates: readonly GameplayEncounterActionCandidateDef[] | undefined,
  poolIds: readonly string[] | undefined,
  content: ReturnType<typeof indexContent>,
  mode: 'allPotentialSources' | 'runtime',
  facts?: MapRunFactSnapshot,
): GameplayEncounterActionCandidateDef[] {
  const merged = new Map<string, number>();
  const result: GameplayEncounterActionCandidateDef[] = [];

  const add = (actionId: string, weight: bigint): void => {
    if (!content.actions.has(actionId)) fail(`candidate source references unknown Action "${actionId}"`);
    if (weight <= 0n || weight > MAX_WEIGHT) fail(`Action "${actionId}" candidate weight exceeds the safe integer range`);
    const previous = BigInt(merged.get(actionId) ?? 0);
    const total = previous + weight;
    if (total > MAX_WEIGHT) fail(`Action "${actionId}" accumulated candidate weight exceeds Number.MAX_SAFE_INTEGER`);
    if (previous === 0n) result.push({ actionId, tendencyWeight: Number(weight) });
    else {
      const index = result.findIndex(candidate => candidate.actionId === actionId);
      if (index < 0) fail(`Action "${actionId}" lost its merged candidate position`);
      result[index] = { actionId, tendencyWeight: Number(total) };
    }
    merged.set(actionId, Number(total));
  };

  for (const [index, candidate] of (directCandidates ?? []).entries()) {
    if (!candidate || typeof candidate !== 'object' || typeof candidate.actionId !== 'string') {
      fail(`direct candidates[${index}] is malformed`);
    }
    if (merged.has(candidate.actionId)) fail(`duplicate direct candidate Action "${candidate.actionId}"`);
    add(candidate.actionId, weightValue(candidate.tendencyWeight, `direct candidates[${index}].tendencyWeight`));
  }

  const seenPoolIds = new Set<string>();
  const expandPool = (poolId: string, multiplier: bigint, stack: Set<string>): void => {
    const pool = content.pools.get(poolId);
    if (!pool) fail(`unknown Pool reference "${poolId}"`);
    if (stack.has(poolId)) fail(`candidate Pool reference cycle at "${poolId}"`);
    if (mode === 'runtime' && !gateAllows(pool, facts)) return;
    const nextStack = new Set(stack);
    nextStack.add(poolId);

    for (const entry of pool.entries) {
      const expandedWeight = multiplier * weightValue(entry.weight, `Pool "${poolId}" entry weight`);
      if (expandedWeight > MAX_WEIGHT) fail(`Pool "${poolId}" multiplied candidate weight exceeds Number.MAX_SAFE_INTEGER`);
      if (entry.kind === 'action') {
        add(entry.actionId, expandedWeight);
      } else if (entry.kind === 'tag') {
        const query = toTagPath(entry.tag);
        for (const action of map.actions ?? []) {
          if ((action.tags ?? []).some(tag => matchesTag(toTagPath(tag), query))) add(action.id, expandedWeight);
        }
      } else if (entry.kind === 'pool') {
        expandPool(entry.poolId, expandedWeight, nextStack);
      } else {
        fail(`Pool "${poolId}" contains an unknown entry kind`);
      }
    }
  };

  for (const [index, poolId] of (poolIds ?? []).entries()) {
    if (typeof poolId !== 'string' || poolId.length === 0) fail(`candidatePoolIds[${index}] must be a non-empty ID`);
    if (seenPoolIds.has(poolId)) fail(`duplicate candidate Pool reference "${poolId}"`);
    seenPoolIds.add(poolId);
    expandPool(poolId, 1n, new Set());
  }

  return result;
}

/**
 * Resolve direct candidates followed by ordered Map-local pools. Static author
 * callers must request allPotentialSources; runtime callers must supply their
 * frozen MapRun Fact values. The omitted mode is retained only for ungated maps
 * until all runtime consumers move to the explicit runtime mode in U15-B.
 */
export function resolveGameplayMapCandidateSources(
  map: CandidateMap,
  directCandidates: readonly GameplayEncounterActionCandidateDef[] | undefined,
  poolIds: readonly string[] | undefined,
  options?: CandidatePoolResolutionMode,
): GameplayEncounterActionCandidateDef[] {
  const content = indexContent(map);
  validatePoolGraph(content.pools, content.actions);
  for (const pool of content.pools.values()) validatePoolGate(map, pool);

  if (options?.mode === 'allPotentialSources') {
    return expandSources(map, directCandidates, poolIds, content, 'allPotentialSources');
  }
  const hasFactGate = [...content.pools.values()].some(pool => pool.gate !== undefined);
  if (!options && hasFactGate) {
    fail('gated candidate Pools require an explicit runtime Fact snapshot or allPotentialSources mode');
  }
  if (options && options.mode !== 'runtime') fail('candidate source resolution mode is invalid');
  const facts = hasFactGate ? validateRuntimeFactSnapshot(map, options?.mapRunFacts) : undefined;
  return expandSources(map, directCandidates, poolIds, content, 'runtime', facts);
}

/** Validate the static Pool graph, gates, and every possible Map/source expansion. */
export function validateGameplayMapCandidatePools(map: GameplayMapDef): void {
  const content = indexContent(map);
  validatePoolGraph(content.pools, content.actions);
  for (const pool of content.pools.values()) validatePoolGate(map, pool);

  for (const poolId of content.pools.keys()) {
    expandSources(map, [], [poolId], content, 'allPotentialSources');
  }

  const validateEncounterSources = (encounter: NonNullable<GameplayMapDef['nodes'][number]['encounter']>): void => {
    for (const participant of encounter.participants ?? []) {
      expandSources(map, participant.actions, participant.candidatePoolIds, content, 'allPotentialSources');
    }
    for (const enemy of encounter.enemies ?? []) {
      expandSources(map, enemy.actions, enemy.candidatePoolIds, content, 'allPotentialSources');
    }
  };

  for (const node of map.nodes) {
    if (node.encounter) validateEncounterSources(node.encounter);
    for (const activity of node.activities ?? []) {
      if (activity.encounter) validateEncounterSources(activity.encounter);
    }
  }
}
