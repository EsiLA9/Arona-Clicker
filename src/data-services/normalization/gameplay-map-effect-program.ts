import type {
  GameplayMapEffectConditionDef,
  GameplayMapEffectLoopConditionDef,
  GameplayMapEffectLoopStatementDef,
  GameplayMapEffectProgramDef,
  GameplayMapEffectStatementDef,
  GameplayMapEffectTriggerDef,
} from '../contracts/gameplay-map-effects';
import type { GameplayMapActionDef } from '../contracts/gameplay-map';
import { validateGameplayMapEffectProgram } from '../validation/gameplay-map-effect-syntax';

export interface GameplayMapEffectOrigin {
  readonly originPath: string;
  readonly mode: 'program';
}

type NormalizedGameplayMapEffectConditionMetadata = GameplayMapEffectOrigin;

type NormalizeConditionTree<T> =
  T extends { readonly kind: 'all' | 'any'; readonly conditions: readonly (infer Child)[] }
    ? Omit<T, 'conditions'> & NormalizedGameplayMapEffectConditionMetadata & {
      readonly conditions: readonly NormalizeConditionTree<Child>[];
    }
    : T extends { readonly kind: 'not'; readonly condition: infer Child }
      ? Omit<T, 'condition'> & NormalizedGameplayMapEffectConditionMetadata & {
        readonly condition: NormalizeConditionTree<Child>;
      }
      : T & NormalizedGameplayMapEffectConditionMetadata;

/** Every nested condition retains its source path and Program origin. */
export type NormalizedGameplayMapEffectCondition = NormalizeConditionTree<GameplayMapEffectConditionDef>;
export type NormalizedGameplayMapEffectLoopCondition = NormalizeConditionTree<GameplayMapEffectLoopConditionDef>;

type NormalizedElseItems<T> = T extends { readonly else?: readonly (infer Else)[] } ? Else : never;
type NormalizeInstructionTree<T> =
  T extends {
    readonly op: 'when';
    readonly condition: infer Condition;
    readonly then: readonly (infer Then)[];
  }
    ? Omit<T, 'condition' | 'then' | 'else'> & GameplayMapEffectOrigin & {
      readonly condition: NormalizeConditionTree<Condition>;
      readonly then: readonly NormalizeInstructionTree<Then>[];
      readonly else?: readonly NormalizeInstructionTree<NormalizedElseItems<T>>[];
    }
    : T extends { readonly op: 'forTargets'; readonly body: readonly (infer Body)[] }
      ? Omit<T, 'body'> & GameplayMapEffectOrigin & {
        readonly body: readonly NormalizeInstructionTree<Body>[];
      }
      : T & GameplayMapEffectOrigin;

export type NormalizedGameplayMapEffectInstruction = NormalizeInstructionTree<GameplayMapEffectStatementDef>;
export type NormalizedGameplayMapEffectLoopInstruction = NormalizeInstructionTree<GameplayMapEffectLoopStatementDef>;

export type NormalizedGameplayMapPrepareInstruction = {
  readonly op: 'discountSCost';
  readonly amount: number;
} & GameplayMapEffectOrigin;

export type NormalizedGameplayMapEffectTrigger = {
  readonly id: string;
  readonly event: GameplayMapEffectTriggerDef['event'];
  readonly minimumActualAmount?: number;
  readonly effect: {
    readonly op: 'resourceChange';
    readonly account: 'primaryActor' | 'sourceActor';
    readonly resourceId: string;
    readonly delta: number;
  } & GameplayMapEffectOrigin;
  readonly originPath: string;
  readonly mode: 'program';
};

export interface NormalizedGameplayMapActionEffects {
  readonly budget: 'program-4096';
  readonly prepare: readonly NormalizedGameplayMapPrepareInstruction[];
  readonly resolve: readonly NormalizedGameplayMapEffectInstruction[];
  readonly triggers?: readonly NormalizedGameplayMapEffectTrigger[];
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

const exactKeys = (value: RecordValue, allowed: readonly string[], path: string) => {
  const extra = Object.keys(value).find(key => !allowed.includes(key));
  if (extra) throw new GameplayMapEffectNormalizationError(`${path}.${extra}: unknown field`);
};

const ACTION_FIELDS = [
  'id', 'name', 'description', 'agility', 'eligibleCharacterIds', 'target', 'tendencyRole',
  'costs', 'effectProgram', 'tags', 'additionalTarget',
] as const;

type GameplayMapEffectConditionInput = GameplayMapEffectConditionDef | GameplayMapEffectLoopConditionDef;
type GameplayMapEffectStatementInput = GameplayMapEffectStatementDef | GameplayMapEffectLoopStatementDef;
type NormalizedGameplayMapEffectInstructionInput =
  | NormalizedGameplayMapEffectInstruction
  | NormalizedGameplayMapEffectLoopInstruction;

function normalizeCondition(value: GameplayMapEffectConditionInput, path: string):
  NormalizedGameplayMapEffectCondition | NormalizedGameplayMapEffectLoopCondition {
  const origin = { originPath: path, mode: 'program' as const };
  if (value.kind === 'not') {
    return { ...value, ...origin, condition: normalizeCondition(value.condition, `${path}.condition`) } as
      NormalizedGameplayMapEffectCondition | NormalizedGameplayMapEffectLoopCondition;
  }
  if (value.kind === 'all' || value.kind === 'any') {
    return {
      ...value,
      ...origin,
      conditions: value.conditions.map((child, index) => normalizeCondition(child, `${path}.conditions[${index}]`)),
    } as NormalizedGameplayMapEffectCondition | NormalizedGameplayMapEffectLoopCondition;
  }
  return { ...value, ...origin } as NormalizedGameplayMapEffectCondition | NormalizedGameplayMapEffectLoopCondition;
}

function normalizeStatements(
  statements: readonly GameplayMapEffectStatementInput[], path: string,
): readonly NormalizedGameplayMapEffectInstructionInput[] {
  return statements.map((statement, index) => {
    const statementPath = `${path}[${index}]`;
    const origin = { originPath: statementPath, mode: 'program' as const };
    if (statement.op === 'when') {
      const { condition, then, else: otherwise, ...fields } = statement;
      return {
        ...fields,
        ...origin,
        condition: normalizeCondition(condition, `${statementPath}.condition`),
        then: normalizeStatements(then, `${statementPath}.then`),
        ...(otherwise === undefined ? {} : { else: normalizeStatements(otherwise, `${statementPath}.else`) }),
      } as NormalizedGameplayMapEffectInstructionInput;
    }
    if (statement.op === 'forTargets') {
      return {
        ...statement,
        ...origin,
        body: normalizeStatements(statement.body, `${statementPath}.body`),
      } as NormalizedGameplayMapEffectInstructionInput;
    }
    return { ...statement, ...origin } as NormalizedGameplayMapEffectInstructionInput;
  });
}

function normalizeProgramStatements(
  statements: readonly GameplayMapEffectStatementDef[], path: string,
): readonly NormalizedGameplayMapEffectInstruction[] {
  return normalizeStatements(statements, path) as readonly NormalizedGameplayMapEffectInstruction[];
}

/** Normalize a finite E1/E2 Program; Actions without a Program have no effect leaves. */
export function normalizeMapActionEffects(
  action: GameplayMapActionDef,
  originPath = `actions.${action.id}`,
): NormalizedGameplayMapActionEffects {
  if (!isRecord(action)) throw new GameplayMapEffectNormalizationError(`${originPath}: expected Action object`);
  exactKeys(action, ACTION_FIELDS, originPath);
  if (action.effectProgram === undefined) {
    return { budget: 'program-4096', prepare: [], resolve: [] };
  }

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
  const triggers = program.triggers?.map((trigger, index) => ({
    ...trigger,
    originPath: `${originPath}.effectProgram.triggers[${index}]`,
    mode: 'program' as const,
    effect: {
      ...trigger.effect,
      originPath: `${originPath}.effectProgram.triggers[${index}].effect`,
      mode: 'program' as const,
    },
  }));
  return {
    budget: 'program-4096',
    prepare,
    resolve: normalizeProgramStatements(program.resolve ?? [], `${originPath}.effectProgram.resolve`),
    ...(triggers === undefined ? {} : { triggers }),
  };
}
