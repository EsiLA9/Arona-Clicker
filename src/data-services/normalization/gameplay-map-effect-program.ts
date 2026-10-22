import type {
  GameplayMapEffectConditionDef,
  GameplayMapEffectProgramDef,
  GameplayMapEffectStatementDef,
} from '../contracts/gameplay-map-effects';
import type { GameplayMapActionDef } from '../contracts/gameplay-map';
import { validateGameplayMapEffectProgram } from '../validation/gameplay-map-effect-syntax';

export type GameplayMapEffectMode = 'legacy' | 'program';

/** The OLD phase facts the outer source scheduler must preserve for a legacy leaf. */
export interface GameplayMapLegacyPhase {
  readonly partyAction?: 'party-action-hp-before-resource-settlement' | 'resource-settlement-after-party-action-hp';
  readonly actorlessSource?: 'resource-settlement-before-actorless-hp' | 'actorless-hp-after-resource-settlement';
  readonly enemySource?: 'enemy-resource-before-own-hp' | 'enemy-hp-after-own-resource';
}

export interface GameplayMapEffectOrigin {
  readonly originPath: string;
  readonly mode: GameplayMapEffectMode;
  readonly legacyPhase?: GameplayMapLegacyPhase;
}

type NormalizedGameplayMapEffectConditionMetadata = {
  readonly originPath: string;
  readonly mode: 'program';
};

/** Every nested condition retains its own source path and program origin. */
export type NormalizedGameplayMapEffectCondition =
  | ({
    readonly kind: 'all' | 'any';
    readonly conditions: readonly NormalizedGameplayMapEffectCondition[];
  } & NormalizedGameplayMapEffectConditionMetadata)
  | ({
    readonly kind: 'not';
    readonly condition: NormalizedGameplayMapEffectCondition;
  } & NormalizedGameplayMapEffectConditionMetadata)
  | (Exclude<GameplayMapEffectConditionDef, { kind: 'all' | 'any' | 'not' }>
    & NormalizedGameplayMapEffectConditionMetadata);

export type NormalizedGameplayMapEffectInstruction =
  | (Extract<GameplayMapEffectStatementDef, { op: 'hpChange' }> & GameplayMapEffectOrigin)
  | (Extract<GameplayMapEffectStatementDef, { op: 'resourceChange' }> & GameplayMapEffectOrigin)
  | (Extract<GameplayMapEffectStatementDef, { op: 'counterAdd' }> & GameplayMapEffectOrigin)
  | (Extract<GameplayMapEffectStatementDef, { op: 'flagSet' }> & GameplayMapEffectOrigin)
  | (Omit<Extract<GameplayMapEffectStatementDef, { op: 'when' }>, 'condition' | 'then' | 'else'> & GameplayMapEffectOrigin & {
    readonly condition: NormalizedGameplayMapEffectCondition;
    readonly then: readonly NormalizedGameplayMapEffectInstruction[];
    readonly else?: readonly NormalizedGameplayMapEffectInstruction[];
  });

export type NormalizedGameplayMapPrepareInstruction = {
  readonly op: 'discountSCost';
  readonly amount: number;
} & GameplayMapEffectOrigin;

export interface NormalizedGameplayMapActionEffects {
  readonly mode: GameplayMapEffectMode;
  /** Legacy leaves keep the historical exemption from E1's new-program visit budget. */
  readonly budget: 'legacy-unmetered' | 'program-4096';
  readonly prepare: readonly NormalizedGameplayMapPrepareInstruction[];
  readonly resolve: readonly NormalizedGameplayMapEffectInstruction[];
}

export class GameplayMapEffectNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameplayMapEffectNormalizationError';
  }
}

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};

const isOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const exactKeys = (value: RecordValue, allowed: readonly string[], path: string) => {
  const extra = Object.keys(value).find(key => !allowed.includes(key));
  if (extra) throw new GameplayMapEffectNormalizationError(`${path}.${extra}: unknown field`);
};

const ACTION_FIELDS = [
  'id', 'name', 'description', 'eligibleCharacterIds', 'target', 'tendencyRole',
  'costs', 'effects', 'hpEffects', 'cardEffects', 'effectProgram',
] as const;

function normalizeCondition(value: GameplayMapEffectConditionDef, path: string): NormalizedGameplayMapEffectCondition {
  const origin = { originPath: path, mode: 'program' as const };
  if (value.kind === 'not') {
    return { ...value, ...origin, condition: normalizeCondition(value.condition, `${path}.condition`) };
  }
  if (value.kind === 'all' || value.kind === 'any') {
    return {
      ...value,
      ...origin,
      conditions: value.conditions.map((child, index) => normalizeCondition(child, `${path}.conditions[${index}]`)),
    } as NormalizedGameplayMapEffectCondition;
  }
  return { ...value, ...origin } as NormalizedGameplayMapEffectCondition;
}

function normalizeProgramStatements(
  statements: readonly GameplayMapEffectStatementDef[], path: string,
): readonly NormalizedGameplayMapEffectInstruction[] {
  return statements.map((statement, index) => {
    const statementPath = `${path}[${index}]`;
    const origin = { originPath: statementPath, mode: 'program' as const };
    if (statement.op !== 'when') return { ...statement, ...origin } as NormalizedGameplayMapEffectInstruction;
    const { condition, then, else: otherwise, ...fields } = statement;
    return {
      ...fields,
      ...origin,
      condition: normalizeCondition(condition, `${statementPath}.condition`),
      then: normalizeProgramStatements(then, `${statementPath}.then`),
      ...(otherwise === undefined ? {} : { else: normalizeProgramStatements(otherwise, `${statementPath}.else`) }),
    } as NormalizedGameplayMapEffectInstruction;
  });
}

function normalizeLegacy(action: GameplayMapActionDef, rootPath: string): NormalizedGameplayMapActionEffects {
  const prepare: NormalizedGameplayMapPrepareInstruction[] = [];
  const resolve: NormalizedGameplayMapEffectInstruction[] = [];
  const add = (instruction: NormalizedGameplayMapEffectInstruction) => resolve.push(instruction);

  if (action.hpEffects !== undefined) {
    if (!Array.isArray(action.hpEffects)) throw new GameplayMapEffectNormalizationError(`${rootPath}.hpEffects: expected array`);
    action.hpEffects.forEach((raw, index) => {
      const path = `${rootPath}.hpEffects[${index}]`;
      if (!isRecord(raw)) throw new GameplayMapEffectNormalizationError(`${path}: expected object`);
      exactKeys(raw, ['amount'], path);
      if (!Number.isSafeInteger(raw.amount) || raw.amount === 0) throw new GameplayMapEffectNormalizationError(`${path}.amount: expected a non-zero safe integer`);
      add({ op: 'hpChange', target: 'primary', delta: raw.amount as number, originPath: path, mode: 'legacy' });
    });
  }

  if (action.effects !== undefined) {
    if (!Array.isArray(action.effects)) throw new GameplayMapEffectNormalizationError(`${rootPath}.effects: expected array`);
    action.effects.forEach((raw, index) => {
      const path = `${rootPath}.effects[${index}]`;
      if (!isRecord(raw)) throw new GameplayMapEffectNormalizationError(`${path}: expected object`);
      exactKeys(raw, ['scope', 'resourceId', 'amount', 'recipient'], path);
      const account = raw.scope === 'team' ? 'sourceTeam'
        : raw.scope === 'actor' ? raw.recipient === 'target' ? 'primaryActor' : 'sourceActor'
          : undefined;
      if (!account || typeof raw.resourceId !== 'string' || raw.resourceId.trim().length === 0
        || !Number.isSafeInteger(raw.amount) || raw.amount === 0
        || (raw.recipient !== undefined && raw.recipient !== 'actor' && raw.recipient !== 'target')
        || (raw.scope === 'team' && raw.recipient !== undefined)) {
        throw new GameplayMapEffectNormalizationError(`${path}: invalid legacy resource effect`);
      }
      add({
        op: 'resourceChange', account, resourceId: raw.resourceId, delta: raw.amount as number,
        originPath: path, mode: 'legacy', legacyPhase: {
          partyAction: 'resource-settlement-after-party-action-hp',
          actorlessSource: 'resource-settlement-before-actorless-hp',
          enemySource: 'enemy-resource-before-own-hp',
        },
      });
    });
  }

  if (action.cardEffects !== undefined) {
    if (!Array.isArray(action.cardEffects)) throw new GameplayMapEffectNormalizationError(`${rootPath}.cardEffects: expected array`);
    action.cardEffects.forEach((raw, index) => {
      const path = `${rootPath}.cardEffects[${index}]`;
      if (!isRecord(raw)) throw new GameplayMapEffectNormalizationError(`${path}: expected object`);
      exactKeys(raw, ['kind', 'amount'], path);
      if (raw.kind !== 'scostDiscount' || !Number.isSafeInteger(raw.amount) || (raw.amount as number) <= 0) {
        throw new GameplayMapEffectNormalizationError(`${path}: invalid legacy card effect`);
      }
      prepare.push({ op: 'discountSCost', amount: raw.amount as number, originPath: path, mode: 'legacy' });
    });
  }

  // The source kind is only known by the outer planner. These labels let it
  // retain the different OLD HP phases without baking a queue into a leaf.
  for (let index = 0; index < resolve.length; index += 1) {
    const instruction = resolve[index]!;
    if (instruction.op !== 'hpChange') continue;
    resolve[index] = {
      ...instruction,
      legacyPhase: {
        partyAction: 'party-action-hp-before-resource-settlement',
        actorlessSource: 'actorless-hp-after-resource-settlement',
        enemySource: 'enemy-hp-after-own-resource',
      },
    };
  }

  return { mode: 'legacy', budget: 'legacy-unmetered', prepare, resolve };
}

/** Convert old Action arrays or a validated E1 program to the common pure instruction tree. */
export function normalizeMapActionEffects(
  action: GameplayMapActionDef,
  originPath = `actions.${action.id}`,
): NormalizedGameplayMapActionEffects {
  if (!isRecord(action)) throw new GameplayMapEffectNormalizationError(`${originPath}: expected Action object`);
  exactKeys(action, ACTION_FIELDS, originPath);
  const hasProgram = action.effectProgram !== undefined;
  const legacyFields = ['hpEffects', 'effects', 'cardEffects'] as const;
  if (hasProgram && legacyFields.some(field => isOwn(action, field))) {
    throw new GameplayMapEffectNormalizationError(`${originPath}: effectProgram cannot be mixed with legacy effect arrays`);
  }
  if (!hasProgram) return normalizeLegacy(action, originPath);

  const program = action.effectProgram as GameplayMapEffectProgramDef;
  const validation = validateGameplayMapEffectProgram(program, `${originPath}.effectProgram`);
  if (!validation.ok) {
    const first = validation.issues[0];
    throw new GameplayMapEffectNormalizationError(`${first?.path ?? `${originPath}.effectProgram`}: ${first?.message ?? 'invalid program'}`);
  }
  const prepare = (program.prepare ?? []).map((leaf, index) => ({
    ...leaf,
    originPath: `${originPath}.effectProgram.prepare[${index}]`,
    mode: 'program' as const,
  }));
  return {
    mode: 'program',
    budget: 'program-4096',
    prepare,
    resolve: normalizeProgramStatements(program.resolve ?? [], `${originPath}.effectProgram.resolve`),
  };
}
