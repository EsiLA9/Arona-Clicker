import type { RuntimeEditorProblemInput } from './form';

export type DefinitionProblemSeverity = 'error' | 'warning' | 'info';

export type DefinitionProblemCategory =
  | 'field'
  | 'reference'
  | 'capability'
  | 'materialization'
  | 'runtime-impact';

export interface DefinitionProblemLocation {
  readonly sectionId?: string;
  readonly collectionId?: string;
  readonly itemIndex?: number;
  readonly childCollectionId?: string;
  readonly childIndex?: number;
}

export interface DefinitionProblem {
  readonly severity: DefinitionProblemSeverity;
  readonly problemCode: string;
  readonly objectRef: string;
  readonly table: string;
  readonly defId: string;
  readonly sectionId: string;
  readonly path: string;
  readonly message: string;
  readonly nextAction: string;
  readonly location: DefinitionProblemLocation;
}

export interface RuntimeEditorProblemNormalizationOptions {
  readonly severity?: DefinitionProblemSeverity;
  readonly problemCode?: string;
  readonly objectRef?: string;
  readonly table?: string;
  readonly defId?: string;
  readonly sectionId?: string;
  readonly nextAction?: string;
  readonly location?: DefinitionProblemLocation;
}

export interface DefinitionDiffSummary<T = unknown> {
  readonly path: string;
  readonly source: T | undefined;
  readonly draft: T | undefined;
  readonly applied: T | undefined;
  readonly sourceToDraftChanged: boolean;
  readonly draftToAppliedChanged: boolean;
  readonly sourceToAppliedChanged: boolean;
  readonly changed: boolean;
}

export interface DefinitionThreeWaySnapshots<T = unknown> {
  readonly source: T;
  readonly draft: T;
  readonly applied: T;
}

const LOCATION_KEYS = ['sectionId', 'collectionId', 'itemIndex', 'childCollectionId', 'childIndex'] as const;
const SEVERITY_ORDER: Record<DefinitionProblemSeverity, number> = { error: 0, warning: 1, info: 2 };

export function normalizeRuntimeEditorProblemInput(
  input: RuntimeEditorProblemInput,
  options: RuntimeEditorProblemNormalizationOptions = {},
): DefinitionProblem {
  const table = options.table ?? 'unknown';
  const defId = options.defId ?? 'unknown';
  const objectRef = options.objectRef ?? 'runtime-editor:legacy';
  const sectionId = input.sectionId ?? options.sectionId ?? options.location?.sectionId ?? 'diagnostics';
  const location = normalizeLocation({
    ...options.location,
    ...pickLocation(input),
    ...(sectionId === undefined ? {} : { sectionId }),
  });
  return {
    severity: options.severity ?? 'error',
    problemCode: options.problemCode ?? 'legacy.runtime-editor',
    objectRef,
    table,
    defId,
    sectionId,
    path: input.path ?? '',
    message: input.message,
    nextAction: options.nextAction ?? '检查并修正该问题后重试。',
    location,
  };
}

export function normalizeRuntimeEditorProblemInputs(
  inputs: readonly RuntimeEditorProblemInput[],
  options: RuntimeEditorProblemNormalizationOptions = {},
): DefinitionProblem[] {
  return inputs.map(input => normalizeRuntimeEditorProblemInput(input, options));
}

export function normalizeDefinitionProblem(
  input: RuntimeEditorProblemInput,
  options: RuntimeEditorProblemNormalizationOptions = {},
): DefinitionProblem {
  return normalizeRuntimeEditorProblemInput(input, options);
}

export function compareDefinitionProblems(left: DefinitionProblem, right: DefinitionProblem): number {
  const pathOrder = compareStrings(left.path, right.path);
  if (pathOrder !== 0) return pathOrder;

  const severityOrder = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
  if (severityOrder !== 0) return severityOrder;

  const codeOrder = compareStrings(left.problemCode, right.problemCode);
  if (codeOrder !== 0) return codeOrder;

  const objectOrder = compareStrings(left.objectRef, right.objectRef);
  if (objectOrder !== 0) return objectOrder;

  const tableOrder = compareStrings(left.table, right.table);
  if (tableOrder !== 0) return tableOrder;

  const defOrder = compareStrings(left.defId, right.defId);
  if (defOrder !== 0) return defOrder;

  const sectionOrder = compareStrings(left.sectionId, right.sectionId);
  if (sectionOrder !== 0) return sectionOrder;

  const locationOrder = compareLocations(left.location, right.location);
  if (locationOrder !== 0) return locationOrder;

  const messageOrder = compareStrings(left.message, right.message);
  if (messageOrder !== 0) return messageOrder;
  return compareStrings(left.nextAction, right.nextAction);
}

export function sortDefinitionProblems(problems: readonly DefinitionProblem[]): DefinitionProblem[] {
  return problems
    .map((problem, index) => ({ problem, index }))
    .sort((left, right) => compareDefinitionProblems(left.problem, right.problem) || left.index - right.index)
    .map(item => item.problem);
}

export function definitionProblemKey(problem: DefinitionProblem): string {
  return [
    problem.severity,
    problem.problemCode,
    problem.objectRef,
    problem.table,
    problem.defId,
    problem.sectionId,
    problem.path,
    problem.message,
    problem.nextAction,
    stableValueKey(problem.location),
  ].map(value => value === undefined ? '<undefined>' : String(value)).join('\u0000');
}

export function dedupeDefinitionProblems(problems: readonly DefinitionProblem[]): DefinitionProblem[] {
  const seen = new Set<string>();
  const result: DefinitionProblem[] = [];
  for (const problem of problems) {
    const key = definitionProblemKey(problem);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(problem);
  }
  return result;
}

export function mergeDefinitionProblems(
  ...groups: readonly (readonly DefinitionProblem[])[]
): DefinitionProblem[] {
  return sortDefinitionProblems(dedupeDefinitionProblems(groups.flat()));
}

export function summarizeDefinitionDiff<T>(
  snapshots: DefinitionThreeWaySnapshots<T>,
): DefinitionDiffSummary[];
export function summarizeDefinitionDiff<T>(
  source: T,
  draft: T,
  applied: T,
): DefinitionDiffSummary[];
export function summarizeDefinitionDiff(
  sourceOrSnapshots: unknown,
  draft?: unknown,
  applied?: unknown,
): DefinitionDiffSummary[] {
  const snapshots: DefinitionThreeWaySnapshots = arguments.length === 1
    ? sourceOrSnapshots as DefinitionThreeWaySnapshots
    : { source: sourceOrSnapshots, draft, applied };
  const paths = new Set<string>();
  collectDiffPaths(snapshots.source, '', paths);
  collectDiffPaths(snapshots.draft, '', paths);
  collectDiffPaths(snapshots.applied, '', paths);

  return [...paths].sort(compareStrings).map(path => {
    const source = valueAtPath(snapshots.source, path);
    const currentDraft = valueAtPath(snapshots.draft, path);
    const currentApplied = valueAtPath(snapshots.applied, path);
    const sourceToDraftChanged = !sameValue(source, currentDraft);
    const draftToAppliedChanged = !sameValue(currentDraft, currentApplied);
    const sourceToAppliedChanged = !sameValue(source, currentApplied);
    return {
      path,
      source,
      draft: currentDraft,
      applied: currentApplied,
      sourceToDraftChanged,
      draftToAppliedChanged,
      sourceToAppliedChanged,
      changed: sourceToDraftChanged || draftToAppliedChanged || sourceToAppliedChanged,
    };
  });
}

export const summarizeDefinitionDiffs = summarizeDefinitionDiff;

function pickLocation(input: RuntimeEditorProblemInput): DefinitionProblemLocation {
  return {
    ...(input.sectionId === undefined ? {} : { sectionId: input.sectionId }),
    ...(input.collectionId === undefined ? {} : { collectionId: input.collectionId }),
    ...(input.itemIndex === undefined ? {} : { itemIndex: input.itemIndex }),
    ...(input.childCollectionId === undefined ? {} : { childCollectionId: input.childCollectionId }),
    ...(input.childIndex === undefined ? {} : { childIndex: input.childIndex }),
  };
}

function normalizeLocation(location: DefinitionProblemLocation): DefinitionProblemLocation {
  const normalized: Record<string, string | number> = {};
  for (const key of LOCATION_KEYS) {
    const value = location[key];
    if (value !== undefined) normalized[key] = value;
  }
  return normalized as DefinitionProblemLocation;
}

function compareLocations(left: DefinitionProblemLocation, right: DefinitionProblemLocation): number {
  for (const key of LOCATION_KEYS) {
    const order = compareLocationValues(left[key], right[key]);
    if (order !== 0) return order;
  }
  return 0;
}

function compareLocationValues(left: string | number | undefined, right: string | number | undefined): number {
  if (left === right) return 0;
  if (left === undefined) return -1;
  if (right === undefined) return 1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return compareStrings(String(left), String(right));
}

function compareStrings(left: string | undefined, right: string | undefined): number {
  if (left === right) return 0;
  if (left === undefined) return -1;
  if (right === undefined) return 1;
  return left < right ? -1 : 1;
}

function collectDiffPaths(value: unknown, path: string, paths: Set<string>, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== 'object') {
    paths.add(path);
    return;
  }
  if (seen.has(value)) {
    paths.add(path);
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length === 0) paths.add(path);
    value.forEach((item, index) => collectDiffPaths(item, `${path}[${index}]`, paths, seen));
    return;
  }
  const keys = Object.keys(value).sort(compareStrings);
  if (keys.length === 0) {
    paths.add(path);
    return;
  }
  for (const key of keys) {
    collectDiffPaths((value as Record<string, unknown>)[key], path ? `${path}.${key}` : key, paths, seen);
  }
}

function valueAtPath(value: unknown, path: string): unknown {
  if (path === '') return value;
  const tokens = path.match(/[^.[\]]+|\[(\d+)\]/g);
  if (!tokens) return undefined;
  let current = value;
  for (const token of tokens) {
    const key = token.startsWith('[') ? Number(token.slice(1, -1)) : token;
    if (current === null || current === undefined || (typeof current !== 'object' && typeof current !== 'function')) return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function sameValue(left: unknown, right: unknown): boolean {
  return stableValueKey(left) === stableValueKey(right);
}

function stableValueKey(value: unknown, seen = new WeakSet<object>()): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string': return `string:${JSON.stringify(value)}`;
    case 'number': return Number.isNaN(value) ? 'number:NaN' : `number:${Object.is(value, -0) ? '-0' : value}`;
    case 'boolean': return `boolean:${value}`;
    case 'bigint': return `bigint:${value.toString()}`;
    case 'symbol': return `symbol:${String(value)}`;
    case 'function': return `function:${String(value)}`;
  }
  if (seen.has(value)) return 'circular';
  seen.add(value);
  if (value instanceof Date) return `date:${value.toISOString()}`;
  if (Array.isArray(value)) return `array:[${value.map(item => stableValueKey(item, seen)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `object:{${Object.keys(record).sort(compareStrings).map(key => `${JSON.stringify(key)}:${stableValueKey(record[key], seen)}`).join(',')}}`;
}
