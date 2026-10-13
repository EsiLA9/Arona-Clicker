import type {
  OperationActionDef,
  OperationCardConditionDef,
  OperationCardPoolDef,
  OperationStrategyProfileDef,
} from '../../data-services/contracts/operation';
import type {
  OperationCardCandidateDiagnostic,
  OperationCharacterHandSnapshot,
  OperationEventDef,
  OperationStudentProfileSnapshot,
} from '../contracts/operation';
import { operationCharacterHandWordAt, operationCharacterSceneHandWordAt } from './operation-tactical-rng';

const NEUTRAL_BIAS_BPS = 10000;
const LEGACY_ENTRY_WEIGHT = 10000;

export interface OperationCardCandidateResolutionInput {
  readonly eventDefinition: OperationEventDef;
  readonly locationId: string;
  readonly actorId: string;
  readonly profile: OperationStudentProfileSnapshot;
  readonly positionId?: string;
  readonly weaponId?: string;
  readonly knownFactIds: readonly string[];
  readonly actionDefinitions: readonly OperationActionDef[];
  readonly cardPools: readonly OperationCardPoolDef[];
  readonly strategyProfile?: OperationStrategyProfileDef;
  readonly seed: number;
  readonly beatIndex: number;
  /** Scene-local deterministic Hand context; when present, beatIndex is ignored for Hand draws. */
  readonly sceneHandContext?: {
    readonly locationId: string;
    readonly sceneId: string;
    readonly visitCount: number;
    readonly sceneBatchCount: number;
  };
  readonly handSize?: number;
  /** Pure target/cost gate supplied by the Operation planner; any reasons exclude the Action. */
  readonly getActionBlockReasons?: (action: OperationActionDef) => readonly string[];
}

export class OperationCardCandidateResolutionError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'OperationCardCandidateResolutionError';
  }
}

interface AggregatedCandidate {
  readonly action: OperationActionDef;
  baseWeight: number;
  readonly sourcePoolIds: Set<string>;
  legacyFallback: boolean;
}

function fail(message: string): never {
  throw new OperationCardCandidateResolutionError([message]);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function matchesList<T extends string>(allowed: readonly T[] | undefined, actual: T | undefined): boolean {
  if (allowed === undefined) return true;
  return actual !== undefined && allowed.includes(actual);
}

/** Each supplied selector list is OR; different fields are AND. */
function matchesCondition(condition: OperationCardConditionDef | undefined, input: OperationCardCandidateResolutionInput): boolean {
  if (!condition) return true;
  const location = input.eventDefinition.locations.find(item => item.id === input.locationId);
  if (!location) return false;
  const knownFacts = new Set(input.knownFactIds);
  const hasAny = (values: readonly string[] | undefined, predicate: (id: string) => boolean): boolean =>
    values === undefined || values.some(predicate);
  return matchesList(condition.sceneIds, location.interactionSceneId)
    && matchesList(condition.activityIds, location.activityId)
    && matchesList(condition.positionIds, input.positionId)
    && matchesList(condition.weaponIds, input.weaponId)
    && hasAny(condition.requiredFactIds, factId => knownFacts.has(factId))
    && !((condition.forbiddenFactIds ?? []).some(factId => knownFacts.has(factId)));
}

function strategyFactorBps(action: OperationActionDef, strategy: OperationStrategyProfileDef | undefined): number {
  const actionTags = new Set(action.strategyTagIds ?? []);
  if (actionTags.size === 0 || !strategy) return NEUTRAL_BIAS_BPS;
  const biases = new Map(strategy.biases.map(bias => [bias.tagId, bias.biasBps]));
  let adjustment = 0;
  let matches = 0;
  for (const tagId of actionTags) {
    const bias = biases.get(tagId);
    if (bias === undefined) continue;
    adjustment += bias - NEUTRAL_BIAS_BPS;
    matches += 1;
  }
  return matches === 0 ? NEUTRAL_BIAS_BPS : Math.max(0, NEUTRAL_BIAS_BPS + adjustment);
}

function aggregateCandidates(input: OperationCardCandidateResolutionInput): {
  readonly matchedPoolIds: readonly string[];
  readonly rows: Map<string, AggregatedCandidate>;
} {
  const location = input.eventDefinition.locations.find(item => item.id === input.locationId);
  if (!location) fail('unknown Operation Location: ' + input.locationId);
  const poolsById = new Map<string, OperationCardPoolDef>();
  for (const pool of input.cardPools) {
    if (!pool || typeof pool.id !== 'string' || pool.id.length === 0 || !Array.isArray(pool.entries)
      || pool.entries.length < 1 || pool.entries.length > 64) fail('malformed Operation CardPool');
    if (poolsById.has(pool.id)) fail('duplicate Operation CardPool ID: ' + pool.id);
    for (const entry of pool.entries) {
      if (!entry || typeof entry.actionId !== 'string' || entry.actionId.length === 0
        || !Number.isSafeInteger(entry.weight) || entry.weight < 1 || entry.weight > 100000) {
        fail('malformed Operation CardPool entry in ' + pool.id);
      }
    }
    poolsById.set(pool.id, pool);
  }
  if (input.strategyProfile) {
    const strategy = input.strategyProfile;
    if (!Array.isArray(strategy.biases) || strategy.biases.length > 16) fail('malformed Operation StrategyProfile ' + strategy.id);
    const tags = new Set<string>();
    for (const bias of strategy.biases) {
      if (!bias || typeof bias.tagId !== 'string' || bias.tagId.length === 0
        || !Number.isSafeInteger(bias.biasBps) || bias.biasBps < 1 || bias.biasBps > 30000 || tags.has(bias.tagId)) {
        fail('malformed StrategyProfile bias in ' + strategy.id);
      }
      tags.add(bias.tagId);
    }
  }
  const actionsById = new Map<string, OperationActionDef>();
  for (const action of input.actionDefinitions) {
    if (actionsById.has(action.id)) fail('duplicate Operation Action ID: ' + action.id);
    actionsById.set(action.id, action);
  }
  const poolIds = unique([
    ...(input.eventDefinition.cardPoolIds ?? []),
    ...(location.cardPoolIds ?? []),
    ...(input.profile.cardPoolIds ?? []),
  ]);
  const matchedPoolIds: string[] = [];
  const rows = new Map<string, AggregatedCandidate>();
  let matchedEntryCount = 0;
  for (const poolId of poolIds) {
    const pool = poolsById.get(poolId);
    if (!pool) fail('Operation references missing CardPool: ' + poolId);
    if (!matchesCondition(pool.selector, input)) continue;
    matchedPoolIds.push(poolId);
    for (const entry of pool.entries) {
      matchedEntryCount += 1;
      const action = actionsById.get(entry.actionId);
      if (!action) fail('Operation CardPool ' + poolId + ' references missing Action: ' + entry.actionId);
      const candidate = rows.get(action.id) ?? {
        action,
        baseWeight: 0,
        sourcePoolIds: new Set<string>(),
        legacyFallback: false,
      };
      candidate.baseWeight += entry.weight;
      if (!Number.isSafeInteger(candidate.baseWeight)) fail('aggregated Operation CardPool weight exceeds safe integer range for Action ' + action.id);
      candidate.sourcePoolIds.add(poolId);
      rows.set(action.id, candidate);
    }
  }
  if (matchedEntryCount === 0) {
    for (const actionId of unique(input.profile.candidateActionIds)) {
      const action = actionsById.get(actionId);
      if (!action) fail('legacy StudentOperationProfile references missing Action: ' + actionId);
      rows.set(actionId, {
        action,
        baseWeight: LEGACY_ENTRY_WEIGHT,
        sourcePoolIds: new Set<string>(),
        legacyFallback: true,
      });
    }
  }
  return { matchedPoolIds, rows };
}

function diagnosticsFor(input: OperationCardCandidateResolutionInput, rows: ReadonlyMap<string, AggregatedCandidate>): OperationCardCandidateDiagnostic[] {
  const capabilities = new Set(input.profile.capabilityIds);
  const enabledActions = new Set(input.eventDefinition.locations.find(location => location.id === input.locationId)?.enabledActionIds ?? []);
  const results = [...rows.values()].map(candidate => {
    const reasonIds: string[] = [];
    if (!candidate.action.allowedParticipantKinds.includes('student')) reasonIds.push('operation:hand:action-disallows-student');
    for (const capabilityId of candidate.action.requiredCapabilityIds) {
      if (!capabilities.has(capabilityId)) reasonIds.push('operation:hand:missing-capability:' + capabilityId);
    }
    if (!enabledActions.has(candidate.action.id)) reasonIds.push('operation:hand:action-disabled-at-location');
    if (!matchesCondition(candidate.action.cardCondition, input)) reasonIds.push('operation:hand:action-condition-not-met');
    for (const reason of input.getActionBlockReasons?.(candidate.action) ?? []) reasonIds.push(reason);
    const eligible = reasonIds.length === 0;
    const factor = eligible ? strategyFactorBps(candidate.action, input.strategyProfile) : null;
    const finalWeight = eligible && factor !== null ? candidate.baseWeight * factor : 0;
    if (!Number.isSafeInteger(finalWeight)) fail('final Operation Card weight exceeds safe integer range for Action ' + candidate.action.id);
    return {
      actionId: candidate.action.id,
      sourcePoolIds: [...candidate.sourcePoolIds].sort(),
      legacyFallback: candidate.legacyFallback,
      eligible,
      reasonIds: unique(reasonIds),
      baseWeight: candidate.baseWeight,
      strategyFactorBps: factor,
      finalWeight,
    };
  });
  return results.sort((a, b) => a.actionId < b.actionId ? -1 : a.actionId > b.actionId ? 1 : 0);
}

function sampleBelow(input: OperationCardCandidateResolutionInput, cursor: { value: number }, bound: bigint): bigint {
  const threshold = (1n << 64n) % bound;
  while (true) {
    if (cursor.value >= Number.MAX_SAFE_INTEGER) fail('Character Hand sample cursor overflow');
    const word = input.sceneHandContext
      ? operationCharacterSceneHandWordAt(input.seed, input.actorId, input.sceneHandContext.locationId,
        input.sceneHandContext.sceneId, input.sceneHandContext.visitCount, input.sceneHandContext.sceneBatchCount, cursor.value++)
      : operationCharacterHandWordAt(input.seed, input.actorId, input.beatIndex, cursor.value++);
    if (word >= threshold) return word % bound;
  }
}

function drawHand(input: OperationCardCandidateResolutionInput, candidates: OperationCardCandidateDiagnostic[]): string[] {
  const handSize = input.handSize ?? input.eventDefinition.characterHandSize ?? 3;
  if (!Number.isSafeInteger(handSize) || handSize < 1 || handSize > 10) fail('characterHandSize must be between 1 and 10');
  const remaining = candidates.filter(candidate => candidate.eligible && candidate.finalWeight > 0).map(candidate => ({
    actionId: candidate.actionId,
    weight: BigInt(candidate.finalWeight),
  }));
  const hand: string[] = [];
  const cursor = { value: 0 };
  while (hand.length < handSize && remaining.length > 0) {
    const total = remaining.reduce((sum, candidate) => sum + candidate.weight, 0n);
    const draw = sampleBelow(input, cursor, total);
    let cumulative = 0n;
    const selectedIndex = remaining.findIndex(candidate => {
      cumulative += candidate.weight;
      return draw < cumulative;
    });
    if (selectedIndex < 0) fail('weighted Hand draw did not resolve an Action');
    hand.push(remaining[selectedIndex].actionId);
    remaining.splice(selectedIndex, 1);
  }
  return hand;
}

/** Pure Operation-specific pool match, eligibility, Strategy adjustment, and no-replacement Hand draw. */
export function resolveOperationCharacterHand(input: OperationCardCandidateResolutionInput): OperationCharacterHandSnapshot {
  if (!input || !input.eventDefinition || !input.profile) fail('Character Hand input is incomplete');
  if (!Number.isSafeInteger(input.seed) || !Number.isSafeInteger(input.beatIndex) || input.beatIndex < 0) fail('Character Hand seed/beatIndex is invalid');
  if (!input.profile.strategyProfileId && input.strategyProfile) fail('StrategyProfile was supplied for a Profile that does not reference one');
  if (input.profile.strategyProfileId && input.strategyProfile?.id !== input.profile.strategyProfileId) {
    fail('resolved StrategyProfile does not match StudentOperationProfile ' + input.profile.id);
  }
  const aggregated = aggregateCandidates(input);
  const candidates = diagnosticsFor(input, aggregated.rows);
  return Object.freeze({
    actorId: input.actorId,
    actionIds: Object.freeze(drawHand(input, candidates)),
    matchedPoolIds: Object.freeze([...aggregated.matchedPoolIds]),
    candidates: Object.freeze(candidates.map(candidate => Object.freeze(candidate))),
  });
}
