import type {
  GameplayEncounterParticipantDef,
  GameplayMapActionDef,
} from '../../data-services/contracts/gameplay-map';
import {
  GAMEPLAY_B_HAND_RNG_ALGORITHM,
  type MapRunActorResourceBalance,
  type MapRunEncounterHand,
  type MapRunHandRandomState,
  type MapRunTeamResourceBalance,
} from '../contracts/map-run';

const HAND_LIMIT = 3;
const UINT64_MASK = (1n << 64n) - 1n;
const SPLITMIX64_GAMMA = 0x9E3779B97F4A7C15n;
const MIX_MULTIPLIER_1 = 0xBF58476D1CE4E5B9n;
const MIX_MULTIPLIER_2 = 0x94D049BB133111EBn;

export interface GameplayBHandDrawInput {
  readonly partyCharacterIds: readonly string[];
  /** Downed party members remain in Hand order with an empty Hand. */
  readonly livingPartyCharacterIds?: readonly string[];
  /** Living Enemy IDs from the active Encounter; unit target eligibility needs the current roster. */
  readonly livingEnemyIds: readonly string[];
  readonly participants?: readonly GameplayEncounterParticipantDef[];
  readonly actions?: readonly GameplayMapActionDef[];
  /** Current MapRun health with Map definition caps, derived rather than persisted separately. */
  readonly partyHealth?: readonly {
    readonly characterId: string;
    readonly currentHp: number;
    readonly maxHp: number;
  }[];
  readonly actorResources: readonly MapRunActorResourceBalance[];
  readonly teamResources: readonly MapRunTeamResourceBalance[];
  readonly randomState: MapRunHandRandomState;
}

export interface GameplayBHandDrawResult {
  readonly hands: readonly MapRunEncounterHand[];
  readonly randomState: MapRunHandRandomState;
}

export class GameplayBHandResolutionError extends Error {
  constructor(readonly diagnostics: readonly string[]) {
    super(diagnostics.join('; '));
    this.name = 'GameplayBHandResolutionError';
  }
}

interface WeightedAction {
  readonly actionId: string;
  readonly weight: bigint;
  readonly teamCosts: readonly { readonly resourceId: string; readonly amount: bigint }[];
}

interface PartyHealthRow {
  readonly characterId: string;
  readonly currentHp: number;
  readonly maxHp: number;
}

function fail(message: string): never {
  throw new GameplayBHandResolutionError([message]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function freezeTree<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

function validateRandomState(value: unknown): asserts value is MapRunHandRandomState {
  if (!isRecord(value)
    || value.algorithm !== GAMEPLAY_B_HAND_RNG_ALGORITHM
    || !Number.isSafeInteger(value.seed)
    || !Number.isSafeInteger(value.cursor)
    || (value.cursor as number) < 0) {
    fail('invalid Gameplay B Hand random state');
  }
}

function mix64(input: bigint): bigint {
  let value = input & UINT64_MASK;
  value = ((value ^ (value >> 30n)) * MIX_MULTIPLIER_1) & UINT64_MASK;
  value = ((value ^ (value >> 27n)) * MIX_MULTIPLIER_2) & UINT64_MASK;
  value ^= value >> 31n;
  return value & UINT64_MASK;
}

/** Purely addresses a SplitMix64 word by the saved seed and raw-word cursor. */
function wordAt(seed: number, cursor: number): bigint {
  const seedWord = BigInt.asUintN(64, BigInt(seed));
  return mix64(seedWord + SPLITMIX64_GAMMA * BigInt(cursor + 1));
}

function sampleBelow(total: bigint, seed: number, startCursor: number): { value: bigint; cursor: number } {
  const bitCount = total.toString(2).length;
  const wordCount = Math.max(1, Math.ceil(bitCount / 64));
  const sourceRange = 1n << BigInt(wordCount * 64);
  const rejectionThreshold = sourceRange % total;
  let cursor = startCursor;

  while (true) {
    let sample = 0n;
    for (let index = 0; index < wordCount; index += 1) {
      if (cursor >= Number.MAX_SAFE_INTEGER) fail('Gameplay B Hand random cursor overflow');
      sample = (sample << 64n) | wordAt(seed, cursor);
      cursor += 1;
    }
    if (sample >= rejectionThreshold) return { value: sample % total, cursor };
  }
}

function resolveCandidates(
  characterId: string,
  candidates: GameplayEncounterParticipantDef['actions'],
  actionsById: ReadonlyMap<string, GameplayMapActionDef>,
  actorBalances: ReadonlyMap<string, number>,
  teamBalances: ReadonlyMap<string, number>,
  livingPartyIds: ReadonlySet<string>,
  livingEnemyIds: readonly string[],
  partyHealth: ReadonlyMap<string, PartyHealthRow>,
): WeightedAction[] {
  if (!Array.isArray(candidates)) fail('Encounter participant actions must be an array: ' + characterId);
  const seenActionIds = new Set<string>();
  const result: WeightedAction[] = [];
  for (const candidate of candidates) {
    if (!isRecord(candidate)
      || !isNonEmptyId(candidate.actionId)
      || !Number.isSafeInteger(candidate.tendencyWeight)
      || (candidate.tendencyWeight as number) <= 0) {
      fail('Encounter participant has a malformed Hand candidate: ' + characterId);
    }
    const actionId = candidate.actionId;
    if (seenActionIds.has(actionId)) fail('Encounter participant has a duplicate Hand candidate: ' + actionId);
    seenActionIds.add(actionId);

    const action = actionsById.get(actionId);
    if (!action) fail('Encounter Hand candidate references an unknown Map Action: ' + actionId);
    if (!Array.isArray(action.eligibleCharacterIds) || !action.eligibleCharacterIds.some(id => id === characterId)) {
      fail('Encounter Hand candidate is ineligible for Character "' + characterId + '": ' + actionId);
    }
    const costs: unknown = action.costs;
    if (costs !== undefined && !Array.isArray(costs)) fail('Map Action costs must be an array: ' + actionId);
    const requiredBalances = new Map<string, { balance: number; required: bigint }>();
    const teamCosts = new Map<string, bigint>();
    for (const cost of (costs ?? []) as unknown[]) {
      if (!isRecord(cost) || (cost.scope !== 'actor' && cost.scope !== 'team')
        || !isNonEmptyId(cost.resourceId)
        || !Number.isSafeInteger(cost.amount) || (cost.amount as number) <= 0) {
        fail('Map Action has a malformed resource cost: ' + actionId);
      }
      const scopeKey = JSON.stringify([cost.scope, cost.resourceId]);
      const balance = cost.scope === 'actor'
        ? actorBalances.get(JSON.stringify([characterId, cost.resourceId])) ?? 0
        : teamBalances.get(cost.resourceId) ?? 0;
      const previous = requiredBalances.get(scopeKey);
      requiredBalances.set(scopeKey, {
        balance,
        required: (previous?.required ?? 0n) + BigInt(cost.amount as number),
      });
      if (cost.scope === 'team') {
        teamCosts.set(cost.resourceId, (teamCosts.get(cost.resourceId) ?? 0n) + BigInt(cost.amount as number));
      }
    }
    if ([...requiredBalances.values()].some(({ balance, required }) => required > BigInt(balance))) continue;
    if ((action.target.kind === 'enemy' && livingEnemyIds.length === 0)
      || (action.target.kind === 'partyCharacter' && livingPartyIds.size === 0)) continue;
    const role = action.tendencyRole;
    if (role !== undefined && !['recovery', 'defense', 'attack'].includes(role)) {
      fail('Map Action has an invalid tendencyRole: ' + actionId);
    }
    if ((role === 'recovery' && action.target.kind !== 'self' && action.target.kind !== 'partyCharacter')
      || (role === 'attack' && action.target.kind !== 'enemy')) {
      fail('Map Action tendencyRole does not match its target: ' + actionId);
    }
    let multiplier = 1n;
    if (role === 'recovery') {
      const eligibleTargets = action.target.kind === 'self' ? [characterId] : [...livingPartyIds];
      const needsRecovery = eligibleTargets.some(targetId => {
        const health = partyHealth.get(targetId);
        if (!health) fail('recovery tendency requires current HP and maximum HP for ' + targetId);
        return BigInt(health.maxHp - health.currentHp) * 4n >= BigInt(health.maxHp);
      });
      if (needsRecovery) multiplier = 2n;
    } else if (role === 'defense') {
      const health = partyHealth.get(characterId);
      if (!health) fail('defense tendency requires current HP and maximum HP for ' + characterId);
      if (BigInt(health.currentHp) * 2n <= BigInt(health.maxHp)) multiplier = 2n;
    } else if (role === 'attack' && livingEnemyIds.length > 0) {
      multiplier = 2n;
    }
    result.push({
      actionId,
      weight: BigInt(candidate.tendencyWeight as number) * multiplier,
      teamCosts: [...teamCosts].map(([resourceId, amount]) => ({ resourceId, amount })),
    });
  }
  return result;
}

function takeWeightedAction(
  candidates: WeightedAction[],
  seed: number,
  cursor: number,
): { readonly action: WeightedAction; readonly cursor: number } {
  if (candidates.length === 0) fail('cannot draw a Gameplay B Action from an empty candidate pool');
  const totalWeight = candidates.reduce((total, candidate) => total + candidate.weight, 0n);
  const sample = sampleBelow(totalWeight, seed, cursor);
  let cumulativeWeight = 0n;
  const selectedIndex = candidates.findIndex(candidate => {
    cumulativeWeight += candidate.weight;
    return sample.value < cumulativeWeight;
  });
  if (selectedIndex < 0) fail('weighted Hand draw did not resolve a Map Action');
  const [action] = candidates.splice(selectedIndex, 1);
  if (!action) fail('weighted Hand draw selected a missing Map Action');
  return { action, cursor: sample.cursor };
}

function indexMapRunResources(
  partyCharacterIds: readonly string[],
  actorResources: unknown,
  teamResources: unknown,
): { actor: Map<string, number>; team: Map<string, number> } {
  if (!Array.isArray(actorResources) || !Array.isArray(teamResources)) {
    fail('MapRun Hand draw requires Actor and Team resource snapshots');
  }
  const partyIds = new Set(partyCharacterIds);
  const actor = new Map<string, number>();
  for (const row of actorResources) {
    if (!isRecord(row) || !isNonEmptyId(row.characterId) || !partyIds.has(row.characterId)
      || !isNonEmptyId(row.resourceId) || !Number.isSafeInteger(row.value) || (row.value as number) < 0) {
      fail('MapRun Hand draw has a malformed Actor resource balance');
    }
    const key = JSON.stringify([row.characterId, row.resourceId]);
    if (actor.has(key)) fail('MapRun Hand draw has a duplicate Actor resource balance');
    actor.set(key, row.value as number);
  }
  const team = new Map<string, number>();
  for (const row of teamResources) {
    if (!isRecord(row) || !isNonEmptyId(row.resourceId)
      || !Number.isSafeInteger(row.value) || (row.value as number) < 0) {
      fail('MapRun Hand draw has a malformed Team resource balance');
    }
    if (team.has(row.resourceId)) fail('MapRun Hand draw has a duplicate Team resource balance');
    team.set(row.resourceId, row.value as number);
  }
  return { actor, team };
}

/**
 * Pure weighted, without-replacement Gameplay B Hand draw. Empty candidate sets
 * stay empty, and the returned random state is the only state a caller may save.
 */
export function drawGameplayBHands(input: GameplayBHandDrawInput): GameplayBHandDrawResult {
  if (!input || !Array.isArray(input.partyCharacterIds) || input.partyCharacterIds.length === 0
    || input.partyCharacterIds.some(id => !isNonEmptyId(id))
    || new Set(input.partyCharacterIds).size !== input.partyCharacterIds.length) {
    fail('MapRun Hand draw requires a non-empty unique fixed party');
  }
  validateRandomState(input.randomState);
  if (!Array.isArray(input.livingEnemyIds)
    || input.livingEnemyIds.some(id => !isNonEmptyId(id))
    || new Set(input.livingEnemyIds).size !== input.livingEnemyIds.length) {
    fail('MapRun Hand draw has an invalid living Enemy roster');
  }
  const balances = indexMapRunResources(input.partyCharacterIds, input.actorResources, input.teamResources);

  const actions = input.actions ?? [];
  if (!Array.isArray(actions)) fail('Map Actions must be an array');
  const actionsById = new Map<string, GameplayMapActionDef>();
  for (const action of actions) {
    if (!isRecord(action) || !isNonEmptyId(action.id)) fail('Map contains an Action with an invalid ID');
    if (actionsById.has(action.id)) fail('Map contains a duplicate Action ID: ' + action.id);
    actionsById.set(action.id, action as unknown as GameplayMapActionDef);
  }

  const participants = input.participants ?? [];
  if (!Array.isArray(participants)) fail('Encounter participants must be an array');
  const participantsByCharacter = new Map<string, GameplayEncounterParticipantDef>();
  const partyIds = new Set(input.partyCharacterIds);
  const livingPartyIds = input.livingPartyCharacterIds === undefined
    ? partyIds
    : new Set(input.livingPartyCharacterIds);
  if (input.livingPartyCharacterIds !== undefined
    && (!Array.isArray(input.livingPartyCharacterIds)
      || input.livingPartyCharacterIds.some(id => !isNonEmptyId(id))
      || livingPartyIds.size !== input.livingPartyCharacterIds.length)
    || [...livingPartyIds].some(id => !partyIds.has(id))) {
    fail('MapRun Hand draw has a living party member outside the fixed party');
  }
  const partyHealth = new Map<string, PartyHealthRow>();
  if (input.partyHealth !== undefined) {
    if (!Array.isArray(input.partyHealth) || input.partyHealth.length !== input.partyCharacterIds.length) {
      fail('MapRun Hand draw has an invalid party health snapshot');
    }
    for (const [index, row] of input.partyHealth.entries()) {
      const expectedCharacterId = input.partyCharacterIds[index];
      if (!isRecord(row) || row.characterId !== expectedCharacterId
        || !Number.isSafeInteger(row.currentHp) || (row.currentHp as number) < 0
        || !Number.isSafeInteger(row.maxHp) || (row.maxHp as number) < 1
        || (row.currentHp as number) > (row.maxHp as number)) {
        fail('MapRun Hand draw has an invalid party health row');
      }
      partyHealth.set(row.characterId as string, {
        characterId: row.characterId as string,
        currentHp: row.currentHp as number,
        maxHp: row.maxHp as number,
      });
    }
  }
  for (const participant of participants) {
    if (!isRecord(participant) || !isNonEmptyId(participant.characterId)
      || !partyIds.has(participant.characterId)) {
      fail('Encounter participant is not a member of the fixed Map party');
    }
    if (participantsByCharacter.has(participant.characterId)) {
      fail('Encounter contains a duplicate participant: ' + participant.characterId);
    }
    participantsByCharacter.set(participant.characterId, participant as unknown as GameplayEncounterParticipantDef);
  }

  let cursor = input.randomState.cursor;
  const virtualTeamBalances = new Map(balances.team);
  const hands: MapRunEncounterHand[] = [];
  for (const characterId of input.partyCharacterIds) {
    if (!livingPartyIds.has(characterId)) {
      hands.push({ characterId, actionIds: [] });
      continue;
    }
    const participant = participantsByCharacter.get(characterId);
    if (participant && !Array.isArray(participant.actions)) {
      fail('Encounter participant actions must be an array: ' + characterId);
    }
    const startingBalanceCandidates = resolveCandidates(
      characterId,
      participant?.actions ?? [],
      actionsById,
      balances.actor,
      balances.team,
      livingPartyIds,
      input.livingEnemyIds,
      partyHealth,
    );
    const naturalCandidates = resolveCandidates(
      characterId,
      participant?.actions ?? [],
      actionsById,
      balances.actor,
      virtualTeamBalances,
      livingPartyIds,
      input.livingEnemyIds,
      partyHealth,
    );
    if (naturalCandidates.length === 0) {
      hands.push({ characterId, actionIds: [] });
      continue;
    }

    const natural = takeWeightedAction(naturalCandidates, input.randomState.seed, cursor);
    cursor = natural.cursor;
    const actionIds = [natural.action.actionId];
    const remaining = startingBalanceCandidates.filter(candidate => candidate.actionId !== natural.action.actionId);
    for (const cost of natural.action.teamCosts) {
      const balance = virtualTeamBalances.get(cost.resourceId) ?? 0;
      if (cost.amount > BigInt(balance)) fail('natural Hand reservation exceeded the virtual Team balance');
      virtualTeamBalances.set(cost.resourceId, balance - Number(cost.amount));
    }
    while (actionIds.length < HAND_LIMIT && remaining.length > 0) {
      const next = takeWeightedAction(remaining, input.randomState.seed, cursor);
      cursor = next.cursor;
      actionIds.push(next.action.actionId);
    }
    hands.push({ characterId, actionIds });
  }

  return freezeTree({
    hands,
    randomState: {
      algorithm: GAMEPLAY_B_HAND_RNG_ALGORITHM,
      seed: input.randomState.seed,
      cursor,
    },
  });
}
