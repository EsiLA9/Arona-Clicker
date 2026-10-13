import {
  OPERATION_TACTICAL_RNG_ALGORITHM,
  type OperationActorInitialization,
  type OperationEventDef,
  type OperationStudentSkillRollBatch,
  type OperationTacticalRandomState,
} from '../contracts/operation';
import type { OperationStudentSkillRuleDef } from '../contracts/operation-skill';
import type { PreparedBeat } from '../contracts/operation-beat';

const UINT64_MODULUS = 1n << 64n;
export const OPERATION_TACTICAL_RNG_MASK = UINT64_MODULUS - 1n;
export const OPERATION_TACTICAL_RNG_GAMMA = 0x9E3779B97F4A7C15n;
/** ASCII "tactical"; versioning is carried by the fixed stream contract and algorithm ID. */
export const OPERATION_TACTICAL_RNG_STREAM_TAG = 0x746163746963616cn;
/** ASCII "charhand"; independent of the committed tactical skill stream. */
export const OPERATION_CHARACTER_HAND_RNG_STREAM_TAG = 0x6368617268616e64n;
/** ASCII "scenehan"; Scene Hands are counter-addressed independently of Combat beatIndex. */
export const OPERATION_CHARACTER_SCENE_HAND_RNG_STREAM_TAG = 0x7363656e6568616en;

const MIX_MULTIPLIER_1 = 0xBF58476D1CE4E5B9n;
const MIX_MULTIPLIER_2 = 0x94D049BB133111EBn;
const SKILL_ROLL_BOUND = 10000n;

export class OperationTacticalRngError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'OperationTacticalRngError';
  }
}

function fail(message: string): never {
  throw new OperationTacticalRngError([message]);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeTree(child);
  }
  return value;
}

function validateSeedAndCursor(seed: number, tacticalCursor: number): void {
  if (!Number.isSafeInteger(seed)) fail('seed must be a safe integer');
  if (!Number.isSafeInteger(tacticalCursor) || tacticalCursor < 0) {
    fail('tacticalCursor must be a non-negative safe integer');
  }
}

function validateRandomState(state: OperationTacticalRandomState): void {
  if (!state || state.algorithm !== OPERATION_TACTICAL_RNG_ALGORITHM) {
    fail('random algorithm must be ' + OPERATION_TACTICAL_RNG_ALGORITHM);
  }
  validateSeedAndCursor(state.seed, state.tacticalCursor);
}

function mix64(input: bigint): bigint {
  let value = input & OPERATION_TACTICAL_RNG_MASK;
  value = ((value ^ (value >> 30n)) * MIX_MULTIPLIER_1) & OPERATION_TACTICAL_RNG_MASK;
  value = ((value ^ (value >> 27n)) * MIX_MULTIPLIER_2) & OPERATION_TACTICAL_RNG_MASK;
  value = value ^ (value >> 31n);
  return value & OPERATION_TACTICAL_RNG_MASK;
}

function stableActorKey(actorId: string): bigint {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < actorId.length; index++) {
    hash ^= BigInt(actorId.charCodeAt(index));
    hash = (hash * 0x100000001b3n) & OPERATION_TACTICAL_RNG_MASK;
  }
  return hash;
}

function stableSceneHandContextKey(values: readonly (string | number)[]): bigint {
  let hash = 0xcbf29ce484222325n;
  for (const value of values) {
    const encoded = String(value);
    hash ^= BigInt(encoded.length);
    hash = (hash * 0x100000001b3n) & OPERATION_TACTICAL_RNG_MASK;
    for (let index = 0; index < encoded.length; index += 1) {
      hash ^= BigInt(encoded.charCodeAt(index));
      hash = (hash * 0x100000001b3n) & OPERATION_TACTICAL_RNG_MASK;
    }
  }
  return hash;
}

/** Pure, counter-addressed Hand word; it never shares or advances tacticalCursor. */
export function operationCharacterHandWordAt(seed: number, actorId: string, beatIndex: number, wordCursor: number): bigint {
  if (!Number.isSafeInteger(seed)) fail('seed must be a safe integer');
  if (!isNonEmptyId(actorId)) fail('actorId must be a non-empty ID');
  if (!Number.isSafeInteger(beatIndex) || beatIndex < 0) fail('beatIndex must be a non-negative safe integer');
  if (!Number.isSafeInteger(wordCursor) || wordCursor < 0) fail('wordCursor must be a non-negative safe integer');
  const seedWord = BigInt.asUintN(64, BigInt(seed));
  const beatWord = BigInt(beatIndex);
  const keyedSeed = mix64(seedWord ^ OPERATION_CHARACTER_HAND_RNG_STREAM_TAG ^ stableActorKey(actorId) ^ mix64(beatWord));
  const counter = BigInt(wordCursor) + 1n;
  const input = (keyedSeed + OPERATION_TACTICAL_RNG_GAMMA * counter) & OPERATION_TACTICAL_RNG_MASK;
  return mix64(input);
}

/** Pure Scene-round Hand word keyed by the committed Run/Location/Scene visit context. */
export function operationCharacterSceneHandWordAt(
  seed: number,
  actorId: string,
  locationId: string,
  sceneId: string,
  visitCount: number,
  sceneBatchCount: number,
  wordCursor: number,
): bigint {
  if (!Number.isSafeInteger(seed)) fail('seed must be a safe integer');
  if (!isNonEmptyId(actorId) || !isNonEmptyId(locationId) || !isNonEmptyId(sceneId)) {
    fail('Scene Hand Actor/Location/Scene IDs must be non-empty');
  }
  for (const [label, value] of [['visitCount', visitCount], ['sceneBatchCount', sceneBatchCount], ['wordCursor', wordCursor]] as const) {
    if (!Number.isSafeInteger(value) || value < 0) fail(label + ' must be a non-negative safe integer');
  }
  const contextKey = stableSceneHandContextKey([actorId, locationId, sceneId, visitCount, sceneBatchCount]);
  const seedWord = BigInt.asUintN(64, BigInt(seed));
  const keyedSeed = mix64(seedWord ^ OPERATION_CHARACTER_SCENE_HAND_RNG_STREAM_TAG ^ contextKey);
  const counter = BigInt(wordCursor) + 1n;
  const input = (keyedSeed + OPERATION_TACTICAL_RNG_GAMMA * counter) & OPERATION_TACTICAL_RNG_MASK;
  return mix64(input);
}

/** Returns one raw counter-addressed word without advancing or mutating state. */
export function operationTacticalWordAt(seed: number, tacticalCursor: number): bigint {
  validateSeedAndCursor(seed, tacticalCursor);
  const seedWord = BigInt.asUintN(64, BigInt(seed));
  const keyedSeed = mix64(seedWord ^ OPERATION_TACTICAL_RNG_STREAM_TAG);
  const counter = BigInt(tacticalCursor) + 1n;
  const input = (keyedSeed + OPERATION_TACTICAL_RNG_GAMMA * counter) & OPERATION_TACTICAL_RNG_MASK;
  return mix64(input);
}

export interface OperationTacticalSample {
  readonly value: bigint;
  readonly rawWordsConsumed: number;
  readonly nextRandomState: OperationTacticalRandomState;
}

/** Unbiased sample from [0, bound), retaining every rejected word in the provisional cursor. */
export function sampleOperationTacticalBelow(
  randomState: OperationTacticalRandomState,
  bound: bigint,
): OperationTacticalSample {
  validateRandomState(randomState);
  if (typeof bound !== 'bigint' || bound <= 0n || bound > UINT64_MODULUS) {
    fail('bound must be a BigInt in [1, 2^64]');
  }
  const rejectionThreshold = UINT64_MODULUS % bound;
  let tacticalCursor = randomState.tacticalCursor;
  let rawWordsConsumed = 0;
  while (true) {
    if (tacticalCursor >= Number.MAX_SAFE_INTEGER) {
      fail('tacticalCursor cannot advance without overflowing a safe integer');
    }
    const word = operationTacticalWordAt(randomState.seed, tacticalCursor);
    tacticalCursor += 1;
    rawWordsConsumed += 1;
    if (word < rejectionThreshold) continue;
    return freezeTree({
      value: word % bound,
      rawWordsConsumed,
      nextRandomState: {
        algorithm: OPERATION_TACTICAL_RNG_ALGORITHM,
        seed: randomState.seed,
        tacticalCursor,
      },
    });
  }
}

/** Samples one integer from the half-open interval [minimumInclusive, maximumExclusive). */
export function sampleOperationTacticalIntegerRange(
  randomState: OperationTacticalRandomState,
  minimumInclusive: bigint,
  maximumExclusive: bigint,
): OperationTacticalSample {
  if (typeof minimumInclusive !== 'bigint' || typeof maximumExclusive !== 'bigint'
    || maximumExclusive <= minimumInclusive) {
    fail('integer range must be a non-empty half-open interval');
  }
  const width = maximumExclusive - minimumInclusive;
  if (width > UINT64_MODULUS) fail('integer range width cannot exceed 2^64');
  const sample = sampleOperationTacticalBelow(randomState, width);
  return freezeTree({ ...sample, value: minimumInclusive + sample.value });
}

function indexSkillRules(rules: readonly OperationStudentSkillRuleDef[]): Map<string, OperationStudentSkillRuleDef> {
  if (!Array.isArray(rules)) fail('studentSkillRules must be an array');
  const indexed = new Map<string, OperationStudentSkillRuleDef>();
  for (const rule of rules) {
    if (!isNonEmptyId(rule.id)) fail('studentSkillRules contain an invalid rule ID');
    if (indexed.has(rule.id)) fail('studentSkillRules contain duplicate rule ID: ' + rule.id);
    if (!Array.isArray(rule.triggerActionIds)
      || rule.triggerActionIds.some((actionId: unknown) => !isNonEmptyId(actionId))
      || new Set(rule.triggerActionIds).size !== rule.triggerActionIds.length) {
      fail('Student Skill triggerActionIds must contain unique stable Action IDs: ' + rule.id);
    }
    if (!Number.isSafeInteger(rule.chanceBps) || rule.chanceBps < 0 || rule.chanceBps > 10000) {
      fail('Student Skill chanceBps must be an integer in [0,10000]: ' + rule.id);
    }
    indexed.set(rule.id, rule);
  }
  return indexed;
}

function indexInitializations(
  actors: readonly OperationActorInitialization[],
  event: OperationEventDef,
): Map<string, OperationActorInitialization> {
  if (!Array.isArray(actors) || actors.length !== event.actors.length) {
    fail('Actor initializations must contain every Event Actor exactly once');
  }
  const indexed = new Map<string, OperationActorInitialization>();
  for (const initialization of actors) {
    if (!isNonEmptyId(initialization.actorId)) fail('Actor initializations contain an invalid actorId');
    if (indexed.has(initialization.actorId)) fail('Actor initializations contain a duplicate actorId');
    indexed.set(initialization.actorId, initialization);
  }
  for (const eventActor of event.actors) {
    const initialization = indexed.get(eventActor.id);
    if (!initialization) fail('Actor initialization is missing Event Actor: ' + eventActor.id);
    if (initialization.participantKind !== eventActor.type) {
      fail('Actor initialization participant kind does not match Event Actor: ' + eventActor.id);
    }
  }
  return indexed;
}

function validateBeatOrder(event: OperationEventDef, preparedBeat: PreparedBeat): void {
  if (!Number.isSafeInteger(preparedBeat.planVersion) || preparedBeat.planVersion < 0) {
    fail('PreparedBeat planVersion must be a non-negative safe integer');
  }
  if (!event.locations.some(location => location.id === preparedBeat.locationId)) {
    fail('PreparedBeat locationId references an undeclared Event Location');
  }
  if (!Array.isArray(preparedBeat.actorPlans) || preparedBeat.actorPlans.length !== event.actors.length) {
    fail('PreparedBeat must contain exactly one plan for every Event Actor');
  }
  for (let index = 0; index < event.actors.length; index += 1) {
    const eventActor = event.actors[index];
    const plan = preparedBeat.actorPlans[index];
    if (plan?.actorId !== eventActor.id) {
      fail('PreparedBeat Actor plans must follow Event Actor declaration order');
    }
    if (plan.participantKind !== eventActor.type) {
      fail('PreparedBeat participant kind does not match Event Actor: ' + eventActor.id);
    }
    if (plan.kind === 'studentAction' && plan.participantKind !== 'student') {
      fail('only a student Actor can have a studentAction plan: ' + eventActor.id);
    }
    if (plan.kind === 'intent' && plan.participantKind === 'student') {
      fail('a student Actor cannot have an Intent plan: ' + eventActor.id);
    }
  }
}

/** Rolls only triggered student skills, in Event Actor order, without committing the returned cursor. */
export function rollOperationStudentSkills(
  eventDefinition: OperationEventDef,
  actorInitializations: readonly OperationActorInitialization[],
  preparedBeat: PreparedBeat,
  studentSkillRules: readonly OperationStudentSkillRuleDef[],
  randomState: OperationTacticalRandomState,
): OperationStudentSkillRollBatch {
  validateRandomState(randomState);
  validateBeatOrder(eventDefinition, preparedBeat);
  const initializationsByActorId = indexInitializations(actorInitializations, eventDefinition);
  const rulesById = indexSkillRules(studentSkillRules);
  for (const eventActor of eventDefinition.actors) {
    if (eventActor.type !== 'student') continue;
    const initialization = initializationsByActorId.get(eventActor.id);
    if (!initialization || initialization.participantKind !== 'student') {
      fail('student Event Actor lacks a trusted student Profile: ' + eventActor.id);
    }
    const ruleId = initialization.profile.randomSkillRuleId;
    if (ruleId !== undefined && !rulesById.has(ruleId)) {
      fail('student Profile references a missing Student Skill rule: ' + ruleId);
    }
  }

  const checks: OperationStudentSkillRollBatch['checks'][number][] = [];
  let nextRandomState: OperationTacticalRandomState = {
    algorithm: randomState.algorithm,
    seed: randomState.seed,
    tacticalCursor: randomState.tacticalCursor,
  };
  for (let index = 0; index < eventDefinition.actors.length; index += 1) {
    const eventActor = eventDefinition.actors[index];
    if (eventActor.type !== 'student') continue;
    const initialization = initializationsByActorId.get(eventActor.id);
    if (!initialization || initialization.participantKind !== 'student') {
      fail('student Event Actor lacks a trusted student Profile: ' + eventActor.id);
    }
    const ruleId = initialization.profile.randomSkillRuleId;
    if (ruleId === undefined) continue;
    const rule = rulesById.get(ruleId)!;
    const plan = preparedBeat.actorPlans[index];
    if (plan.participantKind !== 'student' || plan.kind !== 'studentAction') continue;
    if (!rule.triggerActionIds.includes(plan.actionId)) continue;

    const sample = sampleOperationTacticalIntegerRange(nextRandomState, 0n, SKILL_ROLL_BOUND);
    const rollBps = Number(sample.value);
    checks.push({
      actorId: eventActor.id,
      skillRuleId: rule.id,
      actionId: plan.actionId,
      chanceBps: rule.chanceBps,
      rollBps,
      succeeded: rollBps < rule.chanceBps,
      rawWordsConsumed: sample.rawWordsConsumed,
    });
    nextRandomState = sample.nextRandomState;
  }

  return freezeTree({ checks, nextRandomState });
}
