import { validateGameplayEncounterEffectSyntax, validateGameplayMapEffectProgram } from './gameplay-map-effect-syntax';

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
  readonly primary: readonly Actor[];
};

const isRecord = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const asRecords = (value: unknown): Obj[] => Array.isArray(value) ? value.filter(isRecord) : [];
const resourceKey = (actor: Actor): string => JSON.stringify([actor.kind, actor.id]);

function conditionRefs(
  value: unknown,
  visit: (kind: 'counter' | 'flag', id: unknown, path: string) => void,
  path: string,
  visitUnit: (unit: unknown, path: string) => void = () => undefined,
): void {
  if (!isRecord(value)) return;
  if (value.kind === 'counter') visit('counter', value.counterId, `${path}.counterId`);
  else if (value.kind === 'flag') visit('flag', value.flagId, `${path}.flagId`);
  else if (value.kind === 'hpAtLeast' || value.kind === 'hpAtMost' || value.kind === 'hpRatioAtLeast' || value.kind === 'hpRatioAtMost') {
    visitUnit(value.target, `${path}.target`);
  }
  else if (value.kind === 'all' || value.kind === 'any') {
    asRecords(value.conditions).forEach((child, index) => conditionRefs(child, visit, `${path}.conditions[${index}]`, visitUnit));
  } else if (value.kind === 'not') conditionRefs(value.condition, visit, `${path}.condition`, visitUnit);
}

/** Bind finite E1 references against each concrete Encounter and source identity. */
export function validateGameplayMapEffectContext(value: unknown): readonly GameplayMapEffectContextIssue[] {
  const issues: GameplayMapEffectContextIssue[] = [];
  const fail = (path: string, message: string): void => { issues.push({ path, message }); };
  if (!isRecord(value) || typeof value.id !== 'string') return issues;
  const mapId = value.id;
  const actions = new Map<string, Obj>();
  for (const action of asRecords(value.actions)) if (typeof action.id === 'string') actions.set(action.id, action);
  const validPrograms = new Set<string>();
  const partyIds = Array.isArray(value.partyCharacterIds)
    ? value.partyCharacterIds.filter((id): id is string => typeof id === 'string') : [];
  for (const action of actions.values()) {
    if (action.effectProgram === undefined) continue;
    const actionPath = `Map "${mapId}" Action "${String(action.id)}"`;
    const programPath = `${actionPath}.effectProgram`;
    const syntax = validateGameplayMapEffectProgram(action.effectProgram, programPath);
    for (const issue of syntax.issues) issues.push({ path: issue.path, message: issue.message });
    if (syntax.ok && typeof action.id === 'string') validPrograms.add(action.id);
    if (['effects', 'hpEffects', 'cardEffects'].some(field => Object.prototype.hasOwnProperty.call(action, field))) {
      fail(programPath, 'effectProgram cannot be combined with legacy effects, hpEffects, or cardEffects fields');
    }
    const prepare = isRecord(action.effectProgram) ? action.effectProgram.prepare : undefined;
    const target = isRecord(action.target) ? action.target.kind : undefined;
    if (Array.isArray(prepare) && prepare.length > 0 && target !== 'card') {
      fail(`${programPath}.prepare`, 'prepare discount requires a card target');
    }
    if (target === 'card' && (!Array.isArray(prepare) || prepare.length === 0)) {
      fail(programPath, 'card target requires effectProgram.prepare or legacy cardEffects');
    }
  }
  const partyResources = new Map<string, Set<string>>();
  const teamResources = new Set<string>();
  for (const row of asRecords(value.initialActorResources)) {
    if (typeof row.characterId !== 'string' || typeof row.resourceId !== 'string') continue;
    const key = JSON.stringify(['party', row.characterId]);
    const set = partyResources.get(key) ?? new Set<string>(); set.add(row.resourceId); partyResources.set(key, set);
  }
  for (const row of asRecords(value.initialTeamResources)) if (typeof row.resourceId === 'string') teamResources.add(row.resourceId);

  const validateEncounter = (raw: unknown, encounterPath: string): void => {
    if (!isRecord(raw)) return;
    const syntax = validateGameplayEncounterEffectSyntax(raw, encounterPath);
    for (const issue of syntax.issues) fail(issue.path, issue.message);

    const enemies = asRecords(raw.enemies);
    const enemyIds = enemies.flatMap(enemy => typeof enemy.id === 'string' ? [enemy.id] : []);
    const enemyResources = new Map<string, Set<string>>();
    for (const enemy of enemies) {
      if (typeof enemy.id !== 'string') continue;
      const set = new Set(asRecords(enemy.initialResources).flatMap(row => typeof row.resourceId === 'string' ? [row.resourceId] : []));
      enemyResources.set(JSON.stringify(['enemy', enemy.id]), set);
    }
    const enemyTeamResources = new Set(asRecords(raw.initialEnemyTeamResources)
      .flatMap(row => typeof row.resourceId === 'string' ? [row.resourceId] : []));
    const localCounters = new Set(asRecords(isRecord(raw.locals) ? raw.locals.counters : undefined)
      .flatMap(row => typeof row.id === 'string' ? [row.id] : []));
    const localFlags = new Set(asRecords(isRecord(raw.locals) ? raw.locals.flags : undefined)
      .flatMap(row => typeof row.id === 'string' ? [row.id] : []));
    const contexts: Context[] = [];
    const actionRefs = (rows: unknown, path: string, owner: Actor, side: 'party' | 'enemy'): void => {
      asRecords(rows).forEach((row, index) => {
        if (typeof row.actionId !== 'string') return;
        const action = actions.get(row.actionId);
        if (!action) return;
        contexts.push({
          path: `${path}[${index}]`, actionId: row.actionId, source: owner, side,
          actorless: false, primary: possibleTargets(action, owner, partyIds, enemyIds),
        });
      });
    };
    enemies.forEach((enemy, index) => {
      if (typeof enemy.id === 'string') actionRefs(enemy.actions, `${encounterPath}.enemies[${index}].actions`, { kind: 'enemy', id: enemy.id }, 'enemy');
    });
    asRecords(raw.participants).forEach((participant, index) => {
      if (typeof participant.characterId === 'string') actionRefs(participant.actions,
        `${encounterPath}.participants[${index}].actions`, { kind: 'party', id: participant.characterId }, 'party');
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
          side: 'party', actorless: true,
          primary: possibleTargets(action, undefined, partyIds, enemyIds),
        });
      });
    }

    for (const context of contexts) {
      const action = actions.get(context.actionId)!;
      const actionPath = `Map "${mapId}" ${context.path} Action "${context.actionId}"`;
      const target = isRecord(action.target) ? action.target.kind : undefined;
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
        if (asRecords(action.effects).some(effect => effect.scope === 'actor')) {
          fail(`${actionPath}.effects`, 'actorless Ability / Item cannot use actor-relative legacy effects');
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
      const checkUnit = (unit: unknown, path: string): void => {
        if (unit === 'source' && context.actorless) fail(path, 'actorless Ability / Item cannot reference source HP');
        if (unit === 'primary' && !hasUnitPrimary) fail(path, 'primary requires a possible unit target; none/card targets have no primary unit');
      };
      for (const [index, statement] of asRecords(isRecord(program) ? program.resolve : undefined).entries()) {
        visitProgramNode(statement, `${programPath}.resolve[${index}]`, {
          unit: checkUnit,
          account: (account, resourceId, path) => {
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
            }
          },
          local: (kind, id, path) => {
            const declarations = kind === 'counter' ? localCounters : localFlags;
            if (typeof id === 'string' && !declarations.has(id)) fail(path, `${kind} "${id}" is not declared in this Encounter`);
          },
        });
      }
    }
    const completion = isRecord(raw.completion) ? raw.completion : undefined;
    if (completion?.kind === 'condition') {
      if (enemies.length > 0) fail(`${encounterPath}.completion`, 'condition completion is only allowed in non-battle Encounters');
      if (raw.rounds !== undefined) fail(`${encounterPath}.completion`, 'condition completion cannot be combined with rounds');
      if (syntax.ok) conditionRefs(completion.condition, (kind, id, path) => {
          const declarations = kind === 'counter' ? localCounters : localFlags;
          if (typeof id === 'string' && !declarations.has(id)) fail(path, `${kind} "${id}" is not declared in this Encounter`);
        }, `${encounterPath}.completion.condition`, (_unit, path) => fail(path, 'Encounter completion has no source or primary unit context for HP conditions'));
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
    unit: (value: unknown, path: string) => void;
    account: (account: unknown, resourceId: unknown, path: string) => void;
    local: (kind: 'counter' | 'flag', id: unknown, path: string) => void;
  },
): void {
  if (value.op === 'hpChange') visit.unit(value.target, `${path}.target`);
  else if (value.op === 'resourceChange') visit.account(value.account, value.resourceId, `${path}.account`);
  else if (value.op === 'counterAdd') visit.local('counter', value.counterId, `${path}.counterId`);
  else if (value.op === 'flagSet') visit.local('flag', value.flagId, `${path}.flagId`);
  else if (value.op === 'when') {
    conditionRefs(value.condition, visit.local, `${path}.condition`, visit.unit);
    asRecords(value.then).forEach((statement, index) => visitProgramNode(statement, `${path}.then[${index}]`, visit));
    if (value.else !== undefined) asRecords(value.else).forEach((statement, index) => visitProgramNode(statement, `${path}.else[${index}]`, visit));
  }
}
