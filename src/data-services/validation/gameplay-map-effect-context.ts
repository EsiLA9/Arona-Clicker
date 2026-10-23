import { validateGameplayEncounterEffectSyntax, validateGameplayMapEffectProgram, validateGameplayMapStatusSyntax } from './gameplay-map-effect-syntax';
import type { GameplayEncounterActionCandidateDef, GameplayMapDef } from '../contracts/gameplay-map';
import { resolveGameplayMapCandidateSources } from './gameplay-map-candidate-pools';

export interface GameplayMapEffectContextIssue {
  readonly path: string;
  readonly message: string;
}

type Obj = Record<string, unknown>;
type Actor = { readonly kind: 'party' | 'enemy'; readonly id: string };
type Context = {
  readonly path: string;
  readonly actionId: string;
  readonly source?: Actor;
  readonly side: 'party' | 'enemy';
  readonly actorless: boolean;
  /** True only for an Action row directly declared in a Party participant's actions list. */
  readonly directPartyAction: boolean;
  readonly primary: readonly Actor[];
};

const isRecord = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const asRecords = (value: unknown): Obj[] => Array.isArray(value) ? value.filter(isRecord) : [];
function containsOp(value: unknown, op: string): boolean {
  if (Array.isArray(value)) return value.some(child => containsOp(child, op));
  if (!isRecord(value)) return false;
  if (value.op === op) return true;
  return Object.values(value).some(child => containsOp(child, op));
}
/** Detect Shield authoring anywhere in a Map so the AG-1 owner can select its replay format. */
export function gameplayMapUsesShieldAdd(value: unknown): boolean {
  return isRecord(value) && asRecords(value.actions).some(action => containsOp(action.effectProgram, 'shieldAdd'));
}
/** Detect Status stack consumption in the Map's normalized Action Programs for Receipt version selection. */
export function gameplayMapUsesStatusConsume(value: unknown): boolean {
  return isRecord(value) && asRecords(value.actions).some(action => containsOp(action.effectProgram, 'statusConsume'));
}
/** Detect category-based Status removal in Map Action Programs for Receipt version selection. */
export function gameplayMapUsesStatusRemoveCategory(value: unknown): boolean {
  return isRecord(value) && asRecords(value.actions).some(action => containsOp(action.effectProgram, 'statusRemoveCategory'));
}
/** Detect Map-local damage-reduction Status definitions for Status Receipt version selection. */
export function gameplayMapUsesDamageReduction(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.statuses)
    && asRecords(value.statuses).some(status => status.kind === 'damageReduction');
}
/** Detect Map-local one-time damage-protection Status definitions for Status Receipt version selection. */
export function gameplayMapUsesDamageProtection(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.statuses)
    && asRecords(value.statuses).some(status => status.kind === 'damageProtection');
}
const resourceKey = (actor: Actor): string => JSON.stringify([actor.kind, actor.id]);

function poolCandidateMatchesOwner(action: Obj, side: 'party' | 'enemy', actorId: string): boolean {
  if (side === 'party'
    && (!Array.isArray(action.eligibleCharacterIds) || !action.eligibleCharacterIds.includes(actorId))) return false;
  const role = action.tendencyRole;
  const target = isRecord(action.target) ? action.target.kind : undefined;
  if (role === undefined || role === 'defense') return true;
  if (role === 'recovery') return side === 'party'
    ? target === 'self' || target === 'partyCharacter'
    : target === 'self' || target === 'enemy';
  if (role === 'attack') return side === 'party' ? target === 'enemy' : target === 'partyCharacter';
  return false;
}

function conditionRefs(
  value: unknown,
  visit: (kind: 'counter' | 'flag' | 'mapRunCounter' | 'mapRunFlag', id: unknown, path: string) => void,
  path: string,
  visitUnit: (unit: unknown, path: string) => void = () => undefined,
  visitAccount: (account: unknown, resourceId: unknown, path: string) => void = () => undefined,
): void {
  if (!isRecord(value)) return;
  if (value.kind === 'counter') visit('counter', value.counterId, `${path}.counterId`);
  else if (value.kind === 'flag') visit('flag', value.flagId, `${path}.flagId`);
  else if (value.kind === 'mapRunCounter') visit('mapRunCounter', value.counterId, `${path}.counterId`);
  else if (value.kind === 'mapRunFlag') visit('mapRunFlag', value.flagId, `${path}.flagId`);
  else if (value.kind === 'resourceAtLeast') visitAccount(value.account, value.resourceId, path);
  else if (value.kind === 'hpAtLeast' || value.kind === 'hpAtMost' || value.kind === 'hpRatioAtLeast' || value.kind === 'hpRatioAtMost') {
    visitUnit(value.target, `${path}.target`);
  }
  else if (value.kind === 'all' || value.kind === 'any') {
    asRecords(value.conditions).forEach((child, index) => conditionRefs(child, visit, `${path}.conditions[${index}]`, visitUnit, visitAccount));
  } else if (value.kind === 'not') conditionRefs(value.condition, visit, `${path}.condition`, visitUnit, visitAccount);
}

function containsPreparedTagCount(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === 'preparedTagCount') return true;
  if (value.kind === 'all' || value.kind === 'any') return asRecords(value.conditions).some(containsPreparedTagCount);
  return value.kind === 'not' && containsPreparedTagCount(value.condition);
}

function containsMapRunFactCondition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === 'mapRunCounter' || value.kind === 'mapRunFlag') return true;
  if (value.kind === 'all' || value.kind === 'any') return asRecords(value.conditions).some(containsMapRunFactCondition);
  return value.kind === 'not' && containsMapRunFactCondition(value.condition);
}

function containsPrimaryEffect(value: unknown, op: 'heal' | 'damage'): boolean {
  if (Array.isArray(value)) return value.some(child => containsPrimaryEffect(child, op));
  if (!isRecord(value)) return false;
  if (value.op === op && value.target === 'primary') return true;
  return (value.op === 'when' && (containsPrimaryEffect(value.then, op) || containsPrimaryEffect(value.else, op)))
    || (value.op === 'forTargets' && containsPrimaryEffect(value.body, op));
}

function containsDirectPrimaryDamage(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsDirectPrimaryDamage);
  if (!isRecord(value)) return false;
  if (value.op === 'damage' && value.target === 'primary') return true;
  // Conditions may gate the direct hit, but a loop body is explicitly outside
  // enemyDefeated's single-hit contract.
  return value.op === 'when'
    && (containsDirectPrimaryDamage(value.then) || containsDirectPrimaryDamage(value.else));
}

/** Bind finite Effect Program references against each concrete Encounter and source identity. */
export function validateGameplayMapEffectContext(value: unknown): readonly GameplayMapEffectContextIssue[] {
  const issues: GameplayMapEffectContextIssue[] = [];
  const fail = (path: string, message: string): void => { issues.push({ path, message }); };
  if (!isRecord(value) || typeof value.id !== 'string') return issues;
  const mapId = value.id;
  const candidateMap = value as unknown as GameplayMapDef;
  const mapRunCounters = new Set(asRecords(isRecord(value.mapRunFacts) ? value.mapRunFacts.counters : undefined)
    .flatMap(row => typeof row.id === 'string' ? [row.id] : []));
  const mapRunFlags = new Set(asRecords(isRecord(value.mapRunFacts) ? value.mapRunFacts.flags : undefined)
    .flatMap(row => typeof row.id === 'string' ? [row.id] : []));
  const statusesSyntax = value.statuses === undefined ? null : validateGameplayMapStatusSyntax(value.statuses, `Map "${mapId}" statuses`);
  for (const issue of statusesSyntax?.issues ?? []) issues.push({ path: issue.path, message: issue.message });
  if (value.executionContractId !== 'AG-1'
    && asRecords(value.statuses).some(status => status.kind === 'damageReduction' || status.kind === 'damageProtection')) {
    const statusKind = asRecords(value.statuses).some(status => status.kind === 'damageProtection')
      ? 'damageProtection' : 'damageReduction';
    fail(`Map "${mapId}" statuses`, `${statusKind} Status requires executionContractId AG-1`);
  }
  if (value.executionContractId !== 'AG-1'
    && asRecords(value.statuses).some(status => status.onExpire !== undefined)) {
    fail(`Map "${mapId}" statuses`, 'Status onExpire requires executionContractId AG-1');
  }
  if (value.executionContractId !== 'AG-1'
    && asRecords(value.statuses).some(status => status.onDamageTaken !== undefined)) {
    fail(`Map "${mapId}" statuses`, 'Status onDamageTaken requires executionContractId AG-1');
  }
  if (value.executionContractId !== 'AG-1'
    && asRecords(value.statuses).some(status => status.lifetime === 'mapRun')) {
    fail(`Map "${mapId}" statuses`, 'MapRun-lifetime Status requires executionContractId AG-1');
  }
  const statuses = new Map<string, Obj>();
  for (const status of asRecords(value.statuses)) if (typeof status.id === 'string') statuses.set(status.id, status);
  const actions = new Map<string, Obj>();
  for (const action of asRecords(value.actions)) if (typeof action.id === 'string') actions.set(action.id, action);
  const validPrograms = new Set<string>();
  const modifierActionIds = new Set<string>();
  const partyIds = Array.isArray(value.partyCharacterIds)
    ? value.partyCharacterIds.filter((id): id is string => typeof id === 'string') : [];
  for (const action of actions.values()) {
    if (action.additionalTarget !== undefined) {
      const actionPath = `Map "${mapId}" Action "${String(action.id)}"`;
      if (value.executionContractId !== 'AG-1') fail(`${actionPath}.additionalTarget`, 'additionalTarget requires executionContractId AG-1');
      if (action.additionalTarget !== 'partyCharacter' && action.additionalTarget !== 'enemy') {
        fail(`${actionPath}.additionalTarget`, 'additionalTarget must be partyCharacter or enemy');
      }
      const target = isRecord(action.target) ? action.target.kind : undefined;
      if (target !== 'partyCharacter' && target !== 'enemy') {
        fail(`${actionPath}.additionalTarget`, 'additionalTarget requires a partyCharacter or enemy unit target');
      }
    }
    if (action.effectProgram === undefined) continue;
    const actionPath = `Map "${mapId}" Action "${String(action.id)}"`;
    const programPath = `${actionPath}.effectProgram`;
    const syntax = validateGameplayMapEffectProgram(action.effectProgram, programPath);
    for (const issue of syntax.issues) issues.push({ path: issue.path, message: issue.message });
    if (syntax.ok && typeof action.id === 'string') validPrograms.add(action.id);
    if (syntax.ok && syntax.requiresAg1 && value.executionContractId !== 'AG-1') {
      fail(programPath, 'new E2 Effect AST requires executionContractId AG-1');
    }
    const prepare = isRecord(action.effectProgram) ? action.effectProgram.prepare : undefined;
    const target = isRecord(action.target) ? action.target.kind : undefined;
    const resolve = isRecord(action.effectProgram) ? action.effectProgram.resolve : undefined;
    const hasRevive = containsOp(action.effectProgram, 'revive');
    const triggers = isRecord(action.effectProgram) ? asRecords(action.effectProgram.triggers) : [];
    const hasTriggers = triggers.length > 0;
    if (hasTriggers) {
      if (value.executionContractId !== 'AG-1') fail(programPath, 'Effect Program triggers require executionContractId AG-1');
      if (target !== 'self' && target !== 'partyCharacter' && target !== 'enemy') {
        fail(`${actionPath}.target`, 'Effect Program triggers require a single unit primary target');
      }
      for (const [index, trigger] of triggers.entries()) {
        const event = trigger.event;
        if (event === 'healApplied' && !containsPrimaryEffect(resolve, 'heal')) {
          fail(`${programPath}.triggers[${index}]`, 'healApplied trigger requires a primary heal in the same Action Program');
        } else if (event === 'damageApplied' && !containsPrimaryEffect(resolve, 'damage')) {
          fail(`${programPath}.triggers[${index}]`, 'damageApplied trigger requires a primary damage in the same Action Program');
        } else if (event === 'enemyDefeated' && !containsDirectPrimaryDamage(resolve)) {
          fail(`${programPath}.triggers[${index}]`, 'enemyDefeated trigger requires a direct primary damage statement outside forTargets');
        }
      }
    }
    const includesDefeated = target === 'partyCharacter' && isRecord(action.target) && action.target.includeDefeated === true;
    if (includesDefeated && !hasRevive) {
      fail(`${actionPath}.target.includeDefeated`, 'includeDefeated requires a revive statement');
    }
    if (hasRevive && (target !== 'partyCharacter' || !includesDefeated)) {
      fail(`${programPath}.resolve`, 'revive requires target.kind partyCharacter and includeDefeated true');
    }
      const hasModifier = containsOp(resolve, 'cardEffectModifier');
    if (hasModifier) {
      modifierActionIds.add(String(action.id));
      if (value.executionContractId !== 'AG-1') fail(programPath, 'cardEffectModifier requires executionContractId AG-1');
      if (target !== 'card' || !isRecord(action.target) || action.target.side !== 'ally') {
        fail(`${actionPath}.target`, 'cardEffectModifier source requires target.kind card and side ally');
      }
      if (!Array.isArray(action.eligibleCharacterIds) || action.eligibleCharacterIds.length === 0) {
        fail(`${actionPath}.eligibleCharacterIds`, 'cardEffectModifier source requires Party eligibility');
      }
      if ((Array.isArray(prepare) && prepare.length > 0) || (prepare !== undefined && !Array.isArray(prepare))) {
        fail(`${programPath}.prepare`, 'cardEffectModifier source cannot declare prepare discounts');
      }
      if (!Array.isArray(resolve) || resolve.length !== 1 || !isRecord(resolve[0]) || resolve[0].op !== 'cardEffectModifier') {
        fail(`${programPath}.resolve`, 'cardEffectModifier source requires exactly one top-level resolve statement');
      }
    }
    if (Array.isArray(prepare) && prepare.length > 0 && target !== 'card') {
      fail(`${programPath}.prepare`, 'prepare discount requires a card target');
    }
    if (target === 'card' && (!Array.isArray(prepare) || prepare.length === 0) && !hasModifier) {
      fail(programPath, 'card target requires effectProgram.prepare');
    }
  }
  if (modifierActionIds.size > 0) {
    const modifierOwners = new Set([...modifierActionIds].flatMap(id => {
      const source = actions.get(id);
      return Array.isArray(source?.eligibleCharacterIds)
        ? source.eligibleCharacterIds.filter((owner): owner is string => typeof owner === 'string' && partyIds.includes(owner))
        : [];
    }));
    const candidateActions = [...actions.values()].filter(action => {
      if (modifierActionIds.has(String(action.id))) return false;
      const eligible = Array.isArray(action.eligibleCharacterIds) ? action.eligibleCharacterIds : [];
      return eligible.some(owner => typeof owner === 'string' && partyIds.includes(owner)
        && [...modifierOwners].some(modifierOwner => modifierOwner !== owner));
    });
    const hasValidTarget = candidateActions.some(action => {
      const statements = isRecord(action.effectProgram) ? action.effectProgram.resolve : undefined;
      return Array.isArray(statements) && statements.length === 1 && isRecord(statements[0])
        && (statements[0].op === 'damage' || statements[0].op === 'heal');
    });
    if (!hasValidTarget) {
      fail(`Map "${mapId}" actions`, 'cardEffectModifier requires at least one other-owner Party Action with exactly one top-level damage or heal statement');
    }
  }
  const partyResources = new Map<string, Set<string>>();
  const teamResources = new Set<string>();
  const partyResourceIds = new Set<string>();
  for (const row of asRecords(value.initialActorResources)) {
    if (typeof row.resourceId === 'string') partyResourceIds.add(row.resourceId);
  }
  for (const row of asRecords(value.initialTeamResources)) if (typeof row.resourceId === 'string') teamResources.add(row.resourceId);
  for (const action of actions.values()) {
    for (const cost of asRecords(action.costs)) {
      if (typeof cost.resourceId !== 'string') continue;
      if (cost.scope === 'actor') partyResourceIds.add(cost.resourceId);
      else if (cost.scope === 'team') teamResources.add(cost.resourceId);
    }
  }
  // MapRun materializes every declared Actor resource ID for every fixed Party
  // member; explicit initial rows only choose which identities start non-zero.
  for (const characterId of partyIds) {
    partyResources.set(JSON.stringify(['party', characterId]), new Set(partyResourceIds));
  }

  const validateEncounter = (raw: unknown, encounterPath: string): void => {
    if (!isRecord(raw)) return;
    const syntax = validateGameplayEncounterEffectSyntax(raw, encounterPath);
    for (const issue of syntax.issues) fail(issue.path, issue.message);
    if (syntax.ok && syntax.requiresAg1 && value.executionContractId !== 'AG-1') {
      fail(encounterPath, 'new E2 Effect AST requires executionContractId AG-1');
    }

    const enemies = asRecords(raw.enemies);
    const enemyIds = enemies.flatMap(enemy => typeof enemy.id === 'string' ? [enemy.id] : []);
    const enemyResources = new Map<string, Set<string>>();
    for (const enemy of enemies) {
      if (typeof enemy.id !== 'string') continue;
      const set = new Set(asRecords(enemy.initialResources).flatMap(row => typeof row.resourceId === 'string' ? [row.resourceId] : []));
      enemyResources.set(JSON.stringify(['enemy', enemy.id]), set);
    }
    for (const status of asRecords(value.statuses)) {
      if (!isRecord(status.onDamageTaken) || typeof status.onDamageTaken.resourceId !== 'string') continue;
      const resourceId = status.onDamageTaken.resourceId;
      const possibleHolders: Actor[] = [
        ...partyIds.map(id => ({ kind: 'party' as const, id })),
        ...enemyIds.map(id => ({ kind: 'enemy' as const, id })),
      ];
      for (const holder of possibleHolders) if (!hasResource(holder, resourceId, partyResources, enemyResources)) {
        fail(`${encounterPath}.enemies`, `Status "${String(status.id)}" onDamageTaken resource "${resourceId}" is not declared for possible holder ${holder.kind} "${holder.id}"`);
      }
    }
    const enemyTeamResources = new Set(asRecords(raw.initialEnemyTeamResources)
      .flatMap(row => typeof row.resourceId === 'string' ? [row.resourceId] : []));
    const localCounters = new Set(asRecords(isRecord(raw.locals) ? raw.locals.counters : undefined)
      .flatMap(row => typeof row.id === 'string' ? [row.id] : []));
    const localFlags = new Set(asRecords(isRecord(raw.locals) ? raw.locals.flags : undefined)
      .flatMap(row => typeof row.id === 'string' ? [row.id] : []));
    const contexts: Context[] = [];
    const actionRefs = (
      rows: unknown,
      path: string,
      owner: Actor,
      side: 'party' | 'enemy',
      directPartyAction = false,
    ): void => {
      asRecords(rows).forEach((row, index) => {
        if (typeof row.actionId !== 'string') return;
        const action = actions.get(row.actionId);
        if (!action) return;
        contexts.push({
          path: `${path}[${index}]`, actionId: row.actionId, source: owner, side,
          actorless: false, directPartyAction, primary: possibleTargets(action, owner, partyIds, enemyIds),
        });
      });
    };
    const addPoolActionRefs = (directRows: unknown, poolIds: unknown, path: string, owner: Actor, side: 'party' | 'enemy'): void => {
      if (poolIds !== undefined && !Array.isArray(poolIds)) {
        fail(`${path}.candidatePoolIds`, 'candidatePoolIds must be an array');
        return;
      }
      const directIds = new Set(asRecords(directRows)
        .flatMap(row => typeof row.actionId === 'string' ? [row.actionId] : []));
      try {
        const candidates = resolveGameplayMapCandidateSources(candidateMap,
          Array.isArray(directRows) ? directRows as GameplayEncounterActionCandidateDef[] : [],
          Array.isArray(poolIds) ? poolIds as string[] : undefined,
          { mode: 'allPotentialSources' });
        const poolOnly = candidates.filter(candidate => {
          if (directIds.has(candidate.actionId)) return false;
          const action = actions.get(candidate.actionId);
          return !!action && poolCandidateMatchesOwner(action, side, owner.id);
        }).map(candidate => ({ actionId: candidate.actionId }));
        actionRefs(poolOnly, `${path}.candidatePoolIds`, owner, side);
      } catch (error) {
        fail(`${path}.candidatePoolIds`, error instanceof Error ? error.message : String(error));
      }
    };
    enemies.forEach((enemy, index) => {
      if (typeof enemy.id === 'string') {
        const owner = { kind: 'enemy' as const, id: enemy.id };
        actionRefs(enemy.actions, `${encounterPath}.enemies[${index}].actions`, owner, 'enemy');
        addPoolActionRefs(enemy.actions, enemy.candidatePoolIds, `${encounterPath}.enemies[${index}]`, owner, 'enemy');
      }
    });
    asRecords(raw.participants).forEach((participant, index) => {
      if (typeof participant.characterId === 'string') {
        const owner = { kind: 'party' as const, id: participant.characterId };
        actionRefs(participant.actions, `${encounterPath}.participants[${index}].actions`, owner, 'party', true);
        addPoolActionRefs(participant.actions, participant.candidatePoolIds,
          `${encounterPath}.participants[${index}]`, owner, 'party');
      }
    });
    for (const field of ['abilityActionIds', 'itemActions'] as const) {
      const refs: { actionId?: unknown }[] = field === 'abilityActionIds'
        ? (Array.isArray(raw[field]) ? (raw[field] as unknown[]).map(actionId => ({ actionId })) : [])
        : asRecords(raw[field]);
      refs.forEach((ref, index) => {
        if (typeof ref.actionId !== 'string') return;
        const action = actions.get(ref.actionId);
        if (!action) return;
        contexts.push({
          path: `${encounterPath}.${field}[${index}]`, actionId: ref.actionId,
          side: 'party', actorless: true, directPartyAction: false,
          primary: possibleTargets(action, undefined, partyIds, enemyIds),
        });
      });
    }

    for (const context of contexts) {
      const action = actions.get(context.actionId)!;
      const actionPath = `Map "${mapId}" ${context.path} Action "${context.actionId}"`;
      const target = isRecord(action.target) ? action.target.kind : undefined;
      const hasRevive = containsOp(action.effectProgram, 'revive');
      const includesDefeated = target === 'partyCharacter' && isRecord(action.target) && action.target.includeDefeated === true;
      if (action.additionalTarget !== undefined && context.side === 'enemy') {
        fail(`${actionPath}.additionalTarget`, 'additionalTarget Actions cannot be referenced by Enemy sources');
      }
      if (hasRevive && context.side === 'enemy') {
        fail(`${actionPath}.effectProgram`, 'Enemy sources cannot use revive');
      }
      if (context.side === 'enemy' && isRecord(action.target) && action.target.includeDefeated !== undefined) {
        fail(`${actionPath}.target.includeDefeated`, 'Enemy sources cannot declare includeDefeated');
      }
      if (context.actorless) {
        if (!Array.isArray(action.eligibleCharacterIds) || action.eligibleCharacterIds.length !== 0) {
          fail(`${actionPath}.eligibleCharacterIds`, 'actorless Ability / Item requires an empty eligibleCharacterIds list');
        }
        if (action.costs !== undefined && (!Array.isArray(action.costs) || action.costs.length > 0)) {
          fail(`${actionPath}.costs`, 'actorless Ability / Item requires costs to be omitted or an empty array');
        }
        if (target !== 'partyCharacter' && target !== 'enemy') {
          fail(`${actionPath}.target`, 'actorless Ability / Item requires a partyCharacter or enemy unit target');
        }
      }
      const program = action.effectProgram;
      if (program === undefined || !validPrograms.has(context.actionId) || !syntax.ok) continue;
      const programPath = `${actionPath}.effectProgram`;
      const hasUnitPrimary = context.primary.length > 0 && (target === 'self' || target === 'partyCharacter' || target === 'enemy');
      const prepare = isRecord(program) ? program.prepare : undefined;
      if (context.actorless && Array.isArray(prepare) && prepare.length > 0) {
        fail(`${programPath}.prepare`, 'actorless Ability / Item cannot declare prepare discounts');
      }
      const checkUnit = (unit: unknown, path: string, loopTargets: readonly Actor[] | null = null): void => {
        if (unit === 'source' && context.actorless) fail(path, 'actorless Ability / Item cannot reference source HP');
        if (unit === 'primary' && !hasUnitPrimary) fail(path, 'primary requires a possible unit target; none/card targets have no primary unit');
        if (unit === 'loopTarget' && loopTargets === null) fail(path, 'loopTarget requires a forTargets body');
      };
      const checkResourceAccount = (account: unknown, resourceId: unknown, path: string, loopTargets: readonly Actor[] | null = null): void => {
        if (account === 'sourceActor') {
          if (context.actorless || !context.source) { fail(path, 'actorless Ability / Item cannot reference sourceActor'); return; }
          if (!hasResource(context.source, resourceId, partyResources, enemyResources)) {
            fail(path, `resource "${String(resourceId)}" is not declared for source ${context.source.kind} "${context.source.id}"`);
          }
        } else if (account === 'primaryActor') {
          if (!hasUnitPrimary) { fail(path, 'primaryActor requires a possible unit target; none/card targets have no primary unit'); return; }
          for (const actor of context.primary) if (!hasResource(actor, resourceId, partyResources, enemyResources)) {
            fail(path, `resource "${String(resourceId)}" is not declared for possible primary ${actor.kind} "${actor.id}"`);
          }
        } else if (account === 'sourceTeam') {
          const declared = context.side === 'party' ? teamResources : enemyTeamResources;
          if (typeof resourceId === 'string' && !declared.has(resourceId)) {
            fail(path, `resource "${resourceId}" is not declared by ${context.side} Team initial balances`);
          }
        } else if (account === 'additionalActor') {
          if (context.side === 'enemy') {
            fail(path, 'Enemy natural sources cannot write to additionalActor');
            return;
          }
          if (action.additionalTarget !== 'partyCharacter' && action.additionalTarget !== 'enemy') {
            fail(path, 'additionalActor requires an additionalTarget of partyCharacter or enemy');
            return;
          }
          const candidateSide = action.additionalTarget === 'partyCharacter' ? 'party' : 'enemy';
          const candidates: Actor[] = candidateSide === 'party'
            ? partyIds.map(id => ({ kind: 'party', id }))
            : enemyIds.map(id => ({ kind: 'enemy', id }));
          const excluded = new Set(context.primary.map(resourceKey));
          if (candidateSide === 'party' && context.source?.kind === 'party') {
            excluded.add(resourceKey(context.source));
          }
          const possible = candidates.filter(actor => !excluded.has(resourceKey(actor)));
          if (possible.length === 0) {
            fail(path, `additionalActor has no possible ${candidateSide} target distinct from source and primary`);
            return;
          }
          for (const actor of possible) if (!hasResource(actor, resourceId, partyResources, enemyResources)) {
            fail(path, `resource "${String(resourceId)}" is not declared for possible additionalTarget ${actor.kind} "${actor.id}"`);
          }
        } else if (account === 'loopTargetActor') {
          if (!loopTargets) { fail(path, 'loopTargetActor requires a forTargets body'); return; }
          for (const actor of loopTargets) if (!hasResource(actor, resourceId, partyResources, enemyResources)) {
            fail(path, `resource "${String(resourceId)}" is not declared for possible loopTarget ${actor.kind} "${actor.id}"`);
          }
        }
      };
      for (const [index, trigger] of asRecords(isRecord(program) ? program.triggers : undefined).entries()) {
        if (!isRecord(trigger) || !isRecord(trigger.effect)) continue;
        const triggerPath = `${programPath}.triggers[${index}]`;
        if (trigger.event === 'enemyDefeated') {
          if (context.side !== 'party' || context.actorless || context.source?.kind !== 'party') {
            fail(`${triggerPath}.event`, 'enemyDefeated requires a Party Actor source');
          }
          if (target !== 'enemy') {
            fail(`${triggerPath}.event`, "enemyDefeated requires target: 'enemy'");
          }
        }
        checkResourceAccount(trigger.effect.account, trigger.effect.resourceId,
          `${triggerPath}.effect.account`);
      }
      const checkFact = (kind: 'mapRunCounter' | 'mapRunFlag', id: unknown, path: string): void => {
        const declarations = kind === 'mapRunCounter' ? mapRunCounters : mapRunFlags;
        if (typeof id === 'string' && !declarations.has(id)) fail(path, `${kind} "${id}" is not declared in Map mapRunFacts`);
      };
      for (const [index, statement] of asRecords(isRecord(program) ? program.resolve : undefined).entries()) {
        visitProgramNode(statement, `${programPath}.resolve[${index}]`, {
          unit: checkUnit,
          revive: (targetUnit, path, loopTargets) => {
            checkUnit(targetUnit, `${path}.target`, loopTargets);
            if (targetUnit !== 'primary') fail(`${path}.target`, "revive requires 'primary'");
            if (context.side !== 'party') fail(path, 'Enemy sources cannot revive Party Characters');
            if (target !== 'partyCharacter' || !includesDefeated) {
              fail(path, 'revive requires a Party primary target with includeDefeated true');
            }
          },
          status: (targetUnit, statusId, stacks, path, loopTargets) => {
            checkUnit(targetUnit, `${path}.target`, loopTargets);
            const status = typeof statusId === 'string' ? statuses.get(statusId) : undefined;
            if (!status) fail(`${path}.statusId`, `status "${String(statusId)}" is not declared by this Map`);
            else if (status.lifetime === 'mapRun') {
              // The context path retains the exact Node or activity source row. Restricting
              // this to a direct participant Action makes the persisted source provenance
              // resolvable against that origin when a later Encounter restores the status.
              if (context.source?.kind !== 'party' || context.side !== 'party' || context.actorless
                || !context.directPartyAction) {
                fail(`${path}.statusId`, 'MapRun-lifetime Status may only be applied by a direct Party participant Action at its origin Node/activity');
              }
              if (targetUnit !== 'source' && targetUnit !== 'primary') {
                fail(`${path}.target`, "MapRun-lifetime Status target must be 'source' or 'primary'");
              } else if (targetUnit === 'source' && context.source?.kind !== 'party') {
                fail(`${path}.target`, "MapRun-lifetime Status 'source' target must be a Party Character");
              } else if (targetUnit === 'primary'
                && (context.primary.length === 0 || context.primary.some(actor => actor.kind !== 'party'))) {
                fail(`${path}.target`, "MapRun-lifetime Status 'primary' target must resolve to a Party Character");
              }
              if (value.executionContractId !== 'AG-1') {
                fail(`${path}.statusId`, 'MapRun-lifetime Status application requires executionContractId AG-1');
              }
            }
            if (status && typeof stacks === 'number' && Number.isSafeInteger(stacks)
              && Number.isSafeInteger(status.maxStacks) && stacks > (status.maxStacks as number)) {
              fail(`${path}.stacks`, `stacks exceeds Status "${String(statusId)}" maxStacks`);
            }
            if (status && typeof stacks === 'number' && isRecord(status.onExpire)
              && typeof status.onExpire.resourceId === 'string') {
              const holders = targetUnit === 'source'
                ? context.source ? [context.source] : []
                : targetUnit === 'primary' ? context.primary
                  : targetUnit === 'loopTarget' ? loopTargets ?? [] : [];
              for (const holder of holders) if (!hasResource(holder, status.onExpire.resourceId, partyResources, enemyResources)) {
                fail(`${path}.statusId`, `Status "${String(statusId)}" onExpire resource "${status.onExpire.resourceId}" is not declared for possible holder ${holder.kind} "${holder.id}"`);
              }
            }
          },
          statusConsume: (targetUnit, statusId, path, loopTargets) => {
            checkUnit(targetUnit, `${path}.target`, loopTargets);
            if (typeof statusId === 'string' && !statuses.has(statusId)) {
              fail(`${path}.statusId`, `status "${statusId}" is not declared by this Map`);
            }
          },
          statusRemoveCategory: (targetUnit, category, path, loopTargets) => {
            checkUnit(targetUnit, `${path}.target`, loopTargets);
            if (!asRecords(value.statuses).some(status => status.category === category)) {
              fail(`${path}.category`, `no Status declares category "${String(category)}" in this Map`);
            }
          },
          value: (value, path, targetAvailable, targetCountAvailable, loopTargets) => {
            visitValueRefs(value, path, {
              unit: (unit, unitPath, scope) => {
                if (unit === 'target' && !targetAvailable) fail(unitPath, 'target HP Value requires a damage/heal target set');
                else checkUnit(unit, unitPath, scope);
              },
              counter: (id, counterPath) => {
                if (typeof id === 'string' && !localCounters.has(id)) fail(counterPath, `counter "${id}" is not declared in this Encounter`);
              },
              targetCount: countPath => {
                if (!targetCountAvailable) fail(countPath, 'targetCount Value requires a damage/heal target set or forTargets body');
              },
              mapRunCounter: (id, counterPath) => checkFact('mapRunCounter', id, counterPath),
              account: (resourceAccount, resourceId, accountPath, scope) =>
                checkResourceAccount(resourceAccount, resourceId, accountPath, scope),
            }, loopTargets);
          },
          account: checkResourceAccount,
          local: (kind, id, path) => {
            const declarations = kind === 'counter' ? localCounters : localFlags;
            if (typeof id === 'string' && !declarations.has(id)) fail(path, `${kind} "${id}" is not declared in this Encounter`);
          },
          mapRun: checkFact,
          targetActors: side => side === 'party'
            ? partyIds.map(id => ({ kind: 'party' as const, id }))
            : enemyIds.map(id => ({ kind: 'enemy' as const, id })),
        });
      }
    }
    for (const id of modifierActionIds) {
      const uses = contexts.filter(context => context.actionId === id);
      if (uses.some(context => context.side !== 'party' || context.actorless)) {
        fail(`${encounterPath} Action "${id}"`, 'cardEffectModifier may only be used by Party sources');
      }
    }
    const completion = isRecord(raw.completion) ? raw.completion : undefined;
    if (completion?.kind === 'condition') {
      if (enemies.length > 0) fail(`${encounterPath}.completion`, 'condition completion is only allowed in non-battle Encounters');
      if (raw.rounds !== undefined) fail(`${encounterPath}.completion`, 'condition completion cannot be combined with rounds');
      if (containsPreparedTagCount(completion.condition)) fail(`${encounterPath}.completion.condition`, 'Prepared Tag conditions are not available to Encounter completion');
      const hasMapRunFactCondition = containsMapRunFactCondition(completion.condition);
      if (hasMapRunFactCondition) {
        fail(`${encounterPath}.completion.condition`, 'MapRun Fact conditions are only available in Action Effect Program when statements');
      }
      if (syntax.ok && !hasMapRunFactCondition) conditionRefs(completion.condition, (kind, id, path) => {
          const declarations = kind === 'counter' ? localCounters : kind === 'flag' ? localFlags
            : kind === 'mapRunCounter' ? mapRunCounters : mapRunFlags;
          const scope = kind === 'counter' || kind === 'flag' ? 'Encounter' : 'Map mapRunFacts';
          if (typeof id === 'string' && !declarations.has(id)) fail(path, `${kind} "${id}" is not declared in ${scope}`);
        }, `${encounterPath}.completion.condition`, (_unit, path) => fail(path, 'Encounter completion has no source or primary unit context for HP conditions'),
        (_account, _resourceId, path) => fail(path, 'Encounter completion has no Action source context for resource balance conditions'));
    }
    if (completion && raw.rounds !== undefined) fail(`${encounterPath}.completion`, 'completion cannot be combined with rounds');
  };

  for (const [nodeIndex, node] of asRecords(value.nodes).entries()) {
    const nodePath = `Map "${mapId}" Node "${String(node.id ?? nodeIndex)}"`;
    if (node.encounter !== undefined) validateEncounter(node.encounter, `${nodePath} encounter`);
    asRecords(node.activities).forEach((activity, activityIndex) => {
      if (activity.encounter !== undefined) validateEncounter(activity.encounter,
        `${nodePath} activities[${activityIndex}](${String(activity.id ?? activityIndex)}).encounter`);
    });
  }
  return issues;
}

function possibleTargets(action: Obj, source: Actor | undefined, partyIds: readonly string[], enemyIds: readonly string[]): Actor[] {
  const kind = isRecord(action.target) ? action.target.kind : undefined;
  if (kind === 'self' && source) return [source];
  if (kind === 'partyCharacter') return partyIds.map(id => ({ kind: 'party', id }));
  if (kind === 'enemy') return enemyIds.map(id => ({ kind: 'enemy', id }));
  return [];
}

function hasResource(source: Actor, resourceId: unknown, party: ReadonlyMap<string, Set<string>>, enemies: ReadonlyMap<string, Set<string>>): boolean {
  if (typeof resourceId !== 'string') return false;
  const resources = source.kind === 'party' ? party.get(resourceKey(source)) : enemies.get(resourceKey(source));
  return resources?.has(resourceId) ?? false;
}

function visitProgramNode(
  value: Obj,
  path: string,
  visit: {
    unit: (value: unknown, path: string, loopTargets?: readonly Actor[] | null) => void;
    revive: (target: unknown, path: string, loopTargets?: readonly Actor[] | null) => void;
    status: (target: unknown, statusId: unknown, stacks: unknown, path: string, loopTargets?: readonly Actor[] | null) => void;
    statusConsume: (target: unknown, statusId: unknown, path: string, loopTargets?: readonly Actor[] | null) => void;
    statusRemoveCategory: (target: unknown, category: unknown, path: string, loopTargets?: readonly Actor[] | null) => void;
    value: (value: unknown, path: string, targetAvailable: boolean, targetCountAvailable: boolean, loopTargets?: readonly Actor[] | null) => void;
    account: (account: unknown, resourceId: unknown, path: string, loopTargets?: readonly Actor[] | null) => void;
    local: (kind: 'counter' | 'flag', id: unknown, path: string) => void;
    mapRun: (kind: 'mapRunCounter' | 'mapRunFlag', id: unknown, path: string) => void;
    targetActors: (side: unknown) => readonly Actor[];
  },
  loopTargets: readonly Actor[] | null = null,
): void {
  if (value.op === 'damage' || value.op === 'heal') {
    const isSet = isRecord(value.target) && isRecord(value.target.set);
    if (value.target === 'primary') visit.unit('primary', `${path}.target`, loopTargets);
    if (typeof value.amount === 'object' && value.amount !== null) visit.value(value.amount, `${path}.amount`, isSet, isSet, loopTargets);
    if (typeof value.repeat === 'object' && value.repeat !== null) visit.value(value.repeat, `${path}.repeat`, false, isSet, loopTargets);
  } else if (value.op === 'revive') visit.revive(value.target, path, loopTargets);
  else if (value.op === 'hpChange') visit.unit(value.target, `${path}.target`, loopTargets);
  else if (value.op === 'shieldAdd') {
    visit.unit(value.target, `${path}.target`, loopTargets);
    if (typeof value.amount === 'object' && value.amount !== null) {
      visit.value(value.amount, `${path}.amount`, false, loopTargets !== null, loopTargets);
    }
  }
  else if (value.op === 'statusApply') visit.status(value.target, value.statusId, value.stacks, path, loopTargets);
  else if (value.op === 'statusRemove') visit.status(value.target, value.statusId, undefined, path, loopTargets);
  else if (value.op === 'statusConsume') visit.statusConsume(value.target, value.statusId, path, loopTargets);
  else if (value.op === 'statusRemoveCategory') visit.statusRemoveCategory(value.target, value.category, path, loopTargets);
  else if (value.op === 'resourceChange') visit.account(value.account, value.resourceId, `${path}.account`, loopTargets);
  else if (value.op === 'counterAdd') visit.local('counter', value.counterId, `${path}.counterId`);
  else if (value.op === 'flagSet') visit.local('flag', value.flagId, `${path}.flagId`);
  else if (value.op === 'mapRunCounterAdd') visit.mapRun('mapRunCounter', value.counterId, `${path}.counterId`);
  else if (value.op === 'mapRunFlagSet') visit.mapRun('mapRunFlag', value.flagId, `${path}.flagId`);
  else if (value.op === 'forTargets') {
    const targets = isRecord(value.targetSet) ? visit.targetActors(value.targetSet.side) : [];
    asRecords(value.body).forEach((statement, index) => visitProgramNode(statement, `${path}.body[${index}]`, visit, targets));
  }
  else if (value.op === 'when') {
    conditionRefs(value.condition, (kind, id, referencePath) => {
      if (kind === 'mapRunCounter' || kind === 'mapRunFlag') visit.mapRun(kind, id, referencePath);
      else visit.local(kind, id, referencePath);
    }, `${path}.condition`,
      (unit, unitPath) => visit.unit(unit, unitPath, loopTargets),
      (account, resourceId, accountPath) => visit.account(account, resourceId, `${accountPath}.account`, loopTargets));
    asRecords(value.then).forEach((statement, index) => visitProgramNode(statement, `${path}.then[${index}]`, visit, loopTargets));
    if (value.else !== undefined) asRecords(value.else).forEach((statement, index) => visitProgramNode(statement, `${path}.else[${index}]`, visit, loopTargets));
  }
}

function visitValueRefs(
  value: unknown,
  path: string,
  visit: {
    unit: (value: unknown, path: string, loopTargets?: readonly Actor[] | null) => void;
    counter: (id: unknown, path: string) => void;
    targetCount: (path: string) => void;
    mapRunCounter: (id: unknown, path: string) => void;
    account: (account: unknown, resourceId: unknown, path: string, loopTargets?: readonly Actor[] | null) => void;
  },
  loopTargets: readonly Actor[] | null = null,
): void {
  if (!isRecord(value)) return;
  if (value.kind === 'hp' || value.kind === 'hpCap' || value.kind === 'missingHp') visit.unit(value.unit, `${path}.unit`, loopTargets);
  else if (value.kind === 'counter') visit.counter(value.counterId, `${path}.counterId`);
  else if (value.kind === 'mapRunCounter') visit.mapRunCounter(value.counterId, `${path}.counterId`);
  else if (value.kind === 'resourceBalance') visit.account(value.account, value.resourceId, path, loopTargets);
  else if (value.kind === 'targetCount') visit.targetCount(path);
  else if (['add', 'sub', 'mul', 'divFloor', 'min', 'max'].includes(String(value.kind))) {
    visitValueRefs(value.left, `${path}.left`, visit, loopTargets);
    visitValueRefs(value.right, `${path}.right`, visit, loopTargets);
  } else if (value.kind === 'clamp') {
    visitValueRefs(value.value, `${path}.value`, visit, loopTargets);
    visitValueRefs(value.min, `${path}.min`, visit, loopTargets);
    visitValueRefs(value.max, `${path}.max`, visit, loopTargets);
  } else if (value.kind === 'abs') visitValueRefs(value.value, `${path}.value`, visit, loopTargets);
}
