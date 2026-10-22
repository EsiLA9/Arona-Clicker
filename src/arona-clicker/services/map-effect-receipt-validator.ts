import type { GameplayMapDef, GameplayMapActionDef, GameplayEncounterDef } from '../../data-services/contracts/gameplay-map';
import { normalizeMapActionEffects, type NormalizedGameplayMapEffectCondition, type NormalizedGameplayMapEffectInstruction } from '../../data-services/normalization/gameplay-map-effect-program';
import type { MapEffectGuardRead, MapEffectProgramSourceIdentity } from '../contracts/map-effects';
import { mapCardActorKey } from './map-card-effects';

type Row = Record<string, any>;
type CurrentEncounter = {
  readonly nodeId: string;
  readonly activityId?: string;
  readonly round: number;
  readonly locals?: unknown;
  readonly partyHp?: readonly { readonly characterId: string; readonly currentHp: number }[];
  readonly enemies?: readonly { readonly enemyId: string; readonly currentHp: number }[];
};
export interface MapEffectReceiptBalances {
  readonly partyActor?: readonly { readonly characterId: string; readonly resourceId: string; readonly value: number }[];
  readonly partyTeam?: readonly { readonly resourceId: string; readonly value: number }[];
  readonly enemyActor?: readonly { readonly enemyId: string; readonly resourceId: string; readonly value: number }[];
  readonly enemyTeam?: readonly { readonly resourceId: string; readonly value: number }[];
}
export interface MapEffectReceiptContext {
  /** Trusted parent Run identity supplied by the caller/checkpoint. */
  readonly runId: string;
  readonly map: GameplayMapDef;
  readonly encounter: GameplayEncounterDef;
  readonly currentEncounter?: CurrentEncounter | null;
  /** Trusted balances from the still-active checkpoint; used only for end-state comparison. */
  readonly currentBalances?: MapEffectReceiptBalances | null;
}
export interface MapEffectReceiptValidation {
  readonly ok: boolean;
  readonly errors: readonly string[];
}

const record = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);
const safeInt = (value: unknown): value is number => Number.isSafeInteger(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const exact = (value: Row, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key))
  && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const identityKey = (identity: Row): string => `${identity.kind}:${identity.id}`;
const sourceKeyFor = (source: MapEffectProgramSourceIdentity): string => source.kind === 'partyCharacter' || source.kind === 'enemy'
  ? mapCardActorKey(source.kind, source.id)
  : source.kind === 'ability' ? JSON.stringify(['ability', source.actionId])
    : JSON.stringify(['item', source.itemId, source.actionId]);
function parseCardReceiver(rawId: string): Row | null {
  const card = parseCardInfo(rawId);
  return card ? { kind: card.kind, id: card.id } : null;
}
function parseCardInfo(rawId: string): { zone: string; kind: string; id: string; actionId: string } | null {
  try {
    const raw: unknown = JSON.parse(rawId);
    if (!Array.isArray(raw) || raw.length !== 4) return null;
    const [zone, kind, actorId, actionId] = raw;
    if ((zone !== 'hand' && zone !== 'playerCommand') || (kind !== 'partyCharacter' && kind !== 'enemy') || !id(actorId) || !id(actionId)) return null;
    return { zone, kind, id: actorId, actionId };
  } catch { return null; }
}

type SourceInfo = { source: MapEffectProgramSourceIdentity; action: GameplayMapActionDef; target: Row | null; targetCard: Row | null; settlement: Row; skipped: boolean };
type Rule = { op: string; path: string; instruction?: NormalizedGameplayMapEffectInstruction; prepareAmount?: number; condition?: NormalizedGameplayMapEffectCondition };

function rulesFor(action: GameplayMapActionDef): Map<string, Rule> {
  const normalized = normalizeMapActionEffects(action);
  const result = new Map<string, Rule>();
  for (const prepare of normalized.prepare) if (prepare.mode === 'program') {
    result.set(prepare.originPath, { op: 'discountSCost', path: prepare.originPath, prepareAmount: prepare.amount });
  }
  const visit = (instructions: readonly NormalizedGameplayMapEffectInstruction[]) => {
    for (const instruction of instructions) {
      result.set(instruction.originPath, {
        op: instruction.op, path: instruction.originPath, instruction,
        ...(instruction.op === 'when' ? { condition: instruction.condition } : {}),
      });
      if (instruction.op === 'when') {
        const condition = (value: NormalizedGameplayMapEffectCondition) => {
          result.set(value.originPath, { op: value.kind, path: value.originPath, condition: value });
          if (value.kind === 'not') condition(value.condition);
          else if (value.kind === 'all' || value.kind === 'any') value.conditions.forEach(condition);
        };
        condition(instruction.condition);
        visit(instruction.then); visit(instruction.else ?? []);
      }
    }
  };
  if (normalized.mode === 'program') visit(normalized.resolve);
  return result;
}

function sourceInfos(receipt: Row, context: MapEffectReceiptContext, errors: string[]): Map<string, SourceInfo> {
  const infos = new Map<string, SourceInfo>();
  const actions = new Map((context.map.actions ?? []).map(action => [action.id, action]));
  const add = (source: MapEffectProgramSourceIdentity, actionId: unknown, target: Row | null, targetCard: Row | null) => {
    if (!id(actionId)) return;
    const action = actions.get(actionId);
    if (!action) { errors.push(`unknown Action ${actionId}`); return; }
    const key = sourceKeyFor(source);
    if (infos.has(key)) { errors.push(`duplicate source ${key}`); return; }
    const settlement = receiptRowFor(receipt, source);
    const skipped = settlement.skipReason !== undefined;
    if (!sourceIsLegal(source, action, settlement, context, errors)) return;
    infos.set(key, { source, action, target, targetCard, settlement, skipped });
  };
  const settlements = Array.isArray(receipt.settlements) ? receipt.settlements : [];
  for (const value of settlements) if (record(value) && value.actionId !== null) {
    if (id(value.characterId)) add({ kind: 'partyCharacter', id: value.characterId }, value.actionId,
      targetFromSettlement(value), record(value.targetCard) ? value.targetCard : null);
  }
  if (Array.isArray(receipt.enemyActions)) for (const value of receipt.enemyActions) if (record(value) && value.actionId !== null && id(value.enemyId)) {
    add({ kind: 'enemy', id: value.enemyId }, value.actionId, targetFromSettlement(value), record(value.targetCard) ? value.targetCard : null);
  }
  if (record(receipt.ability)) add({ kind: 'ability', actionId: String(receipt.ability.actionId ?? '') }, receipt.ability.actionId,
    targetFromSettlement(receipt.ability), null);
  if (record(receipt.item)) add({ kind: 'item', itemId: String(receipt.item.itemId ?? ''), actionId: String(receipt.item.actionId ?? '') },
    receipt.item.actionId, targetFromSettlement(receipt.item), null);
  for (const [key, info] of infos) {
    if (info.source.kind === 'partyCharacter' && !context.map.partyCharacterIds.includes(info.source.id as never)) {
      errors.push(`source ${key} is outside the Encounter roster`);
    } else if (info.source.kind === 'enemy') {
      const enemyId = info.source.id;
      if (!(context.encounter.enemies ?? []).some(enemy => enemy.id === enemyId)) errors.push(`source ${key} is outside the Encounter roster`);
    }
  }
  return infos;
}

function sourceIsLegal(source: MapEffectProgramSourceIdentity, action: GameplayMapActionDef, settlement: Row,
  context: MapEffectReceiptContext, errors: string[]): boolean {
  let legal = false;
  if (source.kind === 'partyCharacter') {
    const participant = (context.encounter.participants ?? []).find(row => row.characterId === source.id);
    legal = action.eligibleCharacterIds.includes(source.id as never)
      && (settlement.overrideKind === 'playerCommand' || !!participant?.actions.some(candidate => candidate.actionId === action.id));
  } else if (source.kind === 'enemy') {
    const enemy = (context.encounter.enemies ?? []).find(row => row.id === source.id);
    legal = !!enemy?.actions?.some(candidate => candidate.actionId === action.id);
  } else if (source.kind === 'ability') {
    legal = (context.encounter.abilityActionIds ?? []).includes(action.id);
  } else {
    legal = (context.encounter.itemActions ?? []).some(row => row.itemId === source.itemId && row.actionId === action.id);
  }
  if (!legal) errors.push(`source ${sourceKeyFor(source)} is not admitted by the current Encounter`);
  return legal;
}

function targetFromSettlement(value: Row): Row | null {
  if (id(value.targetCharacterId)) return { kind: 'partyCharacter', id: value.targetCharacterId };
  if (id(value.targetEnemyId)) return { kind: 'enemy', id: value.targetEnemyId };
  if (record(value.target)) {
    if (value.target.kind === 'partyCharacter' && id(value.target.characterId)) return { kind: 'partyCharacter', id: value.target.characterId };
    if (value.target.kind === 'enemy' && id(value.target.enemyId)) return { kind: 'enemy', id: value.target.enemyId };
  }
  return null;
}

function expectedSourceIdentity(value: unknown, info: SourceInfo): boolean {
  return record(value) && same(value, info.source);
}

function evaluateLeaf(read: Row): boolean | null {
  if (read.op === 'hpAtLeast' || read.op === 'hpAtMost') {
    if (!safeInt(read.current) || !safeInt(read.value)) return null;
    return read.op === 'hpAtLeast' ? read.current >= read.value : read.current <= read.value;
  }
  if (read.op === 'hpRatioAtLeast' || read.op === 'hpRatioAtMost') {
    if (![read.current, read.cap, read.numerator, read.denominator].every(safeInt) || (read.cap as number) <= 0 || (read.denominator as number) <= 0) return null;
    const left = BigInt(read.current as number) * BigInt(read.denominator as number);
    const right = BigInt(read.cap as number) * BigInt(read.numerator as number);
    return read.op === 'hpRatioAtLeast' ? left >= right : left <= right;
  }
  if (read.op === 'counter') {
    if (!safeInt(read.current) || !safeInt(read.value)) return null;
    if (read.comparison === 'eq') return read.current === read.value;
    if (read.comparison === 'lt') return read.current < read.value;
    if (read.comparison === 'lte') return read.current <= read.value;
    if (read.comparison === 'gt') return read.current > read.value;
    if (read.comparison === 'gte') return read.current >= read.value;
    return null;
  }
  if (read.op === 'flag') return typeof read.current === 'boolean' && typeof read.value === 'boolean' ? read.current === read.value : null;
  return null;
}

function validateGuard(condition: NormalizedGameplayMapEffectCondition, reads: readonly unknown[], position: { value: number }, errors: string[], paths: string[]): boolean | null {
  paths.push(condition.originPath);
  const next = (): Row | null => {
    const raw = reads[position.value++];
    if (!record(raw)) { errors.push('guard reads are missing or malformed'); return null; }
    return raw;
  };
  if (condition.kind === 'all' || condition.kind === 'any') {
    const childResults: boolean[] = [];
    for (const child of condition.conditions) {
      if (condition.kind === 'all' && childResults.includes(false) || condition.kind === 'any' && childResults.includes(true)) break;
      const result = validateGuard(child, reads, position, errors, paths);
      if (result === null) return null;
      childResults.push(result);
    }
    const actual = condition.kind === 'all' ? childResults.every(Boolean) : childResults.some(Boolean);
    const node = next();
    if (!node || node.path !== condition.originPath || node.op !== condition.kind || node.result !== actual) errors.push(`guard ${condition.originPath} has an invalid ${condition.kind} summary`);
    return actual;
  }
  if (condition.kind === 'not') {
    const nested = validateGuard(condition.condition, reads, position, errors, paths);
    if (nested === null) return null;
    const actual = !nested;
    const node = next();
    if (!node || node.path !== condition.originPath || node.op !== 'not' || node.result !== actual) errors.push(`guard ${condition.originPath} has an invalid not summary`);
    return actual;
  }
  const leaf = next();
  if (!leaf) return null;
  const actual = evaluateLeaf(leaf);
  if (leaf.path !== condition.originPath || leaf.op !== condition.kind || actual === null || leaf.result !== actual) {
    errors.push(`guard ${condition.originPath} has an invalid read or result`);
    return null;
  }
  if ('target' in condition && record(leaf.identity) && (leaf.identity.kind !== 'partyCharacter' && leaf.identity.kind !== 'enemy')) errors.push(`guard ${condition.originPath} has an invalid Actor`);
  if (condition.kind === 'counter' && (leaf.counterId !== condition.counterId || leaf.comparison !== condition.comparison || leaf.value !== condition.value)) errors.push(`guard ${condition.originPath} disagrees with its Counter declaration`);
  if (condition.kind === 'flag' && (leaf.flagId !== condition.flagId || leaf.value !== condition.value)) errors.push(`guard ${condition.originPath} disagrees with its Flag declaration`);
  if (condition.kind === 'hpAtLeast' || condition.kind === 'hpAtMost') if (leaf.value !== condition.value) errors.push(`guard ${condition.originPath} threshold mismatch`);
  if (condition.kind === 'hpRatioAtLeast' || condition.kind === 'hpRatioAtMost') if (leaf.numerator !== condition.numerator || leaf.denominator !== condition.denominator) errors.push(`guard ${condition.originPath} ratio mismatch`);
  return actual;
}

function compareKnownRead(read: Row, values: Map<string, number | boolean>, errors: string[]) {
  const key = record(read.identity) && (read.identity.kind === 'partyCharacter' || read.identity.kind === 'enemy')
    ? `${read.identity.kind}:${read.identity.id}`
    : read.op === 'counter' ? `counter:${String(read.counterId)}` : read.op === 'flag' ? `flag:${String(read.flagId)}` : null;
  if (!key || !values.has(key)) return;
  const value = values.get(key)!;
  const observed = read.op === 'flag' || read.op === 'counter' ? read.current : read.current;
  if (observed !== value) errors.push(`guard read ${key} breaks the traced value chain`);
}

function canonicalVisits(infos: Map<string, SourceInfo>, sourceOrder: readonly string[], trace: Row[], receipt: Row, errors: string[]): Row[] {
  const prepare: Row[] = [];
  const resolve: Row[] = [];
  const walkStatements = (list: readonly NormalizedGameplayMapEffectInstruction[], info: SourceInfo, sourceKey: string,
    readsByPath: Map<string, Row>): void => {
    for (const statement of list) {
      resolve.push({ sourceKey, actionId: info.action.id, path: statement.originPath, kind: 'statement' });
      if (statement.op !== 'when') continue;
      const event = readsByPath.get(statement.originPath);
      const reads = event && Array.isArray(event.reads) ? event.reads : [];
      const conditions: string[] = [];
      const position = { value: 0 };
      const result = validateGuard(statement.condition, reads, position, errors, conditions);
      if (position.value !== reads.length) errors.push(`guard ${statement.originPath} contains unreachable reads`);
      if (!event || result === null || event.result !== result) errors.push(`cannot rebuild selected branch at ${statement.originPath}`);
      for (const path of conditions) resolve.push({ sourceKey, actionId: info.action.id, path, kind: 'condition' });
      if (result === true) walkStatements(statement.then, info, sourceKey, readsByPath);
      else if (result === false) walkStatements(statement.else ?? [], info, sourceKey, readsByPath);
    }
  };
  const readsBySourcePath = new Map<string, Row>();
  for (const event of trace) if (event.op === 'when') readsBySourcePath.set(`${event.sourceKey}|${event.actionId}|${event.path}`, event);
  for (const sourceKey of sourceOrder) {
    const info = infos.get(sourceKey);
    if (!info || info.skipped || !info.action.effectProgram) continue;
    const normalized = normalizeMapActionEffects(info.action);
    for (const leaf of normalized.prepare) if (leaf.mode === 'program') prepare.push({
      sourceKey, actionId: info.action.id, path: leaf.originPath, kind: 'prepare',
    });
    if (normalized.prepare.some(leaf => leaf.mode === 'program') && !info.targetCard) errors.push(`program prepare source ${info.action.id} has no selected CardRef`);
    const guards = new Map<string, Row>();
    for (const [key, event] of readsBySourcePath) if (key.startsWith(`${sourceKey}|${info.action.id}|`)) guards.set(event.path, event);
    walkStatements(normalized.resolve, info, sourceKey, guards);
  }
  return [...prepare, ...resolve].map(visit => ({ ...visit, mode: 'program', source: infos.get(String(visit.sourceKey))?.source,
    actionId: infos.get(String(visit.sourceKey))?.action.id }));
}

function initialLocals(encounter: GameplayEncounterDef): { counters: Map<string, { value?: number; min: number; max: number }>; flags: Map<string, boolean | undefined> } {
  return {
    counters: new Map((encounter.locals?.counters ?? []).map(counter => [counter.id, { min: counter.min, max: counter.max }])),
    flags: new Map((encounter.locals?.flags ?? []).map(flag => [flag.id, undefined])),
  };
}

function validateStateTrace(trace: Row[], visits: Row[], infos: Map<string, SourceInfo>, receipt: Row, context: MapEffectReceiptContext, errors: string[]) {
  const rules = new Map<string, Rule>();
  for (const info of infos.values()) for (const [path, rule] of rulesFor(info.action)) rules.set(`${info.action.id}|${path}`, rule);
  const visitsByRef = new Map<string, Row>();
  for (const visit of visits) visitsByRef.set(`${visit.sourceKey}|${visit.actionId}|${visit.path}`, visit);
  const stateEntries = trace.filter(entry => entry.op !== 'resourceSettlement' && entry.op !== 'discountSCost');
  const discountEntries = trace.filter(entry => entry.op === 'discountSCost');
  const prepareVisits = visits.filter(visit => visit.kind === 'prepare');
  if (discountEntries.length !== prepareVisits.length) errors.push('discountSCost trace count disagrees with prepare visits');
  for (const visit of prepareVisits) {
    const info = infos.get(String(visit.sourceKey));
    const rule = rules.get(`${String(visit.actionId)}|${String(visit.path)}`);
    const event = discountEntries.find(entry => entry.sourceKey === visit.sourceKey && entry.actionId === visit.actionId && entry.path === visit.path);
    if (!info || !rule || !event || event.amount !== rule.prepareAmount || !expectedSourceIdentity(event.source, info)
      || !record(event.targetCard) || !id(event.targetCard.id) || !record(event.targetCard.scope)
      || !same(event.targetCard.scope, receipt.effectScope)) errors.push(`prepare trace ${visit.path} is missing or disagrees with its declared discount`);
    if (info && record(event?.targetCard) && info.targetCard && !same(event.targetCard, info.targetCard)) errors.push(`prepare trace ${visit.path} changed its selected CardRef`);
    if (record(event?.targetCard)) {
      const receiver = parseCardReceiver(event.targetCard.id);
      if (!same(event.receiver, receiver)) errors.push(`prepare trace ${visit.path} has an invalid receiver`);
    }
  }
  let cursor = 0;
  const known = new Map<string, number | boolean>();
  const local = initialLocals(context.encounter);
  const expectedConditionVisits: string[] = [];
  for (const visit of visits) {
    if (!exact(visit, ['sourceKey', 'source', 'actionId', 'path', 'kind', 'mode'])) errors.push('program visit has unknown or missing fields');
    if (visit.kind === 'prepare') continue;
    const info = infos.get(String(visit.sourceKey));
    const rule = rules.get(`${String(visit.actionId)}|${String(visit.path)}`);
    if (!info || !rule || !rule.instruction) continue;
    const op = rule.op;
    if (op === 'resourceChange') continue;
    if (op === 'when') {
      const entry = stateEntries[cursor++];
      if (!entry || entry.op !== 'when' || entry.sourceKey !== visit.sourceKey || entry.actionId !== visit.actionId || entry.path !== visit.path
        || !expectedSourceIdentity(entry.source, info)) { errors.push(`trace is missing the when at ${visit.path}`); continue; }
      const reads = Array.isArray(entry.reads) ? entry.reads : [];
      const position = { value: 0 };
      const conditionPaths: string[] = [];
      const evaluated = rule.condition ? validateGuard(rule.condition, reads, position, errors, conditionPaths) : null;
      expectedConditionVisits.push(...conditionPaths.map(path => `${visit.sourceKey}|${visit.actionId}|${path}`));
      if (position.value !== reads.length) errors.push(`guard ${visit.path} contains unreachable reads`);
      if (evaluated === null || entry.result !== evaluated) errors.push(`guard ${visit.path} selected the wrong branch`);
      for (const raw of reads) if (record(raw)) {
        compareKnownRead(raw, known, errors);
        const conditionRule = rules.get(`${String(visit.actionId)}|${String(raw.path)}`)?.condition;
        if (conditionRule && conditionRule.kind !== 'all' && conditionRule.kind !== 'any' && conditionRule.kind !== 'not') {
          if ('target' in conditionRule) {
            const expected = (conditionRule.target === 'source' ? info.source : info.target) as Row | null;
            if (!expected || !same(raw.identity, expected)) errors.push(`guard read ${raw.path} has the wrong selected Actor`);
            const cap = expected?.kind === 'partyCharacter' ? context.map.initialPartyHp.find(row => row.characterId === expected.id)?.maxHp
              : expected?.kind === 'enemy' ? context.encounter.enemies?.find(enemy => enemy.id === expected.id)?.maxHp : undefined;
            if ((raw.op === 'hpAtLeast' || raw.op === 'hpAtMost')
              && (!safeInt(raw.current) || raw.current < 0 || !safeInt(cap) || raw.current > cap)) errors.push(`guard read ${raw.path} has an invalid HP value`);
            if ((raw.op === 'hpRatioAtLeast' || raw.op === 'hpRatioAtMost')
              && (!safeInt(raw.current) || raw.current < 0 || !safeInt(cap) || raw.current > cap || raw.cap !== cap)) errors.push(`guard read ${raw.path} has an invalid HP ratio base`);
          } else if (conditionRule.kind === 'counter') {
            const declaration = context.encounter.locals?.counters?.find(counter => counter.id === conditionRule.counterId);
            if (!declaration || raw.identity?.kind !== 'encounterLocal' || raw.counterId !== conditionRule.counterId
              || !safeInt(raw.current) || raw.current < declaration.min || raw.current > declaration.max) errors.push(`guard read ${raw.path} has an invalid Counter`);
          } else if (conditionRule.kind === 'flag') {
            if (!(context.encounter.locals?.flags ?? []).some(flag => flag.id === conditionRule.flagId)
              || raw.identity?.kind !== 'encounterLocal' || raw.flagId !== conditionRule.flagId || typeof raw.current !== 'boolean') errors.push(`guard read ${raw.path} has an invalid Flag`);
          }
        }
      }
      continue;
    }
    const entry = stateEntries[cursor++];
    if (!entry || entry.op !== op || entry.sourceKey !== visit.sourceKey || entry.actionId !== visit.actionId || entry.path !== visit.path
      || !expectedSourceIdentity(entry.source, info)) { errors.push(`trace is missing ${op} at ${visit.path}`); continue; }
    const instruction = rule.instruction as unknown as Row;
    if (op === 'hpChange') {
      const target = (instruction.target === 'source' ? info.source : info.target) as Row | null;
      if (!target || !record(entry.identity) || entry.identity.kind !== target.kind || entry.identity.id !== target.id) errors.push(`hpChange ${visit.path} has an invalid target`);
      if (![entry.before, entry.after, entry.delta].every(safeInt) || !safeInt(instruction.delta)) { errors.push(`hpChange ${visit.path} has unsafe values`); continue; }
      const cap = target?.kind === 'partyCharacter' ? context.map.initialPartyHp.find(row => row.characterId === target.id)?.maxHp
        : target?.kind === 'enemy' ? context.encounter.enemies?.find(row => row.id === target.id)?.maxHp : undefined;
      if (!safeInt(cap) || entry.before < 0 || entry.before > cap || entry.after < 0 || entry.after > cap) errors.push(`hpChange ${visit.path} exceeds its declared cap`);
      const calc = entry.before === 0 ? 0 : Number(BigInt(entry.before) + BigInt(instruction.delta) <= 0n ? 0n
        : BigInt(entry.before) + BigInt(instruction.delta) >= BigInt(cap ?? 0) ? BigInt(cap ?? 0) : BigInt(entry.before) + BigInt(instruction.delta));
      if (entry.after !== calc || entry.delta !== entry.after - entry.before) errors.push(`hpChange ${visit.path} has an invalid actual delta`);
      void target;
    } else if (op === 'counterAdd') {
      const declaration = context.encounter.locals?.counters?.find(counter => counter.id === instruction.counterId);
      if (!declaration || entry.counterId !== instruction.counterId || entry.identity?.kind !== 'encounterLocal'
        || ![entry.before, entry.after, entry.delta].every(safeInt)) { errors.push(`counterAdd ${visit.path} has an invalid declaration or values`); continue; }
      const mathematical = BigInt(entry.before) + BigInt(instruction.delta);
      if (mathematical > BigInt(Number.MAX_SAFE_INTEGER) || mathematical < BigInt(Number.MIN_SAFE_INTEGER)) errors.push(`counterAdd ${visit.path} overflows a safe integer`);
      const result = Math.max(declaration.min, Math.min(declaration.max, Number(mathematical)));
      if (entry.before < declaration.min || entry.before > declaration.max || entry.after !== result || entry.delta !== result - entry.before) errors.push(`counterAdd ${visit.path} has an invalid saturated delta`);
      const key = `counter:${instruction.counterId}`;
      if (known.has(key) && known.get(key) !== entry.before) errors.push(`counterAdd ${visit.path} breaks the Counter chain`);
      known.set(key, entry.after);
      local.counters.get(instruction.counterId)!.value = entry.after;
    } else if (op === 'flagSet') {
      if (!local.flags.has(instruction.flagId) || entry.flagId !== instruction.flagId || entry.identity?.kind !== 'encounterLocal'
        || typeof entry.before !== 'boolean' || entry.after !== instruction.value) { errors.push(`flagSet ${visit.path} has an invalid declaration or value`); continue; }
      const key = `flag:${instruction.flagId}`;
      if (known.has(key) && known.get(key) !== entry.before) errors.push(`flagSet ${visit.path} breaks the Flag chain`);
      known.set(key, entry.after);
      local.flags.set(instruction.flagId, entry.after);
    }
  }
  const actualConditionVisits = visits.filter(visit => visit.kind === 'condition')
    .map(visit => `${visit.sourceKey}|${visit.actionId}|${visit.path}`);
  if (!same(actualConditionVisits, expectedConditionVisits)) errors.push('condition visits disagree with the reached guard nodes or short-circuit path');
  if (cursor !== stateEntries.length) errors.push('effectTrace contains an event with no ordered program visit');
  return { known, local };
}

function settlementRows(receipt: Row): Row[] {
  const result: Row[] = [];
  if (Array.isArray(receipt.settlements)) for (const row of receipt.settlements) if (record(row)) result.push(row);
  if (record(receipt.ability)) result.push(receipt.ability);
  if (record(receipt.item)) result.push(receipt.item);
  if (Array.isArray(receipt.enemyActions)) for (const row of receipt.enemyActions) if (record(row)) result.push(row);
  return result;
}
function settlementSource(row: Row): MapEffectProgramSourceIdentity | null {
  if (!id(row.actionId)) return null;
  if (id(row.itemId)) return { kind: 'item', itemId: row.itemId, actionId: row.actionId };
  if (id(row.characterId)) return { kind: 'partyCharacter', id: row.characterId };
  if (id(row.enemyId)) return { kind: 'enemy', id: row.enemyId };
  return row.playerCostSpent === 1 ? { kind: 'ability', actionId: row.actionId } : null;
}

function validateResourceProjection(receipt: Row, trace: Row[], infos: Map<string, SourceInfo>, context: MapEffectReceiptContext, errors: string[]) {
  const events = trace.filter(entry => entry.op === 'resourceSettlement');
  const expected: Row[] = [];
  for (const row of settlementRows(receipt)) {
    const actionId = row.actionId;
    if (!id(actionId)) continue;
    const source = settlementSource(row);
    if (!source) continue;
    const sourceKey = sourceKeyFor(source as MapEffectProgramSourceIdentity);
    const info = infos.get(sourceKey);
    const changes = Array.isArray(row.resourceChanges) ? row.resourceChanges : [];
    for (const change of changes) if (record(change) && change.kind === 'effect') {
      expected.push({ sourceKey, source, actionId, change });
    }
  }
  const programChanges = expected.filter(item => {
    const info = infos.get(String(item.sourceKey));
    return !!info && rulesFor(info.action).size > 0;
  });
  if (events.length !== programChanges.length) errors.push('resourceSettlement events disagree with the grouped settlement projection');
  const unmatched = [...events];
  programChanges.forEach((item, position) => {
    const change = item.change as Row;
    const event = events[position];
    if (!event || event.sourceKey !== item.sourceKey || event.actionId !== item.actionId || event.resourceId !== change.resourceId) {
      errors.push(`resource event for ${String(item.actionId)} is missing or out of C3 order`);
      return;
    }
    unmatched.shift();
    const info = infos.get(String(item.sourceKey))!;
    const visit = Array.isArray(receipt.programVisits) ? receipt.programVisits.find((candidate: unknown) => record(candidate)
      && candidate.sourceKey === item.sourceKey && candidate.actionId === item.actionId && candidate.path === event.path && candidate.kind === 'statement') : null;
    const instruction = visit && info ? rulesFor(info.action).get(String(event.path))?.instruction : undefined;
    if (!expectedSourceIdentity(event.source, info)) errors.push(`resource event for ${String(item.actionId)} has an invalid source identity`);
    if (!safeInt(event.before) || !safeInt(event.after) || !safeInt(event.intentDelta) || event.after < 0 || event.after > Number.MAX_SAFE_INTEGER) errors.push(`resource event for ${String(item.actionId)} has unsafe balances`);
    if (safeInt(event.before) && safeInt(event.after) && safeInt(event.delta) && event.delta !== event.after - event.before) errors.push(`resource event for ${String(item.actionId)} has an invalid actual delta`);
    if (event.intentDelta !== change.delta || (safeInt(event.delta) && event.delta !== change.delta)) errors.push(`resource event for ${String(item.actionId)} disagrees with settlement delta`);
    if (!instruction || instruction.op !== 'resourceChange') errors.push(`resource event for ${String(item.actionId)} has no declared resourceChange`);
    else if (instruction.resourceId !== event.resourceId || instruction.delta !== event.intentDelta || instruction.account !== event.account) errors.push(`resource event for ${String(item.actionId)} disagrees with its declaration`);
    const account = event.account;
    const identity = event.identity;
    const wanted = account === 'sourceTeam' ? { kind: 'team', side: info.source.kind === 'enemy' ? 'enemy' : 'party' }
      : account === 'sourceActor' ? info.source.kind === 'partyCharacter' || info.source.kind === 'enemy' ? info.source : null
        : account === 'primaryActor' ? targetFromSettlement(receiptRowFor(receipt, info.source)) : null;
    if (!wanted || !same(identity, wanted) || change.resourceId !== event.resourceId) errors.push(`resource event for ${String(item.actionId)} has an invalid account identity`);
  });
  if (unmatched.length) errors.push('resourceSettlement contains duplicate or unprojected events');
  void context;
}

function receiptRowFor(receipt: Row, source: MapEffectProgramSourceIdentity): Row {
  if (source.kind === 'partyCharacter') return (Array.isArray(receipt.settlements) ? receipt.settlements : []).find((row: unknown) => record(row) && row.characterId === source.id) as Row ?? {};
  if (source.kind === 'enemy') return (Array.isArray(receipt.enemyActions) ? receipt.enemyActions : []).find((row: unknown) => record(row) && row.enemyId === source.id) as Row ?? {};
  return record(receipt[source.kind]) ? receipt[source.kind] as Row : {};
}

function encounterReferencesProgram(context: MapEffectReceiptContext): boolean {
  const candidateIds = new Set<string>();
  for (const participant of context.encounter.participants ?? []) for (const candidate of participant.actions) candidateIds.add(candidate.actionId);
  for (const enemy of context.encounter.enemies ?? []) for (const candidate of enemy.actions ?? []) candidateIds.add(candidate.actionId);
  for (const actionId of context.encounter.abilityActionIds ?? []) candidateIds.add(actionId);
  for (const mapping of context.encounter.itemActions ?? []) candidateIds.add(mapping.actionId);
  return (context.map.actions ?? []).some(action => candidateIds.has(action.id) && action.effectProgram !== undefined);
}

function encounterMatchesScope(map: GameplayMapDef, nodeId: unknown, activityId: unknown, encounter: GameplayEncounterDef): boolean {
  if (!id(nodeId)) return false;
  const node = map.nodes.find(row => row.id === nodeId);
  if (!node) return false;
  if (activityId === null || activityId === undefined) return node.encounter === encounter;
  return node.activities?.some(activity => activity.id === activityId && activity.encounter === encounter) ?? false;
}

type HpRange = { readonly min: number; readonly max: number };
type HpRangeMap = Map<string, HpRange[]>;
function hpActorKey(identity: Row) { return `${identity.kind}:${identity.id}`; }
function hpCap(identity: Row, context: MapEffectReceiptContext): number | undefined {
  return identity.kind === 'partyCharacter' ? context.map.initialPartyHp.find(row => row.characterId === identity.id)?.maxHp
    : identity.kind === 'enemy' ? context.encounter.enemies?.find(row => row.id === identity.id)?.maxHp : undefined;
}
function hpInstructionIdentity(instruction: Row, info: SourceInfo): Row | null {
  if (instruction.target === 'source') return info.source.kind === 'partyCharacter' || info.source.kind === 'enemy'
    ? { kind: info.source.kind, id: info.source.id } : null;
  return info.target;
}
function hpProjectionMatches(change: Row, identity: Row, delta: number) {
  return identity.kind === 'partyCharacter' ? change.scope === 'party' && change.characterId === identity.id && change.delta === delta
    : identity.kind === 'enemy' && change.scope === 'enemy' && change.enemyId === identity.id && change.delta === delta;
}
function clampHp(before: number, delta: number, cap: number) {
  if (before === 0) return 0;
  return Math.max(0, Math.min(cap, before + delta));
}
function intersectRange(range: HpRange, min: number, max: number): HpRange | null {
  const low = Math.max(range.min, min); const high = Math.min(range.max, max);
  return low <= high ? { min: low, max: high } : null;
}
function mergeRanges(ranges: HpRange[]): HpRange[] {
  const sorted = ranges.sort((left, right) => left.min - right.min);
  const merged: HpRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.min <= last.max + 1) merged[merged.length - 1] = { min: last.min, max: Math.max(last.max, range.max) };
    else merged.push(range);
  }
  return merged;
}
function applyLegacyHpDelta(ranges: HpRange[], declared: number, actual: number, cap: number): HpRange[] {
  const beforeRanges: HpRange[] = [];
  for (const range of ranges) {
    if (declared > 0) {
      if (actual === 0) { const zero = intersectRange(range, 0, 0); if (zero) beforeRanges.push(zero); }
      if (actual === declared) { const full = intersectRange(range, 1, cap - declared); if (full) beforeRanges.push(full); }
      if (actual >= 0 && actual < declared) {
        const before = cap - actual; const saturated = intersectRange(range, Math.max(1, cap - declared + 1), cap);
        if (saturated && before >= saturated.min && before <= saturated.max) beforeRanges.push({ min: before, max: before });
      }
    } else {
      const magnitude = -declared;
      if (actual === 0) { const zero = intersectRange(range, 0, 0); if (zero) beforeRanges.push(zero); }
      if (actual < 0 && actual >= declared) { const before = -actual; const hit = intersectRange(range, before, before); if (hit) beforeRanges.push(hit); }
      if (actual === declared) { const saturated = intersectRange(range, magnitude + 1, cap); if (saturated) beforeRanges.push(saturated); }
    }
  }
  const possible = mergeRanges(beforeRanges).map(range => ({ min: clampHp(range.min, declared, cap), max: clampHp(range.max, declared, cap) }));
  return mergeRanges(possible);
}
function legacyHpPhase(source: MapEffectProgramSourceIdentity): 'partyAction' | 'actorlessSource' | 'enemySource' {
  return source.kind === 'partyCharacter' ? 'partyAction' : source.kind === 'enemy' ? 'enemySource' : 'actorlessSource';
}

function validateHpProjection(receipt: Row, trace: Row[], infos: Map<string, SourceInfo>, context: MapEffectReceiptContext,
  errors: string[]): HpRangeMap {
  const ranges: HpRangeMap = new Map();
  const rows = settlementRows(receipt);
  const getInstructions = (info: SourceInfo) => normalizeMapActionEffects(info.action).resolve.filter((instruction: any) => instruction.op === 'hpChange'
    && (!info.action.effectProgram ? instruction.legacyPhase?.[legacyHpPhase(info.source)] !== undefined : true));
  const rowFor = (key: string) => rows.find(row => { const source = settlementSource(row); return source && sourceKeyFor(source) === key; });
  const processSource = (info: SourceInfo, key: string) => {
    const row = rowFor(key) ?? info.settlement;
    const actual = Array.isArray(row.hpChanges) ? row.hpChanges.filter(record) : [];
    if (info.skipped) { if (actual.length) errors.push(`skipped Action ${info.action.id} has HP changes`); return; }
    const instructions = getInstructions(info);
    const programEvents = info.action.effectProgram
      ? trace.filter(entry => entry.op === 'hpChange' && entry.sourceKey === key && entry.actionId === info.action.id) : [];
    if (info.action.effectProgram && actual.length !== programEvents.length) errors.push(`HP trace for ${info.action.id} disagrees with its settlement projection`);
    if (!info.action.effectProgram && actual.length !== instructions.length) errors.push(`legacy HP projection for ${info.action.id} disagrees with its declared phase`);
    const count = info.action.effectProgram ? programEvents.length : instructions.length;
    for (let index = 0; index < count; index += 1) {
      const instruction = instructions[index] as unknown as Row | undefined;
      const event = programEvents[index];
      const change = actual[index];
      const identity = event && record(event.identity) ? event.identity : instruction && info ? hpInstructionIdentity(instruction, info) : null;
      const cap = identity ? hpCap(identity, context) : undefined;
      if (!identity || !safeInt(cap) || !change || !safeInt(change.delta)) { errors.push(`HP projection for ${info.action.id} has no valid target or delta`); continue; }
      const expectedIdentity = instruction ? hpInstructionIdentity(instruction, info) : identity;
      if (!expectedIdentity || !same(identity, expectedIdentity) || !hpProjectionMatches(change, identity, change.delta)) errors.push(`HP projection for ${info.action.id} changed its declared target`);
      const keyActor = hpActorKey(identity);
      let current = ranges.get(keyActor);
      if (info.action.effectProgram) {
        if (!event || !safeInt(event.before) || !safeInt(event.after) || !safeInt(event.delta) || !safeInt(instruction?.delta)) {
          errors.push(`program HP event for ${info.action.id} has unsafe values`); continue;
        }
        if (!current) current = [{ min: event.before, max: event.before }];
        if (!current.some(range => event.before >= range.min && event.before <= range.max)) errors.push(`program HP event for ${info.action.id} breaks the mixed-source chain`);
        const after = clampHp(event.before, instruction.delta, cap);
        if (event.after !== after || event.delta !== after - event.before || change.delta !== event.delta) errors.push(`program HP event for ${info.action.id} has an invalid actual delta`);
        ranges.set(keyActor, [{ min: event.after, max: event.after }]);
      } else {
        if (!safeInt(instruction?.delta) || instruction.delta === 0) { errors.push(`legacy HP leaf for ${info.action.id} has an invalid declaration`); continue; }
        if (!current) current = [{ min: 0, max: cap }];
        const next = applyLegacyHpDelta(current, instruction.delta, change.delta, cap);
        if (!next.length) errors.push(`legacy HP event for ${info.action.id} cannot follow the preceding HP state`);
        ranges.set(keyActor, next);
      }
    }
  };
  const byPhase = (source: MapEffectProgramSourceIdentity) => {
    const info = infos.get(sourceKeyFor(source)); return info ? [info] : [];
  };
  const partySources = (receipt.settlements as unknown[] ?? []).filter(record).flatMap(row => {
    const source = settlementSource(row); return source?.kind === 'partyCharacter' ? byPhase(source) : [];
  });
  const ability = record(receipt.ability) ? settlementSource(receipt.ability) : null;
  const item = record(receipt.item) ? settlementSource(receipt.item) : null;
  const actorlessSources = [ability, item].filter((source): source is MapEffectProgramSourceIdentity => source !== null);
  const programActorless = actorlessSources.filter(source => !!infos.get(sourceKeyFor(source))?.action.effectProgram);
  const legacyActorless = actorlessSources.filter(source => !infos.get(sourceKeyFor(source))?.action.effectProgram);
  const enemySources = (receipt.enemyActions as unknown[] ?? []).filter(record).flatMap(row => {
    const source = settlementSource(row); return source?.kind === 'enemy' ? byPhase(source) : [];
  });
  for (const info of [...partySources, ...programActorless.map(source => infos.get(sourceKeyFor(source))!).filter(Boolean),
    ...legacyActorless.map(source => infos.get(sourceKeyFor(source))!).filter(Boolean), ...enemySources]) {
    processSource(info, sourceKeyFor(info.source));
  }
  return ranges;
}

/** Validate one opaque E1 receipt against the current Map/Encounter declarations. */
export function validateMapEffectCommitReceipt(value: unknown, context: MapEffectReceiptContext): MapEffectReceiptValidation {
  const errors: string[] = [];
  if (!record(value)) return { ok: false, errors: ['receipt must be an object'] };
  const receipt = value;
  const headerFields = ['programReceiptVersion', 'executionContractId', 'effectScope', 'programVisitCount', 'programVisits', 'plannedLocals', 'effectTrace'];
  if (headerFields.every(field => !Object.prototype.hasOwnProperty.call(receipt, field))) {
    return encounterReferencesProgram(context)
      ? { ok: false, errors: ['current Encounter references an E1 program but the receipt has no program header'] }
      : { ok: true, errors: [] };
  }
  if (receipt.programReceiptVersion !== 1 || receipt.executionContractId !== 'E1-COMPAT-1') errors.push('unsupported program receipt version or execution contract');
  if (!record(receipt.effectScope)) errors.push('effectScope must be an object');
  const scope = record(receipt.effectScope) ? receipt.effectScope : {};
  if (!id(context.runId) || scope.runId !== context.runId || scope.mapId !== context.map.id || scope.nodeId !== receipt.nodeId || scope.activityId !== (receipt.activityId ?? null)
    || scope.round !== receipt.round || !safeInt(scope.round) || scope.round < 1) errors.push('effectScope does not match the receipt scope');
  if (!encounterMatchesScope(context.map, receipt.nodeId, receipt.activityId ?? null, context.encounter)) errors.push('receipt Node/Activity does not resolve to the supplied Encounter');
  if (!Array.isArray(receipt.programVisits) || !Array.isArray(receipt.effectTrace)) return { ok: false, errors: [...errors, 'programVisits and effectTrace must be arrays'] };
  const visits = receipt.programVisits.filter(record);
  const trace = receipt.effectTrace.filter(record);
  if (visits.length !== receipt.programVisits.length || trace.length !== receipt.effectTrace.length) errors.push('programVisits/effectTrace contain malformed entries');
  if (visits.length > 4096 || receipt.programVisitCount !== visits.length) errors.push('programVisitCount is not the bounded derived visit count');
  if (!exact(scope, ['runId', 'mapId', 'nodeId', 'activityId', 'round'])) errors.push('effectScope has unknown or missing fields');
  for (const entry of trace) {
    const fields: Record<string, readonly string[]> = {
      hpChange: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'before', 'after', 'delta'],
      counterAdd: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'counterId', 'before', 'after', 'delta'],
      flagSet: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'flagId', 'before', 'after'],
      resourceSettlement: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'identity', 'account', 'resourceId', 'intentDelta', 'before', 'after', 'delta'],
      discountSCost: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'targetCard', 'receiver', 'amount'],
      when: ['sourceKey', 'source', 'actionId', 'path', 'op', 'mode', 'result', 'reads'],
    };
    const allowed = fields[String(entry.op)];
    if (!allowed || !exact(entry, allowed) || entry.mode !== 'program' || !id(entry.sourceKey) || !id(entry.actionId) || !id(entry.path)) errors.push('effectTrace contains an unknown shape');
    if (record(entry.identity) && !(
      (entry.identity.kind === 'partyCharacter' || entry.identity.kind === 'enemy') && id(entry.identity.id)
      || entry.identity.kind === 'team' && (entry.identity.side === 'party' || entry.identity.side === 'enemy')
      || entry.identity.kind === 'encounterLocal' && exact(entry.identity, ['kind'])
    )) errors.push('effectTrace contains an invalid identity');
    if (entry.op === 'when' && Array.isArray(entry.reads)) for (const raw of entry.reads) {
      if (!record(raw)) { errors.push('guard contains an unknown shape'); continue; }
      const readFields: Record<string, readonly string[]> = {
        hpAtLeast: ['path', 'op', 'identity', 'current', 'value', 'result'], hpAtMost: ['path', 'op', 'identity', 'current', 'value', 'result'],
        hpRatioAtLeast: ['path', 'op', 'identity', 'current', 'cap', 'numerator', 'denominator', 'result'], hpRatioAtMost: ['path', 'op', 'identity', 'current', 'cap', 'numerator', 'denominator', 'result'],
        counter: ['path', 'op', 'identity', 'counterId', 'current', 'comparison', 'value', 'result'], flag: ['path', 'op', 'identity', 'flagId', 'current', 'value', 'result'],
        all: ['path', 'op', 'result'], any: ['path', 'op', 'result'], not: ['path', 'op', 'result'],
      };
      if (!readFields[String(raw.op)] || !exact(raw, readFields[String(raw.op)])) errors.push('guard contains unknown or missing fields');
    }
  }
  const infos = sourceInfos(receipt, context, errors);
  const visitRefs = new Set<string>();
  for (const visit of visits) {
    if (!id(visit.sourceKey) || !id(visit.actionId) || !id(visit.path) || visit.mode !== 'program'
      || !['prepare', 'statement', 'condition'].includes(String(visit.kind))) { errors.push('program visit has an unknown shape'); continue; }
    const info = infos.get(visit.sourceKey);
    if (!info || info.action.id !== visit.actionId || !expectedSourceIdentity(visit.source, info)) { errors.push(`program visit ${visit.path} has an invalid source/action`); continue; }
    const rule = rulesFor(info.action).get(visit.path);
    if (!rule || (visit.kind === 'prepare' && rule.op !== 'discountSCost')
      || (visit.kind === 'condition' && !rule.condition) || (visit.kind === 'statement' && !rule.instruction)) errors.push(`program visit ${visit.path} is not a declared operation`);
    const ref = `${visit.sourceKey}|${visit.actionId}|${visit.path}`;
    if (visitRefs.has(ref)) errors.push(`duplicate visit ${ref}`);
    visitRefs.add(ref);
  }
  const sourceOrder = settlementRows(receipt).flatMap(row => {
    const source = settlementSource(row);
    return source ? [sourceKeyFor(source)] : [];
  });
  const partyIds = Array.isArray(receipt.settlements) ? receipt.settlements.filter(record).map(row => row.characterId) : [];
  if (!same(partyIds, context.map.partyCharacterIds)) errors.push('Party settlement order does not match the fixed Map roster');
  const enemyIds = Array.isArray(receipt.enemyActions) ? receipt.enemyActions.filter(record).map(row => row.enemyId) : [];
  if (!same(enemyIds, (context.encounter.enemies ?? []).map(enemy => enemy.id))) errors.push('Enemy action order does not match the Encounter declaration');
  const expectedVisits = canonicalVisits(infos, sourceOrder, trace, receipt, errors);
  const visitSignature = (rows: Row[]) => rows.map(row => [row.sourceKey, row.source, row.actionId, row.path, row.kind, row.mode]);
  if (!same(visitSignature(visits), visitSignature(expectedVisits))) errors.push('programVisits do not match the complete declaration walk and E1 source order');
  const state = validateStateTrace(trace, visits, infos, receipt, context, errors);
  validateResourceProjection(receipt, trace, infos, context, errors);
  validatePrepareCostProjection(receipt, trace, context, errors);
  const hpRanges = validateHpProjection(receipt, trace, infos, context, errors);
  if (!record(receipt.plannedLocals)) errors.push('plannedLocals must be an object');
  else {
    validatePlannedLocals(receipt.plannedLocals, context.encounter, errors);
    const counters = record(receipt.plannedLocals.counters) ? receipt.plannedLocals.counters : {};
    const flags = record(receipt.plannedLocals.flags) ? receipt.plannedLocals.flags : {};
    for (const [key, value] of state.known) {
      const [kind, localId] = key.split(':');
      if (kind !== 'counter' && kind !== 'flag') continue;
      const finalValue = kind === 'counter' ? record(counters[localId!]) ? counters[localId!]!.value : undefined : flags[localId!];
      if (finalValue !== value) errors.push(`plannedLocals ${key} disagrees with the last program write`);
    }
  }
  validateCurrentSnapshot(receipt, context, errors);
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function validatePlannedLocals(value: Row, encounter: GameplayEncounterDef, errors: string[]) {
  const counters = record(value.counters) ? value.counters : {};
  const flags = record(value.flags) ? value.flags : {};
  const defs = encounter.locals;
  for (const definition of defs?.counters ?? []) {
    const state = counters[definition.id];
    if (!record(state) || !exact(state, ['value', 'min', 'max']) || !safeInt(state.value) || state.value < definition.min || state.value > definition.max
      || state.min !== definition.min || state.max !== definition.max) errors.push(`planned Counter ${definition.id} is invalid`);
  }
  for (const key of Object.keys(counters)) if (!(defs?.counters ?? []).some(definition => definition.id === key)) errors.push(`planned Counter ${key} is undeclared`);
  for (const definition of defs?.flags ?? []) if (typeof flags[definition.id] !== 'boolean') errors.push(`planned Flag ${definition.id} is invalid`);
  for (const key of Object.keys(flags)) if (!(defs?.flags ?? []).some(definition => definition.id === key)) errors.push(`planned Flag ${key} is undeclared`);
}

function validatePrepareCostProjection(receipt: Row, trace: Row[], context: MapEffectReceiptContext, errors: string[]) {
  const rows = settlementRows(receipt);
  const actions = new Map((context.map.actions ?? []).map(action => [action.id, action]));
  const reductions = new Map<string, number>();
  for (const row of rows) {
    if (!id(row.actionId)) continue;
    const action = actions.get(row.actionId);
    if (!action) continue;
    const declared = normalizeMapActionEffects(action).prepare.reduce((sum, leaf) => sum + leaf.amount, 0);
    if (declared <= 0) continue;
    if (row.skipReason || !record(row.targetCard) || !id(row.targetCard.id) || !same(row.targetCard.scope, receipt.effectScope)) {
      errors.push(`Action ${action.id} has prepare declarations without a selected scoped CardRef`);
      continue;
    }
    const targetCardInfo = parseCardInfo(row.targetCard.id);
    if (!targetCardInfo) { errors.push(`Action ${action.id} selected a malformed CardRef`); continue; }
    const targetKey = `${targetCardInfo.kind}:${targetCardInfo.id}:${targetCardInfo.actionId}`;
    reductions.set(targetKey, (reductions.get(targetKey) ?? 0) + declared);
    const source = settlementSource(row);
    if (source && action.effectProgram) {
      const traced = trace.filter(entry => entry.op === 'discountSCost' && entry.actionId === action.id && same(entry.source, source));
      const expected = normalizeMapActionEffects(action).prepare.filter(leaf => leaf.mode === 'program').length;
      if (traced.length !== expected || traced.some(entry => !same(entry.targetCard, row.targetCard))) errors.push(`program prepare CardRef projection for ${action.id} is invalid`);
    }
  }
  for (const target of rows) {
    if (!id(target.actionId)) continue;
    const ownerKind = id(target.characterId) ? 'partyCharacter' : id(target.enemyId) ? 'enemy' : null;
    const ownerId = id(target.characterId) ? target.characterId : target.enemyId;
    if (!ownerKind || !ownerId) continue;
    const targetKey = `${ownerKind}:${ownerId}:${target.actionId}`;
    const total = reductions.get(targetKey) ?? 0;
    const targetAction = actions.get(target.actionId);
    const original = (targetAction?.costs ?? []).reduce((sum, cost) => cost.scope === 'actor' && cost.resourceId === 'sCost' ? sum + cost.amount : sum, 0);
    const expected = Math.min(total, original);
    if (original === 0) {
      if (target.scostCost !== undefined) errors.push(`sCost settlement for ${String(target.actionId)} is unexpected`);
    } else if (!record(target.scostCost) || target.scostCost.original !== original || target.scostCost.discount !== expected
      || target.scostCost.paid !== original - expected) errors.push(`sCost settlement for ${String(target.actionId)} disagrees with prepare discounts`);
  }
}

function validateCurrentSnapshot(receipt: Row, context: MapEffectReceiptContext, errors: string[]) {
  const current = context.currentEncounter;
  if (!current || current.nodeId !== receipt.nodeId || (current.activityId ?? null) !== (receipt.activityId ?? null)
    || !safeInt(current.round) || current.round <= Number(receipt.round)) return;
  if (current.round !== Number(receipt.round) + 1) { errors.push('current Encounter is not the immediate successor of this receipt'); return; }
  if (record(receipt.plannedLocals) && record(current.locals) && !same(receipt.plannedLocals, current.locals)) errors.push('plannedLocals disagree with the live Encounter snapshot');
  const hpExpected = new Map<string, number>();
  for (const entry of Array.isArray(receipt.effectTrace) ? receipt.effectTrace : []) if (record(entry) && entry.op === 'hpChange' && record(entry.identity)
    && id(entry.identity.id) && safeInt(entry.after)) hpExpected.set(identityKey(entry.identity), entry.after);
  for (const row of current.partyHp ?? []) if (hpExpected.has(`partyCharacter:${row.characterId}`) && hpExpected.get(`partyCharacter:${row.characterId}`) !== row.currentHp) errors.push(`live HP for ${row.characterId} disagrees with effectTrace`);
  for (const row of current.enemies ?? []) if (hpExpected.has(`enemy:${row.enemyId}`) && hpExpected.get(`enemy:${row.enemyId}`) !== row.currentHp) errors.push(`live Enemy HP for ${row.enemyId} disagrees with effectTrace`);
}

